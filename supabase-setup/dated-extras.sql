-- Run after in-stay-orders.sql. Meals and extras can be chosen for specific days of the stay.

ALTER TABLE public.reservation_addons ADD COLUMN service_date date;
ALTER TABLE public.reservation_addons DROP CONSTRAINT reservation_addons_reservation_id_addon_id_key;
ALTER TABLE public.reservation_addons ADD CONSTRAINT reservation_addons_unique_per_day UNIQUE NULLS NOT DISTINCT (reservation_id, addon_id, service_date);

CREATE OR REPLACE FUNCTION public.create_booking(
  p_check_in date, p_check_out date, p_guests integer, p_rooms jsonb, p_addons jsonb,
  p_name text, p_phone text, p_email text, p_note text
)
RETURNS TABLE (reference text, type_name text, unit_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  nights integer := p_check_out - p_check_in;
  grp text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  clean_name text := btrim(coalesce(p_name, ''));
  clean_phone text := regexp_replace(btrim(coalesce(p_phone, '')), '\s+', '', 'g');
  clean_email text := lower(btrim(coalesce(p_email, '')));
  req record; unit record; addon record; addon_unit public.addon_unit;
  got integer; picked uuid[] := '{}'; caps integer[] := '{}'; alloc integer[];
  remaining integer; n integer; i integer; rid uuid; first_res uuid; qty integer;
BEGIN
  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_in < current_date OR nights < 1 OR nights > 30 THEN
    RAISE EXCEPTION 'Please choose valid dates (up to 30 nights).' USING ERRCODE = 'P0001'; END IF;
  IF p_guests IS NULL OR p_guests < 1 OR p_guests > 20 THEN
    RAISE EXCEPTION 'Please choose between 1 and 20 guests.' USING ERRCODE = 'P0001'; END IF;
  IF char_length(clean_name) < 2 OR char_length(clean_name) > 100 THEN
    RAISE EXCEPTION 'Please enter your full name.' USING ERRCODE = 'P0001'; END IF;
  IF clean_phone !~ '^\+?[0-9-]{7,20}$' THEN
    RAISE EXCEPTION 'Please enter a valid mobile number.' USING ERRCODE = 'P0001'; END IF;
  IF clean_email <> '' AND (char_length(clean_email) > 200 OR clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Please enter a valid email address or leave it empty.' USING ERRCODE = 'P0001'; END IF;
  IF (SELECT count(*) FROM public.reservations
      WHERE guest_phone = clean_phone AND status = 'pending' AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'There are already several pending requests for this number. Please contact the resort.' USING ERRCODE = 'P0001'; END IF;

  FOR req IN SELECT (e->>'room_type_id')::uuid AS type_id, (e->>'count')::integer AS cnt
             FROM jsonb_array_elements(coalesce(p_rooms, '[]'::jsonb)) e LOOP
    IF req.cnt IS NULL OR req.cnt < 1 OR req.cnt > 20 THEN
      RAISE EXCEPTION 'Please choose between 1 and 20 rooms of each type.' USING ERRCODE = 'P0001'; END IF;
    got := 0;
    FOR unit IN
      SELECT ru.id, rt.max_guests FROM public.room_units ru JOIN public.room_types rt ON rt.id = ru.room_type_id
      WHERE ru.room_type_id = req.type_id AND ru.is_active AND rt.is_active AND NOT (ru.id = ANY (picked))
        AND NOT EXISTS (SELECT 1 FROM public.reservations r WHERE r.room_unit_id = ru.id AND r.status IN ('pending', 'confirmed')
                        AND daterange(r.check_in, r.check_out, '[)') && daterange(p_check_in, p_check_out, '[)'))
      ORDER BY ru.name LIMIT req.cnt FOR UPDATE OF ru SKIP LOCKED
    LOOP
      picked := picked || unit.id; caps := caps || unit.max_guests; got := got + 1;
    END LOOP;
    IF got < req.cnt THEN
      RAISE EXCEPTION 'Some of the rooms you chose were just booked. Please review your rooms.' USING ERRCODE = 'P0002'; END IF;
  END LOOP;

  n := coalesce(array_length(picked, 1), 0);
  IF n = 0 THEN RAISE EXCEPTION 'Please choose at least one room.' USING ERRCODE = 'P0001'; END IF;
  IF n > p_guests THEN RAISE EXCEPTION 'You have chosen more rooms than guests.' USING ERRCODE = 'P0001'; END IF;
  IF (SELECT sum(c) FROM unnest(caps) c) < p_guests THEN
    RAISE EXCEPTION 'These rooms cannot host all your guests. Please add a room.' USING ERRCODE = 'P0001'; END IF;

  alloc := array_fill(1, ARRAY[n]);
  remaining := p_guests - n;
  WHILE remaining > 0 LOOP
    FOR i IN 1..n LOOP
      IF remaining > 0 AND alloc[i] < caps[i] THEN alloc[i] := alloc[i] + 1; remaining := remaining - 1; END IF;
    END LOOP;
  END LOOP;

  FOR i IN 1..n LOOP
    INSERT INTO public.reservations (user_id, room_unit_id, check_in, check_out, guest_count, guest_note, guest_name, guest_phone, guest_email, booking_group)
    VALUES (uid, picked[i], p_check_in, p_check_out, alloc[i], left(btrim(coalesce(p_note, '')), 500), clean_name, clean_phone, clean_email, grp)
    RETURNING id INTO rid;
    IF i = 1 THEN first_res := rid; END IF;
  END LOOP;

  -- Extras: with a date they are for that day of the stay; without a date, for the whole stay.
  FOR addon IN
    SELECT (e->>'addon_id')::uuid AS addon_id, nullif(e->>'date', '')::date AS service_date,
           least(20, sum(greatest(0, coalesce((e->>'count')::integer, 0))))::integer AS cnt
    FROM jsonb_array_elements(coalesce(p_addons, '[]'::jsonb)) e
    GROUP BY 1, 2
  LOOP
    CONTINUE WHEN addon.cnt = 0;
    SELECT a.unit INTO addon_unit FROM public.resort_addons a WHERE a.id = addon.addon_id AND a.is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'One of the extras is no longer available. Please review your extras.' USING ERRCODE = 'P0001'; END IF;
    IF addon.service_date IS NOT NULL AND (addon.service_date < p_check_in OR addon.service_date > p_check_out) THEN
      RAISE EXCEPTION 'Meals and extras must be on the dates of your stay.' USING ERRCODE = 'P0001'; END IF;
    qty := CASE
      WHEN addon.service_date IS NOT NULL THEN
        CASE addon_unit WHEN 'per_person_per_night' THEN p_guests WHEN 'per_person' THEN p_guests * addon.cnt ELSE addon.cnt END
      ELSE
        CASE addon_unit WHEN 'per_person' THEN p_guests * addon.cnt WHEN 'per_person_per_night' THEN p_guests * nights
                        WHEN 'per_night' THEN nights ELSE addon.cnt END
    END;
    INSERT INTO public.reservation_addons (reservation_id, addon_id, quantity, service_date)
    VALUES (first_res, addon.addon_id, qty, addon.service_date);
  END LOOP;

  RETURN QUERY
    SELECT rv.booking_reference, rt.name, ru.name FROM public.reservations rv
    JOIN public.room_units ru ON ru.id = rv.room_unit_id JOIN public.room_types rt ON rt.id = ru.room_type_id
    WHERE rv.booking_group = grp ORDER BY rt.sort_order, ru.name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_booking(date, date, integer, jsonb, jsonb, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(date, date, integer, jsonb, jsonb, text, text, text, text) TO anon, authenticated;

-- A guest can check a request with the reference and the phone number used to book.
CREATE OR REPLACE FUNCTION public.find_booking(p_reference text, p_phone text)
RETURNS TABLE (reference text, status public.reservation_status, check_in date, check_out date, guest_count integer,
               type_name text, room_total_cents integer, extras_total_cents integer, extras text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rv.booking_reference, rv.status, rv.check_in, rv.check_out, rv.guest_count, rt.name, rv.total_cents,
         coalesce((SELECT sum(ra.total_cents)::integer FROM public.reservation_addons ra WHERE ra.reservation_id = rv.id), 0),
         coalesce((SELECT string_agg(a.name || coalesce(' (' || to_char(ra.service_date, 'DD Mon') || ')', ''), ', ' ORDER BY ra.service_date NULLS FIRST, a.sort_order)
                   FROM public.reservation_addons ra JOIN public.resort_addons a ON a.id = ra.addon_id WHERE ra.reservation_id = rv.id), '')
  FROM public.reservations rv
  JOIN public.room_units ru ON ru.id = rv.room_unit_id JOIN public.room_types rt ON rt.id = ru.room_type_id
  WHERE rv.booking_group = (SELECT r2.booking_group FROM public.reservations r2
                            WHERE r2.booking_reference = upper(btrim(p_reference))
                              AND r2.guest_phone = regexp_replace(btrim(coalesce(p_phone, '')), '\s+', '', 'g')
                              AND r2.guest_phone <> '' LIMIT 1)
  ORDER BY rt.sort_order
$$;
REVOKE EXECUTE ON FUNCTION public.find_booking(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_booking(text, text) TO anon, authenticated;


UPDATE public.resort_addons SET description = 'Paratha, eggs, bhaji, fruit and tea' WHERE name = 'Breakfast';
UPDATE public.resort_addons SET name = 'Lunch', description = 'Rice, dal, vegetables and the catch of the day' WHERE name = 'Seafood lunch';
UPDATE public.resort_addons SET description = 'Bangladeshi home-style dinner' WHERE name = 'Dinner';
