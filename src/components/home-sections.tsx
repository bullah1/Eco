import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ConciergeBell,
  Crown,
  Dices,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Puzzle,
  Ship,
  Spade,
  Target,
  UtensilsCrossed,
  Waves,
  Wifi,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/resort-site";
import {
  activities,
  dining,
  facilities,
  faqs,
  galleryCategories,
  heroSlides,
  indoorGames,
  packages,
  resortContact,
  travelGuide,
} from "@/lib/resort-content";
import { stayConcepts } from "@/lib/resort-data";
import { supabase } from "@/integrations/supabase/client";
import { getRoomMedia } from "@/lib/room-media";
import { formatMoney } from "@/lib/room-booking";

const wrap = "mx-auto max-w-[1180px]";
const pad = "px-6 py-16 sm:px-8 sm:py-24 lg:py-28";
/** Mobile: a sideways swipe row with the next card peeking. From sm up: a normal grid. */
const swipeRow =
  "-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0";
const swipeItem = "w-[80%] shrink-0 snap-start sm:w-auto";
const textLink =
  "inline-flex min-h-11 items-center gap-2 text-sm text-primary underline decoration-resort-gold decoration-1 underline-offset-[6px] transition-colors hover:text-resort-ocean";
const goldButton =
  "h-11 rounded-none bg-resort-gold px-6 text-[13px] font-medium text-resort-wood transition-colors hover:bg-primary hover:text-primary-foreground";

/* ---------- Rooms ---------- */

export function HomeRooms({ layout = "carousel" }: { layout?: "carousel" | "grid" } = {}) {
  const scroller = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ["home-room-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_types")
        .select("id, name, slug, description, image_url, max_guests, nightly_rate_cents, bed_type")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const rooms = useMemo(
    () =>
      (query.data ?? []).map((room, i) => ({
        key: room.id,
        name: room.name,
        slug: room.slug,
        description: room.description,
        guests: room.max_guests,
        bed: room.bed_type,
        price: formatMoney(room.nightly_rate_cents),
        image:
          getRoomMedia(room.slug, room.image_url || undefined).photos[0] ??
          stayConcepts[i % stayConcepts.length]?.image ??
          "",
        alt: `${room.name} at Santa Monica Eco Beach Resort`,
      })),
    [query.data],
  );
  const scrollBy = (dir: number) =>
    scroller.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <section className={`bg-resort-cream ${pad}`}>
      <div className={wrap}>
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow={layout === "grid" ? "All rooms" : "Stay"}
            title={layout === "grid" ? "Find the right room" : "Rooms and suites"}
            copy="Pick the room that suits your stay. Prices are per night."
          />
          {layout === "carousel" && rooms.length > 3 && (
            <div className="hidden gap-2 sm:flex">
              {[
                { dir: -1, label: "Previous rooms", Icon: ChevronLeft },
                { dir: 1, label: "Next rooms", Icon: ChevronRight },
              ].map(({ dir, label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  onClick={() => scrollBy(dir)}
                  className="grid size-11 place-items-center border border-primary/25 text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          )}
        </Reveal>

        {query.isLoading && (
          <div
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            role="status"
            aria-label="Loading rooms"
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-resort-sand" />
                <div className="mt-5 h-5 w-2/3 bg-resort-sand" />
                <div className="mt-3 h-3 w-full bg-resort-sand" />
              </div>
            ))}
          </div>
        )}
        {query.isError && (
          <p role="alert" className="mt-12 text-sm text-muted-foreground">
            We couldn't load the rooms just now.{" "}
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
          <Reveal className="mt-12 grid items-center gap-8 bg-resort-white p-6 sm:grid-cols-[280px_1fr] sm:p-8">
            <div className="sagara-image-frame aspect-[4/3]">
              <img
                src={heroSlides[1]!.image}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-2xl text-primary">Rooms are being added</h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                The resort is publishing its rooms and rates. You can still send a request with your
                dates and the resort will reply.
              </p>
              <Button asChild className={`mt-6 ${goldButton}`}>
                <Link to="/booking">Send a request</Link>
              </Button>
            </div>
          </Reveal>
        )}

        {rooms.length > 0 && layout === "carousel" && (
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:hidden">
            {rooms.map((room) => (
              <li key={room.key} className="flex gap-4 bg-resort-white p-3">
                <Link
                  to="/rooms/$slug"
                  params={{ slug: room.slug }}
                  className="sagara-image-frame size-28 shrink-0"
                  aria-label={`See ${room.name}`}
                >
                  {room.image && (
                    <img
                      src={room.image}
                      alt={room.alt}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="truncate text-lg leading-tight text-primary">{room.name}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Up to {room.guests} guests{room.bed ? ` · ${room.bed}` : ""}
                  </p>
                  <p className="mt-1">
                    <span className="font-display text-lg tabular-nums text-primary">
                      {room.price}
                    </span>
                    <span className="text-xs text-muted-foreground"> / night</span>
                  </p>
                  <div className="mt-auto flex gap-2 pt-2">
                    <Link
                      to="/rooms/$slug"
                      params={{ slug: room.slug }}
                      className="inline-flex h-10 flex-1 items-center justify-center border border-primary/25 text-[13px] text-primary"
                    >
                      Details
                    </Link>
                    <Link
                      to="/booking"
                      search={{ room: room.slug, rooms: 1 }}
                      className="inline-flex h-10 flex-1 items-center justify-center bg-resort-gold text-[13px] font-medium text-resort-wood"
                    >
                      Book
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {rooms.length > 0 && (
          <div
            ref={scroller}
            className={
              layout === "grid"
                ? "mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
                : "mt-12 hidden snap-x snap-mandatory gap-6 overflow-x-auto pb-2 [scrollbar-width:none] sm:flex"
            }
          >
            {rooms.map((room, i) => (
              <Reveal
                key={room.key}
                delay={i * 80}
                as="article"
                className={
                  layout === "grid"
                    ? "group"
                    : "group w-[78vw] shrink-0 snap-start sm:w-[calc((100%-24px)/2)] lg:w-[calc((100%-72px)/4)]"
                }
              >
                <Link to="/rooms/$slug" params={{ slug: room.slug }} className="block">
                  <div className="sagara-image-frame aspect-[4/3]">
                    {room.image && (
                      <img
                        src={room.image}
                        alt={room.alt}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    )}
                  </div>
                </Link>
                <h3 className="mt-5 text-xl text-primary">{room.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {room.description || `Sleeps up to ${room.guests} guests`}
                </p>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <p className="leading-tight">
                    <span className="font-display text-2xl tabular-nums text-primary">
                      {room.price}
                    </span>
                    <span className="block text-xs text-muted-foreground">Per night</span>
                  </p>
                  <Button asChild className={goldButton}>
                    <Link to="/rooms/$slug" params={{ slug: room.slug }}>
                      Details
                    </Link>
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Facilities ---------- */

const facilityIcons = [Waves, UtensilsCrossed, Ship, ConciergeBell, Wifi, Zap];

export function FacilitiesSection() {
  return (
    <section className={`bg-resort-white ${pad}`}>
      <div className={wrap}>
        <Reveal>
          <SectionHeading
            center
            title="Resort facilities"
            copy="Everything you need for an easy stay on the island"
          />
        </Reveal>
        <ul className="mx-auto mt-10 grid max-w-[980px] grid-cols-2 gap-x-5 gap-y-8 sm:mt-16 sm:gap-x-12 sm:gap-y-12 lg:grid-cols-3">
          {facilities.map((item, i) => {
            const Icon = facilityIcons[i % facilityIcons.length] ?? Waves;
            return (
              <Reveal
                as="li"
                key={item.name}
                delay={(i % 3) * 90}
                className="flex flex-col gap-3 sm:flex-row sm:gap-5"
              >
                <Icon size={32} strokeWidth={1.25} className="shrink-0 text-resort-gold-deep" />
                <div>
                  <h3 className="text-base text-primary sm:text-lg">{item.name}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
                    {item.copy}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Dining ---------- */

export function DiningSection() {
  return (
    <section id="dining" className={`scroll-mt-24 bg-resort-cream ${pad}`}>
      <div className={`${wrap} grid items-center gap-10 lg:grid-cols-2 lg:gap-20`}>
        <Reveal className="relative">
          <div className="sagara-image-frame aspect-[16/10] sm:aspect-[5/4] lg:aspect-[4/5]">
            <img
              src={dining.image.src}
              alt={dining.image.alt}
              loading="lazy"
              className="size-full object-cover"
            />
          </div>
          <div className="absolute -bottom-6 right-4 hidden max-w-[240px] sm:block bg-primary p-6 text-primary-foreground sm:right-8">
            <p className="font-display text-lg">Add meals when you book</p>
            <p className="mt-2 text-xs leading-5 text-primary-foreground/70">
              Choose breakfast, lunch or a BBQ dinner with your room
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <SectionHeading eyebrow="Dining" title={dining.title} copy={dining.copy} />
          <ul className="mt-10 border-t border-border">
            {dining.menu.map((item) => (
              <li
                key={item.name}
                className="flex items-baseline justify-between gap-6 border-b border-border py-5"
              >
                <span>
                  <span className="block font-display text-lg text-primary">{item.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{item.copy}</span>
                </span>
                <UtensilsCrossed size={16} className="shrink-0 text-resort-gold-deep" />
              </li>
            ))}
          </ul>
          <Button asChild className={`mt-10 ${goldButton} h-12 px-8`}>
            <Link to="/booking">
              Book with meals <ArrowRight size={15} />
            </Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Activities ---------- */

export function ActivitiesSection() {
  return (
    <section id="activities" className={`scroll-mt-24 bg-resort-white ${pad}`}>
      <div className={wrap}>
        <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <SectionHeading eyebrow="Things to do" title="Activities on the island" />
          <p className="max-w-md text-[15px] leading-7 text-muted-foreground lg:justify-self-end">
            Out on the water by day, music and fire by night. Ask the front desk or add an activity
            when you book.
          </p>
        </Reveal>
        <Reveal className={`mt-10 sm:mt-14 ${swipeRow} sm:grid-cols-2 lg:grid-cols-4`}>
          {activities.map((item, i) => (
            <article key={item.name} className={`group relative overflow-hidden ${swipeItem}`}>
              <div className="sagara-image-frame aspect-[3/4]">
                <img
                  src={item.image.src}
                  alt={item.image.alt}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </div>
              <div
                className="absolute inset-0 flex flex-col justify-end p-6 text-resort-cream"
                style={{
                  background:
                    "linear-gradient(0deg, color-mix(in oklab, var(--resort-wood) 88%, transparent) 0%, color-mix(in oklab, var(--resort-wood) 30%, transparent) 45%, transparent 70%)",
                }}
              >
                <span className="font-display text-sm tabular-nums text-resort-gold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-2xl">{item.name}</h3>
                <p className="mt-2 text-sm leading-6 text-resort-cream/80">{item.copy}</p>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Indoor games ---------- */

const gameIcons = [CircleDot, Target, Crown, Dices, Spade, Puzzle];

export function IndoorGamesSection() {
  return (
    <section className={`bg-resort-deep text-resort-cream ${pad}`}>
      <div className={`${wrap} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}>
        <Reveal>
          <SectionHeading
            light
            eyebrow="Indoors"
            title="Games for rainy days and late evenings"
            copy="The lounge has games for every age. Ask at the front desk for boards, bats and cards."
          />
        </Reveal>
        <ul className="grid grid-cols-3 border-l border-t border-resort-cream/15">
          {indoorGames.map((game, i) => {
            const Icon = gameIcons[i % gameIcons.length] ?? Dices;
            return (
              <Reveal
                as="li"
                key={game.name}
                delay={(i % 3) * 90}
                className="border-b border-r border-resort-cream/15 px-2 py-5 text-center transition-colors hover:bg-resort-cream/5 sm:p-7 sm:text-left"
              >
                <Icon size={28} strokeWidth={1.25} className="mx-auto text-resort-gold sm:mx-0" />
                <h3 className="mt-3 text-sm leading-tight text-resort-cream sm:mt-5 sm:text-lg">
                  {game.name}
                </h3>
                <p className="mt-2 hidden text-[13px] leading-5 text-resort-cream/60 sm:block">
                  {game.copy}
                </p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Packages ---------- */

export function PackagesSection() {
  return (
    <section className="relative bg-resort-white px-6 pb-16 sm:px-8 sm:pb-24 lg:pb-28">
      <div className="absolute inset-x-0 top-0 h-[340px] bg-resort-gold sm:h-[360px]" />
      <div className={`relative ${wrap} pt-16 sm:pt-20 lg:pt-24`}>
        <Reveal className="max-w-2xl">
          <p className="text-[13px] font-medium text-resort-wood/70">Offers</p>
          <h2 className="mt-3 text-[34px] leading-[1.15] text-resort-wood sm:text-[42px]">
            Featured packages
          </h2>
          <span className="mt-5 block h-px w-12 bg-resort-wood/40" />
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-resort-wood/75">
            Rooms, meals and activities together for one price. Ask the resort for the current rate.
          </p>
        </Reveal>
        <Reveal className={`mt-10 sm:mt-12 ${swipeRow} sm:grid-cols-2 lg:grid-cols-3`}>
          {packages.map((item) => (
            <article key={item.name} className={`group flex flex-col bg-resort-white ${swipeItem}`}>
              <div className="sagara-image-frame aspect-[4/3]">
                <img
                  src={item.image.src}
                  alt={item.image.alt}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col px-1 pb-1 pt-5 sm:px-0 sm:pb-0 sm:pt-6">
                <h3 className="text-xl text-primary">{item.name}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                <span className="mt-6 block h-px w-10 bg-border" />
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="leading-tight">
                    <span className="font-display text-lg text-primary">Price on request</span>
                    <span className="block text-xs text-muted-foreground">{item.validity}</span>
                  </p>
                  <Button asChild className={goldButton}>
                    <Link to="/booking">Request</Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Gallery ---------- */

export function GallerySection() {
  const [category, setCategory] = useState<number | null>(null);
  const [photo, setPhoto] = useState(0);
  const photos = category === null ? [] : (galleryCategories[category]?.photos ?? []);
  const current = photos[photo];
  const step = (d: number) => setPhoto((i) => (i + d + photos.length) % photos.length);

  return (
    <section className={`bg-resort-cream ${pad}`}>
      <div className={wrap}>
        <Reveal className="flex items-center justify-center gap-5">
          <span className="h-px w-12 bg-resort-gold sm:w-20" />
          <h2 className="text-[34px] text-primary sm:text-[42px]">Our gallery</h2>
          <span className="h-px w-12 bg-resort-gold sm:w-20" />
        </Reveal>
        <Reveal as="ul" className={`mt-10 sm:mt-14 ${swipeRow} sm:grid-cols-3 lg:grid-cols-5`}>
          {galleryCategories.map((cat, i) => (
            <li key={cat.name} className="w-[44%] shrink-0 snap-start sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setCategory(i);
                  setPhoto(0);
                }}
                className="group block w-full text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resort-teal"
                aria-label={`Open ${cat.name} photos`}
              >
                <div className="sagara-image-frame aspect-[4/3]">
                  <img
                    src={cat.photos[0]!.src}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </div>
                <span className="mt-4 block font-display text-lg text-primary">{cat.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {cat.photos.length} photos
                </span>
              </button>
            </li>
          ))}
        </Reveal>
        <div className="mt-8 text-center sm:mt-12">
          <Link to="/gallery" className={textLink}>
            See all photos <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      <Dialog open={category !== null} onOpenChange={(v) => !v && setCategory(null)}>
        <DialogContent className="max-w-4xl gap-0 rounded-none border-0 bg-resort-wood p-0 text-resort-cream">
          <DialogTitle className="sr-only">
            {category !== null ? galleryCategories[category]?.name : "Gallery"} photos
          </DialogTitle>
          {current && (
            <img
              src={current.src}
              alt={current.alt}
              className="max-h-[78svh] w-full object-contain"
            />
          )}
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <Button
              variant="ghost"
              className="text-resort-cream hover:bg-resort-cream/10 hover:text-resort-cream"
              onClick={() => step(-1)}
            >
              <ChevronLeft size={16} /> Previous
            </Button>
            <span className="tabular-nums text-resort-cream/70">
              {current?.alt ? `${photo + 1} / ${photos.length}` : ""}
            </span>
            <Button
              variant="ghost"
              className="text-resort-cream hover:bg-resort-cream/10 hover:text-resort-cream"
              onClick={() => step(1)}
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ---------- Travel guide ---------- */

export function TravelGuideSection() {
  return (
    <section className={`bg-resort-white ${pad}`}>
      <div className={wrap}>
        <Reveal>
          <SectionHeading eyebrow="Plan your trip" title="Before you travel" />
        </Reveal>
        <Reveal className={`mt-10 sm:mt-12 ${swipeRow} sm:grid-cols-2 lg:grid-cols-3`}>
          {travelGuide.map((item) => (
            <article key={item.title} className={`group ${swipeItem}`}>
              <div className="sagara-image-frame aspect-[16/10]">
                <img
                  src={item.image.src}
                  alt={item.image.alt}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </div>
              <h3 className="mt-5 text-xl text-primary">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Contact and FAQ ---------- */

export function ContactFaqSection() {
  const c = resortContact;
  const maps = `https://www.google.com/maps?q=${c.mapQuery}`;
  return (
    <section className={`bg-resort-cream ${pad}`}>
      <div className={`${wrap} grid gap-16 lg:grid-cols-2 lg:gap-20`}>
        <Reveal>
          <SectionHeading eyebrow="Find us" title="Saint Martin's Island" />
          <ul className="mt-8 space-y-4 text-sm text-foreground">
            <li className="flex items-center gap-3">
              <MapPin size={17} className="text-resort-gold-deep" />
              {c.address || "Saint Martin's Island, Cox's Bazar, Bangladesh"}
            </li>
            {c.phone && (
              <li className="flex items-center gap-3">
                <Phone size={17} className="text-resort-gold-deep" />
                <a href={`tel:${c.phone}`} className="hover:text-resort-ocean">
                  {c.phone}
                </a>
              </li>
            )}
            {c.email && (
              <li className="flex items-center gap-3">
                <Mail size={17} className="text-resort-gold-deep" />
                <a href={`mailto:${c.email}`} className="hover:text-resort-ocean">
                  {c.email}
                </a>
              </li>
            )}
            {c.whatsapp && (
              <li className="flex items-center gap-3">
                <MessageCircle size={17} className="text-resort-gold-deep" />
                <a href={`https://wa.me/${c.whatsapp}`} className="hover:text-resort-ocean">
                  WhatsApp
                </a>
              </li>
            )}
          </ul>
          <div className="mt-8 aspect-[16/10] overflow-hidden border border-border bg-resort-sand sm:aspect-[4/3]">
            <iframe
              title="Map of Saint Martin's Island"
              src={`${maps}&z=12&output=embed`}
              loading="lazy"
              className="size-full border-0"
            />
          </div>
          <a href={maps} target="_blank" rel="noreferrer" className={`mt-3 ${textLink}`}>
            Get directions <ArrowRight size={14} />
          </a>
        </Reveal>
        <Reveal delay={120}>
          <SectionHeading eyebrow="Questions" title="Good to know" />
          <Accordion type="single" collapsible className="mt-8 border-t border-border">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`f${i}`} className="border-border">
                <AccordionTrigger className="py-5 text-left text-[15px] font-medium text-primary hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Final call to action ---------- */

export function FinalCta() {
  const image = heroSlides[0]!;
  return (
    <section className="relative isolate overflow-hidden px-6 py-20 text-center sm:px-8 sm:py-28 lg:py-36">
      <img
        src={image.image}
        alt=""
        loading="lazy"
        className="absolute inset-0 -z-20 size-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-resort-wood/80" />
      <Reveal className="mx-auto max-w-2xl text-resort-cream">
        <p className="text-[13px] font-medium text-resort-gold">Santa Monica Eco Beach Resort</p>
        <h2 className="mt-4 text-[36px] leading-[1.12] sm:text-[52px]">
          Plan your stay by the sea
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-7 text-resort-cream/75">
          Choose your dates, rooms and meals. The resort confirms every request.
        </p>
        <Button
          asChild
          className="mt-10 h-12 rounded-none bg-resort-gold px-9 text-[13px] font-medium text-resort-wood transition-colors hover:bg-resort-white"
        >
          <Link to="/booking">
            Check availability <ArrowRight size={15} />
          </Link>
        </Button>
      </Reveal>
    </section>
  );
}
