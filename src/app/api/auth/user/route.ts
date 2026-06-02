import { NextRequest } from "next/server";
import { requireAuth, validateRequestBody } from "@/lib/api-auth";
import { storage } from "@/lib/storage";
import { userPreferencesSchema } from "@/lib/types";

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

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const rawBody = await request.json();
    const bodyResult = validateRequestBody(rawBody, userPreferencesSchema);

    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    const updated = await storage.updateUserPreferences(authResult.id, bodyResult);

    if (!updated) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return Response.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}