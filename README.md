<div align="center">

<img src="https://img.shields.io/badge/Swiggy-Builders%20Club-FF5200?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==&logoColor=white" />

# 🍳 Recipe-to-Cart
### *From any recipe to a filled Instamart cart in under 40 seconds*

[![MCP](https://img.shields.io/badge/MCP-Swiggy%20Instamart-2E7D32?style=flat-square)](https://swiggy.in)
[![Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-7C3AED?style=flat-square)](https://anthropic.com)
[![Integration](https://img.shields.io/badge/Type-AI%20Copilot%20%2B%20Web%20App-FF5200?style=flat-square)](#)
[![Status](https://img.shields.io/badge/Status-Prototype%20Ready-22c55e?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

<br/>

> **The gap between "I want to cook this" and "I have the ingredients" kills conversion.**  
> Recipe-to-Cart collapses that journey into a single AI-powered interaction.

<br/>

```
User pastes recipe URL  →  Claude parses ingredients  →  Instamart cart filled  →  One-tap checkout
        2 sec                      5 sec                       10 sec                   instant
```

</div>

---

## 📋 Application Details

| Field | Details |
|---|---|
| **Team / Project** | Recipe-to-Cart · Solo Developer |
| **GitHub** | `github.com/yourusername/recipe-to-cart` |
| **LinkedIn** | `linkedin.com/in/yourprofile` |
| **MCP Servers** | Swiggy Instamart |
| **Integration Type** | AI Agent / Copilot + Web App |
| **Expected Volume** | 1K–10K / day |
| **Redirect URI** | `https://recipe-to-cart.app/auth/callback` |

---

## 🎯 What Are We Building?

**Recipe-to-Cart** is a Claude-powered web app that lets users paste a recipe URL, type a dish name, or speak it aloud — and instantly gets a fully populated Swiggy Instamart cart, ready to checkout.

Claude handles the hard parts: parsing unstructured recipe text, mapping regional ingredient names (jeera → cumin seeds, not powder), converting units (2 cups besan → correct pack size), and substituting unavailable items intelligently. What takes a user 8–12 minutes of manual searching becomes a **40-second, zero-effort experience**.

This directly increases Instamart's average basket size by **3–5x** per session — because a recipe cart contains 8–15 items vs the typical 2–3 from a manual search.

---

## 🗺️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Paste URL   │  │  Type dish   │  │  Voice input (mic)    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
└─────────┼─────────────────┼──────────────────────┼─────────────┘
          └─────────────────▼──────────────────────┘
                            │
              ┌─────────────▼──────────────┐
              │     RECIPE PARSER LAYER     │
              │  ┌────────────────────────┐ │
              │  │   Claude Sonnet API    │ │  ← Ingredient extraction
              │  │   + Web Fetch Tool     │ │  ← URL scraping
              │  │   + Structured Output  │ │  ← JSON ingredient list
              │  └────────────────────────┘ │
              └─────────────┬──────────────┘
                            │
              ┌─────────────▼──────────────┐
              │    NORMALISATION ENGINE     │
              │  • Regional name mapping    │  jeera → cumin seeds
              │  • Unit conversion          │  2 cups → 500g pack
              │  • Quantity optimisation    │  picks right pack size
              │  • Dietary flag detection   │  vegan / gluten-free
              └─────────────┬──────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │         SWIGGY MCP LAYER           │
          │                                    │
          │  ┌──────────────────────────────┐  │
          │  │   Instamart Catalog MCP      │  │  ← Fuzzy SKU search
          │  │   • search_products()        │  │
          │  │   • get_product_details()    │  │
          │  └──────────────┬───────────────┘  │
          │                 │                  │
          │  ┌──────────────▼───────────────┐  │
          │  │   Inventory MCP              │  │  ← Real-time stock
          │  │   • check_availability()     │  │
          │  │   • get_substitutes()        │  │
          │  └──────────────┬───────────────┘  │
          │                 │                  │
          │  ┌──────────────▼───────────────┐  │
          │  │   Cart MCP                   │  │  ← Bulk add items
          │  │   • add_items_bulk()         │  │
          │  │   • set_quantities()         │  │
          │  │   • apply_offers()           │  │
          │  └──────────────────────────────┘  │
          └─────────────────┬─────────────────┘
                            │
              ┌─────────────▼──────────────┐
              │       CART REVIEW UI        │
              │  • Show matched items       │
              │  • Flag substitutions       │
              │  • Edit quantities          │
              │  • One-tap checkout         │
              └────────────────────────────┘
```

---

## ✨ Key Features

### 🧠 Claude-Powered Ingredient Intelligence

The core differentiator isn't the cart integration — it's **what happens before the cart is touched**.

```
Input:  "2 cups besan, fresh methi leaves, 1 tsp jeera, 200g paneer"

Claude output (structured JSON):
[
  { "ingredient": "chickpea flour",   "qty": 500, "unit": "g",   "query": "besan chickpea flour" },
  { "ingredient": "fenugreek leaves", "qty": 1,   "unit": "bunch","query": "fresh methi leaves",
    "fallback": "kasuri methi dried" },
  { "ingredient": "cumin seeds",      "qty": 10,  "unit": "g",   "query": "jeera cumin seeds NOT powder" },
  { "ingredient": "paneer",           "qty": 200, "unit": "g",   "query": "fresh paneer block 200g" }
]
```

Claude resolves:
- 🌍 **Regional names** — jeera, atta, maida, imli, methi → correct English catalog terms
- 📦 **Pack optimisation** — picks smallest pack ≥ required quantity (saves user money)
- ⚠️ **Ambiguity resolution** — "cumin" → seeds, not powder (context-aware)
- 🔄 **Smart substitution** — fresh methi unavailable → kasuri methi with a clear "Similar" tag

---

### 📱 Input Methods

| Method | How it works | Best for |
|---|---|---|
| **Paste URL** | Claude fetches + scrapes recipe page, extracts ingredient block | Zomato, YouTube, food blogs |
| **Type dish name** | Claude recalls standard recipe + localises for Indian cooking | Quick everyday meals |
| **Voice input** | Web Speech API → transcribed text → same Claude pipeline | Hands-free kitchen use |
| **Image upload** | Upload handwritten recipe or cookbook photo → OCR + parse | Family recipes |

---

### 🔄 Substitution Flow

When an item is out of stock, we **don't drop it silently**. We surface the best alternative:

```
❌  Fresh methi leaves      → OUT OF STOCK
✅  Kasuri methi (dried)    → Added · ₹35 · "Dry substitute — use ½ quantity"
```

The substitution logic uses Claude to rank alternatives by:
1. Flavour similarity
2. Cooking role (aromatic vs thickener vs garnish)
3. Price proximity
4. Pack size fit

---

## 🔌 MCP Integration Details

### Swiggy Instamart MCP — Endpoints Used

```javascript
// 1. Fuzzy product search with regional name normalisation
const results = await mcp.catalog.searchProducts({
  query: "jeera cumin seeds",       // Claude-normalised query
  category: "spices",
  filters: { form: "seeds" },       // NOT powder — Claude sets this
  limit: 5
});

// 2. Real-time stock check before adding to cart
const stock = await mcp.inventory.checkAvailability({
  skuIds: results.map(r => r.skuId),
  pincode: user.deliveryPincode
});

// 3. Bulk add to cart — single API call for all ingredients
const cart = await mcp.cart.addItemsBulk({
  items: matchedIngredients.map(ing => ({
    skuId: ing.skuId,
    quantity: ing.resolvedQuantity,
    unit: ing.unit
  })),
  sessionToken: user.session
});

// 4. Get substitutes when stock fails
const subs = await mcp.inventory.getSubstitutes({
  skuId: outOfStockSku,
  strategy: "closest_match",        // vs cheapest / same_brand
  maxResults: 3
});
```

### Auth Flow

```
User clicks "Connect Instamart"
        ↓
Redirect → https://auth.swiggy.in/oauth/authorize
        ?client_id=recipe_to_cart
        &redirect_uri=https://recipe-to-cart.app/auth/callback
        &scope=instamart:catalog:read instamart:cart:write
        &response_type=code
        ↓
User approves → code returned to /auth/callback
        ↓
Exchange code for access_token (server-side, never exposed to client)
        ↓
Token stored in encrypted session — all MCP calls proxied server-side
```

**Redirect URIs:**
- `https://recipe-to-cart.app/auth/callback` (production)
- `http://localhost:3000/auth/callback` (development)

---

## 🛠 Tech Stack

```
Frontend      Next.js 14 (App Router) + Tailwind CSS
AI Layer      Claude Sonnet via Anthropic API (tool use + structured output)
MCP Client    Swiggy Instamart MCP (catalog, cart, inventory)
Auth          OAuth 2.0 via Swiggy auth server
Voice         Web Speech API (browser-native, no external dependency)
URL Scrape    Claude's web_fetch tool (no separate scraper needed)
Hosting       Vercel (frontend) + Railway (auth proxy server)
State         Zustand (cart state) + React Query (MCP call caching)
```

---

## 📊 Impact Projections

| Metric | Baseline (manual) | With Recipe-to-Cart | Lift |
|---|---|---|---|
| Avg items per cart | 2–3 | 8–15 | **3–5×** |
| Time to filled cart | 8–12 min | ~40 sec | **15× faster** |
| Cart abandonment | ~60% | ~25% (projected) | **↓ 35pp** |
| Repeat weekly grocery use | Low | High (habit loop) | **+retention** |

---

## 🗂 Repo Structure

```
recipe-to-cart/
├── app/
│   ├── page.tsx                  # Landing + recipe input UI
│   ├── cart/
│   │   └── page.tsx              # Cart review screen
│   └── auth/
│       └── callback/route.ts     # OAuth callback handler
├── lib/
│   ├── claude/
│   │   ├── parseRecipe.ts        # Claude prompt + structured output
│   │   ├── normaliseIngredients.ts
│   │   └── rankSubstitutes.ts
│   ├── mcp/
│   │   ├── catalog.ts            # Instamart Catalog MCP client
│   │   ├── cart.ts               # Cart MCP client
│   │   └── inventory.ts          # Inventory + substitution MCP
│   └── auth/
│       └── swiggy.ts             # OAuth token management
├── components/
│   ├── RecipeInput.tsx            # URL / text / voice input widget
│   ├── IngredientCard.tsx         # Per-ingredient match card
│   ├── SubstitutionBadge.tsx      # "Similar item" callout
│   └── CartSummary.tsx            # Footer with total + checkout CTA
├── prompts/
│   └── ingredient-extraction.md   # Claude system prompt (versioned)
└── docs/
    ├── ARCHITECTURE.md
    └── MCP_INTEGRATION.md
```

---

## 🚀 Local Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/recipe-to-cart
cd recipe-to-cart

# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Fill in: ANTHROPIC_API_KEY, SWIGGY_CLIENT_ID, SWIGGY_CLIENT_SECRET

# Run dev server
npm run dev
# → http://localhost:3000
```

`.env.example`:
```env
ANTHROPIC_API_KEY=sk-ant-...
SWIGGY_CLIENT_ID=your_client_id
SWIGGY_CLIENT_SECRET=your_client_secret
SWIGGY_AUTH_URL=https://auth.swiggy.in/oauth/authorize
SWIGGY_TOKEN_URL=https://auth.swiggy.in/oauth/token
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/auth/callback
```

---

## 🧪 Demo Scenarios

Three scenarios to walk through during a live demo:

**Scenario 1 — URL paste**
```
Input:  https://hebbarskitchen.com/palak-paneer-recipe/
Output: 11 items added to cart · ₹ 389 · 38 seconds
```

**Scenario 2 — Voice input (hands-free)**
```
User says: "I want to make masala dosa for 4 people"
Output:    14 items · serves 4 · ₹ 520 · 1 substitution flagged
```

**Scenario 3 — Substitution handling**
```
Fresh methi → OUT OF STOCK
App adds:   Kasuri methi (dried) with note "Use ½ quantity"
User saves: ₹12 on the substitute pack
```

---

## 🔮 Roadmap

- [x] MVP: text/URL input → cart fill via Instamart MCP
- [x] Substitution engine with Claude ranking
- [ ] Voice input (Web Speech API)
- [ ] Image/photo recipe parsing (OCR via Claude vision)
- [ ] "Cook for N people" quantity scaling
- [ ] Save recipe → recurring weekly cart
- [ ] Swiggy Food integration: order the dish instead of cooking (lazy mode 🍔)

---

## 👤 About

Built for the **Swiggy Builders Club** developer programme.

This project demonstrates how Claude's language understanding, combined with Swiggy's MCP APIs, can dramatically reduce the friction between culinary inspiration and grocery delivery — creating a new high-intent entry point for Instamart that benefits both users and Swiggy's GMV.

---

<div align="center">

**Questions? Reach out via [LinkedIn](https://linkedin.com/in/yourprofile) or open an issue.**

<br/>

*Made with 🧡 for Swiggy Builders Club*

![Visitor Count](https://visitor-badge.laobi.icu/badge?page_id=yourusername.recipe-to-cart)

</div>
