import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { GuestStaysPage } from "@/components/booking-flow";

export const Route = createFileRoute("/my-stays")({
  head: () => ({ meta: [
    { title: "My Stays | Santa Monica Eco Beach Resort" },
    { name: "description", content: "View your Santa Monica Eco Beach Resort reservation requests and stay history." },
    { property: "og:title", content: "My Stays | Santa Monica Eco Beach Resort" },
    { property: "og:description", content: "A private place to keep your reservation requests." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SiteLayout><GuestStaysPage /></SiteLayout>,
});