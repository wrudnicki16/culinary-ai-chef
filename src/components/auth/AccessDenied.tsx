import { AlertTriangle, LogIn, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  showSignIn?: boolean;
  showHome?: boolean;
}

export function AccessDenied({
  title = "Access Denied",
  message = "You don&apos;t have permission to view this content.",
  showSignIn = true,
  showHome = true
}: AccessDeniedProps) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center max-w-md mx-auto">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600 mb-6">{message}</p>

          <div className="flex gap-3 justify-center">
            {showSignIn && (
              <Button onClick={() => window.location.href = "/api/auth/signin"}>
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            )}
            {showHome && (
              <Button
                variant="outline"
                onClick={() => window.location.href = "/"}
              >
                <Home className="h-4 w-4 mr-2" />
                Return Home
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}