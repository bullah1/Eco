import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/components/pos/overview-page";

export const Route = createFileRoute("/pos/overview")({
  head: () => ({ meta: [{ title: "Overview | Front Desk" }] }),
  component: OverviewPage,
});
