import { createFileRoute } from "@tanstack/react-router";
import { HousekeepingPage } from "@/components/pos/housekeeping-page";

export const Route = createFileRoute("/pos/housekeeping")({
  head: () => ({ meta: [{ title: "Housekeeping | Front Desk" }] }),
  component: HousekeepingPage,
});
