import { describe, expect, it } from "vitest";
import {
  addDays,
  buildBoard,
  changeDue,
  groupArrivals,
  nights,
  parseTaka,
  paymentProblem,
  resortToday,
  taka,
  type PosReservation,
  type PosUnit,
} from "./pos";

const unit = (id: string, name: string, extra: Partial<PosUnit> = {}): PosUnit => ({
  id,
  name,
  housekeeping: "clean",
  is_active: true,
  room_type_id: "t1",
  type_name: "Deluxe",
  type_order: 1,
  rate_cents: 650000,
  max_guests: 2,
  ...extra,
});
const res = (id: string, unitId: string, extra: Partial<PosReservation> = {}): PosReservation => ({
  id,
  booking_reference: `REF${id}`,
  booking_group: null,
  room_unit_id: unitId,
  check_in: "2026-11-24",
  check_out: "2026-11-26",
  guest_count: 2,
  status: "confirmed",
  stay_status: "expected",
  guest_name: "Guest",
  guest_phone: "01700000000",
  guest_note: "",
  total_cents: 1300000,
  account_id: null,
  ...extra,
});

describe("money and dates", () => {
  it("formats taka with Indian grouping", () => {
    expect(taka(1815000)).toBe("৳18,150");
    expect(taka(null)).toBe("৳0");
  });
  it("parses typed amounts", () => {
    expect(parseTaka("1,250")).toBe(125000);
    expect(parseTaka("৳ 99.5")).toBe(9950);
    expect(parseTaka("0")).toBeNull();
    expect(parseTaka("-5")).toBeNull();
    expect(parseTaka("abc")).toBeNull();
    expect(parseTaka("1.234")).toBeNull();
  });
  it("uses the resort's date, not the device's", () => {
    // 20:30 UTC on the 23rd is already 02:30 on the 24th in Dhaka
    expect(resortToday(new Date("2026-11-23T20:30:00Z"))).toBe("2026-11-24");
    expect(resortToday(new Date("2026-11-24T17:59:00Z"))).toBe("2026-11-24");
  });
  it("counts nights and adds days across months", () => {
    expect(nights("2026-11-29", "2026-12-02")).toBe(3);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("room board", () => {
  const today = "2026-11-24";
  it("shows each room's state for today", () => {
    const units = [
      unit("a", "D-101"),
      unit("b", "D-102"),
      unit("c", "D-103", { housekeeping: "dirty" }),
      unit("d", "D-104"),
      unit("e", "D-105", { housekeeping: "maintenance" }),
      unit("f", "D-106"),
    ];
    const reservations = [
      res("1", "a", { stay_status: "in_house", check_in: "2026-11-22" }),
      res("2", "b", { stay_status: "in_house", check_in: "2026-11-22", check_out: today }),
      res("3", "d"),
      res("4", "f", { check_in: "2026-11-28", check_out: "2026-11-30" }),
      res("5", "f", { status: "cancelled" }),
    ];
    const board = buildBoard(units, reservations, today);
    expect(board.map((t) => [t.unit.name, t.state])).toEqual([
      ["D-101", "in_house"],
      ["D-102", "leaving"],
      ["D-103", "dirty"],
      ["D-104", "arriving"],
      ["D-105", "maintenance"],
      ["D-106", "free"],
    ]);
    expect(board[5]?.next?.id).toBe("4");
  });
  it("sorts by room type then room number and hides inactive rooms", () => {
    const board = buildBoard(
      [
        unit("x", "S-10", { type_order: 2 }),
        unit("y", "S-9", { type_order: 2 }),
        unit("z", "D-1", { type_order: 1 }),
        unit("w", "D-2", { type_order: 1, is_active: false }),
      ],
      [],
      today,
    );
    expect(board.map((t) => t.unit.name)).toEqual(["D-1", "S-9", "S-10"]);
  });
});

describe("arrivals", () => {
  it("keeps rooms booked together on one card and skips future or done stays", () => {
    const list = groupArrivals(
      [
        res("1", "a", { booking_group: "G1", guest_name: "Nusrat" }),
        res("2", "b", { booking_group: "G1", guest_name: "Nusrat", status: "pending" }),
        res("3", "c", { guest_name: "Arif", check_in: "2026-11-23" }),
        res("4", "d", { check_in: "2026-11-25" }),
        res("5", "e", { stay_status: "in_house" }),
      ],
      "2026-11-24",
    );
    expect(list.map((a) => [a.guest_name, a.reservations.length, a.confirmed])).toEqual([
      ["Arif", 1, true],
      ["Nusrat", 2, false],
    ]);
    expect(list[1]?.total_cents).toBe(2600000);
  });
});

describe("payments", () => {
  it("checks the amount and transaction ID like the database does", () => {
    expect(paymentProblem("cash", 100, 0, "")).toMatch(/Nothing is owed/);
    expect(paymentProblem("cash", null, 5000, "")).toMatch(/Enter the amount/);
    expect(paymentProblem("cash", 6000, 5000, "")).toMatch(/more than the balance of ৳50/);
    expect(paymentProblem("bkash", 5000, 5000, "12")).toMatch(/transaction ID/);
    expect(paymentProblem("bkash", 5000, 5000, "TX9KJ4")).toBeNull();
    expect(paymentProblem("card", 5000, 5000, "")).toBeNull();
  });
  it("works out change for cash", () => {
    expect(changeDue(1820000, 1815000)).toBe(5000);
    expect(changeDue(1000, 5000)).toBe(0);
    expect(changeDue(null, 5000)).toBe(0);
  });
});

import { differenceLabel } from "./pos-cash";
describe("cash close", () => {
  it("names the difference", () => {
    expect(differenceLabel(0)).toEqual({ text: "Exact", tone: "ok" });
    expect(differenceLabel(-12000)).toEqual({ text: "৳120 short", tone: "short" });
    expect(differenceLabel(5000)).toEqual({ text: "৳50 over", tone: "over" });
  });
});
