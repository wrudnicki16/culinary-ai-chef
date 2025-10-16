"use client"

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Heart, Bookmark, ChevronDown, Utensils } from "lucide-react";

export function Header() {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [isAdmin] = useState(() => user?.roles?.includes("admin") || false);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link href="/">
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <Utensils className="text-primary h-6 w-6" />
                <h1 className="text-xl font-heading font-bold text-gray-800 ml-2">
                  AI Recipe Generator
                </h1>
              </div>
            </div>
          </Link>

          <div className="flex items-center space-x-4">
            {isAuthenticated && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex hover:text-primary"
                >
                  <Heart className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex hover:text-primary"
                >
                  <Bookmark className="h-5 w-5" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center p-0 space-x-1"
                    >
                      <img
                        src={user?.profileImageUrl || "https://github.com/shadcn.png"}
                        alt="User profile"
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <ChevronDown className="h-4 w-4 text-gray-600" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Link href="/dashboard">Your Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/dashboard">Saved Recipes</Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Link href="/admin">Admin Dashboard</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Link href="/admin/recipes">Manage Recipes</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Link href="/admin/users">Manage Users</Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <a href="/api/logout">Sign out</a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {!isAuthenticated && pathname !== "/api/auth/signin" && (
              <Button asChild>
                <a href="/api/auth/signin">Sign In</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
