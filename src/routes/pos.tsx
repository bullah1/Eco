import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PosShell } from "@/components/pos/pos-shell";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "Front Desk | Santa Monica Eco Beach Resort" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <PosShell>
      <Outlet />
    </PosShell>
  ),
});
