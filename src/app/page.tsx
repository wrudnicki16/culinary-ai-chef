"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RecipeDetailModal } from "@/components/recipes/recipe-detail-modal";
import { RecipeCreator } from "@/components/recipes/recipe-creator";
import { RecipeBrowser, RecipeBrowserParams } from "@/components/recipes/recipe-browser";
import { ChatWidget } from "@/components/ui/chat-widget";
import { HeroSection } from "@/components/sections/hero-section";
import { Recipe } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [params, setParams] = useState<RecipeBrowserParams>({ search: "", filters: [], sort: "popular" });
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <HeroSection onSearchSubmit={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)} />

          <RecipeCreator onRecipeGenerated={openRecipe} />

          <section>
            <h2 className="text-xl font-heading font-semibold mb-5">Recommended For You</h2>
            <RecipeBrowser params={params} onParamsChange={setParams} onRecipeClick={openRecipe} />
          </section>
        </div>
      </main>

      <ChatWidget />
      <Footer />

      <RecipeDetailModal recipe={selectedRecipe} open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
