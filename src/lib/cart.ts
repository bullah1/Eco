import { useSyncExternalStore } from "react";

export type CartLine = { id: string; name: string; price_cents: number; quantity: number };

const KEY = "santa-monica-cart";
const listeners = new Set<() => void>();
let lines: CartLine[] = [];
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    lines = Array.isArray(parsed) ? parsed.filter((l) => l && l.id && l.quantity > 0) : [];
  } catch {
    lines = [];
  }
}

function save(next: CartLine[]) {
  lines = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the cart lives for this visit only */
  }
  listeners.forEach((l) => l());
}

export const cart = {
  get: () => {
    load();
    return lines;
  },
  set(item: Omit<CartLine, "quantity">, quantity: number) {
    load();
    const q = Math.max(0, Math.min(50, Math.round(quantity)));
    save(q === 0 ? lines.filter((l) => l.id !== item.id) : upsert(lines, item, q));
  },
  clear: () => save([]),
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        loaded = false;
        load();
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

function upsert(current: CartLine[], item: Omit<CartLine, "quantity">, quantity: number) {
  const exists = current.some((l) => l.id === item.id);
  return exists
    ? current.map((l) => (l.id === item.id ? { ...l, ...item, quantity } : l))
    : [...current, { ...item, quantity }];
}

const empty: CartLine[] = [];

export function useCart() {
  const current = useSyncExternalStore(cart.subscribe, cart.get, () => empty);
  const count = current.reduce((n, l) => n + l.quantity, 0);
  const total = current.reduce((n, l) => n + l.quantity * l.price_cents, 0);
  const quantityOf = (id: string) => current.find((l) => l.id === id)?.quantity ?? 0;
  return { lines: current, count, total, quantityOf };
}
