import { describe, it, expect, vi } from 'vitest';
import { processGenerationJob, type WorkerDeps } from '@/lib/generation/worker';

function makeDeps(overrides: Partial<WorkerDeps> = {}) {
  const updates: Array<Record<string, unknown>> = [];
  let jobStatus = 'pending';
  const deps: WorkerDeps = {
    getJob: vi.fn(async () => ({ status: jobStatus, prompt: 'pasta', dietaryFilters: ['vegetarian'], userId: 'u1' })),
    updateJob: vi.fn(async (_id, patch) => { if (patch.status) jobStatus = patch.status as string; updates.push(patch); }),
    getUserDefaultServings: vi.fn(async () => null),
    generateRecipe: vi.fn(async (_p, _f, _s, onStage) => {
      await onStage?.('image');
      await onStage?.('nutrition');
      return {
        title: 'T', description: 'D', imageUrl: null, ingredients: [], instructions: [],
        cookingTime: 10, servings: 2, dietaryTags: ['vegetarian'],
        nutritionInfo: { calories: 1, protein: 1, fat: 1, carbs: 1 },
      };
    }),
    createRecipe: vi.fn(async () => ({ id: 99 })),
    generateEmbedding: vi.fn(async () => []),
    createRecipeEmbedding: vi.fn(async () => undefined),
    ...overrides,
  };
  return { deps, updates };
}

describe('processGenerationJob', () => {
  it('writes stages in order and finishes done with the recipe id', async () => {
    const { deps, updates } = makeDeps();
    await processGenerationJob(1, deps);
    const stages = updates.filter((u) => u.stage).map((u) => u.stage);
    expect(stages).toEqual(['recipe', 'image', 'nutrition', 'finalizing']);
    expect(updates.at(-1)).toMatchObject({ status: 'done', recipeId: 99 });
  });

  it('marks the job error when generation throws', async () => {
    const { deps, updates } = makeDeps({
      generateRecipe: vi.fn(async () => { throw new Error('llm down'); }),
    });
    await processGenerationJob(1, deps);
    expect(updates.at(-1)).toMatchObject({ status: 'error', error: 'llm down' });
    expect(deps.createRecipe).not.toHaveBeenCalled();
  });

  it('bails without persisting when the job was cancelled mid-flight', async () => {
    let calls = 0;
    const { deps } = makeDeps({
      getJob: vi.fn(async () => {
        calls += 1;
        return { status: calls <= 1 ? 'pending' : 'cancelled', prompt: 'p', dietaryFilters: [], userId: 'u1' };
      }),
    });
    await processGenerationJob(1, deps);
    expect(deps.createRecipe).not.toHaveBeenCalled();
  });

  it('bails immediately if the job is already cancelled before processing starts', async () => {
    const { deps, updates } = makeDeps({
      getJob: vi.fn(async () => ({ status: 'cancelled', prompt: 'p', dietaryFilters: [], userId: 'u1' })),
    });
    await processGenerationJob(1, deps);
    expect(updates).toEqual([]);
    expect(deps.generateRecipe).not.toHaveBeenCalled();
    expect(deps.createRecipe).not.toHaveBeenCalled();
  });
});
