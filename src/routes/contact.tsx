import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { ContactPage } from "@/components/content-pages";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Visit Santa Monica | Santa Monica Eco Beach Resort" },
    { name: "description", content: "Find Santa Monica Eco Beach Resort along the Santa Monica, California coast." },
    { property: "og:title", content: "Visit Santa Monica | Santa Monica Eco Beach Resort" },
    { property: "og:description", content: "A place on the Pacific — discover the Santa Monica coast around the resort." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SiteLayout><ContactPage /></SiteLayout>,
});