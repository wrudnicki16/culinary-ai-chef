import { describe, it, expect } from "vitest";
import { scaleQuantity, formatScaledQuantity, scaleRecipePortions, MAX_CALORIES_PER_SERVING } from "@/lib/portion-scaling";

describe("formatScaledQuantity", () => {
  it("formats whole numbers", () => {
    expect(formatScaledQuantity(2, "cups")).toBe("2 cups");
  });

  it("formats quarter fractions", () => {
    expect(formatScaledQuantity(0.25, "cup")).toBe("1/4 cup");
    expect(formatScaledQuantity(1.25, "cups")).toBe("1 1/4 cups");
  });

  it("formats half fractions", () => {
    expect(formatScaledQuantity(0.5, "cup")).toBe("1/2 cup");
    expect(formatScaledQuantity(2.5, "cups")).toBe("2 1/2 cups");
  });

  it("formats three-quarter fractions", () => {
    expect(formatScaledQuantity(0.75, "lb")).toBe("3/4 lb");
    expect(formatScaledQuantity(1.75, "cups")).toBe("1 3/4 cups");
  });

  it("floors to 1 when value rounds to 0", () => {
    expect(formatScaledQuantity(0.1, "tsp")).toBe("1 tsp");
  });

  it("handles empty unit", () => {
    expect(formatScaledQuantity(3, "")).toBe("3");
  });
});

describe("scaleQuantity", () => {
  it("scales integer quantities", () => {
    expect(scaleQuantity("2 cups", 0.5)).toBe("1 cup");
  });

  it("scales decimal quantities", () => {
    expect(scaleQuantity("1.5 lbs", 0.5)).toBe("3/4 lb");
  });

  it("scales fraction quantities", () => {
    expect(scaleQuantity("1/2 cup", 0.5)).toBe("1/4 cup");
  });

  it("scales mixed number quantities", () => {
    expect(scaleQuantity("1 1/2 cups", 0.5)).toBe("3/4 cup");
  });

  it("passes through non-numeric quantities unchanged", () => {
    expect(scaleQuantity("to taste", 0.5)).toBe("to taste");
    expect(scaleQuantity("pinch", 0.67)).toBe("pinch");
  });

  it("rounds to nearest quarter for clean output", () => {
    expect(scaleQuantity("3 cups", 0.33)).toBe("1 cup");
  });

  it("singularizes plural units when scaled to <= 1", () => {
    expect(scaleQuantity("4 cups", 0.25)).toBe("1 cup");
    expect(scaleQuantity("2 lbs", 0.5)).toBe("1 lb");
    expect(scaleQuantity("3 cloves", 0.25)).toBe("3/4 clove");
  });

  it("does not singularize units without trailing s", () => {
    expect(scaleQuantity("2 tbsp", 0.5)).toBe("1 tbsp");
  });

  it("handles a realistic scaling scenario", () => {
    // 1500 cal recipe scaled to 1000: factor = 0.667
    const factor = 1000 / 1500;
    expect(scaleQuantity("2 lbs chicken breast", factor)).toBe("1 1/4 lbs chicken breast");
    expect(scaleQuantity("3 cups rice", factor)).toBe("2 cups rice");
    expect(scaleQuantity("1/4 cup olive oil", factor)).toBe("1/4 cup olive oil");
  });
});

describe("scaleRecipePortions", () => {
  it("does nothing when calories are under the threshold", () => {
    const recipe = {
      ingredients: [{ name: "chicken", quantity: "1 lb" }],
      servings: 4,
      nutritionInfo: { calories: 600, protein: 40, fat: 20, carbs: 30 },
    };
    scaleRecipePortions(recipe);
    expect(recipe.nutritionInfo.calories).toBe(600);
    expect(recipe.servings).toBe(4);
    expect(recipe.ingredients[0].quantity).toBe("1 lb");
  });

  it("does nothing at exactly the threshold", () => {
    const recipe = {
      ingredients: [{ name: "chicken", quantity: "2 lbs" }],
      servings: 4,
      nutritionInfo: { calories: MAX_CALORIES_PER_SERVING, protein: 50, fat: 30, carbs: 40 },
    };
    scaleRecipePortions(recipe);
    expect(recipe.nutritionInfo.calories).toBe(MAX_CALORIES_PER_SERVING);
    expect(recipe.servings).toBe(4);
  });

  it("doubles servings when ×2 lands in range, leaving ingredients untouched", () => {
    // 1500 → ceil(1500/800) = 2 → 750 cal/serving
    const recipe = {
      ingredients: [
        { name: "chicken breast", quantity: "2 lbs" },
        { name: "rice", quantity: "3 cups" },
        { name: "salt", quantity: "to taste" },
      ],
      servings: 4,
      nutritionInfo: { calories: 1500, protein: 90, fat: 45, carbs: 120, fiber: 6 },
    };
    scaleRecipePortions(recipe);

    expect(recipe.nutritionInfo.calories).toBe(750);
    expect(recipe.nutritionInfo.protein).toBe(45);
    expect(recipe.nutritionInfo.fat).toBe(23);
    expect(recipe.nutritionInfo.carbs).toBe(60);
    expect(recipe.nutritionInfo.fiber).toBe(3);
    expect(recipe.servings).toBe(8);

    // Ingredient quantities are never rewritten
    expect(recipe.ingredients[0].quantity).toBe("2 lbs");
    expect(recipe.ingredients[1].quantity).toBe("3 cups");
    expect(recipe.ingredients[2].quantity).toBe("to taste");
  });

  it("triples servings when ×2 is still too high", () => {
    // 2000 → ceil(2000/800) = 3 → 667 cal/serving
    const recipe = {
      ingredients: [{ name: "chicken", quantity: "3 lbs" }],
      servings: 2,
      nutritionInfo: { calories: 2000, protein: 120, fat: 60, carbs: 80 },
    };
    scaleRecipePortions(recipe);

    expect(recipe.nutritionInfo.calories).toBe(667);
    expect(recipe.nutritionInfo.protein).toBe(40);
    expect(recipe.nutritionInfo.carbs).toBe(27);
    expect(recipe.servings).toBe(6);
    expect(recipe.ingredients[0].quantity).toBe("3 lbs");
  });

  it("scales by ×4 for very high calorie recipes", () => {
    // 2800 → ceil(2800/800) = 4 → 700 cal/serving
    const recipe = {
      ingredients: [{ name: "butter", quantity: "4 cups" }],
      servings: 1,
      nutritionInfo: { calories: 2800, protein: 10, fat: 280, carbs: 5 },
    };
    scaleRecipePortions(recipe);

    expect(recipe.nutritionInfo.calories).toBe(700);
    expect(recipe.nutritionInfo.fat).toBe(70);
    expect(recipe.servings).toBe(4);
    expect(recipe.ingredients[0].quantity).toBe("4 cups");
  });

  it("keeps scaling cleanly past the old divisor cap", () => {
    // 4000 → ceil(4000/800) = 5 → 800 cal/serving (no fractional fallback)
    const recipe = {
      ingredients: [{ name: "butter", quantity: "4 cups" }],
      servings: 2,
      nutritionInfo: { calories: 4000, protein: 10, fat: 400, carbs: 5 },
    };
    scaleRecipePortions(recipe);

    expect(recipe.nutritionInfo.calories).toBe(800);
    expect(recipe.servings).toBe(10);
    expect(recipe.ingredients[0].quantity).toBe("4 cups");
  });
});
