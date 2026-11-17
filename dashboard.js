(function () {
  "use strict";

  var notice = document.querySelector("#notice");
  if (!window.Skur) {
    notice.hidden = false;
    notice.textContent = "Sidan kunde inte ladda sina skript.";
    return;
  }

  var cfg = Skur.getConfig();
  var periodButtons = Array.prototype.slice.call(document.querySelectorAll(".period-btn"));
  var customFields = document.querySelector("#custom-fields");
  var fromInput = document.querySelector("#from");
  var toInput = document.querySelector("#to");
  var rangeLabel = document.querySelector("#range-label");
  var source = document.querySelector("#source");
  var reloadBtn = document.querySelector("#reload");
  var exportBtn = document.querySelector("#export");
  var seedBtn = document.querySelector("#seed");
  var clearBtn = document.querySelector("#clear-demo");
  var errorBox = document.querySelector("#error");
  var loading = document.querySelector("#loading");
  var results = document.querySelector("#results");
  var statRuns = document.querySelector("#stat-runs");
  var statDone = document.querySelector("#stat-done");
  var statMiss = document.querySelector("#stat-miss");
  var statMissCard = document.querySelector("#stat-miss-card");
  var chart = document.querySelector("#chart");
  var sites = document.querySelector("#sites");
  var onlyMissingBtn = document.querySelector("#only-missing");
  var recent = document.querySelector("#recent");
  var live = document.querySelector("#status");

  var state = {
    period: "week",
    from: "",
    to: "",
    reports: [],
    onlyMissing: false,
    loaded: false,
    loading: false,
    refreshing: false,
    error: "",
    loadedAt: null,
  };
  var loadSeq = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function demoMode() {
    return Skur.configStatus(cfg) !== "ok";
  }

  function defaultFromTo(now) {
    var p = Skur.parts(now);
    return { from: p.year + "-" + p.month + "-01", to: p.year + "-" + p.month + "-" + p.day };
  }

  function readUrl() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    var period = params.get("period");
    var known = { week: 1, month: 1, "last-month": 1, year: 1, custom: 1 };
    if (known[period]) state.period = period;
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.get("from") || "")) state.from = params.get("from");
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.get("to") || "")) state.to = params.get("to");
  }

  function writeUrl() {
    var params = new URLSearchParams();
    params.set("period", state.period);
    if (state.period === "custom") {
      if (state.from) params.set("from", state.from);
      if (state.to) params.set("to", state.to);
    }
    try { history.replaceState(null, "", location.pathname + "?" + params.toString()); } catch (e) { /* file:// */ }
  }

  function currentRange() {
    return Skur.periodRange(state.period, new Date(), state.from, state.to);
  }

  function summarize(reports, names, range) {
    var inPeriod = [];
    var ever = new Map();
    reports.forEach(function (report) {
      var t = Date.parse(report.reported_at);
      if (Number.isNaN(t)) return;
      var prev = ever.get(report.objekt);
      if (!prev || t > Date.parse(prev)) ever.set(report.objekt, report.reported_at);
      if (Skur.inRange(report.reported_at, range)) inPeriod.push(report);
    });
    var rows = names.map(function (objekt) {
      return { objekt: objekt, known: true, count: 0, last: null, lastEver: ever.get(objekt) || null };
    });
    inPeriod.forEach(function (report) {
      var matches = rows.filter(function (row) { return row.objekt === report.objekt; });
      if (!matches.length) {
        matches = [{ objekt: report.objekt, known: false, count: 0, last: null, lastEver: ever.get(report.objekt) || null }];
        rows.push(matches[0]);
      }
      matches.forEach(function (row) {
        row.count += 1;
        if (!row.last || Date.parse(report.reported_at) > Date.parse(row.last)) row.last = report.reported_at;
      });
    });
    return { inPeriod: inPeriod, rows: rows };
  }

  function badgeText(count) {
    if (count === 0) return "Ej körd";
    if (count === 1) return "1 körning";
    return count + " körningar";
  }

  function metaText(row) {
    if (row.count > 0) {
      var text = "Senaste: " + Skur.formatShort(new Date(row.last));
      return row.known ? text : text + ". Inte kvar i objektlistan.";
    }
    if (row.lastEver) return "Ej körd i perioden. Senast " + Skur.formatShort(new Date(row.lastEver)) + ".";
    return "Ej körd i perioden. Ingen tidigare rapport.";
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function toCsv(rows) {
    var lines = [["objekt", "antal", "senaste_iso", "senaste", "status"].map(csvCell).join(";")];
    rows.forEach(function (row) {
      var latest = row.last ? new Date(row.last) : null;
      lines.push([
        row.objekt,
        String(row.count),
        latest ? latest.toISOString() : "",
        latest ? Skur.formatShort(latest) : "",
        row.count ? "körd" : "ej körd",
      ].map(csvCell).join(";"));
    });
    return lines.join("\r\n");
  }

  function fileStamp(date) {
    var p = Skur.parts(date);
    return p.year + "-" + p.month + "-" + p.day;
  }

  function download(filename, text) {
    var blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function renderNotice() {
    var status = Skur.configStatus(cfg);
    notice.replaceChildren();
    seedBtn.hidden = status === "ok";
    clearBtn.hidden = status === "ok";
    if (status === "ok" && !cfg.token) {
      notice.hidden = false;
      notice.append(el("strong", null, "Nyckeln är tom"), el("p", null, "Skriv samma ord vid token i config.js och vid TOKEN i Code.gs."));
      return;
    }
    if (status === "ok") {
      notice.hidden = true;
      return;
    }
    notice.hidden = false;
    if (status === "broken") {
      notice.append(el("strong", null, "config.js kunde inte läsas"), el("p", null, "Kontrollera citattecken och kommatecken."));
      return;
    }
    if (status === "invalid") {
      notice.append(
        el("strong", null, "Adressen ser fel ut"),
        el("p", null, "webAppUrl i config.js ska börja med https://script.google.com/ och sluta med /exec. Tills dess visas demoläge, bara i den här webbläsaren.")
      );
      return;
    }
    notice.append(
      el("strong", null, "Inte konfigurerad än"),
      el("p", null, "Kalkylarket är inte inkopplat. Fyll i exempeldata, eller rapportera från startsidan. Allt sparas bara i den här webbläsaren.")
    );
  }

  function renderChart(rows) {
    var chartRows = rows.filter(function (row) { return row.count > 0; }).sort(function (a, b) {
      return b.count - a.count || a.objekt.localeCompare(b.objekt, "sv");
    });
    chart.replaceChildren();
    if (!chartRows.length) {
      chart.append(el("p", "empty", "Inga körningar i den här perioden."));
      return;
    }
    var max = chartRows[0].count;
    chartRows.forEach(function (row) {
      var item = el("div", "bar");
      var head = el("div", "bar-head");
      head.append(el("span", "bar-name", row.objekt), el("span", "bar-count", String(row.count)));
      var track = el("div", "bar-track");
      track.setAttribute("aria-hidden", "true");
      var fill = el("div", "bar-fill");
      fill.style.width = (row.count / max) * 100 + "%";
      track.append(fill);
      item.append(head, track);
      chart.append(item);
    });
  }

  function renderSites(rows) {
    var visible = state.onlyMissing ? rows.filter(function (row) { return row.count === 0; }) : rows;
    sites.replaceChildren();
    if (!visible.length) {
      sites.append(el("p", "empty", "Alla objekt är körda i den här perioden."));
      return;
    }
    visible.forEach(function (row) {
      var card = el("article", row.count === 0 ? "site-row is-missing" : "site-row");
      var top = el("div", "site-top");
      top.append(el("h3", null, row.objekt), el("span", row.count === 0 ? "badge badge-miss" : "badge", badgeText(row.count)));
      card.append(top, el("p", "site-meta", metaText(row)));
      sites.append(card);
    });
  }

  function renderRecent(inPeriod) {
    recent.replaceChildren();
    if (!inPeriod.length) {
      recent.append(el("li", "empty", "Inga rapporter i den här perioden."));
      return;
    }
    var sorted = inPeriod.slice().sort(function (a, b) {
      return Date.parse(b.reported_at) - Date.parse(a.reported_at) || Date.parse(b.timestamp) - Date.parse(a.timestamp);
    });
    sorted.slice(0, 40).forEach(function (report) {
      var item = el("li", "recent-item");
      var time = document.createElement("time");
      time.dateTime = report.reported_at;
      time.textContent = Skur.formatShort(new Date(report.reported_at));
      item.append(el("span", "recent-name", report.objekt), time);
      var lag = Date.parse(report.timestamp) - Date.parse(report.reported_at);
      if (lag > 30 * 60 * 1000) item.append(el("span", "late", "Rapporterad i efterhand"));
      recent.append(item);
    });
    if (sorted.length > 40) recent.append(el("li", "empty", "Visar 40 av " + sorted.length + "."));
  }

  function render() {
    renderNotice();
    periodButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.period === state.period ? "true" : "false");
    });
    customFields.hidden = state.period !== "custom";
    fromInput.value = state.from;
    toInput.value = state.to;
    onlyMissingBtn.setAttribute("aria-pressed", state.onlyMissing ? "true" : "false");
    onlyMissingBtn.textContent = state.onlyMissing ? "Visa alla objekt" : "Visa bara ej körda";
    reloadBtn.disabled = state.loading || state.refreshing;

    if (state.error) {
      errorBox.hidden = false;
      errorBox.textContent = state.error;
    } else {
      errorBox.hidden = true;
      errorBox.textContent = "";
    }

    if (!state.loaded) {
      loading.hidden = !state.loading;
      results.hidden = true;
      exportBtn.disabled = true;
      rangeLabel.textContent = "";
      source.textContent = "";
      return;
    }

    loading.hidden = true;
    var range = currentRange();
    if (range.error) {
      rangeLabel.textContent = range.error;
      rangeLabel.classList.add("is-bad");
      source.textContent = "";
      results.hidden = true;
      exportBtn.disabled = true;
      live.textContent = range.error;
      return;
    }

    rangeLabel.classList.remove("is-bad");
    rangeLabel.textContent = range.label;
    results.hidden = false;
    exportBtn.disabled = false;

    if (demoMode()) {
      source.textContent = state.reports.length
        ? "Demoläge. Siffrorna finns bara i den här webbläsaren."
        : "Demoläge. Inga rapporter ännu. Gör en rapport, eller fyll i exempeldata.";
    } else if (state.refreshing) {
      source.textContent = "Uppdaterar…";
    } else if (state.loadedAt) {
      source.textContent = "Hämtat från kalkylarket kl. " + Skur.formatClock(state.loadedAt) + ".";
    }

    var summary = summarize(state.reports, cfg.objekt, range);
    var done = summary.rows.filter(function (row) { return row.count > 0; }).length;
    var miss = summary.rows.filter(function (row) { return row.known && row.count === 0; }).length;
    statRuns.textContent = String(summary.inPeriod.length);
    statDone.textContent = String(done);
    statMiss.textContent = String(miss);
    statMissCard.classList.toggle("is-warn", miss > 0);
    renderChart(summary.rows);
    renderSites(summary.rows);
    renderRecent(summary.inPeriod);
    live.textContent = summary.inPeriod.length + " körningar, " + done + " körda objekt, " + miss + " ej körda. " + range.label;
  }

  async function load() {
    var seq = ++loadSeq;
    var remote = Skur.configStatus(cfg) === "ok";
    state.error = "";
    state.loading = remote && !state.loaded;
    state.refreshing = remote && state.loaded;
    render();
    try {
      var reports = await Skur.loadReports(cfg);
      if (seq !== loadSeq) return;
      state.reports = reports;
      state.loaded = true;
      state.loadedAt = new Date();
    } catch (err) {
      if (seq !== loadSeq) return;
      state.error = Skur.humanError(err);
    } finally {
      if (seq === loadSeq) {
        state.loading = false;
        state.refreshing = false;
        render();
      }
    }
  }

  function buildExamples(now) {
    var today = Skur.stockholmYmd(now);
    var rows = [];
    function at(offset, hour, minute, objekt, lateHours) {
      var day = Skur.addDays(today.y, today.m, today.d, offset);
      var when = Skur.wallToDate(day.y, day.m, day.d, hour, minute);
      rows.push({
        timestamp: new Date(when.getTime() + (lateHours || 0.1) * 60 * 60 * 1000).toISOString(),
        objekt: objekt,
        reported_at: when.toISOString(),
      });
    }
    at(0, 6, 50, "Tallbacken", 0.1);
    at(-1, 7, 10, "Tallbacken", 0.1);
    at(0, 9, 30, "Älvdalsskolan Högstadiet", 0.1);
    at(-1, 13, 15, "Rot Skola", 5);
    at(-4, 8, 0, "Sporthallen", 0.2);
    at(-8, 10, 20, "Nodava", 0.2);
    at(-12, 14, 5, "Kommunhuset", 0.2);
    at(-18, 11, 40, "Tingshuset", 0.2);
    at(-27, 9, 15, "Tingshuset", 0.2);
    at(-35, 8, 45, "Brandstationen", 0.2);
    at(-55, 15, 0, "Turistbyrån", 0.2);
    at(-3, 16, 10, "Ambulansen", 0.2);
    return rows;
  }

  periodButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      state.period = button.dataset.period;
      if (state.period === "custom" && (!state.from || !state.to)) {
        var defaults = defaultFromTo(new Date());
        state.from = state.from || defaults.from;
        state.to = state.to || defaults.to;
      }
      writeUrl();
      render();
    });
  });

  fromInput.addEventListener("change", function () {
    state.from = fromInput.value;
    writeUrl();
    render();
  });
  toInput.addEventListener("change", function () {
    state.to = toInput.value;
    writeUrl();
    render();
  });
  onlyMissingBtn.addEventListener("click", function () {
    state.onlyMissing = !state.onlyMissing;
    render();
  });
  reloadBtn.addEventListener("click", function () { load(); });
  exportBtn.addEventListener("click", function () {
    var range = currentRange();
    if (!state.loaded || range.error) return;
    var rows = summarize(state.reports, cfg.objekt, range).rows;
    var end = new Date(range.end.getTime() - 1);
    download("skurmaskin-" + fileStamp(range.start) + "_" + fileStamp(end) + ".csv", toCsv(rows));
  });
  seedBtn.addEventListener("click", function () {
    if (demoMode() === false) return;
    if (Skur.readDemo().length && !window.confirm("Exempeldatan ersätter rapporterna i demoläge på den här telefonen. Fortsätta?")) return;
    try {
      Skur.writeDemo(buildExamples(new Date()));
    } catch (err) {
      state.error = Skur.humanError(err);
      render();
      return;
    }
    state.reports = Skur.readDemo();
    state.loaded = true;
    state.error = "";
    render();
  });
  clearBtn.addEventListener("click", function () {
    if (!window.confirm("Rensa alla rapporter i demoläge på den här telefonen?")) return;
    try { Skur.writeDemo([]); } catch (err) {
      state.error = Skur.humanError(err);
      render();
      return;
    }
    state.reports = [];
    state.loaded = true;
    render();
  });

  try {
    readUrl();
    if (state.period === "custom" && (!state.from || !state.to)) {
      var initial = defaultFromTo(new Date());
      state.from = state.from || initial.from;
      state.to = state.to || initial.to;
    }
    render();
    load();
  } catch (err) {
    notice.hidden = false;
    notice.textContent = "Sidan kunde inte starta. " + (err && err.message ? err.message : "");
  }
})();
