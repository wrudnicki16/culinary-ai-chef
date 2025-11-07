import { requireRole } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET() {
  const authResult = await requireRole('admin');

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    // For simplicity, this endpoint does not implement pagination
    // In a production app, you'd implement pagination here
    const adminUsers = await storage.getUsersByRole('admin');
    const regularUsers = await storage.getUsersByRole('user');

    return Response.json({
      admins: adminUsers,
      users: regularUsers
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}