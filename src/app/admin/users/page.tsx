"use client"

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { ChevronLeft, MoreVertical, Search, UserCog } from "lucide-react";
import { User } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminUsersData {
  admins: User[];
  users: User[];
}

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleChangeUserId, setRoleChangeUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AdminUsersData>({
    queryKey: ["/api/admin/users"],
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role updated",
        description: "User role has been updated successfully",
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleRoleChangeClick = (userId: string) => {
    const user = [...(data?.admins || []), ...(data?.users || [])].find(
      (u) => u.id === userId
    );
    
    if (user) {
      setRoleChangeUserId(userId);
      setNewRole(user.roles.includes("admin") ? "user" : "admin");
      setIsDialogOpen(true);
    }
  };

  const confirmRoleChange = () => {
    if (roleChangeUserId && newRole) {
      changeRoleMutation.mutate({ userId: roleChangeUserId, role: newRole });
    }
  };

  // Filter users based on search term
  const filteredUsers = () => {
    if (!data) return { admins: [], users: [] };

    const filterFn = (user: User) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        !searchTerm ||
        (user.firstName && user.firstName.toLowerCase().includes(searchLower)) ||
        (user.lastName && user.lastName.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower))
      );
    };

    return {
      admins: data.admins.filter(filterFn),
      users: data.users.filter(filterFn),
    };
  };

  const { admins, users } = filteredUsers();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/admin" className="text-gray-500 hover:text-gray-900 flex items-center mb-4">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to dashboard
            </Link>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">User Management</h1>
                <p className="text-gray-600 mt-1">View and manage user accounts and permissions</p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle>All Users</CardTitle>
                <div className="w-full sm:w-auto">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search users..."
                      className="pl-9"
                      value={searchTerm}
                      onChange={handleSearch}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <div className="loader"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Admin Users */}
                  <div>
                    <h3 className="font-medium text-lg mb-3">Administrators</h3>
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {admins.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-4">
                                No admin users found
                              </TableCell>
                            </TableRow>
                          )}
                          
                          {admins.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-mono text-xs">{user.id}</TableCell>
                              <TableCell className="flex items-center">
                                <div className="h-8 w-8 rounded-full overflow-hidden mr-2">
                                  <img
                                    src={user.profileImageUrl || "https://github.com/shadcn.png"}
                                    alt={`${user.firstName} ${user.lastName}`}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <span>{user.firstName} {user.lastName}</span>
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>
                                <Badge className="bg-primary text-white">Admin</Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(user.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleRoleChangeClick(user.id)}
                                    >
                                      <UserCog className="h-4 w-4 mr-2" />
                                      Change to Regular User
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Regular Users */}
                  <div>
                    <h3 className="font-medium text-lg mb-3">Regular Users</h3>
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-4">
                                No regular users found
                              </TableCell>
                            </TableRow>
                          )}
                          
                          {users.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-mono text-xs">{user.id}</TableCell>
                              <TableCell className="flex items-center">
                                <div className="h-8 w-8 rounded-full overflow-hidden mr-2">
                                  <img
                                    src={user.profileImageUrl || "https://github.com/shadcn.png"}
                                    alt={`${user.firstName} ${user.lastName}`}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <span>{user.firstName} {user.lastName}</span>
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">User</Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(user.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleRoleChangeClick(user.id)}
                                    >
                                      <UserCog className="h-4 w-4 mr-2" />
                                      Promote to Admin
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

      {/* Role Change Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change the user&apos;s role and permission level.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select new role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="user">Regular User</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-sm text-gray-500">
              {newRole === "admin"
                ? "Administrators have full access to all areas of the application."
                : "Regular users have limited access to application features."}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRoleChange}
              disabled={changeRoleMutation.isPending}
            >
              {changeRoleMutation.isPending ? "Updating..." : "Change Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
