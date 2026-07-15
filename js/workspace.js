(function (global) {
  "use strict";
  const COLLECTIONS_KEY = "emcpCollections",
    NOTES_KEY = "emcpNotes",
    SCENARIOS_KEY = "emcpCalculatorScenarios";
  const core = global.EMCPCore,
    storage = core.storage;
  const i18n = global.EMCPi18n;
  const tr = () => i18n?.language === "tr";
  const pick = (english, turkish) => (tr() ? turkish : english);
  const escapeHtml = core.escapeHTML;
  const id = () =>
    global.crypto?.randomUUID?.() ||
    `workspace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const cleanId = core.cleanId;
  let activeTab = "overview",
    initialized = false;

  const parse = (key, fallback) => storage.get(key, fallback);
  const stringList = (key) => storage.get(key, [], core.stringList);
  function getCollections() {
    return storage.get(COLLECTIONS_KEY, [], core.schemas.collections);
  }
  function setCollections(value) {
    storage.set(COLLECTIONS_KEY, core.schemas.collections(value));
    refresh();
  }
  function getNotes() {
    return storage.get(NOTES_KEY, {}, core.schemas.notes);
  }
  function setNotes(value) {
    storage.set(NOTES_KEY, core.schemas.notes(value));
    refresh();
  }
  const noteKey = (type, key) => `${type}:${key}`;
  const getNote = (type, key) => {
    const value = getNotes()[noteKey(type, key)];
    return typeof value === "string" ? value : "";
  };
  function saveNote(type, key, value) {
    const notes = getNotes(),
      storageKey = noteKey(type, key),
      clean = String(value || "").slice(0, 20000);
    if (clean.trim()) notes[storageKey] = clean;
    else delete notes[storageKey];
    setNotes(notes);
    return clean;
  }
  const scenarios = () =>
    global.EMCPCalculators?.getScenarios?.() || parse(SCENARIOS_KEY, []);
  function pruneScenarioNotes() {
    const valid = new Set(scenarios().map((item) => item.id)),
      notes = getNotes();
    let changed = false;
    Object.keys(notes).forEach((key) => {
      if (key.startsWith("scenario:") && !valid.has(key.slice(9))) {
        delete notes[key];
        changed = true;
      }
    });
    if (changed) storage.set(NOTES_KEY, notes);
  }
  const allTerms = () => global.EMCPKnowledge?.entries || [];
  const termIndex = (name) =>
    allTerms().findIndex((entry) => entry.term === name);

  function show(tab = "overview") {
    activeTab = [
      "overview",
      "favourites",
      "recent",
      "collections",
      "scenarios",
    ].includes(tab)
      ? tab
      : "overview";
    global.showPage?.("workspace");
    render();
  }

  function counts() {
    return {
      favourites: stringList("emcpFav").length,
      recent: stringList("emcpRecent").length,
      collections: getCollections().length,
      scenarios: scenarios().length,
      notes: Object.keys(getNotes()).length,
    };
  }

  function overview() {
    const value = counts();
    return `<div class="workspace-summary"><button type="button" data-show-tab="favourites"><strong>${value.favourites}</strong><span>${pick("Favourites", "Favoriler")}</span></button><button type="button" data-show-tab="recent"><strong>${value.recent}</strong><span>${pick("Recent", "Son Kullanılanlar")}</span></button><button type="button" data-show-tab="collections"><strong>${value.collections}</strong><span>${pick("Collections", "Koleksiyonlar")}</span></button><button type="button" data-show-tab="scenarios"><strong>${value.scenarios}</strong><span>${pick("Scenarios", "Senaryolar")}</span></button><button type="button" data-show-tab="overview"><strong>${value.notes}</strong><span>${pick("Saved notes", "Kayıtlı notlar")}</span></button></div>`;
  }

  function knowledgeList(names, type) {
    const valid = [...new Set(names)]
      .map((name) => ({ name, index: termIndex(name) }))
      .filter((item) => item.index >= 0);
    const title =
      type === "favourites"
        ? pick("Favourites", "Favoriler")
        : pick("Recently viewed", "Son görüntülenenler");
    if (!valid.length)
      return `<div class="empty">${type === "favourites" ? pick("No favourites yet. Open a knowledge entry and add it to favourites.", "Henüz favori yok. Bir bilgi kaydını açıp favorilere ekleyin.") : pick("No recently viewed entries yet.", "Henüz görüntülenen bir kayıt yok.")}</div>`;
    return `<div class="workspace-section-heading"><h3>${title}</h3>${type === "recent" ? `<button type="button" class="workspace-primary" data-action="clear-recent">${pick("Clear recent", "Geçmişi temizle")}</button>` : ""}</div><div class="workspace-knowledge-list">${valid
      .map((item) => {
        const entry = allTerms()[item.index],
          note = getNote("knowledge", entry.term);
        return `<article class="workspace-knowledge-item"><div><strong>${escapeHtml(entry.term)}</strong><span>${escapeHtml(entry.tr)} · ${escapeHtml(tr() ? entry.cat : global.emcpCategoryLabel?.(entry.cat) || entry.cat)}${note ? ` · ${pick("Has note", "Notlu")}` : ""}</span></div><div class="workspace-item-actions"><button type="button" data-action="open-term" data-index="${item.index}">${pick("Open", "Aç")}</button><button type="button" data-action="collection-picker" data-index="${item.index}">${pick("Collections", "Koleksiyonlar")}</button>${type === "favourites" ? `<button type="button" class="danger" data-action="remove-favourite" data-term="${escapeHtml(entry.term)}">${pick("Remove", "Kaldır")}</button>` : ""}</div></article>`;
      })
      .join("")}</div>`;
  }

  function collectionsView() {
    const collections = getCollections();
    const create = `<div class="collection-create"><label class="sr-only" for="newCollectionName">${pick("New collection name", "Yeni koleksiyon adı")}</label><input id="newCollectionName" maxlength="80" placeholder="${pick("New collection name", "Yeni koleksiyon adı")}"><button type="button" data-action="create-collection">${pick("Create collection", "Koleksiyon oluştur")}</button></div>`;
    if (!collections.length)
      return `${create}<div class="empty">${pick("No collections yet. Create one to organise knowledge entries.", "Henüz koleksiyon yok. Bilgi kayıtlarını düzenlemek için bir koleksiyon oluşturun.")}</div>`;
    return `${create}<div class="collection-grid">${collections
      .map(
        (collection) =>
          `<article class="collection-card"><div class="workspace-section-heading"><h4>${escapeHtml(collection.name)}</h4><div class="collection-actions"><button type="button" data-action="rename-collection" data-id="${collection.id}">${pick("Rename", "Yeniden adlandır")}</button><button type="button" class="danger" data-action="delete-collection" data-id="${collection.id}">${pick("Delete", "Sil")}</button></div></div><p>${collection.terms.length} ${pick("entries", "kayıt")}</p><div class="collection-entries">${
            collection.terms.length
              ? collection.terms
                  .map((term) => {
                    const index = termIndex(term);
                    return `<div class="collection-entry"><button type="button" data-action="open-term" data-index="${index}" ${index < 0 ? "disabled" : ""}>${escapeHtml(term)}</button><button type="button" class="remove" data-action="remove-collection-term" data-id="${collection.id}" data-term="${escapeHtml(term)}">${pick("Remove", "Kaldır")}</button></div>`;
                  })
                  .join("")
              : `<span class="scenario-empty">${pick("This collection is empty.", "Bu koleksiyon boş.")}</span>`
          }</div></article>`,
      )
      .join("")}</div>`;
  }

  function scenariosView() {
    const values = scenarios();
    if (!values.length)
      return `<div class="empty">${pick("No saved deal scenarios yet. Save one from the calculator workspace.", "Henüz kayıtlı işlem senaryosu yok. Hesaplayıcı çalışma alanından bir senaryo kaydedin.")}</div>`;
    return `<div class="workspace-scenario-list">${values
      .map((scenario) => {
        const note = getNote("scenario", scenario.id);
        return `<article class="workspace-scenario-card"><h4>${escapeHtml(scenario.name)}</h4><span>${pick("Updated", "Güncellendi")} ${escapeHtml(new Date(scenario.updatedAt).toLocaleString(tr() ? "tr-TR" : "en-GB"))}</span><div class="workspace-item-actions"><button type="button" data-action="open-scenario" data-id="${scenario.id}">${pick("Open in calculators", "Hesaplayıcılarda aç")}</button></div><div class="workspace-note"><label for="scenarioNote-${scenario.id}">${pick("Scenario note", "Senaryo notu")}</label><textarea id="scenarioNote-${scenario.id}" rows="3" maxlength="20000">${escapeHtml(note)}</textarea><button type="button" data-action="save-scenario-note" data-id="${scenario.id}">${pick("Save note", "Notu kaydet")}</button><span class="note-saved" id="scenarioNoteStatus-${scenario.id}"></span></div></article>`;
      })
      .join("")}</div>`;
  }

  function render() {
    const output = document.getElementById("workspaceOutput");
    if (!output) return;
    document.querySelectorAll("[data-workspace-tab]").forEach((button) => {
      const selected = button.dataset.workspaceTab === activeTab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected) output.setAttribute("aria-labelledby", button.id);
    });
    if (activeTab === "overview") output.innerHTML = overview();
    if (activeTab === "favourites")
      output.innerHTML = knowledgeList(stringList("emcpFav"), "favourites");
    if (activeTab === "recent")
      output.innerHTML = knowledgeList(stringList("emcpRecent"), "recent");
    if (activeTab === "collections") output.innerHTML = collectionsView();
    if (activeTab === "scenarios") output.innerHTML = scenariosView();
    refreshCounts();
  }

  function refreshCounts() {
    const value = counts();
    const fav = document.getElementById("favCount"),
      recent = document.getElementById("recentCount");
    if (fav) fav.textContent = value.favourites;
    if (recent) recent.textContent = value.recent;
  }
  function refresh() {
    if (document.getElementById("page-workspace")?.classList.contains("active"))
      render();
    else refreshCounts();
  }

  function createCollection(name, initialTerm) {
    const clean = String(name || "")
      .trim()
      .slice(0, 80);
    if (!clean) return null;
    const values = getCollections();
    if (
      values.some(
        (item) => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase(),
      )
    )
      return null;
    const collection = {
      id: id(),
      name: clean,
      terms: initialTerm ? [initialTerm] : [],
      createdAt: new Date().toISOString(),
    };
    values.push(collection);
    setCollections(values);
    return collection;
  }
  function renameCollection(collectionId, name) {
    const clean = String(name || "")
        .trim()
        .slice(0, 80),
      values = getCollections(),
      collection = values.find((item) => item.id === collectionId);
    if (!clean || !collection) return false;
    collection.name = clean;
    setCollections(values);
    return true;
  }
  function deleteCollection(collectionId) {
    const collection = getCollections().find(
      (item) => item.id === collectionId,
    );
    if (!collection) return false;
    if (
      global.confirm &&
      !global.confirm(
        pick(
          `Delete “${collection.name}”?`,
          `“${collection.name}” silinsin mi?`,
        ),
      )
    )
      return false;
    setCollections(getCollections().filter((item) => item.id !== collectionId));
    return true;
  }
  function setCollectionTerm(collectionId, term, included) {
    const values = getCollections(),
      collection = values.find((item) => item.id === collectionId);
    if (!collection) return false;
    collection.terms = included
      ? [...new Set([...collection.terms, term])]
      : collection.terms.filter((value) => value !== term);
    setCollections(values);
    return true;
  }

  function openCollectionPicker(index) {
    const entry = allTerms()[index];
    if (!entry) return;
    const collections = getCollections();
    const sheet = document.getElementById("sheet");
    if (!sheet) return;
    sheet.innerHTML = `<button type="button" class="close" data-modal-close>×</button><h2>${pick("Add to collections", "Koleksiyonlara ekle")}</h2><p><strong>${escapeHtml(entry.term)}</strong> — ${escapeHtml(entry.tr)}</p><div class="collection-picker">${collections.length ? collections.map((collection) => `<label class="collection-choice"><input type="checkbox" data-collection-toggle="${collection.id}" data-term-index="${index}" ${collection.terms.includes(entry.term) ? "checked" : ""}><span>${escapeHtml(collection.name)}</span></label>`).join("") : `<p>${pick("Create your first collection below.", "İlk koleksiyonunuzu aşağıda oluşturun.")}</p>`}</div><div class="collection-create"><label class="sr-only" for="pickerCollectionName">${pick("New collection name", "Yeni koleksiyon adı")}</label><input id="pickerCollectionName" maxlength="80" placeholder="${pick("New collection name", "Yeni koleksiyon adı")}"><button type="button" data-action="create-collection-for-term" data-index="${index}">${pick("Create and add", "Oluştur ve ekle")}</button></div>`;
    global.showModal?.();
  }
  function toggleCollectionTerm(collectionId, index, included) {
    const entry = allTerms()[index];
    if (entry) setCollectionTerm(collectionId, entry.term, included);
  }
  function createCollectionForTerm(index) {
    const input = document.getElementById("pickerCollectionName"),
      entry = allTerms()[index];
    if (input && entry && createCollection(input.value, entry.term))
      openCollectionPicker(index);
  }

  function knowledgeNoteMarkup(index) {
    const entry = allTerms()[index];
    if (!entry) return "";
    const note = getNote("knowledge", entry.term);
    return `<section class="term-note"><h3>${pick("Personal note", "Kişisel not")}</h3><label class="sr-only" for="knowledgeNoteInput">${pick("Personal note", "Kişisel not")}</label><textarea id="knowledgeNoteInput" rows="4" maxlength="20000" placeholder="${pick("Add a private note stored on this device…", "Bu cihazda saklanan özel bir not ekleyin…")}">${escapeHtml(note)}</textarea><button type="button" data-action="save-knowledge-note" data-index="${index}">${pick("Save note", "Notu kaydet")}</button><span class="note-saved" id="knowledgeNoteStatus" role="status" aria-live="polite"></span></section>`;
  }
  function saveKnowledgeNote(index) {
    const entry = allTerms()[index],
      input = document.getElementById("knowledgeNoteInput");
    if (!entry || !input) return;
    saveNote("knowledge", entry.term, input.value);
    const status = document.getElementById("knowledgeNoteStatus");
    if (status) status.textContent = pick("Saved", "Kaydedildi");
  }

  function buildExport() {
    return {
      format: "emcp-workspace",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        favourites: stringList("emcpFav"),
        recent: stringList("emcpRecent"),
        collections: getCollections(),
        notes: getNotes(),
        scenarios: scenarios(),
        preferences: {
          language: i18n?.language || "tr",
          theme: storage.getRaw("emcpTheme") || "light",
        },
      },
    };
  }
  function validateImport(payload) {
    if (
      !payload ||
      payload.format !== "emcp-workspace" ||
      payload.version !== 1 ||
      !payload.data ||
      typeof payload.data !== "object"
    )
      throw new Error(
        pick(
          "Unsupported workspace backup.",
          "Desteklenmeyen çalışma alanı yedeği.",
        ),
      );
    const data = payload.data;
    const invalid = () => {
      throw new Error(
        pick(
          "The backup contains invalid workspace data.",
          "Yedek geçersiz çalışma alanı verileri içeriyor.",
        ),
      );
    };
    const list = (value) => {
      if (
        !Array.isArray(value) ||
        value.length > 5000 ||
        !value.every((item) => typeof item === "string" && item.length <= 300)
      )
        invalid();
      return [...new Set(value)];
    };
    if (
      !Array.isArray(data.collections) ||
      data.collections.length > 500 ||
      !data.collections.every(
        (item) =>
          item &&
          cleanId(item.id) &&
          typeof item.name === "string" &&
          item.name.length > 0 &&
          item.name.length <= 80 &&
          Array.isArray(item.terms),
      )
    )
      invalid();
    const collections = data.collections.map((item) => ({
      id: cleanId(item.id),
      name: item.name,
      terms: list(item.terms),
      createdAt:
        typeof item.createdAt === "string"
          ? item.createdAt
          : new Date().toISOString(),
    }));
    if (
      !data.notes ||
      typeof data.notes !== "object" ||
      Array.isArray(data.notes) ||
      Object.keys(data.notes).length > 2000
    )
      invalid();
    const notes = {};
    Object.entries(data.notes).forEach(([key, value]) => {
      if (typeof value !== "string" || key.length > 500 || value.length > 20000)
        invalid();
      notes[key] = value;
    });
    if (
      !Array.isArray(data.scenarios) ||
      data.scenarios.length > 1000 ||
      !data.scenarios.every((item) => core.schemas.scenario(item))
    )
      invalid();
    const normalized = core.schemas.workspaceBackup(payload);
    return { ...normalized, collections, notes };
  }
  function importData(payload, askConfirmation = true) {
    const data = validateImport(payload);
    if (
      askConfirmation &&
      global.confirm &&
      !global.confirm(
        pick(
          "Replace current workspace data with this backup?",
          "Mevcut çalışma alanı verileri bu yedekle değiştirilsin mi?",
        ),
      )
    )
      return false;
    const backups = storage.get("emcpWorkspaceAutomaticBackups", []);
    storage.set("emcpWorkspaceAutomaticBackups", [
      ...backups.slice(-4),
      buildExport(),
    ]);
    storage.set("emcpFav", data.favourites);
    storage.set("emcpRecent", data.recent);
    storage.set(COLLECTIONS_KEY, data.collections);
    storage.set(NOTES_KEY, data.notes);
    storage.set(SCENARIOS_KEY, data.scenarios);
    storage.setRaw("emcpTheme", data.preferences.theme);
    document.documentElement.setAttribute("data-theme", data.preferences.theme);
    if (typeof global.setLang === "function")
      global.setLang(data.preferences.language);
    else i18n?.setLanguage(data.preferences.language);
    global.dispatchEvent?.(new CustomEvent("emcp:scenarioschange"));
    refresh();
    return true;
  }
  function getAutomaticBackups() {
    return storage.get("emcpWorkspaceAutomaticBackups", []).slice(-5);
  }
  function restoreAutomaticBackup(index) {
    const backup = getAutomaticBackups()[Number(index)];
    return backup ? importData(backup, false) : false;
  }
  function exportFile() {
    const payload = buildExport(),
      blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `emcp-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    status(
      pick(
        "Workspace data exported.",
        "Çalışma alanı verileri dışa aktarıldı.",
      ),
    );
  }
  function status(message, error = false) {
    const element = document.getElementById("workspaceStatus");
    if (element) {
      element.textContent = message;
      element.classList.toggle("error", error);
    }
  }

  async function importFile(file) {
    try {
      if (!file || file.size > 5_000_000)
        throw new Error(
          pick("Backup file is too large.", "Yedek dosyası çok büyük."),
        );
      const payload = core.parseJSON(await file.text(), null);
      if (importData(payload, true))
        status(
          pick(
            "Workspace data imported.",
            "Çalışma alanı verileri içe aktarıldı.",
          ),
        );
    } catch (error) {
      console.error("Workspace import failed:", error);
      status(
        error.message || pick("Import failed.", "İçe aktarma başarısız."),
        true,
      );
    }
  }

  function handleClick(event) {
    const button = event.target.closest("[data-action],[data-show-tab]");
    if (!button) return;
    if (button.dataset.showTab) {
      activeTab = button.dataset.showTab;
      render();
      return;
    }
    const action = button.dataset.action;
    if (action === "open-term") global.openTerm?.(Number(button.dataset.index));
    if (action === "collection-picker")
      openCollectionPicker(Number(button.dataset.index));
    if (action === "remove-favourite") {
      storage.set(
        "emcpFav",
        stringList("emcpFav").filter((term) => term !== button.dataset.term),
      );
      render();
    }
    if (
      action === "clear-recent" &&
      (!global.confirm ||
        global.confirm(
          pick(
            "Clear recently viewed entries?",
            "Son görüntülenen kayıtlar temizlensin mi?",
          ),
        ))
    ) {
      storage.set("emcpRecent", []);
      render();
    }
    if (action === "create-collection") {
      const input = document.getElementById("newCollectionName");
      if (input && !createCollection(input.value))
        status(
          pick(
            "Enter a unique collection name.",
            "Benzersiz bir koleksiyon adı girin.",
          ),
          true,
        );
    }
    if (action === "rename-collection") {
      const collection = getCollections().find(
          (item) => item.id === button.dataset.id,
        ),
        name = global.prompt?.(
          pick("Collection name", "Koleksiyon adı"),
          collection?.name || "",
        );
      if (name !== null) renameCollection(button.dataset.id, name);
    }
    if (action === "delete-collection") deleteCollection(button.dataset.id);
    if (action === "remove-collection-term")
      setCollectionTerm(button.dataset.id, button.dataset.term, false);
    if (action === "open-scenario") {
      global.showPage?.("calculators");
      requestAnimationFrame(() =>
        global.EMCPCalculators?.loadScenario?.(button.dataset.id),
      );
    }
    if (action === "save-scenario-note") {
      const input = document.getElementById(
        `scenarioNote-${button.dataset.id}`,
      );
      if (input) {
        saveNote("scenario", button.dataset.id, input.value);
        const target = document.getElementById(
          `scenarioNoteStatus-${button.dataset.id}`,
        );
        if (target) target.textContent = pick("Saved", "Kaydedildi");
      }
    }
    if (action === "create-collection-for-term")
      createCollectionForTerm(Number(button.dataset.index));
    if (action === "save-knowledge-note")
      saveKnowledgeNote(Number(button.dataset.index));
  }

  function handleChange(event) {
    const input = event.target.closest("[data-collection-toggle]");
    if (input)
      toggleCollectionTerm(
        input.dataset.collectionToggle,
        Number(input.dataset.termIndex),
        input.checked,
      );
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    const tabs = [...document.querySelectorAll("[data-workspace-tab]")];
    tabs.forEach((button, index) => {
      button.id = `workspaceTab-${button.dataset.workspaceTab}`;
      button.addEventListener("click", () => {
        activeTab = button.dataset.workspaceTab;
        render();
      });
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowLeft")
          next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        tabs[next].click();
        tabs[next].focus();
      });
    });
    document
      .getElementById("workspaceOutput")
      ?.addEventListener("click", handleClick);
    document.getElementById("sheet")?.addEventListener("click", handleClick);
    document.getElementById("sheet")?.addEventListener("change", handleChange);
    document
      .getElementById("exportWorkspace")
      ?.addEventListener("click", exportFile);
    document
      .getElementById("importWorkspace")
      ?.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (file) importFile(file);
        event.target.value = "";
      });
    global.addEventListener?.("emcp:languagechange", render);
    global.addEventListener?.("emcp:scenarioschange", () => {
      pruneScenarioNotes();
      refresh();
    });
    pruneScenarioNotes();
    refreshCounts();
  }

  const api = {
    show,
    render,
    refresh,
    refreshCounts,
    getCollections,
    createCollection,
    renameCollection,
    deleteCollection,
    setCollectionTerm,
    getNotes,
    getNote,
    saveNote,
    knowledgeNoteMarkup,
    saveKnowledgeNote,
    openCollectionPicker,
    toggleCollectionTerm,
    createCollectionForTerm,
    buildExport,
    validateImport,
    importData,
    getAutomaticBackups,
    restoreAutomaticBackup,
  };
  global.EMCPWorkspace = api;
  global.emcpWorkspace = api;
  global.showWorkspace = show;
  global.openCollectionPicker = openCollectionPicker;
  global.toggleCollectionTerm = toggleCollectionTerm;
  global.createCollectionForTerm = createCollectionForTerm;
  global.saveKnowledgeNote = saveKnowledgeNote;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})(window);
