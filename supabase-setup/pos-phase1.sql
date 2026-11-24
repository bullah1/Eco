-- POS phase 1: front desk, guest accounts (one bill per stay), charges and payments.
-- Run after the earlier setup files. Requires: ALTER TYPE public.app_role ADD VALUE 'staff'; (run on its own first)
--
-- Rules
--  * A stay account collects everything a guest owes: rooms, food, services. They pay once.
--  * Charges and payments are never edited or deleted. Mistakes are voided with a reason (admin only).
--  * All writes go through the pos_* functions below. Staff can only read the tables.

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.resort_today()
RETURNS date LANGUAGE sql STABLE
SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'Asia/Dhaka')::date $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'staff'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.pos_require_staff()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only resort staff can do this' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pos_require_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an admin can do this' USING ERRCODE = '42501';
  END IF;
END $$;

-- ---------- tables ----------
CREATE SEQUENCE IF NOT EXISTS public.stay_account_seq START 1001;

CREATE TABLE IF NOT EXISTS public.stay_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_no text NOT NULL UNIQUE DEFAULT ('A' || nextval('public.stay_account_seq')::text),
  guest_name text NOT NULL CHECK (char_length(guest_name) BETWEEN 1 AND 120),
  guest_phone text NOT NULL DEFAULT '',
  guest_email text NOT NULL DEFAULT '',
  booking_group text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  note text NOT NULL DEFAULT '',
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS stay_accounts_status_idx ON public.stay_accounts (status, opened_at DESC);
CREATE INDEX IF NOT EXISTS stay_accounts_phone_idx ON public.stay_accounts (guest_phone);

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.stay_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stay_status text NOT NULL DEFAULT 'expected'
    CHECK (stay_status IN ('expected', 'in_house', 'checked_out')),
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;
CREATE INDEX IF NOT EXISTS reservations_account_idx ON public.reservations (account_id);
CREATE INDEX IF NOT EXISTS reservations_dates_idx ON public.reservations (check_in, check_out);

ALTER TABLE public.room_units
  ADD COLUMN IF NOT EXISTS housekeeping text NOT NULL DEFAULT 'clean'
    CHECK (housekeeping IN ('clean', 'dirty', 'maintenance'));

CREATE TABLE IF NOT EXISTS public.account_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.stay_accounts(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('room', 'food', 'service', 'other')),
  source text NOT NULL DEFAULT 'front_desk' CHECK (source IN ('front_desk', 'restaurant', 'website')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 300),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents BETWEEN 0 AND 1000000000),
  amount_cents bigint GENERATED ALWAYS AS (quantity::bigint * unit_price_cents) STORED,
  charge_date date NOT NULL DEFAULT public.resort_today(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  order_id uuid UNIQUE REFERENCES public.service_orders(id) ON DELETE SET NULL,
  addon_id uuid REFERENCES public.resort_addons(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text
);
CREATE INDEX IF NOT EXISTS account_charges_account_idx ON public.account_charges (account_id, created_at);
CREATE INDEX IF NOT EXISTS account_charges_date_idx ON public.account_charges (charge_date);

CREATE TABLE IF NOT EXISTS public.account_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.stay_accounts(id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (method IN ('cash', 'bkash', 'nagad', 'card', 'bank')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reference text NOT NULL DEFAULT '',
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text
);
CREATE INDEX IF NOT EXISTS account_payments_account_idx ON public.account_payments (account_id, created_at);
CREATE INDEX IF NOT EXISTS account_payments_created_idx ON public.account_payments (created_at);

-- Totals per account. security_invoker so RLS of the base tables applies.
CREATE OR REPLACE VIEW public.stay_account_totals WITH (security_invoker = true) AS
SELECT a.id AS account_id,
  COALESCE(c.room, 0)::bigint AS room_cents,
  COALESCE(c.food, 0)::bigint AS food_cents,
  COALESCE(c.service, 0)::bigint AS service_cents,
  COALESCE(c.total, 0)::bigint AS charges_cents,
  COALESCE(p.paid, 0)::bigint AS paid_cents,
  (COALESCE(c.total, 0) - COALESCE(p.paid, 0))::bigint AS balance_cents
FROM public.stay_accounts a
LEFT JOIN LATERAL (
  SELECT SUM(amount_cents) FILTER (WHERE kind = 'room') AS room,
         SUM(amount_cents) FILTER (WHERE kind = 'food') AS food,
         SUM(amount_cents) FILTER (WHERE kind IN ('service', 'other')) AS service,
         SUM(amount_cents) AS total
  FROM public.account_charges WHERE account_id = a.id AND voided_at IS NULL
) c ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount_cents) AS paid
  FROM public.account_payments WHERE account_id = a.id AND voided_at IS NULL
) p ON true;

-- ---------- row level security: staff read, nobody writes directly ----------
ALTER TABLE public.stay_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view accounts" ON public.stay_accounts;
CREATE POLICY "Staff can view accounts" ON public.stay_accounts FOR SELECT TO authenticated
  USING (public.is_staff((SELECT auth.uid())));
DROP POLICY IF EXISTS "Staff can view charges" ON public.account_charges;
CREATE POLICY "Staff can view charges" ON public.account_charges FOR SELECT TO authenticated
  USING (public.is_staff((SELECT auth.uid())));
DROP POLICY IF EXISTS "Staff can view payments" ON public.account_payments;
CREATE POLICY "Staff can view payments" ON public.account_payments FOR SELECT TO authenticated
  USING (public.is_staff((SELECT auth.uid())));

DROP POLICY IF EXISTS "Staff can view reservations" ON public.reservations;
CREATE POLICY "Staff can view reservations" ON public.reservations FOR SELECT TO authenticated
  USING (public.is_staff((SELECT auth.uid())));
DROP POLICY IF EXISTS "Staff can view orders" ON public.service_orders;
CREATE POLICY "Staff can view orders" ON public.service_orders FOR SELECT TO authenticated
  USING (public.is_staff((SELECT auth.uid())));
DROP POLICY IF EXISTS "Staff can view order items" ON public.service_order_items;
CREATE POLICY "Staff can view order items" ON public.service_order_items FOR SELECT TO authenticated
  USING (public.is_staff((SELECT auth.uid())));
DROP POLICY IF EXISTS "Staff can view room units" ON public.room_units;
CREATE POLICY "Staff can view room units" ON public.room_units FOR SELECT TO authenticated
  USING (public.is_staff((SELECT auth.uid())));

GRANT SELECT ON public.stay_accounts, public.account_charges, public.account_payments TO authenticated;
GRANT SELECT ON public.stay_account_totals TO authenticated;
REVOKE ALL ON public.stay_accounts, public.account_charges, public.account_payments, public.stay_account_totals FROM anon;

-- ---------- internal: post the room charge for one reservation ----------
CREATE OR REPLACE FUNCTION public.pos_post_room_charge(p_reservation uuid, p_account uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  SELECT res.id, res.check_in, res.check_out, res.nightly_rate_cents, ru.name AS unit, rt.name AS type_name
    INTO r
  FROM public.reservations res
  JOIN public.room_units ru ON ru.id = res.room_unit_id
  JOIN public.room_types rt ON rt.id = ru.room_type_id
  WHERE res.id = p_reservation;

  INSERT INTO public.account_charges
    (account_id, kind, source, description, quantity, unit_price_cents, charge_date, reservation_id, created_by)
  VALUES
    (p_account, 'room', 'front_desk',
     format('%s · %s · %s to %s, breakfast included', r.type_name, r.unit,
            to_char(r.check_in, 'DD Mon'), to_char(r.check_out, 'DD Mon')),
     (r.check_out - r.check_in), r.nightly_rate_cents, r.check_in, r.id, auth.uid());
END $$;

-- ---------- check in (website bookings) ----------
CREATE OR REPLACE FUNCTION public.pos_check_in(p_reservation_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account uuid;
  v_first record;
  v_count int;
  v_id uuid;
BEGIN
  PERFORM public.pos_require_staff();
  IF p_reservation_ids IS NULL OR cardinality(p_reservation_ids) = 0 THEN
    RAISE EXCEPTION 'Choose at least one room to check in' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.reservations WHERE id = ANY (p_reservation_ids) FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.reservations WHERE id = ANY (p_reservation_ids);
  IF v_count <> cardinality(p_reservation_ids) THEN
    RAISE EXCEPTION 'Some of these bookings no longer exist' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reservations WHERE id = ANY (p_reservation_ids) AND status = 'cancelled') THEN
    RAISE EXCEPTION 'A cancelled booking cannot be checked in' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reservations WHERE id = ANY (p_reservation_ids) AND stay_status <> 'expected') THEN
    RAISE EXCEPTION 'One of these rooms is already checked in or checked out' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reservations WHERE id = ANY (p_reservation_ids) AND check_in > public.resort_today()) THEN
    RAISE EXCEPTION 'This booking starts on a later date. Change the dates before checking in early' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reservations WHERE id = ANY (p_reservation_ids) AND check_out <= public.resort_today()) THEN
    RAISE EXCEPTION 'This booking has already ended' USING ERRCODE = 'P0001';
  END IF;

  SELECT r.guest_name, r.guest_phone, r.guest_email, r.booking_group, r.user_id,
         p.display_name, p.phone AS profile_phone, p.email AS profile_email
    INTO v_first
  FROM public.reservations r LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.id = ANY (p_reservation_ids)
  ORDER BY r.created_at LIMIT 1;

  INSERT INTO public.stay_accounts (guest_name, guest_phone, guest_email, booking_group, opened_by)
  VALUES (
    COALESCE(NULLIF(v_first.guest_name, ''), NULLIF(v_first.display_name, ''), 'Guest'),
    COALESCE(NULLIF(v_first.guest_phone, ''), v_first.profile_phone, ''),
    COALESCE(NULLIF(v_first.guest_email, ''), v_first.profile_email, ''),
    v_first.booking_group,
    auth.uid())
  RETURNING id INTO v_account;

  UPDATE public.reservations
     SET status = 'confirmed', stay_status = 'in_house', account_id = v_account, checked_in_at = now()
   WHERE id = ANY (p_reservation_ids);

  FOREACH v_id IN ARRAY p_reservation_ids LOOP
    PERFORM public.pos_post_room_charge(v_id, v_account);
  END LOOP;

  -- Website orders already placed against these bookings join the same account.
  INSERT INTO public.account_charges (account_id, kind, source, description, quantity, unit_price_cents, order_id, created_by)
  SELECT v_account, 'food', 'website', 'Website order ' || o.order_number, 1, o.subtotal_cents, o.id, auth.uid()
  FROM public.service_orders o
  WHERE o.reservation_id = ANY (p_reservation_ids) AND o.bill_status = 'unbilled' AND o.status <> 'cancelled'
    AND NOT EXISTS (SELECT 1 FROM public.account_charges c WHERE c.order_id = o.id);
  UPDATE public.service_orders SET bill_status = 'billed'
   WHERE reservation_id = ANY (p_reservation_ids) AND bill_status = 'unbilled' AND status <> 'cancelled';

  RETURN v_account;
END $$;

-- ---------- walk-in guest: book and check in at once ----------
CREATE OR REPLACE FUNCTION public.pos_walk_in(
  p_name text, p_phone text, p_email text, p_check_out date, p_rooms jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := public.resort_today();
  v_group text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_ids uuid[] := '{}';
  v_room jsonb;
  v_id uuid;
  v_unit_name text;
BEGIN
  PERFORM public.pos_require_staff();
  IF char_length(btrim(COALESCE(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Enter the guest''s full name' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_phone, '') !~ '^\+?[0-9 -]{7,20}$' THEN
    RAISE EXCEPTION 'Enter a valid mobile number' USING ERRCODE = 'P0001';
  END IF;
  IF p_check_out IS NULL OR p_check_out <= v_today THEN
    RAISE EXCEPTION 'The departure date must be after today' USING ERRCODE = 'P0001';
  END IF;
  IF p_check_out > v_today + 60 THEN
    RAISE EXCEPTION 'A walk-in stay can be at most 60 nights' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_rooms) <> 'array' OR jsonb_array_length(p_rooms) = 0 THEN
    RAISE EXCEPTION 'Choose at least one room' USING ERRCODE = 'P0001';
  END IF;

  FOR v_room IN SELECT * FROM jsonb_array_elements(p_rooms) LOOP
    SELECT name INTO v_unit_name FROM public.room_units WHERE id = (v_room->>'unit_id')::uuid;
    BEGIN
      INSERT INTO public.reservations
        (room_unit_id, check_in, check_out, guest_count, status, guest_name, guest_phone, guest_email, booking_group)
      VALUES
        ((v_room->>'unit_id')::uuid, v_today, p_check_out, GREATEST(1, COALESCE((v_room->>'guests')::int, 1)),
         'confirmed', btrim(p_name), btrim(p_phone), btrim(COALESCE(p_email, '')), v_group)
      RETURNING id INTO v_id;
    EXCEPTION WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Room % is not free for these dates', COALESCE(v_unit_name, '') USING ERRCODE = 'P0002';
    END;
    v_ids := v_ids || v_id;
  END LOOP;

  RETURN public.pos_check_in(v_ids);
END $$;

-- ---------- charges ----------
CREATE OR REPLACE FUNCTION public.pos_lock_open_account(p_account uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.stay_accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0001'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'This account is already closed' USING ERRCODE = 'P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pos_add_charge(
  p_account uuid, p_kind text, p_description text, p_quantity int, p_unit_price_cents int, p_source text DEFAULT 'front_desk')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  IF p_kind NOT IN ('food', 'service', 'other') THEN
    RAISE EXCEPTION 'Choose food, service or other' USING ERRCODE = 'P0001';
  END IF;
  IF p_source NOT IN ('front_desk', 'restaurant') THEN
    RAISE EXCEPTION 'Unknown source' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(btrim(COALESCE(p_description, ''))) = 0 THEN
    RAISE EXCEPTION 'Describe the charge' USING ERRCODE = 'P0001';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 999 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 999' USING ERRCODE = 'P0001';
  END IF;
  IF p_unit_price_cents IS NULL OR p_unit_price_cents <= 0 OR p_unit_price_cents > 1000000000 THEN
    RAISE EXCEPTION 'Enter a price above zero' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.account_charges (account_id, kind, source, description, quantity, unit_price_cents, created_by)
  VALUES (p_account, p_kind, p_source, left(btrim(p_description), 300), p_quantity, p_unit_price_cents, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_add_service(p_account uuid, p_addon_id uuid, p_quantity int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE a record; v_id uuid;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  SELECT * INTO a FROM public.resort_addons WHERE id = p_addon_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'This service is not available' USING ERRCODE = 'P0001'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 999 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 999' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.account_charges (account_id, kind, source, description, quantity, unit_price_cents, addon_id, created_by)
  VALUES (p_account, CASE WHEN a.category = 'food' THEN 'food' ELSE 'service' END, 'front_desk',
          a.name, p_quantity, a.price_cents, a.id, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_charge_order(p_order_id uuid, p_account uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE o record; v_id uuid; v_items text;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  SELECT * INTO o FROM public.service_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001'; END IF;
  IF o.status = 'cancelled' THEN RAISE EXCEPTION 'This order was cancelled' USING ERRCODE = 'P0001'; END IF;
  IF o.bill_status <> 'unbilled' THEN RAISE EXCEPTION 'This order is already on a bill' USING ERRCODE = 'P0001'; END IF;
  IF o.subtotal_cents <= 0 THEN RAISE EXCEPTION 'This order has no amount' USING ERRCODE = 'P0001'; END IF;

  SELECT string_agg(name || ' × ' || quantity, ', ' ORDER BY name) INTO v_items
  FROM public.service_order_items WHERE order_id = o.id;

  INSERT INTO public.account_charges (account_id, kind, source, description, quantity, unit_price_cents, order_id, created_by)
  VALUES (p_account, 'food', 'website',
          left('Order ' || o.order_number || COALESCE(': ' || v_items, ''), 300), 1, o.subtotal_cents, o.id, auth.uid())
  RETURNING id INTO v_id;
  UPDATE public.service_orders SET bill_status = 'billed' WHERE id = o.id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_void_charge(p_charge uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c record;
BEGIN
  PERFORM public.pos_require_admin();
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Write why this charge is removed' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO c FROM public.account_charges WHERE id = p_charge FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Charge not found' USING ERRCODE = 'P0001'; END IF;
  IF c.voided_at IS NOT NULL THEN RAISE EXCEPTION 'This charge is already removed' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.pos_lock_open_account(c.account_id);
  IF c.kind = 'room' THEN
    RAISE EXCEPTION 'Room charges change with the stay dates. Use Change departure instead' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.account_charges SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   WHERE id = p_charge;
  IF c.order_id IS NOT NULL THEN
    UPDATE public.service_orders SET bill_status = 'unbilled' WHERE id = c.order_id;
    -- free the order so it can be billed again
    UPDATE public.account_charges SET order_id = NULL WHERE id = p_charge;
  END IF;
END $$;

-- ---------- payments ----------
CREATE OR REPLACE FUNCTION public.pos_add_payment(p_account uuid, p_method text, p_amount_cents bigint, p_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance bigint; v_id uuid; v_ref text := btrim(COALESCE(p_reference, ''));
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  IF p_method NOT IN ('cash', 'bkash', 'nagad', 'card', 'bank') THEN
    RAISE EXCEPTION 'Choose how the guest paid' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Enter an amount above zero' USING ERRCODE = 'P0001';
  END IF;
  IF p_method IN ('bkash', 'nagad', 'bank') AND char_length(v_ref) < 4 THEN
    RAISE EXCEPTION 'Enter the transaction ID' USING ERRCODE = 'P0001';
  END IF;
  SELECT balance_cents INTO v_balance FROM public.stay_account_totals WHERE account_id = p_account;
  IF p_amount_cents > v_balance THEN
    RAISE EXCEPTION 'This is more than the balance of ৳%', rtrim(to_char(v_balance / 100.0, 'FM99,99,99,990.99'), '.') USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.account_payments (account_id, method, amount_cents, reference, received_by)
  VALUES (p_account, p_method, p_amount_cents, left(v_ref, 80), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_void_payment(p_payment uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p record;
BEGIN
  PERFORM public.pos_require_admin();
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Write why this payment is removed' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO p FROM public.account_payments WHERE id = p_payment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0001'; END IF;
  IF p.voided_at IS NOT NULL THEN RAISE EXCEPTION 'This payment is already removed' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.pos_lock_open_account(p.account_id);
  UPDATE public.account_payments SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   WHERE id = p_payment;
END $$;

-- ---------- change departure (extend or leave early) ----------
CREATE OR REPLACE FUNCTION public.pos_change_departure(p_account uuid, p_check_out date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  IF p_check_out IS NULL OR p_check_out < public.resort_today() THEN
    RAISE EXCEPTION 'The departure date cannot be in the past' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house') THEN
    RAISE EXCEPTION 'No rooms on this account are checked in' USING ERRCODE = 'P0001';
  END IF;
  FOR r IN SELECT * FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house' FOR UPDATE LOOP
    IF p_check_out <= r.check_in THEN
      RAISE EXCEPTION 'The stay must be at least one night' USING ERRCODE = 'P0001';
    END IF;
    CONTINUE WHEN r.check_out = p_check_out;
    BEGIN
      UPDATE public.reservations SET check_out = p_check_out,
             total_cents = nightly_rate_cents * (p_check_out - check_in)
       WHERE id = r.id;
    EXCEPTION WHEN exclusion_violation THEN
      RAISE EXCEPTION 'The room is booked by someone else on those dates' USING ERRCODE = 'P0002';
    END;
    UPDATE public.account_charges SET voided_at = now(), voided_by = auth.uid(),
           void_reason = format('Stay changed to leave on %s', to_char(p_check_out, 'DD Mon'))
     WHERE reservation_id = r.id AND kind = 'room' AND voided_at IS NULL;
    PERFORM public.pos_post_room_charge(r.id, p_account);
  END LOOP;
END $$;

-- ---------- check out ----------
CREATE OR REPLACE FUNCTION public.pos_check_out(p_account uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance bigint; v_last date; v_order text;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  SELECT max(check_out) INTO v_last FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house';
  IF v_last IS NULL THEN
    RAISE EXCEPTION 'No rooms on this account are checked in' USING ERRCODE = 'P0001';
  END IF;
  IF v_last > public.resort_today() THEN
    RAISE EXCEPTION 'The guest is leaving early. Change the departure to today first so the room charge is right' USING ERRCODE = 'P0003';
  END IF;
  SELECT o.order_number INTO v_order FROM public.service_orders o
   JOIN public.reservations r ON r.id = o.reservation_id
   WHERE r.account_id = p_account AND o.bill_status = 'unbilled' AND o.status <> 'cancelled' LIMIT 1;
  IF v_order IS NOT NULL THEN
    RAISE EXCEPTION 'Website order % is not on the bill yet', v_order USING ERRCODE = 'P0001';
  END IF;
  SELECT balance_cents INTO v_balance FROM public.stay_account_totals WHERE account_id = p_account;
  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'Collect the balance of ৳% before check-out', rtrim(to_char(v_balance / 100.0, 'FM99,99,99,990.99'), '.') USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.room_units SET housekeeping = 'dirty'
   WHERE id IN (SELECT room_unit_id FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house');
  UPDATE public.reservations SET stay_status = 'checked_out', checked_out_at = now()
   WHERE account_id = p_account AND stay_status = 'in_house';
  UPDATE public.stay_accounts SET status = 'closed', closed_at = now(), closed_by = auth.uid() WHERE id = p_account;
END $$;

-- ---------- housekeeping and staff ----------
CREATE OR REPLACE FUNCTION public.pos_set_housekeeping(p_unit uuid, p_state text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pos_require_staff();
  IF p_state NOT IN ('clean', 'dirty', 'maintenance') THEN
    RAISE EXCEPTION 'Unknown room state' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.room_units SET housekeeping = p_state WHERE id = p_unit;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found' USING ERRCODE = 'P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pos_list_staff()
RETURNS TABLE (user_id uuid, email text, display_name text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pos_require_admin();
  RETURN QUERY
  SELECT ur.user_id, COALESCE(p.email, u.email)::text, COALESCE(p.display_name, '')::text, ur.role::text
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role IN ('admin', 'staff')
  ORDER BY ur.role, 2;
END $$;

CREATE OR REPLACE FUNCTION public.pos_set_staff(p_email text, p_is_staff boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid;
BEGIN
  PERFORM public.pos_require_admin();
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(btrim(p_email));
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No account uses this email. Ask the staff member to sign up on the website first' USING ERRCODE = 'P0001';
  END IF;
  IF p_is_staff THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'staff')
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = v_user AND role = 'staff';
  END IF;
END $$;

-- ---------- permissions on functions ----------
REVOKE ALL ON FUNCTION public.pos_post_room_charge(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_lock_open_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_require_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pos_require_admin() FROM PUBLIC, anon;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_check_in(uuid[])',
    'pos_walk_in(text,text,text,date,jsonb)',
    'pos_add_charge(uuid,text,text,integer,integer,text)',
    'pos_add_service(uuid,uuid,integer)',
    'pos_charge_order(uuid,uuid)',
    'pos_void_charge(uuid,text)',
    'pos_add_payment(uuid,text,bigint,text)',
    'pos_void_payment(uuid,text)',
    'pos_change_departure(uuid,date)',
    'pos_check_out(uuid)',
    'pos_set_housekeeping(uuid,text)',
    'pos_list_staff()',
    'pos_set_staff(text,boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resort_today() TO anon, authenticated;
