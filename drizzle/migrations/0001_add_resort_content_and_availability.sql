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