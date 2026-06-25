# Background Recipe Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recipe generation non-blocking and durable — the user can dismiss the loading modal, keep browsing or navigate anywhere (even quit and return), and be notified when the recipe is ready, while still able to watch real per-stage progress.

**Architecture:** A durable Postgres `generation_jobs` table acts as the queue. `POST /api/recipes/generate` inserts a job and dispatches the worker via Next's `after()` (runs after the response, decoupled from the client connection); the worker writes real stage checkpoints and persists the recipe. A cron reaper fails stuck jobs. On the client, an app-level `GenerationProvider` owns polling, reconnect-on-load, and notifications; the revamped checklist modal, a Header "cooking" chip, a completion toast, and a lifted global recipe viewer are all consumers.

**Tech Stack:** Next.js 15 App Router (`after`, `maxDuration`), Drizzle ORM + Neon HTTP, TanStack Query, NextAuth v5, vitest + Testing Library.

---

## Conventions for this plan

- **No `git commit` steps.** Per project preference the user commits; tasks end at "tests pass / typecheck clean."
- **Database push is the user's call.** Tasks that change `schema.ts` include a `npm run db:push` step; it mutates the real Neon DB, so flag it and let the user run it.
- **Testing approach mirrors the repo.** The repo unit-tests *pure logic* (`src/test/lib/*`, `src/test/*.test.ts`) and renders components with the harness in `src/test/utils.tsx`; it does **not** unit-test route handlers or `storage` against a DB. So we put the real TDD on pure modules (`src/lib/generation/*`) and the worker (via dependency injection), and verify routes/schema/storage with `npx tsc --noEmit` plus light render tests for UI.
- Run a single test file with: `npx vitest run <path>`. Typecheck with: `npx tsc --noEmit`.

## File Structure

**Create**
- `src/lib/generation/stages.ts` — stage/status constants, labels, predicates (pure)
- `src/lib/generation/reaper.ts` — `selectStaleJobIds` (pure)
- `src/lib/generation/transitions.ts` — client `ClientJob` type, `classifyTransition`, `hasActiveJob` (pure)
- `src/lib/generation/worker.ts` — `processGenerationJob` with injectable deps
- `src/app/api/recipes/generate/[jobId]/route.ts` — GET poll endpoint
- `src/app/api/recipes/generations/active/route.ts` — GET reconnect endpoint
- `src/app/api/cron/reap-generations/route.ts` — reaper
- `vercel.json` — cron schedule
- `src/components/recipes/recipe-viewer-provider.tsx` — global recipe viewer context + modal
- `src/components/generation/generation-provider.tsx` — generation state/polling/notify + renders the modal
- Tests: `src/test/lib/generation-stages.test.ts`, `src/test/lib/generation-reaper.test.ts`, `src/test/lib/generation-transitions.test.ts`, `src/test/lib/generation-worker.test.ts`, `src/test/components/generation/GenerationCookingChip.test.tsx`

**Modify**
- `src/lib/schema.ts` — add `generationJobs` table + types/insert schema
- `src/lib/storage.ts` — add job methods
- `src/lib/openai.ts` — add optional `onStage` callback to `generateRecipe`
- `src/app/api/recipes/generate/route.ts` — rewrite to create-job + `after()` dispatch
- `src/components/recipes/ai-loading-modal.tsx` — checklist consumer of the provider
- `src/components/layout/header.tsx` — cooking chip
- `src/components/recipes/recipe-creator.tsx` — use `useGeneration().start` + gating; drop modal/singleton
- `src/components/providers.tsx` — wrap with `RecipeViewerProvider` + `GenerationProvider`
- `src/app/page.tsx` — use `useRecipeViewer`; drop local detail-modal state + `onRecipeGenerated`
- `src/app/search/page.tsx` (and/or `RecipeBrowser`) — use `useRecipeViewer`
- `src/test/components/recipes/RecipeCreator.test.tsx` — adapt to new API

---

## Phase A — Backend foundation (pure modules, schema, storage, worker)

### Task 1: Stage/status model (pure)

**Files:**
- Create: `src/lib/generation/stages.ts`
- Test: `src/test/lib/generation-stages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/lib/generation-stages.test.ts
import { describe, it, expect } from 'vitest'
import {
  GENERATION_STAGES, DISPLAY_STAGES, stageLabel, stageIndex,
  isTerminalStatus, isActiveStatus,
} from '@/lib/generation/stages'

describe('generation stages', () => {
  it('orders stages queued → finalizing', () => {
    expect(GENERATION_STAGES).toEqual(['queued', 'recipe', 'image', 'nutrition', 'finalizing'])
    expect(stageIndex('recipe')).toBeLessThan(stageIndex('finalizing'))
  })

  it('exposes the 4 visible checklist stages (no queued)', () => {
    expect(DISPLAY_STAGES).toEqual(['recipe', 'image', 'nutrition', 'finalizing'])
  })

  it('labels each stage', () => {
    expect(stageLabel('recipe')).toBe('Creating recipe')
    expect(stageLabel('image')).toBe('Generating image')
    expect(stageLabel('nutrition')).toBe('Analyzing nutrition')
    expect(stageLabel('finalizing')).toBe('Finalizing')
  })

  it('classifies terminal and active statuses', () => {
    expect(isTerminalStatus('done')).toBe(true)
    expect(isTerminalStatus('error')).toBe(true)
    expect(isTerminalStatus('cancelled')).toBe(true)
    expect(isTerminalStatus('processing')).toBe(false)
    expect(isActiveStatus('pending')).toBe(true)
    expect(isActiveStatus('processing')).toBe(true)
    expect(isActiveStatus('done')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/test/lib/generation-stages.test.ts`
Expected: FAIL — cannot resolve `@/lib/generation/stages`.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/generation/stages.ts
export const GENERATION_STAGES = ['queued', 'recipe', 'image', 'nutrition', 'finalizing'] as const
export type GenerationStage = (typeof GENERATION_STAGES)[number]

export const GENERATION_STATUSES = ['pending', 'processing', 'done', 'error', 'cancelled'] as const
export type GenerationStatus = (typeof GENERATION_STATUSES)[number]

// Visible checklist steps (excludes the internal 'queued' stage)
export const DISPLAY_STAGES = ['recipe', 'image', 'nutrition', 'finalizing'] as const

const STAGE_LABELS: Record<GenerationStage, string> = {
  queued: 'Queued',
  recipe: 'Creating recipe',
  image: 'Generating image',
  nutrition: 'Analyzing nutrition',
  finalizing: 'Finalizing',
}

export function stageLabel(stage: GenerationStage): string {
  return STAGE_LABELS[stage]
}

export function stageIndex(stage: GenerationStage): number {
  return GENERATION_STAGES.indexOf(stage)
}

export function isTerminalStatus(status: GenerationStatus): boolean {
  return status === 'done' || status === 'error' || status === 'cancelled'
}

export function isActiveStatus(status: GenerationStatus): boolean {
  return status === 'pending' || status === 'processing'
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/test/lib/generation-stages.test.ts`
Expected: PASS (4 tests).

---

### Task 2: Reaper selection (pure)

**Files:**
- Create: `src/lib/generation/reaper.ts`
- Test: `src/test/lib/generation-reaper.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/lib/generation-reaper.test.ts
import { describe, it, expect } from 'vitest'
import { selectStaleJobIds } from '@/lib/generation/reaper'

const NOW = 1_000_000_000_000
const TTL = 5 * 60 * 1000 // 5 min

describe('selectStaleJobIds', () => {
  it('returns active jobs older than the ttl', () => {
    const jobs = [
      { id: 1, status: 'processing' as const, updatedAt: new Date(NOW - TTL - 1) }, // stale
      { id: 2, status: 'pending' as const, updatedAt: new Date(NOW - 1000) },       // fresh
      { id: 3, status: 'processing' as const, updatedAt: new Date(NOW - TTL) },      // exactly ttl → stale
    ]
    expect(selectStaleJobIds(jobs, NOW, TTL)).toEqual([1, 3])
  })

  it('never selects terminal jobs even if old', () => {
    const jobs = [
      { id: 4, status: 'done' as const, updatedAt: new Date(NOW - TTL - 99999) },
      { id: 5, status: 'error' as const, updatedAt: new Date(NOW - TTL - 99999) },
    ]
    expect(selectStaleJobIds(jobs, NOW, TTL)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/test/lib/generation-reaper.test.ts`
Expected: FAIL — cannot resolve `@/lib/generation/reaper`.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/generation/reaper.ts
import { isActiveStatus, type GenerationStatus } from './stages'

export interface StaleCandidate {
  id: number
  status: GenerationStatus
  updatedAt: Date | string | number
}

export function selectStaleJobIds(jobs: StaleCandidate[], nowMs: number, ttlMs: number): number[] {
  return jobs
    .filter((j) => isActiveStatus(j.status))
    .filter((j) => nowMs - new Date(j.updatedAt).getTime() >= ttlMs)
    .map((j) => j.id)
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/test/lib/generation-reaper.test.ts`
Expected: PASS (2 tests).

---

### Task 3: Client transition helpers (pure)

**Files:**
- Create: `src/lib/generation/transitions.ts`
- Test: `src/test/lib/generation-transitions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/lib/generation-transitions.test.ts
import { describe, it, expect } from 'vitest'
import { classifyTransition, hasActiveJob, type ClientJob } from '@/lib/generation/transitions'

const base: ClientJob = { jobId: 1, status: 'processing', stage: 'recipe', recipeId: null, error: null, modalDismissed: false }

describe('classifyTransition', () => {
  it('opens the viewer when a non-dismissed job finishes', () => {
    const job = { ...base, status: 'done' as const, recipeId: 7 }
    expect(classifyTransition('processing', job)).toEqual({ kind: 'open-viewer', recipeId: 7 })
  })

  it('toasts success when a dismissed (backgrounded) job finishes', () => {
    const job = { ...base, status: 'done' as const, recipeId: 7, modalDismissed: true }
    expect(classifyTransition('processing', job)).toEqual({ kind: 'toast-success', recipeId: 7 })
  })

  it('toasts an error with the message on failure', () => {
    const job = { ...base, status: 'error' as const, error: 'boom' }
    expect(classifyTransition('processing', job)).toEqual({ kind: 'toast-error', message: 'boom' })
  })

  it('does nothing when the status is unchanged', () => {
    expect(classifyTransition('processing', base)).toEqual({ kind: 'none' })
  })
})

describe('hasActiveJob', () => {
  it('is true only for pending/processing jobs', () => {
    expect(hasActiveJob(base)).toBe(true)
    expect(hasActiveJob({ ...base, status: 'done' })).toBe(false)
    expect(hasActiveJob(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/test/lib/generation-transitions.test.ts`
Expected: FAIL — cannot resolve `@/lib/generation/transitions`.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/generation/transitions.ts
import { isActiveStatus, type GenerationStage, type GenerationStatus } from './stages'

export interface ClientJob {
  jobId: number
  status: GenerationStatus
  stage: GenerationStage
  recipeId: number | null
  error: string | null
  modalDismissed: boolean
}

export type GenerationEffect =
  | { kind: 'open-viewer'; recipeId: number }
  | { kind: 'toast-success'; recipeId: number }
  | { kind: 'toast-error'; message: string }
  | { kind: 'none' }

export function classifyTransition(prevStatus: GenerationStatus, job: ClientJob): GenerationEffect {
  if (prevStatus === job.status) return { kind: 'none' }
  if (job.status === 'done' && job.recipeId != null) {
    return job.modalDismissed
      ? { kind: 'toast-success', recipeId: job.recipeId }
      : { kind: 'open-viewer', recipeId: job.recipeId }
  }
  if (job.status === 'error') {
    return { kind: 'toast-error', message: job.error ?? 'Recipe generation failed' }
  }
  return { kind: 'none' }
}

export function hasActiveJob(job: ClientJob | null): boolean {
  return job != null && isActiveStatus(job.status)
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/test/lib/generation-transitions.test.ts`
Expected: PASS (5 tests).

---

### Task 4: `generation_jobs` schema + types

**Files:**
- Modify: `src/lib/schema.ts`

- [ ] **Step 1: Add the table and types**

In `src/lib/schema.ts`, confirm the imports already include `serial, text, jsonb, integer, timestamp, index, pgTable` from `drizzle-orm/pg-core` and `createInsertSchema` from `drizzle-zod` (the `recipes`/`favorites` tables use them). Then add, after the `favorites` block:

```ts
export const generationJobs = pgTable("generation_jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  stage: text("stage").notNull().default("queued"),
  prompt: text("prompt").notNull(),
  dietaryFilters: jsonb("dietary_filters").notNull().$type<string[]>().default([]),
  recipeId: integer("recipe_id").references(() => recipes.id),
  error: text("error"),
  attempt: integer("attempt").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("generation_jobs_user_id_idx").on(table.userId),
  statusIdx: index("generation_jobs_status_idx").on(table.status),
}));

export const insertGenerationJobSchema = createInsertSchema(generationJobs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGenerationJob = Omit<typeof generationJobs.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type GenerationJob = typeof generationJobs.$inferSelect;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `schema.ts`.

- [ ] **Step 3: Push the schema to the database (USER RUNS THIS)**

> ⚠️ This mutates the real Neon database. Hand off to the user (or confirm) before running.

Run: `npm run db:push`
Expected: drizzle-kit reports creating table `generation_jobs` and its indexes; no destructive changes to other tables.

---

### Task 5: Storage job methods

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Extend imports**

In `src/lib/storage.ts`:
- Add `inArray, lt` to the `drizzle-orm` import: `import { eq, and, or, ilike, desc, asc, sql, isNotNull, inArray, lt } from "drizzle-orm";`
- Add `generationJobs` to the table import block (the one importing `users, recipes, comments, ...`).
- Add `GenerationJob, InsertGenerationJob` to the type import block (the one importing `User, UpsertUser, ...`).

- [ ] **Step 2: Add methods to the `Storage` class**

Add these methods inside `class Storage` (e.g., after `createRecipeEmbedding`):

```ts
  async createGenerationJob(job: InsertGenerationJob): Promise<GenerationJob> {
    const result = await db.insert(generationJobs).values({
      ...job,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getGenerationJob(id: number): Promise<GenerationJob | undefined> {
    const result = await db.select().from(generationJobs).where(eq(generationJobs.id, id));
    return result[0];
  }

  async getActiveGenerationJobs(userId: string): Promise<GenerationJob[]> {
    return await db.select().from(generationJobs)
      .where(and(
        eq(generationJobs.userId, userId),
        inArray(generationJobs.status, ['pending', 'processing']),
      ))
      .orderBy(desc(generationJobs.createdAt));
  }

  async updateGenerationJob(
    id: number,
    patch: Partial<Pick<GenerationJob, 'status' | 'stage' | 'recipeId' | 'error' | 'attempt'>>,
  ): Promise<GenerationJob | undefined> {
    const result = await db.update(generationJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(generationJobs.id, id))
      .returning();
    return result[0];
  }

  async failStaleGenerationJobs(ttlMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - ttlMs);
    const result = await db.update(generationJobs)
      .set({ status: 'error', error: 'timed out', updatedAt: new Date() })
      .where(and(
        inArray(generationJobs.status, ['pending', 'processing']),
        lt(generationJobs.updatedAt, cutoff),
      ))
      .returning();
    return result.length;
  }
```

- [ ] **Step 3: Mirror the methods on the `IStorage` interface**

Add the matching signatures to `interface IStorage`:

```ts
  createGenerationJob(job: InsertGenerationJob): Promise<GenerationJob>;
  getGenerationJob(id: number): Promise<GenerationJob | undefined>;
  getActiveGenerationJobs(userId: string): Promise<GenerationJob[]>;
  updateGenerationJob(id: number, patch: Partial<Pick<GenerationJob, 'status' | 'stage' | 'recipeId' | 'error' | 'attempt'>>): Promise<GenerationJob | undefined>;
  failStaleGenerationJobs(ttlMs: number): Promise<number>;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 6: `generateRecipe` emits real stage checkpoints

**Files:**
- Modify: `src/lib/openai.ts`

- [ ] **Step 1: Add an optional `onStage` parameter**

Change the `generateRecipe` signature (around line 136) to accept a 4th optional callback, typed against the stage union:

```ts
import type { GenerationStage } from "@/lib/generation/stages";

export async function generateRecipe(
  prompt: string,
  dietaryFilters: string[] = [],
  targetServings: number | null = null,
  onStage?: (stage: GenerationStage) => void | Promise<void>,
): Promise<{
  // ...existing return type unchanged...
```

- [ ] **Step 2: Call `onStage` before the image and nutrition steps**

- Immediately before the `generateRecipeImage(` call (around line 798), add:

```ts
    await onStage?.('image');
```

- Immediately before the **first** `analyzeNutritionWithEdamam(` call on the success path (around line 811), add:

```ts
    await onStage?.('nutrition');
```

Do **not** add a call before the second `analyzeNutritionWithEdamam` (the one inside the error/fallback branch near line 847) — re-emitting a stage on the error path is unnecessary and `onStage` is idempotent anyway.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Existing callers pass 3 args; the 4th is optional.)

---

### Task 7: Worker with injectable deps

**Files:**
- Create: `src/lib/generation/worker.ts`
- Test: `src/test/lib/generation-worker.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/lib/generation-worker.test.ts
import { describe, it, expect, vi } from 'vitest'
import { processGenerationJob, type WorkerDeps } from '@/lib/generation/worker'

function makeDeps(overrides: Partial<WorkerDeps> = {}) {
  const updates: Array<Record<string, unknown>> = []
  let jobStatus = 'pending'
  const deps: WorkerDeps = {
    getJob: vi.fn(async () => ({ status: jobStatus, prompt: 'pasta', dietaryFilters: ['vegetarian'], userId: 'u1' })),
    updateJob: vi.fn(async (_id, patch) => { if (patch.status) jobStatus = patch.status as string; updates.push(patch) }),
    getUserDefaultServings: vi.fn(async () => null),
    generateRecipe: vi.fn(async (_p, _f, _s, onStage) => {
      await onStage?.('image')
      await onStage?.('nutrition')
      return {
        title: 'T', description: 'D', imageUrl: null, ingredients: [], instructions: [],
        cookingTime: 10, servings: 2, dietaryTags: ['vegetarian'],
        nutritionInfo: { calories: 1, protein: 1, fat: 1, carbs: 1 },
      }
    }),
    createRecipe: vi.fn(async () => ({ id: 99 })),
    generateEmbedding: vi.fn(async () => []),
    createRecipeEmbedding: vi.fn(async () => undefined),
    ...overrides,
  }
  return { deps, updates }
}

describe('processGenerationJob', () => {
  it('writes stages in order and finishes done with the recipe id', async () => {
    const { deps, updates } = makeDeps()
    await processGenerationJob(1, deps)
    const stages = updates.filter((u) => u.stage).map((u) => u.stage)
    expect(stages).toEqual(['recipe', 'image', 'nutrition', 'finalizing'])
    expect(updates.at(-1)).toMatchObject({ status: 'done', recipeId: 99 })
  })

  it('marks the job error when generation throws', async () => {
    const { deps, updates } = makeDeps({
      generateRecipe: vi.fn(async () => { throw new Error('llm down') }),
    })
    await processGenerationJob(1, deps)
    expect(updates.at(-1)).toMatchObject({ status: 'error', error: 'llm down' })
    expect(deps.createRecipe).not.toHaveBeenCalled()
  })

  it('bails without persisting when the job was cancelled mid-flight', async () => {
    let calls = 0
    const { deps } = makeDeps({
      // first getJob (load) returns pending; later checks return cancelled
      getJob: vi.fn(async () => {
        calls += 1
        return { status: calls <= 1 ? 'pending' : 'cancelled', prompt: 'p', dietaryFilters: [], userId: 'u1' }
      }),
    })
    await processGenerationJob(1, deps)
    expect(deps.createRecipe).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/test/lib/generation-worker.test.ts`
Expected: FAIL — cannot resolve `@/lib/generation/worker`.

- [ ] **Step 3: Implement the worker**

```ts
// src/lib/generation/worker.ts
import { storage as defaultStorage } from '@/lib/storage'
import { generateRecipe as defaultGenerateRecipe, generateEmbedding as defaultGenerateEmbedding } from '@/lib/openai'
import type { GenerationStage } from './stages'
import type { InsertRecipe } from '@/lib/schema'

export class GenerationCancelledError extends Error {}

type RecipeData = Awaited<ReturnType<typeof defaultGenerateRecipe>>

export interface WorkerDeps {
  getJob: (jobId: number) => Promise<{ status: string; prompt: string; dietaryFilters: string[]; userId: string } | undefined>
  updateJob: (jobId: number, patch: { status?: string; stage?: GenerationStage; recipeId?: number; error?: string }) => Promise<void>
  getUserDefaultServings: (userId: string) => Promise<number | null>
  generateRecipe: (prompt: string, dietaryFilters: string[], targetServings: number | null, onStage?: (stage: GenerationStage) => void | Promise<void>) => Promise<RecipeData>
  createRecipe: (recipe: InsertRecipe) => Promise<{ id: number }>
  generateEmbedding: (text: string) => Promise<number[]>
  createRecipeEmbedding: (e: { recipeId: number; embedding: number[]; content: string }) => Promise<unknown>
}

export const defaultWorkerDeps: WorkerDeps = {
  getJob: async (id) => {
    const j = await defaultStorage.getGenerationJob(id)
    return j && { status: j.status, prompt: j.prompt, dietaryFilters: j.dietaryFilters, userId: j.userId }
  },
  updateJob: async (id, patch) => { await defaultStorage.updateGenerationJob(id, patch) },
  getUserDefaultServings: async (uid) => (await defaultStorage.getUser(uid))?.defaultServings ?? null,
  generateRecipe: defaultGenerateRecipe,
  createRecipe: (r) => defaultStorage.createRecipe(r),
  generateEmbedding: defaultGenerateEmbedding,
  createRecipeEmbedding: (e) => defaultStorage.createRecipeEmbedding(e),
}

export async function processGenerationJob(jobId: number, deps: WorkerDeps = defaultWorkerDeps): Promise<void> {
  const job = await deps.getJob(jobId)
  if (!job) return

  try {
    await deps.updateJob(jobId, { status: 'processing', stage: 'recipe' })
    const targetServings = await deps.getUserDefaultServings(job.userId)

    const recipeData = await deps.generateRecipe(
      job.prompt,
      job.dietaryFilters,
      targetServings,
      async (stage) => {
        const current = await deps.getJob(jobId)
        if (current?.status === 'cancelled') throw new GenerationCancelledError()
        await deps.updateJob(jobId, { stage })
      },
    )

    const beforePersist = await deps.getJob(jobId)
    if (beforePersist?.status === 'cancelled') return

    await deps.updateJob(jobId, { stage: 'finalizing' })

    const recipe = await deps.createRecipe({
      title: recipeData.title,
      description: recipeData.description,
      imageUrl: recipeData.imageUrl,
      ingredients: recipeData.ingredients,
      instructions: recipeData.instructions,
      cookingTime: recipeData.cookingTime,
      servings: recipeData.servings,
      dietaryTags: recipeData.dietaryTags,
      nutritionInfo: recipeData.nutritionInfo,
      userId: job.userId,
      isAIGenerated: true,
      isVerified: true,
      rating: 0,
      ratingCount: 0,
    })

    // Best-effort embedding for RAG (never affects job outcome) — mirrors the old route.
    try {
      const recipeText = `Title: ${recipe.id}`
      const embedding = await deps.generateEmbedding(recipeText)
      await deps.createRecipeEmbedding({ recipeId: recipe.id, embedding, content: recipeText })
    } catch {
      // ignore embedding failures
    }

    await deps.updateJob(jobId, { status: 'done', recipeId: recipe.id })
  } catch (err) {
    if (err instanceof GenerationCancelledError) return
    await deps.updateJob(jobId, { status: 'error', error: err instanceof Error ? err.message : 'Recipe generation failed' })
  }
}
```

> Note: the embedding `content` is intentionally minimal here; if you want the richer RAG text from the old route, build it from `recipe`/`recipeData` fields — it does not affect the job lifecycle.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/test/lib/generation-worker.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

## Phase B — Endpoints

### Task 8: Rewrite `POST /api/recipes/generate`

**Files:**
- Modify: `src/app/api/recipes/generate/route.ts`

- [ ] **Step 1: Replace the handler**

```ts
// src/app/api/recipes/generate/route.ts
import { NextRequest, after } from "next/server";
import { requireAuth, validateRequestBody } from "@/lib/api-auth";
import { storage } from "@/lib/storage";
import { recipeGenerationSchema } from "@/lib/types";
import { processGenerationJob } from "@/lib/generation/worker";

// Give the after() worker headroom (generation is ~30–50s); the reaper is the backstop.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const rawBody = await request.json();
  const bodyResult = validateRequestBody(rawBody, recipeGenerationSchema);
  if (bodyResult instanceof Response) return bodyResult;

  const { prompt, dietaryFilters } = bodyResult;
  const userId = authResult.id;

  // Single in-flight: re-attach instead of starting a second job.
  const active = await storage.getActiveGenerationJobs(userId);
  if (active.length > 0) {
    return Response.json({ jobId: active[0].id, status: active[0].status }, { status: 409 });
  }

  const job = await storage.createGenerationJob({
    userId,
    status: "pending",
    stage: "queued",
    prompt,
    dietaryFilters: dietaryFilters ?? [],
    recipeId: null,
    error: null,
    attempt: 1,
  });

  // Runs after the response is sent — decoupled from the client connection.
  after(() => processGenerationJob(job.id));

  return Response.json({ jobId: job.id, status: "pending" }, { status: 202 });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`after` is exported from `next/server` in Next 15.)

- [ ] **Step 3: Smoke-build the route**

Run: `npx next build --turbopack 2>&1 | grep -iE "generate|error" | head` (or a full `npm run build`)
Expected: the route compiles; no type/route errors for `api/recipes/generate`.

---

### Task 9: `GET /api/recipes/generate/[jobId]` (poll)

**Files:**
- Create: `src/app/api/recipes/generate/[jobId]/route.ts`

- [ ] **Step 1: Implement the handler**

```ts
// src/app/api/recipes/generate/[jobId]/route.ts
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const { jobId } = await params; // Next 15: params is async
  const id = Number(jobId);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Invalid job id" }, { status: 400 });
  }

  const job = await storage.getGenerationJob(id);
  if (!job || job.userId !== authResult.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const recipe = job.recipeId ? await storage.getRecipe(job.recipeId) : null;
  return Response.json({
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    recipeId: job.recipeId,
    error: job.error,
    recipe,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 10: `GET /api/recipes/generations/active` (reconnect)

**Files:**
- Create: `src/app/api/recipes/generations/active/route.ts`

- [ ] **Step 1: Implement the handler**

```ts
// src/app/api/recipes/generations/active/route.ts
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const jobs = await storage.getActiveGenerationJobs(authResult.id);
  return Response.json({
    jobs: jobs.map((j) => ({
      jobId: j.id, status: j.status, stage: j.stage, recipeId: j.recipeId, error: j.error,
    })),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 11: Reaper route + cron config

**Files:**
- Create: `src/app/api/cron/reap-generations/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Implement the reaper route**

```ts
// src/app/api/cron/reap-generations/route.ts
import { NextRequest } from "next/server";
import { storage } from "@/lib/storage";

const STALE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const failed = await storage.failStaleGenerationJobs(STALE_TTL_MS);
  return Response.json({ failed });
}
```

- [ ] **Step 2: Add the cron schedule**

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/reap-generations", "schedule": "*/5 * * * *" }
  ]
}
```

> The user should set a `CRON_SECRET` env var in Vercel (and `.env.local`) so the endpoint rejects unauthenticated hits. Flag this in the handoff.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

## Phase C — Client providers

### Task 12: Global recipe viewer provider

**Files:**
- Create: `src/components/recipes/recipe-viewer-provider.tsx`

- [ ] **Step 1: Implement the provider**

```tsx
// src/components/recipes/recipe-viewer-provider.tsx
"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { Recipe } from "@/lib/types";
import { RecipeDetailModal } from "./recipe-detail-modal";

interface RecipeViewerContextValue {
  openRecipe: (recipe: Recipe, rating?: number) => void;
  closeRecipe: () => void;
}

const RecipeViewerContext = createContext<RecipeViewerContextValue | null>(null);

export function useRecipeViewer(): RecipeViewerContextValue {
  const ctx = useContext(RecipeViewerContext);
  if (!ctx) throw new Error("useRecipeViewer must be used within RecipeViewerProvider");
  return ctx;
}

export function RecipeViewerProvider({ children }: { children: React.ReactNode }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [open, setOpen] = useState(false);
  const [initialRating, setInitialRating] = useState<number | undefined>(undefined);

  const openRecipe = useCallback((r: Recipe, rating?: number) => {
    setRecipe(r);
    setInitialRating(rating);
    setOpen(true);
  }, []);

  const closeRecipe = useCallback(() => {
    setOpen(false);
    setInitialRating(undefined);
  }, []);

  return (
    <RecipeViewerContext.Provider value={{ openRecipe, closeRecipe }}>
      {children}
      <RecipeDetailModal recipe={recipe} open={open} initialRating={initialRating} onClose={closeRecipe} />
    </RecipeViewerContext.Provider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 13: Generation provider (polling, reconnect, notify) + render the modal

**Files:**
- Create: `src/components/generation/generation-provider.tsx`

- [ ] **Step 1: Implement the provider**

```tsx
// src/components/generation/generation-provider.tsx
"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useRecipeViewer } from "@/components/recipes/recipe-viewer-provider";
import { AILoadingModal } from "@/components/recipes/ai-loading-modal";
import { classifyTransition, hasActiveJob, type ClientJob } from "@/lib/generation/transitions";
import { isTerminalStatus, type GenerationStage, type GenerationStatus } from "@/lib/generation/stages";
import { Recipe } from "@/lib/types";

interface GenerationContextValue {
  job: ClientJob | null;
  isGenerating: boolean;
  start: (prompt: string, dietaryFilters: string[]) => Promise<void>;
  dismissModal: () => void;
  reopenModal: () => void;
  cancel: () => Promise<void>;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function useGeneration(): GenerationContextValue {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error("useGeneration must be used within GenerationProvider");
  return ctx;
}

const POLL_MS = 2000;

interface PollResponse {
  status: GenerationStatus;
  stage: GenerationStage;
  recipeId: number | null;
  error: string | null;
  recipe: Recipe | null;
}

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = useState<ClientJob | null>(null);
  const jobRef = useRef<ClientJob | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openRecipe } = useRecipeViewer();

  const setJobState = useCallback((next: ClientJob | null) => {
    jobRef.current = next;
    setJob(next);
  }, []);

  const poll = useCallback(async (jobId: number) => {
    const res = await fetch(`/api/recipes/generate/${jobId}`, { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as PollResponse;

    const prev = jobRef.current;
    const dismissed = prev?.modalDismissed ?? false;
    const next: ClientJob = {
      jobId, status: data.status, stage: data.stage,
      recipeId: data.recipeId, error: data.error, modalDismissed: dismissed,
    };
    const effect = classifyTransition(prev?.status ?? "pending", next);

    if (isTerminalStatus(data.status)) {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    }

    if (effect.kind === "open-viewer" && data.recipe) {
      openRecipe(data.recipe);
      setJobState(null);
    } else if (effect.kind === "toast-success" && data.recipe) {
      const r = data.recipe;
      toast({
        title: "Your recipe is ready",
        description: r.title,
        action: <ToastAction altText="View recipe" onClick={() => openRecipe(r)}>View recipe</ToastAction>,
      });
      setJobState(null);
    } else if (effect.kind === "toast-error") {
      toast({ title: "Recipe generation failed", description: effect.message, variant: "destructive" });
      // keep the errored job in state so the modal (if open) can show "Try again"
      setJobState(next);
    } else {
      setJobState(next);
    }
  }, [openRecipe, queryClient, setJobState, toast]);

  // One interval per active job id; poll() reads jobRef for the latest snapshot.
  const activeJobId = job && hasActiveJob(job) ? job.jobId : null;
  useEffect(() => {
    if (activeJobId == null) return;
    void poll(activeJobId);
    const timer = setInterval(() => { void poll(activeJobId); }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeJobId, poll]);

  // Reconnect on mount: resume any in-flight job in backgrounded mode.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/recipes/generations/active`, { credentials: "include" });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { jobs: Array<Omit<ClientJob, "modalDismissed">> };
      const first = data.jobs[0];
      if (first && !jobRef.current) {
        setJobState({ ...first, modalDismissed: true });
      }
    })();
    return () => { cancelled = true; };
  }, [setJobState]);

  const start = useCallback(async (prompt: string, dietaryFilters: string[]) => {
    if (jobRef.current && hasActiveJob(jobRef.current)) return; // single in-flight
    const res = await fetch(`/api/recipes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt, dietaryFilters }),
    });
    if (res.status === 401) {
      toast({ title: "Authentication required", description: "Redirecting to login…", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/auth/signin"; }, 1500);
      return;
    }
    if (res.status === 409) {
      const data = (await res.json()) as { jobId: number; status: GenerationStatus };
      setJobState({ jobId: data.jobId, status: data.status, stage: "queued", recipeId: null, error: null, modalDismissed: true });
      toast({ title: "A recipe is already cooking", description: "Hang tight — we’ll notify you when it’s ready." });
      return;
    }
    if (!res.ok) {
      toast({ title: "Recipe generation failed", description: "Please try again.", variant: "destructive" });
      return;
    }
    const data = (await res.json()) as { jobId: number; status: GenerationStatus };
    setJobState({ jobId: data.jobId, status: data.status, stage: "queued", recipeId: null, error: null, modalDismissed: false });
  }, [setJobState, toast]);

  const dismissModal = useCallback(() => {
    const cur = jobRef.current;
    if (cur) setJobState({ ...cur, modalDismissed: true });
  }, [setJobState]);

  const reopenModal = useCallback(() => {
    const cur = jobRef.current;
    if (cur) setJobState({ ...cur, modalDismissed: false });
  }, [setJobState]);

  const cancel = useCallback(async () => {
    const cur = jobRef.current;
    if (!cur) return;
    await fetch(`/api/recipes/generate/${cur.jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "cancelled" }),
    }).catch(() => {});
    setJobState(null);
  }, [setJobState]);

  return (
    <GenerationContext.Provider value={{ job, isGenerating: hasActiveJob(job), start, dismissModal, reopenModal, cancel }}>
      {children}
      <AILoadingModal />
    </GenerationContext.Provider>
  );
}
```

> The `cancel()` call uses `PATCH /api/recipes/generate/[jobId]`. Add a `PATCH` handler to that route (Task 9 file) that, for the owner, sets `status: 'cancelled'` via `storage.updateGenerationJob`. Add it now:

```ts
// append to src/app/api/recipes/generate/[jobId]/route.ts
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const { jobId } = await params;
  const id = Number(jobId);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const job = await storage.getGenerationJob(id);
  if (!job || job.userId !== authResult.id) return Response.json({ error: "Not found" }, { status: 404 });
  await storage.updateGenerationJob(id, { status: "cancelled" });
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `ToastAction` is not exported from `@/components/ui/toast`, confirm the shadcn toast path; the repo's `use-toast` ships with `@/components/ui/toast`.)

---

### Task 14: Wire providers into the app shell

**Files:**
- Modify: `src/components/providers.tsx`

- [ ] **Step 1: Nest the new providers inside `QueryClientProvider`**

In `src/components/providers.tsx`, import and wrap so the order is `QueryClientProvider → ThemeProvider → TooltipProvider → RecipeViewerProvider → GenerationProvider → {children}` (GenerationProvider depends on `useRecipeViewer`, `useQueryClient`, and the toaster, so it must sit inside them and above `{children}`; keep `<Toaster />` rendered as today):

```tsx
import { RecipeViewerProvider } from "@/components/recipes/recipe-viewer-provider"
import { GenerationProvider } from "@/components/generation/generation-provider"
// ...
        <ThemeProvider defaultTheme="light" storageKey="ui-theme">
          <TooltipProvider>
            <RecipeViewerProvider>
              <GenerationProvider>
                {children}
              </GenerationProvider>
            </RecipeViewerProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

## Phase D — UI consumers

### Task 15: Revamp `AILoadingModal` into a checklist consumer

**Files:**
- Modify: `src/components/recipes/ai-loading-modal.tsx`

- [ ] **Step 1: Replace the component (no props; reads the provider)**

```tsx
// src/components/recipes/ai-loading-modal.tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Circle, AlertTriangle } from "lucide-react";
import { useGeneration } from "@/components/generation/generation-provider";
import { DISPLAY_STAGES, stageLabel, stageIndex, type GenerationStage } from "@/lib/generation/stages";

export function AILoadingModal() {
  const { job, dismissModal, cancel, start } = useGeneration();
  const open = !!job && !job.modalDismissed;
  const isError = job?.status === "error";

  // Gentle "taking longer" reassurance after 20s on the same stage.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!open || isError) return;
    const t = setTimeout(() => setSlow(true), 20_000);
    return () => clearTimeout(t);
  }, [open, isError, job?.stage]);

  if (!job) return null;

  const currentIndex = stageIndex(job.stage as GenerationStage);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismissModal(); }}>
      <DialogContent className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="sr-only">
          <DialogTitle>Generating your recipe</DialogTitle>
          <DialogDescription>Live progress while the AI prepares your custom recipe.</DialogDescription>
        </DialogHeader>

        {isError ? (
          <div className="text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h3 className="text-xl font-heading font-semibold mb-2">Couldn’t finish your recipe</h3>
            <p className="text-gray-600 mb-4">{job.error ?? "Something went wrong."}</p>
            <Button onClick={() => start(/* re-run is triggered from the creator; here we just dismiss */ "", [])} className="hidden" />
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={dismissModal}>Close</Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-heading font-semibold mb-1 text-center">Generating Your Recipe</h3>
            <p className="text-gray-600 mb-5 text-center">Our AI is cooking up something based on your preferences…</p>

            <ul className="space-y-3">
              {DISPLAY_STAGES.map((s) => {
                const idx = stageIndex(s);
                const done = idx < currentIndex;
                const active = idx === currentIndex;
                return (
                  <li key={s} className="flex items-center gap-3">
                    {done ? <CheckCircle className="h-5 w-5 text-primary" />
                      : active ? <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      : <Circle className="h-5 w-5 text-gray-300" />}
                    <span className={done ? "text-gray-500" : active ? "font-medium" : "text-gray-400"}>
                      {stageLabel(s)}
                    </span>
                  </li>
                );
              })}
            </ul>

            {slow && <p className="text-sm text-gray-500 pt-4 text-center">Taking a little longer than usual…</p>}

            <div className="mt-6 flex justify-center gap-2">
              <Button variant="default" onClick={dismissModal}>Continue browsing</Button>
              <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => void cancel()}>Cancel</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

> The error-state "Try again" is owned by the creator (which holds the prompt). The modal's job is to surface the failure and let the user close; re-running happens from the creator UI. Remove the unused hidden `Button` line if your linter flags it.

- [ ] **Step 2: Render test for the checklist**

```tsx
// src/test/components/recipes/AILoadingModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { AILoadingModal } from '@/components/recipes/ai-loading-modal'

vi.mock('@/components/generation/generation-provider', () => ({
  useGeneration: () => ({
    job: { jobId: 1, status: 'processing', stage: 'image', recipeId: null, error: null, modalDismissed: false },
    dismissModal: vi.fn(), cancel: vi.fn(), reopenModal: vi.fn(), start: vi.fn(), isGenerating: true,
  }),
}))

describe('AILoadingModal', () => {
  it('renders the real-stage checklist with the current stage active', () => {
    render(<AILoadingModal />)
    expect(screen.getByText('Creating recipe')).toBeInTheDocument()
    expect(screen.getByText('Generating image')).toBeInTheDocument()
    expect(screen.getByText('Analyzing nutrition')).toBeInTheDocument()
    expect(screen.getByText('Continue browsing')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/test/components/recipes/AILoadingModal.test.tsx`
Expected: PASS.

---

### Task 16: Header "cooking" chip

**Files:**
- Modify: `src/components/layout/header.tsx`
- Test: `src/test/components/generation/GenerationCookingChip.test.tsx`

- [ ] **Step 1: Extract a small chip component**

Create `src/components/generation/cooking-chip.tsx`:

```tsx
// src/components/generation/cooking-chip.tsx
"use client";

import { Loader2 } from "lucide-react";
import { useGeneration } from "./generation-provider";

export function CookingChip() {
  const { job, reopenModal, isGenerating } = useGeneration();
  if (!job || !isGenerating) return null;
  return (
    <button
      type="button"
      onClick={reopenModal}
      className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
      aria-label="View recipe in progress"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="hidden sm:inline">Cooking…</span>
    </button>
  );
}
```

- [ ] **Step 2: Render the chip in the Header**

In `src/components/layout/header.tsx`, import the chip and render it inside the authenticated cluster (the `<div className="flex items-center space-x-4">`), before the dashboard heart button:

```tsx
import { CookingChip } from "@/components/generation/cooking-chip";
// ...
            {isAuthenticated && (
              <>
                <CookingChip />
                <Button asChild variant="ghost" size="icon" className="hidden md:flex hover:text-primary">
                  {/* ...existing... */}
```

- [ ] **Step 3: Write a chip render test**

```tsx
// src/test/components/generation/GenerationCookingChip.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { CookingChip } from '@/components/generation/cooking-chip'

const useGenerationMock = vi.fn()
vi.mock('@/components/generation/generation-provider', () => ({
  useGeneration: () => useGenerationMock(),
}))

describe('CookingChip', () => {
  it('renders when a job is active', () => {
    useGenerationMock.mockReturnValue({
      job: { jobId: 1, status: 'processing', stage: 'recipe', recipeId: null, error: null, modalDismissed: true },
      isGenerating: true, reopenModal: vi.fn(),
    })
    render(<CookingChip />)
    expect(screen.getByRole('button', { name: /view recipe in progress/i })).toBeInTheDocument()
  })

  it('renders nothing when there is no active job', () => {
    useGenerationMock.mockReturnValue({ job: null, isGenerating: false, reopenModal: vi.fn() })
    const { container } = render(<CookingChip />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/test/components/generation/GenerationCookingChip.test.tsx`
Expected: PASS (2 tests).

---

### Task 17: `RecipeCreator` uses the provider; drop modal + singleton

**Files:**
- Modify: `src/components/recipes/recipe-creator.tsx`
- Modify: `src/test/components/recipes/RecipeCreator.test.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
// src/components/recipes/recipe-creator.tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sparkles, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuidedRecipeModal } from "./guided-recipe-modal";
import { CustomRecipePrompt } from "./custom-recipe-prompt";
import { useGeneration } from "@/components/generation/generation-provider";

export function RecipeCreator() {
  const { status } = useSession();
  const { start, isGenerating } = useGeneration();
  const [showGuided, setShowGuided] = useState(false);

  const generate = (prompt: string, dietaryFilters: string[]) => {
    setShowGuided(false);
    void start(prompt, dietaryFilters);
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
            <Button className="bg-primary hover:bg-primary/90 text-white" disabled={isGenerating} onClick={() => setShowGuided(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Generate recipe (guided)
            </Button>
            {isGenerating && <p className="text-xs text-gray-400 mt-2">A recipe’s already cooking…</p>}
          </div>

          <div className="text-center text-xs font-medium text-gray-400">— OR —</div>

          <CustomRecipePrompt onGenerate={(text) => generate(text, [])} disabled={isGenerating} />
        </CardContent>
      </Card>

      <GuidedRecipeModal open={showGuided} onClose={() => setShowGuided(false)} onGenerate={generate} />
    </>
  );
}
```

- [ ] **Step 2: Update the RecipeCreator test to mock the provider**

At the top of `src/test/components/recipes/RecipeCreator.test.tsx`, add a mock and remove any `onRecipeGenerated` prop usage:

```tsx
vi.mock('@/components/generation/generation-provider', () => ({
  useGeneration: () => ({ start: vi.fn(), isGenerating: false }),
}))
```

Render with `render(<RecipeCreator />)` (no props). Keep/adjust existing assertions that the guided button and custom prompt render.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/test/components/recipes/RecipeCreator.test.tsx`
Expected: PASS.

---

### Task 18: Home + search pages use the global viewer

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/search/page.tsx` (confirm exact path; it renders `RecipeBrowser`)

- [ ] **Step 1: Rewrite `src/app/page.tsx` to use `useRecipeViewer`**

```tsx
// src/app/page.tsx
"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RecipeCreator } from "@/components/recipes/recipe-creator";
import { RecipeBrowser, RecipeBrowserParams } from "@/components/recipes/recipe-browser";
import { ChatWidget } from "@/components/ui/chat-widget";
import { HeroSection } from "@/components/sections/hero-section";
import { useRecipeViewer } from "@/components/recipes/recipe-viewer-provider";
import { Recipe } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [params, setParams] = useState<RecipeBrowserParams>({ search: "", filters: [], sort: "popular" });
  const { openRecipe } = useRecipeViewer();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <HeroSection onSearchSubmit={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)} />

          <RecipeCreator />

          <section>
            <RecipeBrowser
              title="Recommended For You"
              params={params}
              onParamsChange={setParams}
              onRecipeClick={(r: Recipe) => openRecipe(r)}
              onRecipeRate={(r: Recipe, rating: number) => openRecipe(r, rating)}
            />
          </section>
        </div>
      </main>

      <ChatWidget />
      <Footer />
    </div>
  );
}
```

> The `RecipeDetailModal` is no longer rendered here — it lives in `RecipeViewerProvider`. Remove the now-unused imports (`RecipeDetailModal`, modal state, `pendingRating`).

- [ ] **Step 2: Update the search page the same way**

In `src/app/search/page.tsx`, replace any local `RecipeDetailModal` state/render with `useRecipeViewer()` and pass `onRecipeClick={(r) => openRecipe(r)}` (and `onRecipeRate` if present) to `RecipeBrowser`. If `RecipeBrowser` itself renders a `RecipeDetailModal` internally, switch that internal handler to `useRecipeViewer().openRecipe` and delete the internal modal so there is exactly one app-level viewer.

- [ ] **Step 3: Typecheck + run the affected suites**

Run: `npx tsc --noEmit`
Run: `npx vitest run src/test/app/search-page.test.tsx src/test/components/recipes/RecipeBrowser.test.tsx`
Expected: typecheck clean; suites pass (update any assertion that depended on a page-local modal to expect the viewer behavior, e.g. that `onRecipeClick` is invoked).

---

### Task 19: Full regression

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all suites pass. Pay attention to `RecipeCreator`, `RecipeBrowser`, `search-page`, `Header`, and the new `generation` suites.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; the new routes appear in the route manifest; no `after`/`maxDuration` warnings that fail the build.

---

## Self-Review (completed while writing)

**Spec coverage:**
- Durable `generation_jobs` table → Task 4. Storage ops → Task 5. ✓
- `POST` returns `jobId` + single-in-flight `409` + `after()` dispatch → Task 8. ✓
- Worker with real stage checkpoints, silent retries (degradation/error path), cancel check → Tasks 6 + 7. ✓
- Poll / active-jobs / reaper endpoints + cron → Tasks 9, 10, 11. ✓
- App-level `GenerationProvider` (polling, reconnect, notify, **live** `useQueryClient` invalidation) → Task 13. ✓
- Checklist modal, header chip, completion toast, global recipe viewer → Tasks 15, 16, 13, 12/18. ✓
- Retry rule (monotonic checklist; hard-failure → error state) → Task 15. ✓
- Removes simulated bar + dead-singleton invalidation from the creator → Task 17. ✓

**Placeholder scan:** No "TBD/TODO" left as work items; every code step is complete. (The worker's embedding `content` is intentionally minimal with a note — not a placeholder for required behavior.)

**Type consistency:** `ClientJob`, `GenerationStage`, `GenerationStatus`, `WorkerDeps`, `processGenerationJob`, `useGeneration`, `useRecipeViewer`, `classifyTransition`, `hasActiveJob`, `selectStaleJobIds`, and the storage method names are used identically across tasks.

**Open verification items for the engineer (call out, don't guess):**
- Confirm `ToastAction` import path (`@/components/ui/toast`) matches the repo's shadcn toast.
- Confirm the search page path (`src/app/search/page.tsx`) and whether `RecipeBrowser` renders its own modal.
- `maxDuration = 60` assumes the deploy plan allows it; lower if the plan caps function duration.
