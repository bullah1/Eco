import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  BedDouble,
  CalendarCheck,
  CalendarDays,
  House,
  LogOut,
  MapPin,
  Menu,
  Phone,
  ShoppingBag,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { resortContact } from "@/lib/resort-content";
import { ContactFloat } from "@/components/trust";
import { useCart } from "@/lib/cart";

type NavItem = {
  label: string;
  to: "/" | "/stays" | "/experiences" | "/gallery" | "/contact" | "/order";
  hash?: string;
};

const navigation: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "Rooms", to: "/stays" },
  { label: "Dining", to: "/experiences", hash: "dining" },
  { label: "Activities", to: "/experiences" },
  { label: "Order", to: "/order" },
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
            className="size-11 lg:hidden"
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

function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();
  if (pathname.startsWith("/booking") || pathname.startsWith("/admin")) return null;
  const roomSlug = pathname.match(/^\/rooms\/([a-z0-9-]+)/)?.[1];
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const tab = (active: boolean) =>
    `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${active ? "text-primary" : "text-muted-foreground"}`;
  const indicator = (active: boolean) =>
    active ? (
      <span className="absolute inset-x-5 top-0 h-0.5 bg-resort-gold" aria-hidden="true" />
    ) : null;

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-resort-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        <Link
          to="/"
          className={tab(isActive("/"))}
          aria-current={isActive("/") ? "page" : undefined}
        >
          {indicator(isActive("/"))}
          <House size={21} strokeWidth={1.6} />
          Home
        </Link>
        <Link to="/stays" className={tab(isActive("/stays") || isActive("/rooms"))}>
          {indicator(isActive("/stays") || isActive("/rooms"))}
          <BedDouble size={21} strokeWidth={1.6} />
          Rooms
        </Link>
        <Link
          to="/booking"
          search={roomSlug ? { room: roomSlug, rooms: 1 } : {}}
          className="flex flex-1 flex-col items-center justify-end gap-1 pb-1.5 text-[11px] font-medium text-primary"
          aria-label={roomSlug ? "Book this room" : "Book a room"}
        >
          <span className="-mt-5 grid size-12 place-items-center rounded-full bg-resort-gold text-resort-wood shadow-[0_6px_16px_color-mix(in_oklab,var(--resort-wood)_25%,transparent)] ring-4 ring-resort-white">
            <CalendarCheck size={21} strokeWidth={1.8} />
          </span>
          Book
        </Link>
        <Link
          to="/order"
          className={tab(isActive("/order"))}
          aria-current={isActive("/order") ? "page" : undefined}
        >
          {indicator(isActive("/order"))}
          <span className="relative">
            <ShoppingBag size={21} strokeWidth={1.6} />
            {count > 0 && (
              <span className="absolute -right-2.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-medium leading-[18px] text-primary-foreground tabular-nums">
                {count}
              </span>
            )}
          </span>
          Order
        </Link>
        <Link to="/my-stays" className={tab(isActive("/my-stays") || isActive("/account"))}>
          {indicator(isActive("/my-stays") || isActive("/account"))}
          <CalendarDays size={21} strokeWidth={1.6} />
          My stays
        </Link>
      </div>
    </nav>
  );
}

export function ResortFooter() {
  const c = resortContact;
  return (
    <footer className="bg-resort-wood pb-20 text-resort-cream lg:pb-0">
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-x-6 gap-y-10 px-6 py-14 sm:gap-12 sm:px-8 sm:py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-20">
        <div className="col-span-2 lg:col-span-1">
          <BrandLogo tone="dark" size="lg" />
          <p className="mt-5 max-w-xs text-sm leading-7 text-resort-cream/65">
            An eco beach resort on Saint Martin's Island, Bangladesh's only coral island.
          </p>
        </div>
        <div>
          <p className="font-display text-lg text-resort-cream">Explore</p>
          <span className="gold-rule mt-3" />
          <div className="mt-3 grid text-sm text-resort-cream/70 [&>a]:py-2">
            <Link to="/stays" className="transition-colors hover:text-resort-gold">
              Rooms
            </Link>
            <Link
              to="/experiences"
              hash="dining"
              className="transition-colors hover:text-resort-gold"
            >
              Dining
            </Link>
            <Link to="/experiences" className="transition-colors hover:text-resort-gold">
              Activities
            </Link>
            <Link to="/order" className="transition-colors hover:text-resort-gold">
              Order food and services
            </Link>
            <Link to="/gallery" className="transition-colors hover:text-resort-gold">
              Gallery
            </Link>
          </div>
        </div>
        <div>
          <p className="font-display text-lg text-resort-cream">Your stay</p>
          <span className="gold-rule mt-3" />
          <div className="mt-3 grid text-sm text-resort-cream/70 [&>a]:py-2">
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
        <div className="col-span-2 sm:col-span-1">
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
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-resort-gold hover:text-resort-cream"
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
      <MobileTabBar />
      <ContactFloat />
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
