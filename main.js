const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4I1vjXnIlbHQ0tEnK2YCo20GtHcEU8z-an8r4IcP-2TqoSM8ZA_gCjkCn-5f_hadZcBPMgoW362fx/pub";
const DEFAULT_SHEET_CSV_URL = `${SHEET_BASE_URL}?gid=0&single=true&output=csv`;
const DEFAULT_SHEET_URLS = {
  rackets: `${SHEET_BASE_URL}?gid=0&single=true&output=csv`,
  history: `${SHEET_BASE_URL}?gid=830114346&single=true&output=csv`,
  strings: `${SHEET_BASE_URL}?gid=2116292174&single=true&output=csv`
};
const SHEET_STORAGE_KEY = "gjstrings.sheetCsvUrl";
const THEME_STORAGE_KEY = "gjstrings.theme";
const DARK_MODE_STORAGE_KEY = "gjstrings.darkMode";
const LOW_STRING_THRESHOLD = 4;
const OLD_STRINGING_DAYS = 40;

const fallbackRows = [
  {
    owner: "Šárka Kubíčková",
    racketCode: "raketa013",
    racketName: "Babolat Aero Pure Rafa",
    stringLength: "6m / 5,5m",
    knots: "M:7T / C:5H,6T",
    date: "2025-11-09",
    stringName: "Babolat RPM Power 1,30",
    tension: "24/23",
    remaining: "3",
    note: "Standardní vypletení"
  },
  {
    owner: "Šárka Kubíčková",
    racketCode: "raketa013",
    racketName: "Babolat Aero Pure Rafa",
    stringLength: "6m / 5,5m",
    knots: "M:7T / C:5H,6T",
    date: "2025-09-18",
    stringName: "Babolat RPM Blast 1,25",
    tension: "23/22",
    remaining: "1",
    note: "Měkčí nastavení"
  },
  {
    owner: "Martin Novák",
    racketCode: "raketa204",
    racketName: "Wilson Blade 98",
    stringLength: "6,1m / 5,7m",
    knots: "M:8T / C:7H,8T",
    date: "2026-04-12",
    stringName: "Luxilon ALU Power 1,25",
    tension: "24/23",
    remaining: "5",
    note: "Turnajový servis"
  }
];

const prices = [
  { category: "Vyplétání", items: [
    { name: "Standardní vypletení", note: "běžný termín", price: "150 Kč" },
    { name: "Expresní vypletení", note: "do 90 minut", price: "180 Kč" }
  ]},
  { category: "Výplety", items: [
    { name: "Základní polyester", note: "podle dostupnosti", price: "od 190 Kč" },
    { name: "Premium / hybrid", note: "individuální doporučení", price: "od 290 Kč" }
  ]},
  { category: "Doplňky", items: [
    { name: "Omotávka", note: "výměna při servisu", price: "od 80 Kč" },
    { name: "Tlumič", note: "dle typu", price: "od 40 Kč" }
  ]}
];

const state = {
  rows: [],
  inventory: [],
  owner: "",
  selectedRacketCode: "",
  currentScreen: "homeScreen",
  qrScanner: null,
  scannerRunning: false
};

const screens = [...document.querySelectorAll(".screen")];
const loadingOverlay = document.querySelector("#loadingOverlay");
const lookupInput = { value: "" };
const currentOwner = document.querySelector("#currentOwner");
const racketCount = document.querySelector("#racketCount");
const stringCount = document.querySelector("#stringCount");
const statsSummary = document.querySelector("#statsSummary");
const racketsList = document.querySelector("#racketsList");
const racketDetail = document.querySelector("#racketDetail");
const historyList = document.querySelector("#historyList");
const stringsList = document.querySelector("#stringsList");
const statsGrid = document.querySelector("#statsGrid");
const monthChart = document.querySelector("#monthChart");
const priceList = document.querySelector("#priceList");
const backButton = document.querySelector("#backButton");
const refreshButton = document.querySelector("#refreshButton");
const menuButton = document.querySelector("#menuButton");
const drawer = document.querySelector("#drawer");
const drawerClose = document.querySelector("#drawerClose");
const settingsForm = document.querySelector("#settingsForm");
const sheetUrlInput = document.querySelector("#sheetUrlInput");
const qrDialog = document.querySelector("#qrDialog");
const dialogCloseButton = document.querySelector("#dialogCloseButton");
const dialogScanButton = document.querySelector("#dialogScanButton");
const scannerDialog = document.querySelector("#scannerDialog");
const scannerCloseButton = document.querySelector("#scannerCloseButton");
const qrReader = document.querySelector("#qrReader");
const themeInputs = [...document.querySelectorAll("input[name='theme']")];
const darkModeInput = document.querySelector("#darkModeInput");

function getSheetUrl() {
  const stored = localStorage.getItem(SHEET_STORAGE_KEY);
  if (!stored || stored.includes("2PACX-1vS4I1vjXnIlbHQ0tEnK2YCo20GtHcEU8z-an8r4IcP-2TqoSM8ZA_gCjkCn-5f_hadZcBPMgoW362fx")) {
    return DEFAULT_SHEET_CSV_URL;
  }
  return stored;
}

function showLoading() {
  loadingOverlay.hidden = false;
}

function hideLoading() {
  loadingOverlay.hidden = true;
}

function showQrDialog() {
  qrDialog.hidden = false;
}

function hideQrDialog() {
  qrDialog.hidden = true;
}

function showScannerDialog() {
  scannerDialog.hidden = false;
}

async function hideScannerDialog() {
  if (qrReader) {
    qrReader.onpointerdown = null;
    qrReader.classList.remove("focusing");
  }
  if (state.qrScanner && state.scannerRunning) {
    try {
      await state.qrScanner.stop();
      await state.qrScanner.clear();
    } catch (error) {
      // The camera can already be stopped by the browser.
    }
  }
  state.scannerRunning = false;
  scannerDialog.hidden = true;
}

function applyTheme(theme) {
  const selected = theme || localStorage.getItem(THEME_STORAGE_KEY) || "roland";
  document.body.dataset.theme = selected;
  themeInputs.forEach((input) => {
    input.checked = input.value === selected;
  });
}

function applyDarkMode(enabled) {
  const isEnabled = typeof enabled === "boolean"
    ? enabled
    : localStorage.getItem(DARK_MODE_STORAGE_KEY) === "true";
  document.body.dataset.mode = isEnabled ? "dark" : "light";
  if (darkModeInput) darkModeInput.checked = isEnabled;
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("cs-CZ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function byOwner() {
  return state.rows.filter((row) => normalize(row.owner) === normalize(state.owner));
}

function getRackets() {
  return uniqueBy(byOwner(), "racketCode");
}

function getSelectedRacket() {
  return state.rows.find((row) => normalize(row.racketCode) === normalize(state.selectedRacketCode));
}

function getHistoryForRacket(code) {
  return state.rows
    .filter((row) => normalize(row.racketCode) === normalize(code))
    .filter((row) => row.date || row.stringName || row.tension)
    .sort((a, b) => parseDate(b.date) - parseDate(a.date));
}

function getStrings() {
  const grouped = new Map();
  state.inventory.filter((row) => normalize(row.owner) === normalize(state.owner)).forEach((row) => {
    grouped.set(row.stringName, {
      stringName: row.stringName,
      remaining: row.remaining,
      lastUsed: findLastUse(row.stringName),
      tension: findLastTension(row.stringName)
    });
  });
  return [...grouped.values()];
}

function findLastUse(stringName) {
  return byOwner()
    .filter((row) => normalize(row.stringName) === normalize(stringName))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.date || "-";
}

function findLastTension(stringName) {
  return byOwner()
    .filter((row) => normalize(row.stringName) === normalize(stringName))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.tension || "-";
}

async function loadData() {
  showLoading();
  try {
    const sheetUrl = getSheetUrl();
    if (!sheetUrl) {
      await delay(700);
      return { rows: fallbackRows, inventory: [] };
    }

    const useDefaultMultiSheet = sheetUrl === DEFAULT_SHEET_CSV_URL;
    if (!useDefaultMultiSheet) {
      const response = await fetch(sheetUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Tabulku se nepodařilo načíst");
      const parsed = parseCsv(await response.text());
      if (parsed.length === 0) throw new Error("Tabulka je prázdná");
      return { rows: parsed, inventory: [] };
    }

    const [racketsCsv, historyCsv, stringsCsv] = await Promise.all([
      fetchCsv(DEFAULT_SHEET_URLS.rackets),
      fetchCsv(DEFAULT_SHEET_URLS.history),
      fetchCsv(DEFAULT_SHEET_URLS.strings)
    ]);
    return mergeSheets(racketsCsv, historyCsv, stringsCsv);
  } catch (error) {
    await delay(300);
    return { rows: fallbackRows, inventory: [] };
  } finally {
    hideLoading();
  }
}

async function fetchCsv(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Tabulku se nepodařilo načíst: ${url}`);
  return response.text();
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseCsv(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines.shift(), separator).map((header) => normalize(header).replace(/[^a-z0-9]/g, ""));

  return lines.map((line) => {
    const values = splitCsvLine(line, separator);
    const entry = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    return {
      owner: entry.majitel || entry.jmeno || entry.jmenomajitele || entry.owner || entry.name,
      racketCode: entry.kod || entry.kodrakety || entry.raketakod || entry.racketcode || entry.code,
      racketName: entry.raketa || entry.nazev || entry.nazevrakety || entry.racketname || entry.model,
      stringLength: entry.delkastrun || entry.delka || entry.stringlength,
      knots: entry.uzly || entry.knots,
      date: entry.datum || entry.date,
      stringName: entry.vyplet || entry.struna || entry.string || entry.stringname,
      tension: entry.napeti || entry.tension,
      remaining: entry.zbyva || entry.zustatek || entry.skladem || entry.remaining,
      note: entry.poznamka || entry.note
    };
  }).filter((row) => row.owner && row.racketCode);
}

function parseGenericCsv(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines.shift(), separator).map((header) => normalize(header).replace(/[^a-z0-9]/g, ""));

  return lines.map((line) => {
    const values = splitCsvLine(line, separator);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function mergeSheets(racketsCsv, historyCsv, stringsCsv) {
  const rackets = parseGenericCsv(racketsCsv).map((row) => ({
    owner: row.majitel,
    racketCode: row.kod,
    racketName: row.nazev,
    stringLength: row.delka,
    knots: row.uzly,
    date: "",
    stringName: "",
    tension: "",
    remaining: "",
    note: ""
  })).filter((row) => row.owner && row.racketCode);

  const racketByCode = new Map(rackets.map((racket) => [normalize(racket.racketCode), racket]));
  const inventory = parseGenericCsv(stringsCsv).map((row) => ({
    owner: row.majitel,
    code: row.kod,
    stringName: row.nazev,
    remaining: row.mnozstvi || "0"
  })).filter((row) => row.owner && row.stringName);

  const history = parseGenericCsv(historyCsv).map((row) => {
    const racket = racketByCode.get(normalize(row.kod));
    if (!racket) return null;
    const stockByCode = inventory.find((item) => normalize(item.code) === normalize(row.typ));
    const stringName = stockByCode?.stringName || row.typ;
    const stock = stockByCode || inventory.find((item) =>
      normalize(item.owner) === normalize(racket.owner) &&
      normalize(item.stringName) === normalize(stringName)
    );

    return {
      owner: racket.owner,
      racketCode: racket.racketCode,
      racketName: racket.racketName,
      stringLength: racket.stringLength,
      knots: racket.knots,
      date: row.datum,
      stringName,
      tension: row.napeti,
      remaining: stock?.remaining || "",
      note: ""
    };
  }).filter(Boolean);

  const historyCodes = new Set(history.map((row) => normalize(row.racketCode)));
  const racketsWithoutHistory = rackets.filter((racket) => !historyCodes.has(normalize(racket.racketCode)));

  return { rows: [...history, ...racketsWithoutHistory], inventory };
}

function detectSeparator(headerLine) {
  return headerLine.split(";").length > headerLine.split(",").length ? ";" : ",";
}

function splitCsvLine(line, separator) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function setScreen(id) {
  state.currentScreen = id;
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  closeDrawer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectByLookup(value) {
  const query = normalize(value);
  const byCode = state.rows.find((row) => normalize(row.racketCode) === query);
  const match = byCode;

  if (!match) {
    showQrDialog();
    return;
  }

  state.owner = match.owner;
  state.selectedRacketCode = match.racketCode;
  lookupInput.value = match.racketCode;
  render();
  setScreen("detailScreen");
}

function openRacketDetail(code) {
  const racket = state.rows.find((row) => normalize(row.racketCode) === normalize(code));
  if (!racket) {
    lookupInput.value = code;
    showQrDialog();
    return;
  }

  state.owner = racket.owner;
  state.selectedRacketCode = racket.racketCode;
  lookupInput.value = racket.racketCode;
  render();
  setScreen("detailScreen");
}

function render() {
  const ownerRows = byOwner();
  const ownerHistoryRows = ownerRows.filter((row) => row.date || row.stringName || row.tension);
  const rackets = getRackets();
  const strings = getStrings();
  const history = getHistoryForRacket(state.selectedRacketCode);

  if (currentOwner) currentOwner.textContent = state.owner || "";
  document.querySelectorAll("[data-owner-name]").forEach((node) => {
    node.textContent = state.owner || "Vyberte raketu";
  });

  if (racketCount) racketCount.textContent = plural(rackets.length, "raketa", "rakety", "raket");
  if (stringCount) stringCount.textContent = plural(strings.length, "výplet skladem", "výplety skladem", "výpletů skladem");
  if (statsSummary) statsSummary.textContent = `${ownerHistoryRows.length} záznamů výpletů`;
  if (sheetUrlInput) sheetUrlInput.value = getSheetUrl();

  renderRackets(rackets);
  renderDetail(history);
  renderStrings(strings);
  renderStats(ownerHistoryRows, strings);
  renderMonthChart(ownerHistoryRows);
  renderPrices();
}

function renderRackets(rackets) {
  if (rackets.length === 0) {
    racketsList.innerHTML = `<p class="muted">Žádné rakety pro vybraného majitele.</p>`;
    return;
  }

  racketsList.innerHTML = rackets.map((racket) => `
    <button class="racket-row" type="button" data-racket-code="${escapeHtml(racket.racketCode)}">
      <span>
        <strong>${escapeHtml(racket.racketName || "Raketa")}</strong>
        <span class="muted">${plural(getHistoryForRacket(racket.racketCode).length, "vypletení", "vypletení", "vypletení")}</span>
      </span>
    </button>
  `).join("");

  racketsList.querySelectorAll("[data-racket-code]").forEach((button) => {
    button.addEventListener("click", () => openRacketDetail(button.dataset.racketCode));
  });
}

function renderDetail(history) {
  const racket = getSelectedRacket();
  if (!racket) {
    racketDetail.innerHTML = `
      <h2>Vyberte raketu</h2>
      <p class="muted">Naskenujte QR kód na úvodní obrazovce.</p>
    `;
    historyList.innerHTML = "";
    return;
  }

  const lastStringingDate = history[0]?.date;
  const daysSinceLastStringing = getDaysSince(lastStringingDate);
  const serviceNotice = Number.isFinite(daysSinceLastStringing) && daysSinceLastStringing > OLD_STRINGING_DAYS
    ? `<div class="service-notice">Poslední vypletení je staré ${daysSinceLastStringing} dní. Doporučujeme zkontrolovat výplet.</div>`
    : "";

  racketDetail.innerHTML = `
    <h2>${escapeHtml(racket.racketName || "Raketa")}</h2>
    <div class="spec-grid">
      <div class="spec"><span>Majitel</span><strong>${escapeHtml(racket.owner)}</strong></div>
      <div class="spec"><span>Délka strun</span><strong>${escapeHtml(racket.stringLength || "-")}</strong></div>
      <div class="spec"><span>Uzly</span><strong>${escapeHtml(racket.knots || "-")}</strong></div>
    </div>
    ${serviceNotice}
  `;

  if (history.length === 0) {
    historyList.innerHTML = `<p class="muted">Žádná historie pro tuto raketu.</p>`;
    return;
  }

  historyList.innerHTML = history.map((item) => `
    <div class="history-row">
      <strong>${escapeHtml(formatDate(item.date))}</strong>
      <span class="history-string">${escapeHtml(item.stringName || "-")}</span>
      <span class="row-code">${escapeHtml(item.tension || "-")}</span>
    </div>
  `).join("");
}

function renderStrings(strings) {
  if (strings.length === 0) {
    stringsList.innerHTML = `<p class="muted">Žádné výplety pro vybraného majitele.</p>`;
    return;
  }

  stringsList.innerHTML = strings.map((item) => {
    const remaining = Number(item.remaining);
    const hasNumber = Number.isFinite(remaining);
    const isLow = hasNumber && remaining > 0 && remaining < LOW_STRING_THRESHOLD;
    const isEmpty = hasNumber && remaining === 0;
    const pillClass = isLow ? "low" : isEmpty ? "empty" : "";
    const pillText = isEmpty ? "Výplet došel" : `zbývá ${escapeHtml(item.remaining)}`;

    return `
      <article class="string-row">
        <span>
          <strong>${escapeHtml(item.stringName)}</strong>
          <span class="string-meta">naposledy použito ${escapeHtml(formatDate(item.lastUsed))} · napětí ${escapeHtml(item.tension || "-")}</span>
        </span>
        <span class="pill ${pillClass}">${pillText}</span>
      </article>
    `;
  }).join("");
}

function renderStats(rows, strings) {
  const mostUsed = mode(rows.map((row) => row.stringName));
  const commonTension = mode(rows.map((row) => row.tension));
  const totalRemaining = strings.reduce((sum, item) => sum + Number(item.remaining || 0), 0);
  const lastStringing = rows.sort((a, b) => parseDate(b.date) - parseDate(a.date))[0]?.date || "-";
  const averageInterval = getAverageStringingInterval(rows);

  statsGrid.innerHTML = `
    <article class="stat-card">
      <span>Celkem vypletení</span>
      <strong>${rows.length}</strong>
    </article>
    <article class="stat-card">
      <span>Nejobvyklejší výplet</span>
      <strong>${escapeHtml(mostUsed || "-")}</strong>
    </article>
    <article class="stat-card">
      <span>Nejobvyklejší napětí</span>
      <strong>${escapeHtml(commonTension || "-")}</strong>
    </article>
    <article class="stat-card">
      <span>Zbývající výplety</span>
      <strong>${totalRemaining}</strong>
    </article>
    <article class="stat-card">
      <span>Poslední vypletení</span>
      <strong>${escapeHtml(formatDate(lastStringing))}</strong>
    </article>
    <article class="stat-card">
      <span>Průměrný interval</span>
      <strong>${averageInterval ? `${averageInterval} dní` : "-"}</strong>
    </article>
  `;
}

function getAverageStringingInterval(rows) {
  const dates = rows
    .map((row) => parseDate(row.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);

  if (dates.length < 2) return 0;

  const intervals = dates.slice(1).map((date, index) => {
    const previous = dates[index];
    return Math.round((date - previous) / 86400000);
  }).filter((days) => days > 0);

  if (intervals.length === 0) return 0;
  return Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length);
}

function renderMonthChart(rows) {
  if (!monthChart) return;
  const counts = new Map();
  rows.forEach((row) => {
    const date = parseDate(row.date);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const items = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  if (items.length === 0) {
    monthChart.innerHTML = `<p class="muted">Zatím nejsou dostupná data pro graf.</p>`;
    return;
  }

  const max = Math.max(...items.map((item) => item[1]), 1);
  monthChart.innerHTML = items.map(([month, count]) => `
    <div class="month-bar" style="--bar-height: ${Math.max(18, Math.round((count / max) * 100))}%">
      <span>${count}</span>
      <div></div>
      <strong>${formatMonth(month)}</strong>
    </div>
  `).join("");
}

function renderPrices() {
  priceList.innerHTML = prices.map((group) => `
    <article class="price-card">
      <h3>${escapeHtml(group.category)}</h3>
      ${group.items.map((item) => `
        <div class="price-row">
          <span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(item.note)}</small>
          </span>
          <b>${escapeHtml(item.price)}</b>
        </div>
      `).join("")}
    </article>
  `).join("");
}

function mode(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function formatDate(date) {
  const parsed = parseDate(date);
  if (Number.isNaN(parsed.getTime())) return date || "-";
  return new Intl.DateTimeFormat("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

function getDaysSince(date) {
  const parsed = parseDate(date);
  if (Number.isNaN(parsed.getTime())) return NaN;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const parsedStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.floor((todayStart - parsedStart) / 86400000);
}

function parseDate(date) {
  const value = String(date || "").trim();
  const czech = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (czech) return new Date(Number(czech[3]), Number(czech[2]) - 1, Number(czech[1]));
  return new Date(value);
}

function formatMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat("cs-CZ", { month: "short", year: "2-digit" }).format(date);
}

function plural(count, one, few, many) {
  const word = count === 1 ? one : count > 1 && count < 5 ? few : many;
  return `${count} ${word}`;
}

function openDrawer() {
  drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add("open"));
}

function closeDrawer() {
  drawer.classList.remove("open");
  window.setTimeout(() => {
    if (!drawer.classList.contains("open")) drawer.hidden = true;
  }, 180);
}

async function startScan() {
  if (!window.Html5Qrcode || !navigator.mediaDevices?.getUserMedia) {
    showQrDialog();
    return;
  }

  showScannerDialog();
  try {
    state.qrScanner = new Html5Qrcode("qrReader");
    state.scannerRunning = true;
    let handledScan = false;
    const cameraConfig = await getPreferredCameraConfig();
    await state.qrScanner.start(
      cameraConfig,
      {
        fps: 12,
        aspectRatio: 1,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.78);
          return { width: Math.max(size, 240), height: Math.max(size, 240) };
        }
      },
      async (decodedText) => {
        if (handledScan) return;
        handledScan = true;
        const racketCode = extractRacketCode(decodedText);
        await hideScannerDialog();
        openRacketDetail(racketCode);
      },
      () => {}
    );
    window.setTimeout(installTapToFocus, 250);
  } catch (error) {
    await hideScannerDialog();
    showQrDialog();
  }
}

async function getPreferredCameraConfig() {
  try {
    const cameras = await Html5Qrcode.getCameras();
    const backCameras = cameras.filter((camera) => {
      const label = normalize(camera.label);
      return label.includes("back") || label.includes("rear") || label.includes("environment") || label.includes("zadni");
    });
    const usableBackCameras = backCameras.filter((camera) => {
      const label = normalize(camera.label);
      return !label.includes("ultra") && !label.includes("wide") && !label.includes("0.5") && !label.includes("0,5");
    });
    const preferred = usableBackCameras.find((camera) => {
      const label = normalize(camera.label);
      return label.includes("main") || label.includes("1x") || label.includes("standard") || label.includes("hlavni");
    }) || usableBackCameras[0] || backCameras[0];

    if (preferred?.id) return { deviceId: { exact: preferred.id } };
  } catch (error) {
    // Some browsers hide camera labels until permission is granted.
  }
  return { facingMode: "environment" };
}

function installTapToFocus() {
  if (!qrReader) return;
  applyCameraFocus("continuous");
  qrReader.onpointerdown = async () => {
    qrReader.classList.add("focusing");
    const focused = await applyCameraFocus("single-shot");
    if (!focused) await applyCameraFocus("continuous");
    window.setTimeout(() => qrReader.classList.remove("focusing"), 520);
  };
}

async function applyCameraFocus(preferredMode) {
  const track = getScannerVideoTrack();
  if (!track?.applyConstraints || !track.getCapabilities) return false;

  const capabilities = track.getCapabilities();
  const focusModes = capabilities.focusMode || [];
  if (!Array.isArray(focusModes) || focusModes.length === 0) return false;

  const focusMode = focusModes.includes(preferredMode)
    ? preferredMode
    : focusModes.includes("continuous")
      ? "continuous"
      : focusModes.includes("single-shot")
        ? "single-shot"
        : "";

  if (!focusMode) return false;

  try {
    await track.applyConstraints({ advanced: [{ focusMode }] });
    return true;
  } catch (error) {
    return false;
  }
}

function getScannerVideoTrack() {
  const video = qrReader?.querySelector("video");
  const stream = video?.srcObject;
  return stream?.getVideoTracks?.()[0] || null;
}

function extractRacketCode(decodedText) {
  const value = String(decodedText || "").trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    const queryCode = getCodeFromSearchParams(url.searchParams);
    if (queryCode) return queryCode;
    if (url.hash) {
      const hashCode = getCodeFromSearchParams(new URLSearchParams(url.hash.replace(/^#\/?/, "")));
      if (hashCode) return hashCode;
      return url.hash.replace(/^#\/?/, "");
    }
    return getCodeFromPath(url.pathname);
  } catch (error) {
    const match = value.match(/[?&](?:code|kod|racket)=([^&\s]+)/i);
    if (match) return decodeURIComponent(match[1]);
    const hashMatch = value.match(/#\/?([^?\s#]+)/);
    if (hashMatch) return decodeURIComponent(hashMatch[1]);
    return value.split("/").filter(Boolean).pop() || value;
  }
}

function getCodeFromSearchParams(params) {
  return params.get("code") || params.get("kod") || params.get("racket") || params.get("raketa") || "";
}

function getCodeFromPath(pathname) {
  const pathCode = String(pathname || "").split("/").filter(Boolean).pop() || "";
  return /^index\.html?$/i.test(pathCode) ? "" : pathCode;
}

document.querySelectorAll("[data-target]").forEach((button) => {
  button.addEventListener("click", () => setScreen(button.dataset.target));
});

backButton.addEventListener("click", () => {
  if (state.currentScreen === "homeScreen") return;
  setScreen("homeScreen");
});

menuButton.addEventListener("click", openDrawer);
drawerClose.addEventListener("click", closeDrawer);
drawer.addEventListener("click", (event) => {
  if (event.target === drawer) closeDrawer();
});
dialogCloseButton.addEventListener("click", hideQrDialog);
dialogScanButton.addEventListener("click", () => {
  hideQrDialog();
  startScan();
});
qrDialog.addEventListener("click", (event) => {
  if (event.target === qrDialog) hideQrDialog();
});
scannerCloseButton.addEventListener("click", hideScannerDialog);
scannerDialog.addEventListener("click", (event) => {
  if (event.target === scannerDialog) hideScannerDialog();
});
themeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    localStorage.setItem(THEME_STORAGE_KEY, input.value);
    applyTheme(input.value);
  });
});
if (darkModeInput) {
  darkModeInput.addEventListener("change", () => {
    localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkModeInput.checked));
    applyDarkMode(darkModeInput.checked);
  });
}

refreshButton.addEventListener("click", async () => {
  const data = await loadData();
  state.rows = data.rows;
  state.inventory = data.inventory;
  openRacketDetail(state.selectedRacketCode || lookupInput.value);
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedTheme = themeInputs.find((input) => input.checked)?.value || "roland";
  localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
  applyTheme(selectedTheme);
});

document.querySelector("#scanButton").addEventListener("click", startScan);

async function boot() {
  applyTheme();
  applyDarkMode();
  if (sheetUrlInput) sheetUrlInput.value = getSheetUrl();
  const data = await loadData();
  state.rows = data.rows;
  state.inventory = data.inventory;
  const scannedCode = extractRacketCode(window.location.href);
  if (scannedCode) {
    openRacketDetail(scannedCode);
  } else {
    render();
    setScreen("homeScreen");
  }
}

boot();
