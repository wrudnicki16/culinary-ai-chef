# Home Page Redesign — Phase 1 (Generation Modes + Filter Relocation)

**Date:** 2026-06-04
**Status:** Approved design, pending implementation plan

## Context

The home page mixes two unrelated jobs — *generate a recipe* and *browse/filter recommendations* — and the dietary filters appear in 3–4 places (left sidebar, an in-card filter tab-strip, an "Active filters" chip, and an "Applied filters" line), all looking identical but behaving differently (the sidebar is Apply-gated, the generator's filters are instant and independent). Users can't tell which control does what, and the generator card itself (`RecipeGenerator`, ~747 lines) bundles a free-text mode, a random "Feeling Lucky" mode, a filter UI, and three dialogs.

This redesign makes each use case its own clear surface: a **guided ("autopilot") generation modal**, a **simple free-text generation box**, and a **browse/filter section** that visibly owns the Recommended list. The standalone search page is **Phase 2** (separate spec).

## Goals

- Two distinct, legible ways to create a recipe: guided pills vs. pure free text.
- Move browse filtering (sidebar + active-filter pill) down to sit with the Recommended list it controls.
- Decompose the oversized `RecipeGenerator` into focused components.
- A more compact home page with one clear section per use case.

## Component Architecture

Replace the monolithic `RecipeGenerator` with three focused units:

- **`GuidedRecipeModal`** (`src/components/recipes/guided-recipe-modal.tsx`) — the "Build your recipe" modal. Owns selection state (diet, cuisine, meal type, allergies), renders the sections with Load-more, and the sticky footer. Calls a passed-in `onGenerate(prompt, dietaryFilters)`.
- **`CustomRecipePrompt`** (`src/components/recipes/custom-recipe-prompt.tsx`) — the free-text textarea + `→` submit button. Calls `onGenerate(text, [])`.
- **`RecipeCreator`** (`src/components/recipes/recipe-creator.tsx`, replaces `RecipeGenerator`) — the "Create a recipe" card. Hosts the guided entry button → `— OR —` → `CustomRecipePrompt`, owns the single `generate()` implementation both modes call (the existing POST `/api/recipes/generate` + loading modal + query invalidation), and hosts the preserved dialogs (protein, contradiction).

`page.tsx` swaps `<RecipeGenerator>` for `<RecipeCreator>`.

## Two Generation Modes

Both funnel into one `generate(prompt, dietaryFilters)` (today's logic in `RecipeGenerator.proceedWithGeneration`, lifted into `RecipeCreator`).

**Guided modal:**
- Sections: **Diet type**, **Cuisine**, **Meal type** (single-select radio, default "Any"), **Allergies**.
- On generate, synthesize a readable prompt from selections, e.g. `"Generate a keto, Mediterranean dinner recipe. Must be peanut-free and dairy-free."`, and pass the selected filter ids as `dietaryFilters` (same array the current flow sends).
- **Footer:** 0 selections → button reads **"Surprise me 🎲"** and sends the existing random "Feeling Lucky" prompt with `dietaryFilters: []`; 1+ selections → **"Generate recipe."** A "X selected · Clear" summary sits on the left.
- Preserves: contradiction detection (`detectContradictoryFilters`) runs on the selections and shows the existing warning dialog before generating; the High-Protein personalization dialog triggers when the High-Protein pill is selected.

**Custom free-text:**
- A textarea ("Describe what you'd like to make — ingredients, cuisine, presentation, constraints…") + a `→` icon button.
- Sends the raw text as the prompt with `dietaryFilters: []`. No pills.

**Retired:** the "Feeling Lucky" tab and the in-card filter tab-strip (their roles move into the modal's empty-state and the modal's sections, respectively).

## Filter Taxonomy (`DIETARY_FILTERS` in `src/lib/utils.ts`)

Restructure to four consumer groups (ids follow the existing camelCase convention; labels below):

- **`dietType`** (ordered; modal shows the first 4, rest behind Load-more):
  - Initial: Vegetarian, Vegan, Keto, Gluten-Free
  - Load-more: High Protein, Paleo, Low Carb, Whole30, Pescatarian, No Red Meat, DASH, Low Sodium, Diabetic Friendly
- **`allergies`** (all visible, no Load-more): Dairy, Eggs, Peanuts, Tree Nuts, Wheat, Soy, Fish, Shellfish, Sesame
- **`cuisines`**: existing list + Mediterranean (keeps its Load-more)
- **`mealType`**: Any, Breakfast, Lunch, Dinner, Snack, Dessert

Removed: the standalone `health` and `trending` groups; the items Heart Healthy, Low Oxalate, Celiac Friendly (superseded by Gluten-Free), and Air Fryer. Mediterranean → cuisines; Whole30 → dietType.

The guided modal reuses the same Load-more slice pattern the cuisines section already uses (`visibleCount` state). The browse sidebar (below) reads the updated `dietType`, `allergies`, and `cuisines` groups.

## Layout Relocation (`src/app/page.tsx`)

Reflow the page top-to-bottom:

1. Hero + search — in Phase 1 the search box keeps its **current in-place behavior** (filtering the existing `/api/recipes` query). Routing it to the dedicated page is Phase 2 (see Out of Scope).
2. **`RecipeCreator`** — full width.
3. **Browse section** — a two-column row: `FilterSidebar` (left, keeps "Apply Filters" deferred behavior) | **Recommended For You** (right). The **active-filter pill** (currently rendered above the generator) moves to **just above the Recommended grid**, with the sort control. On mobile the sidebar stacks above the list.

This removes the page-level top "Active filters" chip and places it with the list it controls.

## Preserved Behaviors

`AILoadingModal` with cancel, `queryClient.invalidateQueries(['/api/recipes'])` after generate, and the existing Recommended-list pagination/caching fixes (`page.tsx` accumulator + reset-guard) all remain.

## Out of Scope

- **Phase 2:** the standalone Search page the hero search routes to (own spec). Until then, the hero search box keeps its current behavior (filters the existing `/api/recipes` query in place) — no new routing in Phase 1.
- Visual styling / CTA color (intentionally unchanged).
- **Deferred from the old `RecipeGenerator` (were previously "preserved"):** the contradiction-detection warning and the High-Protein personalization dialog are dropped in Phase 1. Contradiction detection can return against the modal's diet selections whenever convenient. The High-Protein protein-target calculator is a **post-Phase-2 backlog item** — it also needs a default user weight, which the app doesn't capture today.
- **Known follow-up (not this spec):** browse-sidebar filter *values* must match recipes' stored `dietaryTags` for filtering to actually narrow results — a pre-existing matching gap. Generation is unaffected (selected filters only feed the prompt text + `dietaryFilters` payload).

## Testing

- **`GuidedRecipeModal`**: sections + Load-more render; footer label toggles "Surprise me" ↔ "Generate recipe" with selection count; selecting pills produces the expected `(prompt, dietaryFilters)` passed to `onGenerate` (assert via a mock); the Clear control empties selections.
- **`CustomRecipePrompt`**: typing + submit calls `onGenerate(text, [])`; empty text is blocked (existing toast behavior).
- **`RecipeCreator`**: renders the guided entry + custom box; both paths reach `generate()`.
- **Migrate** the existing `RecipeGenerator` tests (`src/test/components/recipes/RecipeGenerator.test.tsx`) onto the new components.
- **`page.tsx`**: the browse section renders the sidebar and the active-filter pill above the Recommended grid (smoke/structure test).
