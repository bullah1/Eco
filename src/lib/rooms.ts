import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getRoomMedia } from "@/lib/room-media";
import { stayConcepts } from "@/lib/resort-data";

export type RoomType = {
  id: string;
  name: string;
  slug: string;
  description: string;
  features: string[];
  image_url: string;
  max_guests: number;
  nightly_rate_cents: number;
  bed_type: string;
  room_size_sqft: number | null;
  view_label: string;
  video_url: string;
  panorama_url: string;
  gallery_urls: string[];
};

const columns =
  "id, name, slug, description, features, image_url, max_guests, nightly_rate_cents, bed_type, room_size_sqft, view_label, video_url, panorama_url, gallery_urls";

export function useRoomTypes() {
  return useQuery({
    queryKey: ["room-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_types")
        .select(columns)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw new Error("Rooms couldn't be loaded right now.");
      return (data ?? []) as RoomType[];
    },
  });
}

export function useRoomType(slug: string) {
  return useQuery({
    queryKey: ["room-type", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_types")
        .select(columns)
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new Error("This room couldn't be loaded right now.");
      return data as RoomType | null;
    },
  });
}

/** How many rooms of each category are free on the dates (room_type_id -> count). */
export function useTypeAvailability(checkIn: string, checkOut: string) {
  return useQuery({
    queryKey: ["type-availability", checkIn, checkOut],
    enabled: Boolean(checkIn && checkOut && checkOut > checkIn),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_room_type_availability", {
        p_check_in: checkIn,
        p_check_out: checkOut,
      });
      if (error) throw new Error("Availability couldn't be checked right now.");
      return new Map((data ?? []).map((row) => [row.room_type_id, row.available_count]));
    },
  });
}

/** Photos, 360° image and video for a room: admin links first, then files in src/assets/rooms/<slug>/. */
export function roomMedia(room: RoomType, fallbackIndex = 0) {
  const local = getRoomMedia(room.slug, room.image_url || undefined);
  const photos = [...local.photos, ...room.gallery_urls.filter(Boolean)].filter(
    (src, i, all) => all.indexOf(src) === i,
  );
  if (photos.length === 0) {
    const fallback = stayConcepts[fallbackIndex % stayConcepts.length]?.image;
    if (fallback) photos.push(fallback);
  }
  return {
    photos,
    panorama: room.panorama_url || local.panorama,
    video: room.video_url || null,
  };
}

/** Turns a YouTube or Facebook link into an embeddable address; other links are played as a file. */
export function videoEmbed(url: string): { kind: "iframe" | "file"; src: string } {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  if (/facebook\.com|fb\.watch/.test(url))
    return {
      kind: "iframe",
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
    };
  return { kind: "file", src: url };
}

export const nightsBetween = (checkIn: string, checkOut: string) =>
  checkIn && checkOut && checkOut > checkIn
    ? Math.round(
        (new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime()) /
          86400000,
      )
    : 0;
