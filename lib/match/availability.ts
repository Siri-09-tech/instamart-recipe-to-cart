import type { ProductVariant } from "@/lib/mcp/instamart";

export type AvailabilityStatus =
  | "available"
  | "partial"
  | "unavailable"
  | "unknown";

export type AvailabilityInfo = {
  status: AvailabilityStatus;
  /** Packs / units the user wanted */
  requestedQty: number;
  /** Packs / units Instamart can actually fulfill (when known) */
  availableQty: number | null;
  note: string;
};

/**
 * Only trust explicit "how many packs can I buy" fields.
 * Ignore pack-size numbers (250 ml → 250) and ambiguous inventory blobs.
 */
export function readAvailableQty(variant: ProductVariant): number | null {
  const obj = variant as Record<string, unknown>;
  const keys = [
    "availableQuantity",
    "availableQty",
    "available_quantity",
    "maxAllowedQuantity",
    "max_allowed_quantity",
    "maxOrderableQuantity",
  ];

  for (const key of keys) {
    const val = obj[key];
    const n =
      typeof val === "number"
        ? val
        : typeof val === "string" && val.trim()
          ? Number(val)
          : NaN;
    // Cart line counts are small; pack weights are usually >= 50
    if (Number.isFinite(n) && n >= 0 && n <= 30) {
      return Math.floor(n);
    }
  }
  return null;
}

function readInStock(variant: ProductVariant): boolean | undefined {
  if (typeof variant.inStock === "boolean") return variant.inStock;
  const obj = variant as Record<string, unknown>;
  if (typeof obj.isInStockAndAvailable === "boolean") {
    return obj.isInStockAndAvailable;
  }
  // Do NOT use generic `available` — it is often unrelated / false-positive
  return undefined;
}

/** Classify stock vs requested packs at match time. */
export function classifyVariantAvailability(
  variant: ProductVariant,
  requestedPacks: number
): AvailabilityInfo {
  const requestedQty = Math.max(1, Math.floor(requestedPacks) || 1);
  const availableQty = readAvailableQty(variant);
  const inStock = readInStock(variant);

  if (inStock === false) {
    return {
      status: "unavailable",
      requestedQty,
      availableQty: availableQty ?? 0,
      note: "Out of stock at this address.",
    };
  }

  // Only flag partial when we have a reliable low pack-count limit
  if (
    availableQty != null &&
    availableQty > 0 &&
    availableQty < requestedQty
  ) {
    return {
      status: "partial",
      requestedQty,
      availableQty,
      note: `Only ${availableQty} of ${requestedQty} pack(s) available at this store.`,
    };
  }

  if (availableQty === 0 && inStock !== true) {
    return {
      status: "unavailable",
      requestedQty,
      availableQty: 0,
      note: "Out of stock at this address.",
    };
  }

  if (inStock === true || (availableQty != null && availableQty >= requestedQty)) {
    return {
      status: "available",
      requestedQty,
      availableQty,
      note:
        availableQty != null
          ? `Up to ${availableQty} pack(s) can be added.`
          : "In stock.",
    };
  }

  // No reliable signal from Instamart — do not alarm the user
  return {
    status: "unknown",
    requestedQty,
    availableQty: null,
    note: "",
  };
}

export type CartAvailabilityIssue = {
  name: string;
  spinId?: string;
  status: "unavailable" | "partial" | "missing";
  requestedQty: number;
  availableQty: number;
  note: string;
};

/**
 * Compare what we tried to add vs what get_cart returned.
 * Only reports clear shortfalls — not noise when qty fields are missing.
 */
export function diffCartAvailability(
  requested: Array<{ spinId: string; quantity: number; name?: string }>,
  cartItems: Array<Record<string, unknown>>
): CartAvailabilityIssue[] {
  const bySpin = new Map<string, Record<string, unknown>>();
  for (const item of cartItems) {
    const spin = item.spinId != null ? String(item.spinId) : "";
    if (spin) bySpin.set(spin, item);
  }

  const issues: CartAvailabilityIssue[] = [];

  for (const req of requested) {
    const want = Math.max(1, Math.floor(req.quantity) || 1);
    const cartItem = bySpin.get(req.spinId);
    const name =
      req.name ||
      (cartItem
        ? String(cartItem.itemName || cartItem.name || req.spinId)
        : req.spinId);

    if (!cartItem) {
      // Item absent after a successful cart write → likely OOS / rejected
      issues.push({
        name,
        spinId: req.spinId,
        status: "missing",
        requestedQty: want,
        availableQty: 0,
        note: "Not present in Instamart cart after update.",
      });
      continue;
    }

    const rawQty = cartItem.quantity;
    const cartQty =
      typeof rawQty === "number"
        ? rawQty
        : typeof rawQty === "string" && rawQty.trim()
          ? Number(rawQty)
          : NaN;

    // If Instamart omitted line qty, don't invent a partial shortfall
    if (!Number.isFinite(cartQty)) continue;

    const inStock =
      typeof cartItem.isInStockAndAvailable === "boolean"
        ? cartItem.isInStockAndAvailable
        : typeof cartItem.inStock === "boolean"
          ? cartItem.inStock
          : true;

    if (!inStock) {
      issues.push({
        name,
        spinId: req.spinId,
        status: "unavailable",
        requestedQty: want,
        availableQty: Math.max(0, cartQty),
        note: `Marked unavailable in cart (qty ${Math.max(0, cartQty)}).`,
      });
      continue;
    }

    if (cartQty > 0 && cartQty < want) {
      issues.push({
        name,
        spinId: req.spinId,
        status: "partial",
        requestedQty: want,
        availableQty: cartQty,
        note: `Wanted ${want} pack(s), cart has ${cartQty}.`,
      });
    }
  }

  return issues;
}
