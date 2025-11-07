import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recipeId = parseInt(id);

    if (isNaN(recipeId)) {
      return Response.json({ error: "Invalid recipe ID" }, { status: 400 });
    }

    const recipe = await storage.getRecipe(recipeId);

    if (!recipe) {
      return Response.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Get comments for the recipe
    const comments = await storage.getRecipeComments(recipeId);

    // Fetch user data for each comment
    const commentsWithUsers = await Promise.all(comments.map(async (comment) => {
      const user = await storage.getUser(comment.userId);
      return {
        ...comment,
        user: {
          id: user?.id,
          firstName: user?.firstName,
          lastName: user?.lastName,
          profileImageUrl: user?.profileImageUrl
        }
      };
    }));

    // Check if recipe is favorited by the current user
    let isFavorited = false;
    const user = await getAuthenticatedUser();

    if (user) {
      try {
        const favorite = await storage.getFavorite(user.id, recipeId);
        isFavorited = !!favorite;
      } catch (error) {
        console.error("Error checking favorite status:", error);
        // Continue without favorite status
      }
    }

    return Response.json({
      ...recipe,
      comments: commentsWithUsers,
      isFavorited
    });
  } catch (error) {
    console.error("Error fetching recipe:", error);
    return Response.json({ error: "Failed to fetch recipe" }, { status: 500 });
  }
}