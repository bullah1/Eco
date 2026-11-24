import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LoaderCircle, Minus, Plus, Search } from "lucide-react";

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
import { parseTaka, posError, rpc, taka, useCatalog, usePosAction } from "@/lib/pos";

type Tab = "services" | "food" | "other";

function Qty({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-pos-line bg-white">
      <button
        type="button"
        aria-label="Fewer"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className="grid size-10 place-items-center disabled:opacity-30"
      >
        <Minus size={15} />
      </button>
      <span className="w-7 text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="More"
        disabled={value >= 99}
        onClick={() => onChange(value + 1)}
        className="grid size-10 place-items-center disabled:opacity-30"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export function AddChargeDialog({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const catalog = useCatalog(open);
  const [tab, setTab] = useState<Tab>("services");
  const [picked, setPicked] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [search, setSearch] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<"service" | "food" | "other">("service");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    setPicked(null);
    setQty(1);
    setProblem("");
  }, [tab, open]);
  useEffect(() => {
    if (!open) {
      setSearch("");
      setDesc("");
      setPrice("");
    }
  }, [open]);

  const services = catalog.data?.services ?? [];
  const menu = useMemo(() => {
    const all = catalog.data?.menu ?? [];
    const q = search.trim().toLowerCase();
    return q
      ? all.filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
      : all;
  }, [catalog.data, search]);

  const chosen =
    tab === "services"
      ? services.find((s) => s.id === picked)
      : tab === "food"
        ? (catalog.data?.menu ?? []).find((m) => m.id === picked)
        : null;
  const customCents = parseTaka(price);
  const lineTotal = tab === "other" ? (customCents ?? 0) * qty : (chosen?.price_cents ?? 0) * qty;

  const add = usePosAction(async () => {
    if (tab === "services")
      return rpc(
        supabase.rpc("pos_add_service", {
          p_account: accountId,
          p_addon_id: picked!,
          p_quantity: qty,
        }),
      );
    if (tab === "food")
      return rpc(
        supabase.rpc("pos_add_menu_item", {
          p_account: accountId,
          p_menu_item: picked!,
          p_quantity: qty,
        }),
      );
    return rpc(
      supabase.rpc("pos_add_charge", {
        p_account: accountId,
        p_kind: kind,
        p_description: desc.trim(),
        p_quantity: qty,
        p_unit_price_cents: customCents!,
      }),
    );
  });

  function submit() {
    setProblem("");
    if (tab !== "other" && !chosen)
      return setProblem(tab === "services" ? "Choose a service" : "Choose a dish");
    if (tab === "other" && desc.trim().length === 0) return setProblem("Describe what this is for");
    if (tab === "other" && !customCents) return setProblem("Enter a price above zero");
    const label = tab === "other" ? desc.trim() : chosen!.name;
    add.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${label} × ${qty} added · ${taka(lineTotal)}`);
        setPicked(null);
        setQty(1);
        setDesc("");
        setPrice("");
      },
      onError: (e) => setProblem(posError(e)),
    });
  }

  const card = (on: boolean) =>
    `flex min-h-[68px] flex-col justify-between rounded-lg border p-3 text-left transition-colors ${
      on
        ? "border-pos-ocean bg-pos-ocean text-white"
        : "border-pos-line bg-white hover:bg-pos-ground"
    }`;

  return (
    <Dialog open={open} onOpenChange={(o) => !add.isPending && onOpenChange(o)}>
      <DialogContent className="flex max-h-[92svh] flex-col font-sans sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add to bill</DialogTitle>
          <DialogDescription>
            It goes on this guest's bill. They pay everything together at check-out.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-1 rounded-lg bg-pos-ground p-1" role="tablist">
          {(
            [
              ["services", "Services"],
              ["food", "Food and drinks"],
              ["other", "Other"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`h-10 rounded-md text-[13px] font-medium ${tab === t ? "bg-white text-pos-ink shadow-sm" : "text-pos-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {catalog.isLoading && (
            <p className="flex items-center gap-2 text-sm text-pos-muted">
              <LoaderCircle size={14} className="animate-spin" /> Loading
            </p>
          )}
          {catalog.isError && <p className="text-sm text-red-700">{posError(catalog.error)}</p>}

          {tab === "services" &&
            catalog.data &&
            (services.length === 0 ? (
              <p className="text-sm text-pos-muted">
                No services yet. Add them in the admin panel under Services.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={picked === s.id}
                    onClick={() => setPicked(s.id)}
                    className={card(picked === s.id)}
                  >
                    <span className="text-[13px] font-medium leading-snug">{s.name}</span>
                    <span className="mt-1 text-[13px] font-semibold tabular-nums">
                      {taka(s.price_cents)}
                    </span>
                  </button>
                ))}
              </div>
            ))}

          {tab === "food" && catalog.data && (
            <>
              <label className="mb-3 flex h-11 items-center gap-2 rounded-lg border border-pos-line px-3 text-pos-muted">
                <Search size={16} />
                <input
                  aria-label="Search the menu"
                  placeholder="Search dishes"
                  className="min-w-0 flex-1 bg-transparent text-base text-pos-ink outline-none sm:text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {menu.length === 0 ? (
                <p className="text-sm text-pos-muted">No dishes match.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {menu.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={picked === m.id}
                      onClick={() => setPicked(m.id)}
                      className={card(picked === m.id)}
                    >
                      <span className="text-[13px] font-medium leading-snug">{m.name}</span>
                      <span className="mt-1 flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="font-semibold tabular-nums">{taka(m.price_cents)}</span>
                        <span
                          className={`truncate text-[11px] ${picked === m.id ? "text-white/75" : "text-pos-muted"}`}
                        >
                          {m.category}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "other" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="oc-desc">What is it for?</Label>
                <Input
                  id="oc-desc"
                  className="h-11 text-base sm:text-sm"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Extra mattress, broken glass"
                  maxLength={200}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="oc-price">Price each (৳)</Label>
                <Input
                  id="oc-price"
                  inputMode="decimal"
                  className="h-11 text-base tabular-nums sm:text-sm"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Type</legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["service", "food", "other"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={kind === k}
                      onClick={() => setKind(k)}
                      className={`h-11 rounded-lg text-[13px] capitalize ${kind === k ? "bg-pos-ocean text-white" : "border border-pos-line"}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </div>

        {problem && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pos-line pt-4">
          <div className="flex items-center gap-3">
            <Qty value={qty} onChange={setQty} />
            <span className="text-lg font-semibold tabular-nums">{taka(lineTotal)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
              Done
            </Button>
            <Button
              onClick={submit}
              disabled={add.isPending}
              className="h-11 gap-2 bg-pos-ocean px-5 text-white hover:bg-pos-ocean/90"
            >
              {add.isPending ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}{" "}
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
