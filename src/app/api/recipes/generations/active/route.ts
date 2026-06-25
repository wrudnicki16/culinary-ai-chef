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
