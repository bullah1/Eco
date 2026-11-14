import { useMemo, useState } from "react";
import { Check, Images, Move3d } from "lucide-react";

import { RoomMediaDialog } from "@/components/room-viewer";
import { getRoomMedia } from "@/lib/room-media";
import { formatMoney } from "@/lib/room-booking";

export type AvailableRoom = {
  room_unit_id: string;
  room_name: string;
  room_type_id: string;
  type_name: string;
  type_slug: string;
  description: string;
  nightly_rate_cents: number;
  max_guests: number;
  features: string[];
  image_url: string;
};

export function RoomCard({
  room,
  selected,
  onSelect,
  nights = 0,
}: {
  room: AvailableRoom;
  selected: boolean;
  onSelect: () => void;
  nights?: number;
}) {
  const [open, setOpen] = useState(false);
  const [start360, setStart360] = useState(false);
  const media = useMemo(
    () => getRoomMedia(room.type_slug, room.image_url),
    [room.type_slug, room.image_url],
  );
  const price = `${formatMoney(room.nightly_rate_cents)} / night`;
  const photoCount = media.photos.length;
  const hasMedia = photoCount > 0 || Boolean(media.panorama);

  const openDialog = (to360: boolean) => {
    setStart360(to360);
    setOpen(true);
  };

  return (
    <div
      className={`grid border transition-colors sm:grid-cols-[190px_1fr] ${
        selected
          ? "border-resort-ocean bg-resort-ocean-soft/40"
          : "border-border hover:border-resort-gold"
      }`}
    >
      {hasMedia ? (
        <button
          type="button"
          onClick={() => openDialog(false)}
          aria-label={`View photos${media.panorama ? " and 360° tour" : ""} of ${room.type_name}`}
          className="group relative aspect-[4/3] overflow-hidden bg-resort-sand sm:aspect-auto sm:min-h-[150px]"
        >
          {media.photos[0] && (
            <img
              src={media.photos[0]}
              alt=""
              loading="lazy"
              width={640}
              height={480}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
          {media.panorama && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-resort-gold px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              <Move3d size={12} />
              360°
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-resort-wood/80 to-transparent p-2 text-[11px] text-resort-cream">
            <span className="flex items-center gap-1">
              <Images size={13} />
              {photoCount > 1 ? `${photoCount} photos` : "View photo"}
            </span>
          </span>
        </button>
      ) : (
        <div
          className="aspect-[4/3] bg-resort-sand sm:aspect-auto sm:min-h-[150px]"
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="grid gap-4 p-4 text-left sm:grid-cols-[1fr_auto] sm:items-center"
      >
        <span>
          <span className="block font-display text-2xl text-primary">{room.type_name}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {room.room_name} · Up to {room.max_guests} guests
          </span>
          <span className="mt-3 block text-sm leading-5 text-muted-foreground">
            {room.description}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
          <span className="text-right text-xs text-muted-foreground">
            {price}
            {nights > 1 && (
              <span className="block font-medium text-primary">
                {formatMoney(room.nightly_rate_cents * nights)} for {nights} nights
              </span>
            )}
          </span>
          <span
            className={`grid size-6 place-items-center rounded-sm border ${
              selected ? "border-resort-ocean bg-resort-ocean text-resort-cream" : "border-border"
            }`}
          >
            {selected && <Check size={14} />}
          </span>
        </span>
      </button>

      {hasMedia && (
        <div className="flex flex-wrap gap-2 border-t border-border/70 px-4 py-2.5 sm:col-span-2">
          <button
            type="button"
            onClick={() => openDialog(false)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            <Images size={14} />
            Photos
          </button>
          {media.panorama && (
            <button
              type="button"
              onClick={() => openDialog(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-resort-ocean underline-offset-4 hover:underline"
            >
              <Move3d size={14} />
              360° view
            </button>
          )}
        </div>
      )}

      <RoomMediaDialog
        open={open}
        onOpenChange={setOpen}
        name={room.type_name}
        subtitle={`${room.room_name} · Up to ${room.max_guests} guests`}
        price={price}
        media={media}
        selected={selected}
        onSelect={onSelect}
        startOn360={start360}
      />
    </div>
  );
}
