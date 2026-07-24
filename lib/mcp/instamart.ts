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

/** Transient Instamart cart-service failures — clear and retry is usually needed. */
function isTransientCartError(err: unknown): boolean {
  return /oops|try again after|something went wrong|temporarily|please try again/i.test(
    errMsg(err)
  );
}

function isTransportFlake(err: unknown): boolean {
  return /Streamable HTTP|POSTing to endpoint|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
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
  skuId?: string;
  quantity: number;
  name?: string;
};

/** Docs use spinId+qty; skuId included when known. */
function toCartLine(
  spinId: string,
  quantity: number,
  opts?: { skuId?: string; name?: string }
): CartLineIds | null {
  const s = String(spinId || "").trim();
  if (!s) return null;
  const k = String(opts?.skuId || "").trim();
  return {
    spinId: s,
    ...(k ? { skuId: k } : {}),
    quantity: clampQty(quantity),
    name: opts?.name,
  };
}

function collectCandidatesFromProducts(
  products: Product[],
  quantity: number,
  preferred?: { spinId?: string; skuId?: string }
): CartLineIds[] {
  const out: CartLineIds[] = [];
  const seen = new Set<string>();

  const push = (spinId: string, skuId?: string, name?: string) => {
    const line = toCartLine(spinId, quantity, { skuId, name });
    if (!line) return;
    const key = `${line.spinId}::${line.skuId || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(line);
  };

  if (preferred?.spinId) {
    // Prefer spin+sku (more reliable land), then spin-only (docs shape)
    if (preferred.skuId) push(preferred.spinId, preferred.skuId);
    push(preferred.spinId);
  }

  for (const p of products) {
    const name = String(p.displayName || p.name || "");
    for (const v of p.variants || []) {
      if (!v.spinId) continue;
      if (v.skuId) push(v.spinId, v.skuId, name);
      push(v.spinId, undefined, name);
    }
  }

  return out.slice(0, 10);
}

function readCartId(cart: CartData | null | undefined): string {
  if (!cart || typeof cart !== "object") return "";
  const id = (cart as Record<string, unknown>).cartId;
  return id != null ? String(id).trim() : "";
}

export type ReplaceCartResult = {
  cart: CartData;
  /** Lines that actually landed in the MCP cart */
  accepted: CartLineIds[];
  /** When a different spin was used than the UI matched */
  substitutions: Array<{
    requestedName: string;
    requestedSpinId: string;
    addedName: string;
    addedSpinId: string;
  }>;
};

/** Low-level update_cart. Prefer replaceCart() for app flows. */
export async function updateCart(
  token: string,
  selectedAddressId: string,
  items: CartItemInput[]
): Promise<unknown> {
  const normalized = items.map((item) => {
    const line: Record<string, unknown> = {
      spinId: item.spinId,
      quantity: clampQty(item.quantity),
    };
    if (item.skuId) line.skuId = item.skuId;
    return line;
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
 * Safely read cart. Stock/partial/transient errors on get_cart mean a ghost
 * or stuck cart — clear once and treat as empty so fill can proceed.
 */
export async function getCartSafe(token: string): Promise<{
  cart: CartData;
  clearedStale: boolean;
}> {
  try {
    return { cart: await getCart(token), clearedStale: false };
  } catch (err) {
    // Transport flake — retry once; never clear on network errors
    if (isTransportFlake(err)) {
      console.log("[get_cart] transport flake — retry:", errMsg(err));
      await new Promise((r) => setTimeout(r, 400));
      try {
        return { cart: await getCart(token), clearedStale: false };
      } catch (retryErr) {
        console.log(
          "[get_cart] still failing after transport retry:",
          errMsg(retryErr)
        );
        return { cart: { items: [] }, clearedStale: false };
      }
    }
    if (!isCartStockError(err) && !isTransientCartError(err)) throw err;
    console.log("[get_cart] stock/transient error — clearing:", errMsg(err));
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

function cartSpinSet(cart: CartData | null | undefined): Set<string> {
  const items = Array.isArray(cart?.items) ? cart!.items! : [];
  const spins = new Set<string>();
  for (const it of items) {
    if (it && typeof it === "object") {
      const spin = String((it as Record<string, unknown>).spinId || "").trim();
      if (spin) spins.add(spin);
    }
  }
  return spins;
}

function cartSummary(cart: CartData | null | undefined): string {
  const items = Array.isArray(cart?.items) ? cart!.items! : [];
  const names = items.slice(0, 5).map((it) => {
    if (!it || typeof it !== "object") return "?";
    const o = it as Record<string, unknown>;
    return String(o.itemName || o.name || o.spinId || "?");
  });
  const more = items.length > 5 ? ` (+${items.length - 5} more)` : "";
  const cartId =
    cart && typeof cart === "object" && "cartId" in cart
      ? String((cart as Record<string, unknown>).cartId || "")
      : "";
  return `lines=${items.length} cartId=${cartId || "none"} sample=[${names.join(" | ")}]${more}`;
}

/**
 * Replace Instamart cart.
 *
 * `update_cart` **replaces** the whole cart — avoid clear_cart first.
 * clear→update was minting a new cartId each time (MCP-only ghost cart)
 * while the Swiggy app kept the previous cart. Empty carts sync; forked IDs don't.
 */
export async function replaceCart(
  token: string,
  selectedAddressId: string,
  items: CartItemInput[],
  opts?: { forceClear?: boolean }
): Promise<ReplaceCartResult> {
  if (!items.length) throw new Error("No items to add to cart.");
  // Kept for API compat; clear only as last resort inside attemptReplace
  void opts?.forceClear;

  const buildSubstitutions = (
    accepted: CartLineIds[]
  ): ReplaceCartResult["substitutions"] => {
    const subs: ReplaceCartResult["substitutions"] = [];
    for (let i = 0; i < items.length; i++) {
      const req = items[i];
      const got = accepted[i];
      if (!got) continue;
      if (req.spinId && got.spinId !== req.spinId) {
        subs.push({
          requestedName: req.name || req.spinId,
          requestedSpinId: req.spinId,
          addedName: got.name || got.spinId,
          addedSpinId: got.spinId,
        });
      }
    }
    return subs;
  };

  const toResult = (
    cart: CartData,
    accepted: CartLineIds[]
  ): ReplaceCartResult => ({
    cart,
    accepted,
    substitutions: buildSubstitutions(accepted),
  });

  const linePayload = (lines: CartLineIds[]) =>
    lines.map((l) => {
      const row: Record<string, unknown> = {
        spinId: l.spinId,
        quantity: l.quantity,
      };
      if (l.skuId) row.skuId = l.skuId;
      return row;
    });

  const checkCart = (cart: CartData, lines: CartLineIds[]) => {
    const expected = new Set(lines.map((l) => l.spinId));
    const got = cartSpinSet(cart);
    const missing = [...expected].filter((s) => !got.has(s));
    const unexpected = [...got].filter((s) => !expected.has(s));
    return {
      ok: missing.length === 0 && unexpected.length === 0,
      missing,
      unexpected,
      matched: expected.size - missing.length,
    };
  };

  // Resolve product candidates, then mutate cart in the same session.
  return withInstamartSession(token, async (call) => {
    const safeGet = async (): Promise<CartData> => {
      try {
        return ((await call<CartData>("get_cart", {})) as CartData) ?? {};
      } catch (err) {
        console.log("[replace_cart] get_cart:", errMsg(err));
        if (isCartStockError(err) || isTransientCartError(err)) {
          return { items: [] };
        }
        throw err;
      }
    };

    const before = await safeGet();
    const beforeId = readCartId(before);
    const beforeSpins = cartSpinSet(before);
    const beforeAddr = cartAddressId(before);
    // Prefer the address already bound to the live cart so we don't fork a second cart
    const addressForWrite =
      beforeAddr && beforeSpins.size > 0 ? beforeAddr : selectedAddressId;
    console.log(
      `[replace_cart] before: ${cartSummary(before)} cartAddr=${beforeAddr || "none"} selected=${selectedAddressId} writeAddr=${addressForWrite}`
    );
    if (
      beforeAddr &&
      selectedAddressId &&
      beforeAddr !== selectedAddressId
    ) {
      console.log(
        `[replace_cart] WARNING: overwriting cart on its bound address ${beforeAddr} (UI had ${selectedAddressId})`
      );
    }

    // Build candidates (search)
    const candidateLists: CartLineIds[][] = [];
    for (const item of items) {
      const qty = clampQty(item.quantity);
      let products: Product[] = [];
      const q = (item.name || "").trim();
      if (q) {
        try {
          const raw = await call<unknown>("search_products", {
              addressId: addressForWrite,
              query: q,
              offset: 0,
            });
          products = asProductList(raw);
        } catch (e) {
          console.log(
            `[replace_cart] search failed for "${q}":`,
            errMsg(e)
          );
        }
      }

      const candidates = collectCandidatesFromProducts(products, qty, {
        spinId: item.spinId,
        skuId: item.skuId,
      });

      if (item.spinId) {
        const withSku = item.skuId
          ? toCartLine(item.spinId, qty, {
              skuId: item.skuId,
              name: item.name,
            })
          : null;
        const spinOnly = toCartLine(item.spinId, qty, { name: item.name });
        // Unshift in reverse preference so sku-bearing ends up first
        for (const primary of [spinOnly, withSku]) {
          if (!primary) continue;
          const key = `${primary.spinId}::${primary.skuId || ""}`;
          if (!candidates.some((c) => `${c.spinId}::${c.skuId || ""}` === key)) {
            candidates.unshift(primary);
          }
        }
      }

      if (!candidates.length) {
        throw new Error(
          `No spinId for "${item.name || item.spinId}". Re-run Parse & match.`
        );
      }

      console.log(
        `[replace_cart] candidates for "${item.name || item.spinId}":`,
        candidates
          .slice(0, 8)
          .map((c) => `${c.spinId}${c.skuId ? "/" + c.skuId : ""}`)
          .join(", ")
      );
      candidateLists.push(candidates);
    }

    const pickPreferred = (list: CartLineIds[]) =>
      list.find((c) => c.skuId) || list[0];

    /** Replace in place — clear only if old lines refuse to leave. */
    const attemptReplace = async (
      lines: CartLineIds[],
      label: string,
      allowClearFallback = true
    ): Promise<ReplaceCartResult> => {
      console.log(
        `[replace_cart] update_cart ${label}: ${JSON.stringify(linePayload(lines))}`
      );
      await call("update_cart", {
        selectedAddressId: addressForWrite,
        items: linePayload(lines),
      });
      console.log(`[replace_cart] update_cart returned (${label})`);

      await new Promise((r) => setTimeout(r, 500));
      let cart = await safeGet();
      let check = checkCart(cart, lines);
      const afterId = readCartId(cart);
      console.log(
        `[replace_cart] VERIFY ${label}: matched=${check.matched}/${lines.length} missing=${check.missing.length} unexpected=${check.unexpected.length} | ${cartSummary(cart)}`
      );
      if (beforeId && afterId && beforeId !== afterId) {
        console.log(
          `[replace_cart] cartId changed ${beforeId} → ${afterId} (fork risk)`
        );
      }

      if (
        allowClearFallback &&
        !check.ok &&
        check.unexpected.some((s) => beforeSpins.has(s))
      ) {
        console.log(
          `[replace_cart] old lines persist — one clear+update (${label})`
        );
        try {
          await call("clear_cart", {});
        } catch (e) {
          console.log("[replace_cart] clear failed:", errMsg(e));
        }
        await call("update_cart", {
          selectedAddressId: addressForWrite,
          items: linePayload(lines),
        });
        await new Promise((r) => setTimeout(r, 500));
        cart = await safeGet();
        check = checkCart(cart, lines);
        console.log(
          `[replace_cart] VERIFY after clear ${label}: matched=${check.matched}/${lines.length} | ${cartSummary(cart)}`
        );
      }

      if (!check.ok) {
        if (cartSpinSet(cart).size === 0) {
          throw new Error(
            `Instamart accepted update but cart stayed empty (${lines.map((l) => l.spinId).join(",")}).`
          );
        }
        throw new Error(
          `Cart verify failed (missing: ${check.missing.join(", ") || "none"}; unexpected: ${check.unexpected.join(", ") || "none"}).`
        );
      }

      const landed = lines.filter((l) => cartSpinSet(cart).has(l.spinId));
      return toResult(cart, landed.length ? landed : lines);
    };

    // 1) Full replace with sku-bearing candidates when possible
    const primary = candidateLists.map(pickPreferred);
    try {
      return await attemptReplace(primary, "primary-batch");
    } catch (err) {
      console.log("[replace_cart] primary-batch failed:", errMsg(err));
    }

    // 2) Single item: try alternate products (no clear)
    if (items.length === 1) {
      const list = candidateLists[0];
      let lastError: unknown;
      for (let i = 0; i < Math.min(list.length, 8); i++) {
        if (list[i] === primary[0]) continue;
        try {
          const result = await attemptReplace(
            [list[i]],
            `candidate[${i}] ${list[i].name || list[i].spinId}`,
            false
          );
          console.log(
            `[replace_cart] used substitute ${list[i].name || list[i].spinId}`
          );
          return result;
        } catch (err) {
          lastError = err;
          console.log(`[replace_cart] candidate[${i}] failed:`, errMsg(err));
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(errMsg(lastError) || "Could not add item to cart");
    }

    // 3) Multi-item: grow by replace only (keeps cartId stable)
    const accepted: CartLineIds[] = [];
    const failures: string[] = [];
    for (let i = 0; i < candidateLists.length; i++) {
      const list = candidateLists[i];
      let added = false;
      for (let j = 0; j < Math.min(list.length, 5); j++) {
        const trial = [...accepted, list[j]];
        try {
          const result = await attemptReplace(
            trial,
            `grow item[${i}] cand[${j}]`,
            false
          );
          if (cartSpinSet(result.cart).has(list[j].spinId)) {
            accepted.push(list[j]);
            added = true;
            break;
          }
        } catch (err) {
          console.log(
            `[replace_cart] grow item[${i}] cand[${j}] failed:`,
            errMsg(err)
          );
        }
      }
      if (!added) failures.push(items[i].name || items[i].spinId);
    }

    if (!accepted.length) {
      throw new Error(
        `Could not add items to Instamart cart: ${failures.join(", ")}`
      );
    }

    if (failures.length) {
      console.log(
        `[replace_cart] partial ${accepted.length}/${items.length}; skipped: ${failures.join(", ")}`
      );
    }

    return attemptReplace(
      accepted,
      `final ${accepted.length}/${items.length}`,
      true
    );
  }).then(async (result) => {
    await new Promise((r) => setTimeout(r, 700));
    try {
      const fresh = await getCart(token);
      const expected = new Set(result.accepted.map((a) => a.spinId));
      const got = cartSpinSet(fresh);
      const unexpected = [...got].filter((s) => !expected.has(s));
      const missing = [...expected].filter((s) => !got.has(s));
      console.log(
        `[replace_cart] VERIFY cross-session: ${cartSummary(fresh)} missing=${missing.length} unexpected=${unexpected.length}`
      );
      if (unexpected.length > 0 || missing.length > 0) {
        throw new Error(
          `Instamart cart did not sync after overwrite (missing ${missing.length}, extra ${unexpected.length}). Empty the cart in the Swiggy app for this address, then fill again from an empty cart.`
        );
      }
      if (Array.isArray(fresh.items) && fresh.items.length > 0) {
        return { ...result, cart: fresh };
      }
    } catch (err) {
      if (/did not sync|Empty the cart/i.test(errMsg(err))) throw err;
      console.log("[replace_cart] cross-session verify skipped:", errMsg(err));
    }
    return result;
  });
}
