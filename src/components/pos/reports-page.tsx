import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  addDays,
  nights,
  paymentMethods,
  resortToday,
  shortDate,
  taka,
  useBoardData,
} from "@/lib/pos";
import { LoadState, PageTitle, Panel } from "./pos-shell";

type Range = "today" | "7d" | "month" | "last_month" | "30d";

/** [from, to) as YYYY-MM-DD dates in resort time. */
function rangeDates(range: Range, today: string): { from: string; to: string; label: string } {
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
    case "last_month": {
      const prevEnd = monthStart;
      const prevStart = `${addDays(monthStart, -1).slice(0, 8)}01`;
      return { from: prevStart, to: prevEnd, label: "Last month" };
    }
  }
}

/** Dhaka midnight of a date, as an ISO timestamp for created_at filters. */
const dhakaStart = (date: string) => new Date(`${date}T00:00:00+06:00`).toISOString();

const kindLabel: Record<string, string> = {
  room: "Rooms",
  food: "Food & restaurant",
  service: "Services",
  other: "Other",
};

function useReport(from: string, to: string) {
  return useQuery({
    queryKey: ["pos", "report", from, to],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [pay, chg, res] = await Promise.all([
        supabase
          .from("account_payments")
          .select("amount_cents, method, created_at")
          .is("voided_at", null)
          .gte("created_at", dhakaStart(from))
          .lt("created_at", dhakaStart(to))
          .limit(5000),
        supabase
          .from("account_charges")
          .select("amount_cents, kind, charge_date")
          .is("voided_at", null)
          .gte("charge_date", from)
          .lt("charge_date", to)
          .limit(5000),
        supabase
          .from("reservations")
          .select("check_in, check_out, room_unit_id, room_units(room_types(name))")
          .neq("status", "cancelled")
          .lt("check_in", to)
          .gt("check_out", from)
          .limit(5000),
      ]);
      for (const r of [pay, chg, res]) if (r.error) throw r.error;
      return { payments: pay.data ?? [], charges: chg.data ?? [], stays: res.data ?? [] };
    },
  });
}

export function ReportsPage() {
  const [range, setRange] = useState<Range>("7d");
  const today = resortToday();
  const { from, to, label } = rangeDates(range, today);
  const report = useReport(from, to);
  const board = useBoardData();
  const roomCount = board.data?.units.filter((u) => u.is_active).length ?? 0;

  const stats = useMemo(() => {
    if (!report.data) return null;
    const days = nights(from, to);
    const { payments, charges, stays } = report.data;

    const received = payments.reduce((s, p) => s + p.amount_cents, 0);
    const byMethod = new Map<string, number>();
    for (const p of payments)
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_cents);

    const sales = charges.reduce((s, c) => s + (c.amount_cents ?? 0), 0);
    const byKind = new Map<string, number>();
    for (const c of charges) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + (c.amount_cents ?? 0));

    // Money received per day, for the bar chart.
    const perDay = new Map<string, number>();
    for (let d = from; d < to; d = addDays(d, 1)) perDay.set(d, 0);
    for (const p of payments) {
      const d = resortToday(new Date(p.created_at));
      if (perDay.has(d)) perDay.set(d, (perDay.get(d) ?? 0) + p.amount_cents);
    }

    // Room-nights sold inside the range, overall and by room type.
    let roomNights = 0;
    const byType = new Map<string, number>();
    for (const r of stays) {
      const start = r.check_in > from ? r.check_in : from;
      const end = r.check_out < to ? r.check_out : to;
      const n = nights(start, end);
      roomNights += n;
      const type =
        (r.room_units as { room_types: { name: string } | null } | null)?.room_types?.name ??
        "Room";
      byType.set(type, (byType.get(type) ?? 0) + n);
    }
    const capacity = roomCount * days;
    return {
      days,
      received,
      sales,
      paymentsCount: payments.length,
      byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]),
      byKind: [...byKind.entries()].sort((a, b) => b[1] - a[1]),
      perDay: [...perDay.entries()],
      roomNights,
      occupancy: capacity > 0 ? Math.round((roomNights / capacity) * 100) : 0,
      byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [report.data, from, to, roomCount]);

  const presets: [Range, string][] = [
    ["today", "Today"],
    ["7d", "7 days"],
    ["30d", "30 days"],
    ["month", "This month"],
    ["last_month", "Last month"],
  ];

  return (
    <>
      <PageTitle
        title="Reports"
        sub={`${label} · ${shortDate(from)} – ${shortDate(addDays(to, -1))}`}
        actions={
          <Button variant="outline" className="h-10 gap-2" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </Button>
        }
      />
      <h1 className="mb-4 hidden text-lg font-semibold print:block">
        Santa Monica Eco Beach Resort · Report · {shortDate(from)} – {shortDate(addDays(to, -1))}
      </h1>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 print:hidden">
        {presets.map(([id, text]) => (
          <button
            key={id}
            type="button"
            aria-pressed={range === id}
            onClick={() => setRange(id)}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm transition-colors ${
              range === id
                ? "border-pos-ocean bg-pos-ocean font-medium text-white"
                : "border-pos-line bg-white text-pos-muted hover:text-pos-ink"
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <LoadState
        isLoading={report.isLoading}
        error={report.error}
        retry={() => void report.refetch()}
      />

      {stats && (
        <div className="grid gap-5">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Big
              label="Money received"
              value={taka(stats.received)}
              sub={`${stats.paymentsCount} payments`}
            />
            <Big label="Sales billed" value={taka(stats.sales)} sub="rooms, food and services" />
            <Big
              label="Occupancy"
              value={`${stats.occupancy}%`}
              sub={`${stats.roomNights} of ${roomCount * stats.days} room-nights`}
            />
            <Big
              label="Average a day"
              value={taka(stats.days ? stats.received / stats.days : 0)}
              sub="money received"
            />
          </section>

          {stats.days > 1 && (
            <Panel title="Money received each day">
              <DayBars data={stats.perDay} />
            </Panel>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Sales by type">
              <Bars
                rows={stats.byKind.map(([k, v]) => [kindLabel[k] ?? k, v])}
                format={taka}
                empty="No sales in this period."
              />
            </Panel>
            <Panel title="Payments by method">
              <Bars
                rows={stats.byMethod.map(([m, v]) => [
                  paymentMethods.find((p) => p.id === m)?.label ?? m,
                  v,
                ])}
                format={taka}
                empty="No payments in this period."
              />
            </Panel>
            <Panel title="Room-nights by room type">
              <Bars
                rows={stats.byType}
                format={(n) => `${n} nights`}
                empty="No stays in this period."
              />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function Big({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-pos-line bg-white px-4 py-3.5">
      <p className="text-xs text-pos-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-pos-muted">{sub}</p>
    </div>
  );
}

function Bars({
  rows,
  format,
  empty,
}: {
  rows: [string, number][];
  format: (n: number) => string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  if (rows.length === 0) return <p className="text-sm text-pos-muted">{empty}</p>;
  return (
    <ul className="grid gap-3">
      {rows.map(([name, v]) => (
        <li key={name}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate">{name}</span>
            <span className="shrink-0 font-medium tabular-nums">{format(v)}</span>
          </div>
          <div className="h-2 rounded-full bg-pos-ground">
            <div
              className="h-2 rounded-full bg-pos-teal"
              style={{ width: `${Math.max(2, (v / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DayBars({ data }: { data: [string, number][] }) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  const showEvery = data.length > 16 ? Math.ceil(data.length / 10) : 1;
  return (
    <div className="flex h-48 items-end gap-1 sm:gap-1.5">
      {data.map(([day, v], i) => (
        <div key={day} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
          <div className="relative flex flex-1 items-end justify-center">
            <div
              title={`${shortDate(day)}: ${taka(v)}`}
              className="w-full max-w-10 rounded-t-[3px] bg-pos-ocean transition-colors group-hover:bg-pos-gold"
              style={{ height: `${v > 0 ? Math.max(3, (v / max) * 100) : 0}%` }}
            />
          </div>
          <span className="mt-1.5 h-4 truncate text-center text-[10px] text-pos-muted">
            {i % showEvery === 0 ? shortDate(day).split(" ")[0] : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
