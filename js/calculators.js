(function (global) {
  "use strict";

  const SCENARIO_STORAGE_KEY = "emcpCalculatorScenarios";
  const core = global.EMCPCore,
    storage = core.storage,
    model = global.EMCPCalculatorModel;
  const numberFormatter = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  });
  const lastResults = new Map();
  let activeScenarioId = null;
  let currentSnapshot = null;
  let initialized = false;
  const i18n = global.EMCPi18n;
  const isTurkish = () => i18n?.language === "tr";
  const choose = (english, turkish) =>
    isTurkish() ? turkish || english : english;
  const trConfig = {
    ltv: {
      title: "LTV",
      formula: "Kredi ÷ Gayrimenkul Değeri × 100",
      assumptions:
        "Mevcut gayrimenkul değerini kullanır; ücretleri, faizi ve diğer teminatları içermez.",
      labels: { ltvLoan: "Kredi", ltvValue: "Gayrimenkul Değeri" },
    },
    ltc: {
      title: "LTC",
      formula: "Kredi ÷ Toplam Maliyet × 100",
      assumptions:
        "Toplam maliyet, krediyle ilgili satın alma ve geliştirme maliyetlerini içermelidir.",
      labels: { ltcLoan: "Kredi", ltcCost: "Toplam Maliyet" },
    },
    ltgdv: {
      title: "LTGDV",
      formula: "Kredi ÷ Brüt Geliştirme Değeri × 100",
      assumptions:
        "GDV, satış maliyetleri ve vergiler öncesi tahmini tamamlanmış değerdir.",
      labels: { ltgdvLoan: "Kredi", ltgdvValue: "GDV" },
    },
    roi: {
      title: "ROI",
      formula: "Kâr ÷ Yatırım × 100",
      assumptions:
        "Kâr negatif olabilir. Yatırım, ölçülen sermaye temelini göstermelidir.",
      labels: { roiProfit: "Kâr", roiCost: "Yatırım" },
    },
    yield: {
      title: "Kira Getirisi",
      formula: "Yıllık Kira ÷ Gayrimenkul Değeri × 100",
      assumptions:
        "Boşluk, işletme maliyeti, finansman ve vergi öncesi brüt getiriyi gösterir.",
      labels: { yieldRent: "Yıllık Kira", yieldValue: "Gayrimenkul Değeri" },
    },
    "development-profit": {
      title: "Geliştirme Kârı",
      formula: "GDV − Toplam Geliştirme Maliyeti; Kâr ÷ Maliyet × 100",
      assumptions:
        "Toplam geliştirme maliyetine dahil edilmeyen maliyet veya vergileri içermez.",
      labels: { devGdv: "GDV", devCost: "Toplam Geliştirme Maliyeti" },
    },
    "monthly-payment": {
      title: "Aylık Kredi Ödemesi",
      formula: "P × r × (1+r)ⁿ ÷ ((1+r)ⁿ−1)",
      assumptions:
        "Sabit faizli, aylık ödemeli ve tamamen amortismanlı bir geri ödeme kredisi varsayar.",
      labels: {
        loanPrincipal: "Kredi",
        loanRate: "Yıllık Faiz %",
        loanYears: "Vade (Yıl)",
      },
    },
    "arrangement-fee": {
      title: "Kredi Düzenleme Ücreti",
      formula: "Kredi × Ücret Yüzdesi",
      assumptions:
        "Ücretin girilen kredi tutarının tamamı üzerinden alındığını varsayar.",
      labels: { feeLoan: "Kredi", feeRate: "Ücret %" },
    },
    "interest-rollup": {
      title: "Birikmiş Faiz",
      formula: "Kredi × Yıllık Faiz × Ay ÷ 12",
      assumptions:
        "Sabit bakiye üzerinden basit faiz kullanır; bileşik faiz veya dilimleri modellemez.",
      labels: {
        rollLoan: "Kredi",
        rollRate: "Yıllık Faiz %",
        rollMonths: "Ay",
      },
    },
    concrete: {
      title: "Beton Hacmi",
      formula: "Uzunluk × Genişlik × Derinlik",
      assumptions:
        "Tüm ölçüler metre cinsinden girilmelidir; fire payı içermez.",
      labels: { cLen: "Uzunluk m", cWid: "Genişlik m", cDep: "Derinlik m" },
    },
    paint: {
      title: "Boya Alanı",
      formula: "Duvar Uzunluğu × Duvar Yüksekliği × Kat Sayısı",
      assumptions: "Boşluklar ve ürün kaplama oranları düşülmez.",
      labels: {
        pLen: "Duvar Uzunluğu m",
        pHeight: "Duvar Yüksekliği m",
        pCoats: "Kat Sayısı",
      },
    },
    flooring: {
      title: "Zemin Alanı",
      formula: "Uzunluk × Genişlik × (1 + Fire Yüzdesi)",
      assumptions:
        "Tek bir dikdörtgen alan kullanır ve firenin tamamına uygular.",
      labels: { fLen: "Uzunluk m", fWid: "Genişlik m", fWaste: "Fire %" },
    },
    plasterboard: {
      title: "Alçıpan Levha",
      formula: "Alan × (1 + Fire Yüzdesi) ÷ Levha Alanı, yukarı yuvarlanır",
      assumptions:
        "Tam levhaya yukarı yuvarlar ve kesim yerleşimini optimize etmez.",
      labels: {
        pbArea: "Duvar Alanı m²",
        pbSheet: "Levha Alanı m²",
        pbWaste: "Fire %",
      },
    },
    insulation: {
      title: "Yalıtım Alanı",
      formula: "Alan × (1 + Fire Yüzdesi)",
      assumptions:
        "Yalnızca kaplama alanını verir; ürün miktarı seçilen ürüne bağlıdır.",
      labels: { insArea: "Duvar/Tavan Alanı m²", insWaste: "Fire %" },
    },
    tiles: {
      title: "Karo Adedi",
      formula: "Alan × (1 + Fire Yüzdesi) ÷ Karo Alanı, yukarı yuvarlanır",
      assumptions:
        "Tam karoya yukarı yuvarlar; kutu miktarını veya desen eşleştirmeyi içermez.",
      labels: {
        tileArea: "Toplam Alan m²",
        tileSize: "Karo Alanı m²",
        tileWaste: "Fire %",
      },
    },
  };

  const money = (value) =>
    Number.isFinite(value) ? `£${numberFormatter.format(value)}` : "—";
  const number = (value) =>
    Number.isFinite(value) ? numberFormatter.format(value) : "—";
  const percent = (value, base) => {
    const result = model.ratio(value, base);
    return result === null ? "—" : `${result.toFixed(2)}%`;
  };
  const escapeHtml = core.escapeHTML;

  const field = (id, label, options = {}) => ({
    id,
    label,
    required: true,
    step: "any",
    ...options,
  });
  const configurations = [
    {
      id: "ltv",
      legacy: "calcLTV",
      title: "LTV",
      groups: ["finance", "property"],
      resultId: "ltvResult",
      inputs: [
        field("ltvLoan", "Loan", { min: 0, example: 700000 }),
        field("ltvValue", "Property Value", {
          min: 0,
          exclusiveMin: true,
          example: 1000000,
        }),
      ],
      formula: "Loan ÷ Property Value × 100",
      assumptions:
        "Uses the current property value and excludes fees, interest and other security.",
      calculate: ({ ltvLoan, ltvValue }) => ({
        primary: percent(ltvLoan, ltvValue),
        detail: `${money(ltvLoan)} loan against ${money(ltvValue)} value.`,
      }),
    },
    {
      id: "ltc",
      legacy: "calcLTC",
      title: "LTC",
      groups: ["finance", "development"],
      resultId: "ltcResult",
      inputs: [
        field("ltcLoan", "Loan", { min: 0, example: 600000 }),
        field("ltcCost", "Total Cost", {
          min: 0,
          exclusiveMin: true,
          example: 900000,
        }),
      ],
      formula: "Loan ÷ Total Cost × 100",
      assumptions:
        "Total cost should include acquisition and development costs relevant to the facility.",
      calculate: ({ ltcLoan, ltcCost }) => ({
        primary: percent(ltcLoan, ltcCost),
        detail: `${money(ltcLoan)} funded against ${money(ltcCost)} total cost.`,
      }),
    },
    {
      id: "ltgdv",
      legacy: "calcLTGDV",
      title: "LTGDV",
      groups: ["finance", "development"],
      resultId: "ltgdvResult",
      inputs: [
        field("ltgdvLoan", "Loan", { min: 0, example: 750000 }),
        field("ltgdvValue", "GDV", {
          min: 0,
          exclusiveMin: true,
          example: 1250000,
        }),
      ],
      formula: "Loan ÷ Gross Development Value × 100",
      assumptions:
        "GDV is the estimated completed value before sales costs and taxation.",
      calculate: ({ ltgdvLoan, ltgdvValue }) => ({
        primary: percent(ltgdvLoan, ltgdvValue),
        detail: `${money(ltgdvLoan)} loan against ${money(ltgdvValue)} GDV.`,
      }),
    },
    {
      id: "roi",
      legacy: "calcROI",
      title: "ROI",
      groups: ["development", "property"],
      resultId: "roiResult",
      inputs: [
        field("roiProfit", "Profit", { example: 180000 }),
        field("roiCost", "Investment", {
          min: 0,
          exclusiveMin: true,
          example: 720000,
        }),
      ],
      formula: "Profit ÷ Investment × 100",
      assumptions:
        "Profit may be negative. Investment should represent the capital basis being measured.",
      calculate: ({ roiProfit, roiCost }) => ({
        primary: percent(roiProfit, roiCost),
        detail: `${money(roiProfit)} return on ${money(roiCost)} invested.`,
      }),
    },
    {
      id: "yield",
      legacy: "calcYield",
      title: "Rental Yield",
      groups: ["property"],
      resultId: "yieldResult",
      inputs: [
        field("yieldRent", "Annual Rent", { min: 0, example: 60000 }),
        field("yieldValue", "Property Value", {
          min: 0,
          exclusiveMin: true,
          example: 1000000,
        }),
      ],
      formula: "Annual Rent ÷ Property Value × 100",
      assumptions:
        "Shows gross yield before voids, operating costs, finance and taxation.",
      calculate: ({ yieldRent, yieldValue }) => ({
        primary: percent(yieldRent, yieldValue),
        detail: `${money(yieldRent)} annual rent on ${money(yieldValue)} value.`,
      }),
    },
    {
      id: "development-profit",
      legacy: "calcDevProfit",
      title: "Development Profit",
      groups: ["development"],
      resultId: "devResult",
      inputs: [
        field("devGdv", "GDV", { min: 0, example: 1500000 }),
        field("devCost", "Total Development Cost", {
          min: 0,
          exclusiveMin: true,
          example: 1200000,
        }),
      ],
      formula: "GDV − Total Development Cost; Profit ÷ Cost × 100",
      assumptions:
        "Excludes any cost or tax not already included in total development cost.",
      calculate: ({ devGdv, devCost }) => {
        const { profit } = model.developmentProfit(devGdv, devCost);
        return {
          primary: `${money(profit)} | ${percent(profit, devCost)} on cost`,
          detail: `Projected value ${money(devGdv)} less total cost ${money(devCost)}.`,
        };
      },
    },
    {
      id: "monthly-payment",
      legacy: "calcMonthly",
      title: "Monthly Loan Payment",
      groups: ["finance"],
      resultId: "loanResult",
      inputs: [
        field("loanPrincipal", "Loan", { min: 0, example: 500000 }),
        field("loanRate", "Annual Interest %", { min: 0, example: 6.5 }),
        field("loanYears", "Term Years", {
          min: 0,
          exclusiveMin: true,
          example: 20,
        }),
      ],
      formula: "P × r × (1+r)ⁿ ÷ ((1+r)ⁿ−1)",
      assumptions:
        "Assumes a fully amortising repayment loan with a fixed rate and monthly payments.",
      calculate: ({ loanPrincipal, loanRate, loanYears }) => {
        const months = loanYears * 12,
          payment = model.monthlyPayment(loanPrincipal, loanRate, loanYears);
        return {
          primary: money(payment),
          detail: `Monthly payment across ${number(months)} months at ${number(loanRate)}% annually.`,
        };
      },
    },
    {
      id: "arrangement-fee",
      legacy: "calcFee",
      title: "Arrangement Fee",
      groups: ["finance"],
      resultId: "feeResult",
      inputs: [
        field("feeLoan", "Loan", { min: 0, example: 750000 }),
        field("feeRate", "Fee %", { min: 0, example: 1.5 }),
      ],
      formula: "Loan × Fee Percentage",
      assumptions:
        "Assumes the fee is charged against the full entered loan amount.",
      calculate: ({ feeLoan, feeRate }) => ({
        primary: money(model.arrangementFee(feeLoan, feeRate)),
        detail: `${number(feeRate)}% of a ${money(feeLoan)} facility.`,
      }),
    },
    {
      id: "interest-rollup",
      legacy: "calcRollup",
      title: "Interest Roll-up",
      groups: ["finance", "development"],
      resultId: "rollResult",
      inputs: [
        field("rollLoan", "Loan", { min: 0, example: 800000 }),
        field("rollRate", "Annual Interest %", { min: 0, example: 9 }),
        field("rollMonths", "Months", {
          min: 0,
          exclusiveMin: true,
          example: 18,
        }),
      ],
      formula: "Loan × Annual Rate × Months ÷ 12",
      assumptions:
        "Uses simple interest on a constant balance; it does not compound or model drawdowns.",
      calculate: ({ rollLoan, rollRate, rollMonths }) => ({
        primary: money(model.interestRollup(rollLoan, rollRate, rollMonths)),
        detail: `Simple interest over ${number(rollMonths)} months at ${number(rollRate)}% annually.`,
      }),
    },
    {
      id: "concrete",
      legacy: "calcConcrete",
      title: "Concrete Volume",
      groups: ["construction"],
      resultId: "cResult",
      inputs: [
        field("cLen", "Length m", { min: 0, exclusiveMin: true, example: 8 }),
        field("cWid", "Width m", { min: 0, exclusiveMin: true, example: 4 }),
        field("cDep", "Depth m", { min: 0, exclusiveMin: true, example: 0.15 }),
      ],
      formula: "Length × Width × Depth",
      assumptions:
        "All dimensions must be entered in metres; no waste allowance is included.",
      calculate: ({ cLen, cWid, cDep }) => {
        const volume = model.concrete(cLen, cWid, cDep);
        return {
          primary: `${volume.toFixed(2)} m³`,
          detail: `Volume for ${number(cLen)}m × ${number(cWid)}m × ${number(cDep)}m.`,
        };
      },
    },
    {
      id: "paint",
      legacy: "calcPaint",
      title: "Paint Area",
      groups: ["construction"],
      resultId: "pResult",
      inputs: [
        field("pLen", "Wall Length m", {
          min: 0,
          exclusiveMin: true,
          example: 12,
        }),
        field("pHeight", "Wall Height m", {
          min: 0,
          exclusiveMin: true,
          example: 2.4,
        }),
        field("pCoats", "Number of Coats", {
          min: 0,
          exclusiveMin: true,
          integer: true,
          default: 2,
          example: 2,
        }),
      ],
      formula: "Wall Length × Wall Height × Number of Coats",
      assumptions: "Openings and product coverage rates are not deducted.",
      calculate: ({ pLen, pHeight, pCoats }) => {
        const area = model.paint(pLen, pHeight, pCoats);
        return {
          primary: `${area.toFixed(2)} m² total coating area`,
          detail: `${number(pCoats)} coats across ${number(pLen * pHeight)} m² of wall.`,
        };
      },
    },
    {
      id: "flooring",
      legacy: "calcFloor",
      title: "Flooring Area",
      groups: ["construction"],
      resultId: "fResult",
      inputs: [
        field("fLen", "Length m", { min: 0, exclusiveMin: true, example: 8 }),
        field("fWid", "Width m", { min: 0, exclusiveMin: true, example: 5 }),
        field("fWaste", "Waste %", { min: 0, default: 10, example: 10 }),
      ],
      formula: "Length × Width × (1 + Waste Percentage)",
      assumptions:
        "Uses a single rectangular floor area and applies waste to the whole area.",
      calculate: ({ fLen, fWid, fWaste }) => {
        const area = model.flooring(fLen, fWid, fWaste);
        return {
          primary: `${area.toFixed(2)} m² incl. waste`,
          detail: `Base area ${number(fLen * fWid)} m² plus ${number(fWaste)}% waste.`,
        };
      },
    },
    {
      id: "plasterboard",
      legacy: "calcPB",
      title: "Plasterboard Sheets",
      groups: ["construction"],
      resultId: "pbResult",
      inputs: [
        field("pbArea", "Wall Area m²", {
          min: 0,
          exclusiveMin: true,
          example: 85,
        }),
        field("pbSheet", "Sheet Area m²", {
          min: 0,
          exclusiveMin: true,
          default: 2.88,
          example: 2.88,
        }),
        field("pbWaste", "Waste %", { min: 0, default: 10, example: 10 }),
      ],
      formula: "Area × (1 + Waste Percentage) ÷ Sheet Area, rounded up",
      assumptions:
        "Rounds up to whole sheets and does not optimise the cutting layout.",
      calculate: ({ pbArea, pbSheet, pbWaste }) => {
        const sheets = model.plasterboard(pbArea, pbSheet, pbWaste);
        return {
          primary: `${sheets} sheets`,
          detail: `For ${number(pbArea)} m² plus ${number(pbWaste)}% waste using ${number(pbSheet)} m² sheets.`,
        };
      },
    },
    {
      id: "insulation",
      legacy: "calcIns",
      title: "Insulation Area",
      groups: ["construction"],
      resultId: "insResult",
      inputs: [
        field("insArea", "Wall/Ceiling Area m²", {
          min: 0,
          exclusiveMin: true,
          example: 100,
        }),
        field("insWaste", "Waste %", { min: 0, default: 5, example: 5 }),
      ],
      formula: "Area × (1 + Waste Percentage)",
      assumptions:
        "Returns coverage area only; board, roll or pack quantities depend on the selected product.",
      calculate: ({ insArea, insWaste }) => {
        const area = model.insulation(insArea, insWaste);
        return {
          primary: `${area.toFixed(2)} m² incl. waste`,
          detail: `${number(insArea)} m² base area plus ${number(insWaste)}% waste.`,
        };
      },
    },
    {
      id: "tiles",
      legacy: "calcTiles",
      title: "Tiles Quantity",
      groups: ["construction"],
      resultId: "tileResult",
      inputs: [
        field("tileArea", "Total Area m²", {
          min: 0,
          exclusiveMin: true,
          example: 35,
        }),
        field("tileSize", "Tile Area m²", {
          min: 0,
          exclusiveMin: true,
          default: 0.09,
          example: 0.09,
        }),
        field("tileWaste", "Waste %", { min: 0, default: 10, example: 10 }),
      ],
      formula: "Area × (1 + Waste Percentage) ÷ Tile Area, rounded up",
      assumptions:
        "Rounds up to whole tiles and does not account for box quantities or pattern matching.",
      calculate: ({ tileArea, tileSize, tileWaste }) => {
        const tiles = model.tiles(tileArea, tileSize, tileWaste);
        return {
          primary: `${tiles} tiles`,
          detail: `For ${number(tileArea)} m² plus ${number(tileWaste)}% waste using ${number(tileSize)} m² tiles.`,
        };
      },
    },
  ];

  const byId = new Map(
    configurations.map((configuration) => [configuration.id, configuration]),
  );
  const configText = (configuration, key) =>
    choose(configuration[key], trConfig[configuration.id]?.[key]);
  const fieldLabel = (configuration, definition) =>
    choose(
      definition.label,
      trConfig[configuration.id]?.labels?.[definition.id],
    );
  function displayResult(configuration, result) {
    if (!isTurkish()) return { primary: result.primary, detail: result.detail };
    const primary = result.primary
      .replace(" on cost", " maliyet üzerinden")
      .replace(" total coating area", " toplam boya alanı")
      .replace(" incl. waste", " fire dahil")
      .replace(" sheets", " levha")
      .replace(" tiles", " karo");
    return {
      primary,
      detail: `${configText(configuration, "title")} sonucu, girilen değerler ve belirtilen formül kullanılarak hesaplandı.`,
    };
  }

  function inputError(input, message) {
    input.setAttribute("aria-invalid", message ? "true" : "false");
    const error = document.getElementById(`${input.id}Error`);
    if (error) error.textContent = message || "";
  }

  function readConfiguration(configuration) {
    const values = {};
    const errors = [];
    for (const definition of configuration.inputs) {
      const input = document.getElementById(definition.id);
      if (!input) continue;
      const raw = String(input.value).trim();
      let message = "";
      let value = Number(raw);
      if (definition.required && !raw)
        message = choose(
          `Enter ${definition.label.toLowerCase()}.`,
          `${fieldLabel(configuration, definition)} girin.`,
        );
      else if (!Number.isFinite(value))
        message = choose("Enter a valid number.", "Geçerli bir sayı girin.");
      else if (definition.exclusiveMin && value <= definition.min)
        message = choose(
          `Must be greater than ${definition.min}.`,
          `${definition.min} değerinden büyük olmalıdır.`,
        );
      else if (definition.min !== undefined && value < definition.min)
        message = choose(
          `Must be ${definition.min} or more.`,
          `${definition.min} veya daha büyük olmalıdır.`,
        );
      else if (definition.integer && !Number.isInteger(value))
        message = choose("Enter a whole number.", "Tam sayı girin.");
      inputError(input, message);
      if (message) errors.push({ input, message });
      else values[definition.id] = value;
    }
    return { values, errors };
  }

  function calculatorSummary(configuration, result) {
    const lines = [configText(configuration, "title")];
    configuration.inputs.forEach((definition) => {
      const input = document.getElementById(definition.id);
      lines.push(
        `${fieldLabel(configuration, definition)}: ${input ? input.value : ""}`,
      );
    });
    lines.push(
      `${choose("Result", "Sonuç")}: ${result.primary}`,
      result.detail,
      `${choose("Formula", "Formül")}: ${configText(configuration, "formula")}`,
      `${choose("Assumption", "Varsayım")}: ${configText(configuration, "assumptions")}`,
    );
    return lines.join("\n");
  }

  function calculate(id) {
    const configuration = byId.get(id);
    if (!configuration)
      return {
        valid: false,
        errors: [
          { message: choose("Unknown calculator.", "Bilinmeyen hesaplayıcı.") },
        ],
      };
    const resultElement = document.getElementById(configuration.resultId);
    const detailElement = document.getElementById(`${configuration.id}Detail`);
    const actions = document.getElementById(`${configuration.id}ResultActions`);
    const { values, errors } = readConfiguration(configuration);
    if (errors.length) {
      if (resultElement)
        resultElement.textContent = choose(
          "Check highlighted fields.",
          "İşaretli alanları kontrol edin.",
        );
      if (detailElement) detailElement.textContent = "";
      if (actions) actions.hidden = true;
      errors[0].input?.focus();
      return { valid: false, errors };
    }
    const rawResult = configuration.calculate(values),
      result = displayResult(configuration, rawResult);
    if (resultElement) resultElement.textContent = result.primary;
    if (detailElement) detailElement.textContent = result.detail;
    if (actions) actions.hidden = false;
    const complete = {
      valid: true,
      values,
      ...result,
      summary: calculatorSummary(configuration, result),
    };
    lastResults.set(id, complete);
    return complete;
  }

  function useExample(id) {
    const configuration = byId.get(id);
    if (!configuration) return;
    configuration.inputs.forEach((definition) => {
      const input = document.getElementById(definition.id);
      if (input) input.value = definition.example;
    });
    calculate(id);
  }

  function resetCalculator(id) {
    const configuration = byId.get(id);
    if (!configuration) return;
    configuration.inputs.forEach((definition) => {
      const input = document.getElementById(definition.id);
      if (input) input.value = definition.default ?? "";
      if (input) inputError(input, "");
    });
    const result = document.getElementById(configuration.resultId);
    const detail = document.getElementById(`${id}Detail`);
    const actions = document.getElementById(`${id}ResultActions`);
    if (result) result.textContent = "";
    if (detail) detail.textContent = "";
    if (actions) actions.hidden = true;
    lastResults.delete(id);
  }

  function invalidateCalculator(configuration) {
    lastResults.delete(configuration.id);
    const result = document.getElementById(configuration.resultId);
    const detail = document.getElementById(`${configuration.id}Detail`);
    const actions = document.getElementById(`${configuration.id}ResultActions`);
    if (result) result.textContent = "";
    if (detail) detail.textContent = "";
    if (actions) actions.hidden = true;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.className = "clipboard-proxy";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand?.("copy") || false;
    textarea.remove();
    return copied;
  }

  function acknowledge(button, message) {
    if (!button) return;
    const original = button.textContent;
    button.textContent = message;
    global.setTimeout(() => {
      button.textContent = original;
    }, 1400);
  }

  async function shareText(title, text, button) {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
    await copyText(text);
    acknowledge(button, choose("Copied", "Kopyalandı"));
  }

  function enhanceCalculator(configuration) {
    const firstInput = document.getElementById(configuration.inputs[0].id);
    const card = firstInput?.closest(".calc");
    if (!card || card.dataset.workspaceReady) return;
    card.dataset.workspaceReady = "true";
    card.dataset.calculatorId = configuration.id;
    card.dataset.calculatorGroups = configuration.groups.join(" ");
    configuration.inputs.forEach((definition) => {
      const input = document.getElementById(definition.id);
      if (!input) return;
      const label = input.previousElementSibling;
      if (label?.tagName === "LABEL") label.htmlFor = definition.id;
      if (definition.min !== undefined)
        input.min = definition.exclusiveMin
          ? "0.0000001"
          : String(definition.min);
      input.step = definition.integer ? "1" : definition.step;
      const error = document.createElement("span");
      error.id = `${definition.id}Error`;
      error.className = "field-error";
      error.setAttribute("aria-live", "polite");
      input.insertAdjacentElement("afterend", error);
      input.setAttribute("aria-describedby", error.id);
      input.addEventListener("input", () => {
        inputError(input, "");
        invalidateCalculator(configuration);
      });
    });
    const result = document.getElementById(configuration.resultId);
    if (result) result.setAttribute("aria-live", "polite");
    card.insertAdjacentHTML(
      "beforeend",
      `<div id="${configuration.id}Detail" class="calc-result-detail"></div><div id="${configuration.id}ResultActions" class="calc-result-actions" hidden><button type="button" data-calc-action="copy"></button><button type="button" data-calc-action="share"></button></div><div class="calc-meta" id="${configuration.id}Meta"></div><div class="calc-secondary-actions"><button type="button" data-calc-action="example"></button><button type="button" data-calc-action="reset"></button></div>`,
    );
    card.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-calc-action]");
      if (!button) return;
      const action = button.dataset.calcAction;
      if (action === "example") useExample(configuration.id);
      if (action === "reset") resetCalculator(configuration.id);
      if (action === "copy") {
        const result =
          lastResults.get(configuration.id) || calculate(configuration.id);
        if (result.valid) {
          await copyText(result.summary);
          acknowledge(button, choose("Copied", "Kopyalandı"));
        }
      }
      if (action === "share") {
        const result =
          lastResults.get(configuration.id) || calculate(configuration.id);
        if (result.valid)
          await shareText(
            configText(configuration, "title"),
            result.summary,
            button,
          );
      }
    });
    refreshCalculatorLanguage(configuration);
  }

  function refreshCalculatorLanguage(configuration) {
    const firstInput = document.getElementById(configuration.inputs[0].id),
      card = firstInput?.closest(".calc");
    if (!card) return;
    const heading = card.querySelector?.("h3");
    if (heading) heading.textContent = configText(configuration, "title");
    configuration.inputs.forEach((definition) => {
      const input = document.getElementById(definition.id),
        label = input?.previousElementSibling;
      if (label?.childNodes[0])
        label.childNodes[0].nodeValue = fieldLabel(configuration, definition);
    });
    const calculateButton = card.querySelector?.("[data-calculate]");
    if (calculateButton)
      calculateButton.textContent = choose("Calculate", "Hesapla");
    const meta = document.getElementById(`${configuration.id}Meta`);
    if (meta)
      meta.innerHTML = `<strong>${choose("Formula", "Formül")}:</strong> ${escapeHtml(configText(configuration, "formula"))}<br><strong>${choose("Assumption", "Varsayım")}:</strong> ${escapeHtml(configText(configuration, "assumptions"))}`;
    const labels = {
      copy: choose("Copy result", "Sonucu kopyala"),
      share: choose("Share result", "Sonucu paylaş"),
      example: choose("Use example", "Örneği kullan"),
      reset: choose("Reset", "Sıfırla"),
    };
    card.querySelectorAll?.("[data-calc-action]").forEach((button) => {
      button.textContent = labels[button.dataset.calcAction];
    });
  }

  function initializeFilters() {
    const buttons = [...document.querySelectorAll("[data-calculator-filter]")];
    const cards = [...document.querySelectorAll("#page-calculators .calc")];
    buttons.forEach((button) =>
      button.addEventListener("click", () => {
        const filter = button.dataset.calculatorFilter;
        buttons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        cards.forEach((card) => {
          const groups = (card.dataset.calculatorGroups || "").split(" ");
          card.hidden = filter !== "all" && !groups.includes(filter);
        });
      }),
    );
    buttons.forEach((button, index) =>
      button.setAttribute("aria-pressed", String(index === 0)),
    );
  }

  const snapshotFields = [
    {
      id: "dealLoan",
      label: "Loan",
      labelTr: "Kredi",
      min: 0,
      example: 700000,
    },
    {
      id: "dealPropertyValue",
      label: "Property value",
      labelTr: "Gayrimenkul değeri",
      min: 0,
      exclusiveMin: true,
      example: 1000000,
    },
    {
      id: "dealCost",
      label: "Total development cost",
      labelTr: "Toplam geliştirme maliyeti",
      min: 0,
      exclusiveMin: true,
      example: 900000,
    },
    {
      id: "dealGdv",
      label: "Gross development value",
      labelTr: "Brüt geliştirme değeri",
      min: 0,
      exclusiveMin: true,
      example: 1250000,
    },
    {
      id: "dealRent",
      label: "Annual rent",
      labelTr: "Yıllık kira",
      min: 0,
      example: 60000,
    },
  ];

  function readSnapshot() {
    const inputs = {
      dealName: document.getElementById("dealName")?.value.trim() || "",
    };
    const errors = [];
    snapshotFields.forEach((definition) => {
      const input = document.getElementById(definition.id);
      const raw = String(input?.value || "").trim();
      const value = Number(raw);
      let message = "";
      if (!raw)
        message = choose(
          `Enter ${definition.label.toLowerCase()}.`,
          `${definition.labelTr} girin.`,
        );
      else if (!Number.isFinite(value))
        message = choose("Enter a valid number.", "Geçerli bir sayı girin.");
      else if (definition.exclusiveMin && value <= definition.min)
        message = choose(
          `Must be greater than ${definition.min}.`,
          `${definition.min} değerinden büyük olmalıdır.`,
        );
      else if (value < definition.min)
        message = choose(
          `Must be ${definition.min} or more.`,
          `${definition.min} veya daha büyük olmalıdır.`,
        );
      if (input) inputError(input, message);
      if (message) errors.push({ input, message });
      else inputs[definition.id] = value;
    });
    return { inputs, errors };
  }

  function snapshotSummary(snapshot) {
    const { inputs, metrics } = snapshot;
    return [
      inputs.dealName || choose("EMCP Deal Snapshot", "EMCP İşlem Özeti"),
      `${choose("Loan", "Kredi")}: ${money(inputs.dealLoan)}`,
      `${choose("Property value", "Gayrimenkul değeri")}: ${money(inputs.dealPropertyValue)}`,
      `${choose("Total development cost", "Toplam geliştirme maliyeti")}: ${money(inputs.dealCost)}`,
      `GDV: ${money(inputs.dealGdv)}`,
      `${choose("Annual rent", "Yıllık kira")}: ${money(inputs.dealRent)}`,
      `LTV: ${metrics.ltv}`,
      `LTC: ${metrics.ltc}`,
      `LTGDV: ${metrics.ltgdv}`,
      `${choose("Development profit", "Geliştirme kârı")}: ${metrics.profit}`,
      `${choose("Profit on cost", "Maliyet üzerinden kâr")}: ${metrics.returnOnCost}`,
      `${choose("Gross rental yield", "Brüt kira getirisi")}: ${metrics.rentalYield}`,
      `${choose("Equity requirement", "Öz sermaye ihtiyacı")}: ${metrics.equity}`,
    ].join("\n");
  }

  function calculateSnapshot() {
    const { inputs, errors } = readSnapshot();
    const errorsElement = document.getElementById("dealErrors");
    if (errors.length) {
      if (errorsElement)
        errorsElement.textContent = choose(
          "Complete the highlighted fields to calculate this snapshot.",
          "Bu özeti hesaplamak için işaretli alanları doldurun.",
        );
      document.getElementById("dealResultActions").hidden = true;
      errors[0].input?.focus();
      return { valid: false, errors };
    }
    if (errorsElement) errorsElement.textContent = "";
    const values = model.snapshot(inputs);
    const metrics = {
      ltv: values.ltv === null ? "—" : `${values.ltv.toFixed(2)}%`,
      ltc: values.ltc === null ? "—" : `${values.ltc.toFixed(2)}%`,
      ltgdv: values.ltgdv === null ? "—" : `${values.ltgdv.toFixed(2)}%`,
      profit: money(values.profit),
      returnOnCost:
        values.returnOnCost === null
          ? "—"
          : `${values.returnOnCost.toFixed(2)}%`,
      rentalYield:
        values.rentalYield === null ? "—" : `${values.rentalYield.toFixed(2)}%`,
      equity: money(values.equity),
    };
    currentSnapshot = { valid: true, inputs, metrics };
    currentSnapshot.summary = snapshotSummary(currentSnapshot);
    const results = document.getElementById("dealResults");
    if (results)
      results.innerHTML = [
        ["LTV", metrics.ltv],
        ["LTC", metrics.ltc],
        ["LTGDV", metrics.ltgdv],
        [choose("Development profit", "Geliştirme kârı"), metrics.profit],
        [
          choose("Profit on cost", "Maliyet üzerinden kâr"),
          metrics.returnOnCost,
        ],
        [
          choose("Gross rental yield", "Brüt kira getirisi"),
          metrics.rentalYield,
        ],
        [choose("Equity requirement", "Öz sermaye ihtiyacı"), metrics.equity],
      ]
        .map(
          ([label, value]) =>
            `<div class="snapshot-metric"><span>${label}</span><strong>${value}</strong></div>`,
        )
        .join("");
    document.getElementById("dealResultActions").hidden = false;
    return currentSnapshot;
  }

  function scenarioId() {
    return (
      global.crypto?.randomUUID?.() ||
      `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
  function getScenarios() {
    return storage.get(SCENARIO_STORAGE_KEY, [], core.schemas.scenarios);
  }
  function setScenarios(scenarios) {
    const valid = core.schemas.scenarios(scenarios);
    storage.set(SCENARIO_STORAGE_KEY, valid);
    global.dispatchEvent?.(
      new CustomEvent("emcp:scenarioschange", {
        detail: { count: valid.length },
      }),
    );
  }

  function scenarioName(inputs) {
    return (
      inputs.dealName ||
      `${choose("Deal", "İşlem")} ${new Date().toLocaleDateString(isTurkish() ? "tr-TR" : "en-GB")}`
    );
  }

  function saveScenario() {
    const snapshot = calculateSnapshot();
    if (!snapshot.valid) return snapshot;
    const now = new Date().toISOString();
    const scenarios = getScenarios();
    const existingIndex = scenarios.findIndex(
      (scenario) => scenario.id === activeScenarioId,
    );
    const scenario = {
      id: activeScenarioId || scenarioId(),
      name: scenarioName(snapshot.inputs),
      inputs: snapshot.inputs,
      createdAt: existingIndex >= 0 ? scenarios[existingIndex].createdAt : now,
      updatedAt: now,
    };
    if (existingIndex >= 0) scenarios[existingIndex] = scenario;
    else scenarios.unshift(scenario);
    activeScenarioId = scenario.id;
    setScenarios(scenarios);
    renderScenarios();
    const button = document.getElementById("saveDeal");
    if (button) {
      button.textContent = choose("Update scenario", "Senaryoyu güncelle");
      acknowledge(button, choose("Saved", "Kaydedildi"));
    }
    return { valid: true, scenario };
  }

  function loadScenario(id) {
    const scenario = getScenarios().find((item) => item.id === id);
    if (!scenario) return false;
    Object.entries(scenario.inputs || {}).forEach(([key, value]) => {
      const input = document.getElementById(key);
      if (input) input.value = value;
    });
    activeScenarioId = id;
    const saveButton = document.getElementById("saveDeal");
    if (saveButton)
      saveButton.textContent = choose("Update scenario", "Senaryoyu güncelle");
    calculateSnapshot();
    global.EMCPAccessibility?.scrollIntoView(
      document.getElementById("dealSnapshotTitle"),
      { block: "start" },
    );
    return true;
  }

  function duplicateScenario(id) {
    const scenarios = getScenarios();
    const source = scenarios.find((item) => item.id === id);
    if (!source) return false;
    const now = new Date().toISOString();
    const copyName = `${source.name} ${choose("(Copy)", "(Kopya)")}`;
    scenarios.unshift({
      ...source,
      id: scenarioId(),
      name: copyName,
      inputs: { ...source.inputs, dealName: copyName },
      createdAt: now,
      updatedAt: now,
    });
    setScenarios(scenarios);
    renderScenarios();
    return true;
  }

  function deleteScenario(id) {
    const scenario = getScenarios().find((item) => item.id === id);
    if (!scenario) return false;
    if (
      global.confirm &&
      !global.confirm(
        choose(`Delete “${scenario.name}”?`, `“${scenario.name}” silinsin mi?`),
      )
    )
      return false;
    setScenarios(getScenarios().filter((item) => item.id !== id));
    if (activeScenarioId === id) {
      activeScenarioId = null;
      const button = document.getElementById("saveDeal");
      if (button)
        button.textContent = choose("Save scenario", "Senaryoyu kaydet");
    }
    renderScenarios();
    return true;
  }

  function renderScenarios() {
    const list = document.getElementById("savedScenarioList");
    if (!list) return;
    const scenarios = getScenarios().sort((left, right) =>
      String(right.updatedAt).localeCompare(String(left.updatedAt)),
    );
    if (!scenarios.length) {
      list.innerHTML = `<p class="scenario-empty">${choose("No saved scenarios yet.", "Henüz kayıtlı senaryo yok.")}</p>`;
      return;
    }
    list.innerHTML = scenarios
      .map(
        (scenario) =>
          `<article class="scenario-item"><div><strong>${escapeHtml(scenario.name)}</strong><span>${choose("Updated", "Güncellendi")} ${escapeHtml(new Date(scenario.updatedAt).toLocaleString(isTurkish() ? "tr-TR" : "en-GB"))}</span></div><div class="scenario-actions"><button type="button" data-scenario-action="open" data-scenario-id="${scenario.id}">${choose("Open", "Aç")}</button><button type="button" data-scenario-action="duplicate" data-scenario-id="${scenario.id}">${choose("Duplicate", "Çoğalt")}</button><button type="button" class="danger" data-scenario-action="delete" data-scenario-id="${scenario.id}">${choose("Delete", "Sil")}</button></div></article>`,
      )
      .join("");
  }

  function resetSnapshot() {
    document.getElementById("dealName").value = "";
    snapshotFields.forEach((definition) => {
      const input = document.getElementById(definition.id);
      if (input) {
        input.value = "";
        inputError(input, "");
      }
    });
    document.getElementById("dealErrors").textContent = "";
    document.getElementById("dealResults").innerHTML = "";
    document.getElementById("dealResultActions").hidden = true;
    document.getElementById("saveDeal").textContent = choose(
      "Save scenario",
      "Senaryoyu kaydet",
    );
    activeScenarioId = null;
    currentSnapshot = null;
  }

  function useSnapshotExample() {
    document.getElementById("dealName").value = choose(
      "Nottingham development example",
      "Nottingham geliştirme örneği",
    );
    snapshotFields.forEach((definition) => {
      const input = document.getElementById(definition.id);
      if (input) input.value = definition.example;
    });
    activeScenarioId = null;
    document.getElementById("saveDeal").textContent = choose(
      "Save scenario",
      "Senaryoyu kaydet",
    );
    calculateSnapshot();
  }

  function invalidateSnapshot() {
    currentSnapshot = null;
    const results = document.getElementById("dealResults");
    const actions = document.getElementById("dealResultActions");
    if (results) results.innerHTML = "";
    if (actions) actions.hidden = true;
  }

  function initializeSnapshot() {
    if (!document.getElementById("calculateDeal")) return;
    snapshotFields.forEach((definition) => {
      const input = document.getElementById(definition.id);
      const error = document.createElement("span");
      error.id = `${definition.id}Error`;
      error.className = "field-error";
      error.setAttribute("aria-live", "polite");
      input.insertAdjacentElement("afterend", error);
      input.setAttribute("aria-describedby", error.id);
      input.addEventListener("input", () => {
        inputError(input, "");
        invalidateSnapshot();
      });
    });
    document
      .getElementById("dealName")
      .addEventListener("input", invalidateSnapshot);
    document
      .getElementById("calculateDeal")
      .addEventListener("click", calculateSnapshot);
    document
      .getElementById("exampleDeal")
      .addEventListener("click", useSnapshotExample);
    document
      .getElementById("resetDeal")
      .addEventListener("click", resetSnapshot);
    document.getElementById("saveDeal").addEventListener("click", saveScenario);
    document
      .getElementById("copyDeal")
      .addEventListener("click", async (event) => {
        const snapshot = currentSnapshot || calculateSnapshot();
        if (snapshot.valid) {
          await copyText(snapshot.summary);
          acknowledge(event.currentTarget, "Copied");
        }
      });
    document
      .getElementById("shareDeal")
      .addEventListener("click", async (event) => {
        const snapshot = currentSnapshot || calculateSnapshot();
        if (snapshot.valid)
          await shareText(
            snapshot.inputs.dealName || "EMCP Deal Snapshot",
            snapshot.summary,
            event.currentTarget,
          );
      });
    document
      .getElementById("savedScenarioList")
      .addEventListener("click", (event) => {
        const button = event.target.closest("[data-scenario-action]");
        if (!button) return;
        if (button.dataset.scenarioAction === "open")
          loadScenario(button.dataset.scenarioId);
        if (button.dataset.scenarioAction === "duplicate")
          duplicateScenario(button.dataset.scenarioId);
        if (button.dataset.scenarioAction === "delete")
          deleteScenario(button.dataset.scenarioId);
      });
    renderScenarios();
  }

  function installLegacyHandlers() {
    configurations.forEach((configuration) => {
      global[configuration.legacy] = () => calculate(configuration.id);
    });
  }

  function refreshLanguage() {
    configurations.forEach(refreshCalculatorLanguage);
    [...lastResults.keys()].forEach(calculate);
    if (currentSnapshot) calculateSnapshot();
    const saveButton = document.getElementById("saveDeal");
    if (saveButton)
      saveButton.textContent = activeScenarioId
        ? choose("Update scenario", "Senaryoyu güncelle")
        : choose("Save scenario", "Senaryoyu kaydet");
    renderScenarios();
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    configurations.forEach(enhanceCalculator);
    document
      .querySelectorAll("[data-calculate]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          calculate(button.dataset.calculate),
        ),
      );
    initializeFilters();
    initializeSnapshot();
    installLegacyHandlers();
    global.addEventListener?.("emcp:languagechange", refreshLanguage);
    refreshLanguage();
  }

  const api = {
    initialize,
    calculate,
    useExample,
    resetCalculator,
    calculateSnapshot,
    saveScenario,
    loadScenario,
    duplicateScenario,
    deleteScenario,
    getScenarios,
    configurations,
  };
  global.EMCPCalculators = api;
  global.emcpCalculatorWorkspace = api;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})(window);
