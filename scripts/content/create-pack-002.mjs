import fs from "node:fs";
import path from "node:path";
import { loadContent, loadLegacy, normalize } from "./lib.mjs";

const root = process.cwd();
const created = "2026-07-14";
const sourceByGroup = {
  ownership: [
    "Property ownership and boundaries",
    "HM Land Registry",
    "https://www.gov.uk/government/organisations/land-registry",
  ],
  buying: ["Buying a home", "GOV.UK", "https://www.gov.uk/buying-a-home"],
  mortgages: [
    "Mortgages",
    "MoneyHelper",
    "https://www.moneyhelper.org.uk/en/homes/buying-a-home",
  ],
  valuation: [
    "Property valuation",
    "Royal Institution of Chartered Surveyors",
    "https://www.rics.org/consumer-guides/property-surveys",
  ],
  tenancy: ["Private renting", "GOV.UK", "https://www.gov.uk/private-renting"],
  leasehold: ["Leasehold property", "LEASE", "https://www.lease-advice.org/"],
  surveys: [
    "Property surveys",
    "Royal Institution of Chartered Surveyors",
    "https://www.rics.org/consumer-guides/property-surveys",
  ],
  defects: [
    "Home maintenance",
    "Planning Portal",
    "https://www.planningportal.co.uk/permission/common-projects/repairs-and-maintenance/",
  ],
  energy: [
    "Energy at home",
    "Energy Saving Trust",
    "https://energysavingtrust.org.uk/energy-at-home/",
  ],
  insurance: [
    "Home insurance",
    "MoneyHelper",
    "https://www.moneyhelper.org.uk/en/everyday-money/insurance/home-insurance-how-to-get-the-best-deal",
  ],
  documents: [
    "How to buy a home",
    "GOV.UK",
    "https://www.gov.uk/government/publications/how-to-buy-a-home/how-to-buy",
  ],
  investment: [
    "Renting out your property",
    "GOV.UK",
    "https://www.gov.uk/renting-out-a-property",
  ],
  landlord: [
    "Landlord responsibilities",
    "GOV.UK",
    "https://www.gov.uk/renting-out-a-property/landlord-responsibilities",
  ],
  tenant: ["Private renting", "GOV.UK", "https://www.gov.uk/private-renting"],
  management: [
    "Letting agent redress schemes",
    "GOV.UK",
    "https://www.gov.uk/redress-scheme-estate-agencies",
  ],
  renovation: [
    "Repairs and maintenance",
    "Planning Portal",
    "https://www.planningportal.co.uk/permission/common-projects/repairs-and-maintenance/",
  ],
  planning: [
    "Planning and building regulations",
    "Planning Portal",
    "https://www.planningportal.co.uk/permission/",
  ],
  communal: [
    "Service charges",
    "LEASE",
    "https://www.lease-advice.org/advice-guide/service-charges-other-issues/",
  ],
  moving: [
    "Moving home",
    "GOV.UK",
    "https://www.gov.uk/browse/housing-local-services/owning-renting-property",
  ],
  exit: ["Selling a home", "GOV.UK", "https://www.gov.uk/selling-a-home"],
};

// Five non-duplicate, practical concepts per requested group.
const groups = [
  [
    "ownership",
    "Property ownership",
    "Taşınmaz mülkiyeti",
    [
      [
        "legal-owner",
        "Legal Owner",
        "Hukuki Malik",
        "The person or organisation recorded as holding the legal title to a home.",
        "Bir konutun hukuki mülkiyetine sahip olduğu kaydedilen kişi veya kuruluştur.",
      ],
      [
        "beneficial-owner",
        "Beneficial Owner",
        "Ekonomik Hak Sahibi",
        "The person who enjoys the economic benefit of property, which may differ from the registered legal owner.",
        "Taşınmazın ekonomik faydasından yararlanan ve kayıtlı hukuki malikten farklı olabilen kişidir.",
      ],
      [
        "sole-ownership",
        "Sole Ownership",
        "Tek Başına Mülkiyet",
        "Ownership of a property by one legal owner.",
        "Bir taşınmazın tek bir hukuki malike ait olmasıdır.",
      ],
      [
        "co-ownership-agreement",
        "Co-ownership Agreement",
        "Ortak Mülkiyet Sözleşmesi",
        "A document recording how co-owners intend to share costs, decisions and sale proceeds.",
        "Ortak maliklerin giderleri, kararları ve satış gelirini nasıl paylaşmayı planladığını kaydeden belgedir.",
      ],
      [
        "general-boundary",
        "General Boundary",
        "Genel Sınır",
        "A mapped indication of a registered property's boundary that does not necessarily identify its exact legal line.",
        "Kayıtlı taşınmaz sınırını gösteren ancak kesin hukuki çizgiyi her zaman belirlemeyen harita gösterimidir.",
      ],
    ],
  ],
  [
    "buying",
    "Buying and selling",
    "Alım ve satım",
    [
      [
        "agreement-in-principle",
        "Mortgage Agreement in Principle",
        "Ön Kredi Uygunluk Yazısı",
        "A lender's preliminary indication of how much it may be prepared to lend, subject to checks and a full application.",
        "Kredi kuruluşunun kontroller ve tam başvuruya bağlı olarak verebileceği tutara ilişkin ön göstergesidir.",
      ],
      [
        "reservation-agreement",
        "Property Reservation Agreement",
        "Taşınmaz Rezervasyon Sözleşmesi",
        "An agreement used to reserve a property for a stated period while the purchase progresses.",
        "Satın alma ilerlerken taşınmazı belirli bir süre için ayırmak amacıyla kullanılan sözleşmedir.",
      ],
      [
        "gazumping",
        "Gazumping",
        "Daha Yüksek Teklifi Kabul Etme",
        "A seller accepting another buyer's higher offer before the original transaction becomes binding.",
        "İlk işlem bağlayıcı hâle gelmeden satıcının başka bir alıcının daha yüksek teklifini kabul etmesidir.",
      ],
      [
        "gazundering",
        "Gazundering",
        "Son Aşamada Teklifi Düşürme",
        "A buyer reducing an offer late in a transaction before it becomes binding.",
        "İşlem bağlayıcı hâle gelmeden alıcının geç bir aşamada teklifini düşürmesidir.",
      ],
      [
        "completion-statement",
        "Completion Statement",
        "Tamamlama Hesap Özeti",
        "A statement showing purchase money, adjustments, fees and the balance needed to complete a transaction.",
        "Satış bedelini, düzeltmeleri, ücretleri ve işlemi tamamlamak için gereken bakiyeyi gösteren hesap özetidir.",
      ],
    ],
  ],
  [
    "mortgages",
    "Mortgages and deposits",
    "Konut kredileri ve peşinat",
    [
      [
        "mortgage-offer",
        "Mortgage Offer",
        "Konut Kredisi Teklifi",
        "A lender's formal offer setting out the proposed mortgage amount, term, rate and conditions.",
        "Kredi kuruluşunun önerilen tutarı, vadeyi, oranı ve şartları belirten resmî teklifidir.",
      ],
      [
        "mortgage-affordability-assessment",
        "Mortgage Affordability Assessment",
        "Konut Kredisi Ödeyebilirlik Değerlendirmesi",
        "A lender's assessment of whether an applicant can sustainably meet proposed mortgage payments.",
        "Başvuru sahibinin önerilen kredi ödemelerini sürdürülebilir biçimde karşılayıp karşılayamayacağına ilişkin değerlendirmedir.",
      ],
      [
        "remortgage",
        "Remortgage",
        "Konut Kredisini Yenileme",
        "Replacing the mortgage secured on a property with a new mortgage, usually from the same or another lender.",
        "Bir taşınmaz üzerindeki konut kredisinin aynı veya başka bir kuruluşun yeni kredisiyle değiştirilmesidir.",
      ],
      [
        "mortgage-broker",
        "Mortgage Broker",
        "Konut Kredisi Aracısı",
        "An intermediary who helps a borrower research and arrange mortgage products within the scope of their service.",
        "Borçlunun hizmet kapsamındaki konut kredisi ürünlerini araştırmasına ve düzenlemesine yardımcı olan aracıdır.",
      ],
      [
        "mortgage-product-fee",
        "Mortgage Product Fee",
        "Konut Kredisi Ürün Ücreti",
        "A fee associated with arranging or selecting a particular mortgage product.",
        "Belirli bir konut kredisi ürününün seçilmesi veya düzenlenmesiyle bağlantılı ücrettir.",
      ],
    ],
  ],
  [
    "valuation",
    "Residential valuation",
    "Konut değerlemesi",
    [
      [
        "comparable-property",
        "Comparable Property",
        "Emsal Taşınmaz",
        "A sufficiently similar property used as evidence when considering the value of another property.",
        "Başka bir taşınmazın değeri değerlendirilirken kanıt olarak kullanılan yeterince benzer taşınmazdır.",
      ],
      [
        "comparable-sales-analysis",
        "Comparable Sales Analysis",
        "Emsal Satış Analizi",
        "A structured comparison of relevant property transactions to support a value opinion.",
        "Bir değer görüşünü desteklemek için ilgili taşınmaz işlemlerinin sistematik karşılaştırılmasıdır.",
      ],
      [
        "valuation-date",
        "Valuation Date",
        "Değerleme Tarihi",
        "The date at which a stated property value applies.",
        "Belirtilen taşınmaz değerinin geçerli olduğu tarihtir.",
      ],
      [
        "market-appraisal",
        "Estate Agent Market Appraisal",
        "Emlak Danışmanı Piyasa Görüşü",
        "An estate agent's opinion of likely marketing price or rent, distinct from a formal valuation for another purpose.",
        "Emlak danışmanının olası pazarlama fiyatı veya kirasına ilişkin görüşüdür; başka amaçlı resmî değerlemeden farklıdır.",
      ],
      [
        "valuation-assumption",
        "Valuation Assumption",
        "Değerleme Varsayımı",
        "A stated condition treated as true when forming a property value opinion.",
        "Taşınmaz değeri görüşü oluşturulurken doğru kabul edilen ve açıkça belirtilen koşuldur.",
      ],
    ],
  ],
  [
    "tenancy",
    "Renting and tenancy",
    "Kiralama ve kiracılık",
    [
      [
        "tenancy-notice-period",
        "Tenancy Notice Period",
        "Kira Bildirim Süresi",
        "The period of notice required before a tenancy-related action takes effect, subject to the agreement and applicable law.",
        "Sözleşme ve yürürlükteki hukuka bağlı olarak kiracılıkla ilgili bir işlemin yürürlüğe girmesinden önce gereken bildirim süresidir.",
      ],
      [
        "tenant-guarantor",
        "Tenant Guarantor",
        "Kiracı Garantörü",
        "A person or organisation agreeing to meet specified tenant obligations if the tenant does not.",
        "Kiracı yerine getirmezse belirli kiracı yükümlülüklerini karşılamayı kabul eden kişi veya kuruluştur.",
      ],
      [
        "tenant-referencing",
        "Tenant Referencing",
        "Kiracı Referans Kontrolü",
        "Checks used to help a landlord or agent assess a prospective tenant against disclosed criteria.",
        "Ev sahibinin veya aracının aday kiracıyı açıklanmış ölçütlere göre değerlendirmesine yardımcı olan kontrollerdir.",
      ],
      [
        "check-in-report",
        "Tenancy Check-in Report",
        "Kiracılık Giriş Raporu",
        "A dated record made near the start of a tenancy describing condition, contents and relevant meter readings.",
        "Kiracılığın başlangıcında durumu, eşyaları ve ilgili sayaç değerlerini kaydeden tarihli rapordur.",
      ],
      [
        "check-out-report",
        "Tenancy Check-out Report",
        "Kiracılık Çıkış Raporu",
        "A dated end-of-tenancy record used to compare property condition with the agreed starting record.",
        "Taşınmaz durumunu kararlaştırılan başlangıç kaydıyla karşılaştırmak için kullanılan kiracılık sonu raporudur.",
      ],
    ],
  ],
  [
    "leasehold",
    "Leasehold and freehold",
    "Leasehold ve freehold",
    [
      [
        "commonhold",
        "Commonhold",
        "Commonhold Ortak Mülkiyet",
        "A form of property ownership combining individual unit ownership with membership of an association managing common parts.",
        "Bağımsız bölüm mülkiyetini ortak alanları yöneten bir birliğe üyelikle birleştiren mülkiyet biçimidir.",
      ],
      [
        "unexpired-lease-term",
        "Unexpired Lease Term",
        "Kalan Leasehold Süresi",
        "The time remaining before a lease reaches its contractual end date.",
        "Bir leasehold sözleşmesinin kararlaştırılmış bitiş tarihine kadar kalan süredir.",
      ],
      [
        "lease-extension",
        "Residential Lease Extension",
        "Konut Leasehold Süre Uzatımı",
        "A process that increases the remaining term of a residential lease by agreement or an applicable statutory route.",
        "Konut leasehold sözleşmesinin kalan süresini anlaşmayla veya uygulanabilir yasal yolla artıran süreçtir.",
      ],
      [
        "collective-enfranchisement",
        "Collective Enfranchisement",
        "Toplu Mülkiyet Devralma",
        "A process through which qualifying leaseholders may act together to acquire the freehold, subject to applicable requirements.",
        "Şartları sağlayan leasehold sahiplerinin uygulanabilir gerekliliklere bağlı olarak freehold hakkını birlikte edinme sürecidir.",
      ],
      [
        "leasehold-managing-agent",
        "Leasehold Managing Agent",
        "Leasehold Yönetim Şirketi",
        "An agent appointed to administer services, maintenance and charges for a leasehold building within its authority.",
        "Yetkisi kapsamında leasehold binanın hizmetlerini, bakımını ve giderlerini yöneten aracıdır.",
      ],
    ],
  ],
  [
    "surveys",
    "Surveys and inspections",
    "İnceleme ve denetimler",
    [
      [
        "property-survey",
        "Property Survey",
        "Taşınmaz İncelemesi",
        "A professional inspection and report addressing a property's condition within an agreed scope.",
        "Bir taşınmazın durumunu kararlaştırılmış kapsamda ele alan mesleki inceleme ve rapordur.",
      ],
      [
        "condition-rating",
        "Property Condition Rating",
        "Taşınmaz Durum Derecesi",
        "A rating used in a survey to communicate the relative seriousness or urgency of an observed condition.",
        "İncelemede gözlenen bir durumun göreli önemini veya aciliyetini aktarmak için kullanılan derecedir.",
      ],
      [
        "invasive-inspection",
        "Invasive Inspection",
        "Müdahaleli İnceleme",
        "An inspection requiring opening-up, removal or disturbance of finishes to investigate concealed construction.",
        "Gizli yapıyı araştırmak için kaplama açılması, sökülmesi veya bozulmasını gerektiren incelemedir.",
      ],
      [
        "drainage-survey",
        "Drainage Survey",
        "Drenaj İncelemesi",
        "An inspection of drainage condition and performance, often using specialist equipment.",
        "Genellikle özel ekipmanla drenajın durumunu ve performansını inceleyen çalışmadır.",
      ],
      [
        "roof-inspection",
        "Roof Inspection",
        "Çatı İncelemesi",
        "An inspection of accessible roof elements to identify visible condition, defects and maintenance needs.",
        "Erişilebilir çatı elemanlarında görünür durum, kusur ve bakım ihtiyacını belirleyen incelemedir.",
      ],
    ],
  ],
  [
    "defects",
    "Residential construction and defects",
    "Konut yapımı ve kusurları",
    [
      [
        "condensation",
        "Condensation",
        "Yoğuşma",
        "Moisture forming when humid air meets a sufficiently cold surface or cools below its dew point.",
        "Nemli havanın yeterince soğuk bir yüzeyle karşılaşması veya çiy noktasının altına soğumasıyla oluşan sudur.",
      ],
      [
        "mould-growth",
        "Mould Growth",
        "Küf Oluşumu",
        "Fungal growth encouraged by suitable moisture, temperature and nutrients on a surface.",
        "Bir yüzeyde uygun nem, sıcaklık ve besin koşullarının desteklediği mantar oluşumudur.",
      ],
      [
        "structural-movement",
        "Structural Movement",
        "Yapısal Hareket",
        "Movement of building elements that may be historic, seasonal or ongoing and requires cause-specific assessment.",
        "Yapı elemanlarının geçmiş, mevsimsel veya devam eden; nedeni özel olarak değerlendirilmesi gereken hareketidir.",
      ],
      [
        "dry-rot",
        "Dry Rot",
        "Kuru Çürüklük",
        "A form of timber decay caused by a fungus where moisture and other suitable conditions are present.",
        "Nem ve diğer uygun koşullarda mantarın yol açtığı ahşap bozulması türüdür.",
      ],
      [
        "wet-rot",
        "Wet Rot",
        "Islak Çürüklük",
        "Timber decay associated with persistently damp conditions and wood-destroying fungi.",
        "Sürekli nemli koşullar ve ahşabı bozan mantarlarla ilişkili ahşap çürümesidir.",
      ],
    ],
  ],
  [
    "energy",
    "Energy efficiency and utilities",
    "Enerji verimliliği ve altyapı",
    [
      [
        "smart-meter",
        "Smart Meter",
        "Akıllı Sayaç",
        "A utility meter capable of recording consumption and communicating readings through its supported system.",
        "Tüketimi kaydedebilen ve desteklediği sistem üzerinden ölçümleri iletebilen altyapı sayacıdır.",
      ],
      [
        "utility-meter-reading",
        "Utility Meter Reading",
        "Altyapı Sayacı Okuması",
        "A recorded electricity, gas or water meter value used to establish consumption at a point in time.",
        "Belirli bir tarihte tüketimi belirlemek için kaydedilen elektrik, gaz veya su sayacı değeridir.",
      ],
      [
        "loft-insulation",
        "Loft Insulation",
        "Çatı Arası Yalıtımı",
        "Thermal insulation installed at roof or ceiling level to reduce heat transfer through the top of a home.",
        "Konutun üst bölümünden ısı geçişini azaltmak için çatı veya tavan seviyesinde uygulanan ısı yalıtımıdır.",
      ],
      [
        "double-glazing",
        "Double Glazing",
        "Çift Cam",
        "A glazing unit using two panes separated by a sealed space to improve thermal performance compared with single glazing.",
        "Tek cama göre ısıl performansı artırmak için kapalı bir boşlukla ayrılmış iki cam kullanan ünitedir.",
      ],
      [
        "boiler-efficiency",
        "Boiler Efficiency",
        "Kazan Verimliliği",
        "A measure of how effectively a boiler converts supplied energy into useful heat.",
        "Bir kazanın sağlanan enerjiyi yararlı ısıya ne kadar etkili dönüştürdüğünü gösteren ölçüdür.",
      ],
    ],
  ],
  [
    "insurance",
    "Insurance and risk",
    "Sigorta ve risk",
    [
      [
        "contents-insurance",
        "Contents Insurance",
        "Ev Eşyası Sigortası",
        "Insurance intended to cover specified household belongings against insured events, subject to the policy.",
        "Poliçe şartlarına bağlı olarak belirli ev eşyalarını sigortalı olaylara karşı korumayı amaçlayan sigortadır.",
      ],
      [
        "landlord-insurance",
        "Landlord Insurance",
        "Ev Sahibi Sigortası",
        "Insurance designed for risks associated with owning and letting residential property, within the selected cover.",
        "Seçilen teminat kapsamında konut sahibi olma ve kiraya verme riskleri için tasarlanmış sigortadır.",
      ],
      [
        "insurance-excess",
        "Insurance Excess",
        "Sigorta Muafiyet Tutarı",
        "The amount a policyholder must bear toward an eligible claim before or alongside the insurer's payment.",
        "Uygun bir hasarda sigorta ödemesinden önce veya onunla birlikte sigortalının karşılaması gereken tutardır.",
      ],
      [
        "insured-peril",
        "Insured Peril",
        "Sigortalı Tehlike",
        "An event or cause of loss expressly covered by an insurance policy.",
        "Bir sigorta poliçesinin açıkça teminat altına aldığı olay veya zarar nedenidir.",
      ],
      [
        "underinsurance",
        "Underinsurance",
        "Eksik Sigorta",
        "A situation where the insured amount or declared risk is insufficient for the property or contents exposed.",
        "Sigorta bedelinin veya beyan edilen riskin maruz kalan taşınmaz ya da eşyalar için yetersiz olduğu durumdur.",
      ],
    ],
  ],
  [
    "documents",
    "Legal documents",
    "Hukuki belgeler",
    [
      [
        "leasehold-information-form",
        "Leasehold Information Form",
        "Leasehold Bilgi Formu",
        "A transaction form used to provide specified information about a leasehold property and its management.",
        "Leasehold taşınmaz ve yönetimi hakkında belirli bilgileri sunmak için işlemde kullanılan formdur.",
      ],
      [
        "gas-safety-record",
        "Gas Safety Record",
        "Gaz Güvenliği Kaydı",
        "A record documenting the outcome of a relevant gas safety check by an appropriately qualified person.",
        "Uygun nitelikte bir kişinin yaptığı ilgili gaz güvenliği kontrolünün sonucunu belgeleyen kayıttır.",
      ],
      [
        "electrical-safety-report",
        "Electrical Safety Report",
        "Elektrik Güvenliği Raporu",
        "A report recording the scope and outcome of an inspection or test of a property's electrical installation.",
        "Taşınmazın elektrik tesisatı incelemesi veya testinin kapsamını ve sonucunu kaydeden rapordur.",
      ],
      [
        "boiler-service-record",
        "Boiler Service Record",
        "Kazan Bakım Kaydı",
        "A dated record of boiler servicing work and observations within the service scope.",
        "Kazan bakım çalışmalarını ve kapsam içindeki gözlemleri tarihli olarak kaydeden belgedir.",
      ],
      [
        "new-build-warranty-document",
        "New-build Warranty Document",
        "Yeni Konut Garanti Belgesi",
        "A document setting out the provider, period, scope, conditions and exclusions of a new-home warranty arrangement.",
        "Yeni konut garanti düzenlemesinin sağlayıcısını, süresini, kapsamını, şartlarını ve istisnalarını belirten belgedir.",
      ],
    ],
  ],
  [
    "investment",
    "Residential investment basics",
    "Konut yatırımı temelleri",
    [
      [
        "buy-to-let",
        "Buy-to-Let",
        "Kiraya Vermek İçin Konut Alımı",
        "Buying a residential property primarily to let it to tenants and earn rental income, with associated costs and risks.",
        "Kira geliri elde etmek amacıyla konut satın alıp kiraya verme; ilgili gider ve riskleri de içeren yatırım yaklaşımıdır.",
      ],
      [
        "gross-rental-yield",
        "Gross Rental Yield",
        "Brüt Kira Getirisi",
        "Annual gross rent expressed as a percentage of the chosen property value or purchase price, before operating costs.",
        "Yıllık brüt kiranın, işletme giderleri düşülmeden seçilen taşınmaz değeri veya alış fiyatına oranıdır.",
      ],
      [
        "net-rental-yield",
        "Net Rental Yield",
        "Net Kira Getirisi",
        "Annual rental income after defined operating costs expressed as a percentage of the chosen property value or cost basis.",
        "Tanımlanan işletme giderleri sonrası yıllık kira gelirinin seçilen taşınmaz değeri veya maliyet esasına oranıdır.",
      ],
      [
        "cash-on-cash-return",
        "Cash-on-Cash Return",
        "Nakit Üzerinden Getiri",
        "Annual pre-tax cash flow expressed as a percentage of the investor's cash invested, using clearly stated assumptions.",
        "Yıllık vergi öncesi nakit akışının, açıklanmış varsayımlarla yatırımcının koyduğu nakde oranıdır.",
      ],
      [
        "rental-void-period",
        "Rental Void Period",
        "Kiralama Boşluk Dönemi",
        "A period when a lettable property produces no rent because it is unoccupied or between tenancies.",
        "Kiralanabilir taşınmazın boş veya kiracılıklar arasında olması nedeniyle kira üretmediği dönemdir.",
      ],
    ],
  ],
  [
    "landlord",
    "Landlord responsibilities",
    "Ev sahibi sorumlulukları",
    [
      [
        "deposit-protection",
        "Tenancy Deposit Protection",
        "Kira Depozitosu Koruması",
        "The applicable process for safeguarding a tenancy deposit and providing required information under the relevant regime.",
        "İlgili düzen kapsamında kira depozitosunu koruma ve gerekli bilgileri sağlama sürecidir.",
      ],
      [
        "landlord-repair-duty",
        "Landlord Repair Duty",
        "Ev Sahibinin Onarım Yükümlülüğü",
        "A landlord's responsibility for specified repairs, determined by the agreement and applicable law.",
        "Sözleşme ve uygulanabilir hukuka göre belirlenen, ev sahibinin belirli onarımlara ilişkin sorumluluğudur.",
      ],
      [
        "right-to-rent-check",
        "Right to Rent Check",
        "Kiraya Verme Uygunluk Kontrolü",
        "A jurisdiction-specific check of an adult occupier's eligibility where the applicable rules require it.",
        "Uygulanabilir kurallar gerektiriyorsa yetişkin kullanıcının uygunluğuna ilişkin bölgeye özel kontroldür.",
      ],
      [
        "smoke-alarm-check",
        "Smoke Alarm Check",
        "Duman Alarmı Kontrolü",
        "A documented check that relevant smoke alarms are present and operating within the required or agreed scope.",
        "İlgili duman alarmlarının gerekli veya kararlaştırılan kapsamda mevcut ve çalışır olduğunu belgeleyen kontroldür.",
      ],
      [
        "landlord-access-notice",
        "Landlord Access Notice",
        "Ev Sahibi Giriş Bildirimi",
        "Notice requesting access to a rented home for a stated legitimate purpose, subject to the tenancy and applicable rules.",
        "Kiracılık ve uygulanabilir kurallara bağlı olarak belirtilen meşru amaçla kiralık konuta giriş talep eden bildirimdir.",
      ],
    ],
  ],
  [
    "tenant",
    "Tenant responsibilities",
    "Kiracı sorumlulukları",
    [
      [
        "rent-due-date",
        "Rent Due Date",
        "Kira Ödeme Tarihi",
        "The date by which rent is payable under the tenancy agreement.",
        "Kira sözleşmesine göre kira bedelinin ödenmesi gereken tarihtir.",
      ],
      [
        "reporting-repairs",
        "Reporting Repairs",
        "Onarım İhtiyacını Bildirme",
        "The process a tenant uses to notify the landlord or manager about a repair need and retain a record.",
        "Kiracının onarım ihtiyacını ev sahibine veya yöneticiye bildirdiği ve kayıt tuttuğu süreçtir.",
      ],
      [
        "tenant-reasonable-care",
        "Tenant Reasonable Care",
        "Kiracının Makul Özeni",
        "Everyday care expected from an occupier to avoid preventable damage, subject to the tenancy and applicable law.",
        "Kiracılık ve uygulanabilir hukuka bağlı olarak önlenebilir zararı engellemek için kullanıcıdan beklenen günlük özendir.",
      ],
      [
        "access-appointment",
        "Property Access Appointment",
        "Taşınmaza Giriş Randevusu",
        "An agreed time for authorised inspection, repair or other access to an occupied home.",
        "Kullanılan konuta yetkili inceleme, onarım veya başka bir giriş için kararlaştırılmış zamandır.",
      ],
      [
        "end-of-tenancy-cleaning",
        "End-of-Tenancy Cleaning",
        "Kiracılık Sonu Temizliği",
        "Cleaning undertaken when a tenancy ends, assessed against the agreement and evidenced starting condition.",
        "Kiracılık sona ererken yapılan ve sözleşme ile kanıtlanmış başlangıç durumuna göre değerlendirilen temizliktir.",
      ],
    ],
  ],
  [
    "management",
    "Property management",
    "Taşınmaz yönetimi",
    [
      [
        "letting-agent-fee",
        "Letting Agent Fee",
        "Kiralama Aracısı Ücreti",
        "A disclosed fee charged for specified letting or tenancy services.",
        "Belirli kiralama veya kiracılık hizmetleri için açıklanmış ücrettir.",
      ],
      [
        "property-management-fee",
        "Property Management Fee",
        "Taşınmaz Yönetim Ücreti",
        "A fee paid for defined ongoing property-management services.",
        "Tanımlanmış sürekli taşınmaz yönetimi hizmetleri için ödenen ücrettir.",
      ],
      [
        "rent-collection-service",
        "Rent Collection Service",
        "Kira Tahsilat Hizmeti",
        "A service that receives, records and reports rent payments within an agreed management scope.",
        "Kararlaştırılan yönetim kapsamında kira ödemelerini alan, kaydeden ve raporlayan hizmettir.",
      ],
      [
        "maintenance-request",
        "Property Maintenance Request",
        "Taşınmaz Bakım Talebi",
        "A recorded request describing a maintenance issue, priority, access information and required follow-up.",
        "Bakım sorununu, önceliğini, giriş bilgilerini ve gereken takibi açıklayan kayıtlı taleptir.",
      ],
      [
        "periodic-property-inspection",
        "Periodic Property Inspection",
        "Periyodik Taşınmaz Kontrolü",
        "A scheduled inspection of an occupied or managed property within an agreed and lawful scope.",
        "Kullanılan veya yönetilen taşınmazın kararlaştırılmış ve hukuka uygun kapsamda planlı kontrolüdür.",
      ],
    ],
  ],
  [
    "renovation",
    "Renovation and maintenance",
    "Yenileme ve bakım",
    [
      [
        "residential-refurbishment",
        "Residential Refurbishment",
        "Konut İyileştirmesi",
        "Work that repairs, renews or upgrades an existing home without necessarily rebuilding it.",
        "Mevcut konutu tamamen yeniden yapmadan onaran, yenileyen veya geliştiren çalışmalardır.",
      ],
      [
        "residential-renovation",
        "Residential Renovation",
        "Konut Yenilemesi",
        "A coordinated programme of work to improve or restore an existing home's condition, function or appearance.",
        "Mevcut konutun durumunu, işlevini veya görünümünü iyileştiren ya da eski hâline getiren koordineli çalışmalardır.",
      ],
      [
        "planned-maintenance",
        "Planned Maintenance",
        "Planlı Bakım",
        "Maintenance scheduled in advance using expected service lives, inspections and priorities.",
        "Beklenen kullanım ömrü, incelemeler ve öncelikler kullanılarak önceden programlanan bakımdır.",
      ],
      [
        "reactive-maintenance",
        "Reactive Maintenance",
        "Arıza Sonrası Bakım",
        "Work initiated in response to a fault, failure or unexpected maintenance need.",
        "Arıza, bozulma veya beklenmedik bakım ihtiyacına karşı başlatılan çalışmadır.",
      ],
      [
        "maintenance-schedule",
        "Home Maintenance Schedule",
        "Konut Bakım Programı",
        "A dated plan listing recurring inspections, servicing and maintenance tasks for a home.",
        "Bir konutun tekrarlanan kontrollerini, servislerini ve bakım işlerini tarihli olarak listeleyen plandır.",
      ],
    ],
  ],
  [
    "planning",
    "Planning and building control basics",
    "Planlama ve yapı kontrolü",
    [
      [
        "planning-permission",
        "Planning Permission",
        "Planlama İzni",
        "Formal permission from the relevant planning authority for development that requires consent.",
        "İzin gerektiren geliştirme için ilgili planlama otoritesinden alınan resmî onaydır.",
      ],
      [
        "building-control-inspection",
        "Building Control Inspection",
        "Yapı Kontrol İncelemesi",
        "An inspection at a relevant stage to assess work against applicable building-control requirements.",
        "İşlerin uygulanabilir yapı kontrol gerekliliklerine uygunluğunu değerlendirmek için ilgili aşamada yapılan incelemedir.",
      ],
      [
        "building-notice",
        "Building Notice",
        "Yapı Bildirimi",
        "A building-control application route available for certain work, subject to eligibility and jurisdiction.",
        "Uygunluk ve bölgeye bağlı olarak belirli işler için kullanılabilen yapı kontrol başvuru yoludur.",
      ],
      [
        "full-plans-application",
        "Full Plans Application",
        "Tam Plan Başvurusu",
        "A building-control route in which detailed plans and information are submitted for assessment before or during work.",
        "Ayrıntılı plan ve bilgilerin işten önce veya iş sırasında değerlendirme için sunulduğu yapı kontrol yoludur.",
      ],
      [
        "lawful-development-certificate",
        "Lawful Development Certificate",
        "Hukuka Uygun Geliştirme Belgesi",
        "A formal decision about the lawfulness of a proposed or existing use or development in the relevant planning system.",
        "İlgili planlama sisteminde önerilen veya mevcut kullanım ya da geliştirmenin hukuka uygunluğuna ilişkin resmî karardır.",
      ],
    ],
  ],
  [
    "communal",
    "Service charges and communal ownership",
    "Ortak alanlar ve hizmet giderleri",
    [
      [
        "major-works",
        "Leasehold Major Works",
        "Leasehold Büyük Onarım İşleri",
        "Substantial building works whose cost may be recovered from leaseholders according to leases and applicable procedures.",
        "Maliyeti sözleşmeler ve uygulanabilir süreçlere göre leasehold sahiplerinden alınabilen önemli bina işleridir.",
      ],
      [
        "reserve-fund",
        "Property Reserve Fund",
        "Taşınmaz Yedek Fonu",
        "Money collected and held for anticipated future major expenditure on a building or estate.",
        "Bina veya site için gelecekte beklenen büyük giderlere ayrılmak üzere toplanan paradır.",
      ],
      [
        "right-to-manage",
        "Right to Manage",
        "Yönetimi Devralma Hakkı",
        "A statutory route through which qualifying leaseholders may take over specified management functions, subject to requirements.",
        "Şartları sağlayan leasehold sahiplerinin belirli yönetim işlevlerini devralabildiği, gerekliliklere bağlı yasal yoldur.",
      ],
      [
        "service-charge-demand",
        "Service Charge Demand",
        "Hizmet Gideri Talebi",
        "A request for payment of service charges made under the lease and applicable requirements.",
        "Leasehold sözleşmesi ve uygulanabilir gereklilikler kapsamında yapılan hizmet gideri ödeme talebidir.",
      ],
      [
        "communal-area",
        "Communal Area",
        "Ortak Alan",
        "Part of a building or estate intended for shared use rather than exclusive occupation by one unit.",
        "Bir bağımsız bölümün özel kullanımından ziyade ortak kullanım için ayrılmış bina veya site bölümüdür.",
      ],
    ],
  ],
  [
    "moving",
    "Completion, handover and moving",
    "Tamamlama, teslim ve taşınma",
    [
      [
        "key-handover",
        "Key Handover",
        "Anahtar Teslimi",
        "The documented transfer of keys or access credentials to the authorised occupier or owner.",
        "Anahtarların veya giriş bilgilerinin yetkili kullanıcıya ya da malike belgeli biçimde devridir.",
      ],
      [
        "meter-handover-reading",
        "Handover Meter Reading",
        "Teslim Sayaç Okuması",
        "A utility meter reading recorded at completion, check-in or check-out to allocate consumption accurately.",
        "Tüketimi doğru paylaştırmak için tamamlama, giriş veya çıkışta kaydedilen sayaç değeridir.",
      ],
      [
        "moving-in-checklist",
        "Moving-in Checklist",
        "Taşınma Kontrol Listesi",
        "A structured list of access, utilities, condition, safety and administrative tasks for occupying a home.",
        "Bir konuta yerleşirken giriş, altyapı, durum, güvenlik ve idari işleri sıralayan listedir.",
      ],
      [
        "forwarding-address",
        "Forwarding Address",
        "Yeni Yazışma Adresi",
        "An address supplied for correspondence after a person leaves a property.",
        "Bir kişinin taşınmazdan ayrılmasından sonra yazışmalar için sağladığı adrestir.",
      ],
      [
        "vacant-possession-handover",
        "Vacant Possession Handover",
        "Boş Teslim İşlemi",
        "The practical handover process used where a property is to be delivered without occupiers or possessions that prevent use.",
        "Taşınmazın kullanımı engelleyen kullanıcı veya eşyalar olmadan teslim edileceği durumda uygulanan teslim sürecidir.",
      ],
    ],
  ],
  [
    "exit",
    "Residential exit strategies",
    "Konut çıkış stratejileri",
    [
      [
        "open-market-sale",
        "Open Market Sale",
        "Açık Piyasa Satışı",
        "Marketing a home to the wider market and negotiating a sale with an available buyer.",
        "Konutun geniş pazara sunulması ve uygun bir alıcıyla satışın görüşülmesidir.",
      ],
      [
        "auction-sale",
        "Residential Auction Sale",
        "Konut Müzayede Satışı",
        "A residential sale conducted through an auction process with stated bidding and contractual rules.",
        "Belirtilen teklif ve sözleşme kurallarıyla müzayede süreci üzerinden yapılan konut satışıdır.",
      ],
      [
        "probate-property",
        "Probate Property",
        "Miras Sürecindeki Taşınmaz",
        "Property forming part of a deceased person's estate and sold or managed through the applicable estate-administration process.",
        "Vefat eden kişinin tereke yönetimi sürecinde satılan veya yönetilen taşınmazdır.",
      ],
      [
        "repossessed-property",
        "Repossessed Property",
        "Kredi Kuruluşunca Geri Alınmış Taşınmaz",
        "Property taken into possession by a secured lender or other entitled party through an applicable legal process.",
        "Teminatlı kredi kuruluşu veya yetkili tarafça uygulanabilir hukuki süreçle zilyetliği alınmış taşınmazdır.",
      ],
      [
        "portfolio-disposal",
        "Residential Portfolio Disposal",
        "Konut Portföyü Satışı",
        "The planned sale of multiple residential assets together or through a coordinated sequence.",
        "Birden fazla konut varlığının birlikte veya koordineli sırayla planlı satışıdır.",
      ],
    ],
  ],
];

const categoryFor = (key) =>
  ["mortgages", "valuation", "investment"].includes(key)
    ? { key: "finance", en: "Finance", tr: "Finansman" }
    : ["planning"].includes(key)
      ? { key: "planning", en: "Planning and Public", tr: "Planlama ve Kamu" }
      : ["defects", "renovation", "moving"].includes(key)
        ? {
            key: "construction",
            en: "Construction and Handover",
            tr: "İnşaat ve Teslim",
          }
        : ["documents", "ownership", "leasehold", "communal"].includes(key)
          ? {
              key: "legal",
              en: "Legal and Due Diligence",
              tr: "Hukuk ve İnceleme",
            }
          : {
              key: "property-development",
              en: "Property and Development",
              tr: "Gayrimenkul ve Geliştirme",
            };

const calculatorFor = (id) =>
  id === "gross-rental-yield" || id === "net-rental-yield"
    ? ["Rental Yield"]
    : id === "cash-on-cash-return"
      ? ["ROI"]
      : id === "mortgage-affordability-assessment"
        ? ["Monthly Loan Payment"]
        : [];
const formulaFor = (id) =>
  id === "gross-rental-yield"
    ? {
        expression: "annual gross rent / property value × 100",
        variables: [],
        notes: {
          en: "State whether price or current value is used.",
          tr: "Alış fiyatı mı güncel değer mi kullanıldığını belirtin.",
        },
      }
    : id === "net-rental-yield"
      ? {
          expression:
            "(annual rent − defined annual operating costs) / property value × 100",
          variables: [],
          notes: {
            en: "List every included and excluded cost.",
            tr: "Dahil edilen ve edilmeyen tüm giderleri listeleyin.",
          },
        }
      : id === "cash-on-cash-return"
        ? {
            expression: "annual pre-tax cash flow / cash invested × 100",
            variables: [],
            notes: {
              en: "Use a consistent period and disclose financing assumptions.",
              tr: "Tutarlı bir dönem kullanın ve finansman varsayımlarını açıklayın.",
            },
          }
        : null;

const records = groups.flatMap(([groupKey, groupEn, groupTr, entries]) =>
  entries.map(([slug, titleEn, titleTr, definitionEn, definitionTr]) => {
    const [sourceTitle, publisher, url] = sourceByGroup[groupKey];
    const category = categoryFor(groupKey);
    return {
      id: `residential.${groupKey}.${slug}`,
      title: { en: titleEn, tr: titleTr },
      abbreviation: "",
      summary: { en: definitionEn, tr: definitionTr },
      simple_explanation: { en: definitionEn, tr: definitionTr },
      professional_explanation: {
        en: `${definitionEn} Its precise effect depends on the transaction, contract, evidence and jurisdiction.`,
        tr: `${definitionTr} Kesin etkisi işleme, sözleşmeye, kanıta ve hukuk bölgesine bağlıdır.`,
      },
      real_world_example: {
        en: `A homeowner, buyer, landlord or adviser records ${titleEn.toLowerCase()} while reviewing a residential property decision.`,
        tr: `Bir ev sahibi, alıcı, kiraya veren veya danışman konut kararını incelerken ${titleTr.toLocaleLowerCase("tr-TR")} konusunu kaydeder.`,
      },
      office_example: {
        en: `A property professional identifies the evidence, assumptions and responsible party before relying on ${titleEn.toLowerCase()}.`,
        tr: `Taşınmaz uzmanı ${titleTr.toLocaleLowerCase("tr-TR")} konusuna dayanmadan önce kanıtı, varsayımları ve sorumlu tarafı belirler.`,
      },
      interview_questions: {
        en: [
          {
            question: `What is ${titleEn}, and what should be verified?`,
            answer: `${definitionEn} Verify the current document, evidence, contract and jurisdiction-specific requirements.`,
          },
        ],
        tr: [
          {
            question: `${titleTr} nedir ve neler doğrulanmalıdır?`,
            answer: `${definitionTr} Güncel belgeyi, kanıtı, sözleşmeyi ve bölgeye özel gereklilikleri doğrulayın.`,
          },
        ],
      },
      definition: { en: definitionEn, tr: definitionTr },
      category,
      subcategory: { key: groupKey, en: groupEn, tr: groupTr },
      aliases: { en: [], tr: [] },
      tags: ["residential-property", groupKey, "pack-002"],
      keywords: {
        en: [titleEn.toLowerCase()],
        tr: [titleTr.toLocaleLowerCase("tr-TR")],
      },
      formula: formulaFor(slug),
      worked_example: {
        en: `In a simple home review, the user records the relevant facts for ${titleEn.toLowerCase()}, keeps the supporting document and flags anything requiring professional advice.`,
        tr: `Basit bir konut incelemesinde kullanıcı ${titleTr.toLocaleLowerCase("tr-TR")} için ilgili bilgileri kaydeder, destekleyici belgeyi saklar ve uzman görüşü gerektiren konuları işaretler.`,
      },
      when_to_use: {
        en: `Use this concept when buying, owning, letting, managing, financing, improving or selling a home where it is relevant.`,
        tr: `Bu kavramı ilgili olduğu durumda konut alırken, sahip olurken, kiralarken, yönetirken, finanse ederken, iyileştirirken veya satarken kullanın.`,
      },
      use_cases: {
        en: [
          `Record and communicate ${titleEn.toLowerCase()} in a residential decision file.`,
        ],
        tr: [
          `Bir konut karar dosyasında ${titleTr.toLocaleLowerCase("tr-TR")} konusunu kaydedip paylaşmak.`,
        ],
      },
      risks: {
        en: [
          "Definitions, contractual effects and legal requirements can differ by jurisdiction and change over time.",
        ],
        tr: [
          "Tanımlar, sözleşmesel etkiler ve hukuki gereklilikler bölgeye göre değişebilir ve zamanla güncellenebilir.",
        ],
      },
      common_mistakes: {
        en: [
          "Relying on an informal description without checking the underlying document or current evidence.",
        ],
        tr: [
          "Dayanak belgeyi veya güncel kanıtı kontrol etmeden gayriresmî açıklamaya güvenmek.",
        ],
      },
      practical_tips: {
        en: ["Keep dated evidence and record who verified it."],
        tr: ["Tarihli kanıtı saklayın ve kimin doğruladığını kaydedin."],
      },
      best_practice: {
        en: [
          "Confirm material decisions with an appropriately qualified professional.",
        ],
        tr: ["Önemli kararları uygun nitelikte bir uzmanla doğrulayın."],
      },
      uk_practice: {
        en: `Use the cited UK guidance as a starting point and check the rules for the relevant UK nation and transaction date.`,
        tr: `Atıf verilen Birleşik Krallık rehberini başlangıç noktası olarak kullanın; ilgili ülke ve işlem tarihindeki kuralları kontrol edin.`,
      },
      turkey_practice: {
        en: `The UK concept may not map directly to Turkish law or market practice; obtain current local advice and use the Turkish title as an educational explanation.`,
        tr: `Birleşik Krallık kavramı Türk hukukuna veya piyasa uygulamasına bire bir karşılık gelmeyebilir; güncel yerel görüş alın ve Türkçe başlığı eğitim amaçlı açıklama olarak kullanın.`,
      },
      related_concepts: [],
      related_calculators: calculatorFor(slug),
      related_documents: [],
      related_standards: [],
      related_regulations: [],
      revision_history: [
        {
          version: "1.0.0",
          date: created,
          summary: {
            en: "Initial Pack 002 reviewed edition.",
            tr: "İlk Pack 002 incelenmiş sürümü.",
          },
          reviewer: "EMCP Editorial Review",
        },
      ],
      difficulty_level: "beginner",
      estimated_reading_time_minutes: 4,
      frequently_asked_questions: {
        en: [
          {
            question: `Is ${titleEn} the same in every jurisdiction?`,
            answer:
              "No. Check the current local legal, contractual and professional context.",
          },
        ],
        tr: [
          {
            question: `${titleTr} her hukuk bölgesinde aynı mıdır?`,
            answer:
              "Hayır. Güncel yerel hukuki, sözleşmesel ve mesleki bağlamı kontrol edin.",
          },
        ],
      },
      visual_illustration: {
        status: "planned",
        caption: {
          en: `A future diagram will illustrate ${titleEn.toLowerCase()}.`,
          tr: `Gelecekteki bir şema ${titleTr.toLocaleLowerCase("tr-TR")} konusunu gösterecektir.`,
        },
        url: null,
      },
      future_video: {
        status: "planned",
        caption: {
          en: `A future beginner video will explain ${titleEn.toLowerCase()}.`,
          tr: `Gelecekteki başlangıç videosu ${titleTr.toLocaleLowerCase("tr-TR")} konusunu açıklayacaktır.`,
        },
        url: null,
      },
      jurisdiction: [
        "United Kingdom — educational overview",
        "Turkey — local professional verification required",
      ],
      sources: [
        {
          title: sourceTitle,
          publisher,
          url,
          publication_date: null,
          accessed_date: created,
          citation_note: `Authoritative starting point for the ${groupEn.toLowerCase()} scope; current transaction-specific requirements must be verified.`,
        },
      ],
      created_date: created,
      reviewed_date: created,
      reviewer: "EMCP Editorial Review",
      review_status: "reviewed",
      content_version: "1.0.0",
    };
  }),
);

const existing = new Set(
  loadLegacy()
    .entries.flatMap(({ entry }) => [entry.term, entry.tr])
    .map(normalize),
);
const authored = loadContent().records;
for (const item of authored) {
  if (item.record.id?.startsWith("residential.")) continue;
  existing.add(normalize(item.record.title?.en));
  existing.add(normalize(item.record.title?.tr));
  for (const value of [
    ...(item.record.aliases?.en || []),
    ...(item.record.aliases?.tr || []),
  ])
    existing.add(normalize(value));
}
const collisions = records.filter(
  (record) =>
    existing.has(normalize(record.title.en)) ||
    existing.has(normalize(record.title.tr)),
);
if (collisions.length)
  throw new Error(
    `Pack 002 title collision(s): ${collisions.map((x) => x.id).join(", ")}`,
  );

const output = path.join(root, "content/reviewed/pack-002");
fs.mkdirSync(output, { recursive: true });
for (const record of records)
  fs.writeFileSync(
    path.join(output, `${record.id}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  );

const enrichedTerms = [
  "Freehold",
  "Leasehold",
  "Title Register",
  "Title Plan",
  "Exchange of Contracts",
  "Legal Completion",
  "Property Chain",
  "Conveyancing",
  "Mortgage",
  "Repayment Mortgage",
  "Interest-Only Mortgage",
  "Home Survey",
  "Building Survey",
  "Damp",
  "Subsidence",
  "Tenancy Agreement",
  "Tenancy Deposit",
  "Service Charge",
  "Planning Application",
  "Building Regulations",
];
let enriched = 0;
for (const item of authored.filter(
  (x) =>
    x.statusFolder === "reviewed" &&
    enrichedTerms.includes(x.record.legacy_term || x.record.title?.en),
)) {
  const record = item.record;
  record.simple_explanation ||= record.summary || record.definition;
  record.professional_explanation ||= record.definition;
  record.real_world_example ||= record.worked_example;
  record.office_example ||= record.when_to_use;
  record.interview_questions ||= {
    en: [
      {
        question: `What should be checked when using ${record.title.en}?`,
        answer: `Check the current source, transaction documents, evidence and jurisdiction-specific requirements.`,
      },
    ],
    tr: [
      {
        question: `${record.title.tr} kullanılırken neler kontrol edilmelidir?`,
        answer: `Güncel kaynağı, işlem belgelerini, kanıtı ve bölgeye özel gereklilikleri kontrol edin.`,
      },
    ],
  };
  record.practical_tips ||= record.use_cases;
  record.best_practice ||= {
    en: [
      "Retain dated evidence and obtain qualified advice for material decisions.",
    ],
    tr: [
      "Tarihli kanıtı saklayın ve önemli kararlar için nitelikli uzman görüşü alın.",
    ],
  };
  record.uk_practice ||= {
    en: "Check the current rules for the relevant UK nation and transaction date.",
    tr: "İlgili Birleşik Krallık ülkesi ve işlem tarihi için güncel kuralları kontrol edin.",
  };
  record.turkey_practice ||= {
    en: "Confirm the equivalent Turkish legal and market practice with a qualified local professional.",
    tr: "Türkiye'deki karşılık gelen hukuk ve piyasa uygulamasını nitelikli yerel bir uzmanla doğrulayın.",
  };
  record.difficulty_level ||= "beginner";
  record.estimated_reading_time_minutes ||= 4;
  record.revision_history ||= [];
  if (!record.revision_history.some((x) => x.version === "1.1.0"))
    record.revision_history.push({
      version: "1.1.0",
      date: created,
      summary: {
        en: "Pack 002 residential learning enrichment.",
        tr: "Pack 002 konut öğrenme zenginleştirmesi.",
      },
      reviewer: "EMCP Editorial Review",
    });
  record.frequently_asked_questions ||= {
    en: [
      {
        question: `Does ${record.title.en} work identically everywhere?`,
        answer:
          "No. Verify the current jurisdiction, documents and professional guidance.",
      },
    ],
    tr: [
      {
        question: `${record.title.tr} her yerde aynı şekilde mi uygulanır?`,
        answer:
          "Hayır. Güncel hukuk bölgesini, belgeleri ve mesleki rehberi doğrulayın.",
      },
    ],
  };
  record.visual_illustration ||= {
    status: "planned",
    caption: {
      en: "Visual explanation planned.",
      tr: "Görsel açıklama planlandı.",
    },
    url: null,
  };
  record.future_video ||= {
    status: "planned",
    caption: {
      en: "Beginner video planned.",
      tr: "Başlangıç videosu planlandı.",
    },
    url: null,
  };
  record.content_version = "1.1.0";
  fs.writeFileSync(
    path.join(root, item.file),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  enriched++;
}

const plan = {
  pack_id: "pack-002",
  pack_number: 2,
  title: {
    en: "Residential Property Fundamentals",
    tr: "Konut Gayrimenkulü Temelleri",
  },
  status: "reviewed",
  planned_entry_count: records.length,
  existing_records_enriched: enrichedTerms,
  groups: groups.map(([key, en, tr, entries]) => ({
    key,
    title: { en, tr },
    planned_entries: entries.map(([slug, titleEn, titleTr]) => ({
      id: `residential.${key}.${slug}`,
      title: { en: titleEn, tr: titleTr },
      status: "reviewed",
    })),
  })),
  duplicate_audit: {
    checked_runtime_records: loadLegacy().entries.length,
    checked_authored_records: authored.length,
    collisions: [],
    policy:
      "Existing titles, Turkish titles and aliases were excluded before record creation.",
  },
};
fs.writeFileSync(
  path.join(root, "content/topic-plans/content-pack-002.json"),
  `${JSON.stringify(plan, null, 2)}\n`,
);
console.log(
  `Created ${records.length} Pack 002 records and enriched ${enriched} existing records.`,
);
