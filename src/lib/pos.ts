// Front-desk POS: shared types, pure helpers (unit tested) and data hooks.
//
// Writes always go through the pos_* database functions, which check staff rights,
// lock the account and keep the money rules in one place. Screens only read tables.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ---------------- money and dates ---------------- */

export const taka = (cents: number | null | undefined) =>
  `৳${Math.round((cents ?? 0) / 100).toLocaleString("en-IN")}`;

/** Taka typed by staff ("1,250" or "1250.50") to cents. Returns null when it is not a positive amount. */
export function parseTaka(input: string): number | null {
  const clean = input.replace(/[,\s৳]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents > 0 ? cents : null;
}

/** Today's date at the resort (Asia/Dhaka) as YYYY-MM-DD, whatever the device's time zone. */
export function resortToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nights(checkIn: string, checkOut: string): number {
  const ms = Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

const shortFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export const shortDate = (date: string) => shortFmt.format(new Date(`${date}T00:00:00Z`));
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});
export const shortDateTime = (iso: string) => timeFmt.format(new Date(iso));

/** Same rule as pos_phone_key in the database: "+880 1712-345678" → "01712345678". */
export function phoneKey(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (/^8801\d{9}$/.test(d)) return `0${d.slice(3)}`;
  if (/^1\d{9}$/.test(d)) return `0${d}`;
  return d;
}
export const phoneOk = (v: string) => /^\+?[0-9 -]{7,20}$/.test(v.trim());

/** The message a pos_* function raised, or a plain fallback. */
export function posError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message ?? "");
    if (message && !/fetch|network|Failed to/i.test(message)) return message;
    if (message) return "No connection. Check the internet and try again.";
  }
  return "Something went wrong. Please try again.";
}

/* ---------------- types ---------------- */

export type Housekeeping = "clean" | "dirty" | "maintenance";
export type StayStatus = "expected" | "in_house" | "checked_out";

export type PosUnit = {
  id: string;
  name: string;
  housekeeping: Housekeeping;
  is_active: boolean;
  room_type_id: string;
  type_name: string;
  type_order: number;
  rate_cents: number;
  max_guests: number;
};

export type PosReservation = {
  id: string;
  booking_reference: string;
  booking_group: string | null;
  room_unit_id: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  status: "pending" | "confirmed" | "cancelled";
  stay_status: StayStatus;
  guest_name: string;
  guest_phone: string;
  guest_note: string;
  total_cents: number;
  account_id: string | null;
  /** Nights added automatically because the guest stayed past departure. */
  extended_nights?: number;
};

export type TileState = "in_house" | "leaving" | "arriving" | "free" | "dirty" | "maintenance";

export type BoardTile = {
  unit: PosUnit;
  state: TileState;
  reservation: PosReservation | null;
  /** Next booking that has not started yet, for free rooms. */
  next: PosReservation | null;
};

/* ---------------- pure logic ---------------- */

/** What each room looks like on the front-desk board today. */
export function buildBoard(
  units: PosUnit[],
  reservations: PosReservation[],
  today: string,
): BoardTile[] {
  const live = reservations.filter((r) => r.status !== "cancelled");
  return units
    .filter((u) => u.is_active)
    .slice()
    .sort(
      (a, b) =>
        a.type_order - b.type_order || a.name.localeCompare(b.name, undefined, { numeric: true }),
    )
    .map((unit) => {
      const mine = live.filter((r) => r.room_unit_id === unit.id);
      const inHouse = mine.find((r) => r.stay_status === "in_house") ?? null;
      if (inHouse) {
        return {
          unit,
          state: inHouse.check_out <= today ? "leaving" : "in_house",
          reservation: inHouse,
          next: null,
        };
      }
      const arriving =
        mine.find(
          (r) => r.stay_status === "expected" && r.check_in <= today && r.check_out > today,
        ) ?? null;
      if (arriving) return { unit, state: "arriving", reservation: arriving, next: null };
      const next =
        mine
          .filter((r) => r.stay_status === "expected" && r.check_in > today)
          .sort((a, b) => a.check_in.localeCompare(b.check_in))[0] ?? null;
      const state: TileState =
        unit.housekeeping === "maintenance"
          ? "maintenance"
          : unit.housekeeping === "dirty"
            ? "dirty"
            : "free";
      return { unit, state, reservation: null, next };
    });
}

export type Arrival = {
  key: string;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  confirmed: boolean;
  reservations: PosReservation[];
  total_cents: number;
};

/** Bookings that can be checked in today, one card per booking (several rooms booked together stay together). */
export function groupArrivals(reservations: PosReservation[], today: string): Arrival[] {
  const ready = reservations.filter(
    (r) =>
      r.status !== "cancelled" &&
      r.stay_status === "expected" &&
      r.check_in <= today &&
      r.check_out > today,
  );
  const groups = new Map<string, PosReservation[]>();
  for (const r of ready) {
    const key = r.booking_group || r.booking_reference;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      guest_name: list[0]?.guest_name || "Guest",
      guest_phone: list[0]?.guest_phone ?? "",
      check_in: list.reduce((m, r) => (r.check_in < m ? r.check_in : m), list[0]!.check_in),
      check_out: list.reduce((m, r) => (r.check_out > m ? r.check_out : m), list[0]!.check_out),
      confirmed: list.every((r) => r.status === "confirmed"),
      reservations: list,
      total_cents: list.reduce((s, r) => s + r.total_cents, 0),
    }))
    .sort(
      (a, b) => a.check_in.localeCompare(b.check_in) || a.guest_name.localeCompare(b.guest_name),
    );
}

export type PaymentMethod = "cash" | "bkash" | "nagad" | "card" | "bank";
export const paymentMethods: {
  id: PaymentMethod;
  label: string;
  needsRef: boolean;
  refLabel: string;
}[] = [
  { id: "cash", label: "Cash", needsRef: false, refLabel: "Note (optional)" },
  { id: "bkash", label: "bKash", needsRef: true, refLabel: "bKash transaction ID" },
  { id: "nagad", label: "Nagad", needsRef: true, refLabel: "Nagad transaction ID" },
  { id: "card", label: "Card", needsRef: false, refLabel: "Card slip number (optional)" },
  { id: "bank", label: "Bank", needsRef: true, refLabel: "Bank reference" },
];

/** Same checks the database runs, so staff see the problem before sending. */
export function paymentProblem(
  method: PaymentMethod,
  amountCents: number | null,
  balanceCents: number,
  ref: string,
) {
  if (balanceCents <= 0) return "Nothing is owed on this account";
  if (amountCents === null) return "Enter the amount received";
  if (amountCents > balanceCents) return `This is more than the balance of ${taka(balanceCents)}`;
  const m = paymentMethods.find((p) => p.id === method);
  if (m?.needsRef && ref.trim().length < 4) return `Enter the ${m.refLabel}`;
  return null;
}

/** Cash handed over vs. amount due: the change to give back. */
export function changeDue(receivedCents: number | null, dueCents: number) {
  if (receivedCents === null) return 0;
  return Math.max(0, receivedCents - dueCents);
}

/* ---------------- data hooks ---------------- */

export const posKeys = {
  board: ["pos", "board"] as const,
  account: (id: string) => ["pos", "account", id] as const,
  accounts: ["pos", "accounts"] as const,
  orders: ["pos", "orders"] as const,
};

export function useStaffRole(userId: string | undefined) {
  return useQuery({
    queryKey: ["pos", "role", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role);
      return {
        isAdmin: roles.includes("admin"),
        isStaff: roles.includes("admin") || roles.includes("staff"),
      };
    },
    staleTime: 60_000,
  });
}

// Guests still here after their departure date get the extra night billed. The
// database does this nightly too; the front desk also runs it every 10 minutes.
let lastRoll = 0;
async function rollOverstays(): Promise<{ extended: number; blocked: number } | null> {
  if (Date.now() - lastRoll < 10 * 60_000) return null;
  lastRoll = Date.now();
  const { data, error } = await supabase.rpc("pos_roll_overstays");
  if (error) return null;
  return data as { extended: number; blocked: number };
}

export function useBoardData(enabled = true) {
  return useQuery({
    queryKey: posKeys.board,
    enabled,
    refetchInterval: 20_000,
    queryFn: async () => {
      const today = resortToday();
      const rolled = await rollOverstays();
      const [unitsRes, resRes] = await Promise.all([
        supabase
          .from("room_units")
          .select(
            "id, name, housekeeping, is_active, room_type_id, room_types(name, sort_order, nightly_rate_cents, max_guests)",
          ),
        supabase
          .from("reservations")
          .select(
            "id, booking_reference, booking_group, room_unit_id, check_in, check_out, guest_count, status, stay_status, guest_name, guest_phone, guest_note, total_cents, account_id, extended_nights",
          )
          .neq("status", "cancelled")
          .or(`check_out.gte.${addDays(today, -1)},stay_status.eq.in_house`)
          .lte("check_in", addDays(today, 60))
          .order("check_in")
          .limit(1000),
      ]);
      if (unitsRes.error) throw unitsRes.error;
      if (resRes.error) throw resRes.error;
      const units: PosUnit[] = (unitsRes.data ?? []).map((u) => {
        const t = u.room_types as {
          name: string;
          sort_order: number;
          nightly_rate_cents: number;
          max_guests: number;
        } | null;
        return {
          id: u.id,
          name: u.name,
          housekeeping: (u.housekeeping as Housekeeping) ?? "clean",
          is_active: u.is_active,
          room_type_id: u.room_type_id,
          type_name: t?.name ?? "Room",
          type_order: t?.sort_order ?? 0,
          rate_cents: t?.nightly_rate_cents ?? 0,
          max_guests: t?.max_guests ?? 2,
        };
      });
      return { today, units, rolled, reservations: (resRes.data ?? []) as PosReservation[] };
    },
  });
}

export type AccountRow = {
  id: string;
  account_no: string;
  guest_name: string;
  guest_phone: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  rooms: string[];
  check_in: string | null;
  check_out: string | null;
  room_cents: number;
  food_cents: number;
  service_cents: number;
  paid_cents: number;
  balance_cents: number;
};

export function useAccounts(enabled = true) {
  return useQuery({
    queryKey: posKeys.accounts,
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const accRes = await supabase
        .from("stay_accounts")
        .select("id, account_no, guest_name, guest_phone, status, opened_at, closed_at")
        .or(`status.eq.open,opened_at.gte.${since}`)
        .order("opened_at", { ascending: false })
        .limit(500);
      if (accRes.error) throw accRes.error;
      const ids = (accRes.data ?? []).map((a) => a.id);
      if (ids.length === 0) return [] as AccountRow[];
      const [totRes, resRes] = await Promise.all([
        supabase.from("stay_account_totals").select("*").in("account_id", ids),
        supabase
          .from("reservations")
          .select("account_id, check_in, check_out, room_units(name)")
          .in("account_id", ids),
      ]);
      if (totRes.error) throw totRes.error;
      if (resRes.error) throw resRes.error;
      const totals = new Map((totRes.data ?? []).map((t) => [t.account_id, t]));
      return (accRes.data ?? []).map((a) => {
        const t = totals.get(a.id);
        const res = (resRes.data ?? []).filter((r) => r.account_id === a.id);
        return {
          ...a,
          status: a.status as "open" | "closed",
          rooms: res
            .map((r) => (r.room_units as { name: string } | null)?.name ?? "")
            .filter(Boolean)
            .sort(),
          check_in: res.reduce<string | null>(
            (m, r) => (!m || r.check_in < m ? r.check_in : m),
            null,
          ),
          check_out: res.reduce<string | null>(
            (m, r) => (!m || r.check_out > m ? r.check_out : m),
            null,
          ),
          room_cents: t?.room_cents ?? 0,
          food_cents: t?.food_cents ?? 0,
          service_cents: t?.service_cents ?? 0,
          paid_cents: t?.paid_cents ?? 0,
          balance_cents: t?.balance_cents ?? 0,
        } satisfies AccountRow;
      });
    },
  });
}

export type ChargeLine = {
  id: string;
  kind: "room" | "food" | "service" | "other";
  source: "front_desk" | "restaurant" | "website";
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
  charge_date: string;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
};
export type PaymentLine = {
  id: string;
  method: PaymentMethod;
  amount_cents: number;
  reference: string;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

export function useAccount(id: string, enabled = true) {
  return useQuery({
    queryKey: posKeys.account(id),
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [acc, totals, charges, payments, rooms, orders] = await Promise.all([
        supabase.from("stay_accounts").select("*").eq("id", id).maybeSingle(),
        supabase.from("stay_account_totals").select("*").eq("account_id", id).maybeSingle(),
        supabase.from("account_charges").select("*").eq("account_id", id).order("created_at"),
        supabase.from("account_payments").select("*").eq("account_id", id).order("created_at"),
        supabase
          .from("reservations")
          .select(
            "id, booking_reference, check_in, check_out, guest_count, stay_status, nightly_rate_cents, room_units(name, room_types(name))",
          )
          .eq("account_id", id)
          .order("check_in"),
        supabase
          .from("service_orders")
          .select(
            "id, order_number, subtotal_cents, status, bill_status, reservation_id, created_at",
          )
          .eq("bill_status", "unbilled")
          .neq("status", "cancelled"),
      ]);
      for (const r of [acc, totals, charges, payments, rooms, orders]) if (r.error) throw r.error;
      if (!acc.data) return null;
      const roomList = (rooms.data ?? []).map((r) => {
        const unit = r.room_units as { name: string; room_types: { name: string } | null } | null;
        return {
          id: r.id,
          reference: r.booking_reference,
          check_in: r.check_in,
          check_out: r.check_out,
          guests: r.guest_count,
          stay_status: r.stay_status as StayStatus,
          rate_cents: r.nightly_rate_cents,
          unit: unit?.name ?? "",
          type: unit?.room_types?.name ?? "",
        };
      });
      const resIds = new Set(roomList.map((r) => r.id));
      return {
        account: acc.data,
        totals: {
          room: totals.data?.room_cents ?? 0,
          food: totals.data?.food_cents ?? 0,
          service: totals.data?.service_cents ?? 0,
          charges: totals.data?.charges_cents ?? 0,
          paid: totals.data?.paid_cents ?? 0,
          discount: totals.data?.discount_cents ?? 0,
          balance: totals.data?.balance_cents ?? 0,
        },
        charges: (charges.data ?? []) as ChargeLine[],
        payments: (payments.data ?? []) as PaymentLine[],
        rooms: roomList,
        pendingOrders: (orders.data ?? []).filter(
          (o) => o.reservation_id && resIds.has(o.reservation_id),
        ),
      };
    },
  });
}

export function useCatalog(enabled = true) {
  return useQuery({
    queryKey: ["pos", "catalog"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [addons, menu] = await Promise.all([
        supabase
          .from("resort_addons")
          .select("id, name, description, category, price_cents, unit, sort_order")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("menu_items")
          .select("id, name, category, price_cents, sort_order")
          .eq("is_available", true)
          .order("sort_order"),
      ]);
      if (addons.error) throw addons.error;
      if (menu.error) throw menu.error;
      return {
        services: (addons.data ?? []).filter((a) => a.category !== "food"),
        menu: menu.data ?? [],
      };
    },
  });
}

export function useUnbilledOrders(enabled = true) {
  return useQuery({
    queryKey: posKeys.orders,
    enabled,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(
          "id, order_number, guest_name, guest_phone, room_label, delivery, note, status, bill_status, subtotal_cents, created_at, reservation_id, service_order_items(name, quantity, line_total_cents), reservations(account_id, room_units(name))",
        )
        .eq("bill_status", "unbilled")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Run a pos_* function and refresh every POS screen afterwards. */
export function usePosAction<TArgs, TResult>(run: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["pos"] }),
  });
}

/** Throws the database error so React Query (and posError) can show it. */
export async function rpc<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
