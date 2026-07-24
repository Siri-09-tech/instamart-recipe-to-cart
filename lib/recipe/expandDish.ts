import { chatJson } from "@/lib/llm/provider";
import { normalizeIngredientName } from "@/lib/recipe/synonyms";
import {
  parseIngredientLine,
  type ParsedIngredient,
} from "@/lib/recipe/parseText";

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
Given a dish request (may include guest count and appetite), return ONLY valid JSON.

Schema (follow exactly):
{
  "title": "Palak Paneer",
  "servings": 4,
  "appetite": "medium",
  "notes": "optional short note",
  "ingredients": [
    {
      "original": "250 g spinach",
      "name": "spinach",
      "quantity": 250,
      "unit": "g",
      "search_query": "palak spinach",
      "avoid": ["puree", "soup"]
    },
    {
      "original": "200 g paneer",
      "name": "paneer",
      "quantity": 200,
      "unit": "g",
      "search_query": "paneer",
      "avoid": ["tofu"]
    }
  ]
}

HARD RULES:
- name MUST be English (latin letters only), e.g. spinach not पालक, paneer not पनीर.
- search_query MUST be Instamart-friendly English + common Hindi transliteration, e.g. "jeera cumin seeds", "palak spinach", "adrak ginger". Never leave search_query empty.
- quantity MUST be a JSON number (250), NEVER a string like "250g". Put the unit only in unit.
- unit MUST be one of: g, kg, ml, l, tsp, tbsp, cup, pc, bunch, clove (or null).
- appetite MUST be exactly: light | medium | heavy
- Scale quantities for servings and appetite (light≈0.75x, medium=1x, heavy≈1.25x vs normal adult portion).
- original MUST state the same scaled amount as quantity+unit (e.g. original "1 tsp cumin seeds" → quantity 1, unit "tsp"). Never invent a different number.
- If you mean one kilogram, use quantity 1 and unit "kg" — NEVER quantity 1000 with unit "kg".
- Cooking oil for a home dish is usually tablespoons or ml (e.g. 2 tbsp), NOT litres. Never set oil to 1+ litres unless the user asked for bulk grocery oil.
- Rice for 1–2 meals is usually cups or grams (e.g. 1–2 cups / 200–400 g), NOT multi-kg gift combos.
- Include onions/tomato/oil/salt/cream when typical for the dish. Omit water.
- Keep 8–18 ingredients. For ambiguous spices prefer seeds vs powder from dish context; put the wrong form in avoid[].
- Do NOT invent Devanagari-only names. Do NOT map paneer to dahi or ghee to butter.
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

/** Parse "250g", "1.5 kg", 250, "250" → { value, unitHint } */
export function coerceQuantity(
  raw: unknown,
  unitHint?: string | null
): { quantity: number | null; unit: string | null } {
  let unit =
    unitHint && String(unitHint).trim()
      ? String(unitHint).toLowerCase().trim()
      : null;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { quantity: raw, unit };
  }

  if (raw == null) return { quantity: null, unit };

  const s = String(raw).trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (m) {
    const value = Number(m[1]);
    if (m[2]) unit = m[2].toLowerCase();
    return {
      quantity: Number.isFinite(value) ? value : null,
      unit,
    };
  }

  const n = Number(s);
  return { quantity: Number.isFinite(n) ? n : null, unit };
}

function hasLatinLetters(s: string): boolean {
  return /[a-zA-Z]/.test(s);
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
      avoid?: string[] | string;
    }>;
  };

  const appetiteRaw = String(raw.appetite || "medium").toLowerCase();
  const appetite =
    appetiteRaw === "light" || appetiteRaw === "heavy" ? appetiteRaw : "medium";

  const ingredients: ParsedIngredient[] = [];
  for (const row of raw.ingredients || []) {
    const rawName = String(row.name || "").trim();
    const original = String(
      row.original || `${row.quantity ?? ""} ${row.unit ?? ""} ${rawName}`
    ).trim();
    if (!rawName && !original) continue;

    // Prefer English original/name for catalog matching when LLM returns Devanagari
    const englishHint = hasLatinLetters(original)
      ? original.replace(/^\d+(\.\d+)?\s*[a-zA-Z]*\s*/i, "").trim() || original
      : hasLatinLetters(rawName)
        ? rawName
        : "";

    const nameForNorm = hasLatinLetters(rawName) ? rawName : englishHint || rawName;
    const queryHint = String(
      row.search_query || row.searchQuery || nameForNorm || englishHint
    ).trim();

    const coerced = coerceQuantity(row.quantity, row.unit);
    // Prefer qty/unit parsed from original when LLM invents inconsistent numbers
    const fromOriginal = original ? parseIngredientLine(original) : null;
    let quantity =
      fromOriginal?.quantity != null ? fromOriginal.quantity : coerced.quantity;
    let unit =
      fromOriginal?.unit != null ? fromOriginal.unit : coerced.unit;
    if (unit === "grams" || unit === "gram" || unit === "gm" || unit === "gms")
      unit = "g";
    if (unit === "litre" || unit === "liter") unit = "l";

    // Guard against "1 kg" being stored as 1000 kg
    if (unit === "kg" && quantity != null && quantity >= 50) {
      unit = "g";
    }
    if (unit === "l" && quantity != null && quantity >= 50) {
      unit = "ml";
    }

    const norm = normalizeIngredientName(queryHint || nameForNorm, {
      englishHint: englishHint || nameForNorm,
    });

    const avoidFromLlm = Array.isArray(row.avoid)
      ? row.avoid.map(String)
      : typeof row.avoid === "string" && row.avoid.trim()
        ? [row.avoid.trim()]
        : [];

    ingredients.push({
      original: original || nameForNorm,
      name: hasLatinLetters(rawName)
        ? rawName.toLowerCase()
        : norm.name || englishHint.toLowerCase() || nameForNorm.toLowerCase(),
      quantity,
      unit,
      searchQuery: norm.query || queryHint || nameForNorm,
      aliases: norm.searchQueries.filter((q) => q !== norm.query),
      avoid: avoidFromLlm.length ? avoidFromLlm : norm.avoid,
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
