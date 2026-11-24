-- POS: staff bookings from the front-desk calendar.
--   pos_book            book rooms for future (or today's) dates without checking in
--   pos_confirm_booking confirm a website request (whole booking group)
--   pos_cancel_booking  cancel a booking that hasn't checked in (whole booking group)

CREATE OR REPLACE FUNCTION public.pos_book(
  p_name text, p_phone text, p_email text, p_check_in date, p_check_out date, p_note text, p_rooms jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := public.resort_today();
  v_group text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_room jsonb;
  v_unit_name text;
BEGIN
  PERFORM public.pos_require_staff();
  IF char_length(btrim(COALESCE(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Enter the guest''s full name' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_phone, '') !~ '^\+?[0-9 -]{7,20}$' THEN
    RAISE EXCEPTION 'Enter a valid mobile number' USING ERRCODE = 'P0001';
  END IF;
  IF p_check_in IS NULL OR p_check_in < v_today THEN
    RAISE EXCEPTION 'The arrival date can''t be in the past' USING ERRCODE = 'P0001';
  END IF;
  IF p_check_in > v_today + 400 THEN
    RAISE EXCEPTION 'Bookings can be made up to about a year ahead' USING ERRCODE = 'P0001';
  END IF;
  IF p_check_out IS NULL OR p_check_out <= p_check_in THEN
    RAISE EXCEPTION 'The departure date must be after the arrival date' USING ERRCODE = 'P0001';
  END IF;
  IF p_check_out > p_check_in + 60 THEN
    RAISE EXCEPTION 'A stay can be at most 60 nights' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_rooms) <> 'array' OR jsonb_array_length(p_rooms) = 0 THEN
    RAISE EXCEPTION 'Choose at least one room' USING ERRCODE = 'P0001';
  END IF;

  FOR v_room IN SELECT * FROM jsonb_array_elements(p_rooms) LOOP
    SELECT name INTO v_unit_name FROM public.room_units WHERE id = (v_room->>'unit_id')::uuid;
    BEGIN
      INSERT INTO public.reservations
        (room_unit_id, check_in, check_out, guest_count, status, guest_name, guest_phone, guest_email,
         guest_note, booking_group)
      VALUES
        ((v_room->>'unit_id')::uuid, p_check_in, p_check_out, GREATEST(1, COALESCE((v_room->>'guests')::int, 1)),
         'confirmed', btrim(p_name), btrim(p_phone), btrim(COALESCE(p_email, '')),
         left(btrim(COALESCE(p_note, '')), 500), v_group);
    EXCEPTION WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Room % is not free for these dates', COALESCE(v_unit_name, '') USING ERRCODE = 'P0002';
    END;
  END LOOP;
  RETURN v_group;
END $$;

-- Every reservation of the same booking (group), locked.
CREATE OR REPLACE FUNCTION public.pos_booking_ids(p_reservation uuid)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_group text; v_ids uuid[];
BEGIN
  SELECT booking_group INTO v_group FROM public.reservations WHERE id = p_reservation;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0001'; END IF;
  IF v_group IS NULL OR v_group = '' THEN
    v_ids := ARRAY[p_reservation];
  ELSE
    SELECT array_agg(id) INTO v_ids FROM public.reservations WHERE booking_group = v_group;
  END IF;
  PERFORM 1 FROM public.reservations WHERE id = ANY(v_ids) FOR UPDATE;
  RETURN v_ids;
END $$;

CREATE OR REPLACE FUNCTION public.pos_confirm_booking(p_reservation uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ids uuid[]; v_count int;
BEGIN
  PERFORM public.pos_require_staff();
  v_ids := public.pos_booking_ids(p_reservation);
  UPDATE public.reservations SET status = 'confirmed'
   WHERE id = ANY(v_ids) AND status = 'pending';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'This booking is already confirmed or cancelled' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.pos_cancel_booking(p_reservation uuid, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ids uuid[]; v_count int;
BEGIN
  PERFORM public.pos_require_staff();
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Write why the booking is cancelled' USING ERRCODE = 'P0001';
  END IF;
  v_ids := public.pos_booking_ids(p_reservation);
  IF EXISTS (SELECT 1 FROM public.reservations WHERE id = ANY(v_ids) AND stay_status <> 'expected') THEN
    RAISE EXCEPTION 'The guest has already checked in. Use the bill to change the stay' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.reservations
     SET status = 'cancelled',
         guest_note = left(btrim(guest_note || E'\nCancelled: ' || btrim(p_reason)), 1000)
   WHERE id = ANY(v_ids) AND status <> 'cancelled';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'This booking is already cancelled' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_count;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_book(text,text,text,date,date,text,jsonb)',
    'pos_booking_ids(uuid)',
    'pos_confirm_booking(uuid)',
    'pos_cancel_booking(uuid,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE EXECUTE ON FUNCTION public.pos_booking_ids(uuid) FROM authenticated;
END $$;
