import { createFileRoute } from "@tanstack/react-router";
import { ExpensesPage } from "@/components/pos/expenses-page";

export const Route = createFileRoute("/pos/expenses")({
  head: () => ({ meta: [{ title: "Expenses | Front Desk" }] }),
  component: ExpensesPage,
});
