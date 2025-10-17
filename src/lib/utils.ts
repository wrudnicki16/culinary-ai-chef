import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export const DIETARY_FILTERS = {
  dietType: [
    { id: "vegetarian", label: "Vegetarian" },
    { id: "vegan", label: "Vegan" },
    { id: "highProtein", label: "High Protein" },
    { id: "keto", label: "Keto" },
    { id: "paleo", label: "Paleo" },
    { id: "lowCarb", label: "Low Carb" },
  ],
  allergies: [
    { id: "nutFree", label: "Nut Allergy" },
    { id: "glutenFree", label: "Celiac Friendly" },
    { id: "dairyFree", label: "Dairy Free" },
    { id: "lowOxalate", label: "Low Oxalate" },
  ],
  health: [
    { id: "heartHealthy", label: "Heart Healthy" },
    { id: "lowSodium", label: "Low Sodium" },
    { id: "diabetic", label: "Diabetic Friendly" },
  ],
  trending: [
    { id: "mediterranean", label: "Mediterranean" },
    { id: "whole30", label: "Whole30" },
    { id: "airFryer", label: "Air Fryer" },
    { id: "onePot", label: "One Pot" },
    { id: "adaptogens", label: "Adaptogens" },
  ],
  cuisines: [
    { id: "italian", label: "Italian" },
    { id: "mexican", label: "Mexican" },
    { id: "japanese", label: "Japanese" },
    { id: "chinese", label: "Chinese" },
    { id: "indian", label: "Indian" },
    { id: "french", label: "French" },
    { id: "greek", label: "Greek" },
    { id: "turkish", label: "Turkish" },
    { id: "spanish", label: "Spanish" },
    { id: "ethiopian", label: "Ethiopian" },
    { id: "thai", label: "Thai" },
    { id: "american", label: "American" },
    { id: "korean", label: "Korean" },
    { id: "pakistani", label: "Pakistani" },
    { id: "peruvian", label: "Peruvian" },
    { id: "indonesian", label: "Indonesian" },
    { id: "iranian", label: "Iranian" },
    { id: "venezuelan", label: "Venezuelan" },
    { id: "german", label: "German" },
    { id: "polish", label: "Polish" },
    { id: "vietnamese", label: "Vietnamese" },
    { id: "egyptian", label: "Egyptian" },
    { id: "brazilian", label: "Brazilian" },
    { id: "filipino", label: "Filipino" },
    { id: "colombian", label: "Colombian" },
    { id: "malaysian", label: "Malaysian" },
    { id: "russian", label: "Russian" },
    { id: "british", label: "British" },
    { id: "moroccan", label: "Moroccan" },
    { id: "burmese", label: "Burmese" },
  ],
};

export const SAMPLE_RECIPE_IMAGES = [
  "https://images.unsplash.com/photo-1484723091739-30a097e8f929",
  "https://images.unsplash.com/photo-1540914124281-342587941389",
  "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288",
  "https://images.unsplash.com/photo-1505576399279-565b52d4ac71",
  "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f",
  "https://images.unsplash.com/photo-1506368249639-73a05d6f6488",
];

export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Define contradictory filter combinations
const CONTRADICTORY_COMBINATIONS = [
  {
    filters: ["vegan", "keto"],
    message: "Vegan and Keto diets can be challenging to combine. Vegan keto requires careful planning to get enough fats while avoiding animal products."
  },
  {
    filters: ["vegan", "paleo"],
    message: "Vegan and Paleo diets are fundamentally incompatible. Paleo emphasizes animal proteins while vegan excludes all animal products."
  },
  {
    filters: ["keto", "dairyfree"],
    message: "Keto and Dairy-Free can be difficult to combine. Keto relies heavily on dairy fats, so dairy-free keto requires alternative fat sources."
  },
  {
    filters: ["paleo", "vegetarian"],
    message: "Paleo and Vegetarian diets conflict. Paleo emphasizes meat and fish while vegetarian excludes these protein sources."
  }
];

export function detectContradictoryFilters(selectedFilters: string[]): {
  hasContradictions: boolean;
  warnings: string[];
} {
  const normalizedFilters = selectedFilters.map(f => f.toLowerCase());
  const warnings: string[] = [];
  const processedCombinations = new Set<string>();
  
  for (const combination of CONTRADICTORY_COMBINATIONS) {
    const hasAllFilters = combination.filters.every(filter => 
      normalizedFilters.includes(filter.toLowerCase())
    );
    
    if (hasAllFilters) {
      // Create a sorted key to avoid duplicates (e.g., "vegan,paleo" and "paleo,vegan")
      const combinationKey = combination.filters.sort().join(',');
      
      if (!processedCombinations.has(combinationKey)) {
        warnings.push(combination.message);
        processedCombinations.add(combinationKey);
      }
    }
  }
  
  return {
    hasContradictions: warnings.length > 0,
    warnings
  };
}
