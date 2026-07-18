import { chatJson } from "@/lib/llm/provider";
import { normalizeIngredientName } from "@/lib/recipe/synonyms";
import type { ParsedIngredient } from "@/lib/recipe/parseText";

export type LlmRecipeResult = {
  title: string;
  servings: number;
  appetite: "light" | "medium" | "heavy";
  ingredients: ParsedIngredient[];
  notes?: string;
  provider: string;
  model: string;
};

const SYSTEM = `You are an Indian home-cooking recipe planner for Swiggy Instamart grocery shopping.
Given a dish request (may include guest count and appetite), return ONLY valid JSON:

{
  "title": "Dish name",
  "servings": 10,
  "appetite": "medium",
  "notes": "optional short note",
  "ingredients": [
    {
      "original": "1 kg chicken",
      "name": "chicken",
      "quantity": 1000,
      "unit": "g",
      "search_query": "chicken curry cut",
      "avoid": ["nuggets", "keema"]
    }
  ]
}

Rules:
- Scale quantities for the requested servings and appetite (light=0.75x, medium=1x, heavy=1.25x vs a normal adult portion).
- Prefer metric units: g, kg, ml, l, tsp, tbsp, cup, pc, bunch.
- Include pantry staples only if typically bought for this dish (oil, salt, spices used).
- Use Instamart-friendly search_query (English + common Hindi aliases).
- For ambiguous spices (jeera/cumin): prefer seeds vs powder based on dish context; put the wrong form in avoid[].
- Omit water. Keep 8–18 ingredients max.
- quantity must be a number (not a string). unit must be a short string or null.
- Return JSON only. No markdown.`;

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("LLM did not return valid JSON");
  }
}

export async function expandDishWithLlm(
  input: string
): Promise<LlmRecipeResult> {
  const llm = await chatJson({
    system: SYSTEM,
    user: `Dish request: ${input}

Default appetite to medium if unspecified. Infer servings from phrases like "for 10", "serves 4", "10 people". If servings missing, use 2.`,
  });

  const raw = extractJson(llm.text) as {
    title?: string;
    servings?: number;
    appetite?: string;
    notes?: string;
    ingredients?: Array<{
      original?: string;
      name?: string;
      quantity?: number | string;
      unit?: string | null;
      search_query?: string;
      searchQuery?: string;
      avoid?: string[];
    }>;
  };

  const appetiteRaw = String(raw.appetite || "medium").toLowerCase();
  const appetite =
    appetiteRaw === "light" || appetiteRaw === "heavy" ? appetiteRaw : "medium";

  const ingredients: ParsedIngredient[] = [];
  for (const row of raw.ingredients || []) {
    const name = String(row.name || "").trim();
    if (!name) continue;
    const original = String(row.original || `${row.quantity ?? ""} ${row.unit ?? ""} ${name}`).trim();
    const qty =
      typeof row.quantity === "number"
        ? row.quantity
        : row.quantity != null && String(row.quantity).trim()
          ? Number(row.quantity)
          : null;
    const unit = row.unit ? String(row.unit).toLowerCase() : null;
    const queryHint = String(row.search_query || row.searchQuery || name);
    const norm = normalizeIngredientName(queryHint);
    ingredients.push({
      original,
      name: norm.name || name.toLowerCase(),
      quantity: Number.isFinite(qty as number) ? (qty as number) : null,
      unit,
      searchQuery: norm.query,
      avoid: Array.isArray(row.avoid)
        ? row.avoid.map(String)
        : norm.avoid,
    });
  }

  if (ingredients.length === 0) {
    throw new Error("LLM returned no ingredients. Try a clearer dish name.");
  }

  return {
    title: String(raw.title || input).trim(),
    servings: Number(raw.servings) > 0 ? Number(raw.servings) : 2,
    appetite,
    ingredients,
    notes: raw.notes ? String(raw.notes) : undefined,
    provider: llm.provider,
    model: llm.model,
  };
}
