import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RecipeCardSkeleton } from "@/components/ui/loading-skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Skeleton */}
          <div className="rounded-2xl bg-gray-200 h-64 md:h-80 mb-8 animate-pulse" />

          <div className="flex flex-col md:flex-row gap-8">
            {/* Filter Sidebar Skeleton */}
            <div className="w-full md:w-80">
              <div className="bg-white rounded-lg p-6 space-y-4">
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content Skeleton */}
            <div className="flex-1">
              {/* Recipe Generator Skeleton */}
              <div className="bg-white rounded-lg p-6 mb-8">
                <div className="h-6 bg-gray-200 rounded animate-pulse mb-4" />
                <div className="h-20 bg-gray-100 rounded animate-pulse" />
              </div>

              {/* Recipe Grid Skeleton */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <RecipeCardSkeleton key={index} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}