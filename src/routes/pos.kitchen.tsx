import { createFileRoute } from "@tanstack/react-router";
import { KitchenPage } from "@/components/pos/kitchen-page";

export const Route = createFileRoute("/pos/kitchen")({
  head: () => ({ meta: [{ title: "Kitchen | Front Desk" }] }),
  component: KitchenPage,
});
