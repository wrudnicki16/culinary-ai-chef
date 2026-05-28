# Edamam Nutrition API Integration

## Summary

Replace OpenAI's LLM-estimated nutrition data with real nutrition data from the Edamam Nutrition Analysis API. OpenAI continues generating recipes (title, ingredients, instructions, etc.) but Edamam becomes the primary source for `nutritionInfo`. If Edamam is unavailable, fall back to OpenAI's estimate.

## Architecture

### New module: `src/lib/edamam.ts`

A self-contained wrapper around Edamam's Nutrition Analysis API.

**Exports:**
- `analyzeNutritionWithEdamam(ingredients: Ingredient[], servings: number): Promise<NutritionInfo | null>` — returns `NutritionInfo` on success, `null` on any failure.

**Behavior:**
- Converts `Ingredient[]` (e.g. `{name: "chicken breast", quantity: "1 lb"}`) into ingredient line strings that Edamam parses natively (e.g. `"1 lb chicken breast"`).
- Calls Edamam Nutrition Analysis API (`POST https://api.edamam.com/api/nutrition-details`) with the ingredient list. This endpoint accepts a full recipe's ingredients and returns total nutrition for the batch.
- Maps Edamam's response to the existing `NutritionInfo` shape: `{calories, protein, fat, carbs}`.
- Divides totals by `servings` to return per-serving values.
- Returns `null` silently if `EDAMAM_APP_ID` / `EDAMAM_APP_KEY` env vars are missing (intentional opt-out).
- Returns `null` with `console.warn` on API errors, rate limits, network failures, or malformed responses.
- No retries — fallback to OpenAI is sufficient.

### Integration point: `src/lib/openai.ts`

**`generateRecipe()`:**
After OpenAI returns the recipe JSON, call Edamam:
```ts
const edamamNutrition = await analyzeNutritionWithEdamam(recipeData.ingredients, recipeData.servings);
if (edamamNutrition) {
  recipeData.nutritionInfo = edamamNutrition;
}
```

The LLM prompt is simplified — remove the extensive "registered dietitian" nutrition instructions. Keep the `nutritionInfo` field in the JSON schema so the LLM returns a basic estimate (used as fallback), but strip the detailed reference tables and calorie validation logic.

**`analyzeRecipeNutrition()`:**
Same pattern — call Edamam first, fall back to the existing LLM-based analysis if Edamam returns `null`.

### Environment variables

Two new optional env vars:
- `EDAMAM_APP_ID` — Edamam application ID
- `EDAMAM_APP_KEY` — Edamam application key

Added to `.env.example`. When not set, Edamam is skipped and OpenAI estimates are used. Same optional-integration pattern as Together AI and Braintrust.

Free tier: 100 requests/day (one call per recipe generation).

## Data flow

```
User prompt
  -> OpenAI generates recipe (title, ingredients, instructions, basic nutrition estimate)
  -> Edamam receives ingredient list, returns real nutrition
  -> If Edamam succeeds: replace nutritionInfo with Edamam data
  -> If Edamam fails: keep OpenAI's estimate, log console.warn
  -> Recipe saved to database with nutritionInfo (source-agnostic)
```

## Error handling

| Scenario | Behavior |
|----------|----------|
| Env vars missing | Return `null`, no warning (opt-out) |
| API error (rate limit, 5xx, network) | Return `null`, `console.warn` with error |
| Malformed response | Return `null`, `console.warn` |
| Edamam returns `null` in caller | Keep OpenAI's nutrition estimate |

No retries. No circuit breaker. The fallback is fast and good enough.

## Types

`NutritionInfo` is extended with an optional `fiber` field:
```ts
export interface NutritionInfo {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number; // grams, from Edamam
}
```

The field is optional so existing recipes without fiber data remain valid. Edamam provides fiber natively (`FIBTG` in their response). The OpenAI fallback estimate can also include fiber since it's a single additional field.

## What changes

- **New file:** `src/lib/edamam.ts` — Edamam API wrapper
- **Modified:** `src/lib/openai.ts` — call Edamam in `generateRecipe()` and `analyzeRecipeNutrition()`, simplify nutrition prompts
- **Modified:** `.env.example` — add `EDAMAM_APP_ID` and `EDAMAM_APP_KEY`
- **New tests:** `src/test/edamam.test.ts` — unit tests for the Edamam module

## Testing

**`src/test/edamam.test.ts`:**
- Maps Edamam response to `NutritionInfo` correctly
- Returns `null` when env vars missing
- Returns `null` and warns on API errors
- Formats ingredient strings correctly (`quantity + name`)

**Existing tests:**
- Mock the Edamam module so recipe generation tests don't hit the real API

## Out of scope

- Backfilling existing recipes (designed to be easy later — call `analyzeNutritionWithEdamam` with stored ingredients)
- Full micronutrient data (vitamins, minerals beyond fiber)
- Nutrition source indicator on recipes
- Caching Edamam responses
