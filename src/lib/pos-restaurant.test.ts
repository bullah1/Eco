import { describe, expect, it } from "vitest";
import { groupMenu, minutesSince, ticketPlace, ticketTotal, unsentCount } from "./pos-restaurant";

describe("restaurant tickets", () => {
  const items = [
    { quantity: 3, sent_qty: 2, unit_price_cents: 35000 },
    { quantity: 1, sent_qty: 0, unit_price_cents: 6000 },
    { quantity: 2, sent_qty: 2, unit_price_cents: 4000 },
  ];
  it("adds up the order and counts dishes not yet sent", () => {
    expect(ticketTotal(items)).toBe(3 * 35000 + 6000 + 2 * 4000);
    expect(unsentCount(items)).toBe(2);
  });
  it("names where the order is", () => {
    const tables = [{ id: "t1", name: "T-1", sort_order: 1, is_active: true }];
    expect(ticketPlace({ table_id: "t1", label: "", ticket_no: "R1001" }, tables)).toBe("T-1");
    expect(ticketPlace({ table_id: "t1", label: "Rahim", ticket_no: "R1001" }, tables)).toBe(
      "T-1 · Rahim",
    );
    expect(ticketPlace({ table_id: null, label: "", ticket_no: "R1002" }, tables)).toBe(
      "Counter R1002",
    );
    expect(
      ticketPlace({ table_id: null, label: "Takeaway Arif", ticket_no: "R1003" }, tables),
    ).toBe("Takeaway Arif");
  });
  it("groups and searches the menu in menu order", () => {
    const menu = [
      { id: "1", name: "Tea", category: "Drinks", price_cents: 3000, sort_order: 3 },
      { id: "2", name: "Fish fry", category: "Lunch", price_cents: 35000, sort_order: 1 },
      { id: "3", name: "Coconut water", category: "Drinks", price_cents: 10000, sort_order: 2 },
    ];
    expect(groupMenu(menu).map(([c, l]) => [c, l.map((m) => m.name)])).toEqual([
      ["Lunch", ["Fish fry"]],
      ["Drinks", ["Coconut water", "Tea"]],
    ]);
    expect(groupMenu(menu, "drink").flatMap(([, l]) => l.map((m) => m.id))).toEqual(["3", "1"]);
  });
  it("counts minutes waiting", () => {
    expect(minutesSince("2026-11-24T10:00:00Z", Date.parse("2026-11-24T10:17:40Z"))).toBe(17);
  });
});
