import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/account-page";
import { SiteLayout } from "@/components/resort-site";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [
    { title: "Guest Details | Santa Monica Eco Beach Resort" },
    { name: "description", content: "View and update the guest details for your Santa Monica Eco Beach Resort account." },
    { property: "og:title", content: "Guest Details | Santa Monica Eco Beach Resort" },
    { property: "og:description", content: "Manage your private guest profile and visit details." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SiteLayout><AccountPage /></SiteLayout>,
});