import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { ContactPage } from "@/components/content-pages";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Visit Saint Martin's Island | Santa Monica Eco Beach Resort" },
    { name: "description", content: "Find Santa Monica Eco Beach Resort on Saint Martin's Island, Bangladesh." },
    { property: "og:title", content: "Visit Saint Martin's Island | Santa Monica Eco Beach Resort" },
    { property: "og:description", content: "A place on the Bay of Bengal — discover Saint Martin's Island around the resort." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SiteLayout><ContactPage /></SiteLayout>,
});