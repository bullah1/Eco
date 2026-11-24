import { createFileRoute } from "@tanstack/react-router";
import { FrontDesk } from "@/components/pos/front-desk";

export const Route = createFileRoute("/pos/")({
  validateSearch: (search: Record<string, unknown>): { view?: "calendar" } =>
    search["view"] === "calendar" ? { view: "calendar" } : {},
  component: FrontDesk,
});
