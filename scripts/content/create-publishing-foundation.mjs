import fs from "node:fs";
import path from "node:path";

const date = "2026-07-14";
const localized = (en, tr) => ({ en, tr });
const sourceRequired = [
  {
    title: "Authoritative source review required",
    url: null,
    status: "required",
  },
];
const revision = [
  {
    version: "1.0.0",
    date,
    summary: localized(
      "Initial publishing architecture draft.",
      "İlk yayın mimarisi taslağı.",
    ),
  },
];
const common = (id, type, en, tr, summaryEn, summaryTr, extra = {}) => ({
  id,
  object_type: type,
  title: localized(en, tr),
  summary: localized(summaryEn, summaryTr),
  learning_objectives: localized(
    [`Understand ${en} and its place in the publishing hierarchy.`],
    [`${tr} konusunu ve yayın hiyerarşisindeki yerini anlamak.`],
  ),
  prerequisites: [],
  difficulty_level: "beginner",
  estimated_study_time_minutes: 30,
  related_knowledge_entries: [],
  related_topics: [],
  related_calculators: [],
  related_documents: [],
  related_case_studies: [],
  official_sources: sourceRequired,
  revision_history: revision,
  completion_status: "planned",
  content_version: "1.0.0",
  review_status: "draft",
  reviewer: null,
  jurisdiction: [
    "United Kingdom",
    "Turkey — local professional verification required",
  ],
  ...extra,
});
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const pack001KnowledgeIds = fs
  .readdirSync("content/reviewed/pack-001")
  .filter((name) => name.endsWith(".json"))
  .map(
    (name) =>
      JSON.parse(
        fs.readFileSync(path.join("content/reviewed/pack-001", name), "utf8"),
      ).id,
  )
  .sort();

const chapterTitles = [
  [
    "Investor Mindset and Core Concepts",
    "Yatırımcı Zihniyeti ve Temel Kavramlar",
  ],
  ["Property Types", "Gayrimenkul Türleri"],
  ["Market Research", "Piyasa Araştırması"],
  ["Area and Location Analysis", "Bölge ve Lokasyon Analizi"],
  ["Deal Sourcing", "Deal Sourcing"],
  ["Buying Process", "Satın Alma Süreci"],
  ["Due Diligence", "Due Diligence"],
  ["Title, Ownership and Legal Checks", "Tapu, Mülkiyet ve Hukuki Kontroller"],
  ["Valuation Fundamentals", "Değerleme Temelleri"],
  ["Rental Income and Yield", "Kira Geliri ve Yield"],
  ["Finance and Mortgages", "Finansman ve Mortgage"],
  ["Bridging Finance", "Bridging Finance"],
  ["Development Finance", "Development Finance"],
  [
    "LTV, LTC, DSCR, ROI, ROCE, IRR and NPV",
    "LTV, LTC, DSCR, ROI, ROCE, IRR ve NPV",
  ],
  ["Cash Flow", "Nakit Akışı"],
  ["Operating Expenses", "İşletme Giderleri"],
  ["Taxes and Costs", "Vergi ve Masraflar"],
  ["Residential Investment", "Residential Investment"],
  ["Buy-to-Let", "Buy-to-Let"],
  ["HMO", "HMO"],
  ["Commercial Property", "Commercial Property"],
  ["Mixed-Use Property", "Mixed-Use Property"],
  ["Property Development", "Property Development"],
  ["Renovation and Refurbishment", "Renovation ve Refurbishment"],
  ["Construction Cost Basics", "Construction Cost Basics"],
  ["Planning and Building Control", "Planning ve Building Control"],
  ["Risk Management", "Risk Yönetimi"],
  ["Exit Strategy", "Exit Strategy"],
  ["Portfolio Building", "Portfolio Building"],
  ["Asset Management", "Asset Management"],
  ["Tenant and Lease Management", "Tenant ve Lease Management"],
  ["Deal Appraisal", "Deal Appraisal"],
  ["Using Deal Snapshot", "Deal Snapshot Kullanımı"],
  ["Saving and Comparing Scenarios", "Senaryo Kaydetme ve Karşılaştırma"],
  ["Real Case Studies", "Gerçek Vaka Analizleri"],
  ["Common Investor Mistakes", "Sık Yapılan Yatırımcı Hataları"],
  ["Investment Checklists", "Yatırım Kontrol Listeleri"],
  ["Document Guide", "Belge Rehberi"],
  ["Building a Professional Team", "Profesyonel Ekip Kurma"],
  ["Investment Decision Framework", "Yatırım Karar Çerçevesi"],
];
const knowledge = [
  ["Capital Growth", "Property Total Return", "Exit Strategy"],
  ["Freehold", "Leasehold", "Mixed-use", "HMO", "BTR", "PBSA"],
  ["Market Value", "Asking Price", "Asking Rent", "ERV"],
  ["Property Searches", "Flood Risk", "Local Plan"],
  ["Origination", "Deal Flow", "Pipeline"],
  [
    "Conveyancing",
    "Property Offer",
    "Property Chain",
    "Exchange of Contracts",
    "Legal Completion",
  ],
  ["Due Diligence", "Home Survey", "Building Survey", "Data Room"],
  [
    "Title Register",
    "Title Plan",
    "Joint Property Ownership",
    "Freehold",
    "Leasehold",
  ],
  ["Market Value", "Mortgage Valuation", "GDV", "ERV"],
  [
    "Rent",
    "Gross Rental Income",
    "Net Rental Income",
    "Yield",
    "Rental Cash Flow",
  ],
  [
    "Mortgage",
    "Mortgage Deposit",
    "LTV",
    "Repayment Mortgage",
    "Interest-Only Mortgage",
  ],
  ["Bridge Loan", "Loan Principal", "Interest Rate", "Exit Strategy"],
  ["Development Finance", "LTC", "LTGDV", "GDV", "Drawdown"],
  ["LTV", "LTC", "DSCR", "ROI", "IRR"],
  [
    "Rental Cash Flow",
    "Gross Rental Income",
    "Net Rental Income",
    "Property Operating Expenses",
  ],
  [
    "Property Operating Expenses",
    "Property Maintenance Cost",
    "Property Repair Cost",
    "Service Charge",
  ],
  [
    "Stamp Duty Land Tax",
    "Council Tax",
    "Arrangement Fee",
    "Building Insurance Premium",
  ],
  ["BTR", "PBSA", "Mortgage", "Home Survey"],
  ["Landlord", "Tenant", "Rent", "Tenancy Agreement", "Tenancy Deposit"],
  ["HMO", "Landlord", "Tenant", "Tenancy Agreement", "Rental Inventory"],
];
const calculators = [
  ["ROI"],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  ["Development Profit"],
  ["Rental Yield"],
  ["LTV", "Monthly Loan Payment"],
  ["Interest Roll-up", "Monthly Loan Payment"],
  ["LTC", "LTGDV", "Interest Roll-up"],
  ["LTV", "LTC", "ROI"],
  ["Rental Yield", "Monthly Loan Payment"],
  [],
  ["Arrangement Fee"],
  ["Rental Yield", "Monthly Loan Payment"],
  ["Rental Yield"],
  ["Rental Yield"],
];
const checklistIds = [
  "checklist.investment-screening",
  "checklist.purchase-due-diligence",
  "checklist.finance-readiness",
  "checklist.rental-readiness",
];
const chapters = chapterTitles.slice(0, 20).map(([en, tr], index) => {
  const number = index + 1,
    id = `handbook.investor.chapter-${String(number).padStart(2, "0")}`,
    next =
      number < 20
        ? `handbook.investor.chapter-${String(number + 1).padStart(2, "0")}`
        : null;
  return common(
    id,
    "handbook_chapter",
    en,
    tr,
    `A practical introduction to ${en.toLowerCase()} for property investors.`,
    `Gayrimenkul yatırımcıları için ${tr} konusuna pratik bir giriş.`,
    {
      chapter_number: number,
      learning_objectives: localized(
        [
          `Explain the core purpose of ${en}.`,
          "Connect the chapter to existing EMCP knowledge and tools.",
          "Identify questions that require qualified professional advice.",
        ],
        [
          `${tr} konusunun temel amacını açıklamak.`,
          "Bölümü mevcut EMCP bilgileri ve araçlarıyla ilişkilendirmek.",
          "Yetkin uzman görüşü gerektiren soruları belirlemek.",
        ],
      ),
      prerequisites:
        number === 1
          ? []
          : [
              `handbook.investor.chapter-${String(number - 1).padStart(2, "0")}`,
            ],
      estimated_study_time_minutes: 20,
      related_knowledge_entries: knowledge[index],
      related_calculators: calculators[index],
      related_documents:
        number === 6 || number === 8
          ? ["document-guide.property-purchase-documents"]
          : [],
      related_case_studies: ["case-study.investor-screening-example"],
      simple_explanation: localized(
        `This chapter explains ${en.toLowerCase()} in plain language and shows where it fits in an investment decision.`,
        `Bu bölüm ${tr} konusunu sade dille açıklar ve yatırım kararındaki yerini gösterir.`,
      ),
      professional_explanation: localized(
        `The chapter organises existing reviewed EMCP concepts relevant to ${en}; it does not replace transaction-specific legal, tax, lending, valuation or technical advice.`,
        `Bölüm, ${tr} ile ilgili mevcut incelenmiş EMCP kavramlarını düzenler; işleme özel hukuk, vergi, kredi, değerleme veya teknik danışmanlığın yerini almaz.`,
      ),
      real_world_example: localized(
        "A learner reviews the linked concepts, records assumptions and uses the relevant calculator before discussing the opportunity with advisers.",
        "Öğrenci, fırsatı uzmanlarla görüşmeden önce bağlantılı kavramları inceler, varsayımları kaydeder ve ilgili hesaplayıcıyı kullanır.",
      ),
      worked_example: localized(
        "Use a hypothetical property and write down the price, income, costs, funding and key risks; do not use the example as a live recommendation.",
        "Varsayımsal bir taşınmaz için fiyatı, geliri, maliyetleri, finansmanı ve temel riskleri yazın; örneği gerçek bir tavsiye olarak kullanmayın.",
      ),
      formulas: calculators[index],
      common_mistakes: localized(
        [
          "Using general educational content as personalised advice.",
          "Ignoring missing evidence or jurisdiction differences.",
        ],
        [
          "Genel eğitim içeriğini kişisel tavsiye olarak kullanmak.",
          "Eksik kanıtları veya bölgesel farklılıkları göz ardı etmek.",
        ],
      ),
      risks: localized(
        [
          "Inputs, rules and market conditions can change.",
          "A simplified example may omit material risks.",
        ],
        [
          "Girdiler, kurallar ve piyasa şartları değişebilir.",
          "Basitleştirilmiş örnek önemli riskleri içermeyebilir.",
        ],
      ),
      checklist: checklistIds[index % checklistIds.length],
      uk_practice: localized(
        "Authoritative UK source review is required before this draft can be published as reviewed guidance.",
        "Bu taslak incelenmiş rehber olarak yayımlanmadan önce yetkili Birleşik Krallık kaynaklarıyla kontrol edilmelidir.",
      ),
      turkey_practice: localized(
        "Turkish law, tax, title, lending and technical practice must be verified by appropriately qualified local professionals.",
        "Türkiye'deki hukuk, vergi, tapu, kredi ve teknik uygulamalar uygun nitelikte yerel uzmanlarca doğrulanmalıdır.",
      ),
      beginner_questions: localized(
        [
          `What is the simplest meaning of ${en}?`,
          "Which documents and numbers should I collect first?",
        ],
        [
          `${tr} en basit şekilde ne demektir?`,
          "Önce hangi belgeleri ve rakamları toplamalıyım?",
        ],
      ),
      interview_questions: localized(
        [
          `How would you explain ${en} to a client?`,
          "Which assumptions would you verify?",
        ],
        [
          `${tr} konusunu bir müşteriye nasıl açıklarsınız?`,
          "Hangi varsayımları doğrularsınız?",
        ],
      ),
      quiz: [
        {
          question: localized(
            "What should happen before relying on this chapter for a real transaction?",
            "Bu bölümü gerçek bir işlemde kullanmadan önce ne yapılmalıdır?",
          ),
          options: localized(
            [
              "Obtain property-specific professional advice",
              "Assume the example is complete",
            ],
            [
              "Taşınmaza özel profesyonel görüş almak",
              "Örneğin eksiksiz olduğunu varsaymak",
            ],
          ),
          correct_index: 0,
        },
      ],
      next_recommended_chapter: next,
    },
  );
});

const topics = [
  common(
    "topic.property-finance-ratios",
    "topic",
    "Property Finance Ratios",
    "Gayrimenkul Finansman Oranları",
    "Core ratios used to describe leverage, cover and returns.",
    "Kaldıraç, karşılama ve getiriyi açıklayan temel oranlar.",
    {
      related_knowledge_entries: ["LTV", "LTC", "DSCR", "ROI", "IRR"],
      related_calculators: ["LTV", "LTC", "ROI"],
    },
  ),
  common(
    "topic.residential-investment",
    "topic",
    "Residential Investment",
    "Konut Yatırımı",
    "Ownership, letting, finance and risk in residential investment.",
    "Konut yatırımında mülkiyet, kiralama, finansman ve risk.",
    {
      related_knowledge_entries: [
        "Mortgage",
        "Rent",
        "Landlord",
        "Tenant",
        "Home Survey",
      ],
    },
  ),
  common(
    "topic.property-transactions",
    "topic",
    "Property Transactions",
    "Gayrimenkul İşlemleri",
    "The practical buying, title and due-diligence process.",
    "Satın alma, tapu ve inceleme süreci.",
    {
      related_knowledge_entries: [
        "Conveyancing",
        "Property Searches",
        "Title Register",
        "Exchange of Contracts",
      ],
    },
  ),
];
const modules = [
  common(
    "module.property-finance-fundamentals",
    "learning_module",
    "Property Finance Fundamentals",
    "Gayrimenkul Finansmanı Temelleri",
    "A module organising finance entries and ratio topics.",
    "Finansman kayıtlarını ve oran konularını düzenleyen modül.",
    {
      child_topics: ["topic.property-finance-ratios"],
      related_topics: ["topic.property-finance-ratios"],
      related_knowledge_entries: ["LTV", "LTC", "DSCR", "ROI", "IRR"],
    },
  ),
  common(
    "module.residential-property-fundamentals",
    "learning_module",
    "Residential Property Fundamentals",
    "Konut Gayrimenkulü Temelleri",
    "A module for residential ownership, letting and finance.",
    "Konut mülkiyeti, kiralama ve finansman modülü.",
    {
      child_topics: [
        "topic.residential-investment",
        "topic.property-transactions",
      ],
      related_topics: [
        "topic.residential-investment",
        "topic.property-transactions",
      ],
    },
  ),
];
const packs = [
  common(
    "pack.001",
    "content_pack",
    "Everyday Property, Construction and Finance Fundamentals",
    "Günlük Gayrimenkul, İnşaat ve Finans Temelleri",
    "The existing 100-entry reviewed foundation pack.",
    "Mevcut 100 kayıtlık incelenmiş temel paket.",
    {
      completion_status: "complete",
      review_status: "reviewed",
      reviewer: "EMCP Content Pack 001 source review",
      child_modules: ["module.property-finance-fundamentals"],
      related_knowledge_entries: pack001KnowledgeIds,
    },
  ),
  common(
    "pack.002",
    "content_pack",
    "Residential Property Fundamentals",
    "Konut Gayrimenkulü Temelleri",
    "A planned pack covering practical residential property concepts.",
    "Pratik konut gayrimenkulü kavramlarını kapsayan planlı paket.",
    {
      child_modules: ["module.residential-property-fundamentals"],
      prerequisites: ["pack.001"],
    },
  ),
  common(
    "pack.003",
    "content_pack",
    "Property Investor Fundamentals",
    "Gayrimenkul Yatırımcılığı Temelleri",
    "A planned pack connecting investment decisions, finance and risk.",
    "Yatırım kararlarını, finansmanı ve riski birleştiren planlı paket.",
    { prerequisites: ["pack.001", "pack.002"] },
  ),
];
const pathObject = common(
  "path.property-investor",
  "learning_path",
  "Property Investor Learning Path",
  "Gayrimenkul Yatırımcısı Öğrenme Yolu",
  "A progressive route from foundation concepts to investor decision-making.",
  "Temel kavramlardan yatırım kararına ilerleyen öğrenme yolu.",
  {
    child_packs: ["pack.001", "pack.002", "pack.003"],
    prerequisites: ["pack.001"],
  },
);
const handbook = common(
  "handbook.property-investor",
  "handbook",
  "Property Investor’s Handbook",
  "Gayrimenkul Yatırımcısının El Kitabı",
  "A practical bilingual handbook that progresses from beginner foundations to advanced investment decisions.",
  "Başlangıç temellerinden ileri yatırım kararlarına ilerleyen pratik iki dilli el kitabı.",
  {
    child_paths: ["path.property-investor"],
    chapters: chapters.map((chapter) => chapter.id),
    planned_chapters: chapterTitles.slice(20).map(([en, tr], index) => ({
      chapter_number: index + 21,
      id: `handbook.investor.chapter-${String(index + 21).padStart(2, "0")}`,
      title: localized(en, tr),
    })),
    completion_status: "in_progress",
    estimated_study_time_minutes: 1200,
  },
);
const checklistNames = [
  [
    "investment-screening",
    "Investment Screening Checklist",
    "Yatırım Ön Eleme Kontrol Listesi",
  ],
  [
    "purchase-due-diligence",
    "Purchase Due-Diligence Checklist",
    "Satın Alma İnceleme Kontrol Listesi",
  ],
  [
    "finance-readiness",
    "Finance Readiness Checklist",
    "Finansmana Hazırlık Kontrol Listesi",
  ],
  [
    "rental-readiness",
    "Rental Readiness Checklist",
    "Kiralamaya Hazırlık Kontrol Listesi",
  ],
];
const checklists = checklistNames.map(([slug, en, tr]) =>
  common(
    `checklist.${slug}`,
    "checklist",
    en,
    tr,
    "A reusable draft checklist linked from handbook chapters.",
    "El kitabı bölümlerinden bağlantı verilen yeniden kullanılabilir taslak liste.",
    {
      items: localized(
        [
          "Define the objective.",
          "Collect evidence.",
          "Record assumptions.",
          "Escalate specialist questions.",
        ],
        [
          "Amacı tanımlayın.",
          "Kanıtları toplayın.",
          "Varsayımları kaydedin.",
          "Uzmanlık gerektiren soruları yönlendirin.",
        ],
      ),
    },
  ),
);
const caseStudies = [
  common(
    "case-study.investor-screening-example",
    "case_study",
    "Investor Screening Example",
    "Yatırım Ön Eleme Örneği",
    "A placeholder case study for a future fully evidenced investor appraisal.",
    "Gelecekte kanıtlarla tamamlanacak yatırım değerlendirmesi vaka taslağı.",
    { facts_verified: false },
  ),
];
const guides = [
  common(
    "document-guide.property-purchase-documents",
    "document_guide",
    "Property Purchase Document Guide",
    "Taşınmaz Satın Alma Belge Rehberi",
    "A draft map of common purchase documents and when professional review is needed.",
    "Yaygın satın alma belgelerini ve uzman incelemesi gereken noktaları gösteren taslak rehber.",
    {
      related_knowledge_entries: [
        "Title Register",
        "Title Plan",
        "Contract for Sale",
        "Transfer Deed",
        "Property Information Form",
      ],
    },
  ),
];

write("content/topics/investor-topics.json", topics);
write("content/modules/investor-modules.json", modules);
write("content/packs/packs-001-003.json", packs);
write("content/paths/property-investor-learning-path.json", pathObject);
write("content/handbooks/investor/handbook.json", handbook);
write("content/handbooks/investor/chapters.json", chapters);
write("content/case-studies/investor-case-studies.json", caseStudies);
write("content/checklists/investor-checklists.json", checklists);
write("content/document-guides/property-purchase-documents.json", guides);

const groupTitles = [
  [1, 10, "Foundation", "Temeller"],
  [11, 20, "Residential Property", "Konut Gayrimenkulü"],
  [21, 30, "Commercial Property", "Ticari Gayrimenkul"],
  [31, 40, "Construction and Development", "İnşaat ve Geliştirme"],
  [41, 50, "Finance and Investment", "Finans ve Yatırım"],
  [51, 60, "Valuation and Appraisal", "Değerleme ve Analiz"],
  [61, 70, "Planning, Law and Compliance", "Planlama, Hukuk ve Uyum"],
  [
    71,
    80,
    "Documents, Contracts and Due Diligence",
    "Belgeler, Sözleşmeler ve İnceleme",
  ],
  [81, 90, "Asset Management and Operations", "Varlık Yönetimi ve Operasyon"],
  [
    91,
    100,
    "Advanced Investor, Portfolio and Strategy",
    "İleri Yatırımcı, Portföy ve Strateji",
  ],
];
const roadmap = Array.from({ length: 100 }, (_, index) => {
  const number = index + 1,
    group = groupTitles.find(
      ([start, end]) => number >= start && number <= end,
    ),
    special =
      number === 1
        ? packs[0].title
        : number === 2
          ? packs[1].title
          : number === 3
            ? packs[2].title
            : localized(
                `${group[2]} Pack ${String(number).padStart(3, "0")}`,
                `${group[3]} Paketi ${String(number).padStart(3, "0")}`,
              );
  return {
    pack_number: number,
    title: special,
    target_audience:
      number <= 20
        ? "Beginner property learners and practitioners"
        : "Property and construction professionals",
    difficulty:
      number <= 20
        ? "beginner"
        : number <= 60
          ? "intermediate"
          : number <= 90
            ? "advanced"
            : "expert",
    learning_objective: localized(
      `Build verified knowledge in ${group[2].toLowerCase()}.`,
      `${group[3]} alanında doğrulanmış bilgi oluşturmak.`,
    ),
    planned_entry_count: 100,
    related_calculators: number <= 60 ? ["LTV", "ROI", "Rental Yield"] : [],
    related_handbook_chapters: chapterTitles
      .map((_, chapterIndex) => chapterIndex + 1)
      .filter((chapter) => (chapter - 1) % 10 === index % 10),
    recommended_official_sources: [
      "GOV.UK",
      "HM Land Registry",
      "Planning Portal",
      "RICS",
      "HSE",
      "HMRC",
    ],
    status: number === 1 ? "complete" : "planned",
    dependencies:
      number === 1 ? [] : [`pack.${String(number - 1).padStart(3, "0")}`],
  };
});
write("content/roadmaps/master-content-roadmap.json", {
  roadmap_id: "emcp-100-pack-master",
  content_version: "1.0.0",
  groups: groupTitles.map(([start, end, en, tr]) => ({
    range: `${start}-${end}`,
    title: localized(en, tr),
  })),
  packs: roadmap,
});
console.log(
  "Created publishing foundation, 20 draft chapters and 100-pack roadmap.",
);
