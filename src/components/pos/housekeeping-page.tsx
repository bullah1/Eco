import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  BedDouble,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Sparkles,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";
import {
  buildBoard,
  posError,
  rpc,
  shortDate,
  useBoardData,
  usePosAction,
  type BoardTile,
  type Housekeeping,
} from "@/lib/pos";
import { LoadState, PageTitle, Panel } from "./pos-shell";

type Filter = "todo" | "all" | "dirty" | "maintenance" | "clean";

const conditions = [
  ["clean", "Clean", Sparkles],
  ["dirty", "Dirty", BedDouble],
  ["maintenance", "Repair", Wrench],
] as const;

const conditionLook: Record<Housekeeping, string> = {
  clean: "bg-pos-teal-soft text-pos-ocean",
  dirty: "bg-[#f3e6cf] text-[#4d3a17]",
  maintenance: "bg-red-50 text-red-900",
};
const conditionText: Record<Housekeeping, string> = {
  clean: "Clean",
  dirty: "Needs cleaning",
  maintenance: "Out of order",
};

/** Rooms that need work first, and among those the ones a guest is about to walk into. */
function priority(t: BoardTile, today: string) {
  const arrivingSoon =
    t.state === "arriving" || (t.next?.check_in !== undefined && t.next.check_in <= today);
  if (t.unit.housekeeping === "dirty" && arrivingSoon) return 0;
  if (t.unit.housekeeping === "dirty") return 1;
  if (t.unit.housekeeping === "maintenance") return 2;
  return 3;
}

export function HousekeepingPage() {
  const board = useBoardData();
  const [filter, setFilter] = useState<Filter>("todo");
  const [busy, setBusy] = useState<string | null>(null);
  const setState = usePosAction((v: { unit: string; state: Housekeeping }) =>
    rpc(supabase.rpc("pos_set_housekeeping", { p_unit: v.unit, p_state: v.state })),
  );

  const today = board.data?.today ?? "";
  const tiles = useMemo(
    () =>
      board.data
        ? buildBoard(board.data.units, board.data.reservations, today).sort(
            (a, b) => priority(a, today) - priority(b, today),
          )
        : [],
    [board.data, today],
  );

  const n = (h: Housekeeping) => tiles.filter((t) => t.unit.housekeeping === h).length;
  const todo = tiles.filter((t) => t.unit.housekeeping !== "clean");
  const shown =
    filter === "all"
      ? tiles
      : filter === "todo"
        ? todo
        : tiles.filter((t) => t.unit.housekeeping === filter);

  const mark = (tile: BoardTile, state: Housekeeping) => {
    setBusy(tile.unit.id);
    setState.mutate(
      { unit: tile.unit.id, state },
      {
        onSuccess: () => toast.success(`${tile.unit.name}: ${conditionText[state].toLowerCase()}`),
        onError: (e) => toast.error(posError(e)),
        onSettled: () => setBusy(null),
      },
    );
  };

  const tabs: [Filter, string, number][] = [
    ["todo", "To do", todo.length],
    ["dirty", "Dirty", n("dirty")],
    ["maintenance", "Out of order", n("maintenance")],
    ["clean", "Clean", n("clean")],
    ["all", "All rooms", tiles.length],
  ];

  return (
    <>
      <PageTitle
        title="Housekeeping"
        sub="Tap a button to update a room. Dirty rooms with a guest arriving are listed first."
      />
      <LoadState
        isLoading={board.isLoading}
        error={board.error}
        retry={() => void board.refetch()}
      />

      {board.data && (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {tabs.map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors ${
                  filter === id
                    ? "border-pos-ocean bg-pos-ocean font-medium text-white"
                    : "border-pos-line bg-white text-pos-muted hover:text-pos-ink"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 text-[11px] tabular-nums ${filter === id ? "bg-white/20" : "bg-pos-ground"}`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <Panel>
              <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-pos-muted">
                <CheckCircle2 size={28} className="text-pos-teal" />
                {filter === "todo" ? "All rooms are clean. Nothing to do." : "No rooms here."}
              </p>
            </Panel>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((tile) => {
                const h = tile.unit.housekeeping;
                const guest = tile.reservation;
                const urgent = priority(tile, today) === 0;
                return (
                  <li
                    key={tile.unit.id}
                    className={`rounded-xl border bg-white p-4 ${urgent ? "border-pos-gold" : "border-pos-line"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-semibold leading-tight">{tile.unit.name}</p>
                        <p className="truncate text-xs text-pos-muted">{tile.unit.type_name}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${conditionLook[h]}`}
                      >
                        {conditionText[h]}
                      </span>
                    </div>
                    <p className="mt-2 min-h-5 text-[13px] text-pos-muted">
                      {tile.state === "in_house" || tile.state === "leaving"
                        ? `Guest in room: ${guest?.guest_name || "Guest"}${tile.state === "leaving" ? " (leaving today)" : ""}`
                        : tile.state === "arriving"
                          ? `${guest?.guest_name || "Guest"} arrives today`
                          : tile.next
                            ? `Next guest: ${shortDate(tile.next.check_in)}`
                            : "No booking soon"}
                      {urgent && (
                        <span className="ml-1.5 font-medium text-pos-gold-deep">· clean first</span>
                      )}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {conditions.map(([state, label, Icon]) => {
                        const on = h === state;
                        return (
                          <button
                            key={state}
                            type="button"
                            disabled={on || busy === tile.unit.id}
                            onClick={() => mark(tile, state)}
                            className={`flex h-11 items-center justify-center gap-1.5 rounded-lg border text-[13px] transition-colors disabled:cursor-default ${
                              on
                                ? "border-pos-ocean bg-pos-ocean text-white"
                                : "border-pos-line bg-white hover:bg-pos-ground disabled:opacity-50"
                            }`}
                          >
                            <Icon size={15} strokeWidth={1.7} /> {label}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}

/* ---------- Cleaner list: one simple Bangla page for the cleaning staff ---------- */

export function CleanerList() {
  const board = useBoardData();
  const [busy, setBusy] = useState<string | null>(null);
  const setState = usePosAction((v: { unit: string; state: Housekeeping }) =>
    rpc(supabase.rpc("pos_set_housekeeping", { p_unit: v.unit, p_state: v.state })),
  );
  const today = board.data?.today ?? "";
  const tiles = useMemo(
    () =>
      board.data
        ? buildBoard(board.data.units, board.data.reservations, today).sort(
            (a, b) => priority(a, today) - priority(b, today),
          )
        : [],
    [board.data, today],
  );

  const now = tiles.filter(
    (t) => t.unit.housekeeping === "dirty" && t.state !== "in_house" && t.state !== "leaving",
  );
  const later = tiles.filter((t) => t.state === "leaving");
  const repair = tiles.filter((t) => t.unit.housekeeping === "maintenance");

  const done = (tile: BoardTile) => {
    setBusy(tile.unit.id);
    setState.mutate(
      { unit: tile.unit.id, state: "clean" },
      {
        onSuccess: () => toast.success(`${tile.unit.name} পরিষ্কার হয়েছে ✓`),
        onError: (e) => toast.error(posError(e)),
        onSettled: () => setBusy(null),
      },
    );
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="পরিষ্কারের তালিকা" sub="রুম পরিষ্কার শেষ হলে সবুজ বাটনে চাপ দিন।" />
      <LoadState
        isLoading={board.isLoading}
        error={board.error}
        retry={() => void board.refetch()}
      />

      {board.data && (
        <div className="grid gap-6">
          <section>
            <h2 className="mb-2 text-base font-semibold">এখনই পরিষ্কার করুন ({now.length})</h2>
            {now.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl border border-pos-line bg-white p-5 text-pos-muted">
                <CheckCircle2 size={22} className="text-pos-teal" /> সব রুম পরিষ্কার আছে।
              </p>
            ) : (
              <ul className="grid gap-3">
                {now.map((tile) => {
                  const urgent = priority(tile, today) === 0;
                  return (
                    <li
                      key={tile.unit.id}
                      className={`rounded-xl border-2 bg-white p-4 ${urgent ? "border-pos-gold" : "border-pos-line"}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-3xl font-bold tracking-wide">{tile.unit.name}</p>
                        {urgent && (
                          <span className="rounded-full bg-pos-gold px-3 py-1 text-sm font-semibold text-pos-ocean">
                            আজ গেস্ট আসবে
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-pos-muted">{tile.unit.type_name}</p>
                      <button
                        type="button"
                        disabled={busy === tile.unit.id}
                        onClick={() => done(tile)}
                        className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-pos-teal text-lg font-semibold text-white transition-colors hover:bg-pos-teal/90 disabled:opacity-60"
                      >
                        {busy === tile.unit.id ? (
                          <LoaderCircle size={22} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={22} />
                        )}
                        পরিষ্কার হয়েছে
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {later.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold">
                গেস্ট চলে গেলে পরিষ্কার করবেন ({later.length})
              </h2>
              <ul className="grid grid-cols-3 gap-2">
                {later.map((t) => (
                  <li
                    key={t.unit.id}
                    className="rounded-xl border border-pos-line bg-white p-3 text-center text-xl font-bold"
                  >
                    {t.unit.name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {repair.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold">
                মেরামত চলছে, ঢুকবেন না ({repair.length})
              </h2>
              <ul className="grid grid-cols-3 gap-2">
                {repair.map((t) => (
                  <li
                    key={t.unit.id}
                    className="rounded-xl border border-dashed border-red-300 bg-red-50 p-3 text-center text-xl font-bold text-red-900"
                  >
                    {t.unit.name}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
