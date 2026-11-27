import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";

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
  phoneKey,
  posError,
  rpc,
  taka,
  useAccounts,
  usePosAction,
  type PaymentMethod,
  type PosReservation,
} from "@/lib/pos";
import { useDrawerOpen } from "@/lib/pos-cash";

/** Advance already held on the guest's open bill (found by mobile number), in cents. */
export function useAdvanceHeld(phone: string, enabled = true) {
  const accounts = useAccounts(enabled && phone.length > 0);
  const key = phoneKey(phone);
  const acc = (accounts.data ?? []).find(
    (a) => a.status === "open" && key.length >= 7 && phoneKey(a.guest_phone) === key,
  );
  return { account: acc ?? null, held: acc && acc.balance_cents < 0 ? -acc.balance_cents : 0 };
}

export function AdvanceDialog({
  reservation,
  bookingTotal,
  onClose,
}: {
  reservation: PosReservation | null;
  bookingTotal: number;
  onClose: () => void;
}) {
  const drawer = useDrawerOpen(Boolean(reservation));
  const { account, held } = useAdvanceHeld(reservation?.guest_phone ?? "", Boolean(reservation));
  const [method, setMethod] = useState<PaymentMethod>("bkash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  useEffect(() => {
    setMethod("bkash");
    setAmount("");
    setReference("");
  }, [reservation]);

  const cents = parseTaka(amount);
  const max = Math.max(0, bookingTotal - held);
  const m = paymentMethods.find((p) => p.id === method)!;
  const problem =
    cents === null
      ? null
      : cents > max
        ? `At most ${taka(max)}`
        : m.needsRef && reference.trim().length < 4
          ? `Enter the ${m.refLabel}`
          : null;

  const run = usePosAction(() =>
    rpc(
      supabase.rpc("pos_take_advance", {
        p_reservation: reservation!.id,
        p_method: method,
        p_amount_cents: cents!,
        p_reference: reference.trim(),
      }),
    ),
  );

  return (
    <Dialog open={Boolean(reservation)} onOpenChange={(o) => !o && !run.isPending && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        {reservation && (
          <>
            <DialogHeader>
              <DialogTitle>Advance from {reservation.guest_name || "the guest"}</DialogTitle>
              <DialogDescription>
                Room total {taka(bookingTotal)}
                {held > 0 && ` · already paid ${taka(held)}`}. The advance is kept on the guest's
                bill and comes off at check-in.
              </DialogDescription>
            </DialogHeader>
            {!reservation.guest_phone ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                This booking has no mobile number, so an advance can't be linked to the guest.
              </p>
            ) : drawer.data === false ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                The cash drawer is closed. Open it in{" "}
                <Link to="/pos/cash" className="font-medium underline">
                  Cash
                </Link>{" "}
                first. Every payment, bKash too, goes into the open shift.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {paymentMethods.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={method === p.id}
                      onClick={() => setMethod(p.id)}
                      className={`h-10 rounded-full border px-4 text-sm ${method === p.id ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line bg-white"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="adv-amount">Amount (৳)</Label>
                  <Input
                    id="adv-amount"
                    autoFocus
                    inputMode="decimal"
                    className="h-11 text-base tabular-nums"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <div className="flex gap-1.5">
                    {[0.25, 0.5].map((f) => {
                      const v = Math.min(max, Math.round((bookingTotal * f) / 100) * 100);
                      return v > 0 ? (
                        <button
                          key={f}
                          type="button"
                          className="rounded-full bg-pos-ground px-3 py-1 text-xs"
                          onClick={() => setAmount(String(v / 100))}
                        >
                          {f * 100}% · {taka(v)}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="adv-ref">{m.refLabel}</Label>
                  <Input
                    id="adv-ref"
                    className="h-11 text-base sm:text-sm"
                    value={reference}
                    maxLength={60}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                {problem && <p className="text-sm text-red-700">{problem}</p>}
                <Button
                  className="h-12 bg-pos-ocean text-white hover:bg-pos-ocean/90"
                  disabled={!cents || Boolean(problem) || run.isPending}
                  onClick={() =>
                    run.mutate(undefined, {
                      onSuccess: () => {
                        toast.success(`Advance of ${taka(cents!)} saved on the guest's bill`);
                        onClose();
                      },
                      onError: (e) => toast.error(posError(e)),
                    })
                  }
                >
                  {run.isPending && <LoaderCircle size={16} className="animate-spin" />}
                  Save advance
                </Button>
                {account && (
                  <Link
                    to="/pos/account/$id"
                    params={{ id: account.id }}
                    className="text-center text-xs text-pos-teal underline"
                  >
                    Open bill {account.account_no}
                  </Link>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
