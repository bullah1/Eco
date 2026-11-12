import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin-panel";
import { SiteLayout } from "@/components/resort-site";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Resort Management | Santa Monica Eco Beach Resort" },
    { name: "description", content: "Manage room inventory, reservations, guest records, gallery, and resort content." },
    { property: "og:title", content: "Resort Management | Santa Monica Eco Beach Resort" },
    { property: "og:description", content: "A private management desk for the Santa Monica Eco Beach Resort team." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SiteLayout><AdminPage /></SiteLayout>,
});