# Editable Servings — Default Preference + Per-Recipe Modal Control

**Date:** 2026-06-02
**Status:** Approved design, pending implementation plan

## Summary

Two features built on one idea, continuing the existing `scaleRecipePortions` work:
a recipe is **immutable** (ingredients + total nutrition); the **servings count is just a
divisor**. Changing servings only re-derives the per-serving macros shown to the user — it
never rewrites ingredient quantities.

1. **Default servings preference** (settings) — a per-user "default servings" set on the
   dashboard Settings tab. Every recipe adjusts its per-serving macros to this number at
   generation time, with the 1000 cal/serving cap acting as a hard floor.
2. **Per-recipe servings dropdown** (recipe modal) — an editable dropdown in the recipe
   detail modal that live-updates the displayed calories/macros. Ephemeral (view-only) this
   iteration. The modal header is also rearranged: allergen pills left; stars, time, and the
   new dropdown right.

## The shared math

Stored `nutritionInfo` is **per serving**, so the recipe's total is:

```
total(macro) = perServing(macro) × baseServings
```

For any chosen serving count `N`, the displayed per-serving value is:

```
displayedPerServing(macro) = round( perServing(macro) × baseServings / N )
```

The calorie cap (`MAX_CALORIES_PER_SERVING = 1000`) becomes a **hard floor on N**:

```
capMin = ceil( total(calories) / MAX_CALORIES_PER_SERVING )
effectiveServings = max( chosenN, capMin )
```

This is why "cap is a hard ceiling" was chosen for cap-vs-default: a low default can never
push a serving over 1000 cal — it gets bumped up to `capMin`.

## Feature A — Default servings preference

### Schema (`src/lib/schema.ts`)
Add a nullable column to the `users` table:

```ts
defaultServings: integer("default_servings"), // null = "Auto" (no preference)
```

`null` / "Auto" means **no preference** → current behavior (the cap-only path) is used.
Applied via `npm run db:push` (uses drizzle-kit push; **run by the user**, not by the agent,
since it touches the database).

### Types (`src/lib/types.ts`)
Add to the `User` interface:

```ts
defaultServings?: number | null;
```

### Storage (`src/lib/storage.ts`)
Add a focused partial-update method (`upsertUser` requires a full row, so it's unsuitable):

```ts
updateUserPreferences(id: string, prefs: { defaultServings: number | null }): Promise<User>
// db.update(users).set({ ...prefs, updatedAt: new Date() }).where(eq(users.id, id)).returning()
```

Add it to the `IStorage` interface alongside the other user methods.

### API (`src/app/api/auth/user/route.ts`)
- `GET` already returns the full user (via `storage.getUser`), so `defaultServings` surfaces
  automatically once the column exists. No change needed for reads.
- Add `PATCH` to the same route for self-service preference updates. Validate with a new
  `userPreferencesSchema` in `src/lib/types.ts`:

```ts
export const userPreferencesSchema = z.object({
  defaultServings: z.number().int().min(1).max(12).nullable(),
});
```

  Handler: `requireAuth` → `validateRequestBody` → `storage.updateUserPreferences(userId, body)`.

### Settings UI (`src/app/dashboard/page.tsx`, Settings tab)
In the existing "Account Settings" card (currently Notification Preferences / Privacy /
Danger Zone, all placeholder buttons), add a **"Recipe Preferences"** section **above**
Notification Preferences:

- A shadcn `Select` (`src/components/ui/select.tsx`) labeled "Default servings", options:
  **`Auto (match recipe)`** (value → `null`) plus **`1`–`8`**.
- Reads the current value with react-query (`GET /api/auth/user`).
- On change, `PATCH /api/auth/user` with the new value, then a success toast and query
  invalidation. (Saves immediately — no separate save button, matching the lightweight feel.)
- Add a `TODO` comment noting the existing placeholder toggles (Email notifications, Recipe
  recommendations, Public profile, Share my recipes) still need to be wired up later.

### Generation / scaling
Thread the user's default through the existing generation path:

- `src/app/api/recipes/generate/route.ts`: after auth, `const user = await storage.getUser(userId)`
  and pass `user?.defaultServings ?? null` into `generateRecipe(...)` as a new 3rd argument.
- `src/lib/openai.ts`: extend `generateRecipe(prompt, dietaryFilters = [], targetServings: number | null = null)`
  and pass `targetServings` to both `scaleRecipePortions(recipeData, targetServings)` call
  sites (primary ~L818 and fallback ~L852).
- `src/lib/portion-scaling.ts`: extend `scaleRecipePortions(recipeData, targetServings?: number | null)`:
  - Compute `total = perServing × baseServings` for each macro (calories, protein, fat, carbs,
    fiber?).
  - `capMin = currentCalories > MAX_CALORIES_PER_SERVING ? ceil(total.calories / MAX_CALORIES_PER_SERVING) : baseServings`.
  - If `targetServings == null`: **behavior unchanged** — keep the existing cap-only logic
    (integer-multiple of base, targeting `CALORIE_TARGET_MAX = 800`). Existing tests must pass
    untouched.
  - If `targetServings != null`: `effective = max(targetServings, capMin, 1)`; set
    `recipeData.servings = effective` and each macro to `round(total(macro) / effective)`.
  - Keep the existing console.log style for observability.

## Feature B — Recipe modal servings dropdown + layout

File: `src/components/recipes/recipe-detail-modal.tsx`.

### Layout (header row over the image)
Today the dietary/allergen pills, star rating, and cook time share one left-packed
`flex items-center space-x-2` row. Change to a two-group split:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Vegan] [Gluten-Free] [Dairy-Free]     ★ 4.8 (32)  ⏱ 30m  👥 [4 ▾] │
│   └─ allergen pills (left) ─┘            └─ stars · time · servings (right) ─┘
└─────────────────────────────────────────────────────────────────┘
```

- Outer row: `flex items-center justify-between gap-2 text-white` (wrap gracefully on narrow
  widths).
- Left group: the `recipe.dietaryTags.slice(0, 3)` badges (the "allergen pills").
- Right group: `flex items-center gap-3` containing the star span, the timer span, and the
  new servings `Select` (with a `Users` icon to match the recipe card's servings affordance).

### Servings dropdown behavior (ephemeral)
- State: `selectedServings`, initialized to `recipe.servings`; reset via `useEffect` keyed on
  `recipe?.id` so switching recipes restores the stored value.
- Options: `1`–`12`, always including the recipe's base `servings` (extend the range if base
  > 12). Default selected = `recipe.servings`.
- The bottom "Nutrition Information (Per Serving)" block derives each displayed number live:
  `round(recipe.nutritionInfo[macro] * recipe.servings / selectedServings)` (calories,
  protein, fat, carbs, and fiber when present). The "(Per Serving)" heading stays.
- **Ephemeral**: nothing is persisted; the dropdown styling sits on the modal's local state
  only. Closing/reopening or switching recipes shows the stored servings again.

### Forward-compatibility seam (no implementation now)
`selectedServings` is kept as clean local state so a future "save with altered servings" can
read it. See Out of Scope.

## Out of scope (documented follow-ups)

- **Persisting altered servings on save** (from Recommended-For-You) and **editing servings on
  the Saved Recipes page**. Requires a `servings` (per-user override) column on the `favorites`
  table — or cloning the recipe per user — plus re-derivation in `storage.getSavedRecipes` and
  a save action in the modal. Deferred: the Saved Recipes section isn't functional yet, and
  this iteration was scoped to "ephemeral only."
- **Wiring the existing placeholder settings toggles** (notifications, privacy, etc.) — marked
  with a TODO but not implemented here.
- **Retroactively re-scaling already-generated recipes** when a user changes their default.
  The default bakes in at generation time only.

## Testing

- `src/test/portion-scaling.test.ts`: existing `scaleRecipePortions` tests must still pass
  (the `targetServings == null` path is unchanged). Add cases for the new arg:
  - default below `capMin` → bumped to `capMin` (cap-as-ceiling).
  - default above natural servings → honored, per-serving macros divided correctly.
  - default with an under-cap recipe → honored (no cap interference).
  - macro totals are preserved across re-derivation (no drift beyond rounding).
- Modal: a lightweight test that changing `selectedServings` updates the derived calorie/macro
  display and that the header renders pills left / stars+time+dropdown right.
```
