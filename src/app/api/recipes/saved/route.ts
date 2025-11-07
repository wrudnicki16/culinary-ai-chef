import { requireAuth } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET() {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const userId = authResult.id;
    const recipes = await storage.getSavedRecipes(userId);

    // Mark all as favorited
    const recipesWithFavorited = recipes.map(recipe => ({
      ...recipe,
      isFavorited: true
    }));

    return Response.json(recipesWithFavorited);
  } catch (error) {
    console.error("Error fetching saved recipes:", error);
    return Response.json({ error: "Failed to fetch saved recipes" }, { status: 500 });
  }
}