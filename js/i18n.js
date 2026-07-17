(function (global) {
  "use strict";
  const storage = global.EMCPCore.storage;
  const messages = {
    tr: {
      skipToContent: "Ana içeriğe geç",
      tagline:
        "Gayrimenkul, İnşaat ve Yatırım Profesyonelleri için İşletim Sistemi.",
      searchPlaceholder: "Bir harf, kelime veya kısaltma yazın…",
      clear: "Temizle",
      installTitle: "Telefonuna uygulama gibi kur",
      installText:
        "Safari’de aç, Paylaş düğmesine bas ve “Ana Ekrana Ekle”yi seç.",
      installButton: "Kurulum talimatlarını göster",
      knowledgeEntries: "Bilgi Kaydı",
      favourites: "Favoriler",
      recent: "Son Kullanılanlar",
      explore: "Platformu Keşfet",
      exploreIntro:
        "Gayrimenkul, inşaat ve yatırım profesyonelleri için bilgi, hesaplamalar ve pratik araçlar.",
      knowledgeDescription:
        "İki dilli terminoloji, pratik rehberler ve profesyonel referans içeriği.",
      assistantDescription:
        "Bir soru sorun ve yerel profesyonel bilgi tabanında arama yapın.",
      calculators: "Hesaplayıcılar",
      calculatorsDescription: "Finansman, geliştirme ve inşaat hesaplamaları.",
      constructionTools: "İnşaat Araçları",
      constructionDescription: "Metraj ve şantiye ölçüm araçları.",
      legalCompliance: "Hukuk ve Uyum",
      legalDescription:
        "Birleşik Krallık hukuk, planlama ve durum tespiti rehberleri.",
      emailStudio: "E-posta Stüdyosu",
      emailDescription: "Profesyonel iki dilli e-posta şablonları.",
      meetingAssistant: "Toplantı Asistanı",
      meetingDescription:
        "Yatırımcı, kredi veren ve geliştirici toplantı hazırlığı.",
      workspace: "Çalışma Alanım",
      workspaceDescription:
        "Favorilerinizi, koleksiyonlarınızı, notlarınızı ve kayıtlı işlem senaryolarınızı yönetin.",
      workspaceIntro:
        "Kişisel bilgi ve işlem çalışma alanınız. Veriler varsayılan olarak yalnızca bu cihazda tutulur.",
      onDevice: "Yalnızca bu cihazda",
      overview: "Genel Bakış",
      collections: "Koleksiyonlar",
      scenarios: "Senaryolar",
      dataTools: "Veri Yedekleme",
      exportData: "Verileri dışa aktar",
      importData: "Verileri içe aktar",
      importFile: "Çalışma alanı yedeği seç",
      active: "AKTİF",
      planned: "PLANLANIYOR",
      availableOffline: "Çevrimdışı kullanılabilir",
      assistantIntro:
        "Gayrimenkul, inşaat, yatırım, finansman veya uyum hakkında sorun. EMCP önce yerel bilgisinde arama yapar.",
      yourQuestion: "Sorunuz",
      assistantPlaceholder: "Profesyonel bir soru sorun…",
      askEmcp: "EMCP’ye Sor",
      dealSnapshot: "İşlem Özeti",
      dealIntro:
        "Kaldıraç, maliyet, değer, kâr ve getiri ölçülerini yeniden kullanılabilir tek senaryoda birleştirin.",
      savedLocally: "Yerel olarak kaydedilir",
      scenarioName: "Senaryo adı",
      scenarioPlaceholder: "örn. Nottingham satın alımı",
      loanPounds: "Kredi (£)",
      propertyValuePounds: "Gayrimenkul değeri (£)",
      totalCostPounds: "Toplam geliştirme maliyeti (£)",
      gdvPounds: "Brüt geliştirme değeri (£)",
      annualRentPounds: "Yıllık kira (£)",
      calculateSnapshot: "Özeti hesapla",
      useExample: "Örneği kullan",
      reset: "Sıfırla",
      saveScenario: "Senaryoyu kaydet",
      copySummary: "Özeti kopyala",
      shareSummary: "Özeti paylaş",
      savedScenarios: "Kayıtlı senaryolar",
      noScenarios: "Henüz kayıtlı senaryo yok.",
      calculatorCategories: "Hesaplayıcı kategorileri",
      all: "Tümü",
      finance: "Finansman",
      development: "Geliştirme",
      property: "Gayrimenkul",
      stampDutyGuide: "Damga Vergisi Rehberi",
      stampDutyPlaceholder:
        "Gelecekteki canlı Birleşik Krallık SDLT kuralları için planlanan modül.",
      home: "Ana Sayfa",
      knowledge: "Bilgi",
      build: "İnşaat",
      help: "Yardım",
    },
    en: {
      skipToContent: "Skip to main content",
      tagline:
        "The Operating System for Property, Construction & Investment Professionals.",
      searchPlaceholder: "Type a letter, term or abbreviation…",
      clear: "Clear",
      installTitle: "Install it like an app",
      installText:
        "Open in Safari, tap Share, then choose “Add to Home Screen”.",
      installButton: "Show installation instructions",
      knowledgeEntries: "Knowledge Entries",
      favourites: "Favourites",
      recent: "Recent",
      explore: "Explore the Platform",
      exploreIntro:
        "Knowledge, calculators and practical tools built for property, construction and investment professionals.",
      knowledgeDescription:
        "Bilingual terminology, practical guides and professional reference content.",
      assistantDescription:
        "Ask a question and search the local professional knowledge base.",
      calculators: "Calculators",
      calculatorsDescription:
        "Finance, development and construction calculations.",
      constructionTools: "Construction Tools",
      constructionDescription: "Material take-off and site measurement tools.",
      legalCompliance: "Legal & Compliance",
      legalDescription: "UK legal, planning and due diligence guides.",
      emailStudio: "Email Studio",
      emailDescription: "Professional bilingual email templates.",
      meetingAssistant: "Meeting Assistant",
      meetingDescription: "Investor, lender and developer meeting preparation.",
      workspace: "My Workspace",
      workspaceDescription:
        "Manage favourites, collections, notes and saved deal scenarios.",
      workspaceIntro:
        "Your personal knowledge and deal workspace. Data stays on this device by default.",
      onDevice: "On this device only",
      overview: "Overview",
      collections: "Collections",
      scenarios: "Scenarios",
      dataTools: "Data Backup",
      exportData: "Export data",
      importData: "Import data",
      importFile: "Choose workspace backup",
      active: "ACTIVE",
      planned: "PLANNED",
      availableOffline: "Available offline",
      assistantIntro:
        "Ask about property, construction, investment, finance or compliance. EMCP searches its local knowledge first.",
      yourQuestion: "Your question",
      assistantPlaceholder: "Ask a professional question…",
      askEmcp: "Ask EMCP",
      dealSnapshot: "Deal Snapshot",
      dealIntro:
        "Combine leverage, cost, value, profit and return metrics in one reusable scenario.",
      savedLocally: "Saved locally",
      scenarioName: "Scenario name",
      scenarioPlaceholder: "e.g. Nottingham acquisition",
      loanPounds: "Loan (£)",
      propertyValuePounds: "Property value (£)",
      totalCostPounds: "Total development cost (£)",
      gdvPounds: "Gross development value (£)",
      annualRentPounds: "Annual rent (£)",
      calculateSnapshot: "Calculate snapshot",
      useExample: "Use example",
      reset: "Reset",
      saveScenario: "Save scenario",
      copySummary: "Copy summary",
      shareSummary: "Share summary",
      savedScenarios: "Saved scenarios",
      noScenarios: "No saved scenarios yet.",
      calculatorCategories: "Calculator categories",
      all: "All",
      finance: "Finance",
      development: "Development",
      property: "Property",
      stampDutyGuide: "Stamp Duty Guide",
      stampDutyPlaceholder: "Placeholder module for future live UK SDLT rules.",
      home: "Home",
      knowledge: "Knowledge",
      build: "Build",
      help: "Help",
    },
  };
  messages.tr.privacyText =
    "Dışa ve içe aktarma tarayıcınızda yerel olarak gerçekleşir. Hiçbir veri yüklenmez.";
  messages.en.privacyText =
    "Exports and imports happen locally in your browser. Nothing is uploaded.";
  Object.assign(messages.tr, {
    languageSelector: "Dil seçimi",
    searchLabel: "Bilgi bankasında ara",
    knowledgeCategories: "Bilgi kategorileri",
    workspaceViews: "Çalışma alanı görünümleri",
    primaryNavigation: "Ana gezinme",
  });
  Object.assign(messages.en, {
    languageSelector: "Language selection",
    searchLabel: "Search the knowledge base",
    knowledgeCategories: "Knowledge categories",
    workspaceViews: "Workspace views",
    primaryNavigation: "Primary navigation",
  });
  let language = storage.getRaw("emcpLang") === "en" ? "en" : "tr";
  const t = (key) => messages[language]?.[key] ?? messages.en[key] ?? key;
  const pick = (english, turkish) =>
    language === "tr" ? turkish || english : english;
  function apply(root = document) {
    root.documentElement?.setAttribute("lang", language);
    root.querySelectorAll?.("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    root.querySelectorAll?.("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    root.querySelectorAll?.("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
  }
  function setLanguage(next) {
    language = next === "en" ? "en" : "tr";
    storage.setRaw("emcpLang", language);
    apply();
    global.dispatchEvent(
      new CustomEvent("emcp:languagechange", { detail: { language } }),
    );
    return language;
  }
  const api = {
    t,
    pick,
    apply,
    setLanguage,
    get language() {
      return language;
    },
  };
  global.EMCPi18n = api;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => apply());
  else apply();
})(window);
