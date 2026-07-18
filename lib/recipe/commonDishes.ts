/** Small offline dish bank so MVP works without a Claude API key */
export const COMMON_DISHES: Array<{
  name: string;
  displayName: string;
  aliases: string[];
  ingredients: string[];
}> = [
  {
    name: "palak paneer",
    displayName: "Palak Paneer",
    aliases: ["palakpaneer", "spinach paneer"],
    ingredients: [
      "200g paneer",
      "2 bunches palak",
      "1 onion",
      "2 tomato",
      "1 tbsp ginger garlic paste",
      "1 tsp jeera",
      "1 tsp garam masala",
      "0.5 tsp red chilli powder",
      "2 tbsp cream",
      "1 tbsp ghee",
      "salt",
    ],
  },
  {
    name: "masala dosa",
    displayName: "Masala Dosa",
    aliases: ["dosa"],
    ingredients: [
      "2 cups rice",
      "0.5 cup urad dal",
      "4 potato",
      "1 onion",
      "1 tsp mustard seeds",
      "10 curry leaves",
      "2 green chilli",
      "0.5 tsp turmeric powder",
      "oil",
      "salt",
    ],
  },
  {
    name: "dal tadka",
    displayName: "Dal Tadka",
    aliases: ["dal", "toor dal tadka"],
    ingredients: [
      "1 cup toor dal",
      "1 onion",
      "2 tomato",
      "1 tsp jeera",
      "0.5 tsp turmeric powder",
      "1 tsp red chilli powder",
      "2 green chilli",
      "1 tbsp ghee",
      "hing",
      "salt",
    ],
  },
  {
    name: "chicken curry",
    displayName: "Chicken Curry",
    aliases: ["murgh curry"],
    ingredients: [
      "500g chicken",
      "2 onion",
      "2 tomato",
      "1 tbsp ginger garlic paste",
      "1 tsp garam masala",
      "1 tsp red chilli powder",
      "0.5 tsp turmeric powder",
      "2 tbsp oil",
      "coriander leaves",
      "salt",
    ],
  },
  {
    name: "veg biryani",
    displayName: "Veg Biryani",
    aliases: ["vegetable biryani", "biryani"],
    ingredients: [
      "2 cups basmati rice",
      "1 cup mixed vegetables",
      "1 onion",
      "1 tomato",
      "1 tbsp ginger garlic paste",
      "1 tsp garam masala",
      "2 tbsp ghee",
      "mint leaves",
      "coriander leaves",
      "salt",
    ],
  },
];
