import { NextRequest } from "next/server";
import { requireAuth, validateRequestBody } from "@/lib/api-auth";
import { storage } from "@/lib/storage";
import { commentSchema } from "@/lib/types";

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
    const bodyResult = validateRequestBody(rawBody, commentSchema);

    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    const { comment, rating } = bodyResult;
    const userId = authResult.id;

    const newComment = await storage.createComment({
      content: comment,
      rating: rating,
      userId: userId,
      recipeId: recipeId
    });

    // Get user data to return with comment
    const user = await storage.getUser(userId);

    return Response.json({
      ...newComment,
      user: {
        id: user?.id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        profileImageUrl: user?.profileImageUrl
      }
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return Response.json({ error: "Failed to create comment" }, { status: 500 });
  }
}