-- Run after setup.sql. Lets guests book without an account and adds moderated guest reviews.

ALTER TABLE public.reservations
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN guest_name text NOT NULL DEFAULT '',
  ADD COLUMN guest_phone text NOT NULL DEFAULT '',
  ADD COLUMN guest_email text NOT NULL DEFAULT '',
  ADD COLUMN booking_group text,
  ADD CONSTRAINT reservation_has_contact CHECK (user_id IS NOT NULL OR (guest_name <> '' AND guest_phone <> ''));
CREATE INDEX reservations_booking_group_idx ON public.reservations (booking_group);
CREATE INDEX reservations_guest_phone_idx ON public.reservations (guest_phone);
CREATE INDEX IF NOT EXISTS reservations_user_id_idx ON public.reservations (user_id);
CREATE INDEX IF NOT EXISTS reservations_room_unit_id_idx ON public.reservations (room_unit_id);

ALTER TABLE public.reservation_addons DROP CONSTRAINT reservation_addons_quantity_check;
ALTER TABLE public.reservation_addons ADD CONSTRAINT reservation_addons_quantity_check CHECK (quantity BETWEEN 1 AND 2000);

-- One call creates the whole booking: picks free rooms per category, splits guests, adds extras.
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

  FOR addon IN SELECT (e->>'addon_id')::uuid AS addon_id, greatest(0, least(20, coalesce((e->>'count')::integer, 0))) AS cnt
               FROM jsonb_array_elements(coalesce(p_addons, '[]'::jsonb)) e LOOP
    CONTINUE WHEN addon.cnt = 0;
    SELECT a.unit INTO addon_unit FROM public.resort_addons a WHERE a.id = addon.addon_id AND a.is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'One of the extras is no longer available. Please review your extras.' USING ERRCODE = 'P0001'; END IF;
    qty := CASE addon_unit WHEN 'per_person' THEN p_guests * addon.cnt WHEN 'per_person_per_night' THEN p_guests * nights
                           WHEN 'per_night' THEN nights ELSE addon.cnt END;
    INSERT INTO public.reservation_addons (reservation_id, addon_id, quantity) VALUES (first_res, addon.addon_id, qty);
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
         coalesce((SELECT string_agg(a.name, ', ' ORDER BY a.sort_order) FROM public.reservation_addons ra
                   JOIN public.resort_addons a ON a.id = ra.addon_id WHERE ra.reservation_id = rv.id), '')
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

-- Guest reviews: anyone can submit, nothing shows until the resort publishes it.
CREATE TABLE public.guest_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL CHECK (char_length(btrim(guest_name)) BETWEEN 2 AND 60),
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 60),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(btrim(comment)) BETWEEN 10 AND 1000),
  stay_label text NOT NULL DEFAULT '' CHECK (char_length(stay_label) <= 60),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.guest_reviews TO anon, authenticated;
GRANT UPDATE, DELETE ON public.guest_reviews TO authenticated;
GRANT ALL ON public.guest_reviews TO service_role;
ALTER TABLE public.guest_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read published reviews" ON public.guest_reviews FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "Admins can read all reviews" ON public.guest_reviews FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Anyone can submit a review for moderation" ON public.guest_reviews FOR INSERT TO anon, authenticated WITH CHECK (is_published = false);
CREATE POLICY "Admins can update reviews" ON public.guest_reviews FOR UPDATE TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin')) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins can delete reviews" ON public.guest_reviews FOR DELETE TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE INDEX guest_reviews_published_idx ON public.guest_reviews (is_published, created_at DESC);
