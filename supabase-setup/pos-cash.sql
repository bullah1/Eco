-- POS phase 2b: one shared cash drawer, shifts and end-of-shift cash close.
-- Run after pos-restaurant.sql.
--
-- Rules
--  * Only one shift is open at a time; every payment (room bill or restaurant) lands in it.
--  * No payment can be taken while the drawer is closed.
--  * Closing counts the cash. A difference from the expected cash needs a note.
--  * A payment from a closed shift can no longer be removed.

CREATE SEQUENCE IF NOT EXISTS public.cash_shift_seq START 1;
CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_no text NOT NULL UNIQUE DEFAULT ('S' || nextval('public.cash_shift_seq')::text),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_cash_cents bigint NOT NULL CHECK (opening_cash_cents >= 0),
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  open_note text NOT NULL DEFAULT '',
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  expected_cash_cents bigint,
  counted_cash_cents bigint,
  difference_cents bigint,
  close_note text NOT NULL DEFAULT '',
  summary jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_shifts_one_open ON public.cash_shifts ((true)) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS cash_shifts_opened_idx ON public.cash_shifts (opened_at DESC);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.cash_shifts(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('in', 'out')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 200),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_movements_shift_idx ON public.cash_movements (shift_id, created_at);

ALTER TABLE public.account_payments ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.cash_shifts(id) ON DELETE SET NULL;
ALTER TABLE public.restaurant_payments ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.cash_shifts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS account_payments_shift_idx ON public.account_payments (shift_id);
CREATE INDEX IF NOT EXISTS restaurant_payments_shift_idx ON public.restaurant_payments (shift_id);

ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view" ON public.cash_shifts;
CREATE POLICY "Staff can view" ON public.cash_shifts FOR SELECT TO authenticated USING (public.is_staff((SELECT auth.uid())));
DROP POLICY IF EXISTS "Staff can view" ON public.cash_movements;
CREATE POLICY "Staff can view" ON public.cash_movements FOR SELECT TO authenticated USING (public.is_staff((SELECT auth.uid())));
GRANT SELECT ON public.cash_shifts, public.cash_movements TO authenticated;
REVOKE ALL ON public.cash_shifts, public.cash_movements FROM anon;

-- Every payment joins the open shift; none without one.
CREATE OR REPLACE FUNCTION public.pos_attach_shift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_shift uuid;
BEGIN
  SELECT id INTO v_shift FROM public.cash_shifts WHERE status = 'open' LIMIT 1;
  IF v_shift IS NULL THEN
    RAISE EXCEPTION 'The cash drawer is closed. Open it in POS › Cash first' USING ERRCODE = 'P0001';
  END IF;
  NEW.shift_id := v_shift;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS account_payments_attach_shift ON public.account_payments;
CREATE TRIGGER account_payments_attach_shift BEFORE INSERT ON public.account_payments
  FOR EACH ROW EXECUTE FUNCTION public.pos_attach_shift();
DROP TRIGGER IF EXISTS restaurant_payments_attach_shift ON public.restaurant_payments;
CREATE TRIGGER restaurant_payments_attach_shift BEFORE INSERT ON public.restaurant_payments
  FOR EACH ROW EXECUTE FUNCTION public.pos_attach_shift();

-- Totals for one shift: by method, by source (rooms / restaurant), cash moved in and out, expected cash.
CREATE OR REPLACE FUNCTION public.pos_shift_totals(p_shift uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s record; v jsonb;
BEGIN
  PERFORM public.pos_require_staff();
  SELECT * INTO s FROM public.cash_shifts WHERE id = p_shift;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found' USING ERRCODE = 'P0001'; END IF;
  WITH pays AS (
    SELECT 'rooms'::text AS src, method, amount_cents FROM public.account_payments WHERE shift_id = p_shift AND voided_at IS NULL
    UNION ALL
    SELECT 'restaurant', method, amount_cents FROM public.restaurant_payments WHERE shift_id = p_shift AND voided_at IS NULL
  ), mv AS (
    SELECT COALESCE(SUM(amount_cents) FILTER (WHERE kind = 'in'), 0) AS cin,
           COALESCE(SUM(amount_cents) FILTER (WHERE kind = 'out'), 0) AS cout
    FROM public.cash_movements WHERE shift_id = p_shift
  )
  SELECT jsonb_build_object(
    'by_method', COALESCE((SELECT jsonb_object_agg(method, total) FROM (SELECT method, SUM(amount_cents) total FROM pays GROUP BY method) x), '{}'::jsonb),
    'by_source', COALESCE((SELECT jsonb_object_agg(src, total) FROM (SELECT src, SUM(amount_cents) total FROM pays GROUP BY src) y), '{}'::jsonb),
    'payments', (SELECT count(*) FROM pays),
    'total', (SELECT COALESCE(SUM(amount_cents), 0) FROM pays),
    'cash_sales', (SELECT COALESCE(SUM(amount_cents), 0) FROM pays WHERE method = 'cash'),
    'cash_in', mv.cin,
    'cash_out', mv.cout,
    'opening', s.opening_cash_cents,
    'expected_cash', s.opening_cash_cents + (SELECT COALESCE(SUM(amount_cents), 0) FROM pays WHERE method = 'cash') + mv.cin - mv.cout
  ) INTO v FROM mv;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.pos_open_shift(p_opening_cents bigint, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.pos_require_staff();
  IF p_opening_cents IS NULL OR p_opening_cents < 0 THEN
    RAISE EXCEPTION 'Enter the cash in the drawer (0 if empty)' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.cash_shifts (opening_cash_cents, opened_by, open_note)
  VALUES (p_opening_cents, auth.uid(), left(btrim(COALESCE(p_note, '')), 300))
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'The drawer is already open' USING ERRCODE = 'P0001';
END $$;

CREATE OR REPLACE FUNCTION public.pos_cash_movement(p_kind text, p_amount_cents bigint, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_shift uuid; v_id uuid; v_expected bigint;
BEGIN
  PERFORM public.pos_require_staff();
  SELECT id INTO v_shift FROM public.cash_shifts WHERE status = 'open' FOR UPDATE;
  IF v_shift IS NULL THEN RAISE EXCEPTION 'The cash drawer is closed' USING ERRCODE = 'P0001'; END IF;
  IF p_kind NOT IN ('in', 'out') THEN RAISE EXCEPTION 'Choose cash in or cash out' USING ERRCODE = 'P0001'; END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero' USING ERRCODE = 'P0001'; END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Write what the money is for' USING ERRCODE = 'P0001'; END IF;
  IF p_kind = 'out' THEN
    v_expected := (public.pos_shift_totals(v_shift)->>'expected_cash')::bigint;
    IF p_amount_cents > v_expected THEN
      RAISE EXCEPTION 'The drawer should only have ৳% in cash', rtrim(to_char(v_expected / 100.0, 'FM99,99,99,990.99'), '.') USING ERRCODE = 'P0001';
    END IF;
  END IF;
  INSERT INTO public.cash_movements (shift_id, kind, amount_cents, reason, created_by)
  VALUES (v_shift, p_kind, p_amount_cents, left(btrim(p_reason), 200), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_close_shift(p_counted_cents bigint, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_shift uuid; v_totals jsonb; v_expected bigint; v_diff bigint;
BEGIN
  PERFORM public.pos_require_staff();
  SELECT id INTO v_shift FROM public.cash_shifts WHERE status = 'open' FOR UPDATE;
  IF v_shift IS NULL THEN RAISE EXCEPTION 'The cash drawer is not open' USING ERRCODE = 'P0001'; END IF;
  IF p_counted_cents IS NULL OR p_counted_cents < 0 THEN
    RAISE EXCEPTION 'Count the cash in the drawer and enter it' USING ERRCODE = 'P0001';
  END IF;
  v_totals := public.pos_shift_totals(v_shift);
  v_expected := (v_totals->>'expected_cash')::bigint;
  v_diff := p_counted_cents - v_expected;
  IF v_diff <> 0 AND char_length(btrim(COALESCE(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'The cash is ৳% %. Write a note explaining why',
      rtrim(to_char(abs(v_diff) / 100.0, 'FM99,99,99,990.99'), '.'),
      CASE WHEN v_diff < 0 THEN 'short' ELSE 'over' END USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.cash_shifts SET status = 'closed', closed_by = auth.uid(), closed_at = now(),
         expected_cash_cents = v_expected, counted_cash_cents = p_counted_cents, difference_cents = v_diff,
         close_note = left(btrim(COALESCE(p_note, '')), 500), summary = v_totals
   WHERE id = v_shift;
  RETURN v_totals || jsonb_build_object('counted', p_counted_cents, 'difference', v_diff);
END $$;

-- Payments from a closed shift can no longer be removed (the cash was already counted).
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
  IF EXISTS (SELECT 1 FROM public.cash_shifts WHERE id = p.shift_id AND status = 'closed') THEN
    RAISE EXCEPTION 'This payment belongs to a shift that is already closed' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.pos_lock_open_account(p.account_id);
  UPDATE public.account_payments SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   WHERE id = p_payment;
END $$;

REVOKE ALL ON FUNCTION public.pos_attach_shift() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_shift_totals(uuid)',
    'pos_open_shift(bigint,text)',
    'pos_cash_movement(text,bigint,text)',
    'pos_close_shift(bigint,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
