import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Lock, Printer, Unlock } from "lucide-react";

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
  parseTaka,
  paymentMethods,
  posError,
  rpc,
  shortDateTime,
  taka,
  usePosAction,
} from "@/lib/pos";
import {
  differenceLabel,
  emptyTotals,
  useCashDrawer,
  type Shift,
  type ShiftTotals,
} from "@/lib/pos-cash";
import { LoadState, PageTitle, Panel } from "./pos-shell";

const toneCls = { ok: "text-pos-teal", short: "text-red-700", over: "text-pos-gold-deep" };

export function CashPage() {
  const q = useCashDrawer();
  const [printShift, setPrintShift] = useState<Shift | null>(null);

  useEffect(() => {
    if (!printShift) return;
    const done = () => setPrintShift(null);
    window.addEventListener("afterprint", done, { once: true });
    const t = window.setTimeout(() => window.print(), 60);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printShift]);

  return (
    <>
      <div className="print:hidden">
        <PageTitle
          title="Cash"
          sub="One shared drawer. Every payment, from room bills and the restaurant, lands in the open shift."
        />
        <LoadState isLoading={q.isLoading} error={q.error} retry={() => void q.refetch()} />
        {q.data &&
          (q.data.shift ? (
            <OpenShift
              shift={q.data.shift}
              totals={q.data.totals ?? emptyTotals}
              movements={q.data.movements}
              onClosed={setPrintShift}
            />
          ) : (
            <OpenDrawer suggested={q.data.history[0]?.counted_cash_cents ?? 0} />
          ))}
        {q.data && <History list={q.data.history} onPrint={setPrintShift} />}
      </div>
      {printShift && <ShiftReport shift={printShift} />}
    </>
  );
}

function OpenDrawer({ suggested }: { suggested: number }) {
  const [amount, setAmount] = useState(String(suggested / 100));
  const [note, setNote] = useState("");
  useEffect(() => setAmount(String(suggested / 100)), [suggested]);
  const cents = amount.trim() === "0" ? 0 : parseTaka(amount);
  const run = usePosAction(() =>
    rpc(supabase.rpc("pos_open_shift", { p_opening_cents: cents ?? 0, p_note: note })),
  );
  return (
    <Panel className="max-w-lg">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-pos-sand text-pos-ocean">
          <Lock size={20} />
        </span>
        <div>
          <h2 className="text-lg font-semibold">The drawer is closed</h2>
          <p className="text-sm text-pos-muted">No payment can be taken until it is opened.</p>
        </div>
      </div>
      <form
        className="mt-5 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (cents === null) {
            toast.error("Enter the cash in the drawer (0 if empty)");
            return;
          }
          run.mutate(undefined, {
            onSuccess: () => toast.success("Drawer open"),
            onError: (err) => toast.error(posError(err)),
          });
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="open-cash">Cash in the drawer now (৳)</Label>
          <Input
            id="open-cash"
            inputMode="decimal"
            className="h-12 text-lg tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="text-xs text-pos-muted">
            Count it. Last shift ended with {taka(suggested)}.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="open-note">Note (optional)</Label>
          <Input
            id="open-note"
            className="h-11 text-base"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
          />
        </div>
        <Button
          type="submit"
          disabled={run.isPending}
          className="h-12 gap-2 bg-pos-ocean font-semibold text-white hover:bg-pos-ocean/90"
        >
          {run.isPending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Unlock size={16} />
          )}{" "}
          Open the drawer
        </Button>
      </form>
    </Panel>
  );
}

function OpenShift({
  shift,
  totals,
  movements,
  onClosed,
}: {
  shift: Shift;
  totals: ShiftTotals;
  movements: {
    id: string;
    kind: "in" | "out";
    amount_cents: number;
    reason: string;
    created_at: string;
  }[];
  onClosed: (s: Shift) => void;
}) {
  const [moveKind, setMoveKind] = useState<"in" | "out" | null>(null);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const countedCents = counted.trim() === "0" ? 0 : parseTaka(counted);
  const diff = countedCents === null ? null : countedCents - totals.expected_cash;
  const label = diff === null ? null : differenceLabel(diff);

  const close = usePosAction(() =>
    rpc(supabase.rpc("pos_close_shift", { p_counted_cents: countedCents ?? -1, p_note: note })),
  );

  return (
    <>
      <section
        aria-label="This shift"
        className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7"
      >
        <div className="col-span-2 rounded-xl bg-pos-ocean px-4 py-3 text-white md:col-span-1 xl:col-span-2">
          <p className="text-xs text-white/70">
            Shift {shift.shift_no} · open since {shortDateTime(shift.opened_at)}
          </p>
          <p className="mt-0.5 font-display text-[28px] tabular-nums">{taka(totals.total)}</p>
          <p className="text-xs text-white/70">
            {totals.payments} payments · rooms {taka(totals.by_source.rooms)} · restaurant{" "}
            {taka(totals.by_source.restaurant)}
          </p>
        </div>
        {paymentMethods.map((m) => (
          <div key={m.id} className="rounded-xl border border-pos-line bg-white px-4 py-3">
            <p className="text-xs text-pos-muted">{m.label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">
              {taka(totals.by_method[m.id])}
            </p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Panel
          title="Cash in the drawer"
          aside={
            <div className="flex gap-2">
              <Button variant="outline" className="h-9 gap-1.5" onClick={() => setMoveKind("out")}>
                <ArrowUpRight size={15} /> Take cash out
              </Button>
              <Button variant="outline" className="h-9 gap-1.5" onClick={() => setMoveKind("in")}>
                <ArrowDownLeft size={15} /> Put cash in
              </Button>
            </div>
          }
        >
          <dl className="grid gap-2 text-sm">
            <Line label="Opening cash" value={taka(totals.opening)} />
            <Line label="Cash taken from guests" value={`+ ${taka(totals.cash_sales)}`} />
            <Line label="Cash put in" value={`+ ${taka(totals.cash_in)}`} />
            <Line label="Cash taken out" value={`− ${taka(totals.cash_out)}`} />
            <div className="mt-1 flex items-baseline justify-between rounded-lg bg-pos-sand px-4 py-3">
              <dt className="font-medium">Should be in the drawer</dt>
              <dd className="font-display text-[30px] tabular-nums text-pos-ocean">
                {taka(totals.expected_cash)}
              </dd>
            </div>
          </dl>
          <h3 className="mb-1 mt-5 text-[14px] font-semibold">Cash in and out this shift</h3>
          {movements.length === 0 ? (
            <p className="text-sm text-pos-muted">
              None yet. Use the buttons above when you pay a supplier or put change in.
            </p>
          ) : (
            <ul className="divide-y divide-pos-line text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{m.reason}</span>
                    <span className="text-xs text-pos-muted">{shortDateTime(m.created_at)}</span>
                  </span>
                  <span
                    className={`shrink-0 font-medium tabular-nums ${m.kind === "out" ? "text-red-700" : "text-pos-teal"}`}
                  >
                    {m.kind === "out" ? "−" : "+"} {taka(m.amount_cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Close the shift">
          <p className="text-sm text-pos-muted">
            Count the cash in the drawer and enter it. bKash, Nagad and card are counted for you.
          </p>
          <div className="mt-3 grid gap-1.5">
            <Label htmlFor="counted">Cash counted (৳)</Label>
            <Input
              id="counted"
              inputMode="decimal"
              className="h-12 text-lg tabular-nums"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
            />
          </div>
          {label && (
            <p className={`mt-2 text-sm font-semibold ${toneCls[label.tone]}`}>
              {label.text}
              {diff !== 0 && (
                <span className="font-normal text-pos-muted">
                  {" "}
                  · expected {taka(totals.expected_cash)}
                </span>
              )}
            </p>
          )}
          <div className="mt-3 grid gap-1.5">
            <Label htmlFor="close-note">
              Note {diff ? "(needed when the cash doesn't match)" : "(optional)"}
            </Label>
            <Input
              id="close-note"
              className="h-11 text-base"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </div>
          <Button
            disabled={countedCents === null || (Boolean(diff) && note.trim().length < 3)}
            onClick={() => setConfirm(true)}
            className="mt-4 h-12 w-full gap-2 bg-pos-gold font-semibold text-pos-ocean hover:bg-pos-gold/85"
          >
            <Lock size={16} /> Close shift
          </Button>
        </Panel>
      </div>

      <MoveDialog kind={moveKind} onClose={() => setMoveKind(null)} />
      <Dialog open={confirm} onOpenChange={(o) => !close.isPending && setConfirm(o)}>
        <DialogContent className="font-sans sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Close shift {shift.shift_no}?</DialogTitle>
            <DialogDescription>
              Counted {taka(countedCents ?? 0)} · {label?.text}. After closing, no payment can be
              taken until someone opens the drawer again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setConfirm(false)}>
              Not yet
            </Button>
            <Button
              className="h-11 flex-1 bg-pos-ocean text-white hover:bg-pos-ocean/90"
              disabled={close.isPending}
              onClick={() =>
                close.mutate(undefined, {
                  onSuccess: (res) => {
                    const r = res as unknown as ShiftTotals & {
                      counted: number;
                      difference: number;
                    };
                    toast.success(`Shift ${shift.shift_no} closed`);
                    setConfirm(false);
                    onClosed({
                      ...shift,
                      status: "closed",
                      closed_at: new Date().toISOString(),
                      expected_cash_cents: r.expected_cash,
                      counted_cash_cents: r.counted,
                      difference_cents: r.difference,
                      close_note: note,
                      summary: r,
                    });
                  },
                  onError: (e) => toast.error(posError(e)),
                })
              }
            >
              {close.isPending ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                "Close and print"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-pos-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function MoveDialog({ kind, onClose }: { kind: "in" | "out" | null; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    setAmount("");
    setReason("");
  }, [kind]);
  const cents = parseTaka(amount);
  const run = usePosAction(() =>
    rpc(
      supabase.rpc("pos_cash_movement", {
        p_kind: kind!,
        p_amount_cents: cents!,
        p_reason: reason,
      }),
    ),
  );
  return (
    <Dialog open={Boolean(kind)} onOpenChange={(o) => !o && !run.isPending && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{kind === "out" ? "Take cash out" : "Put cash in"}</DialogTitle>
          <DialogDescription>
            {kind === "out"
              ? "For example paying for fish, gas or ice."
              : "For example change brought from the bank."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="mv-amount">Amount (৳)</Label>
          <Input
            id="mv-amount"
            inputMode="decimal"
            className="h-11 text-base tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mv-reason">What for</Label>
          <Input
            id="mv-reason"
            className="h-11 text-base"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />
        </div>
        <Button
          className="h-11 bg-pos-ocean text-white hover:bg-pos-ocean/90"
          disabled={!cents || reason.trim().length < 3 || run.isPending}
          onClick={() =>
            run.mutate(undefined, {
              onSuccess: () => {
                toast.success(`${taka(cents!)} ${kind === "out" ? "taken out" : "put in"}`);
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

function History({ list, onPrint }: { list: Shift[]; onPrint: (s: Shift) => void }) {
  if (list.length === 0) return null;
  return (
    <Panel title="Past shifts" className="mt-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-pos-muted">
              <th className="border-b border-pos-line py-2 pr-2 font-medium">Shift</th>
              <th className="border-b border-pos-line px-2 py-2 font-medium">Closed</th>
              <th className="border-b border-pos-line px-2 py-2 text-right font-medium">Taken</th>
              <th className="border-b border-pos-line px-2 py-2 text-right font-medium">
                Cash expected
              </th>
              <th className="border-b border-pos-line px-2 py-2 text-right font-medium">Counted</th>
              <th className="border-b border-pos-line px-2 py-2 font-medium">Difference</th>
              <th className="w-10 border-b border-pos-line" aria-label="Print" />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const d = differenceLabel(s.difference_cents ?? 0);
              return (
                <tr key={s.id}>
                  <td className="border-b border-pos-line/70 py-2.5 pr-2 font-medium">
                    {s.shift_no}
                  </td>
                  <td className="border-b border-pos-line/70 px-2 py-2.5 text-pos-muted">
                    {s.closed_at ? shortDateTime(s.closed_at) : ""}
                  </td>
                  <td className="border-b border-pos-line/70 px-2 py-2.5 text-right tabular-nums">
                    {taka(s.summary?.total)}
                  </td>
                  <td className="border-b border-pos-line/70 px-2 py-2.5 text-right tabular-nums">
                    {taka(s.expected_cash_cents)}
                  </td>
                  <td className="border-b border-pos-line/70 px-2 py-2.5 text-right tabular-nums">
                    {taka(s.counted_cash_cents)}
                  </td>
                  <td className="border-b border-pos-line/70 px-2 py-2.5">
                    <span className={`font-medium ${toneCls[d.tone]}`}>{d.text}</span>
                    {s.close_note && (
                      <span className="block text-xs text-pos-muted">{s.close_note}</span>
                    )}
                  </td>
                  <td className="border-b border-pos-line/70 text-right">
                    <button
                      type="button"
                      aria-label={`Print ${s.shift_no}`}
                      onClick={() => onPrint(s)}
                      className="grid size-8 place-items-center rounded-md text-pos-muted hover:bg-pos-ground"
                    >
                      <Printer size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ShiftReport({ shift }: { shift: Shift }) {
  const t = { ...emptyTotals, ...(shift.summary ?? {}) };
  const d = differenceLabel(shift.difference_cents ?? 0);
  const row = (label: string, value: string, bold = false) => (
    <p className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
  return (
    <article className="hidden w-[72mm] font-sans text-[12px] text-black print:block">
      <p className="text-center font-display text-[16px] tracking-[0.08em]">SANTA MONICA</p>
      <p className="text-center">Cash close · Shift {shift.shift_no}</p>
      <p className="text-center">
        {shortDateTime(shift.opened_at)} – {shift.closed_at ? shortDateTime(shift.closed_at) : ""}
      </p>
      <hr className="my-2 border-black" />
      {paymentMethods.map((m) => (
        <div key={m.id}>{row(m.label, taka(t.by_method[m.id]))}</div>
      ))}
      {row("Total taken", taka(t.total), true)}
      {row("  Rooms", taka(t.by_source.rooms))}
      {row("  Restaurant", taka(t.by_source.restaurant))}
      <hr className="my-2 border-black" />
      {row("Opening cash", taka(t.opening))}
      {row("Cash from guests", `+ ${taka(t.cash_sales)}`)}
      {row("Cash put in", `+ ${taka(t.cash_in)}`)}
      {row("Cash taken out", `− ${taka(t.cash_out)}`)}
      {row("Expected", taka(shift.expected_cash_cents), true)}
      {row("Counted", taka(shift.counted_cash_cents), true)}
      {row("Difference", d.text, true)}
      {shift.close_note && <p className="mt-1">Note: {shift.close_note}</p>}
      <p className="mt-6">Signature: ____________________</p>
    </article>
  );
}
