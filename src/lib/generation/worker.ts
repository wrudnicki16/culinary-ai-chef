import type { GenerationStage } from './stages';
import type { InsertRecipe } from '@/lib/schema';
import type { generateRecipe as GenerateRecipeFn } from '@/lib/openai';
import { GenerationCancelledError } from './errors';

type RecipeData = Awaited<ReturnType<typeof GenerateRecipeFn>>;

export interface WorkerDeps {
  getJob: (jobId: number) => Promise<{ status: string; prompt: string; dietaryFilters: string[]; userId: string } | undefined>;
  updateJob: (jobId: number, patch: { status?: string; stage?: GenerationStage; recipeId?: number; error?: string }) => Promise<void>;
  getUserDefaultServings: (userId: string) => Promise<number | null>;
  generateRecipe: (prompt: string, dietaryFilters: string[], targetServings: number | null, onStage?: (stage: GenerationStage) => void | Promise<void>) => Promise<RecipeData>;
  createRecipe: (recipe: InsertRecipe) => Promise<{ id: number }>;
  generateEmbedding: (text: string) => Promise<number[]>;
  createRecipeEmbedding: (e: { recipeId: number; embedding: number[]; content: string }) => Promise<unknown>;
}

// Lazy default deps — only imported when actually used (not during module load),
// so the test environment never triggers the DATABASE_URL guard in db.ts.
export const defaultWorkerDeps: WorkerDeps = {
  getJob: async (id) => {
    const { storage } = await import('@/lib/storage');
    const j = await storage.getGenerationJob(id);
    return j && { status: j.status, prompt: j.prompt, dietaryFilters: j.dietaryFilters, userId: j.userId };
  },
  updateJob: async (id, patch) => {
    const { storage } = await import('@/lib/storage');
    await storage.updateGenerationJob(id, patch);
  },
  getUserDefaultServings: async (uid) => {
    const { storage } = await import('@/lib/storage');
    return (await storage.getUser(uid))?.defaultServings ?? null;
  },
  generateRecipe: async (...args) => {
    const { generateRecipe } = await import('@/lib/openai');
    return generateRecipe(...args);
  },
  createRecipe: async (r) => {
    const { storage } = await import('@/lib/storage');
    const rec = await storage.createRecipe(r);
    return { id: rec.id };
  },
  generateEmbedding: async (text) => {
    const { generateEmbedding } = await import('@/lib/openai');
    return generateEmbedding(text);
  },
  createRecipeEmbedding: async (e) => {
    const { storage } = await import('@/lib/storage');
    return storage.createRecipeEmbedding(e);
  },
};

export async function processGenerationJob(jobId: number, deps: WorkerDeps = defaultWorkerDeps): Promise<void> {
  const job = await deps.getJob(jobId);
  if (!job) return;
  // Cancelled during the pending window (before after() ran) — don't start generating.
  if (job.status === 'cancelled') return;

  try {
    await deps.updateJob(jobId, { status: 'processing', stage: 'recipe' });
    const targetServings = await deps.getUserDefaultServings(job.userId);

    const recipeData = await deps.generateRecipe(
      job.prompt,
      job.dietaryFilters,
      targetServings,
      async (stage) => {
        const current = await deps.getJob(jobId);
        if (current?.status === 'cancelled') throw new GenerationCancelledError();
        await deps.updateJob(jobId, { stage });
      },
    );

    const beforePersist = await deps.getJob(jobId);
    if (beforePersist?.status === 'cancelled') return;

    await deps.updateJob(jobId, { stage: 'finalizing' });

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
    });

    // Best-effort embedding for RAG (never affects job outcome).
    try {
      const recipeText = `Title: ${recipeData.title}
Description: ${recipeData.description}
Ingredients: ${JSON.stringify(recipeData.ingredients)}
Instructions: ${JSON.stringify(recipeData.instructions)}
Tags: ${recipeData.dietaryTags.join(", ")}`;
      const embedding = await deps.generateEmbedding(recipeText);
      await deps.createRecipeEmbedding({ recipeId: recipe.id, embedding, content: recipeText });
    } catch {
      // ignore embedding failures
    }

    await deps.updateJob(jobId, { status: 'done', recipeId: recipe.id });
  } catch (err) {
    if (err instanceof GenerationCancelledError) return;
    await deps.updateJob(jobId, { status: 'error', error: err instanceof Error ? err.message : 'Recipe generation failed' });
  }
}
