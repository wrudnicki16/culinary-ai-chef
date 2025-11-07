import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;

  // Only check auth for admin routes
  if (nextUrl.pathname.startsWith('/admin')) {
    // Manually call auth() only for admin routes
    const session = await auth();

    // If no session exists, redirect to sign-in
    if (!session) {
      const signInUrl = new URL('/api/auth/signin', nextUrl.origin);
      signInUrl.searchParams.set('callbackUrl', nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Check if user has admin role
    const userRoles = (session.user as { roles?: string[] })?.roles || [];
    const isAdmin = userRoles.includes('admin');

    if (!isAdmin) {
      // Redirect to home page with access denied message
      // The client-side check in the admin pages will show the proper UI
      return NextResponse.redirect(new URL('/', nextUrl.origin));
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    // Match all admin routes
    '/admin/:path*',
  ],
};
