import cottageImage from "@/assets/sagara-ocean-cottage.jpg";
import wellnessImage from "@/assets/sagara-coastal-wellness.jpg";
import diningImage from "@/assets/sagara-coastal-table.jpg";

export const firstStayConcept = {
    name: "Ocean House",
    category: "Stay concept",
    description: "A natural timber hideaway shaped around horizon views and unhurried mornings.",
    image: cottageImage,
    imageAlt: "Coconut palms leaning over the sandy shore of Saint Martin's Island",
    detail: "Ocean-facing cottage",
  };

export const secondStayConcept = {
    name: "The Garden Suite",
    category: "Stay concept",
    description: "Soft linen, organic textures, and a quieter connection to the coastal landscape.",
    image: diningImage,
    imageAlt: "A leaning coconut palm and wooden boats resting on the beach",
    detail: "Coastal retreat",
  };

export const stayConcepts = [firstStayConcept, secondStayConcept];

export const firstExperienceConcept = {
    name: "First Light",
    description: "A slow start beside the water as the coast wakes around you.",
    image: wellnessImage,
    imageAlt: "Tall coconut palms along the beach beside the sea",
  };

export const secondExperienceConcept = {
    name: "A Table by the Sea",
    description: "An intimate evening shaped by seasonal coastal flavours.",
    image: diningImage,
    imageAlt: "Wooden fishing boats gathered on the shallow turquoise sea",
  };

export const experienceConcepts = [firstExperienceConcept, secondExperienceConcept];