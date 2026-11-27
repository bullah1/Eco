import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import {
  BadgePercent,
  BarChart3,
  Package,
  Receipt,
  BedDouble,
  ExternalLink,
  Menu,
  Search,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  ShoppingBag,
  ChefHat,
  UtensilsCrossed,
  Wallet,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Toaster } from "sonner";

import { LogoMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useStaffRole, useUnbilledOrders } from "@/lib/pos";
import { useDrawerOpen } from "@/lib/pos-cash";
import { isLow, usePendingDiscounts, useStock } from "@/lib/pos-extras";
import { PosSearch } from "./pos-search";

type PosSession = { user: User; isAdmin: boolean };
const PosContext = createContext<PosSession | null>(null);

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be used inside PosShell");
  return ctx;
}

function useSessionUser() {
  const [state, setState] = useState<{ loading: boolean; user: User | null }>({
    loading: true,
    user: null,
  });
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ loading: false, user: data.session?.user ?? null });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ loading: false, user: session?.user ?? null });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return state;
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center bg-pos-ground px-4 font-sans text-pos-ink">
      <div className="w-full max-w-sm rounded-xl border border-pos-line bg-white p-6 text-center shadow-sm">
        <LogoMark className="mx-auto size-12" />
        {children}
      </div>
    </div>
  );
}

export function PosShell({ children }: { children: ReactNode }) {
  const { loading, user } = useSessionUser();
  const role = useStaffRole(user?.id);

  if (loading || (user && role.isLoading)) {
    return (
      <Centered>
        <p
          className="mt-4 flex items-center justify-center gap-2 text-sm text-pos-muted"
          role="status"
        >
          <LoaderCircle size={16} className="animate-spin" /> Opening the front desk
        </p>
      </Centered>
    );
  }
  if (!user) {
    return (
      <Centered>
        <h1 className="mt-4 text-xl font-semibold">Staff sign in</h1>
        <p className="mt-2 text-sm text-pos-muted">
          Sign in with your staff account to open the front desk.
        </p>
        <Button asChild className="mt-5 h-11 w-full bg-pos-ocean text-white hover:bg-pos-ocean/90">
          <Link to="/auth" search={{ next: "/pos" }}>
            Sign in
          </Link>
        </Button>
      </Centered>
    );
  }
  if (role.isError || !role.data?.isStaff) {
    return (
      <Centered>
        <h1 className="mt-4 text-xl font-semibold">Not on the staff list</h1>
        <p className="mt-2 text-sm text-pos-muted">
          {role.isError
            ? "Your role couldn't be checked. Check the connection and reload."
            : `${user.email} is signed in but isn't staff yet. Ask the admin to add this email in POS › Staff.`}
        </p>
        <Button
          variant="outline"
          className="mt-5 h-11 w-full"
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </Button>
      </Centered>
    );
  }

  return (
    <PosContext.Provider value={{ user, isAdmin: role.data.isAdmin }}>
      <Frame>{children}</Frame>
    </PosContext.Provider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { user, isAdmin } = usePos();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const online = useOnline();
  const orders = useUnbilledOrders();
  const waiting = orders.data?.length ?? 0;
  const drawer = useDrawerOpen();
  const stock = useStock();
  const lowStock = (stock.data?.items ?? []).filter((i) => i.is_active && isLow(i)).length;
  const pendingDiscounts = usePendingDiscounts(isAdmin).data?.length ?? 0;

  const nav = [
    {
      section: "Front office",
      to: "/pos",
      label: "Front desk",
      short: "Desk",
      Icon: LayoutGrid,
      active: pathname === "/pos" || pathname === "/pos/",
    },
    {
      section: "Front office",
      to: "/pos/guests",
      label: "Customers",
      Icon: Users,
      active: pathname.startsWith("/pos/guests") || pathname.startsWith("/pos/account"),
      badge: pendingDiscounts,
    },
    {
      section: "Front office",
      to: "/pos/housekeeping",
      label: "Housekeeping",
      short: "Rooms",
      Icon: BedDouble,
      active: pathname.startsWith("/pos/housekeeping"),
    },
    {
      section: "Restaurant",
      to: "/pos/restaurant",
      label: "Restaurant",
      Icon: UtensilsCrossed,
      active: pathname.startsWith("/pos/restaurant"),
    },
    {
      section: "Restaurant",
      to: "/pos/kitchen",
      label: "Kitchen",
      Icon: ChefHat,
      active: pathname.startsWith("/pos/kitchen"),
    },
    {
      section: "Restaurant",
      to: "/pos/stock",
      label: "Kitchen stock",
      short: "Stock",
      Icon: Package,
      active: pathname.startsWith("/pos/stock"),
      badge: lowStock,
    },
    {
      section: "Money",
      to: "/pos/cash",
      label: "Cash",
      Icon: Wallet,
      active: pathname.startsWith("/pos/cash"),
    },
    {
      section: "Money",
      to: "/pos/expenses",
      label: "Expenses",
      Icon: Receipt,
      active: pathname.startsWith("/pos/expenses"),
    },
    {
      section: "Money",
      to: "/pos/reports",
      label: "Reports",
      Icon: BarChart3,
      active: pathname.startsWith("/pos/reports"),
    },
    {
      section: "Front office",
      to: "/pos/orders",
      label: "Website orders",
      short: "Orders",
      Icon: ShoppingBag,
      active: pathname.startsWith("/pos/orders"),
      badge: waiting,
    },
    ...(isAdmin
      ? [
          {
            section: "Settings",
            to: "/pos/prices",
            label: "Room prices",
            short: "Prices",
            Icon: BadgePercent,
            active: pathname.startsWith("/pos/prices"),
          },
          {
            section: "Settings",
            to: "/pos/staff",
            label: "Staff",
            Icon: ShieldCheck,
            active: pathname.startsWith("/pos/staff"),
          },
        ]
      : []),
  ] as const;
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Phone bar: the four screens used all day; everything else sits under "More".
  const primary = ["/pos", "/pos/guests", "/pos/restaurant", "/pos/orders"];
  const barItems = nav.filter((n) => primary.includes(n.to));
  const moreItems = nav.filter((n) => !primary.includes(n.to));
  const moreActive = moreItems.some((n) => n.active);
  const moreBadge =
    (!drawer.data && drawer.data !== undefined) ||
    moreItems.some((n) => "badge" in n && (n.badge ?? 0) > 0);

  const sections = ["Front office", "Restaurant", "Money", "Settings"]
    .map((title) => ({ title, items: nav.filter((n) => n.section === title) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="min-h-svh bg-pos-ground font-sans text-[14px] text-pos-ink print:bg-white">
      <div className="print:hidden">
        <Toaster position="top-center" richColors closeButton />
      </div>

      {/* Desktop sidebar */}
      <aside
        aria-label="POS sections"
        className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-pos-ocean px-3 py-5 text-pos-sand lg:flex print:hidden"
      >
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <LogoMark tone="dark" className="size-9" />
          <span className="leading-tight">
            <span className="block font-display text-[15px] tracking-[0.08em]">SANTA MONICA</span>
            <span className="text-[11px] text-pos-sand/70">Front desk</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mb-5 flex h-9 items-center gap-2 rounded-lg bg-white/8 px-3 text-left text-pos-sand/70 transition-colors hover:bg-white/12 hover:text-white"
        >
          <Search size={16} strokeWidth={1.7} />
          <span className="flex-1">Search</span>
          <kbd className="rounded border border-white/15 px-1.5 text-[10px] text-pos-sand/60">
            Ctrl K
          </kbd>
        </button>
        <nav className="grid gap-5">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[11px] text-pos-sand/55">{section.title}</p>
              <div className="grid gap-0.5">
                {section.items.map(({ to, label, Icon, active, ...rest }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`flex h-9 items-center gap-2.5 rounded-lg px-3 transition-colors ${
                      active
                        ? "bg-white/12 font-medium text-white"
                        : "text-pos-sand/75 hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.6} />
                    <span className="flex-1">{label}</span>
                    {"badge" in rest && rest.badge > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-pos-gold px-1.5 text-[11px] font-semibold text-pos-ocean">
                        {rest.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-white/12 px-2 pt-4 text-xs">
          <span className="flex items-center gap-2 text-pos-sand/75">
            {online ? <Wifi size={14} /> : <WifiOff size={14} className="text-amber-300" />}
            {online ? "Online" : "Offline: changes won't save"}
          </span>
          {drawer.data !== undefined && (
            <Link
              to="/pos/cash"
              className={`flex items-center gap-2 ${drawer.data ? "text-pos-sand/75" : "font-medium text-amber-300"}`}
            >
              <Wallet size={14} /> {drawer.data ? "Cash drawer open" : "Cash drawer closed"}
            </Link>
          )}
          <span className="truncate text-[13px] text-white" title={user.email}>
            {user.email}
          </span>
          <span className="text-pos-sand/70">{isAdmin ? "Admin" : "Staff"}</span>
          <div className="mt-1 flex gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-1 text-pos-sand/75 hover:text-white"
            >
              <ExternalLink size={13} /> Website
            </a>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="inline-flex items-center gap-1 text-pos-sand/75 hover:text-white"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Tablet / phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-pos-line bg-white px-4 lg:hidden print:hidden">
        <LogoMark className="size-8" />
        <span className="flex-1 font-display text-[15px] tracking-[0.08em] text-pos-ocean">
          SANTA MONICA
        </span>
        {!online && (
          <span className="flex items-center gap-1 text-xs text-amber-700">
            <WifiOff size={14} /> Offline
          </span>
        )}
        <button
          type="button"
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
          className="grid size-10 place-items-center rounded-lg text-pos-ink hover:bg-pos-ground"
        >
          <Search size={19} />
        </button>
        <button
          type="button"
          aria-label="Sign out"
          onClick={() => void supabase.auth.signOut()}
          className="grid size-10 place-items-center rounded-lg text-pos-muted hover:bg-pos-ground"
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className="pb-24 lg:pb-8 lg:pl-56 print:p-0">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7 print:max-w-none print:p-0">
          {!online && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:hidden"
            >
              No internet. You can look around, but nothing will save until the connection is back.
            </p>
          )}
          {children}
        </div>
      </main>

      {/* Tablet / phone bottom bar */}
      <nav
        aria-label="POS sections"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-pos-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        {barItems.map(({ to, label, Icon, active, ...rest }) => (
          <Link
            key={to}
            to={to}
            className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${
              active ? "font-medium text-pos-ocean" : "text-pos-muted"
            }`}
          >
            {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-pos-gold" />}
            <Icon size={20} strokeWidth={1.6} />
            {"short" in rest ? rest.short : label}
            {"badge" in rest && rest.badge > 0 && (
              <span className="absolute right-[calc(50%-22px)] top-2 grid h-4 min-w-4 place-items-center rounded-full bg-pos-gold px-1 text-[10px] font-semibold text-pos-ocean">
                {rest.badge}
              </span>
            )}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${
            moreActive ? "font-medium text-pos-ocean" : "text-pos-muted"
          }`}
        >
          {moreActive && (
            <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-pos-gold" />
          )}
          <Menu size={20} strokeWidth={1.6} />
          More
          {moreBadge && (
            <span className="absolute right-[calc(50%-16px)] top-2.5 size-2 rounded-full bg-amber-500" />
          )}
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl font-sans lg:hidden">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4">
            {moreItems.map(({ to, label, Icon, active, ...rest }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={`relative flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-[13px] ${
                  active
                    ? "border-pos-ocean bg-pos-ocean text-white"
                    : "border-pos-line bg-white text-pos-ink"
                }`}
              >
                <Icon size={22} strokeWidth={1.6} />
                {label}
                {"badge" in rest && (rest.badge ?? 0) > 0 && (
                  <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-pos-gold px-1.5 text-[11px] font-semibold text-pos-ocean">
                    {rest.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
          <div className="grid gap-1.5 border-t border-pos-line px-4 pb-6 pt-4 text-[13px] text-pos-muted">
            {drawer.data !== undefined && (
              <span className={drawer.data ? "" : "font-medium text-amber-700"}>
                {drawer.data ? "Cash drawer open" : "Cash drawer closed"}
              </span>
            )}
            <span className="truncate">
              {user.email} · {isAdmin ? "Admin" : "Staff"}
            </span>
            <a href="/" className="inline-flex items-center gap-1 text-pos-teal">
              <ExternalLink size={13} /> Open the website
            </a>
          </div>
        </SheetContent>
      </Sheet>

      <PosSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        pages={nav.map(({ to, label, Icon }) => ({ to, label, Icon }))}
      />
    </div>
  );
}

/* ---------- small shared pieces ---------- */

export function PageTitle({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 print:hidden">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight text-pos-ink">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-pos-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title?: string | undefined;
  aside?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={`rounded-xl border border-pos-line bg-white p-4 sm:p-5 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function LoadState({
  isLoading,
  error,
  retry,
}: {
  isLoading: boolean;
  error: unknown;
  retry: () => void;
}) {
  if (isLoading)
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-xl border border-pos-line bg-white p-5 text-sm text-pos-muted"
      >
        <LoaderCircle size={16} className="animate-spin" /> Loading
      </p>
    );
  if (error)
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
      >
        Couldn't load this. Check the connection.{" "}
        <button type="button" className="font-medium underline" onClick={retry}>
          Try again
        </button>
      </p>
    );
  return null;
}

/** Shown on a new screen until supabase-setup/pos-extras.sql has been run once. */
export function SetupNotice() {
  return (
    <div role="status" className="rounded-xl border border-pos-gold bg-[#fbf6ec] p-5 text-sm">
      <p className="font-semibold">One-time setup needed</p>
      <p className="mt-1 text-pos-muted">
        This screen needs the new database tables. In the Supabase dashboard open SQL Editor, paste
        the file <code className="rounded bg-white px-1">supabase-setup/pos-extras.sql</code> and
        press Run. Then reload this page.
      </p>
    </div>
  );
}
