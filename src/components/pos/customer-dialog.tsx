import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, LoaderCircle, UserPlus } from "lucide-react";

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
  phoneKey,
  phoneOk,
  posError,
  rpc,
  taka,
  useAccounts,
  usePosAction,
  type AccountRow,
} from "@/lib/pos";

/** The customer's open bill for this number, if they already have one. */
export function useOpenAccountByPhone(phone: string, enabled: boolean) {
  const accounts = useAccounts(enabled);
  const key = phoneKey(phone);
  const match: AccountRow | undefined =
    key.length >= 11
      ? (accounts.data ?? []).find((a) => a.status === "open" && phoneKey(a.guest_phone) === key)
      : undefined;
  return { match, loading: accounts.isLoading };
}

/** Open a customer's bill by mobile number, before any room or meal. */
export function CustomerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");
  useEffect(() => {
    if (!open) return;
    setPhone("");
    setName("");
    setEmail("");
    setNote("");
    setProblem("");
  }, [open]);

  const { match } = useOpenAccountByPhone(phone, open);
  const run = usePosAction(() =>
    rpc(
      supabase.rpc("pos_open_account", {
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_email: email.trim(),
        p_note: note.trim(),
      }),
    ),
  );

  function submit() {
    setProblem("");
    if (!phoneOk(phone)) return setProblem("Enter a valid mobile number");
    if (name.trim().length < 2) return setProblem("Enter the customer's name");
    run.mutate(undefined, {
      onSuccess: (id) => {
        toast.success(`Bill opened for ${name.trim()}`);
        onOpenChange(false);
        if (id) void navigate({ to: "/pos/account/$id", params: { id } });
      },
      onError: (e) => setProblem(posError(e)),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !run.isPending && onOpenChange(o)}>
      <DialogContent className="font-sans sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>
            Open the customer's bill first. Rooms, food and services are added to it, and they pay
            once at the end.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cu-phone">Mobile number</Label>
            <Input
              id="cu-phone"
              type="tel"
              inputMode="tel"
              autoFocus
              placeholder="01712 345678"
              className="h-11 text-base sm:text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {match ? (
            <div className="rounded-lg border border-pos-teal bg-pos-teal-soft/40 p-3 text-sm">
              <p>
                <span className="font-medium">{match.guest_name}</span> already has an open bill (
                {match.account_no}
                {match.rooms.length > 0 && ` · ${match.rooms.join(", ")}`} ·{" "}
                {taka(match.balance_cents)} due).
              </p>
              <Button
                asChild
                className="mt-2 h-10 w-full gap-1.5 bg-pos-ocean text-white hover:bg-pos-ocean/90"
              >
                <Link
                  to="/pos/account/$id"
                  params={{ id: match.id }}
                  onClick={() => onOpenChange(false)}
                >
                  Open their bill <ArrowRight size={15} />
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="cu-name">Name</Label>
                <Input
                  id="cu-name"
                  autoComplete="off"
                  className="h-11 text-base sm:text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cu-email">
                  Email <span className="font-normal text-pos-muted">(optional)</span>
                </Label>
                <Input
                  id="cu-email"
                  type="email"
                  className="h-11 text-base sm:text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cu-note">
                  Note <span className="font-normal text-pos-muted">(optional)</span>
                </Label>
                <Input
                  id="cu-note"
                  placeholder="Day visitor, group leader, etc."
                  className="h-11 text-base sm:text-sm"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              {problem && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  {problem}
                </p>
              )}
              <Button
                type="submit"
                disabled={run.isPending}
                className="h-11 gap-2 bg-pos-ocean text-white hover:bg-pos-ocean/90"
              >
                {run.isPending ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}
                Open the bill
              </Button>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
