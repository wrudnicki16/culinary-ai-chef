# Browse Sidebar Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish the home browse sidebar — extract a shared `FilterPillGroup` (pills + +10 Load-more / See-less), use it in both the guided modal and the sidebar, and make the sidebar deselect when an active-filter pill is removed up top.

**Architecture:** A new `FilterPillGroup` renders `FilterChip` pills and owns the incremental visible-count (Load-more +10 / See-less back to the initial count). Selection state stays with the parent (so it serves multi-select and single-select). The guided modal and the sidebar both consume it; the sidebar additionally syncs its internal selection from the `activeFilters` prop.

**Tech Stack:** Next.js, React, TypeScript, shadcn/ui, Vitest + Testing Library.

> **Commits:** the user handles all commits. Do NOT `git commit`; end each task with a checkpoint.

> **Design:** approved interactively 2026-06-08; context in memory `browse-sidebar-followup`.

---

## File Structure
- **Create:** `src/components/recipes/filter-pill-group.tsx` (+ test)
- **Modify:** `src/components/recipes/guided-recipe-modal.tsx` (use FilterPillGroup; drop local pill/moreControl/visible state) + its test
- **Modify:** `src/components/recipes/filter-sidebar.tsx` (use FilterPillGroup + sync effect) + its test

---

## Task 1: `FilterPillGroup` shared component

**Files:** Create `src/components/recipes/filter-pill-group.tsx`; Test `src/test/components/recipes/FilterPillGroup.test.tsx`

- [ ] **Step 1 — failing test**

Create `src/test/components/recipes/FilterPillGroup.test.tsx`:

```tsx
import { render, screen, userEvent } from "@/test/utils";
import { FilterPillGroup } from "@/components/recipes/filter-pill-group";

const items = Array.from({ length: 15 }, (_, i) => ({ id: `i${i}`, label: `Item ${i}` }));

describe("FilterPillGroup", () => {
  it("calls onToggle with the id when a pill is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<FilterPillGroup items={items.slice(0, 3)} selectedIds={[]} onToggle={onToggle} />);
    await user.click(screen.getByRole("button", { name: "Item 1" }));
    expect(onToggle).toHaveBeenCalledWith("i1");
  });

  it("shows everything and no Load more when initialCount is omitted", () => {
    render(<FilterPillGroup items={items.slice(0, 3)} selectedIds={[]} onToggle={() => {}} />);
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("reveals +10 per Load more, then collapses with See less", async () => {
    const user = userEvent.setup();
    render(<FilterPillGroup items={items} selectedIds={[]} onToggle={() => {}} initialCount={4} />);
    expect(screen.queryByText("Item 4")).not.toBeInTheDocument();      // 5th hidden
    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(screen.getByText("Item 4")).toBeInTheDocument();            // now 14 shown
    expect(screen.queryByText("Item 14")).not.toBeInTheDocument();     // 15th still hidden
    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(screen.getByText("Item 14")).toBeInTheDocument();           // all 15 shown
    await user.click(screen.getByRole("button", { name: /see less/i }));
    expect(screen.queryByText("Item 4")).not.toBeInTheDocument();      // back to 4
  });

  it("marks selected pills active", () => {
    render(<FilterPillGroup items={items.slice(0, 3)} selectedIds={["i1"]} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: "Item 1" }).className).toContain("bg-primary");
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/recipes/FilterPillGroup.test.tsx` → FAIL (module not found).

- [ ] **Step 3 — implement**

Create `src/components/recipes/filter-pill-group.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/filters/filter-chip";

const LOAD_STEP = 10;

interface FilterPillGroupProps {
  items: { id: string; label: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** When set and items exceed it, the group shows this many and adds Load-more/See-less. */
  initialCount?: number;
}

export function FilterPillGroup({ items, selectedIds, onToggle, initialCount }: FilterPillGroupProps) {
  const base = initialCount ?? items.length;
  const [visible, setVisible] = useState(base);
  const hasLoadMore = items.length > base;
  const shown = items.slice(0, visible);

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((f) => (
        <FilterChip
          key={f.id}
          id={f.id}
          label={f.label}
          isActive={selectedIds.includes(f.id)}
          onClick={() => onToggle(f.id)}
        />
      ))}
      {hasLoadMore && visible < items.length && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-gray-600"
          onClick={() => setVisible((v) => Math.min(v + LOAD_STEP, items.length))}
        >
          Load more
        </Button>
      )}
      {hasLoadMore && visible >= items.length && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-gray-600"
          onClick={() => setVisible(base)}
        >
          See less
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4 — run**: `npx vitest run src/test/components/recipes/FilterPillGroup.test.tsx` → PASS (4 cases).

- [ ] **Step 5 — checkpoint (user commits)**: files above. Message: `feat: add shared FilterPillGroup (pills + load-more/see-less)`

---

## Task 2: Use `FilterPillGroup` in the guided modal

**Files:** Modify `src/components/recipes/guided-recipe-modal.tsx`; update `src/test/components/recipes/GuidedRecipeModal.test.tsx`

- [ ] **Step 1 — refactor the modal**

In `guided-recipe-modal.tsx`:
- Add import: `import { FilterPillGroup } from "./filter-pill-group";`
- Remove the now-unused `Badge` import and the `LOAD_STEP` constant.
- Remove these from the component body: the `dietVisible`/`cuisineVisible` state, the `dietShown`/`cuisineShown` consts, the `moreControl` helper, and the `pill` helper.
- In the close-reset `useEffect`, remove the `setDietVisible(...)`/`setCuisineVisible(...)` lines (the group owns its own count and resets on dialog unmount). Keep the selection resets (`setDiet([])`, `setAllergies([])`, `setCuisine("")`, `setMeal("any")`).
- Keep `DIET_INITIAL = 4` and `CUISINE_INITIAL = 8`.
- Replace the Diet section's inner `<div className="flex flex-wrap gap-2">…</div>` with:
```tsx
            <FilterPillGroup
              items={DIETARY_FILTERS.dietType}
              selectedIds={diet}
              onToggle={(id) => toggle(diet, setDiet, id)}
              initialCount={DIET_INITIAL}
            />
```
- Replace the Cuisine section's inner `<div className="flex flex-wrap gap-2">…</div>` with:
```tsx
            <FilterPillGroup
              items={DIETARY_FILTERS.cuisines}
              selectedIds={cuisine ? [cuisine] : []}
              onToggle={(id) => setCuisine(cuisine === id ? "" : id)}
              initialCount={CUISINE_INITIAL}
            />
```
- Replace the Allergies section's inner `<div className="flex flex-wrap gap-2">…</div>` with:
```tsx
            <FilterPillGroup
              items={DIETARY_FILTERS.allergies}
              selectedIds={allergies}
              onToggle={(id) => toggle(allergies, setAllergies, id)}
            />
```
- Leave the Meal type `RadioGroup` section untouched, and the footer (selectedCount, Clear, Surprise-me/Generate) untouched.

- [ ] **Step 2 — update the test**

The existing `GuidedRecipeModal.test.tsx` should still largely work (pills are now `FilterChip` buttons; `getByText("Keto")`, `getAllByRole("button", { name: /load more/i })[0]`, and `getByText("High Protein")` all still resolve). Run it:
`npx vitest run src/test/components/recipes/GuidedRecipeModal.test.tsx`
If the "Keto" click no longer toggles (because the pill is now a `<button>` and the matcher finds a different node), change `screen.getByText("Keto")` to `screen.getByRole("button", { name: "Keto" })`. Make only the minimal selector change needed to keep the 4 tests green, and report what you changed.

- [ ] **Step 3 — verify**: `npx tsc --noEmit 2>&1 | grep -i "guided-recipe-modal" || echo clean` (expect clean); the modal test passes.

- [ ] **Step 4 — checkpoint (user commits)**: files above. Message: `refactor: guided modal uses shared FilterPillGroup`

---

## Task 3: Use `FilterPillGroup` in the sidebar + sync on removal

**Files:** Modify `src/components/recipes/filter-sidebar.tsx`; update `src/test/components/recipes/FilterSidebar.test.tsx`

- [ ] **Step 1 — refactor + sync**

In `filter-sidebar.tsx`:
- Change the React import to include `useEffect`: `import { useState, useEffect } from "react";`
- Remove the `FilterChip` import (now used inside FilterPillGroup) and add `import { FilterPillGroup } from "./filter-pill-group";`
- Right after the `const [selectedFilters, setSelectedFilters] = useState<string[]>(activeFilters);` line, add the sync effect:
```ts
  // Keep the sidebar's selection in step with externally-applied filters
  // (e.g. removing an active-filter pill above the recommendations).
  useEffect(() => {
    setSelectedFilters(activeFilters);
  }, [activeFilters]);
```
- Replace the three section bodies (the `<div className="flex flex-wrap gap-2">{DIETARY_FILTERS.<group>.map(... FilterChip ...)}</div>` blocks for Diet Type, Allergies & Restrictions, and Cuisine) with `FilterPillGroup`, keeping each section's existing `<h4>` heading:
  - Diet Type → `<FilterPillGroup items={DIETARY_FILTERS.dietType} selectedIds={selectedFilters} onToggle={toggleFilter} initialCount={4} />`
  - Allergies & Restrictions → `<FilterPillGroup items={DIETARY_FILTERS.allergies} selectedIds={selectedFilters} onToggle={toggleFilter} />`
  - Cuisine → `<FilterPillGroup items={DIETARY_FILTERS.cuisines} selectedIds={selectedFilters} onToggle={toggleFilter} initialCount={8} />`
- Keep `toggleFilter`, `handleApplyFilters`, `handleResetFilters`, the Apply/Reset buttons, and the Card wrapper unchanged.

- [ ] **Step 2 — update the test**

Replace `src/test/components/recipes/FilterSidebar.test.tsx` with:

```tsx
import { render, screen, userEvent } from "@/test/utils";
import { useState } from "react";
import { FilterSidebar } from "@/components/recipes/filter-sidebar";

describe("FilterSidebar", () => {
  it("renders the three filter sections", () => {
    render(<FilterSidebar activeFilters={[]} onFilterChange={() => {}} />);
    expect(screen.getByText("Dietary Filters")).toBeInTheDocument();
    expect(screen.getByText("Diet Type")).toBeInTheDocument();
    expect(screen.getByText("Allergies & Restrictions")).toBeInTheDocument();
    expect(screen.getByText("Cuisine")).toBeInTheDocument();
  });

  it("collapses the cuisine list behind Load more", async () => {
    const user = userEvent.setup();
    render(<FilterSidebar activeFilters={[]} onFilterChange={() => {}} />);
    // Cuisine shows its first 8 (mediterranean…greek); "Turkish" (index 8) is hidden.
    expect(screen.queryByRole("button", { name: "Turkish" })).not.toBeInTheDocument();
    // Load-more buttons in DOM order: [0] = Diet, [1] = Cuisine — click Cuisine's.
    await user.click(screen.getAllByRole("button", { name: /load more/i })[1]);
    expect(screen.getByRole("button", { name: "Turkish" })).toBeInTheDocument();
  });

  it("syncs selection when activeFilters changes (e.g. pill removed up top)", async () => {
    // Controlled wrapper so we can change the prop from outside.
    function Harness() {
      const [filters, setFilters] = useState<string[]>(["vegetarian"]);
      return (
        <div>
          <button onClick={() => setFilters([])}>clear-outside</button>
          <FilterSidebar activeFilters={filters} onFilterChange={() => {}} />
        </div>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Vegetarian" }).className).toContain("bg-primary");
    await user.click(screen.getByRole("button", { name: "clear-outside" }));
    expect(screen.getByRole("button", { name: "Vegetarian" }).className).not.toContain("bg-primary");
  });
});
```

Note: cuisine order is `mediterranean, italian, mexican, japanese, chinese, indian, french, greek, turkish, …`, so the first 8 (indices 0–7) end at "Greek" and "Turkish" (index 8) is the first hidden one — hence the assertions above. If the cuisine list order ever changes, update the hidden-label accordingly.

- [ ] **Step 3 — verify**: `npx vitest run src/test/components/recipes/FilterSidebar.test.tsx` → PASS. `npx tsc --noEmit 2>&1 | grep -i "filter-sidebar" || echo clean` (expect clean). Then `npx vitest run 2>&1 | tail -4` → all pass.

- [ ] **Step 4 — checkpoint (user commits)**: files above. Message: `feat: sidebar uses FilterPillGroup with load-more + syncs on pill removal`

---

## Out of scope
- The standalone Search page (Phase 2).
- Browse-filter value/`dietaryTags` matching correctness (pre-existing).
