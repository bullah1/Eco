-- POS: customer-first accounts.
-- A customer's bill (stay_accounts) can be opened by mobile number before any room.
-- Checking in later joins the same open bill. Restaurant orders can be started and
-- billed by mobile number, with or without a table.

-- "+880 1712-345678", "8801712345678" and "01712 345678" all become "01712345678".
CREATE OR REPLACE FUNCTION public.pos_phone_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN d ~ '^8801\d{9}$' THEN '0' || substr(d, 4)
    WHEN d ~ '^1\d{9}$' THEN '0' || d
    ELSE d END
  FROM (SELECT regexp_replace(COALESCE(p, ''), '\D', '', 'g') AS d) x
$$;

CREATE INDEX IF NOT EXISTS stay_accounts_open_phone_idx
  ON public.stay_accounts (public.pos_phone_key(guest_phone)) WHERE status = 'open';

-- The newest open bill for this mobile number, locked. NULL when there is none.
CREATE OR REPLACE FUNCTION public.pos_open_account_for_phone(p_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_key text := public.pos_phone_key(p_phone); v_id uuid;
BEGIN
  IF char_length(v_key) < 7 THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.stay_accounts
   WHERE status = 'open' AND public.pos_phone_key(guest_phone) = v_key
   ORDER BY opened_at DESC LIMIT 1 FOR UPDATE;
  RETURN v_id;
END $$;

-- Open a customer's bill. Returns the existing open bill when the number already has one.
CREATE OR REPLACE FUNCTION public.pos_open_account(p_name text, p_phone text, p_email text, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.pos_require_staff();
  IF COALESCE(p_phone, '') !~ '^\+?[0-9 -]{7,20}$' THEN
    RAISE EXCEPTION 'Enter a valid mobile number' USING ERRCODE = 'P0001';
  END IF;
  v_id := public.pos_open_account_for_phone(p_phone);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Enter the customer''s name' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.stay_accounts (guest_name, guest_phone, guest_email, note, opened_by)
  VALUES (left(btrim(p_name), 120), btrim(p_phone), btrim(COALESCE(p_email, '')),
          left(btrim(COALESCE(p_note, '')), 500), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ---------- check in: join the customer's open bill when there is one ----------
CREATE OR REPLACE FUNCTION public.pos_check_in(p_reservation_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account uuid;
  v_first record;
  v_count int;
  v_id uuid;
  v_phone text;
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

  v_phone := COALESCE(NULLIF(v_first.guest_phone, ''), v_first.profile_phone, '');
  v_account := public.pos_open_account_for_phone(v_phone);
  IF v_account IS NOT NULL THEN
    UPDATE public.stay_accounts SET booking_group = COALESCE(booking_group, v_first.booking_group)
     WHERE id = v_account;
  ELSE
    INSERT INTO public.stay_accounts (guest_name, guest_phone, guest_email, booking_group, opened_by)
    VALUES (
      COALESCE(NULLIF(v_first.guest_name, ''), NULLIF(v_first.display_name, ''), 'Guest'),
      v_phone,
      COALESCE(NULLIF(v_first.guest_email, ''), v_first.profile_email, ''),
      v_first.booking_group,
      auth.uid())
    RETURNING id INTO v_account;
  END IF;

  UPDATE public.reservations
     SET status = 'confirmed', stay_status = 'in_house', account_id = v_account, checked_in_at = now()
   WHERE id = ANY (p_reservation_ids);

  FOREACH v_id IN ARRAY p_reservation_ids LOOP
    PERFORM public.pos_post_room_charge(v_id, v_account);
  END LOOP;

  INSERT INTO public.account_charges (account_id, kind, source, description, quantity, unit_price_cents, order_id, created_by)
  SELECT v_account, 'food', 'website', 'Website order ' || o.order_number, 1, o.subtotal_cents, o.id, auth.uid()
  FROM public.service_orders o
  WHERE o.reservation_id = ANY (p_reservation_ids) AND o.bill_status = 'unbilled' AND o.status <> 'cancelled'
    AND NOT EXISTS (SELECT 1 FROM public.account_charges c WHERE c.order_id = o.id);
  UPDATE public.service_orders SET bill_status = 'billed'
   WHERE reservation_id = ANY (p_reservation_ids) AND bill_status = 'unbilled' AND status <> 'cancelled';

  RETURN v_account;
END $$;

-- ---------- check out: a bill with no room can be closed once it is paid ----------
CREATE OR REPLACE FUNCTION public.pos_check_out(p_account uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance bigint; v_order text; v_rooms boolean;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  v_rooms := EXISTS (SELECT 1 FROM public.reservations WHERE account_id = p_account);
  IF v_rooms AND NOT EXISTS (SELECT 1 FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house') THEN
    RAISE EXCEPTION 'No rooms on this account are checked in' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house'
              AND check_out > GREATEST(public.resort_today(), check_in + 1)) THEN
    RAISE EXCEPTION 'The guest is leaving early. End the stay today first so the room charge is right' USING ERRCODE = 'P0003';
  END IF;
  SELECT o.order_number INTO v_order FROM public.service_orders o
   JOIN public.reservations r ON r.id = o.reservation_id
   WHERE r.account_id = p_account AND o.bill_status = 'unbilled' AND o.status <> 'cancelled'
     AND o.subtotal_cents > 0 LIMIT 1;
  IF v_order IS NOT NULL THEN
    RAISE EXCEPTION 'Website order % is not on the bill yet', v_order USING ERRCODE = 'P0001';
  END IF;
  SELECT balance_cents INTO v_balance FROM public.stay_account_totals WHERE account_id = p_account;
  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'Collect the balance of ৳% before closing the bill', rtrim(to_char(v_balance / 100.0, 'FM99,99,99,990.99'), '.') USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.room_units SET housekeeping = 'dirty'
   WHERE id IN (SELECT room_unit_id FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house');
  UPDATE public.reservations SET stay_status = 'checked_out', checked_out_at = now()
   WHERE account_id = p_account AND stay_status = 'in_house';
  UPDATE public.stay_accounts SET status = 'closed', closed_at = now(), closed_by = auth.uid() WHERE id = p_account;
END $$;

-- ---------- restaurant orders by mobile number ----------
ALTER TABLE public.restaurant_tickets ADD COLUMN IF NOT EXISTS guest_phone text NOT NULL DEFAULT '';

-- Start an order without a table. Name and number are optional; with a number the order
-- is linked to that customer's bill when they have one.
CREATE OR REPLACE FUNCTION public.pos_open_counter_ticket(p_label text, p_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; v_phone text := btrim(COALESCE(p_phone, '')); v_label text := btrim(COALESCE(p_label, ''));
BEGIN
  PERFORM public.pos_require_staff();
  IF v_phone <> '' AND v_phone !~ '^\+?[0-9 -]{7,20}$' THEN
    RAISE EXCEPTION 'Enter a valid mobile number' USING ERRCODE = 'P0001';
  END IF;
  IF v_label = '' AND v_phone <> '' THEN
    SELECT guest_name INTO v_label FROM public.stay_accounts
     WHERE status = 'open' AND public.pos_phone_key(guest_phone) = public.pos_phone_key(v_phone)
     ORDER BY opened_at DESC LIMIT 1;
  END IF;
  INSERT INTO public.restaurant_tickets (table_id, label, guest_phone, opened_by)
  VALUES (NULL, left(COALESCE(v_label, ''), 60), v_phone, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_ticket_set_phone(p_ticket uuid, p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_phone text := btrim(COALESCE(p_phone, ''));
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_ticket(p_ticket);
  IF v_phone <> '' AND v_phone !~ '^\+?[0-9 -]{7,20}$' THEN
    RAISE EXCEPTION 'Enter a valid mobile number' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.restaurant_tickets SET guest_phone = v_phone WHERE id = p_ticket;
END $$;

-- Put an order on a customer's bill by mobile number, opening the bill if needed.
CREATE OR REPLACE FUNCTION public.pos_ticket_charge_phone(p_ticket uuid, p_phone text, p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account uuid;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_ticket(p_ticket);
  v_account := public.pos_open_account(p_name, p_phone, '', '');
  PERFORM public.pos_ticket_charge_room(p_ticket, v_account);
  UPDATE public.restaurant_tickets SET guest_phone = btrim(p_phone) WHERE id = p_ticket AND guest_phone = '';
  RETURN v_account;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_open_account_for_phone(text)',
    'pos_open_account(text,text,text,text)',
    'pos_check_in(uuid[])',
    'pos_check_out(uuid)',
    'pos_open_counter_ticket(text,text)',
    'pos_ticket_set_phone(uuid,text)',
    'pos_ticket_charge_phone(uuid,text,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE EXECUTE ON FUNCTION public.pos_open_account_for_phone(text) FROM authenticated;
END $$;
