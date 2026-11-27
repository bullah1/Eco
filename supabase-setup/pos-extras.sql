-- POS extras: expenses and profit, kitchen stock, advance payments, seasonal room prices,
-- and bill discounts approved by an admin.
-- Run after pos-customer-accounts.sql. Safe to run more than once.
--
-- Rules (same as the rest of the POS)
--  * Staff read the tables; every write goes through a pos_* function that checks rights.
--  * Money rows are never edited or deleted. Mistakes are voided with a reason (admin only).

-- =====================================================================
-- 1. Expenses
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT public.resort_today(),
  category text NOT NULL CHECK (category IN
    ('market', 'salary', 'fuel', 'electricity', 'repairs', 'transport', 'supplies', 'rent', 'other')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 2 AND 300),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  method text NOT NULL CHECK (method IN ('cash', 'bkash', 'nagad', 'card', 'bank')),
  reference text NOT NULL DEFAULT '',
  cash_movement_id uuid REFERENCES public.cash_movements(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text
);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON public.expenses (expense_date DESC);

-- Internal: record one expense; when paid from the drawer, also take the cash out of the open shift.
CREATE OR REPLACE FUNCTION public.pos_record_expense(
  p_date date, p_category text, p_description text, p_amount_cents bigint,
  p_method text, p_reference text, p_from_drawer boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_move uuid; v_id uuid; v_desc text := left(btrim(COALESCE(p_description, '')), 300);
BEGIN
  IF p_category NOT IN ('market', 'salary', 'fuel', 'electricity', 'repairs', 'transport', 'supplies', 'rent', 'other') THEN
    RAISE EXCEPTION 'Choose what the money was spent on' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_desc) < 2 THEN RAISE EXCEPTION 'Write what was bought or paid' USING ERRCODE = 'P0001'; END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero' USING ERRCODE = 'P0001'; END IF;
  IF p_method NOT IN ('cash', 'bkash', 'nagad', 'card', 'bank') THEN
    RAISE EXCEPTION 'Choose how it was paid' USING ERRCODE = 'P0001';
  END IF;
  IF p_date IS NULL OR p_date > public.resort_today() OR p_date < public.resort_today() - 120 THEN
    RAISE EXCEPTION 'The date must be within the last 120 days' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_from_drawer, false) THEN
    IF p_method <> 'cash' THEN RAISE EXCEPTION 'Only cash can come from the drawer' USING ERRCODE = 'P0001'; END IF;
    v_move := public.pos_cash_movement('out', p_amount_cents, 'Expense: ' || left(v_desc, 180));
  END IF;
  INSERT INTO public.expenses (expense_date, category, description, amount_cents, method, reference, cash_movement_id, created_by)
  VALUES (p_date, p_category, v_desc, p_amount_cents, p_method, left(btrim(COALESCE(p_reference, '')), 80), v_move, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_add_expense(
  p_date date, p_category text, p_description text, p_amount_cents bigint,
  p_method text, p_reference text, p_from_drawer boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pos_require_staff();
  RETURN public.pos_record_expense(p_date, p_category, p_description, p_amount_cents, p_method, p_reference, p_from_drawer);
END $$;

-- Removing an expense does not put cash back in the drawer by itself; staff use Cash › Money in for that.
CREATE OR REPLACE FUNCTION public.pos_void_expense(p_expense uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE e record;
BEGIN
  PERFORM public.pos_require_admin();
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Write why this expense is removed' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO e FROM public.expenses WHERE id = p_expense FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found' USING ERRCODE = 'P0001'; END IF;
  IF e.voided_at IS NOT NULL THEN RAISE EXCEPTION 'This expense is already removed' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.expenses SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason) WHERE id = p_expense;
END $$;

-- =====================================================================
-- 2. Kitchen stock
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  unit text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 20),
  quantity numeric(12, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity numeric(12, 3) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_name_idx ON public.stock_items (lower(name));

CREATE TABLE IF NOT EXISTS public.stock_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('in', 'out', 'count')),
  change numeric(12, 3) NOT NULL,
  quantity_after numeric(12, 3) NOT NULL,
  note text NOT NULL DEFAULT '',
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_moves_item_idx ON public.stock_moves (item_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.pos_save_stock_item(
  p_id uuid, p_name text, p_unit text, p_min_quantity numeric, p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.pos_require_staff();
  IF char_length(btrim(COALESCE(p_name, ''))) < 1 THEN RAISE EXCEPTION 'Enter the item name' USING ERRCODE = 'P0001'; END IF;
  IF char_length(btrim(COALESCE(p_unit, ''))) < 1 THEN RAISE EXCEPTION 'Enter the unit, like kg or litre' USING ERRCODE = 'P0001'; END IF;
  IF p_min_quantity IS NULL OR p_min_quantity < 0 THEN RAISE EXCEPTION 'The alert level cannot be below zero' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    IF p_id IS NULL THEN
      INSERT INTO public.stock_items (name, unit, min_quantity, is_active)
      VALUES (left(btrim(p_name), 80), left(btrim(p_unit), 20), p_min_quantity, COALESCE(p_active, true))
      RETURNING id INTO v_id;
    ELSE
      UPDATE public.stock_items SET name = left(btrim(p_name), 80), unit = left(btrim(p_unit), 20),
             min_quantity = p_min_quantity, is_active = COALESCE(p_active, true), updated_at = now()
       WHERE id = p_id RETURNING id INTO v_id;
      IF v_id IS NULL THEN RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0001'; END IF;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'An item with this name already exists' USING ERRCODE = 'P0001';
  END;
  RETURN v_id;
END $$;

-- in: bought or received (optionally with what it cost, which is also saved as a Market expense)
-- out: used or spoiled. count: the real amount after counting the store.
CREATE OR REPLACE FUNCTION public.pos_stock_move(
  p_item uuid, p_kind text, p_quantity numeric, p_note text,
  p_cost_cents bigint DEFAULT NULL, p_method text DEFAULT 'cash', p_from_drawer boolean DEFAULT false)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE i record; v_after numeric; v_change numeric; v_expense uuid;
BEGIN
  PERFORM public.pos_require_staff();
  SELECT * INTO i FROM public.stock_items WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0001'; END IF;
  IF p_kind NOT IN ('in', 'out', 'count') THEN RAISE EXCEPTION 'Choose received, used or counted' USING ERRCODE = 'P0001'; END IF;
  IF p_quantity IS NULL OR p_quantity < 0 OR (p_kind <> 'count' AND p_quantity = 0) THEN
    RAISE EXCEPTION 'Enter the quantity' USING ERRCODE = 'P0001';
  END IF;
  v_after := CASE p_kind WHEN 'in' THEN i.quantity + p_quantity
                         WHEN 'out' THEN i.quantity - p_quantity
                         ELSE p_quantity END;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Only % % of % is in stock', trim_scale(i.quantity), i.unit, i.name USING ERRCODE = 'P0001';
  END IF;
  v_change := v_after - i.quantity;
  IF p_kind = 'in' AND COALESCE(p_cost_cents, 0) > 0 THEN
    v_expense := public.pos_record_expense(public.resort_today(), 'market',
      format('%s %s %s', i.name, trim_scale(p_quantity), i.unit), p_cost_cents, COALESCE(p_method, 'cash'), '', p_from_drawer);
  END IF;
  UPDATE public.stock_items SET quantity = v_after, updated_at = now() WHERE id = p_item;
  INSERT INTO public.stock_moves (item_id, kind, change, quantity_after, note, expense_id, created_by)
  VALUES (p_item, p_kind, v_change, v_after, left(btrim(COALESCE(p_note, '')), 200), v_expense, auth.uid());
  RETURN v_after;
END $$;

-- =====================================================================
-- 3. Advance payment on a booking (before check-in)
-- The advance goes on the customer's open bill (found by mobile number). At check-in the
-- rooms join that same bill, so the advance is already counted.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.pos_take_advance(
  p_reservation uuid, p_method text, p_amount_cents bigint, p_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_phone text;
  v_account uuid;
  v_booking_total bigint;
  v_credit bigint;
  v_ref text := btrim(COALESCE(p_reference, ''));
  v_id uuid;
BEGIN
  PERFORM public.pos_require_staff();
  SELECT res.*, p.phone AS profile_phone, p.display_name, p.email AS profile_email INTO r
  FROM public.reservations res LEFT JOIN public.profiles p ON p.id = res.user_id
  WHERE res.id = p_reservation FOR UPDATE OF res;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0001'; END IF;
  IF r.status = 'cancelled' THEN RAISE EXCEPTION 'This booking was cancelled' USING ERRCODE = 'P0001'; END IF;
  IF r.stay_status <> 'expected' THEN
    RAISE EXCEPTION 'The guest is already checked in. Take the payment on the bill instead' USING ERRCODE = 'P0001';
  END IF;
  IF p_method NOT IN ('cash', 'bkash', 'nagad', 'card', 'bank') THEN
    RAISE EXCEPTION 'Choose how the guest paid' USING ERRCODE = 'P0001';
  END IF;
  IF p_method IN ('bkash', 'nagad', 'bank') AND char_length(v_ref) < 4 THEN
    RAISE EXCEPTION 'Enter the transaction ID' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Enter an amount above zero' USING ERRCODE = 'P0001';
  END IF;

  v_phone := COALESCE(NULLIF(r.guest_phone, ''), r.profile_phone, '');
  IF char_length(public.pos_phone_key(v_phone)) < 7 THEN
    RAISE EXCEPTION 'This booking has no mobile number. Add one before taking an advance' USING ERRCODE = 'P0001';
  END IF;

  -- Not more than the room total of the whole booking, minus what is already held on the bill.
  SELECT COALESCE(SUM(total_cents), 0) INTO v_booking_total FROM public.reservations
   WHERE status <> 'cancelled' AND stay_status = 'expected'
     AND (id = r.id OR (r.booking_group IS NOT NULL AND booking_group = r.booking_group));

  v_account := public.pos_open_account_for_phone(v_phone);
  IF v_account IS NULL THEN
    INSERT INTO public.stay_accounts (guest_name, guest_phone, guest_email, booking_group, note, opened_by)
    VALUES (COALESCE(NULLIF(r.guest_name, ''), NULLIF(r.display_name, ''), 'Guest'), v_phone,
            COALESCE(NULLIF(r.guest_email, ''), r.profile_email, ''), r.booking_group,
            'Opened for an advance on booking ' || r.booking_reference, auth.uid())
    RETURNING id INTO v_account;
  END IF;
  SELECT GREATEST(0, -balance_cents) INTO v_credit FROM public.stay_account_totals WHERE account_id = v_account;
  IF p_amount_cents > v_booking_total - COALESCE(v_credit, 0) THEN
    RAISE EXCEPTION 'The advance can be at most ৳% (room total minus advance already taken)',
      rtrim(to_char(GREATEST(0, v_booking_total - COALESCE(v_credit, 0)) / 100.0, 'FM99,99,99,990.99'), '.')
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.account_payments (account_id, method, amount_cents, reference, received_by)
  VALUES (v_account, p_method, p_amount_cents,
          left(trim(both ' ·' FROM format('Advance · booking %s · %s', r.booking_reference, v_ref)), 80), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_account;
END $$;

-- =====================================================================
-- 4. Seasonal and weekend room prices
-- A rule changes the nightly price on matching nights: a date range, weekdays, or both.
-- percent: +20 means 20% more, -10 means 10% less. fixed: the night costs exactly this.
-- When rules overlap, the highest priority wins.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.room_rate_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  room_type_id uuid REFERENCES public.room_types(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  weekdays smallint[] CHECK (weekdays IS NULL OR weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  kind text NOT NULL CHECK (kind IN ('percent', 'fixed')),
  value integer NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
  CHECK (kind <> 'percent' OR value BETWEEN -90 AND 500),
  CHECK (kind <> 'fixed' OR value > 0)
);

-- Price of one night (cents). isodow: 1 = Monday … 5 = Friday, 6 = Saturday, 7 = Sunday.
CREATE OR REPLACE FUNCTION public.night_price(p_room_type uuid, p_night date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN rr.kind = 'fixed' THEN rr.value
                 ELSE GREATEST(0, round(rt.nightly_rate_cents * (100 + rr.value) / 100.0 / 100.0) * 100)::integer END
       FROM public.room_rate_rules rr
      WHERE rr.is_active
        AND (rr.room_type_id IS NULL OR rr.room_type_id = p_room_type)
        AND (rr.start_date IS NULL OR p_night >= rr.start_date)
        AND (rr.end_date IS NULL OR p_night <= rr.end_date)
        AND (rr.weekdays IS NULL OR extract(isodow FROM p_night)::smallint = ANY (rr.weekdays))
      ORDER BY rr.priority DESC, (rr.room_type_id IS NOT NULL) DESC, rr.created_at DESC
      LIMIT 1),
    rt.nightly_rate_cents)
  FROM public.room_types rt WHERE rt.id = p_room_type
$$;

CREATE OR REPLACE FUNCTION public.stay_price(p_room_type uuid, p_check_in date, p_check_out date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(public.night_price(p_room_type, d::date)), 0)::integer
  FROM generate_series(p_check_in, p_check_out - 1, interval '1 day') d
$$;

-- For the website and the front desk: total for a stay, plus the nights that differ from the normal price.
CREATE OR REPLACE FUNCTION public.quote_stay(p_room_type uuid, p_check_in date, p_check_out date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_base integer;
BEGIN
  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in OR p_check_out > p_check_in + 60 THEN
    RETURN NULL;
  END IF;
  SELECT nightly_rate_cents INTO v_base FROM public.room_types WHERE id = p_room_type;
  IF v_base IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'total_cents', public.stay_price(p_room_type, p_check_in, p_check_out),
    'base_cents', v_base * (p_check_out - p_check_in),
    'nights', p_check_out - p_check_in);
END $$;

-- New bookings use the rule prices. nightly_rate_cents keeps the normal price for reference.
CREATE OR REPLACE FUNCTION public.prepare_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_rate integer;
  selected_max_guests integer;
  selected_active boolean;
  selected_type uuid;
BEGIN
  SELECT rt.nightly_rate_cents, rt.max_guests, (rt.is_active AND ru.is_active), rt.id
  INTO selected_rate, selected_max_guests, selected_active, selected_type
  FROM public.room_units ru
  JOIN public.room_types rt ON rt.id = ru.room_type_id
  WHERE ru.id = NEW.room_unit_id;

  IF NOT FOUND OR NOT selected_active THEN
    RAISE EXCEPTION 'This accommodation is not available for booking';
  END IF;
  IF NEW.guest_count > selected_max_guests THEN
    RAISE EXCEPTION 'Guest count exceeds accommodation capacity';
  END IF;

  NEW.nightly_rate_cents := selected_rate;
  NEW.total_cents := public.stay_price(selected_type, NEW.check_in, NEW.check_out);
  RETURN NEW;
END;
$$;

-- Room charge = the reservation total (so seasonal nights are billed right).
CREATE OR REPLACE FUNCTION public.pos_post_room_charge(p_reservation uuid, p_account uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; v_nights int;
BEGIN
  SELECT res.id, res.check_in, res.check_out, res.nightly_rate_cents, res.total_cents,
         ru.name AS unit, rt.name AS type_name
    INTO r
  FROM public.reservations res
  JOIN public.room_units ru ON ru.id = res.room_unit_id
  JOIN public.room_types rt ON rt.id = ru.room_type_id
  WHERE res.id = p_reservation;
  v_nights := r.check_out - r.check_in;

  INSERT INTO public.account_charges
    (account_id, kind, source, description, quantity, unit_price_cents, charge_date, reservation_id, created_by)
  SELECT p_account, 'room', 'front_desk',
         format('%s · %s · %s to %s, breakfast included%s', r.type_name, r.unit,
                to_char(r.check_in, 'DD Mon'), to_char(r.check_out, 'DD Mon'),
                CASE WHEN r.total_cents = r.nightly_rate_cents * v_nights THEN ''
                     ELSE format(' · %s nights, seasonal prices', v_nights) END),
         CASE WHEN r.total_cents = r.nightly_rate_cents * v_nights THEN v_nights ELSE 1 END,
         CASE WHEN r.total_cents = r.nightly_rate_cents * v_nights THEN r.nightly_rate_cents ELSE r.total_cents END,
         r.check_in, r.id, auth.uid();
END $$;

-- Extending or shortening a stay re-prices it with the rule prices.
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
  IF p_check_out > public.resort_today() + 90 THEN
    RAISE EXCEPTION 'The departure date is too far ahead' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house') THEN
    RAISE EXCEPTION 'No rooms on this account are checked in' USING ERRCODE = 'P0001';
  END IF;
  FOR r IN SELECT res.*, ru.room_type_id FROM public.reservations res
             JOIN public.room_units ru ON ru.id = res.room_unit_id
            WHERE res.account_id = p_account AND res.stay_status = 'in_house' FOR UPDATE OF res LOOP
    IF p_check_out <= r.check_in THEN
      RAISE EXCEPTION 'The stay must be at least one night' USING ERRCODE = 'P0001';
    END IF;
    CONTINUE WHEN r.check_out = p_check_out;
    BEGIN
      UPDATE public.reservations SET check_out = p_check_out,
             total_cents = public.stay_price(r.room_type_id, r.check_in, p_check_out)
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

CREATE OR REPLACE FUNCTION public.pos_end_stay_today(p_account uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; v_end date;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  IF NOT EXISTS (SELECT 1 FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house') THEN
    RAISE EXCEPTION 'No rooms on this account are checked in' USING ERRCODE = 'P0001';
  END IF;
  FOR r IN SELECT res.*, ru.room_type_id FROM public.reservations res
             JOIN public.room_units ru ON ru.id = res.room_unit_id
            WHERE res.account_id = p_account AND res.stay_status = 'in_house' FOR UPDATE OF res LOOP
    v_end := GREATEST(public.resort_today(), r.check_in + 1);
    CONTINUE WHEN r.check_out <= v_end;
    UPDATE public.reservations SET check_out = v_end,
           total_cents = public.stay_price(r.room_type_id, r.check_in, v_end)
     WHERE id = r.id;
    UPDATE public.account_charges SET voided_at = now(), voided_by = auth.uid(),
           void_reason = format('Guest left early on %s', to_char(public.resort_today(), 'DD Mon'))
     WHERE reservation_id = r.id AND kind = 'room' AND voided_at IS NULL;
    PERFORM public.pos_post_room_charge(r.id, p_account);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.pos_save_rate_rule(
  p_id uuid, p_name text, p_room_type uuid, p_start date, p_end date, p_weekdays smallint[],
  p_kind text, p_value integer, p_priority integer, p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; v_days smallint[] := NULLIF(p_weekdays, '{}');
BEGIN
  PERFORM public.pos_require_admin();
  IF char_length(btrim(COALESCE(p_name, ''))) < 2 THEN RAISE EXCEPTION 'Give the price a name, like Winter season' USING ERRCODE = 'P0001'; END IF;
  IF p_start IS NULL AND p_end IS NULL AND v_days IS NULL THEN
    RAISE EXCEPTION 'Choose dates, weekdays, or both' USING ERRCODE = 'P0001';
  END IF;
  IF p_start IS NOT NULL AND p_end IS NOT NULL AND p_end < p_start THEN
    RAISE EXCEPTION 'The end date must be on or after the start date' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind = 'percent' AND (p_value IS NULL OR p_value = 0 OR p_value < -90 OR p_value > 500) THEN
    RAISE EXCEPTION 'Enter a change between -90%% and +500%%' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind = 'fixed' AND (p_value IS NULL OR p_value <= 0) THEN
    RAISE EXCEPTION 'Enter the nightly price' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind NOT IN ('percent', 'fixed') THEN RAISE EXCEPTION 'Choose a type of change' USING ERRCODE = 'P0001'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.room_rate_rules (name, room_type_id, start_date, end_date, weekdays, kind, value, priority, is_active)
    VALUES (left(btrim(p_name), 80), p_room_type, p_start, p_end, v_days, p_kind, p_value, COALESCE(p_priority, 0), COALESCE(p_active, true))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.room_rate_rules SET name = left(btrim(p_name), 80), room_type_id = p_room_type, start_date = p_start,
           end_date = p_end, weekdays = v_days, kind = p_kind, value = p_value, priority = COALESCE(p_priority, 0),
           is_active = COALESCE(p_active, true)
     WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Price rule not found' USING ERRCODE = 'P0001'; END IF;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_delete_rate_rule(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pos_require_admin();
  DELETE FROM public.room_rate_rules WHERE id = p_id;
END $$;

-- =====================================================================
-- 5. Discounts on a bill: staff ask with a reason, an admin approves.
-- Only approved discounts lower the balance. An admin's own discount is approved at once.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.account_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.stay_accounts(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'voided')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS account_discounts_account_idx ON public.account_discounts (account_id, requested_at);
CREATE INDEX IF NOT EXISTS account_discounts_pending_idx ON public.account_discounts (status) WHERE status = 'pending';

-- Totals now subtract approved discounts. New column is added at the end (views can only grow).
CREATE OR REPLACE VIEW public.stay_account_totals WITH (security_invoker = true) AS
SELECT a.id AS account_id,
  COALESCE(c.room, 0)::bigint AS room_cents,
  COALESCE(c.food, 0)::bigint AS food_cents,
  COALESCE(c.service, 0)::bigint AS service_cents,
  COALESCE(c.total, 0)::bigint AS charges_cents,
  COALESCE(p.paid, 0)::bigint AS paid_cents,
  (COALESCE(c.total, 0) - COALESCE(d.discount, 0) - COALESCE(p.paid, 0))::bigint AS balance_cents,
  COALESCE(d.discount, 0)::bigint AS discount_cents
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
) p ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount_cents) AS discount
  FROM public.account_discounts WHERE account_id = a.id AND status = 'approved'
) d ON true;

CREATE OR REPLACE FUNCTION public.pos_request_discount(p_account uuid, p_amount_cents bigint, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance bigint; v_pending bigint; v_id uuid; v_admin boolean;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Write why the discount is given' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN RAISE EXCEPTION 'Enter a discount above zero' USING ERRCODE = 'P0001'; END IF;
  SELECT balance_cents INTO v_balance FROM public.stay_account_totals WHERE account_id = p_account;
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_pending FROM public.account_discounts
   WHERE account_id = p_account AND status = 'pending';
  IF p_amount_cents > v_balance - v_pending THEN
    RAISE EXCEPTION 'The discount can be at most ৳% (what is still owed)',
      rtrim(to_char(GREATEST(0, v_balance - v_pending) / 100.0, 'FM99,99,99,990.99'), '.') USING ERRCODE = 'P0001';
  END IF;
  v_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  INSERT INTO public.account_discounts (account_id, amount_cents, reason, status, requested_by, decided_by, decided_at)
  VALUES (p_account, p_amount_cents, left(btrim(p_reason), 300),
          CASE WHEN v_admin THEN 'approved' ELSE 'pending' END, auth.uid(),
          CASE WHEN v_admin THEN auth.uid() END, CASE WHEN v_admin THEN now() END)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- p_decision: approve, reject, or void (take back an approved discount).
CREATE OR REPLACE FUNCTION public.pos_decide_discount(p_discount uuid, p_decision text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d record; v_balance bigint;
BEGIN
  PERFORM public.pos_require_admin();
  SELECT * INTO d FROM public.account_discounts WHERE id = p_discount FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Discount not found' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.pos_lock_open_account(d.account_id);
  IF p_decision IN ('approve', 'reject') AND d.status <> 'pending' THEN
    RAISE EXCEPTION 'This discount was already decided' USING ERRCODE = 'P0001';
  END IF;
  IF p_decision = 'void' AND d.status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved discount can be taken back' USING ERRCODE = 'P0001';
  END IF;
  IF p_decision = 'approve' THEN
    SELECT balance_cents INTO v_balance FROM public.stay_account_totals WHERE account_id = d.account_id;
    IF d.amount_cents > v_balance THEN
      RAISE EXCEPTION 'The bill now owes only ৳%, less than this discount', rtrim(to_char(GREATEST(0, v_balance) / 100.0, 'FM99,99,99,990.99'), '.') USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_decision NOT IN ('reject', 'void') THEN
    RAISE EXCEPTION 'Choose approve or reject' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.account_discounts
     SET status = CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'voided' END,
         decided_by = auth.uid(), decided_at = now(), decision_note = left(btrim(COALESCE(p_note, '')), 300)
   WHERE id = p_discount;
END $$;

-- =====================================================================
-- Security: staff read, nobody writes directly; rate rules and quotes are public to read.
-- =====================================================================
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_discounts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['expenses', 'stock_items', 'stock_moves', 'room_rate_rules', 'account_discounts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff can view" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Staff can view" ON public.%I FOR SELECT TO authenticated USING (public.is_staff((SELECT auth.uid())))', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;
GRANT SELECT ON public.stay_account_totals TO authenticated;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_add_expense(date,text,text,bigint,text,text,boolean)',
    'pos_void_expense(uuid,text)',
    'pos_save_stock_item(uuid,text,text,numeric,boolean)',
    'pos_stock_move(uuid,text,numeric,text,bigint,text,boolean)',
    'pos_take_advance(uuid,text,bigint,text)',
    'pos_save_rate_rule(uuid,text,uuid,date,date,smallint[],text,integer,integer,boolean)',
    'pos_delete_rate_rule(uuid)',
    'pos_request_discount(uuid,bigint,text)',
    'pos_decide_discount(uuid,text,text)',
    'pos_change_departure(uuid,date)',
    'pos_end_stay_today(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
-- Internal helpers: only called from other functions.
REVOKE ALL ON FUNCTION public.pos_record_expense(date,text,text,bigint,text,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_post_room_charge(uuid,uuid) FROM PUBLIC, anon, authenticated;
-- Prices are public information (the website shows them).
GRANT EXECUTE ON FUNCTION public.night_price(uuid,date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stay_price(uuid,date,date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_stay(uuid,date,date) TO anon, authenticated;
