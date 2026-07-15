import fs from "node:fs";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const date = "2026-07-14",
  local = (en, tr) => ({ en, tr });
const source = (title, url) => ({ title, url, status: "verified" });
const base = (id, type, en, tr, summaryEn, summaryTr) => ({
  id,
  object_type: type,
  title: local(en, tr),
  summary: local(summaryEn, summaryTr),
  learning_objectives: local(
    [`Apply ${en} to a documented beginner investment decision.`],
    [`${tr} aracını belgeli bir başlangıç yatırım kararına uygulamak.`],
  ),
  prerequisites: [],
  difficulty_level: "beginner",
  estimated_study_time_minutes: 15,
  related_knowledge_entries: [],
  related_topics: [],
  related_calculators: [],
  related_documents: [],
  related_case_studies: [],
  official_sources: [
    source(
      "RICS consumer and professional guidance",
      "https://www.rics.org/consumer-guides",
    ),
  ],
  revision_history: [
    {
      version: "1.0.0",
      date,
      summary: local("Initial Pack 003 draft.", "İlk Pack 003 taslağı."),
    },
  ],
  completion_status: "complete",
  content_version: "1.0.0",
  review_status: "draft",
  reviewer: null,
  jurisdiction: [
    "United Kingdom",
    "Turkey — local professional verification required",
  ],
});
const plan = read("content/topic-plans/content-pack-003.json"),
  idByTitle = new Map(plan.concepts.map((x) => [x.title.en, x.id]));

const checklistSpecs = [
  [
    "checklist.investor-goals",
    "Investor Goals Checklist",
    "Yatırımcı Hedefleri Kontrol Listesi",
    [
      "Define income, growth and liquidity objectives.",
      "Record time horizon and capital limits.",
      "State risk capacity and tolerance.",
      "Identify decision owners and review dates.",
    ],
    [
      "Gelir, değer artışı ve likidite hedeflerini tanımlayın.",
      "Süre ufkunu ve sermaye sınırlarını kaydedin.",
      "Risk kapasitesi ve toleransını belirtin.",
      "Karar sorumlularını ve inceleme tarihlerini belirleyin.",
    ],
  ],
  [
    "checklist.deal-screening",
    "Deal Screening Checklist",
    "Yatırım Fırsatı Ön Eleme Kontrol Listesi",
    [
      "Confirm strategy fit and location.",
      "Collect price, income, cost and funding evidence.",
      "Identify material missing information.",
      "Record pass, pause or reject decision.",
    ],
    [
      "Strateji uyumunu ve lokasyonu doğrulayın.",
      "Fiyat, gelir, maliyet ve finansman kanıtını toplayın.",
      "Önemli eksik bilgileri belirleyin.",
      "Devam, bekletme veya ret kararını kaydedin.",
    ],
  ],
  [
    "checklist.investment-appraisal",
    "Investment Appraisal Checklist",
    "Yatırım Değerleme Kontrol Listesi",
    [
      "Use consistent periods and units.",
      "Reconcile income, costs and financing.",
      "Test base, upside and downside cases.",
      "Check calculator outputs independently.",
    ],
    [
      "Tutarlı dönem ve birimler kullanın.",
      "Gelir, gider ve finansmanı uzlaştırın.",
      "Temel, iyimser ve kötümser senaryoları test edin.",
      "Hesaplayıcı çıktılarını bağımsız kontrol edin.",
    ],
  ],
  [
    "checklist.investment-risk",
    "Investment Risk Checklist",
    "Yatırım Riski Kontrol Listesi",
    [
      "Name each material risk and owner.",
      "Record likelihood, impact and evidence.",
      "Define mitigation and contingency.",
      "Test whether the exit remains feasible.",
    ],
    [
      "Her önemli riski ve sorumlusunu belirleyin.",
      "Olasılık, etki ve kanıtı kaydedin.",
      "Azaltım ve beklenmeyen durum payını tanımlayın.",
      "Çıkışın uygulanabilir kalıp kalmadığını test edin.",
    ],
  ],
  [
    "checklist.investment-decision",
    "Investment Decision Checklist",
    "Yatırım Kararı Kontrol Listesi",
    [
      "Summarise evidence and unresolved issues.",
      "Compare results with approval criteria.",
      "Record conflicts and professional advice.",
      "Document go, no-go or conditional approval.",
    ],
    [
      "Kanıtı ve çözülmemiş konuları özetleyin.",
      "Sonuçları onay ölçütleriyle karşılaştırın.",
      "Çelişkileri ve uzman görüşlerini kaydedin.",
      "Devam, ret veya koşullu onayı belgeleyin.",
    ],
  ],
];
const checklistFile = "content/checklists/investor-checklists.json";
let checklists = read(checklistFile).filter(
  (x) => !checklistSpecs.some((s) => s[0] === x.id),
);
checklists.push(
  ...checklistSpecs.map(([id, en, tr, enItems, trItems]) => ({
    ...base(
      id,
      "checklist",
      en,
      tr,
      `A reusable ${en.toLowerCase()} for evidence-led decisions.`,
      `Kanıta dayalı kararlar için yeniden kullanılabilir ${tr.toLocaleLowerCase("tr-TR")}.`,
    ),
    items: local(enItems, trItems),
  })),
);
write(checklistFile, checklists);

const caseSpecs = [
  [
    "case-study.investor-first-rental",
    "First Rental Investment",
    "İlk Kiralık Konut Yatırımı",
    "A beginner compares rent, costs, finance, vacancy and exit evidence before deciding.",
  ],
  [
    "case-study.investor-refurbishment",
    "Refurbishment Investment",
    "Yenileme Yatırımı",
    "An investor tests purchase, works, contingency, programme, value and sale assumptions.",
  ],
  [
    "case-study.investor-refinance",
    "Refinance Decision",
    "Yeniden Finansman Kararı",
    "An owner compares hold, refinance and sale using consistent values and finance costs.",
  ],
  [
    "case-study.investor-small-portfolio",
    "Small Portfolio Review",
    "Küçük Portföy İncelemesi",
    "An investor reviews concentration, cash flow, maintenance and funding across several assets.",
  ],
  [
    "case-study.investor-no-go",
    "No-Go Investment Decision",
    "Yatırımdan Vazgeçme Kararı",
    "A deal is rejected because verified downside evidence falls outside the decision criteria.",
  ],
];
const scenarioSpecs = [
  [
    "case-study.scenario-rent",
    "Rent Sensitivity Comparison",
    "Kira Duyarlılığı Karşılaştırması",
    "Base, lower and higher rent assumptions are compared without changing unrelated inputs.",
  ],
  [
    "case-study.scenario-interest",
    "Interest-cost Scenario Comparison",
    "Faiz Maliyeti Senaryo Karşılaştırması",
    "Finance cost is varied across consistent scenarios to show cash-flow sensitivity.",
  ],
  [
    "case-study.scenario-exit",
    "Exit-value Scenario Comparison",
    "Çıkış Değeri Senaryo Karşılaştırması",
    "A range of supported exit values is compared against cost, debt and equity outcomes.",
  ],
];
const appraisalSpecs = [
  [
    "case-study.appraisal-rental",
    "Worked Rental Appraisal",
    "Çalışılmış Kira Yatırımı Değerlemesi",
    "A hypothetical rental appraisal links gross yield, operating expenses, net cash flow and financing.",
  ],
  [
    "case-study.appraisal-refurbishment",
    "Worked Refurbishment Appraisal",
    "Çalışılmış Yenileme Değerlemesi",
    "A hypothetical refurbishment appraisal links price, works, contingency, programme and exit.",
  ],
  [
    "case-study.appraisal-development",
    "Worked Development Appraisal",
    "Çalışılmış Geliştirme Değerlemesi",
    "A hypothetical development appraisal links cost, GDV, funding, profit and downside testing.",
  ],
];
const caseFile = "content/case-studies/investor-case-studies.json";
const allCaseSpecs = [...caseSpecs, ...scenarioSpecs, ...appraisalSpecs];
let cases = read(caseFile).filter(
  (x) => !allCaseSpecs.some((s) => s[0] === x.id),
);
cases.push(
  ...allCaseSpecs.map(([id, en, tr, summaryEn]) => ({
    ...base(
      id,
      "case_study",
      en,
      tr,
      summaryEn,
      `${tr}, varsayımları ve kanıtları açıkça ayıran eğitim amaçlı bir örnektir.`,
    ),
    scenario: local(
      summaryEn,
      `${tr} için kanıt, varsayım ve sonuçlar tarihli olarak kaydedilir.`,
    ),
    lessons: local(
      [
        "Use hypothetical figures only for learning.",
        "Keep evidence, assumptions and calculator outputs distinct.",
        "Obtain property-specific professional advice.",
      ],
      [
        "Yalnız eğitim için varsayımsal rakamlar kullanın.",
        "Kanıt, varsayım ve hesaplayıcı çıktılarını ayrı tutun.",
        "Taşınmaza özel uzman görüşü alın.",
      ],
    ),
  })),
);
write(caseFile, cases);

const guideSpecs = [
  [
    "document-guide.investment-memo",
    "Investment Memorandum Guide",
    "Yatırım Bilgi Notu Rehberi",
    "Investment Memorandum",
  ],
  [
    "document-guide.deal-appraisal",
    "Deal Appraisal Guide",
    "Yatırım Fırsatı Değerleme Rehberi",
    "Deal Appraisal",
  ],
  [
    "document-guide.finance-terms",
    "Finance Terms Guide",
    "Finansman Şartları Rehberi",
    "Financing Cost",
  ],
  [
    "document-guide.risk-register",
    "Investment Risk Register Guide",
    "Yatırım Risk Kaydı Rehberi",
    "Investment Risk Checklist",
  ],
  [
    "document-guide.post-investment-review",
    "Post-investment Review Guide",
    "Yatırım Sonrası İnceleme Rehberi",
    "Post-investment Review",
  ],
];
const guideFile = "content/document-guides/property-purchase-documents.json";
let guides = read(guideFile).filter(
  (x) => !guideSpecs.some((s) => s[0] === x.id),
);
guides.push(
  ...guideSpecs.map(([id, en, tr, term]) => ({
    ...base(
      id,
      "document_guide",
      en,
      tr,
      `A structured guide for preparing and reviewing ${en.toLowerCase()}.`,
      `${tr} hazırlama ve inceleme için yapılandırılmış rehberdir.`,
    ),
    related_knowledge_entries: [idByTitle.get(term)].filter(Boolean),
    document_purpose: local(
      "Record evidence, assumptions, calculations, risks, ownership and approval status.",
      "Kanıtı, varsayımları, hesaplamaları, riskleri, sorumluluğu ve onay durumunu kaydetmek.",
    ),
    review_steps: local(
      [
        "Confirm scope, version and author.",
        "Trace material inputs to dated evidence.",
        "Reperform key calculations and record unresolved issues.",
      ],
      [
        "Kapsamı, sürümü ve yazarı doğrulayın.",
        "Önemli girdileri tarihli kanıta bağlayın.",
        "Temel hesaplamaları yeniden yapın ve çözülmemiş konuları kaydedin.",
      ],
    ),
  })),
);
write(guideFile, guides);

const chapterTitles = new Map([
  [27, ["Risk Management", "Risk Yönetimi"]],
  [28, ["Exit Strategy", "Çıkış Stratejisi"]],
  [29, ["Portfolio Building", "Portföy Oluşturma"]],
  [30, ["Asset Management", "Varlık Yönetimi"]],
  [32, ["Deal Appraisal", "Yatırım Fırsatı Değerlemesi"]],
  [33, ["Using Deal Snapshot", "Deal Snapshot Kullanımı"]],
  [34, ["Saving and Comparing Scenarios", "Senaryo Kaydetme ve Karşılaştırma"]],
  [36, ["Common Investor Mistakes", "Sık Yapılan Yatırımcı Hataları"]],
  [37, ["Investor Checklists", "Yatırım Kontrol Listeleri"]],
  [40, ["Investment Decision Framework", "Yatırım Karar Çerçevesi"]],
]);
const chaptersFile = "content/handbooks/investor/chapters.json",
  handbookFile = "content/handbooks/investor/handbook.json";
let chapters = read(chaptersFile),
  handbook = read(handbookFile);
const template = chapters[0];
for (const [number, [en, tr]] of chapterTitles)
  if (!chapters.some((x) => x.chapter_number === number)) {
    const id = `handbook.investor.chapter-${String(number).padStart(2, "0")}`;
    chapters.push({
      ...structuredClone(template),
      id,
      title: local(en, tr),
      summary: local(
        `A practical introduction to ${en.toLowerCase()} for property investors.`,
        `Gayrimenkul yatırımcıları için ${tr.toLocaleLowerCase("tr-TR")} konusuna pratik giriş.`,
      ),
      chapter_number: number,
      prerequisites: [],
      related_knowledge_entries: [],
      related_calculators: [],
      related_documents: [],
      related_case_studies: [],
      checklist: "checklist.investment-decision",
      content_version: "1.0.0",
      revision_history: [
        {
          version: "1.0.0",
          date,
          summary: local(
            "Initial Pack 003 chapter draft.",
            "İlk Pack 003 bölüm taslağı.",
          ),
        },
      ],
      next_recommended_chapter: chapterTitles.has(number + 1)
        ? `handbook.investor.chapter-${String(number + 1).padStart(2, "0")}`
        : null,
      simple_explanation: local(
        `This chapter explains ${en.toLowerCase()} in plain language.`,
        `Bu bölüm ${tr.toLocaleLowerCase("tr-TR")} konusunu sade dille açıklar.`,
      ),
      professional_explanation: local(
        `The chapter applies evidence-led ${en.toLowerCase()} without replacing transaction-specific advice.`,
        `Bölüm, işleme özel danışmanlığın yerini almadan kanıta dayalı ${tr.toLocaleLowerCase("tr-TR")} uygular.`,
      ),
    });
  }
const chapterConcepts = {
  1: [
    "Investor Goals",
    "Investment Strategy",
    "Risk Tolerance",
    "Investment Time Horizon",
    "Capital Allocation",
  ],
  3: ["Property Market Research", "Demand Analysis", "Supply Analysis"],
  4: ["Location Analysis", "Comparable Evidence"],
  5: ["Deal Sourcing"],
  7: ["Due Diligence", "Title Risk", "Survey Risk", "Environmental Risk"],
  9: ["Market Value", "GDV", "Comparable Evidence"],
  10: ["Rental Income", "Gross Rental Yield", "Net Rental Yield"],
  11: [
    "Mortgage Deposit",
    "Equity",
    "Property Debt",
    "Investment Leverage",
    "Interest Rate",
    "Loan Term",
  ],
  12: ["Bridging Finance"],
  13: ["Development Finance", "Cost Overrun", "Programme Delay"],
  14: [
    "LTV",
    "LTC",
    "DSCR",
    "ROI",
    "Return on Capital Employed",
    "IRR",
    "Net Present Value",
  ],
  15: ["Rental Cash Flow", "Net Operating Income", "Vacancy Assumption"],
  16: [
    "Property Operating Expenses",
    "Maintenance Allowance",
    "Management Cost",
    "Insurance Cost",
    "Financing Cost",
  ],
  27: [
    "Planning Risk",
    "Construction Risk",
    "Tenant Risk",
    "Property Market Risk",
    "Interest-rate Risk",
    "Liquidity Risk",
    "Regulatory Risk",
    "Tax Risk",
  ],
  28: [
    "Exit Strategy",
    "Property Sale Exit",
    "Refinance Exit",
    "Hold Strategy",
    "Development Exit",
  ],
  29: ["Portfolio Strategy", "Diversification", "Concentration Risk"],
  30: [
    "Asset Management",
    "Property Management",
    "Tenant Management",
    "Lease Management",
    "Investment Performance Tracking",
  ],
  32: ["Deal Appraisal", "Sensitivity Analysis", "Margin of Safety"],
  33: ["Deal Snapshot"],
  34: [
    "Scenario Comparison",
    "Best-case Scenario",
    "Base-case Scenario",
    "Worst-case Scenario",
  ],
  36: [
    "Common Investor Mistakes",
    "Overpaying",
    "Underestimating Costs",
    "Overestimating Rent",
    "Ignoring Exit Risk",
  ],
  37: ["Investment Checklist"],
  40: [
    "Investment Decision Framework",
    "Go/No-Go Decision",
    "Investment Memorandum",
  ],
};
const calculatorsByChapter = {
  10: ["Rental Yield"],
  11: ["LTV", "Monthly Loan Payment", "Arrangement Fee"],
  12: ["Interest Roll-up"],
  13: ["LTC", "LTGDV", "Development Profit"],
  14: ["LTV", "LTC", "ROI"],
  15: ["Rental Yield"],
  16: ["ROI"],
  32: ["ROI", "Rental Yield", "Development Profit"],
  33: ["LTV", "LTC", "ROI", "Rental Yield", "Development Profit"],
  34: ["LTV", "LTC", "ROI", "Rental Yield", "Development Profit"],
};
for (const chapter of chapters)
  if (chapterConcepts[chapter.chapter_number]) {
    chapter.related_knowledge_entries = [
      ...new Set([
        ...chapter.related_knowledge_entries,
        ...chapterConcepts[chapter.chapter_number]
          .map((x) => idByTitle.get(x))
          .filter(Boolean),
      ]),
    ];
    chapter.related_calculators = [
      ...new Set([
        ...chapter.related_calculators,
        ...(calculatorsByChapter[chapter.chapter_number] || []),
      ]),
    ];
    chapter.related_documents = [
      ...new Set([
        ...chapter.related_documents,
        ...guideSpecs.map((x) => x[0]),
      ]),
    ];
    chapter.related_case_studies = [
      ...new Set([
        ...chapter.related_case_studies.flat(),
        ...caseSpecs.map((x) => x[0]),
        ...scenarioSpecs.map((x) => x[0]),
        ...appraisalSpecs.map((x) => x[0]),
      ]),
    ];
    chapter.checklist =
      chapter.chapter_number === 27
        ? "checklist.investment-risk"
        : chapter.chapter_number === 32
          ? "checklist.investment-appraisal"
          : chapter.chapter_number === 37
            ? "checklist.investment-decision"
            : chapter.checklist;
    chapter.content_version =
      chapter.content_version === "1.1.0" ? "1.2.0" : "1.1.0";
    if (
      !chapter.revision_history.some(
        (x) =>
          x.summary?.en === "Pack 003 investor-fundamentals references added.",
      )
    )
      chapter.revision_history.push({
        version: chapter.content_version,
        date,
        summary: local(
          "Pack 003 investor-fundamentals references added.",
          "Pack 003 yatırımcı temelleri bağlantıları eklendi.",
        ),
      });
  }
chapters.sort((a, b) => a.chapter_number - b.chapter_number);
write(chaptersFile, chapters);
handbook.chapters = [
  ...new Set([
    ...handbook.chapters,
    ...[...chapterTitles.keys()].map(
      (n) => `handbook.investor.chapter-${String(n).padStart(2, "0")}`,
    ),
  ]),
];
handbook.planned_chapters = handbook.planned_chapters.filter(
  (x) => !chapterTitles.has(x.chapter_number),
);
write(handbookFile, handbook);

const packsFile = "content/packs/packs-001-003.json",
  packs = read(packsFile),
  pack = packs.find((x) => x.id === "pack.003");
pack.related_knowledge_entries = plan.concepts.map((x) => x.id);
pack.related_calculators = [
  "LTV",
  "LTC",
  "ROI",
  "Rental Yield",
  "Development Profit",
  "Monthly Loan Payment",
  "Arrangement Fee",
  "Interest Roll-up",
  "LTGDV",
];
pack.related_documents = guideSpecs.map((x) => x[0]);
pack.related_case_studies = allCaseSpecs.map((x) => x[0]);
pack.completion_status = "complete";
pack.review_status = "reviewed";
pack.reviewer = "EMCP Editorial Review";
pack.content_version = "1.1.0";
pack.official_sources = [
  source(
    "RICS consumer and professional guidance",
    "https://www.rics.org/consumer-guides",
  ),
];
pack.revision_history.push({
  version: "1.1.0",
  date,
  summary: local(
    "Pack 003 linked to its 100-concept plan and investor learning resources.",
    "Pack 003, 100 kavramlık planına ve yatırımcı öğrenme kaynaklarına bağlandı.",
  ),
});
write(packsFile, packs);
console.log(
  "Enriched 23 handbook chapters; created 5 checklists, 5 case studies, 5 guides, 3 scenarios and 3 worked appraisals.",
);
