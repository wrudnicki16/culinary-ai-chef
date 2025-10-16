import { useSession } from "next-auth/react";
import { AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AdminProtectedProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireRole?: string;
}

export function AdminProtected({
  children,
  fallback,
  requireRole = 'admin'
}: AdminProtectedProps) {
  const { data: session, status } = useSession();

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      fallback || (
        <Card>
          <CardContent className="py-8">
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          </CardContent>
        </Card>
      )
    );
  }

  // Show access denied for non-admin users
  if (!session || session.user?.role !== requireRole) {
    return (
      fallback || (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
              <p className="text-gray-600 mb-6">
                {requireRole.charAt(0).toUpperCase() + requireRole.slice(1)} privileges required to access this content.
              </p>
              {!session ? (
                <Button onClick={() => window.location.href = "/api/auth/signin"}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              ) : (
                <Button variant="outline" onClick={() => window.location.href = "/"}>
                  Return Home
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )
    );
  }

  // Render protected content for authorized users
  return <>{children}</>;
}