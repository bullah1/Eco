# Room photos and 360° views

Create one folder per stay type, named exactly like the **slug** you gave the stay
type in the admin panel (for example `ocean-house`), and drop the files in it:

```
src/assets/rooms/ocean-house/
  1-bedroom.jpg        <- photos (shown in the gallery, sorted by name)
  2-bathroom.jpg
  3-view.jpg
  360.jpg              <- 360° photo (name must start with "360" or "pano")
```

- The guest sees a photo gallery plus a **360° view** tab when they open a room in the booking step.
- The 360° file must be an **equirectangular** photo (2:1 ratio, e.g. 4096x2048). Phone apps
  such as Google Street View, or any 360 camera, produce this format.
- Keep photos under about 400 KB and the 360° file under about 3 MB so the page stays fast.
- If a room has no folder, only its cover image from the admin panel is shown and there is no 360° tab.
