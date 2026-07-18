# Recipe-to-Cart (Instamart)

Paste a recipe URL or ingredient list → match products on **Swiggy Instamart MCP** → fill your cart.

Built for [Swiggy Builders Club](https://mcp.swiggy.com/builders/docs/).

## MVP scope

- Swiggy OAuth 2.1 + PKCE (phone + OTP)
- Recipe parse **without** Claude (JSON-LD / heuristics / small dish bank)
- Instamart tools: `get_addresses` → `search_products` → `update_cart` → `get_cart`
- Cart review in-app; **checkout not included** yet

## Setup

```bash
npm install
cp .env.example .env.local
# set SESSION_SECRET (openssl rand -base64 32)
npm run dev
```

Open http://localhost:3000 → **Continue with Swiggy**.

## Recipe LLM (dish names)

Dish phrases like `chilli chicken for 10 medium eaters` need a local/free LLM:

1. **Ollama (recommended)** — install from https://ollama.com then:
   ```bash
   ollama pull llama3.2
   ```
2. Or set `GROQ_API_KEY` / `GEMINI_API_KEY` in `.env.local` (free tiers).

The UI shows **Required** (recipe qty) vs **Added** (Instamart packs) per ingredient.

- [Order groceries end-to-end](https://mcp.swiggy.com/builders/docs/build/recipes/order-groceries.md)
- [Authenticate](https://mcp.swiggy.com/builders/docs/start/authenticate.md)
- [Instamart reference](https://mcp.swiggy.com/builders/docs/reference/instamart/index.md)
