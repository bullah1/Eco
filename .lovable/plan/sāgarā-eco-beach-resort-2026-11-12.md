# Sāgarā Eco Beach Resort

Build a polished, mobile-first resort website and booking foundation for **Sāgarā Eco Beach Resort** in Santa Monica, with the tagline **“Where Silence Meets the Sea.”** Use the supplied brand direction and generated coastal hero image.

## Guest experience
- Create a cinematic home page with resort navigation, a date/guest booking entry, accommodation highlights, experiences, gallery, testimonials, location, and contact details.
- Add accommodation detail and experiences/gallery/contact pages with page-specific share metadata.
- Add guest sign-up/sign-in, profile details, booking history, and a multi-step booking flow: dates → accommodation → guest details → review → confirmation.
- Use the connected account system for guest identity and store profiles and reservations in Lovable Cloud.

## Reservations and administration
- Add room types, room-unit inventory, rate snapshots, reservation records, owner-scoped guest reads, and server/database-enforced date-overlap protection.
- Add role-protected administration pages for room inventory/prices, reservations, gallery/content, and customer records; roles remain separate from editable profiles.
- Keep payment implementation deferred until the resort's registered seller country is confirmed and the payment provider is enabled.

## Visual direction
- Build a distinctive, warm coastal-resort design with refined serif headings, clear sans-serif body text, natural wood/sand/cream/gold/ocean tones, restrained motion, and responsive layouts.

## Technical details
- Preserve the existing TanStack Start framework rather than replacing the project with Next.js; use its file-based routes and route-level metadata.
- Use semantic global style tokens, the generated Lovable Cloud client, authenticated server functions, explicit table grants/RLS, and the database migration tool.
- Keep the first admin assignment unavailable until an authorized admin role is granted; never grant admin from client-controlled profile data.
- Do not invent operationally binding room rates, policies, or contact details. Any visible starter rates/content must be clearly marked as examples until the resort supplies its real catalog.
