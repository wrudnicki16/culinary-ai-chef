import { z } from "zod";

export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Ingredient {
  name: string;
  quantity: string;
}

export interface NutritionInfo {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Comment {
  id: number;
  content: string;
  rating: number;
  createdAt: Date;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}

export interface Recipe {
  id: number;
  title: string;
  description: string;
  imageUrl: string | null;
  ingredients: Ingredient[];
  instructions: string[];
  cookingTime: number;
  servings: number;
  dietaryTags: string[];
  nutritionInfo: NutritionInfo;
  rating: number;
  ratingCount: number;
  isFavorited?: boolean;
  userId: string;
  comments?: Comment[];
  createdAt: Date;
  updatedAt: Date;
  isAIGenerated: boolean;
  isVerified: boolean;
}

export interface GroceryItem {
  id: number;
  userId: string;
  name: string;
  quantity: string;
  recipeId?: number;
  purchased: boolean;
  createdAt: Date;
}

export interface ChatMessage {
  id: number;
  userId: string;
  content: string;
  isUserMessage: boolean;
  createdAt: Date;
}

export const recipeGenerationSchema = z.object({
  prompt: z.string().min(1).max(1000),
  dietaryFilters: z.array(z.string()).optional(),
});

export const commentSchema = z.object({
  comment: z.string().min(1).max(500),
  rating: z.number().min(1).max(5).optional(),
});

export const favoriteSchema = z.object({
  isFavorite: z.boolean(),
});

export const grocerySchema = z.object({
  recipeId: z.number().optional(),
  ingredients: z.array(z.string()),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(500),
});

export const filterSchema = z.object({
  filters: z.array(z.string()).optional(),
  search: z.string().optional(),
  sort: z.enum(['popular', 'newest', 'quickest']).optional(),
});
