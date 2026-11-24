// Restaurant and kitchen data for the POS. Writes go through pos_* functions.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TicketItem = {
  id: string;
  menu_item_id: string | null;
  name: string;
  unit_price_cents: number;
  quantity: number;
  sent_qty: number;
  created_at: string;
};

export type Ticket = {
  id: string;
  ticket_no: string;
  table_id: string | null;
  label: string;
  note: string;
  status: "open" | "paid" | "charged" | "cancelled";
  opened_at: string;
  items: TicketItem[];
};

export type RestTable = { id: string; name: string; sort_order: number; is_active: boolean };
export type MenuEntry = {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  sort_order: number;
};

export const ticketTotal = (items: Pick<TicketItem, "quantity" | "unit_price_cents">[]) =>
  items.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0);

/** Dishes added since the last time the order went to the kitchen. */
export const unsentCount = (items: Pick<TicketItem, "quantity" | "sent_qty">[]) =>
  items.reduce((s, i) => s + Math.max(0, i.quantity - i.sent_qty), 0);

export function minutesSince(iso: string, now: number = Date.now()) {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

export function ticketPlace(
  t: Pick<Ticket, "table_id" | "label" | "ticket_no">,
  tables: RestTable[],
) {
  const table = t.table_id ? tables.find((x) => x.id === t.table_id) : undefined;
  return table
    ? t.label
      ? `${table.name} · ${t.label}`
      : table.name
    : t.label || `Counter ${t.ticket_no}`;
}

/** Menu grouped by category in menu order, optionally filtered by a search word. */
export function groupMenu(menu: MenuEntry[], search = "") {
  const q = search.trim().toLowerCase();
  const list = q
    ? menu.filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
    : menu;
  const groups = new Map<string, MenuEntry[]>();
  for (const m of [...list].sort((a, b) => a.sort_order - b.sort_order))
    groups.set(m.category, [...(groups.get(m.category) ?? []), m]);
  return [...groups.entries()];
}

export function useRestaurant(enabled = true) {
  return useQuery({
    queryKey: ["pos", "restaurant"],
    enabled,
    refetchInterval: 15_000,
    queryFn: async () => {
      const [tables, tickets, menu] = await Promise.all([
        supabase
          .from("restaurant_tables")
          .select("id, name, sort_order, is_active")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("restaurant_tickets")
          .select(
            "id, ticket_no, table_id, label, note, status, opened_at, restaurant_ticket_items(id, menu_item_id, name, unit_price_cents, quantity, sent_qty, created_at)",
          )
          .eq("status", "open")
          .order("opened_at"),
        supabase
          .from("menu_items")
          .select("id, name, category, price_cents, sort_order")
          .eq("is_available", true)
          .order("sort_order"),
      ]);
      for (const r of [tables, tickets, menu]) if (r.error) throw r.error;
      return {
        tables: (tables.data ?? []) as RestTable[],
        tickets: (tickets.data ?? []).map(({ restaurant_ticket_items, ...t }) => ({
          ...t,
          status: t.status as Ticket["status"],
          items: ((restaurant_ticket_items ?? []) as TicketItem[])
            .slice()
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
        })) as Ticket[],
        menu: (menu.data ?? []) as MenuEntry[],
      };
    },
  });
}

export type KitchenTicket = {
  id: string;
  kot_no: string;
  status: "new" | "preparing" | "ready" | "served";
  created_at: string;
  items: { name: string; qty: number }[];
  place: string;
  note: string;
};

export type WebKitchenOrder = {
  id: string;
  order_number: string;
  status: string;
  delivery: string;
  room_label: string;
  guest_name: string;
  note: string;
  created_at: string;
  items: { name: string; quantity: number }[];
};

export function useKitchen(enabled = true) {
  return useQuery({
    queryKey: ["pos", "kitchen"],
    enabled,
    refetchInterval: 10_000,
    queryFn: async () => {
      const [kots, web, tables] = await Promise.all([
        supabase
          .from("kitchen_tickets")
          .select(
            "id, kot_no, status, created_at, items, restaurant_tickets(ticket_no, table_id, label, note)",
          )
          .neq("status", "served")
          .order("created_at")
          .limit(100),
        supabase
          .from("service_orders")
          .select(
            "id, order_number, status, delivery, room_label, guest_name, note, created_at, service_order_items(name, quantity)",
          )
          .in("status", ["pending", "confirmed", "preparing"])
          .order("created_at")
          .limit(100),
        supabase.from("restaurant_tables").select("id, name, sort_order, is_active"),
      ]);
      for (const r of [kots, web, tables]) if (r.error) throw r.error;
      const tableList = (tables.data ?? []) as RestTable[];
      return {
        kots: (kots.data ?? []).map((k) => {
          const t = k.restaurant_tickets as {
            ticket_no: string;
            table_id: string | null;
            label: string;
            note: string;
          } | null;
          return {
            id: k.id,
            kot_no: k.kot_no,
            status: k.status as KitchenTicket["status"],
            created_at: k.created_at,
            items: (Array.isArray(k.items) ? k.items : []) as { name: string; qty: number }[],
            place: t ? ticketPlace(t, tableList) : "",
            note: t?.note ?? "",
          } satisfies KitchenTicket;
        }),
        web: (web.data ?? []).map(({ service_order_items, ...o }) => ({
          ...o,
          items: (service_order_items ?? []) as { name: string; quantity: number }[],
        })) as WebKitchenOrder[],
      };
    },
  });
}
