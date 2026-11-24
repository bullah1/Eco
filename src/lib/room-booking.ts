export type Priced = { nightly_rate_cents: number; max_guests: number };

export const formatMoney = (cents: number) => `৳${(cents / 100).toLocaleString("en-IN")}`;

/**
 * Split the guests across the chosen rooms: every room gets at least one guest, the rest
 * are spread evenly without going over a room's capacity. Returns null when the chosen
 * rooms can't host everyone (or there are more rooms than guests).
 */
export function allocateGuests(
  rooms: Pick<Priced, "max_guests">[],
  guests: number,
): number[] | null {
  if (rooms.length === 0 || guests < rooms.length) return null;
  if (rooms.some((room) => room.max_guests < 1)) return null;
  const result = rooms.map(() => 1);
  let left = guests - rooms.length;
  while (left > 0) {
    let progressed = false;
    for (let i = 0; i < rooms.length && left > 0; i++) {
      if (result[i]! < rooms[i]!.max_guests) {
        result[i] = result[i]! + 1;
        left--;
        progressed = true;
      }
    }
    if (!progressed) return null;
  }
  return result;
}

export function selectionProblem(
  rooms: Pick<Priced, "max_guests">[],
  guests: number,
): string | null {
  if (rooms.length === 0) return null;
  if (rooms.length > guests)
    return "You've chosen more rooms than guests. Remove a room, or go back and add guests.";
  const capacity = rooms.reduce((sum, room) => sum + room.max_guests, 0);
  if (capacity < guests)
    return `These rooms host up to ${capacity} ${capacity === 1 ? "guest" : "guests"}, and you have ${guests}. Add another room or reduce the guests.`;
  return null;
}

/** Groups free room units by category, keeping the order the server returned. */
export function groupUnits<T extends { room_type_id: string }>(units: T[]) {
  const groups = new Map<string, T[]>();
  for (const unit of units)
    groups.set(unit.room_type_id, [...(groups.get(unit.room_type_id) ?? []), unit]);
  return groups;
}

/** Picks the requested number of free units from each category (never more than are free). */
export function pickUnits<T extends { room_type_id: string }>(
  units: T[],
  quantities: Record<string, number>,
) {
  const groups = groupUnits(units);
  const picked: T[] = [];
  for (const [typeId, count] of Object.entries(quantities)) {
    picked.push(...(groups.get(typeId) ?? []).slice(0, Math.max(0, count)));
  }
  return picked;
}
