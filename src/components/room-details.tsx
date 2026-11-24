import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Images,
  LoaderCircle,
  Minus,
  Move3d,
  PlayCircle,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PanoramaViewer, PhotoGallery } from "@/components/room-viewer";
import { RoomSpecs } from "@/components/room-categories";
import { formatMoney } from "@/lib/room-booking";
import {
  nightsBetween,
  roomMedia,
  useRoomType,
  useRoomTypes,
  useTypeAvailability,
  videoEmbed,
} from "@/lib/rooms";

const field =
  "mt-1 h-11 w-full border border-input bg-resort-white px-3 text-sm text-foreground outline-none transition-colors focus:border-resort-teal focus-visible:ring-2 focus-visible:ring-resort-teal/30";

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mt-1 flex h-11 items-center justify-between border border-input bg-resort-white px-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 rounded-none"
        aria-label={`Fewer ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </Button>
      <span className="tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 rounded-none"
        aria-label={`More ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}

export function RoomDetails({ slug }: { slug: string }) {
  const query = useRoomType(slug);
  const others = useRoomTypes();
  const room = query.data;
  const media = useMemo(() => (room ? roomMedia(room) : null), [room]);
  const [view, setView] = useState<"photos" | "360" | "video">("photos");

  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [count, setCount] = useState(1);
  const [guests, setGuests] = useState(2);
  const nights = nightsBetween(checkIn, checkOut);
  const availability = useTypeAvailability(checkIn, checkOut);
  const free = room && availability.data ? (availability.data.get(room.id) ?? 0) : null;
  const maxRooms = free ?? 10;
  const rooms = Math.min(count, Math.max(1, maxRooms));
  const capacity = room ? room.max_guests * rooms : 0;
  const total = room ? room.nightly_rate_cents * Math.max(1, nights) * rooms : 0;

  if (query.isLoading)
    return (
      <div className="bg-resort-cream px-6 py-24">
        <p
          role="status"
          className="mx-auto flex max-w-[1180px] items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="animate-spin" size={16} /> Loading room
        </p>
      </div>
    );
  if (query.isError)
    return (
      <div className="bg-resort-cream px-6 py-24">
        <div role="alert" className="mx-auto max-w-[1180px] bg-resort-white p-8">
          <h1 className="text-3xl text-primary">We couldn't load this room</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p>
          <Button className="mt-5 rounded-none" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  if (!room || !media)
    return (
      <div className="bg-resort-cream px-6 py-24">
        <div className="mx-auto max-w-[1180px] bg-resort-white p-8">
          <h1 className="text-3xl text-primary">This room isn't available</h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            It may have been renamed or taken off the website.
          </p>
          <Button asChild className="mt-6 rounded-none">
            <Link to="/stays">
              See all rooms <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      </div>
    );

  const tabs = [
    { key: "photos" as const, label: `Photos (${media.photos.length})`, Icon: Images, show: true },
    { key: "360" as const, label: "360° view", Icon: Move3d, show: Boolean(media.panorama) },
    { key: "video" as const, label: "Video", Icon: PlayCircle, show: Boolean(media.video) },
  ].filter((t) => t.show);
  const video = media.video ? videoEmbed(media.video) : null;

  return (
    <div className="bg-resort-cream pb-24">
      <div className="border-b border-border bg-resort-white px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-[1180px]">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
          >
            <Link to="/" className="hover:text-resort-ocean">
              Home
            </Link>
            <ChevronRight size={13} />
            <Link to="/stays" className="hover:text-resort-ocean">
              Rooms
            </Link>
            <ChevronRight size={13} />
            <span className="text-foreground">{room.name}</span>
          </nav>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              {room.view_label && (
                <p className="text-[13px] font-medium text-resort-ocean">{room.view_label}</p>
              )}
              <h1 className="mt-1 text-[36px] leading-tight text-primary sm:text-[48px]">
                {room.name}
              </h1>
            </div>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-3xl tabular-nums text-primary">
                {formatMoney(room.nightly_rate_cents)}
              </span>
              <span className="text-sm text-muted-foreground">per night</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-[1180px] gap-8 px-6 sm:px-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          {tabs.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Room media">
              {tabs.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                  className={`flex h-10 items-center gap-2 border px-4 text-[13px] transition-colors ${view === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-resort-white text-foreground hover:border-resort-gold"}`}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          )}
          <div className="bg-resort-white">
            {view === "360" && media.panorama ? (
              <PanoramaViewer src={media.panorama} />
            ) : view === "video" && video ? (
              <div className="aspect-video bg-resort-wood">
                {video.kind === "iframe" ? (
                  <iframe
                    src={video.src}
                    title={`${room.name} video`}
                    className="size-full border-0"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <video src={video.src} controls playsInline className="size-full" />
                )}
              </div>
            ) : (
              <PhotoGallery photos={media.photos} name={room.name} />
            )}
          </div>

          <section className="mt-8 bg-resort-white p-6 sm:p-8">
            <h2 className="text-2xl text-primary">About this room</h2>
            <span className="gold-rule mt-4" />
            <div className="mt-6">
              <RoomSpecs room={room} />
            </div>
            {room.description && (
              <p className="mt-6 text-[15px] leading-7 text-muted-foreground">{room.description}</p>
            )}
            {room.features.length > 0 && (
              <>
                <h3 className="mt-8 text-lg text-primary">In the room</h3>
                <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {room.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <Check size={15} className="mt-0.5 shrink-0 text-resort-gold-deep" /> {f}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="mt-8 text-lg text-primary">Good to know</h3>
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
              <li>Check-in from 2:00 PM, check-out by 12:00 noon</li>
              <li>Meals, boat trips and other extras can be added when you book</li>
              <li>The resort confirms every request before your stay</li>
            </ul>
          </section>
        </div>

        <aside className="h-fit bg-resort-white p-6 lg:sticky lg:top-24">
          <p className="text-[13px] font-medium text-resort-ocean">Book this room</p>
          <p className="mt-1 font-display text-2xl text-primary">{room.name}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Arrival
              <input
                type="date"
                className={field}
                min={today}
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (checkOut && e.target.value >= checkOut) setCheckOut("");
                }}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Departure
              <input
                type="date"
                className={field}
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </label>
            <div className="text-xs font-medium text-muted-foreground">
              Rooms
              <Stepper
                label="rooms"
                value={rooms}
                min={1}
                max={Math.max(1, maxRooms)}
                onChange={setCount}
              />
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Guests
              <Stepper
                label="guests"
                value={guests}
                min={1}
                max={Math.min(20, capacity)}
                onChange={setGuests}
              />
            </div>
          </div>

          {availability.isFetching && (
            <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle size={13} className="animate-spin" /> Checking availability
            </p>
          )}
          {free !== null && !availability.isFetching && (
            <p className={`mt-3 text-xs ${free === 0 ? "text-destructive" : "text-resort-ocean"}`}>
              {free === 0
                ? "No rooms of this type are free on these dates"
                : `${free} ${free === 1 ? "room" : "rooms"} free on these dates`}
            </p>
          )}
          {guests > capacity && (
            <p className="mt-2 text-xs text-destructive">
              Add a room: {rooms} {rooms === 1 ? "room hosts" : "rooms host"} up to {capacity}{" "}
              guests
            </p>
          )}

          <div className="mt-5 border-t border-border pt-5 text-sm">
            <p className="flex justify-between gap-3 text-muted-foreground">
              <span className="tabular-nums">
                {formatMoney(room.nightly_rate_cents)} × {Math.max(1, nights)}{" "}
                {nights === 1 || nights === 0 ? "night" : "nights"} × {rooms}{" "}
                {rooms === 1 ? "room" : "rooms"}
              </span>
            </p>
            <p className="mt-3 flex items-baseline justify-between">
              <span className="text-muted-foreground">
                {nights > 0 ? "Room total" : "Price for one night"}
              </span>
              <span className="font-display text-3xl tabular-nums text-primary">
                {formatMoney(total)}
              </span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Meals and extras are added in the next steps
            </p>
          </div>

          <Button
            asChild
            disabled={free === 0}
            className="mt-6 h-12 w-full rounded-none bg-resort-gold text-[13px] font-medium text-resort-wood transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Link
              to="/booking"
              search={{
                room: room.slug,
                rooms,
                guests: Math.min(guests, capacity),
                ...(nights > 0 ? { checkIn, checkOut } : {}),
              }}
              aria-disabled={free === 0}
              onClick={(e) => free === 0 && e.preventDefault()}
            >
              Continue to booking <ArrowRight size={15} />
            </Link>
          </Button>
        </aside>
      </div>

      {(others.data?.length ?? 0) > 1 && (
        <section className="mx-auto mt-16 max-w-[1180px] px-6 sm:px-8">
          <h2 className="text-2xl text-primary">Other rooms</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {others
              .data!.filter((r) => r.slug !== room.slug)
              .slice(0, 3)
              .map((r, i) => (
                <Link
                  key={r.id}
                  to="/rooms/$slug"
                  params={{ slug: r.slug }}
                  className="group block bg-resort-white"
                >
                  <div className="sagara-image-frame aspect-[4/3]">
                    <img
                      src={roomMedia(r, i + 1).photos[0]}
                      alt={r.name}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 p-5">
                    <span className="font-display text-lg text-primary">{r.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatMoney(r.nightly_rate_cents)}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
