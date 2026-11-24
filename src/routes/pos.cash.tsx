import { createFileRoute } from "@tanstack/react-router";
import { CashPage } from "@/components/pos/cash-page";

export const Route = createFileRoute("/pos/cash")({
  head: () => ({ meta: [{ title: "Cash | Front Desk" }] }),
  component: CashPage,
});
