"use client"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { ThemeProvider } from "./theme-provider"
import { TooltipProvider } from "./ui/tooltip"
import { Toaster } from "./ui/toaster"
import { getQueryFn } from "@/lib/queryClient"
import { RecipeViewerProvider } from "@/components/recipes/recipe-viewer-provider"
import { GenerationProvider } from "@/components/generation/generation-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Default fetcher: queries keyed by their URL fetch that URL.
            // Without this, keyless useQuery calls (e.g. the dashboard tabs)
            // never fetch. Per-query queryFns still override this default.
            queryFn: getQueryFn({ on401: "throw" }),
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="ui-theme">
          <TooltipProvider>
            <RecipeViewerProvider>
              <GenerationProvider>
                {children}
              </GenerationProvider>
            </RecipeViewerProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}