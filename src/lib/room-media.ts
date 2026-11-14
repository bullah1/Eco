// Room photos and 360° panoramas.
//
// Drop files into src/assets/rooms/<room-type-slug>/ and they appear automatically
// in the booking flow when a guest views that room:
//   - any .jpg / .jpeg / .png / .webp   -> photo gallery (sorted by file name)
//   - a file whose name starts with "360" or "pano" -> the 360° view
// The slug is the one set in the admin panel when the stay type was created.

const files = import.meta.glob("/src/assets/rooms/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export type RoomMedia = {
  photos: string[];
  panorama: string | null;
};

const byRoom = new Map<string, { photos: [string, string][]; panoramas: [string, string][] }>();

for (const [path, url] of Object.entries(files)) {
  const match = path.match(/\/rooms\/([^/]+)\/([^/]+)$/);
  if (!match) continue;
  const [, rawSlug, fileName] = match;
  if (!rawSlug || !fileName) continue;
  const slug = rawSlug.toLowerCase();
  const entry = byRoom.get(slug) ?? { photos: [], panoramas: [] };
  if (/^(360|pano)/i.test(fileName)) entry.panoramas.push([fileName, url]);
  else entry.photos.push([fileName, url]);
  byRoom.set(slug, entry);
}

const sortByName = (a: [string, string], b: [string, string]) =>
  a[0].localeCompare(b[0], undefined, { numeric: true });

export function getRoomMedia(slug: string, coverImage?: string): RoomMedia {
  const entry = byRoom.get(slug.toLowerCase());
  const local = entry ? [...entry.photos].sort(sortByName).map(([, url]) => url) : [];
  const photos = [...(coverImage ? [coverImage] : []), ...local];
  const panorama = entry ? ([...entry.panoramas].sort(sortByName)[0]?.[1] ?? null) : null;
  return { photos, panorama };
}
