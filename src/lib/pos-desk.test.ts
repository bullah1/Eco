import { describe, expect, it } from "vitest";
import { buildDesk, freeLabel } from "./pos-desk";
import type { PosReservation, PosUnit } from "./pos";

const unit = (id: string, extra: Partial<PosUnit> = {}): PosUnit => ({
  id,
  name: id,
  housekeeping: "clean",
  is_active: true,
  room_type_id: "t",
  type_name: "Deluxe",
  type_order: 1,
  rate_cents: 650000,
  max_guests: 2,
  ...extra,
});
let n = 0;
const res = (
  unitId: string,
  check_in: string,
  check_out: string,
  extra: Partial<PosReservation> = {},
): PosReservation => ({
  id: `r${++n}`,
  booking_reference: `REF${n}`,
  booking_group: null,
  room_unit_id: unitId,
  check_in,
  check_out,
  guest_count: 2,
  status: "confirmed",
  stay_status: "expected",
  guest_name: `Guest ${n}`,
  guest_phone: "",
  guest_note: "",
  total_cents: 0,
  account_id: null,
  ...extra,
});

const T = "2026-11-27";

describe("front desk groups", () => {
  it("puts every room in exactly one group", () => {
    const units = [
      unit("D-101"),
      unit("D-102"),
      unit("D-103", { housekeeping: "dirty" }),
      unit("D-104"),
      unit("D-105", { housekeeping: "maintenance" }),
      unit("D-106"),
      unit("D-107"),
      unit("D-108", { is_active: false }),
    ];
    const list = [
      res("D-101", "2026-11-25", "2026-11-30", { stay_status: "in_house" }),
      res("D-102", "2026-11-25", T, { stay_status: "in_house", extended_nights: 1 }),
      res("D-103", "2026-12-03", "2026-12-05"),
      res("D-104", T, "2026-11-29"), // arriving today: not free
      res("D-106", "2026-11-28", "2026-11-30", { booking_group: "G", status: "pending" }),
      res("D-107", "2026-11-28", "2026-12-01", { booking_group: "G", status: "pending" }),
      res("D-106", "2026-11-20", "2026-11-22", { stay_status: "checked_out" }),
    ];
    const d = buildDesk(units, list, T);
    expect(d.free.map((f) => [f.unit.name, f.dirty, f.freeUntil])).toEqual([
      ["D-103", true, "2026-12-03"],
      ["D-106", false, "2026-11-28"],
      ["D-107", false, "2026-11-28"],
    ]);
    expect(d.staying.map((s) => [s.unit.name, s.nightsLeft, s.freeFrom])).toEqual([
      ["D-101", 3, "2026-11-30"],
    ]);
    expect(d.leaving.map((s) => [s.unit.name, s.extended, s.blocked])).toEqual([
      ["D-102", 1, false],
    ]);
    expect(d.outOfOrder.map((u) => u.name)).toEqual(["D-105"]);
    // the two rooms booked together show as one booking; today's arrival is not "ahead"
    expect(d.booked.map((b) => [b.rooms, b.check_in, b.check_out, b.request])).toEqual(
      [
        [["D-103"], "2026-12-03", "2026-12-05", false],
        [["D-106", "D-107"], "2026-11-28", "2026-12-01", true],
      ].sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
    );
  });

  it("knows when an occupied room is really free again", () => {
    const d = buildDesk(
      [unit("D-101"), unit("D-102")],
      [
        res("D-101", "2026-11-25", "2026-11-29", { stay_status: "in_house" }),
        res("D-101", "2026-11-29", "2026-12-02"), // next guest arrives the same day
        res("D-102", "2026-11-24", "2026-11-26", { stay_status: "in_house" }), // past departure, not rolled
      ],
      T,
    );
    expect(d.staying[0]?.freeFrom).toBe("2026-12-02");
    expect(d.leaving[0]?.blocked).toBe(true);
    expect(d.leaving[0]?.freeFrom).toBe(T);
  });

  it("says how long a free room stays free", () => {
    expect(freeLabel(null, T)).toBe("No bookings ahead");
    expect(freeLabel("2026-11-28", T)).toBe("Tonight only");
    expect(freeLabel("2026-12-01", T)).toBe("Free 4 nights");
  });
});
