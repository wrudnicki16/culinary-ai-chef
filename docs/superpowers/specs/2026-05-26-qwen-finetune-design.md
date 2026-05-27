# Fine-Tune Qwen2.5-14B on FoodEarth via Together AI

## Goal

Replace GPT-4o for recipe generation and nutrition analysis with a food-domain fine-tuned model, reducing cost and improving food-specific quality. Safety validation and chat support remain on GPT-4o.

## Architecture

Three OpenAI-compatible clients in `src/lib/openai.ts`:

| Client | Endpoint | API Key Env Var | Used For |
|---|---|---|---|
| `openai` | `api.openai.com` | `OPENAI_API_KEY` | Embeddings (`text-embedding-3-small`), image generation (`gpt-image-1`) |
| `openaiChat` | `api.braintrust.dev/v1/proxy` | `BRAINTRUST_API_KEY` | Safety validation, chat support (GPT-4o). Also serves as fallback for recipe/nutrition. |
| `togetherAI` | `api.together.xyz/v1` | `TOGETHER_API_KEY` | Recipe generation, nutrition analysis (fine-tuned Qwen2.5-14B) |

The `togetherAI` client is gated on both `TOGETHER_API_KEY` and `TOGETHER_MODEL` environment variables. When either is absent, recipe generation and nutrition analysis fall back to `openaiChat` (GPT-4o via Braintrust proxy).

## Dataset Preparation

**Source:** FoodEarth-mini.json (200K instances) from [Zenodo](https://zenodo.org/records/14892842) (CC0 license, 589MB zip).

**Script:** `scripts/prepare-dataset.ts`

Steps:
1. Read `FoodEarth-mini.json` (LLaMA-Factory alpaca format: `instruction`/`input`/`output` fields)
2. Filter to English-only entries (dataset is bilingual Chinese/English)
3. Convert each entry to Together AI conversational JSONL format:
   ```json
   {"messages": [{"role": "system", "content": "You are a professional chef and nutritionist specializing in recipes, dietary requirements, and food safety."}, {"role": "user", "content": "<instruction + input>"}, {"role": "assistant", "content": "<output>"}]}
   ```
4. Split 90% train / 10% validation
5. Output `training.jsonl` and `validation.jsonl`

The system prompt in training data should match what the app sends at inference time for consistency.

## Fine-Tuning Configuration

**Platform:** Together AI

**Base model:** `Qwen/Qwen2.5-14B-Instruct`

**Method:** LoRA (matching FoodSky's published config)
- Rank: 16
- Alpha: 16
- Dropout: 0.05
- Target: all layers
- Epochs: 1
- Learning rate: 1e-6
- Scheduler: cosine
- Precision: bf16

**Estimated training cost:** ~$30-50 (200K examples × ~300-500 avg tokens × $0.48/M tokens)

The fine-tuned model gets a serverless endpoint with an identifier like `<org>/culinary-ai-chef-qwen-14b`.

## App Integration

### New Client

```typescript
const togetherAI = process.env.TOGETHER_API_KEY && process.env.TOGETHER_MODEL
  ? new OpenAI({
      baseURL: "https://api.together.xyz/v1",
      apiKey: process.env.TOGETHER_API_KEY,
    })
  : null;
```

### Function Routing

| Function | Primary Model | Fallback |
|---|---|---|
| `generateRecipe()` | Together AI (fine-tuned Qwen) | GPT-4o via Braintrust |
| `analyzeRecipeNutrition()` | Together AI (fine-tuned Qwen) | GPT-4o via Braintrust |
| `validateRecipeSafety()` | GPT-4o via Braintrust | None (keep on GPT-4o) |
| `generateChatResponse()` | GPT-4o via Braintrust | None (keep on GPT-4o) |
| `generateEmbedding()` | OpenAI direct | None |
| `generateRecipeImage()` | OpenAI direct | None |

### Fallback Logic

In `generateRecipe()` and `analyzeRecipeNutrition()`:
1. If `togetherAI` client exists, call it with `TOGETHER_MODEL`
2. If the call errors or returns malformed JSON, catch the error
3. Retry with `openaiChat` (GPT-4o via Braintrust proxy)
4. Log which model served the request

### Model Selection Helper

Extract a helper to select the right client and model for recipe/nutrition calls:

```typescript
function getRecipeClient(): { client: OpenAI; model: string } {
  if (togetherAI && process.env.TOGETHER_MODEL) {
    return { client: togetherAI, model: process.env.TOGETHER_MODEL };
  }
  return { client: openaiChat, model: OPENAI_MODEL };
}
```

## Environment Variables

New Vercel env vars (all environments):
- `TOGETHER_API_KEY` — Together AI API key
- `TOGETHER_MODEL` — Fine-tuned model identifier (e.g., `<org>/culinary-ai-chef-qwen-14b`)

## Cost

| Component | One-Time | Monthly (~500 recipes) |
|---|---|---|
| Fine-tuning (LoRA, 200K examples) | ~$30-50 | — |
| Together AI inference (recipe + nutrition) | — | ~$1.60 |
| GPT-4o (safety + chat, via Braintrust) | — | ~$2-4 |
| OpenAI (embeddings + images) | — | ~$3-5 |
| **Total** | **~$30-50** | **~$7-11** |

## What Does Not Change

- Image generation: `gpt-image-1` via OpenAI direct client
- Embeddings: `text-embedding-3-small` via OpenAI direct client
- Safety validation: GPT-4o via Braintrust proxy
- Chat support: GPT-4o via Braintrust proxy
- Braintrust logging: continues for all GPT-4o calls via proxy
- Cloudinary image upload: no change
- Database schema: no change
- Frontend: no change

## Risks

1. **FoodEarth data format unknown until downloaded.** The script assumes alpaca format (`instruction`/`input`/`output`). If the format differs, the conversion script adjusts accordingly. Low risk — inspect the data before writing the converter.

2. **Fine-tuned model quality.** May underperform GPT-4o on complex dietary constraint combinations (vegan + keto + low-oxalate). Mitigation: fallback to GPT-4o on error, and monitor quality in Braintrust.

3. **JSON response format.** Together AI's fine-tuned Qwen may not support `response_format: { type: "json_object" }` the same way OpenAI does. Mitigation: include JSON formatting instructions in the system prompt (the training data should reinforce this), and validate/parse responses with error handling.
