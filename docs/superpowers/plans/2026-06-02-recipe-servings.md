# Editable Servings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set a default servings count (applied to every generated recipe's macros, with the 1000 cal/serving cap as a hard floor) and adjust servings live inside the recipe modal to re-derive the displayed per-serving macros.

**Architecture:** A recipe is immutable (ingredients + total nutrition); servings is just a divisor. `scaleRecipePortions` gains an optional `targetServings` arg that unifies the cap with the user's default at generation time. A new pure `deriveServingNutrition` helper powers the modal's ephemeral re-derivation. The default servings preference is stored on the `users` table and read/written through `/api/auth/user`.

**Tech Stack:** Next.js (App Router), TypeScript, Drizzle ORM (Postgres, `db:push`), TanStack Query, shadcn/ui (Radix Select), Vitest + Testing Library.

> **Commits:** Per the user's standing preference, **the user handles all git commits**. Do NOT run `git commit`. Each task ends with a checkpoint listing the changed files and a suggested message for the user.

> **Spec:** `docs/superpowers/specs/2026-06-02-recipe-servings-design.md`

---

## File Structure

**Modify:**
- `src/lib/schema.ts` — add `defaultServings` column to `users`.
- `src/lib/types.ts` — add `defaultServings` to `User`; add `userPreferencesSchema`.
- `src/lib/portion-scaling.ts` — extend `scaleRecipePortions`; add `deriveServingNutrition`.
- `src/lib/storage.ts` — add `updateUserPreferences`.
- `src/app/api/auth/user/route.ts` — add `PATCH`.
- `src/lib/openai.ts` — thread `targetServings` into `generateRecipe` + both `scaleRecipePortions` calls.
- `src/app/api/recipes/generate/route.ts` — fetch user default, pass to `generateRecipe`.
- `src/app/dashboard/page.tsx` — Recipe Preferences UI in the Settings tab.
- `src/components/recipes/recipe-detail-modal.tsx` — header layout + servings dropdown + derived nutrition.

**Test (modify/create):**
- `src/test/portion-scaling.test.ts` — new cases for `scaleRecipePortions(targetServings)` and `deriveServingNutrition`.
- `src/test/components/recipes/RecipeDetailModal.test.tsx` — new smoke/structure test.

---

## Task 1: Schema + types foundation

**Files:**
- Modify: `src/lib/schema.ts:6-19` (users table)
- Modify: `src/lib/types.ts:3-12` (User interface), `:99-107` (schemas section)

- [ ] **Step 1: Add the column to the users table**

In `src/lib/schema.ts`, inside `export const users = pgTable("users", { ... })`, add `defaultServings` after `roles`:

```ts
  roles: jsonb("roles").default("[]").notNull().$type<string[]>(),
  defaultServings: integer("default_servings"), // null = "Auto" (no preference)
  createdAt: timestamp("created_at").defaultNow(),
```

(`integer` is already imported at the top of the file.)

- [ ] **Step 2: Add the field to the app-facing User interface**

In `src/lib/types.ts`, add to the `User` interface:

```ts
export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  roles: string[];
  defaultServings?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 3: Add the preferences validation schema**

In `src/lib/types.ts`, after `filterSchema` (end of file), add:

```ts
export const userPreferencesSchema = z.object({
  defaultServings: z.number().int().min(1).max(12).nullable(),
});
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 5: Push the schema to the database**

Run: `npm run db:push`
Expected: drizzle-kit reports adding the `default_servings` column. (If running non-interactively fails, the user runs this manually — note it and continue.)

- [ ] **Step 6: Checkpoint (user commits)**

Files: `src/lib/schema.ts`, `src/lib/types.ts`
Suggested message: `feat: add defaultServings user preference column + schema`

---

## Task 2: Extend `scaleRecipePortions` with `targetServings`

**Files:**
- Modify: `src/lib/portion-scaling.ts:72-99`
- Test: `src/test/portion-scaling.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/test/portion-scaling.test.ts`, inside the existing `describe("scaleRecipePortions", ...)` block, add these cases:

```ts
  it("honors a default-servings preference, dividing total nutrition (no cap interference)", () => {
    // base 2 servings @ 400 cal => 800 total; default 4 => 200 cal/serving
    const recipe = {
      ingredients: [{ name: "oats", quantity: "1 cup" }],
      servings: 2,
      nutritionInfo: { calories: 400, protein: 20, fat: 10, carbs: 50, fiber: 8 },
    };
    scaleRecipePortions(recipe, 4);
    expect(recipe.servings).toBe(4);
    expect(recipe.nutritionInfo.calories).toBe(200);
    expect(recipe.nutritionInfo.protein).toBe(10);
    expect(recipe.nutritionInfo.fat).toBe(5);
    expect(recipe.nutritionInfo.carbs).toBe(25);
    expect(recipe.nutritionInfo.fiber).toBe(4);
    expect(recipe.ingredients[0].quantity).toBe("1 cup");
  });

  it("treats the calorie cap as a hard floor when the default is too low", () => {
    // base 1 serving @ 2400 cal => 2400 total; default 1 would be 2400/serving,
    // capMin = ceil(2400/1000) = 3 => 800 cal/serving wins
    const recipe = {
      ingredients: [{ name: "butter", quantity: "2 cups" }],
      servings: 1,
      nutritionInfo: { calories: 2400, protein: 30, fat: 240, carbs: 15 },
    };
    scaleRecipePortions(recipe, 1);
    expect(recipe.servings).toBe(3);
    expect(recipe.nutritionInfo.calories).toBe(800);
    expect(recipe.ingredients[0].quantity).toBe("2 cups");
  });

  it("honors a default above the natural servings for an under-cap recipe", () => {
    // base 4 servings @ 500 cal => 2000 total; default 8 => 250 cal/serving
    const recipe = {
      ingredients: [{ name: "rice", quantity: "3 cups" }],
      servings: 4,
      nutritionInfo: { calories: 500, protein: 40, fat: 16, carbs: 60 },
    };
    scaleRecipePortions(recipe, 8);
    expect(recipe.servings).toBe(8);
    expect(recipe.nutritionInfo.calories).toBe(250);
    expect(recipe.nutritionInfo.protein).toBe(20);
  });

  it("does nothing when the default equals the natural servings", () => {
    const recipe = {
      ingredients: [{ name: "rice", quantity: "3 cups" }],
      servings: 4,
      nutritionInfo: { calories: 500, protein: 40, fat: 16, carbs: 60 },
    };
    scaleRecipePortions(recipe, 4);
    expect(recipe.servings).toBe(4);
    expect(recipe.nutritionInfo.calories).toBe(500);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/portion-scaling.test.ts`
Expected: the 4 new cases FAIL (current function ignores a 2nd argument).

- [ ] **Step 3: Rewrite `scaleRecipePortions` to accept `targetServings`**

Replace the entire function body (`src/lib/portion-scaling.ts:72-99`) with:

```ts
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
  recipeData.nutritionInfo.calories = newCalories;
  recipeData.nutritionInfo.protein = Math.round((recipeData.nutritionInfo.protein * baseServings) / effective);
  recipeData.nutritionInfo.fat = Math.round((recipeData.nutritionInfo.fat * baseServings) / effective);
  recipeData.nutritionInfo.carbs = Math.round((recipeData.nutritionInfo.carbs * baseServings) / effective);
  if (recipeData.nutritionInfo.fiber !== undefined) {
    recipeData.nutritionInfo.fiber = Math.round((recipeData.nutritionInfo.fiber * baseServings) / effective);
  }
}
```

- [ ] **Step 4: Run the full scaling test file**

Run: `npx vitest run src/test/portion-scaling.test.ts`
Expected: PASS — all new cases plus all pre-existing `scaleRecipePortions` cases (they call `scaleRecipePortions(recipe)` with no 2nd arg → `undefined == null` → unchanged path).

- [ ] **Step 5: Checkpoint (user commits)**

Files: `src/lib/portion-scaling.ts`, `src/test/portion-scaling.test.ts`
Suggested message: `feat: scaleRecipePortions honors a target servings with cap as hard floor`

---

## Task 3: Add `deriveServingNutrition` display helper

**Files:**
- Modify: `src/lib/portion-scaling.ts` (add an exported function)
- Test: `src/test/portion-scaling.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/test/portion-scaling.test.ts`, add the import and a new describe block. Update the import line at the top:

```ts
import { scaleQuantity, formatScaledQuantity, scaleRecipePortions, deriveServingNutrition, MAX_CALORIES_PER_SERVING } from "@/lib/portion-scaling";
```

Append at the end of the file:

```ts
describe("deriveServingNutrition", () => {
  const base = { calories: 600, protein: 40, fat: 20, carbs: 50, fiber: 8 };

  it("returns the same values when target equals base servings", () => {
    expect(deriveServingNutrition(base, 4, 4)).toEqual(base);
  });

  it("halves per-serving values when servings double", () => {
    expect(deriveServingNutrition(base, 4, 8)).toEqual({
      calories: 300, protein: 20, fat: 10, carbs: 25, fiber: 4,
    });
  });

  it("doubles per-serving values when servings halve", () => {
    expect(deriveServingNutrition(base, 4, 2)).toEqual({
      calories: 1200, protein: 80, fat: 40, carbs: 100, fiber: 16,
    });
  });

  it("omits fiber when the source has none", () => {
    const result = deriveServingNutrition({ calories: 400, protein: 10, fat: 5, carbs: 60 }, 2, 4);
    expect(result).toEqual({ calories: 200, protein: 5, fat: 3, carbs: 30 });
    expect(result.fiber).toBeUndefined();
  });

  it("guards against a zero target (no divide-by-zero)", () => {
    expect(deriveServingNutrition(base, 4, 0)).toEqual(base);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/portion-scaling.test.ts`
Expected: the `deriveServingNutrition` cases FAIL (function not exported / not defined).

- [ ] **Step 3: Add the function**

In `src/lib/portion-scaling.ts`, add after `scaleRecipePortions`:

```ts
// Re-derives per-serving nutrition for a different serving count WITHOUT
// mutating the recipe. Total nutrition is treated as fixed (perServing ×
// baseServings); this is the display-time layer used by the recipe modal's
// servings dropdown. Returns rounded per-serving values for the chosen count.
export function deriveServingNutrition(
  nutritionInfo: NutritionInfo,
  baseServings: number,
  targetServings: number
): NutritionInfo {
  const factor = targetServings > 0 ? baseServings / targetServings : 1;
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
```

- [ ] **Step 4: Run the test file**

Run: `npx vitest run src/test/portion-scaling.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Checkpoint (user commits)**

Files: `src/lib/portion-scaling.ts`, `src/test/portion-scaling.test.ts`
Suggested message: `feat: add deriveServingNutrition display helper`

---

## Task 4: Storage `updateUserPreferences`

**Files:**
- Modify: `src/lib/storage.ts:20-23` (IStorage interface), `:97-100` area (impl after `getUsersByRole`)

- [ ] **Step 1: Add to the IStorage interface**

In `src/lib/storage.ts`, in the `// User operations` block of `interface IStorage`, add after `getUsersByRole`:

```ts
  getUsersByRole(role: string): Promise<User[]>;
  updateUserPreferences(id: string, prefs: { defaultServings: number | null }): Promise<User | undefined>;
```

- [ ] **Step 2: Add the implementation**

In the storage class, immediately after the `getUsersByRole` method implementation (the `async getUsersByRole(...) { ... }` that returns the role query), add:

```ts
  async updateUserPreferences(id: string, prefs: { defaultServings: number | null }): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ ...prefs, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }
```

(`db`, `users`, and `eq` are already imported at the top of the file.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Checkpoint (user commits)**

Files: `src/lib/storage.ts`
Suggested message: `feat: add updateUserPreferences storage method`

---

## Task 5: `PATCH /api/auth/user`

**Files:**
- Modify: `src/app/api/auth/user/route.ts`

- [ ] **Step 1: Update imports**

In `src/app/api/auth/user/route.ts`, change the imports to include `validateRequestBody` and the schema:

```ts
import { NextRequest } from "next/server";
import { requireAuth, validateRequestBody } from "@/lib/api-auth";
import { storage } from "@/lib/storage";
import { userPreferencesSchema } from "@/lib/types";
```

- [ ] **Step 2: Add the PATCH handler**

Append after the existing `GET` function:

```ts
export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const rawBody = await request.json();
    const bodyResult = validateRequestBody(rawBody, userPreferencesSchema);

    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    const updated = await storage.updateUserPreferences(authResult.id, bodyResult);

    if (!updated) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return Response.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual verification (after dev server is up)**

With the app running and logged in, in the browser console:
```js
await fetch('/api/auth/user', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ defaultServings: 3 }) }).then(r => r.json())
```
Expected: the returned user object has `defaultServings: 3`. A `GET /api/auth/user` then reflects it; `{ defaultServings: null }` clears it.

- [ ] **Step 5: Checkpoint (user commits)**

Files: `src/app/api/auth/user/route.ts`
Suggested message: `feat: PATCH /api/auth/user to update servings preference`

---

## Task 6: Thread default servings into generation

**Files:**
- Modify: `src/lib/openai.ts:135` (signature), `:818` and `:852` (both `scaleRecipePortions` calls)
- Modify: `src/app/api/recipes/generate/route.ts:24-43`

- [ ] **Step 1: Extend the `generateRecipe` signature**

In `src/lib/openai.ts`, change the function declaration (currently `export async function generateRecipe(prompt: string, dietaryFilters: string[] = []): Promise<{`):

```ts
export async function generateRecipe(prompt: string, dietaryFilters: string[] = [], targetServings: number | null = null): Promise<{
```

(Leave the return-type body unchanged.)

- [ ] **Step 2: Pass `targetServings` at both scaling call sites**

In `src/lib/openai.ts`, the primary path (~L818) and the GPT-4o fallback path (~L852) each call `scaleRecipePortions(recipeData);`. Change **both** to:

```ts
    scaleRecipePortions(recipeData, targetServings);
```

- [ ] **Step 3: Fetch the user's default in the generate route and pass it through**

In `src/app/api/recipes/generate/route.ts`, after `const userId = authResult.id;`, add:

```ts
    const userId = authResult.id;

    const user = await storage.getUser(userId);
    const targetServings = user?.defaultServings ?? null;
```

Then update the `generateRecipe` call to pass it (currently `generateRecipe(`${prompt}\n\n${researchContext}`, dietaryFilters)`):

```ts
    const recipeData = await generateRecipe(
      `${prompt}\n\n${researchContext}`,
      dietaryFilters,
      targetServings
    );
```

(`storage` is already imported in this route.)

- [ ] **Step 4: Typecheck + run the scaling tests**

Run: `npx tsc --noEmit && npx vitest run src/test/portion-scaling.test.ts`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Set your default to e.g. 6 in the DB (or via the Task 5 PATCH), generate a recipe, and confirm the stored recipe's `servings` honors 6 (or a higher value if the calorie cap required it), with per-serving macros divided accordingly.

- [ ] **Step 6: Checkpoint (user commits)**

Files: `src/lib/openai.ts`, `src/app/api/recipes/generate/route.ts`
Suggested message: `feat: apply user default servings at recipe generation`

---

## Task 7: Recipe Preferences UI in the dashboard Settings tab

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add imports**

In `src/app/dashboard/page.tsx`, add these imports near the top (alongside the existing ones):

```ts
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
```

And add `User` to the existing types import:

```ts
import { Recipe, User } from "@/lib/types";
```

- [ ] **Step 2: Add the query, toast, and change handler**

Inside the `Dashboard` component, after the existing `useState`/`useQuery` hooks, add:

```ts
  const { toast } = useToast();

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    enabled: activeTab === "settings",
  });

  const handleDefaultServingsChange = async (value: string) => {
    const defaultServings = value === "auto" ? null : parseInt(value, 10);
    try {
      const res = await apiRequest("PATCH", "/api/auth/user", { defaultServings });
      if (!res.ok) throw new Error("Request failed");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Preference saved",
        description:
          defaultServings == null
            ? "Default servings set to Auto"
            : `New recipes will default to ${defaultServings} servings`,
      });
    } catch {
      toast({
        title: "Error saving preference",
        description: "Could not update your default servings. Please try again.",
        variant: "destructive",
      });
    }
  };
```

- [ ] **Step 3: Add the Recipe Preferences section to the Settings tab**

In the `<TabsContent value="settings">` card, inside `<div className="space-y-6">`, add this as the **first** child (before "Notification Preferences"):

```tsx
                        <div>
                          <h3 className="font-medium">Recipe Preferences</h3>
                          <p className="text-sm text-gray-500 mt-1 mb-2">
                            New recipes divide their macros to match this serving count. The
                            per-serving calorie cap still applies, so very large recipes may use
                            more servings than chosen.
                          </p>
                          <div className="flex items-center justify-between">
                            <span>Default servings</span>
                            <Select
                              value={currentUser?.defaultServings != null ? String(currentUser.defaultServings) : "auto"}
                              onValueChange={handleDefaultServingsChange}
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue placeholder="Auto (match recipe)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">Auto (match recipe)</SelectItem>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n} {n === 1 ? "serving" : "servings"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
```

- [ ] **Step 4: Add the TODO note for the placeholder toggles**

Directly above the existing `<h3 className="font-medium">Notification Preferences</h3>` line, add:

```tsx
                        {/* TODO: wire these placeholder toggles (email notifications, recipe
                            recommendations, public profile, share recipes) to real user
                            preferences — currently non-functional. */}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run the dev server, open `/dashboard`, click the **Settings** tab. Change "Default servings" → a success toast appears, the Network tab shows `PATCH /api/auth/user`, and reloading the tab keeps the chosen value (read back via `GET /api/auth/user`). Selecting "Auto" clears it.

- [ ] **Step 7: Checkpoint (user commits)**

Files: `src/app/dashboard/page.tsx`
Suggested message: `feat: default servings control in dashboard settings`

---

## Task 8: Recipe modal — layout, servings dropdown, derived nutrition

**Files:**
- Modify: `src/components/recipes/recipe-detail-modal.tsx`
- Test: `src/test/components/recipes/RecipeDetailModal.test.tsx` (create)

- [ ] **Step 1: Write the failing smoke test**

Create `src/test/components/recipes/RecipeDetailModal.test.tsx`:

```tsx
import { render, screen } from '@/test/utils'
import { RecipeDetailModal } from '@/components/recipes/recipe-detail-modal'
import type { Recipe } from '@/lib/types'

const recipe: Recipe = {
  id: 1,
  title: 'Test Bowl',
  description: 'A tasty test bowl.',
  imageUrl: null,
  ingredients: [{ name: 'rice', quantity: '2 cups' }],
  instructions: ['Cook rice.'],
  cookingTime: 30,
  servings: 4,
  dietaryTags: ['Gluten Free', 'High Protein'],
  nutritionInfo: { calories: 500, protein: 40, fat: 20, carbs: 60, fiber: 5 },
  rating: 4.5,
  ratingCount: 12,
  userId: 'u1',
  comments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  isAIGenerated: true,
  isVerified: true,
}

describe('RecipeDetailModal servings control', () => {
  it('renders allergen pills, a servings control at base servings, and base per-serving macros', () => {
    render(<RecipeDetailModal recipe={recipe} open={true} onClose={() => {}} />)
    expect(screen.getByText('Gluten Free')).toBeInTheDocument()
    expect(screen.getByLabelText('Servings')).toBeInTheDocument()
    expect(screen.getByText('4 servings')).toBeInTheDocument() // selected value in the dropdown
    expect(screen.getByText('500')).toBeInTheDocument()        // base per-serving calories
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/components/recipes/RecipeDetailModal.test.tsx`
Expected: FAIL — `getByLabelText('Servings')` not found (dropdown not built yet).

- [ ] **Step 3: Update imports and add servings state/derivation**

In `src/components/recipes/recipe-detail-modal.tsx`:

Change the React import:
```ts
import { useEffect, useState } from "react";
```

Add `Users` to the lucide-react import list (alongside `Utensils`, `UtensilsCrossed`, etc.):
```ts
  Utensils,
  UtensilsCrossed,
  Users
```

Add these imports with the other component imports:
```ts
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deriveServingNutrition } from "@/lib/portion-scaling";
```

Add state + reset effect with the other hooks (after `const [showCommentForm, ...]` and **before** `if (!recipe) return null;`):
```ts
  const [selectedServings, setSelectedServings] = useState<number>(recipe?.servings ?? 1);

  useEffect(() => {
    if (recipe) setSelectedServings(recipe.servings);
  }, [recipe?.id, open]);
```

After `if (!recipe) return null;`, add the derived values:
```ts
  const displayedNutrition = deriveServingNutrition(
    recipe.nutritionInfo,
    recipe.servings,
    selectedServings
  );
  const servingsOptions = Array.from(
    new Set([...Array.from({ length: 12 }, (_, i) => i + 1), recipe.servings])
  ).sort((a, b) => a - b);
```

- [ ] **Step 4: Replace the header row with the left/right layout + dropdown**

Replace the block currently at `src/components/recipes/recipe-detail-modal.tsx:130-147` (the `<div className="flex items-center space-x-2 text-white">...</div>` containing tags, star span, timer span) with:

```tsx
            <div className="flex items-center justify-between gap-2 text-white flex-wrap">
              {/* Allergen / dietary pills — left */}
              <div className="flex items-center gap-2 flex-wrap" data-testid="allergen-pills">
                {recipe.dietaryTags.slice(0, 3).map(tag => (
                  <Badge
                    key={tag}
                    className="bg-primary text-white text-xs px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              {/* Stars · time · servings — right */}
              <div className="flex items-center gap-3" data-testid="recipe-meta">
                <span className="flex items-center text-sm">
                  <Star className="h-4 w-4 text-yellow-400 mr-1" />
                  {recipe.rating.toFixed(1)} ({recipe.ratingCount} ratings)
                </span>
                <span className="flex items-center text-sm">
                  <Timer className="h-4 w-4 mr-1" />
                  {recipe.cookingTime} min
                </span>
                <div className="flex items-center text-sm">
                  <Users className="h-4 w-4 mr-1" />
                  <Select
                    value={String(selectedServings)}
                    onValueChange={(v) => setSelectedServings(parseInt(v, 10))}
                  >
                    <SelectTrigger
                      aria-label="Servings"
                      className="h-7 w-[7.5rem] border-white/40 bg-white/10 text-white text-sm focus:ring-white/50"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {servingsOptions.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? "serving" : "servings"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
```

- [ ] **Step 5: Use the derived nutrition in the bottom block**

In the "Nutrition Information (Per Serving)" grid (`:198-221`), replace each `recipe.nutritionInfo.*` **value** with the derived value (keep the fiber presence check on the original):

```tsx
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{displayedNutrition.calories}</span>
                <span className="text-sm text-gray-500">Calories</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{displayedNutrition.protein}g</span>
                <span className="text-sm text-gray-500">Protein</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{displayedNutrition.fat}g</span>
                <span className="text-sm text-gray-500">Fat</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{displayedNutrition.carbs}g</span>
                <span className="text-sm text-gray-500">Carbs</span>
              </div>
              {recipe.nutritionInfo.fiber !== undefined && (
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <span className="block text-lg font-medium">{displayedNutrition.fiber}g</span>
                  <span className="text-sm text-gray-500">Fiber</span>
                </div>
              )}
```

- [ ] **Step 6: Run the modal test**

Run: `npx vitest run src/test/components/recipes/RecipeDetailModal.test.tsx`
Expected: PASS.

> Note: the live re-derivation math is covered by the `deriveServingNutrition` unit tests (Task 3). The modal test is a render/structure smoke test — simulating a Radix Select change in jsdom is brittle, so it's intentionally not driven here.

- [ ] **Step 7: Manual verification**

Run the dev server, open any recipe modal. Confirm: allergen pills sit on the left; stars, time, and the servings dropdown sit on the right; changing the dropdown updates the bottom calories/macros live; closing and reopening (or opening a different recipe) resets to the recipe's stored servings.

- [ ] **Step 8: Full test run + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Checkpoint (user commits)**

Files: `src/components/recipes/recipe-detail-modal.tsx`, `src/test/components/recipes/RecipeDetailModal.test.tsx`
Suggested message: `feat: editable servings dropdown + reordered header in recipe modal`

---

## Out of scope (documented follow-ups)

- **Persisting altered servings on save** (Recommended-For-You) and **editing servings on the Saved Recipes page** — needs a per-user `servings` override column on the `favorites` table (or per-user recipe clones) plus re-derivation in `storage.getSavedRecipes`. `selectedServings` is kept as clean modal state to make this a small future addition. Deferred (Saved Recipes section not yet functional).
- **Wiring the existing placeholder settings toggles** (notifications/privacy) — TODO marked in Task 7, not implemented.
- **Retroactively re-scaling already-generated recipes** when the default changes — default bakes in at generation time only.
