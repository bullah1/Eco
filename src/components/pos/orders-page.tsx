import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { LoaderCircle, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  posError,
  rpc,
  shortDateTime,
  taka,
  useAccounts,
  usePosAction,
  useUnbilledOrders,
} from "@/lib/pos";
import { LoadState, PageTitle } from "./pos-shell";

const deliveryLabel: Record<string, string> = {
  room: "To the room",
  restaurant: "At the restaurant",
  pickup: "Pick-up",
};

export function OrdersPage() {
  const orders = useUnbilledOrders();
  const accounts = useAccounts();
  const openAccounts = (accounts.data ?? []).filter((a) => a.status === "open");
  const [choice, setChoice] = useState<Record<string, string>>({});
  const charge = usePosAction((v: { order: string; account: string }) =>
    rpc(supabase.rpc("pos_charge_order", { p_order_id: v.order, p_account: v.account })),
  );

  return (
    <>
      <PageTitle
        title="Website orders"
        sub="Food and services guests ordered on the website that aren't on a bill yet. Add each one to the guest's bill."
      />
      <LoadState
        isLoading={orders.isLoading}
        error={orders.error}
        retry={() => void orders.refetch()}
      />
      {orders.data && orders.data.length === 0 && (
        <div className="rounded-xl border border-pos-line bg-white p-8 text-center">
          <ShoppingBag className="mx-auto text-pos-muted" size={28} strokeWidth={1.5} />
          <p className="mt-3 font-medium">All website orders are on a bill</p>
          <p className="mt-1 text-sm text-pos-muted">
            New orders appear here within a few seconds.
          </p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(orders.data ?? []).map((o) => {
          const res = o.reservations as {
            account_id: string | null;
            room_units: { name: string } | null;
          } | null;
          const linked = res?.account_id
            ? openAccounts.find((a) => a.id === res.account_id)
            : undefined;
          const selected = linked?.id ?? choice[o.id] ?? "";
          const items = (o.service_order_items ?? []) as {
            name: string;
            quantity: number;
            line_total_cents: number;
          }[];
          const busy = charge.isPending && charge.variables?.order === o.id;
          return (
            <li key={o.id} className="rounded-xl border border-pos-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    Order {o.order_number}
                    <span className="ml-2 text-xs font-normal text-pos-muted">
                      {shortDateTime(o.created_at)}
                    </span>
                  </p>
                  <p className="text-sm text-pos-muted">
                    {o.guest_name} · {o.guest_phone} · {deliveryLabel[o.delivery] ?? o.delivery}
                    {o.room_label ? ` · room ${o.room_label}` : ""}
                  </p>
                </div>
                <span className="text-lg font-semibold tabular-nums">{taka(o.subtotal_cents)}</span>
              </div>
              <ul className="mt-2 text-sm">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-3 border-b border-pos-line/60 py-1 last:border-0"
                  >
                    <span>
                      {it.name} × {it.quantity}
                    </span>
                    <span className="tabular-nums text-pos-muted">{taka(it.line_total_cents)}</span>
                  </li>
                ))}
              </ul>
              {o.note && (
                <p className="mt-2 rounded bg-pos-ground px-2 py-1.5 text-sm">“{o.note}”</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-pos-line pt-3">
                {linked ? (
                  <p className="flex-1 text-sm">
                    Bill: <span className="font-medium">{linked.guest_name}</span> ·{" "}
                    {linked.rooms.join(", ")}
                  </p>
                ) : (
                  <select
                    aria-label={`Bill for order ${o.order_number}`}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-pos-line bg-white px-3 text-base sm:text-sm"
                    value={selected}
                    onChange={(e) => setChoice((c) => ({ ...c, [o.id]: e.target.value }))}
                  >
                    <option value="">Choose the guest's bill</option>
                    {openAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.rooms.join(", ")} · {a.guest_name}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  disabled={!selected || busy}
                  onClick={() =>
                    charge.mutate(
                      { order: o.id, account: selected },
                      {
                        onSuccess: () => toast.success(`Order ${o.order_number} added to the bill`),
                        onError: (e) => toast.error(posError(e)),
                      },
                    )
                  }
                  className="h-11 bg-pos-ocean px-5 text-white hover:bg-pos-ocean/90"
                >
                  {busy ? <LoaderCircle size={16} className="animate-spin" /> : "Add to bill"}
                </Button>
                {linked && (
                  <Link
                    to="/pos/account/$id"
                    params={{ id: linked.id }}
                    className="text-sm text-pos-teal underline-offset-4 hover:underline"
                  >
                    Open bill
                  </Link>
                )}
              </div>
              {!linked && openAccounts.length === 0 && (
                <p className="mt-2 text-xs text-pos-muted">
                  No one is checked in. Check the guest in first, then add the order.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
