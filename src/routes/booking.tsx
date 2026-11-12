import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { BookingFlow } from "@/components/booking-flow";

export const Route = createFileRoute("/booking")({
  validateSearch: (search: Record<string, unknown>): { checkIn?: string; checkOut?: string; guests?: number } => {
    const checkIn = typeof search["checkIn"] === "string" ? search["checkIn"] : undefined;
    const checkOut = typeof search["checkOut"] === "string" ? search["checkOut"] : undefined;
    const guests = typeof search["guests"] === "number" && Number.isFinite(search["guests"])
      ? search["guests"]
      : typeof search["guests"] === "string" && Number.isFinite(Number(search["guests"]))
        ? Number(search["guests"])
        : undefined;
    return { ...(checkIn ? { checkIn } : {}), ...(checkOut ? { checkOut } : {}), ...(guests !== undefined ? { guests } : {}) };
  },
  head: () => ({ meta: [
    { title: "Reserve Your Stay | Santa Monica Eco Beach Resort" },
    { name: "description", content: "Choose your dates and request a stay at Santa Monica Eco Beach Resort in Santa Monica." },
    { property: "og:title", content: "Reserve Your Stay | Santa Monica Eco Beach Resort" },
    { property: "og:description", content: "Choose your dates, find an available stay, and request your time by the sea." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SiteLayout><BookingFlow /></SiteLayout>,
});