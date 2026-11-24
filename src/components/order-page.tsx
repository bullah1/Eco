import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  Check,
  ChefHat,
  CircleCheck,
  Coffee,
  LoaderCircle,
  Minus,
  Plus,
  Sailboat,
  ShoppingBag,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { cart, useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/room-booking";

type MenuItem = {
  id: string;
  category: "food" | "drinks" | "service" | "activity";
  name: string;
  description: string;
  price_cents: number;
  image_url: string;
};

const categories = [
  { key: "food", label: "Food", Icon: UtensilsCrossed },
  { key: "drinks", label: "Drinks", Icon: Coffee },
  { key: "service", label: "Services", Icon: BellRing },
  { key: "activity", label: "Activities", Icon: Sailboat },
] as const;

const deliveryOptions = [
  { key: "room", label: "To my room" },
  { key: "restaurant", label: "At the restaurant" },
  { key: "pickup", label: "I'll pick it up" },
] as const;

const CONTACT_KEY = "santa-monica-order-contact";
const goldBtn =
  "rounded-none bg-resort-gold text-[13px] font-medium text-resort-wood transition-colors hover:bg-primary hover:text-primary-foreground";

function Qty({ item }: { item: MenuItem }) {
  const { quantityOf } = useCart();
  const q = quantityOf(item.id);
  const line = { id: item.id, name: item.name, price_cents: item.price_cents };
  if (q === 0)
    return (
      <Button
        type="button"
        className={`h-10 px-5 ${goldBtn}`}
        onClick={() => cart.set(line, 1)}
        aria-label={`Add ${item.name}`}
      >
        <Plus size={15} /> Add
      </Button>
    );
  return (
    <div className="flex h-10 items-center border border-primary bg-resort-white">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-none"
        aria-label={`One less ${item.name}`}
        onClick={() => cart.set(line, q - 1)}
      >
        <Minus size={14} />
      </Button>
      <span className="w-8 text-center text-sm tabular-nums text-primary" aria-live="polite">
        {q}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-none"
        aria-label={`One more ${item.name}`}
        onClick={() => cart.set(line, q + 1)}
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}

function CartPanel({
  menu,
  onPlaced,
}: {
  menu: MenuItem[];
  onPlaced: (order: { number: string; total: number; phone: string }) => void;
}) {
  const { lines, total, count } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState<"room" | "restaurant" | "pickup">("room");
  const [room, setRoom] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CONTACT_KEY) ?? "{}");
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
      if (saved.room) setRoom(saved.room);
      if (saved.reference) setReference(saved.reference);
    } catch {
      /* nothing saved */
    }
  }, []);

  // Drop items the resort has taken off the menu since they were added.
  useEffect(() => {
    if (menu.length === 0) return;
    const ids = new Set(menu.map((m) => m.id));
    lines.filter((l) => !ids.has(l.id)).forEach((l) => cart.set(l, 0));
  }, [menu, lines]);

  const place = useMutation({
    mutationFn: async () => {
      const { data, error: rpcError } = await supabase.rpc("place_order", {
        p_items: lines.map((l) => ({ menu_item_id: l.id, quantity: l.quantity })),
        p_name: name,
        p_phone: phone,
        p_reference: reference,
        p_room: delivery === "room" ? room : "",
        p_delivery: delivery,
        p_note: note,
      });
      if (rpcError) {
        if (rpcError.code === "P0001" || rpcError.code === "P0002")
          throw new Error(rpcError.message);
        throw new Error("We couldn't send your order. Please check your connection and try again.");
      }
      const row = data?.[0];
      if (!row) throw new Error("We couldn't send your order. Please try again.");
      return row;
    },
    onSuccess: (row) => {
      try {
        window.localStorage.setItem(CONTACT_KEY, JSON.stringify({ name, phone, room, reference }));
      } catch {
        /* ignore */
      }
      cart.clear();
      setNote("");
      onPlaced({ number: row.order_number, total: row.subtotal_cents, phone });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "We couldn't send your order."),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (lines.length === 0) return setError("Your cart is empty");
    if (name.trim().length < 2) return setError("Please enter your name");
    if (!/^\+?[0-9-]{7,20}$/.test(phone.replace(/\s+/g, "")))
      return setError("Please enter a valid mobile number");
    if (delivery === "room" && !room.trim() && !reference.trim())
      return setError("Please enter your room number or booking reference");
    place.mutate();
  }

  if (lines.length === 0)
    return (
      <div className="py-10 text-center">
        <ShoppingBag size={32} strokeWidth={1.25} className="mx-auto text-resort-gold-deep" />
        <p className="mt-4 font-display text-xl text-primary">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add food, drinks or a service from the menu
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate>
      <ul className="divide-y divide-border border-y border-border">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-primary">{l.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatMoney(l.price_cents)} each
              </span>
            </span>
            <div className="flex h-9 items-center border border-input">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-none"
                aria-label={`One less ${l.name}`}
                onClick={() => cart.set(l, l.quantity - 1)}
              >
                {l.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
              </Button>
              <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-none"
                aria-label={`One more ${l.name}`}
                onClick={() => cart.set(l, l.quantity + 1)}
              >
                <Plus size={14} />
              </Button>
            </div>
            <span className="w-20 text-right text-sm tabular-nums text-primary">
              {formatMoney(l.price_cents * l.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">
          Total · {count} {count === 1 ? "item" : "items"}
        </span>
        <span className="font-display text-2xl tabular-nums text-primary">
          {formatMoney(total)}
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Added to your bill. Pay with your stay at the front desk.
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">How would you like it?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup">
          {deliveryOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={delivery === o.key}
              onClick={() => setDelivery(o.key)}
              className={`min-h-11 border px-2 py-2 text-xs leading-tight transition-colors ${delivery === o.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-resort-white text-foreground hover:border-resort-gold"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="order-name">Name</Label>
          <Input
            id="order-name"
            autoComplete="name"
            className="h-11 rounded-none text-base sm:text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="order-phone">Mobile number</Label>
          <Input
            id="order-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01712 345678"
            className="h-11 rounded-none text-base sm:text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {delivery === "room" && (
          <div className="grid gap-1.5">
            <Label htmlFor="order-room">Room number</Label>
            <Input
              id="order-room"
              className="h-11 rounded-none text-base sm:text-sm"
              value={room}
              maxLength={40}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. D-101"
            />
          </div>
        )}
        <div className={`grid gap-1.5 ${delivery === "room" ? "" : "col-span-2"}`}>
          <Label htmlFor="order-ref">
            Booking ref <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="order-ref"
            className="h-11 rounded-none text-base uppercase placeholder:normal-case sm:text-sm"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Links it to your stay"
          />
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="order-note">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="order-note"
            rows={2}
            maxLength={500}
            className="rounded-none text-base sm:text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Less spicy, time to deliver, allergies"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={place.isPending} className={`mt-5 h-12 w-full ${goldBtn}`}>
        {place.isPending ? (
          <LoaderCircle size={16} className="animate-spin" />
        ) : (
          <>
            Place order · {formatMoney(total)} <ArrowRight size={15} />
          </>
        )}
      </Button>
    </form>
  );
}

function OrderPlaced({
  order,
  onMore,
}: {
  order: { number: string; total: number; phone: string };
  onMore: () => void;
}) {
  return (
    <div className="py-4 text-center">
      <CircleCheck size={40} className="mx-auto text-resort-ocean" />
      <p className="mt-4 font-display text-2xl text-primary">Order sent</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The kitchen and front desk have your order
      </p>
      <div className="mx-auto mt-6 max-w-xs border-y border-border py-4">
        <p className="text-xs text-muted-foreground">Order number</p>
        <p className="font-display text-2xl tracking-[0.12em] text-primary">{order.number}</p>
        <p className="mt-1 text-sm tabular-nums text-foreground">
          {formatMoney(order.total)} added to your bill
        </p>
      </div>
      <ol className="mx-auto mt-6 grid max-w-xs gap-3 text-left text-sm">
        {[
          ["Received", "Your order is waiting to be confirmed"],
          ["Preparing", "The team is getting it ready"],
          ["Served", "Delivered or ready for you"],
        ].map(([t, c], i) => (
          <li key={t} className="flex gap-3">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${i === 0 ? "bg-resort-gold text-resort-wood" : "bg-resort-sand text-muted-foreground"}`}
            >
              {i === 0 ? <Check size={13} /> : i + 1}
            </span>
            <span>
              <span className="block font-medium text-primary">{t}</span>
              <span className="text-xs text-muted-foreground">{c}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-7 grid gap-2">
        <Button
          variant="outline"
          className="h-11 rounded-none"
          onClick={() => window.dispatchEvent(new CustomEvent("track-order", { detail: order }))}
        >
          Track this order
        </Button>
        <Button className={`h-11 ${goldBtn}`} onClick={onMore}>
          Order something else
        </Button>
      </div>
    </div>
  );
}

const statusSteps = ["pending", "confirmed", "preparing", "served"] as const;
const statusLabel: Record<string, string> = {
  pending: "Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  served: "Served",
  cancelled: "Cancelled",
};

function TrackOrder() {
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<null | {
    order_number: string;
    status: string;
    subtotal_cents: number;
    items: { name: string; quantity: number; line_total_cents: number }[];
  }>(null);

  async function lookup(n: string, p: string) {
    setError("");
    setFound(null);
    if (!n.trim() || !p.trim()) return setError("Enter your order number and mobile number");
    setLoading(true);
    const { data, error: e } = await supabase.rpc("find_order", { p_order_number: n, p_phone: p });
    setLoading(false);
    if (e) return setError("We couldn't check right now. Please try again.");
    const row = data?.[0];
    if (!row) return setError("No order matches that number and mobile. Check both and try again.");
    setFound({ ...row, items: (row.items ?? []) as never });
  }

  useEffect(() => {
    const onTrack = (e: Event) => {
      const d = (e as CustomEvent<{ number: string; phone: string }>).detail;
      setNumber(d.number);
      setPhone(d.phone);
      void lookup(d.number, d.phone);
      document.getElementById("track")?.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("track-order", onTrack);
    return () => window.removeEventListener("track-order", onTrack);
  }, []);

  const stepIndex = found ? statusSteps.indexOf(found.status as (typeof statusSteps)[number]) : -1;

  return (
    <section id="track" className="scroll-mt-24 bg-resort-white p-5 sm:p-8">
      <h2 className="text-2xl text-primary">Track an order</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Use your order number and the mobile number you ordered with.
      </p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(number, phone);
        }}
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="track-number">Order number</Label>
          <Input
            id="track-number"
            className="h-11 rounded-none text-base uppercase placeholder:normal-case sm:text-sm"
            placeholder="e.g. OD513A3A"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="track-phone">Mobile number</Label>
          <Input
            id="track-phone"
            type="tel"
            inputMode="tel"
            className="h-11 rounded-none text-base sm:text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading} className={`h-11 px-6 ${goldBtn}`}>
          {loading ? <LoaderCircle size={15} className="animate-spin" /> : "Check status"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {found && (
        <div className="mt-6 border border-border p-5" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-xl tracking-[0.08em] text-primary">
              {found.order_number}
            </p>
            <p className="font-display text-lg tabular-nums text-primary">
              {formatMoney(found.subtotal_cents)}
            </p>
          </div>
          {found.status === "cancelled" ? (
            <p className="mt-3 text-sm text-destructive">
              This order was cancelled. Please contact the front desk.
            </p>
          ) : (
            <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Order progress">
              {statusSteps.map((s, i) => (
                <li key={s}>
                  <span
                    className={`block h-1 ${i <= stepIndex ? "bg-resort-gold" : "bg-border"}`}
                  />
                  <span
                    className={`mt-2 block text-[11px] sm:text-xs ${i <= stepIndex ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {statusLabel[s]}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <ul className="mt-4 grid gap-1 text-sm">
            {found.items.map((i) => (
              <li key={i.name} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {i.name} × {i.quantity}
                </span>
                <span className="tabular-nums">{formatMoney(i.line_total_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function OrderPage() {
  const [category, setCategory] = useState<(typeof categories)[number]["key"] | "all">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placed, setPlaced] = useState<null | { number: string; total: number; phone: string }>(
    null,
  );
  const { count, total } = useCart();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    const onTrack = () => setSheetOpen(false);
    window.addEventListener("track-order", onTrack);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("track-order", onTrack);
    };
  }, []);

  const menu = useQuery({
    queryKey: ["menu-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, category, name, description, price_cents, image_url")
        .eq("is_available", true)
        .order("sort_order");
      if (error) throw new Error("The menu couldn't be loaded right now.");
      return (data ?? []) as MenuItem[];
    },
  });
  const items = menu.data ?? [];
  const groups = useMemo(
    () =>
      categories
        .filter((c) => category === "all" || c.key === category)
        .map((c) => ({ ...c, items: items.filter((i) => i.category === c.key) }))
        .filter((g) => g.items.length > 0),
    [items, category],
  );

  const handlePlaced = (order: { number: string; total: number; phone: string }) => {
    setPlaced(order);
    setSheetOpen(true);
  };

  const panel = placed ? (
    <OrderPlaced
      order={placed}
      onMore={() => {
        setPlaced(null);
        setSheetOpen(false);
      }}
    />
  ) : (
    <CartPanel menu={items} onPlaced={handlePlaced} />
  );

  return (
    <div className="bg-resort-cream pb-36 lg:pb-24">
      <div className="border-b border-border bg-resort-white px-5 pb-6 pt-8 sm:px-8 sm:pt-10">
        <div className="mx-auto max-w-[1180px]">
          <p className="text-[13px] font-medium text-resort-ocean">Room service</p>
          <h1 className="mt-2 text-[32px] leading-tight text-primary sm:text-[44px]">
            Order food and services
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Delivered to your room, served at the restaurant or ready to pick up. Everything is
            added to your bill.
          </p>
        </div>
      </div>

      <div className="sticky top-[57px] z-30 border-b border-border bg-resort-white/95 backdrop-blur lg:top-[65px]">
        <div
          className="mx-auto flex max-w-[1180px] gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] sm:px-8"
          role="tablist"
          aria-label="Menu categories"
        >
          {[{ key: "all" as const, label: "All", Icon: Sparkles }, ...categories].map(
            ({ key, label, Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={category === key}
                onClick={() => setCategory(key)}
                className={`flex h-10 shrink-0 items-center gap-2 border px-4 text-[13px] transition-colors ${category === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-resort-white text-foreground hover:border-resort-gold"}`}
              >
                <Icon size={15} /> {label}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-[1180px] gap-8 px-4 sm:px-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          {menu.isLoading && (
            <div className="grid gap-3" role="status" aria-label="Loading menu">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse bg-resort-white" />
              ))}
            </div>
          )}
          {menu.isError && (
            <p role="alert" className="bg-resort-white p-6 text-sm text-destructive">
              {menu.error.message}{" "}
              <button type="button" className="underline" onClick={() => menu.refetch()}>
                Try again
              </button>
            </p>
          )}
          {!menu.isLoading && !menu.isError && items.length === 0 && (
            <div className="bg-resort-white p-8 text-center">
              <ChefHat size={32} strokeWidth={1.25} className="mx-auto text-resort-gold-deep" />
              <p className="mt-4 font-display text-xl text-primary">The menu is being prepared</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Please ask the front desk for today's menu.
              </p>
            </div>
          )}
          <div className="grid gap-8">
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`cat-${g.key}`}>
                <h2 id={`cat-${g.key}`} className="flex items-center gap-2 text-xl text-primary">
                  <g.Icon size={18} className="text-resort-gold-deep" /> {g.label}
                </h2>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {g.items.map((item) => (
                    <li key={item.id} className="flex gap-3 bg-resort-white p-3">
                      <div className="grid size-20 shrink-0 place-items-center overflow-hidden bg-resort-ocean-soft">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <g.Icon size={26} strokeWidth={1.25} className="text-resort-ocean" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="text-[15px] font-medium leading-snug text-primary">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                          <span className="font-display text-lg tabular-nums text-primary">
                            {formatMoney(item.price_cents)}
                          </span>
                          <Qty item={item} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="mt-10">
            <TrackOrder />
          </div>
        </div>

        <aside className="hidden h-fit bg-resort-white p-6 lg:sticky lg:top-36 lg:block">
          <p className="flex items-center gap-2 text-[13px] font-medium text-resort-ocean">
            <ShoppingBag size={15} /> Your order
          </p>
          <div className="mt-4">{desktop && panel}</div>
        </aside>
      </div>

      {(count > 0 || placed) && (
        <div className="fixed inset-x-0 bottom-16 z-40 px-3 pb-2 lg:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-14 w-full items-center justify-between bg-primary px-5 text-primary-foreground shadow-[0_8px_24px_color-mix(in_oklab,var(--resort-wood)_30%,transparent)]"
          >
            <span className="flex items-center gap-3 text-sm">
              <span className="grid size-7 place-items-center rounded-full bg-resort-gold text-xs font-medium text-resort-wood tabular-nums">
                {placed && count === 0 ? <Check size={14} /> : count}
              </span>
              {placed && count === 0 ? `Order ${placed.number} sent` : "View cart"}
            </span>
            <span className="flex items-center gap-2 font-display text-lg tabular-nums">
              {placed && count === 0 ? "" : formatMoney(total)} <ArrowRight size={16} />
            </span>
          </button>
        </div>
      )}

      <Sheet open={sheetOpen && !desktop} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90svh] overflow-y-auto rounded-t-xl px-5 pb-8 lg:hidden"
        >
          <SheetTitle className="font-display text-2xl font-normal text-primary">
            {placed ? "Thank you" : "Your order"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Review your cart and place your order
          </SheetDescription>
          <div className="mt-4">{!desktop && panel}</div>
        </SheetContent>
      </Sheet>

      <p className="mx-auto mt-10 max-w-[1180px] px-5 text-xs text-muted-foreground sm:px-8">
        Not staying yet?{" "}
        <Link
          to="/booking"
          className="inline-flex min-h-11 items-center text-resort-ocean underline-offset-4 hover:underline"
        >
          Book a room first
        </Link>
      </p>
    </div>
  );
}
