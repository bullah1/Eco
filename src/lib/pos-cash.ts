// Cash drawer: one shared drawer, one open shift at a time.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { taka } from "./pos";

export type ShiftTotals = {
  by_method: Partial<Record<"cash" | "bkash" | "nagad" | "card" | "bank", number>>;
  by_source: Partial<Record<"rooms" | "restaurant", number>>;
  payments: number;
  total: number;
  cash_sales: number;
  cash_in: number;
  cash_out: number;
  opening: number;
  expected_cash: number;
};

export type Shift = {
  id: string;
  shift_no: string;
  status: "open" | "closed";
  opening_cash_cents: number;
  opened_at: string;
  open_note: string;
  closed_at: string | null;
  expected_cash_cents: number | null;
  counted_cash_cents: number | null;
  difference_cents: number | null;
  close_note: string;
  summary: ShiftTotals | null;
};

export type CashMovement = {
  id: string;
  kind: "in" | "out";
  amount_cents: number;
  reason: string;
  created_at: string;
};

/** "Exact", "৳120 short" or "৳50 over", and how worried to look. */
export function differenceLabel(diffCents: number) {
  if (diffCents === 0) return { text: "Exact", tone: "ok" as const };
  return diffCents < 0
    ? { text: `${taka(-diffCents)} short`, tone: "short" as const }
    : { text: `${taka(diffCents)} over`, tone: "over" as const };
}

export const emptyTotals: ShiftTotals = {
  by_method: {},
  by_source: {},
  payments: 0,
  total: 0,
  cash_sales: 0,
  cash_in: 0,
  cash_out: 0,
  opening: 0,
  expected_cash: 0,
};

export function useCashDrawer(enabled = true) {
  return useQuery({
    queryKey: ["pos", "cash"],
    enabled,
    refetchInterval: 20_000,
    queryFn: async () => {
      const [open, history] = await Promise.all([
        supabase.from("cash_shifts").select("*").eq("status", "open").maybeSingle(),
        supabase
          .from("cash_shifts")
          .select("*")
          .eq("status", "closed")
          .order("closed_at", { ascending: false })
          .limit(20),
      ]);
      if (open.error) throw open.error;
      if (history.error) throw history.error;
      const shift = open.data as Shift | null;
      let totals: ShiftTotals | null = null;
      let movements: CashMovement[] = [];
      if (shift) {
        const [t, mv] = await Promise.all([
          supabase.rpc("pos_shift_totals", { p_shift: shift.id }),
          supabase
            .from("cash_movements")
            .select("id, kind, amount_cents, reason, created_at")
            .eq("shift_id", shift.id)
            .order("created_at"),
        ]);
        if (t.error) throw t.error;
        if (mv.error) throw mv.error;
        totals = { ...emptyTotals, ...(t.data as ShiftTotals) };
        movements = (mv.data ?? []) as CashMovement[];
      }
      return { shift, totals, movements, history: (history.data ?? []) as Shift[] };
    },
  });
}

/** Light check for the sidebar badge: is the drawer open? */
export function useDrawerOpen(enabled = true) {
  return useQuery({
    queryKey: ["pos", "cash", "open"],
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_shifts")
        .select("id")
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });
}
