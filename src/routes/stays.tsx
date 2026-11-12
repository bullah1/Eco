import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { StaysPage } from "@/components/content-pages";

export const Route = createFileRoute("/stays")({
  head: () => ({ meta: [
    { title: "The Stay | Santa Monica Eco Beach Resort" },
    { name: "description", content: "Discover the considered stay concepts and coastal spaces of Santa Monica Eco Beach Resort." },
    { property: "og:title", content: "The Stay | Santa Monica Eco Beach Resort" },
    { property: "og:description", content: "Spaces shaped by the coast, thoughtful materials, and room to breathe." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SiteLayout><StaysPage /></SiteLayout>,
});