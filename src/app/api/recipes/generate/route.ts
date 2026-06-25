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
