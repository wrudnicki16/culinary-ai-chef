import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { id } = await params;
    const itemId = parseInt(id);

    if (isNaN(itemId)) {
      return Response.json({ error: "Invalid item ID" }, { status: 400 });
    }

    const { purchased } = await request.json();
    const updatedItem = await storage.updateGroceryItem(itemId, purchased);

    if (!updatedItem) {
      return Response.json({ error: "Grocery item not found" }, { status: 404 });
    }

    return Response.json(updatedItem);
  } catch (error) {
    console.error("Error updating grocery item:", error);
    return Response.json({ error: "Failed to update grocery item" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { id } = await params;
    const itemId = parseInt(id);

    if (isNaN(itemId)) {
      return Response.json({ error: "Invalid item ID" }, { status: 400 });
    }

    const success = await storage.deleteGroceryItem(itemId);

    if (!success) {
      return Response.json({ error: "Grocery item not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting grocery item:", error);
    return Response.json({ error: "Failed to delete grocery item" }, { status: 500 });
  }
}