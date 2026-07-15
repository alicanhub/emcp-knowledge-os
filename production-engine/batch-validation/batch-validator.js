import * as fs from "node:fs/promises";
import * as path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { RESEARCH_CATEGORIES } from "../research-queue/research-queue.js";

export class BatchValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BatchValidationError";
    this.code = code;
  }
}
const normalize = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export class JsonBatchValidator {
  #schemaFile;
  #runtimeEntries;
  #calculatorIds;
  #researchQueue;
  #reviewWorkflow;
  #jobQueue;
  #clock;
  #validateSchema = null;
  /** @param {any} options */
  constructor(options = {}) {
    if (!options.schemaFile)
      throw new BatchValidationError(
        "schema_unavailable",
        "A Knowledge Entry v2 schema path is required.",
      );
    this.#schemaFile = options.schemaFile;
    this.#runtimeEntries = Array.isArray(options.runtimeEntries)
      ? options.runtimeEntries
      : [];
    this.#calculatorIds = new Set(options.calculatorIds || []);
    this.#researchQueue = options.researchQueue || null;
    this.#reviewWorkflow = options.reviewWorkflow || null;
    this.#jobQueue = options.jobQueue || null;
    this.#clock = options.clock || (() => new Date());
  }
  async validate(result, batchId = `batch.${result?.sourcePack || "unknown"}`) {
    if (
      !result ||
      !Array.isArray(result.drafts) ||
      !result.sourcePack ||
      !result.plannerJobId
    )
      throw new BatchValidationError(
        "invalid_batch",
        "A Draft Generator v1 result is required.",
      );
    const validateSchema = await this.#schemaValidator(),
      findings = [],
      records = [];
    for (const reference of result.drafts) {
      let record;
      try {
        record = JSON.parse(await fs.readFile(reference.path, "utf8"));
      } catch (error) {
        findings.push(
          this.#finding(
            "critical",
            "invalid_json",
            `Cannot read draft JSON: ${error.message}`,
            reference.draft_id,
            null,
            reference.path,
          ),
        );
        continue;
      }
      records.push({ reference, record });
      if (!validateSchema(record))
        for (const error of validateSchema.errors || [])
          findings.push(
            this.#finding(
              "critical",
              "schema",
              `${error.instancePath || "/"} ${error.message}`,
              reference.draft_id,
              error.instancePath || null,
              reference.path,
            ),
          );
      this.#required(record, reference, findings);
      this.#metadata(record, reference, result, findings);
      this.#bilingual(record, reference, findings);
      this.#formula(record, reference, findings);
      this.#calculators(record, reference, findings);
      this.#upstream(reference, findings);
    }
    this.#duplicates(records, findings);
    this.#references(records, findings);
    const counts = {
      drafts: result.drafts.length,
      critical: findings.filter((item) => item.severity === "critical").length,
      errors: findings.filter((item) => item.severity === "error").length,
      warnings: findings.filter((item) => item.severity === "warning").length,
      information: findings.filter((item) => item.severity === "information")
        .length,
    };
    return {
      version: 1,
      batchId,
      sourcePack: result.sourcePack,
      plannerJobId: result.plannerJobId,
      generatedAt: this.#clock().toISOString(),
      counts,
      findings,
      validForPublishing: counts.critical === 0 && counts.errors === 0,
    };
  }
  async validateJob(jobId, result, batchId) {
    if (!this.#jobQueue)
      throw new BatchValidationError(
        "queue_unavailable",
        "A Job Queue Engine instance is required.",
      );
    const job = this.#jobQueue.get(jobId);
    if (!job)
      throw new BatchValidationError(
        "job_not_found",
        `Unknown validation job: ${jobId}`,
      );
    if (job.status !== "validation")
      throw new BatchValidationError(
        "invalid_job_state",
        `Job must be in validation, not ${job.status}.`,
      );
    const report = await this.validate(result, batchId);
    await this.#jobQueue.transition(
      jobId,
      report.validForPublishing ? "import" : "failed",
      report.validForPublishing
        ? undefined
        : "Critical batch validation failed.",
    );
    return report;
  }
  assertPublishable(report) {
    if (!report?.validForPublishing)
      throw new BatchValidationError(
        "validation_failed",
        "Batch is blocked from publishing by validation findings.",
      );
  }
  async exportReport(report, file) {
    if (!report || report.version !== 1 || !file)
      throw new BatchValidationError(
        "invalid_report",
        "A v1 report and JSON output path are required.",
      );
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(
      temporary,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(temporary, file);
    return file;
  }
  async #schemaValidator() {
    if (this.#validateSchema) return this.#validateSchema;
    const schema = JSON.parse(await fs.readFile(this.#schemaFile, "utf8")),
      ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);
    this.#validateSchema = ajv.compile(schema);
    return this.#validateSchema;
  }
  #required(record, reference, findings) {
    for (const field of [
      "id",
      "title",
      "simple_explanation",
      "professional_explanation",
      "definition",
      "category",
      "subcategory",
      "aliases",
      "keywords",
      "worked_example",
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
      "revision_history",
      "difficulty_level",
      "estimated_reading_time_minutes",
      "frequently_asked_questions",
      "visual_illustration",
      "future_video",
      "jurisdiction",
      "sources",
      "review_status",
      "content_version",
    ])
      if (!Object.hasOwn(record, field))
        findings.push(
          this.#finding(
            "critical",
            "required_field",
            `Required v2 field is missing: ${field}`,
            reference.draft_id,
            field,
            reference.path,
          ),
        );
  }
  #metadata(record, reference, result, findings) {
    const expected = {
      draft_id: reference.draft_id,
      source_pack: result.sourcePack,
      planner_job_id: result.plannerJobId,
      version: reference.version,
      generated_at: reference.generated_at,
      updated_at: reference.updated_at,
    };
    for (const [field, value] of Object.entries(expected))
      if (record[field] !== value)
        findings.push(
          this.#finding(
            "critical",
            "metadata_mismatch",
            `${field} does not match the batch manifest.`,
            reference.draft_id,
            field,
            reference.path,
          ),
        );
    if (record.review_status !== "draft")
      findings.push(
        this.#finding(
          "critical",
          "invalid_review_status",
          "Batch input must remain a draft until publishing.",
          reference.draft_id,
          "review_status",
          reference.path,
        ),
      );
  }
  #bilingual(record, reference, findings) {
    const visit = (value, field) => {
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        !("en" in value) ||
        !("tr" in value)
      )
        return;
      const empty = (item) =>
        typeof item === "string"
          ? !item.trim()
          : Array.isArray(item)
            ? item.length === 0
            : item == null;
      if (empty(value.en) !== empty(value.tr))
        findings.push(
          this.#finding(
            "critical",
            "bilingual_missing",
            `${field} must be complete in both English and Turkish.`,
            reference.draft_id,
            field,
            reference.path,
          ),
        );
      if (
        Array.isArray(value.en) &&
        Array.isArray(value.tr) &&
        value.en.length !== value.tr.length
      )
        findings.push(
          this.#finding(
            "warning",
            "bilingual_count",
            `${field} has different English and Turkish item counts.`,
            reference.draft_id,
            field,
            reference.path,
          ),
        );
    };
    for (const [field, value] of Object.entries(record)) visit(value, field);
  }
  #formula(record, reference, findings) {
    if (record.formula == null) return;
    if (!record.formula.expression?.trim())
      findings.push(
        this.#finding(
          "critical",
          "formula_expression",
          "Formula expression is required.",
          reference.draft_id,
          "formula",
          reference.path,
        ),
      );
    const symbols = (record.formula.variables || []).map((item) =>
      normalize(item.symbol),
    );
    if (new Set(symbols).size !== symbols.length)
      findings.push(
        this.#finding(
          "error",
          "formula_symbols",
          "Formula variable symbols must be unique.",
          reference.draft_id,
          "formula.variables",
          reference.path,
        ),
      );
    if (
      !record.worked_example?.en?.trim() ||
      !record.worked_example?.tr?.trim()
    )
      findings.push(
        this.#finding(
          "critical",
          "formula_example",
          "A bilingual worked example is required when a formula is present.",
          reference.draft_id,
          "worked_example",
          reference.path,
        ),
      );
  }
  #calculators(record, reference, findings) {
    for (const id of record.related_calculators || [])
      if (!this.#calculatorIds.has(id))
        findings.push(
          this.#finding(
            "critical",
            "invalid_calculator",
            `Unknown calculator id: ${id}`,
            reference.draft_id,
            "related_calculators",
            reference.path,
          ),
        );
  }
  #upstream(reference, findings) {
    if (!this.#researchQueue)
      findings.push(
        this.#finding(
          "critical",
          "research_unavailable",
          "Research Queue integration is required.",
          reference.draft_id,
          null,
          reference.path,
        ),
      );
    else {
      const tasks = this.#researchQueue.list({ draftId: reference.draft_id });
      if (
        tasks.length !== RESEARCH_CATEGORIES.length ||
        tasks.some((task) => task.status !== "verified")
      )
        findings.push(
          this.#finding(
            "critical",
            "research_incomplete",
            "All research categories must be verified.",
            reference.draft_id,
            null,
            reference.path,
          ),
        );
    }
    if (!this.#reviewWorkflow?.canPublish(reference.draft_id))
      findings.push(
        this.#finding(
          "critical",
          "review_not_approved",
          "Human Review approval is required before publishing.",
          reference.draft_id,
          null,
          reference.path,
        ),
      );
  }
  #duplicates(records, findings) {
    const maps = {
      id: new Map(),
      title: new Map(),
      alias: new Map(),
      abbreviation: new Map(),
    };
    const add = (kind, value, owner, reference, field) => {
      const key = normalize(value);
      if (!key) return;
      const previous = maps[kind].get(key);
      if (previous && previous !== owner)
        findings.push(
          this.#finding(
            "critical",
            `duplicate_${kind}`,
            `${field} duplicates ${previous}: ${value}`,
            reference.draft_id,
            field,
            reference.path,
          ),
        );
      else maps[kind].set(key, owner);
    };
    for (const entry of this.#runtimeEntries) {
      const owner = entry.id || `runtime:${entry.term || entry.title?.en}`;
      add("id", entry.id, owner, { draft_id: null, path: null }, "id");
      add(
        "title",
        entry.term || entry.title?.en,
        owner,
        { draft_id: null, path: null },
        "title.en",
      );
      add(
        "title",
        entry.tr || entry.title?.tr,
        owner,
        { draft_id: null, path: null },
        "title.tr",
      );
      add(
        "abbreviation",
        entry.abbreviation,
        owner,
        { draft_id: null, path: null },
        "abbreviation",
      );
      for (const alias of [
        ...(entry.aliases?.en || []),
        ...(entry.aliases?.tr || []),
      ])
        add("alias", alias, owner, { draft_id: null, path: null }, "aliases");
    }
    for (const { record, reference } of records) {
      const owner = record.id;
      add("id", record.id, owner, reference, "id");
      add("title", record.title?.en, owner, reference, "title.en");
      add("title", record.title?.tr, owner, reference, "title.tr");
      add(
        "abbreviation",
        record.abbreviation,
        owner,
        reference,
        "abbreviation",
      );
      for (const alias of [
        ...(record.aliases?.en || []),
        ...(record.aliases?.tr || []),
      ])
        add("alias", alias, owner, reference, "aliases");
    }
  }
  #references(records, findings) {
    const known = new Set([
      ...this.#runtimeEntries.map((entry) => entry.id).filter(Boolean),
      ...records.map(({ record }) => record.id),
    ]);
    for (const { record, reference } of records)
      for (const related of record.related_concepts || [])
        if (!known.has(related))
          findings.push(
            this.#finding(
              "critical",
              "broken_reference",
              `Unknown related concept: ${related}`,
              reference.draft_id,
              "related_concepts",
              reference.path,
            ),
          );
  }
  #finding(severity, code, message, draftId, field, filePath) {
    return {
      severity,
      code,
      message,
      draftId: draftId || null,
      field: field || null,
      path: filePath || null,
    };
  }
}
