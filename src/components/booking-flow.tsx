import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, BedDouble, Check, CircleCheck, LoaderCircle, UserRound, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth-context";
import { Eyebrow } from "@/components/resort-site";
import { getMyReservations, getGuestProfile } from "@/lib/resort.functions";
import { RoomCard, type AvailableRoom } from "@/components/room-card";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function BookingFlow() {
  const user = useCurrentUser();
  const search = useSearch({ from: "/booking" });
  const queryClient = useQueryClient();
  const [step, setStep] = useState(search.checkIn && search.checkOut ? 2 : 1);
  const [checkIn, setCheckIn] = useState(search.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(search.checkOut ?? "");
  const [guestCount, setGuestCount] = useState(Math.min(6, Math.max(1, search.guests ?? 2)));
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const nights = useMemo(() => checkIn && checkOut ? Math.max(1, Math.round((new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime()) / 86400000)) : 0, [checkIn, checkOut]);
  const roomQuery = useQuery({
    queryKey: ["available-rooms", checkIn, checkOut],
    enabled: Boolean(checkIn && checkOut && checkOut > checkIn),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_rooms", { p_check_in: checkIn, p_check_out: checkOut });
      if (error) throw new Error("Availability couldn't be checked right now.");
      return (data ?? []) as AvailableRoom[];
    },
  });

  const createReservation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedRoom) throw new Error("Sign in and select a room before continuing.");
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        room_unit_id: selectedRoom.room_unit_id,
        check_in: checkIn,
        check_out: checkOut,
        guest_count: guestCount,
        guest_note: note.trim(),
      }).select("booking_reference").single();
      if (error) {
        if (error.code === "23P01") throw new Error("Those dates were just reserved. Please choose different dates.");
        if (error.code === "23514") throw new Error("That room can't accommodate this number of guests.");
        throw new Error("We couldn't save this reservation. Please check the dates and try again.");
      }
      return data.booking_reference;
    },
    onSuccess: async (bookingReference) => {
      setReference(bookingReference);
      setMessage("");
      setStep(5);
      await queryClient.invalidateQueries({ queryKey: ["my-stays"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "We couldn't save your reservation."),
  });

  const steps = ["Dates", "Stay", "Your details", "Review", "Confirmation"];

  return (
    <div className="min-h-[calc(100svh-68px)] bg-resort-cream px-5 py-12 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>A slower way to arrive</Eyebrow>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6"><div><h1 className="text-4xl text-primary sm:text-5xl">Find your stay.</h1><p className="mt-3 text-sm text-muted-foreground">Saint Martin's Island, Bangladesh · Where Silence Meets the Sea</p></div>{step < 5 && <div className="flex items-center gap-2 text-xs text-resort-ocean"><Waves size={16}/>Reservation request</div>}</div>

        <div className="mt-10 grid grid-cols-5 border-y border-border py-4" aria-label="Booking progress">
          {steps.map((label, index) => <div key={label} className={`flex items-center gap-2 text-[10px] sm:text-xs ${step >= index + 1 ? "text-primary" : "text-muted-foreground"}`}><span className={`grid size-6 shrink-0 place-items-center rounded-full border ${step > index + 1 ? "border-resort-ocean bg-resort-ocean text-resort-cream" : step === index + 1 ? "border-resort-gold text-primary" : "border-border"}`}>{step > index + 1 ? <Check size={12}/> : index + 1}</span><span className="hidden sm:inline">{label}</span></div>)}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
          <section className="min-w-0 bg-background p-5 sm:p-8">
            {step === 1 && <>
              <Eyebrow>Step 01</Eyebrow><h2 className="mt-3 text-3xl text-primary">When will you come?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Choose the dates that leave room to exhale.</p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="arrival">Arrival</Label><Input id="arrival" type="date" min={todayDate()} value={checkIn} onChange={(event)=>{setCheckIn(event.target.value); if (checkOut && event.target.value >= checkOut) setCheckOut("");}}/></div><div className="grid gap-2"><Label htmlFor="departure">Departure</Label><Input id="departure" type="date" min={checkIn || todayDate()} value={checkOut} onChange={(event)=>setCheckOut(event.target.value)}/></div><div className="grid gap-2"><Label htmlFor="guests">Guests</Label><Input id="guests" type="number" min={1} max={6} value={guestCount} onChange={(event)=>setGuestCount(Math.min(6, Math.max(1, Number(event.target.value) || 1)))}/></div></div>
              <div className="mt-8 flex justify-end"><Button disabled={!checkIn || !checkOut || checkOut <= checkIn} onClick={()=>{setStep(2); void roomQuery.refetch();}}>See available stays <ArrowRight size={15}/></Button></div>
            </>}

            {step === 2 && <>
              <Eyebrow>Step 02</Eyebrow><h2 className="mt-3 text-3xl text-primary">Choose a place to land.</h2><p className="mt-2 text-sm text-muted-foreground">{checkIn && checkOut ? `${format(new Date(`${checkIn}T12:00:00`), "MMM d, yyyy")} — ${format(new Date(`${checkOut}T12:00:00`), "MMM d, yyyy")} · ${nights} ${nights === 1 ? "night" : "nights"}` : "Choose dates to see available stays."}</p>
              {roomQuery.isFetching && <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={16}/>Checking the coast for you…</p>}
              {roomQuery.isError && <p role="alert" className="mt-8 text-sm text-destructive">{roomQuery.error.message}</p>}
              {!roomQuery.isFetching && roomQuery.data?.length === 0 && <div className="mt-8 border border-border p-6"><BedDouble size={24} className="text-resort-ocean"/><h3 className="mt-4 font-display text-2xl text-primary">No open stays for these dates.</h3><p className="mt-2 text-sm text-muted-foreground">The resort’s room list is being prepared, or those dates are already spoken for. Try again later or choose different dates.</p><Button variant="outline" className="mt-5" onClick={()=>setStep(1)}>Change dates</Button></div>}
              <div className="mt-6 grid gap-5">{roomQuery.data?.map((room)=><RoomCard key={room.room_unit_id} room={room} selected={selectedRoom?.room_unit_id === room.room_unit_id} onSelect={()=>{setSelectedRoom(room); setMessage("");}}/>)}</div>
              {roomQuery.data && roomQuery.data.length > 0 && <div className="mt-8 flex justify-between"><Button variant="ghost" onClick={()=>setStep(1)}><ArrowLeft size={15}/>Dates</Button><Button disabled={!selectedRoom || guestCount > (selectedRoom?.max_guests ?? 0)} onClick={()=>setStep(3)}>Continue <ArrowRight size={15}/></Button></div>}
            </>}

            {step === 3 && <>
              <Eyebrow>Step 03</Eyebrow><h2 className="mt-3 text-3xl text-primary">A few details about you.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">We’ll use these details for your stay request and future visits.</p>
              {!user ? <div className="mt-8 border border-resort-gold/70 bg-resort-cream p-5"><UserRound size={22} className="text-resort-ocean"/><p className="mt-3 font-display text-xl text-primary">Sign in to keep your stay together.</p><p className="mt-2 text-sm text-muted-foreground">Your account keeps your guest details and booking history in one place.</p><Button className="mt-5" asChild><Link to="/auth" search={{ next: "/booking", checkIn, checkOut, guests: guestCount }}>Sign in or create an account <ArrowRight size={14}/></Link></Button></div> : <GuestDetails onContinue={()=>setStep(4)} />}
              <div className="mt-8"><Button variant="ghost" onClick={()=>setStep(2)}><ArrowLeft size={15}/>Choose another stay</Button></div>
            </>}

            {step === 4 && selectedRoom && <>
              <Eyebrow>Step 04</Eyebrow><h2 className="mt-3 text-3xl text-primary">A moment to review.</h2><p className="mt-2 text-sm text-muted-foreground">Your reservation request, all together.</p>
              <div className="mt-8 divide-y divide-border border-y border-border">{[["Stay", selectedRoom.type_name],["Room",selectedRoom.room_name],["Arrival",format(new Date(`${checkIn}T12:00:00`),"EEE, MMM d, yyyy")],["Departure",format(new Date(`${checkOut}T12:00:00`),"EEE, MMM d, yyyy")],["Guests",`${guestCount} ${guestCount===1?"guest":"guests"}`],["Length",`${nights} ${nights===1?"night":"nights"}`],["Rate",`$${(selectedRoom.nightly_rate_cents/100).toLocaleString()} / night`],["Estimated stay",`$${(selectedRoom.nightly_rate_cents*nights/100).toLocaleString()}`]].map(([key,value])=><div className="flex justify-between gap-3 py-4 text-sm" key={key}><span className="text-muted-foreground">{key}</span><span className="text-right font-medium text-primary">{value}</span></div>)}</div>
              <div className="mt-6 grid gap-2"><Label htmlFor="guest-note">Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="guest-note" value={note} maxLength={500} onChange={(event)=>setNote(event.target.value)} placeholder="A note for the resort" rows={3}/></div>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">This sends a reservation request. No payment is collected here. The resort will confirm your stay directly.</p>
              {message && <p role="alert" className="mt-4 text-sm text-destructive">{message}</p>}
              <div className="mt-7 flex flex-wrap justify-between gap-3"><Button variant="ghost" onClick={()=>setStep(3)}><ArrowLeft size={15}/>Your details</Button><Button disabled={createReservation.isPending} onClick={()=>createReservation.mutate()}>{createReservation.isPending ? "Sending request…" : "Request this stay"}<ArrowRight size={15}/></Button></div>
            </>}

            {step === 5 && <div className="py-8 text-center sm:py-14"><span className="mx-auto grid size-16 place-items-center rounded-full bg-resort-ocean-soft text-resort-ocean"><CircleCheck size={30}/></span><Eyebrow>We’ve received your request</Eyebrow><h2 className="mt-4 text-4xl text-primary">The coast is getting closer.</h2><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground">Your request is in. The resort will be in touch to confirm the stay and next steps.</p><div className="mx-auto mt-8 max-w-sm border-y border-border py-5"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your reference</p><p className="mt-2 font-display text-2xl tracking-[0.12em] text-primary">{reference}</p></div><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild><Link to="/my-stays">My stays</Link></Button><Button variant="outline" asChild><Link to="/">Return home</Link></Button></div></div>}
          </section>

          <aside className="h-fit border-y border-border py-5 lg:sticky lg:top-24"><div className="flex items-center gap-2"><Waves size={17} className="text-resort-ocean"/><Eyebrow>Your coastal pause</Eyebrow></div><h2 className="mt-4 font-display text-2xl text-primary">A stay shaped around you.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Every visit starts with a few thoughtful details. Choose your dates and we’ll show what’s available.</p>{selectedRoom && <div className="mt-6 border-t border-border pt-5"><p className="font-display text-xl text-primary">{selectedRoom.type_name}</p><p className="mt-1 text-xs text-muted-foreground">{nights} {nights===1?"night":"nights"} · {guestCount} {guestCount===1?"guest":"guests"}</p><p className="mt-4 flex justify-between text-sm"><span className="text-muted-foreground">Estimated stay</span><span className="font-semibold text-primary">${(selectedRoom.nightly_rate_cents*nights/100).toLocaleString()}</span></p></div>}<p className="mt-7 border-l-2 border-resort-gold pl-3 text-[11px] leading-5 text-muted-foreground">Your room and dates are checked against live availability. A reservation request is not confirmed until the resort contacts you.</p></aside>
        </div>
      </div>
    </div>
  );
}

function GuestDetails({ onContinue }: { onContinue: () => void }) {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const { data: profile, isLoading } = useQuery({ queryKey: ["guest-profile", user?.id], queryFn: () => getGuestProfile(), enabled: Boolean(user) });
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState("");

async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setError("");
    const nextName = displayName ?? profile?.display_name ?? "";
    const nextPhone = phone ?? profile?.phone ?? "";
    const { error: saveError } = await supabase.from("profiles").update({ display_name: nextName.trim(), phone: nextPhone.trim() }).eq("id", user.id);
    if (saveError) {
      setError("We couldn't save your guest details. Please try again.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["guest-profile", user.id] });
    onContinue();
  }

  return <form onSubmit={submit} className="mt-7 grid gap-5">
    <div className="grid gap-2"><Label htmlFor="guest-email">Email address</Label><Input id="guest-email" type="email" value={user?.email ?? ""} readOnly className="bg-muted"/></div>
    <div className="grid gap-2"><Label htmlFor="guest-name">Full name</Label><Input id="guest-name" autoComplete="name" value={displayName ?? profile?.display_name ?? ""} onChange={(event)=>setDisplayName(event.target.value)} required disabled={isLoading}/></div>
    <div className="grid gap-2"><Label htmlFor="guest-phone">Phone number</Label><Input id="guest-phone" type="tel" autoComplete="tel" value={phone ?? profile?.phone ?? ""} onChange={(event)=>setPhone(event.target.value)} required disabled={isLoading}/></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={isLoading}>Continue to review <ArrowRight size={15}/></Button>
  </form>;
}

export function GuestStaysPage() {
  const user = useCurrentUser();
  const { data, isLoading, isError } = useQuery({ queryKey: ["my-stays", user?.id], queryFn: () => getMyReservations(), enabled: Boolean(user) });
  return <div className="min-h-[calc(100svh-68px)] bg-resort-cream px-5 py-12 sm:px-8 lg:py-16"><div className="mx-auto max-w-5xl"><Eyebrow>Your time by the sea</Eyebrow><h1 className="mt-3 text-4xl text-primary sm:text-5xl">My stays.</h1><p className="mt-3 text-sm text-muted-foreground">A quiet place to keep your reservation requests.</p>
    {isLoading && <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={16}/>Loading your stays…</p>}
    {isError && <p role="alert" className="mt-10 text-sm text-destructive">Your stays couldn't be loaded. Please try again.</p>}
    {!user && <div className="mt-10 border-y border-border py-10"><UserRound size={24} className="text-resort-ocean"/><h2 className="mt-4 font-display text-3xl text-primary">Your stays, all together.</h2><p className="mt-3 text-sm text-muted-foreground">Sign in to view your reservation requests and history.</p><Button className="mt-6" asChild><Link to="/auth" search={{ next: "/my-stays" }}>Sign in <ArrowRight size={15}/></Link></Button></div>}
    {user && !isLoading && !isError && data?.length === 0 && <div className="mt-10 border-y border-border py-10"><BedDouble size={24} className="text-resort-ocean"/><h2 className="mt-4 font-display text-3xl text-primary">Nothing on the calendar just yet.</h2><p className="mt-3 text-sm text-muted-foreground">Your reservation requests will appear here.</p><Button className="mt-6" asChild><Link to="/booking">Find your stay <ArrowRight size={15}/></Link></Button></div>}
    <div className="mt-8 grid gap-4">{data?.map((reservation)=>{
      const room = reservation.room_units as unknown as {name: string; room_types: {name: string; slug: string}} | null;
      return <article key={reservation.id} className="grid gap-5 border-y border-border bg-background p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7"><div><div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-2xl text-primary">{room?.room_types?.name ?? "Coastal stay"}</h2><span className={`px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${reservation.status === "confirmed" ? "bg-resort-ocean-soft text-resort-ocean" : reservation.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-resort-sand text-primary"}`}>{reservation.status}</span></div><p className="mt-2 text-sm text-muted-foreground">{format(new Date(`${reservation.check_in}T12:00:00`), "MMM d, yyyy")} — {format(new Date(`${reservation.check_out}T12:00:00`), "MMM d, yyyy")} · {reservation.guest_count} guests</p><p className="mt-2 text-xs text-muted-foreground">Reference {reservation.booking_reference}</p></div><div className="sm:text-right"><p className="text-xs text-muted-foreground">Stay estimate</p><p className="mt-1 font-semibold text-primary">${(reservation.total_cents/100).toLocaleString()}</p></div></article>;
    })}</div>
    <div className="mt-10 border-t border-border pt-6"><p className="text-xs leading-5 text-muted-foreground">Your booking history is private to your account. Reservation requests remain pending until the resort confirms them.</p></div>
  </div></div>;
}