import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Search, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerDialog } from "./customer-dialog";

import { shortDate, taka, useAccounts, type AccountRow } from "@/lib/pos";
import { LoadState, PageTitle } from "./pos-shell";

type Tab = "staying" | "balance" | "left";

export function GuestsPage() {
  const q = useAccounts();
  const [tab, setTab] = useState<Tab>("staying");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const all = q.data ?? [];
  const staying = all.filter((a) => a.status === "open");
  const counts = {
    staying: staying.length,
    balance: staying.filter((a) => a.balance_cents > 0).length,
    left: all.filter((a) => a.status === "closed").length,
  };

  const rows = useMemo(() => {
    const base =
      tab === "staying"
        ? all.filter((a) => a.status === "open")
        : tab === "balance"
          ? all.filter((a) => a.status === "open" && a.balance_cents > 0)
          : all.filter((a) => a.status === "closed");
    const s = search.trim().toLowerCase();
    if (!s) return base;
    return base.filter(
      (a) =>
        a.guest_name.toLowerCase().includes(s) ||
        a.guest_phone.replace(/\s/g, "").includes(s.replace(/\s/g, "")) ||
        a.account_no.toLowerCase().includes(s) ||
        a.rooms.some((r) => r.toLowerCase().includes(s)),
    );
  }, [all, tab, search]);

  const sum = (f: (a: AccountRow) => number) => staying.reduce((s, a) => s + f(a), 0);

  return (
    <>
      <PageTitle
        title="Customers"
        sub="Every customer has one bill, found by mobile number. Rooms, food and services add up there, and they pay once."
        actions={
          <Button
            onClick={() => setAdding(true)}
            className="h-11 gap-2 bg-pos-gold px-5 font-semibold text-pos-ocean hover:bg-pos-gold/85"
          >
            <UserPlus size={18} /> New customer
          </Button>
        }
      />
      <CustomerDialog open={adding} onOpenChange={setAdding} />

      <section aria-label="Totals" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Open bills" value={`${counts.staying}`} />
        <Tile label="Food on bills" value={taka(sum((a) => a.food_cents))} />
        <Tile label="Services on bills" value={taka(sum((a) => a.service_cents))} />
        <Tile
          label="Still to collect"
          value={taka(sum((a) => Math.max(0, a.balance_cents)))}
          dark
        />
      </section>

      <div className="rounded-xl border border-pos-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pos-line p-3 sm:p-4">
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {(
              [
                ["staying", `Open bills · ${counts.staying}`],
                ["balance", `Owes money · ${counts.balance}`],
                ["left", `Closed · ${counts.left}`],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`h-9 rounded-full px-3.5 text-[13px] ${tab === t ? "bg-pos-ocean text-white" : "border border-pos-line hover:bg-pos-ground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-pos-line px-3 text-pos-muted sm:w-72">
            <Search size={16} />
            <input
              aria-label="Search customers"
              placeholder="Name, phone, room or bill no."
              className="min-w-0 flex-1 bg-transparent text-base text-pos-ink outline-none sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <div className="p-3 sm:p-4">
          <LoadState isLoading={q.isLoading} error={q.error} retry={() => void q.refetch()} />
          {q.data && rows.length === 0 && (
            <p className="py-8 text-center text-sm text-pos-muted">
              {search
                ? "No customer matches that search."
                : tab === "staying"
                  ? "No open bills. Add a new customer or check a guest in from the front desk."
                  : "Nothing here."}
            </p>
          )}

          {/* Desktop table */}
          {rows.length > 0 && (
            <table className="hidden w-full border-collapse text-[13px] md:table">
              <thead>
                <tr className="text-left text-pos-muted">
                  <th className="border-b border-pos-line py-2 pr-2 font-medium">Guest</th>
                  <th className="border-b border-pos-line px-2 py-2 font-medium">Rooms</th>
                  <th className="border-b border-pos-line px-2 py-2 font-medium">Stay</th>
                  <th className="border-b border-pos-line px-2 py-2 text-right font-medium">
                    Room
                  </th>
                  <th className="border-b border-pos-line px-2 py-2 text-right font-medium">
                    Food
                  </th>
                  <th className="border-b border-pos-line px-2 py-2 text-right font-medium">
                    Services
                  </th>
                  <th className="border-b border-pos-line px-2 py-2 text-right font-medium">
                    Paid
                  </th>
                  <th className="border-b border-pos-line py-2 pl-2 text-right font-medium">Due</th>
                  <th className="w-8 border-b border-pos-line" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="group relative hover:bg-pos-ground/60">
                    <td className="border-b border-pos-line/70 py-2.5 pr-2">
                      <Link
                        to="/pos/account/$id"
                        params={{ id: a.id }}
                        className="font-medium after:absolute after:inset-0 after:content-['']"
                      >
                        {a.guest_name}
                      </Link>
                      <span className="block text-xs text-pos-muted">
                        {a.guest_phone} · {a.account_no}
                      </span>
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5 font-medium">
                      {a.rooms.length ? (
                        a.rooms.join(", ")
                      ) : (
                        <span className="font-normal text-pos-muted">No room</span>
                      )}
                    </td>
                    <td className="border-b border-pos-line/70 px-2 py-2.5 whitespace-nowrap text-pos-muted">
                      {a.check_in && a.check_out
                        ? `${shortDate(a.check_in)}–${shortDate(a.check_out)}`
                        : ""}
                    </td>
                    <Money v={a.room_cents} />
                    <Money v={a.food_cents} />
                    <Money v={a.service_cents} />
                    <Money v={a.paid_cents} teal />
                    <td className="border-b border-pos-line/70 py-2.5 pl-2 text-right font-semibold tabular-nums">
                      {a.balance_cents > 0 ? (
                        taka(a.balance_cents)
                      ) : (
                        <span className="font-normal text-pos-teal">Settled</span>
                      )}
                    </td>
                    <td className="border-b border-pos-line/70 text-right text-pos-muted">
                      <ChevronRight size={16} className="ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Phone / tablet list */}
          <ul className="grid gap-2 md:hidden">
            {rows.map((a) => (
              <li key={a.id}>
                <Link
                  to="/pos/account/$id"
                  params={{ id: a.id }}
                  className="flex items-center gap-3 rounded-lg border border-pos-line p-3 active:bg-pos-ground"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.guest_name}</span>
                    <span className="block truncate text-xs text-pos-muted">
                      {a.rooms.length
                        ? `${a.rooms.join(", ")}${a.check_in && a.check_out ? ` · ${shortDate(a.check_in)}–${shortDate(a.check_out)}` : ""}`
                        : a.guest_phone || "No room"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums">
                      {a.balance_cents > 0 ? taka(a.balance_cents) : "Settled"}
                    </span>
                    <span className="text-[11px] text-pos-muted">
                      of {taka(a.room_cents + a.food_cents + a.service_cents)}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-pos-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function Money({ v, teal }: { v: number; teal?: boolean }) {
  return (
    <td
      className={`border-b border-pos-line/70 px-2 py-2.5 text-right tabular-nums ${teal ? "text-pos-teal" : ""}`}
    >
      {v ? taka(v) : <span className="text-pos-muted">—</span>}
    </td>
  );
}

function Tile({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div
      className={`rounded-xl px-4 py-3 ${dark ? "bg-pos-ocean text-white" : "border border-pos-line bg-white"}`}
    >
      <p className={`text-xs ${dark ? "text-white/70" : "text-pos-muted"}`}>{label}</p>
      <p
        className={`mt-0.5 tabular-nums ${dark ? "font-display text-[26px]" : "text-2xl font-semibold"}`}
      >
        {value}
      </p>
    </div>
  );
}
