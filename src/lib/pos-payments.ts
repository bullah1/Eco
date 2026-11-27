// Every payment received: room bills and the restaurant, one list.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, phoneKey, type PaymentMethod } from "./pos";

export type ReceivedPayment = {
  id: string;
  source: "rooms" | "restaurant";
  method: PaymentMethod;
  amount_cents: number;
  reference: string;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  shift_no: string | null;
  /** Who paid: guest name, or the restaurant order's name / table. */
  payer: string;
  phone: string;
  /** Bill A1004 or order R1003. */
  doc_no: string;
  account_id: string | null;
};

export type PaymentFilter = {
  method: PaymentMethod | "all";
  source: "all" | "rooms" | "restaurant";
  search: string;
  showRemoved: boolean;
};

export function filterPayments(list: ReceivedPayment[], f: PaymentFilter): ReceivedPayment[] {
  const q = f.search.trim().toLowerCase();
  const digits = phoneKey(q);
  return list.filter(
    (p) =>
      (f.showRemoved || !p.voided_at) &&
      (f.method === "all" || p.method === f.method) &&
      (f.source === "all" || p.source === f.source) &&
      (!q ||
        p.payer.toLowerCase().includes(q) ||
        p.doc_no.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        (digits.length >= 4 && phoneKey(p.phone).includes(digits))),
  );
}

export function paymentTotals(list: ReceivedPayment[]) {
  const live = list.filter((p) => !p.voided_at);
  const byMethod: Partial<Record<PaymentMethod, number>> = {};
  for (const p of live) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount_cents;
  return {
    total: live.reduce((s, p) => s + p.amount_cents, 0),
    count: live.length,
    byMethod,
    rooms: live.filter((p) => p.source === "rooms").reduce((s, p) => s + p.amount_cents, 0),
    restaurant: live
      .filter((p) => p.source === "restaurant")
      .reduce((s, p) => s + p.amount_cents, 0),
  };
}

/** Start of a resort day (Asia/Dhaka) as an ISO timestamp. */
export const dhakaStart = (date: string) => `${date}T00:00:00+06:00`;

/** Payments received from `from` to `to` (both resort dates, inclusive). */
export function usePayments(from: string, to: string) {
  return useQuery({
    queryKey: ["pos", "payments", from, to],
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ReceivedPayment[]> => {
      const start = dhakaStart(from);
      const end = dhakaStart(addDays(to, 1));
      const [acc, rest] = await Promise.all([
        supabase
          .from("account_payments")
          .select(
            "id, method, amount_cents, reference, created_at, voided_at, void_reason, shift_id, account_id",
          )
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("restaurant_payments")
          .select(
            "id, method, amount_cents, reference, created_at, voided_at, void_reason, shift_id, ticket_id",
          )
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: false })
          .limit(2000),
      ]);
      if (acc.error) throw acc.error;
      if (rest.error) throw rest.error;

      const ticketIds = [...new Set((rest.data ?? []).map((p) => p.ticket_id))];
      const accountIds = [...new Set((acc.data ?? []).map((p) => p.account_id))];
      const shiftIds = [
        ...new Set(
          [...(acc.data ?? []), ...(rest.data ?? [])]
            .map((p) => p.shift_id)
            .filter((x): x is string => Boolean(x)),
        ),
      ];
      const [accounts, tickets, tables, shifts] = await Promise.all([
        accountIds.length
          ? supabase
              .from("stay_accounts")
              .select("id, account_no, guest_name, guest_phone")
              .in("id", accountIds)
          : Promise.resolve({ data: [], error: null }),
        ticketIds.length
          ? supabase
              .from("restaurant_tickets")
              .select("id, ticket_no, label, guest_phone, table_id")
              .in("id", ticketIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("restaurant_tables").select("id, name"),
        shiftIds.length
          ? supabase.from("cash_shifts").select("id, shift_no").in("id", shiftIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (accounts.error) throw accounts.error;
      if (tickets.error) throw tickets.error;
      if (tables.error) throw tables.error;
      if (shifts.error) throw shifts.error;
      const accountById = new Map((accounts.data ?? []).map((a) => [a.id, a]));
      const ticketById = new Map((tickets.data ?? []).map((t) => [t.id, t]));
      const tableName = new Map((tables.data ?? []).map((t) => [t.id, t.name]));
      const shiftNo = new Map((shifts.data ?? []).map((s) => [s.id, s.shift_no]));

      const rooms: ReceivedPayment[] = (acc.data ?? []).map((p) => {
        const a = accountById.get(p.account_id);
        return {
          id: p.id,
          source: "rooms",
          method: p.method as PaymentMethod,
          amount_cents: p.amount_cents,
          reference: p.reference ?? "",
          created_at: p.created_at,
          voided_at: p.voided_at,
          void_reason: p.void_reason,
          shift_no: p.shift_id ? (shiftNo.get(p.shift_id) ?? null) : null,
          payer: a?.guest_name || "Guest",
          phone: a?.guest_phone ?? "",
          doc_no: a?.account_no ? `Bill ${a.account_no}` : "Bill",
          account_id: p.account_id,
        };
      });
      const food: ReceivedPayment[] = (rest.data ?? []).map((p) => {
        const t = ticketById.get(p.ticket_id);
        const table = t?.table_id ? tableName.get(t.table_id) : undefined;
        return {
          id: p.id,
          source: "restaurant",
          method: p.method as PaymentMethod,
          amount_cents: p.amount_cents,
          reference: p.reference ?? "",
          created_at: p.created_at,
          voided_at: p.voided_at,
          void_reason: p.void_reason,
          shift_no: p.shift_id ? (shiftNo.get(p.shift_id) ?? null) : null,
          payer: t?.label || table || t?.guest_phone || "Walk-in customer",
          phone: t?.guest_phone ?? "",
          doc_no: t ? `Order ${t.ticket_no}${table && t.label ? ` · ${table}` : ""}` : "Order",
          account_id: null,
        };
      });
      return [...rooms, ...food].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  });
}
