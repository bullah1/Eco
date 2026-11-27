import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCheck, LoaderCircle, Minus, Pencil, Plus } from "lucide-react";

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
import { parseTaka, posError, rpc, shortDateTime, taka, usePosAction } from "@/lib/pos";
import { useDrawerOpen } from "@/lib/pos-cash";
import { isLow, qty, useStock, type StockItem } from "@/lib/pos-extras";
import { LoadState, PageTitle, Panel, SetupNotice } from "./pos-shell";

type MoveKind = "in" | "out" | "count";
const moveText: Record<MoveKind, { title: string; verb: string; label: string }> = {
  in: { title: "Received", verb: "received", label: "How much came in?" },
  out: { title: "Used", verb: "used", label: "How much was used or thrown away?" },
  count: { title: "Count", verb: "counted", label: "How much is in the store now?" },
};

export function StockPage() {
  const stock = useStock();
  const [editing, setEditing] = useState<StockItem | "new" | null>(null);
  const [moving, setMoving] = useState<{ item: StockItem; kind: MoveKind } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(
    () =>
      (stock.data?.items ?? [])
        .filter((i) => showAll || i.is_active)
        .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name)),
    [stock.data, showAll],
  );
  const low = (stock.data?.items ?? []).filter((i) => i.is_active && isLow(i));
  const nameOf = (id: string) => stock.data?.items.find((i) => i.id === id);

  return (
    <>
      <PageTitle
        title="Kitchen stock"
        sub="Fish, rice, oil and everything else in the store. Items at or below the alert level are shown in red."
        actions={
          <Button
            onClick={() => setEditing("new")}
            disabled={stock.data?.notSetUp}
            className="h-11 gap-2 bg-pos-gold px-5 font-semibold text-pos-ocean hover:bg-pos-gold/85"
          >
            <Plus size={18} /> New item
          </Button>
        }
      />
      <LoadState
        isLoading={stock.isLoading}
        error={stock.error}
        retry={() => void stock.refetch()}
      />
      {stock.data?.notSetUp && <SetupNotice />}

      {stock.data && !stock.data.notSetUp && (
        <div className="grid gap-5">
          {low.length > 0 && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">Running low: </span>
                {low.map((i) => `${i.name} (${qty(i.quantity)} ${i.unit})`).join(", ")}. Buy more
                soon.
              </span>
            </p>
          )}

          {items.length === 0 ? (
            <Panel>
              <p className="py-6 text-center text-sm text-pos-muted">
                No items yet. Add fish, rice, oil, onions… with “New item”.
              </p>
            </Panel>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((i) => {
                const lowNow = isLow(i);
                return (
                  <li
                    key={i.id}
                    className={`rounded-xl border bg-white p-4 ${lowNow ? "border-red-300" : "border-pos-line"} ${i.is_active ? "" : "opacity-60"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{i.name}</p>
                        <p className="text-xs text-pos-muted">
                          Alert at {qty(i.min_quantity)} {i.unit}
                          {!i.is_active && " · not in use"}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Edit ${i.name}`}
                        onClick={() => setEditing(i)}
                        className="grid size-8 place-items-center rounded-md text-pos-muted hover:bg-pos-ground"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                    <p
                      className={`mt-2 text-3xl font-semibold tabular-nums ${lowNow ? "text-red-700" : ""}`}
                    >
                      {qty(i.quantity)}{" "}
                      <span className="text-base font-normal text-pos-muted">{i.unit}</span>
                    </p>
                    {lowNow && <p className="text-xs font-medium text-red-700">Low. Buy more.</p>}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        className="h-11 gap-1 px-2"
                        onClick={() => setMoving({ item: i, kind: "in" })}
                      >
                        <Plus size={15} /> Got
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 gap-1 px-2"
                        onClick={() => setMoving({ item: i, kind: "out" })}
                      >
                        <Minus size={15} /> Used
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 gap-1 px-2"
                        onClick={() => setMoving({ item: i, kind: "count" })}
                      >
                        <ClipboardCheck size={15} /> Count
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {(stock.data.items.some((i) => !i.is_active) || showAll) && (
            <label className="flex items-center gap-2 text-xs text-pos-muted">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />{" "}
              Show items not in use
            </label>
          )}

          {stock.data.moves.length > 0 && (
            <Panel title="Latest changes">
              <ul className="divide-y divide-pos-line text-sm">
                {stock.data.moves.slice(0, 20).map((m) => {
                  const it = nameOf(m.item_id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="font-medium">{it?.name ?? "Item"}</span>{" "}
                        <span className="text-pos-muted">
                          {moveText[m.kind].verb}
                          {m.note ? ` · ${m.note}` : ""} · {shortDateTime(m.created_at)}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${m.change < 0 ? "text-red-700" : "text-pos-teal"}`}
                      >
                        {m.change > 0 ? "+" : ""}
                        {qty(m.change)} → {qty(m.quantity_after)} {it?.unit}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <ItemDialog item={editing} onClose={() => setEditing(null)} />
      <MoveDialog target={moving} onClose={() => setMoving(null)} />
    </>
  );
}

function ItemDialog({ item, onClose }: { item: StockItem | "new" | null; onClose: () => void }) {
  const existing = item && item !== "new" ? item : null;
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [min, setMin] = useState("");
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (!item) return;
    setName(existing?.name ?? "");
    setUnit(existing?.unit ?? "kg");
    setMin(existing ? qty(existing.min_quantity) : "");
    setActive(existing?.is_active ?? true);
  }, [item, existing]);
  const minNum = min.trim() === "" ? 0 : Number(min);
  const run = usePosAction(() =>
    rpc(
      supabase.rpc("pos_save_stock_item", {
        p_id: existing?.id ?? null,
        p_name: name.trim(),
        p_unit: unit.trim(),
        p_min_quantity: minNum,
        p_active: active,
      }),
    ),
  );
  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && !run.isPending && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : "New stock item"}</DialogTitle>
          <DialogDescription>
            Set the alert level to get a warning when it runs low.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="st-name">Name</Label>
          <Input
            id="st-name"
            className="h-11 text-base sm:text-sm"
            placeholder="Rice, Rupchanda fish, Soybean oil…"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Unit</Label>
          <div className="flex flex-wrap gap-1.5">
            {["kg", "litre", "pcs", "packet", "dozen", "bottle"].map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => setUnit(u)}
                className={`h-9 rounded-full border px-3.5 text-sm ${unit === u ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line bg-white"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="st-min">Warn me when it is at or below ({unit})</Label>
          <Input
            id="st-min"
            inputMode="decimal"
            className="h-11 text-base tabular-nums"
            placeholder="5"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </div>
        {existing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}
            In use
          </label>
        )}
        <Button
          className="h-11 bg-pos-ocean text-white hover:bg-pos-ocean/90"
          disabled={
            name.trim().length < 1 || !Number.isFinite(minNum) || minNum < 0 || run.isPending
          }
          onClick={() =>
            run.mutate(undefined, {
              onSuccess: () => {
                toast.success(`${name.trim()} saved`);
                onClose();
              },
              onError: (e) => toast.error(posError(e)),
            })
          }
        >
          Save
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  target,
  onClose,
}: {
  target: { item: StockItem; kind: MoveKind } | null;
  onClose: () => void;
}) {
  const drawer = useDrawerOpen(Boolean(target));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [fromDrawer, setFromDrawer] = useState(true);
  useEffect(() => {
    setAmount("");
    setNote("");
    setCost("");
    setFromDrawer(true);
  }, [target]);

  const n = Number(amount.replace(",", "."));
  const valid =
    amount.trim() !== "" && Number.isFinite(n) && (target?.kind === "count" ? n >= 0 : n > 0);
  const costCents = cost.trim() ? parseTaka(cost) : null;
  const costBad = cost.trim() !== "" && costCents === null;
  const after =
    !target || !valid
      ? null
      : target.kind === "in"
        ? target.item.quantity + n
        : target.kind === "out"
          ? target.item.quantity - n
          : n;

  const run = usePosAction(() =>
    rpc(
      supabase.rpc("pos_stock_move", {
        p_item: target!.item.id,
        p_kind: target!.kind,
        p_quantity: n,
        p_note: note.trim(),
        p_cost_cents: target!.kind === "in" ? costCents : null,
        p_method: "cash",
        p_from_drawer:
          target!.kind === "in" && costCents !== null && fromDrawer && drawer.data === true,
      }),
    ),
  );

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && !run.isPending && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>
                {moveText[target.kind].title}: {target.item.name}
              </DialogTitle>
              <DialogDescription>
                In store now: {qty(target.item.quantity)} {target.item.unit}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="mv-qty">
                {moveText[target.kind].label} ({target.item.unit})
              </Label>
              <Input
                id="mv-qty"
                autoFocus
                inputMode="decimal"
                className="h-12 text-lg tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {after !== null && (
                <p className={`text-sm ${after < 0 ? "text-red-700" : "text-pos-muted"}`}>
                  {after < 0
                    ? "That is more than what is in stock."
                    : `After this: ${qty(Math.round(after * 1000) / 1000)} ${target.item.unit}`}
                </p>
              )}
            </div>
            {target.kind === "in" && (
              <div className="grid gap-1.5">
                <Label htmlFor="mv-cost">What did it cost? (৳, optional)</Label>
                <Input
                  id="mv-cost"
                  inputMode="decimal"
                  className="h-11 text-base tabular-nums"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
                {costCents !== null && (
                  <>
                    <p className="text-xs text-pos-muted">Saved as a Market expense too.</p>
                    {drawer.data && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={fromDrawer}
                          onChange={(e) => setFromDrawer(e.target.checked)}
                        />{" "}
                        Paid from the cash drawer
                      </label>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="mv-note">Note (optional)</Label>
              <Input
                id="mv-note"
                className="h-11 text-base sm:text-sm"
                placeholder={
                  target.kind === "out"
                    ? "Lunch, spoiled…"
                    : target.kind === "in"
                      ? "From Teknaf market"
                      : "Weekly count"
                }
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button
              className="h-12 bg-pos-ocean text-white hover:bg-pos-ocean/90"
              disabled={!valid || costBad || (after !== null && after < 0) || run.isPending}
              onClick={() =>
                run.mutate(undefined, {
                  onSuccess: (left) => {
                    toast.success(
                      `${target.item.name}: ${qty(left as number)} ${target.item.unit} in stock${costCents ? ` · expense ${taka(costCents)}` : ""}`,
                    );
                    onClose();
                  },
                  onError: (e) => toast.error(posError(e)),
                })
              }
            >
              {run.isPending && <LoaderCircle size={16} className="animate-spin" />}
              Save
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
