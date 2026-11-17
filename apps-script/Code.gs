/**
 * Skurmaskin-portal
 *
 * Klistra in hela den här filen i kalkylarket:
 * Tillägg > Apps Script (Extensions > Apps Script).
 *
 * Publicera som webbapp:
 *   Kör som: Jag (Execute as: Me)
 *   Vem har åtkomst: Alla (Anyone)
 * Använd inte "Alla med Google-konto". Då måste personalen logga in.
 *
 * TOKEN måste vara exakt samma ord som token i config.js.
 * Nyckeln är bara ett lätt skydd mot skräp. Den syns i sidans kod.
 *
 * doPost lägger till en rad: timestamp (ISO), objekt, reported_at (ISO).
 * doGet svarar med alla rader som JSON.
 *
 * Webbläsaren anropar med ett enkelt CORS-anrop (POST som text/plain).
 * Ändra inte det upplägget. Apps Script svarar inte på preflight.
 *
 * Om du ändrar skriptet senare: Distribuera > Hantera distributioner >
 * pennan > Version: Ny version > Distribuera. Adressen ska vara oförändrad.
 *
 * Lämna SPREADSHEET_ID tom när skriptet ligger i kalkylarket.
 * Fyll bara i id:t om skriptet av någon anledning är fristående.
 */
var TOKEN = "alvdalen-skur";
var SPREADSHEET_ID = "";
var SHEET_NAME = "Rapporter";
var HEADERS = ["timestamp", "objekt", "reported_at"];

function setup() {
  var ss = openSpreadsheet_();
  ss.setSpreadsheetTimeZone("Europe/Stockholm");
  ensureSheet_();
}

function doPost(e) {
  try {
    var body = readBody_(e);
    if (!tokenOk_(body.token)) throw new Error("Ogiltig nyckel.");
    var objekt = cleanObjekt_(body.objekt);
    var reported = normalizeWhen_(body.reported_at);
    var timestamp = new Date().toISOString();
    withLock_(function () {
      var sheet = ensureSheet_();
      var row = sheet.getLastRow() + 1;
      sheet.getRange(row, 1, 1, 3).setNumberFormat("@");
      sheet.getRange(row, 1, 1, 3).setValues([[timestamp, objekt, reported]]);
    });
    return json_({
      ok: true,
      row: { timestamp: timestamp, objekt: objekt, reported_at: reported },
    });
  } catch (err) {
    return json_({ ok: false, error: message_(err) });
  }
}

function doGet(e) {
  try {
    var token = e && e.parameter ? e.parameter.token : "";
    if (!tokenOk_(token)) throw new Error("Ogiltig nyckel.");
    var rows = withLock_(function () {
      return readRows_(ensureSheet_());
    });
    return json_({ ok: true, rows: rows });
  } catch (err) {
    return json_({ ok: false, error: message_(err) });
  }
}

function tokenOk_(value) {
  if (!TOKEN) return false;
  return String(value || "").replace(/^\s+|\s+$/g, "") === TOKEN;
}

function readBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Tom rapport.");
  }
  try {
    var body = JSON.parse(e.postData.contents);
    if (!body || typeof body !== "object") throw new Error("Tom rapport.");
    return body;
  } catch (err) {
    if (err && err.message === "Tom rapport.") throw err;
    throw new Error("Kunde inte läsa rapporten.");
  }
}

function cleanObjekt_(value) {
  var text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "");
  if (!text || text.length > 80) {
    throw new Error("Objekt saknas eller är för långt.");
  }
  return text;
}

function normalizeWhen_(value) {
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) throw new Error("Ogiltig tid.");
  var now = Date.now();
  var day = 24 * 60 * 60 * 1000;
  if (parsed.getTime() > now + 7 * day) throw new Error("Tiden ligger för långt fram.");
  if (parsed.getTime() < now - 5 * 366 * day) throw new Error("Tiden ligger för långt bakåt.");
  return parsed.toISOString();
}

function openSpreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Skriptet hittar inget kalkylark. Öppna det via Tillägg > Apps Script i kalkylarket.");
  }
  return ss;
}

function ensureSheet_() {
  var ss = openSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    var sheets = ss.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
      sheet = sheets[0];
      sheet.setName(SHEET_NAME);
    } else {
      sheet = ss.insertSheet(SHEET_NAME);
    }
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange("A:C").setNumberFormat("@");
    sheet.setColumnWidth(1, 230);
    sheet.setColumnWidth(2, 240);
    sheet.setColumnWidth(3, 230);
  }
  return sheet;
}

function readRows_(sheet) {
  var values = sheet.getDataRange().getValues();
  var start = 0;
  if (values.length && String(values[0][0]).toLowerCase() === "timestamp") start = 1;
  var rows = [];
  for (var i = start; i < values.length; i++) {
    var objekt = String(values[i][1] || "").replace(/^\s+|\s+$/g, "");
    var reported = toIso_(values[i][2]);
    if (!objekt || !reported) continue;
    rows.push({
      timestamp: toIso_(values[i][0]) || reported,
      objekt: objekt,
      reported_at: reported,
    });
  }
  return rows;
}

function toIso_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (value === "" || value === null || typeof value === "undefined") return "";
  var text = String(value).replace(/^\s+|\s+$/g, "");
  if (!text) return "";
  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return "";
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error("Kalkylarket är upptaget. Vänta en stund och försök igen.");
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function message_(err) {
  var text = err && err.message ? String(err.message) : String(err);
  text = text.replace(/^Exception:\s*/, "");
  if (text.indexOf("Lock") !== -1) {
    return "Kalkylarket är upptaget. Vänta en stund och försök igen.";
  }
  return text;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
