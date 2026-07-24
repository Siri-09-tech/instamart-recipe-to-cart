"use client";

import { useEffect, useState } from "react";

type Me = {
  isLoggedIn: boolean;
  addressId: string | null;
  addressLabel: string | null;
};

type Address = {
  id: string;
  label?: string;
  address?: string;
  addressLine?: string;
  locality?: string;
  city?: string;
};

type MatchRow = {
  ingredient: {
    original: string;
    name: string;
    searchQuery: string;
    quantity: number | null;
    unit: string | null;
  };
  status: "matched" | "unmatched";
  product?: { name: string; brand?: string };
  variant?: { spinId: string; skuId?: string; label: string; price?: number };
  quantityInfo?: {
    requiredLabel: string;
    addedLabel: string;
    coverageNote: string;
    packsNeeded: number;
    packLabel?: string;
  };
  suggestedPacks?: number;
  error?: string;
  selected?: boolean;
  packs?: number;
  availability?: {
    status: "available" | "partial" | "unavailable" | "unknown";
    requestedQty: number;
    availableQty: number | null;
    note: string;
  };
};

type AvailabilityIssue = {
  name: string;
  spinId?: string;
  status: "unavailable" | "partial" | "missing";
  requestedQty: number;
  availableQty: number;
  note: string;
};

type CartSubstitution = {
  requestedName: string;
  requestedSpinId: string;
  addedName: string;
  addedSpinId: string;
};

type CartLine = {
  spinId?: string;
  skuId?: string;
  itemName?: string;
  name?: string;
  quantity?: number;
  discountedFinalPrice?: number;
  mrp?: number;
};

type CartSnapshot = {
  cartTotalAmount?: string;
  items?: CartLine[];
  billBreakdown?: {
    toPay?: { label?: string; value?: string };
  };
  cartId?: string;
  [key: string]: unknown;
};

type CartItemPayload = {
  spinId: string;
  skuId?: string;
  quantity: number;
  name?: string;
};

function asCartItems(cart: unknown): CartLine[] {
  if (!cart || typeof cart !== "object") return [];
  const obj = cart as CartSnapshot;
  if (Array.isArray(obj.items)) return obj.items;
  return [];
}

function cartItemLabel(item: CartLine): string {
  return String(item.itemName || item.name || item.spinId || "Item");
}

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>("");
  const [addressLoadError, setAddressLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string | undefined>();
  const [note, setNote] = useState<string | undefined>();
  const [servingsMeta, setServingsMeta] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [cartPreview, setCartPreview] = useState<CartSnapshot | null>(null);
  const [availabilityIssues, setAvailabilityIssues] = useState<
    AvailabilityIssue[]
  >([]);
  const [substitutions, setSubstitutions] = useState<CartSubstitution[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [overwritePrompt, setOverwritePrompt] = useState<{
    existing: CartLine[];
    pending: CartItemPayload[];
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ae = params.get("authError");
    if (ae) setAuthError(ae);

    refreshMe();
    fetch("/api/llm/status")
      .then((r) => r.json())
      .then((d) => setLlmStatus(d.ready ? d.detail : d.detail))
      .catch(() => setLlmStatus(null));
  }, []);

  async function refreshMe() {
    setAddressLoadError(null);
    const res = await fetch("/api/me");
    const data = await res.json();
    setMe(data);
    if (data.addressId) setAddressId(data.addressId);
    if (data.isLoggedIn) {
      const a = await fetch("/api/addresses");
      const json = await a.json().catch(() => ({}));
      if (!a.ok) {
        if (json.code === "UNAUTHENTICATED") {
          setMe({ ...data, isLoggedIn: false });
          setAddressLoadError("Session expired — sign in with Swiggy again.");
          return;
        }
        setAddressLoadError(json.error || `Address load failed (${a.status})`);
        setAddresses([]);
        return;
      }
      setAddresses(json.addresses || []);
      if ((json.addresses || []).length === 0) {
        setAddressLoadError(
          "Swiggy returned 0 addresses. Confirm this account has saved addresses in the Swiggy app, then click Refresh addresses."
        );
      }
    }
  }

  async function selectAddress(id: string) {
    setAddressId(id);
    const addr = addresses.find((a) => a.id === id);
    const label =
      addr?.label ||
      [addr?.addressLine || addr?.address, addr?.locality, addr?.city]
        .filter(Boolean)
        .join(", ");
    await fetch("/api/addresses/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressId: id, addressLabel: label }),
    });
  }

  async function runMatch() {
    setError(null);
    setCartPreview(null);
    setOverwritePrompt(null);
    setAvailabilityIssues([]);
    setSubstitutions([]);
    setLoading(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, addressId: addressId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "UNAUTHENTICATED") {
          window.location.href = "/auth/login";
          return;
        }
        throw new Error(data.error || "Match failed");
      }
      setTitle(data.title);
      setNote(data.note);
      setServingsMeta(
        data.servings
          ? `${data.servings} ${data.appetite || "medium"} servings` +
              (data.provider ? ` · via ${data.provider}` : "")
          : null
      );
      setMatches(
        (data.matches || []).map(
          (
            m: MatchRow & {
              quantity?: MatchRow["quantityInfo"];
              suggestedPacks?: number;
            }
          ) => {
            const quantityInfo = m.quantityInfo || m.quantity;
            return {
              ...m,
              quantityInfo,
              selected: m.status === "matched",
              packs: m.suggestedPacks || quantityInfo?.packsNeeded || 1,
            };
          }
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function selectedCartItems(): CartItemPayload[] {
    return matches
      .filter((m) => m.selected && m.variant?.spinId)
      .map((m) => ({
        spinId: m.variant!.spinId,
        ...(m.variant!.skuId ? { skuId: m.variant!.skuId } : {}),
        quantity: m.packs || 1,
        name: m.product?.name || m.ingredient.original,
      }));
  }

  async function fetchCurrentCart(): Promise<CartSnapshot | null> {
    const res = await fetch("/api/cart");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.code === "UNAUTHENTICATED") {
        window.location.href = "/auth/login";
        return null;
      }
      const msg = String(data.error || "");
      // Stale / stuck Instamart cart — treat as empty so fill can proceed
      if (
        /out of stock|partially available|CART_EXPIRED|unavailable|oops|try again after|something went wrong|Streamable HTTP|POSTing to endpoint/i.test(
          msg
        )
      ) {
        return { items: [] };
      }
      throw new Error(msg || "Could not read Instamart cart");
    }
    return (data.cart || null) as CartSnapshot | null;
  }

  /** Check existing cart; prompt overwrite only when non-empty. */
  async function prepareFillCart() {
    const items = selectedCartItems();
    if (!items.length) {
      setError(
        "Select at least one matched item with a spinId (re-run Parse & match if needed)."
      );
      return;
    }

    setError(null);
    setOverwritePrompt(null);
    setCartPreview(null);
    setSubstitutions([]);
    setAvailabilityIssues([]);
    setFilling(true);
    try {
      let cart: CartSnapshot | null = null;
      try {
        cart = await fetchCurrentCart();
      } catch (e) {
        // Don't block fill on a broken cart read — replaceCart will clear/rebuild
        console.warn("cart pre-check failed, filling anyway", e);
        cart = { items: [] };
      }
      const existing = asCartItems(cart);
      if (existing.length > 0) {
        setCartPreview(null);
        setOverwritePrompt({ existing, pending: items });
        return;
      }
      await commitFillCart(items, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cart check failed");
    } finally {
      setFilling(false);
    }
  }

  async function commitFillCart(items: CartItemPayload[], replace: boolean) {
    setFilling(true);
    setError(null);
    setOverwritePrompt(null);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          addressId: addressId || undefined,
          replace,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "UNAUTHENTICATED") {
          window.location.href = "/auth/login";
          return;
        }
        throw new Error(data.error || "Could not fill cart");
      }
      // Prefer verified cart from fill; skip extra GET when POST already has lines
      const fromPost =
        data.cart && typeof data.cart === "object"
          ? (data.cart as CartSnapshot)
          : null;
      const postItems = asCartItems(fromPost);
      let preview = fromPost;
      if (postItems.length === 0) {
        const fresh = await fetchCurrentCart().catch(() => null);
        if (asCartItems(fresh).length > 0) preview = fresh;
      }
      setCartPreview(preview);
      setAvailabilityIssues(
        Array.isArray(data.availabilityIssues) ? data.availabilityIssues : []
      );
      setSubstitutions(
        Array.isArray(data.substitutions) ? data.substitutions : []
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cart fill failed");
    } finally {
      setFilling(false);
    }
  }

  const matchedSelected = matches.filter((m) => m.selected).length;
  const previewItems = asCartItems(cartPreview);
  const stockProblems = matches.filter(
    (m) =>
      m.availability?.status === "partial" ||
      m.availability?.status === "unavailable"
  );

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
      <header className="animate-rise mb-10">
        <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-[var(--orange)] uppercase">
          Instamart · Recipe-to-Cart
        </p>
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-[var(--ink)] sm:text-5xl">
          From recipe to a filled cart
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)]">
          Paste a URL or ingredient list. We match Instamart products via Swiggy
          MCP and fill your cart — checkout stays in your hands for this MVP.
        </p>
      </header>

      <section className="animate-rise-delay space-y-6">
        {!me?.isLoggedIn ? (
          <div className="rounded-2xl border border-black/5 bg-white/70 p-6 backdrop-blur">
            <h2 className="font-display text-xl font-semibold">
              Connect Swiggy
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Sign in with Swiggy (phone + OTP). We use OAuth 2.1 + PKCE — no
              passwords stored here.
            </p>
            {authError && (
              <p className="mt-3 text-sm text-red-700">Auth error: {authError}</p>
            )}
            <a
              href="/auth/login"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-[var(--orange)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105"
            >
              Continue with Swiggy
            </a>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/70 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-sm font-medium text-[var(--leaf)]">
                  Connected to Swiggy
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Session uses Instamart MCP tools on your account
                </p>
              </div>
              <a
                href="/auth/logout"
                className="text-sm font-medium text-[var(--muted)] underline-offset-2 hover:underline"
              >
                Sign out
              </a>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white/70 p-5 backdrop-blur">
              <label className="text-sm font-semibold">Delivery address</label>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Required for product search at your location
              </p>
              {addressLoadError && (
                <p className="mt-3 text-sm text-amber-800">{addressLoadError}</p>
              )}
              {addresses.length === 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-[var(--muted)]">
                    No saved addresses loaded yet.
                  </p>
                  <button
                    type="button"
                    onClick={refreshMe}
                    className="text-sm font-semibold text-[var(--orange)] underline-offset-2 hover:underline"
                  >
                    Refresh addresses
                  </button>
                </div>
              ) : (
                <select
                  className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm outline-none focus:border-[var(--orange)]"
                  value={addressId}
                  onChange={(e) => selectAddress(e.target.value)}
                >
                  <option value="">Select address…</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.label ? `${a.label} · ` : "") +
                        [a.addressLine || a.address, a.locality, a.city]
                          .filter(Boolean)
                          .join(", ")}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="rounded-2xl border border-black/5 bg-white/70 p-5 backdrop-blur">
              <label className="text-sm font-semibold">Recipe input</label>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Dish name with servings, URL, or ingredient list
              </p>
              {llmStatus && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  LLM: {llmStatus}
                </p>
              )}
              <textarea
                className="mt-3 min-h-[140px] w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm outline-none focus:border-[var(--orange)]"
                placeholder={`Examples:\nchilli chicken for 10 medium eaters\n\nhttps://hebbarskitchen.com/...\n\n2 cups besan\n1 tsp jeera`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="button"
                disabled={loading || !input.trim() || !addressId}
                onClick={runMatch}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-white transition enabled:hover:bg-black disabled:opacity-40"
              >
                {loading ? (
                  <span className="animate-pulse-soft">
                    Expanding recipe & matching Instamart…
                  </span>
                ) : (
                  "Parse & match"
                )}
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        {matches.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-2xl font-semibold">
                {title || "Matched ingredients"}
              </h2>
              {servingsMeta && (
                <p className="mt-1 text-sm font-medium text-[var(--leaf)]">
                  {servingsMeta}
                </p>
              )}
              {note && (
                <p className="mt-1 text-sm text-[var(--muted)]">{note}</p>
              )}
              <p className="mt-1 text-sm text-[var(--muted)]">
                {matchedSelected} selected · review required vs added before
                filling cart
              </p>
            </div>

            <ul className="space-y-3">
              {matches.map((m, idx) => (
                <li
                  key={`${m.ingredient.searchQuery}-${idx}`}
                  className="rounded-2xl border border-black/5 bg-white/80 p-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(m.selected)}
                      disabled={m.status !== "matched"}
                      onChange={(e) => {
                        const next = [...matches];
                        next[idx] = { ...m, selected: e.target.checked };
                        setMatches(next);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {m.ingredient.original}
                      </p>
                      {m.quantityInfo && (
                        <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                          <p className="rounded-lg bg-black/5 px-2 py-1.5">
                            <span className="font-semibold text-[var(--ink)]">
                              Required:{" "}
                            </span>
                            {m.quantityInfo.requiredLabel}
                          </p>
                          <p className="rounded-lg bg-[var(--orange)]/10 px-2 py-1.5">
                            <span className="font-semibold text-[var(--ink)]">
                              Added:{" "}
                            </span>
                            {m.packs || m.quantityInfo.packsNeeded} ×{" "}
                            {m.variant?.label ||
                              m.quantityInfo.packLabel ||
                              "pack"}
                          </p>
                        </div>
                      )}
                      {m.quantityInfo?.coverageNote && (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {m.quantityInfo.coverageNote}
                        </p>
                      )}
                      {m.status === "matched" && m.product && m.variant ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          → {m.product.name}
                          {m.product.brand ? ` · ${m.product.brand}` : ""}
                          {typeof m.variant.price === "number"
                            ? ` · ₹${m.variant.price}/pack`
                            : ""}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-amber-800">
                          Unmatched{m.error ? `: ${m.error}` : ""}
                        </p>
                      )}
                      {m.availability &&
                        m.availability.note &&
                        (m.availability.status === "partial" ||
                          m.availability.status === "unavailable") && (
                          <p
                            className={`mt-2 text-xs font-medium ${
                              m.availability.status === "unavailable"
                                ? "text-red-700"
                                : "text-amber-800"
                            }`}
                          >
                            {m.availability.status === "unavailable"
                              ? "Unavailable"
                              : "Partially available"}
                            : {m.availability.note}
                            {m.availability.availableQty != null
                              ? ` (available qty: ${m.availability.availableQty})`
                              : ""}
                          </p>
                        )}
                    </div>
                    {m.status === "matched" && (
                      <div className="text-right">
                        <label className="block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                          Packs
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={m.packs || 1}
                          onChange={(e) => {
                            const next = [...matches];
                            next[idx] = {
                              ...m,
                              packs: Number(e.target.value) || 1,
                            };
                            setMatches(next);
                          }}
                          className="w-16 rounded-lg border border-black/10 px-2 py-1 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {stockProblems.length > 0 && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-950">
                  Availability issues ({stockProblems.length})
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-amber-950">
                  {stockProblems.map((m, i) => (
                    <li key={`stock-${i}`}>
                      <span className="font-medium">
                        {m.product?.name || m.ingredient.original}
                      </span>
                      {" — "}
                      {m.availability?.status === "unavailable" ||
                      m.status === "unmatched"
                        ? "Unavailable"
                        : "Partially available"}
                      {m.availability?.availableQty != null
                        ? ` · available qty: ${m.availability.availableQty}`
                        : ""}
                      {m.availability?.requestedQty
                        ? ` · wanted: ${m.availability.requestedQty}`
                        : ""}
                      {m.availability?.note ? (
                        <span className="block text-xs text-amber-900/80">
                          {m.availability.note}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              disabled={filling || matchedSelected === 0}
              onClick={prepareFillCart}
              className="inline-flex items-center justify-center rounded-full bg-[var(--orange)] px-6 py-3 text-sm font-semibold text-white transition enabled:hover:brightness-105 disabled:opacity-40"
            >
              {filling ? "Checking Instamart cart…" : "Fill Instamart cart"}
            </button>
          </section>
        )}

        {overwritePrompt && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="font-display text-xl font-semibold text-amber-950">
              Cart already has {overwritePrompt.existing.length} item
              {overwritePrompt.existing.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-2 text-sm text-amber-900/80">
              Overwriting replaces your Instamart cart with the{" "}
              {overwritePrompt.pending.length} selected item
              {overwritePrompt.pending.length === 1 ? "" : "s"} (same address as
              the app). Most reliable: empty the Swiggy cart first, then fill —
              overwrites of a non-empty cart sometimes stay only on the MCP
              side.
            </p>
            <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-sm text-amber-950">
              {overwritePrompt.existing.slice(0, 12).map((item, i) => (
                <li key={`${item.spinId || i}`}>
                  · {cartItemLabel(item)}
                  {item.quantity ? ` × ${item.quantity}` : ""}
                </li>
              ))}
              {overwritePrompt.existing.length > 12 && (
                <li className="text-amber-800">
                  …and {overwritePrompt.existing.length - 12} more
                </li>
              )}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={filling}
                onClick={() =>
                  commitFillCart(overwritePrompt.pending, true)
                }
                className="inline-flex items-center justify-center rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {filling ? "Overwriting…" : "Overwrite cart"}
              </button>
              <button
                type="button"
                disabled={filling}
                onClick={() => setOverwritePrompt(null)}
                className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {cartPreview != null && (
          <section className="rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf)]/10 p-5">
            <h2 className="font-display text-xl font-semibold text-[var(--leaf)]">
              Cart updated (MCP)
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {previewItems.length} item
              {previewItems.length === 1 ? "" : "s"}
              {cartPreview.cartTotalAmount
                ? ` · ${cartPreview.cartTotalAmount}`
                : cartPreview.billBreakdown?.toPay?.value
                  ? ` · ${cartPreview.billBreakdown.toPay.value}`
                  : ""}
              . Force-close and reopen the Swiggy Instamart app (or switch
              address and back) to refresh. If the app still shows your old
              cart, empty it there first, then fill again from here.
            </p>
            {previewItems.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {previewItems.map((item, i) => (
                  <li
                    key={`${item.spinId || i}`}
                    className="rounded-xl bg-white/70 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{cartItemLabel(item)}</span>
                    <span className="text-[var(--muted)]">
                      {" "}
                      × {item.quantity ?? 1}
                      {typeof item.discountedFinalPrice === "number"
                        ? ` · ₹${item.discountedFinalPrice}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-amber-800">
                Instamart returned an updated cart payload, but no line items
                were parsed. Check the Swiggy app cart directly.
              </p>
            )}

            {substitutions.length > 0 && (
              <div className="mt-4 rounded-xl border border-[var(--leaf)]/25 bg-white/60 p-3">
                <p className="text-sm font-semibold text-[var(--ink)]">
                  Substituted ({substitutions.length})
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
                  {substitutions.map((s, i) => (
                    <li key={`sub-${s.addedSpinId || i}`}>
                      <span className="text-[var(--ink)]">{s.addedName}</span>
                      {" replaced "}
                      <span className="line-through">{s.requestedName}</span>
                      <span className="block text-xs">
                        Matched product would not stay in cart; used another
                        in-stock pack.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {availabilityIssues.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-950">
                  Not fully added ({availabilityIssues.length})
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-amber-950">
                  {availabilityIssues.map((issue, i) => (
                    <li key={`issue-${issue.spinId || i}`}>
                      <span className="font-medium">{issue.name}</span>
                      {" — "}
                      {issue.status === "partial"
                        ? "Partially available"
                        : issue.status === "missing"
                          ? "Missing from cart"
                          : "Unavailable"}
                      {` · available qty: ${issue.availableQty} · wanted: ${issue.requestedQty}`}
                      <span className="block text-xs text-amber-900/80">
                        {issue.note}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
