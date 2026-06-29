"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { Recipe } from "@/lib/types";
import { RecipeDetailModal } from "./recipe-detail-modal";

interface RecipeViewerContextValue {
  openRecipe: (recipe: Recipe, rating?: number) => void;
  closeRecipe: () => void;
}

const RecipeViewerContext = createContext<RecipeViewerContextValue | null>(null);

export function useRecipeViewer(): RecipeViewerContextValue {
  const ctx = useContext(RecipeViewerContext);
  if (!ctx) throw new Error("useRecipeViewer must be used within RecipeViewerProvider");
  return ctx;
}

export function RecipeViewerProvider({ children }: { children: React.ReactNode }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [open, setOpen] = useState(false);
  const [initialRating, setInitialRating] = useState<number | undefined>(undefined);

  const openRecipe = useCallback((r: Recipe, rating?: number) => {
    setRecipe(r);
    setInitialRating(rating);
    setOpen(true);
  }, []);

  const closeRecipe = useCallback(() => {
    setOpen(false);
    setInitialRating(undefined);
  }, []);

  return (
    <RecipeViewerContext.Provider value={{ openRecipe, closeRecipe }}>
      {children}
      <RecipeDetailModal recipe={recipe} open={open} initialRating={initialRating} onClose={closeRecipe} />
    </RecipeViewerContext.Provider>
  );
}
