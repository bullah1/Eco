-- POS phase 2a: restaurant tickets, kitchen order tickets (KOT), restaurant payments.
-- Run after pos-phase1.sql.
--
-- A ticket is one table's (or one counter customer's) running order. Dishes are priced
-- from the menu on the server. "Send to kitchen" creates a KOT with only the new dishes.
-- A ticket ends one of three ways: paid now, charged to a guest's room bill, or cancelled.

CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 40),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.restaurant_ticket_seq START 1001;
CREATE TABLE IF NOT EXISTS public.restaurant_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text NOT NULL UNIQUE DEFAULT ('R' || nextval('public.restaurant_ticket_seq')::text),
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'charged', 'cancelled')),
  account_id uuid REFERENCES public.stay_accounts(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  cancel_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_tickets_one_open_per_table
  ON public.restaurant_tickets (table_id) WHERE status = 'open' AND table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS restaurant_tickets_status_idx ON public.restaurant_tickets (status, opened_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_tickets_closed_idx ON public.restaurant_tickets (closed_at);

CREATE TABLE IF NOT EXISTS public.restaurant_ticket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.restaurant_tickets(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  quantity integer NOT NULL CHECK (quantity BETWEEN 0 AND 999),
  sent_qty integer NOT NULL DEFAULT 0 CHECK (sent_qty >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sent_qty <= quantity),
  UNIQUE (ticket_id, menu_item_id)
);

CREATE SEQUENCE IF NOT EXISTS public.kitchen_ticket_seq START 1;
CREATE TABLE IF NOT EXISTS public.kitchen_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kot_no text NOT NULL UNIQUE DEFAULT ('K' || nextval('public.kitchen_ticket_seq')::text),
  ticket_id uuid NOT NULL REFERENCES public.restaurant_tickets(id) ON DELETE CASCADE,
  items jsonb NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'ready', 'served')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kitchen_tickets_status_idx ON public.kitchen_tickets (status, created_at);

CREATE TABLE IF NOT EXISTS public.restaurant_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.restaurant_tickets(id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (method IN ('cash', 'bkash', 'nagad', 'card', 'bank')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reference text NOT NULL DEFAULT '',
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text
);
CREATE INDEX IF NOT EXISTS restaurant_payments_created_idx ON public.restaurant_payments (created_at);

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_payments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['restaurant_tables','restaurant_tickets','restaurant_ticket_items','kitchen_tickets','restaurant_payments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff can view" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Staff can view" ON public.%I FOR SELECT TO authenticated USING (public.is_staff((SELECT auth.uid())))', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

INSERT INTO public.restaurant_tables (name, sort_order) VALUES
  ('T-1', 1), ('T-2', 2), ('T-3', 3), ('T-4', 4), ('T-5', 5), ('T-6', 6), ('Beach 1', 7), ('Beach 2', 8)
ON CONFLICT (name) DO NOTHING;

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.pos_lock_open_ticket(p_ticket uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.restaurant_tickets WHERE id = p_ticket FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'This order is already closed' USING ERRCODE = 'P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pos_ticket_total(p_ticket uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT COALESCE(SUM(quantity::bigint * unit_price_cents), 0) FROM public.restaurant_ticket_items WHERE ticket_id = p_ticket $$;

-- ---------- tickets ----------
CREATE OR REPLACE FUNCTION public.pos_open_ticket(p_table uuid, p_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.pos_require_staff();
  IF p_table IS NOT NULL THEN
    PERFORM 1 FROM public.restaurant_tables WHERE id = p_table AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Table not found' USING ERRCODE = 'P0001'; END IF;
    SELECT id INTO v_id FROM public.restaurant_tickets WHERE table_id = p_table AND status = 'open';
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  INSERT INTO public.restaurant_tickets (table_id, label, opened_by)
  VALUES (p_table, left(btrim(COALESCE(p_label, '')), 60), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_id FROM public.restaurant_tickets WHERE table_id = p_table AND status = 'open';
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_ticket_set_item(p_ticket uuid, p_menu_item uuid, p_quantity int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE line record; m record; v_admin boolean;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_ticket(p_ticket);
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 999 THEN
    RAISE EXCEPTION 'Quantity must be between 0 and 999' USING ERRCODE = 'P0001';
  END IF;
  v_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  SELECT * INTO line FROM public.restaurant_ticket_items WHERE ticket_id = p_ticket AND menu_item_id = p_menu_item FOR UPDATE;
  IF FOUND THEN
    IF p_quantity < line.sent_qty AND NOT v_admin THEN
      RAISE EXCEPTION '% × % already went to the kitchen. Only an admin can take it off', line.name, line.sent_qty USING ERRCODE = 'P0001';
    END IF;
    IF p_quantity = 0 AND (line.sent_qty = 0 OR v_admin) THEN
      DELETE FROM public.restaurant_ticket_items WHERE id = line.id;
    ELSE
      UPDATE public.restaurant_ticket_items SET quantity = p_quantity, sent_qty = LEAST(sent_qty, p_quantity) WHERE id = line.id;
    END IF;
    RETURN;
  END IF;
  IF p_quantity = 0 THEN RETURN; END IF;
  SELECT * INTO m FROM public.menu_items WHERE id = p_menu_item AND is_available;
  IF NOT FOUND THEN RAISE EXCEPTION 'This dish is not available' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.restaurant_ticket_items (ticket_id, menu_item_id, name, unit_price_cents, quantity)
  VALUES (p_ticket, m.id, m.name, m.price_cents, p_quantity);
END $$;

CREATE OR REPLACE FUNCTION public.pos_ticket_set_note(p_ticket uuid, p_label text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_ticket(p_ticket);
  UPDATE public.restaurant_tickets SET label = left(btrim(COALESCE(p_label, '')), 60), note = left(btrim(COALESCE(p_note, '')), 300)
   WHERE id = p_ticket;
END $$;

CREATE OR REPLACE FUNCTION public.pos_send_kot(p_ticket uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_items jsonb; v_no text;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_ticket(p_ticket);
  SELECT jsonb_agg(jsonb_build_object('name', name, 'qty', quantity - sent_qty) ORDER BY created_at)
    INTO v_items
  FROM public.restaurant_ticket_items WHERE ticket_id = p_ticket AND quantity > sent_qty;
  IF v_items IS NULL THEN
    RAISE EXCEPTION 'Nothing new to send to the kitchen' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.kitchen_tickets (ticket_id, items, created_by) VALUES (p_ticket, v_items, auth.uid())
  RETURNING kot_no INTO v_no;
  UPDATE public.restaurant_ticket_items SET sent_qty = quantity WHERE ticket_id = p_ticket AND quantity > sent_qty;
  RETURN v_no;
END $$;

CREATE OR REPLACE FUNCTION public.pos_ticket_pay(p_ticket uuid, p_method text, p_reference text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total bigint; v_ref text := btrim(COALESCE(p_reference, ''));
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_ticket(p_ticket);
  IF p_method NOT IN ('cash', 'bkash', 'nagad', 'card', 'bank') THEN
    RAISE EXCEPTION 'Choose how the guest paid' USING ERRCODE = 'P0001';
  END IF;
  IF p_method IN ('bkash', 'nagad', 'bank') AND char_length(v_ref) < 4 THEN
    RAISE EXCEPTION 'Enter the transaction ID' USING ERRCODE = 'P0001';
  END IF;
  v_total := public.pos_ticket_total(p_ticket);
  IF v_total <= 0 THEN RAISE EXCEPTION 'Add a dish before taking payment' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.restaurant_payments (ticket_id, method, amount_cents, reference, received_by)
  VALUES (p_ticket, p_method, v_total, left(v_ref, 80), auth.uid());
  UPDATE public.restaurant_tickets SET status = 'paid', closed_at = now(), closed_by = auth.uid() WHERE id = p_ticket;
  RETURN v_total;
END $$;

CREATE OR REPLACE FUNCTION public.pos_ticket_charge_room(p_ticket uuid, p_account uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total bigint; v_where text;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_ticket(p_ticket);
  PERFORM public.pos_lock_open_account(p_account);
  v_total := public.pos_ticket_total(p_ticket);
  IF v_total <= 0 THEN RAISE EXCEPTION 'Add a dish before charging the room' USING ERRCODE = 'P0001'; END IF;
  SELECT COALESCE(NULLIF(t.label, ''), rt.name, t.ticket_no) INTO v_where
  FROM public.restaurant_tickets t LEFT JOIN public.restaurant_tables rt ON rt.id = t.table_id WHERE t.id = p_ticket;
  INSERT INTO public.account_charges (account_id, kind, source, description, quantity, unit_price_cents, created_by)
  SELECT p_account, 'food', 'restaurant', left(i.name || ' · ' || v_where, 300), i.quantity, i.unit_price_cents, auth.uid()
  FROM public.restaurant_ticket_items i WHERE i.ticket_id = p_ticket AND i.quantity > 0
  ORDER BY i.created_at;
  UPDATE public.restaurant_tickets SET status = 'charged', account_id = p_account, closed_at = now(), closed_by = auth.uid()
   WHERE id = p_ticket;
  RETURN v_total;
END $$;

CREATE OR REPLACE FUNCTION public.pos_cancel_ticket(p_ticket uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_ticket(p_ticket);
  IF EXISTS (SELECT 1 FROM public.restaurant_ticket_items WHERE ticket_id = p_ticket AND sent_qty > 0) THEN
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Food already went to the kitchen. Ask an admin to cancel this order' USING ERRCODE = 'P0001';
    END IF;
    IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
      RAISE EXCEPTION 'Write why this order is cancelled' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  UPDATE public.restaurant_tickets SET status = 'cancelled', closed_at = now(), closed_by = auth.uid(),
         cancel_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
   WHERE id = p_ticket;
  UPDATE public.kitchen_tickets SET status = 'served', updated_at = now() WHERE ticket_id = p_ticket AND status <> 'served';
END $$;

-- ---------- kitchen ----------
CREATE OR REPLACE FUNCTION public.pos_set_kot_status(p_kot uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pos_require_staff();
  IF p_status NOT IN ('new', 'preparing', 'ready', 'served') THEN
    RAISE EXCEPTION 'Unknown kitchen status' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.kitchen_tickets SET status = p_status, updated_at = now() WHERE id = p_kot;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kitchen ticket not found' USING ERRCODE = 'P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pos_set_web_order_status(p_order uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE o record;
BEGIN
  PERFORM public.pos_require_staff();
  IF p_status NOT IN ('confirmed', 'preparing', 'served', 'cancelled') THEN
    RAISE EXCEPTION 'Unknown order status' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO o FROM public.service_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001'; END IF;
  IF p_status = 'cancelled' AND o.bill_status <> 'unbilled' THEN
    RAISE EXCEPTION 'This order is already on a bill. Remove it from the bill first' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.service_orders SET status = p_status WHERE id = p_order;
END $$;

CREATE OR REPLACE FUNCTION public.pos_save_table(p_id uuid, p_name text, p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.pos_require_admin();
  IF char_length(btrim(COALESCE(p_name, ''))) = 0 THEN RAISE EXCEPTION 'Name the table' USING ERRCODE = 'P0001'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.restaurant_tables (name, sort_order)
    VALUES (btrim(p_name), COALESCE((SELECT max(sort_order) + 1 FROM public.restaurant_tables), 1))
    RETURNING id INTO v_id;
  ELSE
    IF NOT p_active AND EXISTS (SELECT 1 FROM public.restaurant_tickets WHERE table_id = p_id AND status = 'open') THEN
      RAISE EXCEPTION 'This table has an open order' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.restaurant_tables SET name = btrim(p_name), is_active = p_active WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'A table with this name already exists' USING ERRCODE = 'P0001';
END $$;

REVOKE ALL ON FUNCTION public.pos_lock_open_ticket(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_ticket_total(uuid) FROM PUBLIC, anon, authenticated;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_open_ticket(uuid,text)',
    'pos_ticket_set_item(uuid,uuid,integer)',
    'pos_ticket_set_note(uuid,text,text)',
    'pos_send_kot(uuid)',
    'pos_ticket_pay(uuid,text,text)',
    'pos_ticket_charge_room(uuid,uuid)',
    'pos_cancel_ticket(uuid,text)',
    'pos_set_kot_status(uuid,text)',
    'pos_set_web_order_status(uuid,text)',
    'pos_save_table(uuid,text,boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
