import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  BedDouble,
  CalendarClock,
  CircleCheck,
  LoaderCircle,
  LogOut,
  Phone,
  Plus,
  Printer,
  ShoppingBag,
  X,
} from "lucide-react";

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
  changeDue,
  nights,
  parseTaka,
  paymentMethods,
  paymentProblem,
  posError,
  resortToday,
  rpc,
  shortDate,
  shortDateTime,
  taka,
  useAccount,
  useBoardData,
  usePosAction,
  type ChargeLine,
  type PaymentMethod,
} from "@/lib/pos";
import { AddChargeDialog } from "./add-charge-dialog";
import { BookingDialog } from "./walk-in-dialog";
import { DiscountSection } from "./discounts";
import { LoadState, Panel, usePos } from "./pos-shell";

const sourceLabel: Record<ChargeLine["source"], string> = {
  front_desk: "Front desk",
  restaurant: "Restaurant",
  website: "Website order",
};
const kindChip: Record<ChargeLine["kind"], string> = {
  room: "bg-[#e7eeef] text-pos-ocean",
  food: "bg-[#f3e6cf] text-[#4d3a17]",
  service: "bg-pos-teal-soft text-[#1f5e5c]",
  other: "bg-[#ecebe6] text-[#45443f]",
};
const methodLabel = Object.fromEntries(paymentMethods.map((m) => [m.id, m.label])) as Record<
  PaymentMethod,
  string
>;

type Filter = "all" | "room" | "food" | "service";

export function AccountPage({ id }: { id: string }) {
  const { isAdmin } = usePos();
  const q = useAccount(id);
  const [filter, setFilter] = useState<Filter>("all");
  const [showRemoved, setShowRemoved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<{
    type: "charge" | "payment";
    id: string;
    label: string;
  } | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [booking, setBooking] = useState(false);
  const board = useBoardData(booking);

  const chargeOrder = usePosAction((orderId: string) =>
    rpc(supabase.rpc("pos_charge_order", { p_order_id: orderId, p_account: id })),
  );

  if (q.isLoading || q.error)
    return <LoadState isLoading={q.isLoading} error={q.error} retry={() => void q.refetch()} />;
  if (!q.data)
    return (
      <Panel>
        <p className="text-sm">This bill doesn't exist or you can't see it.</p>
        <Link to="/pos/guests" className="mt-2 inline-block text-sm text-pos-teal underline">
          Back to customers
        </Link>
      </Panel>
    );

  const { account, totals, charges, payments, rooms, pendingOrders } = q.data;
  const open = account.status === "open";
  const today = resortToday();
  const inHouse = rooms.filter((r) => r.stay_status === "in_house");
  const lastOut = inHouse.reduce<string | null>(
    (m, r) => (!m || r.check_out > m ? r.check_out : m),
    null,
  );
  const leavingEarly = inHouse.some(
    (r) => r.check_out > (today > addDays(r.check_in, 1) ? today : addDays(r.check_in, 1)),
  );
  const bookingGuest = {
    guest: { name: account.guest_name, phone: account.guest_phone, email: account.guest_email },
  };
  const removedCount =
    charges.filter((c) => c.voided_at).length + payments.filter((p) => p.voided_at).length;

  const visibleCharges = charges.filter(
    (c) =>
      (showRemoved || !c.voided_at) &&
      (filter === "all" ||
        (filter === "service" ? c.kind === "service" || c.kind === "other" : c.kind === filter)),
  );
  const visiblePayments = payments.filter((p) => showRemoved || !p.voided_at);

  const blockers = [
    pendingOrders.length > 0 &&
      `${pendingOrders.length} website order${pendingOrders.length > 1 ? "s" : ""} not on the bill`,
    leavingEarly && "The stay runs past today",
    totals.balance > 0 && `${taka(totals.balance)} still to pay`,
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="print:hidden">
        <Link
          to="/pos/guests"
          className="mb-3 inline-flex items-center gap-1 text-sm text-pos-teal hover:underline"
        >
          <ArrowLeft size={15} /> Customers
        </Link>
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-[22px] font-semibold leading-tight">
              {account.guest_name}
              <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-pos-muted ring-1 ring-pos-line">
                Bill {account.account_no}
              </span>
              {open ? (
                <span className="rounded-full bg-pos-teal-soft px-2.5 py-0.5 text-xs font-medium text-[#1f5e5c]">
                  {rooms.length ? "Staying" : "Open bill"}
                </span>
              ) : (
                <span className="rounded-full bg-[#ecebe6] px-2.5 py-0.5 text-xs font-medium text-[#45443f]">
                  Checked out {account.closed_at ? shortDateTime(account.closed_at) : ""}
                </span>
              )}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-pos-muted">
              {account.guest_phone && (
                <a
                  href={`tel:${account.guest_phone}`}
                  className="inline-flex items-center gap-1 text-pos-teal"
                >
                  <Phone size={13} /> {account.guest_phone}
                </a>
              )}
              {rooms.map((r) => (
                <span key={r.id}>
                  {r.unit} ({r.type}) · {shortDate(r.check_in)}–{shortDate(r.check_out)}
                </span>
              ))}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 gap-2" onClick={() => window.print()}>
              <Printer size={16} /> Print bill
            </Button>
            {open && (
              <Button
                onClick={() => setAdding(true)}
                className="h-11 gap-2 bg-pos-gold px-5 font-semibold text-pos-ocean hover:bg-pos-gold/85"
              >
                <Plus size={18} /> Add to bill
              </Button>
            )}
          </div>
        </header>

        {open && pendingOrders.length > 0 && (
          <div className="mb-4 rounded-xl border border-pos-gold bg-[#fbf6ec] p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShoppingBag size={16} /> The guest ordered from the website. Add it to this bill:
            </p>
            <ul className="mt-2 grid gap-2">
              {pendingOrders.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                >
                  <span>
                    Order {o.order_number} · {shortDateTime(o.created_at)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">{taka(o.subtotal_cents)}</span>
                    <Button
                      className="h-9 bg-pos-ocean text-white hover:bg-pos-ocean/90"
                      disabled={chargeOrder.isPending}
                      onClick={() =>
                        chargeOrder.mutate(o.id, {
                          onSuccess: () => toast.success(`Order ${o.order_number} added`),
                          onError: (e) => toast.error(posError(e)),
                        })
                      }
                    >
                      Add
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
                {(
                  [
                    ["all", "All"],
                    ["room", "Room"],
                    ["food", "Food"],
                    ["service", "Services"],
                  ] as [Filter, string][]
                ).map(([f, label]) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={`h-9 rounded-full px-3.5 text-[13px] transition-colors ${
                      filter === f
                        ? "bg-pos-ocean text-white"
                        : "border border-pos-line bg-white hover:bg-pos-ground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {removedCount > 0 && (
                <label className="flex items-center gap-2 text-xs text-pos-muted">
                  <input
                    type="checkbox"
                    checked={showRemoved}
                    onChange={(e) => setShowRemoved(e.target.checked)}
                  />
                  Show removed ({removedCount})
                </label>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-pos-muted">
                    <th className="border-b border-pos-line py-2 pr-2 font-medium">Date</th>
                    <th className="border-b border-pos-line px-2 py-2 font-medium">Item</th>
                    <th className="hidden border-b border-pos-line px-2 py-2 font-medium md:table-cell">
                      From
                    </th>
                    <th className="hidden border-b border-pos-line px-2 py-2 text-right font-medium sm:table-cell">
                      Qty × price
                    </th>
                    <th className="border-b border-pos-line py-2 pl-2 text-right font-medium">
                      Amount
                    </th>
                    {isAdmin && open && (
                      <th className="w-9 border-b border-pos-line" aria-label="Remove" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleCharges.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-pos-muted">
                        Nothing here yet
                      </td>
                    </tr>
                  )}
                  {visibleCharges.map((c) => (
                    <tr
                      key={c.id}
                      className={
                        c.voided_at ? "text-pos-muted line-through decoration-pos-muted/60" : ""
                      }
                    >
                      <td className="border-b border-pos-line/70 py-2.5 pr-2 align-top whitespace-nowrap text-pos-muted">
                        {shortDate(c.charge_date)}
                      </td>
                      <td className="border-b border-pos-line/70 px-2 py-2.5 align-top">
                        {c.description}
                        {c.quantity > 1 && (
                          <span className="block text-xs text-pos-muted sm:hidden">
                            {c.quantity} × {taka(c.unit_price_cents)}
                          </span>
                        )}
                        {c.voided_at && (
                          <span className="block text-xs no-underline">
                            Removed: {c.void_reason}
                          </span>
                        )}
                      </td>
                      <td className="hidden border-b border-pos-line/70 px-2 py-2.5 align-top md:table-cell">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${kindChip[c.kind]}`}
                        >
                          {sourceLabel[c.source]}
                        </span>
                      </td>
                      <td className="hidden border-b border-pos-line/70 px-2 py-2.5 text-right align-top whitespace-nowrap tabular-nums text-pos-muted sm:table-cell">
                        {c.quantity} × {taka(c.unit_price_cents)}
                      </td>
                      <td className="border-b border-pos-line/70 py-2.5 pl-2 text-right align-top font-medium tabular-nums">
                        {taka(c.amount_cents)}
                      </td>
                      {isAdmin && open && (
                        <td className="border-b border-pos-line/70 text-right align-top">
                          {!c.voided_at && c.kind !== "room" && (
                            <button
                              type="button"
                              aria-label={`Remove ${c.description}`}
                              onClick={() =>
                                setVoiding({ type: "charge", id: c.id, label: c.description })
                              }
                              className="grid size-8 place-items-center rounded-md text-pos-muted hover:bg-red-50 hover:text-red-700"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-6 mb-2 text-[14px] font-semibold">Payments</h3>
            {visiblePayments.length === 0 ? (
              <p className="text-sm text-pos-muted">No payments yet</p>
            ) : (
              <ul className="divide-y divide-pos-line/70 text-[13px]">
                {visiblePayments.map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between gap-3 py-2.5 ${p.voided_at ? "text-pos-muted line-through" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{methodLabel[p.method]}</span>
                      {p.reference && <span className="ml-2 text-pos-muted">{p.reference}</span>}
                      <span className="block text-xs text-pos-muted">
                        {shortDateTime(p.created_at)}
                        {p.voided_at && ` · removed: ${p.void_reason}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium tabular-nums text-pos-teal">
                        {taka(p.amount_cents)}
                      </span>
                      {isAdmin && open && !p.voided_at && (
                        <button
                          type="button"
                          aria-label="Remove payment"
                          onClick={() =>
                            setVoiding({
                              type: "payment",
                              id: p.id,
                              label: `${methodLabel[p.method]} ${taka(p.amount_cents)}`,
                            })
                          }
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
            <p className="mt-4 text-xs text-pos-muted">
              Breakfast is included with the room. Lines are never deleted: an admin can remove one
              with a reason, and it stays on record.
            </p>
          </Panel>

          <div className="order-first grid content-start gap-5 xl:sticky xl:top-6 xl:order-none">
            <Panel>
              <dl className="grid gap-2 text-[13px]">
                <Row label="Room" value={totals.room} />
                <Row label="Food" value={totals.food} />
                <Row label="Services" value={totals.service} />
                <div className="flex justify-between border-t border-pos-line pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{taka(totals.charges)}</dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-pos-gold-deep">
                    <dt>Discount</dt>
                    <dd className="tabular-nums">− {taka(totals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-pos-teal">
                  <dt>Paid{totals.charges === 0 && totals.paid > 0 ? " in advance" : ""}</dt>
                  <dd className="tabular-nums">− {taka(totals.paid)}</dd>
                </div>
              </dl>
              <div className="mt-3 rounded-lg bg-pos-sand px-4 py-3">
                <p className="text-xs text-pos-muted">
                  {totals.balance > 0
                    ? "Balance to pay"
                    : totals.balance < 0
                      ? "Advance held for the guest"
                      : "Balance"}
                </p>
                <p className="font-display text-[34px] leading-tight tabular-nums text-pos-ocean">
                  {taka(Math.abs(totals.balance))}
                </p>
                {totals.balance < 0 && (
                  <p className="text-xs text-pos-muted">
                    It comes off the room bill at check-in. If the booking is cancelled, an admin
                    can remove the payment when the money is returned.
                  </p>
                )}
              </div>
              {open && totals.balance > 0 && <PayForm accountId={id} balance={totals.balance} />}
              <DiscountSection
                accountId={id}
                open={open}
                isAdmin={isAdmin}
                balance={totals.balance}
                charges={totals.charges}
              />
            </Panel>

            {open && (
              <Panel title="Stay">
                {rooms.length > 0 && (
                  <StayControls accountId={id} lastOut={lastOut} leavingEarly={leavingEarly} />
                )}
                {rooms.length === 0 && (
                  <p className="text-sm text-pos-muted">
                    No room yet. Food and services can still go on this bill.
                  </p>
                )}
                <Button
                  variant="outline"
                  className="mt-3 h-11 w-full gap-2"
                  onClick={() => setBooking(true)}
                >
                  <BedDouble size={16} /> {rooms.length ? "Add another room" : "Give a room"}
                </Button>
                <div className="mt-4 border-t border-pos-line pt-4">
                  {blockers.length > 0 ? (
                    <p className="mb-2 text-xs text-pos-muted">
                      {rooms.length ? "Before check-out" : "Before closing"}: {blockers.join(" · ")}
                    </p>
                  ) : (
                    <p className="mb-2 flex items-center gap-1.5 text-xs text-pos-teal">
                      <CircleCheck size={14} /> All paid. Ready to{" "}
                      {rooms.length ? "check out" : "close the bill"}
                    </p>
                  )}
                  <Button
                    onClick={() => setConfirmOut(true)}
                    disabled={blockers.length > 0}
                    className="h-12 w-full gap-2 bg-pos-ocean text-white hover:bg-pos-ocean/90"
                  >
                    <LogOut size={16} /> {rooms.length ? "Check out" : "Close the bill"}
                  </Button>
                </div>
              </Panel>
            )}
          </div>
        </div>
      </div>

      <PrintableBill data={q.data} />
      {open && (
        <BookingDialog
          open={booking}
          onOpenChange={setBooking}
          units={board.data?.units ?? []}
          start={bookingGuest}
        />
      )}

      {open && <AddChargeDialog accountId={id} open={adding} onOpenChange={setAdding} />}
      <VoidDialog target={voiding} onClose={() => setVoiding(null)} />
      <CheckOutDialog
        open={confirmOut}
        onOpenChange={setConfirmOut}
        accountId={id}
        guest={account.guest_name}
        rooms={inHouse.map((r) => r.unit)}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-pos-muted">{label}</dt>
      <dd className="tabular-nums">{taka(value)}</dd>
    </div>
  );
}

function PayForm({ accountId, balance }: { accountId: string; balance: number }) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState(String(balance / 100));
  const [ref, setRef] = useState("");
  const [given, setGiven] = useState("");
  const [problem, setProblem] = useState("");
  useEffect(() => setAmount(String(balance / 100)), [balance]);

  const cents = parseTaka(amount);
  const m = paymentMethods.find((p) => p.id === method)!;
  const change = method === "cash" ? changeDue(parseTaka(given), cents ?? 0) : 0;
  const pay = usePosAction(() =>
    rpc(
      supabase.rpc("pos_add_payment", {
        p_account: accountId,
        p_method: method,
        p_amount_cents: cents!,
        p_reference: ref.trim(),
      }),
    ),
  );

  function submit() {
    const p = paymentProblem(method, cents, balance, ref);
    setProblem(p ?? "");
    if (p) return;
    pay.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${taka(cents!)} received by ${m.label}`);
        setRef("");
        setGiven("");
      },
      onError: (e) => setProblem(posError(e)),
    });
  }

  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-xs text-pos-muted">Paid by</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {paymentMethods.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={method === p.id}
              onClick={() => {
                setMethod(p.id);
                setProblem("");
              }}
              className={`h-10 rounded-lg text-[12.5px] font-medium transition-colors ${
                method === p.id
                  ? "bg-pos-ocean text-white"
                  : "border border-pos-line bg-white hover:bg-pos-ground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor="pay-amount" className="text-xs text-pos-muted">
            Amount (৳)
          </Label>
          <Input
            id="pay-amount"
            inputMode="decimal"
            className="h-11 text-base tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {method === "cash" ? (
          <div className="grid gap-1">
            <Label htmlFor="pay-given" className="text-xs text-pos-muted">
              Guest gave (৳)
            </Label>
            <Input
              id="pay-given"
              inputMode="decimal"
              className="h-11 text-base tabular-nums"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              placeholder="optional"
            />
          </div>
        ) : (
          <div className="grid gap-1">
            <Label htmlFor="pay-ref" className="truncate text-xs text-pos-muted">
              {m.refLabel}
            </Label>
            <Input
              id="pay-ref"
              className="h-11 text-base"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </div>
      {change > 0 && (
        <p className="rounded-lg bg-pos-teal-soft px-3 py-2 text-sm text-[#1f5e5c]">
          Give back {taka(change)} change
        </p>
      )}
      {problem && (
        <p role="alert" className="text-sm text-red-700">
          {problem}
        </p>
      )}
      <Button
        type="submit"
        disabled={pay.isPending}
        className="h-12 bg-pos-gold text-[15px] font-semibold text-pos-ocean hover:bg-pos-gold/85"
      >
        {pay.isPending ? (
          <LoaderCircle size={16} className="animate-spin" />
        ) : (
          `Take ${cents ? taka(cents) : "payment"}`
        )}
      </Button>
    </form>
  );
}

function StayControls({
  accountId,
  lastOut,
  leavingEarly,
}: {
  accountId: string;
  lastOut: string | null;
  leavingEarly: boolean;
}) {
  const today = resortToday();
  const [date, setDate] = useState(lastOut ?? "");
  useEffect(() => setDate(lastOut ?? ""), [lastOut]);
  const change = usePosAction(() =>
    rpc(supabase.rpc("pos_change_departure", { p_account: accountId, p_check_out: date })),
  );
  const endToday = usePosAction(() =>
    rpc(supabase.rpc("pos_end_stay_today", { p_account: accountId })),
  );

  if (!lastOut)
    return <p className="text-sm text-pos-muted">No rooms are checked in on this bill.</p>;
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="dep" className="text-xs text-pos-muted">
          Leaving on
        </Label>
        <div className="flex gap-2">
          <Input
            id="dep"
            type="date"
            min={today}
            max={addDays(today, 90)}
            className="h-11 min-w-0 flex-1 text-base"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button
            variant="outline"
            className="h-11"
            disabled={!date || date === lastOut || change.isPending}
            onClick={() =>
              change.mutate(undefined, {
                onSuccess: () =>
                  toast.success(`Stay now ends ${shortDate(date)}. Room charge updated`),
                onError: (e) => toast.error(posError(e)),
              })
            }
          >
            {change.isPending ? <LoaderCircle size={15} className="animate-spin" /> : "Change"}
          </Button>
        </div>
        <p className="text-xs text-pos-muted">
          Changing the date re-prices the room charge for the new number of nights.
        </p>
      </div>
      {leavingEarly && (
        <Button
          variant="outline"
          className="h-11 gap-2"
          disabled={endToday.isPending}
          onClick={() =>
            endToday.mutate(undefined, {
              onSuccess: () => toast.success("Stay ends today. Room charge updated"),
              onError: (e) => toast.error(posError(e)),
            })
          }
        >
          <CalendarClock size={16} /> Guest is leaving today
        </Button>
      )}
    </div>
  );
}

function VoidDialog({
  target,
  onClose,
}: {
  target: { type: "charge" | "payment"; id: string; label: string } | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [target]);
  const run = usePosAction(() =>
    target?.type === "payment"
      ? rpc(supabase.rpc("pos_void_payment", { p_payment: target.id, p_reason: reason }))
      : rpc(supabase.rpc("pos_void_charge", { p_charge: target!.id, p_reason: reason })),
  );
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && !run.isPending && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove {target?.type === "payment" ? "payment" : "charge"}</DialogTitle>
          <DialogDescription>
            {target?.label}. It stays on record as removed, with your reason.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="void-reason">Reason</Label>
          <Input
            id="void-reason"
            className="h-11 text-base"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. entered twice"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={onClose}>
            Keep it
          </Button>
          <Button
            className="h-11 flex-1 bg-red-700 text-white hover:bg-red-800"
            disabled={reason.trim().length < 3 || run.isPending}
            onClick={() =>
              run.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Removed");
                  onClose();
                },
                onError: (e) => toast.error(posError(e)),
              })
            }
          >
            Remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckOutDialog({
  open,
  onOpenChange,
  accountId,
  guest,
  rooms,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accountId: string;
  guest: string;
  rooms: string[];
}) {
  const run = usePosAction(() => rpc(supabase.rpc("pos_check_out", { p_account: accountId })));
  return (
    <Dialog open={open} onOpenChange={(o) => !run.isPending && onOpenChange(o)}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {rooms.length ? `Check out ${guest}?` : `Close ${guest}'s bill?`}
          </DialogTitle>
          <DialogDescription>
            {rooms.length
              ? `The bill closes and ${rooms.join(", ")} ${rooms.length === 1 ? "is" : "are"} marked for cleaning. `
              : "The bill closes. "}
            A closed bill can't be changed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
            Not yet
          </Button>
          <Button
            className="h-11 flex-1 bg-pos-ocean text-white hover:bg-pos-ocean/90"
            disabled={run.isPending}
            onClick={() =>
              run.mutate(undefined, {
                onSuccess: () => {
                  toast.success(rooms.length ? `${guest} checked out` : `${guest}'s bill closed`);
                  onOpenChange(false);
                },
                onError: (e) => toast.error(posError(e)),
              })
            }
          >
            {run.isPending ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : rooms.length ? (
              "Check out"
            ) : (
              "Close the bill"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type AccountData = NonNullable<ReturnType<typeof useAccount>["data"]>;

function PrintableBill({ data }: { data: AccountData }) {
  const { account, totals, charges, payments, rooms } = data;
  const lines = useMemo(() => charges.filter((c) => !c.voided_at), [charges]);
  const paid = payments.filter((p) => !p.voided_at);
  return (
    <article className="hidden font-sans text-[12px] text-black print:block">
      <header className="flex items-start justify-between border-b border-black pb-3">
        <div>
          <p className="font-display text-xl tracking-[0.08em]">SANTA MONICA</p>
          <p>Eco Beach Resort · Saint Martin's Island</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Bill {account.account_no}</p>
          <p>{new Date().toLocaleDateString("en-GB")}</p>
        </div>
      </header>
      <section className="py-3">
        <p className="font-semibold">{account.guest_name}</p>
        {account.guest_phone && <p>{account.guest_phone}</p>}
        {rooms.map((r) => (
          <p key={r.id}>
            {r.unit} ({r.type}) · {shortDate(r.check_in)} – {shortDate(r.check_out)} ·{" "}
            {nights(r.check_in, r.check_out)} nights
          </p>
        ))}
      </section>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((c) => (
            <tr key={c.id} className="border-b border-black/20">
              <td className="py-1 pr-2">{c.description}</td>
              <td className="py-1 text-right">{c.quantity}</td>
              <td className="py-1 text-right">{taka(c.unit_price_cents)}</td>
              <td className="py-1 text-right">{taka(c.amount_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-3 grid w-64 gap-1">
        <div className="flex justify-between">
          <dt>Total</dt>
          <dd>{taka(totals.charges)}</dd>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between">
            <dt>Discount</dt>
            <dd>− {taka(totals.discount)}</dd>
          </div>
        )}
        {paid.map((p) => (
          <div key={p.id} className="flex justify-between">
            <dt>
              Paid, {methodLabel[p.method]} {shortDate(p.created_at.slice(0, 10))}
            </dt>
            <dd>− {taka(p.amount_cents)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-black pt-1 text-[14px] font-semibold">
          <dt>Balance</dt>
          <dd>{taka(totals.balance)}</dd>
        </div>
      </dl>
      <p className="mt-6 text-center">Breakfast included. Thank you for staying with us.</p>
    </article>
  );
}
