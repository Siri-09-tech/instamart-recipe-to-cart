import { normalizeIngredientName } from "./synonyms";

export type ParsedIngredient = {
  original: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  searchQuery: string;
  aliases: string[];
  avoid: string[];
};

const UNIT_ALIASES: Record<string, string> = {
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  litre: "l",
  liter: "l",
  pinch: "pinch",
  piece: "pc",
  pieces: "pc",
  pc: "pc",
  pcs: "pc",
  clove: "clove",
  cloves: "clove",
  bunch: "bunch",
  bunches: "bunch",
  packet: "packet",
  pack: "packet",
  tub: "packet",
};

const LINE_RE =
  /^(?:[-*•]\s+)?(?:(\d+(?:[./]\d+)?)\s*(?:-|to\s+\d+(?:[./]\d+)?)?\s*)?([a-zA-Z]+)?\s+(.+)$/i;

const TRAILING_QTY_RE =
  /^(.*?)[\s,:-]+(\d+(?:\.\d+)?)\s*(gm|gms|grams?|kg|g|ml|mls|l|lt|litre|liter|cup|cups|tsp|tbsp|pc|pcs|tub|pack|packet)s?\s*$/i;

function parseFraction(raw: string): number {
  if (raw.includes("/")) {
    const [a, b] = raw.split("/").map(Number);
    if (b) return a / b;
  }
  return Number(raw);
}

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const trimmed = line
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
  if (!trimmed || trimmed.length < 2) return null;

  if (
    /^(ingredients|method|instructions|directions|for the|to serve)/i.test(
      trimmed
    )
  ) {
    return null;
  }

  let quantity: number | null = null;
  let unit: string | null = null;
  let rest = trimmed;

  const m = trimmed.match(LINE_RE);
  if (m) {
    if (m[1]) quantity = parseFraction(m[1]);
    if (m[2]) {
      const u = UNIT_ALIASES[m[2].toLowerCase()];
      if (u) {
        unit = u;
        rest = m[3];
      } else {
        rest = `${m[2]} ${m[3]}`.trim();
      }
    } else if (m[3]) {
      rest = m[3];
    }
  }

  // Trailing size: "butterscotch ice cream tub 500ml"
  if (quantity == null) {
    const trail = trimmed.match(TRAILING_QTY_RE);
    if (trail) {
      rest = trail[1].trim();
      quantity = Number(trail[2]);
      unit = UNIT_ALIASES[trail[3].toLowerCase()] || trail[3].toLowerCase();
    }
  }

  rest = rest.replace(/^of\s+/i, "").trim();
  // Drop marketing words that hurt search
  rest = rest.replace(/\b(tub|pack|packet|bottle|carton)\b/gi, " ").replace(/\s+/g, " ").trim();
  const namePart = rest.split(",")[0].trim();
  if (!namePart) return null;

  const norm = normalizeIngredientName(namePart);

  return {
    original: trimmed,
    name: norm.name || namePart,
    quantity: Number.isFinite(quantity as number) ? quantity : null,
    unit,
    searchQuery: norm.query,
    aliases: norm.searchQueries.filter((q) => q !== norm.query),
    avoid: norm.avoid,
  };
}

export function parseIngredientText(text: string): ParsedIngredient[] {
  const lines = text
    .split(/\r?\n|,/)
    .map((l) => l.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: ParsedIngredient[] = [];

  for (const line of lines) {
    const parsed = parseIngredientLine(line);
    if (!parsed) continue;
    const key = parsed.searchQuery.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }

  return out;
}
