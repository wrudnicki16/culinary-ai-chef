import { NextRequest } from "next/server";
import { requireAuth, validateRequestBody } from "@/lib/api-auth";
import { storage } from "@/lib/storage";
import { generateRecipe, generateEmbedding, researchRelatedRecipes } from "@/lib/openai";
import { recipeGenerationSchema } from "@/lib/types";
import { InsertRecipe } from "@/lib/schema";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const rawBody = await request.json();
    const bodyResult = validateRequestBody(rawBody, recipeGenerationSchema);

    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    const { prompt, dietaryFilters } = bodyResult;
    const userId = authResult.id;

    console.log(`Route received filters: ${JSON.stringify(dietaryFilters)}`);

    // Research related recipes using RAG if we have embeddings
    let researchContext = "";
    try {
      // In a real implementation, you would retrieve similar embeddings from vector DB
      // Here we'll just pass an empty array
      researchContext = await researchRelatedRecipes(prompt, []);
    } catch (error) {
      console.error("Error researching related recipes:", error);
      // Continue without research context
    }

    // Generate the recipe
    const recipeData = await generateRecipe(
      `${prompt}\n\n${researchContext}`,
      dietaryFilters
    );

    // Insert into database
    const newRecipe: InsertRecipe = {
      title: recipeData.title,
      description: recipeData.description,
      imageUrl: recipeData.imageUrl,
      ingredients: recipeData.ingredients,
      instructions: recipeData.instructions,
      cookingTime: recipeData.cookingTime,
      servings: recipeData.servings,
      dietaryTags: recipeData.dietaryTags,
      nutritionInfo: recipeData.nutritionInfo,
      userId: userId,
      isAIGenerated: true,
      isVerified: true, // Auto-verify AI-generated recipes
      rating: 0,
      ratingCount: 0
    };

    const recipe = await storage.createRecipe(newRecipe);

    // Generate embedding for the recipe for future RAG usage
    try {
      const recipeText = `Title: ${recipe.title}
Description: ${recipe.description}
Ingredients: ${JSON.stringify(recipe.ingredients)}
Instructions: ${JSON.stringify(recipe.instructions)}
Tags: ${recipe.dietaryTags.join(", ")}`;

      const embedding = await generateEmbedding(recipeText);
      await storage.createRecipeEmbedding({
        recipeId: recipe.id,
        embedding: embedding,
        content: recipeText
      });
    } catch (error) {
      console.error("Error generating embedding:", error);
      // Continue without storing embedding
    }

    return Response.json(recipe);
  } catch (error) {
    console.error("Error generating recipe:", error);
    return Response.json({ error: "Failed to generate recipe" }, { status: 500 });
  }
}