import { Ingredient, NutritionInfo } from "./types";

const EDAMAM_API_URL = "https://api.edamam.com/api/nutrition-details";

function formatIngredients(ingredients: Ingredient[]): string[] {
  return ingredients.map((ing) => `${ing.quantity} ${ing.name}`);
}

export async function analyzeNutritionWithEdamam(
  ingredients: Ingredient[],
  servings: number
): Promise<NutritionInfo | null> {
  const appId = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;

  if (!appId || !appKey) {
    return null;
  }

  try {
    const response = await fetch(
      `${EDAMAM_API_URL}?app_id=${appId}&app_key=${appKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingr: formatIngredients(ingredients) }),
      }
    );

    if (!response.ok) {
      console.warn(`Edamam API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (typeof data.calories !== "number" || !data.totalNutrients) {
      console.warn("Edamam API error: malformed response");
      return null;
    }

    return {
      calories: Math.round(data.calories / servings),
      protein: Math.round((data.totalNutrients.PROCNT?.quantity ?? 0) / servings),
      fat: Math.round((data.totalNutrients.FAT?.quantity ?? 0) / servings),
      carbs: Math.round((data.totalNutrients.CHOCDF?.quantity ?? 0) / servings),
      fiber: Math.round((data.totalNutrients.FIBTG?.quantity ?? 0) / servings),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Edamam API error: ${message}`);
    return null;
  }
}
