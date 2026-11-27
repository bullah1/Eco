import { describe, expect, it } from "vitest";
import {
  averagePct,
  averageRate,
  change,
  dailyOccupancy,
  greeting,
  nightsIn,
  pointChange,
} from "./pos-overview";

describe("overview", () => {
  it("counts rooms occupied each night", () => {
    const pts = dailyOccupancy(
      [
        { check_in: "2026-11-24", check_out: "2026-11-27" },
        { check_in: "2026-11-26", check_out: "2026-11-28" },
      ],
      "2026-11-25",
      "2026-11-29",
      4,
    );
    expect(pts.map((p) => [p.date, p.occupied, p.pct])).toEqual([
      ["2026-11-25", 1, 25],
      ["2026-11-26", 2, 50],
      ["2026-11-27", 1, 25],
      ["2026-11-28", 0, 0],
    ]);
    expect(averagePct(pts)).toBe(25);
    expect(dailyOccupancy([], "2026-11-25", "2026-11-26", 0)[0]?.pct).toBe(0);
  });
  it("works out rate and change", () => {
    expect(averageRate(1950000, 3)).toBe(650000);
    expect(averageRate(0, 0)).toBeNull();
    expect(change(123, 100)).toEqual({ text: "+23%", dir: "up" });
    expect(change(80, 100)).toEqual({ text: "−20%", dir: "down" });
    expect(change(5, 0)).toEqual({ text: "new", dir: "up" });
    expect(change(0, 0)).toEqual({ text: "same", dir: "flat" });
    expect(pointChange(94, 88)).toEqual({ text: "+6 pts", dir: "up" });
  });
  it("greets by the time of day and clips stays to a range", () => {
    expect([greeting(9), greeting(14), greeting(20)]).toEqual([
      "Good morning",
      "Good afternoon",
      "Good evening",
    ]);
    expect(
      nightsIn({ check_in: "2026-11-20", check_out: "2026-11-30" }, "2026-11-25", "2026-11-27"),
    ).toBe(2);
    expect(
      nightsIn({ check_in: "2026-12-01", check_out: "2026-12-03" }, "2026-11-25", "2026-11-27"),
    ).toBe(0);
  });
});
