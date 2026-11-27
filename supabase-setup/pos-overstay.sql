-- POS: guests who stay past their departure date are billed automatically.
-- A guest still checked in after the departure date has stayed another night, so the
-- stay is extended to today and the room charge is re-posted at the same prices.
-- If the room is already booked by the next guest, the stay can't be extended; the
-- front desk shows it so staff can move the guest or check them out.
-- Runs when the front desk opens, before every check-out, and nightly (pg_cron).

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS extended_nights integer NOT NULL DEFAULT 0;

-- Internal: extend every overdue stay (optionally only one bill's). Returns how many
-- rooms were extended and how many could not be because the room is booked.
CREATE OR REPLACE FUNCTION public.pos_roll_overstays_run(p_account uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := public.resort_today();
  r record;
  v_extended int := 0;
  v_blocked int := 0;
BEGIN
  FOR r IN
    SELECT res.id, res.account_id, res.check_in, res.check_out, ru.room_type_id
      FROM public.reservations res
      JOIN public.room_units ru ON ru.id = res.room_unit_id
     WHERE res.stay_status = 'in_house' AND res.check_out < v_today
       AND res.account_id IS NOT NULL
       AND (p_account IS NULL OR res.account_id = p_account)
     ORDER BY res.check_out
       FOR UPDATE OF res
  LOOP
    BEGIN
      UPDATE public.reservations
         SET check_out = v_today,
             total_cents = public.stay_price(r.room_type_id, r.check_in, v_today),
             extended_nights = extended_nights + (v_today - r.check_out)
       WHERE id = r.id;
    EXCEPTION WHEN exclusion_violation THEN
      v_blocked := v_blocked + 1;
      CONTINUE;
    END;
    UPDATE public.account_charges
       SET voided_at = now(), voided_by = auth.uid(),
           void_reason = format('Stayed past departure (%s); stay extended to %s',
                                to_char(r.check_out, 'DD Mon'), to_char(v_today, 'DD Mon'))
     WHERE reservation_id = r.id AND kind = 'room' AND voided_at IS NULL;
    PERFORM public.pos_post_room_charge(r.id, r.account_id);
    v_extended := v_extended + 1;
  END LOOP;
  RETURN jsonb_build_object('extended', v_extended, 'blocked', v_blocked);
END $$;

-- Staff: run it from the front desk.
CREATE OR REPLACE FUNCTION public.pos_roll_overstays()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pos_require_staff();
  RETURN public.pos_roll_overstays_run(NULL);
END $$;

-- Check-out bills the extra nights first, so nobody leaves under-charged.
CREATE OR REPLACE FUNCTION public.pos_check_out(p_account uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance bigint; v_order text; v_rooms boolean;
BEGIN
  PERFORM public.pos_require_staff();
  PERFORM public.pos_lock_open_account(p_account);
  PERFORM public.pos_roll_overstays_run(p_account);
  IF EXISTS (SELECT 1 FROM public.reservations WHERE account_id = p_account AND stay_status = 'in_house'
              AND check_out < public.resort_today()) THEN
    RAISE EXCEPTION 'The guest stayed past the departure date but the room is booked by the next guest. Move the next guest''s booking to another room first (Calendar, tap their booking, Move room)' USING ERRCODE = 'P0001';
  END IF;
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

REVOKE ALL ON FUNCTION public.pos_roll_overstays_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_roll_overstays() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_roll_overstays() TO authenticated;
REVOKE ALL ON FUNCTION public.pos_check_out(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_check_out(uuid) TO authenticated;

-- Nightly, 00:10 in Bangladesh (18:10 UTC).
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'pos-roll-overstays';
SELECT cron.schedule('pos-roll-overstays', '10 18 * * *', $$SELECT public.pos_roll_overstays_run(NULL)$$);

-- Move a booking that hasn't checked in to another room for the same dates.
CREATE OR REPLACE FUNCTION public.pos_move_booking(p_reservation uuid, p_unit uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; v_unit record;
BEGIN
  PERFORM public.pos_require_staff();
  SELECT * INTO r FROM public.reservations WHERE id = p_reservation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0001'; END IF;
  IF r.status = 'cancelled' OR r.stay_status <> 'expected' THEN
    RAISE EXCEPTION 'Only a booking that has not checked in can be moved' USING ERRCODE = 'P0001';
  END IF;
  SELECT ru.id, ru.name, ru.room_type_id, ru.is_active, ru.housekeeping, rt.max_guests, rt.nightly_rate_cents
    INTO v_unit
  FROM public.room_units ru JOIN public.room_types rt ON rt.id = ru.room_type_id
  WHERE ru.id = p_unit;
  IF NOT FOUND OR NOT v_unit.is_active OR v_unit.housekeeping = 'maintenance' THEN
    RAISE EXCEPTION 'That room can''t be booked' USING ERRCODE = 'P0001';
  END IF;
  IF r.room_unit_id = p_unit THEN RETURN; END IF;
  IF r.guest_count > v_unit.max_guests THEN
    RAISE EXCEPTION 'Room % takes at most % guests', v_unit.name, v_unit.max_guests USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    UPDATE public.reservations
       SET room_unit_id = p_unit,
           nightly_rate_cents = v_unit.nightly_rate_cents,
           total_cents = public.stay_price(v_unit.room_type_id, r.check_in, r.check_out)
     WHERE id = p_reservation;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Room % is not free for these dates', v_unit.name USING ERRCODE = 'P0002';
  END;
END $$;

REVOKE ALL ON FUNCTION public.pos_move_booking(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_move_booking(uuid, uuid) TO authenticated;
