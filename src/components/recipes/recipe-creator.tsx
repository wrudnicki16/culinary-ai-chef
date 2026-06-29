"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sparkles, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuidedRecipeModal } from "./guided-recipe-modal";
import { CustomRecipePrompt } from "./custom-recipe-prompt";
import { useGeneration } from "@/components/generation/generation-provider";

export function RecipeCreator() {
  const { status } = useSession();
  const { start, isGenerating } = useGeneration();
  const [showGuided, setShowGuided] = useState(false);

  const generate = (prompt: string, dietaryFilters: string[]) => {
    setShowGuided(false);
    void start(prompt, dietaryFilters);
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
            <Button className="bg-primary hover:bg-primary/90 text-white" disabled={isGenerating} onClick={() => setShowGuided(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Generate recipe (guided)
            </Button>
            {isGenerating && <p className="text-xs text-gray-400 mt-2">A recipe's already cooking…</p>}
          </div>

          <div className="text-center text-xs font-medium text-gray-400">— OR —</div>

          <CustomRecipePrompt onGenerate={(text) => generate(text, [])} disabled={isGenerating} />
        </CardContent>
      </Card>

      <GuidedRecipeModal open={showGuided} onClose={() => setShowGuided(false)} onGenerate={generate} />
    </>
  );
}
