import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { GalleryPage } from "@/components/content-pages";

export const Route = createFileRoute("/gallery")({
  head: () => ({ meta: [
    { title: "The Coast in Frames | Santa Monica Eco Beach Resort" },
    { name: "description", content: "A visual glimpse of the shoreline, timber spaces, and sunset coast at Santa Monica Eco Beach Resort." },
    { property: "og:title", content: "The Coast in Frames | Santa Monica Eco Beach Resort" },
    { property: "og:description", content: "Sunlight, coconut palms, and the Bay of Bengal horizon — moments from our coast." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SiteLayout><GalleryPage /></SiteLayout>,
});