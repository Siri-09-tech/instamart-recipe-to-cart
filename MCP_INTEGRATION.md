# MCP Integration Guide — Swiggy Instamart

This document details how Recipe-to-Cart integrates with Swiggy's Instamart MCP server.

## Overview

We use three MCP endpoints in a sequential pipeline:

```
searchProducts → checkAvailability → addItemsBulk
                        ↓ (on failure)
                  getSubstitutes → addItemsBulk (substitute)
```

## Catalog MCP

### `searchProducts(query, filters)`

Called once per extracted ingredient. Claude pre-normalises the query before calling this:

- `"jeera"` → `"cumin seeds"` with filter `{ form: "seeds", NOT: "powder" }`
- `"atta"` → `"wheat flour chapati"` with filter `{ type: "whole_wheat" }`
- `"fresh coriander"` → `"coriander leaves fresh"` with filter `{ form: "fresh", NOT: "dried" }`

### Response handling

We pick the top result unless:
- Price is >2× the second result (pick cheaper)
- Pack size is >3× the required quantity (pick smaller)
- Brand is blacklisted by user preferences

## Inventory MCP

### `checkAvailability(skuIds, pincode)`

Called in batch for all matched SKUs. Response includes `eta_minutes` — we surface this in the UI ("Arrives in 15 min").

### `getSubstitutes(skuId, strategy)`

Three strategies exposed in UI:
- `closest_match` — Claude ranks by flavour/function similarity (default)
- `cheapest` — price-optimised substitute
- `same_brand` — user prefers a specific brand

## Cart MCP

### `addItemsBulk(items)`

Single call for all ingredients. Partial success is handled — if 2 of 11 items fail, the other 9 are still added and failures are shown in the UI with retry options.

## Rate Limiting

Expected call pattern per user session:
- `searchProducts`: 8–15 calls (one per ingredient)
- `checkAvailability`: 1 batch call
- `addItemsBulk`: 1 call
- `getSubstitutes`: 0–3 calls (only on stock failures)

**Total per session: ~15–20 MCP calls**

At 1K daily active sessions: ~15K–20K MCP calls/day.
