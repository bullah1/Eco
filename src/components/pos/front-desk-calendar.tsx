import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  LogIn,
  Phone,
  Search,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  addDays,
  groupArrivals,
  nights,
  posError,
  rpc,
  shortDate,
  taka,
  usePosAction,
  type Arrival,
  type PosReservation,
  type PosUnit,
} from "@/lib/pos";
import {
  buildTimeline,
  matchesSearch,
  useTimeline,
  type BarTone,
  type TimelineBar,
} from "@/lib/pos-timeline";
import { LoadState } from "./pos-shell";
import type { BookingStart } from "./walk-in-dialog";
import { AdvanceDialog, useAdvanceHeld } from "./advance-dialog";

const toneLook: Record<BarTone, { label: string; cls: string }> = {
  in_house: { label: "In house", cls: "bg-pos-ocean text-white" },
  booked: {
    label: "Booked",
    cls: "border-l-[3px] border-pos-teal bg-pos-teal-soft text-pos-ocean",
  },
  request: {
    label: "Website request",
    cls: "border border-dashed border-amber-500 bg-amber-50 text-amber-900",
  },
  done: { label: "Checked out", cls: "bg-[#e7e5df] text-[#66645e]" },
};

type Range = "weeks" | "month";

const monthFmt = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`;
function addMonths(d: string, n: number) {
  const x = asDate(firstOfMonth(d));
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString().slice(0, 10);
}
const daysInMonth = (d: string) => nights(firstOfMonth(d), addMonths(d, 1));

export function FrontDeskCalendar({
  units,
  today,
  onBook,
  onCheckIn,
}: {
  units: PosUnit[];
  today: string;
  onBook: (start: BookingStart) => void;
  onCheckIn: (arrival: Arrival) => void;
}) {
  const [range, setRange] = useState<Range>("weeks");
  const [from, setFrom] = useState(() => addDays(today, -1));
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [open, setOpen] = useState<TimelineBar | null>(null);

  const days = range === "weeks" ? 14 : daysInMonth(from);
  // Day columns stretch to fill the screen, but never get narrower than this.
  const minCol = range === "weeks" ? 52 : 40;
  const scroller = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const roomCol = width >= 640 ? 120 : 88;
  const grid = useRef<HTMLDivElement>(null);
  const col = Math.max(minCol, Math.floor((width - 2 - roomCol) / days) || minCol);
  const data = useTimeline(from, days);

  const groups = useMemo(
    () => (data.data ? buildTimeline(units, data.data, from, days) : []),
    [data.data, units, from, days],
  );
  const types = useMemo(() => [...new Set(groups.map((g) => g.type_name))], [groups]);
  const shown = type === "all" ? groups : groups.filter((g) => g.type_name === type);
  const loaded = Boolean(data.data);
  // Open with today near the left edge when today is on screen.
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const i = nights(from, today) * (today < from ? -1 : 1);
    el.scrollLeft = i > 2 && i < days ? (i - 1) * col : 0;
  }, [from, days, col, today, loaded]);

  const dates = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(from, i)),
    [from, days],
  );
  const matches = query.trim()
    ? (data.data ?? []).filter((r) => matchesSearch(r, query)).length
    : null;

  function move(step: number) {
    if (range === "month") setFrom(addMonths(from, step));
    else setFrom(addDays(from, step * 7));
  }
  function goToday() {
    setFrom(range === "month" ? firstOfMonth(today) : addDays(today, -1));
  }
  function switchRange(next: Range) {
    setRange(next);
    if (next === "month") setFrom(firstOfMonth(addDays(from, 1)));
    else setFrom(from.slice(0, 7) === today.slice(0, 7) ? addDays(today, -1) : from);
  }

  const label =
    range === "month"
      ? monthFmt.format(asDate(from))
      : `${shortDate(from)} – ${shortDate(addDays(from, days - 1))}`;

  return (
    <section
      ref={scroller}
      aria-label="Booking calendar"
      className="min-w-0 rounded-xl border border-pos-line bg-white"
    >
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-pos-line p-3 sm:p-4">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            aria-label={range === "month" ? "Previous month" : "Previous week"}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button variant="outline" className="h-10 px-3" onClick={goToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            aria-label={range === "month" ? "Next month" : "Next week"}
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        <label className="relative">
          <span className="sr-only">Jump to month</span>
          <input
            type="month"
            value={from.slice(0, 7)}
            onChange={(e) => {
              if (!e.target.value) return;
              const first = `${e.target.value}-01`;
              setFrom(first);
            }}
            className="h-10 rounded-md border border-pos-line bg-white px-3 text-sm font-medium"
          />
        </label>
        <span className="min-w-0 text-sm text-pos-muted max-sm:hidden">{label}</span>
        {data.isFetching && !data.isLoading && (
          <LoaderCircle size={14} className="animate-spin text-pos-muted" aria-label="Updating" />
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="How many days"
            className="flex rounded-md border border-pos-line p-0.5"
          >
            {(
              [
                ["weeks", "2 weeks"],
                ["month", "Month"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                aria-pressed={range === id}
                onClick={() => switchRange(id)}
                className={`h-8 rounded px-3 text-sm ${range === id ? "bg-pos-ocean text-white" : "text-pos-muted hover:text-pos-ink"}`}
              >
                {text}
              </button>
            ))}
          </div>
          <select
            aria-label="Room type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 rounded-md border border-pos-line bg-white px-2.5 text-sm"
          >
            <option value="all">All room types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="relative w-full sm:w-60">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pos-muted"
            />
            <Input
              aria-label="Find a booking"
              placeholder="Guest, phone or booking ref"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 pl-9 pr-9 text-base sm:text-sm"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-pos-muted"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs text-pos-muted">
        {(Object.keys(toneLook) as BarTone[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`h-3 w-5 rounded-[3px] ${toneLook[t].cls}`} />
            {toneLook[t].label}
          </span>
        ))}
        <span>Tap an empty day to book that room</span>
        {matches !== null && (
          <span className="ml-auto font-medium text-pos-ink" role="status">
            {matches === 0
              ? "No booking matches"
              : `${matches} matching ${matches === 1 ? "stay" : "stays"}`}
          </span>
        )}
      </div>

      <LoadState isLoading={data.isLoading} error={data.error} retry={() => void data.refetch()} />

      {data.data && (
        <div ref={grid} className="overflow-x-auto border-t border-pos-line">
          <div
            style={{ width: roomCol + days * col, "--room-col": `${roomCol}px` } as CSSProperties}
          >
            {/* day header */}
            <div className="sticky top-0 z-20 flex border-b border-pos-line bg-white">
              <div className="sticky left-0 z-10 w-[var(--room-col)] shrink-0 border-r border-pos-line bg-white px-3 py-2 text-xs text-pos-muted">
                Rooms
              </div>
              {dates.map((d) => {
                const isToday = d === today;
                const weekend = [5, 6].includes(asDate(d).getUTCDay());
                return (
                  <div
                    key={d}
                    style={{ width: col }}
                    className={`shrink-0 border-r border-pos-line/70 py-1.5 text-center leading-tight ${weekend ? "bg-pos-ground/70" : ""}`}
                  >
                    <span
                      className={`block text-[11px] ${isToday ? "font-semibold text-pos-ocean" : "text-pos-muted"}`}
                    >
                      {weekdayFmt.format(asDate(d))}
                    </span>
                    <span
                      className={`mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-[13px] tabular-nums ${isToday ? "bg-pos-ocean font-semibold text-white" : ""}`}
                    >
                      {Number(d.slice(8))}
                    </span>
                  </div>
                );
              })}
            </div>

            {shown.length === 0 && (
              <p className="p-6 text-center text-sm text-pos-muted">
                No rooms yet. Add room types and rooms in the admin panel.
              </p>
            )}

            {shown.map((g) => (
              <div key={g.type_name}>
                {/* room type row with free rooms per night */}
                <div className="flex border-b border-pos-line bg-pos-ground/60">
                  <div className="sticky left-0 z-10 w-[var(--room-col)] shrink-0 border-r border-pos-line bg-[#f7f5f1] px-3 py-1.5">
                    <span className="line-clamp-2 block text-[13px] font-semibold leading-tight">
                      {g.type_name}
                    </span>
                    <span className="block text-[11px] text-pos-muted">{taka(g.rate_cents)}</span>
                  </div>
                  {g.free.map((n, i) => (
                    <div
                      key={i}
                      style={{ width: col }}
                      className="grid shrink-0 place-items-center border-r border-pos-line/50"
                      title={`${n} free on ${shortDate(dates[i]!)}`}
                    >
                      <span
                        className={`min-w-6 rounded px-1 text-center text-xs font-medium tabular-nums ${n === 0 ? "bg-red-100 text-red-800" : "text-pos-muted"}`}
                      >
                        {n}
                      </span>
                    </div>
                  ))}
                </div>

                {g.rows.map(({ unit, bars }) => (
                  <div key={unit.id} className="flex border-b border-pos-line/70">
                    <div className="sticky left-0 z-10 flex w-[var(--room-col)] shrink-0 items-center gap-2 border-r border-pos-line bg-white px-3">
                      <span
                        className={`size-2 shrink-0 rounded-full ${unit.housekeeping === "clean" ? "bg-pos-teal" : unit.housekeeping === "dirty" ? "bg-pos-gold-deep" : "bg-red-500"}`}
                        title={
                          unit.housekeeping === "clean"
                            ? "Clean"
                            : unit.housekeeping === "dirty"
                              ? "Needs cleaning"
                              : "Out of order"
                        }
                      />
                      <span className="truncate whitespace-nowrap text-[13px] font-medium">
                        {unit.name}
                      </span>
                    </div>
                    <div className="relative h-12 shrink-0" style={{ width: days * col }}>
                      {/* day cells: tap to book */}
                      <div className="absolute inset-0 flex">
                        {dates.map((d, i) => {
                          const busy = bars.some(
                            (b) => b.tone !== "done" && b.start <= i && b.end > i,
                          );
                          const canBook =
                            !busy && d >= today && unit.housekeeping !== "maintenance";
                          const cls = `h-full shrink-0 border-r border-pos-line/50 ${d === today ? "bg-pos-teal-soft/35" : [5, 6].includes(asDate(d).getUTCDay()) ? "bg-pos-ground/50" : ""}`;
                          return canBook ? (
                            <button
                              key={d}
                              type="button"
                              style={{ width: col }}
                              aria-label={`Book ${unit.name} from ${shortDate(d)}`}
                              onClick={() => onBook({ checkIn: d, unitId: unit.id })}
                              className={`${cls} transition-colors hover:bg-pos-gold/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pos-teal`}
                            />
                          ) : (
                            <div
                              key={d}
                              style={{ width: col }}
                              className={`${cls} ${unit.housekeeping === "maintenance" && d >= today ? "bg-[repeating-linear-gradient(135deg,transparent_0_6px,#f3d5d5_6px_8px)]" : ""}`}
                            />
                          );
                        })}
                      </div>
                      {/* stays: arrive mid-day, leave mid-day */}
                      {bars.map((b) => {
                        const left = b.start < 0 ? 0 : b.start * col + col / 2;
                        const right = b.end > days ? days * col : b.end * col + col / 2;
                        const width = Math.max(right - left - 3, 10);
                        const dim = query.trim() && !matchesSearch(b.reservation, query);
                        const r = b.reservation;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setOpen(b)}
                            style={{ left: left + 1, width }}
                            title={`${r.guest_name || "Guest"} · ${shortDate(r.check_in)}–${shortDate(r.check_out)}`}
                            className={`absolute inset-y-2 z-[5] flex items-center overflow-hidden rounded-md px-2 text-left text-xs font-medium shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-opacity hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pos-gold ${toneLook[b.tone].cls} ${b.start < 0 ? "rounded-l-none" : ""} ${b.end > days ? "rounded-r-none" : ""} ${dim ? "opacity-20" : ""}`}
                          >
                            <span className="truncate">{r.guest_name || "Guest"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <StaySheet
        bar={open}
        all={data.data ?? []}
        units={units}
        today={today}
        onClose={() => setOpen(null)}
        onCheckIn={(a) => {
          setOpen(null);
          onCheckIn(a);
        }}
      />
    </section>
  );
}

function StaySheet({
  bar,
  all,
  units,
  today,
  onClose,
  onCheckIn,
}: {
  bar: TimelineBar | null;
  all: PosReservation[];
  units: PosUnit[];
  today: string;
  onClose: () => void;
  onCheckIn: (a: Arrival) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [advanceFor, setAdvanceFor] = useState<PosReservation | null>(null);
  const confirm = usePosAction((id: string) =>
    rpc(supabase.rpc("pos_confirm_booking", { p_reservation: id })),
  );
  const cancel = usePosAction((v: { id: string; reason: string }) =>
    rpc(supabase.rpc("pos_cancel_booking", { p_reservation: v.id, p_reason: v.reason })),
  );

  const r = bar?.reservation;
  const together = r
    ? all.filter((x) => (r.booking_group ? x.booking_group === r.booking_group : x.id === r.id))
    : [];
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "Room";
  const arrival = r
    ? groupArrivals(all, today).find((a) => a.reservations.some((x) => x.id === r.id))
    : undefined;
  const total = together.reduce((s, x) => s + x.total_cents, 0);
  const { held } = useAdvanceHeld(
    r && r.stay_status === "expected" ? r.guest_phone : "",
    Boolean(r && r.stay_status === "expected"),
  );

  function close() {
    setCancelling(false);
    setReason("");
    onClose();
  }

  return (
    <Sheet open={Boolean(bar)} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto font-sans sm:max-w-md">
        {r && bar && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">{r.guest_name || "Guest"}</SheetTitle>
              <SheetDescription>
                {toneLook[bar.tone].label} · ref {r.booking_reference}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4 pb-6">
              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-pos-line p-4 text-sm">
                <div>
                  <dt className="text-xs text-pos-muted">Arrives</dt>
                  <dd className="font-medium">{shortDate(r.check_in)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-pos-muted">Leaves</dt>
                  <dd className="font-medium">{shortDate(r.check_out)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-pos-muted">Nights</dt>
                  <dd className="font-medium tabular-nums">{nights(r.check_in, r.check_out)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-pos-muted">Room total</dt>
                  <dd className="font-medium tabular-nums">{taka(total)}</dd>
                  {held > 0 && (
                    <dd className="text-xs font-medium text-pos-teal">Advance paid {taka(held)}</dd>
                  )}
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-pos-muted">
                    {together.length === 1 ? "Room" : `${together.length} rooms`}
                  </dt>
                  <dd className="font-medium">
                    {together
                      .map((x) => `${unitName(x.room_unit_id)} (${x.guest_count} guests)`)
                      .join(", ")}
                  </dd>
                </div>
                {r.guest_phone && (
                  <div className="col-span-2">
                    <a
                      href={`tel:${r.guest_phone}`}
                      className="inline-flex items-center gap-1.5 text-pos-teal"
                    >
                      <Phone size={14} /> {r.guest_phone}
                    </a>
                  </div>
                )}
              </dl>
              {r.guest_note && (
                <p className="whitespace-pre-line rounded-lg bg-pos-ground p-3 text-sm">
                  {r.guest_note}
                </p>
              )}

              <div className="grid gap-2">
                {r.account_id && (
                  <Button asChild className="h-11 bg-pos-ocean text-white hover:bg-pos-ocean/90">
                    <Link to="/pos/account/$id" params={{ id: r.account_id }}>
                      Open the guest's bill
                    </Link>
                  </Button>
                )}
                {arrival && (
                  <Button
                    onClick={() => onCheckIn(arrival)}
                    className="h-11 gap-2 bg-pos-ocean text-white hover:bg-pos-ocean/90"
                  >
                    <LogIn size={16} /> Check in
                  </Button>
                )}
                {r.stay_status === "expected" && r.status !== "cancelled" && (
                  <Button variant="outline" className="h-11 gap-2" onClick={() => setAdvanceFor(r)}>
                    <Wallet size={16} /> {held > 0 ? "Take more advance" : "Take advance"}
                  </Button>
                )}
                {r.status === "pending" && r.stay_status === "expected" && (
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={confirm.isPending}
                    onClick={() =>
                      confirm.mutate(r.id, {
                        onSuccess: () => {
                          toast.success(`Booking for ${r.guest_name || "the guest"} confirmed`);
                          close();
                        },
                        onError: (e) => toast.error(posError(e)),
                      })
                    }
                  >
                    {confirm.isPending && <LoaderCircle size={16} className="animate-spin" />}
                    Confirm the booking
                  </Button>
                )}
                {r.stay_status === "expected" && !cancelling && (
                  <Button
                    variant="ghost"
                    className="h-11 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => setCancelling(true)}
                  >
                    Cancel booking
                  </Button>
                )}
                {cancelling && (
                  <form
                    className="grid gap-2 rounded-lg border border-red-200 bg-red-50/60 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      cancel.mutate(
                        { id: r.id, reason: reason.trim() },
                        {
                          onSuccess: () => {
                            toast.success("Booking cancelled. The rooms are free again");
                            close();
                          },
                          onError: (err) => toast.error(posError(err)),
                        },
                      );
                    }}
                  >
                    <label htmlFor="cancel-reason" className="text-sm font-medium text-red-900">
                      Why is it cancelled?
                      {together.length > 1 && ` All ${together.length} rooms will be freed.`}
                    </label>
                    <Input
                      id="cancel-reason"
                      value={reason}
                      autoFocus
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Guest called to cancel"
                      className="h-11 bg-white text-base sm:text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 flex-1"
                        onClick={() => setCancelling(false)}
                      >
                        Keep it
                      </Button>
                      <Button
                        type="submit"
                        disabled={cancel.isPending || reason.trim().length < 3}
                        className="h-10 flex-1 bg-red-700 text-white hover:bg-red-800"
                      >
                        {cancel.isPending && <LoaderCircle size={16} className="animate-spin" />}
                        Cancel booking
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
      <AdvanceDialog
        reservation={advanceFor}
        bookingTotal={total}
        onClose={() => setAdvanceFor(null)}
      />
    </Sheet>
  );
}
