import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterChip } from "@/components/filters/filter-chip";
import { DIETARY_FILTERS } from "@/lib/utils";

interface FilterSidebarProps {
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
}

export function FilterSidebar({
  activeFilters,
  onFilterChange,
}: FilterSidebarProps) {
  const [selectedFilters, setSelectedFilters] = useState<string[]>(activeFilters);

  const toggleFilter = (filterId: string) => {
    setSelectedFilters((prev) => {
      if (prev.includes(filterId)) {
        return prev.filter((id) => id !== filterId);
      } else {
        return [...prev, filterId];
      }
    });
  };

  const handleApplyFilters = () => {
    onFilterChange(selectedFilters);
  };

  const handleResetFilters = () => {
    setSelectedFilters([]);
    onFilterChange([]);
  };

  return (
    <aside className="md:w-64 flex-shrink-0">
      <Card className="sticky top-24">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Dietary Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div>
              <h4 className="font-medium text-sm text-gray-500 mb-2">Diet Type</h4>
              <div className="flex flex-wrap gap-2">
                {DIETARY_FILTERS.dietType.map((filter) => (
                  <FilterChip
                    key={filter.id}
                    id={filter.id}
                    label={filter.label}
                    isActive={selectedFilters.includes(filter.id)}
                    onClick={() => toggleFilter(filter.id)}
                  />
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm text-gray-500 mb-2">
                Allergies & Restrictions
              </h4>
              <div className="flex flex-wrap gap-2">
                {DIETARY_FILTERS.allergies.map((filter) => (
                  <FilterChip
                    key={filter.id}
                    id={filter.id}
                    label={filter.label}
                    isActive={selectedFilters.includes(filter.id)}
                    onClick={() => toggleFilter(filter.id)}
                  />
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm text-gray-500 mb-2">
                Health Concerns
              </h4>
              <div className="flex flex-wrap gap-2">
                {DIETARY_FILTERS.health.map((filter) => (
                  <FilterChip
                    key={filter.id}
                    id={filter.id}
                    label={filter.label}
                    isActive={selectedFilters.includes(filter.id)}
                    onClick={() => toggleFilter(filter.id)}
                  />
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm text-gray-500 mb-2">Trending</h4>
              <div className="flex flex-wrap gap-2">
                {DIETARY_FILTERS.trending.map((filter) => (
                  <FilterChip
                    key={filter.id}
                    id={filter.id}
                    label={filter.label}
                    isActive={selectedFilters.includes(filter.id)}
                    onClick={() => toggleFilter(filter.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-200">
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-white"
              onClick={handleApplyFilters}
            >
              Apply Filters
            </Button>
            <Button
              variant="ghost"
              className="w-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 mt-2 text-sm"
              onClick={handleResetFilters}
            >
              Reset All
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
