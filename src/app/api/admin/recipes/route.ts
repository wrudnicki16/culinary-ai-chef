import { NextRequest } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, 'admin');

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 10;

    const { recipes, total } = await storage.getAllRecipes({
      search,
      page,
      pageSize
    });

    return Response.json({ recipes, total });
  } catch (error) {
    console.error("Error fetching admin recipes:", error);
    return Response.json({ error: "Failed to fetch recipes" }, { status: 500 });
  }
}