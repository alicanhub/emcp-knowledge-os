(function (global) {
  "use strict";

  const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);
  const text = (value, language) =>
    String(value?.[language] || value?.en || value?.tr || value || "").trim();
  const languageWords = {
    tr: new Set([
      "bir",
      "bu",
      "icin",
      "ile",
      "karsilastir",
      "nasil",
      "nedir",
      "neden",
      "ornek",
      "risk",
      "ve",
    ]),
    en: new Set([
      "and",
      "compare",
      "example",
      "for",
      "how",
      "is",
      "risk",
      "the",
      "what",
      "why",
      "with",
    ]),
  };

  function understand(question, normalize, fallbackLanguage = "en") {
    const normalized = normalize(question),
      tokens = normalized.split(" ").filter(Boolean),
      trCount = tokens.filter((token) => languageWords.tr.has(token)).length,
      enCount = tokens.filter((token) => languageWords.en.has(token)).length,
      language =
        trCount && enCount
          ? "mixed"
          : trCount
            ? "tr"
            : enCount
              ? "en"
              : fallbackLanguage,
      tests = [
        ["compare", /\b(compare|difference|versus|vs|karsilastir|fark)\b/],
        ["formula", /\b(formula|calculate|calculation|hesap|hesapla|formul)\b/],
        ["risk", /\b(risk\w*|limitation\w*|sinirlam\w*)\b/],
        ["example", /\b(example\w*|ornek\w*|scenario\w*|senaryo\w*)\b/],
        ["practical", /\b(how|use\w*|when|nasil|ne zaman|kullan\w*)\b/],
        ["definition", /\b(what|define|meaning|nedir|ne demek|tanim)\b/],
      ],
      intents = tests
        .filter(([, expression]) => expression.test(normalized))
        .map(([intent]) => intent);
    return {
      language,
      responseLanguage: language === "mixed" ? fallbackLanguage : language,
      intents: intents.length ? intents : ["overview"],
      normalized,
      tokens,
    };
  }

  function selectEvidence(results, limit = 4) {
    const valid = list(results).filter((result) => {
      const score = Number(result?._s ?? result?.score ?? 0),
        tier = Number(result?._tier ?? result?.tier ?? 0);
      return result?.entry && score > 0 && (tier >= 2 || score >= 120);
    });
    if (!valid.length) return [];
    const topScore = Number(valid[0]._s ?? valid[0].score),
      topTier = Number(valid[0]._tier ?? valid[0].tier ?? 0);
    return valid
      .filter((result, index) => {
        if (!index) return true;
        const score = Number(result._s ?? result.score),
          tier = Number(result._tier ?? result.tier ?? 0);
        return tier >= Math.max(2, topTier - 1) && score >= topScore * 0.24;
      })
      .slice(0, Math.max(1, Math.min(5, limit)));
  }

  function localizedEntry(entry, language) {
    const details = entry.details || {},
      simple = text(details.simpleExplanation, language),
      professional = text(details.professionalExplanation, language),
      definition =
        language === "tr"
          ? entry.def || simple || entry.description
          : entry.defEn || simple || entry.def || entry.description;
    return {
      title:
        language === "tr"
          ? entry.tr || entry.term || entry.title
          : entry.term || entry.title || entry.tr,
      alternateTitle: language === "tr" ? entry.term : entry.tr,
      definition: String(definition || "").trim(),
      professional,
      practical: [
        language === "tr" ? entry.use : entry.useEn || entry.use,
        text(details.siteExample, language),
        text(details.officeExample, language),
      ].find(Boolean),
      example:
        text(details.realWorldExample, language) || String(entry.example || ""),
      risks: list(details.risks?.[language] || details.risks?.en),
      formula: details.formula?.expression || "",
      formulaNotes: text(details.formula?.notes, language),
      category: entry.cat || entry.category || "",
    };
  }

  function confidenceFor(evidence, unsupported) {
    if (!evidence.length) return "low";
    const top = evidence[0],
      tier = Number(top._tier ?? top.tier ?? 0),
      score = Number(top._s ?? top.score ?? 0);
    if (!unsupported.length && (tier >= 5 || score >= 1800)) return "high";
    if (tier >= 3 || score >= 500) return "medium";
    return "low";
  }

  function compose({ question, results, normalize, language = "en" }) {
    const understanding = understand(question, normalize, language),
      responseLanguage = understanding.responseLanguage,
      evidence = selectEvidence(results),
      unsupported = [];
    if (!evidence.length)
      return {
        found: false,
        confidence: "low",
        evidence: [],
        related: [],
        unsupported: ["local-evidence"],
        understanding,
      };

    const records = evidence.map((result) => ({
        result,
        content: localizedEntry(result.entry, responseLanguage),
      })),
      paragraphs = [];
    for (const { content } of records) {
      const parts = [];
      if (content.definition) parts.push(content.definition);
      if (
        understanding.intents.includes("practical") &&
        content.practical &&
        content.practical !== content.definition
      )
        parts.push(content.practical);
      if (understanding.intents.includes("example") && content.example)
        parts.push(content.example);
      if (understanding.intents.includes("risk") && content.risks.length)
        parts.push(content.risks.join(" "));
      if (understanding.intents.includes("formula") && content.formula)
        parts.push(
          `${content.formula}${content.formulaNotes ? ` — ${content.formulaNotes}` : ""}`,
        );
      if (parts.length) paragraphs.push({ title: content.title, parts });
    }

    for (const intent of understanding.intents) {
      if (
        intent === "formula" &&
        !records.some(({ content }) => content.formula)
      )
        unsupported.push("formula");
      if (
        intent === "example" &&
        !records.some(({ content }) => content.example)
      )
        unsupported.push("example");
      if (
        intent === "risk" &&
        !records.some(({ content }) => content.risks.length)
      )
        unsupported.push("risk");
    }
    if (!paragraphs.length) unsupported.push("answer");

    return {
      found: paragraphs.length > 0,
      confidence: confidenceFor(evidence, unsupported),
      evidence,
      paragraphs,
      unsupported,
      understanding,
    };
  }

  global.EMCPAssistantEngine = {
    understand,
    selectEvidence,
    compose,
  };
})(typeof self !== "undefined" ? self : window);
