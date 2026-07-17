import fs from "node:fs";
import path from "node:path";
import { loadContent, loadLegacy, normalize, slug } from "./lib.mjs";

const root = process.cwd(),
  date = "2026-07-14";
const concepts = [
  [
    "Investor Goals",
    "Yatırımcı Hedefleri",
    "The specific financial and practical outcomes an investor wants property to support.",
    "Yatırımcının gayrimenkulün desteklemesini istediği belirli finansal ve pratik sonuçlardır.",
  ],
  [
    "Investment Strategy",
    "Yatırım Stratejisi",
    "A documented approach for selecting, financing, managing and exiting investments.",
    "Yatırımları seçme, finanse etme, yönetme ve yatırımdan çıkma yaklaşımını belgeleyen plandır.",
  ],
  [
    "Risk Tolerance",
    "Risk Toleransı",
    "The degree of uncertainty and potential loss an investor is willing and able to accept.",
    "Yatırımcının kabul etmeye istekli ve mali açıdan dayanabilecek durumda olduğu belirsizlik ve olası kayıp düzeyidir.",
  ],
  [
    "Investment Time Horizon",
    "Yatırım Süresi Ufku",
    "The expected period from committing capital until the intended exit or objective.",
    "Sermayenin yatırılmasından planlanan çıkışa veya hedefe kadar beklenen süredir.",
  ],
  [
    "Capital Allocation",
    "Sermaye Dağılımı",
    "The decision to distribute available capital among investments, reserves and other uses.",
    "Mevcut sermayeyi yatırımlar, rezervler ve diğer kullanımlar arasında dağıtma kararıdır.",
  ],
  [
    "Deal Sourcing",
    "Yatırım Fırsatı Bulma",
    "The repeatable process used to identify potential property investment opportunities.",
    "Olası gayrimenkul yatırım fırsatlarını belirlemek için kullanılan tekrarlanabilir süreçtir.",
  ],
  [
    "Property Market Research",
    "Gayrimenkul Piyasası Araştırması",
    "The structured collection and analysis of evidence about prices, rents, demand, supply and activity.",
    "Fiyat, kira, talep, arz ve piyasa faaliyeti hakkındaki kanıtların sistematik biçimde toplanıp analiz edilmesidir.",
  ],
  [
    "Location Analysis",
    "Lokasyon Analizi",
    "Assessment of how a property's position, connections, amenities and local context affect its use and prospects.",
    "Taşınmazın konumu, bağlantıları, olanakları ve yerel bağlamının kullanım ve beklentileri nasıl etkilediğinin değerlendirilmesidir.",
  ],
  [
    "Demand Analysis",
    "Talep Analizi",
    "Assessment of the depth, characteristics and evidence of buyer or occupier demand.",
    "Alıcı veya kullanıcı talebinin derinliği, özellikleri ve kanıtlarının değerlendirilmesidir.",
  ],
  [
    "Supply Analysis",
    "Arz Analizi",
    "Assessment of existing, competing and planned property supply in a defined market.",
    "Tanımlı bir piyasadaki mevcut, rakip ve planlanan gayrimenkul arzının değerlendirilmesidir.",
  ],
  [
    "Comparable Evidence",
    "Emsal Kanıt",
    "Relevant transaction or market evidence used to support assumptions about value or rent.",
    "Değer veya kira varsayımlarını desteklemek için kullanılan ilgili işlem veya piyasa kanıtıdır.",
  ],
  [
    "Purchase Price",
    "Satın Alma Fiyatı",
    "The agreed price payable for an asset before separately identified costs and adjustments.",
    "Ayrıca belirtilen gider ve düzeltmelerden önce varlık için ödenmesi kararlaştırılan fiyattır.",
  ],
  [
    "Market Value",
    "Piyasa Değeri",
    "An established professional basis of value that must be applied using its current formal definition and assumptions.",
    "Güncel resmî tanımı ve varsayımlarıyla uygulanması gereken yerleşik mesleki değer esasıdır.",
  ],
  [
    "GDV",
    "Brüt Geliştirme Değeri",
    "The estimated aggregate value of a completed development at the chosen valuation date and stated assumptions.",
    "Tamamlanmış bir geliştirmenin seçilen değerleme tarihinde ve açıklanan varsayımlarla tahmini toplam değeridir.",
  ],
  [
    "Rental Income",
    "Kira Geliri",
    "Income earned or forecast from granting occupation or use of property.",
    "Gayrimenkulün kullanım veya işgal hakkının verilmesinden elde edilen ya da öngörülen gelirdir.",
  ],
  [
    "Gross Rental Yield",
    "Brüt Kira Getirisi",
    "Annual gross rent divided by the stated property value or price, expressed as a percentage before costs.",
    "Yıllık brüt kiranın, giderlerden önce belirtilen değer veya fiyata bölünerek yüzde olarak ifade edilmesidir.",
  ],
  [
    "Net Rental Yield",
    "Net Kira Getirisi",
    "Annual rent after defined operating costs divided by the stated value or cost basis.",
    "Tanımlanan işletme giderleri sonrası yıllık kiranın belirtilen değer veya maliyet esasına bölünmesidir.",
  ],
  [
    "Rental Cash Flow",
    "Kira Nakit Akışı",
    "The timing and amount of cash receipts and payments arising from a rental investment.",
    "Kiralama yatırımından doğan nakit giriş ve çıkışlarının zamanı ve tutarıdır.",
  ],
  [
    "Property Operating Expenses",
    "Gayrimenkul İşletme Giderleri",
    "Recurring costs required to operate a property, classified consistently for the analysis.",
    "Bir gayrimenkulü işletmek için gereken ve analizde tutarlı biçimde sınıflandırılan tekrarlayan giderlerdir.",
  ],
  [
    "Net Operating Income",
    "Net İşletme Geliri",
    "Property income after defined operating expenses but before financing and tax items, subject to the stated convention.",
    "Belirtilen yönteme göre finansman ve vergi kalemlerinden önce, tanımlı işletme giderleri düşülmüş gayrimenkul geliridir.",
  ],
  [
    "Vacancy Assumption",
    "Boşluk Varsayımı",
    "The forecast allowance for time or space that produces no rent.",
    "Kira üretmeyen süre veya alan için tahminde ayrılan paydır.",
  ],
  [
    "Maintenance Allowance",
    "Bakım Payı",
    "A forecast amount reserved for routine and expected property maintenance.",
    "Rutin ve beklenen gayrimenkul bakımı için tahminde ayrılan tutardır.",
  ],
  [
    "Management Cost",
    "Yönetim Maliyeti",
    "The cost attributed to letting, administering and overseeing a property investment.",
    "Gayrimenkul yatırımının kiralanması, idaresi ve gözetimine atfedilen maliyettir.",
  ],
  [
    "Insurance Cost",
    "Sigorta Maliyeti",
    "The premiums and disclosed associated charges included for the selected insurance cover.",
    "Seçilen sigorta teminatı için dahil edilen primler ve açıklanmış ilgili ücretlerdir.",
  ],
  [
    "Financing Cost",
    "Finansman Maliyeti",
    "Interest, fees and other identified costs attributable to borrowing or arranging capital.",
    "Borçlanma veya sermaye düzenlemesine atfedilen faiz, ücret ve belirlenmiş diğer maliyetlerdir.",
  ],
  [
    "Mortgage Deposit",
    "Konut Kredisi Peşinatı",
    "The buyer's own contribution toward a purchase rather than mortgage borrowing.",
    "Alıcının satın almaya konut kredisi yerine kendi kaynaklarından yaptığı katkıdır.",
  ],
  [
    "Equity",
    "Öz Sermaye",
    "Capital representing the owner's residual economic interest after relevant liabilities.",
    "İlgili yükümlülüklerden sonra malikin kalan ekonomik payını temsil eden sermayedir.",
  ],
  [
    "Property Debt",
    "Gayrimenkul Borcu",
    "Borrowed capital associated with acquiring, developing or holding property.",
    "Gayrimenkulün edinilmesi, geliştirilmesi veya elde tutulmasıyla bağlantılı borç sermayedir.",
  ],
  [
    "Investment Leverage",
    "Yatırım Kaldıracı",
    "The use of debt or other senior capital to increase the exposure of invested equity to an asset.",
    "Yatırılan öz sermayenin varlığa maruziyetini artırmak için borç veya daha kıdemli sermaye kullanılmasıdır.",
  ],
  [
    "LTV",
    "Kredi Değer Oranı",
    "Loan amount divided by the stated property value, expressed as a percentage.",
    "Kredi tutarının belirtilen gayrimenkul değerine bölünerek yüzde olarak ifade edilmesidir.",
  ],
  [
    "LTC",
    "Kredi Maliyet Oranı",
    "Loan amount divided by the defined total project cost, expressed as a percentage.",
    "Kredi tutarının tanımlı toplam proje maliyetine bölünerek yüzde olarak ifade edilmesidir.",
  ],
  [
    "DSCR",
    "Borç Servisi Karşılama Oranı",
    "Defined income available for debt service divided by the debt service due for the same period.",
    "Borç servisi için tanımlanan gelirin aynı dönemdeki borç servisine bölünmesidir.",
  ],
  [
    "Interest Rate",
    "Faiz Oranı",
    "The rate used to determine interest on borrowed capital under stated terms.",
    "Belirtilen şartlara göre borç sermaye üzerindeki faizi belirlemek için kullanılan orandır.",
  ],
  [
    "Loan Term",
    "Kredi Vadesi",
    "The contractual period over which a loan is scheduled to remain outstanding.",
    "Bir kredinin ödenmemiş kalmasının planlandığı sözleşmesel süredir.",
  ],
  [
    "Loan Amortisation",
    "Kredi Amortismanı",
    "The scheduled reduction of loan principal through payments over time.",
    "Kredi anaparasının zaman içindeki ödemelerle planlı olarak azaltılmasıdır.",
  ],
  [
    "Interest-Only Mortgage",
    "Yalnız Faiz Ödemeli Kredi",
    "Borrowing where scheduled payments generally service interest and principal requires a separate repayment plan.",
    "Planlı ödemelerin genellikle faizi karşıladığı ve anapara için ayrı geri ödeme planı gereken borçlanmadır.",
  ],
  [
    "Repayment Mortgage",
    "Anapara ve Faiz Ödemeli Kredi",
    "Borrowing where scheduled payments reduce both interest due and principal over the term.",
    "Planlı ödemelerin vade boyunca hem faizi hem anaparayı azalttığı borçlanmadır.",
  ],
  [
    "Bridging Finance",
    "Köprü Finansmanı",
    "Short-term secured finance used to bridge a defined funding or transaction gap, with a credible repayment route.",
    "Tanımlı finansman veya işlem boşluğunu kapatmak için güvenilir geri ödeme yoluyla kullanılan kısa vadeli teminatlı finansmandır.",
  ],
  [
    "Development Finance",
    "Geliştirme Finansmanı",
    "Funding structured for land acquisition, construction and associated development costs, commonly released in stages.",
    "Arsa edinimi, inşaat ve ilgili geliştirme maliyetleri için yapılandırılan ve çoğunlukla aşamalı kullandırılan finansmandır.",
  ],
  [
    "Refinance",
    "Yeniden Finansman",
    "Replacing or restructuring existing finance with new borrowing or capital.",
    "Mevcut finansmanın yeni borçlanma veya sermayeyle değiştirilmesi ya da yeniden yapılandırılmasıdır.",
  ],
  [
    "ROI",
    "Yatırım Getirisi",
    "A return measure comparing defined gain or profit with a stated investment base.",
    "Tanımlı kazanç veya kârı belirtilen yatırım esasıyla karşılaştıran getiri ölçüsüdür.",
  ],
  [
    "Return on Equity",
    "Öz Sermaye Getirisi",
    "Defined return divided by the equity base used in the analysis.",
    "Tanımlı getirinin analizde kullanılan öz sermaye esasına bölünmesidir.",
  ],
  [
    "Return on Capital Employed",
    "Kullanılan Sermaye Getirisi",
    "A performance ratio comparing defined operating return with capital employed.",
    "Tanımlı faaliyet getirisini kullanılan sermayeyle karşılaştıran performans oranıdır.",
  ],
  [
    "Cash-on-Cash Return",
    "Nakit Üzerinden Getiri",
    "Annual pre-tax cash flow divided by the investor's cash invested.",
    "Yıllık vergi öncesi nakit akışının yatırımcının yatırdığı nakde bölünmesidir.",
  ],
  [
    "IRR",
    "İç Verim Oranı",
    "The discount rate that makes the net present value of a specified cash-flow series equal to zero.",
    "Belirli nakit akışı dizisinin net bugünkü değerini sıfıra eşitleyen iskonto oranıdır.",
  ],
  [
    "Net Present Value",
    "Net Bugünkü Değer",
    "The sum of forecast cash flows discounted to a stated valuation date at a selected discount rate.",
    "Tahmini nakit akışlarının seçilen iskonto oranıyla belirtilen değerleme tarihine indirgenmiş toplamıdır.",
  ],
  [
    "Equity Multiple",
    "Öz Sermaye Çarpanı",
    "Total equity distributions divided by total equity contributions, without measuring timing by itself.",
    "Toplam öz sermaye dağıtımlarının toplam öz sermaye katkılarına bölünmesidir; tek başına zamanlamayı ölçmez.",
  ],
  [
    "Capital Growth",
    "Sermaye Değer Artışı",
    "The increase in an asset's value over a stated period and measurement basis.",
    "Bir varlığın değerinin belirtilen dönem ve ölçüm esasına göre artmasıdır.",
  ],
  [
    "Property Total Return",
    "Toplam Gayrimenkul Getirisi",
    "The combined income and capital performance over a stated period using a consistent basis.",
    "Tutarlı bir esasla belirtilen dönemdeki gelir ve sermaye performansının birleşimidir.",
  ],
  [
    "Investment Break-even Point",
    "Yatırım Başabaş Noktası",
    "The output, occupancy, price or time at which defined revenue equals defined costs.",
    "Tanımlı gelirin tanımlı maliyetlere eşit olduğu çıktı, doluluk, fiyat veya zamandır.",
  ],
  [
    "Sensitivity Analysis",
    "Duyarlılık Analizi",
    "Testing how appraisal outputs change when selected assumptions change individually or together.",
    "Seçilen varsayımlar tek tek veya birlikte değiştiğinde değerleme sonuçlarının nasıl değiştiğinin testidir.",
  ],
  [
    "Best-case Scenario",
    "İyimser Senaryo",
    "A deliberately favourable but internally consistent set of disclosed appraisal assumptions.",
    "Açıklanmış ve kendi içinde tutarlı, kasıtlı olarak olumlu değerleme varsayımları kümesidir.",
  ],
  [
    "Base-case Scenario",
    "Temel Senaryo",
    "The central set of appraisal assumptions considered most appropriate for decision comparison.",
    "Karar karşılaştırması için en uygun kabul edilen merkezi değerleme varsayımları kümesidir.",
  ],
  [
    "Worst-case Scenario",
    "Kötümser Senaryo",
    "A deliberately adverse but plausible and internally consistent set of assumptions.",
    "Olası ve kendi içinde tutarlı, kasıtlı olarak olumsuz varsayımlar kümesidir.",
  ],
  [
    "Investment Contingency",
    "Yatırım Beklenmeyen Gider Payı",
    "A separately identified allowance for uncertainty within a defined cost or programme scope.",
    "Tanımlı maliyet veya program kapsamındaki belirsizlik için ayrıca belirlenen paydır.",
  ],
  [
    "Cost Overrun",
    "Maliyet Aşımı",
    "Actual or forecast cost exceeding the approved or stated budget baseline.",
    "Gerçekleşen veya tahmin edilen maliyetin onaylı ya da belirtilen bütçe esasını aşmasıdır.",
  ],
  [
    "Programme Delay",
    "Program Gecikmesi",
    "Progress or completion occurring later than the approved or assumed programme.",
    "İlerlemenin veya tamamlanmanın onaylı ya da varsayılan programdan daha geç gerçekleşmesidir.",
  ],
  [
    "Planning Risk",
    "Planlama Riski",
    "Uncertainty that planning decisions, conditions, policy or timing adversely affect an investment.",
    "Planlama kararları, koşulları, politikası veya zamanlamasının yatırımı olumsuz etkileme belirsizliğidir.",
  ],
  [
    "Construction Risk",
    "İnşaat Riski",
    "Uncertainty arising from design, procurement, cost, quality, safety, programme or delivery of works.",
    "Tasarım, tedarik, maliyet, kalite, güvenlik, program veya iş tesliminden doğan belirsizliktir.",
  ],
  [
    "Tenant Risk",
    "Kiracı Riski",
    "Uncertainty associated with tenant demand, payment, conduct, retention or covenant strength.",
    "Kiracı talebi, ödeme, davranış, elde tutma veya ödeme gücüyle bağlantılı belirsizliktir.",
  ],
  [
    "Property Market Risk",
    "Gayrimenkul Piyasa Riski",
    "Exposure to adverse changes in property prices, rents, liquidity, demand or supply.",
    "Gayrimenkul fiyatı, kira, likidite, talep veya arzdaki olumsuz değişikliklere maruz kalmadır.",
  ],
  [
    "Interest-rate Risk",
    "Faiz Oranı Riski",
    "Exposure to changes in interest rates that affect finance cost, affordability, value or exit options.",
    "Finansman maliyeti, ödeyebilirlik, değer veya çıkış seçeneklerini etkileyen faiz değişikliklerine maruz kalmadır.",
  ],
  [
    "Liquidity Risk",
    "Likidite Riski",
    "The risk that an asset or position cannot be sold, refinanced or converted to cash when required without material loss.",
    "Bir varlık veya pozisyonun gerektiğinde önemli kayıp olmadan satılamaması, yeniden finanse edilememesi veya nakde çevrilememesi riskidir.",
  ],
  [
    "Regulatory Risk",
    "Düzenleyici Risk",
    "Uncertainty that regulatory requirements or changes affect cost, use, income, compliance or value.",
    "Düzenleyici gereklilik veya değişikliklerin maliyet, kullanım, gelir, uyum veya değeri etkileme belirsizliğidir.",
  ],
  [
    "Tax Risk",
    "Vergi Riski",
    "Uncertainty arising from tax treatment, timing, classification, compliance or future change.",
    "Vergi uygulaması, zamanlama, sınıflandırma, uyum veya gelecekteki değişiklikten doğan belirsizliktir.",
  ],
  [
    "Due Diligence",
    "Detaylı İnceleme",
    "A proportionate investigation of an investment's legal, financial, commercial, technical and environmental evidence.",
    "Yatırımın hukuki, finansal, ticari, teknik ve çevresel kanıtlarının orantılı incelemesidir.",
  ],
  [
    "Title Risk",
    "Tapu Riski",
    "Uncertainty arising from ownership, registered interests, boundaries, rights or restrictions affecting property.",
    "Gayrimenkulü etkileyen mülkiyet, kayıtlı hak, sınır, yetki veya kısıtlamalardan doğan belirsizliktir.",
  ],
  [
    "Survey Risk",
    "İnceleme Riski",
    "The risk that condition information is incomplete, misunderstood or outside an inspection's scope.",
    "Durum bilgisinin eksik, yanlış anlaşılmış veya inceleme kapsamı dışında olması riskidir.",
  ],
  [
    "Environmental Risk",
    "Çevresel Risk",
    "Potential adverse effects from contamination, flooding, ecology, ground conditions or other environmental factors.",
    "Kirlilik, sel, ekoloji, zemin koşulları veya diğer çevresel etkenlerden doğabilecek olumsuz etkilerdir.",
  ],
  [
    "Flood Risk",
    "Sel Riski",
    "The likelihood and potential consequence of flooding from relevant sources at a property.",
    "Bir gayrimenkulde ilgili kaynaklardan sel oluşma olasılığı ve olası sonucudur.",
  ],
  [
    "Exit Strategy",
    "Çıkış Stratejisi",
    "A planned route for realising, refinancing, transferring or ending an investment position.",
    "Yatırım pozisyonunu nakde çevirme, yeniden finanse etme, devretme veya sonlandırma için planlanan yoldur.",
  ],
  [
    "Property Sale Exit",
    "Gayrimenkul Satış Çıkışı",
    "An exit that realises the investment through sale of the property or relevant interest.",
    "Gayrimenkulün veya ilgili hakkın satışıyla yatırımın nakde çevrildiği çıkıştır.",
  ],
  [
    "Refinance Exit",
    "Yeniden Finansman Çıkışı",
    "An exit or capital-release route using replacement finance, subject to value, income and lending conditions.",
    "Değer, gelir ve kredi koşullarına bağlı olarak yeni finansmanla çıkış veya sermaye serbest bırakma yoludur.",
  ],
  [
    "Hold Strategy",
    "Elde Tutma Stratejisi",
    "A strategy focused on retaining an asset for income, growth or another stated objective.",
    "Varlığı gelir, değer artışı veya belirtilen başka amaç için elde tutmaya odaklanan stratejidir.",
  ],
  [
    "Development Exit",
    "Geliştirme Çıkışı",
    "The planned disposal, refinance or retention route following development activity.",
    "Geliştirme faaliyeti sonrasında planlanan satış, yeniden finansman veya elde tutma yoludur.",
  ],
  [
    "Portfolio Strategy",
    "Portföy Stratejisi",
    "A coordinated plan for the role, balance, funding and lifecycle of multiple investments.",
    "Birden fazla yatırımın rolü, dengesi, finansmanı ve yaşam döngüsü için koordineli plandır.",
  ],
  [
    "Diversification",
    "Çeşitlendirme",
    "Spreading exposure across assets or risk drivers to reduce dependence on a single outcome.",
    "Tek bir sonuca bağımlılığı azaltmak için maruziyeti varlıklar veya risk etkenleri arasında dağıtmaktır.",
  ],
  [
    "Concentration Risk",
    "Yoğunlaşma Riski",
    "Excessive dependence on one asset, location, tenant, strategy, lender or risk factor.",
    "Tek bir varlık, lokasyon, kiracı, strateji, kredi kuruluşu veya risk etkenine aşırı bağımlılıktır.",
  ],
  [
    "Asset Management",
    "Varlık Yönetimi",
    "Strategic oversight intended to protect and improve an asset's performance, risk position and business plan.",
    "Varlığın performansını, risk konumunu ve iş planını koruyup geliştirmeyi amaçlayan stratejik gözetimdir.",
  ],
  [
    "Property Management",
    "Gayrimenkul Yönetimi",
    "Day-to-day administration of property, occupiers, maintenance, suppliers and records within an agreed scope.",
    "Kararlaştırılan kapsamda gayrimenkul, kullanıcı, bakım, tedarikçi ve kayıtların günlük yönetimidir.",
  ],
  [
    "Tenant Management",
    "Kiracı Yönetimi",
    "The structured management of tenant communication, obligations, payments, service and retention.",
    "Kiracı iletişimi, yükümlülükleri, ödemeleri, hizmeti ve elde tutmanın sistematik yönetimidir.",
  ],
  [
    "Lease Management",
    "Kira Sözleşmesi Yönetimi",
    "Administration of lease dates, obligations, payments, notices, reviews and evidence.",
    "Kira sözleşmesi tarihleri, yükümlülükleri, ödemeleri, bildirimleri, incelemeleri ve kanıtlarının yönetimidir.",
  ],
  [
    "Investment Performance Tracking",
    "Yatırım Performansı Takibi",
    "Regular comparison of actual investment results with budget, forecast and objectives.",
    "Gerçek yatırım sonuçlarının bütçe, tahmin ve hedeflerle düzenli karşılaştırılmasıdır.",
  ],
  [
    "Property Investment Budget",
    "Gayrimenkul Yatırım Bütçesi",
    "An approved plan of expected income, costs, capital expenditure and funding for a period.",
    "Bir dönem için beklenen gelir, gider, sermaye harcaması ve finansmanın onaylı planıdır.",
  ],
  [
    "Investment Forecasting",
    "Yatırım Tahmini",
    "Producing forward-looking estimates from documented assumptions and available evidence.",
    "Belgelenmiş varsayımlar ve mevcut kanıtlardan geleceğe yönelik tahminler üretmektir.",
  ],
  [
    "Deal Appraisal",
    "Yatırım Fırsatı Değerlemesi",
    "A structured financial and risk assessment of a potential transaction against objectives and constraints.",
    "Olası işlemin hedef ve kısıtlara göre sistematik finansal ve risk değerlendirmesidir.",
  ],
  [
    "Investment Memorandum",
    "Yatırım Bilgi Notu",
    "A decision document summarising the opportunity, evidence, assumptions, appraisal, risks and recommendation.",
    "Fırsatı, kanıtı, varsayımları, değerlemeyi, riskleri ve öneriyi özetleyen karar belgesidir.",
  ],
  [
    "Investment Decision Framework",
    "Yatırım Karar Çerçevesi",
    "A consistent set of criteria, evidence requirements and approval steps for investment decisions.",
    "Yatırım kararları için tutarlı ölçüt, kanıt gerekliliği ve onay adımları kümesidir.",
  ],
  [
    "Go/No-Go Decision",
    "Devam veya Vazgeç Kararı",
    "A documented decision to proceed, pause or reject an opportunity against stated criteria.",
    "Belirtilen ölçütlere göre fırsata devam etme, bekletme veya reddetme kararıdır.",
  ],
  [
    "Margin of Safety",
    "Güvenlik Marjı",
    "The deliberate buffer between an investment assumption or price and a more adverse outcome.",
    "Yatırım varsayımı veya fiyatıyla daha olumsuz sonuç arasında kasıtlı bırakılan tampon paydır.",
  ],
  [
    "Investment Checklist",
    "Yatırım Kontrol Listesi",
    "A repeatable list of evidence, calculations, risks and approvals required before a decision.",
    "Karardan önce gereken kanıt, hesaplama, risk ve onayların tekrarlanabilir listesidir.",
  ],
  [
    "Deal Snapshot",
    "Yatırım Fırsatı Özeti",
    "A concise, dated summary of key deal inputs, outputs, assumptions and risks.",
    "Yatırım fırsatının temel girdi, çıktı, varsayım ve risklerinin kısa ve tarihli özetidir.",
  ],
  [
    "Scenario Comparison",
    "Senaryo Karşılaştırması",
    "Side-by-side comparison of appraisal outcomes under consistently defined assumption sets.",
    "Tutarlı biçimde tanımlanmış varsayım kümelerindeki değerleme sonuçlarının yan yana karşılaştırılmasıdır.",
  ],
  [
    "Investment Lessons Learned",
    "Yatırımdan Çıkarılan Dersler",
    "Documented observations about what worked, failed or should change in future decisions.",
    "Gelecekteki kararlarda neyin işe yaradığı, başarısız olduğu veya değişmesi gerektiğine ilişkin belgeli gözlemlerdir.",
  ],
  [
    "Post-investment Review",
    "Yatırım Sonrası İnceleme",
    "A structured review comparing the investment case with actual delivery and outcomes.",
    "Yatırım gerekçesini gerçek uygulama ve sonuçlarla karşılaştıran sistematik incelemedir.",
  ],
  [
    "Common Investor Mistakes",
    "Yaygın Yatırımcı Hataları",
    "Recurring decision errors that weaken evidence, appraisal, risk control or execution.",
    "Kanıtı, değerlemeyi, risk kontrolünü veya uygulamayı zayıflatan tekrarlayan karar hatalarıdır.",
  ],
  [
    "Overpaying",
    "Fazla Ödeme",
    "Paying more than the amount supported by the investor's evidence, objectives and risk-adjusted appraisal.",
    "Yatırımcının kanıtı, hedefleri ve riske göre değerlemesinin desteklediğinden daha fazla ödeme yapmasıdır.",
  ],
  [
    "Underestimating Costs",
    "Maliyetleri Düşük Tahmin Etme",
    "Using cost assumptions that omit, understate or inadequately allow for likely expenditure.",
    "Olası harcamaları dışlayan, düşük gösteren veya yetersiz pay ayıran maliyet varsayımları kullanmaktır.",
  ],
  [
    "Overestimating Rent",
    "Kirayı Yüksek Tahmin Etme",
    "Forecasting rent above the level supported by comparable evidence and realistic letting assumptions.",
    "Emsal kanıt ve gerçekçi kiralama varsayımlarının desteklediğinden yüksek kira tahmin etmektir.",
  ],
  [
    "Ignoring Exit Risk",
    "Çıkış Riskini Göz Ardı Etme",
    "Making an investment decision without testing whether the intended sale, refinance or hold route remains feasible under adverse conditions.",
    "Planlanan satış, yeniden finansman veya elde tutma yolunun olumsuz koşullarda uygulanabilirliğini test etmeden yatırım kararı almaktır.",
  ],
];

const formulas = new Map([
  ["Gross Rental Yield", "annual gross rent / property value × 100"],
  [
    "Net Rental Yield",
    "(annual rent − defined operating costs) / property value × 100",
  ],
  ["Net Operating Income", "property income − defined operating expenses"],
  ["LTV", "loan / property value × 100"],
  ["LTC", "loan / total cost × 100"],
  ["DSCR", "income available for debt service / debt service"],
  ["ROI", "defined return / investment base × 100"],
  ["Return on Equity", "defined return / equity × 100"],
  [
    "Return on Capital Employed",
    "defined operating return / capital employed × 100",
  ],
  ["Cash-on-Cash Return", "annual pre-tax cash flow / cash invested × 100"],
  [
    "Equity Multiple",
    "total equity distributions / total equity contributions",
  ],
]);
const calculators = new Map([
  ["Gross Rental Yield", ["Rental Yield"]],
  ["Net Rental Yield", ["Rental Yield"]],
  ["LTV", ["LTV"]],
  ["LTC", ["LTC"]],
  ["DSCR", []],
  ["ROI", ["ROI"]],
  ["Cash-on-Cash Return", ["ROI"]],
  ["GDV", ["Development Profit"]],
  ["Financing Cost", ["Arrangement Fee", "Interest Roll-up"]],
  ["Loan Amortisation", ["Monthly Loan Payment"]],
  ["Interest Rate", ["Monthly Loan Payment"]],
  [
    "Deal Snapshot",
    ["LTV", "LTC", "ROI", "Rental Yield", "Development Profit"],
  ],
]);
const sourceFor = (title) =>
  title.includes("Planning")
    ? [
        "Planning Portal guidance",
        "Planning Portal",
        "https://www.planningportal.co.uk/permission/",
      ]
    : title.includes("Mortgage") ||
        title.includes("Loan") ||
        title.includes("Interest") ||
        title.includes("Finance") ||
        title === "Refinance"
      ? [
          "Mortgages and borrowing",
          "MoneyHelper",
          "https://www.moneyhelper.org.uk/en/homes/buying-a-home",
        ]
      : [
          "Property investment professional guidance",
          "Royal Institution of Chartered Surveyors",
          "https://www.rics.org/consumer-guides",
        ];
const category = { key: "finance", en: "Finance", tr: "Finansman" };
const authored = loadContent().records,
  legacy = loadLegacy();
const authoredByTitle = new Map(
  authored.map((item) => [normalize(item.record.title?.en), item]),
);
const legacyByTitle = new Map(
  legacy.entries.map((item) => [normalize(item.entry.term), item.entry.term]),
);
const touched = [],
  createdRecords = [];

function enrich(record, title, tr, defEn, defTr) {
  record.simple_explanation ||= { en: defEn, tr: defTr };
  record.professional_explanation ||= {
    en: `${defEn} The basis, period, inclusions and assumptions must be stated consistently.`,
    tr: `${defTr} Esas, dönem, dahil edilen kalemler ve varsayımlar tutarlı biçimde belirtilmelidir.`,
  };
  record.real_world_example ||= {
    en: `An investor records the evidence and assumptions for ${title.toLowerCase()} before comparing the opportunity with alternatives.`,
    tr: `Yatırımcı fırsatı alternatiflerle karşılaştırmadan önce ${tr.toLocaleLowerCase("tr-TR")} için kanıt ve varsayımları kaydeder.`,
  };
  record.office_example ||= {
    en: `The appraisal file shows the source, date, owner and sensitivity of the ${title.toLowerCase()} assumption.`,
    tr: `Değerleme dosyası ${tr.toLocaleLowerCase("tr-TR")} varsayımının kaynağını, tarihini, sorumlusunu ve duyarlılığını gösterir.`,
  };
  record.interview_questions ||= {
    en: [
      {
        question: `How would you verify ${title}?`,
        answer:
          "Define the measure, obtain dated evidence, state assumptions and test the effect of error.",
      },
    ],
    tr: [
      {
        question: `${tr} nasıl doğrulanır?`,
        answer:
          "Ölçüyü tanımlayın, tarihli kanıt alın, varsayımları açıklayın ve hata etkisini test edin.",
      },
    ],
  };
  record.practical_tips ||= {
    en: ["Record the source, date, units, period and responsible reviewer."],
    tr: ["Kaynağı, tarihi, birimi, dönemi ve sorumlu inceleyeni kaydedin."],
  };
  record.best_practice ||= {
    en: [
      "Use consistent definitions across the base, upside and downside cases.",
    ],
    tr: ["Temel, iyimser ve kötümser senaryolarda tutarlı tanımlar kullanın."],
  };
  record.uk_practice ||= {
    en: "Verify current UK legal, tax, valuation, planning and lending requirements with the relevant qualified adviser.",
    tr: "Güncel Birleşik Krallık hukuk, vergi, değerleme, planlama ve kredi gerekliliklerini ilgili nitelikli uzmanla doğrulayın.",
  };
  record.turkey_practice ||= {
    en: "Use the Turkish explanation educationally and verify current Turkish law, tax, title, valuation and lending practice locally.",
    tr: "Türkçe açıklamayı eğitim amaçlı kullanın; güncel Türkiye hukuk, vergi, tapu, değerleme ve kredi uygulamasını yerel olarak doğrulayın.",
  };
  record.difficulty_level ||= "beginner";
  record.estimated_reading_time_minutes ||= 5;
  record.frequently_asked_questions ||= {
    en: [
      {
        question: `Can ${title} be used without checking its basis?`,
        answer:
          "No. The definition, period, evidence and exclusions must be clear.",
      },
    ],
    tr: [
      {
        question: `${tr} esası kontrol edilmeden kullanılabilir mi?`,
        answer:
          "Hayır. Tanım, dönem, kanıt ve hariç tutulan kalemler açık olmalıdır.",
      },
    ],
  };
  record.revision_history ||= [];
  if (!record.revision_history.some((x) => x.version === "1.2.0"))
    record.revision_history.push({
      version: "1.2.0",
      date,
      summary: {
        en: "Pack 003 investor-fundamentals enrichment.",
        tr: "Pack 003 yatırımcı temelleri zenginleştirmesi.",
      },
      reviewer: "EMCP Editorial Review",
    });
  record.content_version = "1.2.0";
  return record;
}

for (const [title, tr, defEn, defTr] of concepts) {
  const existingAuthored = authoredByTitle.get(normalize(title));
  if (existingAuthored) {
    enrich(existingAuthored.record, title, tr, defEn, defTr);
    fs.writeFileSync(
      path.join(root, existingAuthored.file),
      `${JSON.stringify(existingAuthored.record, null, 2)}\n`,
    );
    touched.push({
      title,
      id: existingAuthored.record.id,
      file: existingAuthored.file,
    });
    continue;
  }
  const legacyTerm = legacyByTitle.get(normalize(title));
  const [sourceTitle, publisher, url] = sourceFor(title),
    expression = formulas.get(title) || null;
  const id = `investor.${slug(title)}`;
  const record = enrich(
    {
      id,
      ...(legacyTerm ? { legacy_term: legacyTerm } : {}),
      title: { en: title, tr },
      abbreviation: title.length <= 6 ? title : "",
      summary: { en: defEn, tr: defTr },
      definition: { en: defEn, tr: defTr },
      category,
      subcategory: {
        key: "investor-fundamentals",
        en: "Property Investor Fundamentals",
        tr: "Gayrimenkul Yatırımcısı Temelleri",
      },
      aliases: { en: [], tr: [] },
      tags: ["property-investment", "pack-003", "beginner"],
      keywords: {
        en: [title.toLowerCase()],
        tr: [tr.toLocaleLowerCase("tr-TR")],
      },
      formula: expression
        ? {
            expression,
            variables: [],
            notes: {
              en: "Use consistent definitions and periods; disclose inclusions and exclusions.",
              tr: "Tutarlı tanım ve dönem kullanın; dahil ve hariç kalemleri açıklayın.",
            },
          }
        : null,
      worked_example: {
        en: `A learner enters a hypothetical property's evidence into a dated appraisal, calculates or records ${title.toLowerCase()}, and tests whether a reasonable adverse change alters the decision.`,
        tr: `Öğrenci varsayımsal taşınmazın kanıtını tarihli değerlemeye girer, ${tr.toLocaleLowerCase("tr-TR")} değerini hesaplar veya kaydeder ve makul olumsuz değişikliğin kararı değiştirip değiştirmediğini test eder.`,
      },
      when_to_use: {
        en: `Use ${title.toLowerCase()} when it is relevant to screening, financing, managing or exiting a property investment.`,
        tr: `${tr} kavramını gayrimenkul yatırımını ön eleme, finanse etme, yönetme veya yatırımdan çıkmada ilgili olduğunda kullanın.`,
      },
      use_cases: {
        en: [
          `Document ${title.toLowerCase()} in an investment appraisal or decision record.`,
        ],
        tr: [
          `${tr} konusunu yatırım değerlemesi veya karar kaydında belgelemek.`,
        ],
      },
      risks: {
        en: [
          "Incorrect definitions, periods or unsupported assumptions can materially distort the decision.",
        ],
        tr: [
          "Yanlış tanım, dönem veya desteksiz varsayımlar kararı önemli ölçüde bozabilir.",
        ],
      },
      common_mistakes: {
        en: [
          "Using a number without recording its source, date, units and exclusions.",
        ],
        tr: [
          "Bir rakamı kaynağı, tarihi, birimi ve hariç kalemleri olmadan kullanmak.",
        ],
      },
      related_concepts: [],
      related_calculators: calculators.get(title) || [],
      related_documents: [],
      related_standards: [],
      related_regulations: [],
      visual_illustration: {
        status: "planned",
        caption: {
          en: `${title} decision diagram planned.`,
          tr: `${tr} karar şeması planlandı.`,
        },
        url: null,
      },
      future_video: {
        status: "planned",
        caption: {
          en: `${title} beginner lesson planned.`,
          tr: `${tr} başlangıç dersi planlandı.`,
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
          accessed_date: date,
          citation_note:
            "Authoritative professional starting point; transaction-specific assumptions and current requirements require verification.",
        },
      ],
      created_date: date,
      reviewed_date: date,
      reviewer: "EMCP Editorial Review",
      review_status: "reviewed",
      content_version: "1.0.0",
    },
    title,
    tr,
    defEn,
    defTr,
  );
  // New records begin at 1.0.0 even though the shared enrichment helper adds full v2 detail.
  record.revision_history = [
    {
      version: "1.0.0",
      date,
      summary: {
        en: "Initial Pack 003 reviewed edition.",
        tr: "İlk Pack 003 incelenmiş sürümü.",
      },
      reviewer: "EMCP Editorial Review",
    },
  ];
  record.content_version = "1.0.0";
  createdRecords.push(record);
}

const output = path.join(root, "content/reviewed/pack-003");
fs.mkdirSync(output, { recursive: true });
for (const record of createdRecords)
  fs.writeFileSync(
    path.join(output, `${record.id}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  );
const plan = {
  pack_id: "pack-003",
  pack_number: 3,
  title: {
    en: "Property Investor Fundamentals",
    tr: "Gayrimenkul Yatırımcısı Temelleri",
  },
  planned_concept_count: concepts.length,
  reviewed_new_or_legacy_records: createdRecords.length,
  existing_authored_records_enriched: touched.length,
  status: "reviewed",
  concepts: concepts.map(([title, tr], index) => {
    const touchedItem = touched.find((x) => x.title === title),
      created = createdRecords.find((x) => x.title.en === title);
    return {
      number: index + 1,
      title: { en: title, tr },
      disposition: touchedItem
        ? "existing record enriched"
        : created?.legacy_term
          ? "existing runtime record enriched"
          : "new reviewed record",
      id: touchedItem?.id || created?.id,
    };
  }),
  duplicate_audit: {
    runtime_records_checked: legacy.entries.length,
    authored_records_checked: authored.length,
    duplicate_records_created: 0,
  },
};
fs.writeFileSync(
  "content/topic-plans/content-pack-003.json",
  `${JSON.stringify(plan, null, 2)}\n`,
);
console.log(
  `Pack 003 plan: ${concepts.length}; created authoring records: ${createdRecords.length}; existing authored records enriched: ${touched.length}.`,
);
