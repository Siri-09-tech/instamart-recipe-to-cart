# MCP Integration — Swiggy Instamart (authoritative)

Docs: https://mcp.swiggy.com/builders/docs/reference/instamart/

## Real journey (MVP)

```
get_addresses → search_products → update_cart → get_cart
```

Checkout / track_order intentionally omitted from this MVP.

## Endpoint

`POST https://mcp.swiggy.com/im` with `Authorization: Bearer <access_token>`

JSON-RPC:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "search_products", "arguments": { "addressId": "...", "query": "..." } },
  "id": 1
}
```

## Auth

OAuth 2.1 + PKCE via Dynamic Client Registration (`POST /auth/register`).
See https://mcp.swiggy.com/builders/docs/start/authenticate.md

## Important

- Cart lines use `spinId` (variant), not a generic skuId
- `update_cart` **replaces** the entire cart
- Always resolve `addressId` from `get_addresses` before search
