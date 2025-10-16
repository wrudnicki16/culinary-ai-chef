"use client"

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeDetailModal } from "@/components/recipes/recipe-detail-modal";
import { useQuery } from "@tanstack/react-query";
import { Recipe } from "@/lib/types";
import { User, Settings, ShoppingCart, Heart, History, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("saved");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: savedRecipes, isLoading: isLoadingSaved } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes/saved"],
    enabled: activeTab === "saved",
  });

  const { data: generatedRecipes, isLoading: isLoadingGenerated } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes/generated"],
    enabled: activeTab === "generated",
  });

  const { data: groceryList, isLoading: isLoadingGrocery } = useQuery<any[]>({
    queryKey: ["/api/groceries"],
    enabled: activeTab === "grocery",
  });

  const openRecipeDetails = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };

  const closeRecipeDetails = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/" className="text-gray-500 hover:text-gray-900 flex items-center mb-4">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to recipes
            </Link>
            <h1 className="text-3xl font-bold">Your Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage your recipes, preferences, and account settings</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden">
                    <img
                      src={user?.image || "https://github.com/shadcn.png"}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <CardTitle>{user?.name || "User"}</CardTitle>
                    <CardDescription>{user?.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start ${activeTab === "saved" ? "bg-primary/10 text-primary" : ""}`}
                    onClick={() => setActiveTab("saved")}
                  >
                    <Heart className="mr-2 h-4 w-4" />
                    Saved Recipes
                  </Button>
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start ${activeTab === "generated" ? "bg-primary/10 text-primary" : ""}`}
                    onClick={() => setActiveTab("generated")}
                  >
                    <History className="mr-2 h-4 w-4" />
                    Generated History
                  </Button>
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start ${activeTab === "grocery" ? "bg-primary/10 text-primary" : ""}`}
                    onClick={() => setActiveTab("grocery")}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Grocery List
                  </Button>
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start ${activeTab === "profile" ? "bg-primary/10 text-primary" : ""}`}
                    onClick={() => setActiveTab("profile")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Button>
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start ${activeTab === "settings" ? "bg-primary/10 text-primary" : ""}`}
                    onClick={() => setActiveTab("settings")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-5 mb-8">
                  <TabsTrigger value="saved">Saved</TabsTrigger>
                  <TabsTrigger value="generated">Generated</TabsTrigger>
                  <TabsTrigger value="grocery">Grocery</TabsTrigger>
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="saved">
                  <Card>
                    <CardHeader>
                      <CardTitle>Saved Recipes</CardTitle>
                      <CardDescription>
                        Recipes you've bookmarked for future reference
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingSaved ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-gray-100 rounded-lg h-48 animate-pulse" />
                          ))}
                        </div>
                      ) : savedRecipes && savedRecipes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {savedRecipes.map(recipe => (
                            <RecipeCard
                              key={recipe.id}
                              recipe={recipe}
                              onClick={() => openRecipeDetails(recipe)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Heart className="mx-auto h-12 w-12 text-gray-300" />
                          <h3 className="mt-4 text-lg font-medium">No saved recipes yet</h3>
                          <p className="mt-1 text-gray-500">
                            When you save recipes, they'll appear here
                          </p>
                          <Button className="mt-4" asChild>
                            <Link href="/">Browse Recipes</Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="generated">
                  <Card>
                    <CardHeader>
                      <CardTitle>Generated Recipes</CardTitle>
                      <CardDescription>
                        Recipes you've created using our AI generator
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingGenerated ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-gray-100 rounded-lg h-48 animate-pulse" />
                          ))}
                        </div>
                      ) : generatedRecipes && generatedRecipes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {generatedRecipes.map(recipe => (
                            <RecipeCard
                              key={recipe.id}
                              recipe={recipe}
                              onClick={() => openRecipeDetails(recipe)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <History className="mx-auto h-12 w-12 text-gray-300" />
                          <h3 className="mt-4 text-lg font-medium">No generated recipes yet</h3>
                          <p className="mt-1 text-gray-500">
                            Try our AI recipe generator to create custom recipes
                          </p>
                          <Button className="mt-4" asChild>
                            <Link href="/">Generate a Recipe</Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="grocery">
                  <Card>
                    <CardHeader>
                      <CardTitle>Grocery List</CardTitle>
                      <CardDescription>
                        Ingredients from your saved recipes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingGrocery ? (
                        <div className="animate-pulse space-y-3">
                          {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-8 bg-gray-100 rounded-md" />
                          ))}
                        </div>
                      ) : groceryList && groceryList.length > 0 ? (
                        <div className="space-y-2">
                          {groceryList.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                              <span>{item.name}</span>
                              <span className="text-gray-500">{item.quantity}</span>
                            </div>
                          ))}
                          <div className="mt-4 flex justify-end">
                            <Button>
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              Order Ingredients
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <ShoppingCart className="mx-auto h-12 w-12 text-gray-300" />
                          <h3 className="mt-4 text-lg font-medium">Your grocery list is empty</h3>
                          <p className="mt-1 text-gray-500">
                            Add ingredients from recipes to your grocery list
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="profile">
                  <Card>
                    <CardHeader>
                      <CardTitle>Profile Information</CardTitle>
                      <CardDescription>
                        Manage your personal information and preferences
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-medium">Personal Information</h3>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm text-gray-500">First Name</label>
                              <div className="mt-1 p-2 border rounded-md">{user?.firstName || "Not set"}</div>
                            </div>
                            <div>
                              <label className="text-sm text-gray-500">Last Name</label>
                              <div className="mt-1 p-2 border rounded-md">{user?.lastName || "Not set"}</div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-sm text-gray-500">Email</label>
                              <div className="mt-1 p-2 border rounded-md">{user?.email}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="font-medium">Dietary Preferences</h3>
                          <p className="text-sm text-gray-500 mt-1 mb-2">
                            Set your default dietary preferences for recipe suggestions
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm">Vegetarian</Button>
                            <Button variant="outline" size="sm">High Protein</Button>
                            <Button variant="outline" size="sm">Low Carb</Button>
                            <Button variant="outline" size="sm">+ Add More</Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="settings">
                  <Card>
                    <CardHeader>
                      <CardTitle>Account Settings</CardTitle>
                      <CardDescription>
                        Manage your account preferences and notifications
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div>
                          <h3 className="font-medium">Notification Preferences</h3>
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span>Email notifications</span>
                              <Button variant="outline" size="sm">Enable</Button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Recipe recommendations</span>
                              <Button variant="outline" size="sm">Enable</Button>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="font-medium">Privacy Settings</h3>
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span>Public profile</span>
                              <Button variant="outline" size="sm">Disable</Button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Share my recipes</span>
                              <Button variant="outline" size="sm">Enable</Button>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="font-medium text-red-600">Danger Zone</h3>
                          <div className="mt-2">
                            <Button variant="destructive">Delete Account</Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      
      <RecipeDetailModal
        recipe={selectedRecipe}
        open={isModalOpen}
        onClose={closeRecipeDetails}
      />
    </div>
  );
}
