// Front-desk calendar: rooms down the side, days across the top, one bar per stay.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, nights, type PosReservation, type PosUnit } from "./pos";

export type BarTone = "in_house" | "booked" | "request" | "done";

export type TimelineBar = {
  reservation: PosReservation;
  tone: BarTone;
  /** Day index of arrival and departure relative to the first column (may run off either edge). */
  start: number;
  end: number;
};

export type TimelineRow = { unit: PosUnit; bars: TimelineBar[] };

export type TimelineGroup = {
  type_name: string;
  rate_cents: number;
  rows: TimelineRow[];
  /** Rooms of this type still bookable for each night shown. */
  free: number[];
};

export function barTone(r: PosReservation): BarTone {
  if (r.stay_status === "in_house") return "in_house";
  if (r.stay_status === "checked_out") return "done";
  return r.status === "pending" ? "request" : "booked";
}

/** Does this reservation match what was typed in the search box? */
export function matchesSearch(r: PosReservation, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return (
    r.guest_name.toLowerCase().includes(q) ||
    r.booking_reference.toLowerCase().includes(q) ||
    (digits.length >= 4 && r.guest_phone.replace(/\D/g, "").includes(digits))
  );
}

/** Whole days from `from` to `date`; negative when `date` is earlier. */
export const dayIndex = (from: string, date: string) =>
  date < from ? -nights(date, from) : nights(from, date);

export function buildTimeline(
  units: PosUnit[],
  reservations: PosReservation[],
  from: string,
  days: number,
): TimelineGroup[] {
  const to = addDays(from, days);
  const live = reservations.filter(
    (r) => r.status !== "cancelled" && r.check_in < to && r.check_out > from,
  );
  const sorted = units
    .filter((u) => u.is_active)
    .slice()
    .sort(
      (a, b) =>
        a.type_order - b.type_order || a.name.localeCompare(b.name, undefined, { numeric: true }),
    );

  const groups = new Map<string, TimelineGroup>();
  for (const unit of sorted) {
    const bars = live
      .filter((r) => r.room_unit_id === unit.id)
      .sort((a, b) => a.check_in.localeCompare(b.check_in))
      .map((r) => ({
        reservation: r,
        tone: barTone(r),
        start: dayIndex(from, r.check_in),
        end: dayIndex(from, r.check_out),
      }));

    let g = groups.get(unit.type_name);
    if (!g) {
      g = {
        type_name: unit.type_name,
        rate_cents: unit.rate_cents,
        rows: [],
        free: Array(days).fill(0),
      };
      groups.set(unit.type_name, g);
    }
    g.rows.push({ unit, bars });
    if (unit.housekeeping === "maintenance") continue;
    for (let d = 0; d < days; d++) {
      const taken = bars.some((b) => b.tone !== "done" && b.start <= d && b.end > d);
      if (!taken) g.free[d]! += 1;
    }
  }
  return [...groups.values()];
}

export function useTimeline(from: string, days: number, enabled = true) {
  return useQuery({
    queryKey: ["pos", "timeline", from, days],
    enabled,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id, booking_reference, booking_group, room_unit_id, check_in, check_out, guest_count, status, stay_status, guest_name, guest_phone, guest_note, total_cents, account_id",
        )
        .neq("status", "cancelled")
        .lt("check_in", addDays(from, days))
        .gt("check_out", from)
        .order("check_in")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as PosReservation[];
    },
  });
}
