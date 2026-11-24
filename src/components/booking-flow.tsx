import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, BedDouble, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth-context";
import { getMyReservations } from "@/lib/resort.functions";
import { formatMoney } from "@/lib/room-booking";

const prettyDate = (d: string, f = "EEE, d MMM yyyy") => format(new Date(`${d}T12:00:00`), f);

const primaryBtn =
  "h-12 rounded-none bg-resort-gold px-7 text-[13px] font-medium text-resort-wood transition-colors hover:bg-primary hover:text-primary-foreground disabled:bg-resort-sand disabled:text-muted-foreground";

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
      <div className="border-b border-border bg-resort-white px-5 py-7 sm:px-8 sm:py-10 lg:py-12">
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
                className="inline-flex min-h-11 items-center text-resort-ocean underline-offset-4 hover:underline"
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
