# Interactable Star Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the recipe stars an interactive "start a rating" affordance (hover-fills yellow, click routes to the modal's pre-filled review form) and wire real persistence by reusing the comments table, recomputing each recipe's average from the latest rating per user.

**Architecture:** A pure `computeRatingAggregate` function drives a new `storage.recomputeRecipeRating`, called from `createComment`; the comment schema/endpoint accept rating-only. On the front end, the `Rating` component gains an interactive yellow mode, a `useRatingGate` hook blocks logged-out users at click-time, and `RecipeCard`/`RecipeDetailModal`/`RecipeBrowser` + the three modal-owning pages thread a preselected rating into the modal's review form.

**Tech Stack:** Next.js (App Router), TypeScript, Drizzle (Postgres), zod, shadcn/ui (Dialog, Toast), TanStack Query, Vitest + Testing Library.

> **Commits:** the user handles all commits — do NOT run `git commit`/`git add`. End each task with a checkpoint listing the files; leave them uncommitted.

> **Spec:** `docs/superpowers/specs/2026-06-12-star-ratings-design.md`.

> **Test mocks (repo-wide, `src/test/setup.tsx`):** `next-auth/react` (`useSession` defaults to unauthenticated — override per-test with `vi.mocked(useSession).mockReturnValue(...)`), `@tanstack/react-query` (`useQuery`/`useQueryClient`/etc.), `next/navigation`, `next/image`. `@/test/utils` re-exports `render`, `screen`, `userEvent`, `AllProviders`, `mockSession`, `mockRecipe`, `mockUser`.

---

## Task 1: `computeRatingAggregate` pure function

**Files:**
- Create: `src/lib/rating-aggregate.ts`
- Test: `src/test/lib/rating-aggregate.test.ts`

- [ ] **Step 1 — failing test**

Create `src/test/lib/rating-aggregate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeRatingAggregate } from "@/lib/rating-aggregate";

const d = (s: string) => new Date(s);

describe("computeRatingAggregate", () => {
  it("returns 0/0 when there are no ratings", () => {
    expect(computeRatingAggregate([])).toEqual({ rating: 0, ratingCount: 0 });
  });

  it("counts each user once using their most recent rating", () => {
    const rows = [
      { userId: "a", rating: 2, createdAt: d("2026-01-01") },
      { userId: "a", rating: 5, createdAt: d("2026-02-01") }, // a's latest = 5
      { userId: "b", rating: 4, createdAt: d("2026-01-15") },
    ];
    // latest per user: a=5, b=4 -> avg 4.5 -> round 5, count 2
    expect(computeRatingAggregate(rows)).toEqual({ rating: 5, ratingCount: 2 });
  });

  it("rounds the average to a whole number", () => {
    const rows = [
      { userId: "a", rating: 3, createdAt: d("2026-01-01") },
      { userId: "b", rating: 4, createdAt: d("2026-01-01") },
      { userId: "c", rating: 4, createdAt: d("2026-01-01") },
    ];
    // avg 11/3 = 3.67 -> 4, count 3
    expect(computeRatingAggregate(rows)).toEqual({ rating: 4, ratingCount: 3 });
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/lib/rating-aggregate.test.ts` → FAIL (module not found).

- [ ] **Step 3 — implement**

Create `src/lib/rating-aggregate.ts`:
```ts
export interface RatingRow {
  userId: string;
  rating: number;
  createdAt: Date;
}

/**
 * A recipe's aggregate rating from its rating-bearing comments. Each user
 * contributes one vote — their most recent rating — and the average is rounded
 * to a whole number (the recipes.rating column is an integer).
 */
export function computeRatingAggregate(
  rows: RatingRow[]
): { rating: number; ratingCount: number } {
  const latestByUser = new Map<string, RatingRow>();
  for (const row of rows) {
    const existing = latestByUser.get(row.userId);
    if (!existing || row.createdAt > existing.createdAt) {
      latestByUser.set(row.userId, row);
    }
  }
  const ratings = [...latestByUser.values()].map((r) => r.rating);
  if (ratings.length === 0) return { rating: 0, ratingCount: 0 };
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { rating: Math.round(avg), ratingCount: ratings.length };
}
```

- [ ] **Step 4 — run**: `npx vitest run src/test/lib/rating-aggregate.test.ts` → PASS (3 tests).

- [ ] **Step 5 — checkpoint (user commits)**: `src/lib/rating-aggregate.ts`, `src/test/lib/rating-aggregate.test.ts`. Message: `feat: rating aggregate helper (latest-per-user, rounded)`

---

## Task 2: Backend — accept rating-only + recompute the average

**Files:**
- Modify: `src/lib/types.ts` (`commentSchema`)
- Modify: `src/lib/storage.ts` (add `recomputeRecipeRating`, call it in `createComment`)
- Modify: `src/app/api/recipes/[id]/comments/route.ts` (persist empty content)
- Test: `src/test/lib/comment-schema.test.ts`

- [ ] **Step 1 — failing test**

Create `src/test/lib/comment-schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { commentSchema } from "@/lib/types";

describe("commentSchema", () => {
  it("accepts a rating with no comment", () => {
    expect(commentSchema.safeParse({ rating: 4 }).success).toBe(true);
  });
  it("accepts a comment with no rating", () => {
    expect(commentSchema.safeParse({ comment: "Great recipe" }).success).toBe(true);
  });
  it("rejects an empty submission", () => {
    expect(commentSchema.safeParse({}).success).toBe(false);
  });
  it("rejects a blank-only comment with no rating", () => {
    expect(commentSchema.safeParse({ comment: "   " }).success).toBe(false);
  });
  it("rejects an out-of-range rating", () => {
    expect(commentSchema.safeParse({ rating: 6 }).success).toBe(false);
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/lib/comment-schema.test.ts` → FAIL (today `comment` is required, so `{ rating: 4 }` is rejected → first test fails).

- [ ] **Step 3 — relax `commentSchema`**

In `src/lib/types.ts`, replace the existing `commentSchema`:
```ts
export const commentSchema = z.object({
  comment: z.string().min(1).max(500),
  rating: z.number().min(1).max(5).optional(),
});
```
with:
```ts
export const commentSchema = z
  .object({
    comment: z.string().max(500).optional(),
    rating: z.number().int().min(1).max(5).optional(),
  })
  .refine((d) => (d.comment?.trim().length ?? 0) > 0 || d.rating !== undefined, {
    message: "Provide a rating or a comment",
  });
```

- [ ] **Step 4 — run, confirm schema tests pass**: `npx vitest run src/test/lib/comment-schema.test.ts` → PASS (5 tests).

- [ ] **Step 5 — recompute in storage**

In `src/lib/storage.ts`:

(a) Add `isNotNull` to the existing `drizzle-orm` import (which already imports `and`, `eq`, `desc`, `sql`, etc.), and import the helper at the top:
```ts
import { computeRatingAggregate } from "@/lib/rating-aggregate";
```

(b) Add the method to the `IStorage` interface (near the other comment/recipe signatures, e.g. after `createComment(...)`):
```ts
  recomputeRecipeRating(recipeId: number): Promise<void>;
```

(c) Implement it and call it from `createComment`. Replace the existing `createComment`:
```ts
  async createComment(comment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values({
      ...comment,
      createdAt: new Date(),
    }).returning();

    return result[0];
  }
```
with:
```ts
  async createComment(comment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values({
      ...comment,
      createdAt: new Date(),
    }).returning();

    await this.recomputeRecipeRating(comment.recipeId);

    return result[0];
  }

  async recomputeRecipeRating(recipeId: number): Promise<void> {
    const rows = await db
      .select({
        userId: comments.userId,
        rating: comments.rating,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(and(eq(comments.recipeId, recipeId), isNotNull(comments.rating)));

    const valid = rows.filter(
      (r): r is { userId: string; rating: number; createdAt: Date } =>
        r.rating !== null && r.createdAt !== null
    );

    const { rating, ratingCount } = computeRatingAggregate(valid);
    await this.updateRecipe(recipeId, { rating, ratingCount });
  }
```

- [ ] **Step 6 — persist empty content in the route**

In `src/app/api/recipes/[id]/comments/route.ts`, the `content` column is `notNull`, so store an empty string for a rating-only submission. Change the `createComment` call:
```ts
    const newComment = await storage.createComment({
      content: comment,
      rating: rating,
      userId: userId,
      recipeId: recipeId
    });
```
to:
```ts
    const newComment = await storage.createComment({
      content: (comment ?? "").trim(),
      rating: rating,
      userId: userId,
      recipeId: recipeId
    });
```

- [ ] **Step 7 — verify**: `npx vitest run src/test/lib/comment-schema.test.ts` → PASS. Then typecheck the touched non-test files: `npx tsc --noEmit 2>&1 | grep -E "storage\.ts|types\.ts|comments/route" || echo clean` → expect `clean`.

- [ ] **Step 8 — checkpoint (user commits)**: `src/lib/types.ts`, `src/lib/storage.ts`, `src/app/api/recipes/[id]/comments/route.ts`, `src/test/lib/comment-schema.test.ts`. Message: `feat: accept rating-only reviews and recompute recipe average`

---

## Task 3: `Rating` — interactive yellow mode

**Files:**
- Modify: `src/components/ui/rating.tsx`
- Test: `src/test/components/ui/Rating.test.tsx` (create)

- [ ] **Step 1 — failing test**

Create `src/test/components/ui/Rating.test.tsx`:
```tsx
import { render, screen, userEvent } from "@/test/utils";
import { Rating } from "@/components/ui/rating";

describe("Rating", () => {
  it("read-only renders amber filled stars and no buttons", () => {
    render(<Rating value={3} readOnly />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".star")).toHaveLength(5);
    expect(document.querySelectorAll(".star.filled")).toHaveLength(3);
    expect(document.querySelectorAll(".fill-yellow-400")).toHaveLength(0);
  });

  it("interactive fills yellow up to the resting value", () => {
    render(<Rating value={2} readOnly={false} onChange={() => {}} />);
    expect(document.querySelectorAll(".fill-yellow-400")).toHaveLength(2);
    expect(document.querySelectorAll(".star.filled")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("fills yellow up to the hovered star, then reverts on mouse leave", async () => {
    const user = userEvent.setup();
    render(<Rating value={0} readOnly={false} onChange={() => {}} />);
    const fourth = screen.getByRole("button", { name: "Rate 4 stars" });
    await user.hover(fourth);
    expect(document.querySelectorAll(".fill-yellow-400")).toHaveLength(4);
    await user.unhover(fourth);
    expect(document.querySelectorAll(".fill-yellow-400")).toHaveLength(0);
  });

  it("calls onChange with the clicked star", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating value={0} readOnly={false} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Rate 5 stars" }));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/ui/Rating.test.tsx` → FAIL (no hover state / no yellow / no role=button yet).

- [ ] **Step 3 — implement**

Replace the entire contents of `src/components/ui/rating.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  onChange?: (value: number) => void;
  count?: number;
  className?: string;
}

export function Rating({
  value,
  max = 5,
  size = "md",
  readOnly = true,
  onChange,
  count,
  className,
}: RatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  const threshold = hoverValue ?? value;

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div
      className={cn("flex items-center", className)}
      onMouseLeave={() => !readOnly && setHoverValue(null)}
    >
      <div className="star-rating">
        {stars.map((star) => {
          const filled = star <= threshold;
          return (
            <Star
              key={star}
              role={!readOnly ? "button" : undefined}
              aria-label={!readOnly ? `Rate ${star} star${star > 1 ? "s" : ""}` : undefined}
              className={cn(
                "star",
                sizeClasses[size],
                filled && (readOnly ? "filled" : "fill-yellow-400 text-yellow-400"),
                !readOnly && "cursor-pointer hover:scale-110 transition-transform"
              )}
              onMouseEnter={() => !readOnly && setHoverValue(star)}
              onClick={() => !readOnly && onChange?.(star)}
            />
          );
        })}
      </div>
      {count !== undefined && (
        <span className="text-xs ml-1 text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4 — run**: `npx vitest run src/test/components/ui/Rating.test.tsx` → PASS (4). Re-run the existing card test to confirm read-only displays are unaffected: `npx vitest run src/test/components/recipes/RecipeCard.test.tsx` → PASS.

- [ ] **Step 5 — checkpoint (user commits)**: `src/components/ui/rating.tsx`, `src/test/components/ui/Rating.test.tsx`. Message: `feat: interactive yellow hover mode for Rating`

---

## Task 4: `useRatingGate` hook

**Files:**
- Create: `src/hooks/useRatingGate.tsx`
- Test: `src/test/hooks/useRatingGate.test.tsx`

- [ ] **Step 1 — failing test**

Create `src/test/hooks/useRatingGate.test.tsx`:
```tsx
import { renderHook } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { AllProviders, mockSession } from "@/test/utils";
import { useRatingGate } from "@/hooks/useRatingGate";

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));

describe("useRatingGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs proceed when authenticated", () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
    const { result } = renderHook(() => useRatingGate(), { wrapper: AllProviders });
    const proceed = vi.fn();
    result.current(proceed);
    expect(proceed).toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("blocks and prompts sign-in when unauthenticated", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated" } as never);
    const { result } = renderHook(() => useRatingGate(), { wrapper: AllProviders });
    const proceed = vi.fn();
    result.current(proceed);
    expect(proceed).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sign in to rate" })
    );
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/hooks/useRatingGate.test.tsx` → FAIL (module not found).

- [ ] **Step 3 — implement**

Create `src/hooks/useRatingGate.tsx`:
```tsx
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

/**
 * Returns a guard that runs `proceed` only when the user is signed in.
 * Signed-out users get a sign-in prompt instead, so they are never led into a
 * rating/review they cannot submit.
 */
export function useRatingGate() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  return (proceed: () => void) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in to rate",
        description: "Please sign in to rate or review this recipe.",
        action: (
          <ToastAction altText="Sign in" asChild>
            <Link href="/api/auth/signin">Sign in</Link>
          </ToastAction>
        ),
      });
      return;
    }
    proceed();
  };
}
```

- [ ] **Step 4 — run**: `npx vitest run src/test/hooks/useRatingGate.test.tsx` → PASS (2).

- [ ] **Step 5 — checkpoint (user commits)**: `src/hooks/useRatingGate.tsx`, `src/test/hooks/useRatingGate.test.tsx`. Message: `feat: useRatingGate (sign-in gate for rating)`

---

## Task 5: `RecipeCard` — interactive footer stars

**Files:**
- Modify: `src/components/recipes/recipe-card.tsx`
- Test: `src/test/components/recipes/RecipeCard.test.tsx` (add tests + imports)

- [ ] **Step 1 — failing test**

In `src/test/components/recipes/RecipeCard.test.tsx`, add these imports at the top (next to the existing `@/test/utils` import):
```tsx
import { useSession } from 'next-auth/react'
import { mockSession } from '@/test/utils'
```
Then add inside the `describe('RecipeCard Component', ...)` block:
```tsx
  it('rates via a footer star when authenticated, without opening the card', async () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: 'authenticated' } as never)
    const user = userEvent.setup()
    const onRate = vi.fn()
    render(<RecipeCard recipe={mockRecipe} onClick={mockOnClick} onRate={onRate} />)
    await user.click(screen.getByRole('button', { name: 'Rate 4 stars' }))
    expect(onRate).toHaveBeenCalledWith(4)
    expect(mockOnClick).not.toHaveBeenCalled()
  })

  it('prompts sign-in instead of rating when unauthenticated', async () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    const user = userEvent.setup()
    const onRate = vi.fn()
    render(<RecipeCard recipe={mockRecipe} onClick={mockOnClick} onRate={onRate} />)
    await user.click(screen.getByRole('button', { name: 'Rate 4 stars' }))
    expect(onRate).not.toHaveBeenCalled()
    expect(mockOnClick).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/recipes/RecipeCard.test.tsx` → the two new tests FAIL (footer stars aren't interactive / no `onRate`).

- [ ] **Step 3 — implement**

In `src/components/recipes/recipe-card.tsx`:

(a) Add the import:
```tsx
import { useRatingGate } from "@/hooks/useRatingGate";
```

(b) Add `onRate` to the props interface:
```tsx
interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  onRate?: (rating: number) => void;
  className?: string;
}
```
and destructure it: `export function RecipeCard({ recipe, onClick, onRate, className }: RecipeCardProps) {`

(c) Inside the component body (near the other hooks), add:
```tsx
  const gate = useRatingGate();
```

(d) Replace the footer's `<Rating value={recipe.rating} count={recipe.ratingCount} />` line with a stop-propagation wrapper and gated interactivity:
```tsx
          <span className="inline-block" onClick={(e) => e.stopPropagation()}>
            <Rating
              value={recipe.rating}
              count={recipe.ratingCount}
              readOnly={!onRate}
              onChange={onRate ? (r) => gate(() => onRate(r)) : undefined}
            />
          </span>
```

- [ ] **Step 4 — run**: `npx vitest run src/test/components/recipes/RecipeCard.test.tsx` → PASS (all, including the existing favorite/tag tests). `npx tsc --noEmit 2>&1 | grep -i "recipe-card.tsx" || echo clean`.

- [ ] **Step 5 — checkpoint (user commits)**: `src/components/recipes/recipe-card.tsx`, `src/test/components/recipes/RecipeCard.test.tsx`. Message: `feat: interactive rating stars on recipe cards`

---

## Task 6: `RecipeDetailModal` — entry points + pre-filled form

**Files:**
- Modify: `src/components/recipes/recipe-detail-modal.tsx`
- Test: `src/test/components/recipes/RecipeDetailModal.test.tsx` (create)

- [ ] **Step 1 — failing test**

Create `src/test/components/recipes/RecipeDetailModal.test.tsx`:
```tsx
import { render, screen, userEvent } from "@/test/utils";
import { useSession } from "next-auth/react";
import { mockSession, mockRecipe } from "@/test/utils";
import { RecipeDetailModal } from "@/components/recipes/recipe-detail-modal";

beforeAll(() => {
  // @ts-expect-error minimal jsdom stubs for Radix Dialog/Select
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
});

describe("RecipeDetailModal ratings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the review form pre-filled when given an initialRating", () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
    render(<RecipeDetailModal recipe={mockRecipe} open initialRating={4} onClose={() => {}} />);
    expect(screen.getByText("Your Review")).toBeInTheDocument();
    expect(document.querySelectorAll(".fill-yellow-400").length).toBeGreaterThanOrEqual(4);
  });

  it("opens the form when an authenticated user clicks a star", async () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
    const user = userEvent.setup();
    render(<RecipeDetailModal recipe={mockRecipe} open onClose={() => {}} />);
    expect(screen.queryByText("Your Review")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Rate 5 stars" })[0]);
    expect(screen.getByText("Your Review")).toBeInTheDocument();
  });

  it("does not open the form for an unauthenticated click", async () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated" } as never);
    const user = userEvent.setup();
    render(<RecipeDetailModal recipe={mockRecipe} open onClose={() => {}} />);
    await user.click(screen.getAllByRole("button", { name: "Rate 5 stars" })[0]);
    expect(screen.queryByText("Your Review")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/recipes/RecipeDetailModal.test.tsx` → FAIL (no `initialRating`, stars not interactive).

- [ ] **Step 3 — implement**

In `src/components/recipes/recipe-detail-modal.tsx`:

(a) Add `useRef` to the React import and import the gate. The top of the file imports become:
```tsx
import { useEffect, useRef, useState } from "react";
```
and add with the other `@/` imports:
```tsx
import { useRatingGate } from "@/hooks/useRatingGate";
```

(b) Add `initialRating` to the props:
```tsx
interface RecipeDetailModalProps {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
  initialRating?: number;
}
```
and destructure: `export function RecipeDetailModal({ recipe, open, onClose, initialRating }: RecipeDetailModalProps) {`

(c) Inside the component (near the existing `useState` hooks), add the gate, a ref, and a `startReview` helper:
```tsx
  const gate = useRatingGate();
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  const startReview = (rating: number) => {
    setUserRating(rating);
    setShowCommentForm(true);
    setTimeout(
      () => reviewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50
    );
  };
```

(d) Add an effect that consumes `initialRating` when the modal opens. Place it next to the existing `useEffect` (after the `selectedServings` effect, before the `if (!recipe) return null;` guard):
```tsx
  useEffect(() => {
    if (open && recipe && initialRating && initialRating > 0) {
      startReview(initialRating);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe?.id, initialRating]);
```

(e) **Top summary hover-reveal.** Replace the rating summary span inside `data-testid="recipe-meta"`:
```tsx
                <span className="flex items-center text-sm">
                  <Star className="h-4 w-4 text-yellow-400 mr-1" />
                  {recipe.rating.toFixed(1)} ({recipe.ratingCount} ratings)
                </span>
```
with a `group` that reveals an interactive picker to its left (the picker's stars still fill left-to-right):
```tsx
                <span className="relative group flex items-center text-sm">
                  <span className="absolute right-full mr-2 flex items-center rounded-full bg-white/95 px-2 py-1 shadow opacity-0 -translate-x-1 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto">
                    <Rating
                      value={userRating}
                      size="sm"
                      readOnly={false}
                      onChange={(r) => gate(() => startReview(r))}
                    />
                  </span>
                  <Star className="h-4 w-4 text-yellow-400 mr-1" />
                  {recipe.rating.toFixed(1)} ({recipe.ratingCount} ratings)
                </span>
```

(f) **Bottom stars + "Write a Review" button.** Replace:
```tsx
              <div className="flex items-center mb-3">
                <Rating value={recipe.rating} readOnly />
                <Button
                  variant="link"
                  className="ml-4 text-sm text-primary font-medium"
                  onClick={() => setShowCommentForm(!showCommentForm)}
                >
                  Write a Review
                </Button>
              </div>
```
with:
```tsx
              <div className="flex items-center mb-3">
                <Rating
                  value={recipe.rating}
                  readOnly={false}
                  onChange={(r) => gate(() => startReview(r))}
                />
                <Button
                  variant="link"
                  className="ml-4 text-sm text-primary font-medium"
                  onClick={() => gate(() => setShowCommentForm((s) => !s))}
                >
                  Write a Review
                </Button>
              </div>
```

(g) **Scroll anchor.** Put the ref on the "Ratings & Reviews" section wrapper. Change its opening `<div>` (the one immediately after `<Separator className="my-6" />`, currently `<div>` wrapping the `<h3>Ratings & Reviews</h3>`) to:
```tsx
          <div ref={reviewSectionRef}>
```

(h) **Hide empty text for rating-only entries.** In the comments list, change:
```tsx
                    <p className="text-sm">{comment.content}</p>
```
to:
```tsx
                    {comment.content && <p className="text-sm">{comment.content}</p>}
```

- [ ] **Step 4 — run**: `npx vitest run src/test/components/recipes/RecipeDetailModal.test.tsx` → PASS (3). `npx tsc --noEmit 2>&1 | grep -i "recipe-detail-modal.tsx" || echo clean`.

- [ ] **Step 5 — checkpoint (user commits)**: `src/components/recipes/recipe-detail-modal.tsx`, `src/test/components/recipes/RecipeDetailModal.test.tsx`. Message: `feat: modal rating entry points + pre-filled review form`

---

## Task 7: Thread the preselected rating — `RecipeBrowser` + pages

**Files:**
- Modify: `src/components/recipes/recipe-browser.tsx`
- Modify: `src/app/page.tsx` (home)
- Modify: `src/app/search/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Test: `src/test/components/recipes/RecipeBrowser.test.tsx` (add a test)

- [ ] **Step 1 — failing test**

In `src/test/components/recipes/RecipeBrowser.test.tsx`, ensure these imports exist at the top (add any that are missing):
```tsx
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { mockSession, mockRecipe } from "@/test/utils";
```
Then add inside the `describe(...)`:
```tsx
  it("calls onRecipeRate when an authenticated user clicks a card star", async () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
    vi.mocked(useQuery).mockReturnValue({
      data: { recipes: [mockRecipe], total: 1 },
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    } as never);
    const onRecipeRate = vi.fn();
    const user = userEvent.setup();
    render(
      <RecipeBrowser
        params={{ search: "", filters: [], sort: "popular" }}
        onParamsChange={() => {}}
        onRecipeClick={() => {}}
        onRecipeRate={onRecipeRate}
      />
    );
    await user.click(screen.getByRole("button", { name: "Rate 3 stars" }));
    expect(onRecipeRate).toHaveBeenCalledWith(mockRecipe, 3);
  });
```

- [ ] **Step 2 — run, confirm fail**: `npx vitest run src/test/components/recipes/RecipeBrowser.test.tsx` → the new test FAILS (`onRecipeRate` not wired).

- [ ] **Step 3 — `RecipeBrowser`**

In `src/components/recipes/recipe-browser.tsx`:

(a) Add `onRecipeRate` to the props interface:
```tsx
interface RecipeBrowserProps {
  params: RecipeBrowserParams;
  onParamsChange: (next: RecipeBrowserParams) => void;
  onRecipeClick: (recipe: Recipe) => void;
  onRecipeRate?: (recipe: Recipe, rating: number) => void;
  showSearch?: boolean;
}
```
and destructure it in the function signature: `export function RecipeBrowser({ params, onParamsChange, onRecipeClick, onRecipeRate, showSearch }: RecipeBrowserProps) {`

(b) Pass it to each card. Change the `<RecipeCard recipe={recipe} onClick={() => onRecipeClick(recipe)} />` to:
```tsx
                  <RecipeCard
                    recipe={recipe}
                    onClick={() => onRecipeClick(recipe)}
                    onRate={onRecipeRate ? (r) => onRecipeRate(recipe, r) : undefined}
                  />
```

- [ ] **Step 4 — run, confirm pass**: `npx vitest run src/test/components/recipes/RecipeBrowser.test.tsx` → PASS (all).

- [ ] **Step 5 — home page**

In `src/app/page.tsx`:

(a) Add pending-rating state and a rate handler; clear it on a normal open and on close:
```tsx
  const [pendingRating, setPendingRating] = useState<number | undefined>(undefined);

  const openRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setPendingRating(undefined);
    setIsModalOpen(true);
  };

  const rateRecipe = (recipe: Recipe, rating: number) => {
    setSelectedRecipe(recipe);
    setPendingRating(rating);
    setIsModalOpen(true);
  };
```
(Replace the existing `openRecipe` with the version above.)

(b) Pass `onRecipeRate` to the browser:
```tsx
            <RecipeBrowser params={params} onParamsChange={setParams} onRecipeClick={openRecipe} onRecipeRate={rateRecipe} />
```

(c) Pass `initialRating` and clear on close:
```tsx
      <RecipeDetailModal
        recipe={selectedRecipe}
        open={isModalOpen}
        initialRating={pendingRating}
        onClose={() => { setIsModalOpen(false); setPendingRating(undefined); }}
      />
```

- [ ] **Step 6 — search page**

In `src/app/search/page.tsx` (inside `SearchPageContent`), mirror the home wiring:

(a) Add state + handler near the existing `useState` calls:
```tsx
  const [pendingRating, setPendingRating] = useState<number | undefined>(undefined);

  const rateRecipe = (recipe: Recipe, rating: number) => {
    setSelectedRecipe(recipe);
    setPendingRating(rating);
    setIsModalOpen(true);
  };
```

(b) On the existing `<RecipeBrowser … showSearch />`, add the rate prop and clear `pendingRating` when opening normally. Change:
```tsx
      <RecipeBrowser
        params={params}
        onParamsChange={writeParams}
        onRecipeClick={(r) => { setSelectedRecipe(r); setIsModalOpen(true); }}
        showSearch
      />
```
to:
```tsx
      <RecipeBrowser
        params={params}
        onParamsChange={writeParams}
        onRecipeClick={(r) => { setSelectedRecipe(r); setPendingRating(undefined); setIsModalOpen(true); }}
        onRecipeRate={rateRecipe}
        showSearch
      />
```

(c) Update the modal:
```tsx
      <RecipeDetailModal recipe={selectedRecipe} open={isModalOpen} initialRating={pendingRating} onClose={() => { setIsModalOpen(false); setPendingRating(undefined); }} />
```

- [ ] **Step 7 — dashboard page**

In `src/app/dashboard/page.tsx`:

(a) Add pending-rating state and a rate handler, and clear it on open/close. Replace the existing `openRecipeDetails`/`closeRecipeDetails`:
```tsx
  const openRecipeDetails = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };

  const closeRecipeDetails = () => {
    setIsModalOpen(false);
  };
```
with:
```tsx
  const [pendingRating, setPendingRating] = useState<number | undefined>(undefined);

  const openRecipeDetails = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setPendingRating(undefined);
    setIsModalOpen(true);
  };

  const rateRecipe = (recipe: Recipe, rating: number) => {
    setSelectedRecipe(recipe);
    setPendingRating(rating);
    setIsModalOpen(true);
  };

  const closeRecipeDetails = () => {
    setIsModalOpen(false);
    setPendingRating(undefined);
  };
```

(b) On BOTH the Saved and Generated `RecipeCard`s, add `onRate`. Each currently reads:
```tsx
                            <RecipeCard
                              key={recipe.id}
                              recipe={recipe}
                              onClick={() => openRecipeDetails(recipe)}
                            />
```
Change both to:
```tsx
                            <RecipeCard
                              key={recipe.id}
                              recipe={recipe}
                              onClick={() => openRecipeDetails(recipe)}
                              onRate={(r) => rateRecipe(recipe, r)}
                            />
```

(c) Pass `initialRating` to the modal at the bottom of the file:
```tsx
      <RecipeDetailModal
        recipe={selectedRecipe}
        open={isModalOpen}
        initialRating={pendingRating}
        onClose={closeRecipeDetails}
      />
```

- [ ] **Step 8 — full verify**

- `npx vitest run 2>&1 | tail -5` → all test files pass.
- `npx tsc --noEmit 2>&1 | grep -vE "src/test/" | grep -iE "error TS" || echo "no non-test type errors"` → `no non-test type errors`.
- Re-run the existing page/integration tests that touch these files: `npx vitest run src/test/pages/dashboard.test.tsx src/test/components/recipes/RecipeBrowser.test.tsx` → PASS.

- [ ] **Step 9 — checkpoint (user commits)**: `src/components/recipes/recipe-browser.tsx`, `src/app/page.tsx`, `src/app/search/page.tsx`, `src/app/dashboard/page.tsx`, `src/test/components/recipes/RecipeBrowser.test.tsx`. Message: `feat: deep-link card star clicks into the modal review form`

---

## Notes for the implementer
- **No `git commit`** — leave each task's files uncommitted; the user commits.
- The `.fill-yellow-400` class string is asserted directly in tests — keep that exact class on interactive filled stars.
- `recomputeRecipeRating` is intentionally a thin DB wrapper around the unit-tested `computeRatingAggregate`; don't re-implement the aggregation in SQL.
- Smooth-scroll (`scrollIntoView`) isn't asserted under jsdom — tests stub it; the behavior is verified manually.
