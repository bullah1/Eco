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
