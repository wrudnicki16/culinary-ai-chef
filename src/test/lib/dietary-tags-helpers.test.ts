import { describe, it, expect } from "vitest";
import { toDietaryTagId, dietaryTagLabel, mergeDietaryTags } from "@/lib/dietary-tags";

describe("toDietaryTagId", () => {
  it("normalizes labels and casing to the canonical id", () => {
    expect(toDietaryTagId("Italian")).toBe("italian");
    expect(toDietaryTagId("italian")).toBe("italian");
    expect(toDietaryTagId("High Protein")).toBe("highProtein");
    expect(toDietaryTagId("gluten-free")).toBe("glutenFree");
    expect(toDietaryTagId("Gluten-Free")).toBe("glutenFree");
  });
  it("passes unknown tags through unchanged", () => {
    expect(toDietaryTagId("Contains Allergens")).toBe("Contains Allergens");
  });
});

describe("dietaryTagLabel", () => {
  it("maps an id to its display label", () => {
    expect(dietaryTagLabel("italian")).toBe("Italian");
    expect(dietaryTagLabel("highProtein")).toBe("High Protein");
  });
  it("maps a label-shaped tag to the canonical label", () => {
    expect(dietaryTagLabel("Italian")).toBe("Italian");
  });
  it("passes unknown tags through unchanged", () => {
    expect(dietaryTagLabel("Contains Allergens")).toBe("Contains Allergens");
  });
});

describe("mergeDietaryTags", () => {
  it("adds requested filter ids and dedupes after normalizing", () => {
    expect(mergeDietaryTags(["vegetarian"], ["vegetarian", "italian"]).sort())
      .toEqual(["italian", "vegetarian"]);
  });
  it("does not duplicate a label-cased existing tag with its id", () => {
    expect(mergeDietaryTags(["Vegetarian"], ["italian"]).sort())
      .toEqual(["italian", "vegetarian"]);
  });
  it("keeps unknown LLM tags", () => {
    expect(mergeDietaryTags(["Contains Allergens"], ["italian"]))
      .toEqual(expect.arrayContaining(["Contains Allergens", "italian"]));
  });
});
