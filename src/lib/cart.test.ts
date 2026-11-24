import { beforeEach, describe, expect, it } from "vitest";
import { cart } from "./cart";

describe("cart", () => {
  beforeEach(() => cart.clear());
  it("adds, updates and removes lines", () => {
    cart.set({ id: "a", name: "Tea", price_cents: 3000 }, 2);
    cart.set({ id: "b", name: "Coffee", price_cents: 8000 }, 1);
    cart.set({ id: "a", name: "Tea", price_cents: 3000 }, 3);
    expect(cart.get()).toEqual([
      { id: "a", name: "Tea", price_cents: 3000, quantity: 3 },
      { id: "b", name: "Coffee", price_cents: 8000, quantity: 1 },
    ]);
    cart.set({ id: "a", name: "Tea", price_cents: 3000 }, 0);
    expect(cart.get().map((l) => l.id)).toEqual(["b"]);
  });
  it("caps quantity at 50", () => {
    cart.set({ id: "a", name: "Tea", price_cents: 3000 }, 99);
    expect(cart.get()[0]!.quantity).toBe(50);
  });
});
