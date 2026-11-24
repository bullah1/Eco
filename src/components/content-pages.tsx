import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ChevronRight as Crumb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "@/components/reveal";
import { ReviewsSection } from "@/components/reviews";
import {
  ActivitiesSection,
  ContactFaqSection,
  DiningSection,
  FacilitiesSection,
  FinalCta,
  IndoorGamesSection,
  TravelGuideSection,
} from "@/components/home-sections";
import { RoomCategories } from "@/components/room-categories";
import { allGalleryPhotos, galleryCategories, heroSlides } from "@/lib/resort-content";

function PageHero({
  title,
  copy,
  crumb,
  image,
  alt,
}: {
  title: string;
  copy: string;
  crumb: string;
  image: string;
  alt: string;
}) {
  return (
    <section className="relative isolate flex min-h-[340px] items-end overflow-hidden bg-resort-wood lg:min-h-[420px]">
      <img
        src={image}
        alt={alt}
        className="absolute inset-0 -z-20 size-full object-cover"
        fetchPriority="high"
      />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(0deg, color-mix(in oklab, var(--resort-wood) 85%, transparent) 0%, color-mix(in oklab, var(--resort-wood) 45%, transparent) 60%, color-mix(in oklab, var(--resort-wood) 30%, transparent) 100%)",
        }}
      />
      <div className="hero-copy-in mx-auto w-full max-w-[1180px] px-6 pb-14 pt-24 text-resort-cream sm:px-8 lg:pb-16">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-[13px] text-resort-cream/75"
        >
          <Link to="/" className="transition-colors hover:text-resort-gold">
            Home
          </Link>
          <Crumb size={13} />
          <span className="text-resort-cream">{crumb}</span>
        </nav>
        <h1 className="mt-4 text-[38px] font-medium leading-[1.1] sm:text-[52px]">{title}</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-7 text-resort-cream/80">{copy}</p>
      </div>
    </section>
  );
}

export function StaysPage() {
  return (
    <>
      <PageHero
        crumb="Rooms"
        title="Rooms and suites"
        copy="Every room category with its price, beds, size and view. Open a room for photos, the 360° view and video, or book it straight away."
        image={heroSlides[1]!.image}
        alt={heroSlides[1]!.alt}
      />
      <RoomCategories />
      <FacilitiesSection />
      <ReviewsSection />
      <FinalCta />
    </>
  );
}

export function ExperiencesPage() {
  return (
    <>
      <PageHero
        crumb="Dining and activities"
        title="Food, sea and things to do"
        copy="Island seafood from the resort kitchen, speedboat trips, beach games, music nights and a lounge full of games."
        image={heroSlides[2]!.image}
        alt={heroSlides[2]!.alt}
      />
      <DiningSection />
      <ActivitiesSection />
      <IndoorGamesSection />
      <TravelGuideSection />
      <FinalCta />
    </>
  );
}

export function GalleryPage() {
  const [filter, setFilter] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const photos = filter === null ? allGalleryPhotos : (galleryCategories[filter]?.photos ?? []);
  const current = open === null ? null : photos[open];
  const step = (d: number) =>
    setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length));
  const tabs = [
    { name: "All", count: allGalleryPhotos.length },
    ...galleryCategories.map((c) => ({ name: c.name, count: c.photos.length })),
  ];

  return (
    <>
      <PageHero
        crumb="Gallery"
        title="The coast in pictures"
        copy="The beach, the pool, the boats and the water around Saint Martin's."
        image={heroSlides[0]!.image}
        alt={heroSlides[0]!.alt}
      />
      <section className="bg-resort-white px-6 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-[1180px]">
          <div
            role="tablist"
            aria-label="Photo categories"
            className="flex flex-wrap justify-center gap-2"
          >
            {tabs.map((tab, i) => {
              const value = i === 0 ? null : i - 1;
              const active = filter === value;
              return (
                <button
                  key={tab.name}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(value)}
                  className={`h-10 border px-5 text-[13px] transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-resort-gold"}`}
                >
                  {tab.name}{" "}
                  <span className={active ? "text-primary-foreground/60" : "text-muted-foreground"}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          <ul
            key={filter ?? "all"}
            className="mt-12 grid auto-rows-[220px] grid-flow-dense gap-3 sm:grid-cols-2 lg:auto-rows-[260px] lg:grid-cols-4"
          >
            {photos.map((photo, i) => (
              <Reveal
                as="li"
                key={photo.alt}
                delay={(i % 4) * 70}
                className={i % 5 === 0 ? "sm:col-span-2 sm:row-span-2" : ""}
              >
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={`Open photo: ${photo.alt}`}
                  className="sagara-image-frame block size-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resort-teal"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </button>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-5xl gap-0 rounded-none border-0 bg-resort-wood p-0 text-resort-cream">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {current && (
            <img
              src={current.src}
              alt={current.alt}
              className="max-h-[80svh] w-full object-contain"
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
            <span className="max-w-[50%] truncate text-resort-cream/70">{current?.alt}</span>
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
      <FinalCta />
    </>
  );
}

export function ContactPage() {
  return (
    <>
      <PageHero
        crumb="Contact"
        title="Find us on Saint Martin's"
        copy="How to reach the island, where the resort is, and answers to the questions guests ask most."
        image={heroSlides[2]!.image}
        alt={heroSlides[2]!.alt}
      />
      <ContactFaqSection />
      <TravelGuideSection />
      <FinalCta />
    </>
  );
}
