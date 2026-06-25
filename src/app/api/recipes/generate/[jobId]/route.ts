import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const { jobId } = await params;
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
