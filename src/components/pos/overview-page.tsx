import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarPlus, LogIn, LogOut, TrendingDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  addDays,
  groupArrivals,
  resortToday,
  shortDate,
  shortDateTime,
  taka,
  useBoardData,
} from "@/lib/pos";
import { buildDesk } from "@/lib/pos-desk";
import { statusLook, useBookingHistory } from "@/lib/pos-history";
import {
  averagePct,
  averageRate,
  change,
  dailyOccupancy,
  greeting,
  pointChange,
} from "@/lib/pos-overview";
import { summarize, useReportRows } from "@/lib/pos-reports";
import { LoadState, Panel } from "./pos-shell";
import { BookingDialog, type BookingStart } from "./walk-in-dialog";

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const shortDay = (d: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

export function OverviewPage() {
  const today = resortToday();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingStart | null>(null);
  const board = useBoardData();
  const last30 = useReportRows(addDays(today, -29), addDays(today, 1));
  const prev30 = useReportRows(addDays(today, -59), addDays(today, -29));
  const recent = useBookingHistory(addDays(today, -30), today, "booked", today);

  const units = useMemo(() => (board.data?.units ?? []).filter((u) => u.is_active), [board.data]);
  const roomCount = units.length;
  const desk = useMemo(
    () => (board.data ? buildDesk(board.data.units, board.data.reservations, today) : null),
    [board.data, today],
  );
  const arrivals = useMemo(
    () => (board.data ? groupArrivals(board.data.reservations, today) : []),
    [board.data, today],
  );

  const now = useMemo(
    () =>
      last30.data
        ? summarize({ from: addDays(today, -29), to: addDays(today, 1), roomCount, ...last30.data })
        : null,
    [last30.data, today, roomCount],
  );
  const before = useMemo(
    () =>
      prev30.data
        ? summarize({
            from: addDays(today, -59),
            to: addDays(today, -29),
            roomCount,
            ...prev30.data,
          })
        : null,
    [prev30.data, today, roomCount],
  );
  const occupancy = useMemo(
    () =>
      last30.data
        ? dailyOccupancy(last30.data.stays, addDays(today, -29), addDays(today, 1), roomCount)
        : [],
    [last30.data, today, roomCount],
  );

  // Headline numbers
  const occupiedTonight = desk ? roomCount - desk.free.length - desk.outOfOrder.length : 0;
  const occTonight = roomCount ? Math.round((occupiedTonight / roomCount) * 100) : 0;
  const occWeek = averagePct(occupancy.slice(-8, -1));
  const moneyToday = now?.daily.at(-1);
  const moneyYesterday = now?.daily.at(-2);
  const sumDay = (b?: { rooms: number; restaurant: number }) => (b ? b.rooms + b.restaurant : 0);
  const roomSales = (s: typeof now) => s?.byKind.find(([k]) => k === "room")?.[1] ?? 0;
  const adr = now ? averageRate(roomSales(now), now.roomNights) : null;
  const adrBefore = before ? averageRate(roomSales(before), before.roomNights) : null;
  const revpar = now && now.capacity > 0 ? Math.round(roomSales(now) / now.capacity) : null;
  const leavingToday = desk?.leaving.length ?? 0;

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Dhaka",
    }).format(new Date()),
  );

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium leading-tight text-pos-ink">
            {greeting(hour)}, Santa Monica
          </h1>
          <p className="mt-1 text-sm text-pos-muted">
            {dayFmt.format(new Date(`${today}T00:00:00Z`))} · {arrivals.length}{" "}
            {arrivals.length === 1 ? "arrival" : "arrivals"} and {leavingToday}{" "}
            {leavingToday === 1 ? "departure" : "departures"} today
          </p>
        </div>
        <Button
          onClick={() => setBooking({})}
          className="h-11 gap-2 bg-pos-gold px-5 font-semibold text-pos-ocean hover:bg-pos-gold/85"
        >
          <CalendarPlus size={18} /> New booking
        </Button>
      </header>

      <LoadState
        isLoading={board.isLoading}
        error={board.error}
        retry={() => void board.refetch()}
      />

      {board.data && (
        <div className="grid gap-5">
          {/* headline numbers */}
          <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Occupancy tonight"
              value={`${occTonight}%`}
              delta={occupancy.length ? pointChange(occTonight, occWeek) : null}
              note={`vs ${occWeek}% average last 7 nights`}
            />
            <Kpi
              label="Free rooms tonight"
              value={`${desk?.free.length ?? 0}`}
              note={`of ${roomCount} rooms${desk?.outOfOrder.length ? ` · ${desk.outOfOrder.length} out of order` : ""}`}
              href="/pos"
            />
            <Kpi
              label="Money in today"
              value={now ? taka(sumDay(moneyToday)) : "…"}
              delta={now ? change(sumDay(moneyToday), sumDay(moneyYesterday)) : null}
              note={`vs ${taka(sumDay(moneyYesterday))} yesterday`}
              href="/pos/payments"
            />
            <Kpi
              label="Average room rate"
              value={adr !== null ? taka(adr) : "–"}
              delta={adr !== null && adrBefore !== null ? change(adr, adrBefore) : null}
              note={`Last 30 days${revpar !== null ? ` · RevPAR ${taka(revpar)}` : ""}`}
              href="/pos/reports"
            />
          </section>

          {/* occupancy + room status */}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Panel
              className="min-w-0"
              title="Occupancy, last 30 nights"
              aside={
                <span className="text-xs text-pos-muted">
                  Average {averagePct(occupancy)}% · {now?.roomNights ?? 0} room-nights
                </span>
              }
            >
              {last30.isLoading ? (
                <p className="h-52 text-sm text-pos-muted">Loading</p>
              ) : (
                <LineChart points={occupancy} />
              )}
            </Panel>

            <Panel
              title="Rooms right now"
              aside={
                <Link to="/pos/housekeeping" className="text-xs text-pos-teal">
                  Housekeeping
                </Link>
              }
            >
              <RoomGrid
                units={units}
                desk={desk}
                today={today}
                onOpen={(id) => void navigate({ to: "/pos", search: { room: id } })}
              />
            </Panel>
          </div>

          {/* money + room types */}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Panel
              className="min-w-0"
              title="Money received, last 30 days"
              aside={
                <span className="text-xs text-pos-muted">
                  {now ? taka(now.received) : "…"} · rooms {now ? taka(now.rooms) : "…"} ·
                  restaurant {now ? taka(now.restaurant) : "…"}
                </span>
              }
            >
              {now ? (
                <MoneyBars days={now.daily} />
              ) : (
                <p className="h-52 text-sm text-pos-muted">Loading</p>
              )}
            </Panel>
            <Panel
              title="Room-nights by room type"
              aside={<span className="text-xs text-pos-muted">Last 30 days</span>}
            >
              {now && now.byType.length > 0 ? (
                <ul className="grid gap-3">
                  {now.byType.map(([name, n]) => {
                    const max = Math.max(1, ...now.byType.map(([, v]) => v));
                    return (
                      <li key={name}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="truncate">{name}</span>
                          <span className="shrink-0 tabular-nums text-pos-muted">
                            {n} {n === 1 ? "night" : "nights"} ·{" "}
                            {Math.round((n / now.roomNights) * 100)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-pos-ground">
                          <div
                            className="h-2 rounded-full bg-pos-teal"
                            style={{ width: `${Math.max(3, (n / max) * 100)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-pos-muted">No nights sold in the last 30 days.</p>
              )}
            </Panel>
          </div>

          {/* today + recent bookings */}
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
            <Panel title={`Arriving today · ${arrivals.length}`}>
              {arrivals.length === 0 ? (
                <p className="text-sm text-pos-muted">No one else is due today.</p>
              ) : (
                <ul className="divide-y divide-pos-line">
                  {arrivals.slice(0, 6).map((a) => (
                    <PersonRow
                      key={a.key}
                      name={a.guest_name}
                      sub={`${a.reservations.length} ${a.reservations.length === 1 ? "room" : "rooms"} · ${shortDate(a.check_out)}`}
                      action={
                        <Link
                          to="/pos"
                          className="flex items-center gap-1 text-xs font-medium text-pos-teal"
                        >
                          <LogIn size={13} /> Check in
                        </Link>
                      }
                    />
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title={`Leaving today · ${leavingToday}`}>
              {!desk || desk.leaving.length === 0 ? (
                <p className="text-sm text-pos-muted">No check-outs left today.</p>
              ) : (
                <ul className="divide-y divide-pos-line">
                  {desk.leaving.slice(0, 6).map((s) => (
                    <PersonRow
                      key={s.reservation.id}
                      name={s.reservation.guest_name || "Guest"}
                      sub={`${s.unit.name}${s.extended ? ` · ${s.extended} extra night` : ""}`}
                      action={
                        s.reservation.account_id ? (
                          <Link
                            to="/pos/account/$id"
                            params={{ id: s.reservation.account_id }}
                            className="flex items-center gap-1 text-xs font-medium text-pos-teal"
                          >
                            <LogOut size={13} /> Bill
                          </Link>
                        ) : null
                      }
                    />
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Latest bookings"
              className="lg:col-span-2 xl:col-span-1"
              aside={
                <Link to="/pos/bookings" className="flex items-center gap-1 text-xs text-pos-teal">
                  View all <ArrowRight size={13} />
                </Link>
              }
            >
              {(recent.data ?? []).length === 0 ? (
                <p className="text-sm text-pos-muted">No bookings in the last 30 days.</p>
              ) : (
                <ul className="divide-y divide-pos-line">
                  {(recent.data ?? []).slice(0, 6).map((b) => (
                    <li key={b.key} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{b.guest_name}</span>
                        <span className="block truncate text-xs text-pos-muted">
                          {b.rooms.map((r) => r.room).join(", ")} · {shortDate(b.check_in)} –{" "}
                          {shortDate(b.check_out)} · booked {shortDateTime(b.booked_at)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {taka(b.total_cents)}
                      </span>
                      <span
                        className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline ${statusLook[b.status].cls}`}
                      >
                        {statusLook[b.status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      <BookingDialog
        open={booking !== null}
        onOpenChange={(o) => !o && setBooking(null)}
        units={board.data?.units ?? []}
        start={booking ?? undefined}
      />
    </>
  );
}

function Kpi({
  label,
  value,
  note,
  delta,
  href,
}: {
  label: string;
  value: string;
  note: string;
  delta?: { text: string; dir: "up" | "down" | "flat" } | null;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[11px] font-medium tracking-[0.08em] text-pos-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-[30px] leading-none font-medium tabular-nums text-pos-ink">
        {value}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-pos-muted">
        {delta && delta.dir !== "flat" && (
          <span
            className={`flex items-center gap-0.5 font-medium ${delta.dir === "up" ? "text-emerald-700" : "text-red-700"}`}
          >
            {delta.dir === "up" ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {delta.text}
          </span>
        )}
        <span className="truncate">{note}</span>
      </p>
    </>
  );
  const cls = "block min-w-0 rounded-xl border border-pos-line bg-white px-4 py-4 sm:px-5";
  return href ? (
    <Link to={href} className={`${cls} transition-shadow hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function PersonRow({ name, sub, action }: { name: string; sub: string; action: React.ReactNode }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pos-ocean text-xs font-semibold text-white">
        {initials || "G"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-pos-muted">{sub}</span>
      </span>
      {action}
    </li>
  );
}

/** One line, one axis (0–100%), crosshair + tooltip on hover. */
function LineChart({ points }: { points: { date: string; pct: number; occupied: number }[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real width so labels stay 11px on phones too.
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(280, Math.round(e?.contentRect.width ?? 720))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 500 ? 180 : 220;
  const step = W < 500 ? 10 : 7;
  const pad = { l: 36, r: 12, t: 12, b: 26 };
  const x = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  if (points.length === 0) return <p className="h-52 text-sm text-pos-muted">No data yet.</p>;
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const h = hover !== null ? points[hover] : null;

  return (
    <div ref={box} className="relative min-w-0">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={`Occupancy per night, ${shortDay(points[0]!.date)} to ${shortDay(points.at(-1)!.date)}. Average ${averagePct(points)}%.`}
        onPointerMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e2ded6" strokeWidth={1} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#5c6b6e">
              {v}%
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          (i % step === 0 && i < points.length - 4) || i === points.length - 1 ? (
            <text
              key={p.date}
              x={x(i)}
              y={H - 6}
              textAnchor={i === points.length - 1 ? "end" : i === 0 ? "start" : "middle"}
              fontSize={11}
              fill="#5c6b6e"
            >
              {i === points.length - 1 ? "Today" : shortDay(p.date)}
            </text>
          ) : null,
        )}
        <path d={area} fill="#2f7f7d" opacity={0.08} />
        <path d={path} fill="none" stroke="#2f7f7d" strokeWidth={2} strokeLinejoin="round" />
        {h && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={y(0)}
              stroke="#16262a"
              strokeOpacity={0.25}
            />
            <circle
              cx={x(hover)}
              cy={y(h.pct)}
              r={5}
              fill="#2f7f7d"
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-pos-line bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform:
              hover > points.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
          }}
        >
          <p className="font-medium">{shortDay(h.date)}</p>
          <p className="tabular-nums text-pos-muted">
            {h.pct}% · {h.occupied} {h.occupied === 1 ? "room" : "rooms"}
          </p>
        </div>
      )}
    </div>
  );
}

/** Daily money received: one bar per day, split shown in the tooltip. */
function MoneyBars({ days }: { days: { key: string; rooms: number; restaurant: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.rooms + d.restaurant));
  const h = hover !== null ? days[hover] : null;
  return (
    <div className="relative">
      <div className="flex h-52 items-end gap-[3px]" onPointerLeave={() => setHover(null)}>
        {days.map((d, i) => {
          const total = d.rooms + d.restaurant;
          return (
            <button
              key={d.key}
              type="button"
              aria-label={`${shortDay(d.key)}: ${taka(total)}`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="flex h-full min-w-0 flex-1 items-end focus-visible:outline-2 focus-visible:outline-pos-teal"
            >
              <span
                className={`block w-full rounded-t-[4px] ${hover === i ? "bg-pos-ocean" : "bg-pos-ocean/75"}`}
                style={{ height: `${total ? Math.max(2, (total / max) * 100) : 0}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-pos-muted">
        <span>{shortDay(days[0]!.key)}</span>
        <span>{shortDay(days[Math.floor(days.length / 2)]!.key)}</span>
        <span>Today</span>
      </div>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-pos-line bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${((hover + 0.5) / days.length) * 100}%`,
            transform:
              hover > days.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
          }}
        >
          <p className="font-medium">{shortDay(h.key)}</p>
          <p className="tabular-nums">Total {taka(h.rooms + h.restaurant)}</p>
          <p className="tabular-nums text-pos-muted">
            Rooms {taka(h.rooms)} · Restaurant {taka(h.restaurant)}
          </p>
        </div>
      )}
    </div>
  );
}

type RoomState = "occupied" | "arriving" | "free" | "dirty" | "out";
const roomLook: Record<RoomState, { label: string; cls: string }> = {
  occupied: { label: "Occupied", cls: "bg-pos-ocean text-white" },
  arriving: { label: "Arriving", cls: "bg-pos-teal-soft text-pos-ocean ring-1 ring-pos-teal" },
  free: { label: "Free", cls: "bg-white text-pos-ink ring-1 ring-pos-line" },
  dirty: { label: "Needs cleaning", cls: "bg-[#f3e6cf] text-[#4d3a17]" },
  out: { label: "Out of order", cls: "bg-red-50 text-red-800 ring-1 ring-red-200" },
};

function RoomGrid({
  units,
  desk,
  today,
  onOpen,
}: {
  units: { id: string; name: string; type_name: string; housekeeping: string }[];
  desk: ReturnType<typeof buildDesk> | null;
  today: string;
  onOpen: (unitId: string) => void;
}) {
  const stateOf = (id: string): { state: RoomState; who: string } => {
    if (!desk) return { state: "free", who: "" };
    const stay = [...desk.staying, ...desk.leaving].find((s) => s.unit.id === id);
    if (stay) return { state: "occupied", who: stay.reservation.guest_name };
    if (desk.outOfOrder.some((u) => u.id === id)) return { state: "out", who: "" };
    const free = desk.free.find((f) => f.unit.id === id);
    if (free) return { state: free.dirty ? "dirty" : "free", who: "" };
    return { state: "arriving", who: "" };
  };
  const counts = new Map<RoomState, number>();
  const cells = units.map((u) => {
    const s = stateOf(u.id);
    counts.set(s.state, (counts.get(s.state) ?? 0) + 1);
    return { u, ...s };
  });
  return (
    <>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
        {cells.map(({ u, state, who }) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onOpen(u.id)}
            title={`${u.name} · ${u.type_name} · ${roomLook[state].label}${who ? ` · ${who}` : ""}`}
            aria-label={`${u.name}, ${roomLook[state].label}`}
            className={`grid h-12 place-items-center rounded-md text-[13px] font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pos-gold ${roomLook[state].cls}`}
          >
            {u.name}
          </button>
        ))}
      </div>
      <ul
        className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-pos-muted"
        aria-label={`Rooms on ${today}`}
      >
        {(Object.keys(roomLook) as RoomState[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-[3px] ${roomLook[s].cls}`} />
            {roomLook[s].label} <span className="tabular-nums">{counts.get(s) ?? 0}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
