import { parseIngredientText, type ParsedIngredient } from "./parseText";

type JsonLdRecipe = {
  "@type"?: string | string[];
  name?: string;
  recipeIngredient?: string | string[];
};

function isRecipeType(type: string | string[] | undefined): boolean {
  if (!type) return false;
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => String(t).toLowerCase().includes("recipe"));
}

function extractFromJsonLd(html: string): { title?: string; ingredients: string[] } {
  const scripts = Array.from(
    html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  );

  for (const match of scripts) {
    try {
      const json = JSON.parse(match[1].trim());
      const nodes: JsonLdRecipe[] = Array.isArray(json)
        ? json
        : json["@graph"]
          ? json["@graph"]
          : [json];

      for (const node of nodes) {
        if (!isRecipeType(node["@type"])) continue;
        const raw = node.recipeIngredient;
        if (!raw) continue;
        const ingredients = Array.isArray(raw) ? raw : [raw];
        return {
          title: node.name,
          ingredients: ingredients.map(String).filter(Boolean),
        };
      }
    } catch {
      // ignore bad JSON-LD blocks
    }
  }

  return { ingredients: [] };
}

function extractFromHtmlHeuristics(html: string): string[] {
  // Common class names on food blogs
  const blockMatch = html.match(
    /<(?:ul|div)[^>]*(?:ingredient|wprm-recipe-ingredient)[^>]*>([\s\S]*?)<\/(?:ul|div)>/i
  );
  const block = blockMatch?.[1] ?? html;
  const items = Array.from(block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((m) =>
    m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
  );
  return items.filter((t) => t.length > 1 && t.length < 120);
}

export type FetchedRecipe = {
  title?: string;
  sourceUrl: string;
  ingredients: ParsedIngredient[];
};

export async function fetchRecipeFromUrl(url: string): Promise<FetchedRecipe> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid recipe URL");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only http(s) recipe URLs are supported");
  }

  const res = await fetch(parsedUrl.toString(), {
    headers: {
      "User-Agent":
        "RecipeToCart/1.0 (+https://github.com/Siri-09-tech/instamart-recipe-to-cart)",
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Could not fetch recipe page (${res.status})`);
  }

  const html = await res.text();
  const jsonLd = extractFromJsonLd(html);
  let lines = jsonLd.ingredients;

  if (lines.length === 0) {
    lines = extractFromHtmlHeuristics(html);
  }

  if (lines.length === 0) {
    throw new Error(
      "No ingredients found on that page. Paste the ingredient list instead."
    );
  }

  const ingredients = parseIngredientText(lines.join("\n"));
  if (ingredients.length === 0) {
    throw new Error("Could not parse ingredients from that page.");
  }

  return {
    title: jsonLd.title,
    sourceUrl: parsedUrl.toString(),
    ingredients,
  };
}
