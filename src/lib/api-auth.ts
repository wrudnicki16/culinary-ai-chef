import { auth } from "./auth";
import { storage } from "./storage";

export async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return session.user;
}

export async function requireAuth() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return user;
}

export async function requireRole(role: string) {
  const user = await getAuthenticatedUser();

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

export function validateRequestBody<T>(body: unknown, schema: { parse: (data: unknown) => T }): T | Response {
  try {
    return schema.parse(body);
  } catch (error: unknown) {
    return Response.json({
      error: "Validation error",
      details: (error as { errors?: unknown; message?: string }).errors || (error as { message?: string }).message
    }, { status: 400 });
  }
}