import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/resort-site";
import { RoomDetails } from "@/components/room-details";

export const Route = createFileRoute("/rooms/$slug")({
  head: () => ({
    meta: [
      { title: "Room details | Santa Monica Eco Beach Resort" },
      {
        name: "description",
        content:
          "See photos, facilities and the nightly rate for a room at Santa Monica Eco Beach Resort on Saint Martin's Island.",
      },
      { property: "og:title", content: "Room details | Santa Monica Eco Beach Resort" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { slug } = Route.useParams();
  return (
    <SiteLayout>
      <RoomDetails slug={slug} />
    </SiteLayout>
  );
}
