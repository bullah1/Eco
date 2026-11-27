// Expenses, kitchen stock, price rules and discounts (tables from supabase-setup/pos-extras.sql).
// Every hook marks `notSetUp` instead of failing when that SQL has not been run yet,
// so the rest of the POS keeps working.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dhakaStart } from "./pos-reports";

/** PostgREST/Postgres "table or function does not exist". */
export function isNotSetUp(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === "42P01" ||
    e.code === "PGRST205" ||
    e.code === "PGRST202" ||
    e.code === "42883" ||
    /does not exist|could not find the (table|function)/i.test(e.message ?? "")
  );
}

/* ---------- expenses ---------- */

export const expenseCategories = [
  { id: "market", label: "Market / বাজার" },
  { id: "salary", label: "Salary / বেতন" },
  { id: "fuel", label: "Generator fuel / তেল" },
  { id: "electricity", label: "Electricity / বিদ্যুৎ" },
  { id: "repairs", label: "Repairs / মেরামত" },
  { id: "transport", label: "Transport / যাতায়াত" },
  { id: "supplies", label: "Supplies / মালামাল" },
  { id: "rent", label: "Rent / ভাড়া" },
  { id: "other", label: "Other / অন্যান্য" },
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number]["id"];
export const categoryLabel = (id: string) =>
  expenseCategories.find((c) => c.id === id)?.label ?? id;

export type Expense = {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount_cents: number;
  method: string;
  reference: string;
  cash_movement_id: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

/** Expenses with expense_date in [from, to). */
export function useExpenses(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["pos", "expenses", from, to],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", from)
        .lt("expense_date", to)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) {
        if (isNotSetUp(error)) return { notSetUp: true, rows: [] as Expense[] };
        throw error;
      }
      return { notSetUp: false, rows: (data ?? []) as Expense[] };
    },
  });
}

/** Discounts approved in [from, to), for reports. */
export function useApprovedDiscounts(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["pos", "discounts", "approved", from, to],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_discounts")
        .select("amount_cents, decided_at")
        .eq("status", "approved")
        .gte("decided_at", dhakaStart(from))
        .lt("decided_at", dhakaStart(to))
        .limit(5000);
      if (error) {
        if (isNotSetUp(error)) return 0;
        throw error;
      }
      return (data ?? []).reduce((s, d) => s + d.amount_cents, 0);
    },
  });
}

/* ---------- stock ---------- */

export type StockItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  is_active: boolean;
  updated_at: string;
};
export type StockMove = {
  id: string;
  item_id: string;
  kind: "in" | "out" | "count";
  change: number;
  quantity_after: number;
  note: string;
  created_at: string;
};

export const isLow = (i: Pick<StockItem, "quantity" | "min_quantity">) =>
  Number(i.quantity) <= Number(i.min_quantity);

/** "12.5" not "12.500". */
export const qty = (n: number | string) => String(Number(n));

export function useStock(enabled = true) {
  return useQuery({
    queryKey: ["pos", "stock"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [items, moves] = await Promise.all([
        supabase.from("stock_items").select("*").order("name"),
        supabase
          .from("stock_moves")
          .select("id, item_id, kind, change, quantity_after, note, created_at")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);
      for (const r of [items, moves]) {
        if (r.error) {
          if (isNotSetUp(r.error))
            return { notSetUp: true, items: [] as StockItem[], moves: [] as StockMove[] };
          throw r.error;
        }
      }
      const toItem = (i: StockItem) => ({
        ...i,
        quantity: Number(i.quantity),
        min_quantity: Number(i.min_quantity),
      });
      return {
        notSetUp: false,
        items: ((items.data ?? []) as StockItem[]).map(toItem),
        moves: ((moves.data ?? []) as StockMove[]).map((m) => ({
          ...m,
          change: Number(m.change),
          quantity_after: Number(m.quantity_after),
        })),
      };
    },
  });
}

/* ---------- price rules ---------- */

export type RateRule = {
  id: string;
  name: string;
  room_type_id: string | null;
  start_date: string | null;
  end_date: string | null;
  weekdays: number[] | null;
  kind: "percent" | "fixed";
  value: number;
  priority: number;
  is_active: boolean;
  created_at: string;
};

export const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** ISO weekday of a YYYY-MM-DD date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Same rule as public.night_price in the database (unit tested). */
export function nightPrice(
  rules: RateRule[],
  typeId: string,
  baseCents: number,
  night: string,
): { cents: number; rule: RateRule | null } {
  const match = rules
    .filter(
      (r) =>
        r.is_active &&
        (r.room_type_id === null || r.room_type_id === typeId) &&
        (r.start_date === null || night >= r.start_date) &&
        (r.end_date === null || night <= r.end_date) &&
        (r.weekdays === null || r.weekdays.includes(isoWeekday(night))),
    )
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        Number(b.room_type_id !== null) - Number(a.room_type_id !== null) ||
        b.created_at.localeCompare(a.created_at),
    )[0];
  if (!match) return { cents: baseCents, rule: null };
  if (match.kind === "fixed") return { cents: match.value, rule: match };
  return {
    cents: Math.max(0, Math.round((baseCents * (100 + match.value)) / 100 / 100) * 100),
    rule: match,
  };
}

export function useRateRules(enabled = true) {
  return useQuery({
    queryKey: ["pos", "rate-rules"],
    enabled,
    queryFn: async () => {
      const [rules, types] = await Promise.all([
        supabase
          .from("room_rate_rules")
          .select("*")
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("room_types")
          .select("id, name, nightly_rate_cents, sort_order, is_active")
          .order("sort_order"),
      ]);
      if (types.error) throw types.error;
      if (rules.error) {
        if (isNotSetUp(rules.error))
          return { notSetUp: true, rules: [] as RateRule[], types: types.data ?? [] };
        throw rules.error;
      }
      return {
        notSetUp: false,
        rules: (rules.data ?? []) as RateRule[],
        types: (types.data ?? []).filter((t) => t.is_active),
      };
    },
  });
}

/* ---------- discounts ---------- */

export type Discount = {
  id: string;
  account_id: string;
  amount_cents: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "voided";
  requested_at: string;
  decided_at: string | null;
  decision_note: string;
};

export function useAccountDiscounts(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ["pos", "account", accountId, "discounts"],
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_discounts")
        .select("*")
        .eq("account_id", accountId)
        .order("requested_at");
      if (error) {
        if (isNotSetUp(error)) return { notSetUp: true, rows: [] as Discount[] };
        throw error;
      }
      return { notSetUp: false, rows: (data ?? []) as Discount[] };
    },
  });
}

/** Discounts waiting for an admin, with the guest's name, for the dashboard. */
export function usePendingDiscounts(enabled = true) {
  return useQuery({
    queryKey: ["pos", "discounts", "pending"],
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_discounts")
        .select(
          "id, account_id, amount_cents, reason, requested_at, stay_accounts(guest_name, account_no)",
        )
        .eq("status", "pending")
        .order("requested_at");
      if (error) {
        if (isNotSetUp(error)) return [];
        throw error;
      }
      return (data ?? []).map((d) => {
        const a = d.stay_accounts as { guest_name: string; account_no: string } | null;
        return { ...d, guest_name: a?.guest_name ?? "Guest", account_no: a?.account_no ?? "" };
      });
    },
  });
}
