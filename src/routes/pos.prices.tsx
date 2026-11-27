import { createFileRoute } from "@tanstack/react-router";
import { PricesPage } from "@/components/pos/prices-page";

export const Route = createFileRoute("/pos/prices")({
  head: () => ({ meta: [{ title: "Room prices | Front Desk" }] }),
  component: PricesPage,
});
