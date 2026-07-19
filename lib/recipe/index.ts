import { parseIngredientText, type ParsedIngredient } from "./parseText";
import { fetchRecipeFromUrl } from "./fetchUrl";
import { COMMON_DISHES } from "./commonDishes";
import { expandDishWithLlm } from "./expandDish";
import { detectLlmProvider } from "@/lib/llm/provider";
import { classifyInputIntent } from "./intent";

export type RecipeParseResult = {
  title?: string;
  source: "url" | "text" | "dish" | "llm" | "grocery";
  ingredients: ParsedIngredient[];
  note?: string;
  servings?: number;
  appetite?: string;
  provider?: string;
  model?: string;
};

export async function parseRecipeInput(
  input: string
): Promise<RecipeParseResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Paste a recipe URL, ingredient list, or dish name.");
  }

  const intent = classifyInputIntent(trimmed);

  if (intent === "url") {
    const fetched = await fetchRecipeFromUrl(trimmed);
    return {
      title: fetched.title,
      source: "url",
      ingredients: fetched.ingredients,
    };
  }

  if (intent === "grocery" || intent === "ingredient_list") {
    const ingredients = parseIngredientText(trimmed);
    if (ingredients.length === 0) {
      throw new Error("Could not parse any ingredients from that text.");
    }
    const isSingle = ingredients.length === 1 && intent === "grocery";
    return {
      title: isSingle
        ? ingredients[0].name || ingredients[0].searchQuery
        : undefined,
      source: isSingle ? "grocery" : "text",
      ingredients,
      note: isSingle
        ? "Treated as a grocery item (not a full recipe)."
        : undefined,
    };
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

  const detected = await detectLlmProvider();
  if (!detected.provider) {
    throw new Error(
      `${detected.detail}\n\nOr paste a recipe URL / ingredient list. Example dish: "chilli chicken for 10 medium eaters"`
    );
  }

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
