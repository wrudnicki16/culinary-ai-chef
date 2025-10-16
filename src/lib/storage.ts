import {
  User, UpsertUser,
  Recipe, InsertRecipe,
  Comment, InsertComment,
  Favorite, InsertFavorite,
  GroceryItem, InsertGroceryItem,
  ChatMessage, InsertChatMessage,
  RecipeEmbedding, InsertRecipeEmbedding
} from "./schema";
import { db } from "./db";
import { eq, and, or, like, desc, asc, inArray, sql, not } from "drizzle-orm";
import {
  users, recipes, comments, favorites,
  groceryItems, chatMessages, recipeEmbeddings
} from "./schema";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;

  // Recipe operations
  getRecipe(id: number): Promise<Recipe | undefined>;
  getAllRecipes(options?: { filters?: string[], search?: string, sort?: string, page?: number, pageSize?: number }):
    Promise<{ recipes: Recipe[], total: number }>;
  getUserRecipes(userId: string): Promise<Recipe[]>;
  getSavedRecipes(userId: string): Promise<Recipe[]>;
  getGeneratedRecipes(userId: string): Promise<Recipe[]>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: number): Promise<boolean>;

  // Comment operations
  getRecipeComments(recipeId: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;

  // Favorite operations
  getFavorite(userId: string, recipeId: number): Promise<Favorite | undefined>;
  toggleFavorite(favorite: InsertFavorite): Promise<Favorite | undefined>;

  // Grocery operations
  getGroceryItems(userId: string): Promise<GroceryItem[]>;
  addGroceryItems(items: InsertGroceryItem[]): Promise<GroceryItem[]>;
  updateGroceryItem(id: number, purchased: boolean): Promise<GroceryItem | undefined>;
  deleteGroceryItem(id: number): Promise<boolean>;

  // Chat operations
  getUserChatMessages(userId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Recipe embedding operations
  createRecipeEmbedding(embedding: InsertRecipeEmbedding): Promise<RecipeEmbedding>;

  // Admin operations
  getAdminStats(): Promise<{
    totalUsers: number;
    totalRecipes: number;
    totalComments: number;
  }>;
}

export class Storage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values({
        ...user,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...user,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(sql`${users.roles} ? ${role}`);
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    const result = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
    return result[0];
  }

  async getAllRecipes(options: {
    filters?: string[],
    search?: string,
    sort?: string,
    page?: number,
    pageSize?: number
  } = {}): Promise<{ recipes: Recipe[], total: number }> {
    const { filters, search, sort = 'newest', page = 1, pageSize = 10 } = options;

    let query = db.select().from(recipes);
    let countQuery = db.select({ count: sql`count(*)` }).from(recipes);

    const conditions = [];

    // Apply filters
    if (filters && filters.length > 0) {
      filters.forEach(filter => {
        conditions.push(sql`${recipes.dietaryTags} ? ${filter}`);
      });
    }

    // Apply search
    if (search) {
      conditions.push(
        or(
          like(recipes.title, `%${search}%`),
          like(recipes.description, `%${search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      query = query.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }

    // Apply sorting
    switch (sort) {
      case 'oldest':
        query = query.orderBy(asc(recipes.createdAt));
        break;
      case 'rating':
        query = query.orderBy(desc(recipes.rating));
        break;
      case 'newest':
      default:
        query = query.orderBy(desc(recipes.createdAt));
        break;
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.limit(pageSize).offset(offset);

    const [recipesResult, countResult] = await Promise.all([
      query,
      countQuery
    ]);

    return {
      recipes: recipesResult,
      total: Number(countResult[0].count)
    };
  }

  async getUserRecipes(userId: string): Promise<Recipe[]> {
    return await db.select().from(recipes)
      .where(eq(recipes.userId, userId))
      .orderBy(desc(recipes.createdAt));
  }

  async getSavedRecipes(userId: string): Promise<Recipe[]> {
    return await db
      .select({
        id: recipes.id,
        title: recipes.title,
        description: recipes.description,
        imageUrl: recipes.imageUrl,
        ingredients: recipes.ingredients,
        instructions: recipes.instructions,
        cookingTime: recipes.cookingTime,
        servings: recipes.servings,
        dietaryTags: recipes.dietaryTags,
        nutritionInfo: recipes.nutritionInfo,
        userId: recipes.userId,
        isAIGenerated: recipes.isAIGenerated,
        isVerified: recipes.isVerified,
        rating: recipes.rating,
        ratingCount: recipes.ratingCount,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt
      })
      .from(recipes)
      .innerJoin(favorites, eq(recipes.id, favorites.recipeId))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
  }

  async getGeneratedRecipes(userId: string): Promise<Recipe[]> {
    return await db.select().from(recipes)
      .where(and(
        eq(recipes.userId, userId),
        eq(recipes.isAIGenerated, true)
      ))
      .orderBy(desc(recipes.createdAt));
  }

  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const result = await db.insert(recipes).values({
      ...recipe,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return result[0];
  }

  async updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined> {
    const result = await db
      .update(recipes)
      .set({ ...recipe, updatedAt: new Date() })
      .where(eq(recipes.id, id))
      .returning();

    return result[0];
  }

  async deleteRecipe(id: number): Promise<boolean> {
    const result = await db.delete(recipes).where(eq(recipes.id, id)).returning();
    return result.length > 0;
  }

  async getRecipeComments(recipeId: number): Promise<Comment[]> {
    return await db.select().from(comments)
      .where(eq(comments.recipeId, recipeId))
      .orderBy(desc(comments.createdAt));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values({
      ...comment,
      createdAt: new Date(),
    }).returning();

    return result[0];
  }

  async getFavorite(userId: string, recipeId: number): Promise<Favorite | undefined> {
    const result = await db.select().from(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.recipeId, recipeId)
      ))
      .limit(1);

    return result[0];
  }

  async toggleFavorite(favorite: InsertFavorite): Promise<Favorite | undefined> {
    const existing = await this.getFavorite(favorite.userId, favorite.recipeId);

    if (existing) {
      // Remove favorite
      await db.delete(favorites).where(and(
        eq(favorites.userId, favorite.userId),
        eq(favorites.recipeId, favorite.recipeId)
      ));
      return undefined;
    } else {
      // Add favorite
      const result = await db.insert(favorites).values({
        ...favorite,
        createdAt: new Date(),
      }).returning();
      return result[0];
    }
  }

  async getGroceryItems(userId: string): Promise<GroceryItem[]> {
    return await db.select().from(groceryItems)
      .where(eq(groceryItems.userId, userId))
      .orderBy(desc(groceryItems.createdAt));
  }

  async addGroceryItems(items: InsertGroceryItem[]): Promise<GroceryItem[]> {
    const result = await db.insert(groceryItems).values(
      items.map(item => ({
        ...item,
        createdAt: new Date(),
      }))
    ).returning();

    return result;
  }

  async updateGroceryItem(id: number, purchased: boolean): Promise<GroceryItem | undefined> {
    const result = await db
      .update(groceryItems)
      .set({ purchased })
      .where(eq(groceryItems.id, id))
      .returning();

    return result[0];
  }

  async deleteGroceryItem(id: number): Promise<boolean> {
    const result = await db.delete(groceryItems).where(eq(groceryItems.id, id)).returning();
    return result.length > 0;
  }

  async getUserChatMessages(userId: string): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(10);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values({
      ...message,
      createdAt: new Date(),
    }).returning();

    return result[0];
  }

  async createRecipeEmbedding(embedding: InsertRecipeEmbedding): Promise<RecipeEmbedding> {
    const result = await db.insert(recipeEmbeddings).values({
      ...embedding,
      createdAt: new Date(),
    }).returning();

    return result[0];
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalRecipes: number;
    totalComments: number;
  }> {
    const [userCount, recipeCount, commentCount] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(users),
      db.select({ count: sql`count(*)` }).from(recipes),
      db.select({ count: sql`count(*)` }).from(comments),
    ]);

    return {
      totalUsers: Number(userCount[0].count),
      totalRecipes: Number(recipeCount[0].count),
      totalComments: Number(commentCount[0].count),
    };
  }
}

// Export singleton instance
export const storage = new Storage();