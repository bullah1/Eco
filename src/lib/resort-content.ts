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

export const resortContact = {
  address: "",
  phone: "",
  whatsapp: "", // digits only with country code, e.g. 8801XXXXXXXXX
  email: "",
  mapQuery: "20.6275,92.3234", // Saint Martin's Island
};

export const heroSlides = [
  {
    image: coastHero,
    alt: "Wooden fishing boats on the turquoise water off Saint Martin's Island",
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
    image: palmsShore,
    alt: "Tall coconut palms along the beach beside the sea",
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
    { src: leaningPalm, alt: "A coconut palm leaning over the sandy shore" },
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
    src: boatsShallow,
    alt: "Fishing boats resting in the shallow water off Saint Martin's",
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
    image: { src: coastHero, alt: "Boats on the turquoise water off Saint Martin's" },
  },
  {
    name: "Beach games",
    copy: "Football, volleyball and frisbee on the sand in the afternoon.",
    image: { src: poolUmbrellas, alt: "Sun loungers and umbrellas by the sea" },
  },
  {
    name: "Music night",
    copy: "Live songs and guitar on the lawn after dinner.",
    image: { src: infinityPoolDusk, alt: "The resort lawn and pool at dusk" },
  },
  {
    name: "BBQ and bonfire",
    copy: "A fire on the beach, grilled food and the sound of the sea.",
    image: { src: palmsShore, alt: "Coconut palms along the beach at the end of the day" },
  },
];

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
    image: { src: infinityPoolDusk, alt: "The pool at dusk" },
  },
  {
    name: "Family package",
    copy: "Connected rooms, all meals and a speedboat trip for the family.",
    validity: "Year round, subject to availability",
    image: { src: poolUmbrellas, alt: "Loungers and umbrellas by the pool" },
  },
  {
    name: "Group package",
    copy: "Rooms, meals and a BBQ night arranged for larger groups.",
    validity: "On request",
    image: { src: aerialBeach, alt: "Aerial view of the beach" },
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
    image: { src: leaningPalm, alt: "A palm leaning over the beach" },
  },
];

export const galleryCategories = [
  {
    name: "Beach",
    photos: [
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
