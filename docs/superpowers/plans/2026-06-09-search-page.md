# Standalone Search Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a URL-driven `/search` page (sidebar + results + search, no generator) by extracting the home page's browse logic into a reusable controlled `RecipeBrowser`, and turn the home hero search into a submit-to-navigate launcher.

**Architecture:** `RecipeBrowser` is controlled on `{ search, filters, sort }`, owns page/accumulation internally (with the Phase-1 pagination fixes), and emits `onParamsChange` + `onRecipeClick`. The home page feeds it from `useState`; the `/search` page feeds it from the URL (`useSearchParams` ↔ `router.replace`). `page` is intentionally NOT in the URL this iteration.

**Tech Stack:** Next.js App Router (`useSearchParams`, `useRouter`, `<Suspense>`), React, TanStack Query, shadcn/ui, Vitest + Testing Library.

> **Commits:** the user handles all commits — do NOT `git commit`; end each task with a checkpoint.

> **Spec:** `docs/superpowers/specs/2026-06-09-search-page-design.md`

---

## File Structure
- **Create:** `src/components/recipes/recipe-browser.tsx` (+ test)
- **Modify:** `src/components/sections/search-section.tsx`, `src/components/sections/hero-section.tsx` (submit-to-navigate) (+ a SearchSection test)
- **Modify:** `src/app/page.tsx` (use `RecipeBrowser` + route hero search)
- **Create:** `src/app/search/page.tsx` (+ test)

---

## Task 1: Extract `RecipeBrowser`

**Files:** Create `src/components/recipes/recipe-browser.tsx`; Test `src/test/components/recipes/RecipeBrowser.test.tsx`

- [ ] **Step 1 — write the failing test**

Create `src/test/components/recipes/RecipeBrowser.test.tsx`:

```tsx
import { render, screen, waitFor, userEvent } from "@/test/utils";
import { RecipeBrowser } from "@/components/recipes/recipe-browser";
import type { Recipe } from "@/lib/types";

beforeAll(() => {
  // @ts-expect-error minimal jsdom stub for Radix Select
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
});

const recipe = {
  id: 7, title: "Eggplant Parmesan", description: "Cheesy bake.", imageUrl: null,
  ingredients: [], instructions: [], cookingTime: 30, servings: 4,
  dietaryTags: ["vegetarian", "italian"], nutritionInfo: { calories: 500, protein: 20, fat: 20, carbs: 50 },
  rating: 0, ratingCount: 0, userId: "u1", createdAt: new Date(), updatedAt: new Date(),
  isAIGenerated: true, isVerified: true,
} as unknown as Recipe;

describe("RecipeBrowser", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve({ recipes: [recipe], total: 1 }),
    } as Response));
  });

  it("renders the sidebar and the fetched recipe, and shows active-filter pills", async () => {
    const onParamsChange = vi.fn();
    render(
      <RecipeBrowser
        params={{ search: "", filters: ["vegetarian"], sort: "popular" }}
        onParamsChange={onParamsChange}
        onRecipeClick={() => {}}
      />
    );
    expect(screen.getByText("Dietary Filters")).toBeInTheDocument();
    expect(screen.getByText("Active filters:")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Eggplant Parmesan")).toBeInTheDocument());
  });

  it("calls onRecipeClick when a card is clicked", async () => {
    const onRecipeClick = vi.fn();
    const user = userEvent.setup();
    render(
      <RecipeBrowser
        params={{ search: "", filters: [], sort: "popular" }}
        onParamsChange={() => {}}
        onRecipeClick={onRecipeClick}
      />
    );
    await waitFor(() => expect(screen.getByText("Eggplant Parmesan")).toBeInTheDocument());
    await user.click(screen.getByText("Eggplant Parmesan"));
    expect(onRecipeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/recipes/RecipeBrowser.test.tsx` → FAIL (module not found).

- [ ] **Step 3 — implement**

Create `src/components/recipes/recipe-browser.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Search, Sliders } from "lucide-react";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { FilterSidebar } from "@/components/recipes/filter-sidebar";
import { FilterChip } from "@/components/filters/filter-chip";
import { useToast } from "@/hooks/use-toast";
import { debounce, DIETARY_FILTERS } from "@/lib/utils";
import { Recipe } from "@/lib/types";

export interface RecipeBrowserParams {
  search: string;
  filters: string[];
  sort: string;
}

interface RecipeBrowserProps {
  params: RecipeBrowserParams;
  onParamsChange: (next: RecipeBrowserParams) => void;
  onRecipeClick: (recipe: Recipe) => void;
  showSearch?: boolean;
}

const PAGE_SIZE = 10;

function filterLabel(id: string): string {
  for (const group of Object.values(DIETARY_FILTERS)) {
    const f = group.find((x) => x.id === id);
    if (f) return f.label;
  }
  return id;
}

export function RecipeBrowser({ params, onParamsChange, onRecipeClick, showSearch }: RecipeBrowserProps) {
  const { search, filters, sort } = params;
  const filterKey = filters.join(",");

  const [page, setPage] = useState(1);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [searchInput, setSearchInput] = useState(search);
  const { toast } = useToast();
  const newPageRef = useRef<HTMLDivElement>(null);

  // Keep the controlled search box in step with the URL (back/forward + initial).
  useEffect(() => { setSearchInput(search); }, [search]);

  // Stable debounced push of typed search → params (refs hold latest values).
  const paramsRef = useRef(params); paramsRef.current = params;
  const onChangeRef = useRef(onParamsChange); onChangeRef.current = onParamsChange;
  const pushSearch = useRef(
    debounce((value: string) => onChangeRef.current({ ...paramsRef.current, search: value }), 500)
  ).current;

  const { data, isLoading, error, isFetching } = useQuery<{ recipes: Recipe[]; total: number }>({
    queryKey: ["/api/recipes", { filters, search, sort, page, pageSize: PAGE_SIZE }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      filters.forEach((f) => sp.append("filters", f));
      if (search) sp.append("search", search);
      if (sort) sp.append("sort", sort);
      sp.append("page", String(page));
      sp.append("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/recipes?${sp.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch recipes: ${res.statusText}`);
      return res.json();
    },
  });

  // Accumulate across pages (page 1 replaces; later pages append + scroll).
  useEffect(() => {
    if (!data?.recipes) return;
    if (page === 1) {
      setAllRecipes(data.recipes);
    } else {
      setAllRecipes((prev) => {
        const next = [...prev, ...data.recipes];
        if (next.length > prev.length) {
          setTimeout(() => {
            if (newPageRef.current) {
              const top = newPageRef.current.getBoundingClientRect().top;
              window.scrollBy({ top: top - 84, behavior: "smooth" });
            }
          }, 100);
        }
        return next;
      });
    }
  }, [data?.recipes, page]);

  // Reset to page 1 when query inputs change — but NOT on initial mount (a cached
  // remount fills allRecipes synchronously; the guard prevents wiping it).
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setPage(1);
    setAllRecipes([]);
  }, [search, filterKey, sort]);

  useEffect(() => {
    if (error) {
      toast({ title: "Error", description: "Failed to load recipes. Please try again later.", variant: "destructive" });
    }
  }, [error, toast]);

  const recipes = allRecipes.length > 0 ? allRecipes : data?.recipes ?? [];
  const hasMore = data?.total ? recipes.length < data.total : false;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <FilterSidebar activeFilters={filters} onFilterChange={(next) => onParamsChange({ ...params, filters: next })} />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3 mb-5">
          {showSearch ? (
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchInput}
                  placeholder="Search by ingredient, cuisine, or dish…"
                  className="pl-9"
                  aria-label="Search recipes"
                  onChange={(e) => { setSearchInput(e.target.value); pushSearch(e.target.value); }}
                />
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap">{data?.total ?? 0} results</span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex gap-3 items-center">
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
              <Sliders className="h-5 w-5" />
            </Button>
            <Select value={sort} onValueChange={(value) => onParamsChange({ ...params, sort: value })}>
              <SelectTrigger className="w-[140px] text-sm"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="quickest">Quickest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filters.length > 0 && (
          <div className="mb-6 flex items-center flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-500">Active filters:</span>
            {filters.map((id) => (
              <FilterChip
                key={id}
                id={id}
                label={filterLabel(id)}
                isActive
                onClick={() => {}}
                onRemove={() => onParamsChange({ ...params, filters: filters.filter((f) => f !== id) })}
              />
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recipes.map((recipe, index) => (
                <div key={`recipe-${recipe.id}`} ref={index === PAGE_SIZE * (page - 1) ? newPageRef : null}>
                  <RecipeCard recipe={recipe} onClick={() => onRecipeClick(recipe)} />
                </div>
              ))}
              {recipes.length === 0 && (
                <div className="col-span-3 py-12 text-center">
                  <p className="text-gray-500">No recipes found matching your criteria. Try adjusting your filters.</p>
                </div>
              )}
            </div>
            {recipes.length > 0 && hasMore && (
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  className="inline-flex items-center"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isFetching}
                >
                  {isFetching ? "Loading..." : "Load More Recipes"}
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4 — run**: `npx vitest run src/test/components/recipes/RecipeBrowser.test.tsx` → PASS. Then `npx tsc --noEmit 2>&1 | grep -i "recipe-browser" || echo clean`.

- [ ] **Step 5 — checkpoint (user commits)**: files above. Message: `feat: extract controlled RecipeBrowser (sidebar + results + search)`

---

## Task 2: Hero search → submit-to-navigate

**Files:** Modify `src/components/sections/search-section.tsx`, `src/components/sections/hero-section.tsx`; Test `src/test/components/sections/SearchSection.test.tsx`

- [ ] **Step 1 — failing test**

Create `src/test/components/sections/SearchSection.test.tsx`:

```tsx
import { render, screen, userEvent } from "@/test/utils";
import { SearchSection } from "@/components/sections/search-section";

describe("SearchSection", () => {
  it("submits the typed query on Enter", async () => {
    const onSearchSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SearchSection onSearchSubmit={onSearchSubmit} />);
    await user.type(screen.getByRole("textbox"), "eggplant{Enter}");
    expect(onSearchSubmit).toHaveBeenCalledWith("eggplant");
  });

  it("does not submit an empty query", async () => {
    const onSearchSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SearchSection onSearchSubmit={onSearchSubmit} />);
    await user.click(screen.getByRole("button"));
    expect(onSearchSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/sections/SearchSection.test.tsx` → FAIL.

- [ ] **Step 3 — implement SearchSection**

Replace `src/components/sections/search-section.tsx` with:

```tsx
"use client"

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface SearchSectionProps {
  onSearchSubmit: (query: string) => void;
}

export function SearchSection({ onSearchSubmit }: SearchSectionProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const q = value.trim();
    if (q) onSearchSubmit(q);
  };

  return (
    <form
      className="relative max-w-xl"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter ingredients, cuisine, or dish name..."
        className="w-full py-3 px-4 pr-12 rounded-lg border-0 shadow-md focus:ring-2 focus:ring-primary text-gray-900"
      />
      <Button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80"
        variant="ghost"
        size="icon"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </Button>
    </form>
  );
}
```

- [ ] **Step 4 — update HeroSection**

In `src/components/sections/hero-section.tsx`, change the prop from `onSearchChange` to `onSearchSubmit` and pass it through:

```tsx
interface HeroSectionProps {
  onSearchSubmit: (query: string) => void;
}

export function HeroSection({ onSearchSubmit }: HeroSectionProps) {
```
and change `<SearchSection onSearchChange={onSearchChange} />` to `<SearchSection onSearchSubmit={onSearchSubmit} />`. (Leave the rest of the markup unchanged.)

- [ ] **Step 5 — run**: `npx vitest run src/test/components/sections/SearchSection.test.tsx` → PASS. `npx tsc --noEmit 2>&1 | grep -iE "search-section|hero-section" || echo clean` (Note: `page.tsx` will not typecheck until Task 3 swaps the prop — that's expected; only confirm these two files are clean).

- [ ] **Step 6 — checkpoint (user commits)**: files above. Message: `feat: hero search submits to navigate`

---

## Task 3: Rewire the home page

**Files:** Modify `src/app/page.tsx`

- [ ] **Step 1 — replace the home page**

Replace the entire contents of `src/app/page.tsx` with:

```tsx
"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RecipeDetailModal } from "@/components/recipes/recipe-detail-modal";
import { RecipeCreator } from "@/components/recipes/recipe-creator";
import { RecipeBrowser, RecipeBrowserParams } from "@/components/recipes/recipe-browser";
import { ChatWidget } from "@/components/ui/chat-widget";
import { HeroSection } from "@/components/sections/hero-section";
import { Recipe } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [params, setParams] = useState<RecipeBrowserParams>({ search: "", filters: [], sort: "popular" });
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <HeroSection onSearchSubmit={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)} />

          <RecipeCreator onRecipeGenerated={openRecipe} />

          <section>
            <h2 className="text-xl font-heading font-semibold mb-5">Recommended For You</h2>
            <RecipeBrowser params={params} onParamsChange={setParams} onRecipeClick={openRecipe} />
          </section>
        </div>
      </main>

      <ChatWidget />
      <Footer />

      <RecipeDetailModal recipe={selectedRecipe} open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2 — verify**

Run `npx tsc --noEmit 2>&1 | grep -i "app/page" || echo clean` (expect clean) and `npx vitest run 2>&1 | tail -4` (all pass — the home browse logic now lives in the tested `RecipeBrowser`).

- [ ] **Step 3 — manual verification**

Run the dev server, open `/`: the Recommended list still loads with sidebar/sort/Load More; typing in the hero search and pressing Enter navigates to `/search?q=…`; generating a recipe still opens the detail modal.

- [ ] **Step 4 — checkpoint (user commits)**: `src/app/page.tsx`. Message: `refactor: home uses RecipeBrowser; hero routes to /search`

---

## Task 4: The `/search` page

**Files:** Create `src/app/search/page.tsx`; Test `src/test/app/search-page.test.tsx`

- [ ] **Step 1 — failing test**

Create `src/test/app/search-page.test.tsx`:

```tsx
import { render, screen, waitFor } from "@/test/utils";
import SearchPage from "@/app/search/page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("q=eggplant&filters=vegetarian"),
  usePathname: () => "/search",
  useParams: () => ({}),
}));

beforeAll(() => {
  // @ts-expect-error minimal jsdom stub
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
});

describe("SearchPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve({ recipes: [], total: 0 }),
    } as Response));
  });

  it("reads the query from the URL and shows a back-to-home link", async () => {
    render(<SearchPage />);
    await waitFor(() => expect(screen.getByLabelText("Search recipes")).toHaveValue("eggplant"));
    const back = screen.getByRole("link", { name: /back to home/i });
    expect(back).toHaveAttribute("href", "/");
    // the URL-derived filter is reflected as an active pill
    expect(screen.getByText("Active filters:")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/app/search-page.test.tsx` → FAIL (module not found).

- [ ] **Step 3 — implement**

Create `src/app/search/page.tsx`:

```tsx
"use client"

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RecipeDetailModal } from "@/components/recipes/recipe-detail-modal";
import { RecipeBrowser, RecipeBrowserParams } from "@/components/recipes/recipe-browser";
import { Recipe } from "@/lib/types";

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params: RecipeBrowserParams = {
    search: searchParams.get("q") ?? "",
    filters: (searchParams.get("filters") ?? "").split(",").filter(Boolean),
    sort: searchParams.get("sort") ?? "popular",
  };

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const writeParams = (next: RecipeBrowserParams) => {
    const sp = new URLSearchParams();
    if (next.search) sp.set("q", next.search);
    if (next.filters.length) sp.set("filters", next.filters.join(","));
    if (next.sort && next.sort !== "popular") sp.set("sort", next.sort);
    const qs = sp.toString();
    router.replace(qs ? `/search?${qs}` : "/search");
  };

  return (
    <>
      <Link href="/" className="text-gray-500 hover:text-gray-900 flex items-center mb-4">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to home
      </Link>
      <h1 className="text-2xl font-bold mb-5">Search recipes</h1>
      <RecipeBrowser
        params={params}
        onParamsChange={writeParams}
        onRecipeClick={(r) => { setSelectedRecipe(r); setIsModalOpen(true); }}
        showSearch
      />
      <RecipeDetailModal recipe={selectedRecipe} open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading search…</div>}>
            <SearchPageContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 4 — run**: `npx vitest run src/test/app/search-page.test.tsx` → PASS. Then full suite + typecheck: `npx vitest run 2>&1 | tail -4` and `npx tsc --noEmit 2>&1 | grep -vE "src/test/" | grep -iE "error TS" || echo "no non-test type errors"`.

- [ ] **Step 5 — manual verification**

Dev server: visit `/search?q=eggplant`, confirm the search box is pre-filled and results load; typing refines the URL (`?q=…`) live; toggling a filter + Apply updates the URL and results; Load More appends; "Back to home" returns to `/`; the home hero search lands here.

- [ ] **Step 6 — checkpoint (user commits)**: files above. Message: `feat: add /search page (URL-driven, reuses RecipeBrowser)`

---

## Out of scope (this plan)
- Infinite scroll + a `page` URL param (deferred together).
- Any `/api/recipes` change (the existing route/contract is reused).
- Header global search.
