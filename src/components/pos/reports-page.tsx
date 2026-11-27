import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, LoaderCircle, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addDays, paymentMethods, resortToday, shortDate, taka, useBoardData } from "@/lib/pos";
import {
  rangeDates,
  summarize,
  useReportRows,
  type Bucket,
  type ReportRange,
  type ReportSummary,
} from "@/lib/pos-reports";
import { categoryLabel, useApprovedDiscounts, useExpenses, type Expense } from "@/lib/pos-extras";
import { LoadState, PageTitle, Panel } from "./pos-shell";

const kindLabel: Record<string, string> = {
  room: "Rooms",
  food: "Food on guest bills",
  service: "Services",
  other: "Other",
};
const methodLabel = (m: string) => paymentMethods.find((p) => p.id === m)?.label ?? m;
const monthName = (key: string) =>
  new Date(`${key}-15T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const tk = (cents: number) => Math.round(cents / 100);

export function ReportsPage() {
  const [range, setRange] = useState<ReportRange>("7d");
  const today = resortToday();
  const { from, to, label } = rangeDates(range, today);
  const rows = useReportRows(from, to);
  const board = useBoardData();
  const roomCount = board.data?.units.filter((u) => u.is_active).length ?? 0;
  const [exporting, setExporting] = useState(false);
  const expensesQ = useExpenses(from, to);
  const discountsQ = useApprovedDiscounts(from, to);
  const expenses = useMemo(
    () => (expensesQ.data?.rows ?? []).filter((e) => !e.voided_at),
    [expensesQ.data],
  );
  const spent = expenses.reduce((t, e) => t + e.amount_cents, 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount_cents);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const extrasReady = Boolean(expensesQ.data) && !expensesQ.data?.notSetUp;

  const s = useMemo(
    () => (rows.data ? summarize({ from, to, roomCount, ...rows.data }) : null),
    [rows.data, from, to, roomCount],
  );
  const byMonth = s ? s.days > 62 : false;
  const period = `${shortDate(from)} – ${shortDate(addDays(to, -1))}`;

  const exportExcel = async () => {
    if (!s) return;
    setExporting(true);
    try {
      await downloadExcel(
        s,
        { spent, discounts: discountsQ.data ?? 0, expenses, ready: extrasReady },
        `${label} (${period})`,
        `santa-monica-report-${from}-to-${addDays(to, -1)}.xlsx`,
      );
    } catch {
      toast.error("Couldn't make the Excel file. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const presets: [ReportRange, string][] = [
    ["today", "Today"],
    ["7d", "7 days"],
    ["30d", "30 days"],
    ["month", "This month"],
    ["last_month", "Last month"],
    ["year", "This year"],
  ];

  return (
    <>
      <PageTitle
        title="Reports"
        sub={`${label} · ${period}`}
        actions={
          <>
            <Button variant="outline" className="h-10 gap-2" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </Button>
            <Button
              className="h-10 gap-2 bg-pos-ocean text-white hover:bg-pos-ocean/90"
              disabled={!s || exporting}
              onClick={() => void exportExcel()}
            >
              {exporting ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={16} />
              )}
              Excel
            </Button>
          </>
        }
      />
      <h1 className="mb-4 hidden text-lg font-semibold print:block">
        Santa Monica Eco Beach Resort · {label} · {period}
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

      <LoadState isLoading={rows.isLoading} error={rows.error} retry={() => void rows.refetch()} />

      {s && (
        <div className="grid gap-5">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Big
              label="Total money received"
              value={taka(s.received)}
              sub={`${s.payments} payments · ${taka(s.days ? s.received / s.days : 0)} a day`}
              strong
            />
            <Big
              label="From rooms & guest bills"
              value={taka(s.rooms)}
              sub={share(s.rooms, s.received)}
            />
            <Big
              label="From restaurant"
              value={taka(s.restaurant)}
              sub={share(s.restaurant, s.received)}
            />
            <Big
              label="Rooms filled"
              value={`${s.occupancy}%`}
              sub={`${s.roomNights} of ${s.capacity} room-nights`}
            />
          </section>

          {extrasReady && (
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Big label="Expenses" value={taka(spent)} sub={`${expenses.length} entries`} />
              <Big
                label={s.received - spent >= 0 ? "Profit" : "Loss"}
                value={taka(Math.abs(s.received - spent))}
                sub="money received − expenses"
                tone={s.received - spent >= 0 ? "good" : "bad"}
              />
              <Big
                label="Discounts given"
                value={taka(discountsQ.data ?? 0)}
                sub="approved in this period"
              />
              <Big
                label="Billed after discounts"
                value={taka(s.sales - (discountsQ.data ?? 0))}
                sub={`billed ${taka(s.sales)}`}
              />
            </section>
          )}

          {s.days > 1 && (
            <Panel
              title={byMonth ? "Money received each month" : "Money received each day"}
              aside={
                <span className="flex gap-3 text-xs text-pos-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-pos-ocean" /> Rooms
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-pos-gold" /> Restaurant
                  </span>
                </span>
              }
            >
              <StackBars
                data={byMonth ? s.monthly : s.daily}
                name={(k) => (byMonth ? monthName(k) : shortDate(k)).split(" ")[0] ?? k}
                full={byMonth ? monthName : shortDate}
              />
            </Panel>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Payments by method">
              <Bars
                rows={s.byMethod.map(([m, v]) => [methodLabel(m), v])}
                format={taka}
                empty="No payments in this period."
              />
            </Panel>
            <Panel title="Billed to guests, by type">
              <Bars
                rows={s.byKind.map(([k, v]) => [kindLabel[k] ?? k, v])}
                format={taka}
                empty="Nothing billed in this period."
              />
            </Panel>
            <Panel title="Room-nights by room type">
              <Bars
                rows={s.byType}
                format={(n) => `${n} nights`}
                empty="No stays in this period."
              />
            </Panel>
            {extrasReady && (
              <Panel title="Expenses by type">
                <Bars
                  rows={byCategory.map(([c, v]) => [categoryLabel(c), v])}
                  format={taka}
                  empty="No expenses in this period."
                />
              </Panel>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const share = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}% of the total` : "—";

function Big({
  label,
  value,
  sub,
  strong,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  strong?: boolean;
  tone?: "good" | "bad";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        strong
          ? "border-pos-ocean bg-pos-ocean text-white"
          : tone === "good"
            ? "border-pos-teal bg-pos-teal-soft"
            : tone === "bad"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-pos-line bg-white"
      }`}
    >
      <p className={`text-xs ${strong ? "text-pos-sand/75" : "text-pos-muted"}`}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className={`mt-0.5 text-xs ${strong ? "text-pos-sand/75" : "text-pos-muted"}`}>{sub}</p>
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

function StackBars({
  data,
  name,
  full,
}: {
  data: Bucket[];
  name: (key: string) => string;
  full: (key: string) => string;
}) {
  const max = Math.max(1, ...data.map((b) => b.rooms + b.restaurant));
  const showEvery = data.length > 16 ? Math.ceil(data.length / 10) : 1;
  return (
    <div className="flex h-52 items-end gap-1 sm:gap-1.5">
      {data.map((b, i) => {
        const total = b.rooms + b.restaurant;
        return (
          <div key={b.key} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className="flex flex-1 flex-col items-center justify-end"
              title={`${full(b.key)}\nRooms ${taka(b.rooms)} · Restaurant ${taka(b.restaurant)}\nTotal ${taka(total)}`}
            >
              <div
                className="flex w-full max-w-10 flex-col overflow-hidden rounded-t-[3px] transition-opacity group-hover:opacity-80"
                style={{ height: `${total > 0 ? Math.max(3, (total / max) * 100) : 0}%` }}
              >
                <div className="bg-pos-gold" style={{ flexGrow: b.restaurant }} />
                <div className="bg-pos-ocean" style={{ flexGrow: b.rooms }} />
              </div>
            </div>
            <span className="mt-1.5 h-4 truncate text-center text-[10px] text-pos-muted">
              {i % showEvery === 0 ? name(b.key) : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Builds a 4-sheet .xlsx in the browser: summary, daily, monthly, breakdown. */
async function downloadExcel(
  s: ReportSummary,
  x: { spent: number; discounts: number; expenses: Expense[]; ready: boolean },
  title: string,
  fileName: string,
) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const bold = (value: string | number) => ({ value, fontWeight: "bold" as const });
  const cell = (value: string | number) => ({ value });

  const summary = [
    [bold("Santa Monica Eco Beach Resort")],
    [cell(title)],
    [],
    [bold("Item"), bold("Amount (Tk)")],
    [cell("Total money received"), cell(tk(s.received))],
    [cell("From rooms & guest bills"), cell(tk(s.rooms))],
    [cell("From restaurant"), cell(tk(s.restaurant))],
    [cell("Billed to guests (rooms, food, services)"), cell(tk(s.sales))],
    [cell("Number of payments"), cell(s.payments)],
    ...(x.ready
      ? [
          [cell("Discounts given"), cell(tk(x.discounts))],
          [cell("Expenses"), cell(tk(x.spent))],
          [
            bold(s.received - x.spent >= 0 ? "Profit" : "Loss"),
            bold(tk(Math.abs(s.received - x.spent))),
          ],
        ]
      : []),
    [],
    [bold("Occupancy"), bold("")],
    [cell("Rooms filled (%)"), cell(s.occupancy)],
    [cell("Room-nights sold"), cell(s.roomNights)],
    [cell("Room-nights available"), cell(s.capacity)],
  ];
  const bucketRows = (list: Bucket[], label: (k: string) => string, first: string) => [
    [bold(first), bold("Rooms (Tk)"), bold("Restaurant (Tk)"), bold("Total (Tk)")],
    ...list.map((b) => [
      cell(label(b.key)),
      cell(tk(b.rooms)),
      cell(tk(b.restaurant)),
      cell(tk(b.rooms + b.restaurant)),
    ]),
    [bold("Total"), bold(tk(s.rooms)), bold(tk(s.restaurant)), bold(tk(s.received))],
  ];
  const fourCols = [{ width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }];

  await writeXlsxFile([
    { data: summary, sheet: "Summary", columns: [{ width: 40 }, { width: 16 }] },
    {
      data: bucketRows(s.daily, (k) => k, "Date"),
      sheet: "Daily",
      columns: fourCols,
      stickyRowsCount: 1,
    },
    {
      data: bucketRows(s.monthly, monthName, "Month"),
      sheet: "Monthly",
      columns: fourCols,
      stickyRowsCount: 1,
    },
    {
      data: [
        [bold("Payment method"), bold("Amount (Tk)")],
        ...s.byMethod.map(([m, v]) => [cell(methodLabel(m)), cell(tk(v))]),
        [],
        [bold("Billed to guests"), bold("Amount (Tk)")],
        ...s.byKind.map(([k, v]) => [cell(kindLabel[k] ?? k), cell(tk(v))]),
        [],
        [bold("Room type"), bold("Room-nights")],
        ...s.byType.map(([t, n]) => [cell(t), cell(n)]),
      ],
      sheet: "Breakdown",
      columns: [{ width: 28 }, { width: 16 }],
    },
    ...(x.ready
      ? [
          {
            data: [
              [bold("Date"), bold("Type"), bold("What"), bold("Paid by"), bold("Amount (Tk)")],
              ...x.expenses.map((e) => [
                cell(e.expense_date),
                cell(categoryLabel(e.category)),
                cell(e.description),
                cell(methodLabel(e.method)),
                cell(tk(e.amount_cents)),
              ]),
              [bold("Total"), cell(""), cell(""), cell(""), bold(tk(x.spent))],
            ],
            sheet: "Expenses",
            columns: [{ width: 12 }, { width: 24 }, { width: 36 }, { width: 10 }, { width: 14 }],
            stickyRowsCount: 1,
          },
        ]
      : []),
  ]).toFile(fileName);
}
