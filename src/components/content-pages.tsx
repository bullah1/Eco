import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Compass, Leaf, MapPin, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { experienceConcepts, firstExperienceConcept, firstStayConcept, stayConcepts } from "@/lib/resort-data";
import { Eyebrow, SectionHeading, TextLink } from "@/components/resort-site";
import heroImage from "@/assets/sagara-coast-hero.jpg";

function PageIntro({ eyebrow, title, copy, image, alt }: { eyebrow: string; title: string; copy: string; image: string; alt: string }) {
  return <section className="grid min-h-[520px] bg-resort-sand md:grid-cols-2"><div className="flex items-center px-6 py-16 sm:px-12 lg:px-16"><div className="max-w-xl"><Eyebrow>{eyebrow}</Eyebrow><h1 className="mt-5 text-5xl leading-[1.1] text-primary sm:text-6xl">{title}</h1><p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">{copy}</p><Button className="mt-8 rounded-none" asChild><Link to="/booking">Find your stay <ArrowRight size={15}/></Link></Button></div></div><div className="sagara-image-frame min-h-[320px] md:min-h-full"><img src={image} alt={alt} width={1600} height={1067} className="size-full object-cover"/></div></section>;
}

export function StaysPage() {
  return <>
    <PageIntro eyebrow="The art of arriving" title="A place to land, a little differently." copy="Our stay concepts draw from the rhythm of the shoreline: calm rooms, tactile details, and a horizon that stays with you. Room availability and final rates are shared during booking." image={firstStayConcept.image} alt={firstStayConcept.imageAlt}/>
    <section className="bg-background px-6 py-20 sm:px-10 lg:py-28"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="Find your own shore" title="Spaces shaped by the coast." copy="A quieter palette, considered materials, and room for the sea to become part of your day."/><div className="mt-12 grid gap-8 lg:grid-cols-2">{stayConcepts.map((stay, index)=><article key={stay.name} className="grid gap-6 sm:grid-cols-[1.1fr_0.9fr] sm:items-center"><div className="sagara-image-frame aspect-[5/4]"><img src={stay.image} alt={stay.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div><div><Eyebrow>Stay concept 0{index+1}</Eyebrow><h2 className="mt-4 text-3xl text-primary">{stay.name}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{stay.description}</p><p className="mt-4 text-xs text-resort-ocean">{stay.detail}</p><Button variant="link" className="mt-4 h-auto p-0" asChild><Link to="/booking">Check dates <ArrowRight size={14}/></Link></Button></div></article>)}</div><p className="mt-12 border-l-2 border-resort-gold pl-4 text-xs leading-5 text-muted-foreground">Stay names and images are illustrative concepts. Confirm the resort's current room types, rates, and inventory before accepting reservations.</p></div></section>
  </>;
}

export function ExperiencesPage() {
  return <>
    <PageIntro eyebrow="Let the coast set the pace" title="Small rituals. Open horizons." copy="From the first light over the water to an evening that takes its time, find the moments that feel like yours." image={firstExperienceConcept.image} alt={firstExperienceConcept.imageAlt}/>
    <section className="bg-resort-ocean px-6 py-20 text-resort-cream sm:px-10 lg:py-28"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="A little more present" title="Experiences with room to breathe." copy="A few ways to meet the coast, thoughtfully and at your own pace." light/><div className="mt-12 grid gap-6 md:grid-cols-2">{experienceConcepts.map((item, index)=><article key={item.name} className="grid gap-5 md:grid-cols-[1fr_1fr] md:items-center"><div className={`sagara-image-frame aspect-[5/4] ${index===1?"md:order-2":""}`}><img src={item.image} alt={item.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div><div className="py-2"><Eyebrow light>Coastal ritual 0{index+1}</Eyebrow><h2 className="mt-4 text-3xl text-resort-cream">{item.name}</h2><p className="mt-3 text-sm leading-6 text-resort-cream/75">{item.description}</p></div></article>)}</div><p className="mt-10 text-xs text-resort-cream/55">Experiences shown are illustrative and subject to resort confirmation.</p></div></section>
    <section className="bg-resort-cream px-6 py-16 text-center"><Eyebrow>Stay a little longer</Eyebrow><h2 className="mt-4 text-4xl text-primary">Let the day unfold.</h2><Button className="mt-7 rounded-none" asChild><Link to="/booking">Plan your stay <ArrowRight size={15}/></Link></Button></section>
  </>;
}

export function GalleryPage() {
  return <>
    <section className="bg-resort-sand px-6 pb-12 pt-16 sm:px-10 lg:px-16 lg:pt-24"><div className="mx-auto max-w-7xl"><Eyebrow>A glimpse of the coast</Eyebrow><h1 className="mt-5 text-5xl text-primary sm:text-6xl">The quiet, in frames.</h1><p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">Sunlight, coconut palms, and the Bay of Bengal horizon. A few moments from our coast.</p></div></section>
    <section className="bg-resort-sand px-5 pb-20 sm:px-8 lg:px-12"><div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="sagara-image-frame aspect-[4/5] lg:row-span-2"><img src={heroImage} alt="Wooden fishing boats on the turquoise sea at Saint Martin's Island" width={1600} height={960} className="size-full object-cover"/></div>{[...stayConcepts, ...experienceConcepts].map((item)=><div key={item.name} className="sagara-image-frame aspect-[4/3]"><img src={item.image} alt={item.imageAlt} loading="lazy" width={1600} height={1067} className="size-full object-cover"/></div>)}</div><p className="mx-auto mt-5 max-w-7xl text-xs text-muted-foreground">Resort imagery shown for concept purposes.</p></section>
  </>;
}

export function ContactPage() {
  return <>
    <PageIntro eyebrow="A place on the Bay of Bengal" title="Come find the quieter edge." copy="The resort is imagined on Saint Martin's Island, where the gentle rhythm of the island meets the quiet of the sea." image={heroImage} alt="Coconut palms and wooden boats along the shore of Saint Martin's Island"/>
    <section className="bg-background px-6 py-20 sm:px-10 lg:py-28"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2"><div><SectionHeading eyebrow="The coast, close by" title="Saint Martin's Island, Bangladesh." copy="Coral shores, coconut palms, and turquoise water, made for walking, wandering, and returning to the sea."/><p className="mt-8 flex items-start gap-3 text-sm leading-6 text-primary"><MapPin size={18} className="mt-0.5 text-resort-ocean"/>Saint Martin's Island, Bangladesh</p><a className="mt-5 inline-flex items-center gap-2 border-b border-resort-gold pb-1 text-sm text-primary" href="https://maps.google.com/?q=Saint+Martin%27s+Island+Bangladesh" target="_blank" rel="noreferrer">Explore the area <Compass size={15}/></a></div><div className="border-t border-resort-gold pt-6"><Eyebrow>Stay in touch</Eyebrow><p className="mt-4 text-sm leading-7 text-muted-foreground">For current availability and guest assistance, please reach out through the resort's official contact channel. Contact details are not yet provided here.</p><div className="mt-8 flex flex-wrap gap-4"><Button className="rounded-none" asChild><Link to="/booking">Check availability <CalendarDays size={15}/></Link></Button><Link className="inline-flex items-center gap-2 py-2 text-sm text-primary" to="/experiences">See experiences <Waves size={15}/></Link></div></div></div></section>
    <div className="h-px bg-border"/><section className="bg-resort-cream px-6 py-16 text-center"><Eyebrow>Plan a coastal pause</Eyebrow><h2 className="mt-4 text-4xl text-primary">When you’re ready, we’ll be here.</h2><Button className="mt-7 rounded-none" asChild><Link to="/booking">Begin a booking <ArrowRight size={15}/></Link></Button></section>
  </>;
}