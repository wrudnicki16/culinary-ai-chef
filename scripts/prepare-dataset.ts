import { createReadStream, readFileSync, writeFileSync, createWriteStream } from "fs";
import { createInterface } from "readline";
import { join } from "path";

interface TogetherMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface TogetherEntry {
  messages: TogetherMessage[];
}

const SYSTEM_PROMPT =
  "You are a professional chef and nutritionist specializing in recipes, dietary requirements, and food safety. Respond with accurate, detailed information about cooking, ingredients, nutrition, and dietary restrictions.";

const RECIPE_SAMPLE_SIZE = 160_000;
const TRAIN_SPLIT = 0.9;

const RECIPE_PROMPTS = [
  (title: string) => `Create a recipe for ${title}`,
  (title: string) => `Give me a recipe for ${title}`,
  (title: string) => `How do I make ${title}?`,
  (title: string) => `I want to cook ${title}. What's the recipe?`,
  (title: string) => `Share a recipe for ${title}`,
];

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseIngredient(raw: string): { name: string; quantity: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([\d\s\/\.\-]+(?:cup|cups|tbsp|tsp|oz|lb|lbs|pound|pounds|tablespoon|tablespoons|teaspoon|teaspoons|quart|gallon|pint|can|cans|pkg|package|jar|bunch|head|clove|cloves|slice|slices|piece|pieces|stick|sticks|c\.|tsp\.|tbsp\.|oz\.|lb\.|pkg\.)?s?\.?\s*)/i);

  if (match && match[1].trim()) {
    return {
      quantity: match[1].trim(),
      name: trimmed.slice(match[1].length).trim() || trimmed,
    };
  }

  const numMatch = trimmed.match(/^([\d\s\/\.\-]+)\s+(.*)/);
  if (numMatch) {
    return { quantity: numMatch[1].trim(), name: numMatch[2].trim() };
  }

  return { quantity: "to taste", name: trimmed };
}

function convertRecipeEntry(
  title: string,
  ingredientsRaw: string[],
  directionsRaw: string[],
  index: number
): TogetherEntry | null {
  if (!title || ingredientsRaw.length === 0 || directionsRaw.length === 0) return null;

  const ingredients = ingredientsRaw.map(parseIngredient);
  const instructions = directionsRaw.map((d) => d.trim()).filter(Boolean);
  if (instructions.length === 0) return null;

  const promptFn = RECIPE_PROMPTS[index % RECIPE_PROMPTS.length];

  const recipeJson = {
    title: title.trim(),
    description: `A delicious ${title.trim().toLowerCase()} recipe.`,
    ingredients,
    instructions,
    cookingTime: Math.max(15, instructions.length * 8),
    servings: 4,
    dietaryTags: [] as string[],
    nutritionInfo: { calories: 0, protein: 0, fat: 0, carbs: 0 },
  };

  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: promptFn(title.trim()) },
      { role: "assistant", content: JSON.stringify(recipeJson) },
    ],
  };
}

interface NutritionEntry {
  recipe_name: string;
  ingredient_lines: string;
  ingredients: string;
  servings: string;
  calories: string;
  total_nutrients: string;
  diet_labels: string;
  health_labels: string;
}

function convertNutritionEntry(entry: NutritionEntry): TogetherEntry | null {
  try {
    const ingredientLines: string[] = JSON.parse(entry.ingredient_lines);
    if (ingredientLines.length === 0) return null;

    const servings = parseFloat(entry.servings) || 4;
    const totalNutrients = JSON.parse(entry.total_nutrients);

    const perServing = {
      calories: Math.round((parseFloat(entry.calories) || 0) / servings),
      protein: Math.round(((totalNutrients?.PROCNT?.quantity || 0) / servings) * 10) / 10,
      fat: Math.round(((totalNutrients?.FAT?.quantity || 0) / servings) * 10) / 10,
      carbs: Math.round(((totalNutrients?.CHOCDF?.quantity || 0) / servings) * 10) / 10,
    };

    if (perServing.calories === 0) return null;

    const ingredients = ingredientLines.map(parseIngredient);

    return {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze the nutrition for these ingredients with high accuracy. The recipe makes ${servings} servings:\n${JSON.stringify(ingredients)}`,
        },
        { role: "assistant", content: JSON.stringify(perServing) },
      ],
    };
  } catch {
    return null;
  }
}

async function processRecipeNLG(): Promise<TogetherEntry[]> {
  const csvPath = join(process.cwd(), "data", "recipenlg", "RecipeNLG_dataset.csv");
  console.log(`Reading RecipeNLG from ${csvPath}...`);

  const entries: TogetherEntry[] = [];
  let lineNum = 0;
  let skipped = 0;

  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // skip header

    const fields = parseCSVLine(line);
    if (fields.length < 7) {
      skipped++;
      continue;
    }

    const [, title, ingredientsStr, directionsStr] = fields;

    try {
      const ingredients: string[] = JSON.parse(ingredientsStr);
      const directions: string[] = JSON.parse(directionsStr);
      const entry = convertRecipeEntry(title, ingredients, directions, lineNum);
      if (entry) entries.push(entry);
    } catch {
      skipped++;
    }
  }

  console.log(`RecipeNLG: ${entries.length} valid entries, ${skipped} skipped`);
  return entries;
}

function processNutrition(): TogetherEntry[] {
  const jsonPath = join(process.cwd(), "data", "recipes-with-nutrition.json");
  console.log(`Reading nutrition data from ${jsonPath}...`);

  const raw = readFileSync(jsonPath, "utf-8");
  const entries: TogetherEntry[] = [];
  let skipped = 0;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry: NutritionEntry = JSON.parse(line);
      const converted = convertNutritionEntry(entry);
      if (converted) {
        entries.push(converted);
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  console.log(`Nutrition: ${entries.length} valid entries, ${skipped} skipped`);
  return entries;
}

function deterministicShuffle(arr: TogetherEntry[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor((Math.sin(i) * 10000 + 10000) % (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

async function main() {
  console.log("=== Dataset Preparation for Together AI Fine-Tuning ===\n");

  const recipeEntries = await processRecipeNLG();
  const nutritionEntries = processNutrition();

  // Sample recipes down to target size
  deterministicShuffle(recipeEntries);
  const sampledRecipes = recipeEntries.slice(0, RECIPE_SAMPLE_SIZE);
  console.log(`\nSampled ${sampledRecipes.length} recipes from ${recipeEntries.length}`);

  // Combine recipe + nutrition entries
  const combined = [...sampledRecipes, ...nutritionEntries];
  deterministicShuffle(combined);
  console.log(`Combined dataset: ${combined.length} entries`);

  // Split 90/10
  const splitIndex = Math.floor(combined.length * TRAIN_SPLIT);
  const training = combined.slice(0, splitIndex);
  const validation = combined.slice(splitIndex);

  const outputDir = join(process.cwd(), "data");
  const trainPath = join(outputDir, "training.jsonl");
  const valPath = join(outputDir, "validation.jsonl");

  writeFileSync(trainPath, training.map((e) => JSON.stringify(e)).join("\n"));
  writeFileSync(valPath, validation.map((e) => JSON.stringify(e)).join("\n"));

  console.log(`\nTraining set: ${training.length} entries -> ${trainPath}`);
  console.log(`Validation set: ${validation.length} entries -> ${valPath}`);

  // Stats
  const recipeCount = training.filter(
    (e) => !e.messages[1].content.startsWith("Analyze the nutrition")
  ).length;
  const nutritionCount = training.length - recipeCount;
  console.log(`\nTraining breakdown: ${recipeCount} recipes, ${nutritionCount} nutrition`);
}

main().catch(console.error);
