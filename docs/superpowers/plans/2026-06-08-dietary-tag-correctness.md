# Dietary Tag Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make recipes reliably filterable by the attributes the user selected — deterministically tag generated recipes with the canonical filter ids (diet + cuisine + allergies), and map ids → labels for display.

**Root cause (from systematic-debugging):** `dietaryTags` are written only by the LLM, which tags dietary attributes but not the selected cuisine, and uses wording that doesn't match the camelCase filter ids. The browse filter matches `dietaryTags ? <id>` exactly, so cuisines and multi-word diets can't match.

**Architecture:** A new pure module `src/lib/dietary-tags.ts` normalizes tags to canonical ids and maps ids to labels. Generation merges the requested filters into `dietaryTags` via it; display renders labels via it.

**Tech Stack:** TypeScript, Next.js, Vitest + Testing Library.

> **Commits:** user handles all commits — do NOT `git commit`; end each task with a checkpoint.

---

## File Structure
- **Create:** `src/lib/dietary-tags.ts` (+ `src/test/lib/dietary-tags-helpers.test.ts`)
- **Modify:** `src/lib/openai.ts` (merge at both return paths)
- **Modify:** `src/components/recipes/recipe-card.tsx`, `src/components/recipes/recipe-detail-modal.tsx` (display via labels) + their tests

---

## Task 1: `dietary-tags.ts` helpers

**Files:** Create `src/lib/dietary-tags.ts`; Test `src/test/lib/dietary-tags-helpers.test.ts`

- [ ] **Step 1 — failing test**

Create `src/test/lib/dietary-tags-helpers.test.ts`:

```ts
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
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/lib/dietary-tags-helpers.test.ts` → FAIL.

- [ ] **Step 3 — implement**

Create `src/lib/dietary-tags.ts`:

```ts
import { DIETARY_FILTERS } from "./utils";

// Filterable tag vocabularies (meal type is not a filterable dietary tag).
const TAG_GROUPS = [
  DIETARY_FILTERS.dietType,
  DIETARY_FILTERS.allergies,
  DIETARY_FILTERS.cuisines,
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// normalized(id OR label) -> canonical id
const ID_BY_NORM: Record<string, string> = {};
// canonical id -> label
const LABEL_BY_ID: Record<string, string> = {};
for (const group of TAG_GROUPS) {
  for (const { id, label } of group) {
    ID_BY_NORM[normalize(id)] = id;
    ID_BY_NORM[normalize(label)] = id;
    LABEL_BY_ID[id] = label;
  }
}

/** Normalize any tag string to its canonical filter id; unknown tags pass through. */
export function toDietaryTagId(tag: string): string {
  return ID_BY_NORM[normalize(tag)] ?? tag;
}

/** Map a tag (id or label-shaped) to its display label; unknown tags pass through. */
export function dietaryTagLabel(tag: string): string {
  return LABEL_BY_ID[toDietaryTagId(tag)] ?? tag;
}

/** Union of existing + requested tags, normalized to canonical ids and deduped. */
export function mergeDietaryTags(existing: string[], requested: string[]): string[] {
  return Array.from(new Set([...existing, ...requested].map(toDietaryTagId)));
}
```

- [ ] **Step 4 — run**: `npx vitest run src/test/lib/dietary-tags-helpers.test.ts` → PASS.

- [ ] **Step 5 — checkpoint (user commits)**: files above. Message: `feat: dietary-tags id/label helpers + merge`

---

## Task 2: Merge requested filters into generated tags

**Files:** Modify `src/lib/openai.ts`

- [ ] **Step 1 — wire the merge**

In `src/lib/openai.ts`:
- Add the import near the other `./` imports (e.g. next to `import { scaleRecipePortions } from "./portion-scaling";`):
```ts
import { mergeDietaryTags } from "./dietary-tags";
```
- In the **primary path**, right before `scaleRecipePortions(recipeData, targetServings);` (the first occurrence, ~line 818), add:
```ts
    recipeData.dietaryTags = mergeDietaryTags(recipeData.dietaryTags, dietaryFilters);
```
- In the **GPT-4o fallback path**, right before the second `scaleRecipePortions(recipeData, targetServings);` (~line 852), add the same line:
```ts
        recipeData.dietaryTags = mergeDietaryTags(recipeData.dietaryTags, dietaryFilters);
```
(`dietaryFilters` is the function parameter, in scope in both paths.)

- [ ] **Step 2 — verify**

Run `npx tsc --noEmit 2>&1 | grep -i "openai.ts" || echo clean` (expect clean) and `npx vitest run src/test/lib/dietary-tags-helpers.test.ts` (still pass).
Also confirm exactly two merge call sites: `grep -n "mergeDietaryTags" src/lib/openai.ts` → 1 import + 2 calls.

- [ ] **Step 3 — checkpoint (user commits)**: `src/lib/openai.ts`. Message: `fix: tag generated recipes with the requested dietary filters`

---

## Task 3: Display tags as labels

**Files:** Modify `src/components/recipes/recipe-card.tsx`, `src/components/recipes/recipe-detail-modal.tsx`; update their tests if present.

- [ ] **Step 1 — recipe card**

In `src/components/recipes/recipe-card.tsx`:
- Add `import { dietaryTagLabel } from "@/lib/dietary-tags";`.
- The dietary-tag pills currently do `recipe.dietaryTags.slice(0, 2).map((tag) => <Badge ... className={cn(... tag === "High Protein" && ..., tag === "Vegetarian" && ..., ...)}>{tag}</Badge>)`. Change it to compute the label once and key both the text and the color classes off the label:
```tsx
            {recipe.dietaryTags.slice(0, 2).map((tag) => {
              const label = dietaryTagLabel(tag);
              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    label === "High Protein" && "bg-primary-100 text-primary-800",
                    label === "Vegetarian" && "bg-blue-100 text-blue-800",
                    label === "Vegan" && "bg-purple-100 text-purple-800",
                    label === "Gluten-Free" && "bg-green-100 text-green-800",
                    label === "Heart Healthy" && "bg-red-100 text-red-800",
                    label === "Low Carb" && "bg-yellow-100 text-yellow-800",
                  )}
                >
                  {label}
                </Badge>
              );
            })}
```
(Note: the color labels now use the canonical labels — e.g. "Gluten-Free" with the hyphen, matching `DIETARY_FILTERS`. Keep the existing `+N` overflow badge below it unchanged.)

- [ ] **Step 2 — recipe modal**

In `src/components/recipes/recipe-detail-modal.tsx`:
- Add `import { dietaryTagLabel } from "@/lib/dietary-tags";`.
- The allergen/dietary pills render `recipe.dietaryTags.slice(0, 3).map(tag => <Badge key={tag} ...>{tag}</Badge>)`. Change the rendered text to `{dietaryTagLabel(tag)}` (keep `key={tag}`).

- [ ] **Step 3 — tests**

Run `npx vitest run 2>&1 | tail -4`. The existing `RecipeCard.test.tsx` asserts dietary tags display: it uses `mockRecipe.dietaryTags`. If `mockRecipe.dietaryTags` contains label-shaped values (e.g. "Vegetarian"), `dietaryTagLabel` returns the same label, so assertions still pass. If it contains an id that now renders as a different label, update that assertion to the mapped label. Make only the minimal change needed and report it. Add one assertion to `RecipeCard.test.tsx` that an id-form tag renders as its label, e.g. render a recipe whose `dietaryTags` includes `"italian"` and assert `screen.getByText("Italian")` is present.

- [ ] **Step 4 — verify**: `npx tsc --noEmit 2>&1 | grep -vE "src/test/" | grep -iE "error TS" || echo "no non-test type errors"`; full suite green.

- [ ] **Step 5 — checkpoint (user commits)**: files above. Message: `feat: display dietary tags as labels`

---

## Out of scope
- Backfilling existing recipes' tags (we don't store which filters they were generated with).
- Tolerant matching on the query side for legacy label tags (new recipes store ids; sidebar sends ids).
