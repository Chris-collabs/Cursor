/**
 * @typedef {{
 *   id: string;
 *   nummer: number;
 *   namn: string;
 *   grams: number;
 *   narings: unknown[];
 *   portionLabel?: string;
 * }} DiaryEntry
 */

export function localDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function storageKey(dateKey) {
  return `slv-naring-diary.${dateKey}`;
}

/** @param {string} dateKey */
export function loadDiary(dateKey) {
  try {
    const raw = localStorage.getItem(storageKey(dateKey));
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return /** @type {DiaryEntry[]} */ (data).filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.nummer === "number" &&
        typeof e.namn === "string" &&
        typeof e.grams === "number" &&
        Array.isArray(e.narings) &&
        (e.portionLabel === undefined || typeof e.portionLabel === "string"),
    );
  } catch {
    return [];
  }
}

/**
 * @param {string} dateKey
 * @param {DiaryEntry[]} entries
 */
export function saveDiary(dateKey, entries) {
  localStorage.setItem(storageKey(dateKey), JSON.stringify(entries));
}

/**
 * @param {DiaryEntry[]} entries
 * @returns {unknown[]}
 */
export function aggregateNutrientList(entries) {
  /** @type {Map<string, Record<string, unknown>>} */
  const map = new Map();

  for (const entry of entries) {
    const factor = entry.grams / 100;
    for (const raw of entry.narings) {
      const n = /** @type {Record<string, unknown>} */ (raw);
      const code = /** @type {string} */ (n.euroFIRkod ?? "");
      let key = code;
      if (code === "ENERC") {
        const u = String(n.enhet ?? "").toLowerCase();
        if (u.includes("kj")) key = "__ENERC_kj";
        else if (u.includes("kcal")) key = "__ENERC_kcal";
        else key = `__ENERC_${u}`;
      }
      if (!key) continue;

      const v = n.varde;
      const add =
        typeof v === "number" && !Number.isNaN(v) ? /** @type {number} */ (v) * factor : 0;

      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          namn: n.namn,
          euroFIRkod: code === "ENERC" ? "ENERC" : code,
          forkortning: n.forkortning,
          enhet: n.enhet,
          varde: add,
          viktGram: 100,
        });
      } else {
        const cur = prev.varde;
        prev.varde =
          (typeof cur === "number" && !Number.isNaN(cur) ? cur : 0) + add;
      }
    }
  }

  return Array.from(map.values());
}
