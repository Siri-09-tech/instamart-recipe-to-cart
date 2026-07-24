import type { ParsedIngredient } from "@/lib/recipe/parseText";
import {
  searchProducts,
  type Product,
  type ProductVariant,
} from "@/lib/mcp/instamart";
import {
  computeQuantityInfo,
  parsePackSize,
  toBase,
  normalizeUnit,
  type QuantityInfo,
} from "@/lib/match/quantity";
import {
  classifyVariantAvailability,
  type AvailabilityInfo,
} from "@/lib/match/availability";
import {
  edibleBiasedQueries,
  hasEdibleSignal,
  isIntentionalNonFoodSearch,
  isNonEdibleProduct,
} from "@/lib/match/edible";
import { chatJson } from "@/lib/llm/provider";

export type MatchedIngredient = {
  ingredient: ParsedIngredient;
  status: "matched" | "unmatched";
  product?: {
    name: string;
    brand?: string;
    imageUrl?: string;
  };
  variant?: {
    spinId: string;
    skuId?: string;
    label: string;
    price?: number;
    inStock?: boolean;
    availableQuantity?: number;
  };
  quantity?: QuantityInfo;
  suggestedPacks?: number;
  availability?: AvailabilityInfo;
  alternatives?: Array<{
    spinId: string;
    skuId?: string;
    name: string;
    label: string;
    price?: number;
  }>;
  error?: string;
};

type RankedVariant = {
  product: Product;
  variant: ProductVariant;
  score: number;
  index: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "for",
  "with",
  "fresh",
  "organic",
  "premium",
  "pack",
  "packet",
  "pcs",
  "pc",
]);

const FLAVOR_WORDS = [
  "butterscotch",
  "chocolate",
  "vanilla",
  "strawberry",
  "mango",
  "pista",
  "pistachio",
  "kulfi",
  "kesar",
  "malai",
  "coffee",
  "mocha",
  "brownie",
  "cookie",
  "caramel",
  "butter",
  "scotch",
  "berry",
  "blackcurrant",
  "chocochips",
  "almond",
  "cashew",
];

const PACK_WORDS = [
  "tub",
  "cup",
  "cone",
  "stick",
  "bar",
  "family",
  "brick",
  "bottle",
  "pouch",
  "tin",
  "can",
  "jar",
  "box",
  "tray",
];

function productName(p: Product): string {
  return String(p.displayName || p.name || "Product");
}

function variantSpinId(v: ProductVariant | Record<string, unknown>): string {
  const obj = v as Record<string, unknown>;
  for (const key of ["spinId", "spin_id", "spinID", "spin"]) {
    const val = obj[key];
    if (val != null && String(val).trim() && typeof val !== "object") {
      return String(val).trim();
    }
  }
  return "";
}

function variantSkuId(v: ProductVariant | Record<string, unknown>): string {
  const obj = v as Record<string, unknown>;
  for (const key of ["skuId", "sku_id", "skuID", "sku"]) {
    const val = obj[key];
    if (val != null && String(val).trim() && typeof val !== "object") {
      return String(val).trim();
    }
  }
  return "";
}

function variantLabel(v: ProductVariant): string {
  const qty = v.quantity;
  const unit = v.unit;
  if (qty != null && unit != null && String(unit).trim()) {
    return `${qty} ${unit}`.trim();
  }
  if (qty != null && String(qty).trim()) return String(qty).trim();
  if (unit != null && String(unit).trim()) return String(unit).trim();
  return "1 pack";
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Prefer the user's original grocery text for Instamart search. */
function isCookingCreamIngredient(ingredient: ParsedIngredient): boolean {
  const text =
    `${ingredient.original} ${ingredient.name} ${ingredient.searchQuery}`.toLowerCase();
  if (/\bice\s*cream\b|\bicecream\b/.test(text)) return false;
  return /\b(cream|malai|cooking\s*cream|fresh\s*cream)\b/.test(text);
}

function buildSearchQueries(ingredient: ParsedIngredient): string[] {
  const original = ingredient.original.trim();
  const name = (ingredient.name || "").trim();
  const searchQuery = (ingredient.searchQuery || "").trim();

  // Strip only leading/trailing size noise for a secondary query, keep flavour words
  const cleanedOriginal = original
    .replace(/^\d+(?:\.\d+)?\s*(gm|gms|kg|g|ml|l|tub|pack)?\s*/i, "")
    .replace(/\b\d+(?:\.\d+)?\s*(gm|gms|kg|g|ml|l)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const key = q.toLowerCase().trim();
    if (!q || !key || seen.has(key)) return;
    // Bare "cream" pulls medicine tubes — skip unless that's all we have later
    if (key === "cream") return;
    seen.add(key);
    out.push(q.trim());
  };

  // Edible-biased queries first for ambiguous foods (rose water, chicken, cream…)
  if (!isIntentionalNonFoodSearch(ingredient)) {
    for (const q of edibleBiasedQueries(ingredient)) push(q);
  }

  // Cooking cream: never lead with bare "cream"
  if (isCookingCreamIngredient(ingredient)) {
    for (const q of [
      "amul fresh cream",
      "fresh cream",
      "cooking cream",
      searchQuery,
      ...(ingredient.aliases || []),
      "dairy cream",
    ]) {
      push(q);
    }
    return out.length ? out : ["amul fresh cream"];
  }

  for (const q of [
    original,
    cleanedOriginal,
    name,
    searchQuery,
    ...(ingredient.aliases || []),
  ]) {
    const key = q.toLowerCase();
    if (!q || seen.has(key)) continue;
    if (
      out.length > 0 &&
      (key === "ice cream" || key === "cream" || key === "fresh cream")
    ) {
      continue;
    }
    push(q);
  }
  return out;
}

function extractFeatures(text: string): {
  flavors: string[];
  packs: string[];
  tokens: string[];
} {
  const lower = text.toLowerCase();
  const flavors = FLAVOR_WORDS.filter((f) => lower.includes(f));
  const packs = PACK_WORDS.filter((p) => lower.includes(p));
  return { flavors, packs, tokens: tokenize(text) };
}

/**
 * Feature-aware score: flavour + pack type matter more than generic "ice cream".
 */
function scoreVariant(
  product: Product,
  variant: ProductVariant,
  ingredient: ParsedIngredient
): number {
  const hay = `${productName(product)} ${variantLabel(variant)} ${
    product.brand || ""
  }`.toLowerCase();
  const wantText = `${ingredient.original} ${ingredient.name} ${ingredient.searchQuery}`;
  const want = extractFeatures(wantText);
  const got = extractFeatures(hay);

  let score = 0;

  // Category / shared distinctive tokens (ignore ultra-generic alone)
  const generic = new Set(["ice", "cream", "icecream", "frozen", "dessert"]);
  const wantSpecific = want.tokens.filter((t) => !generic.has(t));
  const gotTokens = new Set(got.tokens);
  let specificHits = 0;
  for (const t of wantSpecific) {
    if (gotTokens.has(t) || hay.includes(t)) {
      score += t.length > 5 ? 25 : 15;
      specificHits += 1;
    } else {
      score -= 8;
    }
  }

  // Flavour: must match if user specified one
  if (want.flavors.length) {
    const flavorHit = want.flavors.some((f) => hay.includes(f));
    if (flavorHit) score += 40;
    else score -= 100; // chocolate brownie for butterscotch → reject
  }

  // Wrong flavours present in candidate
  for (const f of got.flavors) {
    if (want.flavors.length && !want.flavors.includes(f)) score -= 35;
  }

  // Pack type: tub vs cup vs stick
  if (want.packs.length) {
    const packHit = want.packs.some((p) => hay.includes(p));
    if (packHit) score += 25;
    else score -= 30;
  }
  for (const p of got.packs) {
    if (want.packs.length && !want.packs.includes(p)) score -= 20;
  }

  // Quantity closeness
  if (ingredient.quantity != null && ingredient.unit) {
    const pack = parsePackSize(variantLabel(variant));
    const reqBase = toBase(
      ingredient.quantity,
      normalizeUnit(ingredient.unit)
    );
    const packBase =
      pack.value != null ? toBase(pack.value, pack.unit) : null;
    if (reqBase != null && packBase != null && packBase > 0) {
      const ratio = packBase / reqBase;
      if (ratio >= 0.7 && ratio <= 1.4) score += 20;
      else if (ratio >= 0.4 && ratio <= 2.5) score += 8;
      else score -= 10;
    }
  }

  for (const avoid of ingredient.avoid) {
    const a = avoid.toLowerCase().trim();
    if (a && hay.includes(a)) score -= 40;
  }

  // Strict edible-only for cooking ingredients (skip for intentional non-food grocery)
  const enforceEdible = !isIntentionalNonFoodSearch(ingredient);
  if (enforceEdible) {
    if (isNonEdibleProduct(hay)) {
      return -1000; // hard reject — never pick pet food / face toner / medicine
    }
    if (hasEdibleSignal(hay)) score += 12;
  }

  // Cooking cream: prefer dairy brands, hard-reject medicine tubes
  if (isCookingCreamIngredient(ingredient)) {
    if (
      /\b(fresh\s*cream|cooking\s*cream|dairy|amul|mother\s*dairy|nandini|milky\s*mist|malai)\b/i.test(
        hay
      )
    ) {
      score += 55;
    }
    if (/\btube\b|\d+\s*%|ointment|gm\s+cream|cream\s+for\s+skin/i.test(hay)) {
      score -= 250;
    }
  }

  if (variant.inStock === false) score -= 50;

  // Tiny boost for any shared non-generic token so empty-specific still ranks
  if (specificHits === 0 && want.flavors.length === 0) {
    for (const t of want.tokens) {
      if (hay.includes(t)) score += 5;
    }
  }

  return score;
}

function flattenRanked(
  products: Product[],
  ingredient: ParsedIngredient
): RankedVariant[] {
  const ranked: RankedVariant[] = [];
  let index = 0;
  const enforceEdible = !isIntentionalNonFoodSearch(ingredient);

  for (const product of products) {
    const variants = product.variants?.length
      ? product.variants
      : [
          {
            spinId: variantSpinId(product as ProductVariant),
            skuId: variantSkuId(product as ProductVariant),
          } as ProductVariant,
        ];

    for (const variant of variants) {
      const spinId = variantSpinId(variant);
      if (!spinId) continue;
      const skuId = variantSkuId(variant) || variantSkuId(product);
      const normalized: ProductVariant = {
        ...variant,
        spinId,
        ...(skuId ? { skuId } : {}),
      };

      const hay = `${productName(product)} ${variantLabel(normalized)} ${
        product.brand || ""
      }`;
      if (enforceEdible && isNonEdibleProduct(hay)) {
        continue; // drop pet food / face toner / medicine before ranking
      }

      ranked.push({
        product,
        variant: normalized,
        score: scoreVariant(product, normalized, ingredient),
        index: index++,
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.filter((r) => r.score > -500);
}

function toResult(
  best: RankedVariant,
  ranked: RankedVariant[]
): {
  product: Product;
  variant: ProductVariant;
  alternatives: MatchedIngredient["alternatives"];
  score: number;
} {
  return {
    product: best.product,
    variant: best.variant,
    score: best.score,
    alternatives: ranked
      .filter((r) => r.variant.spinId !== best.variant.spinId)
      .slice(0, 3)
      .map((r) => ({
        spinId: r.variant.spinId,
        skuId: variantSkuId(r.variant) || undefined,
        name: productName(r.product),
        label: variantLabel(r.variant),
        price: typeof r.variant.price === "number" ? r.variant.price : undefined,
      })),
  };
}

async function pickWithLlm(
  ingredient: ParsedIngredient,
  ranked: RankedVariant[]
): Promise<RankedVariant | null> {
  const top = ranked.filter((r) => r.score > -50).slice(0, 12);
  if (!top.length) return null;

  const catalog = top.map((r, i) => ({
    i,
    name: productName(r.product),
    brand: r.product.brand ? String(r.product.brand) : "",
    pack: variantLabel(r.variant),
    score: r.score,
    price: typeof r.variant.price === "number" ? r.variant.price : null,
  }));

  try {
    const llm = await chatJson({
      temperature: 0,
      system: `You pick the best Swiggy Instamart product for a grocery / cooking ingredient.
Return ONLY JSON: {"index": <number>} from candidates.
ONLY edible food / drink / cooking products are allowed.
NEVER pick: pet food, dog/cat food, medicine tubes, face/skin/hair care, toners, mists for face, cleaning products.
For "cream" pick dairy cooking cream (Amul fresh cream) — not medicine.
For "rose water" pick edible/food-grade gulab jal — not face toner.
For "chicken" pick fresh chicken for cooking — not pet food.
Match flavour, pack type, and size closely.
If nothing edible/reasonable, return {"index": -1}.`,
      user: JSON.stringify({
        request: ingredient.original,
        name: ingredient.name,
        searchQuery: ingredient.searchQuery,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        candidates: catalog,
      }),
    });

    const cleaned = llm.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(
      cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1)
    ) as { index?: number };
    const idx = Number(parsed.index);
    if (!Number.isFinite(idx) || idx < 0 || idx >= top.length) return null;
    return top[idx];
  } catch {
    return null;
  }
}

async function pickBest(
  products: Product[],
  ingredient: ParsedIngredient
): Promise<{
  product: Product;
  variant: ProductVariant;
  alternatives: MatchedIngredient["alternatives"];
  score: number;
} | null> {
  const ranked = flattenRanked(products, ingredient);
  if (!ranked.length) return null;

  // Strong feature match
  if (ranked[0].score >= 40) {
    return toResult(ranked[0], ranked);
  }

  // Ambiguous / weak → let LLM choose among Instamart hits (after search)
  const llmPick = await pickWithLlm(ingredient, ranked);
  if (llmPick && llmPick.score >= -20) {
    return toResult(llmPick, ranked);
  }

  // Reject terrible matches (wrong flavour etc.)
  if (ranked[0].score < 0) return null;

  return toResult(ranked[0], ranked);
}

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const p of products) {
    const key =
      String(p.productId || "") ||
      `${productName(p)}::${(p.variants || [])
        .map((v) => variantSpinId(v))
        .join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

async function searchWithFallbackQueries(
  token: string,
  addressId: string,
  queries: string[],
  ingredient: ParsedIngredient,
  meta?: { mode?: string; ingredient?: string }
): Promise<Product[]> {
  const collected: Product[] = [];
  const tried = new Set<string>();
  const enforceEdible = !isIntentionalNonFoodSearch(ingredient);

  for (const q of queries) {
    const key = q.trim().toLowerCase();
    if (!key || tried.has(key)) continue;
    tried.add(key);

    try {
      const products = await searchProducts(token, addressId, q.trim(), 0, meta);
      if (!products.length) continue;

      const filtered = enforceEdible
        ? products.filter(
            (p) =>
              !isNonEdibleProduct(
                `${p.displayName || p.name || ""} ${p.brand || ""}`
              )
          )
        : products;

      // If this query only returned non-food, try the next edible-biased query
      if (enforceEdible && !filtered.length) {
        console.log(
          `[match] skipped non-edible-only results for query="${q}"`
        );
        continue;
      }

      collected.push(...(filtered.length ? filtered : products));
      if (collected.length >= 10) break;
    } catch {
      // try next
    }
  }

  return dedupeProducts(collected);
}

export async function matchIngredientsToProducts(
  token: string,
  addressId: string,
  ingredients: ParsedIngredient[],
  opts?: { mode?: string }
): Promise<MatchedIngredient[]> {
  const results: MatchedIngredient[] = [];
  const mode = opts?.mode || "match";

  console.log(
    `\n##### Instamart match start mode=${mode} ingredients=${ingredients.length} #####\n`
  );

  for (const ingredient of ingredients) {
    try {
      const queries = buildSearchQueries(ingredient);
      console.log(
        `[match] searching with queries (original first):`,
        queries
      );

      const products = await searchWithFallbackQueries(
        token,
        addressId,
        queries,
        ingredient,
        {
          mode,
          ingredient: ingredient.original || ingredient.name,
        }
      );

      if (!products.length) {
        results.push({
          ingredient,
          status: "unmatched",
          error: "No Instamart products for search query",
          quantity: computeQuantityInfo({
            requiredQty: ingredient.quantity,
            requiredUnit: ingredient.unit,
            packLabel: "—",
          }),
        });
        continue;
      }

      const picked = await pickBest(products, ingredient);
      if (!picked) {
        results.push({
          ingredient,
          status: "unmatched",
          error: "No close Instamart match",
          quantity: computeQuantityInfo({
            requiredQty: ingredient.quantity,
            requiredUnit: ingredient.unit,
            packLabel: "—",
          }),
        });
        continue;
      }

      const packLabel = variantLabel(picked.variant);
      let suggestedPacks = computeQuantityInfo({
        requiredQty: ingredient.quantity,
        requiredUnit: ingredient.unit,
        packLabel,
      }).packsNeeded;

      const availability = classifyVariantAvailability(
        picked.variant,
        suggestedPacks
      );

      // Cap cart packs to what Instamart can fulfill when partial
      if (
        availability.status === "partial" &&
        availability.availableQty != null &&
        availability.availableQty > 0
      ) {
        suggestedPacks = availability.availableQty;
      }

      const quantity = computeQuantityInfo({
        requiredQty: ingredient.quantity,
        requiredUnit: ingredient.unit,
        packLabel,
        packsOverride: suggestedPacks,
      });

      const skuId = variantSkuId(picked.variant);

      const status: MatchedIngredient["status"] =
        availability.status === "unavailable" ? "unmatched" : "matched";

      results.push({
        ingredient,
        status,
        product: {
          name: productName(picked.product),
          brand: picked.product.brand
            ? String(picked.product.brand)
            : undefined,
          imageUrl: picked.product.imageUrl
            ? String(picked.product.imageUrl)
            : undefined,
        },
        variant: {
          spinId: picked.variant.spinId,
          ...(skuId ? { skuId } : {}),
          label: packLabel,
          price:
            typeof picked.variant.price === "number"
              ? picked.variant.price
              : undefined,
          inStock: picked.variant.inStock,
          ...(typeof picked.variant.availableQuantity === "number"
            ? { availableQuantity: picked.variant.availableQuantity }
            : {}),
        },
        quantity,
        suggestedPacks,
        availability,
        alternatives: picked.alternatives,
        ...(status === "unmatched"
          ? { error: availability.note || "Out of stock on Instamart" }
          : {}),
      });
    } catch (err) {
      results.push({
        ingredient,
        status: "unmatched",
        error: err instanceof Error ? err.message : "Search failed",
      });
    }
  }

  return results;
}
