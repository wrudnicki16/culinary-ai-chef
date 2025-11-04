"use client"

import { useState } from "react";
import { Heart, Timer, Users, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { cn, SAMPLE_RECIPE_IMAGES } from "@/lib/utils";
import { Recipe } from "@/lib/types";
import { FormattedText } from "@/components/ui/formatted-text";
import { useToast } from "@/hooks/use-toast";

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  className?: string;
}

export function RecipeCard({ recipe, onClick, className }: RecipeCardProps) {
  const [isFavorite, setIsFavorite] = useState(recipe.isFavorited || false);
  const { toast } = useToast();

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavoriteStatus = !isFavorite;

    try {
      // Optimistically update UI
      setIsFavorite(newFavoriteStatus);

      // Update in the database
      const response = await fetch(`/api/recipes/${recipe.id}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: newFavoriteStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update favorite status");
      }

      // Show success toast
      toast({
        title: newFavoriteStatus ? "Recipe saved!" : "Recipe removed",
        description: newFavoriteStatus
          ? "Added to your favorites"
          : "Removed from your favorites",
        variant: "default",
      });
    } catch (error) {
      // Revert UI state if API call fails
      setIsFavorite(isFavorite);

      // Show error toast
      toast({
        title: "Error updating favorite",
        description: "There was a problem updating your favorites. Please try again.",
        variant: "destructive",
      });

      console.error("Failed to update favorite status", error);
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden hover:shadow-md transition-shadow cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="relative h-48">
        <img
          src={recipe.imageUrl || SAMPLE_RECIPE_IMAGES[recipe.id % SAMPLE_RECIPE_IMAGES.length]}
          alt={recipe.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {recipe.isAIGenerated && (
            <Badge className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI Generated
            </Badge>
          )}
          {recipe.isVerified && (
            <Badge className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Verified
            </Badge>
          )}
        </div>
        <div className="absolute top-2 right-2">
          <Button
            variant="ghost"
            size="icon"
            className="bg-white rounded-full p-1 shadow hover:bg-gray-100"
            onClick={handleFavoriteClick}
          >
            <Heart
              className={cn(
                "h-5 w-5",
                isFavorite ? "fill-secondary-500 text-secondary-500" : "text-gray-400"
              )}
            />
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Timer className="h-4 w-4 text-secondary-400" />
              <span className="text-xs">{recipe.cookingTime} min</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-secondary-400" />
              <span className="text-xs">{recipe.servings} servings</span>
            </div>
          </div>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="recipe-title text-lg font-bold mb-1">
          <FormattedText text={recipe.title} />
        </h3>
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          <FormattedText text={recipe.description} />
        </p>
        <div className="flex justify-between items-center">
          <Rating value={recipe.rating} count={recipe.ratingCount} />
          <div className="flex flex-wrap gap-1">
            {recipe.dietaryTags.slice(0, 2).map((tag) => (
              <Badge 
                key={tag} 
                variant="outline" 
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  tag === "High Protein" && "bg-primary-100 text-primary-800",
                  tag === "Vegetarian" && "bg-blue-100 text-blue-800",
                  tag === "Vegan" && "bg-purple-100 text-purple-800",
                  tag === "Gluten Free" && "bg-green-100 text-green-800",
                  tag === "Heart Healthy" && "bg-red-100 text-red-800",
                  tag === "Low Carb" && "bg-yellow-100 text-yellow-800",
                )}
              >
                {tag}
              </Badge>
            ))}
            {recipe.dietaryTags.length > 2 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
                +{recipe.dietaryTags.length - 2}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
