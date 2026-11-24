import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, LogOut, MapPin, Menu, Phone, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { resortContact } from "@/lib/resort-content";

type NavItem = { label: string; to: "/" | "/stays" | "/gallery" | "/contact"; hash?: string };

const navigation: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "Rooms", to: "/stays" },
  { label: "Dining", to: "/", hash: "dining" },
  { label: "Activities", to: "/", hash: "activities" },
  { label: "Gallery", to: "/gallery" },
  { label: "Contact", to: "/contact" },
];

function TopBar() {
  const user = useCurrentUser();
  return (
    <div className="hidden bg-resort-wood text-[12px] text-resort-cream/75 md:block">
      <div className="mx-auto flex h-9 max-w-[1240px] items-center justify-between px-8">
        <p className="flex items-center gap-2">
          {resortContact.phone ? (
            <>
              <Phone size={13} className="text-resort-gold" />
              Need help? Call us
              <a
                href={`tel:${resortContact.phone}`}
                className="text-resort-gold hover:text-resort-cream"
              >
                {resortContact.phone}
              </a>
            </>
          ) : (
            <>
              <MapPin size={13} className="text-resort-gold" />
              Saint Martin's Island, Bangladesh
            </>
          )}
        </p>
        <p className="flex items-center gap-3">
          <Link to="/my-stays" className="transition-colors hover:text-resort-gold">
            My stays
          </Link>
          <span className="h-3 w-px bg-resort-cream/25" />
          {user ? (
            <Link to="/account" className="transition-colors hover:text-resort-gold">
              Account
            </Link>
          ) : (
            <Link to="/auth" className="transition-colors hover:text-resort-gold">
              Sign in
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}

export function ResortHeader() {
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function signOut() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
    setSigningOut(false);
  }

  const isActive = (item: NavItem) => !item.hash && item.to === pathname;

  return (
    <>
      <TopBar />
      <header
        className="sagara-nav sticky top-0 z-50 border-b border-border/70"
        data-scrolled={scrolled ? "true" : "false"}
      >
        <div
          className={`mx-auto flex max-w-[1240px] items-center justify-between px-5 transition-[padding] duration-300 sm:px-8 ${scrolled ? "py-2" : "py-4"}`}
        >
          <Link
            to="/"
            className="flex items-center"
            aria-label="Santa Monica Eco Beach Resort home"
          >
            <BrandLogo />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                {...(item.hash ? { hash: item.hash } : {})}
                className={`relative py-2 text-[13px] font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-resort-gold after:transition-transform after:duration-300 hover:text-resort-ocean hover:after:scale-x-100 ${isActive(item) ? "text-resort-ocean after:scale-x-100" : "text-foreground after:scale-x-0"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {user && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
                onClick={signOut}
                disabled={signingOut}
              >
                <LogOut size={17} />
              </Button>
            )}
            <Button
              className="h-11 rounded-none bg-resort-gold px-7 text-[13px] font-medium text-resort-wood transition-colors hover:bg-primary hover:text-primary-foreground"
              asChild
            >
              <Link to="/booking">Book now</Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </Button>
        </div>

        {menuOpen && (
          <nav
            className="fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-y-auto bg-resort-white px-6 pb-10 pt-4 lg:hidden"
            style={{ top: scrolled ? 57 : 73 }}
            aria-label="Mobile navigation"
          >
            {navigation.map((item) => (
              <Link
                onClick={() => setMenuOpen(false)}
                key={item.label}
                to={item.to}
                {...(item.hash ? { hash: item.hash } : {})}
                className="border-b border-border py-4 font-display text-2xl text-primary"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-6 grid gap-3 text-sm">
              <Link onClick={() => setMenuOpen(false)} to="/my-stays" className="text-foreground">
                My stays
              </Link>
              {user ? (
                <>
                  <Link
                    onClick={() => setMenuOpen(false)}
                    to="/account"
                    className="text-foreground"
                  >
                    Account
                  </Link>
                  <button type="button" onClick={signOut} className="text-left text-foreground">
                    Sign out
                  </button>
                </>
              ) : (
                <Link onClick={() => setMenuOpen(false)} to="/auth" className="text-foreground">
                  Sign in
                </Link>
              )}
            </div>
            <Button
              className="mt-8 h-12 rounded-none bg-resort-gold text-resort-wood hover:bg-primary hover:text-primary-foreground"
              asChild
            >
              <Link onClick={() => setMenuOpen(false)} to="/booking">
                Book now <ArrowRight size={15} />
              </Link>
            </Button>
          </nav>
        )}
      </header>
    </>
  );
}

function MobileBookBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/booking") || pathname.startsWith("/admin")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-resort-white/95 p-3 backdrop-blur lg:hidden">
      <Button
        className="h-12 w-full rounded-none bg-resort-gold text-resort-wood hover:bg-primary hover:text-primary-foreground"
        asChild
      >
        <Link to="/booking">
          Book now <ArrowRight size={15} />
        </Link>
      </Button>
    </div>
  );
}

export function ResortFooter() {
  const c = resortContact;
  return (
    <footer className="bg-resort-wood pb-20 text-resort-cream lg:pb-0">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-6 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-20">
        <div>
          <BrandLogo tone="dark" size="lg" />
          <p className="mt-5 max-w-xs text-sm leading-7 text-resort-cream/65">
            An eco beach resort on Saint Martin's Island, Bangladesh's only coral island.
          </p>
        </div>
        <div>
          <p className="font-display text-lg text-resort-cream">Explore</p>
          <span className="gold-rule mt-3" />
          <div className="mt-5 grid gap-3 text-sm text-resort-cream/70">
            <Link to="/stays" className="transition-colors hover:text-resort-gold">
              Rooms
            </Link>
            <Link to="/" hash="dining" className="transition-colors hover:text-resort-gold">
              Dining
            </Link>
            <Link to="/" hash="activities" className="transition-colors hover:text-resort-gold">
              Activities
            </Link>
            <Link to="/gallery" className="transition-colors hover:text-resort-gold">
              Gallery
            </Link>
          </div>
        </div>
        <div>
          <p className="font-display text-lg text-resort-cream">Your stay</p>
          <span className="gold-rule mt-3" />
          <div className="mt-5 grid gap-3 text-sm text-resort-cream/70">
            <Link to="/booking" className="transition-colors hover:text-resort-gold">
              Book a room
            </Link>
            <Link to="/my-stays" className="transition-colors hover:text-resort-gold">
              My stays
            </Link>
            <Link to="/account" className="transition-colors hover:text-resort-gold">
              Account
            </Link>
          </div>
        </div>
        <div>
          <p className="font-display text-lg text-resort-cream">Contact</p>
          <span className="gold-rule mt-3" />
          <ul className="mt-5 grid gap-3 text-sm text-resort-cream/70">
            <li className="flex gap-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-resort-gold" />
              {c.address || "Saint Martin's Island, Bangladesh"}
            </li>
            {c.phone && (
              <li className="flex gap-2">
                <Phone size={16} className="mt-0.5 shrink-0 text-resort-gold" />
                <a href={`tel:${c.phone}`} className="hover:text-resort-gold">
                  {c.phone}
                </a>
              </li>
            )}
            {c.email && (
              <li>
                <a href={`mailto:${c.email}`} className="hover:text-resort-gold">
                  {c.email}
                </a>
              </li>
            )}
          </ul>
          <Link
            to="/contact"
            className="mt-5 inline-flex items-center gap-2 text-sm text-resort-gold hover:text-resort-cream"
          >
            How to get here <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      <div className="border-t border-resort-cream/10 px-6 py-5 text-center text-xs text-resort-cream/50">
        © {new Date().getFullYear()} Santa Monica Eco Beach Resort · Saint Martin's Island
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ResortHeader />
      <main>{children}</main>
      <ResortFooter />
      <MobileBookBar />
    </>
  );
}

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={`text-[13px] font-medium ${light ? "text-resort-gold" : "text-resort-ocean"}`}>
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  light = false,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  light?: boolean;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      <h2
        className={`${eyebrow ? "mt-3" : ""} text-[34px] leading-[1.15] sm:text-[42px] ${light ? "text-resort-cream" : "text-primary"}`}
      >
        {title}
      </h2>
      <span className={`gold-rule mt-5 ${center ? "mx-auto" : ""}`} />
      {copy && (
        <p
          className={`mt-5 text-[15px] leading-7 ${center ? "mx-auto max-w-xl" : "max-w-xl"} ${light ? "text-resort-cream/70" : "text-muted-foreground"}`}
        >
          {copy}
        </p>
      )}
    </div>
  );
}

export function TextLink({
  to,
  children,
  light = false,
}: {
  to: "/stays" | "/experiences" | "/gallery" | "/contact";
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-2 border-b pb-1 text-sm transition-colors ${light ? "border-resort-gold/60 text-resort-cream hover:text-resort-gold" : "border-resort-gold text-primary hover:text-resort-ocean"}`}
    >
      {children}
      <ArrowDownRight
        size={15}
        className="transition-transform group-hover:translate-x-1 group-hover:translate-y-1"
      />
    </Link>
  );
}
