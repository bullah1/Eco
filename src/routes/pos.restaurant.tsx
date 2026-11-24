import { createFileRoute } from "@tanstack/react-router";
import { RestaurantPage } from "@/components/pos/restaurant-page";

export const Route = createFileRoute("/pos/restaurant")({
  head: () => ({ meta: [{ title: "Restaurant | Front Desk" }] }),
  component: RestaurantPage,
});
