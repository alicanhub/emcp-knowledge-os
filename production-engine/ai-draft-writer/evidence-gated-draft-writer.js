import * as fs from "node:fs/promises";
import { WeightedKnowledgeQualityScorer } from "../knowledge-quality/weighted-quality-scorer.js";

const WRITER_VERSION = "1.0.0";
const FACTUAL_FIELDS = Object.freeze([
  "summary",
  "simple_explanation",
  "professional_explanation",
  "definition",
  "real_world_example",
  "site_example",
  "office_example",
  "interview_questions",
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
  "related_documents",
  "related_standards",
  "related_regulations",
  "frequently_asked_questions",
]);
const LOCALIZED_TEXT_FIELDS = new Set([
  "summary",
  "simple_explanation",
  "professional_explanation",
  "definition",
  "real_world_example",
  "site_example",
  "office_example",
  "worked_example",
  "when_to_use",
  "uk_practice",
  "turkey_practice",
]);
const LOCALIZED_LIST_FIELDS = new Set([
  "use_cases",
  "risks",
  "common_mistakes",
  "practical_tips",
  "best_practice",
]);
const FIELD_RESEARCH_CATEGORIES = {
  formula: ["formulas"],
  worked_example: ["formulas", "examples"],
  real_world_example: ["examples"],
  site_example: ["examples"],
  office_example: ["examples"],
  related_standards: ["standards"],
  related_regulations: ["regulations"],
  related_documents: ["references", "standards", "regulations"],
  uk_practice: ["uk-guidance", "regulations"],
  turkey_practice: ["turkey-guidance", "regulations"],
};

export class AIDraftWriterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AIDraftWriterError";
    this.code = code;
  }
}

const clone = (value) => structuredClone(value);
const percentage = (value, total) =>
  total ? Number(((value / total) * 100).toFixed(1)) : 0;
const researchRequired = (title, field) => ({
  en: `${field.replaceAll("_", " ")} research is required for ${title.en}.`,
  tr: `${title.tr} için ${field.replaceAll("_", " ")} araştırması gereklidir.`,
});
const questionRequired = (title) => ({
  en: [
    {
      question: `What should be verified about ${title.en}?`,
      answer:
        "Research and professional review are required before a factual answer can be provided.",
    },
  ],
  tr: [
    {
      question: `${title.tr} hakkında neler doğrulanmalıdır?`,
      answer:
        "Gerçeğe dayalı bir cevap verilmeden önce araştırma ve uzman incelemesi gereklidir.",
    },
  ],
});

export class EvidenceGatedAIDraftWriter {
  #draftGenerator;
  #researchQueue;
  #jobQueue;
  #provider;
  #qualityScorer;
  #calculatorIds;
  #clock;

  /** @param {any} options */
  constructor(options = {}) {
    if (!options.draftGenerator || !options.researchQueue)
      throw new AIDraftWriterError(
        "missing-services",
        "Draft Generator and Research Queue are required.",
      );
    if (options.provider) this.#assertProvider(options.provider);
    this.#draftGenerator = options.draftGenerator;
    this.#researchQueue = options.researchQueue;
    this.#jobQueue = options.jobQueue || null;
    this.#provider = options.provider || null;
    this.#qualityScorer =
      options.qualityScorer ||
      new WeightedKnowledgeQualityScorer({ clock: options.clock });
    this.#calculatorIds = options.calculatorIds || [];
    this.#clock = options.clock || (() => new Date());
  }

  async generateFromQueue(jobId, options = {}) {
    if (!this.#jobQueue?.get)
      throw new AIDraftWriterError(
        "queue-required",
        "Job Queue is required for queued generation.",
      );
    const job = this.#jobQueue.get(jobId);
    if (!job?.payload?.plan)
      throw new AIDraftWriterError(
        "invalid-job",
        "The Topic Planner job does not contain a production plan.",
      );
    const draftResult = await this.#draftGenerator.generateFromQueue(jobId);
    return this.write({
      plannerJobId: jobId,
      plan: job.payload.plan,
      draftResult,
      deterministic: options.deterministic,
    });
  }

  async write(request) {
    this.#assertRequest(request);
    const deterministic = request.deterministic !== false;
    if (!deterministic && !this.#provider)
      throw new AIDraftWriterError(
        "provider-required",
        "Provider-assisted mode requires a draft-writing adapter.",
      );
    const quality = [];
    for (const reference of request.draftResult.drafts) {
      const draft = JSON.parse(await fs.readFile(reference.path, "utf8"));
      if (draft.review_status !== "draft")
        throw new AIDraftWriterError(
          "approved-content",
          `AI Draft Writer cannot modify non-draft content: ${draft.id}`,
        );
      const topic = request.plan.topics.find((item) => item.id === draft.id);
      if (!topic)
        throw new AIDraftWriterError(
          "topic-missing",
          `Draft topic is absent from the plan: ${draft.id}`,
        );
      const tasks = this.#researchQueue.list({ draftId: draft.draft_id });
      const verifiedTasks = tasks.filter((task) => task.status === "verified");
      const evidence = verifiedTasks.flatMap((task) =>
        task.evidence.map((item) => ({
          ...item,
          researchCategory: task.category,
        })),
      );
      const evidenceById = new Map(evidence.map((item) => [item.id, item]));
      let response = { sections: {}, warnings: [] };
      if (!deterministic)
        response = await this.#provider.write({
          topic: clone(topic),
          plan: clone(request.plan),
          currentDraft: clone(draft),
          verifiedEvidence: clone(evidence),
          languages: ["en", "tr"],
        });
      this.#assertResponse(response);
      const supported = [];
      const unsupported = [];
      for (const field of FACTUAL_FIELDS) {
        const section = response.sections[field];
        if (
          section &&
          section.evidenceIds.length > 0 &&
          section.evidenceIds.every((id) => evidenceById.has(id)) &&
          this.#categoriesSupport(field, section.evidenceIds, evidenceById) &&
          this.#contentSupported(
            field,
            section.value,
            section.evidenceIds,
            evidenceById,
          ) &&
          this.#validBilingualValue(field, section.value)
        ) {
          draft[field] = clone(section.value);
          supported.push(field);
        } else {
          draft[field] = this.#unsupportedValue(draft.title, field);
          unsupported.push(field);
        }
      }
      draft.sources = this.#sources(evidence);
      const timestamp = this.#clock().toISOString();
      draft.version = WRITER_VERSION;
      draft.updated_at = timestamp;
      draft.content_version = "0.2.0";
      draft.revision_history = [
        ...(draft.revision_history || []).filter(
          (revision) => revision.version !== "0.2.0",
        ),
        {
          version: "0.2.0",
          date: timestamp.slice(0, 10),
          summary: {
            en: "Evidence-gated AI Draft Writer pass completed; unsupported fields remain marked for research.",
            tr: "Kanıt kontrollü AI Taslak Yazarı aşaması tamamlandı; desteklenmeyen alanlar araştırma gerekli olarak işaretlendi.",
          },
          reviewer: "Pending human review",
        },
      ];
      draft.generation_warnings = [
        ...new Set([
          ...(draft.generation_warnings || []),
          ...response.warnings,
          ...unsupported.map((field) => `${field}: research required`),
          "AI-generated wording requires human review; cited evidence has not been editorially approved by this writer.",
        ]),
      ];
      await this.#write(reference.path, draft);
      const evidenceCoveragePercentage = percentage(
        supported.length,
        FACTUAL_FIELDS.length,
      );
      quality.push({
        draftId: draft.draft_id,
        factualSections: FACTUAL_FIELDS.length,
        evidenceSupportedSections: supported.length,
        unsupportedSections: unsupported,
        verifiedEvidenceItems: evidence.length,
        sourceCount: draft.sources.length,
        bilingualCompletenessPercentage: this.#bilingualCompleteness(draft),
        evidenceCoveragePercentage,
        deterministic,
        knowledgeQuality: this.#qualityScorer.score(draft, {
          evidenceCoveragePercentage,
          knownEntryIds: request.plan.topics.map((item) => item.id),
          calculatorIds: this.#calculatorIds,
        }),
      });
    }
    return {
      version: 1,
      writerVersion: WRITER_VERSION,
      generatedAt: this.#clock().toISOString(),
      deterministic,
      providerId: deterministic ? null : this.#provider.id,
      draftResult: clone(request.draftResult),
      quality,
    };
  }

  #unsupportedValue(title, field) {
    if (field === "formula") return null;
    if (
      [
        "related_documents",
        "related_standards",
        "related_regulations",
      ].includes(field)
    )
      return [];
    if (["interview_questions", "frequently_asked_questions"].includes(field))
      return questionRequired(title);
    const value = researchRequired(title, field);
    if (LOCALIZED_LIST_FIELDS.has(field))
      return { en: [value.en], tr: [value.tr] };
    return value;
  }

  #validBilingualValue(field, value) {
    if (field === "formula")
      return value === null || (value && typeof value === "object");
    if (
      [
        "related_documents",
        "related_standards",
        "related_regulations",
      ].includes(field)
    )
      return Array.isArray(value);
    if (LOCALIZED_TEXT_FIELDS.has(field))
      return Boolean(
        value && String(value.en || "").trim() && String(value.tr || "").trim(),
      );
    if (LOCALIZED_LIST_FIELDS.has(field))
      return Boolean(
        value &&
        Array.isArray(value.en) &&
        value.en.length &&
        Array.isArray(value.tr) &&
        value.tr.length,
      );
    if (["interview_questions", "frequently_asked_questions"].includes(field))
      return Boolean(
        value &&
        Array.isArray(value.en) &&
        value.en.length &&
        Array.isArray(value.tr) &&
        value.tr.length,
      );
    return false;
  }

  #categoriesSupport(field, evidenceIds, evidenceById) {
    const allowed = FIELD_RESEARCH_CATEGORIES[field];
    return (
      !allowed ||
      evidenceIds.some((id) =>
        allowed.includes(evidenceById.get(id).researchCategory),
      )
    );
  }

  #contentSupported(field, value, evidenceIds, evidenceById) {
    const evidence = evidenceIds.map((id) => evidenceById.get(id));
    if (field === "formula" && value) {
      const expression = String(value.expression || "").trim();
      return Boolean(
        expression &&
        evidence.some((item) => String(item.note || "").includes(expression)),
      );
    }
    if (
      [
        "related_documents",
        "related_standards",
        "related_regulations",
      ].includes(field)
    ) {
      const evidenceUrls = new Set(evidence.map((item) => item.url));
      return value.every(
        (item) => item.url === null || evidenceUrls.has(item.url),
      );
    }
    return true;
  }

  #sources(evidence) {
    const seen = new Set();
    return evidence
      .filter((item) => {
        const key = `${item.url}|${item.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
        title: item.title,
        publisher: item.publisher,
        url: item.url,
        publication_date: item.publishedAt || null,
        accessed_date: item.accessedAt.slice(0, 10),
        citation_note: item.note,
      }));
  }

  #bilingualCompleteness(draft) {
    const fields = [
      ...LOCALIZED_TEXT_FIELDS,
      ...LOCALIZED_LIST_FIELDS,
      "interview_questions",
      "frequently_asked_questions",
    ];
    const complete = fields.filter((field) =>
      this.#validBilingualValue(field, draft[field]),
    ).length;
    return percentage(complete, fields.length);
  }
  async #write(file, value) {
    const temporary = `${file}.${process.pid}.ai-writer.tmp`;
    await fs.writeFile(
      temporary,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(temporary, file);
  }
  #assertProvider(provider) {
    if (!provider.id || !provider.name || typeof provider.write !== "function")
      throw new AIDraftWriterError(
        "invalid-provider",
        "Draft-writing adapters require id, name and write().",
      );
  }
  #assertRequest(request) {
    if (
      !request?.plannerJobId ||
      request.plan?.schemaVersion !== 1 ||
      !Array.isArray(request.draftResult?.drafts)
    )
      throw new AIDraftWriterError(
        "invalid-request",
        "Planner job, Topic Planner v1 plan and Draft Generator result are required.",
      );
    if (request.draftResult.plannerJobId !== request.plannerJobId)
      throw new AIDraftWriterError(
        "job-mismatch",
        "Draft result does not belong to the requested planner job.",
      );
  }
  #assertResponse(response) {
    if (
      !response ||
      typeof response.sections !== "object" ||
      !Array.isArray(response.warnings)
    )
      throw new AIDraftWriterError(
        "invalid-provider-response",
        "Provider response requires sections and warnings.",
      );
    for (const [field, section] of Object.entries(response.sections)) {
      if (
        !FACTUAL_FIELDS.includes(field) ||
        !Array.isArray(section?.evidenceIds)
      )
        throw new AIDraftWriterError(
          "invalid-provider-response",
          `Unsupported or unbound provider section: ${field}`,
        );
    }
  }
}
