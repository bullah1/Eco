-- Santa Monica Eco Beach Resort: full database setup for a NEW Supabase project.
-- Run once in Supabase Dashboard > SQL Editor. Combined from drizzle/migrations 0000-0002.

-- ===== drizzle/migrations/0000_create_resort_booking_foundation.sql =====
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE TYPE public.app_role AS ENUM ('admin', 'guest');
CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'cancelled');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'guest',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY "Guests can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Guests can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Guests can view their own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  nightly_rate_cents integer NOT NULL CHECK (nightly_rate_cents > 0),
  max_guests integer NOT NULL DEFAULT 2 CHECK (max_guests > 0),
  features text[] NOT NULL DEFAULT '{}',
  image_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.room_types TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.room_types TO authenticated;
GRANT ALL ON public.room_types TO service_role;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active room types" ON public.room_types FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "Admins can view inactive room types" ON public.room_types FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage room types" ON public.room_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.room_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id uuid NOT NULL REFERENCES public.room_types(id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_type_id, name)
);
GRANT SELECT ON public.room_units TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.room_units TO authenticated;
GRANT ALL ON public.room_units TO service_role;
ALTER TABLE public.room_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active room units" ON public.room_units FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "Admins can view inactive room units" ON public.room_units FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage room units" ON public.room_units FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  room_unit_id uuid NOT NULL REFERENCES public.room_units(id),
  check_in date NOT NULL,
  check_out date NOT NULL,
  guest_count integer NOT NULL DEFAULT 2 CHECK (guest_count > 0),
  status public.reservation_status NOT NULL DEFAULT 'pending',
  nightly_rate_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  guest_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_reservation_dates CHECK (check_out > check_in),
  CONSTRAINT no_overlapping_room_reservations EXCLUDE USING gist (
    room_unit_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guests can view their reservations" ON public.reservations FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Guests can request reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id AND status = 'pending') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update reservations" ON public.reservations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete reservations" ON public.reservations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.prepare_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_rate integer;
  selected_max_guests integer;
  selected_active boolean;
BEGIN
  SELECT rt.nightly_rate_cents, rt.max_guests, (rt.is_active AND ru.is_active)
  INTO selected_rate, selected_max_guests, selected_active
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
  NEW.total_cents := selected_rate * (NEW.check_out - NEW.check_in);
  RETURN NEW;
END;
$$;
CREATE TRIGGER prepare_reservation_before_insert
BEFORE INSERT ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.prepare_reservation();

CREATE OR REPLACE FUNCTION public.handle_new_guest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), '')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'guest')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_sagara
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_guest();

-- ===== drizzle/migrations/0001_add_resort_content_and_availability.sql =====
CREATE TABLE public.resort_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'resort',
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resort_gallery TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.resort_gallery TO authenticated;
GRANT ALL ON public.resort_gallery TO service_role;
ALTER TABLE public.resort_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published gallery images" ON public.resort_gallery FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "Admins can view all gallery images" ON public.resort_gallery FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage gallery images" ON public.resort_gallery FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.resort_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key text NOT NULL UNIQUE,
  content_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resort_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.resort_content TO authenticated;
GRANT ALL ON public.resort_content TO service_role;
ALTER TABLE public.resort_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published resort content" ON public.resort_content FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "Admins can view all resort content" ON public.resort_content FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage resort content" ON public.resort_content FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_available_rooms(p_check_in date, p_check_out date)
RETURNS TABLE (
  room_unit_id uuid,
  room_name text,
  room_type_id uuid,
  type_name text,
  type_slug text,
  description text,
  nightly_rate_cents integer,
  max_guests integer,
  features text[],
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ru.id, ru.name, rt.id, rt.name, rt.slug, rt.description,
         rt.nightly_rate_cents, rt.max_guests, rt.features, rt.image_url
  FROM public.room_units ru
  JOIN public.room_types rt ON rt.id = ru.room_type_id
  WHERE p_check_out > p_check_in
    AND ru.is_active = true
    AND rt.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.room_unit_id = ru.id
        AND r.status IN ('pending', 'confirmed')
        AND daterange(r.check_in, r.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
    )
  ORDER BY rt.sort_order, ru.name
$$;
GRANT EXECUTE ON FUNCTION public.get_available_rooms(date, date) TO anon, authenticated;

-- ===== drizzle/migrations/0002_restrict_guest_profile_updates.sql =====
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (display_name, phone, updated_at) ON TABLE public.profiles TO authenticated;

