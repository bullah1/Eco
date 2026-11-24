import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, LoaderCircle, Minus, Plus, UserPlus } from "lucide-react";

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
  nights,
  posError,
  resortToday,
  rpc,
  shortDate,
  taka,
  usePosAction,
  type PosUnit,
} from "@/lib/pos";

const phoneOk = (v: string) => /^\+?[0-9 -]{7,20}$/.test(v.trim());

export function WalkInDialog({
  open,
  onOpenChange,
  units,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: PosUnit[];
}) {
  const navigate = useNavigate();
  const today = resortToday();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setPhone("");
    setEmail("");
    setCheckOut(addDays(today, 1));
    setPicked({});
    setProblem("");
  }, [open, today]);

  const n = nights(today, checkOut);
  const validDates = n >= 1 && n <= 60;
  const free = useQuery({
    queryKey: ["pos", "free-rooms", today, checkOut],
    enabled: open && validDates,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_rooms", {
        p_check_in: today,
        p_check_out: checkOut,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Drop rooms that stopped being free when the dates change.
  useEffect(() => {
    if (!free.data) return;
    const ids = new Set(free.data.map((r) => r.room_unit_id));
    setPicked((p) => Object.fromEntries(Object.entries(p).filter(([id]) => ids.has(id))));
  }, [free.data]);

  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const chosen = (free.data ?? []).filter((r) => picked[r.room_unit_id]);
  const total = chosen.reduce((s, r) => s + r.nightly_rate_cents * n, 0);

  const action = usePosAction(() =>
    rpc(
      supabase.rpc("pos_walk_in", {
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_email: email.trim(),
        p_check_out: checkOut,
        p_rooms: chosen.map((r) => ({ unit_id: r.room_unit_id, guests: picked[r.room_unit_id] })),
      }),
    ),
  );

  function submit() {
    setProblem("");
    if (name.trim().length < 2) return setProblem("Enter the guest's full name");
    if (!phoneOk(phone)) return setProblem("Enter a valid mobile number");
    if (!validDates) return setProblem("Choose a departure 1 to 60 nights from today");
    if (chosen.length === 0) return setProblem("Choose at least one room");
    action.mutate(undefined, {
      onSuccess: (accountId) => {
        toast.success(`${name.trim()} is checked in`);
        onOpenChange(false);
        if (accountId) void navigate({ to: "/pos/account/$id", params: { id: accountId } });
      },
      onError: (e) => {
        setProblem(posError(e));
        void free.refetch();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !action.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[92svh] overflow-y-auto font-sans sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Walk-in guest</DialogTitle>
          <DialogDescription>
            Book and check in now. Breakfast is included with every room.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="wi-name">Guest name</Label>
            <Input
              id="wi-name"
              className="h-11 text-base sm:text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-phone">Mobile number</Label>
            <Input
              id="wi-phone"
              type="tel"
              inputMode="tel"
              placeholder="01712 345678"
              className="h-11 text-base sm:text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-email">
              Email <span className="font-normal text-pos-muted">(optional)</span>
            </Label>
            <Input
              id="wi-email"
              type="email"
              className="h-11 text-base sm:text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-out">Leaving on</Label>
            <Input
              id="wi-out"
              type="date"
              min={addDays(today, 1)}
              max={addDays(today, 60)}
              className="h-11 text-base sm:text-sm"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
          <p className="self-end pb-3 text-sm text-pos-muted">
            {validDates
              ? `${shortDate(today)} – ${shortDate(checkOut)} · ${n} ${n === 1 ? "night" : "nights"}`
              : "Choose a date after today"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Free rooms for these nights</p>
          {free.isLoading && (
            <p className="flex items-center gap-2 text-sm text-pos-muted">
              <LoaderCircle size={14} className="animate-spin" /> Checking rooms
            </p>
          )}
          {free.isError && (
            <p className="text-sm text-red-700">Couldn't check rooms. {posError(free.error)}</p>
          )}
          {free.data && free.data.length === 0 && (
            <p className="text-sm text-pos-muted">No rooms are free for all these nights.</p>
          )}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(free.data ?? []).map((r) => {
              const guests = picked[r.room_unit_id] ?? 0;
              const on = guests > 0;
              const hk = unitById.get(r.room_unit_id)?.housekeeping;
              return (
                <li
                  key={r.room_unit_id}
                  className={`rounded-lg border p-3 transition-colors ${on ? "border-pos-ocean bg-pos-teal-soft/40" : "border-pos-line"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setPicked((p) => {
                          const next = { ...p };
                          if (on) delete next[r.room_unit_id];
                          else next[r.room_unit_id] = Math.min(2, r.max_guests);
                          return next;
                        })
                      }
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    >
                      <span
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${on ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line"}`}
                      >
                        {on && <Check size={13} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {r.room_name} · {r.type_name}
                        </span>
                        <span className="text-xs text-pos-muted">
                          {taka(r.nightly_rate_cents)} / night · up to {r.max_guests}
                          {hk && hk !== "clean" && (
                            <span className="ml-1 text-pos-gold-deep">· not cleaned</span>
                          )}
                        </span>
                      </span>
                    </button>
                    {on && (
                      <div className="flex items-center rounded-md border border-pos-line bg-white">
                        <button
                          type="button"
                          aria-label="Fewer guests"
                          disabled={guests <= 1}
                          onClick={() => setPicked((p) => ({ ...p, [r.room_unit_id]: guests - 1 }))}
                          className="grid size-9 place-items-center disabled:opacity-30"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums" aria-label="Guests">
                          {guests}
                        </span>
                        <button
                          type="button"
                          aria-label="More guests"
                          disabled={guests >= r.max_guests}
                          onClick={() => setPicked((p) => ({ ...p, [r.room_unit_id]: guests + 1 }))}
                          className="grid size-9 place-items-center disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {problem && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {problem}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pos-line pt-4">
          <p>
            <span className="text-xs text-pos-muted">Room total</span>
            <span className="block text-2xl font-semibold tabular-nums">{taka(total)}</span>
          </p>
          <Button
            onClick={submit}
            disabled={action.isPending}
            className="h-11 gap-2 bg-pos-ocean px-6 text-white hover:bg-pos-ocean/90"
          >
            {action.isPending ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <UserPlus size={16} />
            )}{" "}
            Check in now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
