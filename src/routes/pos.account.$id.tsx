import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/pos/account-page";

export const Route = createFileRoute("/pos/account/$id")({
  head: () => ({ meta: [{ title: "Guest bill | Front Desk" }] }),
  component: AccountRoute,
});

function AccountRoute() {
  const { id } = Route.useParams();
  return <AccountPage key={id} id={id} />;
}
