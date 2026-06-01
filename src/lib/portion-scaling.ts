import { Ingredient, NutritionInfo } from "./types";

export const MAX_CALORIES_PER_SERVING = 1000;

function singularizeUnit(unit: string): string {
  const parts = unit.split(" ");
  const first = parts[0];
  if (first.endsWith("s") && !first.endsWith("ss")) {
    parts[0] = first.slice(0, -1);
  }
  return parts.join(" ");
}

export function formatScaledQuantity(value: number, unit: string): string {
  const rounded = Math.round(value * 4) / 4;
  let formatted: string;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;

  if (frac === 0) {
    formatted = String(whole || 1);
  } else if (frac === 0.25) {
    formatted = whole > 0 ? `${whole} 1/4` : "1/4";
  } else if (frac === 0.5) {
    formatted = whole > 0 ? `${whole} 1/2` : "1/2";
  } else if (frac === 0.75) {
    formatted = whole > 0 ? `${whole} 3/4` : "3/4";
  } else {
    formatted = rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  const displayUnit = rounded <= 1 ? singularizeUnit(unit) : unit;
  return displayUnit ? `${formatted} ${displayUnit}` : formatted;
}

export function scaleQuantity(quantity: string, factor: number): string {
  const mixedMatch = quantity.match(/^(\d+)\s+(\d+\/\d+)\s*(.*)/);
  if (mixedMatch) {
    const [, whole, frac, rest] = mixedMatch;
    const [num, den] = frac.split("/").map(Number);
    const value = parseInt(whole) + num / den;
    return formatScaledQuantity(value * factor, rest);
  }

  const fracMatch = quantity.match(/^(\d+\/\d+)\s*(.*)/);
  if (fracMatch) {
    const [, frac, rest] = fracMatch;
    const [num, den] = frac.split("/").map(Number);
    return formatScaledQuantity((num / den) * factor, rest);
  }

  const numMatch = quantity.match(/^(\d+\.?\d*)\s*(.*)/);
  if (numMatch) {
    const [, numStr, rest] = numMatch;
    return formatScaledQuantity(parseFloat(numStr) * factor, rest);
  }

  return quantity;
}

export function scaleRecipePortions(recipeData: {
  ingredients: Ingredient[];
  nutritionInfo: NutritionInfo;
}): void {
  const currentCalories = recipeData.nutritionInfo?.calories;
  if (!currentCalories || currentCalories <= MAX_CALORIES_PER_SERVING) return;

  const scaleFactor = MAX_CALORIES_PER_SERVING / currentCalories;
  console.log(
    `Scaling recipe portions: ${currentCalories} cal/serving → ${MAX_CALORIES_PER_SERVING} cal/serving (factor: ${scaleFactor.toFixed(2)})`
  );

  for (const ing of recipeData.ingredients) {
    ing.quantity = scaleQuantity(ing.quantity, scaleFactor);
  }

  recipeData.nutritionInfo.calories = Math.round(currentCalories * scaleFactor);
  recipeData.nutritionInfo.protein = Math.round(recipeData.nutritionInfo.protein * scaleFactor);
  recipeData.nutritionInfo.fat = Math.round(recipeData.nutritionInfo.fat * scaleFactor);
  recipeData.nutritionInfo.carbs = Math.round(recipeData.nutritionInfo.carbs * scaleFactor);
  if (recipeData.nutritionInfo.fiber !== undefined) {
    recipeData.nutritionInfo.fiber = Math.round(recipeData.nutritionInfo.fiber * scaleFactor);
  }
}
