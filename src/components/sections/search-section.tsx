"use client"

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface SearchSectionProps {
  onSearchSubmit: (query: string) => void;
}

export function SearchSection({ onSearchSubmit }: SearchSectionProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const q = value.trim();
    if (q) onSearchSubmit(q);
  };

  return (
    <form
      className="relative max-w-xl"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter ingredients, cuisine, or dish name..."
        className="w-full py-3 px-4 pr-12 rounded-lg border-0 shadow-md focus:ring-2 focus:ring-primary text-gray-900"
      />
      <Button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80"
        variant="ghost"
        size="icon"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </Button>
    </form>
  );
}
