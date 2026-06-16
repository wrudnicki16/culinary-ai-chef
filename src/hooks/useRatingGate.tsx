import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

/**
 * Returns a guard that runs `proceed` only when the user is signed in.
 * Signed-out users get a sign-in prompt instead, so they are never led into a
 * rating/review they cannot submit.
 */
export function useRatingGate() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  return (proceed: () => void) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in to rate",
        description: "Please sign in to rate or review this recipe.",
        action: (
          <ToastAction altText="Sign in" asChild>
            <Link href="/api/auth/signin">Sign in</Link>
          </ToastAction>
        ),
      });
      return;
    }
    proceed();
  };
}
