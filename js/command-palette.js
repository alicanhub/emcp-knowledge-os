(function (global) {
  "use strict";

  const STORAGE_SEARCHES = "emcpPaletteSearches";
  const MAX_RESULTS = 120;
  const WINDOW_SIZE = 32;
  const list = (value) => (Array.isArray(value) ? value : []);
  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  const normalize = (value) =>
    global.EMCPBilingualSearch?.normalize(value) ||
    String(value || "")
      .toLocaleLowerCase("tr-TR")
      .trim();

  function subsequencePositions(value, query) {
    const source = normalize(value),
      target = normalize(query).replaceAll(" ", "");
    if (!target) return [];
    const positions = [];
    let cursor = 0;
    for (
      let index = 0;
      index < source.length && cursor < target.length;
      index++
    ) {
      if (source[index] === target[cursor]) {
        positions.push(index);
        cursor++;
      }
    }
    return cursor === target.length ? positions : [];
  }

  function scoreText(value, query) {
    const text = normalize(value),
      needle = normalize(query);
    if (!needle) return 1;
    if (text === needle) return 1200;
    if (text.startsWith(needle)) return 900;
    if (text.includes(needle)) return 700;
    const tokens = needle.split(" ").filter(Boolean);
    if (
      tokens.every((token) =>
        text.split(" ").some((word) => word.startsWith(token)),
      )
    )
      return 500;
    const positions = subsequencePositions(value, query);
    if (positions.length)
      return Math.max(100, 360 - (positions.at(-1) - positions[0]));
    return 0;
  }

  function scoreItem(item, query) {
    const titleScore = scoreText(item.title, query),
      subtitleScore = scoreText(item.subtitle, query) * 0.45,
      keywordScore = Math.max(
        0,
        ...list(item.keywords).map((value) => scoreText(value, query) * 0.7),
      );
    return Math.max(titleScore, subtitleScore, keywordScore);
  }

  function highlight(value, query) {
    const raw = String(value ?? ""),
      needle = normalize(query);
    if (!needle) return escapeHTML(raw);
    const normalized = normalize(raw),
      direct = normalized.indexOf(needle);
    if (direct >= 0 && raw.length === normalized.length)
      return `${escapeHTML(raw.slice(0, direct))}<mark>${escapeHTML(raw.slice(direct, direct + needle.length))}</mark>${escapeHTML(raw.slice(direct + needle.length))}`;
    const positions = new Set(subsequencePositions(raw, query));
    if (!positions.size) return escapeHTML(raw);
    return [...raw]
      .map((character, index) =>
        positions.has(index)
          ? `<mark>${escapeHTML(character)}</mark>`
          : escapeHTML(character),
      )
      .join("");
  }

  function createModel({
    entries = [],
    calculators = [],
    chapters = [],
    commands = [],
  } = {}) {
    const termIndex = new Map(
        entries.map((entry, index) => [
          normalize(entry.term),
          { entry, index },
        ]),
      ),
      chapterIndex = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    function knowledgeItem(entry, index, group = "Knowledge") {
      return {
        id: `knowledge:${index}`,
        group,
        title: entry.term,
        subtitle: entry.tr,
        keywords: [
          entry.abbr,
          entry.cat,
          entry.def,
          entry.defEn,
          ...list(entry.aliases),
          ...list(entry.keywords),
          ...list(entry.tags),
        ].filter(Boolean),
        action: { type: "knowledge", index },
      };
    }
    const knowledgeItems = entries.map((entry, index) =>
        knowledgeItem(
          entry,
          index,
          /regulation|building control|planning permission/i.test(
            [
              entry.term,
              entry.tr,
              entry.cat,
              ...list(entry.tags),
              ...list(entry.keywords),
            ].join(" "),
          )
            ? "Regulations"
            : "Knowledge",
        ),
      ),
      calculatorItems = calculators.map((calculator) => ({
        id: `calculator:${calculator.target}`,
        group:
          calculator.page === "construction"
            ? "Construction Tools"
            : "Calculators",
        title: calculator.title,
        subtitle: calculator.subtitle || calculator.page,
        keywords: calculator.keywords || [],
        action: {
          type: "calculator",
          target: calculator.target,
          page: calculator.page,
        },
      })),
      chapterItems = chapters.map((chapter) => ({
        id: `chapter:${chapter.id}`,
        group: "Investor Handbook",
        title: chapter.title?.en || chapter.id,
        subtitle: chapter.title?.tr || "",
        keywords: [chapter.summary?.en, chapter.summary?.tr].filter(Boolean),
        action: { type: "chapter", id: chapter.id },
      })),
      commandItems = commands.map((command) => ({
        ...command,
        id: `command:${command.id}`,
      }));
    function contextualItems(storage) {
      const favourites = new Set(list(storage.get("emcpFav"))),
        recent = list(storage.get("emcpRecent")),
        lastChapter = chapterIndex.get(
          storage.getRaw?.("emcpHandbookInvestorLastChapter") || "",
        ),
        continueItems = lastChapter
          ? [
              {
                id: `chapter:${lastChapter.id}`,
                group: "Continue Where You Left Off",
                title: lastChapter.title?.en || lastChapter.id,
                subtitle: lastChapter.title?.tr || "",
                keywords: ["continue", "resume", "devam", "sürdür"],
                action: { type: "chapter", id: lastChapter.id },
              },
            ]
          : [];
      return [
        ...[...favourites]
          .map((term) => termIndex.get(normalize(term)))
          .filter(Boolean)
          .map(({ entry, index }) => knowledgeItem(entry, index, "Favourites")),
        ...continueItems,
        ...recent
          .filter((term) => !favourites.has(term))
          .map((term) => termIndex.get(normalize(term)))
          .filter(Boolean)
          .map(({ entry, index }) => knowledgeItem(entry, index, "Recent")),
      ];
    }
    function search(query, storage) {
      const context = contextualItems(storage),
        contextualIds = new Set(context.map((item) => item.id)),
        pool = [
          ...context,
          ...knowledgeItems.filter((item) => !contextualIds.has(item.id)),
          ...chapterItems,
          ...calculatorItems,
          ...commandItems,
        ],
        scored = pool
          .map((item, order) => ({
            item,
            order,
            score: scoreItem(item, query),
          }))
          .filter(({ score }) => score > 0)
          .sort(
            (left, right) =>
              right.score - left.score || left.order - right.order,
          );
      const seen = new Set();
      return scored
        .filter(({ item }) => !seen.has(item.id) && (seen.add(item.id), true))
        .slice(0, MAX_RESULTS)
        .map(({ item, score }) => ({ ...item, score }));
    }
    return {
      search,
      records:
        knowledgeItems.length +
        chapterItems.length +
        calculatorItems.length +
        commandItems.length,
    };
  }

  function createStorage(core) {
    return {
      get(key) {
        return core.storage.get(key, [], core.stringList);
      },
      set(key, value) {
        core.storage.set(key, value);
      },
      getRaw(key) {
        return core.storage.getRaw(key) || "";
      },
    };
  }

  function initialize(options) {
    const root = document.getElementById("commandPalette"),
      input = document.getElementById("commandPaletteInput"),
      output = document.getElementById("commandPaletteResults"),
      status = document.getElementById("commandPaletteStatus"),
      preview = document.getElementById("commandPalettePreview"),
      closeButton = document.getElementById("commandPaletteClose"),
      mobileSearch = document.getElementById("q");
    if (!root || !input || !output || !preview || !status || !closeButton)
      return null;
    const storage = createStorage(global.EMCPCore),
      labels = {
        en: {
          empty: "No matching commands",
          hint: "Try LTV, yield, handbook, calculator or workspace.",
          recent: "Recent searches",
          results: (count) => `${count} results`,
          placeholder: "Search knowledge, tools and commands…",
          close: "Close command palette",
          resultLabel: "Command results",
        },
        tr: {
          empty: "Eşleşen komut bulunamadı",
          hint: "LTV, getiri, el kitabı, hesaplayıcı veya çalışma alanını deneyin.",
          recent: "Son aramalar",
          results: (count) => `${count} sonuç`,
          placeholder: "Bilgi, araç ve komut ara…",
          close: "Komut paletini kapat",
          resultLabel: "Komut sonuçları",
        },
      };
    let model = createModel(options),
      results = [],
      selected = 0,
      returnFocus = null,
      open = false,
      cachedSearches = storage.get(STORAGE_SEARCHES);
    const language = () =>
      document.documentElement.lang === "tr" ? "tr" : "en";
    const allFocusable = () => [
      closeButton,
      input,
      ...output.querySelectorAll("button"),
    ];

    function groupMarkup(items, query, offset = 0) {
      const groups = new Map();
      items.forEach((item, index) => {
        if (!groups.has(item.group)) groups.set(item.group, []);
        groups.get(item.group).push({ item, index: index + offset });
      });
      return [...groups]
        .map(
          ([group, values]) =>
            `<section class="command-group" aria-labelledby="command-group-${normalize(group).replaceAll(" ", "-")}"><h3 id="command-group-${normalize(group).replaceAll(" ", "-")}">${escapeHTML(group)}</h3>${values
              .map(
                ({ item, index }) =>
                  `<button type="button" id="command-option-${index}" class="command-result${index === selected ? " selected" : ""}" data-command-index="${index}"><span class="command-icon" aria-hidden="true">${item.group === "Favourites" ? "★" : item.group === "Recent" ? "↺" : item.group === "Calculators" ? "∑" : item.group === "Construction Tools" ? "◇" : item.group === "Investor Handbook" ? "▤" : item.group === "Regulations" ? "§" : "◆"}</span><span><strong>${highlight(item.title, query)}</strong><small>${highlight(item.subtitle, query)}</small></span><kbd aria-hidden="true">↵</kbd></button>`,
              )
              .join("")}</section>`,
        )
        .join("");
    }

    function render() {
      const query = input.value.trim();
      results = model.search(query, storage);
      selected = Math.min(selected, Math.max(0, results.length - 1));
      if (results.length) {
        const start = Math.max(
          0,
          Math.min(selected - 8, Math.max(0, results.length - WINDOW_SIZE)),
        );
        output.innerHTML = groupMarkup(
          results.slice(start, start + WINDOW_SIZE),
          query,
          start,
        );
        const current = results[selected];
        preview.innerHTML = `<span class="command-preview-icon" aria-hidden="true">${current.group === "Favourites" ? "★" : current.group === "Recent" ? "↺" : current.group === "Calculators" ? "∑" : current.group === "Construction Tools" ? "◇" : current.group === "Investor Handbook" || current.group === "Continue Where You Left Off" ? "▤" : current.group === "Regulations" ? "§" : "◆"}</span><small>${escapeHTML(current.group)}</small><strong>${highlight(current.title, query)}</strong><p>${highlight(current.subtitle, query)}</p><span class="command-preview-action">${escapeHTML(language() === "tr" ? "Açmak için Enter'a basın" : "Press Enter to open")}</span>`;
      } else {
        output.innerHTML = `<div class="command-empty"><strong>${labels[language()].empty}</strong><span>${labels[language()].hint}</span><div class="command-suggestions"><button type="button" data-command-suggestion="LTV">LTV</button><button type="button" data-command-suggestion="yield">Yield</button><button type="button" data-command-suggestion="handbook">Handbook</button></div></div>`;
        preview.innerHTML = `<span class="command-preview-icon" aria-hidden="true">⌕</span><strong>${escapeHTML(labels[language()].empty)}</strong><p>${escapeHTML(labels[language()].hint)}</p>`;
      }
      status.textContent = labels[language()].results(results.length);
    }

    function move(delta) {
      if (!results.length) return;
      selected = (selected + delta + results.length) % results.length;
      render();
      document
        .getElementById(`command-option-${selected}`)
        ?.scrollIntoView({ block: "nearest" });
    }

    function remember(query) {
      if (!query) return;
      storage.set(
        STORAGE_SEARCHES,
        (cachedSearches = [
          query,
          ...cachedSearches.filter(
            (item) => normalize(item) !== normalize(query),
          ),
        ].slice(0, 8)),
      );
    }

    function close() {
      if (!open) return;
      open = false;
      root.classList.remove("show");
      root.setAttribute("aria-hidden", "true");
      document.body.classList.remove("command-palette-open");
      const target = returnFocus;
      returnFocus = null;
      target?.focus?.({ preventScroll: true });
    }

    function execute(index = selected) {
      const result = results[index];
      if (!result) return;
      remember(input.value.trim());
      close();
      options.execute(result.action);
    }

    function show(seed = "") {
      if (
        global.matchMedia?.("(max-width: 760px)").matches &&
        document.activeElement === mobileSearch
      )
        mobileSearch.blur();
      if (!open) returnFocus = document.activeElement;
      open = true;
      selected = 0;
      input.value = seed;
      root.classList.add("show");
      root.setAttribute("aria-hidden", "false");
      document.body.classList.add("command-palette-open");
      render();
      input.focus({ preventScroll: true });
      requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }

    function showHistory() {
      const history = cachedSearches;
      if (!history.length || input.value) return;
      const label = labels[language()].recent;
      output.insertAdjacentHTML(
        "afterbegin",
        `<section class="command-history" aria-label="${escapeHTML(label)}"><h3>${escapeHTML(label)}</h3><div>${history.map((query) => `<button type="button" data-command-suggestion="${escapeHTML(query)}">↺ ${escapeHTML(query)}</button>`).join("")}</div></section>`,
      );
    }

    function setLanguage() {
      const copy = labels[language()];
      input.placeholder = copy.placeholder;
      closeButton.setAttribute("aria-label", copy.close);
      output.setAttribute("aria-label", copy.resultLabel);
      if (open) {
        render();
        showHistory();
      }
    }

    input.addEventListener("input", () => {
      selected = 0;
      render();
      showHistory();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        move(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        execute();
      }
    });
    output.addEventListener("click", (event) => {
      const suggestion = event.target.closest("[data-command-suggestion]");
      if (suggestion) {
        input.value = suggestion.dataset.commandSuggestion;
        input.focus();
        render();
        return;
      }
      const result = event.target.closest("[data-command-index]");
      if (result) execute(Number(result.dataset.commandIndex));
    });
    output.addEventListener("pointermove", (event) => {
      const result = event.target.closest("[data-command-index]");
      if (!result) return;
      const index = Number(result.dataset.commandIndex);
      if (index !== selected) {
        selected = index;
        render();
      }
    });
    closeButton.addEventListener("click", close);
    root.addEventListener("click", (event) => {
      if (event.target === root) close();
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        const items = allFocusable(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    document.addEventListener("keydown", (event) => {
      const target = event.target,
        editable =
          target instanceof HTMLElement &&
          (target.matches("input, textarea, select") ||
            target.isContentEditable),
        shortcut =
          (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k",
        slash = event.key === "/" && !editable;
      if (shortcut || slash) {
        event.preventDefault();
        show();
      }
    });
    mobileSearch.addEventListener("click", (event) => {
      if (
        !global.navigator?.maxTouchPoints &&
        !global.matchMedia?.("(max-width: 760px)").matches
      )
        return;
      event.preventDefault();
      show(mobileSearch.value);
    });
    render();
    showHistory();
    setLanguage();
    return {
      show,
      close,
      refresh(nextOptions) {
        options = { ...options, ...nextOptions };
        model = createModel(options);
        if (open) render();
      },
      setLanguage,
      get open() {
        return open;
      },
    };
  }

  global.EMCPCommandPalette = { createModel, highlight, initialize };
})(typeof self !== "undefined" ? self : window);
