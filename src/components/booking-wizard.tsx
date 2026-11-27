import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CircleCheck,
  Coffee,
  LoaderCircle,
  Minus,
  Plus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth-context";
import { getGuestProfile } from "@/lib/resort.functions";
import { isSeasonal, roomPrice, useStayQuotes } from "@/lib/stay-quote";
import type { AvailableRoom } from "@/components/room-card";
import {
  allocateGuests,
  formatMoney,
  groupUnits,
  pickUnits,
  selectionProblem,
} from "@/lib/room-booking";
import { nightsBetween, roomMedia, useRoomTypes } from "@/lib/rooms";

const today = () => new Date().toISOString().slice(0, 10);
const day = (d: string, f: string) => format(new Date(`${d}T12:00:00`), f);
const DRAFT_KEY = "santa-monica-booking-v3";
const phonePattern = /^\+?[0-9-]{7,20}$/;

const gold =
  "rounded-none bg-resort-gold font-medium text-resort-wood transition-colors hover:bg-primary hover:text-primary-foreground disabled:bg-resort-sand disabled:text-muted-foreground disabled:opacity-100";
const dateField =
  "h-12 w-full min-w-0 rounded-none border border-input bg-resort-white px-2 text-base text-foreground outline-none focus:border-resort-teal focus-visible:ring-2 focus-visible:ring-resort-teal/30 sm:px-3 sm:text-sm";

type Draft = { checkIn: string; checkOut: string; guests: number; qty: Record<string, number> };

function Stepper({
  value,
  min = 0,
  max,
  label,
  onChange,
}: {
  value: number;
  min?: number;
  max: number;
  label: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center border border-input bg-resort-white">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-none"
        aria-label={`Fewer ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={16} />
      </Button>
      <span className="w-8 text-center tabular-nums text-primary" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-none"
        aria-label={`More ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={16} />
      </Button>
    </div>
  );
}

/** Total and the main button. Fixed to the bottom on phones, inline on desktop. */
function ActionBar({
  total,
  caption,
  children,
}: {
  total: number;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-resort-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur lg:static lg:mt-8 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-6 lg:backdrop-blur-none">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight tabular-nums text-primary">
            {formatMoney(total)}
          </p>
          <p className="truncate text-xs text-muted-foreground">{caption}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

export function BookingFlow() {
  const user = useCurrentUser();
  const search = useSearch({ from: "/booking" });
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"rooms" | "confirm" | "done">("rooms");
  const [checkIn, setCheckIn] = useState(search.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(search.checkOut ?? "");
  const [guests, setGuests] = useState(Math.min(20, Math.max(1, search.guests ?? 2)));
  const [qty, setQty] = useState<Record<string, number>>({});
  const [presetDone, setPresetDone] = useState(!search.room);
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<{
    references: { title: string; reference: string }[];
    phone: string;
    total: number;
  } | null>(null);

  // Keep the choices if the page is reloaded mid-way.
  useEffect(() => {
    try {
      const draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
      if (!draft || search.room) return;
      const sameDates =
        !search.checkIn || (draft.checkIn === search.checkIn && draft.checkOut === search.checkOut);
      if (!sameDates) return;
      setCheckIn(draft.checkIn);
      setCheckOut(draft.checkOut);
      setGuests(draft.guests);
      setQty(draft.qty ?? {});
    } catch {
      /* no draft */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (step === "done") return;
    try {
      window.sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ checkIn, checkOut, guests, qty } satisfies Draft),
      );
    } catch {
      /* storage unavailable */
    }
  }, [checkIn, checkOut, guests, qty, step]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const nights = nightsBetween(checkIn, checkOut);
  const datesOk = nights > 0;

  const roomQuery = useQuery({
    queryKey: ["available-rooms", checkIn, checkOut],
    enabled: datesOk,
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("get_available_rooms", {
        p_check_in: checkIn,
        p_check_out: checkOut,
      });
      if (e) throw new Error("Availability couldn't be checked right now.");
      return (data ?? []) as AvailableRoom[];
    },
  });
  const typesQuery = useRoomTypes();
  const profile = useQuery({
    queryKey: ["guest-profile", user?.id],
    queryFn: () => getGuestProfile(),
    enabled: Boolean(user),
  });
  useEffect(() => {
    if (!user) return;
    setContact((c) => ({
      name: c.name || profile.data?.display_name || "",
      phone: c.phone || profile.data?.phone || "",
      email: c.email || user.email || "",
    }));
  }, [user, profile.data]);

  const units = useMemo(() => roomQuery.data ?? [], [roomQuery.data]);
  const types = typesQuery.data ?? [];
  const freeByType = useMemo(() => groupUnits(units), [units]);
  const selectedRooms = useMemo(() => pickUnits(units, qty), [units, qty]);
  const presetType = types.find((t) => t.slug === search.room);

  useEffect(() => {
    if (presetDone || !presetType || !roomQuery.data) return;
    const free = freeByType.get(presetType.id)?.length ?? 0;
    if (free > 0) setQty({ [presetType.id]: Math.min(free, search.rooms ?? 1) });
    setPresetDone(true);
  }, [presetDone, presetType, roomQuery.data, freeByType, search.rooms]);

  const quotes = useStayQuotes(
    types.map((t) => t.id),
    checkIn,
    checkOut,
    datesOk,
  ).data;
  const priceOf = (type: { id: string; nightly_rate_cents: number }) =>
    roomPrice(quotes, type.id, type.nightly_rate_cents, nights);
  const roomLines = types
    .map((type) => {
      const count = selectedRooms.filter((r) => r.room_type_id === type.id).length;
      return { type, count, total: priceOf(type) * count };
    })
    .filter((l) => l.count > 0);
  const total = roomLines.reduce((s, l) => s + l.total, 0);
  const allocation = useMemo(() => allocateGuests(selectedRooms, guests), [selectedRooms, guests]);
  const problem = selectedRooms.length > 0 ? selectionProblem(selectedRooms, guests) : null;

  const roomWord = (n: number) => `${n} ${n === 1 ? "room" : "rooms"}`;
  const nightWord = `${nights} ${nights === 1 ? "night" : "nights"}`;
  const guestWord = `${guests} ${guests === 1 ? "guest" : "guests"}`;
  const caption =
    [datesOk ? nightWord : "", selectedRooms.length ? roomWord(selectedRooms.length) : ""]
      .filter(Boolean)
      .join(" · ") || "Choose dates and rooms";

  const send = useMutation({
    mutationFn: async () => {
      const { data, error: e } = await supabase.rpc("create_booking", {
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_guests: guests,
        p_rooms: roomLines.map((l) => ({ room_type_id: l.type.id, count: l.count })),
        p_addons: [],
        p_name: contact.name,
        p_phone: contact.phone,
        p_email: contact.email,
        p_note: note,
      });
      if (e) {
        if (e.code === "P0002") {
          void roomQuery.refetch();
          throw new Error(e.message);
        }
        if (e.code === "P0001") throw new Error(e.message);
        throw new Error(
          "We couldn't send your request. Please check your connection and try again.",
        );
      }
      return (data ?? []).map((r) => ({
        title: `${r.type_name} · ${r.unit_name}`,
        reference: r.reference,
      }));
    },
    onSuccess: async (references) => {
      setBooked({ references, phone: contact.phone, total });
      setStep("done");
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      await queryClient.invalidateQueries({ queryKey: ["my-stays"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "We couldn't send your request."),
  });

  function confirm() {
    setError("");
    if (contact.name.trim().length < 2) return setError("Please enter your full name");
    if (!phonePattern.test(contact.phone.replace(/\s+/g, "")))
      return setError("Please enter a valid mobile number, e.g. 01712 345678");
    if (contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim()))
      return setError("Please check your email, or leave it empty");
    send.mutate();
  }

  const bill = (
    <div>
      <p className="text-[13px] font-medium text-resort-ocean">Your bill</p>
      {datesOk ? (
        <p className="mt-1 text-sm text-foreground">
          {day(checkIn, "d MMM")} – {day(checkOut, "d MMM yyyy")} · {nightWord} · {guestWord}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Choose your dates</p>
      )}
      {roomLines.length > 0 && (
        <ul className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
          {roomLines.map((l) => (
            <li key={l.type.id} className="flex justify-between gap-3">
              <span>
                {l.type.name} × {l.count}
                <span className="block text-xs text-muted-foreground">
                  {isSeasonal(quotes, l.type.id)
                    ? `${nightWord}, includes seasonal / weekend prices`
                    : `${formatMoney(l.type.nightly_rate_cents)} × ${nightWord}`}
                </span>
              </span>
              <span className="tabular-nums text-primary">{formatMoney(l.total)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-foreground">
        <Coffee size={16} className="text-resort-gold-deep" /> Breakfast included every morning
      </p>
      <p className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="font-display text-2xl tabular-nums text-primary">
          {formatMoney(total)}
        </span>
      </p>
    </div>
  );

  return (
    <div className="min-h-[70svh] bg-resort-cream pb-36 lg:pb-24">
      <div className="border-b border-border bg-resort-white px-4 py-5 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[1180px]">
          {step !== "done" ? (
            <>
              <div className="flex items-center gap-3">
                {step === "confirm" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-ml-2 size-11"
                    aria-label="Back to rooms"
                    onClick={() => setStep("rooms")}
                  >
                    <ArrowLeft size={20} />
                  </Button>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    Step {step === "rooms" ? 1 : 2} of 2
                  </p>
                  <h1 className="text-[26px] leading-tight text-primary sm:text-[36px]">
                    {step === "rooms" ? "Choose your rooms" : "Confirm your request"}
                  </h1>
                </div>
              </div>
              <ol className="mt-4 grid grid-cols-2 gap-1.5" aria-label="Booking progress">
                {["Rooms", "Confirm"].map((label, i) => {
                  const reached = i === 0 || step === "confirm";
                  return (
                    <li key={label}>
                      <span
                        className={`block h-1 transition-colors duration-500 ${reached ? "bg-resort-gold" : "bg-border"}`}
                      />
                      <span
                        className={`mt-1.5 hidden text-xs sm:block ${reached ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <h1 className="text-[28px] leading-tight text-primary sm:text-[40px]">
              Request received
            </h1>
          )}
        </div>
      </div>

      <div className="mx-auto mt-4 grid max-w-[1180px] grid-cols-1 gap-6 px-4 sm:mt-8 sm:px-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {step === "rooms" && (
            <>
              <section className="bg-resort-white p-4 sm:p-6" aria-label="Dates and guests">
                {presetType && (
                  <p className="mb-4 border-l-2 border-resort-gold bg-resort-cream px-3 py-2 text-sm">
                    Booking <span className="font-medium text-primary">{presetType.name}</span>
                    {datesOk ? "" : " · choose your dates"}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <label className="min-w-0 text-xs font-medium text-muted-foreground">
                    Arrival
                    <input
                      type="date"
                      className={`mt-1 ${dateField}`}
                      min={today()}
                      value={checkIn}
                      onChange={(e) => {
                        setCheckIn(e.target.value);
                        if (checkOut && e.target.value >= checkOut) setCheckOut("");
                      }}
                    />
                  </label>
                  <label className="min-w-0 text-xs font-medium text-muted-foreground">
                    Departure
                    <input
                      type="date"
                      className={`mt-1 ${dateField}`}
                      min={checkIn || today()}
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <Users size={18} className="text-resort-gold-deep" /> Guests
                  </span>
                  <Stepper value={guests} min={1} max={20} label="guests" onChange={setGuests} />
                </div>
                {datesOk && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {day(checkIn, "EEE d MMM")} → {day(checkOut, "EEE d MMM")} · {nightWord}
                  </p>
                )}
              </section>

              {!datesOk && (
                <div className="mt-4 flex items-center gap-3 bg-resort-white p-5 text-sm text-muted-foreground">
                  <CalendarDays size={22} className="shrink-0 text-resort-ocean" />
                  Choose your arrival and departure dates to see free rooms and prices.
                </div>
              )}

              {datesOk && (
                <section className="mt-4" aria-label="Rooms">
                  {(roomQuery.isLoading || typesQuery.isLoading) && (
                    <p
                      role="status"
                      className="flex items-center gap-2 bg-resort-white p-5 text-sm text-muted-foreground"
                    >
                      <LoaderCircle size={16} className="animate-spin" /> Checking free rooms
                    </p>
                  )}
                  {roomQuery.isError && (
                    <p role="alert" className="bg-resort-white p-5 text-sm text-destructive">
                      {roomQuery.error.message}{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => roomQuery.refetch()}
                      >
                        Try again
                      </button>
                    </p>
                  )}
                  {roomQuery.data && units.length === 0 && (
                    <div className="bg-resort-white p-5">
                      <BedDouble size={22} className="text-resort-ocean" />
                      <p className="mt-3 font-display text-xl text-primary">
                        No rooms free on these dates
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">Try other dates.</p>
                    </div>
                  )}
                  <ul className="grid grid-cols-1 gap-3">
                    {types
                      .filter((t) => (freeByType.get(t.id)?.length ?? 0) > 0)
                      .map((type, i) => {
                        const free = freeByType.get(type.id)?.length ?? 0;
                        const count = Math.min(qty[type.id] ?? 0, free);
                        return (
                          <li
                            key={type.id}
                            className={`bg-resort-white p-3 transition-shadow sm:p-4 ${count > 0 ? "ring-2 ring-primary" : ""}`}
                          >
                            <div className="flex gap-3">
                              <div className="sagara-image-frame size-24 shrink-0 sm:size-28">
                                <img
                                  src={roomMedia(type, i).photos[0]}
                                  alt={type.name}
                                  loading="lazy"
                                  className="size-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-lg leading-tight text-primary">{type.name}</h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Up to {type.max_guests} guests
                                  {type.bed_type ? ` · ${type.bed_type}` : ""}
                                </p>
                                <p className="mt-1">
                                  <span className="font-display text-lg tabular-nums text-primary">
                                    {formatMoney(type.nightly_rate_cents)}
                                  </span>
                                  <span className="text-xs text-muted-foreground"> / night</span>
                                </p>
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-resort-ocean">
                                  <Coffee size={12} /> Breakfast included
                                </p>
                                <Link
                                  to="/rooms/$slug"
                                  params={{ slug: type.slug }}
                                  target="_blank"
                                  className="inline-flex min-h-8 items-center text-xs text-resort-ocean underline underline-offset-4"
                                >
                                  Photos and details
                                </Link>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                              <span
                                className={`text-xs ${free <= 2 ? "font-medium text-resort-gold-deep" : "text-muted-foreground"}`}
                              >
                                {free <= 2 ? `Only ${free} left` : `${free} free`}
                                {count > 0 && (
                                  <span className="ml-2 tabular-nums text-primary">
                                    · {formatMoney(priceOf(type) * count)}
                                  </span>
                                )}
                              </span>
                              {count === 0 ? (
                                <Button
                                  className={`h-11 px-6 text-sm ${gold}`}
                                  onClick={() => setQty((q) => ({ ...q, [type.id]: 1 }))}
                                >
                                  <Plus size={16} /> Add room
                                </Button>
                              ) : (
                                <Stepper
                                  value={count}
                                  max={free}
                                  label={`${type.name} rooms`}
                                  onChange={(n) => setQty((q) => ({ ...q, [type.id]: n }))}
                                />
                              )}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              )}
              {problem && (
                <p role="alert" className="mt-3 bg-resort-white p-4 text-sm text-destructive">
                  {problem}
                </p>
              )}
              <ActionBar total={total} caption={caption}>
                <Button
                  className={`h-12 px-6 text-sm ${gold}`}
                  disabled={!allocation || !datesOk}
                  onClick={() => setStep("confirm")}
                >
                  Next <ArrowRight size={16} />
                </Button>
              </ActionBar>
            </>
          )}

          {step === "confirm" && (
            <>
              <section className="bg-resort-white p-4 sm:p-6" aria-label="Your details">
                <h2 className="text-lg text-primary">Your details</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  No account needed. The resort calls this number to confirm.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="guest-name">Full name</Label>
                    <Input
                      id="guest-name"
                      autoComplete="name"
                      className="h-12 rounded-none text-base sm:text-sm"
                      value={contact.name}
                      onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="guest-phone">Mobile number</Label>
                    <Input
                      id="guest-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="01712 345678"
                      className="h-12 rounded-none text-base sm:text-sm"
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="guest-email">
                      Email <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="guest-email"
                      type="email"
                      autoComplete="email"
                      className="h-12 rounded-none text-base sm:text-sm"
                      value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="guest-note">
                      Anything we should know?{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="guest-note"
                      rows={2}
                      maxLength={500}
                      className="rounded-none text-base sm:text-sm"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Arrival time, special requests"
                    />
                  </div>
                </div>
              </section>

              <section className="mt-4 bg-resort-white p-4 sm:p-6 lg:hidden" aria-label="Your bill">
                {bill}
              </section>

              {error && (
                <p role="alert" className="mt-3 bg-resort-white p-4 text-sm text-destructive">
                  {error}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                No payment now. The resort confirms your request and explains how to pay.
              </p>

              <ActionBar total={total} caption={caption}>
                <Button
                  className={`h-12 px-6 text-sm ${gold}`}
                  disabled={send.isPending}
                  onClick={confirm}
                >
                  {send.isPending ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <>
                      Send request <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </ActionBar>
            </>
          )}

          {step === "done" && booked && (
            <section className="bg-resort-white p-5 text-center sm:p-10">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-resort-ocean-soft text-resort-ocean">
                <CircleCheck size={30} />
              </span>
              <h2 className="mt-5 text-[28px] text-primary">Thank you, your request is in</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Your rooms are held for these dates while the resort reviews your request.
              </p>
              <div className="mx-auto mt-6 max-w-sm border-y border-border py-4">
                <p className="text-xs text-muted-foreground">
                  {booked.references.length > 1 ? "Your references" : "Your reference"}
                </p>
                {booked.references.map((r) => (
                  <div key={r.reference} className="mt-2">
                    {booked.references.length > 1 && (
                      <p className="text-xs text-muted-foreground">{r.title}</p>
                    )}
                    <p className="font-display text-2xl tracking-[0.12em] text-primary">
                      {r.reference}
                    </p>
                  </div>
                ))}
                <p className="mt-2 text-sm tabular-nums text-foreground">
                  Total {formatMoney(booked.total)} · breakfast included
                </p>
              </div>
              <ol className="mx-auto mt-6 grid max-w-sm gap-3 text-left">
                {[
                  ["The resort reviews your request", "Rooms and dates are checked"],
                  [`You get a call on ${booked.phone}`, "To confirm and explain how to pay"],
                  ["Your stay is confirmed", "Check its status any time with your reference"],
                ].map(([t, c], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-primary">{t}</span>
                      <span className="text-xs text-muted-foreground">{c}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-8 grid gap-2 sm:flex sm:justify-center">
                <Button asChild className={`h-12 px-6 ${gold}`}>
                  <Link to="/my-stays">Check booking status</Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-none">
                  <Link to="/order">Order food during your stay</Link>
                </Button>
              </div>
            </section>
          )}
        </div>

        {step !== "done" && (
          <aside
            className="hidden h-fit bg-resort-white p-6 lg:sticky lg:top-24 lg:block"
            aria-label="Your bill"
          >
            {bill}
          </aside>
        )}
      </div>
    </div>
  );
}
