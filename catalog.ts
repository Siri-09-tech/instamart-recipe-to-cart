// lib/mcp/catalog.ts
// Swiggy Instamart Catalog MCP client

export interface ProductSearchResult {
  skuId: string;
  name: string;
  brand: string;
  packSize: string;
  price: number;
  unit: string;
  imageUrl: string;
  category: string;
  inStock: boolean;
}

export interface CartItem {
  skuId: string;
  quantity: number;
  unit: string;
}

export interface SubstituteResult {
  skuId: string;
  name: string;
  brand: string;
  price: number;
  similarityScore: number;
  usageNote: string;
}

// Catalog MCP — fuzzy product search with filter support
export async function searchProducts(
  query: string,
  filters: Record<string, string | string[]> = {},
  pincode: string,
  accessToken: string
): Promise<ProductSearchResult[]> {
  const res = await fetch("/api/mcp/catalog/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, filters, pincode, limit: 5 }),
  });
  if (!res.ok) throw new Error(`Catalog MCP error: ${res.status}`);
  return res.json();
}

// Inventory MCP — batch availability check
export async function checkAvailability(
  skuIds: string[],
  pincode: string,
  accessToken: string
): Promise<Record<string, { available: boolean; eta_minutes: number }>> {
  const res = await fetch("/api/mcp/inventory/availability", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ skuIds, pincode }),
  });
  if (!res.ok) throw new Error(`Inventory MCP error: ${res.status}`);
  return res.json();
}

// Substitution MCP — get alternatives for out-of-stock items
export async function getSubstitutes(
  skuId: string,
  strategy: "closest_match" | "cheapest" | "same_brand" = "closest_match",
  accessToken: string
): Promise<SubstituteResult[]> {
  const res = await fetch(`/api/mcp/inventory/substitutes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ skuId, strategy, maxResults: 3 }),
  });
  if (!res.ok) throw new Error(`Substitution MCP error: ${res.status}`);
  return res.json();
}

// Cart MCP — bulk add all ingredients in one call
export async function addItemsBulk(
  items: CartItem[],
  sessionToken: string,
  accessToken: string
): Promise<{ success: string[]; failed: string[]; cartId: string }> {
  const res = await fetch("/api/mcp/cart/bulk-add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ items, sessionToken }),
  });
  if (!res.ok) throw new Error(`Cart MCP error: ${res.status}`);
  return res.json();
}
