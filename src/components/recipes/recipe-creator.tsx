"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sparkles, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Recipe } from "@/lib/types";
import { AILoadingModal } from "./ai-loading-modal";
import { GuidedRecipeModal } from "./guided-recipe-modal";
import { CustomRecipePrompt } from "./custom-recipe-prompt";

interface RecipeCreatorProps {
  onRecipeGenerated: (recipe: Recipe) => void;
}

export function RecipeCreator({ onRecipeGenerated }: RecipeCreatorProps) {
  const { status } = useSession();
  const { toast } = useToast();
  const [showGuided, setShowGuided] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);

  const generate = async (prompt: string, dietaryFilters: string[]) => {
    setShowGuided(false);
    setIsCancelled(false);
    setIsGenerating(true);
    setGenerationProgress(0);
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        const next = prev + Math.random() * 15;
        return next > 95 ? 95 : next;
      });
    }, 800);
    try {
      const response = await apiRequest("POST", "/api/recipes/generate", { prompt, dietaryFilters });
      if (isCancelled) { clearInterval(progressInterval); return; }
      if (!response.ok) throw new Error("Failed to generate recipe");
      const recipe = await response.json();
      if (isCancelled) { clearInterval(progressInterval); return; }
      setGenerationProgress(100);
      setTimeout(() => {
        if (!isCancelled) {
          setIsGenerating(false);
          clearInterval(progressInterval);
          queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
          onRecipeGenerated(recipe);
        }
      }, 500);
    } catch (error: unknown) {
      clearInterval(progressInterval);
      if (isCancelled) return;
      setIsGenerating(false);
      if (isUnauthorizedError(error)) {
        toast({ title: "Authentication required", description: "Redirecting to login…", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/auth/signin"; }, 1500);
        return;
      }
      toast({ title: "Recipe generation failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleCancelGeneration = () => {
    setIsCancelled(true);
    setIsGenerating(false);
    setGenerationProgress(0);
    toast({ title: "Recipe generation cancelled", variant: "default" });
  };

  if (status === "unauthenticated") {
    return (
      <Card className="mb-8">
        <CardHeader><CardTitle className="text-lg">Create a recipe</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <LogIn className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sign in to generate recipes</h3>
            <Button onClick={() => (window.location.href = "/api/auth/signin")} className="bg-primary hover:bg-primary/90 text-white">
              <LogIn className="h-4 w-4 mr-2" /> Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-8">
        <CardHeader><CardTitle className="text-lg">Create a recipe</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center border border-dashed border-gray-200 rounded-lg p-5">
            <p className="font-medium">Generate your recipe</p>
            <p className="text-sm text-gray-500 mb-3">Guided — pick diet, cuisine, allergies, or hit Surprise me.</p>
            <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setShowGuided(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Generate recipe (guided)
            </Button>
          </div>

          <div className="text-center text-xs font-medium text-gray-400">— OR —</div>

          <CustomRecipePrompt onGenerate={(text) => generate(text, [])} disabled={isGenerating} />
        </CardContent>
      </Card>

      <GuidedRecipeModal open={showGuided} onClose={() => setShowGuided(false)} onGenerate={generate} />

      <AILoadingModal isOpen={isGenerating} progress={generationProgress} onCancel={handleCancelGeneration} />
    </>
  );
}
