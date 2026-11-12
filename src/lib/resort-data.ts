import cottageImage from "@/assets/sagara-ocean-cottage.jpg";
import wellnessImage from "@/assets/sagara-coastal-wellness.jpg";
import diningImage from "@/assets/sagara-coastal-table.jpg";

export const firstStayConcept = {
    name: "Ocean House",
    category: "Stay concept",
    description: "A natural timber hideaway shaped around horizon views and unhurried mornings.",
    image: cottageImage,
    imageAlt: "A timber beach cottage opening onto the Pacific at sunrise",
    detail: "Ocean-facing cottage",
  };

export const secondStayConcept = {
    name: "The Garden Suite",
    category: "Stay concept",
    description: "Soft linen, organic textures, and a quieter connection to the coastal landscape.",
    image: diningImage,
    imageAlt: "A candlelit dining table on a timber deck above the coast",
    detail: "Coastal retreat",
  };

export const stayConcepts = [firstStayConcept, secondStayConcept];

export const firstExperienceConcept = {
    name: "First Light",
    description: "A slow start beside the water as the coast wakes around you.",
    image: wellnessImage,
    imageAlt: "Two guests stretching on a coastal deck at sunrise",
  };

export const secondExperienceConcept = {
    name: "A Table by the Sea",
    description: "An intimate evening shaped by seasonal coastal flavours.",
    image: diningImage,
    imageAlt: "A candlelit seasonal dinner on the shoreline at sunset",
  };

export const experienceConcepts = [firstExperienceConcept, secondExperienceConcept];