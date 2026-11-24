import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Check,
  CircleCheck,
  LoaderCircle,
  Minus,
  Plus,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth-context";
import { getMyReservations, getGuestProfile } from "@/lib/resort.functions";
import { type AvailableRoom } from "@/components/room-card";
import { RoomSpecs } from "@/components/room-categories";
import {
  allocateGuests,
  formatMoney,
  groupUnits,
  pickUnits,
  selectionProblem,
} from "@/lib/room-booking";
import { roomMedia, useRoomTypes } from "@/lib/rooms";
import {
  addonLines,
  categoryLabel,
  describeQuantity,
  isToggleUnit,
  unitLabel,
  type Addon,
  type AddonCategory,
} from "@/lib/addons";

const todayDate = () => new Date().toISOString().slice(0, 10);
const prettyDate = (d: string, f = "EEE, d MMM yyyy") => format(new Date(`${d}T12:00:00`), f);
const STORAGE_KEY = "santa-monica-booking-draft";

const primaryBtn =
  "h-12 rounded-none bg-resort-gold px-7 text-[13px] font-medium text-resort-wood transition-colors hover:bg-primary hover:text-primary-foreground disabled:bg-resort-sand disabled:text-muted-foreground";
const ghostBtn = "h-12 rounded-none px-4 text-[13px] text-foreground";

type Draft = {
  checkIn: string;
  checkOut: string;
  qty: Record<string, number>;
  chosen: Record<string, number>;
};

function readDraft(checkIn?: string, checkOut?: string): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    return draft.checkIn === checkIn && draft.checkOut === checkOut ? draft : null;
  } catch {
    return null;
  }
}

function StepTitle({ step, title, copy }: { step: number; title: string; copy?: string }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-resort-ocean">Step {step} of 5</p>
      <h2 className="mt-2 text-[28px] leading-tight text-primary sm:text-[32px]">{title}</h2>
      {copy && <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>}
    </div>
  );
}

export function BookingFlow() {
  const user = useCurrentUser();
  const search = useSearch({ from: "/booking" });
  const queryClient = useQueryClient();
  const [step, setStep] = useState(search.checkIn && search.checkOut ? 2 : 1);
  const [checkIn, setCheckIn] = useState(search.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(search.checkOut ?? "");
  const [guestCount, setGuestCount] = useState(Math.min(6, Math.max(1, search.guests ?? 2)));
  const [qty, setQty] = useState<Record<string, number>>({});
  const [presetApplied, setPresetApplied] = useState(!search.room);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [bookedRooms, setBookedRooms] = useState<{ title: string; reference: string }[]>([]);
  const [bookedPhone, setBookedPhone] = useState("");
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [message, setMessage] = useState("");

  // Bring back rooms and extras chosen before a guest left to sign in.
  useEffect(() => {
    const draft = readDraft(search.checkIn, search.checkOut);
    if (draft && Object.values(draft.qty ?? {}).some((n) => n > 0)) {
      setQty(draft.qty);
      setPresetApplied(true);
      setChosen(draft.chosen);
      setStep(4);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (Object.values(qty).some((n) => n > 0) && step < 6) {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ checkIn, checkOut, qty, chosen } satisfies Draft),
        );
      }
    } catch {
      /* storage unavailable: the draft simply isn't kept */
    }
  }, [checkIn, checkOut, qty, chosen, step]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const nights = useMemo(
    () =>
      checkIn && checkOut
        ? Math.max(
            1,
            Math.round(
              (new Date(`${checkOut}T12:00:00`).getTime() -
                new Date(`${checkIn}T12:00:00`).getTime()) /
                86400000,
            ),
          )
        : 0,
    [checkIn, checkOut],
  );

  const roomQuery = useQuery({
    queryKey: ["available-rooms", checkIn, checkOut],
    enabled: Boolean(checkIn && checkOut && checkOut > checkIn),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_rooms", {
        p_check_in: checkIn,
        p_check_out: checkOut,
      });
      if (error) throw new Error("Availability couldn't be checked right now.");
      return (data ?? []) as AvailableRoom[];
    },
  });

  const addonQuery = useQuery({
    queryKey: ["resort-addons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resort_addons")
        .select("id, category, name, description, price_cents, unit")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw new Error("Meals and extras couldn't be loaded right now.");
      return (data ?? []) as Addon[];
    },
  });

  const typesQuery = useRoomTypes();
  const types = typesQuery.data ?? [];
  const freeByType = useMemo(() => groupUnits(roomQuery.data ?? []), [roomQuery.data]);
  const selectedRooms = useMemo(() => pickUnits(roomQuery.data ?? [], qty), [roomQuery.data, qty]);
  const presetType = types.find((t) => t.slug === search.room);

  // A room chosen on the Rooms page or a room page arrives pre-selected.
  useEffect(() => {
    if (presetApplied || !presetType || !roomQuery.data) return;
    const free = freeByType.get(presetType.id)?.length ?? 0;
    if (free > 0) setQty({ [presetType.id]: Math.min(free, search.rooms ?? 1) });
    setPresetApplied(true);
  }, [presetApplied, presetType, roomQuery.data, freeByType, search.rooms]);

  const setRoomQty = (typeId: string, count: number) => {
    setMessage("");
    const free = freeByType.get(typeId)?.length ?? 0;
    setQty((current) => ({ ...current, [typeId]: Math.max(0, Math.min(free, count)) }));
  };
  const setAddon = (id: string, count: number) =>
    setChosen((c) => ({ ...c, [id]: Math.max(0, Math.min(20, count)) }));

  const allocation = useMemo(
    () => allocateGuests(selectedRooms, guestCount),
    [selectedRooms, guestCount],
  );
  const problem = selectionProblem(selectedRooms, guestCount);
  const roomsTotal = selectedRooms.reduce((sum, room) => sum + room.nightly_rate_cents * nights, 0);
  const lines = useMemo(
    () => addonLines(addonQuery.data ?? [], chosen, guestCount, nights),
    [addonQuery.data, chosen, guestCount, nights],
  );
  const extrasTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const grandTotal = roomsTotal + extrasTotal;
  const roomWord = (count: number) => `${count} ${count === 1 ? "room" : "rooms"}`;
  const roomLines = types
    .map((type) => {
      const count = selectedRooms.filter((r) => r.room_type_id === type.id).length;
      return { type, count, total: type.nightly_rate_cents * nights * count };
    })
    .filter((line) => line.count > 0);
  const nightWord = `${nights} ${nights === 1 ? "night" : "nights"}`;
  const guestWord = `${guestCount} ${guestCount === 1 ? "guest" : "guests"}`;

  const createReservation = useMutation({
    mutationFn: async () => {
      if (selectedRooms.length === 0 || !allocation)
        throw new Error("Please choose your rooms before sending the request.");
      const rooms = roomLines.map((line) => ({ room_type_id: line.type.id, count: line.count }));
      const extras = lines.map((l) => ({ addon_id: l.addon.id, count: chosen[l.addon.id] ?? 0 }));
      const { data, error } = await supabase.rpc("create_booking", {
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_guests: guestCount,
        p_rooms: rooms,
        p_addons: extras,
        p_name: contact.name,
        p_phone: contact.phone,
        p_email: contact.email,
        p_note: note,
      });
      if (error) {
        if (error.code === "P0002") {
          void roomQuery.refetch();
          throw new Error(error.message);
        }
        if (error.code === "P0001") throw new Error(error.message);
        throw new Error(
          "We couldn't send your request. Please check your connection and try again.",
        );
      }
      return (data ?? []).map((row) => ({
        title: `${row.type_name} · ${row.unit_name}`,
        reference: row.reference,
      }));
    },
    onSuccess: async (rooms) => {
      setBookedRooms(rooms);
      setBookedPhone(contact.phone);
      setMessage("");
      setStep(6);
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      await queryClient.invalidateQueries({ queryKey: ["my-stays"] });
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "We couldn't send your request."),
  });

  const steps = ["Dates", "Rooms", "Meals & extras", "Your details", "Review"];
  const grouped = useMemo(() => {
    const groups = new Map<AddonCategory, Addon[]>();
    for (const a of addonQuery.data ?? [])
      groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
    return [...groups.entries()];
  }, [addonQuery.data]);

  return (
    <div className="min-h-[70svh] bg-resort-cream pb-24">
      <div className="border-b border-border bg-resort-white px-5 py-10 sm:px-8 lg:py-12">
        <div className="mx-auto max-w-[1180px]">
          <p className="text-[13px] font-medium text-resort-ocean">Reservation request</p>
          <h1 className="mt-2 text-[34px] leading-tight text-primary sm:text-[44px]">
            {step === 6 ? "Request received" : "Book your stay"}
          </h1>
          {step < 6 && (
            <ol className="mt-8 grid grid-cols-5 gap-2" aria-label="Booking progress">
              {steps.map((label, index) => {
                const n = index + 1;
                const state = step > n ? "done" : step === n ? "current" : "todo";
                return (
                  <li key={label} aria-current={state === "current" ? "step" : undefined}>
                    <span
                      className={`block h-1 transition-colors duration-500 ${state === "todo" ? "bg-border" : state === "current" ? "bg-resort-gold" : "bg-primary"}`}
                    />
                    <span
                      className={`mt-3 flex items-center gap-1.5 text-[11px] sm:text-[13px] ${state === "todo" ? "text-muted-foreground" : "text-primary"}`}
                    >
                      {state === "done" && <Check size={13} className="hidden sm:block" />}
                      <span className="sm:hidden">{n}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-[1180px] gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0 bg-resort-white p-6 sm:p-9">
          {step === 1 && (
            <>
              {presetType && (
                <p className="mb-6 border-l-2 border-resort-gold bg-resort-cream px-4 py-3 text-sm text-foreground">
                  You're booking <span className="font-medium text-primary">{presetType.name}</span>
                  {search.rooms && search.rooms > 1 ? ` × ${search.rooms} rooms` : ""}. Choose your
                  dates to see the bill.
                </p>
              )}
              <StepTitle
                step={1}
                title="When are you coming?"
                copy="Choose your dates and how many people are travelling."
              />
              <div className="mt-8 grid gap-5 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="arrival">Arrival</Label>
                  <Input
                    id="arrival"
                    type="date"
                    className="h-11 rounded-none"
                    min={todayDate()}
                    value={checkIn}
                    onChange={(event) => {
                      setCheckIn(event.target.value);
                      if (checkOut && event.target.value >= checkOut) setCheckOut("");
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="departure">Departure</Label>
                  <Input
                    id="departure"
                    type="date"
                    className="h-11 rounded-none"
                    min={checkIn || todayDate()}
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="guests">Guests</Label>
                  <div className="flex h-11 items-center justify-between border border-input px-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Fewer guests"
                      onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                    >
                      <Minus size={14} />
                    </Button>
                    <span id="guests" className="tabular-nums">
                      {guestCount}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="More guests"
                      onClick={() => setGuestCount(Math.min(6, guestCount + 1))}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
              </div>
              {checkIn && checkOut && checkOut <= checkIn && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  Departure must be after arrival
                </p>
              )}
              <div className="mt-10 flex justify-end">
                <Button
                  className={primaryBtn}
                  disabled={!checkIn || !checkOut || checkOut <= checkIn}
                  onClick={() => {
                    setStep(2);
                    void roomQuery.refetch();
                  }}
                >
                  See available rooms <ArrowRight size={15} />
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <StepTitle
                step={2}
                title="Choose your rooms"
                copy={`${prettyDate(checkIn, "d MMM")} to ${prettyDate(checkOut, "d MMM yyyy")} · ${nightWord} · ${guestWord}. Travelling as a group? Select more than one room.`}
              />
              {roomQuery.isFetching && (
                <p
                  role="status"
                  className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <LoaderCircle className="animate-spin" size={16} />
                  Checking availability
                </p>
              )}
              {roomQuery.isError && (
                <p role="alert" className="mt-8 text-sm text-destructive">
                  {roomQuery.error.message}{" "}
                  <button type="button" className="underline" onClick={() => roomQuery.refetch()}>
                    Try again
                  </button>
                </p>
              )}
              {!roomQuery.isFetching && roomQuery.data?.length === 0 && (
                <div className="mt-8 border border-border p-6">
                  <BedDouble size={24} className="text-resort-ocean" />
                  <h3 className="mt-4 text-2xl text-primary">No rooms free on these dates</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    The rooms are either booked or not yet published. Try different dates.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5 rounded-none"
                    onClick={() => setStep(1)}
                  >
                    Change dates
                  </Button>
                </div>
              )}
              <ul className="mt-6 grid gap-5">
                {types
                  .filter((type) => (freeByType.get(type.id)?.length ?? 0) > 0)
                  .map((type, i) => {
                    const free = freeByType.get(type.id)?.length ?? 0;
                    const count = Math.min(qty[type.id] ?? 0, free);
                    const on = count > 0;
                    return (
                      <li
                        key={type.id}
                        className={`grid border transition-colors sm:grid-cols-[200px_1fr] ${on ? "border-primary bg-resort-ocean-soft/30" : "border-border"}`}
                      >
                        <div className="sagara-image-frame aspect-[4/3] sm:aspect-auto sm:h-full">
                          <img
                            src={roomMedia(type, i).photos[0]}
                            alt={type.name}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        </div>
                        <div className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-xl text-primary">{type.name}</h3>
                              <Link
                                to="/rooms/$slug"
                                params={{ slug: type.slug }}
                                target="_blank"
                                className="text-xs text-resort-ocean underline-offset-4 hover:underline"
                              >
                                Photos, 360° and details
                              </Link>
                            </div>
                            <p className="text-right">
                              <span className="block font-display text-xl tabular-nums text-primary">
                                {formatMoney(type.nightly_rate_cents)}
                              </span>
                              <span className="text-xs text-muted-foreground">per night</span>
                            </p>
                          </div>
                          <div className="mt-4 text-[13px]">
                            <RoomSpecs room={type} />
                          </div>
                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                            <span
                              className={`text-xs ${free <= 2 ? "text-resort-gold-deep" : "text-muted-foreground"}`}
                            >
                              {free} {free === 1 ? "room" : "rooms"} free
                            </span>
                            <div className="flex items-center gap-3">
                              {on && (
                                <span className="text-sm tabular-nums text-primary">
                                  {formatMoney(type.nightly_rate_cents * nights * count)}
                                </span>
                              )}
                              <div className="flex h-10 items-center border border-input bg-resort-white">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-10 rounded-none"
                                  aria-label={`Fewer ${type.name} rooms`}
                                  disabled={!on}
                                  onClick={() => setRoomQty(type.id, count - 1)}
                                >
                                  <Minus size={14} />
                                </Button>
                                <span className="w-10 text-center tabular-nums" aria-live="polite">
                                  {count}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-10 rounded-none"
                                  aria-label={`More ${type.name} rooms`}
                                  disabled={count >= free}
                                  onClick={() => setRoomQty(type.id, count + 1)}
                                >
                                  <Plus size={14} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
              {typesQuery.isLoading && (
                <p role="status" className="mt-6 text-sm text-muted-foreground">
                  Loading room details
                </p>
              )}
              {roomLines.length > 0 && (
                <div className="mt-8 bg-resort-cream p-5 sm:p-6">
                  <p className="text-[13px] font-medium text-resort-ocean">Your bill</p>
                  <ul className="mt-3 divide-y divide-border">
                    {roomLines.map((line) => (
                      <li key={line.type.id} className="flex justify-between gap-3 py-3 text-sm">
                        <span>
                          <span className="block text-primary">{line.type.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatMoney(line.type.nightly_rate_cents)} × {nightWord} ×{" "}
                            {roomWord(line.count)}
                          </span>
                        </span>
                        <span className="tabular-nums text-primary">{formatMoney(line.total)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 flex items-baseline justify-between border-t border-border pt-4">
                    <span className="text-sm text-muted-foreground">
                      Rooms total · {roomWord(selectedRooms.length)}
                    </span>
                    <span className="font-display text-2xl tabular-nums text-primary">
                      {formatMoney(roomsTotal)}
                    </span>
                  </p>
                </div>
              )}
              {problem && selectedRooms.length > 0 && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {problem}
                </p>
              )}
              <div className="mt-10 flex justify-between gap-3">
                <Button variant="ghost" className={ghostBtn} onClick={() => setStep(1)}>
                  <ArrowLeft size={15} /> Dates
                </Button>
                <Button className={primaryBtn} disabled={!allocation} onClick={() => setStep(3)}>
                  Continue <ArrowRight size={15} />
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepTitle
                step={3}
                title="Add meals and extras"
                copy="Optional. Prices are worked out for your guests and nights, and the resort confirms everything with your stay."
              />
              {addonQuery.isLoading && (
                <p
                  role="status"
                  className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <LoaderCircle className="animate-spin" size={16} /> Loading the menu
                </p>
              )}
              {addonQuery.isError && (
                <p role="alert" className="mt-8 text-sm text-destructive">
                  {addonQuery.error.message} You can continue and add them later with the resort.
                </p>
              )}
              {addonQuery.data?.length === 0 && (
                <p className="mt-8 text-sm text-muted-foreground">
                  The resort hasn't listed meals or extras yet. You can mention them in your note.
                </p>
              )}
              <div className="mt-8 grid gap-10">
                {grouped.map(([category, items]) => (
                  <div key={category}>
                    <h3 className="flex items-center gap-3 text-xl text-primary">
                      {category === "food" && (
                        <UtensilsCrossed size={18} className="text-resort-gold-deep" />
                      )}
                      {categoryLabel[category]}
                    </h3>
                    <ul className="mt-4 divide-y divide-border border-y border-border">
                      {items.map((addon) => {
                        const count = chosen[addon.id] ?? 0;
                        const on = count > 0;
                        const line = lines.find((l) => l.addon.id === addon.id);
                        return (
                          <li
                            key={addon.id}
                            className={`grid gap-4 py-5 transition-colors sm:grid-cols-[1fr_auto] sm:items-center ${on ? "bg-resort-ocean-soft/40 -mx-3 px-3" : ""}`}
                          >
                            <div>
                              <p className="font-medium text-primary">{addon.name}</p>
                              {addon.description && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {addon.description}
                                </p>
                              )}
                              <p className="mt-2 text-[13px] text-foreground">
                                <span className="tabular-nums">
                                  {formatMoney(addon.price_cents)}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {unitLabel[addon.unit]}
                                </span>
                                {line && (
                                  <span className="ml-2 text-resort-ocean">
                                    · {describeQuantity(addon.unit, count, guestCount, nights)} ={" "}
                                    <span className="tabular-nums">{formatMoney(line.total)}</span>
                                  </span>
                                )}
                              </p>
                            </div>
                            {isToggleUnit(addon.unit) ? (
                              <Button
                                type="button"
                                variant={on ? "default" : "outline"}
                                aria-pressed={on}
                                className="h-10 min-w-28 rounded-none"
                                onClick={() => setAddon(addon.id, on ? 0 : 1)}
                              >
                                {on ? (
                                  <>
                                    <Check size={15} /> Added
                                  </>
                                ) : (
                                  "Add"
                                )}
                              </Button>
                            ) : (
                              <div className="flex h-10 w-fit items-center gap-1 border border-input">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 rounded-none"
                                  aria-label={`Fewer ${addon.name}`}
                                  disabled={!on}
                                  onClick={() => setAddon(addon.id, count - 1)}
                                >
                                  <Minus size={14} />
                                </Button>
                                <span className="w-8 text-center tabular-nums" aria-live="polite">
                                  {count}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 rounded-none"
                                  aria-label={`More ${addon.name}`}
                                  onClick={() => setAddon(addon.id, count + 1)}
                                >
                                  <Plus size={14} />
                                </Button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex flex-wrap justify-between gap-3">
                <Button variant="ghost" className={ghostBtn} onClick={() => setStep(2)}>
                  <ArrowLeft size={15} /> Rooms
                </Button>
                <Button className={primaryBtn} onClick={() => setStep(4)}>
                  {lines.length > 0 ? "Continue" : "Continue without extras"}{" "}
                  <ArrowRight size={15} />
                </Button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <StepTitle
                step={4}
                title="Your details"
                copy="No account needed. The resort uses these to confirm your stay."
              />
              <GuestDetails value={contact} onChange={setContact} onContinue={() => setStep(5)} />
              {!user && (
                <p className="mt-6 text-xs text-muted-foreground">
                  Have an account?{" "}
                  <Link
                    to="/auth"
                    search={{ next: "/booking", checkIn, checkOut, guests: guestCount }}
                    className="text-resort-ocean underline-offset-4 hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  to keep all your bookings in one place. Your choices are kept.
                </p>
              )}
              <div className="mt-8">
                <Button variant="ghost" className={ghostBtn} onClick={() => setStep(3)}>
                  <ArrowLeft size={15} /> Meals & extras
                </Button>
              </div>
            </>
          )}

          {step === 5 && selectedRooms.length > 0 && allocation && (
            <>
              <StepTitle step={5} title="Review your request" />
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-6 text-sm sm:grid-cols-3">
                {[
                  ["Arrival", prettyDate(checkIn)],
                  ["Departure", prettyDate(checkOut)],
                  ["Length", nightWord],
                  ["Guests", guestWord],
                  ["Name", contact.name],
                  ["Mobile", contact.phone],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="mt-1 font-medium text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="mt-8 text-lg text-primary">Rooms</h3>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {selectedRooms.map((room, index) => (
                  <li className="flex justify-between gap-3 py-4 text-sm" key={room.room_unit_id}>
                    <span>
                      <span className="block font-medium text-primary">{room.type_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {room.room_name} · {allocation[index]}{" "}
                        {allocation[index] === 1 ? "guest" : "guests"} ·{" "}
                        {formatMoney(room.nightly_rate_cents)} per night
                      </span>
                    </span>
                    <span className="font-medium tabular-nums text-primary">
                      {formatMoney(room.nightly_rate_cents * nights)}
                    </span>
                  </li>
                ))}
              </ul>
              {lines.length > 0 && (
                <>
                  <h3 className="mt-8 text-lg text-primary">Meals and extras</h3>
                  <ul className="mt-3 divide-y divide-border border-y border-border">
                    {lines.map((l) => (
                      <li key={l.addon.id} className="flex justify-between gap-3 py-4 text-sm">
                        <span>
                          <span className="block font-medium text-primary">{l.addon.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatMoney(l.addon.price_cents)} {unitLabel[l.addon.unit]} ·{" "}
                            {describeQuantity(
                              l.addon.unit,
                              chosen[l.addon.id] ?? 0,
                              guestCount,
                              nights,
                            )}
                          </span>
                        </span>
                        <span className="font-medium tabular-nums text-primary">
                          {formatMoney(l.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-6 flex items-baseline justify-between border-b border-border pb-6">
                <span className="text-sm text-muted-foreground">Estimated total</span>
                <span className="font-display text-3xl tabular-nums text-primary">
                  {formatMoney(grandTotal)}
                </span>
              </p>
              <div className="mt-6 grid gap-2">
                <Label htmlFor="guest-note">
                  Anything we should know?{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="guest-note"
                  value={note}
                  maxLength={500}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Arrival time, food allergies, special requests"
                  rows={3}
                  className="rounded-none"
                />
              </div>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                This sends a reservation request. No payment is taken here. The resort will contact
                you to confirm.
              </p>
              {message && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {message}
                </p>
              )}
              <div className="mt-8 flex flex-wrap justify-between gap-3">
                <Button variant="ghost" className={ghostBtn} onClick={() => setStep(4)}>
                  <ArrowLeft size={15} /> Your details
                </Button>
                <Button
                  className={primaryBtn}
                  disabled={createReservation.isPending}
                  onClick={() => createReservation.mutate()}
                >
                  {createReservation.isPending ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" /> Sending
                    </>
                  ) : (
                    <>
                      Send request <ArrowRight size={15} />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 5 && (selectedRooms.length === 0 || !allocation) && (
            <div className="py-6">
              <p className="text-sm text-muted-foreground">
                Your room selection was cleared. Please choose your rooms again.
              </p>
              <Button className={`mt-5 ${primaryBtn}`} onClick={() => setStep(2)}>
                Choose rooms
              </Button>
            </div>
          )}

          {step === 6 && (
            <div className="py-6 sm:py-10">
              <div className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-resort-ocean-soft text-resort-ocean">
                  <CircleCheck size={30} />
                </span>
                <h2 className="mt-6 text-[32px] text-primary">Thank you, your request is in</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                  Your rooms are held for these dates while the resort reviews your request.
                </p>
              </div>
              <div className="mx-auto mt-8 max-w-sm border-y border-border py-5 text-center">
                <p className="text-xs font-medium text-muted-foreground">
                  {bookedRooms.length > 1 ? "Your references" : "Your reference"} · keep{" "}
                  {bookedRooms.length > 1 ? "them" : "it"} safe
                </p>
                {bookedRooms.map((item) => (
                  <div key={item.reference} className="mt-3">
                    {bookedRooms.length > 1 && (
                      <p className="text-xs text-muted-foreground">{item.title}</p>
                    )}
                    <p className="font-display text-2xl tracking-[0.12em] text-primary">
                      {item.reference}
                    </p>
                  </div>
                ))}
              </div>
              <ol className="mx-auto mt-8 grid max-w-lg gap-4">
                {[
                  [
                    "The resort reviews your request",
                    "Rooms, dates, meals and extras are checked.",
                  ],
                  [
                    `You get a call or message on ${bookedPhone || "your phone"}`,
                    "To confirm your stay and explain how to pay.",
                  ],
                  [
                    "Your booking is confirmed",
                    "Check its status any time with your reference and phone number.",
                  ],
                ].map(([title, copy], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm text-primary-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block font-medium text-primary">{title}</span>
                      <span className="block text-sm text-muted-foreground">{copy}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Button className={primaryBtn} asChild>
                  <Link to="/my-stays">Check booking status</Link>
                </Button>
                <Button variant="outline" className="h-12 rounded-none" asChild>
                  <Link to="/">Back to home</Link>
                </Button>
              </div>
            </div>
          )}
        </section>

        {step < 6 && (
          <aside className="h-fit bg-resort-white p-6 lg:sticky lg:top-24">
            <p className="text-[13px] font-medium text-resort-ocean">Your stay</p>
            {checkIn && checkOut && checkOut > checkIn ? (
              <p className="mt-2 font-display text-xl text-primary">
                {prettyDate(checkIn, "d MMM")} – {prettyDate(checkOut, "d MMM")}
              </p>
            ) : (
              <p className="mt-2 font-display text-xl text-primary">Choose your dates</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {nights > 0 ? `${nightWord} · ` : ""}
              {guestWord}
            </p>
            {selectedRooms.length > 0 && (
              <div className="mt-6 border-t border-border pt-5">
                <p className="text-sm font-medium text-primary">{roomWord(selectedRooms.length)}</p>
                <ul className="mt-3 grid gap-2 text-sm">
                  {roomLines.map((line) => (
                    <li key={line.type.id} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {line.type.name} × {line.count}
                      </span>
                      <span className="tabular-nums text-primary">{formatMoney(line.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lines.length > 0 && (
              <div className="mt-5 border-t border-border pt-5">
                <p className="text-sm font-medium text-primary">Meals and extras</p>
                <ul className="mt-3 grid gap-2 text-sm">
                  {lines.map((l) => (
                    <li key={l.addon.id} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{l.addon.name}</span>
                      <span className="tabular-nums text-primary">{formatMoney(l.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedRooms.length > 0 && (
              <p className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
                <span className="text-sm text-muted-foreground">Estimated total</span>
                <span className="font-display text-2xl tabular-nums text-primary">
                  {formatMoney(grandTotal)}
                </span>
              </p>
            )}
            <p className="mt-6 border-l-2 border-resort-gold pl-3 text-xs leading-5 text-muted-foreground">
              Rooms are checked against live availability. Nothing is confirmed until the resort
              contacts you.
            </p>
          </aside>
        )}
        {step > 1 && step < 6 && selectedRooms.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-border bg-resort-white/95 px-5 py-3 backdrop-blur lg:hidden">
            <span className="text-xs text-muted-foreground">
              {roomWord(selectedRooms.length)} · {nightWord}
              {lines.length > 0 ? " · extras" : ""}
            </span>
            <span className="text-right">
              <span className="block text-[11px] text-muted-foreground">Estimated total</span>
              <span className="font-display text-xl tabular-nums text-primary">
                {formatMoney(grandTotal)}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

type Contact = { name: string; phone: string; email: string };

const phonePattern = /^\+?[0-9-]{7,20}$/;

function GuestDetails({
  value,
  onChange,
  onContinue,
}: {
  value: Contact;
  onChange: (next: Contact) => void;
  onContinue: () => void;
}) {
  const user = useCurrentUser();
  const { data: profile } = useQuery({
    queryKey: ["guest-profile", user?.id],
    queryFn: () => getGuestProfile(),
    enabled: Boolean(user),
  });
  const [error, setError] = useState("");

  // Signed-in guests start with their saved name, phone and email.
  useEffect(() => {
    if (!profile && !user) return;
    onChange({
      name: value.name || profile?.display_name || "",
      phone: value.phone || profile?.phone || "",
      email: value.email || user?.email || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = value.phone.replace(/\s+/g, "");
    if (value.name.trim().length < 2) return setError("Please enter your full name");
    if (!phonePattern.test(phone))
      return setError("Please enter a valid mobile number, e.g. 01712 345678");
    if (value.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email.trim()))
      return setError("Please check your email address, or leave it empty");
    setError("");
    onChange({ ...value, name: value.name.trim(), phone, email: value.email.trim() });
    onContinue();
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 grid gap-5 sm:grid-cols-2">
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="guest-name">Full name</Label>
        <Input
          id="guest-name"
          autoComplete="name"
          className="h-12 rounded-none"
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="guest-phone">Mobile number</Label>
        <Input
          id="guest-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01712 345678"
          className="h-12 rounded-none"
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
          required
        />
        <span className="text-xs text-muted-foreground">
          The resort calls this number to confirm
        </span>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="guest-email">
          Email <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="guest-email"
          type="email"
          autoComplete="email"
          className="h-12 rounded-none"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" className={primaryBtn}>
          Continue to review <ArrowRight size={15} />
        </Button>
      </div>
    </form>
  );
}

type StayRow = Awaited<ReturnType<typeof getMyReservations>>[number];

export function GuestStaysPage() {
  const user = useCurrentUser();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-stays", user?.id],
    queryFn: () => getMyReservations(),
    enabled: Boolean(user),
  });
  return (
    <div className="min-h-[70svh] bg-resort-cream pb-24">
      <div className="border-b border-border bg-resort-white px-5 py-10 sm:px-8 lg:py-12">
        <div className="mx-auto max-w-[1000px]">
          <p className="text-[13px] font-medium text-resort-ocean">Your account</p>
          <h1 className="mt-2 text-[34px] leading-tight text-primary sm:text-[44px]">My stays</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your reservation requests and their status
          </p>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-[1000px] px-5 sm:px-8">
        {isLoading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={16} /> Loading your stays
          </p>
        )}
        {isError && (
          <p role="alert" className="text-sm text-destructive">
            Your stays couldn't be loaded.{" "}
            <button type="button" className="underline" onClick={() => refetch()}>
              Try again
            </button>
          </p>
        )}
        {!user && (
          <>
            <BookingLookup />
            <p className="mt-6 text-sm text-muted-foreground">
              Have an account?{" "}
              <Link
                to="/auth"
                search={{ next: "/my-stays" }}
                className="text-resort-ocean underline-offset-4 hover:underline"
              >
                Sign in
              </Link>{" "}
              to see all your stays.
            </p>
          </>
        )}
        {user && !isLoading && !isError && data?.length === 0 && (
          <div className="bg-resort-white p-8">
            <BedDouble size={24} className="text-resort-ocean" />
            <h2 className="mt-4 text-2xl text-primary">No stays yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your reservation requests will appear here.
            </p>
            <Button className={`mt-6 ${primaryBtn}`} asChild>
              <Link to="/booking">
                Book a room <ArrowRight size={15} />
              </Link>
            </Button>
          </div>
        )}
        <div className="grid gap-4">
          {data?.map((reservation: StayRow) => {
            const room = reservation.room_units as unknown as {
              name: string;
              room_types: { name: string };
            } | null;
            const extras = (reservation.reservation_addons ?? []) as unknown as {
              quantity: number;
              total_cents: number;
              resort_addons: { name: string } | null;
            }[];
            const extrasTotal = extras.reduce((s, e) => s + e.total_cents, 0);
            const statusStyle =
              reservation.status === "confirmed"
                ? "bg-resort-ocean-soft text-resort-ocean"
                : reservation.status === "cancelled"
                  ? "bg-muted text-muted-foreground"
                  : "bg-resort-sand text-primary";
            return (
              <article
                key={reservation.id}
                className="grid gap-5 bg-resort-white p-6 sm:grid-cols-[1fr_auto] sm:p-8"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl text-primary">{room?.room_types?.name ?? "Stay"}</h2>
                    <span className={`px-2.5 py-1 text-xs capitalize ${statusStyle}`}>
                      {reservation.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {prettyDate(reservation.check_in, "d MMM yyyy")} –{" "}
                    {prettyDate(reservation.check_out, "d MMM yyyy")} · {reservation.guest_count}{" "}
                    guests
                  </p>
                  {extras.length > 0 && (
                    <p className="mt-2 text-sm text-foreground">
                      Extras:{" "}
                      {extras
                        .map((e) => e.resort_addons?.name)
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reference {reservation.booking_reference}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-muted-foreground">Estimate</p>
                  <p className="mt-1 font-display text-2xl tabular-nums text-primary">
                    {formatMoney(reservation.total_cents + extrasTotal)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type FoundBooking = {
  reference: string;
  status: "pending" | "confirmed" | "cancelled";
  check_in: string;
  check_out: string;
  guest_count: number;
  type_name: string;
  room_total_cents: number;
  extras_total_cents: number;
  extras: string;
};

const statusText = {
  pending: "Waiting for the resort to confirm",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
} as const;

function BookingLookup() {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<FoundBooking[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!reference.trim() || !phone.trim())
      return setError("Enter your reference and mobile number");
    setLoading(true);
    const { data, error: lookupError } = await supabase.rpc("find_booking", {
      p_reference: reference,
      p_phone: phone,
    });
    setLoading(false);
    if (lookupError) return setError("We couldn't check right now. Please try again.");
    if (!data || data.length === 0)
      return setError("No booking matches that reference and number. Check both and try again.");
    setResult(data as FoundBooking[]);
  }

  return (
    <div className="bg-resort-white p-6 sm:p-8">
      <h2 className="text-2xl text-primary">Check a booking</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Use the reference from your confirmation and the mobile number you booked with.
      </p>
      <form
        onSubmit={submit}
        noValidate
        className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div className="grid gap-2">
          <Label htmlFor="lookup-ref">Reference</Label>
          <Input
            id="lookup-ref"
            className="h-12 rounded-none uppercase placeholder:normal-case"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. 205A9F81E5"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lookup-phone">Mobile number</Label>
          <Input
            id="lookup-phone"
            type="tel"
            inputMode="tel"
            className="h-12 rounded-none"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="h-12 rounded-none bg-resort-gold px-7 text-[13px] font-medium text-resort-wood hover:bg-primary hover:text-primary-foreground"
        >
          {loading ? <LoaderCircle size={15} className="animate-spin" /> : "Check status"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-6 grid gap-3" aria-live="polite">
          {result.map((b) => (
            <article key={b.reference} className="border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl text-primary">{b.type_name}</h3>
                <span
                  className={`px-2.5 py-1 text-xs ${b.status === "confirmed" ? "bg-resort-ocean-soft text-resort-ocean" : b.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-resort-sand text-primary"}`}
                >
                  {statusText[b.status]}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {prettyDate(b.check_in, "d MMM yyyy")} – {prettyDate(b.check_out, "d MMM yyyy")} ·{" "}
                {b.guest_count} guests · Ref {b.reference}
              </p>
              {b.extras && <p className="mt-1 text-sm text-foreground">Extras: {b.extras}</p>}
              <p className="mt-2 font-display text-lg tabular-nums text-primary">
                {formatMoney(b.room_total_cents + b.extras_total_cents)}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
