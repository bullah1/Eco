import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, FileSpreadsheet, LoaderCircle, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addDays,
  paymentMethods,
  resortToday,
  shortDate,
  shortDateTime,
  taka,
  type PaymentMethod,
} from "@/lib/pos";
import {
  filterPayments,
  paymentTotals,
  usePayments,
  type PaymentFilter,
  type ReceivedPayment,
} from "@/lib/pos-payments";
import { LoadState, PageTitle, Panel } from "./pos-shell";

type Range = "today" | "yesterday" | "week" | "month" | "custom";

function rangeDates(range: Range, today: string, custom: { from: string; to: string }) {
  switch (range) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "week":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    default:
      return custom;
  }
}

const methodLabel = (m: PaymentMethod) => paymentMethods.find((x) => x.id === m)?.label ?? m;

export function PaymentsPage() {
  const today = resortToday();
  const [range, setRange] = useState<Range>("today");
  const [custom, setCustom] = useState({ from: addDays(today, -30), to: today });
  const [filter, setFilter] = useState<PaymentFilter>({
    method: "all",
    source: "all",
    search: "",
    showRemoved: false,
  });
  const [busy, setBusy] = useState(false);

  const { from, to } = rangeDates(range, today, custom);
  const validRange = from <= to;
  const q = usePayments(from, validRange ? to : from);
  const shown = useMemo(() => filterPayments(q.data ?? [], filter), [q.data, filter]);
  const totals = paymentTotals(shown);
  const removedCount = (q.data ?? []).filter((p) => p.voided_at).length;
  const label = from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;

  async function exportExcel() {
    setBusy(true);
    try {
      await downloadPayments(shown, label, `payments-${from}-to-${to}.xlsx`);
    } catch {
      toast.error("Couldn't make the Excel file. Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Payments received"
        sub="Every payment from room bills and the restaurant: who paid, how much, when and how."
        actions={
          <Button
            variant="outline"
            className="h-11 gap-2"
            disabled={busy || shown.length === 0}
            onClick={() => void exportExcel()}
          >
            {busy ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            Excel
          </Button>
        }
      />

      {/* when */}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div role="group" aria-label="Dates" className="flex flex-wrap gap-1.5">
          {(
            [
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["week", "Last 7 days"],
              ["month", "This month"],
              ["custom", "Choose dates"],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              aria-pressed={range === id}
              onClick={() => setRange(id)}
              className={`h-10 rounded-full border px-4 text-sm ${range === id ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line bg-white hover:border-pos-ocean"}`}
            >
              {text}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm">
              <span className="sr-only">From</span>
              <Input
                type="date"
                value={custom.from}
                max={today}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="h-10 w-40 text-base sm:text-sm"
              />
            </label>
            <span className="text-sm text-pos-muted">to</span>
            <label className="text-sm">
              <span className="sr-only">To</span>
              <Input
                type="date"
                value={custom.to}
                max={today}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="h-10 w-40 text-base sm:text-sm"
              />
            </label>
            {!validRange && (
              <span className="text-sm text-red-700">The first date must come first</span>
            )}
          </div>
        )}
      </div>

      {/* totals */}
      <section
        aria-label="Totals"
        className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[1.4fr_repeat(5,minmax(0,1fr))]"
      >
        <div className="col-span-2 rounded-xl border border-pos-ocean bg-pos-ocean px-4 py-3 text-white sm:col-span-1">
          <p className="text-xs text-pos-sand/80">Received · {label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{taka(totals.total)}</p>
          <p className="mt-0.5 text-[11px] text-pos-sand/80">
            {totals.count} {totals.count === 1 ? "payment" : "payments"} · Rooms{" "}
            {taka(totals.rooms)} · Restaurant {taka(totals.restaurant)}
          </p>
        </div>
        {paymentMethods.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={filter.method === m.id}
            onClick={() => setFilter((f) => ({ ...f, method: f.method === m.id ? "all" : m.id }))}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${filter.method === m.id ? "border-pos-teal bg-pos-teal-soft/50" : "border-pos-line bg-white hover:border-pos-teal"}`}
          >
            <p className="text-xs text-pos-muted">{m.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {taka(totals.byMethod[m.id] ?? 0)}
            </p>
          </button>
        ))}
      </section>

      <Panel>
        {/* filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pos-muted"
            />
            <Input
              aria-label="Search payments"
              placeholder="Name, mobile, bill or order no, transaction ID"
              value={filter.search}
              onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
              className="h-10 pl-9 pr-9 text-base sm:text-sm"
            />
            {filter.search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setFilter((f) => ({ ...f, search: "" }))}
                className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-pos-muted"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div
            role="group"
            aria-label="From where"
            className="flex rounded-md border border-pos-line p-0.5"
          >
            {(
              [
                ["all", "All"],
                ["rooms", "Room bills"],
                ["restaurant", "Restaurant"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter.source === id}
                onClick={() => setFilter((f) => ({ ...f, source: id }))}
                className={`h-8 rounded px-3 text-sm ${filter.source === id ? "bg-pos-ocean text-white" : "text-pos-muted hover:text-pos-ink"}`}
              >
                {text}
              </button>
            ))}
          </div>
          {filter.method !== "all" && (
            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, method: "all" }))}
              className="flex h-9 items-center gap-1 rounded-full bg-pos-teal-soft px-3 text-sm text-pos-ocean"
            >
              {methodLabel(filter.method)} only <X size={14} />
            </button>
          )}
          {removedCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-pos-muted">
              <input
                type="checkbox"
                checked={filter.showRemoved}
                onChange={(e) => setFilter((f) => ({ ...f, showRemoved: e.target.checked }))}
                className="size-4 accent-pos-ocean"
              />
              Show removed ({removedCount})
            </label>
          )}
        </div>

        <LoadState isLoading={q.isLoading} error={q.error} retry={() => void q.refetch()} />

        {q.data && shown.length === 0 && (
          <p className="py-10 text-center text-sm text-pos-muted">
            {(q.data ?? []).length === 0
              ? `No payments received ${from === to && from === today ? "today" : `for ${label}`} yet.`
              : "No payment matches these filters."}
          </p>
        )}

        {shown.length > 0 && (
          <>
            {/* wide screens: table */}
            <table className="w-full text-sm max-md:hidden">
              <thead>
                <tr className="text-left text-xs text-pos-muted">
                  <th className="border-b border-pos-line py-2 pr-2 font-normal">Time</th>
                  <th className="border-b border-pos-line px-2 py-2 font-normal">Paid by</th>
                  <th className="border-b border-pos-line px-2 py-2 font-normal">For</th>
                  <th className="border-b border-pos-line px-2 py-2 font-normal">Method</th>
                  <th className="border-b border-pos-line px-2 py-2 font-normal">
                    Transaction / note
                  </th>
                  <th className="border-b border-pos-line px-2 py-2 font-normal">Shift</th>
                  <th className="border-b border-pos-line py-2 pl-2 text-right font-normal">
                    Amount
                  </th>
                  <th className="w-8 border-b border-pos-line" />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className={p.voided_at ? "text-pos-muted" : ""}>
                    <td className="whitespace-nowrap border-b border-pos-line/70 py-2.5 pr-2 tabular-nums">
                      {shortDateTime(p.created_at)}
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5">
                      <span className="block font-medium">{p.payer}</span>
                      {p.phone && <span className="text-xs text-pos-muted">{p.phone}</span>}
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5">
                      <span
                        className={`mr-1.5 rounded-full px-2 py-0.5 text-[11px] ${p.source === "rooms" ? "bg-pos-teal-soft text-pos-ocean" : "bg-[#f3e6cf] text-[#4d3a17]"}`}
                      >
                        {p.source === "rooms" ? "Room bill" : "Restaurant"}
                      </span>
                      <span className="text-xs text-pos-muted">{p.doc_no}</span>
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5">
                      {methodLabel(p.method)}
                    </td>
                    <td className="max-w-48 truncate border-b border-pos-line/70 px-2 py-2.5 text-xs">
                      {p.voided_at ? (
                        <span className="text-red-700">Removed: {p.void_reason}</span>
                      ) : (
                        p.reference || <span className="text-pos-muted">–</span>
                      )}
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5 text-xs text-pos-muted">
                      {p.shift_no ?? "–"}
                    </td>
                    <td
                      className={`border-b border-pos-line/70 py-2.5 pl-2 text-right font-medium tabular-nums ${p.voided_at ? "line-through" : ""}`}
                    >
                      {taka(p.amount_cents)}
                    </td>
                    <td className="border-b border-pos-line/70 pl-1 text-right">
                      {p.account_id && (
                        <Link
                          to="/pos/account/$id"
                          params={{ id: p.account_id }}
                          aria-label={`Open ${p.payer}'s bill`}
                          className="inline-grid size-8 place-items-center rounded-md text-pos-teal hover:bg-pos-ground"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* phones: cards */}
            <ul className="divide-y divide-pos-line md:hidden">
              {shown.map((p) => (
                <PaymentCard key={p.id} p={p} />
              ))}
            </ul>
          </>
        )}
      </Panel>
    </>
  );
}

function PaymentCard({ p }: { p: ReceivedPayment }) {
  const body = (
    <div
      className={`flex items-start justify-between gap-3 py-3 ${p.voided_at ? "text-pos-muted" : ""}`}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{p.payer}</p>
        <p className="text-xs text-pos-muted">
          {shortDateTime(p.created_at)} · {p.source === "rooms" ? "Room bill" : "Restaurant"} ·{" "}
          {p.doc_no}
        </p>
        <p className="text-xs text-pos-muted">
          {methodLabel(p.method)}
          {p.reference && ` · ${p.reference}`}
          {p.shift_no && ` · ${p.shift_no}`}
        </p>
        {p.voided_at && <p className="text-xs text-red-700">Removed: {p.void_reason}</p>}
      </div>
      <span className={`shrink-0 font-semibold tabular-nums ${p.voided_at ? "line-through" : ""}`}>
        {taka(p.amount_cents)}
      </span>
    </div>
  );
  return (
    <li>
      {p.account_id ? (
        <Link to="/pos/account/$id" params={{ id: p.account_id }} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

async function downloadPayments(list: ReceivedPayment[], label: string, fileName: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const bold = (value: string | number) => ({ value, fontWeight: "bold" as const });
  const cell = (value: string | number) => ({ value });
  const tk = (cents: number) => Math.round(cents) / 100;
  const t = paymentTotals(list);
  const rows = [
    [bold("Santa Monica Eco Beach Resort")],
    [cell(`Payments received · ${label}`)],
    [],
    [
      bold("Date and time"),
      bold("Paid by"),
      bold("Mobile"),
      bold("For"),
      bold("Bill / order"),
      bold("Method"),
      bold("Transaction / note"),
      bold("Shift"),
      bold("Amount (Tk)"),
      bold("Removed?"),
    ],
    ...list.map((p) => [
      cell(shortDateTime(p.created_at)),
      cell(p.payer),
      cell(p.phone),
      cell(p.source === "rooms" ? "Room bill" : "Restaurant"),
      cell(p.doc_no),
      cell(methodLabel(p.method)),
      cell(p.reference),
      cell(p.shift_no ?? ""),
      cell(tk(p.amount_cents)),
      cell(p.voided_at ? `Yes: ${p.void_reason ?? ""}` : ""),
    ]),
    [],
    [
      bold("Total received"),
      cell(""),
      cell(""),
      cell(""),
      cell(""),
      cell(""),
      cell(""),
      cell(""),
      bold(tk(t.total)),
    ],
    ...paymentMethods.map((m) => [
      cell(m.label),
      cell(""),
      cell(""),
      cell(""),
      cell(""),
      cell(""),
      cell(""),
      cell(""),
      cell(tk(t.byMethod[m.id] ?? 0)),
    ]),
  ];
  await writeXlsxFile([
    {
      data: rows,
      sheet: "Payments",
      columns: [
        { width: 18 },
        { width: 24 },
        { width: 15 },
        { width: 12 },
        { width: 18 },
        { width: 10 },
        { width: 22 },
        { width: 8 },
        { width: 14 },
        { width: 20 },
      ],
      stickyRowsCount: 4,
    },
  ]).toFile(fileName);
}
