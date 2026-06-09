"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Search, Sliders } from "lucide-react";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { FilterSidebar } from "@/components/recipes/filter-sidebar";
import { FilterChip } from "@/components/filters/filter-chip";
import { useToast } from "@/hooks/use-toast";
import { debounce, DIETARY_FILTERS } from "@/lib/utils";
import { Recipe } from "@/lib/types";

export interface RecipeBrowserParams {
  search: string;
  filters: string[];
  sort: string;
}

interface RecipeBrowserProps {
  params: RecipeBrowserParams;
  onParamsChange: (next: RecipeBrowserParams) => void;
  onRecipeClick: (recipe: Recipe) => void;
  showSearch?: boolean;
}

const PAGE_SIZE = 10;

function filterLabel(id: string): string {
  for (const group of Object.values(DIETARY_FILTERS)) {
    const f = group.find((x) => x.id === id);
    if (f) return f.label;
  }
  return id;
}

export function RecipeBrowser({ params, onParamsChange, onRecipeClick, showSearch }: RecipeBrowserProps) {
  const { search, filters, sort } = params;
  const filterKey = filters.join(",");

  const [page, setPage] = useState(1);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [searchInput, setSearchInput] = useState(search);
  const { toast } = useToast();
  const newPageRef = useRef<HTMLDivElement>(null);

  // Keep the controlled search box in step with the URL (back/forward + initial).
  useEffect(() => { setSearchInput(search); }, [search]);

  // Stable debounced push of typed search → params (refs hold latest values).
  const paramsRef = useRef(params); paramsRef.current = params;
  const onChangeRef = useRef(onParamsChange); onChangeRef.current = onParamsChange;
  const pushSearch = useRef(
    debounce((value: string) => onChangeRef.current({ ...paramsRef.current, search: value }), 500)
  ).current;

  const { data, isLoading, error, isFetching } = useQuery<{ recipes: Recipe[]; total: number }>({
    queryKey: ["/api/recipes", { filters, search, sort, page, pageSize: PAGE_SIZE }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      filters.forEach((f) => sp.append("filters", f));
      if (search) sp.append("search", search);
      if (sort) sp.append("sort", sort);
      sp.append("page", String(page));
      sp.append("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/recipes?${sp.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch recipes: ${res.statusText}`);
      return res.json();
    },
  });

  // Accumulate across pages (page 1 replaces; later pages append + scroll).
  useEffect(() => {
    if (!data?.recipes) return;
    if (page === 1) {
      setAllRecipes(data.recipes);
    } else {
      setAllRecipes((prev) => {
        const next = [...prev, ...data.recipes];
        if (next.length > prev.length) {
          setTimeout(() => {
            if (newPageRef.current) {
              const top = newPageRef.current.getBoundingClientRect().top;
              window.scrollBy({ top: top - 84, behavior: "smooth" });
            }
          }, 100);
        }
        return next;
      });
    }
  }, [data?.recipes, page]);

  // Reset to page 1 when query inputs change — but NOT on initial mount (a cached
  // remount fills allRecipes synchronously; the guard prevents wiping it).
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setPage(1);
    setAllRecipes([]);
  }, [search, filterKey, sort]);

  useEffect(() => {
    if (error) {
      toast({ title: "Error", description: "Failed to load recipes. Please try again later.", variant: "destructive" });
    }
  }, [error, toast]);

  const recipes = allRecipes.length > 0 ? allRecipes : data?.recipes ?? [];
  const hasMore = data?.total ? recipes.length < data.total : false;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <FilterSidebar activeFilters={filters} onFilterChange={(next) => onParamsChange({ ...params, filters: next })} />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3 mb-5">
          {showSearch ? (
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchInput}
                  placeholder="Search by ingredient, cuisine, or dish…"
                  className="pl-9"
                  aria-label="Search recipes"
                  onChange={(e) => { setSearchInput(e.target.value); pushSearch(e.target.value); }}
                />
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap">{data?.total ?? 0} results</span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex gap-3 items-center">
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
              <Sliders className="h-5 w-5" />
            </Button>
            <Select value={sort} onValueChange={(value) => onParamsChange({ ...params, sort: value })}>
              <SelectTrigger className="w-[140px] text-sm"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="quickest">Quickest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filters.length > 0 && (
          <div className="mb-6 flex items-center flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-500">Active filters:</span>
            {filters.map((id) => (
              <FilterChip
                key={id}
                id={id}
                label={filterLabel(id)}
                isActive
                onClick={() => {}}
                onRemove={() => onParamsChange({ ...params, filters: filters.filter((f) => f !== id) })}
              />
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recipes.map((recipe, index) => (
                <div key={`recipe-${recipe.id}`} ref={index === PAGE_SIZE * (page - 1) ? newPageRef : null}>
                  <RecipeCard recipe={recipe} onClick={() => onRecipeClick(recipe)} />
                </div>
              ))}
              {recipes.length === 0 && (
                <div className="col-span-3 py-12 text-center">
                  <p className="text-gray-500">No recipes found matching your criteria. Try adjusting your filters.</p>
                </div>
              )}
            </div>
            {recipes.length > 0 && hasMore && (
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  className="inline-flex items-center"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isFetching}
                >
                  {isFetching ? "Loading..." : "Load More Recipes"}
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
