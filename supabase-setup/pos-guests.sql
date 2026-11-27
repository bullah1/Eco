-- NOT APPLIED YET: waiting for approval in Supabase. Apply this before the guest profile screens ship.
-- POS: guest profiles, keyed by mobile number (pos_phone_key).
-- A profile holds what the desk should remember about a guest: ID for the register,
-- address, tags (VIP, regular, do not book…) and preferences. Visits and money come from
-- the guest's bills, so they are always up to date.

CREATE TABLE IF NOT EXISTS public.guest_profiles (
  phone_key text PRIMARY KEY CHECK (char_length(phone_key) >= 7),
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  id_type text NOT NULL DEFAULT '' CHECK (id_type IN ('', 'nid', 'passport', 'driving', 'other')),
  id_number text NOT NULL DEFAULT '' CHECK (char_length(id_number) <= 40),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 300),
  tags text[] NOT NULL DEFAULT '{}',
  preferences text NOT NULL DEFAULT '' CHECK (char_length(preferences) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_name text NOT NULL DEFAULT ''
);

ALTER TABLE public.guest_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read guest profiles" ON public.guest_profiles;
CREATE POLICY "staff read guest profiles" ON public.guest_profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
REVOKE ALL ON public.guest_profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.guest_profiles FROM authenticated;
GRANT SELECT ON public.guest_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_guest_save(
  p_phone text, p_name text, p_email text, p_id_type text, p_id_number text,
  p_address text, p_tags text[], p_preferences text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_key text := public.pos_phone_key(p_phone); v_tags text[];
BEGIN
  PERFORM public.pos_require_staff();
  IF char_length(v_key) < 7 THEN
    RAISE EXCEPTION 'Enter a valid mobile number' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_id_type, '') NOT IN ('', 'nid', 'passport', 'driving', 'other') THEN
    RAISE EXCEPTION 'Unknown ID type' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT t), '{}') INTO v_tags
    FROM unnest(COALESCE(p_tags, '{}')) t
   WHERE t IN ('vip', 'regular', 'family', 'corporate', 'do_not_book');
  INSERT INTO public.guest_profiles AS g
    (phone_key, name, phone, email, id_type, id_number, address, tags, preferences, updated_at, updated_by_name)
  VALUES (v_key, left(btrim(COALESCE(p_name, '')), 120), btrim(COALESCE(p_phone, '')),
          left(btrim(COALESCE(p_email, '')), 120), COALESCE(p_id_type, ''),
          left(btrim(COALESCE(p_id_number, '')), 40), left(btrim(COALESCE(p_address, '')), 300),
          v_tags, left(btrim(COALESCE(p_preferences, '')), 1000), now(), public.pos_actor_name())
  ON CONFLICT (phone_key) DO UPDATE
    SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email,
        id_type = EXCLUDED.id_type, id_number = EXCLUDED.id_number, address = EXCLUDED.address,
        tags = EXCLUDED.tags, preferences = EXCLUDED.preferences,
        updated_at = now(), updated_by_name = EXCLUDED.updated_by_name;
  RETURN v_key;
END $$;

-- Every guest we know, by mobile number: visits, nights, money, last visit, profile tags.
-- A "visit" is a bill; nights count rooms that were checked in.
CREATE OR REPLACE FUNCTION public.pos_guest_directory(p_search text DEFAULT '', p_limit int DEFAULT 300)
RETURNS TABLE (
  phone_key text, name text, phone text, visits int, nights int,
  spent_cents bigint, due_cents bigint, first_visit date, last_visit date,
  upcoming int, tags text[], has_profile boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE q text := lower(btrim(COALESCE(p_search, ''))); qd text := regexp_replace(COALESCE(p_search, ''), '\D', '', 'g');
BEGIN
  PERFORM public.pos_require_staff();
  RETURN QUERY
  WITH acc AS (
    SELECT public.pos_phone_key(a.guest_phone) AS k, a.id, a.guest_name, a.guest_phone, a.opened_at,
           t.paid_cents, t.balance_cents
      FROM public.stay_accounts a
      LEFT JOIN public.stay_account_totals t ON t.account_id = a.id
     WHERE char_length(public.pos_phone_key(a.guest_phone)) >= 7
  ),
  stays AS (
    SELECT public.pos_phone_key(r.guest_phone) AS k,
           sum(CASE WHEN r.stay_status IN ('in_house', 'checked_out') THEN r.check_out - r.check_in ELSE 0 END)::int AS n,
           min(r.check_in) FILTER (WHERE r.stay_status IN ('in_house', 'checked_out')) AS first_in,
           max(r.check_in) FILTER (WHERE r.stay_status IN ('in_house', 'checked_out')) AS last_in,
           count(*) FILTER (WHERE r.stay_status = 'expected' AND r.status <> 'cancelled'
                              AND r.check_out > public.resort_today())::int AS up,
           (array_agg(r.guest_name ORDER BY r.created_at DESC))[1] AS rname,
           (array_agg(r.guest_phone ORDER BY r.created_at DESC))[1] AS rphone
      FROM public.reservations r
     WHERE char_length(public.pos_phone_key(r.guest_phone)) >= 7
     GROUP BY 1
  ),
  a2 AS (
    SELECT k, count(*)::int AS visits, COALESCE(sum(paid_cents), 0)::bigint AS spent,
           COALESCE(sum(GREATEST(balance_cents, 0)), 0)::bigint AS due,
           min(opened_at)::date AS first_open, max(opened_at)::date AS last_open,
           (array_agg(guest_name ORDER BY opened_at DESC))[1] AS aname,
           (array_agg(guest_phone ORDER BY opened_at DESC))[1] AS aphone
      FROM acc GROUP BY k
  ),
  keys AS (
    SELECT k FROM a2 UNION SELECT k FROM stays UNION SELECT g.phone_key FROM public.guest_profiles g
  )
  SELECT keys.k,
         COALESCE(NULLIF(g.name, ''), a2.aname, s.rname, '')::text,
         COALESCE(NULLIF(g.phone, ''), a2.aphone, s.rphone, keys.k)::text,
         COALESCE(a2.visits, 0), COALESCE(s.n, 0), COALESCE(a2.spent, 0), COALESCE(a2.due, 0),
         COALESCE(s.first_in, a2.first_open), GREATEST(s.last_in, a2.last_open),
         COALESCE(s.up, 0), COALESCE(g.tags, '{}'), g.phone_key IS NOT NULL
    FROM keys
    LEFT JOIN a2 ON a2.k = keys.k
    LEFT JOIN stays s ON s.k = keys.k
    LEFT JOIN public.guest_profiles g ON g.phone_key = keys.k
   WHERE q = ''
      OR lower(COALESCE(NULLIF(g.name, ''), a2.aname, s.rname, '')) LIKE '%' || q || '%'
      OR (char_length(qd) >= 4 AND keys.k LIKE '%' || qd || '%')
   ORDER BY GREATEST(s.last_in, a2.last_open) DESC NULLS LAST
   LIMIT GREATEST(1, LEAST(p_limit, 1000));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_guest_save(text,text,text,text,text,text,text[],text)',
    'pos_guest_directory(text,int)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
