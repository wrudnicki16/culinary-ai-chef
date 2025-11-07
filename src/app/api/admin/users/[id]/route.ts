import { NextRequest } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole('admin');

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { id } = await params;
    const userId = id;
    const { role } = await request.json();

    if (!role || !['admin', 'user'].includes(role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }

    const user = await storage.getUser(userId);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // If role is already present, do nothing
    if (user.roles.includes(role)) {
      return Response.json(user);
    }

    // Replace existing roles with new role
    const newRoles = [role];

    const updatedUser = await storage.upsertUser({
      ...user,
      roles: newRoles
    });

    return Response.json(updatedUser);
  } catch (error) {
    console.error("Error updating user role:", error);
    return Response.json({ error: "Failed to update user role" }, { status: 500 });
  }
}