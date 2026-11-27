import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/pos/reports-page";

export const Route = createFileRoute("/pos/reports")({
  head: () => ({ meta: [{ title: "Reports | Front Desk" }] }),
  component: ReportsPage,
});
