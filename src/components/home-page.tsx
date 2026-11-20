import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Minus, Plus, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { experienceConcepts, firstExperienceConcept, firstStayConcept, secondExperienceConcept, stayConcepts } from "@/lib/resort-data";
import { Eyebrow, SectionHeading, TextLink } from "@/components/resort-site";
import heroImage from "@/assets/sagara-coast-hero.jpg";

export function HomePage() {
  const today = new Date().toISOString().slice(0, 10);
  const nextDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  return (
    <>
      <section className="sagara-hero flex items-end">
        <img className="sagara-hero-image" src={heroImage} alt="Traditional wooden fishing boats on the turquoise water off Saint Martin's Island" width={1600} height={960} fetchPriority="high" />
        <div className="relative mx-auto w-full max-w-[1440px] px-6 pb-28 pt-32 sm:px-10 sm:pb-36 lg:px-16 lg:pb-40">
          <div className="sagara-hero-copy max-w-[800px] text-resort-cream">
            <Eyebrow light>Santa Monica Eco Beach Resort</Eyebrow>
            <span className="mt-6 block h-px w-16 bg-resort-gold"/><h1 className="mt-6 max-w-3xl text-5xl leading-[1.04] sm:text-6xl lg:text-7xl">Stay by the sea on<br className="hidden sm:block"/> Saint Martin's Island</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-resort-cream/90 sm:text-lg">Santa Monica Eco Beach Resort, on Bangladesh's only coral island. Choose your dates and rooms, and the resort confirms your stay.</p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Button size="lg" className="h-12 rounded-none bg-resort-cream px-7 text-primary hover:bg-resort-sand" asChild><Link to="/booking">Reserve a room <ArrowRight size={16}/></Link></Button>
              <Link to="/stays" className="group inline-flex items-center gap-2 text-sm text-resort-cream/90 hover:text-resort-gold">See the rooms <ArrowRight size={15} className="transition-transform group-hover:translate-x-1"/></Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 right-8 hidden items-center gap-3 text-xs text-resort-cream/70 lg:flex"><span className="h-px w-10 bg-resort-gold/80"/>Bay of Bengal</div>
      </section>

      <section className="relative z-10 mx-auto -mt-9 max-w-6xl px-5 sm:px-8">
        <form action="/booking" className="sagara-booking-bar grid gap-px bg-border p-px sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_auto]">
          <label className="flex items-center gap-3 bg-resort-white px-5 py-4">
            <CalendarDays size={18} className="text-resort-ocean"/><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-muted-foreground">Arrival</span><Input type="date" name="checkIn" aria-label="Arrival date" min={today} value={checkIn} onChange={(event)=>{setCheckIn(event.target.value); if (checkOut && event.target.value >= checkOut) setCheckOut("");}} required className="mt-1 h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"/></span>
          </label>
          <label className="flex items-center gap-3 bg-resort-white px-5 py-4">
            <CalendarDays size={18} className="text-resort-ocean"/><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-muted-foreground">Departure</span><Input type="date" name="checkOut" aria-label="Departure date" min={checkIn || nextDay} value={checkOut} onChange={(event)=>setCheckOut(event.target.value)} required className="mt-1 h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"/></span>
          </label>
          <div className="flex items-center gap-3 bg-resort-white px-5 py-4"><Waves size={18} className="text-resort-ocean"/><span className="flex-1"><span className="block text-xs font-medium text-muted-foreground">Guests</span><span className="mt-1 flex items-center gap-3 text-sm"><Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Remove a guest" onClick={()=>setGuests(Math.max(1, guests-1))}><Minus size={13}/></Button><span className="min-w-4 text-center">{guests}</span><Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Add a guest" onClick={()=>setGuests(Math.min(6, guests+1))}><Plus size={13}/></Button></span></span><input type="hidden" name="guests" value={guests}/></div>
          <Button type="submit" className="h-full min-h-16 rounded-none px-8">Check availability <ArrowRight size={15}/></Button>
        </form>
      </section>

      <section className="bg-background px-6 py-20 sm:px-10 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
          <div><Eyebrow>The island</Eyebrow><h2 className="mt-5 max-w-xl text-4xl leading-[1.15] text-primary sm:text-5xl">An island you cross by sea, a resort you walk out of onto the sand</h2><p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">Saint Martin's sits at the south-eastern tip of the Bay of Bengal. Days here follow the tide: fishing boats out at dawn, palms along the beach, long evenings on the water.</p><div className="mt-8"><TextLink to="/experiences">See the experiences</TextLink></div></div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5"><div className="sagara-image-frame aspect-[4/5]"><img src={firstStayConcept.image} alt={firstStayConcept.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div><div className="mt-12 sagara-image-frame aspect-[4/5]"><img src={firstExperienceConcept.image} alt={firstExperienceConcept.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div></div>
        </div>
      </section>

      <section className="bg-resort-sand px-6 py-24 sm:px-10 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end"><SectionHeading eyebrow="Rooms" title="Where you will stay" copy="Two room types, each built from natural materials and facing the coast."/><TextLink to="/stays">All rooms</TextLink></div>
          <div className="mt-12 grid gap-7 md:grid-cols-2">
            {stayConcepts.map((stay, index)=><article key={stay.name} className="group grid gap-6 bg-background p-4 sm:grid-cols-[1fr_0.9fr] sm:items-center sm:p-5"><div className="sagara-image-frame aspect-[5/4]"><img src={stay.image} alt={stay.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div><div className="px-2 pb-3 sm:px-1"><Eyebrow>{stay.category} 0{index+1}</Eyebrow><h3 className="mt-4 text-3xl text-primary">{stay.name}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{stay.description}</p><p className="mt-5 text-xs text-resort-ocean">{stay.detail}</p><Link to="/stays" className="mt-6 inline-flex items-center gap-2 text-sm text-primary">See room <ArrowRight size={14}/></Link></div></article>)}
          </div>
        </div>
      </section>

      <section className="bg-primary px-6 py-20 text-resort-cream sm:px-10 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><Eyebrow light>Things to do</Eyebrow><h2 className="mt-4 text-4xl leading-tight sm:text-5xl">Follow the tide</h2><p className="mt-5 max-w-md text-sm leading-7 text-resort-cream/75">Morning walks, boat trips, and dinner by the water.</p><div className="mt-7"><TextLink to="/experiences" light>Explore experiences</TextLink></div></div><div className="grid gap-5 sm:grid-cols-2">{experienceConcepts.map((item)=><article key={item.name} className="relative min-h-72 overflow-hidden bg-resort-wood"><img src={item.image} alt={item.imageAlt} loading="lazy" width={1600} height={1067} className="absolute inset-0 size-full object-cover opacity-75 "/><div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/10 to-transparent"/><div className="absolute inset-x-0 bottom-0 p-6"><Eyebrow light>Experience</Eyebrow><h3 className="mt-2 text-2xl text-resort-cream">{item.name}</h3><p className="mt-2 text-xs leading-5 text-resort-cream/75">{item.description}</p></div></article>)}</div></div>
      </section>

      <section className="bg-resort-cream px-6 py-20 sm:px-10 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"><div className="sagara-image-frame aspect-[5/4]"><img src={secondExperienceConcept.image} alt={secondExperienceConcept.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div><div><Eyebrow>Dining</Eyebrow><h2 className="mt-4 text-4xl leading-tight text-primary sm:text-5xl">Dinner at the water's edge</h2><p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">A long table, the last light of the day, and the sea in front of you.</p><div className="mt-8"><TextLink to="/experiences">See dining</TextLink></div></div></div>
      </section>

      <section className="border-y border-border bg-background px-6 py-20 sm:px-10 lg:py-24"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">{[{title:"On the shoreline",copy:"Rooms sit close to the water on Saint Martin's Island, Bangladesh's only coral island."},{title:"Built with natural materials",copy:"Timber, linen and local craft keep the footprint light and the rooms warm."},{title:"Request in minutes",copy:"Pick dates and rooms online. The resort confirms your stay directly."}].map(({title,copy})=><div key={title} className="border-t border-resort-gold pt-6"><h3 className="text-2xl text-primary">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p></div>)}</div></section>

      <section className="relative overflow-hidden bg-primary px-6 py-24 sm:px-10 lg:py-28"><div className="relative mx-auto max-w-3xl text-center text-resort-cream"><Eyebrow light>Book</Eyebrow><h2 className="mt-5 text-4xl leading-tight sm:text-6xl">Plan your stay</h2><p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-resort-cream/75">Pick your dates and rooms. The resort confirms every request.</p><Button size="lg" className="mt-8 h-12 rounded-none bg-resort-cream px-8 text-primary hover:bg-resort-sand" asChild><Link to="/booking">Check availability <ArrowRight size={15}/></Link></Button></div></section>
    </>
  );
}