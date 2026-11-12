import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/resort-site";
import { HomePage } from "@/components/home-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Santa Monica Eco Beach Resort | Where Silence Meets the Sea" },
      { name: "description", content: "Find a quieter kind of coastal retreat at Santa Monica Eco Beach Resort in Santa Monica, California." },
      { property: "og:title", content: "Santa Monica Eco Beach Resort | Where Silence Meets the Sea" },
      { property: "og:description", content: "A considered coastal retreat for the moments that ask you to slow down." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SiteLayout><HomePage /></SiteLayout>,
});