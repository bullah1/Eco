import { createFileRoute } from "@tanstack/react-router";
import { FrontDesk } from "@/components/pos/front-desk";

export const Route = createFileRoute("/pos/")({
  component: FrontDesk,
});
