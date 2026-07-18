/** Convert recipe qty ↔ pack size for Instamart matching */

const TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  ml: 1, // treat ml≈g for rough coverage
  l: 1000,
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

function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = unit.toLowerCase().trim();
  if (TO_GRAMS[u] != null) return u === "grams" || u === "gram" ? "g" : u;
  if (u === "pcs" || u === "piece" || u === "pieces") return "pc";
  return u;
}

/** Parse strings like "500 g", "1kg", "200ml", "1 pack" */
export function parsePackSize(label: string): {
  value: number | null;
  unit: string | null;
} {
  const m = label.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
  if (!m) return { value: null, unit: null };
  const value = Number(m[1]);
  const unit = normalizeUnit(m[2] || "pc");
  return { value: Number.isFinite(value) ? value : null, unit };
}

function toBase(value: number, unit: string | null): number | null {
  if (!unit) return null;
  const factor = TO_GRAMS[unit];
  if (factor != null) return value * factor;
  // countable: pc, bunch, clove, packet — compare 1:1 in same unit only
  return null;
}

export function computeQuantityInfo(opts: {
  requiredQty: number | null;
  requiredUnit: string | null;
  packLabel: string;
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
  let coverageNote = "1 pack added (exact recipe amount unknown or not comparable).";

  if (requiredValue != null && packValue != null && packValue > 0) {
    const reqBase = toBase(requiredValue, requiredUnit);
    const packBase = toBase(packValue, packUnit);

    if (reqBase != null && packBase != null) {
      packsNeeded = Math.max(1, Math.ceil(reqBase / packBase));
      const addedBase = packsNeeded * packBase;
      const unitOut = requiredUnit && TO_GRAMS[requiredUnit] ? (requiredUnit === "kg" || requiredUnit === "l" ? requiredUnit : "g") : "g";
      const addedDisplay =
        unitOut === "kg" || unitOut === "l"
          ? `${(addedBase / 1000).toFixed(2)} ${unitOut}`
          : `${Math.round(addedBase)} g/ml`;
      coverageNote =
        addedBase >= reqBase
          ? `Covers recipe need (${requiredLabel}). Pack total ≈ ${addedDisplay}.`
          : `May be short of ${requiredLabel}.`;
    } else if (
      requiredUnit &&
      packUnit &&
      normalizeUnit(requiredUnit) === normalizeUnit(packUnit)
    ) {
      packsNeeded = Math.max(1, Math.ceil(requiredValue / packValue));
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
