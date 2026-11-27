import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, LoaderCircle, Plus, X } from "lucide-react";

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
  paymentMethods,
  posError,
  resortToday,
  rpc,
  shortDate,
  taka,
  usePosAction,
  type PaymentMethod,
} from "@/lib/pos";
import { useDrawerOpen } from "@/lib/pos-cash";
import {
  categoryLabel,
  expenseCategories,
  useExpenses,
  type Expense,
  type ExpenseCategory,
} from "@/lib/pos-extras";
import { useReportRows } from "@/lib/pos-reports";
import { LoadState, PageTitle, Panel, SetupNotice, usePos } from "./pos-shell";

/** First day of the month that is `offset` months from the month of `date`. */
function monthStart(date: string, offset = 0) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}
const monthTitle = (start: string) =>
  new Date(`${start}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export function ExpensesPage() {
  const { isAdmin } = usePos();
  const today = resortToday();
  const [offset, setOffset] = useState(0);
  const from = monthStart(today, offset);
  const nextMonth = monthStart(today, offset + 1);
  const to = offset === 0 ? addDays(today, 1) : nextMonth;

  const expenses = useExpenses(from, to);
  const income = useReportRows(from, to, true);
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<Expense | null>(null);

  const live = useMemo(
    () => (expenses.data?.rows ?? []).filter((e) => !e.voided_at),
    [expenses.data],
  );
  const spent = live.reduce((s, e) => s + e.amount_cents, 0);
  const received =
    (income.data?.roomPayments ?? []).reduce((s, p) => s + p.amount_cents, 0) +
    (income.data?.restaurantPayments ?? []).reduce((s, p) => s + p.amount_cents, 0);
  const profit = received - spent;
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of live) m.set(e.category, (m.get(e.category) ?? 0) + e.amount_cents);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [live]);
  const maxCat = Math.max(1, ...byCategory.map(([, v]) => v));

  return (
    <>
      <PageTitle
        title="Expenses and profit"
        sub="Write down every taka spent. Profit = money received − expenses."
        actions={
          <Button
            onClick={() => setAdding(true)}
            disabled={expenses.data?.notSetUp}
            className="h-11 gap-2 bg-pos-gold px-5 font-semibold text-pos-ocean hover:bg-pos-gold/85"
          >
            <Plus size={18} /> Add expense
          </Button>
        }
      />

      <div className="mb-5 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Previous month"
          onClick={() => setOffset((o) => o - 1)}
        >
          <ChevronLeft size={18} />
        </Button>
        <span className="min-w-36 text-center font-medium">{monthTitle(from)}</span>
        <Button
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Next month"
          disabled={offset >= 0}
          onClick={() => setOffset((o) => o + 1)}
        >
          <ChevronRight size={18} />
        </Button>
      </div>

      <LoadState
        isLoading={expenses.isLoading}
        error={expenses.error}
        retry={() => void expenses.refetch()}
      />
      {expenses.data?.notSetUp && <SetupNotice />}

      {expenses.data && !expenses.data.notSetUp && (
        <div className="grid gap-5">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card label="Money received" value={income.data ? taka(received) : "…"} />
            <Card label="Expenses" value={taka(spent)} sub={`${live.length} entries`} />
            <Card
              label={profit >= 0 ? "Profit" : "Loss"}
              value={income.data ? taka(Math.abs(profit)) : "…"}
              tone={profit >= 0 ? "good" : "bad"}
            />
          </section>

          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Panel title="Spent on">
              {byCategory.length === 0 ? (
                <p className="text-sm text-pos-muted">Nothing yet this month.</p>
              ) : (
                <ul className="grid gap-3">
                  {byCategory.map(([cat, v]) => (
                    <li key={cat}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="truncate">{categoryLabel(cat)}</span>
                        <span className="shrink-0 font-medium tabular-nums">{taka(v)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-pos-ground">
                        <div
                          className="h-2 rounded-full bg-pos-gold"
                          style={{ width: `${Math.max(2, (v / maxCat) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="All expenses">
              {expenses.data.rows.length === 0 ? (
                <p className="text-sm text-pos-muted">No expenses written down for this month.</p>
              ) : (
                <ul className="divide-y divide-pos-line">
                  {expenses.data.rows.map((e) => (
                    <li
                      key={e.id}
                      className={`flex items-start justify-between gap-3 py-2.5 ${e.voided_at ? "text-pos-muted line-through" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{e.description}</span>
                        <span className="text-xs text-pos-muted">
                          {shortDate(e.expense_date)} · {categoryLabel(e.category)} ·{" "}
                          {paymentMethods.find((m) => m.id === e.method)?.label ?? e.method}
                          {e.cash_movement_id ? " from the drawer" : ""}
                          {e.reference ? ` · ${e.reference}` : ""}
                        </span>
                        {e.voided_at && (
                          <span className="block text-xs no-underline">
                            Removed: {e.void_reason}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="font-medium tabular-nums">{taka(e.amount_cents)}</span>
                        {isAdmin && !e.voided_at && (
                          <button
                            type="button"
                            aria-label={`Remove ${e.description}`}
                            onClick={() => setVoiding(e)}
                            className="grid size-8 place-items-center rounded-md text-pos-muted hover:bg-red-50 hover:text-red-700"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      <ExpenseDialog open={adding} onOpenChange={setAdding} />
      <VoidExpenseDialog expense={voiding} onClose={() => setVoiding(null)} />
    </>
  );
}

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        tone === "good"
          ? "border-pos-teal bg-pos-teal-soft"
          : tone === "bad"
            ? "border-red-200 bg-red-50"
            : "border-pos-line bg-white"
      }`}
    >
      <p className="text-xs text-pos-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "bad" ? "text-red-800" : tone === "good" ? "text-pos-ocean" : ""}`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-pos-muted">{sub}</p>}
    </div>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const today = resortToday();
  const drawer = useDrawerOpen(open);
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<ExpenseCategory>("market");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [fromDrawer, setFromDrawer] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDate(today);
    setCategory("market");
    setDescription("");
    setAmount("");
    setMethod("cash");
    setReference("");
    setFromDrawer(true);
  }, [open, today]);

  const cents = parseTaka(amount);
  const useDrawer = method === "cash" && fromDrawer && drawer.data === true;
  const run = usePosAction(() =>
    rpc(
      supabase.rpc("pos_add_expense", {
        p_date: date,
        p_category: category,
        p_description: description.trim(),
        p_amount_cents: cents!,
        p_method: method,
        p_reference: reference.trim(),
        p_from_drawer: useDrawer,
      }),
    ),
  );
  const ready = cents !== null && description.trim().length >= 2 && Boolean(date);

  return (
    <Dialog open={open} onOpenChange={(o) => !run.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[92svh] overflow-y-auto font-sans sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>Market, salary, generator fuel, repairs and so on.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Spent on</Label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {expenseCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                className={`min-h-10 rounded-lg border px-2 py-1.5 text-left text-[12.5px] leading-tight ${
                  category === c.id
                    ? "border-pos-ocean bg-pos-ocean text-white"
                    : "border-pos-line bg-white hover:bg-pos-ground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ex-desc">What was it?</Label>
          <Input
            id="ex-desc"
            className="h-11 text-base sm:text-sm"
            placeholder="Fish 10 kg, Rahim's salary, diesel 20 L…"
            value={description}
            maxLength={300}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ex-amount">Amount (৳)</Label>
            <Input
              id="ex-amount"
              inputMode="decimal"
              className="h-11 text-base tabular-nums"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ex-date">Date</Label>
            <Input
              id="ex-date"
              type="date"
              className="h-11 text-base sm:text-sm"
              max={today}
              min={addDays(today, -120)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Paid by</Label>
          <div className="flex flex-wrap gap-1.5">
            {paymentMethods.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={method === m.id}
                onClick={() => setMethod(m.id)}
                className={`h-10 rounded-full border px-4 text-sm ${method === m.id ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line bg-white"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {method === "cash" ? (
          drawer.data ? (
            <label className="flex items-start gap-2 rounded-lg bg-pos-ground p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={fromDrawer}
                onChange={(e) => setFromDrawer(e.target.checked)}
              />
              <span>
                Taken from the cash drawer
                <span className="block text-xs text-pos-muted">
                  The drawer's expected cash goes down by this amount.
                </span>
              </span>
            </label>
          ) : (
            <p className="rounded-lg bg-pos-ground p-3 text-xs text-pos-muted">
              The cash drawer is closed, so this is saved as paid from outside the drawer.
            </p>
          )
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="ex-ref">Transaction ID (optional)</Label>
            <Input
              id="ex-ref"
              className="h-11 text-base sm:text-sm"
              value={reference}
              maxLength={80}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        )}
        <Button
          className="h-12 bg-pos-ocean text-white hover:bg-pos-ocean/90"
          disabled={!ready || run.isPending}
          onClick={() =>
            run.mutate(undefined, {
              onSuccess: () => {
                toast.success(`Expense of ${taka(cents!)} saved`);
                onOpenChange(false);
              },
              onError: (e) => toast.error(posError(e)),
            })
          }
        >
          {run.isPending && <LoaderCircle size={16} className="animate-spin" />}
          Save expense {cents ? taka(cents) : ""}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function VoidExpenseDialog({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [expense]);
  const run = usePosAction(() =>
    rpc(supabase.rpc("pos_void_expense", { p_expense: expense!.id, p_reason: reason.trim() })),
  );
  return (
    <Dialog open={Boolean(expense)} onOpenChange={(o) => !o && !run.isPending && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove expense</DialogTitle>
          <DialogDescription>
            {expense?.description} · {taka(expense?.amount_cents)}. It stays on record as removed.
            {expense?.cash_movement_id &&
              " If the cash went back into the drawer, add it in Cash › Put cash in."}
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          className="h-11 text-base sm:text-sm"
          placeholder="Why? (entered twice, wrong amount…)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button
          className="h-11 bg-red-700 text-white hover:bg-red-800"
          disabled={reason.trim().length < 3 || run.isPending}
          onClick={() =>
            run.mutate(undefined, {
              onSuccess: () => {
                toast.success("Expense removed");
                onClose();
              },
              onError: (e) => toast.error(posError(e)),
            })
          }
        >
          Remove
        </Button>
      </DialogContent>
    </Dialog>
  );
}
