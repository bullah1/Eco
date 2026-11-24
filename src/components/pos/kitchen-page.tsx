import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { posError, rpc, usePosAction } from "@/lib/pos";
import { minutesSince, useKitchen, type KitchenTicket } from "@/lib/pos-restaurant";
import { LoadState, PageTitle } from "./pos-shell";

const columns: {
  status: KitchenTicket["status"];
  title: string;
  next: KitchenTicket["status"];
  action: string;
}[] = [
  { status: "new", title: "New", next: "preparing", action: "Start cooking" },
  { status: "preparing", title: "Cooking", next: "ready", action: "Ready" },
  { status: "ready", title: "Ready to serve", next: "served", action: "Served" },
];

const webNext: Record<string, { next: string; action: string }> = {
  pending: { next: "confirmed", action: "Accept" },
  confirmed: { next: "preparing", action: "Start cooking" },
  preparing: { next: "served", action: "Served" },
};

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

function Age({ iso, now }: { iso: string; now: number }) {
  const m = minutesSince(iso, now);
  const late = m >= 25;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs tabular-nums ${late ? "font-semibold text-red-700" : "text-pos-muted"}`}
    >
      <Clock size={12} />{" "}
      {m < 1 ? "just now" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`}
    </span>
  );
}

export function KitchenPage() {
  const q = useKitchen();
  const now = useNow();
  const setKot = usePosAction((v: { id: string; status: string }) =>
    rpc(supabase.rpc("pos_set_kot_status", { p_kot: v.id, p_status: v.status })),
  );
  const setWeb = usePosAction((v: { id: string; status: string }) =>
    rpc(supabase.rpc("pos_set_web_order_status", { p_order: v.id, p_status: v.status })),
  );

  const kots = q.data?.kots ?? [];
  const web = q.data?.web ?? [];

  return (
    <>
      <PageTitle
        title="Kitchen"
        sub="Every order sent from the restaurant, plus food ordered on the website. Updates on its own every few seconds."
      />
      <LoadState isLoading={q.isLoading} error={q.error} retry={() => void q.refetch()} />

      {q.data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {columns.map((col) => {
              const list = kots.filter((k) => k.status === col.status);
              return (
                <section
                  key={col.status}
                  aria-label={col.title}
                  className="rounded-xl border border-pos-line bg-white/60 p-3"
                >
                  <h2 className="mb-3 flex items-center justify-between px-1 text-[15px] font-semibold">
                    {col.title}
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-pos-ocean px-2 text-xs text-white">
                      {list.length}
                    </span>
                  </h2>
                  {list.length === 0 && (
                    <p className="px-1 py-6 text-center text-sm text-pos-muted">Nothing here</p>
                  )}
                  <ul className="grid gap-3">
                    {list.map((k) => (
                      <li
                        key={k.id}
                        className={`rounded-lg border bg-white p-3 ${col.status === "new" ? "border-pos-gold" : "border-pos-line"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[17px] font-semibold leading-tight">{k.place}</p>
                            <p className="text-xs text-pos-muted">{k.kot_no}</p>
                          </div>
                          <Age iso={k.created_at} now={now} />
                        </div>
                        <ul className="mt-2 grid gap-1">
                          {k.items.map((i, n) => (
                            <li key={n} className="flex gap-2 text-[15px]">
                              <span className="w-8 shrink-0 font-semibold tabular-nums">
                                {i.qty}×
                              </span>
                              <span>{i.name}</span>
                            </li>
                          ))}
                        </ul>
                        {k.note && (
                          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">
                            {k.note}
                          </p>
                        )}
                        <Button
                          className={`mt-3 h-11 w-full font-semibold ${col.status === "ready" ? "bg-pos-teal text-white hover:bg-pos-teal/90" : "bg-pos-ocean text-white hover:bg-pos-ocean/90"}`}
                          disabled={setKot.isPending && setKot.variables?.id === k.id}
                          onClick={() =>
                            setKot.mutate(
                              { id: k.id, status: col.next },
                              { onError: (e) => toast.error(posError(e)) },
                            )
                          }
                        >
                          {col.action}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <section aria-label="Website orders" className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
              <Globe size={16} /> From the website
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-pos-gold px-2 text-xs text-pos-ocean">
                {web.length}
              </span>
            </h2>
            {web.length === 0 ? (
              <p className="rounded-xl border border-pos-line bg-white p-5 text-sm text-pos-muted">
                No website food orders waiting.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {web.map((o) => {
                  const step = webNext[o.status];
                  return (
                    <li key={o.id} className="rounded-lg border border-pos-line bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[16px] font-semibold leading-tight">
                            {o.delivery === "room"
                              ? `Room ${o.room_label || "?"}`
                              : o.delivery === "pickup"
                                ? "Pick-up"
                                : "Restaurant"}{" "}
                            · {o.guest_name}
                          </p>
                          <p className="text-xs text-pos-muted">
                            Order {o.order_number} · {o.status === "pending" ? "new" : o.status}
                          </p>
                        </div>
                        <Age iso={o.created_at} now={now} />
                      </div>
                      <ul className="mt-2 grid gap-1">
                        {o.items.map((i, n) => (
                          <li key={n} className="flex gap-2 text-[15px]">
                            <span className="w-8 shrink-0 font-semibold tabular-nums">
                              {i.quantity}×
                            </span>
                            <span>{i.name}</span>
                          </li>
                        ))}
                      </ul>
                      {o.note && (
                        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">
                          {o.note}
                        </p>
                      )}
                      {step && (
                        <Button
                          className="mt-3 h-11 w-full bg-pos-ocean font-semibold text-white hover:bg-pos-ocean/90"
                          disabled={setWeb.isPending && setWeb.variables?.id === o.id}
                          onClick={() =>
                            setWeb.mutate(
                              { id: o.id, status: step.next },
                              { onError: (e) => toast.error(posError(e)) },
                            )
                          }
                        >
                          {step.action}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
