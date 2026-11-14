import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, LogOut, Menu, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

const navigation = [
  { label: "The stay", to: "/stays" as const },
  { label: "Experiences", to: "/experiences" as const },
  { label: "The coast", to: "/gallery" as const },
  { label: "Visit", to: "/contact" as const },
];

export function ResortHeader() {
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
    setSigningOut(false);
  }

  return (
    <header className="sagara-nav fixed inset-x-0 top-0 z-50 border-b border-border/70">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3 sm:px-8 lg:px-12">
        <Link to="/" className="flex items-center" aria-label="Santa Monica Eco Beach Resort home">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.to} to={item.to} className="text-sm text-primary/80 transition-colors hover:text-resort-ocean">{item.label}</Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild><Link to="/account">Account</Link></Button>
              <Button variant="ghost" size="sm" asChild><Link to="/my-stays">My stays</Link></Button>
              <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={signOut} disabled={signingOut}><LogOut size={17} /></Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" asChild><Link to="/auth">Sign in</Link></Button>
          )}
          <Button className="rounded-none px-6" asChild><Link to="/booking">Reserve your stay <ArrowRight size={15} /></Link></Button>
        </div>

        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {menuOpen && (
        <nav className="grid gap-1 border-t border-border bg-background px-5 py-4 lg:hidden" aria-label="Mobile navigation">
          {navigation.map((item) => <Link onClick={() => setMenuOpen(false)} key={item.to} to={item.to} className="py-3 text-sm text-primary">{item.label}</Link>)}
          {user ? <><Link onClick={() => setMenuOpen(false)} to="/account" className="py-3 text-sm text-primary">Account</Link><Link onClick={() => setMenuOpen(false)} to="/my-stays" className="py-3 text-sm text-primary">My stays</Link></> : <Link onClick={() => setMenuOpen(false)} to="/auth" className="py-3 text-sm text-primary">Sign in</Link>}
          <Button className="mt-2 rounded-none" asChild><Link onClick={() => setMenuOpen(false)} to="/booking">Reserve your stay <ArrowRight size={15} /></Link></Button>
        </nav>
      )}
    </header>
  );
}

export function ResortFooter() {
  return (
    <footer className="bg-resort-wood text-resort-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-10 lg:py-16">
        <div>
          <BrandLogo tone="dark" size="lg" />
          <p className="mt-2 max-w-sm text-sm leading-6 text-resort-cream/70">Where Silence Meets the Sea. An invitation to find your own rhythm along the Saint Martin's Island coast.</p>
        </div>
        <div>
          <p className="sagara-eyebrow text-[10px] font-semibold uppercase text-resort-gold">Find your way</p>
          <div className="mt-4 grid gap-2 text-sm text-resort-cream/80">
            <Link to="/stays" className="hover:text-resort-gold">The stay</Link>
            <Link to="/experiences" className="hover:text-resort-gold">Experiences</Link>
            <Link to="/gallery" className="hover:text-resort-gold">The coast</Link>
          </div>
        </div>
        <div>
          <p className="sagara-eyebrow text-[10px] font-semibold uppercase text-resort-gold">A little closer</p>
          <p className="mt-4 text-sm leading-6 text-resort-cream/80">Saint Martin's Island, Bangladesh</p>
          <Link to="/contact" className="mt-2 inline-flex items-center gap-2 text-sm text-resort-cream hover:text-resort-gold">Plan a visit <ArrowRight size={14} /></Link>
          <p className="mt-6 text-xs text-resort-cream/55">Contact details will be shared by the resort soon.</p>
        </div>
      </div>
      <div className="border-t border-resort-cream/15 px-6 py-4 text-center text-[11px] text-resort-cream/55">© {new Date().getFullYear()} Santa Monica Eco Beach Resort</div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return <><ResortHeader /><main className="pt-[68px]">{children}</main><ResortFooter /></>;
}

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <p className={`sagara-eyebrow text-[10px] font-semibold uppercase ${light ? "text-resort-gold" : "text-resort-ocean"}`}>{children}</p>;
}

export function SectionHeading({ eyebrow, title, copy, light = false }: { eyebrow: string; title: string; copy?: string; light?: boolean }) {
  return <div className="max-w-2xl">
    <Eyebrow light={light}>{eyebrow}</Eyebrow>
    <h2 className={`mt-4 text-4xl leading-[1.12] sm:text-5xl ${light ? "text-resort-cream" : "text-primary"}`}>{title}</h2>
    {copy && <p className={`mt-5 max-w-xl text-sm leading-7 sm:text-base ${light ? "text-resort-cream/70" : "text-muted-foreground"}`}>{copy}</p>}
  </div>;
}

export function TextLink({ to, children, light = false }: { to: "/stays" | "/experiences" | "/gallery" | "/contact"; children: ReactNode; light?: boolean }) {
  return <Link to={to} className={`group inline-flex items-center gap-2 border-b pb-1 text-sm transition-colors ${light ? "border-resort-gold/60 text-resort-cream hover:text-resort-gold" : "border-resort-gold text-primary hover:text-resort-ocean"}`}>
    {children}<ArrowDownRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />
  </Link>;
}