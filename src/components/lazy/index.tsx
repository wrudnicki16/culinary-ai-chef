import dynamic from "next/dynamic";
import { RecipeCardSkeleton } from "@/components/ui/loading-skeleton";

// Lazy load heavy components that aren't immediately visible
export const LazyRecipeDetailModal = dynamic(
  () => import("@/components/recipes/recipe-detail-modal").then(mod => ({ default: mod.RecipeDetailModal })),
  {
    loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><RecipeCardSkeleton /></div>,
    ssr: false
  }
);

export const LazyRecipeGenerator = dynamic(
  () => import("@/components/recipes/recipe-generator").then(mod => ({ default: mod.RecipeGenerator })),
  {
    loading: () => <div className="bg-white rounded-lg p-6 animate-pulse"><div className="h-20 bg-gray-100 rounded" /></div>
  }
);

export const LazyChatWidget = dynamic(
  () => import("@/components/ui/chat-widget").then(mod => ({ default: mod.ChatWidget })),
  {
    loading: () => null,
    ssr: false
  }
);

export const LazyFeaturesSection = dynamic(
  () => import("@/components/sections/features-section").then(mod => ({ default: mod.FeaturesSection })),
  {
    loading: () => (
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-4" />
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-3 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
);

// Admin components (only load when needed)
export const LazyAdminRecipeTable = dynamic(
  () => import("@/components/admin/recipe-table").then(mod => ({ default: mod.RecipeTable })),
  {
    loading: () => <div className="p-6 animate-pulse"><div className="h-64 bg-gray-100 rounded" /></div>,
    ssr: false
  }
);