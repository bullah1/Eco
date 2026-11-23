import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Minus, Plus, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { firstStayConcept, secondStayConcept } from "@/lib/resort-data";
import { ContactFaqSection, FacilitiesSection, GallerySection, HomeRooms, PackagesSection } from "@/components/home-sections";
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
        <div className="relative mx-auto w-full max-w-[1440px] px-6 pb-32 pt-32 sm:px-10 sm:pb-40 lg:px-16 lg:pb-44">
          <div className="sagara-hero-copy max-w-[960px] text-resort-cream">
            <p className="flex items-center gap-4 text-xs tracking-[0.04em] text-resort-gold"><span className="h-px w-12 bg-resort-gold"/>Saint Martin's Island · 20°37′N 92°19′E</p>
            <h1 className="mt-8 text-[44px] font-normal leading-[0.98] tracking-[-0.025em] sm:text-7xl lg:text-[104px]">Stay by the sea<br/>on Saint Martin's</h1>
            <p className="mt-8 max-w-xl text-base leading-8 text-resort-cream/90 sm:text-lg">Santa Monica Eco Beach Resort, on Bangladesh's only coral island. Choose your dates and rooms, and the resort confirms your stay.</p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Button size="lg" className="h-12 rounded-none bg-resort-gold px-8 text-primary hover:bg-resort-cream" asChild><Link to="/booking">Reserve a room <ArrowRight size={16}/></Link></Button>
              <Link to="/stays" className="group inline-flex items-center gap-2 border-b border-resort-cream/40 pb-1 text-sm text-resort-cream transition-colors hover:border-resort-gold hover:text-resort-gold">See the rooms <ArrowRight size={15}/></Link>
            </div>
          </div>
        </div>
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

      <section className="bg-background px-6 py-24 sm:px-10 lg:py-36">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="sagara-image-frame aspect-[3/4]"><img src={firstStayConcept.image} alt={firstStayConcept.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover" /></div>
            <div className="sagara-image-frame mt-10 aspect-[3/4] sm:mt-16"><img src={secondStayConcept.image} alt={secondStayConcept.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover" /></div>
          </div>
          <div className="mt-16 max-w-2xl">
            <h2 className="text-5xl font-normal leading-[1.05] text-primary sm:text-6xl">Welcome to Santa Monica</h2>
            <span className="mt-6 block h-px w-16 bg-resort-gold" />
            <p className="mt-8 text-lg leading-8 text-primary/80">Saint Martin's sits at the south-eastern tip of the Bay of Bengal. Days here follow the tide: fishing boats out at dawn, palms along the beach, long evenings on the water.</p>
            <p className="mt-4 text-base leading-8 text-muted-foreground">Santa Monica Eco Beach Resort is a quiet place to stay on Bangladesh's only coral island.</p>
            <Button asChild className="mt-10 h-12 rounded-none bg-resort-gold px-8 text-sm tracking-[0.08em] text-primary hover:bg-primary hover:text-primary-foreground"><Link to="/stays">Know more</Link></Button>
          </div>
        </div>
      </section>

      <HomeRooms />

      <FacilitiesSection />
      <PackagesSection />
      <GallerySection />
      <ContactFaqSection />

      <section className="bg-background px-6 py-24 sm:px-10 lg:py-32"><div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-3 md:gap-16">{[{n:"i",title:"On the shoreline",copy:"Rooms sit close to the water on Saint Martin's Island, Bangladesh's only coral island."},{n:"ii",title:"Built with natural materials",copy:"Timber, linen and local craft keep the footprint light and the rooms warm."},{n:"iii",title:"Request in minutes",copy:"Pick dates and rooms online. The resort confirms your stay directly."}].map(({n,title,copy})=><div key={title}><p className="font-display text-xl italic text-resort-gold">{n}</p><div className="mt-4 h-px bg-border"/><h3 className="mt-6 text-3xl font-normal text-primary">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{copy}</p></div>)}</div></section>

      <section className="relative overflow-hidden bg-primary px-6 py-28 sm:px-10 lg:py-40"><div className="relative mx-auto max-w-3xl text-center text-resort-cream"><p className="text-sm text-resort-gold">Santa Monica Eco Beach Resort</p><h2 className="mt-6 text-5xl font-normal leading-[1.02] sm:text-7xl">Plan your stay</h2><p className="mx-auto mt-6 max-w-md text-base leading-8 text-resort-cream/75">Pick your dates and rooms. The resort confirms every request.</p><Button size="lg" className="mt-10 h-12 rounded-none bg-resort-gold px-10 text-primary hover:bg-resort-cream" asChild><Link to="/booking">Check availability <ArrowRight size={15}/></Link></Button></div></section>
    </>
  );
}
