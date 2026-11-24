import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { heroSlides, welcome } from "@/lib/resort-content";
import {
  ActivitiesSection,
  ContactFaqSection,
  DiningSection,
  FacilitiesSection,
  FinalCta,
  GallerySection,
  HomeRooms,
  IndoorGamesSection,
  PackagesSection,
  TravelGuideSection,
} from "@/components/home-sections";

const field =
  "mt-1 h-11 w-full border border-border bg-resort-white px-3 text-sm text-foreground outline-none transition-colors focus:border-resort-teal focus-visible:ring-2 focus-visible:ring-resort-teal/30";

function Hero() {
  const [index, setIndex] = useState(0);
  const count = heroSlides.length;
  const go = (step: number) => setIndex((current) => (current + step + count) % count);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => go(1), 7000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const slide = heroSlides[index]!;

  return (
    <section
      className="relative isolate flex min-h-[max(600px,calc(100svh-109px))] items-center overflow-hidden bg-resort-wood"
      aria-roledescription="carousel"
      aria-label="Santa Monica Eco Beach Resort"
    >
      {heroSlides.map((item, i) => (
        <div
          key={item.title}
          className="hero-slide absolute inset-0 -z-20"
          data-active={i === index ? "true" : "false"}
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden={i !== index}
        >
          <img
            src={item.image}
            alt={item.alt}
            className="size-full object-cover"
            fetchPriority={i === 0 ? "high" : "low"}
            loading={i === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in oklab, var(--resort-wood) 78%, transparent) 0%, color-mix(in oklab, var(--resort-wood) 45%, transparent) 50%, color-mix(in oklab, var(--resort-wood) 10%, transparent) 100%), linear-gradient(0deg, color-mix(in oklab, var(--resort-wood) 55%, transparent), transparent 40%)",
        }}
      />

      <div className="mx-auto w-full max-w-[1180px] px-6 pb-36 pt-20 sm:px-8 lg:pb-40">
        <div key={index} className="hero-copy-in max-w-xl text-resort-cream" aria-live="polite">
          <p className="flex items-center gap-3 text-[13px] text-resort-gold">
            <span className="h-px w-10 bg-resort-gold" />
            Saint Martin's Island · 20°37′N 92°19′E
          </p>
          <h1 className="mt-6 text-[40px] font-medium leading-[1.08] sm:text-[56px] lg:text-[64px]">
            {slide.title}
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-resort-cream/85 sm:text-base">
            {slide.copy}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Button
              asChild
              className="h-12 rounded-none bg-resort-gold px-8 text-[13px] font-medium text-resort-wood transition-colors hover:bg-resort-white"
            >
              <Link to="/booking">
                Book a room <ArrowRight size={15} />
              </Link>
            </Button>
            <Link
              to="/stays"
              className="border-b border-resort-cream/40 pb-1 text-sm text-resort-cream transition-colors hover:border-resort-gold hover:text-resort-gold"
            >
              See the rooms
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-28 right-6 flex items-center gap-4 text-resort-cream sm:right-8 lg:bottom-32 lg:right-[max(2rem,calc((100vw-1180px)/2+2rem))]">
        <span className="font-display text-sm tabular-nums">
          {String(index + 1).padStart(2, "0")}
          <span className="text-resort-cream/50"> / {String(count).padStart(2, "0")}</span>
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="grid size-10 place-items-center border border-resort-cream/40 transition-colors hover:border-resort-gold hover:bg-resort-gold hover:text-resort-wood"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next slide"
            className="grid size-10 place-items-center border border-resort-cream/40 transition-colors hover:border-resort-gold hover:bg-resort-gold hover:text-resort-wood"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

function BookingBar() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!checkIn || !checkOut) return setError("Choose your arrival and departure dates");
    if (checkOut <= checkIn) return setError("Departure must be after arrival");
    setError("");
    void navigate({
      to: "/booking",
      search: { checkIn, checkOut, guests: Math.min(6, adults + children) },
    });
  }

  return (
    <section className="relative z-10 bg-resort-white">
      <div className="relative -top-16 mx-auto -mb-16 max-w-[1100px] px-4 sm:px-8">
        <form
          onSubmit={submit}
          noValidate
          className="sagara-booking-bar grid gap-4 bg-resort-white p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] lg:items-end"
        >
          <label className="text-xs font-medium text-muted-foreground">
            Arrival date
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
            Departure date
            <input
              type="date"
              className={field}
              min={checkIn || today}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Adults
            <select
              className={field}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Children
            <select
              className={field}
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            className="h-11 rounded-none bg-primary px-7 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-resort-gold hover:text-resort-wood sm:col-span-2 lg:col-span-1"
          >
            Check availability
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-5">
              {error}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

function Welcome() {
  return (
    <section className="bg-resort-white px-6 pb-24 pt-20 sm:px-8 lg:pb-32 lg:pt-28">
      <div className="mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        <Reveal className="grid grid-cols-2 gap-4">
          {welcome.images.map((img, i) => (
            <div
              key={img.alt}
              className={`sagara-image-frame aspect-[3/4] ${i === 1 ? "mt-12" : ""}`}
            >
              <img src={img.src} alt={img.alt} loading="lazy" className="size-full object-cover" />
            </div>
          ))}
        </Reveal>
        <Reveal delay={120}>
          <p className="text-[13px] font-medium text-resort-ocean">Welcome</p>
          <h2 className="mt-3 text-[34px] leading-[1.15] text-primary sm:text-[44px]">
            {welcome.title}
          </h2>
          <span className="gold-rule mt-5" />
          <p className="mt-6 font-display text-xl leading-8 text-primary/85">{welcome.lead}</p>
          <p className="mt-5 text-[15px] leading-7 text-muted-foreground">{welcome.copy}</p>
          <Button
            asChild
            className="mt-9 h-12 rounded-none bg-resort-gold px-8 text-[13px] font-medium text-resort-wood transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Link to="/stays">Know more</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />
      <BookingBar />
      <Welcome />
      <HomeRooms />
      <FacilitiesSection />
      <DiningSection />
      <ActivitiesSection />
      <IndoorGamesSection />
      <PackagesSection />
      <GallerySection />
      <TravelGuideSection />
      <ContactFaqSection />
      <FinalCta />
    </>
  );
}
