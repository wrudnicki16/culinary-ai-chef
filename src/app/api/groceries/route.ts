import { NextRequest } from "next/server";
import { requireAuth, validateRequestBody } from "@/lib/api-auth";
import { storage } from "@/lib/storage";
import { grocerySchema } from "@/lib/types";

export async function GET() {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const userId = authResult.id;
    const groceryItems = await storage.getGroceryItems(userId);
    return Response.json(groceryItems);
  } catch (error) {
    console.error("Error fetching grocery items:", error);
    return Response.json({ error: "Failed to fetch grocery items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const rawBody = await request.json();
    const bodyResult = validateRequestBody(rawBody, grocerySchema);

    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    const { recipeId, ingredients } = bodyResult;
    const userId = authResult.id;

    const items = ingredients.map((name: string) => ({
      userId,
      name,
      quantity: "As needed", // Default quantity
      recipeId: recipeId || undefined,
      purchased: false
    }));

    const groceryItems = await storage.addGroceryItems(items);
    return Response.json(groceryItems);
  } catch (error) {
    console.error("Error adding grocery items:", error);
    return Response.json({ error: "Failed to add grocery items" }, { status: 500 });
  }
}