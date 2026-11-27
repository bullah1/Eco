import { createFileRoute } from "@tanstack/react-router";
import { StockPage } from "@/components/pos/stock-page";

export const Route = createFileRoute("/pos/stock")({
  head: () => ({ meta: [{ title: "Kitchen stock | Front Desk" }] }),
  component: StockPage,
});
