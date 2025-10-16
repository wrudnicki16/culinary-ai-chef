import { NextRequest } from "next/server";
import { auth } from "./auth";
import { storage } from "./storage";

export async function getAuthenticatedUser(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return session.user;
}

export async function requireAuth(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return user;
}

export async function requireRole(request: NextRequest, role: string) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbUser = await storage.getUser(user.id);

    if (!dbUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (!dbUser.roles || !dbUser.roles.includes(role)) {
      return Response.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    return { user, dbUser };
  } catch (error) {
    console.error("Error checking user role:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

export function validateRequestBody<T>(body: any, schema: any): T | Response {
  try {
    return schema.parse(body);
  } catch (error: any) {
    return Response.json({
      error: "Validation error",
      details: error.errors || error.message
    }, { status: 400 });
  }
}