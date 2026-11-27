import { createFileRoute } from "@tanstack/react-router";
import { FrontDesk } from "@/components/pos/front-desk";

export const Route = createFileRoute("/pos/")({
  validateSearch: (search: Record<string, unknown>): { view?: "calendar"; room?: string } => ({
    ...(search["view"] === "calendar" ? { view: "calendar" as const } : {}),
    ...(typeof search["room"] === "string" ? { room: search["room"] } : {}),
  }),
  component: FrontDesk,
});
