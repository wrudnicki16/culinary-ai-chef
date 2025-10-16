import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TableSkeleton, Skeleton } from "@/components/ui/loading-skeleton";

export default function AdminUsersLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <Skeleton className="h-8 w-40 mb-1" />
                <Skeleton className="h-5 w-72" />
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-10 w-64" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Admin Users Skeleton */}
                <div>
                  <Skeleton className="h-6 w-32 mb-3" />
                  <div className="border rounded-md overflow-hidden">
                    <TableSkeleton rows={3} columns={6} />
                  </div>
                </div>

                {/* Regular Users Skeleton */}
                <div>
                  <Skeleton className="h-6 w-28 mb-3" />
                  <div className="border rounded-md overflow-hidden">
                    <TableSkeleton rows={8} columns={6} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}