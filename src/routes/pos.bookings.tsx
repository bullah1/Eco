import { createFileRoute } from "@tanstack/react-router";
import { BookingsPage } from "@/components/pos/bookings-page";

export const Route = createFileRoute("/pos/bookings")({
  head: () => ({ meta: [{ title: "Booking history | Front Desk" }] }),
  component: BookingsPage,
});
