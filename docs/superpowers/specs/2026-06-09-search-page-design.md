# Standalone Search Page — Design (Phase 2)

**Date:** 2026-06-09
**Status:** Approved design, pending implementation plan

## Context

Phase 1 redesigned the home page (guided/custom generation + relocated browse filters) and explicitly deferred a standalone Search page. Today the home hero search filters the recommendations in place. This phase delivers the dedicated page the hero search should route to: same sidebar + recipe grid, **no generator**, with more room to search and **shareable** result URLs. It also removes the duplicated browse logic by extracting it into one reusable component.

## Goals

- A dedicated `/search` route with **URL-driven state** (shareable/bookmarkable, working browser back/forward).
- **Extract a shared `RecipeBrowser`** so the home recommendations and the search page use one tested implementation of the query + pagination (no duplicating the recently bug-fixed accumulation logic).
- The home hero search becomes a **submit-to-navigate launcher** into `/search`.

## Architecture

### `RecipeBrowser` (new) — `src/components/recipes/recipe-browser.tsx`
A controlled client component that encapsulates everything the home "Recommended For You" section does today:
- the `/api/recipes` query (search, filters, sort, page, pageSize),
- the `allRecipes` accumulation across pages **and the Phase-1 pagination fixes** (the `isInitialMount` reset-guard and the `recipes = allRecipes.length ? allRecipes : data?.recipes ?? []` fallback) — page/accumulation is **internal** (not in the URL); changing search/filters/sort resets it to page 1,
- the active-filter pills, the sort `Select`, the `FilterSidebar`,
- the `RecipeCard` grid + Load More, and opening the `RecipeDetailModal`.

**Props (controlled):**
```ts
interface RecipeBrowserParams { search: string; filters: string[]; sort: string; }
interface RecipeBrowserProps {
  params: RecipeBrowserParams;                    // the query inputs (search/filters/sort) — controlled
  onParamsChange: (next: RecipeBrowserParams) => void;
  onRecipeClick: (recipe: Recipe) => void;        // parent owns the detail modal (reused by generation on home)
  showSearch?: boolean;                           // render the search input + result count (search page); home omits it
}
```
- The component reads `params` and renders the UI; every user action (apply filters, change sort, type in search, remove a pill, Load More) calls `onParamsChange` with the next params. Changing search/filters/sort resets `page` to 1; Load More increments `page`.
- Accumulation is internal: when the query returns and `params.page === 1`, replace the list; otherwise append. The reset-guard prevents wiping a cached list on remount.
- The **state source is the parent's choice** — the component itself is routing-agnostic.

### Home page — `src/app/page.tsx`
- The "Recommended For You" list becomes `<RecipeBrowser>` driven by **local `useState`** params (no `showSearch`). The inline query/accumulation/pills/sort move out of `page.tsx` into `RecipeBrowser`, slimming the page.
- `HeroSection`'s search changes from debounced in-place filtering to **on-submit navigation**: pressing Enter or clicking search runs `router.push('/search?q=' + encodeURIComponent(value))`. (`HeroSection` exposes an `onSearchSubmit` callback; the home page wires it to the router.)
- The generator (`RecipeCreator`) and layout are otherwise unchanged.

### Search page — `src/app/search/page.tsx` (new route `/search`)
A client page that:
- derives `RecipeBrowserParams` from `useSearchParams` — `q` → `search`, `filters` (comma-separated ids) → `filters[]`, `sort`. (`page` is **not** in the URL this iteration — see Out of scope.);
- on change, writes them back to the URL with `router.replace` (debounced for `q` so typing doesn't spam history);
- renders `Header` → a **"← Back to home"** link (page chrome, links to `/`) → `<RecipeBrowser params={...} onParamsChange={writeToUrl} showSearch />` → `Footer`. No hero image, no generator.
- Wraps the URL-reading content in `<Suspense>` (Next.js App Router requires a Suspense boundary around `useSearchParams`).

### URL ↔ API params
The **page URL** uses a readable comma-separated `filters` (`?filters=vegetarian,italian`). `RecipeBrowser`'s API call keeps the existing `/api/recipes` contract (repeated `filters` query params, as `route.ts` reads via `searchParams.getAll('filters')`). No API change.

## Reuse / preserved
`FilterSidebar`, `RecipeCard`, `RecipeDetailModal`, the `/api/recipes` route + `storage.getAllRecipes` (incl. the sort fix), and the Phase-1 pagination fixes are all reused — the fixes now live in one place (`RecipeBrowser`).

## Out of scope (noted for later)
- **Infinite scroll** — deliberately deferred; Load More stays. When added, it slots into `RecipeBrowser` and benefits both pages. A **`page` URL param** (deep-linkable scroll depth) is deferred together with it — for now `page`/accumulation is internal and resets on load, while `q`/`filters`/`sort` remain shareable.
- No global search added to the `Header` nav; the entry points remain the home hero and the `/search` page itself.
- No backfill of existing recipes' tags (tracked separately).

## Testing
- **`RecipeBrowser`**: renders `FilterSidebar` + a `RecipeCard` grid; Load More increments page and appends; changing a filter/sort/search resets to page 1 (guards the pagination behavior in one tested place); clicking a card opens the detail modal. Controlled — assert `onParamsChange` payloads.
- **Search page**: initial `?q=` populates the search field + query; typing updates the URL (`router.replace` called with the new `q`); the "Back to home" link points to `/`.
- **Home**: submitting the hero search calls the router with `/search?q=…`; the Recommended list still renders via `RecipeBrowser`.
- Full suite + typecheck green.
