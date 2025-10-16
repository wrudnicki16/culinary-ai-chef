"use client"

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Star, 
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Recipe } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function AdminRecipes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [deleteRecipeId, setDeleteRecipeId] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const pageSize = 10;
  
  const { data, isLoading } = useQuery<{
    recipes: Recipe[];
    total: number;
  }>({
    queryKey: ["/api/admin/recipes", { page, search: searchTerm }],
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      return await apiRequest("DELETE", `/api/admin/recipes/${recipeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recipes"] });
      toast({
        title: "Recipe deleted",
        description: "The recipe has been deleted successfully",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the recipe. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page on new search
  };
  
  const handleDeleteClick = (recipeId: number) => {
    setDeleteRecipeId(recipeId);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (deleteRecipeId) {
      deleteRecipeMutation.mutate(deleteRecipeId);
    }
  };
  
  const totalPages = Math.ceil((data?.total || 0) / pageSize);
  
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
                <h1 className="text-3xl font-bold">Recipe Management</h1>
                <p className="text-gray-600 mt-1">View, edit, and manage all recipes</p>
              </div>
              <Button asChild>
                <Link href="/admin/recipes/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Recipe
                </Link>
              </Button>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle>All Recipes</CardTitle>
                <div className="w-full sm:w-auto flex space-x-2">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search recipes..."
                      className="pl-9"
                      value={searchTerm}
                      onChange={handleSearch}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <div className="loader"></div>
                </div>
              ) : (
                <>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.recipes?.map((recipe) => (
                          <TableRow key={recipe.id}>
                            <TableCell className="font-medium">{recipe.id}</TableCell>
                            <TableCell>{recipe.title}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {recipe.dietaryTags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {recipe.dietaryTags.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{recipe.dietaryTags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Star className="h-4 w-4 text-yellow-400 mr-1" />
                                <span>{recipe.rating.toFixed(1)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {new Date(recipe.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={recipe.isVerified ? "default" : "outline"} 
                                className={!recipe.isVerified ? "bg-yellow-100 text-yellow-800" : undefined}
                              >
                                {recipe.isVerified ? "Verified" : "Unverified"}
                              </Badge>
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
                                  <DropdownMenuItem asChild>
                                    <Link href={`/admin/recipes/${recipe.id}/view`}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/admin/recipes/${recipe.id}/edit`}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteClick(recipe.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {data?.recipes?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8">
                              <p className="text-gray-500">No recipes found</p>
                              <Button variant="link" asChild className="mt-2">
                                <Link href="/admin/recipes/new">Add a new recipe</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <p className="text-sm text-gray-500">
                        Showing {Math.min((page - 1) * pageSize + 1, data?.total || 0)} to {Math.min(page * pageSize, data?.total || 0)} of {data?.total || 0} recipes
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={page === 1}
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={page >= totalPages}
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
      
      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recipe</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this recipe? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteRecipeMutation.isPending}
            >
              {deleteRecipeMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
