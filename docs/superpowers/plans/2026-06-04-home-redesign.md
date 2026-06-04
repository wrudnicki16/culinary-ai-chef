# Home Page Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `RecipeGenerator` with two clear creation modes — a guided "Build your recipe" modal and a simple free-text box — and move the browse filters (sidebar + active-filter pill) down beside the Recommended list.

**Architecture:** Decompose `RecipeGenerator` (747 lines) into `GuidedRecipeModal` (pill sections + Surprise-me/Generate footer), `CustomRecipePrompt` (textarea + arrow), and a slim `RecipeCreator` that hosts both and owns the single `generate()` API call + preserved dialogs. Restructure the filter taxonomy in `DIETARY_FILTERS`. Reflow `page.tsx` so the generator is full-width on top and the sidebar/pill sit with Recommended.

**Tech Stack:** Next.js (App Router), TypeScript, React, TanStack Query, shadcn/ui (Radix Dialog/Badge/RadioGroup), Vitest + Testing Library.

> **Commits:** Per the user's standing preference, **the user handles all git commits**. Do NOT run `git commit`. Each task ends with a checkpoint listing changed files + a suggested message.

> **Spec:** `docs/superpowers/specs/2026-06-04-home-redesign-design.md`

---

## File Structure

**Modify:**
- `src/lib/utils.ts` — restructure `DIETARY_FILTERS`; fix one `detectContradictoryFilters` id.
- `src/app/page.tsx` — swap `RecipeGenerator` → `RecipeCreator`; reflow layout (sidebar + active pill move down).

**Create:**
- `src/components/recipes/custom-recipe-prompt.tsx` — free-text box.
- `src/components/recipes/guided-recipe-modal.tsx` — guided modal.
- `src/components/recipes/recipe-creator.tsx` — composes both + owns generation.

**Delete (after migration):**
- `src/components/recipes/recipe-generator.tsx`

**Test (create/modify):**
- `src/test/lib/dietary-filters.test.ts` (new)
- `src/test/components/recipes/CustomRecipePrompt.test.tsx` (new)
- `src/test/components/recipes/GuidedRecipeModal.test.tsx` (new)
- `src/test/components/recipes/RecipeGenerator.test.tsx` → replace with `RecipeCreator.test.tsx`

---

## Task 1: Restructure the filter taxonomy

**Files:**
- Modify: `src/lib/utils.ts:16-77` (`DIETARY_FILTERS`) and the `CONTRADICTORY_COMBINATIONS` array.
- Test: `src/test/lib/dietary-filters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/lib/dietary-filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DIETARY_FILTERS } from "@/lib/utils";

const ids = (group: { id: string }[]) => group.map((f) => f.id);

describe("DIETARY_FILTERS taxonomy", () => {
  it("diet type leads with the four common options then the long tail", () => {
    expect(ids(DIETARY_FILTERS.dietType).slice(0, 4)).toEqual([
      "vegetarian", "vegan", "keto", "glutenFree",
    ]);
    expect(ids(DIETARY_FILTERS.dietType)).toEqual(expect.arrayContaining([
      "highProtein", "paleo", "lowCarb", "whole30", "pescatarian",
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
```

- [ ] **Step 2: Run it, confirm failure**

Run: `npx vitest run src/test/lib/dietary-filters.test.ts`
Expected: FAIL (current taxonomy has `health`/`trending`, no `mealType`, allergies are the old set).

- [ ] **Step 3: Replace `DIETARY_FILTERS`**

In `src/lib/utils.ts`, replace the whole `export const DIETARY_FILTERS = { ... };` block with:

```ts
export const DIETARY_FILTERS = {
  // First 4 shown by default in the guided modal; the rest behind "Load more".
  dietType: [
    { id: "vegetarian", label: "Vegetarian" },
    { id: "vegan", label: "Vegan" },
    { id: "keto", label: "Keto" },
    { id: "glutenFree", label: "Gluten-Free" },
    { id: "highProtein", label: "High Protein" },
    { id: "paleo", label: "Paleo" },
    { id: "lowCarb", label: "Low Carb" },
    { id: "whole30", label: "Whole30" },
    { id: "pescatarian", label: "Pescatarian" },
    { id: "noRedMeat", label: "No Red Meat" },
    { id: "dash", label: "DASH" },
    { id: "lowSodium", label: "Low Sodium" },
    { id: "diabetic", label: "Diabetic Friendly" },
  ],
  allergies: [
    { id: "dairy", label: "Dairy" },
    { id: "eggs", label: "Eggs" },
    { id: "peanuts", label: "Peanuts" },
    { id: "treeNuts", label: "Tree Nuts" },
    { id: "wheat", label: "Wheat" },
    { id: "soy", label: "Soy" },
    { id: "fish", label: "Fish" },
    { id: "shellfish", label: "Shellfish" },
    { id: "sesame", label: "Sesame" },
  ],
  mealType: [
    { id: "any", label: "Any" },
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
    { id: "dinner", label: "Dinner" },
    { id: "snack", label: "Snack" },
    { id: "dessert", label: "Dessert" },
  ],
  cuisines: [
    { id: "mediterranean", label: "Mediterranean" },
    { id: "italian", label: "Italian" },
    { id: "mexican", label: "Mexican" },
    { id: "japanese", label: "Japanese" },
    { id: "chinese", label: "Chinese" },
    { id: "indian", label: "Indian" },
    { id: "french", label: "French" },
    { id: "greek", label: "Greek" },
    { id: "turkish", label: "Turkish" },
    { id: "spanish", label: "Spanish" },
    { id: "ethiopian", label: "Ethiopian" },
    { id: "thai", label: "Thai" },
    { id: "american", label: "American" },
    { id: "korean", label: "Korean" },
    { id: "pakistani", label: "Pakistani" },
    { id: "peruvian", label: "Peruvian" },
    { id: "indonesian", label: "Indonesian" },
    { id: "iranian", label: "Iranian" },
    { id: "venezuelan", label: "Venezuelan" },
    { id: "german", label: "German" },
    { id: "polish", label: "Polish" },
    { id: "vietnamese", label: "Vietnamese" },
    { id: "egyptian", label: "Egyptian" },
    { id: "brazilian", label: "Brazilian" },
    { id: "filipino", label: "Filipino" },
    { id: "colombian", label: "Colombian" },
    { id: "malaysian", label: "Malaysian" },
    { id: "russian", label: "Russian" },
    { id: "british", label: "British" },
    { id: "moroccan", label: "Moroccan" },
    { id: "burmese", label: "Burmese" },
  ],
};
```

- [ ] **Step 4: Fix the contradiction id**

In `src/lib/utils.ts`, in `CONTRADICTORY_COMBINATIONS`, the `keto`/dairy entry currently reads `filters: ["keto", "dairyfree"]`. The new dairy-avoidance id is `dairy`. Change that entry's filters to:

```ts
    filters: ["keto", "dairy"],
```

(Leave the other three combinations — vegan/keto, vegan/paleo, paleo/vegetarian — unchanged; those ids still exist.)

- [ ] **Step 5: Run the test + full suite**

Run: `npx vitest run src/test/lib/dietary-filters.test.ts && npx vitest run`
Expected: new test PASSES. Other suites may now fail to compile if they import removed ids — that's expected and handled in later tasks (RecipeGenerator is replaced in Task 6). If `RecipeGenerator.test.tsx` fails here, note it and proceed; Task 6 removes it.

- [ ] **Step 6: Checkpoint (user commits)**

Files: `src/lib/utils.ts`, `src/test/lib/dietary-filters.test.ts`
Suggested message: `feat: restructure dietary filter taxonomy for guided modal`

---

## Task 2: `CustomRecipePrompt` component

**Files:**
- Create: `src/components/recipes/custom-recipe-prompt.tsx`
- Test: `src/test/components/recipes/CustomRecipePrompt.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/test/components/recipes/CustomRecipePrompt.test.tsx`:

```tsx
import { render, screen, userEvent } from "@/test/utils";
import { CustomRecipePrompt } from "@/components/recipes/custom-recipe-prompt";

describe("CustomRecipePrompt", () => {
  it("submits the typed text and clears", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<CustomRecipePrompt onGenerate={onGenerate} disabled={false} />);

    await user.type(screen.getByRole("textbox"), "spicy tofu stir fry");
    await user.click(screen.getByRole("button", { name: /generate/i }));

    expect(onGenerate).toHaveBeenCalledWith("spicy tofu stir fry");
  });

  it("does not submit empty text", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<CustomRecipePrompt onGenerate={onGenerate} disabled={false} />);
    await user.click(screen.getByRole("button", { name: /generate/i }));
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, confirm failure**

Run: `npx vitest run src/test/components/recipes/CustomRecipePrompt.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/components/recipes/custom-recipe-prompt.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CustomRecipePromptProps {
  onGenerate: (prompt: string) => void;
  disabled: boolean;
}

export function CustomRecipePrompt({ onGenerate, disabled }: CustomRecipePromptProps) {
  const [prompt, setPrompt] = useState("");

  const submit = () => {
    const text = prompt.trim();
    if (!text) return;
    onGenerate(text);
  };

  return (
    <div>
      <label htmlFor="custom-recipe-prompt" className="block text-sm font-medium text-gray-700 mb-1">
        Describe what you&apos;d like to make
      </label>
      <div className="flex items-end gap-2">
        <Textarea
          id="custom-recipe-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Pure English — ingredients you have, a cuisine, presentation, any constraints…"
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary h-24"
        />
        <Button
          onClick={submit}
          disabled={disabled || !prompt.trim()}
          aria-label="Generate from description"
          className="bg-primary hover:bg-primary/90 text-white h-10 w-10 p-0 rounded-lg flex-shrink-0"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/test/components/recipes/CustomRecipePrompt.test.tsx`
Expected: PASS.

- [ ] **Step 5: Checkpoint (user commits)**

Files: `src/components/recipes/custom-recipe-prompt.tsx`, `src/test/components/recipes/CustomRecipePrompt.test.tsx`
Suggested message: `feat: add CustomRecipePrompt free-text generation box`

---

## Task 3: `GuidedRecipeModal` component

This is the "Build your recipe" modal. It owns selection state and emits `(prompt, dietaryFilters)`. It does NOT call the API (the parent does). The contradiction warning + protein dialogs are owned by the parent (`RecipeCreator`) so this stays focused; the modal exposes the current selections via its `onGenerate` callback.

**Files:**
- Create: `src/components/recipes/guided-recipe-modal.tsx`
- Test: `src/test/components/recipes/GuidedRecipeModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/test/components/recipes/GuidedRecipeModal.test.tsx`:

```tsx
import { render, screen, userEvent } from "@/test/utils";
import { GuidedRecipeModal } from "@/components/recipes/guided-recipe-modal";

beforeAll(() => {
  // @ts-expect-error minimal stub for Radix in jsdom
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
});

describe("GuidedRecipeModal", () => {
  it("shows Surprise me when nothing is selected", () => {
    render(<GuidedRecipeModal open onClose={() => {}} onGenerate={() => {}} />);
    expect(screen.getByRole("button", { name: /surprise me/i })).toBeInTheDocument();
  });

  it("switches to Generate and emits prompt + filters once a pill is picked", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<GuidedRecipeModal open onClose={() => {}} onGenerate={onGenerate} />);

    await user.click(screen.getByRole("button", { name: "Keto" }));
    const generate = screen.getByRole("button", { name: /generate recipe/i });
    expect(generate).toBeInTheDocument();

    await user.click(generate);
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const [prompt, filters] = onGenerate.mock.calls[0];
    expect(prompt.toLowerCase()).toContain("keto");
    expect(filters).toEqual(["keto"]);
  });
});
```

- [ ] **Step 2: Run it, confirm failure**

Run: `npx vitest run src/test/components/recipes/GuidedRecipeModal.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/components/recipes/guided-recipe-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DIETARY_FILTERS } from "@/lib/utils";

const DIET_INITIAL = 4;
const CUISINE_INITIAL = 8;

interface GuidedRecipeModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, dietaryFilters: string[]) => void;
}

function labelFor(group: { id: string; label: string }[], id: string): string {
  return group.find((f) => f.id === id)?.label ?? id;
}

export function GuidedRecipeModal({ open, onClose, onGenerate }: GuidedRecipeModalProps) {
  const [diet, setDiet] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState<string>("");
  const [meal, setMeal] = useState<string>("any");
  const [showAllDiet, setShowAllDiet] = useState(false);
  const [showAllCuisine, setShowAllCuisine] = useState(false);

  const selectedCount = diet.length + allergies.length + (cuisine ? 1 : 0) + (meal !== "any" ? 1 : 0);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const clearAll = () => {
    setDiet([]); setAllergies([]); setCuisine(""); setMeal("any");
  };

  const buildPrompt = (): string => {
    const dietLabels = diet.map((id) => labelFor(DIETARY_FILTERS.dietType, id));
    const allergyLabels = allergies.map((id) => labelFor(DIETARY_FILTERS.allergies, id));
    const cuisineLabel = cuisine ? labelFor(DIETARY_FILTERS.cuisines, cuisine) : "";
    const mealLabel = meal !== "any" ? meal : "";
    let s = "Generate a";
    if (dietLabels.length) s += ` ${dietLabels.join(", ")}`;
    if (cuisineLabel) s += ` ${cuisineLabel}`;
    if (mealLabel) s += ` ${mealLabel}`;
    s += " recipe";
    if (allergyLabels.length) s += ` that avoids ${allergyLabels.join(", ")}`;
    s += ".";
    return s;
  };

  const handleGenerate = () => {
    if (selectedCount === 0) {
      onGenerate(
        "Generate a random, creative recipe that would surprise and delight me. Be inventive with ingredients and cooking techniques.",
        []
      );
      return;
    }
    const filters = [...diet, ...allergies, ...(cuisine ? [cuisine] : [])];
    onGenerate(buildPrompt(), filters);
  };

  const dietShown = showAllDiet ? DIETARY_FILTERS.dietType : DIETARY_FILTERS.dietType.slice(0, DIET_INITIAL);
  const cuisineShown = showAllCuisine ? DIETARY_FILTERS.cuisines : DIETARY_FILTERS.cuisines.slice(0, CUISINE_INITIAL);

  const pill = (active: boolean, label: string, onClick: () => void) => (
    <Badge
      key={label}
      variant={active ? "default" : "outline"}
      className={active ? "cursor-pointer bg-primary hover:bg-primary/80" : "cursor-pointer hover:bg-gray-100"}
      onClick={onClick}
    >
      {label}
    </Badge>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Build your recipe</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Diet type</p>
            <div className="flex flex-wrap gap-2">
              {dietShown.map((f) => pill(diet.includes(f.id), f.label, () => toggle(diet, setDiet, f.id)))}
              {!showAllDiet && (
                <Button variant="ghost" size="sm" className="h-6 text-xs text-gray-600" onClick={() => setShowAllDiet(true)}>
                  Load more
                </Button>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Cuisine</p>
            <div className="flex flex-wrap gap-2">
              {cuisineShown.map((f) => pill(cuisine === f.id, f.label, () => setCuisine(cuisine === f.id ? "" : f.id)))}
              {!showAllCuisine && (
                <Button variant="ghost" size="sm" className="h-6 text-xs text-gray-600" onClick={() => setShowAllCuisine(true)}>
                  Load more
                </Button>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Meal type</p>
            <RadioGroup value={meal} onValueChange={setMeal} className="flex flex-wrap gap-4">
              {DIETARY_FILTERS.mealType.map((f) => (
                <div key={f.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={f.id} id={`meal-${f.id}`} />
                  <Label htmlFor={`meal-${f.id}`} className="text-sm cursor-pointer">{f.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Allergies &amp; restrictions</p>
            <div className="flex flex-wrap gap-2">
              {DIETARY_FILTERS.allergies.map((f) => pill(allergies.includes(f.id), f.label, () => toggle(allergies, setAllergies, f.id)))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t pt-3 mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {selectedCount} selected
            {selectedCount > 0 && (
              <button className="ml-2 underline hover:text-gray-700" onClick={clearAll}>Clear</button>
            )}
          </span>
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleGenerate}>
            {selectedCount === 0 ? "Surprise me 🎲" : "Generate recipe →"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/test/components/recipes/GuidedRecipeModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Checkpoint (user commits)**

Files: `src/components/recipes/guided-recipe-modal.tsx`, `src/test/components/recipes/GuidedRecipeModal.test.tsx`
Suggested message: `feat: add GuidedRecipeModal build-your-recipe flow`

---

## Task 4: `RecipeCreator` component (owns generation)

Hosts the guided entry button + `CustomRecipePrompt`, owns the single `generate(prompt, dietaryFilters)` call, and keeps the preserved dialogs. The generation logic is **lifted from the existing `RecipeGenerator`** so behavior is unchanged.

**Files:**
- Create: `src/components/recipes/recipe-creator.tsx`
- Reference (to copy from): `src/components/recipes/recipe-generator.tsx`

- [ ] **Step 1: Implement by lifting the generation flow**

Create `src/components/recipes/recipe-creator.tsx` with the structure below. Copy these pieces **verbatim** from `recipe-generator.tsx` into it:
- the auth gate (`status === "unauthenticated"` / `"loading"` early-return cards) — lines 280-325;
- `proceedWithGeneration` (lines 154-247) **but** rename its filter inputs: it now receives `(prompt, dietaryFilters)` as arguments instead of reading component state. Replace the body's `const allFilters = [...]` / prompt-selection block (lines 169-182) with a direct use of the passed `prompt` and `dietaryFilters`;
- the `AILoadingModal` usage (lines 739-743) and its state (`isGenerating`, `generationProgress`, `isCancelled`, `handleCancelGeneration`).

```tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sparkles, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Recipe } from "@/lib/types";
import { AILoadingModal } from "./ai-loading-modal";
import { GuidedRecipeModal } from "./guided-recipe-modal";
import { CustomRecipePrompt } from "./custom-recipe-prompt";

interface RecipeCreatorProps {
  onRecipeGenerated: (recipe: Recipe) => void;
}

export function RecipeCreator({ onRecipeGenerated }: RecipeCreatorProps) {
  const { status } = useSession();
  const { toast } = useToast();
  const [showGuided, setShowGuided] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);

  // --- LIFTED from recipe-generator.tsx proceedWithGeneration (154-247),
  // adapted to take (prompt, dietaryFilters) directly ---
  const generate = async (prompt: string, dietaryFilters: string[]) => {
    setShowGuided(false);
    setIsCancelled(false);
    setIsGenerating(true);
    setGenerationProgress(0);
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        const next = prev + Math.random() * 15;
        return next > 95 ? 95 : next;
      });
    }, 800);
    try {
      const response = await apiRequest("POST", "/api/recipes/generate", { prompt, dietaryFilters });
      if (isCancelled) { clearInterval(progressInterval); return; }
      if (!response.ok) throw new Error("Failed to generate recipe");
      const recipe = await response.json();
      if (isCancelled) { clearInterval(progressInterval); return; }
      setGenerationProgress(100);
      setTimeout(() => {
        if (!isCancelled) {
          setIsGenerating(false);
          clearInterval(progressInterval);
          queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
          onRecipeGenerated(recipe);
        }
      }, 500);
    } catch (error: unknown) {
      clearInterval(progressInterval);
      if (isCancelled) return;
      setIsGenerating(false);
      if (isUnauthorizedError(error)) {
        toast({ title: "Authentication required", description: "Redirecting to login…", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/auth/signin"; }, 1500);
        return;
      }
      toast({ title: "Recipe generation failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleCancelGeneration = () => {
    setIsCancelled(true);
    setIsGenerating(false);
    setGenerationProgress(0);
    toast({ title: "Recipe generation cancelled", variant: "default" });
  };

  if (status === "unauthenticated") {
    return (
      <Card className="mb-8">
        <CardHeader><CardTitle className="text-lg">Create a recipe</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <LogIn className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sign in to generate recipes</h3>
            <Button onClick={() => (window.location.href = "/api/auth/signin")} className="bg-primary hover:bg-primary/90 text-white">
              <LogIn className="h-4 w-4 mr-2" /> Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-8">
        <CardHeader><CardTitle className="text-lg">Create a recipe</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center border border-dashed border-gray-200 rounded-lg p-5">
            <p className="font-medium">Generate your recipe</p>
            <p className="text-sm text-gray-500 mb-3">Guided — pick diet, cuisine, allergies, or hit Surprise me.</p>
            <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setShowGuided(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Generate recipe (guided)
            </Button>
          </div>

          <div className="text-center text-xs font-medium text-gray-400">— OR —</div>

          <CustomRecipePrompt onGenerate={(text) => generate(text, [])} disabled={isGenerating} />
        </CardContent>
      </Card>

      <GuidedRecipeModal open={showGuided} onClose={() => setShowGuided(false)} onGenerate={generate} />

      <AILoadingModal isOpen={isGenerating} progress={generationProgress} onCancel={handleCancelGeneration} />
    </>
  );
}
```

> Note on retired features: the contradiction-warning dialog and the High-Protein personalization dialog from `RecipeGenerator` are **intentionally dropped in Phase 1 per an explicit scope decision** (see the spec's Out of Scope). Do **not** re-add them and do **not** flag their absence — it is expected. The High-Protein calculator is a post-Phase-2 backlog item (it also needs a default user weight the app doesn't capture).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i "recipe-creator" || echo "no recipe-creator errors"`
Expected: empty.

- [ ] **Step 3: Checkpoint (user commits)**

Files: `src/components/recipes/recipe-creator.tsx`
Suggested message: `feat: add RecipeCreator hosting guided + custom modes`

---

## Task 5: Reflow the home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Swap the import and component**

In `src/app/page.tsx`, replace `import { RecipeGenerator } from "@/components/recipes/recipe-generator";` with:

```ts
import { RecipeCreator } from "@/components/recipes/recipe-creator";
```

And replace `<RecipeGenerator onRecipeGenerated={handleRecipeGenerated} />` (line ~208) with:

```tsx
<RecipeCreator onRecipeGenerated={handleRecipeGenerated} />
```

- [ ] **Step 2: Move the generator full-width above the filter row**

Currently the layout is `FilterSidebar` + a `flex-1` main column containing the active-filter chip, the generator, and the Recommended section (page.tsx ~179-287). Restructure the return so the order is: Hero → `RecipeCreator` (full width) → a row of `FilterSidebar` + Recommended. Concretely, in the `<main>` inner container, place `<RecipeCreator … />` **before** the `<div className="flex flex-col md:flex-row gap-8">` wrapper, and **remove** the `<RecipeGenerator>`/`<RecipeCreator>` line from inside the main column.

- [ ] **Step 3: Move the active-filter chip next to Recommended**

Cut the active-filters block (page.tsx ~189-205, the `{activeFilters.length > 0 && ( … FilterChip … )}` div) out of its current position and paste it **inside the Recommended `<section>`, immediately above the "Recipe Grid"** (just before the `{isLoading ? …}` block, after the header row at ~234). Keep its logic identical.

- [ ] **Step 4: Verify build + tests**

Run: `npx tsc --noEmit 2>&1 | grep -i "app/page" || echo "no page errors"` then `npx vitest run`
Expected: no page errors; suite green except the old `RecipeGenerator.test.tsx` (removed in Task 6).

- [ ] **Step 5: Manual verification**

Run the dev server, open `/`. Confirm: the "Create a recipe" card is full-width on top with the guided button + OR + free-text box; the guided button opens the modal; the sidebar and the active-filter pill now sit with the Recommended list; generating from either mode still shows the loading modal and refreshes the list.

- [ ] **Step 6: Checkpoint (user commits)**

Files: `src/app/page.tsx`
Suggested message: `feat: reflow home — full-width creator, filters beside recommendations`

---

## Task 6: Remove the old generator + migrate tests

**Files:**
- Delete: `src/components/recipes/recipe-generator.tsx`
- Delete: `src/test/components/recipes/RecipeGenerator.test.tsx`
- Verify: no remaining imports of `recipe-generator`.

- [ ] **Step 1: Confirm nothing imports it**

Run: `grep -rn "recipe-generator\|RecipeGenerator" src --include=*.tsx --include=*.ts`
Expected: only the files being deleted appear. If anything else imports it, stop and report.

- [ ] **Step 2: Delete the files**

```bash
rm src/components/recipes/recipe-generator.tsx src/test/components/recipes/RecipeGenerator.test.tsx
```

- [ ] **Step 3: Full verification**

Run: `npx vitest run && npx tsc --noEmit 2>&1 | grep -vE "src/test/" | grep -iE "error TS" || echo "no non-test type errors"`
Expected: all tests pass; no non-test type errors.

- [ ] **Step 4: Checkpoint (user commits)**

Files: deletions above
Suggested message: `refactor: remove RecipeGenerator superseded by RecipeCreator`

---

## Out of scope (Phase 2 / follow-ups)

- Standalone Search page the hero search routes to (own spec). Hero search keeps its current in-place behavior for now.
- Re-adding contradiction detection against the new modal (whenever convenient). The High-Protein personalization dialog is a **post-Phase-2** backlog item (also needs a default user weight the app doesn't capture).
- Browse-sidebar filter values matching recipes' stored `dietaryTags` (pre-existing gap).
