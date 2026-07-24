/**
 * Edible-only matching for recipe / cooking ingredients.
 * Rejects pet food, pharmacy, personal care, cleaning, etc.
 */

import type { ParsedIngredient } from "@/lib/recipe/parseText";

/** User explicitly shopping non-food (grocery mode for glycerine, shampoo, …). */
export function isIntentionalNonFoodSearch(ingredient: ParsedIngredient): boolean {
  const text =
    `${ingredient.original} ${ingredient.name} ${ingredient.searchQuery}`.toLowerCase();
  return /\b(glycerine|glycerin|shampoo|conditioner|toothpaste|detergent|floor\s*cleaner|face\s*wash|body\s*lotion|moisturizer|moisturiser|sunscreen|serum|perfume|deodorant|sanitizer|handwash|dishwash|toilet\s*cleaner|garbage\s*bag|wishcare|dove\s+soap|dettol|colgate|oral[\s-]?b|dog\s+food|cat\s+food|pet\s+food|puppy|kitten)\b/i.test(
    text
  );
}

/**
 * Product title/brand looks non-edible (not for cooking).
 * Used to hard-reject candidates when matching recipe ingredients.
 */
export function isNonEdibleProduct(haystack: string): boolean {
  const hay = haystack.toLowerCase();

  // Pet food & animal treats
  if (
    /\b(dog\s*food|cat\s*food|pet\s*food|puppy|kitten|pedigree|whiskas|drools|royal\s*canin|pet\s*treat|dog\s*treat|cat\s*treat|bird\s*food|aquarium|fish\s*food\b(?!.*\bcook)|for\s+dogs|for\s+cats|for\s+pets)\b/i.test(
      hay
    )
  ) {
    return true;
  }

  // Pharmacy / topical medicine
  if (
    /\b(tube\s+of|ointment|picon|elocon|tenovate|pacroma|impoyz|hydrocortisone|clotrimazole|betamethasone|mometasone|salicylic|hydrocolloid|dermat|acne|pimple\s+patch|tablet|capsule|syrup\b.*\bmg\b|\d+\s*mg\b)/i.test(
      hay
    )
  ) {
    return true;
  }

  // Personal care / beauty / face-body (not cooking)
  if (
    /\b(face\s*wash|face\s*cream|body\s*cream|hand\s*cream|cold\s*cream|moisturizer|moisturiser|sunscreen|spf\s*\d|serum|toner|facial|skin\s*care|skincare|hair\s*oil|hair\s*cream|shampoo|conditioner|perfume|deodorant|lipstick|makeup|cosmetic|nail\s*polish|sanitizer|hand\s*wash|body\s*lotion|face\s*mist|facial\s*mist|for\s+face|for\s+skin|for\s+hair(?!\s*care\s*food))\b/i.test(
      hay
    )
  ) {
    return true;
  }

  // Rose water / floral waters marketed for face (edible gulab jal usually says edible/food/cooking/kannauj for drinking)
  if (
    /\b(rose\s*water|gulab\s*jal|flower\s*water)\b/i.test(hay) &&
    /\b(face|facial|skin|toner|mist|spray|beauty|skincare)\b/i.test(hay) &&
    !/\b(edible|food\s*grade|cooking|culinary|drink|beverage|sharbat|sherbet)\b/i.test(
      hay
    )
  ) {
    return true;
  }

  // Cleaning / household non-food
  if (
    /\b(detergent|floor\s*cleaner|toilet\s*cleaner|dishwash|phenyl|harpic|lizol|garbage\s*bag|aluminium\s*foil|cling\s*wrap|tissue\s*paper|sanitary|diaper|insect\s*repellent|mosquito)\b/i.test(
      hay
    )
  ) {
    return true;
  }

  // Baby non-food (keep baby food/cereal edible)
  if (
    /\b(baby\s*wipes|diaper|nappy|baby\s*lotion|baby\s*shampoo)\b/i.test(hay)
  ) {
    return true;
  }

  return false;
}

/** Positive edible signals (small boost when present). */
export function hasEdibleSignal(haystack: string): boolean {
  return /\b(fresh|organic|farm|dairy|edible|food\s*grade|cooking|culinary|curry|masala|spice|atta|flour|rice|dal|pulse|vegetable|fruit|meat|seafood|frozen\s*food|ready\s*to\s*eat|beverage|drink|juice|milk|ghee|oil|butter|cheese|paneer|yoghurt|yogurt|curd|cream|pickle|sauce|chutney|basmati|wheat|sugar|salt|tea|coffee)\b/i.test(
    haystack
  );
}

/**
 * Extra search queries that bias Instamart toward edible catalog.
 * Returned queries are prepended for specific ambiguous ingredients.
 */
export function edibleBiasedQueries(ingredient: ParsedIngredient): string[] {
  const text =
    `${ingredient.original} ${ingredient.name} ${ingredient.searchQuery}`.toLowerCase();

  if (/\b(rose\s*water|gulab\s*jal|gulabjal)\b/.test(text)) {
    return [
      "edible rose water",
      "food grade rose water",
      "gulab jal edible",
      "rose water cooking",
    ];
  }

  if (/\bchicken\b/.test(text) && !/\bdog|cat|pet\b/.test(text)) {
    return ["chicken curry cut", "chicken fresh", "chicken boneless"];
  }

  if (/\b(cream|malai)\b/.test(text) && !/\bice\s*cream\b/.test(text)) {
    return ["amul fresh cream", "fresh cream", "cooking cream"];
  }

  if (/\b(oil)\b/.test(text) && !/\bhair|baby|massage|engine\b/.test(text)) {
    return ["cooking oil", "refined oil"];
  }

  if (/\b(water)\b/.test(text) && /\b(rose|kevra|kewra|screwpine)\b/.test(text)) {
    return ["edible rose water", "kewra water food"];
  }

  return [];
}
