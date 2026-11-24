import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/components/pos/orders-page";

export const Route = createFileRoute("/pos/orders")({
  head: () => ({ meta: [{ title: "Website orders | Front Desk" }] }),
  component: OrdersPage,
});
