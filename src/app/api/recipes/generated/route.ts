import { requireAuth } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET() {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const userId = authResult.id;
    const recipes = await storage.getGeneratedRecipes(userId);

    // Check which ones are favorited
    const favoriteRecipes = await storage.getSavedRecipes(userId);
    const favoriteIds = favoriteRecipes.map(r => r.id);

    const recipesWithFavorites = recipes.map(recipe => ({
      ...recipe,
      isFavorited: favoriteIds.includes(recipe.id)
    }));

    return Response.json(recipesWithFavorites);
  } catch (error) {
    console.error("Error fetching generated recipes:", error);
    return Response.json({ error: "Failed to fetch generated recipes" }, { status: 500 });
  }
}