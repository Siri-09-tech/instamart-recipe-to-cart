/**
 * Decide whether user input is a dish/recipe request vs a grocery item list.
 *
 * Mental model: if it looks like an Instamart search box query → grocery.
 * Only expand with LLM when the user clearly asks for a cooked dish / servings.
 */

const DISH_SIGNALS =
  /\b(biryani|pulao|pilaf|fried\s*rice|curry|masala|gravy|sambar|rasam|dal\s+tadka|dal\s+fry|korma|kofta|tikka|kebab|tandoori|butter\s+chicken|chilli\s+chicken|manchurian|noodles?|pasta|pizza|burger|sandwich|wrap|roll|dosa|idli|vada|uttapam|paratha|roti|naan|thali|soup|stew|salad|cake|cookies?|brownie|pudding|kheer|halwa|payasam|smoothie|shake|recipe|cook|make\s+me|ingredients\s+for)\b/i;

const SERVING_SIGNAL =
  /\bfor\s+\d+\b|\bserves?\s+\d+\b|\b\d+\s+(people|persons|guests|eaters|pax)\b/i;

const QTY_UNIT_RE =
  /(\d+(?:\.\d+)?)\s*(gm|gms|grams?|kg|g|ml|mls|l|lt|litre|liter|cup|cups|tsp|tsps|tbsp|tbsps|pc|pcs|pieces?|bunch|bunches|clove|cloves|packet|pack|tub)\b/i;

/** Brand / catalog product cues (not a home-cooked dish name) */
const PRODUCT_SIGNALS =
  /\b(wishcare|amul|tata|aashirvaad|fortune|saffola|dove|nivea|himalaya|patanjali|dabur|pond'?s|garnier|loreal|lux|pears|dettol|colgate|oral[\s-]?b|maggi|mtr|everest|mdh|catch|mother\s*dairy|nandini|heritage|licious|freshToHome|glycerine|glycerin|shampoo|conditioner|toothpaste|detergent|floor\s*cleaner|face\s*wash|body\s*lotion|moisturizer|sunscreen|serum|perfume|deodorant|sanitizer|handwash|dishwash|toilet\s*cleaner|garbage\s*bag|aluminium\s*foil|cling\s*wrap|battery|batteries|led\s*bulb)\b/i;

export type InputIntent = "url" | "grocery" | "ingredient_list" | "dish";

export function classifyInputIntent(input: string): InputIntent {
  const trimmed = input.trim();
  if (!trimmed) return "dish";
  if (/^https?:\/\//i.test(trimmed)) return "url";

  // Multi-line or comma lists are ingredient lists
  if (trimmed.includes("\n")) return "ingredient_list";
  if (
    /,/.test(trimmed) &&
    QTY_UNIT_RE.test(trimmed) &&
    !DISH_SIGNALS.test(trimmed)
  ) {
    return "ingredient_list";
  }

  // Explicit servings / guests → dish recipe expansion
  if (SERVING_SIGNAL.test(trimmed)) return "dish";

  // Qty + product ("200gm drumsticks", "butterscotch ice cream tub 500ml")
  if (QTY_UNIT_RE.test(trimmed)) return "grocery";

  // Bare count + item ("2 onions")
  if (/^\d+\s+[a-zA-Z][a-zA-Z\s\-']{1,40}$/i.test(trimmed)) return "grocery";

  // Brand / personal-care / packaged goods → Instamart product search
  if (PRODUCT_SIGNALS.test(trimmed)) return "grocery";

  // Title-Case product-like query without dish words → grocery
  // e.g. "WishCare Unscented Glycerine", "Amul Gold Milk"
  const words = trimmed.split(/\s+/);
  const titleCaseWords = words.filter((w) => /^[A-Z][a-z0-9'%-]*$/.test(w));
  if (
    !DISH_SIGNALS.test(trimmed) &&
    words.length >= 2 &&
    words.length <= 10 &&
    titleCaseWords.length >= 2
  ) {
    return "grocery";
  }

  // Clear dish name → recipe
  if (DISH_SIGNALS.test(trimmed)) return "dish";

  // Default: Instamart-style search (not LLM recipe expansion)
  return "grocery";
}
