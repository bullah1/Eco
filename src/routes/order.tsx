import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { OrderPage } from "@/components/order-page";

export const Route = createFileRoute("/order")({
  head: () => ({
    meta: [
      { title: "Order Food and Services | Santa Monica Eco Beach Resort" },
      {
        name: "description",
        content:
          "Order meals, drinks, laundry, boat trips and more during your stay at Santa Monica Eco Beach Resort. Delivered to your room and added to your bill.",
      },
      { property: "og:title", content: "Order Food and Services | Santa Monica Eco Beach Resort" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => (
    <SiteLayout>
      <OrderPage />
    </SiteLayout>
  ),
});
