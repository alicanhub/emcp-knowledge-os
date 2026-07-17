(function (global) {
  "use strict";
  const core = global.EMCPCore,
    escape = core.escapeHTML,
    page = document.getElementById("page-handbooks"),
    chapterNav = document.getElementById("handbookChapters"),
    chapterOutput = document.getElementById("handbookChapter"),
    progressOutput = document.getElementById("handbookProgress"),
    titleOutput = document.getElementById("handbookTitle"),
    summaryOutput = document.getElementById("handbookSummary");
  if (!page || !chapterNav || !chapterOutput) return;

  const keys = {
    complete: "emcpHandbookInvestorCompleted",
    saved: "emcpHandbookInvestorSaved",
    notes: "emcpHandbookInvestorNotes",
    collection: "emcpHandbookInvestorCollection",
    last: "emcpHandbookInvestorLastChapter",
  };
  let handbook,
    chapters = [],
    checklists = [],
    caseStudies = [],
    documentGuides = [],
    current = null,
    filter = "all",
    language = core.storage.getRaw("emcpLang") === "en" ? "en" : "tr";
  const pick = (value) => String(value?.[language] || value?.en || value || "");
  const list = (value) => (Array.isArray(value) ? value : []);
  const storedList = (key) => core.storage.get(key, [], core.stringList);
  const storedObject = (key) =>
    core.storage.get(key, {}, (value) => (core.object(value) ? value : {}));
  const setList = (key, values) => core.storage.set(key, [...new Set(values)]);
  const fetchJSON = async (url) => {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Unable to load ${url}`);
    return response.json();
  };
  const textList = (value) =>
    `<ul>${list(value?.[language])
      .map((item) => `<li>${escape(item)}</li>`)
      .join("")}</ul>`;
  const section = (en, tr, body, open = false) =>
    `<details class="handbook-section"${open ? " open" : ""}><summary>${escape(language === "tr" ? tr : en)}</summary><div>${body}</div></details>`;

  function progress() {
    const completed = storedList(keys.complete).filter((id) =>
      chapters.some((chapter) => chapter.id === id),
    ).length;
    const percentage = chapters.length
      ? Math.round((completed / chapters.length) * 100)
      : 0;
    progressOutput.textContent = `${percentage}%`;
    document.getElementById("handbookProgressLabel").textContent =
      language === "tr"
        ? `${completed}/${chapters.length} bölüm tamamlandı`
        : `${completed}/${chapters.length} chapters completed`;
  }

  function renderNav() {
    const saved = new Set(storedList(keys.saved)),
      complete = new Set(storedList(keys.complete)),
      visible =
        filter === "saved"
          ? chapters.filter((chapter) => saved.has(chapter.id))
          : chapters;
    chapterNav.innerHTML = visible.length
      ? visible
          .map(
            (chapter) =>
              `<button type="button" class="handbook-chapter-link${chapter.id === current?.id ? " active" : ""}" data-handbook-chapter="${escape(chapter.id)}" aria-current="${chapter.id === current?.id ? "true" : "false"}"><span>${chapter.chapter_number}. ${escape(pick(chapter.title))}</span><small>${complete.has(chapter.id) ? "✓ " : ""}${saved.has(chapter.id) ? "★" : ""}</small></button>`,
          )
          .join("")
      : `<p>${language === "tr" ? "Henüz kaydedilmiş bölüm yok." : "No saved chapters yet."}</p>`;
  }

  const relatedKnowledge = (chapter) =>
    list(chapter.related_knowledge_entries)
      .map((term) => {
        const index = global.EMCPApp?.entries?.findIndex(
          (entry) => entry.term === term || entry.details?.id === term,
        );
        return `<button type="button" data-handbook-knowledge="${index}"${index < 0 ? " disabled" : ""}>${escape(term)}</button>`;
      })
      .join("");
  const relatedCalculators = (chapter) =>
    list(chapter.related_calculators)
      .map(
        (calculator) =>
          `<button type="button" data-handbook-calculator="${escape(calculator)}">${escape(calculator)} →</button>`,
      )
      .join("");
  function referencedItems(ids, values) {
    return list(ids)
      .map((id) => values.find((item) => item.id === id))
      .filter(Boolean)
      .map(
        (item) =>
          `<li><strong>${escape(pick(item.title))}</strong><p>${escape(pick(item.summary))}</p></li>`,
      )
      .join("");
  }

  function renderChapter(focus = false) {
    if (!current) {
      chapterOutput.innerHTML = `<p>${language === "tr" ? "Başlamak için bir bölüm seçin." : "Choose a chapter to begin."}</p>`;
      return;
    }
    core.storage.setRaw(keys.last, current.id);
    const saved = storedList(keys.saved).includes(current.id),
      completed = storedList(keys.complete).includes(current.id),
      collected = storedList(keys.collection).includes(current.id),
      notes = storedObject(keys.notes),
      checklist = checklists.find((item) => item.id === current.checklist),
      next = chapters.find(
        (item) => item.id === current.next_recommended_chapter,
      ),
      quiz = list(current.quiz)
        .map(
          (item, quizIndex) =>
            `<fieldset><legend>${escape(pick(item.question))}</legend>${list(
              item.options?.[language],
            )
              .map(
                (option, optionIndex) =>
                  `<label><input type="radio" name="handbookQuiz-${quizIndex}" value="${optionIndex}"> ${escape(option)}</label>`,
              )
              .join("")}</fieldset>`,
        )
        .join("");
    chapterOutput.innerHTML = `<header><span class="badge">${language === "tr" ? "Taslak bölüm" : "Draft chapter"}</span><h3>${current.chapter_number}. ${escape(pick(current.title))}</h3><p>${escape(pick(current.summary))}</p></header>
      <div class="handbook-actions"><button type="button" data-handbook-action="toggle-save">${saved ? "★" : "☆"} ${language === "tr" ? "Bölümü kaydet" : "Save chapter"}</button><button type="button" data-handbook-action="toggle-complete">${completed ? "✓ " : ""}${language === "tr" ? "Tamamlandı olarak işaretle" : "Mark as completed"}</button><button type="button" data-handbook-action="toggle-collection">${collected ? "✓ " : ""}${language === "tr" ? "Koleksiyona ekle" : "Add to collection"}</button></div>
      ${section("Simple explanation", "Basit açıklama", `<p>${escape(pick(current.simple_explanation))}</p>`, true)}
      ${section("Professional explanation", "Profesyonel açıklama", `<p>${escape(pick(current.professional_explanation))}</p>`)}
      ${section("Learning objectives", "Öğrenme hedefleri", textList(current.learning_objectives))}
      ${section("Real-world example", "Gerçek hayat örneği", `<p>${escape(pick(current.real_world_example))}</p>`)}
      ${section("Worked example", "Çalışılmış örnek", `<p>${escape(pick(current.worked_example))}</p>`)}
      ${section("Common mistakes", "Yaygın hatalar", textList(current.common_mistakes))}
      ${section("Risks", "Riskler", textList(current.risks))}
      ${section("UK practice", "Birleşik Krallık uygulaması", `<p>${escape(pick(current.uk_practice))}</p>`)}
      ${section("Turkey practice", "Türkiye uygulaması", `<p>${escape(pick(current.turkey_practice))}</p>`)}
      ${section("Beginner questions", "Başlangıç soruları", textList(current.beginner_questions))}
      ${section("Interview-style questions", "Mülakat tarzı sorular", textList(current.interview_questions))}
      ${section("Related concepts", "İlgili kavramlar", `<div class="handbook-related">${relatedKnowledge(current)}</div>`)}
      ${section("Related calculators", "İlgili hesaplayıcılar", `<div class="handbook-related">${relatedCalculators(current) || `<p>${language === "tr" ? "İlgili hesaplayıcı yok." : "No related calculator."}</p>`}</div>`)}
      ${section("Checklist", "Kontrol listesi", checklist ? `<h4>${escape(pick(checklist.title))}</h4>${textList(checklist.items)}<button type="button" data-handbook-action="open-checklist">${language === "tr" ? "Kontrol listesini aç" : "Open checklist"}</button>` : "")}
      ${section("Related documents", "İlgili belgeler", `<ul>${referencedItems(current.related_documents, documentGuides)}</ul>`)}
      ${section("Related case study", "İlgili vaka analizi", `<ul>${referencedItems(current.related_case_studies, caseStudies)}</ul>`)}
      ${section("Short quiz", "Kısa test", quiz)}
      ${section(
        "Official sources",
        "Resmî kaynaklar",
        `<ul>${list(current.official_sources)
          .map(
            (source) =>
              `<li>${source.url ? `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)}</a>` : escape(source.title)} — ${escape(source.status)}</li>`,
          )
          .join("")}</ul>`,
      )}
      <section class="handbook-note"><label for="handbookNote">${language === "tr" ? "Bölüm notu" : "Chapter note"}</label><textarea id="handbookNote" rows="4" maxlength="20000">${escape(notes[current.id] || "")}</textarea><button type="button" data-handbook-action="save-note">${language === "tr" ? "Notu kaydet" : "Save note"}</button><span id="handbookNoteStatus" role="status" aria-live="polite"></span></section>
      <div class="handbook-actions"><button type="button" data-handbook-action="compare">${language === "tr" ? "Senaryoları karşılaştır" : "Compare scenarios"}</button>${next ? `<button type="button" data-handbook-chapter="${escape(next.id)}">${language === "tr" ? "Öğrenmeye devam et" : "Continue learning"} →</button>` : ""}</div>`;
    renderNav();
    progress();
    if (focus) chapterOutput.focus({ preventScroll: true });
  }

  function toggle(key) {
    const values = storedList(key),
      next = values.includes(current.id)
        ? values.filter((id) => id !== current.id)
        : [...values, current.id];
    setList(key, next);
    renderChapter();
  }
  function openChapter(id, focus = true) {
    const chapter = chapters.find((item) => item.id === id);
    if (!chapter) return;
    current = chapter;
    renderChapter(focus);
  }

  page.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.handbookChapter)
      openChapter(button.dataset.handbookChapter);
    if (button.dataset.handbookKnowledge !== undefined) {
      const index = Number(button.dataset.handbookKnowledge);
      if (index >= 0) global.EMCPApp?.openTerm?.(index);
    }
    if (button.dataset.handbookCalculator)
      global.EMCPApp?.showPage?.("calculators");
    const action = button.dataset.handbookAction;
    if (action === "toggle-save") toggle(keys.saved);
    if (action === "toggle-complete") toggle(keys.complete);
    if (action === "toggle-collection") toggle(keys.collection);
    if (action === "saved" || action === "all") {
      filter = action;
      renderNav();
    }
    if (action === "resume")
      openChapter(core.storage.getRaw(keys.last) || chapters[0]?.id);
    if (action === "compare") global.EMCPApp?.showPage?.("calculators");
    if (action === "open-checklist")
      button.closest("details")?.setAttribute("open", "");
    if (action === "save-note" && current) {
      const notes = storedObject(keys.notes),
        input = document.getElementById("handbookNote");
      notes[current.id] = String(input?.value || "").slice(0, 20000);
      core.storage.set(keys.notes, notes);
      document.getElementById("handbookNoteStatus").textContent =
        language === "tr" ? "Kaydedildi" : "Saved";
    }
  });

  async function initialize() {
    if (handbook) return renderChapter();
    try {
      [handbook, chapters, checklists, caseStudies, documentGuides] =
        await Promise.all([
          fetchJSON("content/handbooks/investor/handbook.json"),
          fetchJSON("content/handbooks/investor/chapters.json"),
          fetchJSON("content/checklists/investor-checklists.json"),
          fetchJSON("content/case-studies/investor-case-studies.json"),
          fetchJSON("content/document-guides/property-purchase-documents.json"),
        ]);
      titleOutput.textContent = pick(handbook.title);
      summaryOutput.textContent = pick(handbook.summary);
      current =
        chapters.find(
          (chapter) => chapter.id === core.storage.getRaw(keys.last),
        ) || chapters[0];
      renderChapter();
    } catch (error) {
      chapterOutput.innerHTML = `<p role="alert">${language === "tr" ? "El kitabı yüklenemedi." : "The handbook could not be loaded."}</p>`;
      console.error("Unable to load handbook:", error);
    }
  }
  function setLanguage(value) {
    language = value === "en" ? "en" : "tr";
    if (!handbook) return;
    titleOutput.textContent = pick(handbook.title);
    summaryOutput.textContent = pick(handbook.summary);
    renderChapter();
  }
  global.EMCPHandbook = { initialize, setLanguage, openChapter };
  initialize();
})(window);
