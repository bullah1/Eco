import { describe, expect, it } from "vitest";
import { filterPayments, paymentTotals, type ReceivedPayment } from "./pos-payments";

const p = (id: string, extra: Partial<ReceivedPayment>): ReceivedPayment => ({
  id,
  source: "rooms",
  method: "cash",
  amount_cents: 100000,
  reference: "",
  created_at: "2026-11-27T05:00:00Z",
  voided_at: null,
  void_reason: null,
  shift_no: "S1",
  payer: "Guest",
  phone: "",
  doc_no: "Bill A1001",
  account_id: "a1",
  ...extra,
});

const list = [
  p("1", { payer: "Nusrat Jahan", phone: "01712 345678", amount_cents: 500000 }),
  p("2", { method: "bkash", reference: "TX9KJ4", amount_cents: 200000 }),
  p("3", { source: "restaurant", doc_no: "Order R1003", payer: "T-2", amount_cents: 48000 }),
  p("4", { amount_cents: 70000, voided_at: "2026-11-27T06:00:00Z", void_reason: "Wrong bill" }),
];
const all = { method: "all", source: "all", search: "", showRemoved: false } as const;

describe("payments received", () => {
  it("hides removed payments unless asked, and totals only the live ones", () => {
    expect(filterPayments(list, all).map((x) => x.id)).toEqual(["1", "2", "3"]);
    expect(filterPayments(list, { ...all, showRemoved: true })).toHaveLength(4);
    const t = paymentTotals(list);
    expect(t.total).toBe(748000);
    expect(t.count).toBe(3);
    expect(t.byMethod).toEqual({ cash: 548000, bkash: 200000 });
    expect([t.rooms, t.restaurant]).toEqual([700000, 48000]);
  });
  it("filters by method, place and search", () => {
    expect(filterPayments(list, { ...all, method: "bkash" }).map((x) => x.id)).toEqual(["2"]);
    expect(filterPayments(list, { ...all, source: "restaurant" }).map((x) => x.id)).toEqual(["3"]);
    expect(filterPayments(list, { ...all, search: "nusrat" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterPayments(list, { ...all, search: "+880 1712-345678" }).map((x) => x.id)).toEqual([
      "1",
    ]);
    expect(filterPayments(list, { ...all, search: "tx9kj4" }).map((x) => x.id)).toEqual(["2"]);
    expect(filterPayments(list, { ...all, search: "r1003" }).map((x) => x.id)).toEqual(["3"]);
  });
});
