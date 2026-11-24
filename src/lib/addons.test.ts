import { describe, expect, it } from "vitest";
import { addonLines, addonQuantity, type Addon } from "./addons";

describe("addonQuantity", () => {
  it("multiplies guests and nights for daily meals", () => {
    expect(addonQuantity("per_person_per_night", 1, 3, 2)).toBe(6);
  });
  it("uses guests times count for per-person items", () => {
    expect(addonQuantity("per_person", 2, 4, 3)).toBe(8);
  });
  it("uses nights for per-night items and count for per-stay items", () => {
    expect(addonQuantity("per_night", 1, 4, 3)).toBe(3);
    expect(addonQuantity("per_stay", 2, 4, 3)).toBe(2);
  });
  it("returns 0 when nothing is chosen", () => {
    expect(addonQuantity("per_stay", 0, 2, 2)).toBe(0);
  });
});

describe("addonLines", () => {
  it("totals only chosen add-ons", () => {
    const addons: Addon[] = [
      {
        id: "a",
        category: "food",
        name: "Breakfast",
        description: "",
        price_cents: 35000,
        unit: "per_person_per_night",
      },
      {
        id: "b",
        category: "activity",
        name: "Boat",
        description: "",
        price_cents: 350000,
        unit: "per_stay",
      },
    ];
    const lines = addonLines(addons, { a: 1 }, 2, 3);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.total).toBe(35000 * 6);
  });
});

import { choiceKey, datedLines, datedQuantity, stayDays } from "./addons";

describe("meals and extras by day", () => {
  it("lists every day of the stay, arrival and departure included", () => {
    expect(stayDays("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(stayDays("2026-12-30", "2026-12-30")).toEqual([]);
  });
  it("prices meals for every guest on the chosen day", () => {
    expect(datedQuantity("per_person_per_night", 1, 3)).toBe(3);
    expect(datedQuantity("per_stay", 2, 3)).toBe(2);
    expect(datedQuantity("per_person", 2, 3)).toBe(6);
  });
  it("totals only chosen days", () => {
    const addons: Addon[] = [
      { id: "bf", category: "food", name: "Breakfast", description: "", price_cents: 35000, unit: "per_person_per_night" },
      { id: "boat", category: "activity", name: "Boat", description: "", price_cents: 350000, unit: "per_stay" },
    ];
    const days = stayDays("2026-12-10", "2026-12-12");
    const lines = datedLines(addons, { [choiceKey("bf", "2026-12-11")]: 1, [choiceKey("bf", "2026-12-12")]: 1, [choiceKey("boat", "2026-12-11")]: 1 }, 2, days);
    expect(lines.map((l) => `${l.addon.id}@${l.date}`)).toEqual(["bf@2026-12-11", "boat@2026-12-11", "bf@2026-12-12"]);
    expect(lines.reduce((s, l) => s + l.total, 0)).toBe(35000 * 2 * 2 + 350000);
  });
});
