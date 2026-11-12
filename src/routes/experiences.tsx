import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { ExperiencesPage } from "@/components/content-pages";

export const Route = createFileRoute("/experiences")({
  head: () => ({ meta: [
    { title: "Coastal Experiences | Santa Monica Eco Beach Resort" },
    { name: "description", content: "Find coastal rituals and thoughtful experiences at Santa Monica Eco Beach Resort in Santa Monica." },
    { property: "og:title", content: "Coastal Experiences | Santa Monica Eco Beach Resort" },
    { property: "og:description", content: "From first light to an evening that takes its time, follow your own tide." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SiteLayout><ExperiencesPage /></SiteLayout>,
});