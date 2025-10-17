"use client"

import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { Users, BookOpen, Settings, ChevronRight, TrendingUp, MessageSquare, AlertTriangle, RefreshCw, LogIn } from "lucide-react";

interface AdminStats {
  userCount: number;
  recipeCount: number;
  activeUsersToday: number;
  activeUsers: number;
  generationCount: number;
  recentActivity: Array<{id: string; type: string; description: string; timestamp: string}>;
}

export default function Admin() {
  const { data: session, status } = useSession();
  const { data: stats, isLoading, error, refetch } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!session && (session.user as {role?: string})?.role === 'admin',
  });

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!session || (session.user as {role?: string})?.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-16">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
              <p className="text-gray-600 mb-6">Admin privileges required to access this page.</p>
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
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-gray-600 mt-2">Manage recipes, users, and application settings</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/admin/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>
          
          {/* Stats overview */}
          {error ? (
            <Card className="mb-8">
              <CardContent className="py-8">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading statistics</h3>
                  <p className="text-gray-600 mb-4">There was a problem loading the admin statistics.</p>
                  <Button onClick={() => refetch()} className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Users</CardDescription>
                  <CardTitle className="text-3xl">
                    {isLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      stats?.userCount || 0
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>+12% from last month</span>
                  </div>
                </CardContent>
              </Card>
            
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Recipes</CardDescription>
                  <CardTitle className="text-3xl">
                    {isLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      stats?.recipeCount || 0
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>+24% from last month</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>AI Generations</CardDescription>
                  <CardTitle className="text-3xl">
                    {isLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      stats?.generationCount || 0
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>+18% from last month</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Users</CardDescription>
                  <CardTitle className="text-3xl">
                    {isLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      stats?.activeUsers || 0
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>+7% from last month</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Quick access cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">User Management</CardTitle>
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardDescription>Manage user accounts and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    View and manage all users, assign roles, and handle user-related issues.
                  </p>
                  <Button variant="outline" className="w-full justify-between" asChild>
                    <Link href="/admin/users">
                      Manage Users
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Recipe Management</CardTitle>
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <CardDescription>Manage recipes and categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    Add, edit, or remove recipes. Manage categories and featured content.
                  </p>
                  <Button variant="outline" className="w-full justify-between" asChild>
                    <Link href="/admin/recipes">
                      Manage Recipes
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Support Messages</CardTitle>
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <CardDescription>View and respond to user inquiries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    Manage support messages from the chat widget. View, assign, and resolve tickets.
                  </p>
                  <Button variant="outline" className="w-full justify-between" asChild>
                    <Link href="/admin/support">
                      View Messages
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-start space-x-4 pb-4 border-b last:border-0">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium">User Registration</p>
                      <p className="text-sm text-gray-500">New user registered: johndoe@example.com</p>
                      <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
