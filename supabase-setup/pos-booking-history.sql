-- POS: booking history and tracking.
-- Every change to a booking is written to booking_events by a trigger, so it is
-- recorded whichever screen or website flow made it: booked (website or front desk),
-- confirmed, checked in, dates changed, extra nights, room moved, cancelled, checked out.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS booked_via text NOT NULL DEFAULT 'website'
  CHECK (booked_via IN ('website', 'front_desk'));

CREATE TABLE IF NOT EXISTS public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  booking_group text,
  kind text NOT NULL CHECK (kind IN
    ('booked', 'confirmed', 'checked_in', 'dates_changed', 'extended', 'room_moved',
     'cancelled', 'checked_out', 'reopened')),
  detail text NOT NULL DEFAULT '',
  actor_id uuid,
  actor_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_events_res_idx ON public.booking_events (reservation_id, created_at);
CREATE INDEX IF NOT EXISTS booking_events_group_idx ON public.booking_events (booking_group);

ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read booking events" ON public.booking_events;
CREATE POLICY "staff read booking events" ON public.booking_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
REVOKE ALL ON public.booking_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.booking_events FROM authenticated;
GRANT SELECT ON public.booking_events TO authenticated;

-- Name of whoever made the change: staff name/email, "Website guest", or "Automatic".
CREATE OR REPLACE FUNCTION public.pos_actor_name()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'Automatic'
    WHEN NOT public.is_staff(auth.uid()) THEN 'Website guest'
    ELSE COALESCE(
      (SELECT NULLIF(btrim(p.display_name), '') FROM public.profiles p WHERE p.id = auth.uid()),
      (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()),
      'Staff')
  END
$$;

CREATE OR REPLACE FUNCTION public.pos_log_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text := public.pos_actor_name();
  v_uid uuid := auth.uid();
  v_old_room text; v_new_room text;
  ev text[] := '{}'; det text[] := '{}';
  i int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    ev := ev || 'booked'::text;
    det := det || format('%s – %s, %s %s%s',
      to_char(NEW.check_in, 'DD Mon YYYY'), to_char(NEW.check_out, 'DD Mon YYYY'),
      NEW.check_out - NEW.check_in, CASE WHEN NEW.check_out - NEW.check_in = 1 THEN 'night' ELSE 'nights' END,
      CASE WHEN NEW.booked_via = 'website' THEN ' · website' ELSE ' · front desk' END);
  ELSE
    IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
      ev := ev || 'confirmed'::text; det := det || ''::text;
    END IF;
    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      ev := ev || 'cancelled'::text;
      det := det || COALESCE(substring(NEW.guest_note FROM 'Cancelled: ([^\n]*)$'), '');
    END IF;
    IF NEW.stay_status = 'in_house' AND OLD.stay_status = 'expected' THEN
      ev := ev || 'checked_in'::text; det := det || ''::text;
    END IF;
    IF NEW.stay_status = 'checked_out' AND OLD.stay_status <> 'checked_out' THEN
      ev := ev || 'checked_out'::text; det := det || ''::text;
    END IF;
    IF NEW.stay_status = 'in_house' AND OLD.stay_status = 'checked_out' THEN
      ev := ev || 'reopened'::text; det := det || ''::text;
    END IF;
    IF NEW.room_unit_id <> OLD.room_unit_id THEN
      SELECT name INTO v_old_room FROM public.room_units WHERE id = OLD.room_unit_id;
      SELECT name INTO v_new_room FROM public.room_units WHERE id = NEW.room_unit_id;
      ev := ev || 'room_moved'::text;
      det := det || format('%s → %s', COALESCE(v_old_room, '?'), COALESCE(v_new_room, '?'));
    END IF;
    IF NEW.extended_nights > OLD.extended_nights THEN
      ev := ev || 'extended'::text;
      det := det || format('Stayed %s extra %s past %s, billed automatically',
        NEW.extended_nights - OLD.extended_nights,
        CASE WHEN NEW.extended_nights - OLD.extended_nights = 1 THEN 'night' ELSE 'nights' END,
        to_char(OLD.check_out, 'DD Mon'));
    ELSIF NEW.check_in <> OLD.check_in OR NEW.check_out <> OLD.check_out THEN
      ev := ev || 'dates_changed'::text;
      det := det || format('%s – %s → %s – %s',
        to_char(OLD.check_in, 'DD Mon'), to_char(OLD.check_out, 'DD Mon'),
        to_char(NEW.check_in, 'DD Mon'), to_char(NEW.check_out, 'DD Mon'));
    END IF;
  END IF;

  FOR i IN 1 .. COALESCE(array_length(ev, 1), 0) LOOP
    INSERT INTO public.booking_events (reservation_id, booking_group, kind, detail, actor_id, actor_name)
    VALUES (NEW.id, NEW.booking_group, ev[i], det[i], v_uid,
            CASE WHEN ev[i] = 'extended' AND v_uid IS NULL THEN 'Automatic' ELSE v_actor END);
  END LOOP;
  RETURN NEW;
END $$;

-- Stamp where a new booking came from (staff = front desk), before the row is written.
CREATE OR REPLACE FUNCTION public.pos_stamp_booked_via()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.booked_via := CASE WHEN auth.uid() IS NOT NULL AND public.is_staff(auth.uid())
                         THEN 'front_desk' ELSE 'website' END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reservations_booked_via ON public.reservations;
CREATE TRIGGER reservations_booked_via BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.pos_stamp_booked_via();

DROP TRIGGER IF EXISTS reservations_log ON public.reservations;
CREATE TRIGGER reservations_log AFTER INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.pos_log_booking();

REVOKE ALL ON FUNCTION public.pos_log_booking() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_stamp_booked_via() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_actor_name() FROM PUBLIC, anon, authenticated;

-- Follow-ups applied live:
-- 1) A new booking with nobody signed in is logged as "Website guest" (pos_log_actor).
CREATE OR REPLACE FUNCTION public.pos_log_actor(p_kind text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN p_kind = 'booked' AND auth.uid() IS NULL THEN 'Website guest'
              ELSE public.pos_actor_name() END
$$;
REVOKE ALL ON FUNCTION public.pos_log_actor(text) FROM PUBLIC, anon, authenticated;
--    (pos_log_booking inserts actor_name = public.pos_log_actor(ev[i]))
-- 2) Exact event times, and history for bookings made before this log existed.
ALTER TABLE public.booking_events ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_booked_via_check;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_booked_via_check
  CHECK (booked_via IN ('website', 'front_desk', 'unknown'));
-- (existing rows set to 'unknown'; booked / checked_in / checked_out events back-filled
--  from created_at, checked_in_at and checked_out_at)
