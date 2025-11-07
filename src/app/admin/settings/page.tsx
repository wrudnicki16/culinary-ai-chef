"use client"

import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Database, Shield, Bell, AlertTriangle, LogIn } from "lucide-react";

export default function SettingsPage() {
  const { data: session, status } = useSession();

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
            <h1 className="text-3xl font-bold">Admin Settings</h1>
            <p className="text-gray-600 mt-2">Configure application settings and preferences</p>
          </div>

          <div className="space-y-6">
            {/* General Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  <CardTitle>General Settings</CardTitle>
                </div>
                <CardDescription>Configure general application settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <h4 className="font-medium">Application Name</h4>
                      <p className="text-sm text-gray-600">The name of your application</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <h4 className="font-medium">Maintenance Mode</h4>
                      <p className="text-sm text-gray-600">Enable maintenance mode for updates</p>
                    </div>
                    <Button variant="outline" size="sm">Toggle</Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium">Allow User Registration</h4>
                      <p className="text-sm text-gray-600">Control whether new users can register</p>
                    </div>
                    <Button variant="outline" size="sm">Toggle</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>Security Settings</CardTitle>
                </div>
                <CardDescription>Manage security and authentication settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <h4 className="font-medium">Two-Factor Authentication</h4>
                      <p className="text-sm text-gray-600">Require 2FA for admin accounts</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <h4 className="font-medium">Session Timeout</h4>
                      <p className="text-sm text-gray-600">Set automatic logout duration</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium">Password Policy</h4>
                      <p className="text-sm text-gray-600">Configure password requirements</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle>Database Settings</CardTitle>
                </div>
                <CardDescription>Manage database and backup settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <h4 className="font-medium">Database Backup</h4>
                      <p className="text-sm text-gray-600">Schedule automatic database backups</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <h4 className="font-medium">Data Retention</h4>
                      <p className="text-sm text-gray-600">Set how long to keep old data</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium">Cache Settings</h4>
                      <p className="text-sm text-gray-600">Configure caching behavior</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle>Notification Settings</CardTitle>
                </div>
                <CardDescription>Configure notification preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <h4 className="font-medium">Email Notifications</h4>
                      <p className="text-sm text-gray-600">Send email alerts to admins</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <h4 className="font-medium">Error Reporting</h4>
                      <p className="text-sm text-gray-600">Configure error notification settings</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium">User Activity Alerts</h4>
                      <p className="text-sm text-gray-600">Get notified of suspicious activity</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
