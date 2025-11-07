"use client"

import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, User, AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  id: number;
  userId: string;
  content: string;
  isUserMessage: boolean;
  createdAt: Date;
}

export default function SupportPage() {
  const { data: session, status } = useSession();
  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/admin/support"],
    enabled: !!session && (session.user as {roles?: string[]})?.roles?.includes('admin'),
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
  if (!session || !(session.user as {roles?: string[]})?.roles?.includes('admin')) {
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
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Support Messages</h1>
            <p className="text-gray-600 mt-2">View and manage user chat messages</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Messages</CardTitle>
              <CardDescription>Latest user interactions from the chat widget</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-gray-600">Loading messages...</span>
                </div>
              ) : !messages || messages.length === 0 ? (
                <div className="text-center py-16">
                  <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Messages</h3>
                  <p className="text-gray-600">No support messages have been received yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          {message.isUserMessage ? (
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                              <MessageSquare className="h-5 w-5 text-green-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900">
                              {message.isUserMessage ? 'User' : 'AI Assistant'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(message.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs text-gray-500 mt-1">User ID: {message.userId}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
