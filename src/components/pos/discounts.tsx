import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, LoaderCircle, Percent, X } from "lucide-react";

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
import { useAccountDiscounts, type Discount } from "@/lib/pos-extras";

const statusLook: Record<Discount["status"], { text: string; cls: string }> = {
  pending: { text: "Waiting for admin", cls: "bg-amber-100 text-amber-900" },
  approved: { text: "Approved", cls: "bg-pos-teal-soft text-[#1f5e5c]" },
  rejected: { text: "Not approved", cls: "bg-[#ecebe6] text-[#45443f]" },
  voided: { text: "Taken back", cls: "bg-[#ecebe6] text-[#45443f]" },
};

/** Discounts on one bill: list, admin approve / reject / take back, and the "Give a discount" button. */
export function DiscountSection({
  accountId,
  open,
  isAdmin,
  balance,
  charges,
}: {
  accountId: string;
  open: boolean;
  isAdmin: boolean;
  balance: number;
  charges: number;
}) {
  const q = useAccountDiscounts(accountId);
  const [asking, setAsking] = useState(false);
  const decide = usePosAction((v: { id: string; decision: "approve" | "reject" | "void" }) =>
    rpc(
      supabase.rpc("pos_decide_discount", { p_discount: v.id, p_decision: v.decision, p_note: "" }),
    ),
  );
  if (!q.data || q.data.notSetUp) return null;
  const rows = q.data.rows.filter((d) => d.status === "pending" || d.status === "approved");
  const pending = rows
    .filter((d) => d.status === "pending")
    .reduce((s, d) => s + d.amount_cents, 0);

  return (
    <div className="mt-3 border-t border-pos-line pt-3">
      {rows.length > 0 && (
        <ul className="mb-3 grid gap-2">
          {rows.map((d) => (
            <li key={d.id} className="rounded-lg border border-pos-line p-2.5 text-[13px]">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-medium">Discount {taka(d.amount_cents)}</span>
                  <span className="block text-xs text-pos-muted">
                    {d.reason} · {shortDateTime(d.requested_at)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusLook[d.status].cls}`}
                >
                  {statusLook[d.status].text}
                </span>
              </div>
              {isAdmin && open && (
                <div className="mt-2 flex gap-2">
                  {d.status === "pending" ? (
                    <>
                      <Button
                        className="h-9 flex-1 gap-1 bg-pos-teal text-white hover:bg-pos-teal/90"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate(
                            { id: d.id, decision: "approve" },
                            {
                              onSuccess: () => toast.success("Discount approved"),
                              onError: (e) => toast.error(posError(e)),
                            },
                          )
                        }
                      >
                        <Check size={15} /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="h-9 flex-1 gap-1"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate(
                            { id: d.id, decision: "reject" },
                            {
                              onSuccess: () => toast.success("Discount not approved"),
                              onError: (e) => toast.error(posError(e)),
                            },
                          )
                        }
                      >
                        <X size={15} /> Reject
                      </Button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-red-700 underline"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate(
                          { id: d.id, decision: "void" },
                          {
                            onSuccess: () => toast.success("Discount taken back"),
                            onError: (e) => toast.error(posError(e)),
                          },
                        )
                      }
                    >
                      Take back this discount
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && balance - pending > 0 && (
        <Button variant="outline" className="h-10 w-full gap-2" onClick={() => setAsking(true)}>
          <Percent size={15} /> Give a discount
        </Button>
      )}
      {!isAdmin && pending > 0 && (
        <p className="mt-2 text-xs text-pos-muted">
          An admin must approve the discount before it comes off the bill.
        </p>
      )}
      <DiscountDialog
        open={asking}
        onOpenChange={setAsking}
        accountId={accountId}
        maxCents={balance - pending}
        chargesCents={charges}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function DiscountDialog({
  open,
  onOpenChange,
  accountId,
  maxCents,
  chargesCents,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accountId: string;
  maxCents: number;
  chargesCents: number;
  isAdmin: boolean;
}) {
  const [mode, setMode] = useState<"taka" | "percent">("taka");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!open) return;
    setMode("taka");
    setValue("");
    setReason("");
  }, [open]);

  const pct = Number(value);
  const cents =
    mode === "taka"
      ? parseTaka(value)
      : Number.isFinite(pct) && pct > 0 && pct <= 100
        ? Math.round((chargesCents * pct) / 100 / 100) * 100
        : null;
  const tooBig = cents !== null && cents > maxCents;
  const run = usePosAction(() =>
    rpc(
      supabase.rpc("pos_request_discount", {
        p_account: accountId,
        p_amount_cents: cents!,
        p_reason: reason.trim(),
      }),
    ),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !run.isPending && onOpenChange(o)}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Give a discount</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "As admin, your discount comes off the bill at once."
              : "An admin approves it before it comes off the bill."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5">
          {(
            [
              ["taka", "Amount ৳"],
              ["percent", "Percent %"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`h-9 flex-1 rounded-full border text-sm ${mode === m ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line bg-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dc-value">
            {mode === "taka" ? "Discount (৳)" : "Discount (% of the bill total)"}
          </Label>
          <Input
            id="dc-value"
            autoFocus
            inputMode="decimal"
            className="h-11 text-base tabular-nums"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {mode === "percent" && cents !== null && (
            <p className="text-sm text-pos-muted">= {taka(cents)}</p>
          )}
          {tooBig && (
            <p className="text-sm text-red-700">At most {taka(maxCents)} (what is still owed).</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dc-reason">Reason (required)</Label>
          <Input
            id="dc-reason"
            className="h-11 text-base sm:text-sm"
            placeholder="Regular guest, AC problem in the room…"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Button
          className="h-11 bg-pos-ocean text-white hover:bg-pos-ocean/90"
          disabled={!cents || tooBig || reason.trim().length < 5 || run.isPending}
          onClick={() =>
            run.mutate(undefined, {
              onSuccess: () => {
                toast.success(
                  isAdmin
                    ? `Discount of ${taka(cents!)} given`
                    : `Discount of ${taka(cents!)} sent for approval`,
                );
                onOpenChange(false);
              },
              onError: (e) => toast.error(posError(e)),
            })
          }
        >
          {run.isPending && <LoaderCircle size={16} className="animate-spin" />}
          {isAdmin ? "Give discount" : "Ask for approval"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
