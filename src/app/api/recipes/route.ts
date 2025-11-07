import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const filtersParam = searchParams.getAll('filters');
    const filters = filtersParam.length > 0 ? filtersParam : undefined;

    const search = searchParams.get('search') || undefined;
    const sort = searchParams.get('sort') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 10;

    const { recipes: initialRecipes, total } = await storage.getAllRecipes({
      filters,
      search,
      sort,
      page,
      pageSize
    });

    // Check authentication and add favorite status
    const user = await getAuthenticatedUser();

    let recipes = initialRecipes;

    if (user) {
      try {
        const favoriteRecipes = await storage.getSavedRecipes(user.id);
        const favoriteIds = favoriteRecipes.map(r => r.id);

        recipes = recipes.map(recipe => ({
          ...recipe,
          isFavorited: favoriteIds.includes(recipe.id)
        }));
      } catch (error) {
        console.error("Error fetching favorites:", error);
        // Continue without favorite status
      }
    }

    return Response.json({ recipes, total });
  } catch (error) {
    console.error("Error fetching recipes:", error);
    return Response.json({ error: "Failed to fetch recipes" }, { status: 500 });
  }
}