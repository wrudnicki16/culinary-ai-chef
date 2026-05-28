# Edamam Nutrition API Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace LLM-estimated nutrition data with real data from the Edamam Nutrition Analysis API, with graceful fallback to OpenAI estimates.

**Architecture:** New `src/lib/edamam.ts` module wraps the Edamam API and returns `NutritionInfo | null`. Called from `generateRecipe()` and `analyzeRecipeNutrition()` in `openai.ts` after OpenAI generates the recipe. Returns `null` on any failure; callers keep the OpenAI estimate.

**Tech Stack:** Edamam Nutrition Analysis API (POST /api/nutrition-details), TypeScript, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/edamam.ts` | Create | Edamam API wrapper — format ingredients, call API, map response to `NutritionInfo` |
| `src/lib/types.ts` | Modify | Add optional `fiber` field to `NutritionInfo` |
| `src/lib/schema.ts` | Modify | Add `fiber` to the `nutritionInfo` jsonb type |
| `src/lib/openai.ts` | Modify | Call Edamam after recipe generation, simplify nutrition prompts, add fiber to sanitizer |
| `src/components/recipes/recipe-detail-modal.tsx` | Modify | Display fiber when present |
| `.env.example` | Modify | Add `EDAMAM_APP_ID` and `EDAMAM_APP_KEY` |
| `src/test/edamam.test.ts` | Create | Unit tests for the Edamam module |

---

### Task 1: Add `fiber` to `NutritionInfo` type and DB schema

**Files:**
- Modify: `src/lib/types.ts:19-24`
- Modify: `src/lib/schema.ts:76`

- [ ] **Step 1: Update `NutritionInfo` interface in `types.ts`**

In `src/lib/types.ts`, change the `NutritionInfo` interface:

```ts
export interface NutritionInfo {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
}
```

- [ ] **Step 2: Update the jsonb type in `schema.ts`**

In `src/lib/schema.ts` line 76, update the `$type` to include fiber:

```ts
  nutritionInfo: jsonb("nutrition_info").notNull().$type<{ calories: number, protein: number, fat: number, carbs: number, fiber?: number }>(),
```

- [ ] **Step 3: Run type check to confirm no breakage**

Run: `npx tsc --noEmit`
Expected: No errors (fiber is optional, so all existing code compiles)

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/schema.ts
git commit -m "feat: add optional fiber field to NutritionInfo"
```

---

### Task 2: Create `src/lib/edamam.ts` — tests first

**Files:**
- Create: `src/test/edamam.test.ts`
- Create: `src/lib/edamam.ts`

- [ ] **Step 1: Write the test file**

Create `src/test/edamam.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We'll mock global fetch; env vars are controlled per test
const MOCK_EDAMAM_RESPONSE = {
  calories: 812,
  totalNutrients: {
    PROCNT: { label: 'Protein', quantity: 62.4, unit: 'g' },
    FAT: { label: 'Fat', quantity: 30.1, unit: 'g' },
    CHOCDF: { label: 'Carbs', quantity: 78.5, unit: 'g' },
    FIBTG: { label: 'Fiber', quantity: 6.2, unit: 'g' },
  },
}

const TEST_INGREDIENTS = [
  { name: 'chicken breast', quantity: '1 lb' },
  { name: 'rice', quantity: '2 cups' },
  { name: 'olive oil', quantity: '2 tbsp' },
]

describe('analyzeNutritionWithEdamam', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      EDAMAM_APP_ID: 'test-app-id',
      EDAMAM_APP_KEY: 'test-app-key',
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('returns null when env vars are missing', async () => {
    delete process.env.EDAMAM_APP_ID
    delete process.env.EDAMAM_APP_KEY
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)
    expect(result).toBeNull()
  })

  it('formats ingredient strings as "quantity name"', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_EDAMAM_RESPONSE), { status: 200 })
    )
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body.ingr).toEqual([
      '1 lb chicken breast',
      '2 cups rice',
      '2 tbsp olive oil',
    ])
  })

  it('maps Edamam response to NutritionInfo with per-serving values', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_EDAMAM_RESPONSE), { status: 200 })
    )
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    expect(result).toEqual({
      calories: Math.round(812 / 4),
      protein: Math.round(62.4 / 4),
      fat: Math.round(30.1 / 4),
      carbs: Math.round(78.5 / 4),
      fiber: Math.round(6.2 / 4),
    })
  })

  it('returns null and warns on API error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Rate limit exceeded', { status: 429 })
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Edamam API error')
    )
  })

  it('returns null and warns on network failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Edamam API error')
    )
  })

  it('returns null and warns on malformed response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ unexpected: 'shape' }), { status: 200 })
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Edamam API error')
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/edamam.test.ts`
Expected: FAIL — `@/lib/edamam` does not exist

- [ ] **Step 3: Create the Edamam module**

Create `src/lib/edamam.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/edamam.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/edamam.ts src/test/edamam.test.ts
git commit -m "feat: add Edamam nutrition API module with tests"
```

---

### Task 3: Integrate Edamam into `generateRecipe()` and simplify nutrition prompts

**Files:**
- Modify: `src/lib/openai.ts:1-57` (imports, sanitizer)
- Modify: `src/lib/openai.ts:130-831` (generateRecipe function)
- Modify: `src/lib/openai.ts:908-1145` (analyzeRecipeNutrition function)

- [ ] **Step 1: Add import and update `sanitizeRecipeData` in `openai.ts`**

At the top of `src/lib/openai.ts`, add the import:

```ts
import { analyzeNutritionWithEdamam } from "./edamam";
```

Update `sanitizeRecipeData` to handle `fiber`:

```ts
function sanitizeRecipeData(data: any): any {
  data.cookingTime = extractNumber(data.cookingTime);
  data.servings = Math.max(1, Math.round(extractNumber(data.servings)));
  if (data.nutritionInfo && typeof data.nutritionInfo === "object") {
    data.nutritionInfo.calories = extractNumber(data.nutritionInfo.calories);
    data.nutritionInfo.protein = extractNumber(data.nutritionInfo.protein);
    data.nutritionInfo.fat = extractNumber(data.nutritionInfo.fat);
    data.nutritionInfo.carbs = extractNumber(data.nutritionInfo.carbs);
    if (data.nutritionInfo.fiber !== undefined) {
      data.nutritionInfo.fiber = extractNumber(data.nutritionInfo.fiber);
    }
  }
  return data;
}
```

- [ ] **Step 2: Add Edamam call at the end of `generateRecipe()`**

In `generateRecipe()`, just before the final `return` (around line 798), add the Edamam call:

```ts
    // Replace LLM nutrition estimate with Edamam data when available
    const edamamNutrition = await analyzeNutritionWithEdamam(
      recipeData.ingredients,
      recipeData.servings
    );
    if (edamamNutrition) {
      recipeData.nutritionInfo = edamamNutrition;
    }

    return {
      ...recipeData,
      imageUrl
    };
```

This goes right after the image generation block and before the existing `return { ...recipeData, imageUrl }` statement. Replace that return with the block above.

- [ ] **Step 3: Simplify the nutrition prompt in the LLM system messages**

In `generateRecipe()`, there are 4 system prompts that ask the LLM to include `nutritionInfo` (around lines 349, 399, 450, 600). In each one, keep the JSON schema with `nutritionInfo` (so the LLM still returns a rough estimate as fallback) but the detailed nutrition instructions are no longer needed since Edamam handles accuracy.

The JSON schema block in each prompt stays unchanged:
```json
"nutritionInfo": {
  "calories": number,
  "protein": number in grams,
  "fat": number in grams,
  "carbs": number in grams
}
```

What to remove from the system role text: the phrase "and nutritionist" from "professional chef and nutritionist" (keep "professional chef"). The LLM prompt no longer needs to emphasize nutrition accuracy — it just needs to return a rough estimate in the schema.

- [ ] **Step 4: Update `analyzeRecipeNutrition()` to try Edamam first**

Replace the beginning of `analyzeRecipeNutrition()` (line 908+) to try Edamam before falling back to the LLM:

```ts
export async function analyzeRecipeNutrition(
  ingredients: Ingredient[],
  servings: number = 4
): Promise<NutritionInfo> {
  // Try Edamam first
  const edamamResult = await analyzeNutritionWithEdamam(ingredients, servings);
  if (edamamResult) {
    return edamamResult;
  }

  // Fall back to LLM-based analysis
  const { client: nutritionClient, model: nutritionModel } = getRecipeClient();
  // ... rest of existing LLM logic unchanged
```

- [ ] **Step 5: Remove the calorie sanity-check block from `analyzeRecipeNutrition()`**

Lines 1009-1113 contain extensive manual calorie math validation (the `calculatedCalories` check, the `hasProteinSource` loop, the `estimatedMinimumCalories` logic). With Edamam as the primary source, this safety net is only relevant for the LLM fallback path. Keep it for the fallback but it can be simplified — remove the large ingredient-by-ingredient estimation loop (lines 1026-1113) since Edamam handles accuracy. Keep only the macro cross-check (lines 1009-1020).

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (existing tests use mocked fetch, Edamam import is new but doesn't break anything)

- [ ] **Step 8: Commit**

```bash
git add src/lib/openai.ts
git commit -m "feat: integrate Edamam nutrition into recipe generation with OpenAI fallback"
```

---

### Task 4: Display fiber in the recipe detail modal

**Files:**
- Modify: `src/components/recipes/recipe-detail-modal.tsx:196-215`

- [ ] **Step 1: Add fiber display to the nutrition grid**

In `src/components/recipes/recipe-detail-modal.tsx`, find the nutrition grid (lines 198-215). Change from `grid-cols-2 sm:grid-cols-4` to `grid-cols-2 sm:grid-cols-5` and add a fiber column after carbs:

```tsx
          <div className="mb-6">
            <h3 className="font-heading font-semibold mb-2">Nutrition Information (Per Serving)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{recipe.nutritionInfo.calories}</span>
                <span className="text-sm text-gray-500">Calories</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{recipe.nutritionInfo.protein}g</span>
                <span className="text-sm text-gray-500">Protein</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{recipe.nutritionInfo.fat}g</span>
                <span className="text-sm text-gray-500">Fat</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{recipe.nutritionInfo.carbs}g</span>
                <span className="text-sm text-gray-500">Carbs</span>
              </div>
              {recipe.nutritionInfo.fiber !== undefined && (
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <span className="block text-lg font-medium">{recipe.nutritionInfo.fiber}g</span>
                  <span className="text-sm text-gray-500">Fiber</span>
                </div>
              )}
            </div>
          </div>
```

The grid uses `sm:grid-cols-5` when fiber is present. Old recipes without fiber gracefully hide the column via the conditional render.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/recipes/recipe-detail-modal.tsx
git commit -m "feat: display fiber in recipe nutrition info"
```

---

### Task 5: Update `.env.example` and test utils

**Files:**
- Modify: `.env.example`
- Modify: `src/test/utils.tsx:111-116`

- [ ] **Step 1: Add Edamam env vars to `.env.example`**

Add at the end of `.env.example`:

```
# Edamam Nutrition Analysis API (optional)
# When set, recipe nutrition data comes from Edamam instead of LLM estimates
# Sign up at https://developer.edamam.com/edamam-nutrition-api
EDAMAM_APP_ID=your-edamam-app-id
EDAMAM_APP_KEY=your-edamam-app-key
```

- [ ] **Step 2: Update mock recipe data in test utils**

In `src/test/utils.tsx`, update the `mockRecipe.nutritionInfo` to optionally include fiber so tests reflect the new type:

```ts
  nutritionInfo: {
    calories: 200,
    protein: 5,
    fat: 2,
    carbs: 40,
    fiber: 3,
  },
```

- [ ] **Step 3: Run all tests to confirm nothing breaks**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add .env.example src/test/utils.tsx
git commit -m "feat: add Edamam config to env example and update test fixtures"
```

---

### Task 6: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Generate a recipe without Edamam keys**

Generate a recipe through the UI. Confirm it still works — nutrition data comes from OpenAI as before. Check the server console: no Edamam warnings (env vars not set = silent skip).

- [ ] **Step 3: Add Edamam keys and generate a recipe**

Add real `EDAMAM_APP_ID` and `EDAMAM_APP_KEY` to `.env.local`, restart the dev server, and generate a recipe. Confirm:
- Nutrition values appear and look reasonable
- Fiber is displayed in the recipe detail modal
- Server console shows no Edamam warnings

- [ ] **Step 4: Test fallback by using invalid keys**

Set `EDAMAM_APP_KEY=invalid` in `.env.local`, restart, and generate a recipe. Confirm:
- Recipe still generates successfully
- Server console shows `Edamam API error: 401 Unauthorized` warning
- Nutrition falls back to OpenAI estimates (no fiber shown since LLM doesn't return it by default)
