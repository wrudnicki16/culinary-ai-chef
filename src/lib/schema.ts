import { pgTable, serial, text, varchar, timestamp, jsonb, integer, boolean, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { AdapterAccount } from "@auth/core/adapters";

// Auth.js required tables
export const users = pgTable("users", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // Custom fields for our app
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: text("profile_image_url"),
  roles: jsonb("roles").default("[]").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// Recipes table
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  ingredients: jsonb("ingredients").notNull().$type<{name: string, quantity: string}[]>(),
  instructions: jsonb("instructions").notNull().$type<string[]>(),
  cookingTime: integer("cooking_time").notNull(),
  servings: integer("servings").notNull(),
  dietaryTags: jsonb("dietary_tags").notNull().$type<string[]>(),
  nutritionInfo: jsonb("nutrition_info").notNull().$type<{calories: number, protein: number, fat: number, carbs: number}>(),
  rating: integer("rating").default(0).notNull(),
  ratingCount: integer("rating_count").default(0).notNull(),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isAIGenerated: boolean("is_ai_generated").default(false),
  isVerified: boolean("is_verified").default(false),
}, (table) => {
  return {
    userIdIdx: index("recipes_user_id_idx").on(table.userId),
    titleIdx: index("recipes_title_idx").on(table.title),
    dietaryTagsIdx: index("recipes_dietary_tags_idx").on(table.dietaryTags),
  };
});

// Favorites table
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  rating: integer("rating"),
  userId: text("user_id").notNull().references(() => users.id),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    userRecipeIdx: index("comments_user_recipe_idx").on(table.userId, table.recipeId),
    recipeIdx: index("comments_recipe_idx").on(table.recipeId),
  };
});

// Grocery items table
export const groceryItems = pgTable("grocery_items", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  quantity: text("quantity").notNull(),
  recipeId: integer("recipe_id").references(() => recipes.id),
  purchased: boolean("purchased").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    userIdx: index("grocery_items_user_idx").on(table.userId),
  };
});

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isUserMessage: boolean("is_user_message").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    userIdx: index("chat_messages_user_idx").on(table.userId),
  };
});

// Embedding vectors for RAG
export const recipeEmbeddings = pgTable("recipe_embeddings", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id),
  embedding: jsonb("embedding").notNull(), // Vector stored as JSON array
  content: text("content").notNull(), // Text content that was embedded
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    recipeIdx: index("recipe_embeddings_recipe_idx").on(table.recipeId),
  };
});

// Define schemas for CRUD operations
export const upsertUserSchema = createInsertSchema(users);
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertRecipeSchema = createInsertSchema(recipes).omit({ id: true });
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

export const insertGroceryItemSchema = createInsertSchema(groceryItems).omit({ id: true, createdAt: true });
export type InsertGroceryItem = z.infer<typeof insertGroceryItemSchema>;
export type GroceryItem = typeof groceryItems.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertRecipeEmbeddingSchema = createInsertSchema(recipeEmbeddings).omit({ id: true, createdAt: true });
export type InsertRecipeEmbedding = z.infer<typeof insertRecipeEmbeddingSchema>;
export type RecipeEmbedding = typeof recipeEmbeddings.$inferSelect;