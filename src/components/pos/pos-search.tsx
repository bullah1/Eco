import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BedDouble, CalendarDays, FileText, type LucideIcon } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { buildBoard, shortDate, taka, useAccounts, useBoardData } from "@/lib/pos";

export type SearchPage = { to: string; label: string; Icon: LucideIcon };

/** One box to find a room, a guest bill (by name, phone or bill number) or a POS page. Ctrl/⌘+K opens it. */
export function PosSearch({
  open,
  onOpenChange,
  pages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: SearchPage[];
}) {
  const navigate = useNavigate();
  const board = useBoardData(open);
  const accounts = useAccounts(open);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const tiles = useMemo(
    () =>
      board.data ? buildBoard(board.data.units, board.data.reservations, board.data.today) : [],
    [board.data],
  );
  const upcoming = useMemo(
    () =>
      (board.data?.reservations ?? []).filter(
        (r) => r.stay_status === "expected" && r.check_in > (board.data?.today ?? ""),
      ),
    [board.data],
  );

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const typing = query.trim().length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search room, guest name, phone or bill no."
      />
      <CommandList className="max-h-[60vh] font-sans [&_[cmdk-item][data-selected=true]]:bg-pos-teal-soft [&_[cmdk-item][data-selected=true]]:text-pos-ink">
        <CommandEmpty>Nothing found.</CommandEmpty>

        {!typing && (
          <CommandGroup heading="Go to">
            {pages.map(({ to, label, Icon }) => (
              <CommandItem
                key={to}
                value={`page ${label}`}
                onSelect={() => go(() => void navigate({ to }))}
              >
                <Icon className="text-pos-muted" /> {label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Rooms">
          {(typing ? tiles : tiles.slice(0, 6)).map((t) => (
            <CommandItem
              key={t.unit.id}
              value={`room ${t.unit.name} ${t.unit.type_name} ${t.reservation?.guest_name ?? ""}`}
              onSelect={() => go(() => void navigate({ to: "/pos", search: { room: t.unit.id } }))}
            >
              <BedDouble className="text-pos-muted" />
              <span className="font-medium">{t.unit.name}</span>
              <span className="truncate text-pos-muted">
                {t.reservation?.guest_name || t.unit.type_name}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        {typing && (
          <>
            <CommandGroup heading="Guest bills">
              {(accounts.data ?? []).slice(0, 200).map((a) => (
                <CommandItem
                  key={a.id}
                  value={`bill ${a.account_no} ${a.guest_name} ${a.guest_phone} ${a.rooms.join(" ")}`}
                  onSelect={() =>
                    go(() => void navigate({ to: "/pos/account/$id", params: { id: a.id } }))
                  }
                >
                  <FileText className="text-pos-muted" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{a.guest_name || "Guest"}</span>
                    <span className="text-pos-muted">
                      {" "}
                      · {a.account_no}
                      {a.rooms.length > 0 && ` · ${a.rooms.join(", ")}`}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${a.status === "open" ? "text-pos-teal" : "text-pos-muted"}`}
                  >
                    {a.status !== "open"
                      ? "Closed"
                      : a.balance_cents < 0
                        ? `Credit ${taka(-a.balance_cents)}`
                        : `Due ${taka(a.balance_cents)}`}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Upcoming bookings">
              {upcoming.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`booking ${r.guest_name} ${r.guest_phone} ${r.booking_reference}`}
                  onSelect={() =>
                    go(() => void navigate({ to: "/pos", search: { view: "calendar" } }))
                  }
                >
                  <CalendarDays className="text-pos-muted" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{r.guest_name || "Guest"}</span>
                    <span className="text-pos-muted"> · {r.booking_reference}</span>
                  </span>
                  <span className="shrink-0 text-xs text-pos-muted">{shortDate(r.check_in)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
