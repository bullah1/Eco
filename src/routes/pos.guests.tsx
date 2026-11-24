import { createFileRoute } from "@tanstack/react-router";
import { GuestsPage } from "@/components/pos/guests-page";

export const Route = createFileRoute("/pos/guests")({
  head: () => ({ meta: [{ title: "Guests | Front Desk" }] }),
  component: GuestsPage,
});
