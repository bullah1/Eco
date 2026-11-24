import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowRight,
  BedDouble,
  LoaderCircle,
  LogIn,
  Phone,
  Sparkles,
  UserPlus,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  buildBoard,
  groupArrivals,
  nights,
  posError,
  rpc,
  shortDate,
  taka,
  useBoardData,
  usePosAction,
  type Arrival,
  type BoardTile,
  type Housekeeping,
  type TileState,
} from "@/lib/pos";
import { LoadState, PageTitle, Panel } from "./pos-shell";
import { WalkInDialog } from "./walk-in-dialog";

const tileLook: Record<TileState, { label: string; cls: string }> = {
  in_house: { label: "In house", cls: "border-pos-ocean bg-pos-ocean text-white" },
  leaving: { label: "Leaving today", cls: "border-pos-gold-deep bg-[#f3e6cf] text-[#4d3a17]" },
  arriving: { label: "Arriving", cls: "border-pos-teal bg-pos-teal-soft text-pos-ocean" },
  free: { label: "Free", cls: "border-[#c9c3b8] bg-white text-pos-ink" },
  dirty: {
    label: "Needs cleaning",
    cls: "border-dashed border-[#8c8a85] bg-[#ecebe6] text-[#45443f]",
  },
  maintenance: {
    label: "Out of order",
    cls: "border-dashed border-red-300 bg-red-50 text-red-900",
  },
};

export function FrontDesk() {
  const board = useBoardData();
  const [walkIn, setWalkIn] = useState(false);
  const [openTile, setOpenTile] = useState<BoardTile | null>(null);
  const [checkIn, setCheckIn] = useState<Arrival | null>(null);

  const today = board.data?.today ?? "";
  const tiles = useMemo(
    () => (board.data ? buildBoard(board.data.units, board.data.reservations, today) : []),
    [board.data, today],
  );
  const arrivals = useMemo(
    () => (board.data ? groupArrivals(board.data.reservations, today) : []),
    [board.data, today],
  );
  const upcoming = useMemo(() => {
    if (!board.data) return [];
    const future = board.data.reservations.filter(
      (r) => r.stay_status === "expected" && r.check_in > today,
    );
    const seen = new Map<
      string,
      { name: string; check_in: string; rooms: number; pending: boolean }
    >();
    for (const r of future) {
      const key = r.booking_group || r.booking_reference;
      const cur = seen.get(key);
      seen.set(key, {
        name: r.guest_name || "Guest",
        check_in: cur && cur.check_in < r.check_in ? cur.check_in : r.check_in,
        rooms: (cur?.rooms ?? 0) + 1,
        pending: Boolean(cur?.pending) || r.status === "pending",
      });
    }
    return [...seen.values()].sort((a, b) => a.check_in.localeCompare(b.check_in)).slice(0, 8);
  }, [board.data, today]);

  const groups = useMemo(() => {
    const map = new Map<string, BoardTile[]>();
    for (const t of tiles) map.set(t.unit.type_name, [...(map.get(t.unit.type_name) ?? []), t]);
    return [...map.entries()];
  }, [tiles]);

  const count = (s: TileState) => tiles.filter((t) => t.state === s).length;
  const leaving = tiles.filter((t) => t.state === "leaving");
  const inUse = count("in_house") + count("leaving");

  const arrivalFor = (tile: BoardTile) =>
    arrivals.find((a) => a.reservations.some((r) => r.id === tile.reservation?.id)) ?? null;

  return (
    <>
      <PageTitle
        title="Front desk"
        sub={
          today
            ? new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })
            : undefined
        }
        actions={
          <Button
            onClick={() => setWalkIn(true)}
            className="h-11 gap-2 bg-pos-gold px-5 font-semibold text-pos-ocean hover:bg-pos-gold/85"
          >
            <UserPlus size={18} /> Walk-in guest
          </Button>
        }
      />

      <LoadState
        isLoading={board.isLoading}
        error={board.error}
        retry={() => void board.refetch()}
      />

      {board.data && (
        <>
          <section
            aria-label="Today at a glance"
            className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
          >
            <Stat label="Arriving today" value={arrivals.length} />
            <Stat label="Leaving today" value={leaving.length} />
            <Stat label="Rooms in use" value={inUse} of={tiles.length} />
            <Stat label="Free and clean" value={count("free")} />
            <Stat
              label="Need cleaning"
              value={count("dirty")}
              tone={count("dirty") > 0 ? "warn" : undefined}
            />
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel
              title="Rooms tonight"
              aside={
                <ul className="hidden flex-wrap gap-x-4 gap-y-1 text-xs text-pos-muted md:flex">
                  {(["in_house", "arriving", "leaving", "free", "dirty"] as TileState[]).map(
                    (s) => (
                      <li key={s} className="flex items-center gap-1.5">
                        <span className={`size-3 rounded-[3px] border ${tileLook[s].cls}`} />
                        {tileLook[s].label}
                      </li>
                    ),
                  )}
                </ul>
              }
            >
              {tiles.length === 0 ? (
                <p className="py-6 text-center text-sm text-pos-muted">
                  No rooms yet. Add room types and rooms in the admin panel.
                </p>
              ) : (
                <div className="grid gap-5">
                  {groups.map(([name, list]) => (
                    <div key={name}>
                      <p className="mb-2 text-xs text-pos-muted">
                        {name} · {taka(list[0]?.unit.rate_cents)} / night
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                        {list.map((tile) => (
                          <button
                            key={tile.unit.id}
                            type="button"
                            onClick={() => setOpenTile(tile)}
                            className={`flex h-[68px] min-w-0 flex-col justify-between rounded-lg border px-2.5 py-2 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pos-teal ${tileLook[tile.state].cls}`}
                          >
                            <span className="flex min-w-0 items-baseline justify-between gap-1.5">
                              <span className="shrink-0 whitespace-nowrap text-[15px] font-semibold">
                                {tile.unit.name}
                              </span>
                              <span className="min-w-0 truncate text-[10.5px] opacity-85">
                                {tileLook[tile.state].label}
                              </span>
                            </span>
                            <span className="truncate text-xs opacity-90">
                              {tile.reservation
                                ? `${tile.reservation.guest_name || "Guest"}${tile.state === "in_house" ? ` · till ${shortDate(tile.reservation.check_out)}` : ""}`
                                : tile.next
                                  ? `Next: ${shortDate(tile.next.check_in)}`
                                  : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <div className="grid content-start gap-5">
              <Panel
                title="Arriving today"
                aside={<span className="text-xs text-pos-muted">{arrivals.length}</span>}
              >
                {arrivals.length === 0 ? (
                  <p className="text-sm text-pos-muted">No one else is due today.</p>
                ) : (
                  <ul className="grid gap-2.5">
                    {arrivals.map((a) => (
                      <li key={a.key} className="rounded-lg border border-pos-line p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{a.guest_name}</p>
                            <p className="text-xs text-pos-muted">
                              {a.reservations.length}{" "}
                              {a.reservations.length === 1 ? "room" : "rooms"} ·{" "}
                              {shortDate(a.check_in)}–{shortDate(a.check_out)} ·{" "}
                              {nights(a.check_in, a.check_out)} nights
                            </p>
                          </div>
                          {!a.confirmed && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                              Request
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <Button
                            onClick={() => setCheckIn(a)}
                            className="h-10 flex-1 gap-1.5 bg-pos-ocean text-white hover:bg-pos-ocean/90"
                          >
                            <LogIn size={16} /> Check in
                          </Button>
                          {a.guest_phone && (
                            <Button
                              asChild
                              variant="outline"
                              className="h-10 px-3"
                              aria-label={`Call ${a.guest_name}`}
                            >
                              <a href={`tel:${a.guest_phone}`}>
                                <Phone size={16} />
                              </a>
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Leaving today">
                {leaving.length === 0 ? (
                  <p className="text-sm text-pos-muted">No check-outs left today.</p>
                ) : (
                  <ul className="divide-y divide-pos-line">
                    {leaving.map((t) => (
                      <li
                        key={t.unit.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {t.reservation?.guest_name || "Guest"}
                          </span>
                          <span className="text-xs text-pos-muted">{t.unit.name}</span>
                        </span>
                        {t.reservation?.account_id && (
                          <Button asChild variant="outline" className="h-9 gap-1 px-3">
                            <Link to="/pos/account/$id" params={{ id: t.reservation.account_id }}>
                              Bill <ArrowRight size={14} />
                            </Link>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {upcoming.length > 0 && (
                <Panel title="Coming up">
                  <ul className="divide-y divide-pos-line text-sm">
                    {upcoming.map((u, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0 truncate">
                          {u.name}
                          {u.pending && (
                            <span className="ml-1.5 text-[11px] text-amber-800">request</span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-pos-muted">
                          {shortDate(u.check_in)} · {u.rooms} {u.rooms === 1 ? "room" : "rooms"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          </div>
        </>
      )}

      <WalkInDialog open={walkIn} onOpenChange={setWalkIn} units={board.data?.units ?? []} />
      <RoomSheet
        tile={openTile}
        onClose={() => setOpenTile(null)}
        onCheckIn={(tile) => {
          const a = arrivalFor(tile);
          setOpenTile(null);
          if (a) setCheckIn(a);
        }}
      />
      <CheckInDialog
        arrival={checkIn}
        units={board.data?.units ?? []}
        onClose={() => setCheckIn(null)}
      />
    </>
  );
}

function Stat({
  label,
  value,
  of,
  tone,
}: {
  label: string;
  value: number;
  of?: number | undefined;
  tone?: "warn" | undefined;
}) {
  return (
    <div className="rounded-xl border border-pos-line bg-white px-4 py-3">
      <p className="text-xs text-pos-muted">{label}</p>
      <p
        className={`mt-0.5 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-pos-gold-deep" : ""}`}
      >
        {value}
        {of !== undefined && (
          <span className="ml-1 text-sm font-normal text-pos-muted">of {of}</span>
        )}
      </p>
    </div>
  );
}

function RoomSheet({
  tile,
  onClose,
  onCheckIn,
}: {
  tile: BoardTile | null;
  onClose: () => void;
  onCheckIn: (tile: BoardTile) => void;
}) {
  const setState = usePosAction((v: { unit: string; state: Housekeeping }) =>
    rpc(supabase.rpc("pos_set_housekeeping", { p_unit: v.unit, p_state: v.state })),
  );
  const r = tile?.reservation;
  const occupied = tile && (tile.state === "in_house" || tile.state === "leaving");

  return (
    <Sheet open={Boolean(tile)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full font-sans sm:max-w-md">
        {tile && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">
                {tile.unit.name} · {tile.unit.type_name}
              </SheetTitle>
              <SheetDescription>
                {tileLook[tile.state].label} · {taka(tile.unit.rate_cents)} a night · up to{" "}
                {tile.unit.max_guests} guests
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4 pb-6">
              {r && (
                <div className="rounded-lg border border-pos-line p-4">
                  <p className="font-medium">{r.guest_name || "Guest"}</p>
                  <p className="mt-0.5 text-sm text-pos-muted">
                    {shortDate(r.check_in)} – {shortDate(r.check_out)} · {r.guest_count} guests ·
                    ref {r.booking_reference}
                  </p>
                  {r.guest_phone && (
                    <a
                      href={`tel:${r.guest_phone}`}
                      className="mt-1 inline-flex items-center gap-1 text-sm text-pos-teal"
                    >
                      <Phone size={14} /> {r.guest_phone}
                    </a>
                  )}
                  {r.guest_note && (
                    <p className="mt-2 rounded bg-pos-ground p-2 text-sm">“{r.guest_note}”</p>
                  )}
                  <div className="mt-3">
                    {occupied && r.account_id ? (
                      <Button
                        asChild
                        className="h-11 w-full bg-pos-ocean text-white hover:bg-pos-ocean/90"
                      >
                        <Link to="/pos/account/$id" params={{ id: r.account_id }}>
                          Open the guest's bill
                        </Link>
                      </Button>
                    ) : tile.state === "arriving" ? (
                      <Button
                        onClick={() => onCheckIn(tile)}
                        className="h-11 w-full gap-2 bg-pos-ocean text-white hover:bg-pos-ocean/90"
                      >
                        <LogIn size={16} /> Check in
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
              {tile.next && !r && (
                <p className="text-sm text-pos-muted">
                  Next booking: {tile.next.guest_name || "Guest"} from{" "}
                  {shortDate(tile.next.check_in)}
                </p>
              )}
              {!occupied && (
                <div>
                  <p className="mb-2 text-sm font-medium">Room condition</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["clean", "Clean", Sparkles],
                        ["dirty", "Needs cleaning", BedDouble],
                        ["maintenance", "Out of order", Wrench],
                      ] as const
                    ).map(([state, label, Icon]) => {
                      const on = tile.unit.housekeeping === state;
                      return (
                        <button
                          key={state}
                          type="button"
                          disabled={setState.isPending}
                          aria-pressed={on}
                          onClick={() =>
                            setState.mutate(
                              { unit: tile.unit.id, state },
                              {
                                onSuccess: () => {
                                  toast.success(`${tile.unit.name} marked ${label.toLowerCase()}`);
                                  onClose();
                                },
                                onError: (e) => toast.error(posError(e)),
                              },
                            )
                          }
                          className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-xs transition-colors ${
                            on
                              ? "border-pos-ocean bg-pos-ocean text-white"
                              : "border-pos-line bg-white hover:bg-pos-ground"
                          }`}
                        >
                          <Icon size={18} strokeWidth={1.6} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CheckInDialog({
  arrival,
  units,
  onClose,
}: {
  arrival: Arrival | null;
  units: { id: string; name: string; type_name: string; housekeeping: Housekeeping }[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const action = usePosAction((ids: string[]) =>
    rpc(supabase.rpc("pos_check_in", { p_reservation_ids: ids })),
  );
  const unitOf = (id: string) => units.find((u) => u.id === id);
  const dirty =
    arrival?.reservations.filter((r) => unitOf(r.room_unit_id)?.housekeeping !== "clean") ?? [];

  return (
    <Dialog open={Boolean(arrival)} onOpenChange={(o) => !o && !action.isPending && onClose()}>
      <DialogContent className="font-sans sm:max-w-md">
        {arrival && (
          <>
            <DialogHeader>
              <DialogTitle>Check in {arrival.guest_name}</DialogTitle>
              <DialogDescription>
                {shortDate(arrival.check_in)} – {shortDate(arrival.check_out)} ·{" "}
                {nights(arrival.check_in, arrival.check_out)} nights · breakfast included
              </DialogDescription>
            </DialogHeader>
            <ul className="divide-y divide-pos-line rounded-lg border border-pos-line text-sm">
              {arrival.reservations.map((r) => {
                const u = unitOf(r.room_unit_id);
                return (
                  <li key={r.id} className="flex justify-between gap-3 px-3 py-2.5">
                    <span>
                      {u?.name} · {u?.type_name}
                      <span className="block text-xs text-pos-muted">{r.guest_count} guests</span>
                    </span>
                    <span className="tabular-nums">{taka(r.total_cents)}</span>
                  </li>
                );
              })}
              <li className="flex justify-between px-3 py-2.5 font-semibold">
                <span>Room total</span>
                <span className="tabular-nums">{taka(arrival.total_cents)}</span>
              </li>
            </ul>
            {!arrival.confirmed && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                This was a website request that nobody confirmed. Checking in confirms it.
              </p>
            )}
            {dirty.length > 0 && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {dirty.map((r) => unitOf(r.room_unit_id)?.name).join(", ")} is not marked clean yet.
              </p>
            )}
            <p className="text-xs text-pos-muted">
              A bill opens for the guest with the room charge. Food, services and website orders are
              added to the same bill.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1"
                onClick={onClose}
                disabled={action.isPending}
              >
                Cancel
              </Button>
              <Button
                className="h-11 flex-1 gap-2 bg-pos-ocean text-white hover:bg-pos-ocean/90"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate(
                    arrival.reservations.map((r) => r.id),
                    {
                      onSuccess: (accountId) => {
                        toast.success(`${arrival.guest_name} is checked in`);
                        onClose();
                        if (accountId)
                          void navigate({ to: "/pos/account/$id", params: { id: accountId } });
                      },
                      onError: (e) => toast.error(posError(e)),
                    },
                  )
                }
              >
                {action.isPending ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <LogIn size={16} />
                )}{" "}
                Check in
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
