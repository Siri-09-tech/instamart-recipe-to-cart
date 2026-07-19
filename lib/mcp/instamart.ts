import { callInstamartTool, withInstamartSession } from "./client";

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
  /** Optional display name â€” used to re-search for a fresh spin before cart write */
  name?: string;
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
      // Pack counts are small; 250/500 are pack sizes in g/ml â€” ignore those
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


function clampQty(n: number): number {
  return Math.max(1, Math.min(20, Math.floor(n) || 1));
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isCartStockError(err: unknown): boolean {
  return /out of stock|ITEM_OUT_OF_STOCK|partially available|all items .* unavailable|CART_EXPIRED/i.test(
    errMsg(err)
  );
}

function cartAddressId(cart: CartData | null | undefined): string {
  if (!cart || typeof cart !== "object") return "";
  const c = cart as Record<string, unknown>;
  for (const key of [
    "selectedAddress",
    "selectedAddressId",
    "addressId",
    "address_id",
  ]) {
    const val = c[key];
    if (val != null && typeof val !== "object" && String(val).trim()) {
      return String(val).trim();
    }
    if (val && typeof val === "object" && "id" in (val as object)) {
      const id = (val as Record<string, unknown>).id;
      if (id != null && String(id).trim()) return String(id).trim();
    }
  }
  const details = c.selectedAddressDetails;
  if (details && typeof details === "object") {
    const id = (details as Record<string, unknown>).id;
    if (id != null && String(id).trim()) return String(id).trim();
  }
  return "";
}

function cartHasOosItems(cart: CartData | null | undefined): boolean {
  const items = Array.isArray(cart?.items) ? cart!.items! : [];
  return items.some(
    (it) =>
      it &&
      typeof it === "object" &&
      (it as Record<string, unknown>).isInStockAndAvailable === false
  );
}

type CartLineIds = {
  spinId: string;
  skuId: string;
  quantity: number;
  name?: string;
};

/** MCP requires both spinId and skuId on every update_cart line. */
function toCartLine(
  spinId: string,
  skuId: string,
  quantity: number,
  name?: string
): CartLineIds | null {
  const s = String(spinId || "").trim();
  const k = String(skuId || "").trim();
  if (!s || !k) return null;
  return { spinId: s, skuId: k, quantity: clampQty(quantity), name };
}

function collectCandidatesFromProducts(
  products: Product[],
  quantity: number,
  preferred?: { spinId?: string; skuId?: string }
): CartLineIds[] {
  const out: CartLineIds[] = [];
  const seen = new Set<string>();

  const push = (spinId: string, skuId: string, name?: string) => {
    const line = toCartLine(spinId, skuId, quantity, name);
    if (!line) return;
    const key = `${line.spinId}::${line.skuId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(line);
  };

  if (preferred?.spinId && preferred?.skuId) {
    push(preferred.spinId, preferred.skuId);
  }

  for (const p of products) {
    const name = String(p.displayName || p.name || "");
    for (const v of p.variants || []) {
      if (v.spinId && v.skuId) {
        push(v.spinId, v.skuId, name);
        // Some payloads invert the two fields
        push(v.skuId, v.spinId, name);
      }
    }
  }

  return out;
}

/** Low-level update_cart. Prefer replaceCart() for app flows. */
export async function updateCart(
  token: string,
  selectedAddressId: string,
  items: CartItemInput[]
): Promise<unknown> {
  const normalized = items.map((item) => {
    if (!item.skuId) {
      throw new Error(
        `Missing skuId for spinId=${item.spinId}. Both spinId and skuId are required.`
      );
    }
    return {
      spinId: item.spinId,
      skuId: item.skuId,
      quantity: clampQty(item.quantity),
    };
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

/**
 * Safely read cart. Stock/partial errors on get_cart mean a ghost cart —
 * clear once and treat as empty so fill can proceed.
 */
export async function getCartSafe(token: string): Promise<{
  cart: CartData;
  clearedStale: boolean;
}> {
  try {
    return { cart: await getCart(token), clearedStale: false };
  } catch (err) {
    if (!isCartStockError(err)) throw err;
    console.log("[get_cart] stock/partial error — clearing:", errMsg(err));
    await clearCart(token).catch((e) =>
      console.log("[get_cart] clear failed:", errMsg(e))
    );
    try {
      return { cart: await getCart(token), clearedStale: true };
    } catch (retryErr) {
      console.log(
        "[get_cart] still failing after clear; empty fallback:",
        errMsg(retryErr)
      );
      return { cart: { items: [] }, clearedStale: true };
    }
  }
}

async function updateCartLines(
  call: <T>(name: string, args?: Record<string, unknown>) => Promise<T>,
  selectedAddressId: string,
  lines: CartLineIds[],
  label: string
): Promise<unknown> {
  const payload = lines.map((l) => ({
    spinId: l.spinId,
    skuId: l.skuId,
    quantity: l.quantity,
  }));
  console.log(
    `[replace_cart] try=${label} items=${JSON.stringify(payload)}`
  );
  const result = await call<unknown>("update_cart", {
    selectedAddressId,
    items: payload,
  });
  console.log(`[replace_cart] SUCCESS via ${label}`);
  return result;
}

/**
 * Replace Instamart cart in one MCP session.
 *
 * Live MCP contract: every item needs BOTH spinId and skuId.
 * Search can still return spins that fail as OOS on update_cart — walk
 * the next search candidates (and spin/sku swapped) until one sticks.
 */
export async function replaceCart(
  token: string,
  selectedAddressId: string,
  items: CartItemInput[]
): Promise<unknown> {
  if (!items.length) throw new Error("No items to add to cart.");

  return withInstamartSession(token, async (call) => {
    let cart: CartData = { items: [] };
    try {
      cart = (await call<CartData>("get_cart", {})) ?? {};
    } catch (err) {
      console.log("[replace_cart] get_cart:", errMsg(err));
      if (isCartStockError(err)) {
        await call("clear_cart", {}).catch((e) =>
          console.log("[replace_cart] clear after get error:", errMsg(e))
        );
      }
    }

    const existing = Array.isArray(cart.items) ? cart.items : [];
    if (existing.length > 0 || cartHasOosItems(cart)) {
      console.log(
        `[replace_cart] clearing before write (lines=${existing.length} addr=${cartAddressId(cart) || "none"})`
      );
      await call("clear_cart", {}).catch((e) =>
        console.log("[replace_cart] clear failed:", errMsg(e))
      );
    }

    const candidateLists: CartLineIds[][] = [];
    for (const item of items) {
      const qty = clampQty(item.quantity);
      let products: Product[] = [];
      const q = (item.name || "").trim();
      if (q) {
        try {
          const raw = await call<unknown>("search_products", {
            addressId: selectedAddressId,
            query: q,
            offset: 0,
          });
          products = asProductList(raw);
        } catch (e) {
          console.log(
            `[replace_cart] fresh search failed for "${q}":`,
            errMsg(e)
          );
        }
      }

      const candidates = collectCandidatesFromProducts(products, qty, {
        spinId: item.spinId,
        skuId: item.skuId,
      });

      if (item.spinId && item.skuId) {
        const primary = toCartLine(item.spinId, item.skuId, qty, item.name);
        if (primary) {
          const key = `${primary.spinId}::${primary.skuId}`;
          if (!candidates.some((c) => `${c.spinId}::${c.skuId}` === key)) {
            candidates.unshift(primary);
          }
        }
      }

      if (!candidates.length) {
        throw new Error(
          `No spinId+skuId pair for "${item.name || item.spinId}". Re-run Parse & match.`
        );
      }

      console.log(
        `[replace_cart] candidates for "${item.name || item.spinId}":`,
        candidates
          .slice(0, 8)
          .map((c) => `${c.spinId}/${c.skuId}`)
          .join(", ")
      );
      candidateLists.push(candidates);
    }

    const primary = candidateLists.map((list) => list[0]);
    try {
      return await updateCartLines(
        call,
        selectedAddressId,
        primary,
        "primary spinId+skuId"
      );
    } catch (err) {
      console.log("[replace_cart] primary failed:", errMsg(err));
      if (!isCartStockError(err) && !/skuId|spinId/i.test(errMsg(err))) {
        throw err;
      }
    }

    // Single item: walk search candidates until one adds
    if (items.length === 1) {
      const list = candidateLists[0];
      let lastError: unknown;
      for (let i = 0; i < Math.min(list.length, 8); i++) {
        const line = list[i];
        try {
          await call("clear_cart", {}).catch(() => {});
          return await updateCartLines(
            call,
            selectedAddressId,
            [line],
            `candidate[${i}] ${line.name || line.spinId}`
          );
        } catch (err) {
          lastError = err;
          console.log(`[replace_cart] candidate[${i}] failed:`, errMsg(err));
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(
            errMsg(lastError) ||
              "Could not add any in-stock variant at this address"
          );
    }

    // Multi-item: build cart one line at a time with substitutes
    const accepted: CartLineIds[] = [];
    const failures: string[] = [];

    for (let i = 0; i < candidateLists.length; i++) {
      const list = candidateLists[i];
      let added = false;
      for (let j = 0; j < Math.min(list.length, 6); j++) {
        const trial = [...accepted, list[j]];
        try {
          await call("clear_cart", {}).catch(() => {});
          await updateCartLines(
            call,
            selectedAddressId,
            trial,
            `build item[${i}] cand[${j}]`
          );
          accepted.push(list[j]);
          added = true;
          break;
        } catch (err) {
          console.log(
            `[replace_cart] build item[${i}] cand[${j}] failed:`,
            errMsg(err)
          );
        }
      }
      if (!added) failures.push(items[i].name || items[i].spinId);
    }

    if (!accepted.length) {
      throw new Error(
        `Could not add items (out of stock at this address): ${failures.join(", ")}`
      );
    }

    await call("clear_cart", {}).catch(() => {});
    return updateCartLines(
      call,
      selectedAddressId,
      accepted,
      `final ${accepted.length}/${items.length} items`
    );
  });
}
