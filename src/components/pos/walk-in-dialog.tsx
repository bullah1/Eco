import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, Check, LoaderCircle, Minus, Plus, UserPlus } from "lucide-react";

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
  phoneOk,
  posError,
  resortToday,
  rpc,
  shortDate,
  taka,
  usePosAction,
  type PosUnit,
} from "@/lib/pos";
import { isSeasonal, roomPrice, useStayQuotes } from "@/lib/stay-quote";

export type BookingStart = {
  checkIn?: string | undefined;
  unitId?: string | undefined;
  /** Book for a customer whose bill is already open. */
  guest?: { name: string; phone: string; email: string } | undefined;
};

/** New booking from the front desk. Arriving today can be checked in straight away. */
export function BookingDialog({
  open,
  onOpenChange,
  units,
  start,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: PosUnit[];
  start?: BookingStart | undefined;
}) {
  const navigate = useNavigate();
  const today = resortToday();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [problem, setProblem] = useState("");

  const startIn = start?.checkIn && start.checkIn >= today ? start.checkIn : today;
  const startUnit = start?.unitId;
  const gName = start?.guest?.name ?? "";
  const gPhone = start?.guest?.phone ?? "";
  const gEmail = start?.guest?.email ?? "";
  useEffect(() => {
    if (!open) return;
    setName(gName);
    setPhone(gPhone);
    setEmail(gEmail);
    setNote("");
    setCheckIn(startIn);
    setCheckOut(addDays(startIn, 1));
    setPicked(startUnit ? { [startUnit]: 0 } : {});
    setProblem("");
  }, [open, startIn, startUnit, gName, gPhone, gEmail]);

  const arrivingToday = checkIn === today;
  const n = nights(checkIn, checkOut);
  const validDates = checkIn >= today && n >= 1 && n <= 60;
  const free = useQuery({
    queryKey: ["pos", "free-rooms", checkIn, checkOut],
    enabled: open && validDates,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_rooms", {
        p_check_in: checkIn,
        p_check_out: checkOut,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Drop rooms that stopped being free when the dates change.
  useEffect(() => {
    if (!free.data) return;
    const rooms = new Map(free.data.map((r) => [r.room_unit_id, r]));
    setPicked((p) =>
      Object.fromEntries(
        Object.entries(p)
          .filter(([id]) => rooms.has(id))
          .map(([id, g]) => [id, g || Math.min(2, rooms.get(id)!.max_guests)]),
      ),
    );
  }, [free.data]);

  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const chosen = (free.data ?? []).filter((r) => picked[r.room_unit_id]);
  const quotes = useStayQuotes(
    chosen.map((r) => r.room_type_id),
    checkIn,
    checkOut,
    open && validDates,
  ).data;
  const total = chosen.reduce(
    (s, r) => s + roomPrice(quotes, r.room_type_id, r.nightly_rate_cents, n),
    0,
  );
  const seasonal = chosen.some((r) => isSeasonal(quotes, r.room_type_id));

  const rooms = () =>
    chosen.map((r) => ({ unit_id: r.room_unit_id, guests: picked[r.room_unit_id] }));
  const freeByType = (() => {
    const map = new Map<string, NonNullable<typeof free.data>>();
    for (const r of free.data ?? []) {
      if (unitById.get(r.room_unit_id)?.housekeeping === "maintenance") continue; // out of order
      map.set(r.type_name, [...(map.get(r.type_name) ?? []), r]);
    }
    return [...map.entries()];
  })();
  const action = usePosAction((mode: "check_in" | "book"): Promise<string | null> =>
    mode === "check_in"
      ? rpc(
          supabase.rpc("pos_walk_in", {
            p_name: name.trim(),
            p_phone: phone.trim(),
            p_email: email.trim(),
            p_check_out: checkOut,
            p_rooms: rooms(),
          }),
        )
      : rpc(
          supabase.rpc("pos_book", {
            p_name: name.trim(),
            p_phone: phone.trim(),
            p_email: email.trim(),
            p_check_in: checkIn,
            p_check_out: checkOut,
            p_note: note.trim(),
            p_rooms: rooms(),
          }),
        ).then(() => null),
  );

  function submit(mode: "check_in" | "book") {
    setProblem("");
    if (name.trim().length < 2) return setProblem("Enter the guest's full name");
    if (!phoneOk(phone)) return setProblem("Enter a valid mobile number");
    if (!validDates) return setProblem("Choose an arrival from today and a stay of 1 to 60 nights");
    if (chosen.length === 0) return setProblem("Choose at least one room");
    action.mutate(mode, {
      onSuccess: (accountId) => {
        toast.success(
          mode === "check_in"
            ? `${name.trim()} is checked in`
            : `Booked ${name.trim()} for ${shortDate(checkIn)}`,
        );
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
          <DialogTitle>New booking</DialogTitle>
          <DialogDescription>
            Choose the dates, pick a free room, then add the guest. Breakfast is included.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <p className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <span className="grid size-6 place-items-center rounded-full bg-pos-ocean text-xs text-white">
              1
            </span>
            When are they coming?
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-in">Arriving on</Label>
            <Input
              id="wi-in"
              type="date"
              min={today}
              className="h-11 text-base sm:text-sm"
              value={checkIn}
              onChange={(e) => {
                const v = e.target.value;
                setCheckIn(v);
                if (v && checkOut <= v) setCheckOut(addDays(v, 1));
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-out">Leaving on</Label>
            <Input
              id="wi-out"
              type="date"
              min={addDays(checkIn || today, 1)}
              max={addDays(checkIn || today, 60)}
              className="h-11 text-base sm:text-sm"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 sm:col-span-2" aria-label="How many nights">
            {[1, 2, 3, 4, 5, 7].map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={n === k}
                onClick={() => setCheckOut(addDays(checkIn || today, k))}
                className={`h-9 rounded-full border px-3.5 text-sm ${n === k ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line hover:border-pos-ocean"}`}
              >
                {k} {k === 1 ? "night" : "nights"}
              </button>
            ))}
          </div>
          <p className="text-sm font-medium text-pos-ocean sm:col-span-2">
            {validDates
              ? `${shortDate(checkIn)} – ${shortDate(checkOut)} · ${n} ${n === 1 ? "night" : "nights"}`
              : "Choose an arrival from today and a departure after it"}
          </p>
        </div>

        <div>
          <p className="flex items-center gap-2 text-sm font-semibold mb-2">
            <span className="grid size-6 place-items-center rounded-full bg-pos-ocean text-xs text-white">
              2
            </span>
            Pick a free room
          </p>
          {free.isLoading && (
            <p className="flex items-center gap-2 text-sm text-pos-muted">
              <LoaderCircle size={14} className="animate-spin" /> Checking rooms
            </p>
          )}
          {free.isError && (
            <p className="text-sm text-red-700">Couldn't check rooms. {posError(free.error)}</p>
          )}
          {free.data && freeByType.length === 0 && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              No room is free for all these nights. Try other dates.
            </p>
          )}
          <div className="grid gap-4">
            {freeByType.map(([typeName, list]) => (
              <section key={typeName} aria-label={typeName}>
                <p className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-medium">{typeName}</span>
                  <span className="text-xs text-pos-muted">
                    {taka(list[0]!.nightly_rate_cents)} / night ·{" "}
                    <span className="font-medium text-pos-teal">{list.length} free</span>
                  </span>
                </p>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((r) => {
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
                              <span className="block font-medium">{r.room_name}</span>
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
                                onClick={() =>
                                  setPicked((p) => ({ ...p, [r.room_unit_id]: guests - 1 }))
                                }
                                className="grid size-9 place-items-center disabled:opacity-30"
                              >
                                <Minus size={14} />
                              </button>
                              <span
                                className="w-6 text-center text-sm tabular-nums"
                                aria-label="Guests"
                              >
                                {guests}
                              </span>
                              <button
                                type="button"
                                aria-label="More guests"
                                disabled={guests >= r.max_guests}
                                onClick={() =>
                                  setPicked((p) => ({ ...p, [r.room_unit_id]: guests + 1 }))
                                }
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
              </section>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <p className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <span className="grid size-6 place-items-center rounded-full bg-pos-ocean text-xs text-white">
              3
            </span>
            Guest details
          </p>
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
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="wi-note">
              Note <span className="font-normal text-pos-muted">(optional)</span>
            </Label>
            <Input
              id="wi-note"
              placeholder="Late arrival, advance paid by bKash, etc."
              className="h-11 text-base sm:text-sm"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {problem && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {problem}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pos-line pt-4">
          <p>
            <span className="text-xs text-pos-muted">
              Room total{seasonal ? " · includes seasonal / weekend prices" : ""}
            </span>
            <span className="block text-2xl font-semibold tabular-nums">{taka(total)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={arrivingToday ? "outline" : "default"}
              onClick={() => submit("book")}
              disabled={action.isPending}
              className={`h-11 gap-2 px-5 ${arrivingToday ? "" : "bg-pos-ocean text-white hover:bg-pos-ocean/90"}`}
            >
              {action.isPending && action.variables === "book" ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <CalendarPlus size={16} />
              )}{" "}
              {arrivingToday ? "Book only" : "Save booking"}
            </Button>
            {arrivingToday && (
              <Button
                onClick={() => submit("check_in")}
                disabled={action.isPending}
                className="h-11 gap-2 bg-pos-ocean px-6 text-white hover:bg-pos-ocean/90"
              >
                {action.isPending && action.variables === "check_in" ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}{" "}
                Check in now
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
