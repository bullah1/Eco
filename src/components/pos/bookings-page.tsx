import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, FileSpreadsheet, LoaderCircle, Phone, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { addDays, nights, resortToday, shortDate, shortDateTime, taka } from "@/lib/pos";
import {
  eventLabel,
  filterBookings,
  historySummary,
  mergeEvents,
  statusLook,
  useBookingEvents,
  useBookingHistory,
  type BookingStatus,
  type DateBy,
  type HistoryBooking,
  type HistoryFilter,
} from "@/lib/pos-history";
import { LoadState, PageTitle, Panel } from "./pos-shell";

type Range = "month" | "next30" | "lastMonth" | "year" | "custom";

function monthStart(date: string, offset = 0) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}

function rangeDates(range: Range, today: string, custom: { from: string; to: string }) {
  switch (range) {
    case "month":
      return { from: monthStart(today), to: addDays(monthStart(today, 1), -1) };
    case "next30":
      return { from: today, to: addDays(today, 30) };
    case "lastMonth":
      return { from: monthStart(today, -1), to: addDays(monthStart(today), -1) };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    default:
      return custom;
  }
}

const viaLabel = { website: "Website", front_desk: "Front desk", unknown: "–" } as const;
const statusTabs: ["all" | BookingStatus, string][] = [
  ["all", "All"],
  ["request", "Website requests"],
  ["upcoming", "Booked"],
  ["staying", "Staying"],
  ["checked_out", "Checked out"],
  ["no_show", "Didn't come"],
  ["cancelled", "Cancelled"],
];

export function BookingsPage() {
  const today = resortToday();
  const [range, setRange] = useState<Range>("month");
  const [dateBy, setDateBy] = useState<DateBy>("stay");
  const [custom, setCustom] = useState({ from: monthStart(today), to: today });
  const [filter, setFilter] = useState<HistoryFilter>({ status: "all", via: "all", search: "" });
  const [open, setOpen] = useState<HistoryBooking | null>(null);
  const [busy, setBusy] = useState(false);

  const { from, to } = rangeDates(range, today, custom);
  const valid = from <= to;
  const q = useBookingHistory(from, valid ? to : from, dateBy, today);
  const all = useMemo(() => q.data ?? [], [q.data]);
  const shown = useMemo(() => filterBookings(all, filter), [all, filter]);
  const sum = historySummary(shown);
  const countOf = (s: "all" | BookingStatus) =>
    filterBookings(all, { ...filter, status: s }).length;
  const label = `${shortDate(from)} – ${shortDate(to)}`;

  async function exportExcel() {
    setBusy(true);
    try {
      await downloadBookings(
        shown,
        `${dateBy === "stay" ? "Staying" : "Booked"} ${label}`,
        `bookings-${from}-to-${to}.xlsx`,
      );
    } catch {
      toast.error("Couldn't make the Excel file. Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Booking history"
        sub="Every booking, from the website and the front desk: who, which rooms, which dates, and everything that happened to it."
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Which date"
          className="flex rounded-full border border-pos-line bg-white p-0.5"
        >
          {(
            [
              ["stay", "Stay dates"],
              ["booked", "Booked on"],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              aria-pressed={dateBy === id}
              onClick={() => setDateBy(id)}
              className={`h-9 rounded-full px-3.5 text-sm ${dateBy === id ? "bg-pos-ocean text-white" : "text-pos-muted hover:text-pos-ink"}`}
            >
              {text}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Dates" className="flex flex-wrap gap-1.5">
          {(
            [
              ["month", "This month"],
              ["next30", "Next 30 days"],
              ["lastMonth", "Last month"],
              ["year", "This year"],
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
            <Input
              type="date"
              aria-label="From"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              className="h-10 w-40 text-base sm:text-sm"
            />
            <span className="text-sm text-pos-muted">to</span>
            <Input
              type="date"
              aria-label="To"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              className="h-10 w-40 text-base sm:text-sm"
            />
            {!valid && <span className="text-sm text-red-700">The first date must come first</span>}
          </div>
        )}
        <span className="text-sm text-pos-muted">{label}</span>
      </div>

      {/* totals */}
      <section
        aria-label="Totals"
        className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <Tile label="Bookings" value={`${sum.bookings}`} strong />
        <Tile label="Room-nights" value={`${sum.roomNights}`} />
        <Tile label="Room value" value={taka(sum.value)} sub="Cancelled not counted" />
        <Tile label="From the website" value={`${sum.website}`} />
        <Tile
          label="Cancelled"
          value={`${sum.cancelled}`}
          tone={sum.cancelled > 0 ? "warn" : undefined}
        />
      </section>

      <Panel>
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Status">
          {statusTabs.map(([id, text]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter.status === id}
              onClick={() => setFilter((f) => ({ ...f, status: id }))}
              className={`h-9 shrink-0 rounded-full px-3.5 text-sm ${filter.status === id ? "bg-pos-ocean text-white" : "bg-pos-ground text-pos-muted hover:text-pos-ink"}`}
            >
              {text} <span className="tabular-nums opacity-75">{countOf(id)}</span>
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pos-muted"
            />
            <Input
              aria-label="Search bookings"
              placeholder="Name, mobile, booking ref or room"
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
            aria-label="Booked from"
            className="flex rounded-md border border-pos-line p-0.5"
          >
            {(
              [
                ["all", "All"],
                ["website", "Website"],
                ["front_desk", "Front desk"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter.via === id}
                onClick={() => setFilter((f) => ({ ...f, via: id }))}
                className={`h-8 rounded px-3 text-sm ${filter.via === id ? "bg-pos-ocean text-white" : "text-pos-muted hover:text-pos-ink"}`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <LoadState isLoading={q.isLoading} error={q.error} retry={() => void q.refetch()} />

        {q.data && shown.length === 0 && (
          <p className="py-10 text-center text-sm text-pos-muted">
            {all.length === 0
              ? `No bookings ${dateBy === "stay" ? "staying" : "made"} between ${label}.`
              : "No booking matches these filters."}
          </p>
        )}

        {shown.length > 0 && (
          <>
            <table className="w-full text-sm max-lg:hidden">
              <thead>
                <tr className="text-left text-xs text-pos-muted">
                  <th className="border-b border-pos-line py-2 pr-2 font-normal">Booked on</th>
                  <th className="border-b border-pos-line px-2 py-2 font-normal">Guest</th>
                  <th className="border-b border-pos-line px-2 py-2 font-normal">Rooms</th>
                  <th className="border-b border-pos-line px-2 py-2 font-normal">Stay</th>
                  <th className="border-b border-pos-line px-2 py-2 font-normal">From</th>
                  <th className="border-b border-pos-line px-2 py-2 text-right font-normal">
                    Value
                  </th>
                  <th className="border-b border-pos-line py-2 pl-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((b) => (
                  <tr
                    key={b.key}
                    onClick={() => setOpen(b)}
                    className="cursor-pointer hover:bg-pos-ground/60"
                  >
                    <td className="whitespace-nowrap border-b border-pos-line/70 py-2.5 pr-2 tabular-nums text-pos-muted">
                      {shortDateTime(b.booked_at)}
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(b);
                        }}
                        className="block text-left font-medium hover:text-pos-teal"
                      >
                        {b.guest_name}
                      </button>
                      <span className="text-xs text-pos-muted">
                        {b.guest_phone || "No number"} · {b.reference}
                      </span>
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5">
                      {b.rooms.map((r) => (
                        <span
                          key={r.id}
                          className={`mr-1 ${r.status === "cancelled" ? "text-pos-muted line-through" : "font-medium"}`}
                        >
                          {r.room}
                        </span>
                      ))}
                    </td>
                    <td className="whitespace-nowrap border-b border-pos-line/70 px-2 py-2.5">
                      {shortDate(b.check_in)} – {shortDate(b.check_out)}
                      <span className="block text-xs text-pos-muted">
                        {b.nights} {b.nights === 1 ? "night" : "nights"}
                      </span>
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5 text-pos-muted">
                      {viaLabel[b.booked_via]}
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5 text-right font-medium tabular-nums">
                      {taka(b.total_cents)}
                    </td>
                    <td className="border-b border-pos-line/70 py-2.5 pl-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-pos-line lg:hidden">
              {shown.map((b) => (
                <li key={b.key}>
                  <button
                    type="button"
                    onClick={() => setOpen(b)}
                    className="flex w-full items-start justify-between gap-3 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{b.guest_name}</span>
                      <span className="block text-xs text-pos-muted">
                        {b.rooms.map((r) => r.room).join(", ")} · {shortDate(b.check_in)} –{" "}
                        {shortDate(b.check_out)}
                      </span>
                      <span className="block text-xs text-pos-muted">
                        Booked {shortDateTime(b.booked_at)} · {viaLabel[b.booked_via]}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{taka(b.total_cents)}</span>
                      <StatusBadge status={b.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <BookingSheet booking={open} onClose={() => setOpen(null)} />
    </>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusLook[status].cls}`}
    >
      {statusLook[status].label}
    </span>
  );
}

function Tile({
  label,
  value,
  sub,
  strong,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
  tone?: "warn" | undefined;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${strong ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line bg-white"}`}
    >
      <p className={`text-xs ${strong ? "text-pos-sand/80" : "text-pos-muted"}`}>{label}</p>
      <p
        className={`mt-0.5 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-red-700" : ""}`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-pos-muted">{sub}</p>}
    </div>
  );
}

function BookingSheet({
  booking: b,
  onClose,
}: {
  booking: HistoryBooking | null;
  onClose: () => void;
}) {
  const ids = b ? b.rooms.map((r) => r.id) : [];
  const events = useBookingEvents(ids);
  const roomOf = (id: string) => b?.rooms.find((r) => r.id === id)?.room ?? "";
  const timeline = mergeEvents(events.data ?? [], roomOf);
  const several = (b?.rooms.length ?? 0) > 1;

  return (
    <Sheet open={Boolean(b)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto font-sans sm:max-w-lg">
        {b && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">{b.guest_name}</SheetTitle>
              <SheetDescription>
                Ref {b.reference} · booked {shortDateTime(b.booked_at)}
                {b.booked_via !== "unknown" && ` · ${viaLabel[b.booked_via].toLowerCase()}`}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={b.status} />
                {b.guest_phone && (
                  <a
                    href={`tel:${b.guest_phone}`}
                    className="inline-flex items-center gap-1.5 text-sm text-pos-teal"
                  >
                    <Phone size={14} /> {b.guest_phone}
                  </a>
                )}
                {b.guest_email && <span className="text-sm text-pos-muted">{b.guest_email}</span>}
              </div>

              <div className="rounded-lg border border-pos-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-pos-muted">
                      <th className="px-3 py-2 font-normal">Room</th>
                      <th className="px-2 py-2 font-normal">Dates</th>
                      <th className="px-2 py-2 font-normal">Guests</th>
                      <th className="px-3 py-2 text-right font-normal">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.rooms.map((r) => (
                      <tr
                        key={r.id}
                        className={`border-t border-pos-line/70 ${r.status === "cancelled" ? "text-pos-muted" : ""}`}
                      >
                        <td className="px-3 py-2">
                          <span
                            className={`font-medium ${r.status === "cancelled" ? "line-through" : ""}`}
                          >
                            {r.room}
                          </span>
                          <span className="block text-xs text-pos-muted">{r.type_name}</span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {shortDate(r.check_in)} – {shortDate(r.check_out)}
                          <span className="block text-xs text-pos-muted">
                            {nights(r.check_in, r.check_out)} nights
                            {r.extended_nights > 0 && ` · ${r.extended_nights} extra`}
                          </span>
                        </td>
                        <td className="px-2 py-2 tabular-nums">{r.guest_count}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.status === "cancelled" ? "Cancelled" : taka(r.total_cents)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-pos-line font-medium">
                      <td className="px-3 py-2" colSpan={3}>
                        Room total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{taka(b.total_cents)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {b.note && (
                <p className="whitespace-pre-line rounded-lg bg-pos-ground p-3 text-sm">{b.note}</p>
              )}

              {b.account_id && (
                <Button
                  asChild
                  className="h-11 gap-1.5 bg-pos-ocean text-white hover:bg-pos-ocean/90"
                >
                  <Link to="/pos/account/$id" params={{ id: b.account_id }}>
                    Open the guest's bill <ArrowRight size={15} />
                  </Link>
                </Button>
              )}

              <section aria-label="What happened">
                <h3 className="mb-2 text-sm font-semibold">What happened</h3>
                {events.isLoading && (
                  <p className="flex items-center gap-2 text-sm text-pos-muted">
                    <LoaderCircle size={14} className="animate-spin" /> Loading
                  </p>
                )}
                {events.data && timeline.length === 0 && (
                  <p className="text-sm text-pos-muted">Nothing recorded yet.</p>
                )}
                <ol className="relative grid gap-3 border-l border-pos-line pl-4">
                  {timeline.map((e) => (
                    <li key={e.id} className="relative">
                      <span
                        className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-white ${e.kind === "cancelled" ? "bg-red-500" : e.kind === "extended" ? "bg-pos-gold-deep" : e.kind === "checked_in" || e.kind === "checked_out" ? "bg-pos-ocean" : "bg-pos-teal"}`}
                      />
                      <p className="text-sm">
                        <span className="font-medium">{eventLabel[e.kind] ?? e.kind}</span>
                        {several && e.kind !== "room_moved" && (
                          <span className="text-pos-muted"> · {e.rooms.join(", ")}</span>
                        )}
                      </p>
                      {e.detail && <p className="text-sm text-pos-muted">{e.detail}</p>}
                      <p className="text-xs text-pos-muted">
                        {shortDateTime(e.created_at)}
                        {e.actor_name && ` · ${e.actor_name}`}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

async function downloadBookings(list: HistoryBooking[], title: string, fileName: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const bold = (value: string | number) => ({ value, fontWeight: "bold" as const });
  const cell = (value: string | number) => ({ value });
  const tk = (cents: number) => Math.round(cents) / 100;
  const sum = historySummary(list);
  const data = [
    [bold("Santa Monica Eco Beach Resort")],
    [cell(`Booking history · ${title}`)],
    [],
    [
      bold("Booked on"),
      bold("Ref"),
      bold("Guest"),
      bold("Mobile"),
      bold("Rooms"),
      bold("Arrive"),
      bold("Leave"),
      bold("Nights"),
      bold("From"),
      bold("Status"),
      bold("Room value (Tk)"),
    ],
    ...list.map((b) => [
      cell(shortDateTime(b.booked_at)),
      cell(b.reference),
      cell(b.guest_name),
      cell(b.guest_phone),
      cell(
        b.rooms
          .map((r) => (r.status === "cancelled" ? `${r.room} (cancelled)` : r.room))
          .join(", "),
      ),
      cell(b.check_in),
      cell(b.check_out),
      cell(b.nights),
      cell(viaLabel[b.booked_via]),
      cell(statusLook[b.status].label),
      cell(tk(b.total_cents)),
    ]),
    [],
    [bold("Bookings"), bold(sum.bookings)],
    [bold("Room-nights"), bold(sum.roomNights)],
    [bold("Room value (Tk)"), bold(tk(sum.value))],
    [bold("Cancelled"), bold(sum.cancelled)],
  ];
  await writeXlsxFile([
    {
      data,
      sheet: "Bookings",
      columns: [
        { width: 16 },
        { width: 12 },
        { width: 24 },
        { width: 15 },
        { width: 22 },
        { width: 12 },
        { width: 12 },
        { width: 8 },
        { width: 12 },
        { width: 16 },
        { width: 16 },
      ],
      stickyRowsCount: 4,
    },
  ]).toFile(fileName);
}
