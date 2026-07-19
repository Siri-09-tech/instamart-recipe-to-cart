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
  skuId?: string;
  quantity?: string | number;
  unit?: string;
  price?: number;
  mrp?: number;
  inStock?: boolean;
  /** Max units the store will sell for this spin (when known) */
  availableQuantity?: number;
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
  skuId?: string;
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
  const pickSpinId = (obj: Record<string, unknown>): string => {
    for (const key of ["spinId", "spin_id", "spinID", "spin", "SpinId"]) {
      const val = obj[key];
      if (val != null && String(val).trim() && typeof val !== "object") {
        return String(val).trim();
      }
    }
    return "";
  };

  const pickSkuId = (obj: Record<string, unknown>): string => {
    for (const key of ["skuId", "sku_id", "skuID", "sku", "SkuId"]) {
      const val = obj[key];
      if (val != null && String(val).trim() && typeof val !== "object") {
        return String(val).trim();
      }
    }
    return "";
  };

  const normalizeVariant = (v: unknown): ProductVariant | null => {
    if (!v || typeof v !== "object") return null;
    const vo = v as Record<string, unknown>;
    const spinId = pickSpinId(vo);
    if (!spinId) return null;
    const skuId = pickSkuId(vo);

    const qty =
      vo.quantity ??
      vo.qty ??
      vo.packSize ??
      vo.unitQuantity ??
      vo.variation ??
      vo.quantityDescription ??
      vo.displayQuantity;
    const unit = vo.unit ?? vo.uom ?? vo.quantityUnit;
    const priceRaw =
      vo.price ?? vo.offerPrice ?? vo.finalPrice ?? vo.storePrice ?? vo.mrp;
    const price =
      typeof priceRaw === "number"
        ? priceRaw
        : typeof priceRaw === "string" && priceRaw.trim()
          ? Number(priceRaw)
          : undefined;

    const availableQuantity = pickAvailableQuantity(vo);

    return {
      ...vo,
      spinId,
      ...(skuId ? { skuId } : {}),
      quantity: qty as string | number | undefined,
      unit: unit != null ? String(unit) : undefined,
      price: Number.isFinite(price as number) ? (price as number) : undefined,
      inStock:
        typeof vo.inStock === "boolean"
          ? vo.inStock
          : typeof vo.isInStockAndAvailable === "boolean"
            ? vo.isInStockAndAvailable
            : undefined,
      ...(availableQuantity != null ? { availableQuantity } : {}),
    };
  };

  function pickAvailableQuantity(obj: Record<string, unknown>): number | undefined {
    // Only explicit orderable-qty fields. Never inventory/maxQuantity/pack size.
    for (const key of [
      "availableQuantity",
      "availableQty",
      "available_quantity",
      "maxAllowedQuantity",
      "max_allowed_quantity",
      "maxOrderableQuantity",
    ]) {
      const val = obj[key];
      const n =
        typeof val === "number"
          ? val
          : typeof val === "string" && val.trim()
            ? Number(val)
            : NaN;
      // Pack counts are small; 250/500 are pack sizes in g/ml — ignore those
      if (Number.isFinite(n) && n >= 0 && n <= 30) return Math.floor(n);
    }
    return undefined;
  }

  const normalize = (raw: unknown): Product | null => {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;
    const variantsRaw = [
      obj.variants,
      obj.skus,
      obj.variation,
      obj.variations,
      obj.productVariants,
      obj.spinVariants,
      obj.itemVariations,
    ].find(Array.isArray) as unknown[] | undefined;

    let variants = (variantsRaw || [])
      .map(normalizeVariant)
      .filter(Boolean) as ProductVariant[];

    // Product-level spinId fallback
    if (!variants.length) {
      const spinId = pickSpinId(obj);
      const skuId = pickSkuId(obj);
      if (spinId) {
        variants = [
          normalizeVariant({
            ...obj,
            spinId,
            ...(skuId ? { skuId } : {}),
          })!,
        ].filter(Boolean) as ProductVariant[];
      }
    }

    const name =
      obj.displayName ??
      obj.name ??
      obj.productName ??
      obj.title ??
      obj.itemName;

    return {
      ...obj,
      name: name != null ? String(name) : undefined,
      displayName: name != null ? String(name) : undefined,
      brand:
        obj.brand != null
          ? String(obj.brand)
          : obj.brandName != null
            ? String(obj.brandName)
            : undefined,
      imageUrl:
        obj.imageUrl != null
          ? String(obj.imageUrl)
          : obj.imageid != null
            ? String(obj.imageid)
            : obj.image != null
              ? String(obj.image)
              : undefined,
      variants,
    };
  };

  const collectArrays = (node: unknown, depth = 0): unknown[] => {
    if (depth > 4 || node == null) return [];
    if (Array.isArray(node)) {
      // Heuristic: array of product-like objects
      if (
        node.length &&
        typeof node[0] === "object" &&
        node[0] != null &&
        ("name" in (node[0] as object) ||
          "displayName" in (node[0] as object) ||
          "variants" in (node[0] as object) ||
          "brand" in (node[0] as object))
      ) {
        return node;
      }
      for (const item of node) {
        const found = collectArrays(item, depth + 1);
        if (found.length) return found;
      }
      return [];
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      for (const key of ["products", "items", "results", "data", "widgets"]) {
        if (key in obj) {
          const found = collectArrays(obj[key], depth + 1);
          if (found.length) return found;
        }
      }
      // last resort: scan all values
      for (const val of Object.values(obj)) {
        const found = collectArrays(val, depth + 1);
        if (found.length) return found;
      }
    }
    return [];
  };

  return collectArrays(data)
    .map(normalize)
    .filter(Boolean) as Product[];
}

/** Compact top-10 listing for the Next.js terminal (recipes + groceries). */
export function logSearchProductsTop10(
  query: string,
  products: Product[],
  meta?: { mode?: string; ingredient?: string }
): void {
  const top10 = products.slice(0, 10).map((p, i) => {
    const v0 = p.variants?.[0];
    return {
      rank: i + 1,
      name: String(p.displayName || p.name || "Product"),
      brand: p.brand ? String(p.brand) : undefined,
      spinId: v0?.spinId,
      skuId: v0?.skuId,
      pack: v0
        ? [v0.quantity, v0.unit].filter(Boolean).join(" ") || undefined
        : undefined,
      price: typeof v0?.price === "number" ? v0.price : undefined,
      variantCount: p.variants?.length ?? 0,
    };
  });

  const mode = meta?.mode ? ` mode=${meta.mode}` : "";
  const ing = meta?.ingredient ? ` ingredient="${meta.ingredient}"` : "";
  console.log(
    `\n========== search_products TOP 10${mode}${ing} query="${query}" total=${products.length} ==========`
  );
  console.log(JSON.stringify(top10, null, 2));
  if (products[0] && !(products[0].variants?.length)) {
    const rawKeys = Object.keys(products[0]).slice(0, 40);
    console.log(
      `[search_products] warn: no variants/spinId parsed. product keys: ${rawKeys.join(", ")}`
    );
  }
  console.log("========== end top 10 ==========\n");
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
  offset = 0,
  meta?: { mode?: string; ingredient?: string }
): Promise<Product[]> {
  const data = await callInstamartTool<unknown>(token, "search_products", {
    addressId,
    query,
    offset,
  });
  const products = asProductList(data);
  logSearchProductsTop10(query, products, meta);
  if (products.length > 0 && !(products[0].variants?.length)) {
    // Dump raw shape once so we can map spinId correctly
    const rawPreview = (() => {
      try {
        return JSON.stringify(data, null, 2).slice(0, 2500);
      } catch {
        return String(data);
      }
    })();
    console.log(
      `[search_products] raw payload preview (first 2500 chars):\n${rawPreview}`
    );
  }
  return products;
}

/** Replaces the entire Instamart cart with the provided items. */
export async function updateCart(
  token: string,
  selectedAddressId: string,
  items: CartItemInput[]
): Promise<unknown> {
  const normalized = items.map((item) => {
    const row: Record<string, unknown> = {
      spinId: item.spinId,
      quantity: item.quantity,
    };
    if (item.skuId) row.skuId = item.skuId;
    return row;
  });
  return callInstamartTool(token, "update_cart", {
    selectedAddressId,
    items: normalized,
  });
}

export async function getCart(token: string): Promise<CartData> {
  const data = await callInstamartTool<CartData>(token, "get_cart", {});
  return data ?? {};
}

export async function clearCart(token: string): Promise<unknown> {
  return callInstamartTool(token, "clear_cart", {});
}
