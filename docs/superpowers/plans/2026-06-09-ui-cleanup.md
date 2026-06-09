# UI Cleanup Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Five small UI cleanups — remove "Low Carb", recipe-card heart color + full-width tag row, header heart-only, dashboard single top-tab nav + relocated profile, and a clear (×) button on the search input.

**Architecture:** Independent edits to existing components/pages; no new modules. Tests use the repo's global mocks (`src/test/setup.tsx` mocks `next/navigation`, `next-auth/react` → unauthenticated by default, and `@tanstack/react-query`).

**Tech Stack:** Next.js, React, TypeScript, shadcn/ui, Vitest + Testing Library.

> **Commits:** the user handles all commits — do NOT `git commit`; end each task with a checkpoint.

> **Spec:** `docs/superpowers/specs/2026-06-09-ui-cleanup-design.md`. Interactable ratings are a SEPARATE follow-up (out of scope here).

---

## Task 1: Remove "Low Carb"

**Files:** Modify `src/lib/utils.ts`; `src/test/lib/dietary-filters.test.ts`

- [ ] **Step 1 — update the test**

In `src/test/lib/dietary-filters.test.ts`, the "diet type leads with…" test asserts `arrayContaining([... "lowCarb" ...])`. Remove `"lowCarb"` from that array and add an absence check. Replace the whole `it("diet type leads with the four common options then the long tail", ...)` body with:

```ts
  it("diet type leads with the four common options then the long tail", () => {
    expect(ids(DIETARY_FILTERS.dietType).slice(0, 4)).toEqual([
      "vegetarian", "vegan", "keto", "glutenFree",
    ]);
    expect(ids(DIETARY_FILTERS.dietType)).toEqual(expect.arrayContaining([
      "highProtein", "paleo", "whole30", "pescatarian",
      "noRedMeat", "dash", "lowSodium", "diabetic",
    ]));
    expect(ids(DIETARY_FILTERS.dietType)).not.toContain("lowCarb");
  });
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/lib/dietary-filters.test.ts` → the `not.toContain("lowCarb")` FAILS (lowCarb still present).

- [ ] **Step 3 — remove the item**

In `src/lib/utils.ts`, delete this line from `DIETARY_FILTERS.dietType`:
```ts
    { id: "lowCarb", label: "Low Carb" },
```

- [ ] **Step 4 — run**: `npx vitest run src/test/lib/dietary-filters.test.ts` → PASS. (Low Carb now also disappears from the guided modal + sidebar, which read this array.)

- [ ] **Step 5 — checkpoint (user commits)**: files above. Message: `feat: remove Low Carb diet option`

---

## Task 2: Recipe card — heart color + full-width tag row

**Files:** Modify `src/components/recipes/recipe-card.tsx`; `src/test/components/recipes/RecipeCard.test.tsx`

- [ ] **Step 1 — failing test**

Add to `src/test/components/recipes/RecipeCard.test.tsx` (inside the `describe`):

```tsx
  it('fills the favorite heart red when the recipe is favorited', () => {
    const favorited = { ...mockRecipe, isFavorited: true }
    render(<RecipeCard recipe={favorited} onClick={mockOnClick} />)
    const saveBtn = screen.getByRole('button', { name: /save recipe/i })
    expect(saveBtn.querySelector('svg')?.getAttribute('class')).toContain('fill-red-500')
  })
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/recipes/RecipeCard.test.tsx` → the new test FAILS (no accessible "Save recipe" button / not red yet).

- [ ] **Step 3 — implement**

In `src/components/recipes/recipe-card.tsx`:

(a) The favorite button (the one with `onClick={handleFavoriteClick}`) — add `aria-label="Save recipe"` and change the heart's favorited classes from `fill-secondary-500 text-secondary-500` to `fill-red-500 text-red-500`:
```tsx
          <Button
            variant="ghost"
            size="icon"
            aria-label="Save recipe"
            className="bg-white rounded-full p-1 shadow hover:bg-gray-100"
            onClick={handleFavoriteClick}
          >
            <Heart
              className={cn(
                "h-5 w-5",
                isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"
              )}
            />
          </Button>
```

(b) The footer — change the side-by-side row to a vertical stack (rating on its own line, tags full-width below), and drop the dead `label === "Low Carb"` color line. Replace the `<div className="flex justify-between items-center">…</div>` block with:
```tsx
        <div className="space-y-2">
          <Rating value={recipe.rating} count={recipe.ratingCount} />
          <div className="flex flex-wrap gap-1">
            {visibleTags.slice(0, 2).map((tag) => {
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
                  )}
                >
                  {label}
                </Badge>
              );
            })}
            {visibleTags.length > 2 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
                +{visibleTags.length - 2}
              </Badge>
            )}
          </div>
        </div>
```

- [ ] **Step 4 — run**: `npx vitest run src/test/components/recipes/RecipeCard.test.tsx` → PASS (all, including existing tag/label tests). `npx tsc --noEmit 2>&1 | grep -i "recipe-card" || echo clean`.

- [ ] **Step 5 — checkpoint (user commits)**: files above. Message: `feat: recipe card heart red + full-width tag row`

---

## Task 3: Header — heart only

**Files:** Modify `src/components/layout/header.tsx`; `src/test/components/layout/Header.test.tsx` (create)

- [ ] **Step 1 — failing test**

Create `src/test/components/layout/Header.test.tsx`:

```tsx
import { render, screen } from "@/test/utils";
import { useSession } from "next-auth/react";
import { mockSession } from "@/test/utils";
import { Header } from "@/components/layout/header";

describe("Header", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
  });

  it("shows a heart link to the dashboard and no bookmark", () => {
    render(<Header />);
    const heart = screen.getByRole("link", { name: /saved recipes/i });
    expect(heart).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button", { name: /bookmark/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/layout/Header.test.tsx` → FAIL (heart isn't a labelled link yet).

- [ ] **Step 3 — implement**

In `src/components/layout/header.tsx`:
- Add `import Link from "next/link";` if not already imported (it is). Remove `Bookmark` from the `lucide-react` import (keep `Heart, ChevronDown, Utensils`).
- Replace the heart `<Button …><Heart …/></Button>` and the entire bookmark `<Button …><Bookmark …/></Button>` with a single heart link:
```tsx
                <Button asChild variant="ghost" size="icon" className="hidden md:flex hover:text-primary">
                  <Link href="/dashboard" aria-label="Saved recipes">
                    <Heart className="h-5 w-5" />
                  </Link>
                </Button>
```
(The `<Button asChild>` renders the `<Link>` as the element, so it's an `<a href="/dashboard">` with the accessible name "Saved recipes".)

- [ ] **Step 4 — run**: `npx vitest run src/test/components/layout/Header.test.tsx` → PASS. `npx tsc --noEmit 2>&1 | grep -i "header.tsx" || echo clean`.

- [ ] **Step 5 — checkpoint (user commits)**: files above. Message: `feat: header heart links to saved recipes, drop bookmark`

---

## Task 4: Dashboard — single top tab bar + relocated profile

**Files:** Modify `src/app/dashboard/page.tsx`; `src/test/setup.tsx` (extend mock); `src/test/pages/dashboard.test.tsx` (create)

- [ ] **Step 1 — extend the global react-query mock**

`Dashboard` calls `useQueryClient()` (`page.tsx:44`), but the global mock in `src/test/setup.tsx` only provides `useQuery`/`useMutation`/`QueryClient`/`QueryClientProvider` — rendering `<Dashboard />` would throw `useQueryClient is not a function`. Add it inside the existing `vi.mock('@tanstack/react-query', () => ({ … }))` block:
```ts
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  })),
```

- [ ] **Step 2 — failing test**

Create `src/test/pages/dashboard.test.tsx`:

```tsx
import { render, screen } from "@/test/utils";
import { useSession } from "next-auth/react";
import { mockSession } from "@/test/utils";
import Dashboard from "@/app/dashboard/page";

beforeAll(() => {
  // @ts-expect-error minimal jsdom stub for Radix Tabs
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
});

describe("Dashboard", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
  });

  it("renders one top tab bar, the profile, and no sidebar nav buttons", () => {
    render(<Dashboard />);
    expect(screen.getByRole("tab", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    // the old sidebar's "Generated History" button text no longer exists
    expect(screen.queryByText("Generated History")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3 — run, confirm fail**: `npx vitest run src/test/pages/dashboard.test.tsx` → FAIL (sidebar "Generated History" still present).

- [ ] **Step 4 — implement**

In `src/app/dashboard/page.tsx`:

(a) **Relocate the profile into the header.** Replace the header block:
```tsx
          <div className="mb-6">
            <Link href="/" className="text-gray-500 hover:text-gray-900 flex items-center mb-4">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to recipes
            </Link>
            <h1 className="text-3xl font-bold">Your Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage your recipes, preferences, and account settings</p>
          </div>
```
with:
```tsx
          <div className="mb-6">
            <Link href="/" className="text-gray-500 hover:text-gray-900 inline-flex items-center mb-4 w-fit">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to recipes
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Your Dashboard</h1>
                <p className="text-gray-600 mt-2">Manage your recipes, preferences, and account settings</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full overflow-hidden">
                  <img
                    src={user?.image || "https://github.com/shadcn.png"}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium">{user?.name || "User"}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
```

(b) **Drop the sidebar + grid.** Remove the `<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">` wrapper, the entire sidebar `<Card className="lg:col-span-1">…</Card>` (the profile card with the five `<Button variant="ghost" … onClick={() => setActiveTab(...)}>` nav buttons), AND the `<div className="lg:col-span-3">` wrapper — so the `<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">…</Tabs>` becomes a direct child of the `max-w-7xl` container. Leave the `<Tabs>` (its `TabsList` + all `TabsContent`) unchanged.

(c) **Clean up now-unused imports.** After removing the sidebar buttons, `User as UserIcon` and `Settings` (the lucide icons used only by the sidebar buttons) are unused. Remove them from the `lucide-react` import; KEEP `ShoppingCart, Heart, History` (used by the tab empty-states) and `ChevronLeft` (back link). The final import should be:
```tsx
import { ShoppingCart, Heart, History, ChevronLeft } from "lucide-react";
```
(If tsc flags any other now-unused import, remove it; if it flags one of these as still-needed, keep it — verify against the file.)

- [ ] **Step 5 — run**: `npx vitest run src/test/pages/dashboard.test.tsx` → PASS. `npx tsc --noEmit 2>&1 | grep -i "dashboard/page" || echo clean` (expect clean — no unused-import errors).

- [ ] **Step 6 — checkpoint (user commits)**: files above. Message: `feat: dashboard single top-tab nav + relocated profile`

---

## Task 5: Search input — clear (×) button

**Files:** Modify `src/components/recipes/recipe-browser.tsx`; add a test to `src/test/components/recipes/RecipeBrowser.test.tsx`

- [ ] **Step 1 — failing test**

Add to `src/test/components/recipes/RecipeBrowser.test.tsx` (inside the `describe`, the file already mocks `useQuery` per-test in `beforeEach`). Ensure `userEvent` is imported from `@/test/utils` at the top of the file (add it to the existing import if absent):

```tsx
  it("shows a clear button when the search has text and clears it on click", async () => {
    const user = userEvent.setup();
    render(
      <RecipeBrowser
        params={{ search: "eggplant", filters: [], sort: "popular" }}
        onParamsChange={() => {}}
        onRecipeClick={() => {}}
        showSearch
      />
    );
    const input = screen.getByLabelText("Search recipes");
    expect(input).toHaveValue("eggplant");
    await user.click(screen.getByLabelText("Clear search"));
    expect(input).toHaveValue("");
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/recipes/RecipeBrowser.test.tsx` → the new test FAILS (no clear button).

- [ ] **Step 3 — implement**

In `src/components/recipes/recipe-browser.tsx`:
- Add `X` to the lucide import: `import { ChevronDown, Search, Sliders, X } from "lucide-react";`
- In the `showSearch` block, add `pr-9` to the `Input` className and a clear button inside the relative wrapper. Replace the input wrapper:
```tsx
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchInput}
                  placeholder="Search by ingredient, cuisine, or dish…"
                  className="pl-9 pr-9"
                  aria-label="Search recipes"
                  onChange={(e) => { setSearchInput(e.target.value); pushSearch(e.target.value); }}
                />
                {searchInput && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => { setSearchInput(""); pushSearch(""); }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
```

- [ ] **Step 4 — run**: `npx vitest run src/test/components/recipes/RecipeBrowser.test.tsx` → PASS (all). Then full suite + typecheck: `npx vitest run 2>&1 | tail -4` and `npx tsc --noEmit 2>&1 | grep -vE "src/test/" | grep -iE "error TS" || echo "no non-test type errors"`.

- [ ] **Step 5 — checkpoint (user commits)**: files above. Message: `feat: clear button in the search input`

---

## Out of scope (separate follow-up)
- Interactable 1–5 star ratings (wire `Rating` `onChange` to submit a rating). UX to be confirmed when started.
