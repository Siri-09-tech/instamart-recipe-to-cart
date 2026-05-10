// lib/claude/parseRecipe.ts
// Claude-powered ingredient extraction from recipe text or URL

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface ParsedIngredient {
  original: string;
  ingredient: string;
  hindi_name?: string;
  quantity: number;
  unit: string;
  pack_size_needed: number;
  search_query: string;
  search_filters: Record<string, string | string[]>;
  fallback: {
    ingredient: string;
    search_query: string;
    usage_note: string;
  } | null;
  dietary_flags: string[];
  notes: string;
}

export async function parseRecipeFromText(
  recipeText: string,
  serves: number = 2,
  dietaryRestrictions: string[] = []
): Promise<ParsedIngredient[]> {
  const systemPrompt = `You are an ingredient parser for an Indian grocery delivery app (Swiggy Instamart).
Given a recipe, extract all ingredients as structured JSON.

Rules:
- Normalise Hindi/regional names to English catalog terms
- Resolve ambiguous items (jeera → cumin seeds NOT powder; dhania → specify seeds vs leaves)  
- Suggest smallest Instamart pack size ≥ required quantity
- Always include a fallback for ingredients that are often out of stock (fresh leafy herbs, specialty items)
- Return ONLY valid JSON array. No preamble, no markdown fences.`;

  const userMessage = `Recipe text:
${recipeText}

Serves: ${serves} people
Dietary restrictions: ${dietaryRestrictions.length ? dietaryRestrictions.join(", ") : "none"}

Extract all ingredients. Scale for ${serves} servings.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Strip any accidental markdown fences
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as ParsedIngredient[];
}

export async function parseRecipeFromUrl(
  url: string,
  serves: number = 2
): Promise<ParsedIngredient[]> {
  // Use Claude's web_fetch tool to get the recipe page
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    tools: [
      {
        type: "web_search_20250305" as const,
        name: "web_search",
      },
    ],
    system: `You are an ingredient parser for Swiggy Instamart.
Fetch the given recipe URL, extract the ingredient list, then return structured JSON.
Return ONLY valid JSON array. No preamble.`,
    messages: [
      {
        role: "user",
        content: `Fetch this recipe and extract ingredients as JSON: ${url}
Scale for ${serves} servings. Include Hindi name aliases and Instamart pack size recommendations.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as ParsedIngredient[];
}
