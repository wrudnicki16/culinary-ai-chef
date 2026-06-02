import { Ingredient, NutritionInfo } from "./types";

export const MAX_CALORIES_PER_SERVING = 1000;
export const CALORIE_TARGET_MAX = 800;

// --- Display-time quantity scaling -------------------------------------------
// These helpers render a scaled quantity string (e.g. "2 lbs" → "1 lb") for a
// future "edit servings" UI. scaleRecipePortions itself does NOT rewrite
// ingredient amounts — it adjusts the serving count instead — so these are kept
// for non-destructive display/derivation rather than mutating stored recipes.
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

// Caps an over-target recipe by splitting the same food across more servings
// rather than shrinking ingredient amounts. This keeps ingredient quantities
// exactly as written (clean shopping amounts), keeps per-serving macros exact
// (total is preserved, never re-rounded from scaled ingredients), and gives the
// same scaling mechanism a future "edit servings" feature can reuse.
export function scaleRecipePortions(
  recipeData: {
    ingredients: Ingredient[];
    nutritionInfo: NutritionInfo;
    servings: number;
  },
  targetServings?: number | null
): void {
  const currentCalories = recipeData.nutritionInfo?.calories;
  if (!currentCalories) return;

  const baseServings = recipeData.servings || 1;

  // No user preference: keep the original cap-only behavior. Only act on
  // recipes over the trigger, scaling by the smallest integer multiple that
  // lands per-serving calories in the ~400-800 band.
  if (targetServings == null) {
    if (currentCalories <= MAX_CALORIES_PER_SERVING) return;
    const k = Math.ceil(currentCalories / CALORIE_TARGET_MAX);
    const newCalories = Math.round(currentCalories / k);
    console.log(
      `Scaling recipe portions: ${currentCalories} cal/serving → ${newCalories} cal/serving (servings ×${k}: ${baseServings} → ${baseServings * k})`
    );
    recipeData.servings = baseServings * k;
    recipeData.nutritionInfo.calories = newCalories;
    recipeData.nutritionInfo.protein = Math.round(recipeData.nutritionInfo.protein / k);
    recipeData.nutritionInfo.fat = Math.round(recipeData.nutritionInfo.fat / k);
    recipeData.nutritionInfo.carbs = Math.round(recipeData.nutritionInfo.carbs / k);
    if (recipeData.nutritionInfo.fiber !== undefined) {
      recipeData.nutritionInfo.fiber = Math.round(recipeData.nutritionInfo.fiber / k);
    }
    return;
  }

  // User has a default-servings preference. Treat the recipe as immutable
  // (total nutrition fixed) and choose the serving count: honor the user's
  // target, but never let a serving exceed the calorie cap (hard floor on N).
  const totalCalories = currentCalories * baseServings;
  const capMin = Math.ceil(totalCalories / MAX_CALORIES_PER_SERVING);
  const effective = Math.max(targetServings, capMin, 1);

  if (effective === baseServings) return;

  const newCalories = Math.round(totalCalories / effective);
  console.log(
    `Scaling recipe portions to default: ${baseServings} → ${effective} servings (target ${targetServings}, capMin ${capMin}); ${currentCalories} → ${newCalories} cal/serving`
  );
  recipeData.servings = effective;
  // Same per-macro rounding as the null branch above — keep in sync if fields change.
  recipeData.nutritionInfo.calories = newCalories;
  recipeData.nutritionInfo.protein = Math.round((recipeData.nutritionInfo.protein * baseServings) / effective);
  recipeData.nutritionInfo.fat = Math.round((recipeData.nutritionInfo.fat * baseServings) / effective);
  recipeData.nutritionInfo.carbs = Math.round((recipeData.nutritionInfo.carbs * baseServings) / effective);
  if (recipeData.nutritionInfo.fiber !== undefined) {
    recipeData.nutritionInfo.fiber = Math.round((recipeData.nutritionInfo.fiber * baseServings) / effective);
  }
}

// Re-derives per-serving nutrition for a different serving count WITHOUT
// mutating the recipe. Total nutrition is treated as fixed (perServing ×
// baseServings); this is the display-time layer used by the recipe modal's
// servings dropdown. Returns rounded per-serving values for the chosen count.
export function deriveServingNutrition(
  nutritionInfo: NutritionInfo,
  baseServings: number,
  targetServings: number
): NutritionInfo {
  const factor = targetServings > 0 && baseServings > 0 ? baseServings / targetServings : 1;
  const derived: NutritionInfo = {
    calories: Math.round(nutritionInfo.calories * factor),
    protein: Math.round(nutritionInfo.protein * factor),
    fat: Math.round(nutritionInfo.fat * factor),
    carbs: Math.round(nutritionInfo.carbs * factor),
  };
  if (nutritionInfo.fiber !== undefined) {
    derived.fiber = Math.round(nutritionInfo.fiber * factor);
  }
  return derived;
}
