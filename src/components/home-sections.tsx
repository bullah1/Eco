import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ConciergeBell,
  Flame,
  MapPin,
  Mail,
  MessageCircle,
  Phone,
  Ship,
  UtensilsCrossed,
  Waves,
  Wifi,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { activities, facilities, faqs, packages, resortContact } from "@/lib/resort-content";
import { experienceConcepts, stayConcepts } from "@/lib/resort-data";
import { supabase } from "@/integrations/supabase/client";
import { getRoomMedia } from "@/lib/room-media";
import { formatMoney } from "@/lib/room-booking";
import heroImage from "@/assets/sagara-coast-hero.jpg";
import poolUmbrellas from "@/assets/gallery/pool-umbrellas.jpg";
import infinityPoolDusk from "@/assets/gallery/infinity-pool-dusk.jpg";
import palmPoolBeach from "@/assets/gallery/palm-pool-beach.jpg";
import aerialBeach from "@/assets/gallery/aerial-beach.jpg";
import aerialLagoon from "@/assets/gallery/aerial-lagoon.jpg";

function Index({ n, label, light = false }: { n: string; label: string; light?: boolean }) {
  return (
    <p
      className={`flex items-center gap-4 text-sm ${light ? "text-resort-cream/70" : "text-muted-foreground"}`}
    >
      <span className="font-display text-xl text-resort-gold">{n}</span>
      <span className={`h-px w-10 ${light ? "bg-resort-cream/25" : "bg-border"}`} />
      {label}
    </p>
  );
}

const facilityIcons = [Waves, UtensilsCrossed, ConciergeBell, Wifi, Ship, Flame];

export function FacilitiesSection() {
  return (
    <section className="bg-primary px-6 py-24 text-resort-cream sm:px-10 lg:py-32">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-5xl font-normal leading-[1.05] sm:text-6xl">
          Our services and facilities
        </h2>
        <span className="mt-6 block h-px w-16 bg-resort-gold" />
        <ul className="mt-16 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((item, i) => {
            const Icon = facilityIcons[i % facilityIcons.length] ?? Waves;
            return (
              <li key={item.name}>
                <Icon size={40} strokeWidth={1} className="text-resort-gold" />
                <h3 className="mt-5 text-3xl font-normal text-resort-cream">{item.name}</h3>
                <p className="mt-2 text-sm leading-7 text-resort-cream/70">{item.copy}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-20 border-t border-resort-cream/20 pt-10">
          <p className="text-sm text-resort-cream/70">Activities</p>
          <ul className="mt-5 flex flex-wrap gap-3">
            {activities.map((name) => (
              <li
                key={name}
                className="border border-resort-cream/25 px-4 py-2 text-sm text-resort-cream"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function HomeRooms() {
  const scroller = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ["home-room-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_types")
        .select("id, name, slug, description, image_url, max_guests, nightly_rate_cents")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const rooms = useMemo(() => {
    const live = query.data ?? [];
    return live.map((room, i) => ({
      key: room.id,
      name: room.name,
      slug: room.slug,
      description: room.description,
      price: formatMoney(room.nightly_rate_cents),
      image:
        getRoomMedia(room.slug, room.image_url || undefined).photos[0] ??
        stayConcepts[i % stayConcepts.length]?.image ??
        "",
      alt: `${room.name} at Santa Monica Eco Beach Resort`,
    }));
  }, [query.data]);
  const scrollBy = (dir: number) =>
    scroller.current?.scrollBy({ left: dir * 380, behavior: "smooth" });

  return (
    <section
      className="border-y border-border bg-background px-6 py-24 sm:px-10 lg:py-32"
      style={{ backgroundColor: "var(--secondary)" }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-5xl font-normal leading-[1.05] text-primary sm:text-6xl">
              Rooms and suites
            </h2>
            <span className="mt-6 block h-px w-16 bg-resort-gold" />
            <p className="mt-6 text-sm text-muted-foreground">Pick the room that suits your stay</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous rooms"
              onClick={() => scrollBy(-1)}
              className="grid size-11 place-items-center border border-primary/30 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next rooms"
              onClick={() => scrollBy(1)}
              className="grid size-11 place-items-center border border-primary/30 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {query.isLoading && (
          <p role="status" className="mt-12 text-sm text-muted-foreground">
            Loading rooms
          </p>
        )}
        {query.isError && (
          <p role="alert" className="mt-12 text-sm text-muted-foreground">
            We couldn't load the rooms just now.{" "}
            <button type="button" className="underline" onClick={() => query.refetch()}>
              Try again
            </button>
          </p>
        )}
        {!query.isLoading && !query.isError && rooms.length === 0 && (
          <p className="mt-12 max-w-md text-sm text-muted-foreground">
            Rooms will appear here as soon as the resort publishes them. You can still send a
            reservation request.
          </p>
        )}

        {rooms.length > 0 && (
          <div
            ref={scroller}
            className="mt-12 flex snap-x snap-mandatory gap-8 overflow-x-auto pb-4 [scrollbar-width:none]"
          >
            {rooms.map((room) => (
              <article key={room.key} className="w-[min(86vw,420px)] shrink-0 snap-start">
                <div className="sagara-image-frame aspect-[4/3]">
                  {room.image ? (
                    <img
                      src={room.image}
                      alt={room.alt}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <h3 className="mt-6 text-3xl font-normal text-primary">{room.name}</h3>
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">
                  {room.description}
                </p>
                <div className="mt-6 flex items-end justify-between gap-4">
                  <p>
                    <span className="font-display text-3xl text-primary">{room.price}</span>
                    <span className="block text-xs text-muted-foreground">Per night</span>
                  </p>
                  <Button
                    asChild
                    className="h-11 rounded-none bg-resort-gold px-6 text-xs tracking-[0.1em] text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Link to="/rooms/$slug" params={{ slug: room.slug }}>
                      DETAILS
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function PackagesSection() {
  return (
    <section className="border-t border-border bg-resort-cream px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <Index n="05" label="Packages" />
        <h2 className="mt-6 text-5xl font-normal leading-[1.05] text-primary sm:text-6xl lg:text-7xl">
          Packages
        </h2>
        <div className="mt-16 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((item) => (
            <article key={item.name} className="flex flex-col bg-resort-cream p-8">
              <h3 className="text-3xl font-normal text-primary">{item.name}</h3>
              <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">{item.copy}</p>
              <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
                <Check size={14} className="mt-0.5 shrink-0 text-resort-gold" />
                {item.validity}
              </p>
              <p className="mt-2 text-sm text-primary">Price on request</p>
              <Link
                to="/booking"
                className="mt-6 inline-flex items-center gap-2 border-b border-resort-gold pb-1 text-sm text-primary transition-colors hover:text-resort-ocean self-start"
              >
                Request this package <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const gallery = [
  {
    src: palmPoolBeach,
    alt: "Pool, sun loungers and palms beside the sea",
    span: "sm:col-span-2 sm:row-span-2",
  },
  { src: infinityPoolDusk, alt: "Infinity pool overlooking the sea at dusk", span: "" },
  { src: aerialBeach, alt: "Aerial view of the beach, pools and shaded loungers", span: "" },
  {
    src: poolUmbrellas,
    alt: "Sun loungers and umbrellas by the pool and sea",
    span: "sm:col-span-2",
  },
  {
    src: aerialLagoon,
    alt: "Aerial view of a lagoon ringed by sea cottages",
    span: "sm:col-span-2",
  },
  { src: heroImage, alt: "Wooden fishing boats on the water off Saint Martin's Island", span: "" },
  ...stayConcepts.map((s) => ({ src: s.image, alt: s.imageAlt, span: "" })),
  ...experienceConcepts.map((s) => ({ src: s.image, alt: s.imageAlt, span: "" })),
].filter((item, i, all) => all.findIndex((x) => x.src === item.src) === i);

export function GallerySection() {
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : gallery[open];
  const step = (d: number) =>
    setOpen((i) => (i === null ? i : (i + d + gallery.length) % gallery.length));
  return (
    <section className="bg-background px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <Index n="06" label="Gallery" />
        <h2 className="mt-6 text-5xl font-normal leading-[1.05] text-primary sm:text-6xl lg:text-7xl">
          The coast in pictures
        </h2>
        <ul className="mt-16 grid auto-rows-[220px] grid-flow-dense gap-3 sm:grid-cols-2 lg:auto-rows-[260px] lg:grid-cols-4">
          {gallery.map((item, i) => (
            <li key={item.src} className={i >= gallery.length - 2 ? "lg:col-span-2" : item.span}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={`Open photo: ${item.alt}`}
                className="sagara-image-frame block size-full"
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-4xl gap-0 rounded-none p-0">
          <DialogTitle className="sr-only">Photo gallery</DialogTitle>
          {current && (
            <img
              src={current.src}
              alt={current.alt}
              className="max-h-[80svh] w-full object-contain"
            />
          )}
          <div className="flex items-center justify-between p-4 text-sm">
            <Button variant="ghost" onClick={() => step(-1)}>
              Previous
            </Button>
            <span className="text-muted-foreground">
              {open !== null ? open + 1 : 0} / {gallery.length}
            </span>
            <Button variant="ghost" onClick={() => step(1)}>
              Next
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function ContactFaqSection() {
  const c = resortContact;
  const maps = `https://www.google.com/maps?q=${c.mapQuery}`;
  return (
    <section className="border-t border-border bg-resort-cream px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-2 lg:gap-24">
        <div>
          <Index n="07" label="Find us" />
          <h2 className="mt-6 text-5xl font-normal leading-[1.05] text-primary sm:text-6xl">
            Saint Martin's Island
          </h2>
          <ul className="mt-10 space-y-4 text-sm text-primary">
            <li className="flex items-center gap-3">
              <MapPin size={16} className="text-resort-gold" />
              {c.address || "Saint Martin's Island, Bangladesh"}
            </li>
            {c.phone && (
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-resort-gold" />
                <a href={`tel:${c.phone}`} className="hover:text-resort-ocean">
                  {c.phone}
                </a>
              </li>
            )}
            {c.email && (
              <li className="flex items-center gap-3">
                <Mail size={16} className="text-resort-gold" />
                <a href={`mailto:${c.email}`} className="hover:text-resort-ocean">
                  {c.email}
                </a>
              </li>
            )}
            {c.whatsapp && (
              <li className="flex items-center gap-3">
                <MessageCircle size={16} className="text-resort-gold" />
                <a href={`https://wa.me/${c.whatsapp}`} className="hover:text-resort-ocean">
                  WhatsApp
                </a>
              </li>
            )}
          </ul>
          <div className="mt-10 aspect-[4/3] overflow-hidden border border-border">
            <iframe
              title="Map of Saint Martin's Island"
              src={`${maps}&z=12&output=embed`}
              loading="lazy"
              className="size-full border-0"
            />
          </div>
          <Button asChild variant="outline" className="mt-6 rounded-none">
            <a href={maps} target="_blank" rel="noreferrer">
              Get directions <ArrowRight size={15} />
            </a>
          </Button>
        </div>
        <div>
          <Index n="08" label="Questions" />
          <h2 className="mt-6 text-5xl font-normal leading-[1.05] text-primary sm:text-6xl">
            Good to know
          </h2>
          <Accordion type="single" collapsible className="mt-10 border-t border-border">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`f${i}`} className="border-border">
                <AccordionTrigger className="text-left text-base font-normal text-primary hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
