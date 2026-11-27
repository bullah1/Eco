import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  addDays,
  parseTaka,
  posError,
  resortToday,
  rpc,
  shortDate,
  taka,
  usePosAction,
} from "@/lib/pos";
import {
  isoWeekday,
  nightPrice,
  useRateRules,
  weekdayNames,
  type RateRule,
} from "@/lib/pos-extras";
import { LoadState, PageTitle, Panel, SetupNotice, usePos } from "./pos-shell";

type RoomType = { id: string; name: string; nightly_rate_cents: number };

function describeRule(r: RateRule, types: RoomType[]) {
  const who = r.room_type_id
    ? (types.find((t) => t.id === r.room_type_id)?.name ?? "One room type")
    : "All rooms";
  const when = [
    r.start_date || r.end_date
      ? `${r.start_date ? shortDate(r.start_date) : "…"} – ${r.end_date ? shortDate(r.end_date) : "…"}`
      : "",
    r.weekdays?.length ? r.weekdays.map((d) => weekdayNames[d - 1]).join(", ") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const change =
    r.kind === "fixed" ? `${taka(r.value)} a night` : `${r.value > 0 ? "+" : ""}${r.value}%`;
  return { who, when, change };
}

export function PricesPage() {
  const { isAdmin } = usePos();
  const q = useRateRules();
  const [editing, setEditing] = useState<RateRule | "new" | null>(null);
  const today = resortToday();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);
  const types = (q.data?.types ?? []) as RoomType[];
  const rules = q.data?.rules ?? [];

  return (
    <>
      <PageTitle
        title="Room prices"
        sub="Normal prices are set in the admin panel. Here you add season, holiday and weekend prices."
        actions={
          isAdmin && (
            <Button
              onClick={() => setEditing("new")}
              disabled={q.data?.notSetUp}
              className="h-11 gap-2 bg-pos-gold px-5 font-semibold text-pos-ocean hover:bg-pos-gold/85"
            >
              <Plus size={18} /> New price
            </Button>
          )
        }
      />
      <LoadState isLoading={q.isLoading} error={q.error} retry={() => void q.refetch()} />
      {q.data?.notSetUp && <SetupNotice />}

      {q.data && !q.data.notSetUp && (
        <div className="grid gap-5">
          <Panel title="Price rules">
            {rules.length === 0 ? (
              <p className="text-sm text-pos-muted">
                No special prices yet. Every night costs the normal price. Example: “Weekend +20% on
                Friday and Saturday”, or “Winter season 15 Dec – 15 Jan +30%”.
              </p>
            ) : (
              <ul className="divide-y divide-pos-line">
                {rules.map((r) => {
                  const d = describeRule(r, types);
                  return (
                    <li
                      key={r.id}
                      className={`flex items-center justify-between gap-3 py-3 ${r.is_active ? "" : "opacity-55"}`}
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{r.name}</span>
                        {!r.is_active && <span className="ml-2 text-xs text-pos-muted">(off)</span>}
                        <span className="block text-xs text-pos-muted">
                          {d.who} · {d.when}
                          {r.priority ? ` · priority ${r.priority}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                            r.kind === "percent" && r.value < 0
                              ? "bg-pos-teal-soft text-pos-ocean"
                              : "bg-[#f3e6cf] text-[#4d3a17]"
                          }`}
                        >
                          {d.change}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            aria-label={`Edit ${r.name}`}
                            onClick={() => setEditing(r)}
                            className="grid size-9 place-items-center rounded-md text-pos-muted hover:bg-pos-ground"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Next 14 nights">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium text-pos-muted">
                      Room type
                    </th>
                    {days.map((d) => (
                      <th
                        key={d}
                        className={`px-1 py-2 text-center font-medium ${[5, 6].includes(isoWeekday(d)) ? "text-pos-gold-deep" : "text-pos-muted"}`}
                      >
                        {weekdayNames[isoWeekday(d) - 1]}
                        <span className="block font-normal">{shortDate(d)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <tr key={t.id} className="border-t border-pos-line">
                      <td className="sticky left-0 bg-white py-2 pr-3 font-medium">
                        {t.name}
                        <span className="block text-[11px] font-normal text-pos-muted">
                          normal {taka(t.nightly_rate_cents)}
                        </span>
                      </td>
                      {days.map((d) => {
                        const p = nightPrice(rules, t.id, t.nightly_rate_cents, d);
                        const diff = p.cents - t.nightly_rate_cents;
                        return (
                          <td
                            key={d}
                            title={p.rule ? p.rule.name : "Normal price"}
                            className={`px-1 py-2 text-center tabular-nums ${diff > 0 ? "bg-[#fbf6ec] font-medium text-[#4d3a17]" : diff < 0 ? "bg-pos-teal-soft font-medium text-pos-ocean" : ""}`}
                          >
                            {Math.round(p.cents / 100).toLocaleString("en-IN")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-pos-muted">
              New bookings use these prices. Bookings already made keep the price they were made at,
              unless the stay is changed.
            </p>
          </Panel>
        </div>
      )}

      {isAdmin && <RuleDialog rule={editing} types={types} onClose={() => setEditing(null)} />}
    </>
  );
}

function RuleDialog({
  rule,
  types,
  onClose,
}: {
  rule: RateRule | "new" | null;
  types: RoomType[];
  onClose: () => void;
}) {
  const existing = rule && rule !== "new" ? rule : null;
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [priority, setPriority] = useState("0");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!rule) return;
    setName(existing?.name ?? "");
    setTypeId(existing?.room_type_id ?? "");
    setStart(existing?.start_date ?? "");
    setEnd(existing?.end_date ?? "");
    setDays(existing?.weekdays ?? []);
    setKind(existing?.kind ?? "percent");
    setValue(
      existing
        ? existing.kind === "fixed"
          ? String(existing.value / 100)
          : String(existing.value)
        : "",
    );
    setPriority(String(existing?.priority ?? 0));
    setActive(existing?.is_active ?? true);
  }, [rule, existing]);

  const percent = Number(value);
  const fixedCents = kind === "fixed" ? parseTaka(value) : null;
  const valueOk =
    kind === "percent"
      ? Number.isInteger(percent) && percent !== 0 && percent >= -90 && percent <= 500
      : fixedCents !== null;
  const whenOk = Boolean(start || end || days.length);
  const datesOk = !start || !end || end >= start;

  const save = usePosAction(() =>
    rpc(
      supabase.rpc("pos_save_rate_rule", {
        p_id: existing?.id ?? null,
        p_name: name.trim(),
        p_room_type: typeId || null,
        p_start: start || null,
        p_end: end || null,
        p_weekdays: days.length ? [...days].sort() : null,
        p_kind: kind,
        p_value: kind === "fixed" ? fixedCents! : percent,
        p_priority: Number(priority) || 0,
        p_active: active,
      }),
    ),
  );
  const remove = usePosAction(() =>
    rpc(supabase.rpc("pos_delete_rate_rule", { p_id: existing!.id })),
  );
  const busy = save.isPending || remove.isPending;

  const chip = (on: boolean) =>
    `h-9 rounded-full border px-3.5 text-sm ${on ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line bg-white"}`;

  return (
    <Dialog open={Boolean(rule)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto font-sans sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit price" : "New price"}</DialogTitle>
          <DialogDescription>
            Choose dates, weekdays, or both. The price changes only on matching nights.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="rr-name">Name</Label>
          <Input
            id="rr-name"
            className="h-11 text-base sm:text-sm"
            placeholder="Weekend, Winter season, Eid holiday…"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Rooms</Label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(typeId === "")} onClick={() => setTypeId("")}>
              All rooms
            </button>
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                className={chip(typeId === t.id)}
                onClick={() => setTypeId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rr-start">From (optional)</Label>
            <Input
              id="rr-start"
              type="date"
              className="h-11 text-base sm:text-sm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rr-end">To (optional)</Label>
            <Input
              id="rr-end"
              type="date"
              className="h-11 text-base sm:text-sm"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Only on (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {weekdayNames.map((d, i) => {
              const n = i + 1;
              const on = days.includes(n);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  className={chip(on)}
                  onClick={() => setDays((s) => (on ? s.filter((x) => x !== n) : [...s, n]))}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="justify-self-start text-xs text-pos-teal underline"
            onClick={() => setDays([5, 6])}
          >
            Fri + Sat (weekend)
          </button>
        </div>
        <div className="grid gap-1.5">
          <Label>Price change</Label>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={chip(kind === "percent")}
              onClick={() => setKind("percent")}
            >
              By percent
            </button>
            <button
              type="button"
              className={chip(kind === "fixed")}
              onClick={() => setKind("fixed")}
            >
              Set the price
            </button>
          </div>
          <Input
            inputMode={kind === "percent" ? "numeric" : "decimal"}
            className="h-11 text-base tabular-nums"
            placeholder={
              kind === "percent"
                ? "20 for 20% more, -10 for 10% less"
                : "Nightly price in ৳, e.g. 8000"
            }
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rr-prio">Priority</Label>
            <Input
              id="rr-prio"
              inputMode="numeric"
              className="h-11 text-base tabular-nums"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </div>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}
            Switched on
          </label>
        </div>
        <p className="-mt-1 text-xs text-pos-muted">
          When two prices fall on the same night, the higher priority wins (e.g. Eid 10 beats
          weekend 0).
        </p>
        {!datesOk && (
          <p className="text-sm text-red-700">The end date must be on or after the start date.</p>
        )}
        <div className="flex gap-2">
          {existing && (
            <Button
              variant="outline"
              className="h-11 gap-2 text-red-700 hover:bg-red-50"
              disabled={busy}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Price removed");
                    onClose();
                  },
                  onError: (e) => toast.error(posError(e)),
                })
              }
            >
              <Trash2 size={16} /> Delete
            </Button>
          )}
          <Button
            className="h-11 flex-1 bg-pos-ocean text-white hover:bg-pos-ocean/90"
            disabled={busy || name.trim().length < 2 || !valueOk || !whenOk || !datesOk}
            onClick={() =>
              save.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`${name.trim()} saved`);
                  onClose();
                },
                onError: (e) => toast.error(posError(e)),
              })
            }
          >
            {save.isPending && <LoaderCircle size={16} className="animate-spin" />}
            Save
          </Button>
        </div>
        {!whenOk && <p className="text-xs text-pos-muted">Pick dates or weekdays.</p>}
      </DialogContent>
    </Dialog>
  );
}
