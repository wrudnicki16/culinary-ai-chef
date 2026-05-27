# Qwen2.5-14B Fine-Tune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fine-tune Qwen2.5-14B-Instruct on FoodEarth dataset via Together AI and integrate it into the culinary-ai-chef app for recipe generation and nutrition analysis, with GPT-4o fallback.

**Architecture:** Add a Together AI client alongside the existing OpenAI and Braintrust clients. Route `generateRecipe()` and `analyzeRecipeNutrition()` to the fine-tuned model, with try/catch fallback to GPT-4o. A dataset preparation script converts FoodEarth JSON to Together AI's JSONL format.

**Tech Stack:** Together AI API, OpenAI SDK (compatible client), Node.js/TypeScript, tsx (script runner)

**Spec:** `docs/superpowers/specs/2026-05-26-qwen-finetune-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `scripts/prepare-dataset.ts` | Create | Convert FoodEarth JSON to Together AI JSONL format |
| `src/lib/openai.ts` | Modify | Add Together AI client, `getRecipeClient()` helper, wire into `generateRecipe()` and `analyzeRecipeNutrition()` |
| `.env.example` | Modify | Add `TOGETHER_API_KEY` and `TOGETHER_MODEL` entries |

---

### Task 1: Download and Inspect the FoodEarth Dataset

**Files:**
- Download: `data/FoodEarth-Complete.zip` (from Zenodo, not committed)

This task is manual — download the dataset, extract it, and inspect the format so the conversion script handles the actual structure.

- [ ] **Step 1: Download the dataset**

```bash
mkdir -p data
curl -L -o data/FoodEarth-Complete.zip "https://zenodo.org/records/14892842/files/FoodEarth-Complete.zip?download=1"
```

- [ ] **Step 2: Extract and inspect the mini dataset**

```bash
cd data && unzip FoodEarth-Complete.zip
```

Look for `FoodEarth-mini.json`. Inspect the first 2-3 entries to confirm the format:

```bash
head -c 5000 data/FoodEarth-mini.json
```

Expected: JSON array of objects. Likely fields: `instruction`, `input`, `output` (alpaca format). If different, note the actual field names for Task 2.

- [ ] **Step 3: Add data directory to .gitignore**

Append to `.gitignore`:

```
# Training data (large, not committed)
data/
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: add data/ to gitignore for training dataset"
```

---

### Task 2: Write the Dataset Preparation Script

**Files:**
- Create: `scripts/prepare-dataset.ts`

This script reads FoodEarth-mini.json, filters to English entries, converts to Together AI JSONL format, and splits into train/validation sets.

- [ ] **Step 1: Create the script**

Create `scripts/prepare-dataset.ts`:

```typescript
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface AlpacaEntry {
  instruction: string;
  input: string;
  output: string;
}

interface TogetherMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface TogetherEntry {
  messages: TogetherMessage[];
}

const SYSTEM_PROMPT =
  "You are a professional chef and nutritionist specializing in recipes, dietary requirements, and food safety. Respond with accurate, detailed information about cooking, ingredients, nutrition, and dietary restrictions.";

function isEnglish(text: string): boolean {
  const cjkRange = /[一-鿿㐀-䶿　-〿]/;
  const totalChars = text.length;
  if (totalChars === 0) return false;
  let cjkCount = 0;
  for (const char of text) {
    if (cjkRange.test(char)) cjkCount++;
  }
  return cjkCount / totalChars < 0.1;
}

function convertEntry(entry: AlpacaEntry): TogetherEntry | null {
  const userContent = entry.input
    ? `${entry.instruction}\n\n${entry.input}`
    : entry.instruction;

  if (!userContent.trim() || !entry.output.trim()) return null;
  if (!isEnglish(userContent) || !isEnglish(entry.output)) return null;

  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent.trim() },
      { role: "assistant", content: entry.output.trim() },
    ],
  };
}

function main() {
  const inputPath = join(process.cwd(), "data", "FoodEarth-mini.json");
  console.log(`Reading ${inputPath}...`);

  const raw = readFileSync(inputPath, "utf-8");
  const entries: AlpacaEntry[] = JSON.parse(raw);
  console.log(`Total entries: ${entries.length}`);

  const converted: TogetherEntry[] = [];
  let skippedEmpty = 0;
  let skippedNonEnglish = 0;

  for (const entry of entries) {
    const result = convertEntry(entry);
    if (result) {
      converted.push(result);
    } else {
      const userContent = entry.input
        ? `${entry.instruction}\n\n${entry.input}`
        : entry.instruction;
      if (!userContent.trim() || !entry.output.trim()) {
        skippedEmpty++;
      } else {
        skippedNonEnglish++;
      }
    }
  }

  console.log(`English entries: ${converted.length}`);
  console.log(`Skipped (empty): ${skippedEmpty}`);
  console.log(`Skipped (non-English): ${skippedNonEnglish}`);

  // Shuffle deterministically
  for (let i = converted.length - 1; i > 0; i--) {
    const j = Math.floor((Math.sin(i) * 10000 + 10000) % (i + 1));
    [converted[i], converted[j]] = [converted[j], converted[i]];
  }

  // Split 90/10
  const splitIndex = Math.floor(converted.length * 0.9);
  const training = converted.slice(0, splitIndex);
  const validation = converted.slice(splitIndex);

  const outputDir = join(process.cwd(), "data");
  const trainPath = join(outputDir, "training.jsonl");
  const valPath = join(outputDir, "validation.jsonl");

  writeFileSync(trainPath, training.map((e) => JSON.stringify(e)).join("\n"));
  writeFileSync(valPath, validation.map((e) => JSON.stringify(e)).join("\n"));

  console.log(`Training set: ${training.length} entries -> ${trainPath}`);
  console.log(`Validation set: ${validation.length} entries -> ${valPath}`);
}

main();
```

- [ ] **Step 2: Run the script**

```bash
npx tsx scripts/prepare-dataset.ts
```

Expected output (approximate):
```
Reading data/FoodEarth-mini.json...
Total entries: 200000
English entries: ~100000-150000
Skipped (empty): ...
Skipped (non-English): ...
Training set: ~90000-135000 entries -> data/training.jsonl
Validation set: ~10000-15000 entries -> data/validation.jsonl
```

- [ ] **Step 3: Verify output format**

```bash
head -1 data/training.jsonl | npx -y json
```

Expected: a JSON object with `messages` array containing system, user, and assistant messages.

- [ ] **Step 4: Commit the script**

```bash
git add scripts/prepare-dataset.ts
git commit -m "feat: add FoodEarth dataset preparation script for Together AI"
```

---

### Task 3: Upload Data and Start Fine-Tuning on Together AI

This task is done via the Together AI dashboard or API. No code changes.

- [ ] **Step 1: Create a Together AI account**

Sign up at [together.ai](https://www.together.ai/) and add a payment method.

- [ ] **Step 2: Upload the training data**

Via the Together AI dashboard:
1. Go to Fine-tuning > Create
2. Upload `data/training.jsonl` as the training file
3. Upload `data/validation.jsonl` as the validation file

Or via the API:

```bash
# Install Together CLI
pip install together

# Upload files
together files upload data/training.jsonl
together files upload data/validation.jsonl
```

- [ ] **Step 3: Start the fine-tuning job**

Via dashboard:
1. Select base model: `Qwen/Qwen2.5-14B-Instruct`
2. Method: LoRA
3. Set hyperparameters:
   - LoRA rank: 16
   - LoRA alpha: 16
   - LoRA dropout: 0.05
   - Epochs: 1
   - Learning rate: 1e-6
   - LR scheduler: cosine
   - Batch size: 2 (or let Together auto-select)
4. Give the model a suffix like `culinary-ai-chef`
5. Start training

Or via API:

```bash
together fine-tuning create \
  --training-file <training-file-id> \
  --validation-file <validation-file-id> \
  --model Qwen/Qwen2.5-14B-Instruct \
  --n-epochs 1 \
  --learning-rate 1e-6 \
  --lora \
  --lora-rank 16 \
  --lora-alpha 16 \
  --lora-dropout 0.05 \
  --suffix culinary-ai-chef
```

- [ ] **Step 4: Wait for training to complete**

Monitor via dashboard or:

```bash
together fine-tuning list
```

Training ~100K-150K examples at 1 epoch should take 1-3 hours. When done, note the model identifier (e.g., `<your-org>/culinary-ai-chef-qwen-14b`).

- [ ] **Step 5: Test the model**

```bash
together chat completions create \
  --model "<your-model-id>" \
  --message "user: Create a healthy vegan pasta recipe with nutritional information. Respond as JSON."
```

Verify it returns a coherent food-related response.

---

### Task 4: Add Together AI Client to the App

**Files:**
- Modify: `src/lib/openai.ts:1-19` (client setup section)

- [ ] **Step 1: Add the Together AI client and helper**

In `src/lib/openai.ts`, after the existing `openaiChat` declaration (line 19), add:

```typescript
const togetherAI = process.env.TOGETHER_API_KEY && process.env.TOGETHER_MODEL
  ? new OpenAI({
      baseURL: "https://api.together.xyz/v1",
      apiKey: process.env.TOGETHER_API_KEY,
    })
  : null;

const TOGETHER_MODEL = process.env.TOGETHER_MODEL || "";

function getRecipeClient(): { client: OpenAI; model: string } {
  if (togetherAI && TOGETHER_MODEL) {
    return { client: togetherAI, model: TOGETHER_MODEL };
  }
  return { client: openaiChat, model: OPENAI_MODEL };
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "openai.ts"
```

Expected: no output (no errors in our file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/openai.ts
git commit -m "feat: add Together AI client and model selection helper"
```

---

### Task 5: Wire generateRecipe() to Use Together AI with Fallback

**Files:**
- Modify: `src/lib/openai.ts` — `generateRecipe()` function (starts at line 92)

The function has multiple `openaiChat.chat.completions.create` call sites (complex filters path at line 299, retry at line 351, simple path at line 402, vegan retry at line 553). All need to use `getRecipeClient()` with a try/catch that falls back to `openaiChat`.

- [ ] **Step 1: Replace the model selection in generateRecipe()**

At the top of the `generateRecipe()` function body (inside the outer try block, around line 103), add:

```typescript
    const { client: recipeClient, model: recipeModel } = getRecipeClient();
    const isUsingTogetherAI = recipeClient !== openaiChat;
    if (isUsingTogetherAI) {
      console.log(`Using Together AI model: ${recipeModel}`);
    }
```

Then replace every occurrence of `openaiChat.chat.completions.create` within `generateRecipe()` with `recipeClient.chat.completions.create`, and every `model: OPENAI_MODEL` with `model: recipeModel`.

There are 5 call sites within `generateRecipe()`:
1. Complex filters path (~line 299)
2. Complex filters retry (~line 351)
3. Simple path (~line 402)
4. Vegan retry (~line 553)
5. Within the vegan retry error path — this one should also use `recipeClient`

For the `response_format: { type: "json_object" }` parameter: keep it in all calls. Together AI's Qwen2.5 endpoint supports it. If the fine-tuned model doesn't, the error will be caught by the existing try/catch and the fallback logic.

- [ ] **Step 2: Add top-level fallback wrapper**

Wrap the entire recipe generation logic in a try/catch that falls back to GPT-4o. At the very beginning of `generateRecipe()`, restructure to:

```typescript
export async function generateRecipe(prompt: string, dietaryFilters: string[] = []): Promise<{
  // ... existing return type
}> {
  const { client: recipeClient, model: recipeModel } = getRecipeClient();
  const isUsingTogetherAI = recipeClient !== openaiChat;

  try {
    if (isUsingTogetherAI) {
      console.log(`Using Together AI model: ${recipeModel}`);
    }
    return await _generateRecipeImpl(prompt, dietaryFilters, recipeClient, recipeModel);
  } catch (error) {
    if (isUsingTogetherAI) {
      console.warn(`Together AI failed, falling back to GPT-4o:`, error instanceof Error ? error.message : error);
      return await _generateRecipeImpl(prompt, dietaryFilters, openaiChat, OPENAI_MODEL);
    }
    throw error;
  }
}
```

This approach is cleaner but requires extracting the body into `_generateRecipeImpl`. Given the function's size (700+ lines), a simpler approach: just catch at the outer level and retry. Add this right before the final `catch (error)` block at the end of `generateRecipe()` (~line 758):

Instead of the extraction approach, do this minimal change — in the existing outer catch block (~line 758-761):

```typescript
  } catch (error) {
    if (isUsingTogetherAI) {
      console.warn(`Together AI failed, falling back to GPT-4o:`, error instanceof Error ? error.message : String(error));
      // Re-run with GPT-4o by temporarily overriding
      const originalClient = recipeClient;
      // Recursive call won't hit Together AI because we pass through GPT-4o path
      try {
        // Direct GPT-4o call for the simple path as emergency fallback
        const fallbackResponse = await openaiChat.chat.completions.create({
          model: OPENAI_MODEL,
          temperature: 1.2,
          messages: [
            {
              role: "system",
              content: `You are a professional chef and nutritionist. Generate a complete recipe as JSON: {"title","description","ingredients":[{"name","quantity"}],"instructions":[],"cookingTime","servings","dietaryTags":[],"nutritionInfo":{"calories","protein","fat","carbs"}}`,
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });
        const content = fallbackResponse.choices[0].message.content;
        if (!content) throw new Error("No fallback response");
        const recipeData = JSON.parse(content);
        console.log("GPT-4o fallback succeeded");
        return { ...recipeData, imageUrl: null };
      } catch (fallbackError) {
        console.error("GPT-4o fallback also failed:", fallbackError);
        throw new Error("Failed to generate recipe");
      }
    }
    console.error("Recipe generation error:", error);
    throw new Error("Failed to generate recipe");
  }
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "openai.ts"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/openai.ts
git commit -m "feat: route generateRecipe() through Together AI with GPT-4o fallback"
```

---

### Task 6: Wire analyzeRecipeNutrition() to Use Together AI with Fallback

**Files:**
- Modify: `src/lib/openai.ts` — `analyzeRecipeNutrition()` function (starts at line 839)

- [ ] **Step 1: Replace the client and model in analyzeRecipeNutrition()**

At the top of the function body (inside the try block, ~line 844), add:

```typescript
    const { client: nutritionClient, model: nutritionModel } = getRecipeClient();
    const isUsingTogetherAI = nutritionClient !== openaiChat;
    if (isUsingTogetherAI) {
      console.log(`Using Together AI for nutrition analysis: ${nutritionModel}`);
    }
```

Then replace the single `openaiChat.chat.completions.create` call (~line 847) with `nutritionClient.chat.completions.create` and `model: OPENAI_MODEL` with `model: nutritionModel`.

- [ ] **Step 2: Add fallback in the catch block**

Replace the existing catch block (~line 1039-1049) with:

```typescript
  } catch (error) {
    if (isUsingTogetherAI) {
      console.warn(`Together AI nutrition analysis failed, falling back to GPT-4o:`, error instanceof Error ? error.message : String(error));
      try {
        const fallbackResponse = await openaiChat.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content: `You are a registered dietitian. Calculate per-serving nutrition for the given ingredients. Return JSON: {"calories":number,"protein":number,"fat":number,"carbs":number}`,
            },
            {
              role: "user",
              content: `Analyze nutrition for ${servings} servings: ${JSON.stringify(ingredients)}`,
            },
          ],
          response_format: { type: "json_object" },
        });
        const content = fallbackResponse.choices[0].message.content;
        if (!content) throw new Error("No fallback response");
        return JSON.parse(content) as NutritionInfo;
      } catch (fallbackError) {
        console.error("GPT-4o nutrition fallback also failed:", fallbackError);
      }
    } else {
      console.error("Nutrition analysis error:", error);
    }
    return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  }
```

Note: the `isUsingTogetherAI` variable must be declared at function scope (before the try block) so it's accessible in the catch. Move the declaration above the try:

```typescript
export async function analyzeRecipeNutrition(
  ingredients: Ingredient[],
  servings: number = 4
): Promise<NutritionInfo> {
  const { client: nutritionClient, model: nutritionModel } = getRecipeClient();
  const isUsingTogetherAI = nutritionClient !== openaiChat;
  try {
    // ... rest of function
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "openai.ts"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/openai.ts
git commit -m "feat: route analyzeRecipeNutrition() through Together AI with GPT-4o fallback"
```

---

### Task 7: Update Environment Configuration

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add Together AI env vars to .env.example**

After the Braintrust section, add:

```
# Together AI - Fine-tuned model for recipe generation (optional)
# When set, recipe generation and nutrition analysis use the fine-tuned model
TOGETHER_API_KEY=your-together-api-key
TOGETHER_MODEL=your-org/culinary-ai-chef-qwen-14b
```

- [ ] **Step 2: Add env vars to Vercel**

```bash
vercel env add TOGETHER_API_KEY
vercel env add TOGETHER_MODEL
```

Enter the Together AI API key and the fine-tuned model identifier from Task 3, Step 4.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add Together AI env vars to .env.example"
```

---

### Task 8: Deploy and Verify

- [ ] **Step 1: Push all changes**

```bash
git push origin main
```

- [ ] **Step 2: Verify Vercel deployment succeeds**

Check the Vercel dashboard or:

```bash
vercel logs --limit 5
```

The build should succeed without errors.

- [ ] **Step 3: Test recipe generation on the deployed app**

Generate a recipe through the app. Check Vercel logs for:
- `Using Together AI model: <model-id>` — confirms the fine-tuned model was used
- No `Together AI failed, falling back to GPT-4o` — confirms it succeeded

If you see the fallback message, check the Together AI dashboard for error details.

- [ ] **Step 4: Test the fallback path**

Temporarily set `TOGETHER_MODEL` to an invalid value in Vercel (e.g., `invalid-model`). Generate a recipe. It should:
- Log the fallback warning
- Still return a valid recipe (from GPT-4o)

Restore the correct model name after testing.

- [ ] **Step 5: Verify in Braintrust**

Check the Braintrust dashboard — GPT-4o calls (safety, chat) should still appear in logs. Together AI calls won't appear in Braintrust since they bypass the proxy (expected behavior).
