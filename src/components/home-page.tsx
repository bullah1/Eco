import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Compass, Leaf, Minus, Plus, Sparkles, Sunset, Ship, UtensilsCrossed, Waves } from "lucide-react";

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
            <Eyebrow light>Saint Martin's Island · Bangladesh</Eyebrow>
            <span className="mt-6 block h-px w-16 bg-resort-gold"/><h1 className="mt-6 max-w-3xl text-5xl leading-[1.04] sm:text-6xl lg:text-8xl">Where Silence<br className="hidden sm:block"/> Meets the Sea</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-resort-cream/90 sm:text-lg">A considered coastal retreat for the moments that ask you to slow down.</p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Button size="lg" className="h-12 rounded-none bg-resort-cream px-7 text-primary hover:bg-resort-sand" asChild><Link to="/booking">Find your stay <ArrowRight size={16}/></Link></Button>
              <Link to="/stays" className="group inline-flex items-center gap-2 text-sm text-resort-cream/90 hover:text-resort-gold">Discover the resort <ArrowRight size={15} className="transition-transform group-hover:translate-x-1"/></Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 right-8 hidden items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-resort-cream/70 lg:flex"><span className="h-px w-10 bg-resort-gold/80"/>Bay of Bengal</div>
      </section>

      <section className="relative z-10 mx-auto -mt-9 max-w-6xl px-5 sm:px-8">
        <form action="/booking" className="sagara-booking-bar grid gap-px bg-border p-px sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_auto]">
          <label className="flex items-center gap-3 bg-resort-white px-5 py-4">
            <CalendarDays size={18} className="text-resort-ocean"/><span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Arrival</span><Input type="date" name="checkIn" aria-label="Arrival date" min={today} value={checkIn} onChange={(event)=>{setCheckIn(event.target.value); if (checkOut && event.target.value >= checkOut) setCheckOut("");}} required className="mt-1 h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"/></span>
          </label>
          <label className="flex items-center gap-3 bg-resort-white px-5 py-4">
            <CalendarDays size={18} className="text-resort-ocean"/><span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Departure</span><Input type="date" name="checkOut" aria-label="Departure date" min={checkIn || nextDay} value={checkOut} onChange={(event)=>setCheckOut(event.target.value)} required className="mt-1 h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"/></span>
          </label>
          <div className="flex items-center gap-3 bg-resort-white px-5 py-4"><Waves size={18} className="text-resort-ocean"/><span className="flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Guests</span><span className="mt-1 flex items-center gap-3 text-sm"><Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Remove a guest" onClick={()=>setGuests(Math.max(1, guests-1))}><Minus size={13}/></Button><span className="min-w-4 text-center">{guests}</span><Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Add a guest" onClick={()=>setGuests(Math.min(6, guests+1))}><Plus size={13}/></Button></span></span><input type="hidden" name="guests" value={guests}/></div>
          <Button type="submit" className="h-full min-h-16 rounded-none px-8">Check availability <ArrowRight size={15}/></Button>
        </form>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-5 sm:px-8">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-5 text-primary sm:grid-cols-4">
          {[{icon:Waves,label:"Steps from the sea"},{icon:Leaf,label:"Eco-conscious stay"},{icon:UtensilsCrossed,label:"Fresh island seafood"},{icon:Ship,label:"Boat & island trips"}].map(({icon:Icon,label})=><li key={label} className="flex items-center gap-3 text-sm"><span className="grid size-10 shrink-0 place-items-center rounded-full border border-resort-gold/70 text-resort-gold"><Icon size={18}/></span>{label}</li>)}
        </ul>
      </section>

      <section className="bg-background px-6 py-20 sm:px-10 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
          <div><Eyebrow>A different kind of escape</Eyebrow><h2 className="mt-5 max-w-xl text-4xl leading-[1.15] text-primary sm:text-5xl">The best things happen when you make room for less.</h2><p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">At the edge of the Bay of Bengal, Santa Monica is a place to move with the tide. Thoughtful spaces, local rituals, and open horizons bring the everyday gently into focus.</p><div className="mt-8"><TextLink to="/experiences">A slower way to stay</TextLink></div></div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5"><div className="sagara-image-frame aspect-[4/5]"><img src={firstStayConcept.image} alt={firstStayConcept.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div><div className="mt-12 sagara-image-frame aspect-[4/5]"><img src={firstExperienceConcept.image} alt={firstExperienceConcept.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div></div>
        </div>
      </section>

      <section className="bg-resort-sand px-6 py-24 sm:px-10 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end"><SectionHeading eyebrow="A place to land" title="Space to simply be." copy="Stay concepts inspired by the coast, brought to life with honest materials and room to breathe."/><TextLink to="/stays">Explore the stay</TextLink></div>
          <div className="mt-12 grid gap-7 md:grid-cols-2">
            {stayConcepts.map((stay, index)=><article key={stay.name} className="group grid gap-6 bg-background p-4 sm:grid-cols-[1fr_0.9fr] sm:items-center sm:p-5"><div className="sagara-image-frame aspect-[5/4]"><img src={stay.image} alt={stay.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div><div className="px-2 pb-3 sm:px-1"><Eyebrow>{stay.category} 0{index+1}</Eyebrow><h3 className="mt-4 text-3xl text-primary">{stay.name}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{stay.description}</p><p className="mt-5 text-xs text-resort-ocean">{stay.detail}</p><Link to="/stays" className="mt-6 inline-flex items-center gap-2 text-sm text-primary">Discover the stay <ArrowRight size={14}/></Link></div></article>)}
          </div>
        </div>
      </section>

      <section className="bg-primary px-6 py-20 text-resort-cream sm:px-10 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><Eyebrow light>Days with a little more meaning</Eyebrow><h2 className="mt-4 text-4xl leading-tight sm:text-5xl">Follow your own tide.</h2><p className="mt-5 max-w-md text-sm leading-7 text-resort-cream/75">Some mornings are for movement. Some evenings are for a table set by the water.</p><div className="mt-7"><TextLink to="/experiences" light>Explore experiences</TextLink></div></div><div className="grid gap-5 sm:grid-cols-2">{experienceConcepts.map((item)=><article key={item.name} className="relative min-h-72 overflow-hidden bg-resort-wood"><img src={item.image} alt={item.imageAlt} loading="lazy" width={1600} height={1067} className="absolute inset-0 size-full object-cover opacity-75 transition-transform duration-700 hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/10 to-transparent"/><div className="absolute inset-x-0 bottom-0 p-6"><Eyebrow light>Made for the moment</Eyebrow><h3 className="mt-2 text-2xl text-resort-cream">{item.name}</h3><p className="mt-2 text-xs leading-5 text-resort-cream/75">{item.description}</p></div></article>)}</div></div>
      </section>

      <section className="bg-resort-cream px-6 py-20 sm:px-10 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"><div className="sagara-image-frame aspect-[5/4]"><img src={secondExperienceConcept.image} alt={secondExperienceConcept.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div><div><Eyebrow>Gather, taste, linger</Eyebrow><h2 className="mt-4 text-4xl leading-tight text-primary sm:text-5xl">A seat at the edge of everything.</h2><p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">A long table, the day’s last light, and the kind of conversation that doesn’t need a clock. Let the coast set the pace.</p><div className="mt-8"><TextLink to="/experiences">Find your moment</TextLink></div></div></div>
      </section>

      <section className="border-y border-border bg-background px-6 py-20 sm:px-10 lg:py-24"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 lg:grid-cols-4">{[{icon:Leaf,title:"Grounded in place",copy:"Natural materials and a lighter footprint, always close to the shoreline."},{icon:Sparkles,title:"Thoughtfully considered",copy:"The details are quiet, warm, and made to help you settle in."},{icon:Sunset,title:"Golden-hour evenings",copy:"Sunsets over the Bay of Bengal, from your doorstep to the shoreline."},{icon:Compass,title:"A world within reach",copy:"The open Bay of Bengal on one side, the quiet rhythm of island life on the other."}].map(({icon:Icon,title,copy})=><div key={title} className="border-t border-resort-gold pt-6"><Icon size={20} className="text-resort-ocean"/><h3 className="mt-5 text-2xl text-primary">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p></div>)}</div></section>

      <section className="relative overflow-hidden bg-resort-wood px-6 py-24 sm:px-10 lg:py-28"><img src={heroImage} alt="" loading="lazy" width={1600} height={960} className="absolute inset-0 size-full object-cover opacity-25"/><div className="absolute inset-0 bg-primary/45"/><div className="relative mx-auto max-w-3xl text-center text-resort-cream"><Eyebrow light>Your coast is calling</Eyebrow><h2 className="mt-5 text-4xl leading-tight sm:text-6xl">Let the day unfold.</h2><p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-resort-cream/75">Make space for the sea, and see where the quiet takes you.</p><Button size="lg" className="mt-8 h-12 rounded-none bg-resort-cream px-8 text-primary hover:bg-resort-sand" asChild><Link to="/booking">Begin your stay <ArrowRight size={15}/></Link></Button></div></section>
    </>
  );
}