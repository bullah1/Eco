import { createFileRoute } from "@tanstack/react-router";
import { StaffPage } from "@/components/pos/staff-page";

export const Route = createFileRoute("/pos/staff")({
  head: () => ({ meta: [{ title: "Staff | Front Desk" }] }),
  component: StaffPage,
});
