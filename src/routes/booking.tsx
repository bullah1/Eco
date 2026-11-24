import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { BookingFlow } from "@/components/booking-wizard";

type BookingSearch = {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  room?: string;
  rooms?: number;
};

const toNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && Number.isFinite(Number(value)) && value !== ""
      ? Number(value)
      : undefined;

export const Route = createFileRoute("/booking")({
  validateSearch: (search: Record<string, unknown>): BookingSearch => {
    const date = (v: unknown) =>
      typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
    const checkIn = date(search["checkIn"]);
    const checkOut = date(search["checkOut"]);
    const guests = toNumber(search["guests"]);
    const rooms = toNumber(search["rooms"]);
    const room =
      typeof search["room"] === "string" && /^[a-z0-9-]{1,80}$/.test(search["room"])
        ? search["room"]
        : undefined;
    return {
      ...(checkIn ? { checkIn } : {}),
      ...(checkOut ? { checkOut } : {}),
      ...(guests !== undefined ? { guests } : {}),
      ...(room ? { room } : {}),
      ...(rooms !== undefined ? { rooms: Math.max(1, Math.min(20, Math.round(rooms))) } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Book Your Stay | Santa Monica Eco Beach Resort" },
      {
        name: "description",
        content:
          "Choose your dates, rooms and meals and send a reservation request to Santa Monica Eco Beach Resort on Saint Martin's Island.",
      },
      { property: "og:title", content: "Book Your Stay | Santa Monica Eco Beach Resort" },
      {
        property: "og:description",
        content: "Choose your dates, rooms and meals, see the bill, and send your request.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SiteLayout>
      <BookingFlow />
    </SiteLayout>
  ),
});
