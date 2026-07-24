/** Regional / Hindi → Instamart-friendly search terms + match aliases */

export type IngredientSynonym = {
  /** Primary Instamart search query */
  query: string;
  /** Extra tokens/queries that may appear on product titles (Hindi, aliases) */
  aliases?: string[];
  avoid?: string[];
};

export const INGREDIENT_SYNONYMS: Record<string, IngredientSynonym> = {
  jeera: {
    query: "jeera cumin seeds",
    aliases: ["jeera", "cumin", "जीरा", "जीरे"],
    avoid: ["powder", "पाउडर"],
  },
  cumin: {
    query: "jeera cumin seeds",
    aliases: ["jeera", "cumin", "जीरा"],
    avoid: ["powder"],
  },
  "cumin seeds": {
    query: "jeera cumin seeds",
    aliases: ["jeera", "cumin seeds", "जीरा"],
    avoid: ["powder"],
  },
  "cumin powder": {
    query: "jeera powder cumin powder",
    aliases: ["jeera powder", "cumin powder", "जीरा पाउडर"],
  },
  atta: {
    query: "atta whole wheat flour",
    aliases: ["atta", "wheat flour", "आटा"],
    avoid: ["maida"],
  },
  maida: {
    query: "maida all purpose flour",
    aliases: ["maida", "मैदा"],
    avoid: ["atta"],
  },
  besan: {
    query: "besan chickpea flour gram flour",
    aliases: ["besan", "gram flour", "chickpea flour", "बेसन"],
  },
  methi: {
    query: "fresh methi fenugreek leaves",
    aliases: ["methi", "fenugreek", "मेथी"],
    avoid: ["kasuri", "powder"],
  },
  "kasuri methi": {
    query: "kasuri methi dried fenugreek",
    aliases: ["kasuri methi", "कसूरी मेथी"],
  },
  dhania: {
    query: "coriander leaves fresh dhania",
    aliases: ["dhania", "coriander", "cilantro", "धनिया"],
    avoid: ["powder", "seeds"],
  },
  coriander: {
    query: "coriander leaves fresh dhania",
    aliases: ["dhania", "coriander", "धनिया"],
    avoid: ["powder", "seeds"],
  },
  "coriander seeds": {
    query: "coriander seeds whole dhania",
    aliases: ["coriander seeds", "dhania sabut"],
  },
  "coriander powder": {
    query: "coriander powder dhania powder",
    aliases: ["dhania powder", "coriander powder"],
  },
  haldi: {
    query: "haldi turmeric powder",
    aliases: ["haldi", "turmeric", "हल्दी"],
  },
  turmeric: {
    query: "haldi turmeric powder",
    aliases: ["haldi", "turmeric", "हल्दी"],
  },
  hing: {
    query: "hing asafoetida",
    aliases: ["hing", "asafoetida", "हींग"],
  },
  imli: { query: "imli tamarind", aliases: ["imli", "tamarind", "इमली"] },
  tamarind: { query: "imli tamarind", aliases: ["imli", "tamarind", "इमली"] },
  sooji: {
    query: "sooji rava semolina",
    aliases: ["sooji", "rava", "semolina", "सूजी"],
  },
  rava: {
    query: "sooji rava semolina",
    aliases: ["sooji", "rava", "semolina", "सूजी"],
  },
  "chana dal": {
    query: "chana dal",
    aliases: ["chana dal", "bengal gram", "चना दाल"],
  },
  "toor dal": {
    query: "toor dal arhar dal",
    aliases: ["toor dal", "arhar", "तुअर", "अरहर"],
  },
  "moong dal": {
    query: "moong dal",
    aliases: ["moong dal", "मूंग दाल"],
  },
  paneer: {
    query: "paneer",
    aliases: ["paneer", "cottage cheese", "पनीर"],
    avoid: ["tofu"],
  },
  "cottage cheese": {
    query: "paneer",
    aliases: ["paneer", "cottage cheese", "पनीर"],
  },
  ghee: {
    query: "ghee",
    aliases: ["ghee", "घी"],
    avoid: ["butter", "vanaspati"],
  },
  dahi: {
    query: "curd dahi yogurt",
    aliases: ["dahi", "curd", "yogurt", "दही"],
  },
  curd: {
    query: "curd dahi yogurt",
    aliases: ["dahi", "curd", "yogurt", "दही"],
  },
  yogurt: {
    query: "curd dahi yogurt",
    aliases: ["dahi", "curd", "yogurt", "दही"],
  },
  elaichi: {
    query: "green cardamom elaichi",
    aliases: ["elaichi", "cardamom", "इलायची"],
  },
  cardamom: {
    query: "green cardamom elaichi",
    aliases: ["elaichi", "cardamom", "इलायची"],
  },
  lavang: { query: "cloves lavang", aliases: ["cloves", "lavang", "लौंग"] },
  cloves: { query: "cloves lavang", aliases: ["cloves", "lavang", "लौंग"] },
  dalchini: {
    query: "cinnamon sticks dalchini",
    aliases: ["cinnamon", "dalchini", "दालचीनी"],
  },
  cinnamon: {
    query: "cinnamon sticks dalchini",
    aliases: ["cinnamon", "dalchini", "दालचीनी"],
  },
  pudina: {
    query: "mint leaves fresh pudina",
    aliases: ["pudina", "mint", "पुदीना"],
  },
  mint: {
    query: "mint leaves fresh pudina",
    aliases: ["pudina", "mint", "पुदीना"],
  },
  palak: {
    query: "palak spinach",
    aliases: ["palak", "spinach", "पालक"],
  },
  spinach: {
    query: "palak spinach",
    aliases: ["palak", "spinach", "पालक"],
  },
  "ginger garlic paste": {
    query: "ginger garlic paste",
    aliases: ["ginger garlic paste"],
  },
  adrak: {
    query: "ginger fresh adrak",
    aliases: ["ginger", "adrak", "अदरक"],
  },
  ginger: {
    query: "ginger fresh adrak",
    aliases: ["ginger", "adrak", "अदरक"],
  },
  lehsun: {
    query: "garlic lehsun",
    aliases: ["garlic", "lehsun", "lahsun", "लहसुन"],
  },
  garlic: {
    query: "garlic lehsun",
    aliases: ["garlic", "lehsun", "lahsun", "लहसुन"],
  },
  pyaz: { query: "onion pyaz", aliases: ["onion", "pyaz", "प्याज"] },
  onion: { query: "onion pyaz", aliases: ["onion", "pyaz", "प्याज"] },
  tomato: {
    query: "tomato",
    aliases: ["tomato", "tamatar", "टमाटर"],
  },
  tamatar: {
    query: "tomato",
    aliases: ["tomato", "tamatar", "टमाटर"],
  },
  mirchi: {
    query: "green chilli",
    aliases: ["green chilli", "green chili", "hari mirch", "मिर्च"],
  },
  "green chilli": {
    query: "green chilli",
    aliases: ["green chilli", "green chili", "hari mirch"],
  },
  "green chili": {
    query: "green chilli",
    aliases: ["green chilli", "green chili", "hari mirch"],
  },
  "red chilli powder": {
    query: "red chilli powder lal mirch",
    aliases: ["red chilli", "lal mirch", "लाल मिर्च"],
  },
  "garam masala": {
    query: "garam masala",
    aliases: ["garam masala", "गरम मसाला"],
  },
  oil: {
    query: "cooking oil refined 1 litre",
    aliases: ["sunflower oil", "refined oil", "cooking oil"],
    avoid: [
      "mustard",
      "coconut",
      "olive",
      "sesame",
      "combo",
      "gift",
      "hamper",
      "bundle",
      "x 3",
      "x3",
      "pack of 3",
      "pack of 4",
    ],
  },
  "mustard oil": {
    query: "mustard oil",
    aliases: ["mustard oil", "sarson"],
    avoid: ["combo", "gift", "hamper", "x 3", "pack of 3"],
  },
  butter: {
    query: "butter",
    aliases: ["butter", "makhan", "मक्खन"],
    avoid: ["ghee"],
  },
  milk: { query: "milk", aliases: ["milk", "doodh", "दूध"] },
  cream: {
    query: "amul fresh cream",
    aliases: ["fresh cream", "cooking cream", "dairy cream", "malai", "टेबल क्रीम"],
    avoid: [
      "biscuit",
      "cracker",
      "tube",
      "ointment",
      "picon",
      "elocon",
      "tenovate",
      "pacroma",
      "impoyz",
      "moisturizer",
      "moisturiser",
      "face cream",
      "body cream",
      "hand cream",
      "sunscreen",
      "acne",
      "pimple",
      "hydrocortisone",
      "dermat",
      "skin cream",
      "cold cream",
    ],
  },
  "fresh cream": {
    query: "amul fresh cream",
    aliases: ["fresh cream", "cooking cream", "malai"],
    avoid: [
      "biscuit",
      "tube",
      "ointment",
      "picon",
      "moisturizer",
      "face cream",
      "body cream",
      "sunscreen",
      "acne",
    ],
  },
  "cooking cream": {
    query: "cooking cream",
    aliases: ["fresh cream", "cooking cream", "amul cream"],
    avoid: ["tube", "ointment", "moisturizer", "face cream", "biscuit"],
  },
  malai: {
    query: "fresh cream",
    aliases: ["malai", "fresh cream"],
    avoid: ["tube", "ointment", "moisturizer", "biscuit"],
  },
  "ice cream": {
    query: "ice cream",
    aliases: ["ice cream", "icecream"],
  },
  icecream: {
    query: "ice cream",
    aliases: ["ice cream", "icecream"],
  },
  butterscotch: {
    query: "butterscotch ice cream",
    aliases: ["butterscotch", "ice cream"],
  },
  rice: {
    query: "basmati rice 1 kg",
    aliases: ["basmati", "rice", "चावल"],
    avoid: [
      "licious",
      "freshtohome",
      "combo",
      "gift",
      "hamper",
      "chicken",
      "mutton",
      "biryani combo",
      "meal kit",
    ],
  },
  basmati: {
    query: "basmati rice 1 kg",
    aliases: ["basmati", "rice"],
    avoid: [
      "licious",
      "freshtohome",
      "combo",
      "gift",
      "hamper",
      "chicken",
      "mutton",
    ],
  },
  sugar: { query: "sugar", aliases: ["sugar", "chini", "चीनी"] },
  salt: {
    query: "salt iodised",
    aliases: ["salt", "namak", "नमक"],
  },
  lemon: { query: "lemon", aliases: ["lemon", "nimbu", "नींबू"] },
  potato: {
    query: "potato",
    aliases: ["potato", "aloo", "आलू"],
  },
  aloo: {
    query: "potato",
    aliases: ["potato", "aloo", "आलू"],
  },
  chicken: {
    query: "chicken curry cut",
    aliases: ["chicken", "murgh", "chicken fresh"],
    avoid: [
      "nuggets",
      "keema",
      "sausage",
      "salami",
      "dog",
      "cat",
      "pet",
      "puppy",
      "kitten",
      "pedigree",
      "whiskas",
      "treat",
    ],
  },
  "rose water": {
    query: "edible rose water",
    aliases: ["gulab jal", "gulabjal", "rose water food"],
    avoid: ["face", "facial", "skin", "toner", "mist", "spray", "beauty", "skincare"],
  },
  gulabjal: {
    query: "edible rose water gulab jal",
    aliases: ["gulab jal", "rose water"],
    avoid: ["face", "facial", "toner", "mist", "skin"],
  },
  "gulab jal": {
    query: "edible rose water gulab jal",
    aliases: ["gulab jal", "rose water"],
    avoid: ["face", "facial", "toner", "mist", "skin"],
  },
  drumstick: {
    query: "drumstick",
    aliases: [
      "drumstick",
      "drumsticks",
      "moringa",
      "nuggekaayi",
      "nuggekai",
      "sahjan",
      "सेहजन",
    ],
    avoid: ["chicken drumstick", "chicken leg"],
  },
  drumsticks: {
    query: "drumstick",
    aliases: [
      "drumstick",
      "drumsticks",
      "moringa",
      "nuggekaayi",
      "nuggekai",
    ],
    avoid: ["chicken drumstick", "chicken leg"],
  },
  moringa: {
    query: "drumstick moringa",
    aliases: ["drumstick", "moringa", "nuggekaayi"],
  },
  nuggekaayi: {
    query: "drumstick nuggekaayi",
    aliases: ["drumstick", "nuggekaayi", "moringa"],
  },
};

export type NormalizedIngredient = {
  name: string;
  query: string;
  /** All strings to try with search_products / score against titles */
  searchQueries: string[];
  /** Tokens that boost match score when found in product name */
  matchTokens: string[];
  avoid: string[];
};

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function latinSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prefer exact / whole-phrase match so "cream" does not steal "ice cream". */
function candidateMatchesKey(candidate: string, key: string): boolean {
  if (candidate === key) return true;
  const re = new RegExp(`(?:^|\\s)${escapeRegExp(key)}(?:\\s|$)`, "i");
  return re.test(candidate);
}

export function normalizeIngredientName(
  raw: string,
  opts?: { englishHint?: string }
): NormalizedIngredient {
  const cleaned = latinSlug(raw);
  const hint = opts?.englishHint ? latinSlug(opts.englishHint) : "";
  const candidates = [cleaned, hint].filter(Boolean);

  const keys = Object.keys(INGREDIENT_SYNONYMS).sort(
    (a, b) => b.length - a.length
  );

  for (const candidate of candidates) {
    for (const key of keys) {
      if (candidateMatchesKey(candidate, key)) {
        const syn = INGREDIENT_SYNONYMS[key];
        const aliases = syn.aliases ?? [];
        return {
          name: candidate || cleaned || hint || raw.trim().toLowerCase(),
          query: syn.query,
          searchQueries: uniqueStrings([syn.query, ...aliases, candidate]),
          matchTokens: uniqueStrings([
            ...syn.query.split(/\s+/),
            ...aliases,
            ...candidate.split(/\s+/),
          ]),
          avoid: syn.avoid ?? [],
        };
      }
    }
  }

  const fallbackName = cleaned || hint || raw.trim().toLowerCase();
  // Strip trailing pack sizes from grocery strings for cleaner Instamart search
  const query = fallbackName
    .replace(
      /\b\d+(?:\.\d+)?\s*(gm|gms|grams?|kg|g|ml|mls|l|lt|cup|cups|tsp|tbsp|pc|pcs|tub|pack|packet)s?\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim() || fallbackName;

  return {
    name: fallbackName,
    query,
    searchQueries: uniqueStrings([query, cleaned, hint]),
    matchTokens: uniqueStrings(query.split(/\s+/).filter((t) => t.length > 1)),
    avoid: [],
  };
}
