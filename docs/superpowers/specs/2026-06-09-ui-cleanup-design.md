# UI Cleanup Batch — Design

**Date:** 2026-06-09
**Status:** Approved design, pending implementation plan

## Context

A batch of small, independent UI cleanups across the dashboard, header, recipe cards, taxonomy, and search page. Interactable star ratings were explicitly sequenced last and are a **separate follow-up** (see Out of Scope), to keep this batch focused on layout/nav polish.

## A. Dashboard — one top tab bar, relocated profile (`src/app/dashboard/page.tsx`)

Today the page has a `grid lg:grid-cols-4` with a left **sidebar `Card`** (avatar + name + email + five tab-buttons) AND a `<Tabs>` with a top `TabsList` (Saved / Generated / Grocery / Profile / Settings) — redundant navigation driving the same `activeTab`.

- **Remove the sidebar `Card`** and the `grid lg:grid-cols-4` wrapper; the `<Tabs>` block becomes full width.
- Keep the `<Tabs value={activeTab} onValueChange={setActiveTab}>` + `TabsList` (now the only nav) and all `TabsContent` unchanged.
- **Relocate the profile** (avatar + name + email) into a compact strip in the page header row — right-aligned beside the existing "Your Dashboard" heading/subtitle (reuse the avatar markup + `user?.name`/`user?.email` from the old sidebar header).
- The sidebar's tab-buttons are dropped (the `TabsList` already covers those five sections); `activeTab` state and the queries gated on it stay.

## B. Header — heart only (`src/components/layout/header.tsx`)

- **Remove the `Bookmark` button** and its import.
- Wrap the **heart** button in a `Link href="/dashboard"` (the dashboard opens on the Saved tab by default), so the heart navigates to the user's saved/favorited recipes. Keep its `hidden md:flex` styling.

## C. Recipe card — heart color + full-width tags (`src/components/recipes/recipe-card.tsx`)

- **Favorite heart color:** when `isFavorite`, the heart fills red/pink — change `fill-secondary-500 text-secondary-500` to `fill-red-500 text-red-500`. (The toggle + favorite API call already work; this is color only.)
- **Tag layout:** the card footer is currently `<div className="flex justify-between items-center">` with `<Rating>` and the tag pills side-by-side. Change to a vertical stack: the `<Rating>` on its own line, then the dietary-tag pills (`visibleDietaryTags(...)`, already cuisine-filtered) on their **own full-width row below**. Keep the existing pill rendering + the `+N` overflow badge.

## D. Remove "Low Carb" (`src/lib/utils.ts`)

- Delete `{ id: "lowCarb", label: "Low Carb" }` from `DIETARY_FILTERS.dietType`. The guided modal and the sidebar both read this array, so it disappears from both automatically.
- Remove the now-dead `label === "Low Carb"` color condition in `recipe-card.tsx`.
- Update `src/test/lib/dietary-filters.test.ts` (it asserts `lowCarb` is present in `dietType`) to drop that expectation.

## E. Search page — clear (×) button (`src/components/recipes/recipe-browser.tsx`)

In the `showSearch` input, add an **×** button at the input's right edge, shown only when `searchInput` is non-empty. Clicking it clears the field and the query: `setSearchInput(""); pushSearch("")`. Add `pr-9` to the input so text doesn't run under the ×. (`pushSearch("")` debounced-writes the empty query, which the `/search` page maps to a clean `/search` URL.)

## Out of Scope (next, separate)

- **Interactable star ratings (1–5).** Deferred per sequencing. The `Rating` component already supports `readOnly={false}` + `onChange`; the work is wiring a click on a recipe's displayed stars to submit a rating to `/api/recipes/[id]/comments` (or a dedicated endpoint). Exact UX (rate from card vs. modal header vs. existing review form) to be confirmed when started.

## Testing

- **Dashboard:** the five tab triggers render and switch content; the profile (name) renders once (no sidebar duplicate). A smoke test asserting the tabs + a profile element, and that the old sidebar nav buttons are gone.
- **Header:** the bookmark icon is gone; the heart is a link to `/dashboard`.
- **Recipe card:** favorited heart has the red fill class; dietary tags render in their own row (structure assertion); existing card tests still pass (tags/labels unchanged).
- **Taxonomy:** `dietary-filters.test.ts` updated — `lowCarb` absent from `dietType`.
- **Search:** the × appears when the input has text and clears it on click (assert `pushSearch`/clear behavior or the input value resets); hidden when empty.
- Full suite + typecheck green.
