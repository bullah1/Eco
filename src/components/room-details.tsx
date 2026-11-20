import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Images, LoaderCircle, Move3d, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PanoramaViewer, PhotoGallery } from "@/components/room-viewer";
import { supabase } from "@/integrations/supabase/client";
import { getRoomMedia } from "@/lib/room-media";
import { formatMoney } from "@/lib/room-booking";

export function RoomDetails({ slug }: { slug: string }) {
  const [view, setView] = useState<"photos" | "360">("photos");
  const query = useQuery({
    queryKey: ["room-type", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_types")
        .select("id, name, slug, description, features, image_url, max_guests, nightly_rate_cents")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const room = query.data;
  const media = useMemo(
    () => getRoomMedia(slug, room?.image_url || undefined),
    [slug, room?.image_url],
  );

  return (
    <div className="bg-resort-cream px-5 py-10 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/stays"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft size={15} />
          All rooms
        </Link>

        {query.isLoading && (
          <p role="status" className="mt-16 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={16} />
            Loading room
          </p>
        )}
        {query.isError && (
          <div role="alert" className="mt-16 border border-resort-gold bg-background p-6">
            <h1 className="text-3xl text-primary">We couldn't load this room</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p>
            <Button className="mt-5 rounded-none" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {!query.isLoading && !query.isError && !room && (
          <div className="mt-16 border-y border-border py-12">
            <h1 className="text-4xl text-primary">This room isn't available</h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              It may have been renamed or taken off the website. You can still see the rooms we
              offer.
            </p>
            <Button asChild className="mt-6 rounded-none">
              <Link to="/booking">
                Browse rooms <ArrowRight size={15} />
              </Link>
            </Button>
          </div>
        )}

        {room && (
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
            <div>
              {media.panorama && (
                <div className="mb-3 flex gap-2" role="tablist" aria-label="Room media">
                  <Button
                    role="tab"
                    aria-selected={view === "photos"}
                    variant={view === "photos" ? "default" : "outline"}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setView("photos")}
                  >
                    <Images size={14} className="mr-1.5" />
                    Photos
                  </Button>
                  <Button
                    role="tab"
                    aria-selected={view === "360"}
                    variant={view === "360" ? "default" : "outline"}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setView("360")}
                  >
                    <Move3d size={14} className="mr-1.5" />
                    360° view
                  </Button>
                </div>
              )}
              {view === "360" && media.panorama ? (
                <PanoramaViewer src={media.panorama} />
              ) : (
                <PhotoGallery photos={media.photos} name={room.name} />
              )}
            </div>
            <div className="lg:pt-6">
              <p className="text-sm text-muted-foreground">Room</p>
              <h1 className="mt-3 text-5xl font-normal leading-[1.05] text-primary sm:text-6xl">
                {room.name}
              </h1>
              <p className="mt-6 text-base leading-8 text-muted-foreground">{room.description}</p>
              <p className="mt-8 flex items-center gap-2 text-sm text-primary">
                <Users size={16} className="text-resort-gold" />
                Up to {room.max_guests} guests
              </p>
              {room.features.length > 0 && (
                <ul className="mt-8 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
                  {room.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-primary">
                      <Check size={15} className="mt-0.5 shrink-0 text-resort-gold" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-10 border-t border-border pt-6">
                <p className="text-sm text-muted-foreground">Price per night</p>
                <p className="mt-1 font-display text-4xl text-primary">
                  {formatMoney(room.nightly_rate_cents)}
                </p>
                <Button asChild size="lg" className="mt-6 h-12 w-full rounded-none sm:w-auto">
                  <Link to="/booking">
                    Book now <ArrowRight size={16} />
                  </Link>
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Choose your dates and pick this room in the next step. The resort confirms every
                  request.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
