const SLV_BASE = "https://dataportal.livsmedelsverket.se/livsmedel";

/**
 * @typedef {{ nummer: number, namn?: string, livsmedelsTypId?: number }} Livsmedel
 * @returns {Promise<{ livsmedel: Livsmedel[], totalRecords: number }>}
 */
export async function fetchAllFoods() {
  const url = `${SLV_BASE}/api/v1/livsmedel?limit=3000&offset=0&sprak=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kunde inte hämta livsmedel (${res.status})`);
  const data = await res.json();
  const list = data.livsmedel ?? [];
  const total = data._meta?.totalRecords ?? list.length;
  return { livsmedel: list, totalRecords: total };
}

/**
 * @param {number} nummer
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchNutrients(nummer) {
  const url = `${SLV_BASE}/api/v1/livsmedel/${nummer}/naringsvarden?sprak=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kunde inte hämta näringsvärden (${res.status})`);
  return res.json();
}

/**
 * @param {number} nummer
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchIngredients(nummer) {
  const url = `${SLV_BASE}/api/v1/livsmedel/${nummer}/ingredienser?sprak=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kunde inte hämta ingredienser (${res.status})`);
  return res.json();
}
