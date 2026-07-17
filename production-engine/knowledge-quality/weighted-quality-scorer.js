import * as fs from "node:fs/promises";
import * as path from "node:path";

export const DEFAULT_QUALITY_WEIGHTS = Object.freeze({
  completeness: 18,
  evidenceCoverage: 16,
  citationQuality: 14,
  bilingualConsistency: 14,
  readability: 10,
  reviewFreshness: 10,
  relationshipQuality: 8,
  calculatorIntegration: 5,
  mediaReadiness: 5,
});
const CATEGORIES = Object.keys(DEFAULT_QUALITY_WEIGHTS);
const REQUIRED_FIELDS = [
  "id",
  "title",
  "summary",
  "simple_explanation",
  "professional_explanation",
  "definition",
  "real_world_example",
  "site_example",
  "office_example",
  "interview_questions",
  "category",
  "subcategory",
  "aliases",
  "keywords",
  "formula",
  "worked_example",
  "when_to_use",
  "use_cases",
  "risks",
  "common_mistakes",
  "practical_tips",
  "best_practice",
  "uk_practice",
  "turkey_practice",
  "related_concepts",
  "related_calculators",
  "related_documents",
  "related_standards",
  "related_regulations",
  "frequently_asked_questions",
  "visual_illustration",
  "future_video",
  "jurisdiction",
  "sources",
  "revision_history",
  "review_status",
  "content_version",
];
const BILINGUAL_FIELDS = [
  "title",
  "summary",
  "simple_explanation",
  "professional_explanation",
  "definition",
  "real_world_example",
  "site_example",
  "office_example",
  "worked_example",
  "when_to_use",
  "use_cases",
  "risks",
  "common_mistakes",
  "practical_tips",
  "best_practice",
  "uk_practice",
  "turkey_practice",
  "frequently_asked_questions",
];

export class KnowledgeQualityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "KnowledgeQualityError";
    this.code = code;
  }
}
const clamp = (value) => Math.max(0, Math.min(100, value));
const rounded = (value) => Number(value.toFixed(1));
const researchRequired = (value) =>
  /research (?:and professional review )?(?:is|are) required|araştırması (?:ve uzman incelemesi )?gereklidir|research required/i.test(
    JSON.stringify(value || ""),
  );
const nonEmpty = (value) => {
  if (value === null) return true;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return true;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined;
};
const text = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join(" ")
    : String(value || "");

export class WeightedKnowledgeQualityScorer {
  #weights;
  #clock;
  #reviewFreshDays;

  /** @param {any} options */
  constructor(options = {}) {
    this.#weights = { ...DEFAULT_QUALITY_WEIGHTS, ...(options.weights || {}) };
    if (
      CATEGORIES.some(
        (category) =>
          !Number.isFinite(this.#weights[category]) ||
          this.#weights[category] < 0,
      ) ||
      Object.values(this.#weights).reduce((sum, value) => sum + value, 0) !==
        100
    )
      throw new KnowledgeQualityError(
        "invalid-weights",
        "Quality weights must be non-negative and total 100.",
      );
    this.#clock = options.clock || (() => new Date());
    this.#reviewFreshDays = options.reviewFreshDays ?? 365;
  }

  score(entry, context = {}) {
    if (!entry?.id || typeof entry.id !== "string")
      throw new KnowledgeQualityError(
        "invalid-entry",
        "Knowledge Entry v2 id is required.",
      );
    const raw = {
      completeness: this.#completeness(entry),
      evidenceCoverage: this.#evidence(entry, context),
      citationQuality: this.#citations(entry),
      bilingualConsistency: this.#bilingual(entry),
      readability: this.#readability(entry),
      reviewFreshness: this.#freshness(entry),
      relationshipQuality: this.#relationships(entry, context),
      calculatorIntegration: this.#calculators(entry, context),
      mediaReadiness: this.#media(entry),
    };
    const categories = {};
    for (const category of CATEGORIES) {
      const categoryScore = rounded(clamp(raw[category]));
      categories[category] = {
        score: categoryScore,
        weight: this.#weights[category],
        weightedScore: rounded((categoryScore * this.#weights[category]) / 100),
      };
    }
    const totalScore = rounded(
      Object.values(categories).reduce(
        (sum, category) => sum + category.weightedScore,
        0,
      ),
    );
    return {
      version: 1,
      entryId: entry.id,
      generatedAt: this.#clock().toISOString(),
      totalScore,
      band:
        totalScore >= 85
          ? "excellent"
          : totalScore >= 70
            ? "good"
            : totalScore >= 50
              ? "needs-improvement"
              : "critical",
      categories,
      recommendations: this.#recommendations(categories),
    };
  }

  scoreBatch(entries, context = {}) {
    if (!Array.isArray(entries))
      throw new KnowledgeQualityError(
        "invalid-batch",
        "Entries must be an array.",
      );
    const scored = entries.map((entry) => this.score(entry, context));
    const scores = scored.map((item) => item.totalScore);
    const byBand = {
      excellent: 0,
      good: 0,
      "needs-improvement": 0,
      critical: 0,
    };
    scored.forEach((item) => byBand[item.band]++);
    return {
      version: 1,
      generatedAt: this.#clock().toISOString(),
      entries: scored,
      statistics: {
        count: scored.length,
        averageScore: scores.length
          ? rounded(
              scores.reduce((sum, value) => sum + value, 0) / scores.length,
            )
          : 0,
        minimumScore: scores.length ? Math.min(...scores) : 0,
        maximumScore: scores.length ? Math.max(...scores) : 0,
        byBand,
      },
    };
  }

  async exportJson(report, file) {
    if (!file)
      throw new KnowledgeQualityError(
        "invalid-export",
        "A quality report path is required.",
      );
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`);
    await fs.rename(temporary, file);
    return file;
  }

  #completeness(entry) {
    const complete = REQUIRED_FIELDS.filter(
      (field) => nonEmpty(entry[field]) && !researchRequired(entry[field]),
    ).length;
    return (complete / REQUIRED_FIELDS.length) * 100;
  }
  #evidence(entry, context) {
    if (Number.isFinite(context.evidenceCoveragePercentage))
      return context.evidenceCoveragePercentage;
    const sources = Array.isArray(entry.sources) ? entry.sources : [];
    const substantive = BILINGUAL_FIELDS.filter(
      (field) => nonEmpty(entry[field]) && !researchRequired(entry[field]),
    ).length;
    return substantive
      ? Math.min(100, (sources.length / Math.max(1, substantive / 4)) * 100)
      : 0;
  }
  #citations(entry) {
    const sources = Array.isArray(entry.sources) ? entry.sources : [];
    if (!sources.length) return 0;
    return (
      sources.reduce((sum, source) => {
        let score = 0;
        if (source.title && source.publisher) score += 30;
        if (/^https:\/\//.test(source.url || "")) score += 25;
        if (!Number.isNaN(Date.parse(source.accessed_date))) score += 20;
        if (
          source.publication_date &&
          !Number.isNaN(Date.parse(source.publication_date))
        )
          score += 10;
        if (String(source.citation_note || "").length >= 20) score += 15;
        return sum + score;
      }, 0) / sources.length
    );
  }
  #bilingual(entry) {
    const scores = BILINGUAL_FIELDS.map((field) => {
      const value = entry[field];
      if (!value || typeof value !== "object") return 0;
      const en = text(value.en).trim();
      const tr = text(value.tr).trim();
      if (!en || !tr) return 0;
      const ratio =
        Math.min(en.length, tr.length) / Math.max(en.length, tr.length);
      return ratio >= 0.45 ? 100 : ratio * 200;
    });
    return scores.reduce((sum, value) => sum + value, 0) / scores.length;
  }
  #readability(entry) {
    const samples = [entry.summary, entry.simple_explanation, entry.definition]
      .flatMap((value) => [value?.en, value?.tr])
      .filter(Boolean);
    if (!samples.length) return 0;
    return (
      samples.reduce((sum, sample) => {
        const words = String(sample).trim().split(/\s+/).filter(Boolean);
        const sentences = Math.max(
          1,
          String(sample)
            .split(/[.!?]+/)
            .filter((item) => item.trim()).length,
        );
        const wordsPerSentence = words.length / sentences;
        const averageWordLength =
          words.reduce((total, word) => total + word.length, 0) /
          Math.max(1, words.length);
        return (
          sum +
          (wordsPerSentence <= 25
            ? 60
            : Math.max(10, 60 - (wordsPerSentence - 25) * 2)) +
          (averageWordLength <= 9
            ? 40
            : Math.max(5, 40 - (averageWordLength - 9) * 5))
        );
      }, 0) / samples.length
    );
  }
  #freshness(entry) {
    const revisions = Array.isArray(entry.revision_history)
      ? entry.revision_history
          .map((item) => item.date)
          .filter(Boolean)
          .sort()
      : [];
    const date = entry.reviewed_date || revisions.at(-1);
    if (!date || Number.isNaN(Date.parse(date))) return 0;
    const age = (this.#clock().valueOf() - Date.parse(date)) / 86_400_000;
    if (entry.review_status !== "reviewed") return Math.max(10, 40 - age / 30);
    if (age <= this.#reviewFreshDays) return 100;
    if (age <= this.#reviewFreshDays * 2) return 60;
    return 20;
  }
  #relationships(entry, context) {
    const related = Array.isArray(entry.related_concepts)
      ? entry.related_concepts
      : [];
    if (!related.length) return 40;
    const unique = new Set(related);
    const known = context.knownEntryIds ? new Set(context.knownEntryIds) : null;
    const valid = related.filter(
      (id) => id !== entry.id && (!known || known.has(id)),
    ).length;
    return clamp(
      (valid / related.length) * 80 + (unique.size === related.length ? 20 : 0),
    );
  }
  #calculators(entry, context) {
    if (entry.formula === null) return 100;
    const links = Array.isArray(entry.related_calculators)
      ? entry.related_calculators
      : [];
    if (!links.length) return 0;
    if (!context.calculatorIds) return 70;
    const valid = new Set(context.calculatorIds);
    return (links.filter((id) => valid.has(id)).length / links.length) * 100;
  }
  #media(entry) {
    const value = (item) =>
      item?.status === "available" || item?.status === "not_applicable"
        ? 100
        : item?.status === "planned"
          ? 50
          : 0;
    return (value(entry.visual_illustration) + value(entry.future_video)) / 2;
  }
  #recommendations(categories) {
    const messages = {
      completeness:
        "Complete substantive Knowledge Entry v2 sections and replace research-required placeholders.",
      evidenceCoverage: "Bind factual sections to verified research evidence.",
      citationQuality:
        "Add complete, current HTTPS citations with publishers and explanatory notes.",
      bilingualConsistency:
        "Align English and Turkish coverage and level of detail.",
      readability:
        "Shorten sentences and explain specialist terminology in plain language.",
      reviewFreshness:
        "Schedule professional re-review and update the reviewed date.",
      relationshipQuality: "Add valid, non-duplicate related concepts.",
      calculatorIntegration:
        "Link formula-based content to a valid calculator.",
      mediaReadiness:
        "Complete or explicitly mark planned visual and video assets as not applicable.",
    };
    return CATEGORIES.filter((category) => categories[category].score < 80)
      .sort((a, b) => categories[a].score - categories[b].score)
      .map((category) => ({
        category,
        priority:
          categories[category].score < 40
            ? "high"
            : categories[category].score < 65
              ? "medium"
              : "low",
        message: messages[category],
      }));
  }
}
