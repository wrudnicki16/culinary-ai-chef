import { describe, it, expect } from "vitest";
import { DIETARY_FILTERS } from "@/lib/utils";

const ids = (group: { id: string }[]) => group.map((f) => f.id);

describe("DIETARY_FILTERS taxonomy", () => {
  it("diet type leads with the four common options then the long tail", () => {
    expect(ids(DIETARY_FILTERS.dietType).slice(0, 4)).toEqual([
      "vegetarian", "vegan", "keto", "glutenFree",
    ]);
    expect(ids(DIETARY_FILTERS.dietType)).toEqual(expect.arrayContaining([
      "highProtein", "paleo", "whole30", "pescatarian",
      "noRedMeat", "dash", "lowSodium", "diabetic",
    ]));
  });

  it("allergies are exactly the Big 9", () => {
    expect(ids(DIETARY_FILTERS.allergies)).toEqual([
      "dairy", "eggs", "peanuts", "treeNuts", "wheat",
      "soy", "fish", "shellfish", "sesame",
    ]);
  });

  it("cuisine includes mediterranean", () => {
    expect(ids(DIETARY_FILTERS.cuisines)).toContain("mediterranean");
  });

  it("meal type exists and starts with 'any'", () => {
    expect(ids(DIETARY_FILTERS.mealType)).toEqual([
      "any", "breakfast", "lunch", "dinner", "snack", "dessert",
    ]);
  });

  it("drops retired groups and items", () => {
    expect(DIETARY_FILTERS).not.toHaveProperty("health");
    expect(DIETARY_FILTERS).not.toHaveProperty("trending");
    const allIds = Object.values(DIETARY_FILTERS).flat().map((f) => f.id);
    expect(allIds).not.toContain("airFryer");
    expect(allIds).not.toContain("heartHealthy");
    expect(allIds).not.toContain("lowOxalate");
  });
});
