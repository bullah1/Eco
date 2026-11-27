// Booking history: every booking ever made, grouped (rooms booked together = one booking),
// with a status anyone can read and the full trail of what happened to it.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, nights, phoneKey } from "./pos";

export type HistoryRoom = {
  id: string;
  room: string;
  type_name: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  status: "pending" | "confirmed" | "cancelled";
  stay_status: "expected" | "in_house" | "checked_out";
  total_cents: number;
  extended_nights: number;
};

export type BookingStatus =
  "request" | "upcoming" | "arriving" | "staying" | "checked_out" | "no_show" | "cancelled";

export type HistoryBooking = {
  key: string;
  reference: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  note: string;
  booked_at: string;
  booked_via: "website" | "front_desk" | "unknown";
  check_in: string;
  check_out: string;
  nights: number;
  rooms: HistoryRoom[];
  /** Value of the rooms that are not cancelled. */
  total_cents: number;
  account_id: string | null;
  status: BookingStatus;
  /** The guest's bill, once they have one (checked in or opened at the desk). */
  bill?: BillTotals | undefined;
};

export type BillTotals = {
  food_cents: number;
  service_cents: number;
  charges_cents: number;
  paid_cents: number;
  balance_cents: number;
};

/** "৳1,200 due", "Paid", "৳300 credit" or "Not billed yet". */
export function balanceLabel(bill: BillTotals | undefined) {
  if (!bill) return { text: "Not billed yet", tone: "none" as const };
  if (bill.balance_cents > 0) return { text: "due", tone: "due" as const };
  if (bill.balance_cents < 0) return { text: "credit", tone: "credit" as const };
  return { text: "Paid", tone: "paid" as const };
}

export const statusLook: Record<BookingStatus, { label: string; cls: string }> = {
  request: { label: "Website request", cls: "bg-amber-100 text-amber-900" },
  upcoming: { label: "Booked", cls: "bg-pos-teal-soft text-pos-ocean" },
  arriving: { label: "Arriving today", cls: "bg-pos-teal text-white" },
  staying: { label: "Staying", cls: "bg-pos-ocean text-white" },
  checked_out: { label: "Checked out", cls: "bg-[#e7e5df] text-[#55534d]" },
  no_show: { label: "Didn't come", cls: "bg-red-100 text-red-900" },
  cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-800 line-through decoration-red-300" },
};

export function bookingStatus(rooms: HistoryRoom[], today: string): BookingStatus {
  const live = rooms.filter((r) => r.status !== "cancelled");
  if (live.length === 0) return "cancelled";
  if (live.some((r) => r.stay_status === "in_house")) return "staying";
  if (live.every((r) => r.stay_status === "checked_out")) return "checked_out";
  const expected = live.filter((r) => r.stay_status === "expected");
  if (expected.length && expected.every((r) => r.check_out <= today)) return "no_show";
  if (live.some((r) => r.status === "pending")) return "request";
  if (expected.some((r) => r.check_in <= today)) return "arriving";
  return "upcoming";
}

type Row = {
  id: string;
  booking_reference: string;
  booking_group: string | null;
  room_unit_id: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  status: HistoryRoom["status"];
  stay_status: HistoryRoom["stay_status"];
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  guest_note: string;
  total_cents: number;
  account_id: string | null;
  created_at: string;
  booked_via: string;
  extended_nights: number;
};

export function groupBookings(
  rows: Row[],
  rooms: Map<string, { name: string; type_name: string }>,
  today: string,
): HistoryBooking[] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.booking_group || r.id;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const first = list.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))[0]!;
      const roomList: HistoryRoom[] = list
        .map((r) => ({
          id: r.id,
          room: rooms.get(r.room_unit_id)?.name ?? "Room",
          type_name: rooms.get(r.room_unit_id)?.type_name ?? "",
          check_in: r.check_in,
          check_out: r.check_out,
          guest_count: r.guest_count,
          status: r.status,
          stay_status: r.stay_status,
          total_cents: r.total_cents,
          extended_nights: r.extended_nights ?? 0,
        }))
        .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }));
      const checkIn = list.reduce((m, r) => (r.check_in < m ? r.check_in : m), first.check_in);
      const checkOut = list.reduce((m, r) => (r.check_out > m ? r.check_out : m), first.check_out);
      return {
        key,
        reference: first.booking_reference,
        guest_name: first.guest_name || "Guest",
        guest_phone: first.guest_phone,
        guest_email: first.guest_email,
        note: first.guest_note,
        booked_at: first.created_at,
        booked_via: (["website", "front_desk"].includes(first.booked_via)
          ? first.booked_via
          : "unknown") as HistoryBooking["booked_via"],
        check_in: checkIn,
        check_out: checkOut,
        nights: nights(checkIn, checkOut),
        rooms: roomList,
        total_cents: list
          .filter((r) => r.status !== "cancelled")
          .reduce((s, r) => s + r.total_cents, 0),
        account_id: list.find((r) => r.account_id)?.account_id ?? null,
        status: bookingStatus(roomList, today),
      };
    })
    .sort((a, b) => b.booked_at.localeCompare(a.booked_at));
}

export type HistoryFilter = {
  status: "all" | BookingStatus;
  via: "all" | "website" | "front_desk";
  search: string;
};

export function filterBookings(list: HistoryBooking[], f: HistoryFilter) {
  const q = f.search.trim().toLowerCase();
  const digits = phoneKey(q);
  return list.filter(
    (b) =>
      (f.status === "all" ||
        b.status === f.status ||
        (f.status === "upcoming" && b.status === "arriving")) &&
      (f.via === "all" || b.booked_via === f.via) &&
      (!q ||
        b.guest_name.toLowerCase().includes(q) ||
        b.reference.toLowerCase().includes(q) ||
        b.rooms.some((r) => r.room.toLowerCase() === q) ||
        (digits.length >= 4 && phoneKey(b.guest_phone).includes(digits))),
  );
}

export function historySummary(list: HistoryBooking[]) {
  const kept = list.filter((b) => b.status !== "cancelled");
  return {
    bookings: list.length,
    cancelled: list.length - kept.length,
    roomNights: kept.reduce(
      (s, b) =>
        s +
        b.rooms
          .filter((r) => r.status !== "cancelled")
          .reduce((n, r) => n + nights(r.check_in, r.check_out), 0),
      0,
    ),
    value: kept.reduce((s, b) => s + b.total_cents, 0),
    website: list.filter((b) => b.booked_via === "website").length,
  };
}

export type DateBy = "stay" | "booked";

/** Bookings whose stay touches [from, to] (dateBy "stay"), or that were made in it. */
export function useBookingHistory(from: string, to: string, dateBy: DateBy, today: string) {
  return useQuery({
    queryKey: ["pos", "history", from, to, dateBy],
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from("reservations")
        .select(
          "id, booking_reference, booking_group, room_unit_id, check_in, check_out, guest_count, status, stay_status, guest_name, guest_phone, guest_email, guest_note, total_cents, account_id, created_at, booked_via, extended_nights",
        );
      q =
        dateBy === "stay"
          ? q.lte("check_in", to).gt("check_out", from)
          : q
              .gte("created_at", `${from}T00:00:00+06:00`)
              .lt("created_at", `${addDays(to, 1)}T00:00:00+06:00`);
      const [res, units] = await Promise.all([
        q.order("created_at", { ascending: false }).limit(3000),
        supabase.from("room_units").select("id, name, room_types(name)"),
      ]);
      if (res.error) throw res.error;
      if (units.error) throw units.error;
      const rooms = new Map(
        (units.data ?? []).map((u) => [
          u.id,
          { name: u.name, type_name: (u.room_types as { name: string } | null)?.name ?? "" },
        ]),
      );
      const list = groupBookings((res.data ?? []) as Row[], rooms, today);
      const ids = [
        ...new Set(list.map((b) => b.account_id).filter((x): x is string => Boolean(x))),
      ];
      const totals = new Map<string, BillTotals>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase
          .from("stay_account_totals")
          .select("account_id, food_cents, service_cents, charges_cents, paid_cents, balance_cents")
          .in("account_id", ids.slice(i, i + 200));
        if (error) throw error;
        for (const t of data ?? [])
          if (t.account_id)
            totals.set(t.account_id, {
              food_cents: t.food_cents ?? 0,
              service_cents: t.service_cents ?? 0,
              charges_cents: t.charges_cents ?? 0,
              paid_cents: t.paid_cents ?? 0,
              balance_cents: t.balance_cents ?? 0,
            });
      }
      return list.map((b) => (b.account_id ? { ...b, bill: totals.get(b.account_id) } : b));
    },
  });
}

export type BookingEvent = {
  id: string;
  reservation_id: string;
  kind: string;
  detail: string;
  actor_name: string;
  created_at: string;
};

export const eventLabel: Record<string, string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  dates_changed: "Dates changed",
  extended: "Stayed extra night",
  room_moved: "Room changed",
  cancelled: "Cancelled",
  checked_out: "Checked out",
  reopened: "Check-out undone",
};

export function useBookingEvents(reservationIds: string[]) {
  return useQuery({
    queryKey: ["pos", "history-events", reservationIds.join(",")],
    enabled: reservationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_events")
        .select("id, reservation_id, kind, detail, actor_name, created_at")
        .in("reservation_id", reservationIds)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as BookingEvent[];
    },
  });
}

/** Same thing done to several rooms at once shows as one line. */
export function mergeEvents(events: BookingEvent[], roomOf: (resId: string) => string) {
  const out: (BookingEvent & { rooms: string[] })[] = [];
  for (const e of events) {
    const prev = out.find(
      (o) =>
        o.kind === e.kind &&
        o.detail.replace(/[A-Z]-?\d+/g, "") === e.detail.replace(/[A-Z]-?\d+/g, "") &&
        o.kind !== "room_moved" &&
        Math.abs(new Date(o.created_at).getTime() - new Date(e.created_at).getTime()) < 60_000,
    );
    if (prev) prev.rooms.push(roomOf(e.reservation_id));
    else out.push({ ...e, rooms: [roomOf(e.reservation_id)] });
  }
  return out;
}
