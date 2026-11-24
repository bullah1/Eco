import { describe, expect, it } from "vitest";
import { buildTimeline, dayIndex, matchesSearch } from "./pos-timeline";
import type { PosReservation, PosUnit } from "./pos";

const unit = (
  id: string,
  name: string,
  type = "Deluxe",
  extra: Partial<PosUnit> = {},
): PosUnit => ({
  id,
  name,
  housekeeping: "clean",
  is_active: true,
  room_type_id: type,
  type_name: type,
  type_order: type === "Deluxe" ? 1 : 2,
  rate_cents: 650000,
  max_guests: 2,
  ...extra,
});
const res = (
  id: string,
  unitId: string,
  check_in: string,
  check_out: string,
  extra: Partial<PosReservation> = {},
): PosReservation => ({
  id,
  booking_reference: `REF${id}`,
  booking_group: null,
  room_unit_id: unitId,
  check_in,
  check_out,
  guest_count: 2,
  status: "confirmed",
  stay_status: "expected",
  guest_name: "Guest",
  guest_phone: "01712 345678",
  guest_note: "",
  total_cents: 0,
  account_id: null,
  ...extra,
});

describe("calendar", () => {
  it("counts days either side of the first column", () => {
    expect(dayIndex("2026-11-24", "2026-11-22")).toBe(-2);
    expect(dayIndex("2026-11-24", "2026-12-01")).toBe(7);
  });

  it("places stays, groups by room type and counts free rooms per night", () => {
    const units = [
      unit("a", "D-101"),
      unit("b", "D-102"),
      unit("c", "D-103", "Deluxe", { housekeeping: "maintenance" }),
      unit("s", "S-1", "Suite"),
      unit("x", "D-104", "Deluxe", { is_active: false }),
    ];
    const list = [
      res("1", "a", "2026-11-22", "2026-11-26", { stay_status: "in_house" }),
      res("2", "a", "2026-11-26", "2026-11-28", { status: "pending" }),
      res("3", "b", "2026-11-20", "2026-11-25", { stay_status: "checked_out" }),
      res("4", "s", "2026-12-10", "2026-12-12"),
      res("5", "b", "2026-11-25", "2026-11-27", { status: "cancelled" }),
    ];
    const g = buildTimeline(units, list, "2026-11-24", 4);
    expect(g.map((x) => [x.type_name, x.rows.map((r) => r.unit.name)])).toEqual([
      ["Deluxe", ["D-101", "D-102", "D-103"]],
      ["Suite", ["S-1"]],
    ]);
    const a = g[0]!.rows[0]!.bars;
    expect(a.map((b) => [b.reservation.id, b.tone, b.start, b.end])).toEqual([
      ["1", "in_house", -2, 2],
      ["2", "request", 2, 4],
    ]);
    expect(g[0]!.rows[1]!.bars[0]?.tone).toBe("done");
    // D-101 is taken every night, D-102 left early so it is free, D-103 is out of order
    expect(g[0]!.free).toEqual([1, 1, 1, 1]);
    expect(g[1]!.free).toEqual([1, 1, 1, 1]);
  });

  it("finds guests by name, reference or phone", () => {
    const r = res("9", "a", "2026-11-24", "2026-11-25", { guest_name: "Nusrat Jahan" });
    expect(matchesSearch(r, "nusrat")).toBe(true);
    expect(matchesSearch(r, "ref9")).toBe(true);
    expect(matchesSearch(r, "345678")).toBe(true);
    expect(matchesSearch(r, "arif")).toBe(false);
    expect(matchesSearch(r, "")).toBe(true);
  });
});
