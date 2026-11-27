import { describe, expect, it } from "vitest";
import { rangeDates, summarize } from "./pos-reports";

describe("rangeDates", () => {
  it("last month spans the whole previous month", () => {
    expect(rangeDates("last_month", "2026-03-15")).toMatchObject({
      from: "2026-02-01",
      to: "2026-03-01",
    });
  });
  it("this year starts on 1 January and includes today", () => {
    expect(rangeDates("year", "2026-11-27")).toMatchObject({
      from: "2026-01-01",
      to: "2026-11-28",
    });
  });
});

describe("summarize", () => {
  const base = {
    from: "2026-11-01",
    to: "2026-11-03",
    roomCount: 2,
    charges: [],
    stays: [],
  };

  it("splits money by source and by Dhaka day", () => {
    const s = summarize({
      ...base,
      // 23:30 UTC on 1 Nov is already 2 Nov in Dhaka.
      roomPayments: [{ amount_cents: 500, method: "cash", created_at: "2026-11-01T23:30:00Z" }],
      restaurantPayments: [
        { amount_cents: 200, method: "bkash", created_at: "2026-11-01T06:00:00Z" },
      ],
    });
    expect(s.received).toBe(700);
    expect(s.rooms).toBe(500);
    expect(s.restaurant).toBe(200);
    expect(s.daily).toEqual([
      { key: "2026-11-01", rooms: 0, restaurant: 200 },
      { key: "2026-11-02", rooms: 500, restaurant: 0 },
    ]);
    expect(s.monthly).toEqual([{ key: "2026-11", rooms: 500, restaurant: 200 }]);
  });

  it("counts only the nights inside the range for occupancy", () => {
    const s = summarize({
      ...base,
      roomPayments: [],
      restaurantPayments: [],
      stays: [{ check_in: "2026-10-30", check_out: "2026-11-02", type: "Deluxe" }],
    });
    expect(s.roomNights).toBe(1);
    expect(s.capacity).toBe(4);
    expect(s.occupancy).toBe(25);
  });
});
