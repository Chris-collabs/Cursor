import { fetchAllFoods, fetchNutrients } from "./api.js";
import {
  indexNutrients,
  energyPercentFive,
  sumGramsByCodes,
  OMEGA3_FA_CODES,
  fatEnergyShareWithinFattyAcidProfile,
  scale,
  fmtNum,
  fmtPct,
} from "./nutrition.js";
import {
  localDateKey,
  loadDiary,
  saveDiary,
  aggregateNutrientList,
} from "./diary.js";
import { buildPortionPresets } from "./portions.js";

/** @type {{ nummer: number, namn: string, typId: number }[]} */
let allFoods = [];
/** @type {{ nummer: number, namn: string, typId: number } | null} */
let selected = null;
/** @type {unknown[] | null} */
let cachedNutrients = null;

/** @type {import('./diary.js').DiaryEntry[]} */
let diaryEntries = [];
let diaryDateKey = "";

function ensureDiaryDate() {
  const k = localDateKey();
  if (k !== diaryDateKey) {
    diaryDateKey = k;
    diaryEntries = loadDiary(k);
  }
}

const IDS_DETAIL = {
  summaryKcal: "summary-kcal",
  summaryKj: "summary-kj",
  pfcWrap: "pfc-wrap",
  pfcProt: "pfc-prot",
  pfcFat: "pfc-fat",
  pfcCho: "pfc-cho",
  pfcFib: "pfc-fib",
  pfcAlc: "pfc-alc",
  legProt: "leg-prot",
  legFat: "leg-fat",
  legCho: "leg-cho",
  legFib: "leg-fib",
  legAlc: "leg-alc",
  nutrientBody: "nutrient-body",
};

const IDS_DAY = {
  summaryKcal: "day-summary-kcal",
  summaryKj: "day-summary-kj",
  pfcWrap: "day-pfc-wrap",
  pfcProt: "day-pfc-prot",
  pfcFat: "day-pfc-fat",
  pfcCho: "day-pfc-cho",
  pfcFib: "day-pfc-fib",
  pfcAlc: "day-pfc-alc",
  legProt: "day-leg-prot",
  legFat: "day-leg-fat",
  legCho: "day-leg-cho",
  legFib: "day-leg-fib",
  legAlc: "day-leg-alc",
  nutrientBody: "day-nutrient-body",
};

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Saknar #${id}`);
  return el;
};

function norm(s) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function renderFoodList(filter) {
  const ul = $("food-list");
  ul.innerHTML = "";
  const q = norm(filter.trim());
  const max = 80;
  let n = 0;
  for (const f of allFoods) {
    if (q && !norm(f.namn).includes(q)) continue;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = f.namn;
    if (selected && selected.nummer === f.nummer) btn.classList.add("active");
    btn.addEventListener("click", () => selectFood(f));
    li.appendChild(btn);
    ul.appendChild(li);
    n += 1;
    if (n >= max) break;
  }
  if (n === 0) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.disabled = true;
    btn.textContent = q ? "Inga träffar" : "Inga livsmedel";
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function setAddDiaryEnabled() {
  $("btn-add-diary").disabled = !(selected && cachedNutrients);
}

function resetPortionSelect() {
  const sel = $("portion-preset");
  sel.innerHTML = '<option value="">Egen vikt — ange gram nedan</option>';
  sel.disabled = true;
  $("portion-hint").textContent = "";
}

/**
 * @param {{ id: string; label: string; grams: number }[]} presets
 */
function fillPortionSelect(presets) {
  const sel = $("portion-preset");
  sel.querySelectorAll("option[data-preset-id]").forEach((o) => o.remove());
  for (const p of presets) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.dataset.grams = String(p.grams);
    opt.dataset.presetId = p.id;
    opt.textContent = p.label;
    sel.appendChild(opt);
  }
  $("portion-hint").textContent =
    "Konsumentstandardportioner som i Livsmedelsverkets webbverktyg ”Sök näringsinnehåll” finns inte i detta öppna API. Här visas 100 g (tabellens referens) och, för vissa beräknade rätter, vikten enligt beräkningsunderlaget (summa ingrediensvikter efter tillagning).";
  sel.disabled = false;
  sel.value = "ref100";
  $("grams").value = "100";
}

function syncPortionSelectFromGrams() {
  const sel = $("portion-preset");
  if (sel.disabled) return;
  const g = Number($("grams").value);
  if (!Number.isFinite(g)) {
    sel.value = "";
    return;
  }
  const opts = Array.from(sel.querySelectorAll("option[data-preset-id]"));
  let match = "";
  for (const o of opts) {
    const pg = Number(o.dataset.grams);
    if (Number.isFinite(pg) && Math.abs(pg - g) < 0.05) match = o.value;
  }
  sel.value = match;
}

function diaryPortionLabel() {
  const sel = $("portion-preset");
  const opt = sel.selectedOptions[0];
  if (opt && opt.value) return opt.textContent.trim();
  const g = Number($("grams").value) || 0;
  return `Egen vikt: ${g} g`;
}

async function selectFood(f) {
  selected = f;
  cachedNutrients = null;
  $("food-title").textContent = f.namn;
  $("detail-panel").classList.remove("hidden");
  $("nutrient-body").innerHTML = "";
  $("pfc-wrap").classList.add("hidden");
  resetPortionSelect();
  renderFoodList($("search").value);
  setAddDiaryEnabled();

  const status = $("detail-status");
  status.textContent = "Hämtar näringsvärden…";
  status.classList.remove("error");

  try {
    const list = await fetchNutrients(f.nummer);
    cachedNutrients = list;
    const presets = await buildPortionPresets(f.nummer, f.typId ?? 1);
    fillPortionSelect(presets);
    renderNutrientAnalysis(list, getPortionFactor(), IDS_DETAIL);
    status.textContent = "";
  } catch (e) {
    status.textContent =
      e instanceof Error ? e.message : "Något gick fel vid hämtning.";
    status.classList.add("error");
  }
  setAddDiaryEnabled();
}

function getPortionFactor() {
  return Math.max(0, Number($("grams").value) || 100) / 100;
}

/**
 * @param {Record<string, import('./nutrition.js').Naringsvarde>} idx
 * @param {string} code
 */
function valFromIdx(idx, code) {
  const v = idx[code]?.varde;
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

/**
 * @param {unknown[]} list
 * @param {number} scaleFactor
 * @param {typeof IDS_DETAIL} ids
 */
function renderNutrientAnalysis(list, scaleFactor, ids) {
  const idx = indexNutrients(list);
  const ep = energyPercentFive(idx);

  const kcal = idx.ENERC_kcal?.varde ?? null;
  const kj = idx.ENERC_kj?.varde ?? null;

  $(ids.summaryKcal).textContent =
    kcal != null ? fmtNum(scale(kcal, scaleFactor), 0) : "—";
  $(ids.summaryKj).textContent =
    kj != null ? fmtNum(scale(kj, scaleFactor), 0) : "—";

  const pfc = $(ids.pfcWrap);
  if (
    ep.proteinPct != null &&
    ep.fatPct != null &&
    ep.carbPct != null &&
    ep.fiberPct != null
  ) {
    pfc.classList.remove("hidden");
    $(ids.pfcProt).style.width = `${ep.proteinPct}%`;
    $(ids.pfcFat).style.width = `${ep.fatPct}%`;
    $(ids.pfcCho).style.width = `${ep.carbPct}%`;
    $(ids.pfcFib).style.width = `${ep.fiberPct}%`;
    const alcPct = ep.alcoholPct ?? 0;
    $(ids.pfcAlc).style.width = `${alcPct}%`;
    $(ids.legProt).textContent = fmtPct(ep.proteinPct);
    $(ids.legFat).textContent = fmtPct(ep.fatPct);
    $(ids.legCho).textContent = fmtPct(ep.carbPct);
    $(ids.legFib).textContent = fmtPct(ep.fiberPct);
    $(ids.legAlc).textContent = fmtPct(alcPct);
  } else {
    pfc.classList.add("hidden");
  }

  const tbody = $(ids.nutrientBody);
  tbody.innerHTML = "";

  /**
   * @param {string} label
   * @param {number|null} amount
   * @param {string} unit
   * @param {number|null} ePctTotal
   * @param {number|null} [ePctOfFat]
   * @param {boolean} [sub]
   */
  function addRow(label, amount, unit, ePctTotal, ePctOfFat, sub = false) {
    const tr = document.createElement("tr");
    const tdL = document.createElement("td");
    tdL.textContent = label;
    if (sub) tdL.classList.add("sub");
    const tdA = document.createElement("td");
    tdA.className = "num";
    tdA.textContent = fmtNum(amount);
    const tdU = document.createElement("td");
    tdU.textContent = unit || "—";
    const tdE = document.createElement("td");
    tdE.className = "num";
    tdE.textContent =
      ePctTotal == null || Number.isNaN(ePctTotal) ? "—" : fmtPct(ePctTotal);
    const tdEF = document.createElement("td");
    tdEF.className = "num";
    tdEF.textContent =
      ePctOfFat == null || Number.isNaN(ePctOfFat) ? "—" : fmtPct(ePctOfFat);
    tr.append(tdL, tdA, tdU, tdE, tdEF);
    tbody.appendChild(tr);
  }

  const omega3Per100 = sumGramsByCodes(list, OMEGA3_FA_CODES);
  const fatSplit = fatEnergyShareWithinFattyAcidProfile(idx, omega3Per100);
  const fapuBase = valFromIdx(idx, "FAPU") ?? 0;
  const omegaCapped = Math.min(Math.max(0, omega3Per100), fapuBase);
  const polyOtherPer100 = Math.max(0, fapuBase - omegaCapped);

  addRow(
    "Protein, totalt",
    scale(valFromIdx(idx, "PROT"), scaleFactor),
    "g",
    ep.proteinPct,
    null,
  );
  addRow(
    "Fett, totalt",
    scale(valFromIdx(idx, "FAT"), scaleFactor),
    "g",
    ep.fatPct,
    null,
  );
  addRow(
    "varav mättade fettsyror",
    scale(valFromIdx(idx, "FASAT"), scaleFactor),
    "g",
    null,
    fatSplit?.saturatedPct ?? null,
    true,
  );
  addRow(
    "varav enkelomättade fettsyror",
    scale(valFromIdx(idx, "FAMS"), scaleFactor),
    "g",
    null,
    fatSplit?.monoPct ?? null,
    true,
  );
  addRow(
    "varav fleromättade fettsyror (exkl. omega-3)",
    scale(polyOtherPer100, scaleFactor),
    "g",
    null,
    fatSplit?.polyOtherPct ?? null,
    true,
  );
  addRow(
    "varav omega-3 (C18:3 + C20:5 + C22:6 + C22:5)",
    scale(omega3Per100, scaleFactor),
    "g",
    null,
    fatSplit?.omega3Pct ?? null,
    true,
  );
  addRow(
    "Kolhydrater, totalt (tillgängliga)",
    scale(valFromIdx(idx, "CHO"), scaleFactor),
    "g",
    ep.carbPct,
    null,
  );
  addRow(
    "Kostfiber",
    scale(valFromIdx(idx, "FIBT"), scaleFactor),
    "g",
    ep.fiberPct,
    null,
  );
  addRow(
    "Alkohol (etanol), totalt",
    scale(valFromIdx(idx, "ALC"), scaleFactor),
    "g",
    ep.alcoholPct,
    null,
  );
  addRow(
    "Salt (natriumklorid)",
    scale(valFromIdx(idx, "NACL"), scaleFactor),
    "g",
    null,
    null,
  );
  addRow(
    "Vitamin D",
    scale(valFromIdx(idx, "VITD"), scaleFactor),
    "µg",
    null,
    null,
  );
  addRow("Jod", scale(valFromIdx(idx, "ID"), scaleFactor), "µg", null, null);
  addRow(
    "Vitamin C",
    scale(valFromIdx(idx, "VITC"), scaleFactor),
    "mg",
    null,
    null,
  );
  addRow("Järn", scale(valFromIdx(idx, "FE"), scaleFactor), "mg", null, null);
}

function renderDiaryList() {
  const ul = $("diary-list");
  ul.innerHTML = "";
  for (const e of diaryEntries) {
    const li = document.createElement("li");
    li.className = "diary-item";
    const info = document.createElement("span");
    info.className = "diary-item-info";
    info.textContent = `${e.namn} — ${e.grams} g`;
    if (e.portionLabel) info.title = e.portionLabel;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-small btn-ghost";
    btn.textContent = "Ta bort";
    btn.addEventListener("click", () => {
      ensureDiaryDate();
      diaryEntries = diaryEntries.filter((x) => x.id !== e.id);
      saveDiary(diaryDateKey, diaryEntries);
      renderDiaryPanel();
    });
    li.append(info, btn);
    ul.appendChild(li);
  }
}

function renderDiaryPanel() {
  ensureDiaryDate();
  $("diary-date-line").textContent = `Datum (lokal tid): ${new Date(
    `${diaryDateKey}T12:00:00`,
  ).toLocaleDateString("sv-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;

  $("diary-count").textContent = String(diaryEntries.length);
  renderDiaryList();

  const wrap = $("day-summary-wrap");
  const empty = $("day-empty-hint");

  if (diaryEntries.length === 0) {
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  wrap.classList.remove("hidden");

  const merged = aggregateNutrientList(diaryEntries);
  renderNutrientAnalysis(merged, 1, IDS_DAY);
}

function cloneNarings(list) {
  try {
    return structuredClone(list);
  } catch {
    return JSON.parse(JSON.stringify(list));
  }
}

function addDiaryFromSelection() {
  const status = $("diary-status");
  status.textContent = "";
  status.classList.remove("error");

  if (!selected || !cachedNutrients) {
    status.textContent =
      "Välj ett livsmedel och vänta tills näringsdata laddats.";
    status.classList.add("error");
    return;
  }

  const grams = Math.max(0, Number($("grams").value) || 0);
  if (grams <= 0) {
    status.textContent = "Ange minst 1 gram.";
    status.classList.add("error");
    return;
  }

  ensureDiaryDate();
  diaryEntries = loadDiary(diaryDateKey);

  const entry = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    nummer: selected.nummer,
    namn: selected.namn,
    grams,
    portionLabel: diaryPortionLabel(),
    narings: cloneNarings(cachedNutrients),
  };
  diaryEntries.push(entry);
  saveDiary(diaryDateKey, diaryEntries);
  renderDiaryPanel();
  status.textContent = "Tillagt i dagboken.";
}

function clearDiary() {
  ensureDiaryDate();
  diaryEntries = [];
  saveDiary(diaryDateKey, diaryEntries);
  $("diary-status").textContent = "Dagens logg är rensad.";
  renderDiaryPanel();
}

async function init() {
  const status = $("load-status");
  status.textContent = "Hämtar livsmedelslista från Livsmedelsverket…";

  try {
    const { livsmedel, totalRecords } = await fetchAllFoods();
    allFoods = livsmedel
      .filter((x) => x.nummer != null && x.namn)
      .map((x) => ({
        nummer: x.nummer,
        namn: x.namn,
        typId:
          typeof x.livsmedelsTypId === "number" ? x.livsmedelsTypId : 1,
      }))
      .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
    status.textContent = `${allFoods.length} livsmedel (totalt ${totalRecords} i databasen). Sök och välj ett livsmedel.`;
    $("search").disabled = false;
    renderFoodList("");
  } catch (e) {
    status.textContent =
      e instanceof Error
        ? e.message
        : "Kunde inte läsa data. Kontrollera nätverket.";
    status.classList.add("error");
  }

  ensureDiaryDate();
  renderDiaryPanel();

  $("search").addEventListener("input", (ev) => {
    renderFoodList(ev.target.value);
  });

  $("grams").addEventListener("input", () => {
    syncPortionSelectFromGrams();
    if (!selected || !cachedNutrients) return;
    renderNutrientAnalysis(cachedNutrients, getPortionFactor(), IDS_DETAIL);
  });

  $("portion-preset").addEventListener("change", () => {
    const sel = $("portion-preset");
    const opt = sel.selectedOptions[0];
    const gStr = opt?.dataset.grams;
    if (gStr != null && gStr !== "") {
      $("grams").value = gStr;
    }
    if (!selected || !cachedNutrients) return;
    renderNutrientAnalysis(cachedNutrients, getPortionFactor(), IDS_DETAIL);
  });

  $("btn-add-diary").addEventListener("click", addDiaryFromSelection);
  $("btn-clear-diary").addEventListener("click", clearDiary);

  window.addEventListener("focus", () => {
    const prev = diaryDateKey;
    ensureDiaryDate();
    if (prev !== diaryDateKey) renderDiaryPanel();
  });

  setAddDiaryEnabled();
}

init();
