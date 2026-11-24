import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";
import { SiteLayout } from "@/components/resort-site";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    next?: "/booking" | "/my-stays" | "/admin" | "/account" | "/pos";
    checkIn?: string;
    checkOut?: string;
    guests?: number;
  } => {
    const requestedNext = search["next"];
    const next =
      requestedNext === "/booking" ||
      requestedNext === "/admin" ||
      requestedNext === "/account" ||
      requestedNext === "/my-stays" ||
      requestedNext === "/pos"
        ? requestedNext
        : undefined;
    const checkIn = typeof search["checkIn"] === "string" ? search["checkIn"] : undefined;
    const checkOut = typeof search["checkOut"] === "string" ? search["checkOut"] : undefined;
    const guests =
      typeof search["guests"] === "number" && Number.isFinite(search["guests"])
        ? search["guests"]
        : typeof search["guests"] === "string" && Number.isFinite(Number(search["guests"]))
          ? Number(search["guests"])
          : undefined;
    return {
      ...(next ? { next } : {}),
      ...(checkIn ? { checkIn } : {}),
      ...(checkOut ? { checkOut } : {}),
      ...(guests !== undefined ? { guests } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Guest Sign In | Santa Monica Eco Beach Resort" },
      {
        name: "description",
        content: "Sign in or create your guest account to manage your coastal stays.",
      },
      { property: "og:title", content: "Guest Sign In | Santa Monica Eco Beach Resort" },
      {
        property: "og:description",
        content: "Keep your guest details and stay requests together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SiteLayout>
      <AuthScreen />
    </SiteLayout>
  ),
});
