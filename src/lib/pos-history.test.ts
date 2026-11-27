import { describe, expect, it } from "vitest";
import {
  bookingStatus,
  filterBookings,
  groupBookings,
  historySummary,
  mergeEvents,
  type BookingEvent,
  type HistoryRoom,
} from "./pos-history";

const T = "2026-11-27";
const room = (extra: Partial<HistoryRoom>): HistoryRoom => ({
  id: "x",
  room: "D-101",
  type_name: "Deluxe",
  check_in: "2026-12-01",
  check_out: "2026-12-03",
  guest_count: 2,
  status: "confirmed",
  stay_status: "expected",
  total_cents: 1300000,
  extended_nights: 0,
  ...extra,
});

describe("booking status", () => {
  it("reads the rooms of a booking", () => {
    expect(bookingStatus([room({})], T)).toBe("upcoming");
    expect(bookingStatus([room({ status: "pending" })], T)).toBe("request");
    expect(bookingStatus([room({ check_in: T })], T)).toBe("arriving");
    expect(bookingStatus([room({ stay_status: "in_house" }), room({})], T)).toBe("staying");
    expect(bookingStatus([room({ stay_status: "checked_out" })], T)).toBe("checked_out");
    expect(bookingStatus([room({ check_in: "2026-11-20", check_out: "2026-11-22" })], T)).toBe(
      "no_show",
    );
    expect(bookingStatus([room({ status: "cancelled" })], T)).toBe("cancelled");
    // one room cancelled, the other still coming
    expect(bookingStatus([room({ status: "cancelled" }), room({})], T)).toBe("upcoming");
  });
});

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  booking_reference: `REF${id}`,
  booking_group: null as string | null,
  room_unit_id: "u1",
  check_in: "2026-12-01",
  check_out: "2026-12-03",
  guest_count: 2,
  status: "confirmed" as const,
  stay_status: "expected" as const,
  guest_name: "Nusrat Jahan",
  guest_phone: "01712 345678",
  guest_email: "",
  guest_note: "",
  total_cents: 1300000,
  account_id: null as string | null,
  created_at: "2026-11-20T05:00:00Z",
  booked_via: "website",
  extended_nights: 0,
  ...extra,
});
const units = new Map([
  ["u1", { name: "D-101", type_name: "Deluxe" }],
  ["u2", { name: "D-102", type_name: "Deluxe" }],
]);

describe("history list", () => {
  const list = groupBookings(
    [
      row("1", { booking_group: "G", created_at: "2026-11-21T05:00:00Z" }),
      row("2", {
        booking_group: "G",
        room_unit_id: "u2",
        status: "cancelled",
        created_at: "2026-11-21T05:00:01Z",
      }),
      row("3", {
        guest_name: "Arif",
        guest_phone: "01911 000111",
        booked_via: "front_desk",
        status: "cancelled",
      }),
    ],
    units,
    T,
  );
  it("keeps rooms booked together as one booking, newest first", () => {
    expect(list.map((b) => [b.guest_name, b.rooms.map((r) => r.room), b.status])).toEqual([
      ["Nusrat Jahan", ["D-101", "D-102"], "upcoming"],
      ["Arif", ["D-101"], "cancelled"],
    ]);
    expect(list[0]!.total_cents).toBe(1300000); // the cancelled room doesn't count
  });
  it("filters and totals", () => {
    const f = { status: "all", via: "all", search: "" } as const;
    expect(filterBookings(list, { ...f, status: "cancelled" })).toHaveLength(1);
    expect(filterBookings(list, { ...f, via: "front_desk" })[0]?.guest_name).toBe("Arif");
    expect(filterBookings(list, { ...f, search: "+880 1911-000111" })[0]?.guest_name).toBe("Arif");
    expect(filterBookings(list, { ...f, search: "refx" })).toHaveLength(0);
    expect(historySummary(list)).toEqual({
      bookings: 2,
      cancelled: 1,
      roomNights: 2,
      value: 1300000,
      website: 1,
    });
  });
});

describe("timeline", () => {
  it("shows the same step on several rooms as one line", () => {
    const e = (id: string, res: string, kind: string, at: string): BookingEvent => ({
      id,
      reservation_id: res,
      kind,
      detail: "",
      actor_name: "Desk",
      created_at: at,
    });
    const merged = mergeEvents(
      [
        e("a", "r1", "checked_in", "2026-11-27T05:00:00Z"),
        e("b", "r2", "checked_in", "2026-11-27T05:00:02Z"),
        e("c", "r1", "checked_out", "2026-11-29T05:00:00Z"),
      ],
      (id) => (id === "r1" ? "D-101" : "D-102"),
    );
    expect(merged.map((m) => [m.kind, m.rooms])).toEqual([
      ["checked_in", ["D-101", "D-102"]],
      ["checked_out", ["D-101"]],
    ]);
  });
});

import { balanceLabel } from "./pos-history";
describe("bill balance", () => {
  it("says what is owed", () => {
    const bill = (balance_cents: number) => ({
      food_cents: 0,
      service_cents: 0,
      charges_cents: 0,
      paid_cents: 0,
      balance_cents,
    });
    expect(balanceLabel(undefined).tone).toBe("none");
    expect(balanceLabel(bill(5000)).tone).toBe("due");
    expect(balanceLabel(bill(-5000)).tone).toBe("credit");
    expect(balanceLabel(bill(0))).toEqual({ text: "Paid", tone: "paid" });
  });
});
