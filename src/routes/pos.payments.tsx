import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "@/components/pos/payments-page";

export const Route = createFileRoute("/pos/payments")({
  head: () => ({ meta: [{ title: "Payments received | Front Desk" }] }),
  component: PaymentsPage,
});
