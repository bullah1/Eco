// Reports: money received (guest bills + restaurant), sales by type, occupancy.
// Pure summary logic is unit tested; the hook only fetches rows.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, nights, resortToday } from "./pos";

export type ReportRange = "today" | "7d" | "30d" | "month" | "last_month" | "year";

/** [from, to) as YYYY-MM-DD dates in resort time. */
export function rangeDates(
  range: ReportRange,
  today: string,
): { from: string; to: string; label: string } {
  const tomorrow = addDays(today, 1);
  const monthStart = `${today.slice(0, 8)}01`;
  switch (range) {
    case "today":
      return { from: today, to: tomorrow, label: "Today" };
    case "7d":
      return { from: addDays(today, -6), to: tomorrow, label: "Last 7 days" };
    case "30d":
      return { from: addDays(today, -29), to: tomorrow, label: "Last 30 days" };
    case "month":
      return { from: monthStart, to: tomorrow, label: "This month" };
    case "last_month":
      return {
        from: `${addDays(monthStart, -1).slice(0, 8)}01`,
        to: monthStart,
        label: "Last month",
      };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: tomorrow, label: "This year" };
  }
}

/** Dhaka midnight of a date, as an ISO timestamp for created_at filters. */
export const dhakaStart = (date: string) => new Date(`${date}T00:00:00+06:00`).toISOString();

export type PaymentRow = { amount_cents: number; method: string; created_at: string };
export type ChargeRow = { amount_cents: number | null; kind: string; charge_date: string };
export type StayRow = { check_in: string; check_out: string; type: string };

export type ReportInput = {
  from: string;
  to: string;
  roomCount: number;
  roomPayments: PaymentRow[];
  restaurantPayments: PaymentRow[];
  charges: ChargeRow[];
  stays: StayRow[];
};

export type Bucket = { key: string; rooms: number; restaurant: number };

export function summarize(input: ReportInput) {
  const { from, to, roomCount, roomPayments, restaurantPayments, charges, stays } = input;
  const days = nights(from, to);
  const sum = (rows: { amount_cents: number | null }[]) =>
    rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);

  const rooms = sum(roomPayments);
  const restaurant = sum(restaurantPayments);

  const byMethod = new Map<string, number>();
  for (const p of [...roomPayments, ...restaurantPayments])
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_cents);

  const byKind = new Map<string, number>();
  for (const c of charges) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + (c.amount_cents ?? 0));

  // Money received per day (and per month for long ranges), split by where it came from.
  const daily = new Map<string, Bucket>();
  for (let d = from; d < to; d = addDays(d, 1)) daily.set(d, { key: d, rooms: 0, restaurant: 0 });
  const add = (rows: PaymentRow[], field: "rooms" | "restaurant") => {
    for (const p of rows) {
      const b = daily.get(resortToday(new Date(p.created_at)));
      if (b) b[field] += p.amount_cents;
    }
  };
  add(roomPayments, "rooms");
  add(restaurantPayments, "restaurant");
  const monthly = new Map<string, Bucket>();
  for (const b of daily.values()) {
    const key = b.key.slice(0, 7);
    const m = monthly.get(key) ?? { key, rooms: 0, restaurant: 0 };
    m.rooms += b.rooms;
    m.restaurant += b.restaurant;
    monthly.set(key, m);
  }

  // Room-nights sold inside the range.
  let roomNights = 0;
  const byType = new Map<string, number>();
  for (const r of stays) {
    const n = nights(r.check_in > from ? r.check_in : from, r.check_out < to ? r.check_out : to);
    roomNights += n;
    byType.set(r.type, (byType.get(r.type) ?? 0) + n);
  }
  const capacity = roomCount * days;

  return {
    days,
    received: rooms + restaurant,
    rooms,
    restaurant,
    payments: roomPayments.length + restaurantPayments.length,
    sales: sum(charges),
    byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]),
    byKind: [...byKind.entries()].sort((a, b) => b[1] - a[1]),
    daily: [...daily.values()],
    monthly: [...monthly.values()],
    roomNights,
    capacity,
    occupancy: capacity > 0 ? Math.round((roomNights / capacity) * 100) : 0,
    byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export type ReportSummary = ReturnType<typeof summarize>;

/** Raw rows for a date range. `light` skips charges and stays (dashboard only needs money). */
export function useReportRows(from: string, to: string, light = false) {
  return useQuery({
    queryKey: ["pos", "report", from, to, light],
    refetchInterval: 60_000,
    queryFn: async () => {
      const pays = (table: "account_payments" | "restaurant_payments") =>
        supabase
          .from(table)
          .select("amount_cents, method, created_at")
          .is("voided_at", null)
          .gte("created_at", dhakaStart(from))
          .lt("created_at", dhakaStart(to))
          .limit(10000);
      const [roomPay, restPay, chg, res] = await Promise.all([
        pays("account_payments"),
        pays("restaurant_payments"),
        light
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from("account_charges")
              .select("amount_cents, kind, charge_date")
              .is("voided_at", null)
              .gte("charge_date", from)
              .lt("charge_date", to)
              .limit(10000),
        light
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from("reservations")
              .select("check_in, check_out, room_units(room_types(name))")
              .neq("status", "cancelled")
              .lt("check_in", to)
              .gt("check_out", from)
              .limit(10000),
      ]);
      for (const r of [roomPay, restPay, chg, res]) if (r.error) throw r.error;
      return {
        roomPayments: (roomPay.data ?? []) as PaymentRow[],
        restaurantPayments: (restPay.data ?? []) as PaymentRow[],
        charges: (chg.data ?? []) as ChargeRow[],
        stays: (
          (res.data ?? []) as {
            check_in: string;
            check_out: string;
            room_units: { room_types: { name: string } | null } | null;
          }[]
        ).map((r) => ({
          check_in: r.check_in,
          check_out: r.check_out,
          type: r.room_units?.room_types?.name ?? "Room",
        })),
      };
    },
  });
}
