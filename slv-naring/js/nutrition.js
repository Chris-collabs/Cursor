/** @typedef {{ namn?: string, euroFIRkod?: string, forkortning?: string, varde?: number, enhet?: string, viktGram?: number }} Naringsvarde */

/** Atwater m.m.; fiber 2 kcal/g enligt vanlig energiberäkning för kostfiber (t.ex. EU). */
const MACRO_KCAL = { PROT: 4, CHO: 4, FAT: 9, FIBT: 2, ALC: 7 };

/** Fettsyror som räknas ihop till omega-3 (g per 100 g). */
export const OMEGA3_FA_CODES = ["F18:3", "F20:5", "F22:6", "F22:5"];

/** @param {Naringsvarde[] | Array<Record<string, unknown>>} list */
export function indexNutrients(list) {
  /** @type {Record<string, Naringsvarde>} */
  const out = {};
  for (const n of list) {
    const code = n.euroFIRkod ?? "";
    if (code === "ENERC") {
      const u = (n.enhet ?? "").toLowerCase();
      if (u.includes("kcal")) out.ENERC_kcal = n;
      else if (u.includes("kj")) out.ENERC_kj = n;
      continue;
    }
    if (!out[code]) out[code] = n;
  }
  return out;
}

/**
 * @param {Record<string, Naringsvarde>} idx
 * @param {string} code
 */
function val(idx, code) {
  const v = idx[code]?.varde;
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

/**
 * @param {Record<string, Naringsvarde>} idx
 */
export function metabolizableEnergyKcal(idx) {
  const p = val(idx, "PROT") ?? 0;
  const f = val(idx, "FAT") ?? 0;
  const c = val(idx, "CHO") ?? 0;
  const fib = val(idx, "FIBT") ?? 0;
  const a = val(idx, "ALC") ?? 0;
  return {
    total:
      p * MACRO_KCAL.PROT +
      f * MACRO_KCAL.FAT +
      c * MACRO_KCAL.CHO +
      fib * MACRO_KCAL.FIBT +
      a * MACRO_KCAL.ALC,
    parts: {
      protein: p * MACRO_KCAL.PROT,
      fat: f * MACRO_KCAL.FAT,
      carb: c * MACRO_KCAL.CHO,
      fiber: fib * MACRO_KCAL.FIBT,
      alcohol: a * MACRO_KCAL.ALC,
    },
    grams: { protein: p, fat: f, carb: c, fiber: fib, alcohol: a },
  };
}

/**
 * @param {Record<string, Naringsvarde>} idx
 */
export function energyPercentFive(idx) {
  const { total, parts } = metabolizableEnergyKcal(idx);
  if (total <= 0) {
    return {
      proteinPct: null,
      fatPct: null,
      carbPct: null,
      fiberPct: null,
      alcoholPct: null,
      totalKcal: 0,
    };
  }
  return {
    proteinPct: (100 * parts.protein) / total,
    fatPct: (100 * parts.fat) / total,
    carbPct: (100 * parts.carb) / total,
    fiberPct: (100 * parts.fiber) / total,
    alcoholPct: (100 * parts.alcohol) / total,
    totalKcal: total,
  };
}

/**
 * @param {Naringsvarde[] | Array<Record<string, unknown>>} list
 * @param {string[]} codes
 */
export function sumGramsByCodes(list, codes) {
  const set = new Set(codes);
  let s = 0;
  for (const n of list) {
    if (!set.has(/** @type {{ euroFIRkod?: string }} */ (n).euroFIRkod ?? ""))
      continue;
    const v = /** @type {{ varde?: number }} */ (n).varde;
    if (typeof v === "number" && !Number.isNaN(v)) s += v;
  }
  return s;
}

/**
 * @param {Record<string, Naringsvarde>} idx
 * @param {number} omega3GramsPer100
 */
export function fatEnergyShareWithinFattyAcidProfile(idx, omega3GramsPer100) {
  const fasat = val(idx, "FASAT") ?? 0;
  const fams = val(idx, "FAMS") ?? 0;
  const fapu = val(idx, "FAPU") ?? 0;
  const omegaRaw =
    typeof omega3GramsPer100 === "number" && !Number.isNaN(omega3GramsPer100)
      ? Math.max(0, omega3GramsPer100)
      : 0;
  const omegaCapped = Math.min(omegaRaw, fapu);
  const polyOther = Math.max(0, fapu - omegaCapped);
  const d = 9 * (fasat + fams + polyOther + omegaCapped);
  if (d <= 0) return null;
  return {
    saturatedPct: (100 * 9 * fasat) / d,
    monoPct: (100 * 9 * fams) / d,
    polyOtherPct: (100 * 9 * polyOther) / d,
    omega3Pct: (100 * 9 * omegaCapped) / d,
    gramsPer100: {
      fasat,
      fams,
      fapu,
      polyOther,
      omegaRaw,
      omegaCapped,
    },
  };
}

/** @param {number|null|undefined} v @param {number} factor */
export function scale(v, factor) {
  if (v == null || Number.isNaN(v)) return null;
  return v * factor;
}

/** @param {number|null} n @param {number} [decimals] */
export function fmtNum(n, decimals = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  return n.toLocaleString("sv-SE", {
    minimumFractionDigits: Math.min(decimals, d),
    maximumFractionDigits: Math.max(decimals, d),
  });
}

/** @param {number|null} n */
export function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`;
}
