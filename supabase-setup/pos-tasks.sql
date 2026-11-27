-- POS: tasks, repairs and guest requests for staff.
-- A repair can take its room out of order; when the last such repair is done the room
-- goes back to "needs cleaning" so housekeeping checks it before the next guest.

CREATE SEQUENCE IF NOT EXISTS public.pos_task_seq START 1;

CREATE TABLE IF NOT EXISTS public.pos_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_no text NOT NULL DEFAULT ('T' || nextval('public.pos_task_seq')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),
  detail text NOT NULL DEFAULT '' CHECK (char_length(detail) <= 1000),
  kind text NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'repair', 'guest_request')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  room_unit_id uuid REFERENCES public.room_units(id) ON DELETE SET NULL,
  blocks_room boolean NOT NULL DEFAULT false,
  assigned_to uuid,
  assigned_name text NOT NULL DEFAULT '',
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz,
  done_by_name text NOT NULL DEFAULT '',
  done_note text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS pos_tasks_open_idx ON public.pos_tasks (status, due_date);
CREATE INDEX IF NOT EXISTS pos_tasks_room_idx ON public.pos_tasks (room_unit_id) WHERE status IN ('open', 'in_progress');

ALTER TABLE public.pos_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read tasks" ON public.pos_tasks;
CREATE POLICY "staff read tasks" ON public.pos_tasks
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
REVOKE ALL ON public.pos_tasks FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.pos_tasks FROM authenticated;
GRANT SELECT ON public.pos_tasks TO authenticated;

-- Staff names anyone at the desk can assign work to.
CREATE OR REPLACE FUNCTION public.pos_staff_names()
RETURNS TABLE (user_id uuid, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pos_require_staff();
  RETURN QUERY
  SELECT DISTINCT ON (ur.user_id) ur.user_id,
         COALESCE(NULLIF(btrim(p.display_name), ''), split_part(COALESCE(p.email, u.email), '@', 1))::text
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role IN ('admin', 'staff')
  ORDER BY ur.user_id;
END $$;

-- The room is out of order while any open repair blocks it.
CREATE OR REPLACE FUNCTION public.pos_task_room_sync(p_room uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_room IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.pos_tasks
              WHERE room_unit_id = p_room AND blocks_room AND status IN ('open', 'in_progress')) THEN
    UPDATE public.room_units SET housekeeping = 'maintenance' WHERE id = p_room;
  ELSE
    UPDATE public.room_units SET housekeeping = 'dirty'
     WHERE id = p_room AND housekeeping = 'maintenance';
  END IF;
END $$;

-- Create (p_id NULL) or change a task.
CREATE OR REPLACE FUNCTION public.pos_task_save(
  p_id uuid, p_title text, p_detail text, p_kind text, p_priority text,
  p_room uuid, p_assignee uuid, p_due date, p_blocks_room boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := p_id;
  v_old_room uuid;
  v_old_blocks boolean := false;
  v_name text := '';
BEGIN
  PERFORM public.pos_require_staff();
  IF char_length(btrim(COALESCE(p_title, ''))) < 2 THEN
    RAISE EXCEPTION 'Write what needs doing' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind NOT IN ('task', 'repair', 'guest_request') OR p_priority NOT IN ('normal', 'urgent') THEN
    RAISE EXCEPTION 'Unknown task type' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_blocks_room, false) AND (p_kind <> 'repair' OR p_room IS NULL) THEN
    RAISE EXCEPTION 'Only a repair in a room can take the room out of order' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_blocks_room, false) AND EXISTS (
       SELECT 1 FROM public.reservations WHERE room_unit_id = p_room AND stay_status = 'in_house') THEN
    RAISE EXCEPTION 'A guest is staying in this room. Move them before taking it out of order' USING ERRCODE = 'P0001';
  END IF;
  IF p_due IS NOT NULL AND p_due < public.resort_today() - 1 THEN
    RAISE EXCEPTION 'The due date is in the past' USING ERRCODE = 'P0001';
  END IF;
  IF p_assignee IS NOT NULL THEN
    SELECT s.name INTO v_name FROM public.pos_staff_names() s WHERE s.user_id = p_assignee;
    IF v_name IS NULL THEN RAISE EXCEPTION 'That person is not on the staff list' USING ERRCODE = 'P0001'; END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.pos_tasks (title, detail, kind, priority, room_unit_id, blocks_room,
                                  assigned_to, assigned_name, due_date, created_by, created_by_name)
    VALUES (btrim(p_title), left(btrim(COALESCE(p_detail, '')), 1000), p_kind, p_priority, p_room,
            COALESCE(p_blocks_room, false), p_assignee, COALESCE(v_name, ''), p_due,
            auth.uid(), public.pos_actor_name())
    RETURNING id INTO v_id;
  ELSE
    SELECT room_unit_id, blocks_room INTO v_old_room, v_old_blocks FROM public.pos_tasks WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.pos_tasks WHERE id = v_id AND status IN ('done', 'cancelled')) THEN
      RAISE EXCEPTION 'This task is finished. Open a new one instead' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.pos_tasks
       SET title = btrim(p_title), detail = left(btrim(COALESCE(p_detail, '')), 1000), kind = p_kind,
           priority = p_priority, room_unit_id = p_room, blocks_room = COALESCE(p_blocks_room, false),
           assigned_to = p_assignee, assigned_name = COALESCE(v_name, ''), due_date = p_due,
           updated_at = now()
     WHERE id = v_id;
    -- Only rooms a repair blocks (or used to block) are touched, so a room someone put
    -- out of order by hand stays that way.
    IF v_old_blocks AND v_old_room IS DISTINCT FROM p_room THEN
      PERFORM public.pos_task_room_sync(v_old_room);
    END IF;
  END IF;
  IF COALESCE(p_blocks_room, false) OR (v_old_blocks AND v_old_room = p_room) THEN
    PERFORM public.pos_task_room_sync(p_room);
  END IF;
  RETURN v_id;
END $$;

-- Start, finish, reopen or cancel a task.
CREATE OR REPLACE FUNCTION public.pos_task_set_status(p_id uuid, p_status text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t record;
BEGIN
  PERFORM public.pos_require_staff();
  IF p_status NOT IN ('open', 'in_progress', 'done', 'cancelled') THEN
    RAISE EXCEPTION 'Unknown status' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO t FROM public.pos_tasks WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0001'; END IF;
  IF p_status = 'cancelled' AND char_length(btrim(COALESCE(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Write why the task is cancelled' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.pos_tasks
     SET status = p_status,
         updated_at = now(),
         done_at = CASE WHEN p_status IN ('done', 'cancelled') THEN now() ELSE NULL END,
         done_by_name = CASE WHEN p_status IN ('done', 'cancelled') THEN public.pos_actor_name() ELSE '' END,
         done_note = CASE WHEN p_status IN ('done', 'cancelled') THEN left(btrim(COALESCE(p_note, '')), 500) ELSE '' END
   WHERE id = p_id;
  IF t.blocks_room THEN PERFORM public.pos_task_room_sync(t.room_unit_id); END IF;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_staff_names()',
    'pos_task_save(uuid,text,text,text,text,uuid,uuid,date,boolean)',
    'pos_task_set_status(uuid,text,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.pos_task_room_sync(uuid) FROM PUBLIC, anon, authenticated;
END $$;
