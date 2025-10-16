"use client"

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeDetailModal } from "@/components/recipes/recipe-detail-modal";
import { RecipeGenerator } from "@/components/recipes/recipe-generator";
import { FilterSidebar } from "@/components/recipes/filter-sidebar";
import { FilterChip } from "@/components/filters/filter-chip";
import { ChatWidget } from "@/components/ui/chat-widget";
import { HeroSection } from "@/components/sections/hero-section";
import { useToast } from "@/hooks/use-toast";
import { debounce } from "@/lib/utils";
import { Recipe } from "@/lib/types";
import { DIETARY_FILTERS } from "@/lib/utils";
import { ChevronDown, Search, Sliders } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortOption, setSortOption] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const { toast } = useToast();
  const newPageRef = useRef<HTMLDivElement>(null);

  const pageSize = 10;

  // Query recipes from API
  const { data, isLoading, error, isFetching } = useQuery<{recipes: Recipe[], total: number}>({
    queryKey: ["/api/recipes", { filters: activeFilters, search: searchTerm, sort: sortOption, page: currentPage, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Add filters
      if (activeFilters.length > 0) {
        activeFilters.forEach(filter => params.append('filters', filter));
      }
      
      // Add search
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Add sort
      if (sortOption) {
        params.append('sort', sortOption);
      }
      
      // Add pagination
      params.append('page', currentPage.toString());
      params.append('pageSize', pageSize.toString());
      
      const url = `/api/recipes?${params.toString()}`;
      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch recipes: ${response.statusText}`);
      }
      
      return response.json();
    },
  });
  
  // Manage accumulated recipes for pagination
  useEffect(() => {
    if (data?.recipes) {
      if (currentPage === 1) {
        // First page - replace all recipes
        setAllRecipes(data.recipes);
      } else {
        // Subsequent pages - append to existing recipes
        setAllRecipes(prev => {
          const newRecipes = [...prev, ...data.recipes];
          
          // Only scroll if we're actually adding new content
          if (newRecipes.length > prev.length) {
            // Auto-scroll to first recipe of the new page after a short delay
            setTimeout(() => {
              if (newPageRef.current) {
                const elementPosition = newPageRef.current.getBoundingClientRect().top;
                const scrollAmount = elementPosition - 84; // Account for 72px header + 12px padding
                
                window.scrollBy({
                  top: scrollAmount,
                  behavior: 'smooth'
                });
              }
            }, 100);
          }
          
          return newRecipes;
        });
      }
    }
  }, [data?.recipes, currentPage]);

  // Reset pagination when filters, search, or sort changes
  useEffect(() => {
    setCurrentPage(1);
    setAllRecipes([]);
  }, [activeFilters, searchTerm, sortOption]);
  
  // Use accumulated recipes for display
  const recipes = allRecipes;

  // Debounced search function
  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const handleFilterChange = (filters: string[]) => {
    setActiveFilters(filters);
  };

  const removeFilter = (filterId: string) => {
    setActiveFilters(activeFilters.filter(id => id !== filterId));
  };

  const openRecipeDetails = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };

  const closeRecipeDetails = () => {
    setIsModalOpen(false);
  };

  const handleRecipeGenerated = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };

  const handleLoadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  // Calculate if there are more recipes to load
  const hasMoreRecipes = data?.total ? allRecipes.length < data.total : false;

  // Show error toast if fetch fails
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load recipes. Please try again later.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Find filter label by ID
  const getFilterLabelById = (filterId: string) => {
    for (const category of Object.values(DIETARY_FILTERS)) {
      const filter = category.find(f => f.id === filterId);
      if (filter) return filter.label;
    }
    return filterId;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Banner */}
          <HeroSection onSearchChange={handleSearchInput} />

          <div className="flex flex-col md:flex-row gap-8">
            {/* Filter Sidebar */}
            <FilterSidebar
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
            />

            {/* Main Content */}
            <div className="flex-1">
              {/* Active Filters */}
              {activeFilters.length > 0 && (
                <div className="mb-6 flex items-center flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-500">
                    Active filters:
                  </span>
                  {activeFilters.map((filterId) => (
                    <FilterChip
                      key={filterId}
                      id={filterId}
                      label={getFilterLabelById(filterId)}
                      isActive={true}
                      onClick={() => {}}
                      onRemove={() => removeFilter(filterId)}
                    />
                  ))}
                </div>
              )}

              {/* Recipe Generator */}
              <RecipeGenerator onRecipeGenerated={handleRecipeGenerated} />

              {/* Recipe Recommendations */}
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-heading font-semibold">
                    Recommended For You
                  </h2>
                  <div className="flex gap-3">
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
                      <Sliders className="h-5 w-5" />
                    </Button>
                    <Select
                      value={sortOption}
                      onValueChange={(value) => setSortOption(value)}
                    >
                      <SelectTrigger className="w-[140px] text-sm">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="popular">Most Popular</SelectItem>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="quickest">Quickest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Recipe Grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-xl shadow-sm h-80 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {recipes?.map((recipe, index) => (
                        <div
                          key={`recipe-${recipe.id}`}
                          ref={index === pageSize * (currentPage - 1) ? newPageRef : null}
                        >
                          <RecipeCard
                            recipe={recipe}
                            onClick={() => openRecipeDetails(recipe)}
                          />
                        </div>
                      ))}

                      {recipes?.length === 0 && (
                        <div className="col-span-3 py-12 text-center">
                          <p className="text-gray-500">
                            No recipes found matching your criteria. Try adjusting your filters.
                          </p>
                        </div>
                      )}
                    </div>

                    {recipes && recipes.length > 0 && hasMoreRecipes && (
                      <div className="mt-8 text-center">
                        <Button 
                          variant="outline" 
                          className="inline-flex items-center"
                          onClick={handleLoadMore}
                          disabled={isFetching}
                        >
                          {isFetching ? "Loading..." : "Load More Recipes"}
                          <ChevronDown className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>

      <ChatWidget />
      <Footer />

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        open={isModalOpen}
        onClose={closeRecipeDetails}
      />
    </div>
  );
}
