(function () {
  "use strict";

  var notice = document.querySelector("#notice");
  if (!window.Skur) {
    notice.hidden = false;
    notice.textContent = "Sidan kunde inte ladda sina skript.";
    return;
  }

  var cfg = Skur.getConfig();
  var list = document.querySelector("#list");
  var search = document.querySelector("#search");
  var count = document.querySelector("#count");
  var dialog = document.querySelector("#sheet");
  var confirmView = document.querySelector("#confirm-view");
  var doneView = document.querySelector("#done-view");
  var title = document.querySelector("#confirm-name");
  var whenInput = document.querySelector("#when");
  var preview = document.querySelector("#when-preview");
  var confirmNote = document.querySelector("#confirm-note");
  var formError = document.querySelector("#form-error");
  var confirmBtn = document.querySelector("#confirm-btn");
  var cancelBtn = document.querySelector("#cancel-btn");
  var doneText = document.querySelector("#done-text");
  var doneTime = document.querySelector("#done-time");
  var doneNote = document.querySelector("#done-note");
  var doneBtn = document.querySelector("#done-btn");

  var selectedIndex = -1;
  var saving = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function demoMode() {
    return Skur.configStatus(cfg) !== "ok";
  }

  function renderNotice() {
    var status = Skur.configStatus(cfg);
    notice.replaceChildren();
    if (status === "ok" && !cfg.token) {
      notice.hidden = false;
      notice.append(
        el("strong", null, "Nyckeln är tom"),
        el("p", null, "Skriv samma ord vid token i config.js och vid TOKEN i Code.gs.")
      );
      return;
    }
    if (status === "ok") {
      notice.hidden = true;
      return;
    }
    notice.hidden = false;
    if (status === "broken") {
      notice.append(
        el("strong", null, "config.js kunde inte läsas"),
        el("p", null, "Kontrollera citattecken och kommatecken. Objektlistan måste vara en lista.")
      );
      return;
    }
    if (status === "invalid") {
      notice.append(
        el("strong", null, "Adressen ser fel ut"),
        el("p", null, "webAppUrl i config.js ska börja med https://script.google.com/ och sluta med /exec. Du kan prova ändå. Rapporten sparas bara i den här webbläsaren.")
      );
      return;
    }
    notice.append(
      el("strong", null, "Inte konfigurerad än"),
      el("p", null, "Kalkylarket är inte inkopplat. Du kan prova ändå: tryck på ett objekt. Rapporten sparas bara i den här webbläsaren, inte för de andra.")
    );
  }

  function renderList() {
    if (cfg.broken) {
      count.textContent = "";
      list.replaceChildren();
      return;
    }
    var query = Skur.fold(search.value.trim());
    var names = cfg.objekt
      .map(function (name, index) { return { name: name, index: index }; })
      .filter(function (item) { return !query || Skur.fold(item.name).includes(query); });
    count.textContent = query ? names.length + " träffar" : cfg.objekt.length + " objekt";
    list.replaceChildren();
    if (!names.length) {
      list.append(el("p", "empty", query ? "Inget objekt matchar sökningen." : "Inga objekt i config.js."));
      return;
    }
    names.forEach(function (item) {
      var button = el("button", "objekt");
      button.type = "button";
      button.dataset.index = String(item.index);
      if (item.index === selectedIndex) button.classList.add("is-selected");
      var chevron = el("span", "chevron", "›");
      chevron.setAttribute("aria-hidden", "true");
      button.append(el("span", "objekt-name", item.name), chevron);
      list.append(button);
    });
  }

  function showError(message) {
    formError.hidden = !message;
    formError.textContent = message || "";
  }

  function confirmLabel() {
    return demoMode() ? "Spara i demoläge" : "Bekräfta";
  }

  function setSaving(on) {
    saving = on;
    confirmBtn.disabled = on;
    cancelBtn.disabled = on;
    whenInput.disabled = on;
    confirmBtn.textContent = on ? "Sparar…" : confirmLabel();
  }

  function futureProblem(date) {
    var day = 24 * 60 * 60 * 1000;
    if (date.getTime() > Date.now() + day) return "Tiden ligger i framtiden. Kontrollera datumet.";
    if (date.getTime() < Date.now() - 5 * 366 * day) return "Tiden ligger för långt bakåt.";
    return "";
  }

  function updatePreview() {
    var date = Skur.fromDatetimeLocal(whenInput.value);
    preview.classList.remove("is-bad");
    if (!date) {
      preview.classList.add("is-bad");
      preview.textContent = "Den tiden finns inte. Kontrollera datumet.";
      return;
    }
    var problem = futureProblem(date);
    if (problem) {
      preview.classList.add("is-bad");
      preview.textContent = problem;
      return;
    }
    preview.textContent = Skur.formatWhen(date) + " (svensk tid)";
  }

  function resetSheet() {
    selectedIndex = -1;
    confirmView.hidden = false;
    doneView.hidden = true;
    dialog.setAttribute("aria-labelledby", "sheet-title");
    setSaving(false);
    showError("");
    renderList();
    if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
  }

  function openDialog() {
    document.body.classList.add("dialog-open");
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "");
    dialog.classList.add("is-fallback");
  }

  function closeDialog() {
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
      return;
    }
    dialog.removeAttribute("open");
    dialog.classList.remove("is-fallback");
    dialog.dispatchEvent(new Event("close"));
  }

  function openConfirm(index) {
    if (saving || cfg.broken) return;
    selectedIndex = index;
    renderList();
    var name = cfg.objekt[index];
    title.textContent = name;
    whenInput.value = Skur.toDatetimeLocal(new Date());
    updatePreview();
    confirmNote.hidden = !demoMode();
    confirmNote.textContent = "Kalkylarket är inte kopplat. Den här rapporten sparas bara i den här webbläsaren.";
    showError("");
    setSaving(false);
    confirmView.hidden = false;
    doneView.hidden = true;
    dialog.setAttribute("aria-labelledby", "sheet-title");
    openDialog();
    confirmBtn.focus();
  }

  function showDone(name, row) {
    confirmView.hidden = true;
    doneView.hidden = false;
    dialog.setAttribute("aria-labelledby", "done-heading");
    doneText.textContent = name + " är rapporterad.";
    doneTime.textContent = Skur.formatWhen(new Date(row.reported_at)) + " (svensk tid)";
    doneNote.hidden = !demoMode();
    doneNote.textContent = "Sparat i demoläge, bara i den här webbläsaren.";
    setSaving(false);
    doneBtn.focus();
  }

  search.addEventListener("input", renderList);
  list.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button || !list.contains(button)) return;
    openConfirm(Number(button.dataset.index));
  });
  whenInput.addEventListener("input", updatePreview);
  cancelBtn.addEventListener("click", function () {
    if (!saving) closeDialog();
  });
  doneBtn.addEventListener("click", closeDialog);
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog && !saving) closeDialog();
  });
  dialog.addEventListener("cancel", function (event) {
    if (saving) event.preventDefault();
  });
  dialog.addEventListener("close", resetSheet);

  confirmView.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (saving) return;
    var name = cfg.objekt[selectedIndex];
    if (!name) return;
    var when = Skur.fromDatetimeLocal(whenInput.value);
    if (!when) {
      showError("Den tiden finns inte. Kontrollera datumet.");
      return;
    }
    var problem = futureProblem(when);
    if (problem) {
      showError(problem);
      return;
    }
    setSaving(true);
    showError("");
    try {
      var row = await Skur.submitReport(cfg, name, when);
      showDone(name, row);
    } catch (err) {
      showError(Skur.humanError(err));
      setSaving(false);
    }
  });

  try {
    renderNotice();
    renderList();
  } catch (err) {
    notice.hidden = false;
    notice.textContent = "Sidan kunde inte starta. " + (err && err.message ? err.message : "");
  }
})();
