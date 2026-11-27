// Overview dashboard: occupancy per night and the headline numbers.

import { addDays, nights } from "./pos";
import type { StayRow } from "./pos-reports";

export type OccupancyPoint = { date: string; occupied: number; pct: number };

/** Rooms occupied each night in [from, to), as a share of the rooms the resort has. */
export function dailyOccupancy(
  stays: Pick<StayRow, "check_in" | "check_out">[],
  from: string,
  to: string,
  roomCount: number,
): OccupancyPoint[] {
  const out: OccupancyPoint[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    const occupied = stays.filter((s) => s.check_in <= d && s.check_out > d).length;
    out.push({
      date: d,
      occupied,
      pct: roomCount > 0 ? Math.min(100, Math.round((occupied / roomCount) * 100)) : 0,
    });
  }
  return out;
}

/** Average of the occupancy points (0 when there are none). */
export const averagePct = (points: OccupancyPoint[]) =>
  points.length ? Math.round(points.reduce((s, p) => s + p.pct, 0) / points.length) : 0;

/** Room money per night sold. null when nothing was sold. */
export function averageRate(roomChargesCents: number, roomNights: number) {
  return roomNights > 0 ? Math.round(roomChargesCents / roomNights) : null;
}

/** "+6%" / "−3%" / "same" change between two numbers, and which way it went. */
export function change(now: number, before: number) {
  if (before === 0 && now === 0) return { text: "same", dir: "flat" as const };
  if (before === 0) return { text: "new", dir: "up" as const };
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { text: "same", dir: "flat" as const };
  return {
    text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`,
    dir: pct > 0 ? ("up" as const) : ("down" as const),
  };
}

/** Change in percentage points for occupancy: "+6 pts". */
export function pointChange(now: number, before: number) {
  const d = now - before;
  if (d === 0) return { text: "same", dir: "flat" as const };
  return {
    text: `${d > 0 ? "+" : "−"}${Math.abs(d)} pts`,
    dir: d > 0 ? ("up" as const) : ("down" as const),
  };
}

export const greeting = (hour: number) =>
  hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

/** Nights a stay overlaps [from, to). */
export const nightsIn = (s: Pick<StayRow, "check_in" | "check_out">, from: string, to: string) =>
  Math.max(0, nights(s.check_in > from ? s.check_in : from, s.check_out < to ? s.check_out : to));
