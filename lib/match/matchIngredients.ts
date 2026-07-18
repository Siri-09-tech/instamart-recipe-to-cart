import type { ParsedIngredient } from "@/lib/recipe/parseText";
import {
  searchProducts,
  type Product,
  type ProductVariant,
} from "@/lib/mcp/instamart";
import { computeQuantityInfo, type QuantityInfo } from "@/lib/match/quantity";

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
    label: string;
    price?: number;
  };
  quantity?: QuantityInfo;
  /** Suggested cart line qty (packs) */
  suggestedPacks?: number;
  alternatives?: Array<{
    spinId: string;
    name: string;
    label: string;
    price?: number;
  }>;
  error?: string;
};

function productName(p: Product): string {
  return String(p.displayName || p.name || "Product");
}

function variantLabel(v: ProductVariant): string {
  const qty = v.quantity ?? v.unit ?? "";
  return String(qty || "1 pack");
}

function scoreVariant(
  product: Product,
  variant: ProductVariant,
  ingredient: ParsedIngredient
): number {
  const hay = `${productName(product)} ${variantLabel(variant)}`.toLowerCase();
  let score = 0;

  for (const token of ingredient.searchQuery.split(/\s+/)) {
    if (token.length > 2 && hay.includes(token.toLowerCase())) score += 2;
  }

  for (const avoid of ingredient.avoid) {
    if (hay.includes(avoid.toLowerCase())) score -= 5;
  }

  if (variant.inStock === false) score -= 10;
  if (typeof variant.price === "number") score += 0.001;

  return score;
}

function pickBest(
  products: Product[],
  ingredient: ParsedIngredient
): {
  product: Product;
  variant: ProductVariant;
  alternatives: MatchedIngredient["alternatives"];
} | null {
  const ranked: Array<{
    product: Product;
    variant: ProductVariant;
    score: number;
  }> = [];

  for (const product of products) {
    const variants = product.variants?.length
      ? product.variants
      : [{ spinId: String((product as { spinId?: string }).spinId || "") }];

    for (const variant of variants) {
      if (!variant.spinId) continue;
      ranked.push({
        product,
        variant,
        score: scoreVariant(product, variant, ingredient),
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  if (!ranked.length || ranked[0].score < 0) return null;

  const best = ranked[0];
  const alternatives = ranked.slice(1, 4).map((r) => ({
    spinId: r.variant.spinId,
    name: productName(r.product),
    label: variantLabel(r.variant),
    price: typeof r.variant.price === "number" ? r.variant.price : undefined,
  }));

  return { product: best.product, variant: best.variant, alternatives };
}

export async function matchIngredientsToProducts(
  token: string,
  addressId: string,
  ingredients: ParsedIngredient[]
): Promise<MatchedIngredient[]> {
  const results: MatchedIngredient[] = [];

  for (const ingredient of ingredients) {
    try {
      const products = await searchProducts(
        token,
        addressId,
        ingredient.searchQuery
      );

      const picked = pickBest(products, ingredient);
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
      const quantity = computeQuantityInfo({
        requiredQty: ingredient.quantity,
        requiredUnit: ingredient.unit,
        packLabel,
      });

      results.push({
        ingredient,
        status: "matched",
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
          label: packLabel,
          price:
            typeof picked.variant.price === "number"
              ? picked.variant.price
              : undefined,
        },
        quantity,
        suggestedPacks: quantity.packsNeeded,
        alternatives: picked.alternatives,
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
