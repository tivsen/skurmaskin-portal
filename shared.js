(function (root) {
  "use strict";

  var TZ = "Europe/Stockholm";
  var STORAGE_KEY = "skurmaskin.reports.v1";
  var WEEKDAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

  var PART_FMT = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  var MONTH_LONG = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, month: "long" });
  var MONTH_SHORT = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, month: "short" });
  var WEEKDAY_LONG = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, weekday: "long" });

  function getConfig() {
    var raw = root.SKUR_CONFIG;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.objekt)) {
      return { webAppUrl: "", token: "", objekt: [], broken: true };
    }
    return {
      webAppUrl: String(raw.webAppUrl || "").trim().replace(/\/+$/, ""),
      token: String(raw.token || "").trim(),
      objekt: raw.objekt.map(function (name) { return String(name).trim(); }).filter(Boolean),
      broken: false,
    };
  }

  function isConfigured(cfg) {
    try {
      var url = new URL(cfg.webAppUrl);
      return url.protocol === "https:" && url.hostname === "script.google.com" && /\/exec$/.test(url.pathname);
    } catch (e) {
      return false;
    }
  }

  function configStatus(cfg) {
    if (cfg.broken) return "broken";
    if (!cfg.webAppUrl) return "missing";
    if (!isConfigured(cfg)) return "invalid";
    return "ok";
  }

  function parts(date) {
    var out = {
      year: "1970",
      month: "01",
      day: "01",
      hour: "00",
      minute: "00",
      second: "00",
      weekday: "Thu",
    };
    var list = PART_FMT.formatToParts(date);
    for (var i = 0; i < list.length; i++) {
      if (list[i].type !== "literal") out[list[i].type] = list[i].value;
    }
    if (out.hour === "24") out.hour = "00";
    out.month = String(out.month).padStart(2, "0");
    out.day = String(out.day).padStart(2, "0");
    out.hour = String(out.hour).padStart(2, "0");
    out.minute = String(out.minute).padStart(2, "0");
    out.second = String(out.second).padStart(2, "0");
    return out;
  }

  function stockholmYmd(date) {
    var p = parts(date);
    return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
  }

  function offsetMinutes(instantMs) {
    var p = parts(new Date(instantMs));
    var wallAsUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    return Math.round((wallAsUtc - instantMs) / 60000);
  }

  // Wall clock in Stockholm -> absolute instant. Two passes so DST is right.
  function wallToDate(y, m, d, h, min) {
    var wallAsUtc = Date.UTC(y, m - 1, d, h, min, 0);
    var utc = wallAsUtc - offsetMinutes(wallAsUtc) * 60000;
    utc = wallAsUtc - offsetMinutes(utc) * 60000;
    return new Date(utc);
  }

  function addDays(y, m, d, n) {
    var t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  function addMonths(y, m, delta) {
    var t = new Date(Date.UTC(y, m - 1 + delta, 1));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: 1 };
  }

  function startOfDay(ymd) {
    return wallToDate(ymd.y, ymd.m, ymd.d, 0, 0);
  }

  function weekdayIndex(date) {
    var name = String(parts(date).weekday || "").slice(0, 3).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(WEEKDAYS, name)) return WEEKDAYS[name];
    throw new Error("Okänd veckodag: " + parts(date).weekday);
  }

  function formatDay(date) {
    var p = parts(date);
    return Number(p.day) + " " + MONTH_SHORT.format(date) + " " + p.year;
  }

  function formatWhen(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    var p = parts(date);
    return WEEKDAY_LONG.format(date) + " " + Number(p.day) + " " + MONTH_LONG.format(date) + " " + p.year + " kl. " + p.hour + ":" + p.minute;
  }

  function formatShort(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    var p = parts(date);
    return Number(p.day) + " " + MONTH_SHORT.format(date) + " " + p.year + ", " + p.hour + ":" + p.minute;
  }

  function formatClock(date) {
    var p = parts(date);
    return p.hour + ":" + p.minute;
  }

  function makeRange(startYmd, endYmd) {
    var start = startOfDay(startYmd);
    var end = startOfDay(endYmd);
    var last = new Date(end.getTime() - 1);
    var a = formatDay(start);
    var b = formatDay(last);
    return { start: start, end: end, label: a === b ? a : a + " – " + b };
  }

  function parseYmd(value) {
    if (!value) return { empty: true };
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return { invalid: true };
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    var check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
      return { invalid: true };
    }
    return { y: y, m: m, d: d };
  }

  function periodRange(kind, now, fromStr, toStr) {
    var today = stockholmYmd(now);
    if (kind === "week") {
      var back = (weekdayIndex(now) + 6) % 7;
      var monday = addDays(today.y, today.m, today.d, -back);
      return makeRange(monday, addDays(monday.y, monday.m, monday.d, 7));
    }
    if (kind === "month") {
      return makeRange({ y: today.y, m: today.m, d: 1 }, addMonths(today.y, today.m, 1));
    }
    if (kind === "last-month") {
      return makeRange(addMonths(today.y, today.m, -1), { y: today.y, m: today.m, d: 1 });
    }
    if (kind === "year") {
      return makeRange({ y: today.y, m: 1, d: 1 }, { y: today.y + 1, m: 1, d: 1 });
    }
    if (kind === "custom") {
      var from = parseYmd(fromStr);
      var to = parseYmd(toStr);
      if (from.empty || to.empty) return { error: "Fyll i både från-datum och till-datum." };
      if (from.invalid || to.invalid) return { error: "Ogiltigt datum." };
      var end = addDays(to.y, to.m, to.d, 1);
      if (startOfDay(end).getTime() <= startOfDay(from).getTime()) {
        return { error: "Till-datumet är före från-datumet." };
      }
      return makeRange(from, end);
    }
    return { error: "Okänd period." };
  }

  function inRange(iso, range) {
    var t = Date.parse(iso);
    if (Number.isNaN(t)) return false;
    return t >= range.start.getTime() && t < range.end.getTime();
  }

  function toDatetimeLocal(date) {
    var p = parts(date);
    return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute;
  }

  function fromDatetimeLocal(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
    if (!match) return null;
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    var h = Number(match[4]);
    var min = Number(match[5]);
    if (m < 1 || m > 12 || h > 23 || min > 59) return null;
    var date = wallToDate(y, m, d, h, min);
    var back = parts(date);
    if (Number(back.year) !== y || Number(back.month) !== m || Number(back.day) !== d || Number(back.hour) !== h || Number(back.minute) !== min) {
      return null;
    }
    return date;
  }

  function fold(value) {
    return String(value || "")
      .toLocaleLowerCase("sv")
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  }

  function normalizeReport(raw) {
    if (!raw || typeof raw !== "object") return null;
    var objekt = String(raw.objekt || "").trim();
    var reported = Date.parse(raw.reported_at);
    if (!objekt || Number.isNaN(reported)) return null;
    var timestamp = Date.parse(raw.timestamp);
    return {
      objekt: objekt,
      reported_at: new Date(reported).toISOString(),
      timestamp: Number.isNaN(timestamp) ? new Date(reported).toISOString() : new Date(timestamp).toISOString(),
    };
  }

  function readDemo() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.map(normalizeReport).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function writeDemo(rows) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-5000)));
  }

  function timeoutSignal() {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(20000);
    }
    return undefined;
  }

  function humanError(err) {
    var message = err && err.message ? String(err.message) : "";
    if (err && err.name === "AbortError") return "Det tog för lång tid. Försök igen.";
    if (err && err.name === "QuotaExceededError") return "Webbläsaren kunde inte spara fler rapporter.";
    if (/Failed to fetch|Load failed|NetworkError|network/i.test(message)) {
      return "Ingen kontakt med kalkylarket. Kontrollera nätet och försök igen.";
    }
    return message || "Något gick fel. Försök igen.";
  }

  async function readJson(response) {
    var text = await response.text();
    try {
      var data = JSON.parse(text);
      if (!data || typeof data !== "object") throw new Error("Oväntat svar från kalkylarket.");
      return data;
    } catch (err) {
      if (err && err.message === "Oväntat svar från kalkylarket.") throw err;
      if (/accounts\.google\.com|ServiceLogin|<html/i.test(text)) {
        throw new Error("Kalkylarket kräver inloggning. Sätt åtkomsten till Alla, inte Alla med Google-konto.");
      }
      throw new Error("Oväntat svar från kalkylarket. Kontrollera adressen i config.js.");
    }
  }

  async function loadReports(cfg) {
    if (configStatus(cfg) !== "ok") return readDemo();
    var url = new URL(cfg.webAppUrl);
    url.searchParams.set("token", cfg.token);
    url.searchParams.set("t", String(Date.now()));
    var response = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
      signal: timeoutSignal(),
    });
    var data = await readJson(response);
    if (!data.ok) throw new Error(data.error || "Kunde inte hämta rapporterna.");
    var rows = Array.isArray(data.rows) ? data.rows : [];
    return rows.map(normalizeReport).filter(Boolean);
  }

  async function submitReport(cfg, objekt, when) {
    var reportedAt = when.toISOString();
    var timestamp = new Date().toISOString();
    if (configStatus(cfg) !== "ok") {
      var row = { timestamp: timestamp, objekt: objekt, reported_at: reportedAt };
      var all = readDemo();
      all.push(row);
      writeDemo(all);
      return row;
    }
    // text/plain håller anropet enkelt så webbläsaren inte skickar en preflight.
    var response = await fetch(cfg.webAppUrl, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ token: cfg.token, objekt: objekt, reported_at: reportedAt }),
      signal: timeoutSignal(),
    });
    var data = await readJson(response);
    if (!data.ok) throw new Error(data.error || "Kunde inte spara.");
    return normalizeReport(data.row) || { timestamp: timestamp, objekt: objekt, reported_at: reportedAt };
  }

  root.Skur = {
    getConfig: getConfig,
    configStatus: configStatus,
    isConfigured: isConfigured,
    parts: parts,
    stockholmYmd: stockholmYmd,
    wallToDate: wallToDate,
    addDays: addDays,
    addMonths: addMonths,
    toDatetimeLocal: toDatetimeLocal,
    fromDatetimeLocal: fromDatetimeLocal,
    formatWhen: formatWhen,
    formatShort: formatShort,
    formatDay: formatDay,
    formatClock: formatClock,
    periodRange: periodRange,
    inRange: inRange,
    fold: fold,
    loadReports: loadReports,
    submitReport: submitReport,
    readDemo: readDemo,
    writeDemo: writeDemo,
    humanError: humanError,
  };
})(typeof window !== "undefined" ? window : globalThis);
