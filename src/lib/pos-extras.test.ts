import { describe, expect, it } from "vitest";
import { isLow, isoWeekday, nightPrice, type RateRule } from "./pos-extras";

const rule = (r: Partial<RateRule>): RateRule => ({
  id: Math.random().toString(),
  name: "r",
  room_type_id: null,
  start_date: null,
  end_date: null,
  weekdays: null,
  kind: "percent",
  value: 0,
  priority: 0,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  ...r,
});

// Same cases that were checked against public.night_price in Postgres.
describe("nightPrice", () => {
  const weekend = rule({ weekdays: [5, 6], value: 20 });
  const holiday = rule({
    room_type_id: "deluxe",
    start_date: "2026-12-24",
    end_date: "2026-12-26",
    kind: "fixed",
    value: 150000,
    priority: 10,
  });
  const rules = [weekend, holiday];

  it("knows the weekdays", () => {
    expect(isoWeekday("2026-11-27")).toBe(5); // Friday
    expect(isoWeekday("2026-11-29")).toBe(7); // Sunday
  });
  it("adds 20% on Friday and Saturday only", () => {
    expect(nightPrice(rules, "deluxe", 100000, "2026-12-03").cents).toBe(100000);
    expect(nightPrice(rules, "deluxe", 100000, "2026-12-04").cents).toBe(120000);
    expect(nightPrice(rules, "deluxe", 100000, "2026-12-05").cents).toBe(120000);
  });
  it("lets the higher priority holiday price win over the weekend", () => {
    expect(nightPrice(rules, "deluxe", 100000, "2026-12-25").cents).toBe(150000);
    expect(nightPrice(rules, "deluxe", 100000, "2026-12-27").cents).toBe(100000);
  });
  it("applies a room-type rule only to that type", () => {
    expect(nightPrice(rules, "suite", 100000, "2026-12-24").cents).toBe(100000);
  });
  it("ignores switched-off rules and rounds to whole taka", () => {
    expect(
      nightPrice([rule({ value: 10, is_active: false, weekdays: [4] })], "x", 100000, "2026-12-03")
        .cents,
    ).toBe(100000);
    expect(nightPrice([rule({ value: 7, weekdays: [4] })], "x", 650050, "2026-12-03").cents).toBe(
      695600,
    );
  });
});

describe("isLow", () => {
  it("alerts at or below the alert level", () => {
    expect(isLow({ quantity: 10, min_quantity: 10 })).toBe(true);
    expect(isLow({ quantity: 10.5, min_quantity: 10 })).toBe(false);
  });
});
