import { requireRole } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET() {
  const authResult = await requireRole('admin');

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    // Get all chat messages for admin review
    const messages = await storage.getAllChatMessages();
    return Response.json(messages);
  } catch (error) {
    console.error("Error fetching support messages:", error);
    return Response.json({ error: "Failed to fetch support messages" }, { status: 500 });
  }
}
