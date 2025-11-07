import { NextRequest } from "next/server";
import { requireAuth, validateRequestBody } from "@/lib/api-auth";
import { storage } from "@/lib/storage";
import { favoriteSchema } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { id } = await params;
    const recipeId = parseInt(id);

    if (isNaN(recipeId)) {
      return Response.json({ error: "Invalid recipe ID" }, { status: 400 });
    }

    const rawBody = await request.json();
    const bodyResult = validateRequestBody(rawBody, favoriteSchema);

    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    const { isFavorite } = bodyResult;
    const userId = authResult.id;

    await storage.toggleFavorite({
      userId: userId,
      recipeId: recipeId
    });

    const status = isFavorite ? "favorited" : "unfavorited";
    return Response.json({ status });
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return Response.json({ error: "Failed to update favorite status" }, { status: 500 });
  }
}