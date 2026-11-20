import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Move3d, Images } from "lucide-react";
import "@photo-sphere-viewer/core/index.css";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoomMedia } from "@/lib/room-media";

export function PanoramaViewer({ src }: { src: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [hint, setHint] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let viewer: { destroy: () => void } | undefined;
    setState("loading");
    setHint(true);
    const hintTimer = window.setTimeout(() => setHint(false), 6000);

    import("@photo-sphere-viewer/core")
      .then(({ Viewer }) => {
        if (cancelled || !container.current) return;
        const instance = new Viewer({
          container: container.current,
          panorama: src,
          navbar: ["zoom", "move", "fullscreen"],
          loadingTxt: "",
          mousewheelCtrlKey: false,
          touchmoveTwoFingers: false,
          defaultZoomLvl: 20,
        });
        viewer = instance;
        instance.addEventListener("ready", () => !cancelled && setState("ready"), { once: true });
        instance.addEventListener("panorama-error", () => !cancelled && setState("error"), {
          once: true,
        });
      })
      .catch(() => !cancelled && setState("error"));

    return () => {
      cancelled = true;
      window.clearTimeout(hintTimer);
      viewer?.destroy();
    };
  }, [src]);

  return (
    <div className="relative h-[52vh] min-h-[280px] w-full bg-resort-wood">
      <div ref={container} className="absolute inset-0" />
      {state === "loading" && (
        <p className="absolute inset-0 grid place-items-center text-sm text-resort-cream/80">
          <span className="flex items-center gap-2">
            <LoaderCircle className="animate-spin" size={16} />
            Loading 360° view…
          </span>
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-resort-cream/80"
        >
          The 360° view couldn't be loaded right now.
        </p>
      )}
      {state === "ready" && hint && (
        <p className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-resort-wood/70 px-3 py-1 text-xs text-resort-cream">
          Drag to look around
        </p>
      )}
    </div>
  );
}

export function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const total = photos.length;
  const go = (next: number) => setIndex((next + total) % total);

  if (total === 0) {
    return (
      <div className="grid h-[52vh] min-h-[280px] place-items-center bg-resort-sand text-sm text-muted-foreground">
        Photos coming soon.
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-[52vh] min-h-[280px] w-full bg-resort-sand">
        <img
          src={photos[index]}
          alt={`${name}, photo ${index + 1} of ${total}`}
          className="size-full object-cover"
        />
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(index - 1)}
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-resort-wood/70 text-resort-cream hover:bg-resort-wood"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(index + 1)}
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-resort-wood/70 text-resort-cream hover:bg-resort-wood"
            >
              <ChevronRight size={20} />
            </button>
            <p className="absolute bottom-3 right-3 rounded-full bg-resort-wood/70 px-3 py-1 text-xs text-resort-cream">
              {index + 1} / {total}
            </p>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3">
          {photos.map((photo, i) => (
            <button
              type="button"
              key={photo}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-14 w-20 shrink-0 overflow-hidden border-2 ${i === index ? "border-resort-gold" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RoomMediaDialog({
  open,
  onOpenChange,
  name,
  subtitle,
  price,
  media,
  selected,
  onSelect,
  startOn360 = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  subtitle: string;
  price: string;
  media: RoomMedia;
  selected: boolean;
  onSelect: () => void;
  startOn360?: boolean;
}) {
  const [tab, setTab] = useState<"photos" | "360">("photos");

  useEffect(() => {
    if (open) setTab(startOn360 && media.panorama ? "360" : "photos");
  }, [open, startOn360, media.panorama]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94svh] max-w-3xl gap-0 overflow-y-auto rounded-none p-0">
        <DialogHeader className="p-5 pr-12">
          <DialogTitle className="font-display text-2xl text-primary">{name}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "photos" | "360")}>
          {media.panorama && (
            <TabsList className="mx-5 mb-3 grid w-auto max-w-xs grid-cols-2">
              <TabsTrigger value="photos">
                <Images size={14} className="mr-1.5" />
                Photos
              </TabsTrigger>
              <TabsTrigger value="360">
                <Move3d size={14} className="mr-1.5" />
                360° view
              </TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="photos" className="mt-0">
            <PhotoGallery photos={media.photos} name={name} />
          </TabsContent>
          {media.panorama && (
            <TabsContent value="360" className="mt-0">
              <PanoramaViewer src={media.panorama} />
            </TabsContent>
          )}
        </Tabs>

        <div className="flex items-center justify-between gap-4 border-t border-border p-4">
          <p className="text-sm text-muted-foreground">{price}</p>
          <Button
            variant={selected ? "outline" : "default"}
            onClick={() => {
              onSelect();
              onOpenChange(false);
            }}
          >
            {selected ? "Remove this room" : "Add this room"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
