const SHEETS = {
  rackets: "Rakety",
  history: "Data",
  strings: "Vyplety",
  stringers: "Vypletaci"
};

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

function doPost(event) {
  try {
    const payload = parsePayload(event);
    const action = payload.action;

    if (action === "login") return json(login(payload));
    if (action === "addRacket") return json(addRacket(payload));
    if (action === "addString") return json(addString(payload));
    if (action === "addStringing") return json(addStringing(payload));

    return json({ ok: false, error: "Neznámá akce." });
  } catch (error) {
    return json({ ok: false, error: error.message || String(error) });
  }
}

function doGet() {
  return json({ ok: true, name: "GJ Strings API" });
}

function login(payload) {
  const email = clean(payload.email).toLowerCase();
  const password = String(payload.password || "");
  if (!email || !password) throw new Error("Vyplňte e-mail a heslo.");

  const sheet = getSheet(SHEETS.stringers);
  const table = readTable(sheet);
  const user = table.rows.find((row) => clean(row.email).toLowerCase() === email);
  if (!user) throw new Error("Přihlášení se nepodařilo.");
  if (!isActive(user.aktivni)) throw new Error("Účet není aktivní.");

  const plainPassword = clean(user.heslo || user.password);
  const salt = clean(user.sul || user.salt);
  const expectedHash = clean(user.heslohash || user.heslo_hash);
  const passwordMatches = plainPassword
    ? password === plainPassword
    : salt && expectedHash && hashPassword(password, salt) === expectedHash;
  if (!passwordMatches) throw new Error("Přihlášení se nepodařilo.");

  const stringer = {
    id: clean(user.id),
    name: clean(user.jmeno),
    email,
    role: clean(user.role || "vypletac")
  };

  return {
    ok: true,
    token: createToken(stringer),
    user: stringer
  };
}

function addRacket(payload) {
  requireUser(payload.token);
  const code = clean(payload.code);
  const name = clean(payload.name);
  const owner = clean(payload.owner);
  const stringLength = clean(payload.stringLength || payload.delka);
  const knots = clean(payload.knots || payload.uzly);

  if (!code) throw new Error("Vyplňte kód rakety.");
  if (!name) throw new Error("Vyplňte název rakety.");
  if (!owner) throw new Error("Vyplňte majitele rakety.");
  if (!stringLength) throw new Error("Vyplňte délku strun.");
  if (!knots) throw new Error("Vyplňte uzly.");

  const sheet = getSheet(SHEETS.rackets);
  const table = readTable(sheet);
  const duplicate = table.rows.some((row) => normalize(row.kod) === normalize(code));
  if (duplicate) throw new Error("Raketa s tímto kódem už existuje.");

  appendByHeaders(sheet, table.headers, {
    kod: code,
    nazev: name,
    majitel: owner,
    delka: stringLength,
    uzly: knots
  });

  return { ok: true, racket: { code, name, owner, stringLength, knots } };
}

function addString(payload) {
  const user = requireUser(payload.token);
  const code = clean(payload.code).toUpperCase();
  const name = clean(payload.name);
  const quantity = Number(payload.quantity);
  const owner = clean(payload.owner) || user.name;

  if (!code) throw new Error("Vyplňte kód výpletu.");
  if (!name) throw new Error("Vyplňte název výpletu.");
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Vyplňte správný počet výpletů.");
  if (!owner) throw new Error("Chybí majitel výpletu.");

  const sheet = getSheet(SHEETS.strings);
  const table = readTable(sheet);
  const duplicate = table.rows.some((row) => normalize(row.kod) === normalize(code));
  if (duplicate) throw new Error("Výplet s tímto kódem už existuje.");

  appendByHeaders(sheet, table.headers, {
    kod: code,
    majitel: owner,
    nazev: name,
    mnozstvi: quantity
  });

  return { ok: true, string: { code, owner, name, quantity } };
}

function addStringing(payload) {
  const user = requireUser(payload.token);
  const racketCode = clean(payload.racketCode || payload.kod);
  const stringCode = clean(payload.stringCode || payload.typ).toUpperCase();
  const tension = clean(payload.tension || payload.napeti);
  const date = clean(payload.date || payload.datum) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy");

  if (!racketCode) throw new Error("Chybí kód rakety.");
  if (!stringCode) throw new Error("Chybí kód výpletu.");
  if (!tension) throw new Error("Vyplňte napětí.");

  decrementStringStock(stringCode);

  const sheet = getSheet(SHEETS.history);
  const table = readTable(sheet);
  appendByHeaders(sheet, table.headers, {
    kod: racketCode,
    datum: date,
    typ: stringCode,
    napeti: tension
  });

  return {
    ok: true,
    stringing: { racketCode, stringCode, tension, date, stringer: user.name }
  };
}

function decrementStringStock(stringCode) {
  const sheet = getSheet(SHEETS.strings);
  const table = readTable(sheet);
  const codeColumn = table.headerMap.kod;
  const quantityColumn = table.headerMap.mnozstvi;
  if (!codeColumn || !quantityColumn) throw new Error("List Vyplety musí mít sloupce kod a mnozstvi.");

  const rowIndex = table.rows.findIndex((row) => normalize(row.kod) === normalize(stringCode));
  if (rowIndex === -1) throw new Error("Výplet s tímto kódem neexistuje.");

  const sheetRow = rowIndex + 2;
  const current = Number(sheet.getRange(sheetRow, quantityColumn).getValue() || 0);
  if (!Number.isFinite(current)) throw new Error("Počet výpletů není číslo.");
  if (current <= 0) throw new Error("Výplet došel.");

  sheet.getRange(sheetRow, quantityColumn).setValue(current - 1);
}

function requireUser(token) {
  const user = verifyToken(token);
  if (!user) throw new Error("Přihlášení vypršelo. Přihlaste se znovu.");
  return user;
}

function parsePayload(event) {
  const raw = event?.postData?.contents || "{}";
  return JSON.parse(raw);
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error(`Chybí list ${name}.`);
  return sheet;
}

function readTable(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) throw new Error(`List ${sheet.getName()} je prázdný.`);
  const headers = values[0].map((header) => normalizeHeader(header));
  const headerMap = {};
  headers.forEach((header, index) => {
    if (header) headerMap[header] = index + 1;
  });
  const rows = values.slice(1).filter((row) => row.some((cell) => clean(cell))).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      if (header) item[header] = row[index];
    });
    return item;
  });
  return { headers, headerMap, rows };
}

function appendByHeaders(sheet, headers, data) {
  const row = headers.map((header) => data[header] ?? "");
  sheet.appendRow(row);
}

function createToken(user) {
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const body = base64Url(JSON.stringify({ user, expires }));
  const signature = sign(body);
  return `${body}.${signature}`;
}

function base64Url(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/, "");
}

function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (sign(body) !== signature) return null;
  const data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(body)).getDataAsString());
  if (!data.expires || data.expires < Math.floor(Date.now() / 1000)) return null;
  return data.user || null;
}

function sign(value) {
  const bytes = Utilities.computeHmacSha256Signature(value, getSecret());
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function getSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("TOKEN_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("TOKEN_SECRET", secret);
  }
  return secret;
}

function hashPassword(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${salt}:${password}`);
  return bytes.map((byte) => (`0${(byte < 0 ? byte + 256 : byte).toString(16)}`).slice(-2)).join("");
}

function vytvorHashHesla(password) {
  const salt = Utilities.getUuid();
  return {
    sul: salt,
    heslo_hash: hashPassword(password, salt)
  };
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeHeader(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function isActive(value) {
  const normalized = normalize(value);
  return ["ano", "active", "aktivni", "1", "true"].includes(normalized);
}
