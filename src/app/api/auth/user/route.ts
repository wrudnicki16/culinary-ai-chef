import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const userId = authResult.id;
    const user = await storage.getUser(userId);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return Response.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}