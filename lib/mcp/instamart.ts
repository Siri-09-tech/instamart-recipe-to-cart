import { callInstamartTool } from "./client";

export type SwiggyAddress = {
  id: string;
  label?: string;
  address?: string;
  addressLine?: string;
  locality?: string;
  city?: string;
  [key: string]: unknown;
};

export type ProductVariant = {
  spinId: string;
  quantity?: string | number;
  unit?: string;
  price?: number;
  mrp?: number;
  inStock?: boolean;
  [key: string]: unknown;
};

export type Product = {
  productId?: string;
  name?: string;
  displayName?: string;
  brand?: string;
  imageUrl?: string;
  imageid?: string;
  variants?: ProductVariant[];
  [key: string]: unknown;
};

export type CartItemInput = {
  spinId: string;
  quantity: number;
};

export type CartData = {
  items?: unknown[];
  bill?: unknown;
  availablePaymentMethods?: string[];
  [key: string]: unknown;
};

function pickId(obj: Record<string, unknown>): string {
  const candidates = [obj.id, obj.addressId, obj.address_id, obj.Id];
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c);
  }
  return "";
}

function normalizeAddress(raw: unknown): SwiggyAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = pickId(obj);
  if (!id) return null;
  return {
    ...obj,
    id,
    label: obj.label != null ? String(obj.label) : undefined,
    address:
      obj.address != null
        ? String(obj.address)
        : obj.addressLine != null
          ? String(obj.addressLine)
          : undefined,
    addressLine:
      obj.addressLine != null
        ? String(obj.addressLine)
        : obj.address != null
          ? String(obj.address)
          : undefined,
    locality: obj.locality != null ? String(obj.locality) : undefined,
    city: obj.city != null ? String(obj.city) : undefined,
  };
}

/** Deep-ish scan for address-looking arrays in MCP payloads */
export function asAddressList(data: unknown): SwiggyAddress[] {
  const out: SwiggyAddress[] = [];

  const pushAll = (arr: unknown[]) => {
    for (const item of arr) {
      const n = normalizeAddress(item);
      if (n) out.push(n);
    }
  };

  if (Array.isArray(data)) {
    pushAll(data);
    return out;
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of [
      "addresses",
      "addressList",
      "savedAddresses",
      "data",
      "items",
      "result",
    ]) {
      if (Array.isArray(obj[key])) pushAll(obj[key] as unknown[]);
    }
    // Nested { data: { addresses: [] } }
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
      const nested = obj.data as Record<string, unknown>;
      for (const key of ["addresses", "addressList", "savedAddresses", "items"]) {
        if (Array.isArray(nested[key])) pushAll(nested[key] as unknown[]);
      }
    }
  }

  // de-dupe by id
  const seen = new Set<string>();
  return out.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

function asProductList(data: unknown): Product[] {
  if (Array.isArray(data)) return data as Product[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.products)) return obj.products as Product[];
    if (Array.isArray(obj.data)) return obj.data as Product[];
  }
  return [];
}

export async function getAddresses(token: string): Promise<{
  addresses: SwiggyAddress[];
  raw: unknown;
}> {
  const data = await callInstamartTool<unknown>(token, "get_addresses", {});
  return { addresses: asAddressList(data), raw: data };
}

export async function searchProducts(
  token: string,
  addressId: string,
  query: string,
  offset = 0
): Promise<Product[]> {
  const data = await callInstamartTool<unknown>(token, "search_products", {
    addressId,
    query,
    offset,
  });
  return asProductList(data);
}

/** Replaces the entire Instamart cart with the provided items. */
export async function updateCart(
  token: string,
  selectedAddressId: string,
  items: CartItemInput[]
): Promise<unknown> {
  return callInstamartTool(token, "update_cart", {
    selectedAddressId,
    items,
  });
}

export async function getCart(token: string): Promise<CartData> {
  const data = await callInstamartTool<CartData>(token, "get_cart", {});
  return data ?? {};
}

export async function clearCart(token: string): Promise<unknown> {
  return callInstamartTool(token, "clear_cart", {});
}
