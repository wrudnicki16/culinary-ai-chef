import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DashboardStatsSkeleton, Skeleton } from "@/components/ui/loading-skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>

          {/* Stats Skeleton */}
          <DashboardStatsSkeleton />

          {/* Quick Actions Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-5" />
                </div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          {/* Recent Activity Skeleton */}
          <div className="bg-white rounded-lg border p-6">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-48 mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-4 pb-4 border-b last:border-0">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}