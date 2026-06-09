"use client"

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RecipeDetailModal } from "@/components/recipes/recipe-detail-modal";
import { RecipeBrowser, RecipeBrowserParams } from "@/components/recipes/recipe-browser";
import { Recipe } from "@/lib/types";

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params: RecipeBrowserParams = {
    search: searchParams.get("q") ?? "",
    filters: (searchParams.get("filters") ?? "").split(",").filter(Boolean),
    sort: searchParams.get("sort") || "popular",
  };

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const writeParams = (next: RecipeBrowserParams) => {
    const sp = new URLSearchParams();
    if (next.search) sp.set("q", next.search);
    if (next.filters.length) sp.set("filters", next.filters.join(","));
    if (next.sort && next.sort !== "popular") sp.set("sort", next.sort);
    const qs = sp.toString();
    router.replace(qs ? `/search?${qs}` : "/search");
  };

  return (
    <>
      <Link href="/" className="text-gray-500 hover:text-gray-900 flex items-center mb-4">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to home
      </Link>
      <h1 className="text-2xl font-bold mb-5">Search recipes</h1>
      <RecipeBrowser
        params={params}
        onParamsChange={writeParams}
        onRecipeClick={(r) => { setSelectedRecipe(r); setIsModalOpen(true); }}
        showSearch
      />
      <RecipeDetailModal recipe={selectedRecipe} open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading search…</div>}>
            <SearchPageContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
