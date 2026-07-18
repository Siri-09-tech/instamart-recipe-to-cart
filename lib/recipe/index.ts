import { parseIngredientText, type ParsedIngredient } from "./parseText";
import { fetchRecipeFromUrl } from "./fetchUrl";
import { COMMON_DISHES } from "./commonDishes";
import { expandDishWithLlm } from "./expandDish";
import { detectLlmProvider } from "@/lib/llm/provider";

export type RecipeParseResult = {
  title?: string;
  source: "url" | "text" | "dish" | "llm";
  ingredients: ParsedIngredient[];
  note?: string;
  servings?: number;
  appetite?: string;
  provider?: string;
  model?: string;
};

function looksLikeUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

/** Multi-line or comma-separated ingredient list (not a dish phrase). */
function looksLikeIngredientList(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.includes("\n")) return true;
  // "2 cups besan, 1 tsp jeera" style
  if (
    /,/.test(trimmed) &&
    /\d/.test(trimmed) &&
    /(cup|tsp|tbsp|g|kg|ml|onion|tomato|salt|oil|dal|flour)/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

/** Phrases like "chilli chicken for 10 medium eaters" */
function looksLikeDishRequest(input: string): boolean {
  const t = input.trim().toLowerCase();
  if (looksLikeUrl(t) || looksLikeIngredientList(t)) return false;
  if (/\bfor\s+\d+|\bserves?\s+\d+|\b\d+\s+(people|persons|guests|eaters|pax)\b/i.test(t)) {
    return true;
  }
  // Short single-line food name without unit patterns
  if (!trimmedHasUnitPattern(t) && t.split(/\s+/).length <= 12) {
    return true;
  }
  return false;
}

function trimmedHasUnitPattern(t: string): boolean {
  return /^\d+(\.\d+)?\s*(cup|cups|tsp|tbsp|g|kg|ml|l)\b/i.test(t);
}

export async function parseRecipeInput(input: string): Promise<RecipeParseResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Paste a recipe URL, ingredient list, or dish name.");
  }

  if (looksLikeUrl(trimmed)) {
    const fetched = await fetchRecipeFromUrl(trimmed);
    return {
      title: fetched.title,
      source: "url",
      ingredients: fetched.ingredients,
    };
  }

  if (looksLikeIngredientList(trimmed)) {
    const ingredients = parseIngredientText(trimmed);
    if (ingredients.length === 0) {
      throw new Error("Could not parse any ingredients from that text.");
    }
    return { source: "text", ingredients };
  }

  // Built-in exact dish templates (fast path, no LLM)
  const key = trimmed.toLowerCase();
  const dish = COMMON_DISHES.find(
    (d) => d.name === key || d.aliases.includes(key)
  );
  if (dish && !/\bfor\s+\d+|\bserves?\s+\d+/i.test(key)) {
    return {
      title: dish.displayName,
      source: "dish",
      servings: 2,
      appetite: "medium",
      ingredients: parseIngredientText(dish.ingredients.join("\n")),
      note: "Parsed from built-in dish template.",
    };
  }

  if (looksLikeDishRequest(trimmed)) {
    const llm = await expandDishWithLlm(trimmed);
    return {
      title: llm.title,
      source: "llm",
      servings: llm.servings,
      appetite: llm.appetite,
      ingredients: llm.ingredients,
      provider: llm.provider,
      model: llm.model,
      note:
        llm.notes ||
        `Scaled for ${llm.servings} ${llm.appetite} eaters via ${llm.provider} (${llm.model}).`,
    };
  }

  // Last resort: try LLM anyway, then built-ins message
  const detected = await detectLlmProvider();
  if (detected.provider) {
    const llm = await expandDishWithLlm(trimmed);
    return {
      title: llm.title,
      source: "llm",
      servings: llm.servings,
      appetite: llm.appetite,
      ingredients: llm.ingredients,
      provider: llm.provider,
      model: llm.model,
      note:
        llm.notes ||
        `Generated via ${llm.provider} (${llm.model}) for ${llm.servings} ${llm.appetite} servings.`,
    };
  }

  throw new Error(
    `${detected.detail}\n\nOr paste a recipe URL / ingredient list. Example dish: "chilli chicken for 10 medium eaters"`
  );
}
