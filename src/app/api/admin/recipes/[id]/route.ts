import { NextRequest } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(request, 'admin');

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { id } = await params;
    const recipeId = parseInt(id);

    if (isNaN(recipeId)) {
      return Response.json({ error: "Invalid recipe ID" }, { status: 400 });
    }

    const success = await storage.deleteRecipe(recipeId);

    if (!success) {
      return Response.json({ error: "Recipe not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting recipe:", error);
    return Response.json({ error: "Failed to delete recipe" }, { status: 500 });
  }
}