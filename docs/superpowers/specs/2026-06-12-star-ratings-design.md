# Interactable Star Ratings — Design

**Date:** 2026-06-12
**Status:** Approved design, pending implementation plan

## Context

Recipe ratings are inert today. The `recipes.rating` column is an **integer** (no decimals) defaulting to 0, `ratingCount` defaults to 0, and `storage.createComment` **never recomputes** either — so every recipe shows 0 stars. The only rating UI is the modal's "Write a Review" form, whose discoverability is poor ("I didn't even know a section was open when I clicked 'Write a Review'"). The comment endpoint also can't accept a rating without text (`commentSchema.comment` is `min(1)`), and there is no `ratings` table or one-vote-per-user constraint.

This feature makes the stars an interactive entry point everywhere they appear and wires real persistence by **reusing the comments table** (no new table). Clicking stars never silently submits; it routes the user to the review form, pre-filled and scrolled into view, where an explicit Submit saves. Text on a review becomes optional.

## Locked decisions

- **Click = open the form, explicit Submit.** Clicking a star sets the rating, opens the review form (optional text) at the bottom of the modal, and scrolls to it. Nothing saves until the user presses Submit.
- **Latest rating per user counts once.** The recipe average is recomputed from the most recent rating per user; re-rating updates a user's vote. `ratingCount` = number of distinct raters.
- **Yellow for all interactive stars (resting and hover).** Interactive stars fill solid yellow (`fill-yellow-400 text-yellow-400`, filled interior) up to their threshold — both the resting `value` (e.g. a card's average) and the hover preview. Read-only displays (comment list, etc.) keep amber. *(The user will decide on review whether interactive resting should revert to amber, leaving yellow for hover only.)*
- **Gate rating at click-time, not just submit.** Logged-out users get a sign-in prompt the moment they click a star (or open the review form), so they never fill out a review they can't submit. Hover preview still works for everyone.
- **Reuse the comments table** for storage (per the persistence decision).

## Interaction model

Stars are a single "start a rating" affordance. Hovering fills them yellow **left-to-right** up to the hovered star, whole stars only (star 1 is leftmost; hovering the 3rd star fills 1–3). Mouse-leave reverts to the resting value. Clicking a star takes the user to the modal's review form, pre-filled with that rating, **form open and scrolled into view**.

Three entry points:

1. **Recipe card** — hovering the footer stars previews the fill; clicking opens that recipe's detail modal and scrolls down to the opened, pre-filled review form.
2. **Modal top summary** — the `★ 4.0 (N ratings)` summary. On hover, a five-star selector animates **open to the left** of the summary star (slide + fade). The stars inside still read and fill **left-to-right**. Clicking a star opens + scrolls to the bottom form, pre-filled.
3. **Modal bottom** — the stars next to "Write a Review" become interactive with the same hover-fill; clicking opens + scrolls the form, pre-filled. The "Write a Review" button stays as a secondary entry.

```
MODAL TOP — resting:            ...on hover (panel slides out leftward, stars fill L→R):
                                ┌─────────────────────────┐
   ★ 4.0  (128 ratings)         │ ★ ★ ★ ☆ ☆ │ ★ 4.0 (128) │   hovering the 3rd star
                                └─────────────────────────┘    fills stars 1–3 from the left
                                  click ─┘ opens + scrolls to review form below
```

The form's "Your Rating" stars reflect the pre-selected rating and remain editable. Submit allows rating-only (no text), or rating + text. After a successful save, queries invalidate so the new average appears on the card and modal.

## Architecture

### Backend — reuse comments (`src/lib/types.ts`, `src/lib/storage.ts`, `src/app/api/recipes/[id]/comments/route.ts`)

**Validation (`commentSchema`).** Make a rating-only submission valid:
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

**Route (`comments/route.ts`).** `content` is `notNull`, so persist an empty string when there's no text: `content: (comment ?? "").trim()`. Everything else (auth, user lookup, response shape) is unchanged.

**Recompute (`storage.ts`).** Add `recomputeRecipeRating(recipeId)` and call it at the end of `createComment` (single source of truth, so the aggregate is always consistent after any rating-bearing comment). It averages the latest rating per user:
```sql
SELECT COALESCE(ROUND(AVG(r)), 0)::int AS avg, COUNT(*)::int AS cnt
FROM (
  SELECT DISTINCT ON (user_id) rating AS r
  FROM comments
  WHERE recipe_id = $1 AND rating IS NOT NULL
  ORDER BY user_id, created_at DESC
) latest;
```
Then `updateRecipe(recipeId, { rating: avg, ratingCount: cnt })`. Rounding to an int matches the integer column ("no decimals"). Use Drizzle's `sql` raw template for the `DISTINCT ON` subquery (Postgres-specific).

**Reviews list display.** In the modal, render rating-only rows (empty `content`) as the stars with no text paragraph — guard the `<p>` on `comment.content`.

### `Rating` (`src/components/ui/rating.tsx`)

Add interactive behavior without breaking the many `readOnly` displays:
- Internal `const [hoverValue, setHoverValue] = useState<number | null>(null)`.
- **Fill rule:** the threshold is `hoverValue ?? value`; a star is filled when `star <= threshold`.
  - **Interactive** (`!readOnly`): filled stars use solid yellow (`fill-yellow-400 text-yellow-400`) — same color whether the fill comes from the resting `value` or the hover preview.
  - **Read-only** (default): filled stars use the existing amber `.star.filled`; `hoverValue` is never set; behavior is exactly as today.
- When `!readOnly`: each star gets `onMouseEnter={() => setHoverValue(star)}` and `onClick={() => onChange?.(star)}`; the container gets `onMouseLeave={() => setHoverValue(null)}`; interactive stars add `cursor-pointer` and keep a subtle `hover:scale-110`.
- Add an `aria-label` per star in interactive mode (e.g. `aria-label={`Rate ${star} star${star>1?"s":""}`}`) and `role="button"` for testability/accessibility.

### `RecipeCard` (`src/components/recipes/recipe-card.tsx`)

- New optional prop `onRate?: (rating: number) => void`.
- The footer `<Rating>` is wrapped in a `<span onClick={(e) => e.stopPropagation()}>` so a star click does not also trigger the card body's `onClick` (which opens the modal at the top). When `onRate` is provided, the Rating is interactive (`readOnly={false}`); its `onChange` runs through the auth gate: `onChange={(r) => gate(() => onRate(r))}` with `const gate = useRatingGate()`. Without `onRate`, the stars stay read-only. (Hover still previews for logged-out users; the gate only blocks the click.)
- Favorite-toggle logic is untouched.

### `RecipeDetailModal` (`src/components/recipes/recipe-detail-modal.tsx`)

- New optional prop `initialRating?: number`.
- A `reviewFormRef` (on the review section) drives scroll.
- An effect keyed on `[open, recipe?.id, initialRating]`: when the modal is open and `initialRating` is set, `setUserRating(initialRating)`, `setShowCommentForm(true)`, and `reviewFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })` (inside the modal's scroll container). The card has already passed the auth gate before opening the modal with `initialRating`, so this path does not re-gate.
- **Auth gate inside the modal:** `const gate = useRatingGate()`. The top selector, the bottom stars, and the "Write a Review" button each wrap their open-the-form action in `gate(() => { setUserRating(r); setShowCommentForm(true); scroll(); })`, so a logged-out click prompts sign-in instead of opening the form.
- **Top summary hover-reveal:** wrap the `★ 4.0 (N ratings)` summary in a `group relative`. A sibling panel positioned to its left (`absolute right-full mr-2`) holds an interactive `<Rating readOnly={false} value={userRating} … />` (a picker — empty/0 until a star is chosen, filling yellow L→R on hover) and is hidden/revealed with a CSS transition (`opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0`). Selecting a star calls the same handler: set rating → open form → scroll.
- **Bottom stars:** the `<Rating value={recipe.rating} readOnly />` next to "Write a Review" becomes interactive; click → set rating → open form → scroll.
- The form's existing "Your Rating" `<Rating readOnly={false} onChange={handleRatingChange}>` is kept (pre-filled, editable). `handleSubmitComment` already early-returns unless there is a rating or comment and already invalidates `/api/recipes/${id}` + `/api/recipes`; with the relaxed schema, rating-only now succeeds server-side.

### `RecipeBrowser` (`src/components/recipes/recipe-browser.tsx`)

- New optional prop `onRecipeRate?: (recipe: Recipe, rating: number) => void`, passed to each `RecipeCard` as `onRate={(r) => onRecipeRate?.(recipe, r)}`.

### Parents that own the modal

`src/app/page.tsx` (home) and `src/app/search/page.tsx` use `RecipeBrowser`; `src/app/dashboard/page.tsx` renders `RecipeCard` directly. Each holds a `pendingRating` state alongside `selectedRecipe`/`isModalOpen`:
- A "rate" handler sets `selectedRecipe`, `pendingRating`, and opens the modal.
- `<RecipeDetailModal initialRating={pendingRating} … />`; clear `pendingRating` on close (and on a normal body open, so opening the card normally doesn't pre-fill).

## Reuse / preserved

The `/api/recipes/[id]/comments` route contract (other than accepting rating-only), `requireAuth`, the modal's review form + comment list, the `RecipeCard` favorite flow, and the recipe list/sort all stay. The sort already orders by `desc(rating), desc(ratingCount), desc(createdAt)`, so once averages populate, ranking improves automatically.

## Auth — gate at click-time

Logged-out users should never be led into a review they can't submit, so every action that would **open the review form** is guarded: the card stars, the modal top/bottom star selectors, and the modal's "Write a Review" button. **Hover preview is not gated** — anyone can hover and see the yellow fill; the gate fires on click.

A small shared hook keeps this DRY and testable:

```ts
// src/hooks/useRatingGate.ts
export function useRatingGate() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  return (proceed: () => void) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in to rate",
        description: "Please sign in to rate or review this recipe.",
        action: <ToastAction altText="Sign in" asChild><Link href="/api/auth/signin">Sign in</Link></ToastAction>,
      });
      return;
    }
    proceed();
  };
}
```

Each star/form-open handler wraps its action: `gate(() => openFormWith(rating))`. The card guards before invoking `onRate`; the modal guards before opening the form. The server's `requireAuth` on the POST stays as the backstop (defense in depth), and its existing catch still toasts on the rare 401.

## Out of scope

- A dedicated `ratings` table / endpoint (we reuse comments by decision).
- A distinct "your rating" indicator separate from the average (resting display stays the average).
- Unifying read-only displays (comment list, non-interactive averages) to yellow — those stay amber; only interactive stars are yellow.
- Backfilling averages for existing recipes (they populate as users rate; a one-off recompute script is a later option).

## Testing

- **`Rating`**: interactive mode fills up to the hovered star and reverts on mouse-leave; interactive filled stars carry `fill-yellow-400` (both at rest from `value` and on hover); clicking calls `onChange(star)`; `readOnly` default renders no interactive handlers, keeps amber, and is unchanged.
- **`commentSchema`**: accepts `{ rating }` with no comment; accepts `{ comment }` with no rating; rejects `{}` (neither).
- **`recomputeRecipeRating`** (storage): given comments from two users where one re-rated, the average uses each user's latest rating, rounds to an int, and `ratingCount` equals the distinct-rater count. (Unit-test the aggregation; mock/seed the comments.)
- **`useRatingGate`** (exercised via the components): authenticated → `proceed` runs; unauthenticated → `proceed` does not run and a sign-in toast fires.
- **`RecipeCard`**: when authenticated, clicking a footer star calls `onRate(n)` and does **not** call the card's `onClick` (stopPropagation); when unauthenticated, the star click does **not** call `onRate` (gate blocks) and the card's `onClick` is not called either; with no `onRate`, stars are read-only.
- **`RecipeDetailModal`**: opening with `initialRating={4}` shows the review form open with the "Your Rating" stars at 4; the top hover-reveal panel renders an interactive selector; when authenticated, clicking a bottom star opens the form with that rating; when unauthenticated, clicking leaves the form closed (`showCommentForm` stays false). (Smooth-scroll isn't asserted under jsdom — assert form-open + rating state; stub `scrollIntoView`.)
- Full suite + non-test typecheck green.
