import { fetchIngredients } from "./api.js";

const TYP_BERAKNAT = 2;

/**
 * @param {number} nummer
 * @param {number} [livsmedelsTypId]
 * @returns {Promise<{ id: string; label: string; grams: number }[]>}
 */
export async function buildPortionPresets(nummer, livsmedelsTypId) {
  /** @type {{ id: string; label: string; grams: number }[]} */
  const presets = [
    {
      id: "ref100",
      label: "100 g (referensvikt i tabellen)",
      grams: 100,
    },
  ];

  if (livsmedelsTypId !== TYP_BERAKNAT) return presets;

  try {
    const ing = await fetchIngredients(nummer);
    if (!Array.isArray(ing) || ing.length === 0) return presets;

    let sum = 0;
    for (const row of ing) {
      const v = row.viktEfterTillagning;
      if (typeof v === "number" && !Number.isNaN(v)) sum += v;
    }
    if (sum <= 0) return presets;

    const grams = Math.round(sum * 10) / 10;
    presets.push({
      id: "recipe",
      label: `Hel beräkning / batch (${grams.toLocaleString("sv-SE")} g) — summa ingrediensvikter efter tillagning`,
      grams,
    });
  } catch {
    /* nätverk eller tomt svar */
  }

  return presets;
}
