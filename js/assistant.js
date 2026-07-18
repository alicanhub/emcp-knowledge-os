(function (global) {
  "use strict";
  const core = global.EMCPCore,
    engine = global.EMCPAssistantEngine,
    escapeHtml = core.escapeHTML,
    asList = (value) => (Array.isArray(value) ? value : value ? [value] : []),
    pick = (language, english, turkish) =>
      language === "tr" ? turkish : english;
  if (!engine) throw new Error("Local assistant engine is unavailable");

  function reasonText(result, language) {
    const reasons = asList(result.reasons).slice(0, 3),
      labels = {
        Title: ["Title matched the question", "Başlık soruyla eşleşti"],
        Abbreviation: ["Abbreviation matched", "Kısaltma eşleşti"],
        Alias: ["Alternative name matched", "Alternatif ad eşleşti"],
        Keyword: ["Keyword matched", "Anahtar kelime eşleşti"],
        Tag: ["Topic tag matched", "Konu etiketi eşleşti"],
        Category: ["Category matched", "Kategori eşleşti"],
        "Related concept": ["Related concept matched", "İlgili kavram eşleşti"],
        Definition: ["Definition matched", "Tanım eşleşti"],
        "Practical use": [
          "Practical guidance matched",
          "Pratik kullanım eşleşti",
        ],
        Example: ["Example matched", "Örnek eşleşti"],
      };
    return reasons.length
      ? reasons
          .map((reason) =>
            pick(language, ...(labels[reason] || [reason, reason])),
          )
          .join(" · ")
      : pick(language, "Relevant local record", "İlgili yerel kayıt");
  }

  function create({
    form,
    questionInput,
    output,
    search,
    normalize = (value) => String(value || "").toLowerCase(),
    getRelatedEntries,
    getRelatedCalculators,
    getRelatedChapters = async () => [],
    openEntry,
    openCalculator = () => {},
    openChapter = () => {},
    getLanguage = () => "en",
    categoryLabel = (value) => value,
    calculatorLabel = (value) => value,
  }) {
    let requestId = 0;

    function emptyResult(title, detail) {
      output.setAttribute("aria-busy", "false");
      output.innerHTML = `<div class="assistant-empty" role="status"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
    }

    function renderNoMatch() {
      const language = getLanguage();
      emptyResult(
        pick(
          language,
          "The local EMCP records do not contain enough evidence to answer this question.",
          "Yerel EMCP kayıtlarında bu soruyu yanıtlamak için yeterli kanıt yok.",
        ),
        pick(
          language,
          "Try a more specific term. Ask EMCP does not use the internet or external AI services.",
          "Daha belirgin bir terim deneyin. EMCP’ye Sor interneti veya harici yapay zekâ hizmetlerini kullanmaz.",
        ),
      );
    }

    function renderAnswer(model, relatedEntries, calculators, chapters) {
      const language = model.understanding.responseLanguage,
        confidenceLabels = {
          high: ["High", "Yüksek"],
          medium: ["Medium", "Orta"],
          low: ["Low", "Düşük"],
        },
        paragraphs = model.paragraphs
          .map(
            ({ title, parts }) =>
              `<section class="assistant-answer-section"><h3>${escapeHtml(title)}</h3>${parts.map((part) => `<p>${escapeHtml(part)}</p>`).join("")}</section>`,
          )
          .join(""),
        insufficiency = model.unsupported.length
          ? `<p class="assistant-insufficient"><strong>${escapeHtml(pick(language, "Evidence limitation:", "Kanıt sınırı:"))}</strong> ${escapeHtml(pick(language, "The approved records do not contain every requested detail, so missing sections were not inferred.", "Onaylı kayıtlar istenen her ayrıntıyı içermediği için eksik bölümler tahmin edilmedi."))}</p>`
          : "",
        evidence = model.evidence
          .map(
            (result) =>
              `<button type="button" class="assistant-source" data-entry-index="${result.index}"><strong>${escapeHtml(result.entry.term || result.entry.title)}</strong><span>${escapeHtml(result.entry.tr || result.entry.category || "")}</span><small>${escapeHtml(reasonText(result, language))}</small><small>${escapeHtml(categoryLabel(result.entry.cat || result.entry.category || ""))}</small></button>`,
          )
          .join(""),
        related = relatedEntries
          .map(
            (item) =>
              `<button type="button" class="assistant-link" data-entry-index="${item.index}">${escapeHtml(item.entry.term || item.entry.title)}<span>${escapeHtml(item.entry.tr || "")}</span></button>`,
          )
          .join(""),
        calculatorCards = calculators
          .map(
            (item) =>
              `<button type="button" class="assistant-link" data-assistant-calculator="${escapeHtml(item.calculator.target || "")}" data-assistant-calculator-page="${escapeHtml(item.calculator.page || "calculators")}">${escapeHtml(calculatorLabel(item.calculator.title))}<span>${escapeHtml(pick(language, "Open calculator", "Hesaplayıcıyı aç"))}</span></button>`,
          )
          .join(""),
        chapterCards = chapters
          .map(
            (chapter) =>
              `<button type="button" class="assistant-link" data-assistant-chapter="${escapeHtml(chapter.id)}">${escapeHtml(chapter.title?.[language] || chapter.title?.en || chapter.id)}<span>${escapeHtml(pick(language, "Open handbook chapter", "El kitabı bölümünü aç"))}</span></button>`,
          )
          .join("");
      output.setAttribute("aria-busy", "false");
      output.innerHTML = `<div class="assistant-confidence assistant-confidence-${model.confidence}" role="status"><span>${escapeHtml(pick(language, "Confidence", "Güven"))}</span><strong>${escapeHtml(pick(language, ...confidenceLabels[model.confidence]))}</strong></div><div class="assistant-answer"><p class="assistant-basis">${escapeHtml(pick(language, `Answer based on ${model.evidence.length} approved local EMCP record${model.evidence.length === 1 ? "" : "s"}.`, `Yanıt ${model.evidence.length} onaylı yerel EMCP kaydına dayanmaktadır.`))}</p>${paragraphs}${insufficiency}</div><section class="assistant-panel" aria-labelledby="assistantEvidenceTitle"><h3 id="assistantEvidenceTitle">${escapeHtml(pick(language, "Evidence used", "Kullanılan kanıtlar"))}</h3><p>${escapeHtml(pick(language, "Every statement above comes only from these approved local EMCP records.", "Yukarıdaki her ifade yalnızca bu onaylı yerel EMCP kayıtlarından alınmıştır."))}</p><div class="assistant-sources">${evidence}</div></section>${related ? `<section class="assistant-panel"><h3>${escapeHtml(pick(language, "Related knowledge", "İlgili bilgiler"))}</h3><div class="assistant-links">${related}</div></section>` : ""}${calculatorCards ? `<section class="assistant-panel"><h3>${escapeHtml(pick(language, "Related calculators", "İlgili hesaplayıcılar"))}</h3><div class="assistant-links">${calculatorCards}</div></section>` : ""}${chapterCards ? `<section class="assistant-panel"><h3>${escapeHtml(pick(language, "Related handbook chapters", "İlgili el kitabı bölümleri"))}</h3><div class="assistant-links">${chapterCards}</div></section>` : ""}`;
      output
        .querySelectorAll("[data-entry-index]")
        .forEach((button) =>
          button.addEventListener("click", () =>
            openEntry(Number(button.dataset.entryIndex)),
          ),
        );
      output
        .querySelectorAll("[data-assistant-calculator]")
        .forEach((button) =>
          button.addEventListener("click", () =>
            openCalculator(
              button.dataset.assistantCalculator,
              button.dataset.assistantCalculatorPage,
            ),
          ),
        );
      output
        .querySelectorAll("[data-assistant-chapter]")
        .forEach((button) =>
          button.addEventListener("click", () =>
            openChapter(button.dataset.assistantChapter),
          ),
        );
    }

    async function ask(question) {
      const activeRequest = ++requestId,
        prompt = String(question || "").trim(),
        guard = global.EMCPAIGuard?.check(prompt),
        language = getLanguage();
      if (guard && !guard.allowed) {
        emptyResult(
          pick(language, "Request limit reached.", "İstek sınırına ulaşıldı."),
          pick(
            language,
            guard.reason === "too_long"
              ? "Keep questions under 1,000 characters."
              : "Please wait briefly before asking again.",
            guard.reason === "too_long"
              ? "Soruları 1.000 karakterin altında tutun."
              : "Tekrar sormadan önce lütfen kısa bir süre bekleyin.",
          ),
        );
        return { found: false, limited: true, results: [] };
      }
      if (!prompt) {
        renderNoMatch();
        return { found: false, results: [] };
      }
      output.setAttribute("aria-busy", "true");
      output.innerHTML = `<div class="assistant-loading">${escapeHtml(pick(language, "Searching approved local EMCP knowledge…", "Onaylı yerel EMCP bilgisinde aranıyor…"))}</div>`;
      try {
        const candidateResults = await Promise.resolve(search(prompt)),
          model = engine.compose({
            question: prompt,
            results: candidateResults,
            normalize,
            language,
          });
        if (activeRequest !== requestId)
          return { found: false, stale: true, results: model.evidence };
        if (!model.found) {
          renderNoMatch();
          return { ...model, results: model.evidence };
        }
        const evidenceIndices = new Set(
            model.evidence.map((result) => result.index),
          ),
          relatedMap = new Map(),
          calculatorMap = new Map();
        for (const result of model.evidence) {
          for (const item of getRelatedEntries(result.index))
            if (!evidenceIndices.has(item.index) && !relatedMap.has(item.index))
              relatedMap.set(item.index, item);
          for (const item of getRelatedCalculators(result.entry))
            if (!calculatorMap.has(item.calculator.title))
              calculatorMap.set(item.calculator.title, item);
        }
        const chapters = await getRelatedChapters(model.evidence);
        if (activeRequest !== requestId)
          return { found: false, stale: true, results: model.evidence };
        renderAnswer(
          model,
          [...relatedMap.values()].slice(0, 5),
          [...calculatorMap.values()].slice(0, 4),
          asList(chapters).slice(0, 4),
        );
        return { ...model, found: true, results: model.evidence };
      } catch (error) {
        if (activeRequest === requestId) renderNoMatch();
        return { found: false, results: [], error };
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      ask(questionInput.value.trim());
    });
    return {
      ask,
      clear() {
        requestId += 1;
        output.innerHTML = "";
        output.setAttribute("aria-busy", "false");
      },
    };
  }

  global.EMCPAssistant = { create };
})(window);
