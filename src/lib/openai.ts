import OpenAI from "openai";
import { Ingredient, NutritionInfo } from "./types";

// Configure OpenAI models from environment variables
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-2024-11-20";
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function to generate recipe embeddings for RAG
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate text embedding");
  }
}

// Safety validator for recipes
export async function validateRecipeSafety(recipe: {
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  dietaryTags: string[];
}): Promise<{ safe: boolean; issues?: string[] }> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a recipe safety validator with expertise in food safety, allergens, and nutrition. 
          Your task is to analyze recipes and identify potential safety issues including:
          1. Dangerous food combinations
          2. Allergen risks not properly labeled
          3. Contradictions between dietary tags and actual ingredients (e.g., "vegan" recipe with animal products)
          4. Unsafe cooking instructions
          5. Improper food handling guidance
          
          Respond with JSON containing "safe" (boolean) and "issues" (array of strings describing problems found).
          If the recipe is safe, the "issues" array should be empty.`,
        },
        {
          role: "user",
          content: `Validate this recipe for safety issues:
          Title: ${recipe.title}
          Description: ${recipe.description}
          Ingredients: ${JSON.stringify(recipe.ingredients)}
          Instructions: ${JSON.stringify(recipe.instructions)}
          Dietary Tags: ${JSON.stringify(recipe.dietaryTags)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }
    const result = JSON.parse(content) as {
      safe: boolean;
      issues: string[];
    };

    return result;
  } catch (error) {
    console.error("Recipe validation error:", error);
    throw new Error("Failed to validate recipe safety");
  }
}

// Generate a new recipe from a prompt
export async function generateRecipe(prompt: string, dietaryFilters: string[] = []): Promise<{
  title: string;
  description: string;
  imageUrl: string | null;
  ingredients: Ingredient[];
  instructions: string[];
  cookingTime: number;
  servings: number;
  dietaryTags: string[];
  nutritionInfo: NutritionInfo;
}> {
  try {
    // Create detailed dietary requirements with explicit restrictions
    const dietaryRequirements = dietaryFilters.map(filter => {
      switch (filter.toLowerCase()) {
        case 'vegan':
          return 'VEGAN: ABSOLUTELY NO ANIMAL PRODUCTS - This means ZERO dairy (no milk, cheese, yogurt, butter, cream, ghee), ZERO eggs, ZERO meat, ZERO fish, ZERO honey, ZERO gelatin. Use only plant-based alternatives like coconut oil, plant-based milk, cashew cream, nutritional yeast, plant-based protein sources.';
        case 'vegetarian':
          return 'VEGETARIAN: No meat or fish, but dairy and eggs are allowed';
        case 'high protein':
        case 'highprotein': {
          const baseRequirement = 'HIGH PROTEIN: Recipe must contain at least 25g of protein per serving.';
          const isVeganSelected = dietaryFilters.some(f => f.toLowerCase() === 'vegan');
          const isKetoSelected = dietaryFilters.some(f => f.toLowerCase() === 'keto');

          const veganRequirement = isVeganSelected
            ? ' For vegan recipes, strictly use plant-based protein sources such as lentils, chickpeas, black beans, tofu, tempeh, seitan, hemp seeds, chia seeds, spirulina, or plant-based protein powder. Absolutely NO animal proteins.'
            : '';

          const ketoRequirement = isKetoSelected
            ? ' For keto recipes, ensure the protein sources are high in protein but low in net carbs, such as chicken, fish, eggs, greek yogurt, cheese, or unsweetened protein powder. Maintain keto macros while hitting the protein goal.'
            : '';

          const generalRequirement = !isVeganSelected && !isKetoSelected
            ? ' Use lean, high-quality protein sources (e.g., poultry, fish, legumes, tofu, or lean beef) and clearly state protein content.'
            : '';

          return `${baseRequirement}${veganRequirement}${ketoRequirement}${generalRequirement}`;
        }
        case 'low oxalate':
        case 'lowoxalate':
          return 'LOW OXALATE: STRICTLY AVOID spinach, beets, rhubarb, nuts (if not nut-free), chocolate, and wheat. Use ONLY low-oxalate vegetables like cauliflower, cabbage, lettuce, cucumber, zucchini, carrots, bell peppers.';
        case 'keto':
          return 'KETO: Very low carb (under 10g net carbs), high fat, moderate protein. If combined with high protein, aim for 25g+ protein while keeping carbs under 10g.';
        case 'low carb':
        case 'lowcarb':
          return 'LOW CARB: Keep total carbs under 20g per serving, focus on protein and healthy fats';
        case 'gluten-free':
        case 'celiac friendly':
          return 'GLUTEN-FREE: No wheat, barley, rye, or other gluten-containing grains';
        case 'nut allergy':
          return 'NUT-FREE: No tree nuts, peanuts, or nut-derived products';
        case 'heart healthy':
          return 'HEART HEALTHY: Low sodium, low saturated fat, high fiber, include omega-3 fatty acids';
        default:
          return filter;
      }
    });

    // Create forbidden ingredients list based on filters
    const forbiddenIngredients = [];
    if (dietaryFilters.some(f => f.toLowerCase() === 'vegan')) {
      forbiddenIngredients.push('dairy products (milk, cheese, yogurt, butter, cream, ghee)', 'eggs', 'meat', 'fish', 'seafood', 'honey', 'gelatin', 'whey', 'casein');
    }
    if (dietaryFilters.some(f => f.toLowerCase().replace(/[^a-z]/g, '') === 'lowoxalate')) {
      forbiddenIngredients.push('spinach', 'beets', 'rhubarb', 'chocolate', 'wheat flour', 'cocoa powder', 'dark chocolate');
    }
    if (dietaryFilters.some(f => f.toLowerCase() === 'nut allergy')) {
      forbiddenIngredients.push('nuts', 'peanuts', 'almond', 'walnut', 'cashew', 'pecan');
    }

    // Special handling for Indian + vegan combinations
    const hasIndianCuisine = dietaryFilters.some(f => f.toLowerCase() === 'indian');
    const hasVegan = dietaryFilters.some(f => f.toLowerCase() === 'vegan');

    const indianVeganGuidance = (hasIndianCuisine && hasVegan) ? `
CRITICAL: This MUST be an AUTHENTIC traditional Indian dish, not a Western dish with Indian spices.

REQUIRED INDIAN AUTHENTICITY:
✅ Use traditional Indian cooking techniques: tadka/tempering (heat oil, add whole spices until they crackle), bhuna (sautéing spices in oil), dum (slow cooking), roasting whole spices
✅ Traditional spice combinations: garam masala, curry powder, panch phoron (Bengali), sambar powder (South Indian)
✅ Regional cooking styles: North Indian (tomato-onion-cashew base), South Indian (coconut-tamarind base), East Indian (mustard oil and seeds)
✅ Authentic garnishes: fresh coriander leaves, curry leaves, ginger julienne, lemon wedges, fried curry leaves
✅ Traditional accompaniments: mention serving with basmati rice, roti, naan, paratha, or dosa
✅ Indian names: Use Hindi/regional names (Chana Masala NOT "chickpea curry", Dal Tadka NOT "lentil soup")

ESSENTIAL INGREDIENTS FOR VEGAN INDIAN:
- Legumes: masoor dal (red lentils), moong dal (yellow lentils), toor dal (pigeon peas), chana dal, chickpeas, rajma (kidney beans)
- Vegetables: bhindi (okra), baingan (eggplant), karela (bitter gourd), lauki (bottle gourd), curry leaves, green chilies
- Bases: coconut milk for South Indian, cashew paste for North Indian, tomato-onion masala base
- Tempering: mustard seeds (rai), cumin seeds (jeera), curry leaves, dried red chilies, asafoetida (hing)
- Spices: turmeric (haldi), coriander powder (dhaniya), cumin powder, garam masala, kasuri methi (dried fenugreek leaves), amchur (mango powder)
- Oils: mustard oil (East/North), coconut oil (South), sesame oil

VEGAN SUBSTITUTIONS (Indian-appropriate):
- NO ghee → Use coconut oil (South Indian style) or mustard oil (East/North Indian)
- NO paneer → Use firm tofu pressed and marinated in turmeric and salt, OR cashew cream for gravies
- NO cream/malai → Use coconut cream (South) or cashew cream (North) blended until smooth
- NO yogurt/dahi → Use coconut yogurt or make cashew-based raita, add lemon juice for tang
- NO butter/makkhan → Use vegan butter or coconut oil

AUTHENTIC VEGAN INDIAN DISHES TO CONSIDER:
- Dal Tadka, Dal Fry, Dal Makhani (with vegan butter), Sambar (South Indian dal)
- Chana Masala, Chole, Punjabi Chole Bhature
- Baingan Bharta (smoky mashed eggplant), Bhindi Masala (okra stir-fry)
- Aloo Gobi (potato-cauliflower), Aloo Matar (potato-peas), Aloo Palak
- Vegetable Biryani, Pulao, Tehri
- South Indian: Avial, Kootu, Poriyal, Rasam, Sambhar
- East Indian: Aloo Posto (potatoes in poppy seeds), Cholar Dal (Bengali split peas)
- Gujarati: Undhiyu, Handvo

AVOID THESE (Not authentically Indian):
❌ "Indian-spiced" Western dishes (quinoa bowls, wraps, grain bowls with curry powder)
❌ Fusion concepts ("Indian tacos", "curry pasta", "naan pizza")
❌ Generic "curry" without regional specificity or proper name
❌ Western vegetables with just garam masala added (brussels sprouts curry, kale curry)
❌ Dishes that sound like Western food with Indian names ("Indian Buddha bowl")
❌ Missing traditional cooking techniques (no tadka/tempering mentioned)

COOKING TECHNIQUE REQUIREMENTS:
1. Start with tadka/tempering: heat oil, add whole spices (mustard seeds, cumin, curry leaves), let them crackle and release aroma
2. Build proper masala base: sauté onions until golden, add ginger-garlic paste, cook until raw smell disappears, add tomatoes and spices
3. Use traditional cooking methods: slow simmering for dal, bhuna for masala, dum for biryani
4. Finish with fresh garnishes: chopped coriander leaves, curry leaves, ginger julienne
5. Specify proper consistency: mention if gravy should be thick/thin, or if dish is dry/semi-dry
6. Regional accuracy: North Indian gravies are thicker with cream base, South Indian are thinner with coconut/tamarind
` : '';

    const filtersText = dietaryRequirements.length > 0
      ? `CRITICAL DIETARY REQUIREMENTS - The recipe MUST strictly comply with ALL of these requirements:
${dietaryRequirements.map(req => `- ${req}`).join('\n')}

${forbiddenIngredients.length > 0 ? `FORBIDDEN INGREDIENTS - These ingredients are COMPLETELY PROHIBITED: ${forbiddenIngredients.join(', ')}` : ''}

${indianVeganGuidance}

VALIDATION: Before finalizing the recipe, double-check that EVERY ingredient complies with ALL dietary requirements. Include ONLY the appropriate dietary tags in the dietaryTags array (e.g., if vegan filters are applied, the recipe must be tagged as "vegan", NOT "vegetarian").`
      : "";

    // Handle complex dietary requirements with the configured model
    let response;
    let recipeData;

    // Define what constitutes complex dietary combinations
    const normalizedFilters = dietaryFilters.map(f => f.toLowerCase().replace(/[^a-z]/g, ''));

    // Randomly select a protein category if no restrictive dietary filters are applied
    const proteinRestrictiveFilters = ['vegan', 'vegetarian', 'pescatarian'];
    const hasRestrictiveProteinFilter = dietaryFilters.some(f =>
      proteinRestrictiveFilters.includes(f.toLowerCase())
    );

    let proteinInstruction = '';
    if (!hasRestrictiveProteinFilter) {
      const rand = Math.random(); // 0.0 to 1.0
      let protein;

      if (rand < 0.2) {
        protein = 'poultry (such as chicken, turkey, or duck)';
      } else if (rand < 0.4) {
        protein = 'fish (such as salmon, cod, tuna, or halibut)';
      } else if (rand < 0.6) {
        protein = 'seafood (such as shrimp, scallops, crab, or mussels)';
      } else if (rand < 0.8) {
        protein = 'red meat (such as beef, lamb, or pork)';
      } else {
        protein = 'vegetarian proteins (such as eggs, cheese, tofu, beans, or lentils)';
      }

      proteinInstruction = `\n\nIMPORTANT: This recipe MUST prominently feature ${protein} as the main protein source.`;
    }

    // Cuisines that work well with vegan diets naturally (normalized - no spaces)
    const veganFriendlyCuisines = [
      'mediterranean', 'middleeastern', 'lebanese', 'thai', 'vietnamese',
      'ethiopian', 'mexican', 'moroccan', 'chinese', 'japanese', 'korean'
    ];

    // Check if vegan is combined with a cuisine that's NOT vegan-friendly
    const hasChallengingVeganCuisine = hasVegan && normalizedFilters.some(filter =>
      !veganFriendlyCuisines.includes(filter) &&
      // Check if it's a cuisine (not a dietary restriction)
      ['indian', 'italian', 'french', 'german', 'american', 'southern', 'british', 'russian', 'polish', 'scandinavian'].includes(filter)
    );

    // Check for complex combinations:
    // 1. Any combination of 3+ filters
    // 2. Specific challenging combinations (high protein + vegan, keto + high protein, etc.)
    // 3. Individual complex filters that require careful reasoning
    // 4. Vegan + challenging cuisines (Indian, Italian, French, etc.)
    const hasComplexFilters =
      dietaryFilters.length >= 3 || // 3+ filters always complex
      normalizedFilters.some(f => ['vegan', 'highprotein', 'lowoxalate'].includes(f)) || // Individual complex filters
      (normalizedFilters.includes('keto') && normalizedFilters.includes('highprotein')) || // Keto + high protein
      (normalizedFilters.includes('lowcarb') && normalizedFilters.includes('highprotein')) || // Low carb + high protein
      (normalizedFilters.includes('vegan') && normalizedFilters.includes('highprotein')) || // Vegan + high protein
      hasChallengingVeganCuisine; // Vegan + challenging cuisine

    console.log(`Dietary filters received: ${JSON.stringify(dietaryFilters)}`);
    console.log(`Normalized filters: ${JSON.stringify(normalizedFilters)}`);
    console.log(`Has vegan: ${hasVegan}`);
    console.log(`Has challenging vegan cuisine: ${hasChallengingVeganCuisine}`);
    console.log(`Has complex filters: ${hasComplexFilters}`);

    if (hasComplexFilters) {
      try {
        console.log(`Using ${OPENAI_MODEL} for complex dietary requirements...`);
        response = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          temperature: 1.2,
          messages: [
            {
              role: "system",
              content: `You are a professional chef and nutritionist specializing in creating delicious recipes
              with accurate nutritional information. Create diverse recipes that include a variety of
              dietary approaches including meat, fish, poultry, and plant-based options unless specific
              dietary restrictions are requested. 
              
              ${filtersText}
              
              Generate a complete recipe with clear instructions and accurate measurements.
              Ensure all dietary requirements are strictly followed and reflected in the dietaryTags.
              
              IMPORTANT: Write instructions WITHOUT step numbers (like "1.", "2.", etc.) - the frontend will add numbering automatically.
              
              Format your response as a JSON object with the following structure:
              {
                "title": "Recipe title",
                "description": "Brief appetizing description",
                "ingredients": [{"name": "ingredient name", "quantity": "amount with units"}],
                "instructions": ["First instruction without numbering", "Second instruction without numbering", ...],
                "cookingTime": total time in minutes (number),
                "servings": number of servings (number),
                "dietaryTags": ["tag1", "tag2", ...],
                "nutritionInfo": {
                  "calories": number,
                  "protein": number in grams,
                  "fat": number in grams,
                  "carbs": number in grams
                }
              }`
            },
            {
              role: "user",
              content: `Create a recipe for: "${prompt}"${hasIndianCuisine && hasVegan ? '\n\nIMPORTANT: This MUST be an authentic traditional Indian dish with proper Indian cooking techniques (tadka/tempering, masala base). Use authentic Indian names (e.g., "Chana Masala" NOT "chickpea curry"). Include traditional spices and regional cooking methods. Avoid Western fusion or "Indian-inspired" dishes.' : ''}${proteinInstruction}`
            }
          ],
          response_format: { type: "json_object" }
        });

        // Use response_format for gpt-4o
        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error("No response content from OpenAI");
        }
        recipeData = JSON.parse(content);
      } catch (retryError) {
        const errorMessage = retryError instanceof Error ? retryError.message : String(retryError);
        console.warn(`${OPENAI_MODEL} failed, retrying:`, errorMessage);
        // Retry with the same model
        response = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          temperature: 1.2,
          messages: [
            {
              role: "system",
              content: `You are a professional chef and nutritionist specializing in creating delicious recipes
              with accurate nutritional information. Create diverse recipes that include a variety of
              dietary approaches including meat, fish, poultry, and plant-based options unless specific
              dietary restrictions are requested. 
              
              ${filtersText}
              
              Generate a complete recipe with clear instructions and accurate measurements.
              Ensure all dietary requirements are strictly followed and reflected in the dietaryTags.
              
              IMPORTANT: Write instructions WITHOUT step numbers (like "1.", "2.", etc.) - the frontend will add numbering automatically.
              
              Format your response as a JSON object with the following structure:
              {
                "title": "Recipe title",
                "description": "Brief appetizing description",
                "ingredients": [{"name": "ingredient name", "quantity": "amount with units"}],
                "instructions": ["First instruction without numbering", "Second instruction without numbering", ...],
                "cookingTime": total time in minutes (number),
                "servings": number of servings (number),
                "dietaryTags": ["tag1", "tag2", ...],
                "nutritionInfo": {
                  "calories": number,
                  "protein": number in grams,
                  "fat": number in grams,
                  "carbs": number in grams
                }
              }`,
            },
            {
              role: "user",
              content: `${prompt}${hasIndianCuisine && hasVegan ? '\n\nIMPORTANT: This MUST be an authentic traditional Indian dish with proper Indian cooking techniques (tadka/tempering, masala base). Use authentic Indian names (e.g., "Chana Masala" NOT "chickpea curry"). Include traditional spices and regional cooking methods. Avoid Western fusion or "Indian-inspired" dishes.' : ''}${proteinInstruction}`,
            },
          ],
          response_format: { type: "json_object" },
        });
        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error("No response content from OpenAI");
        }
        recipeData = JSON.parse(content);
      }
    } else {
      // Use configured model for simpler requirements
      response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 1.2,
        messages: [
          {
            role: "system",
            content: `You are a professional chef and nutritionist specializing in creating delicious, 
            healthy recipes with accurate nutritional information. 
            
            ${filtersText}
            
            Generate a complete recipe with clear instructions and accurate measurements.
            Ensure all dietary requirements are strictly followed and reflected in the dietaryTags.
            
            IMPORTANT: Write instructions WITHOUT step numbers (like "1.", "2.", etc.) - the frontend will add numbering automatically.
            
            Format your response as a JSON object with the following structure:
            {
              "title": "Recipe title",
              "description": "Brief appetizing description",
              "ingredients": [{"name": "ingredient name", "quantity": "amount with units"}],
              "instructions": ["First instruction without numbering", "Second instruction without numbering", ...],
              "cookingTime": total time in minutes (number),
              "servings": number of servings (number),
              "dietaryTags": ["tag1", "tag2", ...],
              "nutritionInfo": {
                "calories": number,
                "protein": number in grams,
                "fat": number in grams,
                "carbs": number in grams
              }
            }`,
          },
          {
            role: "user",
            content: `${prompt}${hasIndianCuisine && hasVegan ? '\n\nIMPORTANT: This MUST be an authentic traditional Indian dish with proper Indian cooking techniques (tadka/tempering, masala base). Use authentic Indian names (e.g., "Chana Masala" NOT "chickpea curry"). Include traditional spices and regional cooking methods. Avoid Western fusion or "Indian-inspired" dishes.' : ''}${proteinInstruction}`,
          },
        ],
        response_format: { type: "json_object" },
      });
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No response content from OpenAI");
      }
      recipeData = JSON.parse(content);
    }

    // Validate dietary filter compliance with retry logic
    if (dietaryFilters.some(f => f.toLowerCase() === 'vegan')) {
      const veganViolations = [];
      const ingredientText = JSON.stringify(recipeData.ingredients).toLowerCase();
      const instructionText = JSON.stringify(recipeData.instructions).toLowerCase();
      const fullText = ingredientText + ' ' + instructionText;

      // Check for common non-vegan ingredients
      const nonVeganIngredients = [
        'yogurt', 'milk', 'cheese', 'butter', 'cream', 'egg', 'honey',
        'ghee', 'whey', 'casein', 'meat', 'chicken', 'beef', 'fish',
        'seafood', 'gelatin', 'dairy'
      ];

      for (const ingredient of nonVeganIngredients) {
        // Create more precise patterns to avoid false positives
        const patterns = [
          new RegExp(`\\b${ingredient}\\b`, 'i'), // whole word boundary
        ];

        // Skip if it's a plant-based version
        const plantBasedExceptions = [
          `coconut ${ingredient}`, `almond ${ingredient}`, `oat ${ingredient}`, `soy ${ingredient}`,
          `plant ${ingredient}`, `vegan ${ingredient}`, `cashew ${ingredient}`, `hemp ${ingredient}`,
          `rice ${ingredient}`, `pea ${ingredient}`, `${ingredient} substitute`, `plant-based ${ingredient}`,
          `non-dairy ${ingredient}`, `dairy-free ${ingredient}`
        ];

        let hasViolation = false;
        for (const pattern of patterns) {
          if (pattern.test(fullText)) {
            // Check if it's actually a plant-based version
            let isPlantBased = false;
            for (const exception of plantBasedExceptions) {
              if (fullText.includes(exception.toLowerCase())) {
                isPlantBased = true;
                break;
              }
            }
            if (!isPlantBased) {
              hasViolation = true;
              break;
            }
          }
        }

        if (hasViolation) {
          veganViolations.push(ingredient);
        }
      }

      // If vegan violations found, try one more time with stricter instructions
      if (veganViolations.length > 0) {
        console.log(`Vegan violations detected: ${veganViolations.join(', ')}. Retrying with stricter vegan instructions...`);

        try {
          const veganForbiddenSection = `

ABSOLUTELY FORBIDDEN INGREDIENTS:
- NO dairy products (milk, cheese, butter, cream, yogurt, ghee, whey, casein)
- NO animal products (meat, chicken, beef, fish, seafood, eggs)
- NO honey (use maple syrup, agave, or date syrup instead)
- NO gelatin (use agar-agar instead)`;

          const veganRequiredSection = `

REQUIRED: Use only plant-based ingredients like:
- Plant milks (almond, oat, soy, coconut)
- Plant-based proteins (tofu, tempeh, legumes, nuts, seeds)
- Vegetables, fruits, grains, herbs, spices
- Plant-based fats (olive oil, coconut oil, avocado)`;

          const indianAuthenticityRequirement = hasIndianCuisine ? `

AUTHENTICITY REQUIREMENT: This MUST be an authentic traditional Indian dish with proper Indian cooking techniques (tadka/tempering, bhuna, masala base building). Use authentic Indian dish names like "Chana Masala", "Dal Tadka", "Baingan Bharta", "Aloo Gobi" - NOT generic names like "chickpea curry" or "lentil soup". Include traditional Indian spices, regional cooking methods, and avoid Western fusion concepts.` : '';

          const ketoRequirementSection = dietaryFilters.includes('keto') ? `

KETO REQUIREMENTS (if applicable):
- High fat (70-80% of calories), moderate protein (20-25%), very low carbs (5-10%)
- Use high-fat plant sources: avocados, coconut oil, olive oil, nuts, seeds
- Avoid grains, potatoes, most fruits (except berries in small amounts)
- Focus on leafy greens, cruciferous vegetables, plant proteins like tofu/tempeh
- Target: 20-30g fat, 15-20g protein, 5-10g net carbs per serving` : '';

          const strictVeganPrompt = `CRITICAL VEGAN REQUIREMENT: Create a 100% plant-based recipe for: "${prompt}"${indianAuthenticityRequirement}${veganForbiddenSection}${veganRequiredSection}${ketoRequirementSection}

${hasIndianCuisine && hasVegan ? indianVeganGuidance : ''}

${dietaryFilters.includes('highProtein') ? 'ENSURE high protein (25g+ per serving) using plant sources like tofu, tempeh, legumes, quinoa, hemp seeds.' : ''}
${dietaryFilters.includes('lowOxalate') ? 'AVOID high-oxalate foods: spinach, beets, chocolate, nuts, sweet potatoes. Use low-oxalate vegetables like cabbage, cauliflower, broccoli.' : ''}

RESPONSE FORMAT: Return a complete JSON object with ALL required fields:
{
  "title": "Recipe name",
  "description": "Brief description",
  "ingredients": [{"name": "ingredient", "quantity": "amount"}],
  "instructions": ["step 1", "step 2", "step 3"],
  "cookingTime": minutes,
  "servings": number,
  "dietaryTags": ["vegan"],
  "nutritionInfo": {"calories": number, "protein": number, "fat": number, "carbs": number}
}`;

          response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [
              {
                role: "system",
                content: `You are a vegan chef specializing in 100% plant-based recipes. 
                Generate a complete recipe with clear instructions and accurate measurements.
                IMPORTANT: Write instructions WITHOUT step numbers - the frontend will add numbering automatically.
                Format your response as a JSON object exactly as specified.`
              },
              {
                role: "user",
                content: strictVeganPrompt,
              },
            ],
            response_format: { type: "json_object" },
          });

          const retryContent = response.choices[0].message.content;
          if (!retryContent) {
            throw new Error("No response content from OpenAI");
          }
          recipeData = JSON.parse(retryContent);

          // Re-check for violations after retry
          const retryIngredientText = JSON.stringify(recipeData.ingredients || []).toLowerCase();
          const retryInstructionText = JSON.stringify(recipeData.instructions || []).toLowerCase();
          const retryFullText = retryIngredientText + ' ' + retryInstructionText;

          const retryViolations = [];
          for (const ingredient of nonVeganIngredients) {
            // Create more precise patterns to avoid false positives
            const patterns = [
              new RegExp(`\\b${ingredient}\\b`, 'i'), // whole word boundary
            ];

            // Skip if it's a plant-based version
            const plantBasedExceptions = [
              `coconut ${ingredient}`, `almond ${ingredient}`, `oat ${ingredient}`, `soy ${ingredient}`,
              `plant ${ingredient}`, `vegan ${ingredient}`, `cashew ${ingredient}`, `hemp ${ingredient}`,
              `rice ${ingredient}`, `pea ${ingredient}`, `${ingredient} substitute`, `plant-based ${ingredient}`,
              `non-dairy ${ingredient}`, `dairy-free ${ingredient}`
            ];

            let hasViolation = false;
            for (const pattern of patterns) {
              if (pattern.test(retryFullText)) {
                // Check if it's actually a plant-based version
                let isPlantBased = false;
                for (const exception of plantBasedExceptions) {
                  if (retryFullText.includes(exception.toLowerCase())) {
                    isPlantBased = true;
                    break;
                  }
                }
                if (!isPlantBased) {
                  hasViolation = true;
                  break;
                }
              }
            }

            if (hasViolation) {
              retryViolations.push(ingredient);
            }
          }

          if (retryViolations.length > 0) {
            throw new Error(`Recipe still contains non-vegan ingredients after retry: ${retryViolations.join(', ')}.`);
          }

        } catch (retryError) {
          const errorMessage = retryError instanceof Error ? retryError.message : String(retryError);
          console.error("Vegan retry failed:", errorMessage);
          throw new Error(`Unable to generate compliant vegan recipe: ${veganViolations.join(', ')}`);
        }
      }

      // Check dietary tags (ensure dietaryTags exists)
      const dietaryTags = recipeData.dietaryTags || [];
      const hasVeganTag = dietaryTags.some((tag: string) => tag.toLowerCase() === 'vegan');
      const hasVegetarianTag = dietaryTags.some((tag: string) => tag.toLowerCase() === 'vegetarian');

      // Ensure vegan tag is included and vegetarian tag is removed if present
      if (!hasVeganTag) {
        recipeData.dietaryTags = dietaryTags.filter((tag: string) => tag.toLowerCase() !== 'vegetarian');
        recipeData.dietaryTags.push('vegan');
      }
      if (hasVegetarianTag && hasVeganTag) {
        recipeData.dietaryTags = dietaryTags.filter((tag: string) => tag.toLowerCase() !== 'vegetarian');
      }
    }

    // Validate low oxalate compliance
    if (dietaryFilters.some(f => f.toLowerCase().replace(/[^a-z]/g, '') === 'lowoxalate')) {
      const lowOxalateViolations = [];
      const ingredientText = JSON.stringify(recipeData.ingredients).toLowerCase();
      const instructionText = JSON.stringify(recipeData.instructions).toLowerCase();
      const fullText = ingredientText + ' ' + instructionText;

      // Check for high-oxalate ingredients
      const highOxalateIngredients = [
        'spinach', 'beets', 'rhubarb', 'chocolate', 'cocoa powder', 'dark chocolate',
        'sweet potato', 'almonds', 'cashews', 'peanuts', 'sesame seeds', 'tahini'
      ];

      for (const ingredient of highOxalateIngredients) {
        if (fullText.includes(ingredient) && !fullText.includes(`${ingredient} substitute`) && !fullText.includes(`low-oxalate ${ingredient}`)) {
          lowOxalateViolations.push(ingredient);
        }
      }

      if (lowOxalateViolations.length > 0) {
        console.log(`Low oxalate violations detected: ${lowOxalateViolations.join(', ')}`);
        // Note: Don't throw error, just warn - the AI is getting better at avoiding these
      }
    }

    // Validate Indian cuisine authenticity (when vegan + Indian)
    if (hasIndianCuisine && hasVegan) {
      const title = recipeData.title?.toLowerCase() || '';
      const ingredients = JSON.stringify(recipeData.ingredients || []).toLowerCase();
      const instructions = JSON.stringify(recipeData.instructions || []).toLowerCase();
      const fullText = title + ' ' + ingredients + ' ' + instructions;

      // Check for traditional Indian spices (should have at least 3)
      const indianSpices = [
        'turmeric', 'haldi', 'cumin', 'jeera', 'coriander', 'dhaniya',
        'garam masala', 'curry leaves', 'mustard seeds', 'rai',
        'asafoetida', 'hing', 'cardamom', 'cinnamon', 'cloves',
        'fenugreek', 'kasuri methi', 'curry powder', 'sambar powder'
      ];

      const spicesFound = indianSpices.filter(spice => fullText.includes(spice));

      // Check for Indian cooking techniques
      const indianTechniques = ['tadka', 'tempering', 'temper', 'masala', 'bhuna', 'dum'];
      const techniquesFound = indianTechniques.filter(technique => fullText.includes(technique));

      // Warn if missing Indian authenticity markers
      if (spicesFound.length < 3) {
        console.warn(`⚠️ Indian authenticity warning: Only ${spicesFound.length} traditional Indian spices found. Expected at least 3.`);
        console.warn(`Spices found: ${spicesFound.join(', ') || 'none'}`);
      }

      if (techniquesFound.length === 0) {
        console.warn(`⚠️ Indian authenticity warning: No traditional Indian cooking techniques mentioned (tadka, tempering, masala, bhuna).`);
      }

      // Check for Western fusion anti-patterns
      const fusionPatterns = ['bowl', 'wrap', 'buddha', 'quinoa', 'pasta', 'taco', 'pizza', 'fusion'];
      const fusionFound = fusionPatterns.filter(pattern => title.includes(pattern));

      if (fusionFound.length > 0) {
        console.warn(`⚠️ Possible fusion/Western influence detected in title: ${fusionFound.join(', ')}`);
      }

      // Log authenticity check results
      console.log(`✓ Indian authenticity check: ${spicesFound.length} spices, ${techniquesFound.length} techniques found`);
    }

    // Validate recipe data completeness
    if (!recipeData.title || !recipeData.description || !recipeData.ingredients || !recipeData.instructions) {
      throw new Error("Generated recipe is incomplete - missing required fields");
    }

    // Apply safety validation
    const safetyCheck = await validateRecipeSafety(recipeData);
    if (!safetyCheck.safe) {
      console.warn(`Recipe safety warning: ${safetyCheck.issues?.join(", ")}`);

      // Instead of failing, adjust the recipe to address safety concerns
      if (safetyCheck.issues) {
        // Add warning to recipe description
        recipeData.description = `${recipeData.description} (Note: ${safetyCheck.issues[0]})`;

        // Add allergen information to dietary tags if not present
        if (safetyCheck.issues.some(issue => issue.toLowerCase().includes('allergen'))) {
          const allergenTags = ['Contains Allergens'];
          recipeData.dietaryTags = [...new Set([...recipeData.dietaryTags, ...allergenTags])];
        }
      }
    }

    // Generate an image for the recipe using the newly added function
    let imageUrl = null;
    try {
      // Only generate image if title, description, and instructions are present
      if (recipeData.title && recipeData.description && recipeData.instructions) {
        const imageResult = await generateRecipeImage(
          recipeData.title,
          recipeData.description,
          recipeData.instructions
        );
        imageUrl = imageResult.url;
      }
    } catch (imageError) {
      console.error("Recipe image generation error:", imageError);
      // Continue even if image generation fails
    }

    return {
      ...recipeData,
      imageUrl
    };
  } catch (error) {
    console.error("Recipe generation error:", error);
    throw new Error("Failed to generate recipe");
  }
}

// Helper to extract preparation style from instructions
function extractPreparationStyle(instructions: string[]): string {
  const allInstructions = instructions.join(' ').toLowerCase();

  // Detect preparation method from cooking verbs
  const preparationHints: { pattern: RegExp; hint: string }[] = [
    { pattern: /mash|puree|blend|crush/i, hint: 'Show in mashed, pureed, or blended form with smooth, creamy texture.' },
    { pattern: /layer|arrange|stack/i, hint: 'Show the layered presentation with visible distinct layers.' },
    { pattern: /mix|toss|combine|stir together/i, hint: 'Show ingredients thoroughly mixed and combined in the dish.' },
    { pattern: /simmer|stew|braise/i, hint: 'Show as a simmered dish with rich sauce or gravy coating the ingredients.' },
    { pattern: /roast|bake/i, hint: 'Show the roasted/baked dish with golden-brown caramelization.' },
    { pattern: /fry|sauté|pan.?fry/i, hint: 'Show the fried/sautéed dish with golden, crispy appearance.' },
    { pattern: /grill|char|smoke/i, hint: 'Show grill marks or charred appearance.' },
    { pattern: /stuff|fill/i, hint: 'Show the stuffed presentation with filling visible.' },
  ];

  for (const { pattern, hint } of preparationHints) {
    if (pattern.test(allInstructions)) {
      return hint;
    }
  }

  return ''; // No specific style detected
}

// Function to generate an image for a recipe using DALL-E
export async function generateRecipeImage(
  title: string,
  description: string,
  instructions: string[]
): Promise<{ url: string }> {
  try {
    // Extract preparation style from recipe instructions
    const prepStyle = extractPreparationStyle(instructions);

    // Create a more detailed prompt for realistic food photography
    const prompt = `A professional, realistic food photography image of ${title}.
    ${description}.
    ${prepStyle}
    IMPORTANT: Show the FINISHED, PLATED DISH as it would be served to a customer, not raw ingredients or cooking process.
    Close-up shot with soft natural lighting, shallow depth of field,
    photographed on a rustic wooden table with elegant tableware. Include fresh garnishes and
    complementary ingredients in the background. Use warm, appetizing colors.
    Ensure all details are photo-realistic and not illustrations.
    High-resolution, magazine-quality food photography of the completed, ready-to-eat dish.`;

    const response = await openai.images.generate({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    if (response.data && response.data.length > 0 && response.data[0].url) {
      const dalleImageUrl = response.data[0].url;

      // Upload to Cloudinary for permanent storage
      // This prevents the 403 errors when DALL-E's temporary URLs expire
      const { uploadImageFromUrl } = await import('./cloudinary');
      const permanentUrl = await uploadImageFromUrl(dalleImageUrl);

      return { url: permanentUrl };
    } else {
      throw new Error("No image URL returned from DALL-E");
    }
  } catch (error) {
    console.error("Error generating recipe image:", error);
    throw new Error("Failed to generate recipe image");
  }
}

// Function to analyze recipe nutritional properties with more accuracy
export async function analyzeRecipeNutrition(
  ingredients: Ingredient[],
  servings: number = 4
): Promise<NutritionInfo> {
  try {
    console.log(`Analyzing nutrition for ${ingredients.length} ingredients, ${servings} servings`);

    // First attempt with configured model
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a registered dietitian and professional nutritionist specializing in precise recipe nutrition analysis.
          Calculate the nutritional values for the given ingredients and quantities with extremely high accuracy.
          
          CRITICAL: You MUST analyze EVERY SINGLE INGREDIENT listed, including:
          - ALL protein sources (meat, fish, poultry, eggs, dairy, legumes)
          - ALL carbohydrates (grains, bread, pasta, quinoa, rice, potatoes, etc)
          - ALL vegetables and fruits
          - ALL oils, butter, and other fats
          - ALL sauces, condiments, and seasonings
          - ANY other ingredients, no matter how minor
          
          STEP 1: For each ingredient, calculate its nutritional values accurately based on quantity.
          STEP 2: Sum up ALL ingredients' nutrition to get total recipe values.
          STEP 3: Divide by number of servings for per-serving values.
          STEP 4: Verify your calculations using the formula: calories = (protein*4) + (carbs*4) + (fat*9)
          
          For commonly misunderstood ingredients, use these values per 100g:
          
          PROTEINS:
          - Shrimp: 99 calories (20.3g protein, 1.7g fat, 0g carbs)
          - Chicken breast: 165 calories (31g protein, 3.6g fat, 0g carbs)
          - Chicken thigh: 209 calories (26g protein, 10.9g fat, 0g carbs)
          - Ground beef (85% lean): 250 calories (26g protein, 15g fat, 0g carbs)
          - Salmon: 208 calories (22g protein, 12g fat, 0g carbs)
          - Tuna (canned in water): 86 calories (19g protein, 0.6g fat, 0g carbs)
          - Eggs: 155 calories or ~70-80 calories per large egg (6g protein, 5g fat, 0.6g carbs)
          
          CARBOHYDRATES:
          - White rice (cooked): 130 calories (2.7g protein, 0.3g fat, 28g carbs)
          - Brown rice (cooked): 112 calories (2.6g protein, 0.9g fat, 23g carbs)
          - Quinoa (cooked): 120 calories (4.4g protein, 1.9g fat, 21g carbs)
          - Farro (cooked): 140 calories (5g protein, 0.5g fat, 29g carbs)
          - Buckwheat (cooked): 92 calories (3.4g protein, 0.6g fat, 20g carbs)
          - Pasta (cooked): 158 calories (5.8g protein, 0.9g fat, 31g carbs)
          - Sweet potato (cooked): 90 calories (1.6g protein, 0.1g fat, 21g carbs)
          - Potato (cooked): 86 calories (1.9g protein, 0.1g fat, 19.7g carbs)
          - Ezekiel bread (1 slice): 80 calories (4g protein, 0.5g fat, 15g carbs)
          
          PLANT PROTEINS:
          - Tofu (firm): 144 calories (17g protein, 8.7g fat, 2.8g carbs)
          - Tempeh: 193 calories (20g protein, 11g fat, 9g carbs)
          - Edamame: 121 calories (11g protein, 5.2g fat, 10g carbs)
          - Lentils (cooked): 116 calories (9g protein, 0.4g fat, 20g carbs)
          - Chickpeas (cooked): 164 calories (9g protein, 2.6g fat, 27g carbs)
          - Black beans (cooked): 132 calories (8.9g protein, 0.5g fat, 24g carbs)
          - Hemp seeds: 580 calories (32g protein, 49g fat, 8.7g carbs)
          - Chia seeds: 486 calories (17g protein, 31g fat, 42g carbs)
          - Spirulina (dried): 290 calories (57g protein, 7.7g fat, 24g carbs)
          - Buckwheat (cooked): 92 calories (3.4g protein, 0.6g fat, 20g carbs)
          
          FATS (per tablespoon/15mL):
          - Olive oil: 119 calories (0g protein, 14g fat, 0g carbs)
          - Butter: 102 calories (0.1g protein, 11.5g fat, 0g carbs)
          - Coconut oil: 117 calories (0g protein, 13.5g fat, 0g carbs)
          
          COMMON CONVERSION REFERENCES:
          - 1 pound = 454 grams
          - 1 cup = ~240mL for liquids, varies for solids
          - 1 tablespoon = 15mL
          - 1 teaspoon = 5mL
          
          IMPORTANT: Pay close attention to quantity units (lb, g, oz, cup, tbsp, etc.) and convert appropriately.
          CALCULATIONS MUST INCLUDE ALL INGREDIENTS, no matter how small the amount.
          
          Final values should be PER SERVING, calculated as (total recipe nutrition) ÷ (number of servings).
          Provide a JSON response with calories, protein (g), fat (g), and carbs (g).`,
        },
        {
          role: "user",
          content: `Analyze the nutrition for these ingredients with high accuracy. The recipe makes ${servings} servings:
          ${JSON.stringify(ingredients)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }
    const nutritionData = JSON.parse(content) as NutritionInfo;

    // Double-check the math for calorie calculation as a fail-safe
    const calculatedCalories = (nutritionData.protein * 4) + (nutritionData.carbs * 4) + (nutritionData.fat * 9);
    const calorieDiscrepancy = Math.abs(calculatedCalories - nutritionData.calories);
    const discrepancyPercentage = (calorieDiscrepancy / nutritionData.calories) * 100;

    console.log(`Nutrition check: API calories=${nutritionData.calories}, Calculated=${calculatedCalories}`);
    console.log(`Discrepancy: ${calorieDiscrepancy} calories (${discrepancyPercentage.toFixed(1)}%)`);

    // If there's a significant discrepancy (>10% difference), adjust the calories
    if (discrepancyPercentage > 10) {
      console.warn(`Nutrition calculation adjusted: Original calories: ${nutritionData.calories}, Calculated: ${calculatedCalories}`);
      nutritionData.calories = Math.round(calculatedCalories);
    }

    // Final verification - do a basic calculation for common protein sources
    // This acts as a sanity check for extremely low calorie counts
    let hasProteinSource = false;
    let estimatedMinimumCalories = 0;

    for (const ingredient of ingredients) {
      const name = ingredient.name.toLowerCase();
      const quantity = ingredient.quantity.toLowerCase();

      // Check for common proteins and estimate minimum calories
      if (name.includes('chicken') || name.includes('beef') || name.includes('pork') ||
        name.includes('fish') || name.includes('tofu') || name.includes('shrimp') ||
        name.includes('tuna') || name.includes('salmon')) {

        hasProteinSource = true;

        // Crude estimation based on quantity
        let grams = 0;
        if (quantity.includes('lb') || quantity.includes('pound')) {
          const match = quantity.match(/(\d+(\.\d+)?)/);
          if (match) {
            const pounds = parseFloat(match[0]);
            grams = pounds * 454;
          }
        } else if (quantity.includes('g') || quantity.includes('gram')) {
          const match = quantity.match(/(\d+(\.\d+)?)/);
          if (match) {
            grams = parseFloat(match[0]);
          }
        } else if (quantity.includes('oz') || quantity.includes('ounce')) {
          const match = quantity.match(/(\d+(\.\d+)?)/);
          if (match) {
            const ounces = parseFloat(match[0]);
            grams = ounces * 28.35;
          }
        }

        // Very conservative estimate of calories (100 cal per 100g of protein source)
        if (grams > 0) {
          estimatedMinimumCalories += (grams * 1); // 1 calorie per gram as absolute minimum
        }
      }

      // Check for common carbs and add minimum calories
      if (name.includes('rice') || name.includes('pasta') || name.includes('potato') ||
        name.includes('bread') || name.includes('quinoa')) {

        // Crude estimation based on quantity
        let grams = 0;
        if (quantity.includes('cup')) {
          const match = quantity.match(/(\d+(\.\d+)?)/);
          if (match) {
            const cups = parseFloat(match[0]);
            grams = cups * 150; // Rough approximation for cooked grains
          }
        } else if (quantity.includes('g') || quantity.includes('gram')) {
          const match = quantity.match(/(\d+(\.\d+)?)/);
          if (match) {
            grams = parseFloat(match[0]);
          }
        }

        // Very conservative estimate (100 cal per 100g of carbs)
        if (grams > 0) {
          estimatedMinimumCalories += (grams * 1); // 1 calorie per gram as absolute minimum
        }
      }

      // Check for oils and fats
      if (name.includes('oil') || name.includes('butter') || name.includes('cream')) {
        let tbsp = 0;
        if (quantity.includes('tbsp') || quantity.includes('tablespoon')) {
          const match = quantity.match(/(\d+(\.\d+)?)/);
          if (match) {
            tbsp = parseFloat(match[0]);
            estimatedMinimumCalories += (tbsp * 100); // ~100 calories per tbsp of oil/fat
          }
        }
      }
    }

    // Apply minimum calories sanity check per serving
    const minimumPerServing = estimatedMinimumCalories / servings;
    console.log(`Minimum calorie sanity check: ${minimumPerServing} calories per serving`);

    // If calculated calories are unreasonably low compared to our basic estimation
    if (hasProteinSource && nutritionData.calories < minimumPerServing && minimumPerServing > 100) {
      console.warn(`Calorie count suspiciously low. Minimum estimate: ${minimumPerServing}, API: ${nutritionData.calories}`);
      nutritionData.calories = Math.max(nutritionData.calories, Math.round(minimumPerServing));
    }

    return nutritionData;
  } catch (error) {
    console.error("Nutrition analysis error:", error);
    // Return default values if analysis fails
    return {
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
    };
  }
}

// Function to handle chat support interactions
export async function generateChatResponse(userMessage: string, context: string = ""): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant for a recipe website. You can help users find recipes, 
          explain cooking techniques, suggest substitutions for ingredients, and answer questions about 
          dietary restrictions. Keep your responses friendly, concise, and focused on cooking and recipes.
          
          ${context ? `Context about previous conversation: ${context}` : ""}`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;
    return content || "I'm sorry, I couldn't process your request.";
  } catch (error) {
    console.error("Chat response error:", error);
    return "I'm experiencing some difficulty right now. Please try again later.";
  }
}

// RAG implementation for recipe research
export async function researchRelatedRecipes(prompt: string, recipeEmbeddings: Array<{ embedding: number[]; recipe: string }>): Promise<string> {
  try {
    // Generate embedding for the prompt (for future similarity search)
    await generateEmbedding(prompt);

    // Add context from existing recipes (simplified - in production you'd use vector DB and cosine similarity)
    let context = "Based on similar recipes in our database:\n";

    if (recipeEmbeddings && recipeEmbeddings.length > 0) {
      for (const embedding of recipeEmbeddings.slice(0, 3)) {
        context += `- ${embedding.recipe}\n`;
      }
    } else {
      context += "No similar recipes found.\n";
    }

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a culinary research assistant. Use the provided context about similar recipes 
          to enhance your response to the user's query. Incorporate relevant techniques, ingredient combinations, 
          or cooking methods from the context.`,
        },
        {
          role: "user",
          content: `${context}\n\nUser query: ${prompt}`
        },
      ],
    });

    const content = response.choices[0].message.content;
    return content || "";
  } catch (error) {
    console.error("Recipe research error:", error);
    return "";
  }
}
