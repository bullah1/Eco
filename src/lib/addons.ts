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

/* ---------- Meals and extras chosen per day of the stay ---------- */

/** Key for one add-on on one date. */
export const choiceKey = (addonId: string, date: string) => `${addonId}|${date}`;

/** Meals and per-person items are a simple on/off for everyone on that day. */
export const isForEveryone = (unit: AddonUnit) => unit === "per_person_per_night" || unit === "per_person";

/** Every calendar day of the stay, arrival and departure included (yyyy-mm-dd). */
export function stayDays(checkIn: string, checkOut: string): string[] {
  if (!checkIn || !checkOut || checkOut <= checkIn) return [];
  const days: string[] = [];
  const d = new Date(`${checkIn}T12:00:00Z`);
  const end = new Date(`${checkOut}T12:00:00Z`);
  while (d <= end && days.length < 32) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/** Priced units for one add-on on one day. Matches create_booking on the server. */
export function datedQuantity(unit: AddonUnit, count: number, guests: number) {
  if (count <= 0) return 0;
  const g = Math.max(1, guests);
  if (unit === "per_person_per_night") return g;
  if (unit === "per_person") return g * count;
  return count;
}

export type DatedLine = { addon: Addon; date: string; count: number; quantity: number; total: number };

export function datedLines(addons: Addon[], choices: Record<string, number>, guests: number, days: string[]) {
  const lines: DatedLine[] = [];
  for (const date of days) {
    for (const addon of addons) {
      const count = choices[choiceKey(addon.id, date)] ?? 0;
      if (count <= 0) continue;
      const quantity = datedQuantity(addon.unit, count, guests);
      lines.push({ addon, date, count, quantity, total: quantity * addon.price_cents });
    }
  }
  return lines;
}
