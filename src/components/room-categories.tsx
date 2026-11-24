import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BedDouble,
  Check,
  Coffee,
  Eye,
  Images,
  Maximize2,
  Move3d,
  PlayCircle,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { formatMoney } from "@/lib/room-booking";
import { roomMedia, useRoomTypes, type RoomType } from "@/lib/rooms";

export function RoomSpecs({ room, light = false }: { room: RoomType; light?: boolean }) {
  const specs = [
    { Icon: Users, label: `Up to ${room.max_guests} guests` },
    room.bed_type && { Icon: BedDouble, label: room.bed_type },
    room.room_size_sqft && { Icon: Maximize2, label: `${room.room_size_sqft} sq ft` },
    room.view_label && { Icon: Eye, label: room.view_label },
    { Icon: Coffee, label: "Breakfast included" },
  ].filter(Boolean) as { Icon: typeof Users; label: string }[];
  return (
    <ul
      className={`flex flex-wrap gap-x-6 gap-y-3 text-sm ${light ? "text-resort-cream/85" : "text-foreground"}`}
    >
      {specs.map(({ Icon, label }) => (
        <li key={label} className="flex items-center gap-2">
          <Icon size={17} strokeWidth={1.5} className="text-resort-gold-deep" />
          {label}
        </li>
      ))}
    </ul>
  );
}

function MediaBadges({ room, index }: { room: RoomType; index: number }) {
  const media = roomMedia(room, index);
  return (
    <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
      <span className="flex items-center gap-1.5 bg-resort-wood/80 px-3 py-1.5 text-xs text-resort-cream backdrop-blur">
        <Images size={13} /> {media.photos.length} {media.photos.length === 1 ? "photo" : "photos"}
      </span>
      {media.panorama && (
        <span className="flex items-center gap-1.5 bg-resort-wood/80 px-3 py-1.5 text-xs text-resort-cream backdrop-blur">
          <Move3d size={13} /> 360° view
        </span>
      )}
      {media.video && (
        <span className="flex items-center gap-1.5 bg-resort-wood/80 px-3 py-1.5 text-xs text-resort-cream backdrop-blur">
          <PlayCircle size={13} /> Video
        </span>
      )}
    </div>
  );
}

export function RoomCategories() {
  const query = useRoomTypes();
  const rooms = query.data ?? [];

  return (
    <>
      <section className="border-b border-border bg-resort-white px-6 py-10 sm:px-8">
        <div className="mx-auto max-w-[1180px]">
          <p className="text-[13px] font-medium text-resort-ocean">Room categories</p>
          {query.isLoading && (
            <div
              className="mt-4 h-11 w-full animate-pulse bg-resort-sand"
              role="status"
              aria-label="Loading rooms"
            />
          )}
          {query.isError && (
            <p role="alert" className="mt-4 text-sm text-muted-foreground">
              {query.error.message}{" "}
              <button
                type="button"
                className="text-resort-ocean underline"
                onClick={() => query.refetch()}
              >
                Try again
              </button>
            </p>
          )}
          {!query.isLoading && !query.isError && rooms.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              The resort is adding its rooms. You can still{" "}
              <Link to="/booking" className="text-resort-ocean underline">
                send a request
              </Link>
              .
            </p>
          )}
          {rooms.length > 0 && (
            <nav
              aria-label="Jump to a room category"
              className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]"
            >
              {rooms.map((room) => (
                <a
                  key={room.id}
                  href={`#${room.slug}`}
                  className="shrink-0 border border-border px-5 py-3 text-sm transition-colors hover:border-resort-gold hover:bg-resort-cream"
                >
                  <span className="block font-medium text-primary">{room.name}</span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {formatMoney(room.nightly_rate_cents)} per night
                  </span>
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      {rooms.map((room, i) => {
        const media = roomMedia(room, i);
        const flip = i % 2 === 1;
        return (
          <section
            key={room.id}
            id={room.slug}
            className={`scroll-mt-24 px-6 py-12 sm:px-8 sm:py-20 lg:py-24 ${flip ? "bg-resort-cream" : "bg-resort-white"}`}
          >
            <div className="mx-auto grid max-w-[1180px] items-center gap-6 sm:gap-10 lg:grid-cols-2 lg:gap-16">
              <Reveal className={`group relative ${flip ? "lg:order-2" : ""}`}>
                <Link
                  to="/rooms/$slug"
                  params={{ slug: room.slug }}
                  className="block"
                  aria-label={`See ${room.name}`}
                >
                  <div className="sagara-image-frame aspect-[4/3]">
                    <img
                      src={media.photos[0]}
                      alt={`${room.name} at Santa Monica Eco Beach Resort`}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </div>
                </Link>
                <MediaBadges room={room} index={i} />
              </Reveal>
              <Reveal delay={100}>
                <p className="text-[13px] font-medium text-resort-ocean">
                  {String(i + 1).padStart(2, "0")} · {room.view_label || "Room category"}
                </p>
                <h2 className="mt-3 text-[32px] leading-tight text-primary sm:text-[40px]">
                  {room.name}
                </h2>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl tabular-nums text-primary">
                    {formatMoney(room.nightly_rate_cents)}
                  </span>
                  <span className="text-sm text-muted-foreground">per night</span>
                </p>
                <div className="mt-6 border-y border-border py-5">
                  <RoomSpecs room={room} />
                </div>
                {room.description && (
                  <p className="mt-6 text-[15px] leading-7 text-muted-foreground">
                    {room.description}
                  </p>
                )}
                {room.features.length > 0 && (
                  <ul className="mt-6 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {room.features.slice(0, 6).map((f, fi) => (
                      <li
                        key={f}
                        className={`${fi >= 4 ? "hidden sm:flex" : "flex"} items-start gap-2 text-sm text-foreground`}
                      >
                        <Check size={15} className="mt-0.5 shrink-0 text-resort-gold-deep" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="h-12 rounded-none bg-resort-gold px-7 text-[13px] font-medium text-resort-wood transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    <Link to="/booking" search={{ room: room.slug, rooms: 1 }}>
                      Book this room <ArrowRight size={15} />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-none border-primary/30 px-7 text-[13px]"
                  >
                    <Link to="/rooms/$slug" params={{ slug: room.slug }}>
                      Photos, 360° and details
                    </Link>
                  </Button>
                </div>
              </Reveal>
            </div>
          </section>
        );
      })}
    </>
  );
}
