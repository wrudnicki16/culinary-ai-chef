"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RecipeCreator } from "@/components/recipes/recipe-creator";
import { RecipeBrowser, RecipeBrowserParams } from "@/components/recipes/recipe-browser";
import { ChatWidget } from "@/components/ui/chat-widget";
import { HeroSection } from "@/components/sections/hero-section";
import { useRecipeViewer } from "@/components/recipes/recipe-viewer-provider";
import { Recipe } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [params, setParams] = useState<RecipeBrowserParams>({ search: "", filters: [], sort: "popular" });
  const { openRecipe } = useRecipeViewer();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <HeroSection onSearchSubmit={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)} />

          <RecipeCreator />

          <section>
            <RecipeBrowser
              title="Recommended For You"
              params={params}
              onParamsChange={setParams}
              onRecipeClick={(r: Recipe) => openRecipe(r)}
              onRecipeRate={(r: Recipe, rating: number) => openRecipe(r, rating)}
            />
          </section>
        </div>
      </main>

      <ChatWidget />
      <Footer />
    </div>
  );
}
