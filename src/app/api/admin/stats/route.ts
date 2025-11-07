import { NextRequest } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, 'admin');

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const stats = await storage.getAdminStats();
    return Response.json(stats);
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return Response.json({ error: "Failed to fetch admin statistics" }, { status: 500 });
  }
}