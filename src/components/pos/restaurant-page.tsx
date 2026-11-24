import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChefHat,
  CircleCheck,
  LoaderCircle,
  Minus,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  Smartphone,
  StickyNote,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  changeDue,
  parseTaka,
  paymentMethods,
  phoneKey,
  phoneOk,
  posError,
  rpc,
  shortDateTime,
  taka,
  useAccounts,
  usePosAction,
  type AccountRow,
  type PaymentMethod,
} from "@/lib/pos";
import {
  groupMenu,
  ticketPlace,
  ticketTotal,
  unsentCount,
  useRestaurant,
  type MenuEntry,
  type Ticket,
  type TicketItem,
} from "@/lib/pos-restaurant";
import { LoadState, PageTitle, usePos } from "./pos-shell";
import { useOpenAccountByPhone } from "./customer-dialog";

type Selection = { kind: "table"; tableId: string } | { kind: "ticket"; id: string } | null;
type PrintDoc =
  | {
      type: "kot";
      kot: string;
      place: string;
      note: string;
      items: { name: string; qty: number }[];
      at: string;
    }
  | {
      type: "receipt";
      ticketNo: string;
      place: string;
      items: TicketItem[];
      total: number;
      method: string;
      at: string;
    }
  | null;

const AUTO_PRINT_KEY = "pos-auto-print-kot";

export function RestaurantPage() {
  const { isAdmin } = usePos();
  const queryClient = useQueryClient();
  const q = useRestaurant();
  const [sel, setSel] = useState<Selection>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"pay" | "room" | "cancel" | "note" | "counter" | null>(null);
  const [printDoc, setPrintDoc] = useState<PrintDoc>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const ticketRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      setAutoPrint(window.localStorage.getItem(AUTO_PRINT_KEY) !== "0");
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    if (!printDoc) return;
    const done = () => setPrintDoc(null);
    window.addEventListener("afterprint", done, { once: true });
    const t = window.setTimeout(() => window.print(), 60);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printDoc]);

  const tables = q.data?.tables ?? [];
  const tickets = q.data?.tickets ?? [];
  const menu = q.data?.menu ?? [];
  const ticket: Ticket | null =
    sel?.kind === "ticket"
      ? (tickets.find((t) => t.id === sel.id) ?? null)
      : sel?.kind === "table"
        ? (tickets.find((t) => t.table_id === sel.tableId) ?? null)
        : null;
  ticketRef.current = ticket?.id ?? (sel?.kind === "ticket" ? sel.id : null);

  // Reset local edits when switching orders.
  const selKey = sel ? (sel.kind === "table" ? `t:${sel.tableId}` : `k:${sel.id}`) : "";
  useEffect(() => setLocal({}), [selKey]);

  // A ticket that closed elsewhere (another device) drops the selection.
  useEffect(() => {
    if (
      sel?.kind === "ticket" &&
      q.data &&
      !tickets.some((t) => t.id === sel.id) &&
      pending.current === 0
    )
      setSel(null);
  }, [q.data, sel, tickets]);

  const lines = useMemo(() => {
    const byMenu = new Map<string, TicketItem>();
    for (const i of ticket?.items ?? []) if (i.menu_item_id) byMenu.set(i.menu_item_id, i);
    const out: (TicketItem & { localOnly?: boolean })[] = [];
    for (const i of ticket?.items ?? []) {
      const qty = i.menu_item_id && i.menu_item_id in local ? local[i.menu_item_id]! : i.quantity;
      if (qty > 0 || i.sent_qty > 0) out.push({ ...i, quantity: qty });
    }
    for (const [menuId, qty] of Object.entries(local)) {
      if (byMenu.has(menuId) || qty <= 0) continue;
      const m = menu.find((x) => x.id === menuId);
      if (m)
        out.push({
          id: `local-${menuId}`,
          menu_item_id: menuId,
          name: m.name,
          unit_price_cents: m.price_cents,
          quantity: qty,
          sent_qty: 0,
          created_at: new Date().toISOString(),
          localOnly: true,
        });
    }
    return out;
  }, [ticket, local, menu]);

  const total = ticketTotal(lines);
  const newCount = unsentCount(lines);
  const place = ticket
    ? ticketPlace(ticket, tables)
    : sel?.kind === "table"
      ? (tables.find((t) => t.id === sel.tableId)?.name ?? "")
      : "";
  const qtyOf = (menuId: string) => lines.find((l) => l.menu_item_id === menuId)?.quantity ?? 0;
  const sentOf = (menuId: string) => lines.find((l) => l.menu_item_id === menuId)?.sent_qty ?? 0;

  function setQty(m: Pick<MenuEntry, "id" | "name">, qty: number) {
    if (!sel) return;
    const sent = sentOf(m.id);
    if (qty < sent && !isAdmin) {
      toast.error(`${m.name} × ${sent} already went to the kitchen. Only an admin can take it off`);
      return;
    }
    setLocal((l) => ({ ...l, [m.id]: qty }));
    pending.current += 1;
    const tableId = sel.kind === "table" ? sel.tableId : null;
    queue.current = queue.current
      .then(async () => {
        let id = ticketRef.current;
        if (!id) {
          id = await rpc(supabase.rpc("pos_open_ticket", { p_table: tableId, p_label: "" }));
          ticketRef.current = id;
          setSel({ kind: "ticket", id: id! });
        }
        await rpc(
          supabase.rpc("pos_ticket_set_item", {
            p_ticket: id!,
            p_menu_item: m.id,
            p_quantity: qty,
          }),
        );
      })
      .catch((e) => {
        toast.error(posError(e));
        setLocal((l) => {
          const next = { ...l };
          delete next[m.id];
          return next;
        });
      })
      .finally(async () => {
        pending.current -= 1;
        if (pending.current === 0) {
          await queryClient.invalidateQueries({ queryKey: ["pos", "restaurant"] });
          setLocal({});
        }
      });
  }

  async function afterQueue() {
    await queue.current;
    await queryClient.invalidateQueries({ queryKey: ["pos", "restaurant"] });
  }

  async function sendKot() {
    if (!ticketRef.current) return;
    setBusy(true);
    try {
      await afterQueue();
      const fresh = queryClient.getQueryData<ReturnType<typeof useRestaurant>["data"]>([
        "pos",
        "restaurant",
      ]);
      const t = fresh?.tickets.find((x) => x.id === ticketRef.current);
      const items = (t?.items ?? [])
        .filter((i) => i.quantity > i.sent_qty)
        .map((i) => ({ name: i.name, qty: i.quantity - i.sent_qty }));
      const kot = await rpc(supabase.rpc("pos_send_kot", { p_ticket: ticketRef.current }));
      toast.success(`Sent to the kitchen (${kot})`);
      if (autoPrint && kot)
        setPrintDoc({
          type: "kot",
          kot,
          place: t ? ticketPlace(t, fresh?.tables ?? []) : place,
          note: t?.note ?? "",
          items,
          at: new Date().toISOString(),
        });
    } catch (e) {
      toast.error(posError(e));
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ["pos"] });
    }
  }

  const categories = useMemo(() => groupMenu(menu).map(([c]) => c), [menu]);
  const shownMenu = useMemo(() => {
    const groups = groupMenu(menu, search);
    return (category && !search ? groups.filter(([c]) => c === category) : groups).flatMap(
      ([, l]) => l,
    );
  }, [menu, search, category]);

  const counterTickets = tickets.filter((t) => !t.table_id);

  return (
    <>
      <div className="print:hidden">
        <PageTitle
          title="Restaurant"
          sub="Pick a table or start an order by mobile number. Then take payment or put it on the customer's bill."
          actions={
            <label className="flex items-center gap-2 text-xs text-pos-muted">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => {
                  setAutoPrint(e.target.checked);
                  try {
                    window.localStorage.setItem(AUTO_PRINT_KEY, e.target.checked ? "1" : "0");
                  } catch {
                    /* ignore */
                  }
                }}
              />
              Print kitchen slip when sending
            </label>
          }
        />
        <LoadState isLoading={q.isLoading} error={q.error} retry={() => void q.refetch()} />

        {q.data && (
          <div className="grid grid-cols-1 gap-4 pb-20 lg:grid-cols-[220px_minmax(0,1fr)_340px] lg:pb-0">
            {/* Tables and counter orders */}
            <section aria-label="Tables" className="rounded-xl border border-pos-line bg-white p-3">
              <p className="mb-2 px-1 text-xs font-medium text-pos-muted">Tables</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-2">
                {tables.map((t) => {
                  const open = tickets.find((x) => x.table_id === t.id);
                  const amount = open ? ticketTotal(open.items) : 0;
                  const selected =
                    (sel?.kind === "table" && sel.tableId === t.id) ||
                    (open && ticket?.id === open.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setSel(
                          open ? { kind: "ticket", id: open.id } : { kind: "table", tableId: t.id },
                        )
                      }
                      className={`flex h-16 min-w-0 flex-col items-start justify-between rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        selected
                          ? "border-pos-ocean bg-pos-ocean text-white ring-2 ring-pos-gold ring-offset-1"
                          : open
                            ? "border-pos-teal bg-pos-teal-soft text-pos-ocean"
                            : "border-pos-line bg-white hover:bg-pos-ground"
                      }`}
                    >
                      <span className="text-[14px] font-semibold">{t.name}</span>
                      <span className="text-[11.5px] tabular-nums opacity-85">
                        {open ? taka(amount) : "Free"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-pos-line pt-3">
                <p className="mb-2 px-1 text-xs font-medium text-pos-muted">Without a table</p>
                <ul className="grid gap-1.5">
                  {counterTickets.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSel({ kind: "ticket", id: t.id })}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] ${
                          ticket?.id === t.id
                            ? "border-pos-ocean bg-pos-ocean text-white"
                            : "border-pos-line hover:bg-pos-ground"
                        }`}
                      >
                        <span className="truncate">{ticketPlace(t, tables)}</span>
                        <span className="shrink-0 tabular-nums">{taka(ticketTotal(t.items))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="mt-2 h-10 w-full gap-1.5"
                  onClick={() => setDialog("counter")}
                >
                  <Smartphone size={15} /> Order by mobile
                </Button>
              </div>
            </section>

            {/* Menu */}
            <section
              aria-label="Menu"
              className="min-w-0 rounded-xl border border-pos-line bg-white p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-pos-line px-3 text-pos-muted sm:max-w-xs">
                  <Search size={16} />
                  <input
                    aria-label="Search dishes"
                    placeholder="Search dishes"
                    className="min-w-0 flex-1 bg-transparent text-base text-pos-ink outline-none sm:text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div
                className="mt-3 flex gap-1.5 overflow-x-auto pb-1"
                role="tablist"
                aria-label="Menu sections"
              >
                {[null, ...categories].map((c) => (
                  <button
                    key={c ?? "all"}
                    type="button"
                    role="tab"
                    aria-selected={category === c}
                    onClick={() => setCategory(c)}
                    className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] ${category === c ? "bg-pos-ocean text-white" : "border border-pos-line hover:bg-pos-ground"}`}
                  >
                    {c ?? "All"}
                  </button>
                ))}
              </div>
              {!sel && (
                <p className="mt-3 rounded-lg bg-pos-sand px-3 py-2 text-sm text-pos-ink">
                  Choose a table or start an order by mobile number, then tap dishes.
                </p>
              )}
              {menu.length === 0 ? (
                <p className="mt-4 text-sm text-pos-muted">
                  No dishes on the menu. Add them in the admin panel under Menu.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {shownMenu.map((m) => {
                    const qty = qtyOf(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={!sel}
                        onClick={() => setQty(m, qty + 1)}
                        className={`relative flex min-h-[78px] flex-col justify-between rounded-lg border p-2.5 text-left transition-colors disabled:opacity-50 ${
                          qty > 0
                            ? "border-pos-ocean bg-pos-teal-soft/50"
                            : "border-pos-line bg-white hover:bg-pos-ground"
                        }`}
                      >
                        <span className="pr-6 text-[13px] font-medium leading-snug">{m.name}</span>
                        <span className="mt-1 text-[13px] font-semibold tabular-nums text-pos-ocean">
                          {taka(m.price_cents)}
                        </span>
                        {qty > 0 && (
                          <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-pos-ocean px-1.5 text-xs font-semibold text-white">
                            {qty}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Current order */}
            <section
              id="current-order"
              aria-label="Current order"
              className={`${sel ? "flex" : "hidden lg:flex"} min-h-[420px] flex-col rounded-xl border border-pos-line bg-white p-4 lg:sticky lg:top-6 lg:max-h-[calc(100svh-48px)]`}
            >
              {!sel ? (
                <div className="m-auto text-center text-sm text-pos-muted">
                  <ChefHat className="mx-auto mb-2" size={26} strokeWidth={1.5} />
                  No order selected
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{place || "New order"}</h2>
                      <p className="text-xs text-pos-muted">
                        {ticket
                          ? `${ticket.ticket_no}${ticket.guest_phone ? ` · ${ticket.guest_phone}` : ""} · since ${shortDateTime(ticket.opened_at)}`
                          : "Tap a dish to start"}
                      </p>
                      {ticket?.note && (
                        <p className="mt-1 rounded bg-pos-sand px-2 py-1 text-xs">{ticket.note}</p>
                      )}
                    </div>
                    {ticket && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="More"
                            className="grid size-9 place-items-center rounded-md hover:bg-pos-ground"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="font-sans">
                          <DropdownMenuItem onSelect={() => setDialog("note")}>
                            <StickyNote size={15} /> Name and note
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              setPrintDoc({
                                type: "receipt",
                                ticketNo: ticket.ticket_no,
                                place,
                                items: lines,
                                total,
                                method: "Not paid yet",
                                at: new Date().toISOString(),
                              })
                            }
                          >
                            <Printer size={15} /> Print bill
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-700"
                            onSelect={() => setDialog("cancel")}
                          >
                            <X size={15} /> Cancel order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <ul className="mt-3 min-h-0 flex-1 divide-y divide-pos-line overflow-y-auto">
                    {lines.length === 0 && (
                      <li className="py-8 text-center text-sm text-pos-muted">
                        Tap dishes on the menu
                      </li>
                    )}
                    {lines.map((l) => (
                      <li key={l.id} className="flex items-center gap-2 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">{l.name}</span>
                          <span className="text-xs text-pos-muted tabular-nums">
                            {taka(l.unit_price_cents)}
                            {l.sent_qty > 0 && (
                              <span className="ml-1.5 text-pos-teal">
                                · {l.sent_qty} in kitchen
                              </span>
                            )}
                            {l.quantity > l.sent_qty && (
                              <span className="ml-1.5 text-pos-gold-deep">
                                · {l.quantity - l.sent_qty} new
                              </span>
                            )}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={`One less ${l.name}`}
                          onClick={() =>
                            setQty({ id: l.menu_item_id!, name: l.name }, l.quantity - 1)
                          }
                          disabled={!l.menu_item_id || l.quantity <= 0}
                          className="grid size-9 place-items-center rounded-md border border-pos-line disabled:opacity-30"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                        <button
                          type="button"
                          aria-label={`One more ${l.name}`}
                          onClick={() =>
                            setQty({ id: l.menu_item_id!, name: l.name }, l.quantity + 1)
                          }
                          disabled={!l.menu_item_id}
                          className="grid size-9 place-items-center rounded-md border border-pos-line disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                        <span className="w-16 text-right text-sm font-medium tabular-nums">
                          {taka(l.quantity * l.unit_price_cents)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 border-t border-pos-line pt-3">
                    <p className="flex items-baseline justify-between">
                      <span className="text-sm text-pos-muted">Total</span>
                      <span className="font-display text-[30px] leading-tight tabular-nums text-pos-ocean">
                        {taka(total)}
                      </span>
                    </p>
                    <Button
                      onClick={() => void sendKot()}
                      disabled={busy || newCount === 0}
                      className="mt-2 h-11 w-full gap-2 border border-pos-ocean bg-white font-semibold text-pos-ocean hover:bg-pos-ground"
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : (
                        <ChefHat size={16} />
                      )}
                      {newCount > 0 ? `Send ${newCount} to kitchen` : "Kitchen is up to date"}
                    </Button>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => void afterQueue().then(() => setDialog("pay"))}
                        disabled={!ticket || total <= 0}
                        className="h-12 gap-1.5 bg-pos-ocean font-semibold text-white hover:bg-pos-ocean/90"
                      >
                        <Wallet size={16} /> Pay now
                      </Button>
                      <Button
                        onClick={() => void afterQueue().then(() => setDialog("room"))}
                        disabled={!ticket || total <= 0}
                        className="h-12 gap-1.5 bg-pos-gold font-semibold text-pos-ocean hover:bg-pos-gold/85"
                      >
                        <UserRound size={16} /> To customer bill
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* Phone: quick jump to the order */}
        {sel && (
          <a
            href="#current-order"
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-20 flex items-center justify-between rounded-xl bg-pos-ocean px-4 py-3 text-white shadow-lg lg:hidden"
          >
            <span className="truncate text-sm">
              {place || "New order"} · {lines.reduce((s, l) => s + l.quantity, 0)} items
            </span>
            <span className="font-semibold tabular-nums">{taka(total)}</span>
          </a>
        )}
      </div>

      <PrintArea doc={printDoc} />

      {ticket && (
        <>
          <PayDialog
            open={dialog === "pay"}
            onClose={() => setDialog(null)}
            ticket={ticket}
            total={ticketTotal(ticket.items)}
            onPaid={(method) => {
              setPrintDoc({
                type: "receipt",
                ticketNo: ticket.ticket_no,
                place,
                items: ticket.items,
                total: ticketTotal(ticket.items),
                method,
                at: new Date().toISOString(),
              });
              setSel(null);
            }}
          />
          <RoomDialog
            open={dialog === "room"}
            onClose={() => setDialog(null)}
            ticket={ticket}
            total={ticketTotal(ticket.items)}
            onDone={() => setSel(null)}
          />
          <CancelDialog
            open={dialog === "cancel"}
            onClose={() => setDialog(null)}
            ticket={ticket}
            onDone={() => setSel(null)}
          />
          <NoteDialog open={dialog === "note"} onClose={() => setDialog(null)} ticket={ticket} />
        </>
      )}
      <CounterDialog
        open={dialog === "counter"}
        onClose={() => setDialog(null)}
        onOpened={(id) => setSel({ kind: "ticket", id })}
      />
    </>
  );
}

function PayDialog({
  open,
  onClose,
  ticket,
  total,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket;
  total: number;
  onPaid: (method: string) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [ref, setRef] = useState("");
  const [given, setGiven] = useState("");
  const [problem, setProblem] = useState("");
  useEffect(() => {
    if (open) {
      setMethod("cash");
      setRef("");
      setGiven("");
      setProblem("");
    }
  }, [open]);
  const m = paymentMethods.find((p) => p.id === method)!;
  const change = method === "cash" ? changeDue(parseTaka(given), total) : 0;
  const givenShort = method === "cash" && given && (parseTaka(given) ?? 0) < total;
  const pay = usePosAction(() =>
    rpc(
      supabase.rpc("pos_ticket_pay", {
        p_ticket: ticket.id,
        p_method: method,
        p_reference: ref.trim(),
      }),
    ),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pay.isPending && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Take {taka(total)}</DialogTitle>
          <DialogDescription>{ticket.ticket_no} · the order closes after payment</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-1.5">
          {paymentMethods.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={method === p.id}
              onClick={() => setMethod(p.id)}
              className={`h-11 rounded-lg text-[12.5px] font-medium ${method === p.id ? "bg-pos-ocean text-white" : "border border-pos-line"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {method === "cash" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="rp-given">Guest gave (৳)</Label>
            <Input
              id="rp-given"
              inputMode="decimal"
              className="h-11 text-base tabular-nums"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              placeholder="optional"
            />
            {change > 0 && <p className="text-sm text-pos-teal">Give back {taka(change)}</p>}
            {givenShort && <p className="text-sm text-red-700">That's less than the bill</p>}
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="rp-ref">{m.refLabel}</Label>
            <Input
              id="rp-ref"
              className="h-11 text-base"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
        {problem && (
          <p role="alert" className="text-sm text-red-700">
            {problem}
          </p>
        )}
        <Button
          className="h-12 bg-pos-gold text-[15px] font-semibold text-pos-ocean hover:bg-pos-gold/85"
          disabled={pay.isPending || Boolean(givenShort)}
          onClick={() => {
            if (m.needsRef && ref.trim().length < 4) return setProblem(`Enter the ${m.refLabel}`);
            pay.mutate(undefined, {
              onSuccess: () => {
                toast.success(`${taka(total)} received by ${m.label}`);
                onClose();
                onPaid(m.label);
              },
              onError: (e) => setProblem(posError(e)),
            });
          }}
        >
          {pay.isPending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            `Paid ${taka(total)} by ${m.label}`
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function RoomDialog({
  open,
  onClose,
  ticket,
  total,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket;
  total: number;
  onDone: () => void;
}) {
  const accounts = useAccounts(open);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const openList = (accounts.data ?? []).filter((a) => a.status === "open");

  useEffect(() => {
    if (!open) return;
    setSearch(ticket.guest_phone);
    setNewName(ticket.label);
    setPicked(null);
  }, [open, ticket.guest_phone, ticket.label]);
  // The order was started with a mobile number: pick that customer's bill.
  const linked = ticket.guest_phone
    ? openList.find((a) => phoneKey(a.guest_phone) === phoneKey(ticket.guest_phone))
    : undefined;
  useEffect(() => {
    if (open && linked && picked === null) setPicked(linked.id);
  }, [open, linked, picked]);

  const s = search.trim().toLowerCase();
  const key = phoneKey(search);
  const list = openList.filter(
    (a) =>
      !s ||
      a.guest_name.toLowerCase().includes(s) ||
      a.account_no.toLowerCase() === s ||
      (key.length >= 4 && phoneKey(a.guest_phone).includes(key)) ||
      a.rooms.some((r) => r.toLowerCase().includes(s)),
  );
  const newCustomer = phoneOk(search) && key.length >= 11 && list.length === 0;

  const charge = usePosAction(() =>
    rpc(supabase.rpc("pos_ticket_charge_room", { p_ticket: ticket.id, p_account: picked! })),
  );
  const chargeNew = usePosAction(() =>
    rpc(
      supabase.rpc("pos_ticket_charge_phone", {
        p_ticket: ticket.id,
        p_phone: search.trim(),
        p_name: newName.trim(),
      }),
    ),
  );
  const busy = charge.isPending || chargeNew.isPending;
  const chosen = list.find((a) => a.id === picked);
  const who = (a: AccountRow) => (a.rooms.length ? a.rooms.join(", ") : a.guest_name);
  const done = (text: string) => {
    toast.success(text);
    onClose();
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[90svh] flex-col font-sans sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Put {taka(total)} on the customer's bill</DialogTitle>
          <DialogDescription>
            Find the customer by mobile number. They pay it with everything else at the end.
          </DialogDescription>
        </DialogHeader>
        <label className="flex h-11 items-center gap-2 rounded-lg border border-pos-line px-3 text-pos-muted">
          <Search size={16} />
          <input
            aria-label="Mobile number, name or room"
            placeholder="Mobile number, name or room"
            inputMode="search"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-base text-pos-ink outline-none sm:text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPicked(null);
            }}
          />
        </label>

        {newCustomer ? (
          <form
            className="grid gap-2 rounded-lg border border-pos-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              chargeNew.mutate(undefined, {
                onSuccess: () => done(`${taka(total)} added to a new bill for ${newName.trim()}`),
                onError: (err) => toast.error(posError(err)),
              });
            }}
          >
            <p className="text-sm">
              No open bill for <span className="font-medium">{search.trim()}</span>. Open one now:
            </p>
            <Label htmlFor="nc-name" className="text-xs text-pos-muted">
              Customer name
            </Label>
            <Input
              id="nc-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-11 text-base sm:text-sm"
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={busy || newName.trim().length < 2}
              className="h-12 bg-pos-ocean font-semibold text-white hover:bg-pos-ocean/90"
            >
              {chargeNew.isPending ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                "Open bill and add the order"
              )}
            </Button>
          </form>
        ) : (
          <>
            <ul className="min-h-0 flex-1 divide-y divide-pos-line overflow-y-auto rounded-lg border border-pos-line">
              {accounts.isLoading && <li className="p-3 text-sm text-pos-muted">Loading</li>}
              {accounts.data && list.length === 0 && (
                <li className="p-3 text-sm text-pos-muted">
                  No open bill matches. Type the full mobile number to open a new one.
                </li>
              )}
              {list.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-pressed={picked === a.id}
                    onClick={() => setPicked(a.id)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${picked === a.id ? "bg-pos-ocean text-white" : "hover:bg-pos-ground"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{a.guest_name}</span>
                      <span
                        className={`block truncate text-xs ${picked === a.id ? "text-white/75" : "text-pos-muted"}`}
                      >
                        {a.guest_phone || "No number"} ·{" "}
                        {a.rooms.length ? a.rooms.join(", ") : "No room"}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums">{a.account_no}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Button
              className="h-12 bg-pos-ocean font-semibold text-white hover:bg-pos-ocean/90"
              disabled={!chosen || busy}
              onClick={() =>
                charge.mutate(undefined, {
                  onSuccess: () =>
                    done(`${taka(total)} added to ${chosen!.guest_name}'s bill (${who(chosen!)})`),
                  onError: (e) => toast.error(posError(e)),
                })
              }
            >
              {charge.isPending ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : chosen ? (
                `Add to ${chosen.guest_name}'s bill`
              ) : (
                "Choose a customer"
              )}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onClose,
  ticket,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [open]);
  const sent = ticket.items.some((i) => i.sent_qty > 0);
  const run = usePosAction(() =>
    rpc(supabase.rpc("pos_cancel_ticket", { p_ticket: ticket.id, p_reason: reason })),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !run.isPending && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel {ticket.ticket_no}?</DialogTitle>
          <DialogDescription>
            {sent
              ? "Some food already went to the kitchen. Only an admin can cancel, with a reason."
              : "Nothing was sent to the kitchen yet."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="cancel-reason">Reason {sent ? "" : "(optional)"}</Label>
          <Input
            id="cancel-reason"
            className="h-11 text-base"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={onClose}>
            Keep order
          </Button>
          <Button
            className="h-11 flex-1 bg-red-700 text-white hover:bg-red-800"
            disabled={run.isPending || (sent && reason.trim().length < 3)}
            onClick={() =>
              run.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`${ticket.ticket_no} cancelled`);
                  onClose();
                  onDone();
                },
                onError: (e) => toast.error(posError(e)),
              })
            }
          >
            Cancel order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({
  open,
  onClose,
  ticket,
}: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket;
}) {
  const [label, setLabel] = useState(ticket.label);
  const [note, setNote] = useState(ticket.note);
  useEffect(() => {
    if (open) {
      setLabel(ticket.label);
      setNote(ticket.note);
    }
  }, [open, ticket.label, ticket.note]);
  const run = usePosAction(() =>
    rpc(supabase.rpc("pos_ticket_set_note", { p_ticket: ticket.id, p_label: label, p_note: note })),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Name and note</DialogTitle>
          <DialogDescription>The note prints on the kitchen slip.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="t-label">Guest name</Label>
          <Input
            id="t-label"
            className="h-11 text-base"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-note">Note for the kitchen</Label>
          <Input
            id="t-note"
            className="h-11 text-base"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. less spicy, no onion"
            maxLength={300}
          />
        </div>
        <Button
          className="h-11 bg-pos-ocean text-white hover:bg-pos-ocean/90"
          disabled={run.isPending}
          onClick={() =>
            run.mutate(undefined, { onSuccess: onClose, onError: (e) => toast.error(posError(e)) })
          }
        >
          Save
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function CounterDialog({
  open,
  onClose,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  onOpened: (id: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  useEffect(() => {
    setPhone("");
    setLabel("");
  }, [open]);
  const { match } = useOpenAccountByPhone(phone, open);
  const badPhone = phone.trim() !== "" && !phoneOk(phone);
  const run = usePosAction(() =>
    rpc(
      supabase.rpc("pos_open_counter_ticket", {
        p_label: label.trim() || match?.guest_name || "",
        p_phone: phone.trim(),
      }),
    ),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="font-sans sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Order without a table</DialogTitle>
          <DialogDescription>
            Counter, takeaway or room service. With a mobile number the order can go on the
            customer's bill.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (badPhone) return;
            run.mutate(undefined, {
              onSuccess: (id) => {
                onClose();
                if (id) onOpened(id);
              },
              onError: (err) => toast.error(posError(err)),
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="c-phone">
              Mobile number <span className="font-normal text-pos-muted">(optional)</span>
            </Label>
            <Input
              id="c-phone"
              type="tel"
              inputMode="tel"
              autoFocus
              className="h-11 text-base"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01712 345678"
            />
            {match && (
              <p className="flex items-center gap-1.5 text-xs text-pos-teal">
                <CircleCheck size={13} /> {match.guest_name}
                {match.rooms.length > 0 && ` · ${match.rooms.join(", ")}`} · bill {match.account_no}
              </p>
            )}
            {badPhone && <p className="text-xs text-red-700">Enter a valid mobile number</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-label">
              Name <span className="font-normal text-pos-muted">(optional)</span>
            </Label>
            <Input
              id="c-label"
              className="h-11 text-base"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={match?.guest_name ?? "e.g. Takeaway Arif"}
              maxLength={60}
            />
          </div>
          <Button
            type="submit"
            className="h-11 bg-pos-ocean text-white hover:bg-pos-ocean/90"
            disabled={run.isPending || badPhone}
          >
            {run.isPending && <LoaderCircle size={16} className="animate-spin" />}
            Start order
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PrintArea({ doc }: { doc: PrintDoc }) {
  if (!doc) return null;
  const at = new Date(doc.at).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <article className="hidden w-[72mm] font-sans text-[12px] text-black print:block">
      {doc.type === "kot" ? (
        <>
          <p className="text-center text-[15px] font-bold">KITCHEN · {doc.kot}</p>
          <p className="text-center text-[14px] font-semibold">{doc.place}</p>
          <p className="text-center">{at}</p>
          <hr className="my-2 border-black" />
          <ul className="grid gap-1">
            {doc.items.map((i, k) => (
              <li key={k} className="flex gap-2 text-[15px]">
                <span className="w-8 font-bold">{i.qty}×</span>
                <span>{i.name}</span>
              </li>
            ))}
          </ul>
          {doc.note && (
            <>
              <hr className="my-2 border-black" />
              <p className="font-semibold">Note: {doc.note}</p>
            </>
          )}
        </>
      ) : (
        <>
          <p className="text-center font-display text-[16px] tracking-[0.08em]">SANTA MONICA</p>
          <p className="text-center">Eco Beach Resort · Restaurant</p>
          <p className="mt-1 text-center">
            {doc.ticketNo} · {doc.place} · {at}
          </p>
          <hr className="my-2 border-black" />
          <table className="w-full">
            <tbody>
              {doc.items
                .filter((i) => i.quantity > 0)
                .map((i) => (
                  <tr key={i.id}>
                    <td className="py-0.5 pr-1">
                      {i.quantity} × {i.name}
                    </td>
                    <td className="py-0.5 text-right">{taka(i.quantity * i.unit_price_cents)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <hr className="my-2 border-black" />
          <p className="flex justify-between text-[14px] font-bold">
            <span>Total</span>
            <span>{taka(doc.total)}</span>
          </p>
          <p className="mt-1">
            {doc.method === "Not paid yet" ? "Not paid yet" : `Paid by ${doc.method}`}
          </p>
          <p className="mt-3 text-center">Thank you</p>
        </>
      )}
    </article>
  );
}
