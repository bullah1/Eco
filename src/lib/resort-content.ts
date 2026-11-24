// Editable site content. Replace the sample text and photos below with the resort's own.
// Anything left empty (phone, WhatsApp, email, address) is hidden on the site instead of faked.

import coastHero from "@/assets/sagara-coast-hero.jpg";
import palmsShore from "@/assets/sagara-coastal-wellness.jpg";
import boatsShallow from "@/assets/sagara-coastal-table.jpg";
import leaningPalm from "@/assets/sagara-ocean-cottage.jpg";
import poolUmbrellas from "@/assets/gallery/pool-umbrellas.jpg";
import infinityPoolDusk from "@/assets/gallery/infinity-pool-dusk.jpg";
import palmPoolBeach from "@/assets/gallery/palm-pool-beach.jpg";
import aerialBeach from "@/assets/gallery/aerial-beach.jpg";
import aerialLagoon from "@/assets/gallery/aerial-lagoon.jpg";
// Gemini-generated placeholders. Swap for the resort's own photos before launch.
import genHeroBeach from "@/assets/generated/hero-beach.jpg";
import genHeroSunset from "@/assets/generated/hero-sunset.jpg";
import genDining from "@/assets/generated/dining-table.jpg";
import genSpeedboat from "@/assets/generated/speedboat.jpg";
import genBonfire from "@/assets/generated/bonfire.jpg";
import genIndoor from "@/assets/generated/indoor-games.jpg";
import genDeluxe from "@/assets/rooms/deluxe-sea-view/01-room.jpg";
import genFamily from "@/assets/rooms/family-suite/01-room.jpg";
import genCottage from "@/assets/rooms/eco-cottage/01-cottage.jpg";
import genStandard from "@/assets/rooms/standard-double/01-room.jpg";

export const resortContact = {
  address: "",
  phone: "",
  whatsapp: "", // digits only with country code, e.g. 8801XXXXXXXXX
  email: "",
  mapQuery: "20.6275,92.3234", // Saint Martin's Island
};

export const heroSlides = [
  {
    image: genHeroBeach,
    alt: "Thatched cottages behind the palms on a white beach at golden hour",
    title: "Stay by the sea on Saint Martin's",
    copy: "An eco beach resort on Bangladesh's only coral island. Pick your dates and rooms, with breakfast included every morning.",
  },
  {
    image: aerialBeach,
    alt: "Aerial view of a sandy beach, pools and shaded loungers beside clear water",
    title: "Wake up a few steps from the water",
    copy: "Rooms close to the shore, a pool by the beach and the Bay of Bengal on the horizon.",
  },
  {
    image: genHeroSunset,
    alt: "Resort cottages lit up among the palms at sunset",
    title: "Days on the water, evenings by the fire",
    copy: "Speedboat trips, beach games, music nights and a bonfire under the palms.",
  },
];

export const welcome = {
  title: "Welcome to Santa Monica",
  lead: "A quiet place to stay on Saint Martin's, at the south-eastern tip of the Bay of Bengal",
  copy: "Days here follow the tide: fishing boats out at dawn, palms along the beach and long evenings on the water. Choose a room, breakfast is included, and the resort confirms everything with you directly.",
  images: [
    { src: palmPoolBeach, alt: "Pool, sun loungers and palms beside the sea" },
    { src: genCottage, alt: "An eco cottage with a veranda among the palms" },
  ],
};

export const facilities = [
  { name: "Swimming pool", copy: "A pool beside the beach with loungers and shade." },
  {
    name: "Restaurant",
    copy: "Island seafood, Bangladeshi home cooking and breakfast every morning.",
  },
  {
    name: "Jetty pick-up",
    copy: "Someone meets you at the ship jetty and brings you to the resort.",
  },
  { name: "Room service", copy: "Meals and drinks brought to your room." },
  { name: "Free Wi-Fi", copy: "Wi-Fi in the lobby, restaurant and common areas." },
  { name: "Power backup", copy: "Generator backup so the lights and fans stay on." },
];

export const dining = {
  title: "Fresh from the island",
  copy: "The resort kitchen cooks with fish landed on the island each morning and vegetables from the mainland. Breakfast comes with every room. Order other meals from your phone or at the restaurant.",
  image: {
    src: genDining,
    alt: "Grilled fish, prawns, rice and dal on a table by the sea",
  },
  menu: [
    { name: "Breakfast", copy: "Paratha, eggs, bhaji, fruit and tea" },
    { name: "Seafood lunch", copy: "Rice, dal, vegetables and the catch of the day" },
    { name: "Beach BBQ dinner", copy: "Grilled fish, chicken and naan by the water" },
    { name: "Coral fish platter", copy: "Fried and curried local fish for the table" },
  ],
};

export const activities = [
  {
    name: "Speedboat sea trip",
    copy: "Ride out past the coral to Chhera Dwip and back along the coast.",
    image: { src: genSpeedboat, alt: "A speedboat crossing the turquoise sea off Saint Martin's" },
  },
  {
    name: "Beach games",
    copy: "Football, volleyball and frisbee on the sand in the afternoon.",
    image: { src: poolUmbrellas, alt: "Sun loungers and umbrellas by the sea" },
  },
  {
    name: "Music night",
    copy: "Live songs and guitar on the lawn after dinner.",
    image: { src: genHeroSunset, alt: "The resort at dusk" },
  },
  {
    name: "BBQ and bonfire",
    copy: "A fire on the beach, grilled food and the sound of the sea.",
    image: { src: genBonfire, alt: "A bonfire on the beach under string lights at night" },
  },
];

export const indoorGamesImage = {
  src: genIndoor,
  alt: "The games lounge with carrom, chess and table tennis",
};

export const indoorGames = [
  { name: "Carrom", copy: "Boards in the lounge for two or four players" },
  { name: "Table tennis", copy: "A full-size table with bats and balls" },
  { name: "Chess", copy: "Sets for a slow game on the veranda" },
  { name: "Ludo and board games", copy: "For families and rainy afternoons" },
  { name: "Cards", copy: "Decks at the front desk" },
  { name: "Kids' corner", copy: "Toys and games for younger guests" },
];

export const packages = [
  {
    name: "Couple package",
    copy: "Two nights for two, breakfast each morning and a beach dinner.",
    validity: "Year round, subject to availability",
    image: { src: genHeroSunset, alt: "The beach at sunset" },
  },
  {
    name: "Family package",
    copy: "Connected rooms, all meals and a speedboat trip for the family.",
    validity: "Year round, subject to availability",
    image: { src: genFamily, alt: "A family suite opening onto the palms" },
  },
  {
    name: "Group package",
    copy: "Rooms, meals and a BBQ night arranged for larger groups.",
    validity: "On request",
    image: { src: genBonfire, alt: "A bonfire night on the beach" },
  },
];

export const travelGuide = [
  {
    title: "How to get to Saint Martin's",
    copy: "Travel to Cox's Bazar by bus or air, then take the ship to the island. The resort can meet you at the Saint Martin's jetty.",
    image: { src: boatsShallow, alt: "Boats in the shallow water near the jetty" },
  },
  {
    title: "When to visit",
    copy: "Ships run only in the tourist season, roughly November to February. Check the current rules and dates before you plan.",
    image: { src: aerialLagoon, alt: "Clear blue water seen from above" },
  },
  {
    title: "What to see on the island",
    copy: "Chhera Dwip at low tide, the west beach at sunset and the fishing boats in the morning.",
    image: { src: genSpeedboat, alt: "A speedboat heading out past the coral" },
  },
];

export const galleryCategories = [
  {
    name: "Rooms",
    photos: [
      { src: genDeluxe, alt: "Deluxe sea view room with a king bed" },
      { src: genFamily, alt: "Family suite with doors onto the palms" },
      { src: genCottage, alt: "Eco cottage with a thatched roof" },
      { src: genStandard, alt: "Standard double room in the evening" },
    ],
  },
  {
    name: "Food and fun",
    photos: [
      { src: genDining, alt: "Seafood lunch on a table by the sea" },
      { src: genSpeedboat, alt: "Speedboat trip on the turquoise sea" },
      { src: genBonfire, alt: "Bonfire night on the beach" },
      { src: genIndoor, alt: "The indoor games lounge" },
    ],
  },
  {
    name: "Beach",
    photos: [
      { src: genHeroBeach, alt: "Cottages behind the palms on a white beach" },
      { src: palmsShore, alt: "Coconut palms along the beach beside the sea" },
      { src: leaningPalm, alt: "A coconut palm leaning over the sandy shore" },
      { src: aerialBeach, alt: "Aerial view of the beach and shaded loungers" },
    ],
  },
  {
    name: "Pool",
    photos: [
      { src: palmPoolBeach, alt: "Pool, sun loungers and palms beside the sea" },
      { src: infinityPoolDusk, alt: "Infinity pool overlooking the sea at dusk" },
      { src: poolUmbrellas, alt: "Sun loungers and umbrellas by the pool and sea" },
    ],
  },
  {
    name: "Boats",
    photos: [
      { src: coastHero, alt: "Wooden fishing boats on the water off Saint Martin's Island" },
      { src: boatsShallow, alt: "Fishing boats resting in the shallow turquoise sea" },
    ],
  },
  {
    name: "From above",
    photos: [
      { src: aerialBeach, alt: "Aerial view of the beach, pools and shaded loungers" },
      { src: aerialLagoon, alt: "Aerial view of a lagoon ringed by sea cottages" },
    ],
  },
  {
    name: "Evenings",
    photos: [
      { src: genHeroSunset, alt: "The resort at sunset from the water's edge" },
      { src: infinityPoolDusk, alt: "The pool and sea at dusk" },
      { src: palmsShore, alt: "Palms along the shore late in the day" },
    ],
  },
];

export const allGalleryPhotos = galleryCategories
  .flatMap((c) => c.photos)
  .filter((p, i, all) => all.findIndex((x) => x.src === p.src) === i);

export const faqs = [
  {
    q: "What are the check-in and check-out times?",
    a: "Check-in is from 2:00 PM and check-out is by 12:00 noon. Ask the resort if you need an early arrival or a late departure.",
  },
  {
    q: "Is breakfast included?",
    a: "Yes, breakfast is included with every room. Lunch, dinner, a speedboat trip and other services can be ordered during your stay from the Order page or at the front desk.",
  },
  {
    q: "What is the cancellation policy?",
    a: "A reservation request is not confirmed until the resort contacts you. Tell the resort as early as you can if your plans change, and they will confirm the terms for your stay.",
  },
  {
    q: "How do I pay?",
    a: "The resort confirms payment options when it contacts you about your reservation.",
  },
  {
    q: "Can children stay?",
    a: "Yes. Add children when you search, and the resort will suggest a suitable room.",
  },
  {
    q: "How do I reach the island?",
    a: "Ships run from the Cox's Bazar side during the season. The resort can meet you at the Saint Martin's jetty.",
  },
];
