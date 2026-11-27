// Front desk "Today": every room sorted into one clear group.

import { addDays, nights, type PosReservation, type PosUnit } from "./pos";

export type FreeRoom = {
  unit: PosUnit;
  /** Free tonight but still needs cleaning. */
  dirty: boolean;
  /** Next guest arrives on this date (null = no booking in the next two months). */
  freeUntil: string | null;
};

export type Stay = {
  unit: PosUnit;
  reservation: PosReservation;
  /** Nights left after tonight; 0 = leaving today. */
  nightsLeft: number;
  /** The room is free again from this date (later if someone is booked right after). */
  freeFrom: string;
  /** Extra nights billed because the guest stayed past departure. */
  extended: number;
  /** Past departure and the room is booked by the next guest. */
  blocked: boolean;
};

export type BookedAhead = {
  key: string;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  rooms: string[];
  request: boolean;
  first: PosReservation;
};

export type Desk = {
  free: FreeRoom[];
  leaving: Stay[];
  staying: Stay[];
  booked: BookedAhead[];
  outOfOrder: PosUnit[];
};

const byRoom = (a: PosUnit, b: PosUnit) =>
  a.type_order - b.type_order || a.name.localeCompare(b.name, undefined, { numeric: true });

export function buildDesk(units: PosUnit[], reservations: PosReservation[], today: string): Desk {
  const live = reservations.filter((r) => r.status !== "cancelled");
  const active = units.filter((u) => u.is_active).sort(byRoom);
  const unitById = new Map(active.map((u) => [u.id, u]));
  const expectedFor = (unitId: string) =>
    live
      .filter((r) => r.room_unit_id === unitId && r.stay_status === "expected")
      .sort((a, b) => a.check_in.localeCompare(b.check_in));

  const free: FreeRoom[] = [];
  const leaving: Stay[] = [];
  const staying: Stay[] = [];
  const outOfOrder: PosUnit[] = [];

  for (const unit of active) {
    const inHouse = live.find((r) => r.room_unit_id === unit.id && r.stay_status === "in_house");
    const upcoming = expectedFor(unit.id);
    if (inHouse) {
      // Free again when they leave, unless the next guest arrives the same day.
      let freeFrom = inHouse.check_out < today ? today : inHouse.check_out;
      for (const r of upcoming)
        if (r.check_in <= freeFrom && r.check_out > freeFrom) freeFrom = r.check_out;
      const stay: Stay = {
        unit,
        reservation: inHouse,
        nightsLeft: inHouse.check_out > today ? nights(today, inHouse.check_out) : 0,
        freeFrom,
        extended: inHouse.extended_nights ?? 0,
        blocked: inHouse.check_out < today,
      };
      (stay.nightsLeft === 0 ? leaving : staying).push(stay);
      continue;
    }
    if (unit.housekeeping === "maintenance") {
      outOfOrder.push(unit);
      continue;
    }
    // Someone is booked tonight (arriving today, or arrived late and not checked in yet).
    const tonight = upcoming.find((r) => r.check_in <= today && r.check_out > today);
    if (tonight) continue;
    const next = upcoming.find((r) => r.check_in > today);
    free.push({ unit, dirty: unit.housekeeping === "dirty", freeUntil: next?.check_in ?? null });
  }

  staying.sort(
    (a, b) =>
      a.reservation.check_out.localeCompare(b.reservation.check_out) || byRoom(a.unit, b.unit),
  );

  const groups = new Map<string, BookedAhead>();
  for (const r of live) {
    if (r.stay_status !== "expected" || r.check_in <= today) continue;
    const key = r.booking_group || r.booking_reference;
    const room = unitById.get(r.room_unit_id)?.name ?? "Room";
    const g = groups.get(key);
    if (g) {
      g.rooms.push(room);
      if (r.check_in < g.check_in) g.check_in = r.check_in;
      if (r.check_out > g.check_out) g.check_out = r.check_out;
      g.request ||= r.status === "pending";
    } else {
      groups.set(key, {
        key,
        guest_name: r.guest_name || "Guest",
        guest_phone: r.guest_phone,
        check_in: r.check_in,
        check_out: r.check_out,
        rooms: [room],
        request: r.status === "pending",
        first: r,
      });
    }
  }
  const booked = [...groups.values()].sort((a, b) => a.check_in.localeCompare(b.check_in));

  return { free, leaving, staying, booked, outOfOrder };
}

/** "Free till 3 Dec", "Free, no bookings ahead" — how long a free room stays free. */
export function freeLabel(freeUntil: string | null, today: string) {
  if (!freeUntil) return "No bookings ahead";
  if (freeUntil === addDays(today, 1)) return "Tonight only";
  return `Free ${nights(today, freeUntil)} nights`;
}
