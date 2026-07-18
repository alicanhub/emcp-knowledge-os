(function (global) {
  "use strict";

  const core = global.EMCPCore,
    root = document.getElementById("smartDashboard"),
    output = document.getElementById("smartDashboardGrid"),
    status = document.getElementById("smartDashboardStatus"),
    escape = core.escapeHTML,
    list = (value) => (Array.isArray(value) ? value : []),
    language = () => (document.documentElement.lang === "tr" ? "tr" : "en"),
    pick = (en, tr) => (language() === "tr" ? tr : en);
  let chaptersPromise;
  if (!root || !output || !status) return;

  const calculatorNames = {
      ltv: ["LTV Calculator", "LTV Hesaplayıcı"],
      ltc: ["LTC Calculator", "LTC Hesaplayıcı"],
      ltgdv: ["LTGDV Calculator", "LTGDV Hesaplayıcı"],
      roi: ["ROI Calculator", "ROI Hesaplayıcı"],
      yield: ["Rental Yield", "Kira Getirisi"],
      development: ["Development Profit", "Geliştirme Kârı"],
      loan: ["Monthly Loan Payment", "Aylık Kredi Ödemesi"],
      fee: ["Arrangement Fee", "Kredi Düzenleme Ücreti"],
      rollup: ["Interest Roll-up", "Birikmiş Faiz"],
      concrete: ["Concrete Volume", "Beton Hacmi"],
      paint: ["Paint Area", "Boya Alanı"],
      flooring: ["Flooring Area", "Zemin Alanı"],
      plasterboard: ["Plasterboard Sheets", "Alçıpan Levha"],
      insulation: ["Insulation Area", "Yalıtım Alanı"],
      tiles: ["Tiles Quantity", "Karo Adedi"],
    },
    calculatorTargets = {
      ltv: "ltvLoan",
      ltc: "ltcLoan",
      ltgdv: "ltgdvLoan",
      roi: "roiProfit",
      yield: "yieldRent",
      development: "devGdv",
      loan: "loanPrincipal",
      fee: "feeLoan",
      rollup: "rollLoan",
      concrete: "cLen",
      paint: "pLen",
      flooring: "fLen",
      plasterboard: "pbArea",
      insulation: "insArea",
      tiles: "tileArea",
    };

  function entryIndex(entries) {
    return new Map(
      entries.map((entry, index) => [entry.term, { entry, index }]),
    );
  }

  function knowledgeLinks(entries, terms, empty) {
    const byTerm = entryIndex(entries),
      values = terms
        .map((term) => byTerm.get(term))
        .filter(Boolean)
        .slice(0, 4);
    if (!values.length)
      return `<p class="dashboard-empty">${escape(empty)}</p>`;
    return values
      .map(
        ({ entry, index }) =>
          `<button type="button" class="dashboard-link" data-open-term="${index}"><span><strong>${escape(entry.term)}</strong><small>${escape(entry.tr)}</small></span><span aria-hidden="true">→</span></button>`,
      )
      .join("");
  }

  function suggested(entries, recent, favourites) {
    const excluded = new Set([...recent, ...favourites]),
      latest = entries.find((entry) => entry.term === recent[0]),
      sameCategory = latest
        ? entries.filter(
            (entry) => entry.cat === latest.cat && !excluded.has(entry.term),
          )
        : [];
    return [
      ...sameCategory,
      ...entries.filter((entry) => !excluded.has(entry.term)),
    ]
      .filter(
        (entry, index, values) =>
          values.findIndex((candidate) => candidate.term === entry.term) ===
          index,
      )
      .slice(0, 4)
      .map((entry) => entry.term);
  }

  function calculatorUsage() {
    const metrics = core.storage.get("emcpProductMetrics", { days: {} }),
      totals = new Map();
    Object.values(metrics.days || {}).forEach((day) => {
      Object.entries(day || {}).forEach(([key, value]) => {
        if (!key.startsWith("calculator_") || key === "calculator_complete")
          return;
        const id = key.slice(11);
        totals.set(id, (totals.get(id) || 0) + Number(value || 0));
      });
    });
    return [...totals]
      .filter(([id]) => calculatorNames[id])
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .slice(0, 4);
  }

  function calculatorLinks() {
    const usage = calculatorUsage();
    if (!usage.length)
      return `<button type="button" class="dashboard-link" data-page="calculators"><span><strong>${escape(pick("Explore calculators", "Hesaplayıcıları keşfet"))}</strong><small>${escape(pick("Your frequently used tools will appear here.", "Sık kullandığınız araçlar burada görünecek."))}</small></span><span aria-hidden="true">→</span></button>`;
    return usage
      .map(([id, count]) => {
        const title = calculatorNames[id];
        return `<button type="button" class="dashboard-link" data-calculator-target="${escape(calculatorTargets[id])}" data-calculator-page="calculators"><span><strong>${escape(pick(...title))}</strong><small>${escape(pick(`${count} uses`, `${count} kullanım`))}</small></span><span aria-hidden="true">→</span></button>`;
      })
      .join("");
  }

  async function continueLearning() {
    try {
      chaptersPromise ||= fetch("content/handbooks/investor/chapters.json", {
        credentials: "same-origin",
      }).then((response) => {
        if (!response.ok) throw new Error("chapters unavailable");
        return response.json();
      });
      const chapters = await chaptersPromise,
        lastId = core.storage.getRaw("emcpHandbookInvestorLastChapter"),
        chapter =
          chapters.find((item) => item.id === lastId) || chapters[0] || null;
      if (!chapter) return "";
      return `<button type="button" class="dashboard-feature" data-dashboard-chapter="${escape(chapter.id)}"><span class="dashboard-feature-icon" aria-hidden="true">▤</span><span><small>${escape(pick("Continue learning", "Öğrenmeye devam et"))}</small><strong>${escape(chapter.title?.[language()] || chapter.title?.en || chapter.id)}</strong><span>${escape(pick("Resume the Investor Handbook", "Yatırımcı El Kitabı'na devam et"))}</span></span><span aria-hidden="true">→</span></button>`;
    } catch {
      return "";
    }
  }

  function card(title, icon, body) {
    return `<article class="dashboard-card"><header><span aria-hidden="true">${icon}</span><h3>${escape(title)}</h3></header><div>${body}</div></article>`;
  }

  async function render() {
    const entries = global.EMCPApp?.entries || [],
      recent = list(core.storage.get("emcpRecent", [], core.stringList)),
      favourites = list(core.storage.get("emcpFav", [], core.stringList)),
      learning = await continueLearning();
    document.getElementById("smartDashboardEyebrow").textContent = pick(
      "EMCP Intelligence",
      "EMCP Zekâsı",
    );
    document.getElementById("smartDashboardTitle").textContent = pick(
      "Your dashboard",
      "Kontrol paneliniz",
    );
    document.getElementById("smartDashboardExplore").textContent = pick(
      "Explore all",
      "Tümünü keşfet",
    );
    output.innerHTML = `${learning}${card(
      pick("Recently viewed", "Yakın zamanda görüntülenenler"),
      "↺",
      knowledgeLinks(
        entries,
        recent,
        pick(
          "Open an entry to begin your history.",
          "Geçmişinizi başlatmak için bir kayıt açın.",
        ),
      ),
    )}${card(
      pick("Favourite entries", "Favori kayıtlar"),
      "★",
      knowledgeLinks(
        entries,
        favourites,
        pick(
          "Your saved entries will appear here.",
          "Kaydettiğiniz kayıtlar burada görünecek.",
        ),
      ),
    )}${card(
      pick("Suggested for you", "Sizin için önerilenler"),
      "✦",
      knowledgeLinks(
        entries,
        suggested(entries, recent, favourites),
        pick("Suggestions are being prepared.", "Öneriler hazırlanıyor."),
      ),
    )}${card(
      pick("Most used calculators", "En çok kullanılan hesaplayıcılar"),
      "∑",
      calculatorLinks(),
    )}`;
    root.setAttribute("aria-busy", "false");
    status.textContent = pick("Dashboard ready", "Kontrol paneli hazır");
  }

  root.addEventListener("click", (event) => {
    const chapter = event.target.closest("[data-dashboard-chapter]");
    if (!chapter) return;
    global.EMCPApp?.showPage?.("handbooks");
    (global.EMCPFeatures?.load("handbooks") || Promise.resolve()).then(() =>
      global.EMCPHandbook?.openChapter?.(
        chapter.dataset.dashboardChapter,
        true,
      ),
    );
  });
  global.addEventListener("emcp:workspace-change", render);
  global.EMCPPremiumDashboard = { render };
  render();
})(window);
