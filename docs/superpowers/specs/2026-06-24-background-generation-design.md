# Background Recipe Generation — Design

**Date:** 2026-06-24
**Status:** Approved design, pending implementation plan

## Context

Recipe generation takes ~30–50s (GPT-4o + image generation + Edamam nutrition).
Today the flow is fully **blocking**: `RecipeCreator` (home page) shows `AILoadingModal`
with a **simulated** progress bar (`generationProgress` climbs by `Math.random() * 15`
every 800ms, capped at 95%) and a Cancel button. The user is locked behind the modal
until the single `POST /api/recipes/generate` request returns the recipe, at which point
`onRecipeGenerated` opens the detail modal. The post-generate
`queryClient.invalidateQueries(['/api/recipes'])` is called on the **dead singleton**
client (`@/lib/queryClient`), so the new recipe does not actually refresh into the
"Recommended For You" list (the known QueryClient-singleton no-op).

This feature makes generation **non-blocking and durable**: the user can dismiss the
modal, keep browsing (or navigate anywhere, or close the tab and come back), and be
notified when the recipe is ready — while still being able to *watch* it generate with a
real, checkpoint-driven progress view if they choose to wait.

## Goals

- Generation runs in the background; the user is never forced to wait behind a modal.
- **Durable**: survives navigation to other routes *and* quitting/returning to the app
  (reconnect to in-flight jobs on load).
- **Real progress**, not a fake bar: the modal shows actual server-side checkpoints.
- Two coexisting behaviors from one mechanism: **watch it in the modal** *or* **dismiss
  and wait for a toast**.
- **Vendor-neutral** durability — no Vercel Queues / Workflow lock-in; built on the
  existing Neon Postgres.
- Fix the QueryClient-singleton no-op so the finished recipe lands in the list.

## Non-goals / Out of scope

- **Multiple concurrent generations.** v1 is **single-in-flight** per user. The data
  model supports many, so multi is a later flip.
- **Vercel Queues / Workflow (WDK) / pg-boss.** Considered and rejected to avoid lock-in
  / an always-on worker host at this throughput.
- **Cross-device live sync** beyond what server-side job discovery already gives (no
  websockets/SSE — polling only).
- **Surfacing retry attempts in the UI** (retries are silent until hard failure — see
  Retry & error handling).
- **Loading-bar time calibration** as a separate concern — obviated here by real
  checkpoints. The old simulated-progress code is removed.

## Locked decisions

- **Durable Postgres job table** (`generation_jobs`) is the queue. No external queue
  product.
- **Push worker + reaper.** The create-job request dispatches the worker immediately via
  `waitUntil` (decoupled from the client connection); a small cron **reaper** fails jobs
  stuck past a timeout.
- **Single-in-flight** per user; the generate button disables while a job (including a
  reconnected stale one) is active.
- **Real-stage checklist** replaces the simulated bar: `recipe` → `image` → `nutrition`
  → `finalizing`.
- **App-level `GenerationProvider`** owns all job state, polling, reconnect, and
  notifications. The modal, header chip, toast, and recipe viewer are all consumers.
- **Retries are silent until hard failure**; **non-critical stages degrade gracefully**;
  the checklist is **monotonic within an attempt**.
- **No git commits by the assistant** — file/code changes only (user commits).

## Architecture overview

```
RecipeCreator.start(prompt, filters)
      │  POST /api/recipes/generate            ── insert job (pending), waitUntil(worker), return { jobId }
      ▼
GenerationProvider (app-level, in providers.tsx)
   • holds active job { jobId, status, stage }, modalDismissed, isGenerating
   • polls GET /api/recipes/generate/[jobId] ~2s
   • on mount: GET /api/recipes/generations/active → resume polling (reconnect)
   • on done: invalidate ['/api/recipes'] on the LIVE useQueryClient();
              open viewer (if modal open) OR fire toast (if backgrounded)
   • consumers: AILoadingModal · Header cooking chip · completion toast · recipe viewer
      ▲
      │  worker (waitUntil): writes `stage` per real step, persists recipe, status=done|error
      ▼
Postgres `generation_jobs`  ◀── reaper cron fails stale `processing`/`pending` jobs
```

## Data model — `generation_jobs` (`src/lib/schema.ts`)

Match existing `schema.ts` conventions: `serial` integer PK, `text` user FK, `jsonb`
`$type<string[]>()` arrays, `timestamp` with `defaultNow()` (as in `recipes`/`favorites`).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `serial` PK (int) | the `jobId` the client polls (owner-scoped, so an opaque guess is harmless) |
| `userId` | `text` FK → users | scopes polling and "my active jobs" |
| `status` | `text` | `pending` → `processing` → `done` \| `error` \| `cancelled` |
| `stage` | `text` | current checkpoint: `queued` \| `recipe` \| `image` \| `nutrition` \| `finalizing` |
| `prompt` | `text` | generation input (enables retry / re-run) |
| `dietaryFilters` | `jsonb` `$type<string[]>()` | generation input |
| `recipeId` | `integer` FK → recipes, nullable | set when `done` |
| `error` | `text`, nullable | message when `status = error` |
| `attempt` | `integer`, default 1 | caps internal worker retries; observability (not shown prominently) |
| `createdAt` | `timestamp` defaultNow | — |
| `updatedAt` | `timestamp` defaultNow | bumped on every stage change; drives the reaper |

## Backend

### `POST /api/recipes/generate` — contract change: returns a `jobId`, not the recipe
1. Auth (existing).
2. **Single-in-flight guard:** if the user has a `pending`/`processing` job, return `409`
   with that existing `{ jobId }` so the client re-attaches instead of starting a second.
3. Insert job (`status=pending`, `stage=queued`).
4. **Dispatch the worker:** `waitUntil(processGenerationJob(jobId))` — keeps the function
   working after the response, decoupled from the client connection.
   *Portable fallback (if Vercel is ever left): fire an internal fire-and-forget `fetch`
   to a `/process` route; the data layer is unchanged.*
5. Return `{ jobId }` (HTTP 202).

### Worker — `processGenerationJob(jobId)`
The existing generation logic (currently inline in the route), refactored into a function
that:
- sets `status=processing` and writes `stage` **before each real step**
  (`recipe` → `image` → `nutrition` → `finalizing`),
- reuses the app's **existing pooled Drizzle/Neon client** for the stage writes (never
  opens a fresh connection per write — avoids 100–300ms cold-connect cost; the writes are
  ~5–50ms bookkeeping in the gaps between expensive calls, well under 1% of job time),
- **internal retries are silent**: a transient step failure (e.g., malformed GPT JSON,
  image blip) is retried in place with short backoff up to `attempt` cap; `stage` does
  not move backward,
- **non-critical stages degrade gracefully**: only **recipe-text** failure is fatal;
  **image** failure falls back to a placeholder, **nutrition** (Edamam) falls back to its
  existing path — the job still reaches `done`,
- checks for `cancelled` at each stage boundary and bails before persisting,
- on success: insert the recipe, set `status=done, recipeId`,
- on exhausted/fatal failure: set `status=error, error=…`.

### `GET /api/recipes/generate/[jobId]` — poll target (owner-scoped)
Returns `{ status, stage, recipeId, recipe?, error? }`.

### `GET /api/recipes/generations/active` — reconnect-on-load (owner-scoped)
Returns the user's unfinished (`pending`/`processing`) jobs so the provider can resume
polling after navigation or a fresh visit ("quit and come back").

### Reaper — `GET/POST /api/cron/reap-generations`
Finds jobs in `processing`/`pending` whose `updatedAt` is older than ~3–5 min and marks
them `status=error, error="timed out"` so the client stops waiting and can retry. Wired
via Vercel Cron, but it is just a scheduled HTTP hit — any scheduler works (no lock-in).
**No silent auto-re-queue** (avoids double OpenAI/image cost and confusing progress
resets); recovery is the user's explicit "Try again".

## Client

### `GenerationProvider` (app-level, added to `src/components/providers.tsx`)
Single owner of generation state; everything else reads from it via context.

- **State:** active job `{ jobId, status, stage }`, `modalDismissed` flag, `isGenerating`.
- **`start(prompt, dietaryFilters)`** → `POST /api/recipes/generate` → store `jobId`,
  show modal, begin polling. No-op/blocked when a job is already active (single-in-flight).
- **Polling** (~2s `setInterval`): `GET …/[jobId]`, update `stage`. On terminal state:
  - `done` → invalidate `['/api/recipes']` on the **live** `useQueryClient()`; then if the
    modal is still open → open the recipe in the viewer; if backgrounded → completion toast.
  - `error` → error toast + retry affordance.
  - `cancelled` → drop silently.
- **Reconnect on mount** → `GET …/generations/active`; in-flight jobs resume polling in
  **backgrounded** mode (header chip + eventual toast, no surprise modal).
- **Cleanup:** clears intervals on unmount / terminal state.

### UI consumers
1. **Revamped `AILoadingModal`** — renders the active, non-dismissed job as a **real-stage
   checklist** (✓ completed, ⟳ current/spinning, ○ pending) for `recipe` → `image` →
   `nutrition` → `finalizing`. The simulated random bar is removed. After ~20s on a single
   stage, show a gentle "Taking a little longer than usual…" line (no scary retry text).
   Footer: **"Continue browsing"** (dismiss → background) and **"Cancel"** (abort). On
   `done` while open, hands off to the recipe viewer. On `error`, shows an error state with
   **"Try again"**.
2. **Header "cooking" chip** — in the app-shell `Header` (persists across navigation).
   Spinner + "Cooking…" while a job is active; clicking **re-opens** the modal (un-dismiss);
   disappears when the job resolves.
3. **Completion toast** — fired by the provider for backgrounded jobs: *"Your recipe is
   ready"* + **"View recipe"** action → `openRecipe`. Error variant on failure with
   **"Try again"**.
4. **Global recipe viewer** *(small refactor)* — lift the `RecipeDetailModal` open-state
   into context (`openRecipe(recipe, rating?)`), rendered once at app level. The home page
   (`src/app/page.tsx`) and the search page drop their local detail-modal state and call the
   context instead. This makes "View recipe" work from **any** route and de-duplicates the
   modal currently wired in multiple places. (Preserves the existing `pendingRating` /
   rate-from-card flow.)

## Retry & error handling

Three distinct meanings of "retry", represented differently:

1. **Transient within-step retries → invisible.** Worker retries the failing step in place
   with backoff (capped by `attempt`); the checklist never moves backward. Only concession:
   the ~20s "taking longer than usual" reassurance line.
2. **Non-critical stage failure → graceful degradation.** Only recipe-text failure is
   fatal; image → placeholder, nutrition → existing fallback; job still reaches `done`.
3. **Hard failure (retries exhausted / reaper timeout) → explicit error + manual retry.**
   Active viewer flips to an error state (modal "Try again" or error toast). "Try again"
   starts a **fresh attempt** (new job row); the checklist resets to the top as a new start.

**Governing rule:** checkmarks are **monotonic within an attempt** — retries spin in
place, never roll back; only a hard failure resets to a fresh attempt.

## Edge cases

- **Single-in-flight gating:** the generate button (custom prompt + guided modal entry)
  disables with a hint ("a recipe's already cooking") while any job is active, including a
  stale reconnected one, until it resolves.
- **Cancel:** provider marks the job `cancelled`; the worker checks at stage boundaries and
  bails before persisting; provider stops polling and drops the chip.
- **Auth:** all endpoints owner-scoped; unauthenticated generate keeps the existing
  sign-in redirect.
- **Already-persisted-but-cancelled:** if the worker finished before seeing the cancel
  flag, the recipe exists in the DB (and the list) but is not force-surfaced — acceptable.
- **Polling lifetime:** intervals clear on resolve/unmount; the server-side reaper bounds
  any job that never resolves.

## Testing

**Backend**
- Job creation returns `{ jobId }`; **single-in-flight** returns `409` + existing `jobId`.
- Worker transitions `stage` `recipe → image → nutrition → finalizing`; sets `done` +
  `recipeId` on success; sets `error` on fatal failure; **degrades** on image/nutrition
  failure (still `done`); honors the `cancelled` flag at a boundary.
- `GET …/[jobId]` and `GET …/generations/active` are **owner-scoped** (no cross-user leak).
- Reaper marks stale `processing`/`pending` jobs as `error: "timed out"`.

**Provider**
- `start → poll → done` invalidates `['/api/recipes']` on the live client and opens the
  viewer (modal open) or fires the toast (backgrounded).
- **Dismiss** keeps the job polling (no cancel); **cancel** stops it.
- **Reconnect on mount** from the active-jobs endpoint resumes a backgrounded job.
- **Single-in-flight** gating (`isGenerating`) blocks a second `start`.

**UI**
- Modal renders the **real-stage checklist** with monotonic checkmarks; the simulated bar
  is gone; the ~20s reassurance line appears.
- "Continue browsing" backgrounds (chip appears); the chip re-opens the modal.
- Completion toast's "View recipe" opens the viewer; the error state shows "Try again".

## Implementation notes

- Removes the simulated-progress `setInterval` and the dead-singleton
  `queryClient.invalidateQueries` from `recipe-creator.tsx` (generation logic moves into the
  provider; invalidation moves to the live `useQueryClient`). This also clears the known
  singleton no-op for this path; the other latent singleton usages
  (`admin/recipes`, `admin/users`, `recipe-creator`) are out of scope except where touched.
- `waitUntil` is the chosen keep-alive primitive on Vercel; confirm exact import/usage
  (`@vercel/functions`) during implementation. The data layer (job table + polling +
  reconnect) is platform-independent.
- DB stage writes must reuse the existing pooled client — call out in the plan so it isn't
  done with a per-write connection.
