-- Run after guest-booking-and-reviews.sql. Food, drinks and services guests order during their stay.
-- Every order starts as status 'pending' and bill_status 'unbilled'; the POS picks up unbilled orders
-- as pending bills and marks them 'billed' / 'paid'.

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('food', 'drinks', 'service', 'activity')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  image_url text NOT NULL DEFAULT '',
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view available menu items" ON public.menu_items FOR SELECT TO anon, authenticated USING (is_available);
CREATE POLICY "Admins can view all menu items" ON public.menu_items FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins can manage menu items" ON public.menu_items FOR ALL TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin')) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE TABLE public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('OD' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_phone text NOT NULL,
  room_label text NOT NULL DEFAULT '',
  delivery text NOT NULL DEFAULT 'room' CHECK (delivery IN ('room', 'restaurant', 'pickup')),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'served', 'cancelled')),
  bill_status text NOT NULL DEFAULT 'unbilled' CHECK (bill_status IN ('unbilled', 'billed', 'paid')),
  subtotal_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_orders_status_idx ON public.service_orders (status, created_at DESC);
CREATE INDEX service_orders_bill_idx ON public.service_orders (bill_status);
CREATE INDEX service_orders_phone_idx ON public.service_orders (guest_phone);
CREATE INDEX service_orders_reservation_idx ON public.service_orders (reservation_id);
CREATE INDEX service_orders_user_idx ON public.service_orders (user_id);

CREATE TABLE public.service_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price_cents integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 50),
  line_total_cents integer NOT NULL
);
CREATE INDEX service_order_items_order_idx ON public.service_order_items (order_id);
CREATE INDEX service_order_items_menu_idx ON public.service_order_items (menu_item_id);

GRANT SELECT, UPDATE ON public.service_orders TO authenticated;
GRANT SELECT ON public.service_order_items TO authenticated;
GRANT ALL ON public.service_orders, public.service_order_items TO service_role;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guests can view their own orders" ON public.service_orders FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins can update orders" ON public.service_orders FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin')) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Guests can view their own order items" ON public.service_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_orders o WHERE o.id = order_id AND (o.user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))));

CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb, p_name text, p_phone text, p_reference text, p_room text, p_delivery text, p_note text
)
RETURNS TABLE (order_number text, subtotal_cents integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  clean_name text := btrim(coalesce(p_name, ''));
  clean_phone text := regexp_replace(btrim(coalesce(p_phone, '')), '\s+', '', 'g');
  clean_ref text := upper(btrim(coalesce(p_reference, '')));
  res_id uuid; new_id uuid; new_number text; item record; menu record;
  total integer := 0; lines integer := 0;
BEGIN
  IF char_length(clean_name) < 2 OR char_length(clean_name) > 100 THEN
    RAISE EXCEPTION 'Please enter your name.' USING ERRCODE = 'P0001'; END IF;
  IF clean_phone !~ '^\+?[0-9-]{7,20}$' THEN
    RAISE EXCEPTION 'Please enter a valid mobile number.' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(p_delivery, '') NOT IN ('room', 'restaurant', 'pickup') THEN
    RAISE EXCEPTION 'Please choose how you would like to receive your order.' USING ERRCODE = 'P0001'; END IF;
  IF p_delivery = 'room' AND btrim(coalesce(p_room, '')) = '' AND clean_ref = '' THEN
    RAISE EXCEPTION 'Please enter your room number or booking reference for room delivery.' USING ERRCODE = 'P0001'; END IF;
  IF (SELECT count(*) FROM public.service_orders o WHERE o.guest_phone = clean_phone AND o.status = 'pending'
      AND o.created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'There are already many open orders for this number. Please contact the front desk.' USING ERRCODE = 'P0001'; END IF;

  IF clean_ref <> '' THEN
    SELECT r.id INTO res_id FROM public.reservations r
    WHERE r.booking_reference = clean_ref AND r.status <> 'cancelled'
      AND (r.guest_phone = clean_phone OR r.user_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = r.user_id AND regexp_replace(pr.phone, '\s+', '', 'g') = clean_phone))
    LIMIT 1;
    IF res_id IS NULL THEN
      RAISE EXCEPTION 'We could not find a booking with that reference and mobile number.' USING ERRCODE = 'P0001'; END IF;
  END IF;

  INSERT INTO public.service_orders (reservation_id, user_id, guest_name, guest_phone, room_label, delivery, note)
  VALUES (res_id, auth.uid(), clean_name, clean_phone, left(btrim(coalesce(p_room, '')), 40), p_delivery, left(btrim(coalesce(p_note, '')), 500))
  RETURNING id, service_orders.order_number INTO new_id, new_number;

  FOR item IN
    SELECT (e->>'menu_item_id')::uuid AS menu_item_id, sum(greatest(0, (e->>'quantity')::integer))::integer AS quantity
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e GROUP BY 1
  LOOP
    CONTINUE WHEN item.quantity = 0;
    IF item.quantity > 50 THEN RAISE EXCEPTION 'Please order at most 50 of each item.' USING ERRCODE = 'P0001'; END IF;
    SELECT m.name, m.price_cents INTO menu FROM public.menu_items m WHERE m.id = item.menu_item_id AND m.is_available;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'One of the items is no longer available. Please review your cart.' USING ERRCODE = 'P0002'; END IF;
    INSERT INTO public.service_order_items (order_id, menu_item_id, name, unit_price_cents, quantity, line_total_cents)
    VALUES (new_id, item.menu_item_id, menu.name, menu.price_cents, item.quantity, menu.price_cents * item.quantity);
    total := total + menu.price_cents * item.quantity;
    lines := lines + 1;
  END LOOP;

  IF lines = 0 THEN RAISE EXCEPTION 'Your cart is empty.' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.service_orders SET subtotal_cents = total WHERE id = new_id;
  RETURN QUERY SELECT new_number, total;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.find_order(p_order_number text, p_phone text)
RETURNS TABLE (order_number text, status text, delivery text, room_label text, subtotal_cents integer, created_at timestamptz, items jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.order_number, o.status, o.delivery, o.room_label, o.subtotal_cents, o.created_at,
         coalesce((SELECT jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'line_total_cents', i.line_total_cents) ORDER BY i.name)
                   FROM public.service_order_items i WHERE i.order_id = o.id), '[]'::jsonb)
  FROM public.service_orders o
  WHERE o.order_number = upper(btrim(p_order_number))
    AND o.guest_phone = regexp_replace(btrim(coalesce(p_phone, '')), '\s+', '', 'g')
$$;
REVOKE EXECUTE ON FUNCTION public.find_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_order(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_service_order()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER service_orders_touch BEFORE UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.touch_service_order();

-- Sample menu (prices in paisa: 35000 = ৳350). Edit in Admin → Menu.
INSERT INTO public.menu_items (category, name, description, price_cents, sort_order) VALUES
  ('food', 'Breakfast set', 'Paratha, egg, vegetable bhaji and tea', 35000, 10),
  ('food', 'Coral fish curry with rice', 'Fish of the day cooked in a light curry, rice and dal', 45000, 20),
  ('food', 'Prawn fried rice', 'Fried rice with prawns and vegetables', 42000, 30),
  ('food', 'Chicken biryani', 'Kacchi-style chicken biryani with salad', 38000, 40),
  ('food', 'Grilled pomfret', 'Whole pomfret grilled with spices, served with naan', 75000, 50),
  ('food', 'Vegetable khichuri', 'Rice and lentils with seasonal vegetables', 25000, 60),
  ('drinks', 'Fresh green coconut', 'Straight from the island palms', 10000, 70),
  ('drinks', 'Lemon mint juice', 'Fresh lemon, mint and soda', 12000, 80),
  ('drinks', 'Tea', 'Milk tea or red tea', 3000, 90),
  ('drinks', 'Coffee', 'Hot coffee', 8000, 100),
  ('drinks', 'Mineral water (1.5 L)', 'Sealed bottle', 5000, 110),
  ('service', 'Laundry (one bag)', 'Wash and fold, back the next day', 30000, 120),
  ('service', 'Extra bed', 'Added to your room for one night', 80000, 130),
  ('service', 'Room cleaning', 'An extra clean of your room', 15000, 140),
  ('activity', 'Speedboat to Chhera Dwip', 'Return trip for up to 6 people', 350000, 150),
  ('activity', 'Bicycle (per hour)', 'Explore the island by bike', 10000, 160),
  ('activity', 'Beach bonfire setup', 'Fire, seating and lights for one evening', 150000, 170);
