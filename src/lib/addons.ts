export type AddonUnit = "per_person" | "per_person_per_night" | "per_night" | "per_stay";
export type AddonCategory = "food" | "service" | "activity";

export type Addon = {
  id: string;
  category: AddonCategory;
  name: string;
  description: string;
  price_cents: number;
  unit: AddonUnit;
};

/** Add-ons priced by guests or nights are a simple on/off choice; the rest take a count. */
export const isToggleUnit = (unit: AddonUnit) =>
  unit === "per_person_per_night" || unit === "per_night";

export const unitLabel: Record<AddonUnit, string> = {
  per_person: "per person",
  per_person_per_night: "per person, per night",
  per_night: "per night",
  per_stay: "each",
};

export const categoryLabel: Record<AddonCategory, string> = {
  food: "Meals",
  service: "Services",
  activity: "Activities",
};

/** How many priced units a choice covers. `count` is 1 for toggles, or the number chosen. */
export function addonQuantity(unit: AddonUnit, count: number, guests: number, nights: number) {
  if (count <= 0) return 0;
  const g = Math.max(1, guests);
  const n = Math.max(1, nights);
  switch (unit) {
    case "per_person":
      return g * count;
    case "per_person_per_night":
      return g * n;
    case "per_night":
      return n;
    case "per_stay":
      return count;
  }
}

export function addonLines(
  addons: Addon[],
  chosen: Record<string, number>,
  guests: number,
  nights: number,
) {
  return addons
    .filter((a) => (chosen[a.id] ?? 0) > 0)
    .map((a) => {
      const quantity = addonQuantity(a.unit, chosen[a.id] ?? 0, guests, nights);
      return { addon: a, quantity, total: quantity * a.price_cents };
    });
}

export function describeQuantity(unit: AddonUnit, count: number, guests: number, nights: number) {
  const g = `${guests} ${guests === 1 ? "guest" : "guests"}`;
  const n = `${nights} ${nights === 1 ? "night" : "nights"}`;
  switch (unit) {
    case "per_person":
      return count > 1 ? `${g} × ${count}` : g;
    case "per_person_per_night":
      return `${g} × ${n}`;
    case "per_night":
      return n;
    case "per_stay":
      return `× ${count}`;
  }
}
