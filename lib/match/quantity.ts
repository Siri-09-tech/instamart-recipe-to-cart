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

/** Parse strings like "500 g", "1kg", "200ml", "1 pack", "500" */
export function parsePackSize(label: string): {
  value: number | null;
  unit: string | null;
} {
  const cleaned = String(label || "").trim();
  if (!cleaned) return { value: null, unit: null };

  const m = cleaned.match(
    /(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|grams?|ml|mls|l|lt|ltr|litre|liter|tsp|tbsp|cup|pcs?|pieces?|pack|packet)?/i
  );
  if (!m) return { value: null, unit: null };
  const value = Number(m[1]);
  let unitRaw = m[2] || "pc";
  if (/^ltr$/i.test(unitRaw)) unitRaw = "l";
  const unit = normalizeUnit(unitRaw);
  return { value: Number.isFinite(value) ? value : null, unit };
}

export function toBase(value: number, unit: string | null): number | null {
  if (!unit) return null;
  const factor = TO_GRAMS[unit];
  if (factor != null) return value * factor;
  return null;
}

/** How well a pack size fits the recipe need (higher = better). */
export function packFitScore(
  requiredQty: number | null,
  requiredUnit: string | null,
  packLabel: string
): number {
  if (requiredQty == null || !(requiredQty > 0)) return 0;

  const pack = parsePackSize(packLabel);
  if (pack.value == null || !(pack.value > 0)) return 0;

  const reqUnit = normalizeUnit(requiredUnit);
  const reqBase = toBase(requiredQty, reqUnit);
  const packBase = toBase(pack.value, pack.unit);

  if (reqBase != null && packBase != null) {
    const packs = Math.max(1, Math.ceil(reqBase / packBase));
    const added = packs * packBase;
    const wasteRatio = (added - reqBase) / reqBase;
    // Prefer covering the need with less waste; prefer fewer packs slightly.
    return 8 - Math.min(wasteRatio, 3) * 2 - (packs - 1) * 0.5;
  }

  if (reqUnit && pack.unit && reqUnit === pack.unit) {
    const packs = Math.max(1, Math.ceil(requiredQty / pack.value));
    const waste = (packs * pack.value - requiredQty) / requiredQty;
    return 5 - Math.min(waste, 3) - (packs - 1) * 0.4;
  }

  return 0;
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
      coverageNote =
        addedBase >= reqBase
          ? `Covers recipe need (${requiredLabel}). Pack total ≈ ${addedDisplay}.`
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
  };
}
