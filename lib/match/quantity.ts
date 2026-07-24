/** Convert recipe qty ↔ pack size for Instamart matching */

const TO_GRAMS: Record<string, number> = {
  g: 1,
  gm: 1,
  gms: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  ml: 1,
  mls: 1,
  l: 1000,
  lt: 1000,
  litre: 1000,
  liter: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
};

const UNIT_ALT =
  "kg|g|gm|gms|grams?|ml|mls|l|lt|ltr|litre|liter|tsp|tbsp|cup|pcs?|pieces?|pack|packet";

export type QuantityInfo = {
  requiredLabel: string;
  requiredValue: number | null;
  requiredUnit: string | null;
  packLabel: string;
  packValue: number | null;
  packUnit: string | null;
  packsNeeded: number;
  addedLabel: string;
  coverageNote: string;
  /** How many units are in a multipack SKU (e.g. 3 for "1 ltr x 3") */
  multipackCount: number;
};

export type ParsedPack = {
  /** Content of one unit in the pack line (e.g. 1 for "1 ltr x 3") */
  unitValue: number | null;
  unit: string | null;
  /** Multipack count (3 for "1 ltr x 3"); 1 if single */
  multipackCount: number;
  /** Total content in the SKU (= unitValue * multipackCount) */
  value: number | null;
};

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = unit.toLowerCase().trim().replace(/\./g, "");
  if (u === "ltr" || u === "lt") return "l";
  if (TO_GRAMS[u] != null) {
    if (u === "grams" || u === "gram" || u === "gm" || u === "gms") return "g";
    if (u === "mls") return "ml";
    if (u === "litre" || u === "liter") return "l";
    return u;
  }
  if (u === "pcs" || u === "piece" || u === "pieces" || u === "nos" || u === "no")
    return "pc";
  return u;
}

/**
 * Parse pack labels including multipacks:
 * "500 g", "1kg", "1 ltr x 3", "3 x 1 l", "pack of 2 · 1 L"
 */
export function parsePackSize(label: string): ParsedPack {
  const cleaned = String(label || "").trim();
  if (!cleaned) {
    return { unitValue: null, unit: null, multipackCount: 1, value: null };
  }

  // "1 ltr x 3" / "500g × 2" / "1 L * 3"
  const unitThenCount = cleaned.match(
    new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*(${UNIT_ALT})\\s*[x×*]\\s*(\\d+)\\b`,
      "i"
    )
  );
  if (unitThenCount) {
    const unitValue = Number(unitThenCount[1]);
    let unitRaw = unitThenCount[2];
    if (/^ltr$/i.test(unitRaw)) unitRaw = "l";
    const unit = normalizeUnit(unitRaw);
    const multipackCount = Math.max(1, Math.floor(Number(unitThenCount[3])));
    const value =
      Number.isFinite(unitValue) && unitValue > 0
        ? unitValue * multipackCount
        : null;
    return {
      unitValue: Number.isFinite(unitValue) ? unitValue : null,
      unit,
      multipackCount,
      value,
    };
  }

  // "3 x 1 ltr" / "2 × 500 g"
  const countThenUnit = cleaned.match(
    new RegExp(
      `(\\d+)\\s*[x×*]\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_ALT})\\b`,
      "i"
    )
  );
  if (countThenUnit) {
    const multipackCount = Math.max(1, Math.floor(Number(countThenUnit[1])));
    const unitValue = Number(countThenUnit[2]);
    let unitRaw = countThenUnit[3];
    if (/^ltr$/i.test(unitRaw)) unitRaw = "l";
    const unit = normalizeUnit(unitRaw);
    const value =
      Number.isFinite(unitValue) && unitValue > 0
        ? unitValue * multipackCount
        : null;
    return {
      unitValue: Number.isFinite(unitValue) ? unitValue : null,
      unit,
      multipackCount,
      value,
    };
  }

  // "pack of 3" alone — treat as count only if we also find a size
  const packOf = cleaned.match(/\bpack\s*of\s*(\d+)\b/i);
  const sizeOnly = cleaned.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_ALT})\\b`, "i")
  );
  if (sizeOnly) {
    const unitValue = Number(sizeOnly[1]);
    let unitRaw = sizeOnly[2] || "pc";
    if (/^ltr$/i.test(unitRaw)) unitRaw = "l";
    const unit = normalizeUnit(unitRaw);
    const multipackCount = packOf
      ? Math.max(1, Math.floor(Number(packOf[1])))
      : 1;
    const value =
      Number.isFinite(unitValue) && unitValue > 0
        ? unitValue * multipackCount
        : null;
    return {
      unitValue: Number.isFinite(unitValue) ? unitValue : null,
      unit,
      multipackCount,
      value,
    };
  }

  return { unitValue: null, unit: null, multipackCount: 1, value: null };
}

export function toBase(value: number, unit: string | null): number | null {
  if (!unit) return null;
  const factor = TO_GRAMS[unit];
  if (factor != null) return value * factor;
  return null;
}

/**
 * How well a pack size fits the recipe need (higher = better).
 * Prefers covering the need with modest overshoot; heavily penalizes
 * multipacks / huge bottles when a smaller pack would do.
 */
export function packFitScore(
  requiredQty: number | null,
  requiredUnit: string | null,
  packLabel: string
): number {
  const pack = parsePackSize(packLabel);
  const isComboLabel = /\b(combo|gift|hamper|bundle|assorted)\b/i.test(
    packLabel
  );

  let score = 0;
  if (pack.multipackCount > 1) score -= 12 * (pack.multipackCount - 1);
  if (isComboLabel) score -= 25;

  if (requiredQty == null || !(requiredQty > 0)) {
    // No recipe qty: prefer single mid-size pantry packs over combos
    return score;
  }

  if (pack.value == null || !(pack.value > 0)) return score;

  const reqUnit = normalizeUnit(requiredUnit);
  const reqBase = toBase(requiredQty, reqUnit);
  const packBase = toBase(pack.value, pack.unit);

  if (reqBase != null && packBase != null && reqBase > 0) {
    const packs = Math.max(1, Math.ceil(reqBase / packBase));
    const added = packs * packBase;
    const ratio = packBase / reqBase; // one SKU vs need
    const wasteRatio = (added - reqBase) / reqBase;

    // Ideal: one SKU covers with up to ~3× overshoot (e.g. 1L for ~300ml oil)
    if (packs === 1 && ratio >= 0.85 && ratio <= 3) score += 28;
    else if (packs === 1 && ratio > 3 && ratio <= 8) score += 10;
    else if (packs === 1 && ratio > 8 && ratio <= 25) score -= 15;
    else if (packs === 1 && ratio > 25) score -= 40;
    else if (packs === 2) score += 6;
    else score -= (packs - 1) * 4;

    score -= Math.min(wasteRatio, 8) * 1.5;

    // Multipack when a single unit already overshoots a lot
    if (pack.multipackCount > 1 && ratio > 4) score -= 35;

    return score;
  }

  if (reqUnit && pack.unit && reqUnit === pack.unit) {
    const packs = Math.max(1, Math.ceil(requiredQty / pack.value));
    const waste = (packs * pack.value - requiredQty) / requiredQty;
    score += 8 - Math.min(waste, 5) - (packs - 1) * 3;
    return score;
  }

  return score;
}

export function computeQuantityInfo(opts: {
  requiredQty: number | null;
  requiredUnit: string | null;
  packLabel: string;
  /** Override packs when UI/cart qty differs from computed need */
  packsOverride?: number;
}): QuantityInfo {
  const requiredUnit = normalizeUnit(opts.requiredUnit);
  const requiredValue = opts.requiredQty;
  const pack = parsePackSize(opts.packLabel);
  const packUnit = pack.unit;
  // Use total SKU content (includes multipack) for coverage math
  const packValue = pack.value;

  const requiredLabel =
    requiredValue != null
      ? `${requiredValue}${requiredUnit ? ` ${requiredUnit}` : ""}`.trim()
      : "as needed";

  const packLabel = opts.packLabel || "1 pack";

  let packsNeeded = 1;
  let coverageNote =
    "1 pack added (exact recipe amount unknown or not comparable).";

  if (requiredValue != null && packValue != null && packValue > 0) {
    const reqBase = toBase(requiredValue, requiredUnit);
    const packBase = toBase(packValue, packUnit);

    if (reqBase != null && packBase != null) {
      packsNeeded = Math.max(1, Math.ceil(reqBase / packBase));
    } else if (
      requiredUnit &&
      packUnit &&
      normalizeUnit(requiredUnit) === normalizeUnit(packUnit)
    ) {
      packsNeeded = Math.max(1, Math.ceil(requiredValue / packValue));
    }
  }

  if (
    opts.packsOverride != null &&
    Number.isFinite(opts.packsOverride) &&
    opts.packsOverride >= 1
  ) {
    packsNeeded = Math.floor(opts.packsOverride);
  }

  // Never suggest buying multiple multipacks for a small recipe need
  if (
    pack.multipackCount > 1 &&
    packsNeeded > 1 &&
    requiredValue != null &&
    packValue != null
  ) {
    const reqBase = toBase(requiredValue, requiredUnit);
    const packBase = toBase(packValue, packUnit);
    if (reqBase != null && packBase != null && packBase >= reqBase) {
      packsNeeded = 1;
    }
  }

  if (requiredValue != null && packValue != null && packValue > 0) {
    const reqBase = toBase(requiredValue, requiredUnit);
    const packBase = toBase(packValue, packUnit);
    if (reqBase != null && packBase != null) {
      const addedBase = packsNeeded * packBase;
      const unitOut =
        requiredUnit && TO_GRAMS[requiredUnit]
          ? requiredUnit === "kg" || requiredUnit === "l"
            ? requiredUnit
            : requiredUnit === "ml"
              ? "ml"
              : "g"
          : "g";
      const addedDisplay =
        unitOut === "kg" || unitOut === "l"
          ? `${(addedBase / 1000).toFixed(2)} ${unitOut}`
          : unitOut === "ml"
            ? `${Math.round(addedBase)} ml`
            : `${Math.round(addedBase)} g/ml`;
      const multiNote =
        pack.multipackCount > 1
          ? ` (multipack ×${pack.multipackCount})`
          : "";
      coverageNote =
        addedBase >= reqBase
          ? `Covers recipe need (${requiredLabel}). Pack total ≈ ${addedDisplay}${multiNote}.`
          : `Short of ${requiredLabel} — adding ${packsNeeded} × ${packLabel} (≈ ${addedDisplay}).`;
    } else if (
      requiredUnit &&
      packUnit &&
      normalizeUnit(requiredUnit) === normalizeUnit(packUnit)
    ) {
      coverageNote = `Need ${requiredLabel}; each pack is ${packLabel} → add ${packsNeeded}.`;
    }
  }

  const addedLabel = `${packsNeeded} × ${packLabel}`;

  return {
    requiredLabel,
    requiredValue,
    requiredUnit,
    packLabel,
    packValue,
    packUnit,
    packsNeeded,
    addedLabel,
    coverageNote,
    multipackCount: pack.multipackCount,
  };
}
