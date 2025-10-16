"use client"

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface SearchSectionProps {
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SearchSection({ onSearchChange }: SearchSectionProps) {
  return (
    <div className="relative max-w-xl">
      <Input
        type="text"
        placeholder="Enter ingredients, cuisine, or dish name..."
        className="w-full py-3 px-4 pr-12 rounded-lg border-0 shadow-md focus:ring-2 focus:ring-primary text-gray-900"
        onChange={onSearchChange}
      />
      <Button
        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80"
        variant="ghost"
        size="icon"
      >
        <Search className="h-5 w-5" />
      </Button>
    </div>
  );
}