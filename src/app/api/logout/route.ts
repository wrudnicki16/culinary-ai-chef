import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Redirect to NextAuth's signout endpoint which handles the logout process
  return Response.redirect(new URL("/api/auth/signout", request.url));
}
