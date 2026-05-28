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

    if (!Array.isArray(data.ingredients)) {
      console.warn("Edamam API error: malformed response — no ingredients array");
      return null;
    }

    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    let totalFiber = 0;

    for (const ing of data.ingredients) {
      for (const parsed of ing.parsed ?? []) {
        const n = parsed.nutrients ?? {};
        totalCalories += n.ENERC_KCAL?.quantity ?? 0;
        totalProtein += n.PROCNT?.quantity ?? 0;
        totalFat += n.FAT?.quantity ?? 0;
        totalCarbs += n.CHOCDF?.quantity ?? 0;
        totalFiber += n.FIBTG?.quantity ?? 0;
      }
    }

    return {
      calories: Math.round(totalCalories / servings),
      protein: Math.round(totalProtein / servings),
      fat: Math.round(totalFat / servings),
      carbs: Math.round(totalCarbs / servings),
      fiber: Math.round(totalFiber / servings),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Edamam API error: ${message}`);
    return null;
  }
}
