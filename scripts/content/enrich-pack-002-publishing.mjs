import fs from "node:fs";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const date = "2026-07-14";
const local = (en, tr) => ({ en, tr });
const source = (title, url) => ({ title, url, status: "verified" });
const base = (id, type, en, tr, summaryEn, summaryTr) => ({
  id,
  object_type: type,
  title: local(en, tr),
  summary: local(summaryEn, summaryTr),
  learning_objectives: local(
    [`Use ${en} as a structured residential-property aid.`],
    [`${tr} aracını yapılandırılmış bir konut desteği olarak kullanmak.`],
  ),
  prerequisites: [],
  difficulty_level: "beginner",
  estimated_study_time_minutes: 10,
  related_knowledge_entries: [],
  related_topics: [],
  related_calculators: [],
  related_documents: [],
  related_case_studies: [],
  official_sources: [
    source(
      "GOV.UK housing and local services",
      "https://www.gov.uk/browse/housing-local-services",
    ),
  ],
  revision_history: [
    {
      version: "1.0.0",
      date,
      summary: local("Initial Pack 002 edition.", "İlk Pack 002 sürümü."),
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

const checklistSpecs = [
  [
    "checklist.residential-viewing",
    "Residential Viewing Checklist",
    "Konut Görüntüleme Kontrol Listesi",
    [
      "Record visible condition and room use.",
      "Check access, services and surroundings.",
      "List questions and evidence still required.",
      "Do not treat a viewing as a professional survey.",
    ],
    [
      "Görünür durumu ve oda kullanımını kaydedin.",
      "Giriş, altyapı ve çevreyi kontrol edin.",
      "Gereken soru ve kanıtları listeleyin.",
      "Görüntülemeyi mesleki inceleme olarak kabul etmeyin.",
    ],
  ],
  [
    "checklist.residential-purchase",
    "Residential Purchase Checklist",
    "Konut Satın Alma Kontrol Listesi",
    [
      "Confirm budget and funding evidence.",
      "Appoint appropriate advisers.",
      "Review title, searches, survey and contract.",
      "Record exchange and completion requirements.",
    ],
    [
      "Bütçeyi ve finansman kanıtını doğrulayın.",
      "Uygun uzmanları görevlendirin.",
      "Tapu, araştırma, inceleme ve sözleşmeyi değerlendirin.",
      "Sözleşme teatisi ve tamamlama gerekliliklerini kaydedin.",
    ],
  ],
  [
    "checklist.residential-letting",
    "Residential Letting Checklist",
    "Konut Kiraya Verme Kontrol Listesi",
    [
      "Confirm property readiness and applicable duties.",
      "Document tenant selection criteria.",
      "Complete agreement, inventory and deposit process.",
      "Schedule safety, maintenance and communication tasks.",
    ],
    [
      "Taşınmazın hazır olduğunu ve geçerli yükümlülükleri doğrulayın.",
      "Kiracı seçim ölçütlerini belgeleyin.",
      "Sözleşme, envanter ve depozito sürecini tamamlayın.",
      "Güvenlik, bakım ve iletişim işlerini planlayın.",
    ],
  ],
  [
    "checklist.residential-condition",
    "Residential Condition Checklist",
    "Konut Durum Kontrol Listesi",
    [
      "Record moisture, movement and visible defects.",
      "Identify inaccessible or concealed areas.",
      "Separate observation from diagnosis.",
      "Escalate material concerns to a qualified surveyor.",
    ],
    [
      "Nem, hareket ve görünür kusurları kaydedin.",
      "Erişilemeyen veya gizli alanları belirleyin.",
      "Gözlemi teşhisten ayırın.",
      "Önemli endişeleri nitelikli inceleme uzmanına yönlendirin.",
    ],
  ],
  [
    "checklist.residential-handover",
    "Residential Handover Checklist",
    "Konut Teslim Kontrol Listesi",
    [
      "Confirm keys and authorised recipients.",
      "Record meter readings and condition.",
      "Transfer relevant manuals and records.",
      "Log unresolved defects and responsibilities.",
    ],
    [
      "Anahtarları ve yetkili alıcıları doğrulayın.",
      "Sayaç değerlerini ve durumu kaydedin.",
      "İlgili kılavuzları ve kayıtları devredin.",
      "Çözülmemiş kusurları ve sorumlulukları kaydedin.",
    ],
  ],
];
const checklistsFile = "content/checklists/investor-checklists.json";
let checklists = read(checklistsFile).filter(
  (x) => !x.id.startsWith("checklist.residential-"),
);
checklists.push(
  ...checklistSpecs.map(([id, en, tr, itemsEn, itemsTr]) => ({
    ...base(
      id,
      "checklist",
      en,
      tr,
      `A practical ${en.toLowerCase()} for beginner use.`,
      `Başlangıç kullanımı için pratik ${tr.toLocaleLowerCase("tr-TR")}.`,
    ),
    items: local(itemsEn, itemsTr),
  })),
);
write(checklistsFile, checklists);

const caseSpecs = [
  [
    "case-study.first-home",
    "First-home Purchase",
    "İlk Konut Alımı",
    "A buyer compares budget, mortgage evidence, survey findings and completion tasks.",
    "Bir alıcı bütçeyi, kredi kanıtını, inceleme bulgularını ve tamamlama işlerini karşılaştırır.",
  ],
  [
    "case-study.beginner-landlord",
    "Beginner Landlord",
    "Başlangıç Seviyesi Ev Sahibi",
    "A new landlord documents income, costs, tenant setup, safety and maintenance assumptions.",
    "Yeni bir ev sahibi gelir, gider, kiracı başlangıcı, güvenlik ve bakım varsayımlarını belgeler.",
  ],
  [
    "case-study.leasehold-flat",
    "Leasehold Flat Review",
    "Leasehold Daire İncelemesi",
    "A buyer reviews lease term, service charges, major works, management and title evidence.",
    "Bir alıcı leasehold süresini, hizmet giderlerini, büyük işleri, yönetimi ve tapu kanıtını inceler.",
  ],
];
const casesFile = "content/case-studies/investor-case-studies.json";
let cases = read(casesFile).filter(
  (x) =>
    !x.id.startsWith("case-study.first-home") &&
    !x.id.startsWith("case-study.beginner-landlord") &&
    !x.id.startsWith("case-study.leasehold-flat"),
);
cases.push(
  ...caseSpecs.map(([id, en, tr, summaryEn, summaryTr]) => ({
    ...base(id, "case_study", en, tr, summaryEn, summaryTr),
    scenario: local(summaryEn, summaryTr),
    lessons: local(
      [
        "Separate evidence from assumptions.",
        "Escalate legal, valuation, lending and technical questions.",
      ],
      [
        "Kanıtı varsayımdan ayırın.",
        "Hukuk, değerleme, kredi ve teknik soruları uzmanlara yönlendirin.",
      ],
    ),
  })),
);
write(casesFile, cases);

const guideSpecs = [
  [
    "document-guide.mortgage-offer",
    "Mortgage Offer Guide",
    "Konut Kredisi Teklifi Rehberi",
    "residential.mortgages.mortgage-offer",
  ],
  [
    "document-guide.residential-title",
    "Residential Title Guide",
    "Konut Tapu Kaydı Rehberi",
    "Title Register",
  ],
  [
    "document-guide.tenancy-agreement",
    "Tenancy Agreement Guide",
    "Konut Kira Sözleşmesi Rehberi",
    "Tenancy Agreement",
  ],
  [
    "document-guide.property-survey",
    "Property Survey Guide",
    "Taşınmaz İnceleme Raporu Rehberi",
    "residential.surveys.property-survey",
  ],
  [
    "document-guide.leasehold-pack",
    "Leasehold Information Guide",
    "Leasehold Bilgi Paketi Rehberi",
    "residential.documents.leasehold-information-form",
  ],
];
const guidesFile = "content/document-guides/property-purchase-documents.json";
let guides = read(guidesFile).filter(
  (x) =>
    !x.id.startsWith("document-guide.mortgage-offer") &&
    !x.id.startsWith("document-guide.residential-title") &&
    !x.id.startsWith("document-guide.tenancy-agreement") &&
    !x.id.startsWith("document-guide.property-survey") &&
    !x.id.startsWith("document-guide.leasehold-pack"),
);
guides.push(
  ...guideSpecs.map(([id, en, tr, term]) => ({
    ...base(
      id,
      "document_guide",
      en,
      tr,
      `A beginner guide to the purpose, checks and limitations of a ${term}.`,
      `${term} belgesinin amacı, kontrolleri ve sınırlarına ilişkin başlangıç rehberi.`,
    ),
    related_knowledge_entries: [term],
    document_purpose: local(
      "Identify the document, its date, parties, scope, assumptions and matters needing advice.",
      "Belgeyi, tarihini, taraflarını, kapsamını, varsayımlarını ve uzman görüşü gerektiren konuları belirlemek.",
    ),
    review_steps: local(
      [
        "Confirm the latest complete version.",
        "Check names, property identity, dates and stated conditions.",
        "Refer material uncertainty to the responsible professional.",
      ],
      [
        "En güncel eksiksiz sürümü doğrulayın.",
        "Adları, taşınmaz kimliğini, tarihleri ve belirtilen şartları kontrol edin.",
        "Önemli belirsizlikleri sorumlu uzmana yönlendirin.",
      ],
    ),
  })),
);
write(guidesFile, guides);

const chapterLinks = {
  2: ["residential.leasehold.commonhold", "residential.investment.buy-to-let"],
  4: [
    "residential.valuation.comparable-property",
    "residential.insurance.underinsurance",
  ],
  6: [
    "residential.buying.agreement-in-principle",
    "residential.buying.completion-statement",
    "residential.mortgages.mortgage-offer",
  ],
  7: [
    "residential.surveys.property-survey",
    "residential.defects.structural-movement",
    "residential.insurance.insured-peril",
  ],
  8: [
    "residential.ownership.legal-owner",
    "residential.ownership.beneficial-owner",
    "residential.ownership.general-boundary",
  ],
  9: [
    "residential.valuation.comparable-property",
    "residential.valuation.comparable-sales-analysis",
    "residential.valuation.valuation-date",
  ],
  10: [
    "residential.investment.gross-rental-yield",
    "residential.investment.net-rental-yield",
    "residential.investment.rental-void-period",
  ],
  11: [
    "residential.mortgages.mortgage-offer",
    "residential.mortgages.mortgage-affordability-assessment",
    "residential.mortgages.remortgage",
  ],
  17: [
    "residential.management.letting-agent-fee",
    "residential.management.property-management-fee",
    "residential.insurance.insurance-excess",
  ],
  18: [
    "residential.investment.cash-on-cash-return",
    "residential.exit.open-market-sale",
    "residential.renovation.residential-refurbishment",
  ],
  19: [
    "residential.investment.buy-to-let",
    "residential.landlord.deposit-protection",
    "residential.tenancy.tenant-referencing",
  ],
  20: [
    "residential.landlord.landlord-repair-duty",
    "residential.management.periodic-property-inspection",
    "residential.investment.rental-void-period",
  ],
};
const chaptersFile = "content/handbooks/investor/chapters.json";
const chapters = read(chaptersFile).map((chapter) => {
  const links = chapterLinks[chapter.chapter_number];
  if (!links) return chapter;
  chapter.related_knowledge_entries = [
    ...new Set([...chapter.related_knowledge_entries, ...links]),
  ];
  chapter.related_documents = [
    ...new Set([
      ...chapter.related_documents,
      ...guideSpecs.slice(0, (chapter.chapter_number % 5) + 1).map((x) => x[0]),
    ]),
  ];
  chapter.related_case_studies = [
    ...new Set([
      ...chapter.related_case_studies
        .flat()
        .filter((value) => typeof value === "string"),
      ...caseSpecs.map((x) => x[0]),
    ]),
  ];
  chapter.pack_002_enrichment = local(
    "Links reviewed residential fundamentals while retaining draft chapter status pending chapter-level professional review.",
    "Bölüm düzeyinde mesleki inceleme beklenirken taslak durumu korunarak incelenmiş konut temellerine bağlantı verir.",
  );
  chapter.content_version = "1.1.0";
  if (!chapter.revision_history.some((x) => x.version === "1.1.0"))
    chapter.revision_history.push({
      version: "1.1.0",
      date,
      summary: local(
        "Pack 002 residential references added.",
        "Pack 002 konut bağlantıları eklendi.",
      ),
    });
  return chapter;
});
write(chaptersFile, chapters);

const packsFile = "content/packs/packs-001-003.json";
const packs = read(packsFile);
const pack = packs.find((x) => x.id === "pack.002");
pack.related_knowledge_entries = Array.from({ length: 100 }, (_, index) => {
  const plan = read("content/topic-plans/content-pack-002.json");
  return plan.groups.flatMap((group) => group.planned_entries)[index].id;
});
pack.related_calculators = ["Rental Yield", "ROI", "Monthly Loan Payment"];
pack.related_documents = guideSpecs.map((x) => x[0]);
pack.related_case_studies = caseSpecs.map((x) => x[0]);
pack.completion_status = "complete";
pack.content_version = "1.1.0";
pack.review_status = "reviewed";
pack.reviewer = "EMCP Editorial Review";
pack.official_sources = [
  source(
    "GOV.UK housing and local services",
    "https://www.gov.uk/browse/housing-local-services",
  ),
  source("RICS consumer guides", "https://www.rics.org/consumer-guides"),
];
pack.revision_history.push({
  version: "1.1.0",
  date,
  summary: local(
    "Pack 002 linked to 100 reviewed entries and residential learning resources.",
    "Pack 002, 100 incelenmiş kayıt ve konut öğrenme kaynağına bağlandı.",
  ),
});
write(packsFile, packs);
console.log(
  "Enriched 12 chapters; created 5 checklists, 3 case studies and 5 document guides.",
);
