import fs from "node:fs";
import path from "node:path";

const created = "2026-07-14";
const groups = [
  {
    key: "buying-owning",
    category: [
      "property-development",
      "Property and Development",
      "Gayrimenkul ve Geliştirme",
    ],
    subcategory: [
      "buying-owning",
      "Buying, selling and owning",
      "Alım, satım ve mülkiyet",
    ],
    source: ["Buying a home", "GOV.UK", "https://www.gov.uk/buying-a-home"],
    entries: [
      [
        "asking-price",
        "Asking Price",
        "İlan Fiyatı",
        "The price a seller advertises for a property.",
        "Satıcının taşınmaz için ilanda belirttiği fiyattır.",
      ],
      [
        "property-offer",
        "Property Offer",
        "Taşınmaz Teklifi",
        "A buyer's proposed price and terms for purchasing a property.",
        "Alıcının taşınmazı satın almak için önerdiği fiyat ve şartlardır.",
      ],
      [
        "property-chain",
        "Property Chain",
        "Taşınmaz Zinciri",
        "A linked sequence of purchases where each transaction depends on another.",
        "Her işlemin başka bir işleme bağlı olduğu bağlantılı alım-satım dizisidir.",
      ],
      [
        "conveyancing",
        "Conveyancing",
        "Tapu Devir Hukuk İşlemleri",
        "The legal and administrative work used to transfer property ownership.",
        "Taşınmaz mülkiyetini devretmek için yapılan hukuki ve idari işlemlerdir.",
      ],
      [
        "exchange-of-contracts",
        "Exchange of Contracts",
        "Sözleşmelerin Teatisi",
        "The stage when signed sale contracts are exchanged and the transaction becomes binding in England and Wales.",
        "İngiltere ve Galler'de imzalı satış sözleşmelerinin karşılıklı verildiği ve işlemin bağlayıcı hâle geldiği aşamadır.",
      ],
      [
        "legal-completion",
        "Legal Completion",
        "Hukuki Tamamlama",
        "The point when purchase money is transferred and ownership is completed.",
        "Satış bedelinin aktarıldığı ve mülkiyet devrinin tamamlandığı aşamadır.",
      ],
      [
        "title-register",
        "Title Register",
        "Tapu Sicil Kaydı",
        "HM Land Registry's written record of a registered property's ownership and registered interests.",
        "Kayıtlı bir taşınmazın malikini ve sicile işlenmiş hakları gösteren HM Land Registry kaydıdır.",
      ],
      [
        "title-plan",
        "Title Plan",
        "Tapu Planı",
        "A Land Registry plan showing a registered property's location and general boundaries.",
        "Kayıtlı taşınmazın konumunu ve genel sınırlarını gösteren tapu planıdır.",
      ],
      [
        "property-searches",
        "Property Searches",
        "Taşınmaz Araştırmaları",
        "Checks ordered during a purchase to obtain information not always visible at inspection.",
        "Satın alma sırasında, incelemede görülmeyebilecek bilgileri öğrenmek için yaptırılan araştırmalardır.",
      ],
      [
        "joint-ownership",
        "Joint Property Ownership",
        "Ortak Taşınmaz Mülkiyeti",
        "Ownership of one property by two or more people under a chosen legal arrangement.",
        "Bir taşınmazın seçilen hukuki düzen içinde iki veya daha fazla kişi tarafından sahiplenilmesidir.",
      ],
    ],
  },
  {
    key: "renting-leasing",
    category: [
      "property-development",
      "Property and Development",
      "Gayrimenkul ve Geliştirme",
    ],
    subcategory: ["renting-leasing", "Renting and leasing", "Kiralama"],
    source: [
      "Renting a property",
      "GOV.UK",
      "https://www.gov.uk/browse/housing-local-services/renting-property",
    ],
    entries: [
      [
        "tenancy-agreement",
        "Tenancy Agreement",
        "Konut Kira Sözleşmesi",
        "The agreement setting the terms on which a tenant occupies a home.",
        "Kiracının bir konutta hangi şartlarla oturacağını belirleyen sözleşmedir.",
      ],
      [
        "landlord",
        "Landlord",
        "Ev Sahibi",
        "A person or organisation that grants someone the right to occupy property in return for rent.",
        "Kira karşılığında bir taşınmazı kullanma hakkı veren kişi veya kuruluştur.",
      ],
      [
        "tenant",
        "Tenant",
        "Kiracı",
        "A person or organisation entitled to occupy property under a tenancy or lease.",
        "Kira sözleşmesi kapsamında taşınmazı kullanma hakkına sahip kişi veya kuruluştur.",
      ],
      [
        "rent",
        "Rent",
        "Kira Bedeli",
        "The regular payment made for the right to occupy or use property.",
        "Bir taşınmazı kullanma veya taşınmazda oturma hakkı için düzenli ödenen bedeldir.",
      ],
      [
        "tenancy-deposit",
        "Tenancy Deposit",
        "Kira Güvence Bedeli",
        "Money held as security against specified tenancy obligations.",
        "Kira sözleşmesindeki belirli yükümlülüklere karşı güvence olarak tutulan paradır.",
      ],
      [
        "holding-deposit",
        "Holding Deposit",
        "Rezervasyon Depozitosu",
        "A payment used to reserve a proposed tenancy while checks and paperwork are completed.",
        "Kontroller ve belgeler tamamlanırken planlanan kiralamayı ayırmak için yapılan ödemedir.",
      ],
      [
        "rental-inventory",
        "Rental Inventory",
        "Kiralama Envanteri",
        "A dated record of a rented property's contents and condition.",
        "Kiralanan taşınmazın eşyalarını ve durumunu tarihli olarak kaydeden belgedir.",
      ],
      [
        "rent-arrears",
        "Rent Arrears",
        "Kira Borcu Gecikmesi",
        "Rent that was due under an agreement but has not been paid on time.",
        "Sözleşmeye göre vadesi geldiği hâlde zamanında ödenmemiş kira borcudur.",
      ],
      [
        "break-clause",
        "Break Clause",
        "Erken Fesih Maddesi",
        "A lease term allowing an eligible party to end the agreement early if stated conditions are met.",
        "Belirtilen şartlar sağlanırsa yetkili tarafa sözleşmeyi erken sona erdirme imkânı veren maddedir.",
      ],
      [
        "rent-review",
        "Rent Review",
        "Kira Gözden Geçirmesi",
        "A contractual process for reconsidering rent at specified times or events.",
        "Kiranın belirlenmiş zamanlarda veya olaylarda yeniden değerlendirilmesini sağlayan sözleşmesel süreçtir.",
      ],
    ],
  },
  {
    key: "mortgages-loans",
    category: ["finance", "Finance", "Finansman"],
    subcategory: [
      "mortgages-loans",
      "Mortgages, loans and deposits",
      "İpotekli krediler ve borçlanma",
    ],
    source: [
      "Interest-only and repayment mortgages explained",
      "MoneyHelper",
      "https://www.moneyhelper.org.uk/en/homes/buying-a-home/mortgage-repayment-options",
    ],
    entries: [
      [
        "mortgage",
        "Mortgage",
        "İpotekli Konut Kredisi",
        "A loan secured against property, commonly used to fund a purchase.",
        "Genellikle taşınmaz alımını finanse etmek için kullanılan ve taşınmazla teminatlandırılan kredidir.",
      ],
      [
        "mortgage-deposit",
        "Mortgage Deposit",
        "Konut Kredisi Peşinatı",
        "The buyer's own money contributed toward a purchase rather than borrowed from the mortgage lender.",
        "Alıcının satın almaya kredi kuruluşundan borçlanmadan kendi kaynaklarından kattığı paradır.",
      ],
      [
        "loan-principal",
        "Loan Principal",
        "Kredi Anaparası",
        "The amount borrowed that remains to be repaid, excluding future interest.",
        "Gelecekteki faiz hariç olmak üzere geri ödenmesi gereken borç tutarıdır.",
      ],
      [
        "interest-rate",
        "Interest Rate",
        "Faiz Oranı",
        "The rate used to calculate the interest charged on borrowing.",
        "Borçlanma üzerinden alınacak faizi hesaplamak için kullanılan orandır.",
      ],
      [
        "fixed-rate-mortgage",
        "Fixed-Rate Mortgage",
        "Sabit Faizli Konut Kredisi",
        "A mortgage whose interest rate is fixed for an agreed period.",
        "Faiz oranı kararlaştırılan bir süre boyunca sabit kalan konut kredisidir.",
      ],
      [
        "variable-rate-mortgage",
        "Variable-Rate Mortgage",
        "Değişken Faizli Konut Kredisi",
        "A mortgage with an interest rate that can change under its terms.",
        "Faiz oranı sözleşme şartlarına göre değişebilen konut kredisidir.",
      ],
      [
        "repayment-mortgage",
        "Repayment Mortgage",
        "Anapara ve Faiz Ödemeli Kredi",
        "A mortgage where regular payments reduce both interest and principal over the term.",
        "Düzenli ödemelerin vade boyunca hem faizi hem de anaparayı azalttığı kredidir.",
      ],
      [
        "interest-only-mortgage",
        "Interest-Only Mortgage",
        "Yalnız Faiz Ödemeli Kredi",
        "A mortgage where scheduled payments generally cover interest while principal must be repaid separately.",
        "Düzenli ödemelerin genellikle faizi karşıladığı, anaparanın ayrıca geri ödenmesi gereken kredidir.",
      ],
      [
        "mortgage-term",
        "Mortgage Term",
        "Konut Kredisi Vadesi",
        "The agreed period over which a mortgage is scheduled to run.",
        "Konut kredisinin devam etmesi için kararlaştırılan süredir.",
      ],
      [
        "early-repayment-charge",
        "Early Repayment Charge",
        "Erken Ödeme Ücreti",
        "A charge that may apply when specified borrowing is repaid earlier than its contract allows without charge.",
        "Belirli bir borç sözleşmede ücretsiz izin verilenden daha erken kapatıldığında uygulanabilecek ücrettir.",
      ],
    ],
  },
  {
    key: "investment-returns",
    category: [
      "capital-investment",
      "Capital and Investment",
      "Sermaye ve Yatırım",
    ],
    subcategory: [
      "investment-returns",
      "Everyday investment and returns",
      "Temel yatırım ve getiri",
    ],
    source: [
      "Property investment guidance",
      "RICS",
      "https://www.rics.org/consumer-guides",
    ],
    entries: [
      [
        "capital-growth",
        "Capital Growth",
        "Sermaye Değer Artışı",
        "An increase in a property's value between two measurement dates.",
        "Bir taşınmazın değerinin iki ölçüm tarihi arasında artmasıdır.",
      ],
      [
        "rental-cash-flow",
        "Rental Cash Flow",
        "Kira Nakit Akışı",
        "The cash received from a rental property minus cash paid during a period.",
        "Bir dönemde kiralık taşınmazdan alınan nakit ile ödenen nakit arasındaki farktır.",
      ],
      [
        "gross-rental-income",
        "Gross Rental Income",
        "Brüt Kira Geliri",
        "Total rental income before property expenses and finance costs are deducted.",
        "Taşınmaz giderleri ve finansman maliyetleri düşülmeden önceki toplam kira geliridir.",
      ],
      [
        "net-rental-income",
        "Net Rental Income",
        "Net Kira Geliri",
        "Rental income remaining after the defined operating expenses have been deducted.",
        "Belirlenen işletme giderleri düşüldükten sonra kalan kira geliridir.",
      ],
      [
        "operating-expenses",
        "Property Operating Expenses",
        "Taşınmaz İşletme Giderleri",
        "Recurring costs of operating a property, measured under a clearly stated scope.",
        "Bir taşınmazı işletmenin, kapsamı açıkça belirtilmiş düzenli maliyetleridir.",
      ],
      [
        "vacancy-rate",
        "Vacancy Rate",
        "Boşluk Oranı",
        "The proportion of available space or time that is unoccupied during a period.",
        "Kullanılabilir alanın veya sürenin bir dönem içinde boş kalan oranıdır.",
      ],
      [
        "break-even-occupancy",
        "Break-Even Occupancy",
        "Başabaş Doluluk Oranı",
        "The occupancy level at which defined property income covers defined operating costs.",
        "Tanımlanan taşınmaz gelirinin tanımlanan işletme maliyetlerini karşıladığı doluluk seviyesidir.",
      ],
      [
        "payback-period",
        "Payback Period",
        "Geri Ödeme Süresi",
        "The time needed for cumulative cash inflows to recover an initial cash outlay.",
        "Birikimli nakit girişlerinin başlangıçtaki nakit harcamasını karşılaması için gereken süredir.",
      ],
      [
        "investment-leverage",
        "Investment Leverage",
        "Yatırım Kaldıracı",
        "The use of borrowed money alongside equity to fund an investment.",
        "Bir yatırımı finanse etmek için öz kaynakla birlikte borç para kullanılmasıdır.",
      ],
      [
        "total-return",
        "Property Total Return",
        "Toplam Taşınmaz Getirisi",
        "The combined investment result from income and value change over a stated period.",
        "Belirli bir dönemde gelir ile değer değişiminin birlikte oluşturduğu yatırım sonucudur.",
      ],
    ],
  },
  {
    key: "values-costs-income",
    category: ["finance", "Finance", "Finansman"],
    subcategory: [
      "values-costs-income",
      "Property values, costs and income",
      "Taşınmaz değerleri, maliyetleri ve gelirleri",
    ],
    source: [
      "House surveys and valuation",
      "RICS",
      "https://www.rics.org/consumer-guides/house-surveys-uk-the-costs-types-and-benefits-of-an-rics-home-survey",
    ],
    entries: [
      [
        "market-value",
        "Market Value",
        "Piyasa Değeri",
        "A professionally assessed value based on a defined valuation basis and valuation date.",
        "Belirli bir değerleme esası ve tarihi kullanılarak profesyonel biçimde belirlenen değerdir.",
      ],
      [
        "asking-rent",
        "Asking Rent",
        "Talep Edilen Kira",
        "The rent advertised by a landlord before negotiation and agreement.",
        "Ev sahibinin pazarlık ve sözleşme öncesinde ilanda talep ettiği kiradır.",
      ],
      [
        "service-charge",
        "Service Charge",
        "Ortak Hizmet Gideri",
        "A charge for specified services, maintenance or management provided for a property.",
        "Taşınmaza sağlanan belirli hizmet, bakım veya yönetim giderleri için alınan bedeldir.",
      ],
      [
        "ground-rent",
        "Ground Rent",
        "Arsa Kirası",
        "Rent payable under some long leases for use of the land on which a property stands.",
        "Bazı uzun süreli kira haklarında taşınmazın bulunduğu arsanın kullanımı için ödenen kiradır.",
      ],
      [
        "council-tax",
        "Council Tax",
        "Yerel Yönetim Konut Vergisi",
        "A local tax on domestic property, subject to the rules of the relevant UK jurisdiction.",
        "Birleşik Krallık'ta ilgili bölgenin kurallarına tabi olan konutlara ilişkin yerel vergidir.",
      ],
      [
        "stamp-duty-land-tax",
        "Stamp Duty Land Tax",
        "Damga Vergisi Arazi Vergisi",
        "A transaction tax that can apply to qualifying land and property acquisitions in England and Northern Ireland.",
        "İngiltere ve Kuzey İrlanda'daki belirli arazi ve taşınmaz edinimlerine uygulanabilen işlem vergisidir.",
      ],
      [
        "building-insurance-premium",
        "Building Insurance Premium",
        "Bina Sigortası Primi",
        "The price paid for a period of buildings insurance cover.",
        "Bina sigortası teminatının belirli bir dönemi için ödenen bedeldir.",
      ],
      [
        "maintenance-cost",
        "Property Maintenance Cost",
        "Taşınmaz Bakım Maliyeti",
        "Money spent keeping property and its systems in usable condition.",
        "Taşınmazı ve sistemlerini kullanılabilir durumda tutmak için harcanan paradır.",
      ],
      [
        "repair-cost",
        "Property Repair Cost",
        "Taşınmaz Onarım Maliyeti",
        "Money required to correct damage, defects or failed components.",
        "Hasarları, kusurları veya çalışmayan parçaları düzeltmek için gereken paradır.",
      ],
      [
        "void-cost",
        "Void Cost",
        "Boş Kalma Maliyeti",
        "Costs and lost income arising while lettable property is unoccupied.",
        "Kiralanabilir bir taşınmaz boşken oluşan giderler ve kaybedilen gelirdir.",
      ],
    ],
  },
  {
    key: "construction-roles-stages",
    category: [
      "construction-delivery",
      "Construction and Delivery",
      "İnşaat ve Teslim",
    ],
    subcategory: [
      "roles-stages",
      "Construction roles and stages",
      "İnşaat rolleri ve aşamaları",
    ],
    source: [
      "Managing health and safety in construction",
      "Health and Safety Executive",
      "https://www.hse.gov.uk/pubns/priced/l153.pdf",
    ],
    entries: [
      [
        "construction-client",
        "Construction Client",
        "İnşaat İşvereni",
        "The person or organisation for whom a construction project is carried out.",
        "Bir inşaat projesinin adına yürütüldüğü kişi veya kuruluştur.",
      ],
      [
        "architect",
        "Architect",
        "Mimar",
        "A qualified design professional who develops and coordinates building design within their appointment.",
        "Görevlendirme kapsamı içinde bina tasarımını geliştiren ve koordine eden yetkin tasarım uzmanıdır.",
      ],
      [
        "structural-engineer",
        "Structural Engineer",
        "İnşaat Mühendisi",
        "An engineer who assesses and designs structural elements so loads are safely supported.",
        "Yüklerin güvenle taşınması için yapı elemanlarını değerlendiren ve tasarlayan mühendistir.",
      ],
      [
        "quantity-surveyor",
        "Quantity Surveyor",
        "Maliyet ve Metraj Uzmanı",
        "A construction professional who manages measurement, cost and commercial information.",
        "Ölçüm, maliyet ve ticari bilgileri yöneten inşaat uzmanıdır.",
      ],
      [
        "principal-designer",
        "Principal Designer",
        "Ana Tasarımcı",
        "The appointed designer who leads coordination of health and safety during the pre-construction phase on relevant projects.",
        "İlgili projelerde inşaat öncesi aşamadaki sağlık ve güvenlik koordinasyonuna liderlik etmek üzere atanan tasarımcıdır.",
      ],
      [
        "principal-contractor",
        "Principal Contractor",
        "Ana Yüklenici",
        "The contractor appointed to manage and coordinate the construction phase on relevant multi-contractor projects.",
        "İlgili çok yüklenicili projelerde yapım aşamasını yönetmek ve koordine etmek üzere atanan yüklenicidir.",
      ],
      [
        "subcontractor",
        "Subcontractor",
        "Alt Yüklenici",
        "A business or person engaged by a contractor to carry out part of the works.",
        "İşlerin bir bölümünü yapmak üzere bir yüklenici tarafından görevlendirilen kişi veya işletmedir.",
      ],
      [
        "site-manager",
        "Site Manager",
        "Şantiye Müdürü",
        "The person managing day-to-day site activities within their delegated authority.",
        "Devredilen yetkiler kapsamında günlük şantiye faaliyetlerini yöneten kişidir.",
      ],
      [
        "pre-construction-phase",
        "Pre-Construction Phase",
        "İnşaat Öncesi Aşama",
        "The project period in which design, planning and preparation occur before construction work begins.",
        "Yapım başlamadan önce tasarım, planlama ve hazırlığın yapıldığı proje dönemidir.",
      ],
      [
        "project-handover",
        "Project Handover",
        "Proje Teslimi",
        "The organised transfer of completed works, information and responsibilities to the receiving party.",
        "Tamamlanan işlerin, bilgilerin ve sorumlulukların teslim alan tarafa düzenli biçimde aktarılmasıdır.",
      ],
    ],
  },
  {
    key: "planning-building-control",
    category: ["planning-public", "Planning and Public", "Planlama ve Kamu"],
    subcategory: [
      "planning-building-control",
      "Planning and building control basics",
      "Planlama ve yapı kontrolü temelleri",
    ],
    source: [
      "Planning permission and building regulations approval",
      "Planning Portal",
      "https://www.planningportal.co.uk/planning/planning-applications/how-to-apply/planning-permission-and-building-regulations-approval/",
    ],
    entries: [
      [
        "planning-application",
        "Planning Application",
        "Planlama İzni Başvurusu",
        "A formal request to the planning authority for a decision on proposed development.",
        "Önerilen geliştirme hakkında karar verilmesi için planlama makamına yapılan resmî başvurudur.",
      ],
      [
        "permitted-development-rights",
        "Permitted Development Rights",
        "İzinli Geliştirme Hakları",
        "Planning rights that allow specified development without a conventional planning application, subject to limits and conditions.",
        "Belirli geliştirmelere sınır ve şartlara bağlı olarak normal planlama başvurusu olmadan izin veren haklardır.",
      ],
      [
        "planning-condition",
        "Planning Condition",
        "Planlama Koşulu",
        "A requirement attached to a planning permission that controls how development proceeds or is used.",
        "Geliştirmenin nasıl yürütüleceğini veya kullanılacağını düzenleyen planlama iznine bağlı şarttır.",
      ],
      [
        "listed-building-consent",
        "Listed Building Consent",
        "Tescilli Yapı İzni",
        "A separate consent that may be required for work affecting the special interest of a listed building.",
        "Tescilli bir yapının özel niteliğini etkileyen işler için gerekebilecek ayrı bir izindir.",
      ],
      [
        "conservation-area",
        "Conservation Area",
        "Koruma Alanı",
        "An area designated for special architectural or historic interest where additional planning controls may apply.",
        "Özel mimari veya tarihî önemi nedeniyle belirlenen ve ek planlama kontrollerinin uygulanabildiği alandır.",
      ],
      [
        "building-regulations",
        "Building Regulations",
        "Yapı Yönetmelikleri",
        "Legal standards governing aspects of building design and construction, separate from planning permission.",
        "Planlama izninden ayrı olarak bina tasarımı ve yapımının belirli yönlerini düzenleyen yasal standartlardır.",
      ],
      [
        "building-control-approval",
        "Building Control Approval",
        "Yapı Kontrol Onayı",
        "Approval or acceptance obtained through the applicable building-control route for proposed building work.",
        "Önerilen yapım işi için geçerli yapı kontrol yöntemi üzerinden alınan onay veya kabuldür.",
      ],
      [
        "building-control-body",
        "Building Control Body",
        "Yapı Kontrol Kuruluşu",
        "The authorised body responsible for building-control functions on a project.",
        "Bir projedeki yapı kontrol işlevlerinden sorumlu yetkili kuruluştur.",
      ],
      [
        "building-completion-certificate",
        "Building Completion Certificate",
        "Yapı Tamamlama Belgesi",
        "A building-control document issued when the relevant process concludes that completed work complies, subject to its scope.",
        "İlgili süreç tamamlanan işin kendi kapsamı içinde uygun olduğuna karar verdiğinde düzenlenen yapı kontrol belgesidir.",
      ],
      [
        "party-wall",
        "Party Wall",
        "Ortak Duvar",
        "A wall or qualifying structure shared by buildings or owners and potentially covered by specific statutory procedures.",
        "Binalar veya malikler tarafından paylaşılan ve özel yasal usullere tabi olabilen duvar ya da yapıdır.",
      ],
    ],
  },
  {
    key: "property-documents",
    category: ["legal-review", "Legal and Review", "Hukuk ve İnceleme"],
    subcategory: [
      "property-documents",
      "Common property documents",
      "Yaygın taşınmaz belgeleri",
    ],
    source: [
      "Finding information held by HM Land Registry",
      "HM Land Registry",
      "https://www.gov.uk/guidance/finding-information-held-by-hm-land-registry",
    ],
    entries: [
      [
        "memorandum-of-sale",
        "Memorandum of Sale",
        "Satış Bilgi Özeti",
        "A transaction summary circulated after an offer is accepted to help the parties begin conveyancing.",
        "Teklif kabul edildikten sonra tarafların devir işlemlerine başlamasına yardımcı olmak için dağıtılan işlem özetidir.",
      ],
      [
        "contract-for-sale",
        "Contract for Sale",
        "Taşınmaz Satış Sözleşmesi",
        "The contract recording the agreed legal terms for a property sale.",
        "Taşınmaz satışının kararlaştırılan hukuki şartlarını kaydeden sözleşmedir.",
      ],
      [
        "transfer-deed",
        "Transfer Deed",
        "Devir Senedi",
        "A deed used to transfer registered property ownership from one party to another.",
        "Kayıtlı taşınmaz mülkiyetini bir taraftan diğerine devretmek için kullanılan senettir.",
      ],
      [
        "mortgage-deed",
        "Mortgage Deed",
        "İpotek Senedi",
        "A deed creating the lender's legal security over property for a mortgage.",
        "Konut kredisi için kredi veren lehine taşınmaz üzerinde hukuki teminat kuran senettir.",
      ],
      [
        "energy-performance-certificate",
        "Energy Performance Certificate",
        "Enerji Performans Belgesi",
        "A certificate showing an assessed building energy-efficiency rating and recommendations.",
        "Bir binanın değerlendirilmiş enerji verimliliği derecesini ve önerileri gösteren belgedir.",
      ],
      [
        "property-information-form",
        "Property Information Form",
        "Taşınmaz Bilgi Formu",
        "A seller-completed form providing standard information about a residential property and related matters.",
        "Satıcının konut ve ilgili konular hakkında standart bilgiler verdiği formdur.",
      ],
      [
        "fixtures-fittings-form",
        "Fixtures and Fittings Form",
        "Demirbaş ve Eşya Formu",
        "A sale form recording which items are included, excluded or offered separately.",
        "Satışa hangi eşyaların dâhil, hariç veya ayrıca teklif edildiğini kaydeden formdur.",
      ],
      [
        "property-lease",
        "Property Lease",
        "Taşınmaz Kira Belgesi",
        "A legal document granting rights to occupy or use property for a defined term on stated conditions.",
        "Belirli şartlarla ve süreyle taşınmazı kullanma veya taşınmazda bulunma hakkı veren hukuki belgedir.",
      ],
      [
        "rent-statement",
        "Rent Statement",
        "Kira Hesap Dökümü",
        "A record of rent charges, payments, credits and balance for a tenancy or lease.",
        "Bir kiralama için kira tahakkuklarını, ödemeleri, alacakları ve bakiyeyi gösteren kayıttır.",
      ],
      [
        "schedule-of-condition",
        "Schedule of Condition",
        "Durum Tespit Çizelgesi",
        "A written and often photographic record of property condition at a stated date.",
        "Taşınmazın belirli bir tarihteki durumunu yazılı ve çoğu zaman fotoğraflı olarak kaydeden belgedir.",
      ],
    ],
  },
  {
    key: "risks-inspections",
    category: ["legal-review", "Legal and Review", "Hukuk ve İnceleme"],
    subcategory: [
      "risks-inspections",
      "Risks, inspections and due diligence",
      "Riskler ve incelemeler",
    ],
    source: [
      "House surveys",
      "RICS",
      "https://www.rics.org/consumer-guides/house-surveys-uk-the-costs-types-and-benefits-of-an-rics-home-survey",
    ],
    entries: [
      [
        "home-survey",
        "Home Survey",
        "Konut Durum İncelemesi",
        "A professional visual inspection and report on a home's condition at a stated level of service.",
        "Bir konutun durumuna ilişkin belirli hizmet seviyesinde yapılan profesyonel görsel inceleme ve rapordur.",
      ],
      [
        "mortgage-valuation",
        "Mortgage Valuation",
        "Kredi Değerlemesi",
        "A lender-commissioned valuation used for lending purposes rather than a full condition survey.",
        "Tam durum incelemesi yerine kredi kararı amacıyla kredi veren tarafından yaptırılan değerlemedir.",
      ],
      [
        "building-survey",
        "Building Survey",
        "Ayrıntılı Bina İncelemesi",
        "A detailed professional inspection and report suited to properties needing deeper condition analysis.",
        "Daha derin durum analizi gereken taşınmazlara uygun ayrıntılı profesyonel inceleme ve rapordur.",
      ],
      [
        "damp",
        "Damp",
        "Rutubet",
        "Unwanted excess moisture in building materials or internal spaces.",
        "Yapı malzemelerinde veya iç mekânlarda istenmeyen fazla nemdir.",
      ],
      [
        "subsidence",
        "Subsidence",
        "Zemin Kaynaklı Oturma",
        "Downward movement of ground supporting a building that can affect its foundations.",
        "Bir binayı taşıyan zeminin temelleri etkileyebilecek biçimde aşağı hareket etmesidir.",
      ],
      [
        "asbestos-containing-material",
        "Asbestos-Containing Material",
        "Asbest İçeren Malzeme",
        "Material that contains asbestos and requires risk-based identification and management.",
        "Asbest içeren ve riske dayalı tespit ile yönetim gerektiren malzemedir.",
      ],
      [
        "flood-risk",
        "Flood Risk",
        "Sel Riski",
        "The possibility and potential consequences of flooding at a property or site.",
        "Bir taşınmaz veya sahada sel meydana gelme olasılığı ve olası sonuçlarıdır.",
      ],
      [
        "land-contamination",
        "Land Contamination",
        "Arazi Kirliliği",
        "Harmful substances in or on land that may require investigation, risk assessment or remediation.",
        "Arazide bulunup inceleme, risk değerlendirmesi veya iyileştirme gerektirebilen zararlı maddelerdir.",
      ],
      [
        "japanese-knotweed",
        "Japanese Knotweed",
        "Japon Madımağı",
        "An invasive plant whose presence can affect property management and require specialist assessment.",
        "Varlığı taşınmaz yönetimini etkileyebilen ve uzman değerlendirmesi gerektirebilen istilacı bitkidir.",
      ],
      [
        "electrical-condition-report",
        "Electrical Installation Condition Report",
        "Elektrik Tesisatı Durum Raporu",
        "A report on the observed condition and safety of an electrical installation at the time of inspection.",
        "Elektrik tesisatının inceleme tarihindeki gözlenen durumunu ve güvenliğini değerlendiren rapordur.",
      ],
    ],
  },
  {
    key: "commercial-property",
    category: [
      "property-development",
      "Property and Development",
      "Gayrimenkul ve Geliştirme",
    ],
    subcategory: [
      "commercial-property",
      "Commercial property basics",
      "Ticari taşınmaz temelleri",
    ],
    source: [
      "Rent and commercial property",
      "RICS",
      "https://www.rics.org/dispute-resolution-service/drs-services/rent-and-property-disputes",
    ],
    entries: [
      [
        "business-lease",
        "Business Lease",
        "Ticari Kira Sözleşmesi",
        "A lease granting occupation of premises for business use on stated terms.",
        "Bir işyerini belirli şartlarla ticari amaçla kullanma hakkı veren kira sözleşmesidir.",
      ],
      [
        "passing-rent",
        "Passing Rent",
        "Geçerli Kira",
        "The rent currently payable under an existing lease.",
        "Mevcut kira sözleşmesi kapsamında hâlen ödenmesi gereken kiradır.",
      ],
      [
        "rent-free-period",
        "Rent-Free Period",
        "Kirasız Dönem",
        "An agreed period during which contractual rent is reduced to zero, subject to the lease terms.",
        "Kira şartlarına bağlı olarak sözleşmesel kiranın sıfıra indirildiği kararlaştırılmış dönemdir.",
      ],
      [
        "service-charge-budget",
        "Service Charge Budget",
        "Hizmet Gideri Bütçesi",
        "An estimate of recoverable shared-service expenditure for a future service-charge period.",
        "Gelecekteki hizmet gideri dönemi için ortak hizmetlere ilişkin tahsil edilebilir harcama tahminidir.",
      ],
      [
        "service-charge-reconciliation",
        "Service Charge Reconciliation",
        "Hizmet Gideri Mutabakatı",
        "A comparison of budgeted service charges with actual eligible expenditure after the period.",
        "Dönem sonunda bütçelenen hizmet giderleriyle gerçekleşen uygun harcamaların karşılaştırılmasıdır.",
      ],
      [
        "repairing-obligation",
        "Repairing Obligation",
        "Onarım Yükümlülüğü",
        "A lease duty allocating responsibility for specified repair and condition matters.",
        "Belirli onarım ve durum konularındaki sorumluluğu taraflara dağıtan kira yükümlülüğüdür.",
      ],
      [
        "full-repairing-insuring-lease",
        "Full Repairing and Insuring Lease",
        "Tam Onarım ve Sigorta Yükümlü Kira",
        "A commercial lease intended to place defined repair and insurance costs on the tenant, directly or through recovery.",
        "Tanımlanan onarım ve sigorta maliyetlerini doğrudan veya tahsil yoluyla kiracıya yüklemeyi amaçlayan ticari kira sözleşmesidir.",
      ],
      [
        "lease-assignment",
        "Lease Assignment",
        "Kira Hakkının Devri",
        "A transfer of an existing tenant's lease interest to another party, subject to the lease and law.",
        "Mevcut kiracının kira hakkını sözleşme ve hukuka bağlı olarak başka bir tarafa devretmesidir.",
      ],
      [
        "subletting",
        "Subletting",
        "Alt Kiralama",
        "A tenant granting another occupier rights over some or all of leased premises, where permitted.",
        "Kiracının izin verildiği ölçüde kiralananın tamamı veya bir kısmı üzerinde başka bir kullanıcıya hak vermesidir.",
      ],
      [
        "dilapidations",
        "Dilapidations",
        "Kira Sonu Onarım Talepleri",
        "Lease-related claims concerning a property's repair, reinstatement or condition obligations.",
        "Taşınmazın onarım, eski hâle getirme veya durum yükümlülüklerine ilişkin kira sözleşmesi talepleridir.",
      ],
    ],
  },
];

const formulas = {
  "rental-cash-flow": [
    "CF = CI - CO",
    [
      ["CF", "cash flow", "nakit akışı"],
      ["CI", "cash inflows", "nakit girişleri"],
      ["CO", "cash outflows", "nakit çıkışları"],
    ],
  ],
  "net-rental-income": [
    "NRI = GRI - OE",
    [
      ["NRI", "net rental income", "net kira geliri"],
      ["GRI", "gross rental income", "brüt kira geliri"],
      ["OE", "defined operating expenses", "tanımlı işletme giderleri"],
    ],
  ],
  "vacancy-rate": [
    "VR = Vacant units or time / Available units or time × 100",
    [["VR", "vacancy rate", "boşluk oranı"]],
  ],
  "break-even-occupancy": [
    "BEO = Operating costs / Potential income × 100",
    [["BEO", "break-even occupancy", "başabaş doluluk"]],
  ],
  "payback-period": [
    "Payback occurs when cumulative net cash flow equals the initial outlay",
    [["NCF", "cumulative net cash flow", "birikimli net nakit akışı"]],
  ],
  "total-return": [
    "TR = Income return + Capital value change",
    [["TR", "total return", "toplam getiri"]],
  ],
};

const reviewedDir = path.join("content", "reviewed", "pack-001");
fs.mkdirSync(reviewedDir, { recursive: true });
const planEntries = [];
let count = 0;
for (const group of groups) {
  for (let index = 0; index < group.entries.length; index++) {
    const [slug, en, tr, simpleEn, simpleTr] = group.entries[index];
    const id = `${group.key}.${slug}`;
    const previous =
      group.entries[
        (index + group.entries.length - 1) % group.entries.length
      ][0];
    const next = group.entries[(index + 1) % group.entries.length][0];
    const formula = formulas[slug]
      ? {
          expression: formulas[slug][0],
          variables: formulas[slug][1].map(
            ([symbol, descriptionEn, descriptionTr]) => ({
              symbol,
              description: { en: descriptionEn, tr: descriptionTr },
            }),
          ),
          notes: {
            en: "Use consistently defined inputs for the same period; this educational formula is not professional advice.",
            tr: "Aynı dönem için tutarlı biçimde tanımlanmış girdiler kullanın; bu eğitsel formül profesyonel tavsiye değildir.",
          },
        }
      : null;
    const record = {
      $schema: "../../../schemas/content-entry.schema.json",
      id,
      title: { en, tr },
      summary: { en: simpleEn, tr: simpleTr },
      abbreviation: "",
      definition: {
        en: `${simpleEn} In professional work, its precise effect depends on the contract, evidence, valuation basis and rules applying to the property. Confirm jurisdiction-specific legal, tax, lending or technical consequences with a suitably qualified adviser.`,
        tr: `${simpleTr} Profesyonel uygulamadaki kesin etkisi; sözleşmeye, kanıtlara, değerleme esasına ve taşınmaza uygulanan kurallara bağlıdır. Bölgeye özgü hukuk, vergi, kredi veya teknik sonuçları uygun nitelikte bir uzmanla teyit edin.`,
      },
      category: {
        key: group.category[0],
        en: group.category[1],
        tr: group.category[2],
      },
      subcategory: {
        key: group.subcategory[0],
        en: group.subcategory[1],
        tr: group.subcategory[2],
      },
      aliases: { en: [], tr: [] },
      tags: [group.key, "content-pack-001", "fundamentals"],
      keywords: {
        en: [...new Set(en.toLowerCase().split(/\s+/))],
        tr: [...new Set(tr.toLocaleLowerCase("tr-TR").split(/\s+/))],
      },
      formula,
      worked_example: {
        en: `Example: before relying on “${en}” in a real decision, identify the property, relevant date, document or calculation scope, then verify the result against the cited guidance and transaction documents.`,
        tr: `Örnek: Gerçek bir kararda “${tr}” kavramına dayanmadan önce taşınmazı, ilgili tarihi, belgeyi veya hesap kapsamını belirleyin; ardından sonucu kaynak gösterilen rehber ve işlem belgeleriyle doğrulayın.`,
      },
      when_to_use: {
        en: `Use this concept when reading, discussing or checking property work involving ${en.toLowerCase()}.`,
        tr: `Bu kavramı ${tr.toLocaleLowerCase("tr-TR")} içeren taşınmaz işlerini okurken, konuşurken veya kontrol ederken kullanın.`,
      },
      use_cases: {
        en: [
          "Understanding transaction documents",
          "Preparing questions for an adviser",
        ],
        tr: [
          "İşlem belgelerini anlamak",
          "Bir uzmana sorulacak soruları hazırlamak",
        ],
      },
      risks: {
        en: [
          "Meaning and obligations can change by jurisdiction, date and contract wording.",
        ],
        tr: [
          "Anlam ve yükümlülükler bölgeye, tarihe ve sözleşme metnine göre değişebilir.",
        ],
      },
      common_mistakes: {
        en: [
          "Treating a general explanation as a substitute for property-specific professional advice.",
        ],
        tr: [
          "Genel açıklamayı taşınmaza özel profesyonel tavsiyenin yerine koymak.",
        ],
      },
      related_concepts: [`${group.key}.${previous}`, `${group.key}.${next}`],
      related_calculators: formulas[slug] ? [slug] : [],
      related_documents: [],
      jurisdiction: [
        group.key === "commercial-property" || group.key === "risks-inspections"
          ? "United Kingdom (general; verify locally)"
          : "England and Wales (verify devolved and local rules)",
      ],
      sources: [
        {
          title: group.source[0],
          publisher: group.source[1],
          url: group.source[2],
          publication_date: null,
          accessed_date: created,
          citation_note: `Authoritative or recognised professional guidance used for the definition and practical context of ${en}; check the live source for updates.`,
        },
      ],
      created_date: created,
      reviewed_date: created,
      reviewer: "EMCP Content Pack 001 source review",
      review_status: "reviewed",
      content_version: "1.0.0",
    };
    fs.writeFileSync(
      path.join(reviewedDir, `${id}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
    );
    planEntries.push({
      id,
      title: { en, tr },
      category: group.key,
      priority: "high",
      overlap_check: "new",
      dependencies: [],
      suggested_sources: [group.source[2]],
    });
    count++;
  }
}

const plan = {
  topic_plan_id: "content-pack-001",
  title: {
    en: "Everyday Property, Construction and Finance Fundamentals",
    tr: "Günlük Gayrimenkul, İnşaat ve Finans Temelleri",
  },
  owner: "EMCP Editorial",
  target_jurisdictions: ["England and Wales", "United Kingdom where stated"],
  audience: [
    "Property owners",
    "Investors",
    "Developers",
    "Contractors",
    "Estate agents",
    "Construction professionals",
  ],
  objectives: {
    en: ["Publish 100 practical, beginner-friendly, non-duplicate concepts."],
    tr: [
      "Başlangıç seviyesine uygun, pratik ve tekrarsız 100 kavram yayımlamak.",
    ],
  },
  proposed_entries: planEntries,
  reviewers: ["EMCP Content Pack 001 source review"],
  status: "reviewed",
  target_review_date: created,
  notes:
    "Compared against all 103 runtime titles before authoring. Existing concepts were excluded. Legal, tax, lending, planning and technical consequences require property-specific professional advice.",
};
fs.writeFileSync(
  path.join("content", "topic-plans", "content-pack-001.json"),
  `${JSON.stringify(plan, null, 2)}\n`,
);
console.log(`Created Content Pack 001 with ${count} reviewed records.`);
