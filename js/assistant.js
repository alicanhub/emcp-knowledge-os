(function (global) {
  const core = global.EMCPCore;
  const escapeHtml = core.escapeHTML;
  const asList = (value) =>
    Array.isArray(value) ? value : value ? [value] : [];

  const pick = (language, english, turkish) =>
    language === "tr" ? turkish : english;

  function buildContext(
    results,
    getRelatedEntries,
    getRelatedCalculators,
    language,
    calculatorLabel = (value) => value,
  ) {
    return {
      entries: results.map((result) => {
        const entry = result.entry;
        return {
          title: entry.term || entry.title,
          aliases: [entry.tr, entry.abbr, ...asList(entry.aliases)].filter(
            Boolean,
          ),
          tags: asList(entry.tags),
          keywords: asList(entry.keywords),
          description:
            language === "tr"
              ? entry.def || entry.description || ""
              : entry.defEn || entry.def || entry.description || "",
          category: entry.cat || entry.category || "",
          relatedEntries: getRelatedEntries(result.index).map((item) => ({
            title: item.entry.term || item.entry.title,
            aliases: [
              item.entry.tr,
              item.entry.abbr,
              ...asList(item.entry.aliases),
            ].filter(Boolean),
            category: item.entry.cat || item.entry.category || "",
          })),
          relatedCalculators: getRelatedCalculators(entry).map((item) => ({
            title: calculatorLabel(item.calculator.title),
            category: item.calculator.categories || [],
            tags: item.calculator.tags || [],
            keywords: item.calculator.keywords || [],
          })),
        };
      }),
    };
  }

  const localProvider = {
    async generate({ question, context, language }) {
      const primary = context.entries[0];
      return `<p><strong>${pick(language, "Local EMCP knowledge found for:", "Şu soru için yerel EMCP bilgisi bulundu:")}</strong> ${escapeHtml(question)}</p><p><strong>${escapeHtml(primary.title)}</strong> — ${escapeHtml(primary.description)}</p><p>${pick(language, "Review the retrieved knowledge cards below for related terminology and practical context.", "İlgili terminoloji ve pratik bağlam için aşağıdaki bilgi kartlarını inceleyin.")}</p>`;
    },
  };

  function create({
    form,
    questionInput,
    output,
    search,
    getRelatedEntries,
    getRelatedCalculators,
    openEntry,
    getLanguage = () => "en",
    categoryLabel = (value) => value,
    calculatorLabel = (value) => value,
  }) {
    let provider = localProvider,
      requestId = 0;

    function renderNoMatch() {
      const language = getLanguage();
      output.setAttribute("aria-busy", "false");
      output.innerHTML = `<div class="assistant-empty"><strong>${pick(language, "No local knowledge found.", "Yerel bilgi bulunamadı.")}</strong><span>${pick(language, "Try a more specific property, construction, investment, finance or compliance term.", "Daha belirgin bir gayrimenkul, inşaat, yatırım, finansman veya uyum terimi deneyin.")}</span></div>`;
    }

    function renderError() {
      const language = getLanguage();
      output.setAttribute("aria-busy", "false");
      output.innerHTML = `<div class="assistant-empty"><strong>${pick(language, "Ask EMCP could not prepare an answer.", "EMCP’ye Sor yanıt hazırlayamadı.")}</strong><span>${pick(language, "Please try again. Your local knowledge library remains available.", "Lütfen yeniden deneyin. Yerel bilgi kütüphaneniz kullanılabilir durumda.")}</span></div>`;
    }

    function renderAnswer(answer, results) {
      const language = getLanguage();
      output.setAttribute("aria-busy", "false");
      const cards = results
        .map(
          (result) =>
            `<button type="button" class="assistant-source" data-entry-index="${result.index}"><strong>${escapeHtml(result.entry.term || result.entry.title)}</strong><span>${escapeHtml(result.entry.tr || result.entry.category || "")}</span><small>${escapeHtml(categoryLabel(result.entry.cat || result.entry.category || ""))}</small></button>`,
        )
        .join("");
      output.innerHTML = `<div class="assistant-answer">${core.sanitizeHTML(answer)}</div><h3 class="assistant-sources-title">${pick(language, "Retrieved Knowledge", "Getirilen Bilgiler")}</h3><div class="assistant-sources">${cards}</div>`;
      output
        .querySelectorAll("[data-entry-index]")
        .forEach((card) =>
          card.addEventListener("click", () =>
            openEntry(Number(card.dataset.entryIndex)),
          ),
        );
    }

    async function ask(question) {
      const activeRequest = ++requestId;
      const prompt = String(question || "").trim();
      const guard = global.EMCPAIGuard?.check(prompt);
      if (guard && !guard.allowed) {
        const language = getLanguage();
        output.setAttribute("aria-busy", "false");
        output.innerHTML = `<div class="assistant-empty"><strong>${pick(language, "Request limit reached.", "İstek sınırına ulaşıldı.")}</strong><span>${pick(language, guard.reason === "too_long" ? "Keep questions under 1,000 characters." : "Please wait briefly before asking again.", guard.reason === "too_long" ? "Soruları 1.000 karakterin altında tutun." : "Tekrar sormadan önce lütfen kısa bir süre bekleyin.")}</span></div>`;
        return {
          found: false,
          limited: true,
          reason: guard.reason,
          results: [],
          context: { entries: [] },
        };
      }
      if (!prompt) {
        renderNoMatch();
        return { found: false, results: [], context: { entries: [] } };
      }
      const candidateResults = search(prompt),
        results = Array.isArray(candidateResults) ? candidateResults : [];
      const strongResults = results
        .filter((result) => result._s >= 80)
        .slice(0, 5);
      if (!strongResults.length) {
        renderNoMatch();
        return { found: false, results: [], context: { entries: [] } };
      }
      const language = getLanguage();
      output.setAttribute("aria-busy", "true");
      output.innerHTML = `<div class="assistant-loading">${pick(language, "Searching local EMCP knowledge…", "Yerel EMCP bilgisinde aranıyor…")}</div>`;
      const context = buildContext(
        strongResults,
        getRelatedEntries,
        getRelatedCalculators,
        language,
        calculatorLabel,
      );
      try {
        const answer = await provider.generate({
          question: prompt,
          context,
          language,
        });
        if (activeRequest !== requestId)
          return { found: false, stale: true, results: strongResults, context };
        renderAnswer(answer, strongResults);
        return { found: true, results: strongResults, context };
      } catch (error) {
        console.error("Ask EMCP provider failed:", error);
        if (activeRequest === requestId) renderError();
        return { found: false, results: strongResults, context, error };
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      ask(questionInput.value.trim());
    });
    return {
      ask,
      clear() {
        requestId++;
        output.innerHTML = "";
        output.setAttribute("aria-busy", "false");
      },
      setProvider(nextProvider) {
        provider =
          nextProvider && typeof nextProvider.generate === "function"
            ? nextProvider
            : localProvider;
      },
      buildContext: (results) =>
        buildContext(
          Array.isArray(results) ? results : [],
          getRelatedEntries,
          getRelatedCalculators,
          getLanguage(),
          calculatorLabel,
        ),
    };
  }

  global.EMCPAssistant = { create, localProvider };
})(window);
