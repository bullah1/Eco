import { describe, expect, it } from "vitest";

import { allocateGuests, selectionProblem } from "@/lib/room-booking";

const room = (max_guests: number) => ({ max_guests });

describe("allocateGuests", () => {
  it("gives every room at least one guest and spreads the rest", () => {
    expect(allocateGuests([room(3), room(2)], 4)).toEqual([2, 2]);
    expect(allocateGuests([room(3), room(2)], 5)).toEqual([3, 2]);
    expect(allocateGuests([room(2), room(2)], 2)).toEqual([1, 1]);
  });

  it("returns null when the rooms cannot host everyone", () => {
    expect(allocateGuests([room(2), room(2)], 5)).toBeNull();
  });

  it("returns null when there are more rooms than guests or no rooms", () => {
    expect(allocateGuests([room(2), room(2), room(2)], 2)).toBeNull();
    expect(allocateGuests([], 2)).toBeNull();
  });
});

describe("selectionProblem", () => {
  it("explains why a selection does not work", () => {
    expect(selectionProblem([room(2)], 4)).toMatch(/host up to 2 guests/);
    expect(selectionProblem([room(2), room(2)], 1)).toMatch(/more rooms than guests/);
  });

  it("is quiet when the selection works or is empty", () => {
    expect(selectionProblem([room(3), room(2)], 4)).toBeNull();
    expect(selectionProblem([], 2)).toBeNull();
  });
});

import { groupUnits, pickUnits } from "./room-booking";

describe("pickUnits", () => {
  const units = [
    { room_type_id: "a", id: 1 },
    { room_type_id: "a", id: 2 },
    { room_type_id: "b", id: 3 },
  ];
  it("takes the requested count per category", () => {
    expect(pickUnits(units, { a: 2, b: 1 }).map((u) => u.id)).toEqual([1, 2, 3]);
  });
  it("never takes more than are free", () => {
    expect(pickUnits(units, { b: 5 })).toHaveLength(1);
    expect(pickUnits(units, { a: 0 })).toHaveLength(0);
  });
  it("groups by category", () => {
    expect(groupUnits(units).get("a")).toHaveLength(2);
  });
});
