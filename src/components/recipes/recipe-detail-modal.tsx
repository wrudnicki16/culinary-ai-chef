"use client"

import { useState } from "react";
import { 
  CheckCircle, 
  X, 
  Star, 
  Timer, 
  Share2, 
  Bookmark,
  Heart, 
  ShoppingCart,
  Utensils,
  UtensilsCrossed
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Rating } from "@/components/ui/rating";
import { Badge } from "@/components/ui/badge";
import { Recipe, Comment } from "@/lib/types";
import { cn, SAMPLE_RECIPE_IMAGES } from "@/lib/utils";
import { FormattedText } from "@/components/ui/formatted-text";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
}

export function RecipeDetailModal({ recipe, open, onClose }: RecipeDetailModalProps) {
  const [userRating, setUserRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const { toast } = useToast();

  if (!recipe) return null;

  const handleRatingChange = (newRating: number) => {
    setUserRating(newRating);
  };

  const handleAddToGroceryList = async () => {
    try {
      const response = await apiRequest('POST', `/api/groceries`, {
        recipeId: recipe.id,
        ingredients: recipe.ingredients.map(i => i.name)
      });
      
      if (response.ok) {
        toast({
          title: "Added to grocery list",
          description: "Ingredients have been added to your grocery list",
        });
      }
    } catch (error) {
      toast({
        title: "Error adding to grocery list",
        description: "Failed to add ingredients. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() && !userRating) return;
    
    setIsSubmittingComment(true);
    
    try {
      const response = await apiRequest('POST', `/api/recipes/${recipe.id}/comments`, {
        comment: comment.trim(),
        rating: userRating
      });
      
      if (response.ok) {
        toast({
          title: "Comment submitted",
          description: "Your review has been added successfully",
        });
        
        setComment("");
        setUserRating(0);
        setShowCommentForm(false);
        
        // Invalidate recipe queries to refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/recipes/${recipe.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      }
    } catch (error) {
      toast({
        title: "Error submitting comment",
        description: "Failed to submit your review. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 bg-white/90 rounded-full p-1 shadow-md hover:bg-gray-100"
          onClick={onClose}
        >
          <X className="h-5 w-5 text-gray-800" />
        </Button>
        <div className="relative">
          <div className="w-full h-80 md:h-96 overflow-hidden">
            <img
              src={recipe.imageUrl || SAMPLE_RECIPE_IMAGES[recipe.id % SAMPLE_RECIPE_IMAGES.length]}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6">
            <div className="flex items-center space-x-2 text-white">
              {recipe.dietaryTags.slice(0, 3).map(tag => (
                <Badge 
                  key={tag}
                  className="bg-primary text-white text-xs px-2 py-0.5 rounded-full"
                >
                  {tag}
                </Badge>
              ))}
              <span className="flex items-center text-sm">
                <Star className="h-4 w-4 text-yellow-400 mr-1" />
                {recipe.rating.toFixed(1)} ({recipe.ratingCount} ratings)
              </span>
              <span className="flex items-center text-sm">
                <Timer className="h-4 w-4 mr-1" />
                {recipe.cookingTime} min
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-300px)]">
          <h2 className="recipe-title text-2xl font-bold mb-3">
            <FormattedText text={recipe.title} />
          </h2>
          <p className="text-gray-600 mb-6">
            <FormattedText text={recipe.description} />
          </p>

          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[180px]">
              <h3 className="font-heading font-semibold mb-2 flex items-center">
                <UtensilsCrossed className="text-primary mr-1 h-5 w-5" />
                Ingredients
              </h3>
              <ul className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="text-gray-400 h-5 w-5 mr-2 mt-0.5" />
                    <span>
                      <FormattedText text={`${ingredient.quantity} ${ingredient.name}`} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 min-w-[180px]">
              <h3 className="font-heading font-semibold mb-2 flex items-center">
                <Utensils className="text-primary mr-1 h-5 w-5" />
                Instructions
              </h3>
              <ol className="space-y-3">
                {recipe.instructions.map((instruction, index) => (
                  <li key={index} className="flex">
                    <span className="bg-primary-100 text-primary-800 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-medium">
                      {index + 1}
                    </span>
                    <span>
                      <FormattedText text={instruction} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-heading font-semibold mb-2">Nutrition Information (Per Serving)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{recipe.nutritionInfo.calories}</span>
                <span className="text-sm text-gray-500">Calories</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{recipe.nutritionInfo.protein}g</span>
                <span className="text-sm text-gray-500">Protein</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{recipe.nutritionInfo.fat}g</span>
                <span className="text-sm text-gray-500">Fat</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <span className="block text-lg font-medium">{recipe.nutritionInfo.carbs}g</span>
                <span className="text-sm text-gray-500">Carbs</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div>
            <h3 className="font-heading font-semibold mb-4">Ratings & Reviews</h3>
            <div className="mb-6">
              <div className="flex items-center mb-3">
                <Rating value={recipe.rating} readOnly />
                <Button 
                  variant="link" 
                  className="ml-4 text-sm text-primary font-medium"
                  onClick={() => setShowCommentForm(!showCommentForm)}
                >
                  Write a Review
                </Button>
              </div>

              {showCommentForm && (
                <div className="bg-muted p-4 rounded-lg mb-4">
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Your Rating</label>
                    <Rating 
                      value={userRating} 
                      readOnly={false} 
                      onChange={handleRatingChange} 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Your Review</label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your experience with this recipe..."
                      className="w-full"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCommentForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmitComment}
                      disabled={isSubmittingComment}
                    >
                      {isSubmittingComment ? 'Submitting...' : 'Submit Review'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {recipe.comments && recipe.comments.map((comment: Comment) => (
                  <div key={comment.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center">
                        <img
                          src={comment.user.profileImageUrl || "https://github.com/shadcn.png"}
                          alt="User profile"
                          className="h-8 w-8 rounded-full object-cover mr-2"
                        />
                        <span className="font-medium">
                          {comment.user.firstName} {comment.user.lastName?.charAt(0)}.
                        </span>
                      </div>
                      <Rating value={comment.rating || 5} size="sm" />
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                ))}

                {(!recipe.comments || recipe.comments.length === 0) && (
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">No reviews yet. Be the first to review this recipe!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 py-4 px-6 flex items-center justify-between bg-gray-50">
          <div className="flex gap-3">
            <Button variant="ghost" size="icon" className="rounded-full p-2 hover:bg-gray-200">
              <Share2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full p-2 hover:bg-gray-200">
              <Bookmark className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full p-2 hover:bg-gray-200">
              <Heart className="h-5 w-5" />
            </Button>
          </div>
          <div>
            <Button 
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={handleAddToGroceryList}
            >
              <ShoppingCart className="h-5 w-5 mr-1" />
              Add to Grocery List
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
