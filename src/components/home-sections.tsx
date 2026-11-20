import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, MapPin, Mail, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { activities, facilities, faqs, packages, resortContact } from "@/lib/resort-content";
import { experienceConcepts, stayConcepts } from "@/lib/resort-data";
import heroImage from "@/assets/sagara-coast-hero.jpg";

function Index({ n, label, light = false }: { n: string; label: string; light?: boolean }) {
  return <p className={`flex items-center gap-4 text-sm ${light ? "text-resort-cream/70" : "text-muted-foreground"}`}><span className="font-display text-xl text-resort-gold">{n}</span><span className={`h-px w-10 ${light ? "bg-resort-cream/25" : "bg-border"}`} />{label}</p>;
}

export function FacilitiesSection() {
  return (
    <section className="bg-background px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <Index n="04" label="Facilities" />
        <h2 className="mt-6 max-w-3xl text-5xl font-normal leading-[1.05] text-primary sm:text-6xl lg:text-7xl">Everything for an easy stay</h2>
        <ul className="mt-16 grid gap-x-16 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((item) => (
            <li key={item.name} className="border-t border-border pt-6"><h3 className="text-3xl font-normal text-primary">{item.name}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{item.copy}</p></li>
          ))}
        </ul>
        <div className="mt-20 border-t border-border pt-10">
          <p className="text-sm text-muted-foreground">Activities</p>
          <ul className="mt-5 flex flex-wrap gap-3">
            {activities.map((name) => <li key={name} className="border border-border px-4 py-2 text-sm text-primary">{name}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function PackagesSection() {
  return (
    <section className="border-t border-border bg-resort-cream px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <Index n="05" label="Packages" />
        <h2 className="mt-6 text-5xl font-normal leading-[1.05] text-primary sm:text-6xl lg:text-7xl">Packages</h2>
        <div className="mt-16 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((item) => (
            <article key={item.name} className="flex flex-col bg-resort-cream p-8">
              <h3 className="text-3xl font-normal text-primary">{item.name}</h3>
              <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">{item.copy}</p>
              <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground"><Check size={14} className="mt-0.5 shrink-0 text-resort-gold" />{item.validity}</p>
              <p className="mt-2 text-sm text-primary">Price on request</p>
              <Link to="/booking" className="mt-6 inline-flex items-center gap-2 border-b border-resort-gold pb-1 text-sm text-primary transition-colors hover:text-resort-ocean self-start">Request this package <ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const gallery = [
  { src: heroImage, alt: "Wooden fishing boats on the water off Saint Martin's Island" },
  ...stayConcepts.map((s) => ({ src: s.image, alt: s.imageAlt })),
  ...experienceConcepts.map((s) => ({ src: s.image, alt: s.imageAlt })),
].filter((item, i, all) => all.findIndex((x) => x.src === item.src) === i);

export function GallerySection() {
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : gallery[open];
  const step = (d: number) => setOpen((i) => (i === null ? i : (i + d + gallery.length) % gallery.length));
  return (
    <section className="bg-background px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <Index n="06" label="Gallery" />
        <h2 className="mt-6 text-5xl font-normal leading-[1.05] text-primary sm:text-6xl lg:text-7xl">The coast in pictures</h2>
        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {gallery.map((item, i) => (
            <li key={item.src}><button type="button" onClick={() => setOpen(i)} aria-label={`Open photo: ${item.alt}`} className="sagara-image-frame block aspect-[4/5] w-full"><img src={item.src} alt={item.alt} loading="lazy" className="size-full object-cover" /></button></li>
          ))}
        </ul>
      </div>
      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-4xl gap-0 rounded-none p-0">
          <DialogTitle className="sr-only">Photo gallery</DialogTitle>
          {current && <img src={current.src} alt={current.alt} className="max-h-[80svh] w-full object-contain" />}
          <div className="flex items-center justify-between p-4 text-sm">
            <Button variant="ghost" onClick={() => step(-1)}>Previous</Button>
            <span className="text-muted-foreground">{open !== null ? open + 1 : 0} / {gallery.length}</span>
            <Button variant="ghost" onClick={() => step(1)}>Next</Button>
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
          <h2 className="mt-6 text-5xl font-normal leading-[1.05] text-primary sm:text-6xl">Saint Martin's Island</h2>
          <ul className="mt-10 space-y-4 text-sm text-primary">
            <li className="flex items-center gap-3"><MapPin size={16} className="text-resort-gold" />{c.address || "Saint Martin's Island, Bangladesh"}</li>
            {c.phone && <li className="flex items-center gap-3"><Phone size={16} className="text-resort-gold" /><a href={`tel:${c.phone}`} className="hover:text-resort-ocean">{c.phone}</a></li>}
            {c.email && <li className="flex items-center gap-3"><Mail size={16} className="text-resort-gold" /><a href={`mailto:${c.email}`} className="hover:text-resort-ocean">{c.email}</a></li>}
            {c.whatsapp && <li className="flex items-center gap-3"><MessageCircle size={16} className="text-resort-gold" /><a href={`https://wa.me/${c.whatsapp}`} className="hover:text-resort-ocean">WhatsApp</a></li>}
          </ul>
          <div className="mt-10 aspect-[4/3] overflow-hidden border border-border"><iframe title="Map of Saint Martin's Island" src={`${maps}&z=12&output=embed`} loading="lazy" className="size-full border-0" /></div>
          <Button asChild variant="outline" className="mt-6 rounded-none"><a href={maps} target="_blank" rel="noreferrer">Get directions <ArrowRight size={15} /></a></Button>
        </div>
        <div>
          <Index n="08" label="Questions" />
          <h2 className="mt-6 text-5xl font-normal leading-[1.05] text-primary sm:text-6xl">Good to know</h2>
          <Accordion type="single" collapsible className="mt-10 border-t border-border">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`f${i}`} className="border-border"><AccordionTrigger className="text-left text-base font-normal text-primary hover:no-underline">{f.q}</AccordionTrigger><AccordionContent className="text-sm leading-7 text-muted-foreground">{f.a}</AccordionContent></AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
