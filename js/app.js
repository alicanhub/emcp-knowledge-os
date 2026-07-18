let TERMS = [];
const core = window.EMCPCore,
  knowledge = window.EMCPKnowledge;
const {
  q,
  clearBtn,
  trBtn,
  enBtn,
  themeBtn,
  cats,
  count,
  grid,
  sheet,
  favCount,
  recentCount,
  navHome,
  navKnowledge,
  navHandbooks,
  navCalc,
  navBuild,
  retryKnowledge,
  knowledgeErrorTitle,
  knowledgeErrorText,
} = window.EMCPDOM.collect([
  "q",
  "clearBtn",
  "trBtn",
  "enBtn",
  "themeBtn",
  "cats",
  "count",
  "grid",
  "sheet",
  "favCount",
  "recentCount",
  "navHome",
  "navKnowledge",
  "navHandbooks",
  "navCalc",
  "navBuild",
  "retryKnowledge",
  "knowledgeErrorTitle",
  "knowledgeErrorText",
]);
let lang = core.storage.getRaw("emcpLang") || "tr",
  activeCat = "Tümü";
let currentTermIndex = null;
let knowledgeLoadError = null;
let activePage = "home";
let intelligence = null;
let mapFocusIndex = 0;
let commandPalette = null;
const ui = window.EMCPi18n;
const pick = (english, turkish) =>
  ui ? ui.pick(english, turkish) : lang === "tr" ? turkish : english;
const CATEGORY_EN = {
  "Sermaye ve Yatırım": "Capital & Investment",
  Finansman: "Finance",
  "Hukuk ve İnceleme": "Legal & Due Diligence",
  "Gayrimenkul ve Geliştirme": "Property & Development",
  "Planlama ve Kamu": "Planning & Public Sector",
  "İnşaat ve Teslim": "Construction & Delivery",
  "Uyum ve Kurumsal": "Compliance & Corporate",
  "İletişim ve Belgeler": "Communications & Documents",
};
const CALCULATOR_TR = {
  "Rental Yield": "Kira Getirisi",
  "Development Profit": "Geliştirme Kârı",
  "Monthly Loan Payment": "Aylık Kredi Ödemesi",
  "Arrangement Fee": "Kredi Düzenleme Ücreti",
  "Interest Roll-up": "Birikmiş Faiz",
  "Concrete Volume": "Beton Hacmi",
  "Paint Area": "Boya Alanı",
  "Flooring Area": "Zemin Alanı",
  "Plasterboard Sheets": "Alçıpan Levha",
  "Insulation Area": "Yalıtım Alanı",
  "Tiles Quantity": "Karo Adedi",
};
const categoryLabel = (category) =>
  lang === "tr" ? category : CATEGORY_EN[category] || category;
const calculatorLabel = (title) =>
  lang === "tr" ? CALCULATOR_TR[title] || title : title;
window.emcpCategoryLabel = categoryLabel;
const norm = knowledge.normalize;
const esc = core.escapeHTML;
const RELATED_CALCULATORS = [
  {
    title: "LTV",
    page: "calculators",
    target: "ltvLoan",
    categories: ["Finansman", "Gayrimenkul ve Geliştirme"],
    tags: ["loan", "property value", "lending"],
    keywords: ["ltv", "debt", "finance"],
    aliases: ["loan to value"],
  },
  {
    title: "LTC",
    page: "calculators",
    target: "ltcLoan",
    categories: ["Finansman", "Gayrimenkul ve Geliştirme"],
    tags: ["loan", "total cost", "development"],
    keywords: ["ltc", "debt", "finance"],
    aliases: ["loan to cost"],
  },
  {
    title: "LTGDV",
    page: "calculators",
    target: "ltgdvLoan",
    categories: ["Finansman", "Gayrimenkul ve Geliştirme"],
    tags: ["loan", "gdv", "development"],
    keywords: ["ltgdv", "debt", "finance"],
    aliases: ["loan to gross development value"],
  },
  {
    title: "ROI",
    page: "calculators",
    target: "roiProfit",
    categories: ["Sermaye ve Yatırım", "Finansman"],
    tags: ["profit", "investment", "return"],
    keywords: ["roi", "finance"],
    aliases: ["return on investment"],
  },
  {
    title: "Rental Yield",
    page: "calculators",
    target: "yieldRent",
    categories: ["Gayrimenkul ve Geliştirme", "Finansman"],
    tags: ["rent", "property value", "investment"],
    keywords: ["yield", "rental"],
    aliases: ["rental yield"],
  },
  {
    title: "Development Profit",
    page: "calculators",
    target: "devGdv",
    categories: ["Gayrimenkul ve Geliştirme", "Finansman"],
    tags: ["gdv", "development cost", "profit"],
    keywords: ["development", "return"],
    aliases: ["development profit"],
  },
  {
    title: "Monthly Loan Payment",
    page: "calculators",
    target: "loanPrincipal",
    categories: ["Finansman"],
    tags: ["loan", "interest", "payment"],
    keywords: ["debt", "finance"],
    aliases: ["mortgage payment"],
  },
  {
    title: "Arrangement Fee",
    page: "calculators",
    target: "feeLoan",
    categories: ["Finansman"],
    tags: ["loan", "fee", "lending"],
    keywords: ["finance", "arrangement"],
    aliases: ["loan fee"],
  },
  {
    title: "Interest Roll-up",
    page: "calculators",
    target: "rollLoan",
    categories: ["Finansman"],
    tags: ["loan", "interest", "development"],
    keywords: ["finance", "roll up"],
    aliases: ["rolled up interest"],
  },
  {
    title: "Concrete Volume",
    page: "construction",
    target: "cLen",
    categories: ["İnşaat ve Teslim"],
    tags: ["concrete", "volume", "materials"],
    keywords: ["construction", "site"],
    aliases: ["concrete"],
  },
  {
    title: "Paint Area",
    page: "construction",
    target: "pLen",
    categories: ["İnşaat ve Teslim"],
    tags: ["paint", "wall", "area"],
    keywords: ["construction", "materials"],
    aliases: ["painting"],
  },
  {
    title: "Flooring Area",
    page: "construction",
    target: "fLen",
    categories: ["İnşaat ve Teslim"],
    tags: ["flooring", "area", "materials"],
    keywords: ["construction", "site"],
    aliases: ["floor area"],
  },
  {
    title: "Plasterboard Sheets",
    page: "construction",
    target: "pbArea",
    categories: ["İnşaat ve Teslim"],
    tags: ["plasterboard", "wall", "materials"],
    keywords: ["construction", "site"],
    aliases: ["drywall"],
  },
  {
    title: "Insulation Area",
    page: "construction",
    target: "insArea",
    categories: ["İnşaat ve Teslim"],
    tags: ["insulation", "area", "materials"],
    keywords: ["construction", "site"],
    aliases: ["insulation"],
  },
  {
    title: "Tiles Quantity",
    page: "construction",
    target: "tileArea",
    categories: ["İnşaat ve Teslim"],
    tags: ["tiles", "area", "materials"],
    keywords: ["construction", "site"],
    aliases: ["tiling"],
  },
];
const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const normalizedSet = (value) => new Set(list(value).map(norm).filter(Boolean));
function sharedCount(left, right) {
  const leftValues = normalizedSet(left),
    rightValues = normalizedSet(right);
  let total = 0;
  leftValues.forEach((value) => {
    if (rightValues.has(value)) total++;
  });
  return total;
}
function relationScore(left, right) {
  const sharedCategory = sharedCount(
      left.cat || left.category,
      right.cat || right.category || right.categories,
    ),
    sharedTags = sharedCount(left.tags, right.tags),
    sharedKeywords = sharedCount(left.keywords, right.keywords),
    sharedAliases = sharedCount(
      [left.tr, left.abbr, ...list(left.aliases)],
      [right.tr, right.abbr, ...list(right.aliases)],
    );
  return (
    sharedCategory * 20 +
    sharedTags * 24 +
    sharedKeywords * 18 +
    sharedAliases * 12
  );
}
function getRelatedEntries(currentIndex) {
  const precomputed = knowledge.related?.(currentIndex) || [];
  if (precomputed.length)
    return precomputed
      .map((index) => ({ entry: TERMS[index], index, score: 1 }))
      .filter((item) => item.entry)
      .slice(0, 5);
  const current = TERMS[currentIndex],
    scored = TERMS.map((entry, index) => ({
      entry,
      index,
      score: relationScore(current, entry),
    }))
      .filter((item) => item.index !== currentIndex)
      .sort(
        (a, b) =>
          b.score - a.score || a.entry.term.localeCompare(b.entry.term, "en"),
      ),
    strong = scored.filter((item) => item.score > 20),
    sameCategory = scored.filter(
      (item) => norm(item.entry.cat) === norm(current.cat),
    );
  const ordered = [...strong, ...sameCategory, ...scored],
    seen = new Set();
  return ordered
    .filter((item) => !seen.has(item.index) && (seen.add(item.index), true))
    .slice(0, 5);
}
function getRelatedCalculators(entry) {
  return RELATED_CALCULATORS.map((calculator) => ({
    calculator,
    score: relationScore(entry, calculator),
  }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.calculator.title.localeCompare(b.calculator.title),
    )
    .slice(0, 3);
}
function openCalculator(target, page) {
  showPage(page);
  (window.EMCPFeatures?.load(page) || Promise.resolve()).then(() =>
    requestAnimationFrame(() => {
      const input = document.getElementById(target);
      if (input) {
        window.EMCPAccessibility?.scrollIntoView(input.closest(".calc"), {
          block: "center",
        });
        input.focus({ preventScroll: true });
      }
    }),
  );
}
const PALETTE_COMMANDS = [
  {
    id: "workspace-overview",
    group: "Workspace",
    title: "My Workspace",
    subtitle: "Çalışma Alanım",
    keywords: ["notes", "collections", "workspace", "notlar", "koleksiyonlar"],
    action: { type: "workspace", view: "overview" },
  },
  {
    id: "workspace-favourites",
    group: "Workspace",
    title: "Open Favourites",
    subtitle: "Favorileri aç",
    keywords: ["saved", "starred", "favourites", "favoriler"],
    action: { type: "workspace", view: "favourites" },
  },
  {
    id: "workspace-recent",
    group: "Workspace",
    title: "Recently Viewed",
    subtitle: "Yakın zamanda görüntülenenler",
    keywords: ["history", "recent", "geçmiş", "son"],
    action: { type: "workspace", view: "recent" },
  },
];
function executePaletteAction(action) {
  if (!action) return false;
  if (action.type === "knowledge") return openTerm(action.index);
  if (action.type === "calculator") {
    openCalculator(action.target, action.page);
    return true;
  }
  if (action.type === "workspace") {
    window.showWorkspace?.(action.view);
    return true;
  }
  if (action.type === "chapter") {
    showPage("handbooks");
    (window.EMCPFeatures?.load("handbooks") || Promise.resolve()).then(() =>
      window.EMCPHandbook?.openChapter?.(action.id, true),
    );
    return true;
  }
  return false;
}
function initializeCommandPalette(chapters = []) {
  const options = {
    entries: TERMS,
    calculators: RELATED_CALCULATORS,
    chapters,
    commands: PALETTE_COMMANDS,
    execute: executePaletteAction,
  };
  if (commandPalette) commandPalette.refresh(options);
  else commandPalette = window.EMCPCommandPalette?.initialize(options) || null;
  window.emcpCommandPalette = commandPalette;
}
function relatedContent(index, entry) {
  const related = getRelatedEntries(index),
    calculators = getRelatedCalculators(entry),
    knowledgeItems = related
      .map(
        (item) =>
          `<button type="button" class="related-item" data-open-term="${item.index}"><strong>${esc(item.entry.term)}</strong><span>${esc(item.entry.tr)}</span></button>`,
      )
      .join(""),
    calculatorItems = calculators
      .map(
        (item) =>
          `<button type="button" class="related-item" data-calculator-target="${esc(item.calculator.target)}" data-calculator-page="${esc(item.calculator.page)}"><strong>${esc(calculatorLabel(item.calculator.title))}</strong><span>${pick("Open calculator →", "Hesaplayıcıyı aç →")}</span></button>`,
      )
      .join("");
  return `<section class="related-content"><h3>${pick("Related Knowledge", "İlgili Bilgiler")}</h3><div class="related-list">${knowledgeItems}</div><h3>${pick("Related Calculators", "İlgili Hesaplayıcılar")}</h3><div class="related-list">${calculatorItems || `<p class="related-empty">${pick("No directly related calculators.", "Doğrudan ilgili hesaplayıcı yok.")}</p>`}</div></section>`;
}
const detailText = (value) => esc(lang === "tr" ? value?.tr : value?.en);
const detailList = (value) => {
  const items = lang === "tr" ? value?.tr : value?.en;
  return list(items).length
    ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
    : `<p class="related-empty">${pick("Not yet supplied.", "Henüz eklenmedi.")}</p>`;
};
function expandable(titleEn, titleTr, content, open = false) {
  return `<details class="knowledge-section"${open ? " open" : ""}><summary>${esc(pick(titleEn, titleTr))}</summary><div class="knowledge-section-body">${content}</div></details>`;
}
function questionsMarkup(value) {
  const items = lang === "tr" ? value?.tr : value?.en;
  return list(items).length
    ? items
        .map(
          (item) =>
            `<div class="knowledge-qa"><strong>${esc(item.question)}</strong><p>${esc(item.answer)}</p></div>`,
        )
        .join("")
    : `<p class="related-empty">${pick("No questions supplied.", "Henüz soru eklenmedi.")}</p>`;
}
function referencesMarkup(items) {
  return list(items).length
    ? `<ul>${items
        .map((item) => {
          const title = lang === "tr" ? item.title?.tr : item.title?.en;
          return `<li>${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(title || item.title || item.url)}</a>` : esc(title || item.title || item.reference || "")}${item.reference ? ` — ${esc(item.reference)}` : ""}</li>`;
        })
        .join("")}</ul>`
    : `<p class="related-empty">${pick("None recorded.", "Kayıt bulunmuyor.")}</p>`;
}
function sourcesMarkup(items) {
  return list(items).length
    ? `<ul>${items
        .map(
          (item) =>
            `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>${item.publisher ? ` — ${esc(item.publisher)}` : ""}</li>`,
        )
        .join("")}</ul>`
    : `<p class="related-empty">${pick("No source attached to this migrated legacy record.", "Bu aktarılan eski kayda kaynak eklenmemiştir.")}</p>`;
}
function v2Content(index, entry) {
  const d = entry.details;
  if (!d) return "";
  const formula = d.formula
      ? `<p><code>${esc(d.formula.expression || "")}</code></p>${detailText(d.formula.notes) ? `<p>${detailText(d.formula.notes)}</p>` : ""}`
      : `<p class="related-empty">${pick("No formula applies.", "Uygulanabilir formül yoktur.")}</p>`,
    revision = list(d.revisionHistory)
      .map(
        (item) =>
          `<p><strong>${esc(item.version || "")}</strong> · ${esc(item.date || "")} · ${detailText(item.summary)}${item.reviewer ? ` · ${esc(item.reviewer)}` : ""}</p>`,
      )
      .join(""),
    media = (item, type) =>
      item?.status === "available" && item.url
        ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${detailText(item.caption)}</a>`
        : `<p>${detailText(item?.caption) || esc(pick(`${type} planned.`, `${type} planlandı.`))}</p>`;
  return `<div class="knowledge-v2-meta"><span>${esc(pick("Difficulty", "Seviye"))}: ${esc(d.difficultyLevel)}</span><span>${esc(d.estimatedReadingTimeMinutes)} ${esc(pick("min read", "dk okuma"))}</span></div>
    ${expandable("Simple Explanation", "Basit Açıklama", `<p>${detailText(d.simpleExplanation)}</p>`, true)}
    ${expandable("Professional Explanation", "Profesyonel Açıklama", `<p>${detailText(d.professionalExplanation)}</p>`)}
    ${expandable("Real World Example", "Gerçek Hayat Örneği", `<p>${detailText(d.realWorldExample)}</p>`)}
    ${expandable("Site Example", "Şantiye Örneği", `<p>${detailText(d.siteExample)}</p>`)}
    ${expandable("Office Example", "Ofis Örneği", `<p>${detailText(d.officeExample)}</p>`)}
    ${expandable("Interview Questions", "Mülakat Soruları", questionsMarkup(d.interviewQuestions))}
    ${expandable("Formula", "Formül", formula)}
    ${expandable("Calculator Link", "Hesaplayıcı Bağlantısı", relatedContent(index, entry))}
    ${expandable("Common Mistakes", "Yaygın Hatalar", detailList(d.commonMistakes))}
    ${expandable("Practical Tips", "Pratik İpuçları", detailList(d.practicalTips))}
    ${expandable("Risks", "Riskler", detailList(d.risks))}
    ${expandable("Best Practice", "İyi Uygulama", detailList(d.bestPractice))}
    ${expandable("UK Practice", "Birleşik Krallık Uygulaması", `<p>${detailText(d.ukPractice)}</p>`)}
    ${expandable("Turkey Practice", "Türkiye Uygulaması", `<p>${detailText(d.turkeyPractice)}</p>`)}
    ${expandable("Related Concepts", "İlgili Kavramlar", `<p>${d.relatedConcepts.map(esc).join(", ") || esc(pick("See related knowledge below.", "Aşağıdaki ilgili bilgilere bakın."))}</p>`)}
    ${expandable("Related Documents", "İlgili Belgeler", referencesMarkup(d.relatedDocuments))}
    ${expandable("Related Standards", "İlgili Standartlar", referencesMarkup(d.relatedStandards))}
    ${expandable("Related Regulations", "İlgili Mevzuat", referencesMarkup(d.relatedRegulations))}
    ${expandable("Official Sources", "Resmî Kaynaklar", sourcesMarkup(d.officialSources))}
    ${expandable("Revision History", "Revizyon Geçmişi", revision)}
    ${expandable("Frequently Asked Questions", "Sık Sorulan Sorular", questionsMarkup(d.frequentlyAskedQuestions))}
    ${expandable("Visual Illustration", "Görsel Açıklama", media(d.visualIllustration, pick("Illustration", "Görsel")))}
    ${expandable("Future Video", "Gelecek Video", media(d.futureVideo, "Video"))}`;
}
const stageLabels = {
  planning: ["Planning", "Planlama"],
  design: ["Design", "Tasarım"],
  procurement: ["Procurement", "Tedarik"],
  construction: ["Construction", "İnşaat"],
  inspection: ["Inspection", "Denetim"],
  completion: ["Completion", "Tamamlama"],
  operation: ["Operation", "İşletme"],
};
function entryLinks(items, emptyMessage) {
  return items.length
    ? `<div class="intelligence-list">${items
        .map(
          (item) =>
            `<button type="button" data-open-term="${item.index}"><strong>${esc(item.entry.term)}</strong><span>${esc(item.entry.tr)}</span></button>`,
        )
        .join("")}</div>`
    : `<p class="related-empty">${esc(emptyMessage)}</p>`;
}
function intelligenceContent(index, entry) {
  const insight = intelligence?.forEntry(index, getRecent());
  if (!insight) return "";
  const calculators = getRelatedCalculators(entry),
    regulations = insight.buildingRegulations.recorded
      .map((item) =>
        esc(
          (lang === "tr" ? item.title?.tr : item.title?.en) ||
            item.title ||
            item.reference ||
            "",
        ),
      )
      .filter(Boolean),
    regulationEntry = insight.buildingRegulations.relatedEntry,
    calculatorLinks = calculators.length
      ? `<div class="intelligence-list">${calculators
          .map(
            (item) =>
              `<button type="button" data-calculator-target="${esc(item.calculator.target)}" data-calculator-page="${esc(item.calculator.page)}"><strong>${esc(calculatorLabel(item.calculator.title))}</strong><span>${pick("Open calculator", "Hesaplayıcıyı aç")}</span></button>`,
          )
          .join("")}</div>`
      : `<p class="related-empty">${pick("No verified calculator link.", "Doğrulanmış hesaplayıcı bağlantısı yok.")}</p>`,
    handbookLinks = insight.handbook.length
      ? `<div class="intelligence-list">${insight.handbook
          .map(
            (chapter) =>
              `<button type="button" data-intelligence-chapter="${esc(chapter.id)}"><strong>${esc(chapter.title?.[lang] || chapter.title?.en || chapter.id)}</strong><span>${pick("Open handbook chapter", "El kitabı bölümünü aç")}</span></button>`,
          )
          .join("")}</div>`
      : `<p class="related-empty">${pick("No handbook chapter explicitly references this entry.", "Bu kayda açıkça atıf yapan el kitabı bölümü yok.")}</p>`;
  return `<section class="knowledge-intelligence"><h3>${pick("Knowledge Intelligence", "Bilgi Zekâsı")}</h3><p class="relationship-note">${pick("Relationships marked as derived come from the validated local relationship index; missing semantics are not guessed.", "Türetilmiş olarak işaretlenen ilişkiler doğrulanmış yerel ilişki dizininden gelir; eksik anlamlar tahmin edilmez.")}</p>
    ${expandable("Parent concept", "Üst kavram", `<button type="button" class="intelligence-parent" data-breadcrumb-category="${esc(entry.cat)}">${esc(categoryLabel(insight.parent.title))}</button>`, true)}
    ${expandable("Child concepts", "Alt kavramlar", `<p class="related-empty">${pick("This entry is a leaf in the current verified taxonomy; no child concepts are defined.", "Bu kayıt mevcut doğrulanmış taksonomide bir yapraktır; alt kavram tanımlanmamıştır.")}</p>`)}
    ${expandable("Opposite concepts", "Karşıt kavramlar", `<p class="related-empty">${pick("No opposite concept is defined in the approved record.", "Onaylı kayıtta karşıt kavram tanımlanmamıştır.")}</p>`)}
    ${expandable("Related concepts", "İlgili kavramlar", entryLinks(insight.related, pick("No validated relationships.", "Doğrulanmış ilişki yok.")))}
    ${expandable("Frequently used together", "Sık birlikte kullanılanlar", `<p class="relationship-note">${pick("Derived from the strongest local relationship links.", "En güçlü yerel ilişki bağlantılarından türetilmiştir.")}</p>${entryLinks(insight.frequentlyTogether, pick("No co-usage relationship available.", "Birlikte kullanım ilişkisi yok."))}`)}
    ${expandable("Building Regulation references", "Yapı Mevzuatı referansları", `${regulations.length ? `<ul>${regulations.map((value) => `<li>${value}</li>`).join("")}</ul>` : ""}${regulationEntry ? entryLinks([regulationEntry], "") : ""}${!regulations.length && !regulationEntry ? `<p class="related-empty">${pick("No Building Regulations reference is recorded.", "Kayıtlı Yapı Mevzuatı referansı yok.")}</p>` : ""}`)}
    ${expandable("Calculator links", "Hesaplayıcı bağlantıları", calculatorLinks)}
    ${expandable("Handbook links", "El kitabı bağlantıları", handbookLinks)}
    ${expandable("Construction workflow position", "İnşaat iş akışı konumu", `<p><span class="workflow-stage">${esc(pick(...stageLabels[insight.stage]))}</span></p><p class="relationship-note">${pick("Derived from the record’s approved title, category, tags and usage text.", "Kaydın onaylı başlık, kategori, etiket ve kullanım metninden türetilmiştir.")}</p>`)}
    ${expandable("Read Next", "Sonraki Okuma", insight.readNext ? entryLinks([insight.readNext], "") : `<p class="related-empty">${pick("No next entry available.", "Sonraki kayıt yok.")}</p>`, true)}
  </section>`;
}

function createIntelligence(chapters = []) {
  intelligence = window.EMCPKnowledgeIntelligence.create({
    entries: TERMS,
    related: (index) => knowledge.related(index),
    normalize: norm,
    chapters,
  });
  window.emcpRelationshipValidation = intelligence.validate();
}
function renderKnowledgeMap() {
  if (!intelligence) return;
  const topic = document.getElementById("knowledgeMapTopic"),
    graphOutput = document.getElementById("knowledgeMapGraph"),
    journeyOutput = document.getElementById("knowledgeJourney"),
    recentOutput = document.getElementById("intelligenceRecent"),
    healthOutput = document.getElementById("relationshipHealth");
  if (!topic || !graphOutput || !journeyOutput || !recentOutput) return;
  const selectedTopic =
    topic.value || TERMS[mapFocusIndex]?.cat || intelligence.categories[0];
  topic.innerHTML = intelligence.categories
    .map(
      (category) =>
        `<option value="${esc(category)}"${category === selectedTopic ? " selected" : ""}>${esc(categoryLabel(category))}</option>`,
    )
    .join("");
  if (TERMS[mapFocusIndex]?.cat !== selectedTopic)
    mapFocusIndex = TERMS.findIndex((entry) => entry.cat === selectedTopic);
  const graph = intelligence.graph(mapFocusIndex);
  graphOutput.setAttribute(
    "aria-label",
    pick(
      `${graph.nodes.length - 1} strongest relationships around ${graph.nodes[0].entry.term}`,
      `${graph.nodes[0].entry.tr} çevresindeki en güçlü ${graph.nodes.length - 1} ilişki`,
    ),
  );
  graphOutput.innerHTML = graph.nodes
    .map(
      (node) =>
        `<button type="button" class="knowledge-map-node${node.root ? " root" : ""}" data-intelligence-node="${node.index}" aria-label="${esc(node.entry.term)}"><strong>${esc(node.entry.term)}</strong><span>${esc(node.entry.tr)}</span></button>`,
    )
    .join("");
  const journey = intelligence
      .journeys()
      .find((item) => item.topic === selectedTopic),
    levelLabels = {
      beginner: ["Beginner", "Başlangıç"],
      intermediate: ["Intermediate", "Orta"],
      advanced: ["Professional", "Profesyonel"],
      expert: ["Expert", "Uzman"],
    };
  journeyOutput.innerHTML = Object.entries(journey?.levels || {})
    .map(
      ([level, items]) =>
        `<section><h4>${esc(pick(...levelLabels[level]))}</h4>${entryLinks(items.slice(0, 12), pick("No approved entries at this level yet.", "Bu seviyede henüz onaylı kayıt yok."))}</section>`,
    )
    .join("");
  const recent = getRecent()
    .map((term) => {
      const index = TERMS.findIndex((entry) => entry.term === term);
      return index >= 0 ? { entry: TERMS[index], index } : null;
    })
    .filter(Boolean);
  recentOutput.innerHTML = entryLinks(
    recent.slice(0, 10),
    pick(
      "No recently viewed entries.",
      "Yakın zamanda görüntülenen kayıt yok.",
    ),
  );
  const validation = intelligence.validate();
  healthOutput.textContent = validation.valid
    ? pick(
        `${validation.entries} entries and ${validation.relationships} runtime relationships validated.`,
        `${validation.entries} kayıt ve ${validation.relationships} çalışma zamanı ilişkisi doğrulandı.`,
      )
    : pick(
        "Broken runtime relationships detected.",
        "Bozuk çalışma zamanı ilişkileri tespit edildi.",
      );
}
function initializeAssistant() {
  const form = document.getElementById("assistantForm"),
    questionInput = document.getElementById("assistantQuestion"),
    output = document.getElementById("assistantOutput");
  if (!form || !questionInput || !output || !window.EMCPAssistant) return;
  window.emcpAssistant = window.EMCPAssistant.create({
    form,
    questionInput,
    output,
    search: (question) => knowledge.searchAsync(question, CATEGORY_EN),
    normalize: knowledge.normalize,
    getRelatedEntries,
    getRelatedCalculators,
    getRelatedChapters: relatedHandbookChapters,
    openEntry: openTerm,
    openCalculator,
    openChapter: (chapterId) => {
      showPage("handbooks");
      return (window.EMCPFeatures?.load("handbooks") || Promise.resolve()).then(
        () => window.EMCPHandbook?.openChapter?.(chapterId, true),
      );
    },
    getLanguage: () => lang,
    categoryLabel,
    calculatorLabel,
  });
}
let assistantChaptersPromise;
function relatedHandbookChapters(results) {
  const loadChapters = () => {
    if (!assistantChaptersPromise)
      assistantChaptersPromise = fetch(
        "content/handbooks/investor/chapters.json",
        { credentials: "same-origin" },
      ).then((response) => {
        if (!response.ok) throw new Error("Unable to load handbook chapters");
        return response.json();
      });
    return assistantChaptersPromise;
  };
  const evidenceTerms = new Set(
    results.flatMap((result) =>
      [
        result.entry.term,
        result.entry.tr,
        result.entry.abbr,
        ...list(result.entry.aliases),
      ]
        .map(norm)
        .filter(Boolean),
    ),
  );
  return loadChapters()
    .then((chapters) =>
      chapters.filter((chapter) =>
        list(chapter.related_knowledge_entries).some((reference) =>
          evidenceTerms.has(norm(reference)),
        ),
      ),
    )
    .catch(() => []);
}
function getFav() {
  return core.storage.get("emcpFav", [], core.stringList);
}
function getRecent() {
  return core.storage.get("emcpRecent", [], core.stringList);
}
const pageLabels = {
  home: ["Home", "Ana Sayfa"],
  knowledge: ["Knowledge OS", "Bilgi Sistemi"],
  "knowledge-map": ["Knowledge Map", "Bilgi Haritası"],
  handbooks: ["Investor Handbook", "Yatırımcı El Kitabı"],
  assistant: ["Ask EMCP", "EMCP’ye Sor"],
  workspace: ["My Workspace", "Çalışma Alanım"],
  calculators: ["Calculators", "Hesaplayıcılar"],
  construction: ["Construction Tools", "İnşaat Araçları"],
};
function updateBreadcrumb(name = activePage, category, term) {
  const output = document.getElementById("breadcrumbs");
  if (!output) return;
  const items = [
    { label: pick(...pageLabels.home), page: "home" },
    ...(name === "home"
      ? []
      : [{ label: pick(...(pageLabels[name] || [name, name])), page: name }]),
    ...(category ? [{ label: categoryLabel(category), category }] : []),
    ...(term ? [{ label: term }] : []),
  ];
  output.innerHTML = `<ol>${items
    .map((item, index) => {
      const current = index === items.length - 1,
        attribute = item.category
          ? ` data-breadcrumb-category="${esc(item.category)}"`
          : ` data-page="${esc(item.page)}"`;
      return `<li${current ? ' aria-current="page"' : ""}>${current ? esc(item.label) : `<button type="button"${attribute}>${esc(item.label)}</button>`}</li>`;
    })
    .join("")}</ol>`;
}
function updateStats() {
  favCount.textContent = getFav().length;
  recentCount.textContent = getRecent().length;
  window.emcpWorkspace?.refreshCounts?.();
}
function renderCats() {
  cats.innerHTML = ["Tümü", ...new Set(TERMS.map((x) => x.cat))]
    .map(
      (c, index) =>
        `<button type="button" class="chip ${activeCat === c ? "active" : ""}" aria-pressed="${activeCat === c}" data-category-index="${index}">${esc(c === "Tümü" ? pick("All", "Tümü") : categoryLabel(c))}</button>`,
    )
    .join("");
}
function searchKnowledge(query) {
  return knowledge.search(query, CATEGORY_EN);
}
function getList() {
  const q = document.getElementById("q").value.trim();
  let a = searchKnowledge(q).map((item) => ({
    ...item.entry,
    _i: item.index,
    _s: item._s,
    _reasons: item.reasons,
  }));
  if (activeCat !== "Tümü") a = a.filter((x) => x.cat === activeCat);
  return a;
}
const reasonLabels = {
  Title: ["Title", "Başlık"],
  Abbreviation: ["Abbreviation", "Kısaltma"],
  Alias: ["Alias", "Alternatif ad"],
  Keyword: ["Keyword", "Anahtar kelime"],
  Tag: ["Tag", "Etiket"],
  Category: ["Category", "Kategori"],
  "Related concept": ["Related concept", "İlgili kavram"],
  Definition: ["Definition", "Tanım"],
  "Practical use": ["Practical use", "Pratik kullanım"],
  Example: ["Example", "Örnek"],
};
function resultCard(entry, query = "") {
  const highlight = (value) => knowledge.highlight(value, query),
    reasons = [...new Set(entry._reasons || [])].slice(0, 3),
    reasonText = reasons
      .map((reason) => pick(...(reasonLabels[reason] || [reason, reason])))
      .join(" · ");
  return `<button type="button" class="card" data-open-term="${entry._i}"><span class="term">${highlight(entry.term)}</span>${entry.abbr ? `<span class="abbr">${highlight(entry.abbr)}</span>` : ""}<span class="tr">${highlight(entry.tr)}</span><span class="def">${highlight(lang === "tr" ? entry.def : entry.defEn || entry.def)}</span>${reasonText ? `<span class="match-reason">${esc(pick("Matched by", "Eşleşme"))}: ${esc(reasonText)}</span>` : ""}<span class="badge">${esc(categoryLabel(entry.cat))}</span></button>`;
}
function emptySearch(query) {
  const suggestions = knowledge.suggest(query, 3),
    suggestionButtons = suggestions.length
      ? `<div class="search-suggestions" role="group" aria-label="${esc(pick("Suggested searches", "Önerilen aramalar"))}">${suggestions.map((suggestion) => `<button type="button" data-search-suggestion="${esc(suggestion)}">${esc(suggestion)}</button>`).join("")}</div>`
      : "";
  return `<div class="empty search-empty"><strong>${esc(pick("No matching knowledge found", "Eşleşen bilgi bulunamadı"))}</strong><span>${esc(pick("Try a shorter term, another language, or one of the suggestions below.", "Daha kısa bir terim, diğer dili veya aşağıdaki önerilerden birini deneyin."))}</span>${suggestionButtons}</div>`;
}
function render() {
  const a = getList();
  count.textContent = pick(`${a.length} results`, `${a.length} sonuç`);
  const query = q.value.trim(),
    cards = a.map((entry) => resultCard(entry, query));
  window.EMCPVirtualList.render(grid, cards, {
    empty: emptySearch(query),
  });
  updateStats();
}
let searchRenderSequence = 0;
async function renderSearch() {
  const sequence = ++searchRenderSequence,
    query = q.value.trim(),
    results = await knowledge.searchAsync(query, CATEGORY_EN);
  if (sequence !== searchRenderSequence) return;
  let list = results.map((item) => ({
    ...item.entry,
    _i: item.index,
    _s: item._s,
    _reasons: item.reasons,
  }));
  if (activeCat !== "Tümü")
    list = list.filter((entry) => entry.cat === activeCat);
  count.textContent = pick(`${list.length} results`, `${list.length} sonuç`);
  window.EMCPVirtualList.render(
    grid,
    list.map((entry) => resultCard(entry, query)),
    {
      empty: emptySearch(query),
    },
  );
  q.removeAttribute("aria-busy");
  window.EMCPOperations?.track("knowledge_search");
  updateStats();
}
function setCat(c) {
  const values = ["Tümü", ...new Set(TERMS.map((entry) => entry.cat))];
  if (!values.includes(c)) return false;
  activeCat = c;
  updateBreadcrumb("knowledge", c === "Tümü" ? null : c);
  renderCats();
  render();
  if (c !== "Tümü")
    knowledge
      .loadCategory(c)
      .then(() => {
        TERMS = knowledge.entries;
        render();
      })
      .catch((error) => console.error("Unable to hydrate category:", error));
  return true;
}
async function openTerm(i) {
  i = Number(i);
  if (!Number.isInteger(i) || !TERMS[i]) return false;
  const hydrated = await knowledge.hydrate(i);
  if (hydrated) TERMS = knowledge.entries;
  const t = TERMS[i];
  if (!t) return false;
  currentTermIndex = i;
  let r = getRecent();
  r = [t.term, ...r.filter((x) => x !== t.term)].slice(0, 30);
  core.storage.set("emcpRecent", r);
  updateBreadcrumb("knowledge", t.cat, t.term);
  const fav = getFav().includes(t.term),
    definition = lang === "tr" ? t.def : t.defEn || t.def,
    usage = lang === "tr" ? t.use : t.useEn || t.use,
    note = window.emcpWorkspace?.knowledgeNoteMarkup?.(i) || "";
  sheet.innerHTML = `<button type="button" class="close" data-modal-close>×</button><div class="badge">${esc(categoryLabel(t.cat))}</div><h2>${esc(t.term)}</h2>${t.abbr ? `<div class="abbr">${esc(t.abbr)}</div>` : ""}<p><b>${esc(t.tr)}</b></p>${v2Content(i, t) || `<h3>${pick("Definition", "Tanım")}</h3><p>${esc(definition)}</p><h3>${pick("When is it used?", "Ne zaman kullanılır?")}</h3><p>${esc(usage)}</p>`}${intelligenceContent(i, t)}${note}<div class="actions"><button type="button" data-toggle-favourite="${i}">${fav ? "★" : "☆"} ${pick("Favourite", "Favori")}</button><button type="button" data-collection-picker="${i}">${pick("Collections", "Koleksiyonlar")}</button><button type="button" data-copy-term="${i}">${pick("Copy", "Kopyala")}</button><button type="button" data-share-term="${i}">${pick("Share", "Paylaş")}</button></div>`;
  window.showModal();
  updateStats();
  return true;
}
function closeModal() {
  currentTermIndex = null;
  window.hideModal();
  updateBreadcrumb();
}
function toggleFav(term) {
  if (typeof term !== "string" || !TERMS.some((entry) => entry.term === term))
    return;
  let f = getFav();
  f = f.includes(term) ? f.filter((x) => x !== term) : [...f, term];
  core.storage.set("emcpFav", f);
  closeModal();
  render();
  window.emcpWorkspace?.refresh?.();
}
window.onEMCPModalClose = () => {
  currentTermIndex = null;
};
function copyTerm(i) {
  const t = TERMS[Number(i)];
  if (!t) return false;
  const definition = lang === "tr" ? t.def : t.defEn || t.def;
  navigator.clipboard?.writeText(`${t.term} — ${t.tr}\n${definition}`);
  alert(pick("Copied", "Kopyalandı"));
  return true;
}
function shareTerm(i) {
  const t = TERMS[Number(i)];
  if (!t) return false;
  const definition = lang === "tr" ? t.def : t.defEn || t.def,
    text = `${t.term} — ${t.tr}\n${definition}`;
  if (navigator.share) navigator.share({ title: t.term, text }).catch(() => {});
  else copyTerm(i);
  return true;
}
function showPage(name) {
  const page = document.getElementById("page-" + name);
  if (!page) return false;
  document
    .querySelectorAll(".page")
    .forEach((item) => item.classList.remove("active"));
  page.classList.add("active");
  activePage = name;
  updateBreadcrumb(name);
  if (name === "knowledge-map") renderKnowledgeMap();
  if (window.EMCPFeatures?.has(name)) {
    page.inert = true;
    page.setAttribute("aria-busy", "true");
    window.EMCPFeatures.load(name)
      .then(() => {
        page.inert = false;
        page.setAttribute("aria-busy", "false");
        if (name === "assistant") initializeAssistant();
      })
      .catch((error) => {
        page.inert = false;
        page.setAttribute("aria-busy", "false");
        console.error(`Unable to load ${name}:`, error);
      });
  }
  document.querySelectorAll(".bottom button").forEach((b) => {
    b.classList.remove("active");
    b.removeAttribute("aria-current");
  });
  let activeNav = null;
  if (name === "home") activeNav = navHome;
  if (name === "knowledge") activeNav = navKnowledge;
  if (name === "handbooks") activeNav = navHandbooks;
  if (name === "calculators") activeNav = navCalc;
  if (name === "construction") activeNav = navBuild;
  if (activeNav) {
    activeNav.classList.add("active");
    activeNav.setAttribute("aria-current", "page");
  }
  window.EMCPAccessibility?.scrollToTop();
  return true;
}
function updateThemeControl() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  themeBtn.setAttribute("aria-pressed", String(dark));
  const label = dark
    ? pick("Use light theme", "Açık temayı kullan")
    : pick("Use dark theme", "Koyu temayı kullan");
  themeBtn.setAttribute("aria-label", label);
  themeBtn.title = label;
}
function setLang(l) {
  lang = l === "en" ? "en" : "tr";
  if (ui) ui.setLanguage(lang);
  else core.storage.setRaw("emcpLang", lang);
  trBtn.classList.toggle("active", lang === "tr");
  enBtn.classList.toggle("active", lang === "en");
  trBtn.setAttribute("aria-pressed", String(lang === "tr"));
  enBtn.setAttribute("aria-pressed", String(lang === "en"));
  renderCats();
  render();
  renderKnowledgeError();
  updateThemeControl();
  updateBreadcrumb();
  if (activePage === "knowledge-map") renderKnowledgeMap();
  window.emcpAssistant?.clear?.();
  if (currentTermIndex !== null) openTerm(currentTermIndex);
  window.EMCPHandbook?.setLanguage?.(lang);
  commandPalette?.setLanguage?.();
}
function showHelp() {
  currentTermIndex = null;
  sheet.innerHTML = `<button type="button" class="close" data-modal-close>×</button><h2>${pick("Very Simple User Guide", "Çok Basit Kullanım Kılavuzu")}</h2><p>${pick("1. Tap a module on Home.<br>2. Search inside Knowledge.<br>3. Enter numbers in Calculators and tap Calculate.<br>4. Enter dimensions in Construction Tools.<br>5. Use the half-moon button for dark mode.<br>6. Open in Safari and Add to Home Screen.", "1. Ana Sayfa’dan bir modüle dokunun.<br>2. Bilgi bölümünde arama yapın.<br>3. Hesaplayıcılara rakamları girip Hesapla’ya basın.<br>4. İnşaat Araçları’na ölçüleri girin.<br>5. Koyu mod için yarım ay düğmesini kullanın.<br>6. Safari’de açıp Ana Ekrana Ekle’yi seçin.")}</p>`;
  window.showModal();
}
q.addEventListener("input", () => {
  showPage("knowledge");
  q.setAttribute("aria-busy", "true");
  renderSearch();
});
clearBtn.addEventListener("click", () => {
  q.value = "";
  activeCat = "Tümü";
  renderCats();
  render();
});
trBtn.addEventListener("click", () => setLang("tr"));
enBtn.addEventListener("click", () => setLang("en"));
themeBtn.addEventListener("click", () => {
  const d = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", d ? "light" : "dark");
  core.storage.setRaw("emcpTheme", d ? "light" : "dark");
  updateThemeControl();
});
document.documentElement.setAttribute(
  "data-theme",
  core.storage.getRaw("emcpTheme") === "dark" ? "dark" : "light",
);
updateThemeControl();
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.page) showPage(button.dataset.page);
  if (button.dataset.workspace)
    window.showWorkspace?.(button.dataset.workspace);
  if (button.hasAttribute("data-help")) showHelp();
  if (button.hasAttribute("data-modal-close")) closeModal();
  if (button.dataset.openTerm !== undefined) openTerm(button.dataset.openTerm);
  if (button.dataset.breadcrumbCategory !== undefined) {
    showPage("knowledge");
    setCat(button.dataset.breadcrumbCategory);
  }
  if (button.dataset.intelligenceNode !== undefined) {
    mapFocusIndex = Number(button.dataset.intelligenceNode);
    renderKnowledgeMap();
  }
  if (button.dataset.intelligenceChapter) {
    showPage("handbooks");
    (window.EMCPFeatures?.load("handbooks") || Promise.resolve()).then(() =>
      window.EMCPHandbook?.openChapter?.(
        button.dataset.intelligenceChapter,
        true,
      ),
    );
  }
  if (button.dataset.searchSuggestion !== undefined) {
    q.value = button.dataset.searchSuggestion;
    q.focus();
    renderSearch();
  }
  if (button.dataset.categoryIndex !== undefined) {
    const values = ["Tümü", ...new Set(TERMS.map((entry) => entry.cat))],
      category = values[Number(button.dataset.categoryIndex)];
    if (category) setCat(category);
  }
  if (button.dataset.calculatorTarget)
    openCalculator(
      button.dataset.calculatorTarget,
      button.dataset.calculatorPage,
    );
  if (button.dataset.toggleFavourite !== undefined) {
    const entry = TERMS[Number(button.dataset.toggleFavourite)];
    if (entry) toggleFav(entry.term);
  }
  if (button.dataset.collectionPicker !== undefined)
    window.openCollectionPicker?.(Number(button.dataset.collectionPicker));
  if (button.dataset.copyTerm !== undefined) copyTerm(button.dataset.copyTerm);
  if (button.dataset.shareTerm !== undefined)
    shareTerm(button.dataset.shareTerm);
});
document
  .getElementById("knowledgeMapTopic")
  ?.addEventListener("change", (event) => {
    mapFocusIndex = TERMS.findIndex(
      (entry) => entry.cat === event.currentTarget.value,
    );
    renderKnowledgeMap();
  });
function renderKnowledgeError() {
  const panel = window.EMCPDOM.get("knowledgeError");
  if (!panel) return;
  panel.hidden = !knowledgeLoadError;
  if (!knowledgeLoadError) return;
  knowledgeErrorTitle.textContent = pick(
    "Knowledge data could not be loaded.",
    "Bilgi verileri yüklenemedi.",
  );
  knowledgeErrorText.textContent = pick(
    "Check your connection and retry. Previously cached data remains available offline.",
    "Bağlantınızı kontrol edip yeniden deneyin. Önceden önbelleğe alınan veriler çevrimdışı kullanılabilir.",
  );
  retryKnowledge.textContent = pick("Retry", "Yeniden dene");
}
async function loadKnowledgeData() {
  knowledgeLoadError = null;
  renderKnowledgeError();
  try {
    TERMS = await knowledge.load();
    return true;
  } catch (error) {
    knowledgeLoadError = error;
    TERMS = [];
    console.error("Failed to load knowledge data:", error);
    renderKnowledgeError();
    return false;
  }
}
async function retryKnowledgeData() {
  retryKnowledge.disabled = true;
  retryKnowledge.textContent = pick("Loading…", "Yükleniyor…");
  await loadKnowledgeData();
  retryKnowledge.disabled = false;
  renderCats();
  render();
  renderKnowledgeError();
}
retryKnowledge.addEventListener("click", retryKnowledgeData);
async function initializeApp() {
  await loadKnowledgeData();
  createIntelligence();
  initializeCommandPalette();
  if (!assistantChaptersPromise)
    assistantChaptersPromise = fetch(
      "content/handbooks/investor/chapters.json",
      { credentials: "same-origin" },
    ).then((response) => {
      if (!response.ok) throw new Error("Unable to load handbook chapters");
      return response.json();
    });
  assistantChaptersPromise
    .then((chapters) => {
      createIntelligence(chapters);
      initializeCommandPalette(chapters);
    })
    .catch(() => createIntelligence());
  setLang(lang);
  renderCats();
  render();
  updateStats();
}
window.EMCPApp = {
  showPage,
  setLang,
  openTerm,
  closeModal,
  setCategory: setCat,
  searchKnowledge,
  retryKnowledgeData,
  get entries() {
    return TERMS.slice();
  },
};
initializeApp();
