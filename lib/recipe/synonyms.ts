/** Regional / Hindi → Instamart-friendly search terms */
export const INGREDIENT_SYNONYMS: Record<
  string,
  { query: string; aliases?: string[]; avoid?: string[] }
> = {
  jeera: { query: "cumin seeds", avoid: ["powder"] },
  cumin: { query: "cumin seeds", avoid: ["powder"] },
  atta: { query: "whole wheat flour atta", avoid: ["maida"] },
  maida: { query: "maida all purpose flour", avoid: ["atta"] },
  besan: { query: "besan chickpea flour gram flour" },
  methi: { query: "fresh methi fenugreek leaves", avoid: ["kasuri", "powder"] },
  "kasuri methi": { query: "kasuri methi dried fenugreek" },
  dhania: { query: "coriander leaves fresh", avoid: ["powder", "seeds"] },
  coriander: { query: "coriander leaves fresh", avoid: ["powder"] },
  "coriander seeds": { query: "coriander seeds whole" },
  haldi: { query: "turmeric powder" },
  turmeric: { query: "turmeric powder" },
  hing: { query: "hing asafoetida" },
  imli: { query: "tamarind" },
  tamarind: { query: "tamarind" },
  sooji: { query: "sooji rava semolina" },
  rava: { query: "sooji rava semolina" },
  "chana dal": { query: "chana dal" },
  "toor dal": { query: "toor dal arhar dal" },
  "moong dal": { query: "moong dal" },
  paneer: { query: "paneer" },
  ghee: { query: "ghee" },
  dahi: { query: "curd dahi yogurt" },
  curd: { query: "curd dahi yogurt" },
  elaichi: { query: "green cardamom" },
  lavang: { query: "cloves" },
  dalchini: { query: "cinnamon sticks" },
  pudina: { query: "mint leaves fresh" },
  palak: { query: "palak spinach" },
  "ginger garlic paste": { query: "ginger garlic paste" },
  adrak: { query: "ginger fresh" },
  lehsun: { query: "garlic" },
  pyaz: { query: "onion" },
  onion: { query: "onion" },
  tomato: { query: "tomato" },
  tamatar: { query: "tomato" },
  mirchi: { query: "green chilli" },
  "green chilli": { query: "green chilli" },
  "red chilli powder": { query: "red chilli powder" },
  "garam masala": { query: "garam masala" },
  oil: { query: "cooking oil refined" },
  "mustard oil": { query: "mustard oil" },
  butter: { query: "butter" },
  milk: { query: "milk" },
  cream: { query: "fresh cream" },
  rice: { query: "basmati rice" },
  basmati: { query: "basmati rice" },
  sugar: { query: "sugar" },
  salt: { query: "salt iodised" },
  lemon: { query: "lemon" },
  potato: { query: "potato" },
  aloo: { query: "potato" },
};

export function normalizeIngredientName(raw: string): {
  name: string;
  query: string;
  avoid: string[];
} {
  const cleaned = raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // longest key match first
  const keys = Object.keys(INGREDIENT_SYNONYMS).sort(
    (a, b) => b.length - a.length
  );
  for (const key of keys) {
    if (cleaned === key || cleaned.includes(key)) {
      const syn = INGREDIENT_SYNONYMS[key];
      return {
        name: cleaned,
        query: syn.query,
        avoid: syn.avoid ?? [],
      };
    }
  }

  return { name: cleaned, query: cleaned, avoid: [] };
}
