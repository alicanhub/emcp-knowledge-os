import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export class SafeImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SafeImportError";
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
const values = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const overlap = (left, right) => {
  const set = new Set(values(right).map(normalize));
  return values(left)
    .map(normalize)
    .filter((value) => value && set.has(value)).length;
};

export class JsonSafeImportEngine {
  #runtimeDirectory;
  #manifestsDirectory;
  #backupsDirectory;
  #auditFile;
  #batchValidator;
  #jobQueue;
  #clock;
  #faultInjector;
  #backupRollback;
  /** @param {any} options */
  constructor(options = {}) {
    for (const field of [
      "runtimeDirectory",
      "manifestsDirectory",
      "backupsDirectory",
      "auditFile",
      "batchValidator",
    ])
      if (!options[field])
        throw new SafeImportError(
          "invalid_configuration",
          `${field} is required.`,
        );
    this.#runtimeDirectory = options.runtimeDirectory;
    this.#manifestsDirectory = options.manifestsDirectory;
    this.#backupsDirectory = options.backupsDirectory;
    this.#auditFile = options.auditFile;
    this.#batchValidator = options.batchValidator;
    this.#jobQueue = options.jobQueue || null;
    this.#clock = options.clock || (() => new Date());
    this.#faultInjector = options.faultInjector || null;
    this.#backupRollback = options.backupRollback || null;
  }
  async import({
    draftResult,
    validationReport,
    approvedBy,
    importId = `import.${validationReport?.batchId || "unknown"}`,
  }) {
    if (!draftResult || !validationReport || !approvedBy?.trim())
      throw new SafeImportError(
        "invalid_request",
        "Draft result, validation report and approver are required.",
      );
    this.#batchValidator.assertPublishable(validationReport);
    if (
      validationReport.sourcePack !== draftResult.sourcePack ||
      validationReport.plannerJobId !== draftResult.plannerJobId
    )
      throw new SafeImportError(
        "manifest_mismatch",
        "Validation report does not match the draft batch.",
      );
    if (
      await this.#alreadyImported(
        importId,
        draftResult.drafts.map((item) => item.id),
      )
    )
      throw new SafeImportError(
        "duplicate_import",
        "Import id or one of its records was already imported.",
      );
    if (this.#jobQueue) {
      const job = this.#jobQueue.get(draftResult.plannerJobId);
      if (!job || job.status !== "import")
        throw new SafeImportError(
          "invalid_job_state",
          "Job Queue item must be in Import state.",
        );
    }
    const startedAt = this.#clock().toISOString(),
      token = crypto.randomUUID(),
      parent = path.dirname(this.#runtimeDirectory),
      stage = path.join(parent, `.safe-import-stage-${token}`),
      rollback = path.join(parent, `.safe-import-rollback-${token}`),
      backup = path.join(this.#backupsDirectory, importId),
      preparedFile = path.join(
        this.#manifestsDirectory,
        `${importId}.prepared.json`,
      ),
      reportFile = path.join(this.#manifestsDirectory, `${importId}.json`);
    let swapped = false,
      runtimeCountBefore = 0,
      backupVersionId = null;
    try {
      if (this.#backupRollback) {
        const backupReport = await this.#backupRollback.createSnapshot({
          type: (await this.#backupRollback.list()).length
            ? "incremental"
            : "full",
        });
        backupVersionId = backupReport.manifest.versionId;
      }
      await this.#assertRuntimeIntegrity(this.#runtimeDirectory);
      const beforeFiles = await this.#hashDirectory(this.#runtimeDirectory);
      runtimeCountBefore = (await this.#runtime(this.#runtimeDirectory)).entries
        .length;
      await fs.mkdir(this.#backupsDirectory, { recursive: true });
      await fs.cp(this.#runtimeDirectory, backup, {
        recursive: true,
        errorOnExist: true,
      });
      await fs.cp(this.#runtimeDirectory, stage, {
        recursive: true,
        errorOnExist: true,
      });
      const records = [];
      for (const reference of draftResult.drafts)
        records.push({
          reference,
          record: JSON.parse(await fs.readFile(reference.path, "utf8")),
        });
      await this.#apply(stage, records);
      await this.#generateIndexes(stage);
      await this.#assertRuntimeIntegrity(stage);
      const afterFiles = await this.#hashDirectory(stage),
        runtimeCountAfter = (await this.#runtime(stage)).entries.length;
      if (runtimeCountAfter !== runtimeCountBefore + records.length)
        throw new SafeImportError(
          "count_mismatch",
          "Staged runtime count does not match the import batch.",
        );
      const files = [...afterFiles].map(([file, sha256After]) => ({
        path: file,
        sha256Before: beforeFiles.get(file) || null,
        sha256After,
      }));
      await this.#writeJson(preparedFile, {
        version: 1,
        importId,
        state: "prepared",
        startedAt,
        runtimeCountBefore,
        runtimeCountAfter,
        importedRecordIds: records.map(({ record }) => record.id),
        backup,
        files,
      });
      if (this.#faultInjector) await this.#faultInjector("before-swap");
      await fs.rename(this.#runtimeDirectory, rollback);
      await fs.rename(stage, this.#runtimeDirectory);
      swapped = true;
      if (this.#faultInjector) await this.#faultInjector("after-swap");
      const report = {
        version: 1,
        importId,
        batchId: validationReport.batchId,
        sourcePack: draftResult.sourcePack,
        plannerJobId: draftResult.plannerJobId,
        approvedBy: approvedBy.trim(),
        startedAt,
        completedAt: this.#clock().toISOString(),
        runtimeCountBefore,
        runtimeCountAfter,
        importedRecordIds: records.map(({ record }) => record.id),
        files,
        indexesUpdated: true,
        relationshipIntegrity: true,
        rolledBack: false,
        ...(backupVersionId ? { backupVersionId } : {}),
      };
      await this.#appendAudit({
        timestamp: report.completedAt,
        actor: report.approvedBy,
        action: "import-completed",
        importId,
        batchId: report.batchId,
        recordIds: report.importedRecordIds,
        runtimeCountBefore,
        runtimeCountAfter,
      });
      await this.#writeJson(reportFile, report);
      await fs.rm(preparedFile, { force: true });
      if (this.#jobQueue)
        await this.#jobQueue.transition(draftResult.plannerJobId, "completed");
      await fs.rm(rollback, { recursive: true, force: true });
      return report;
    } catch (error) {
      if (swapped) {
        await fs.rm(this.#runtimeDirectory, { recursive: true, force: true });
        await fs.rename(rollback, this.#runtimeDirectory);
      }
      if (backupVersionId && this.#backupRollback)
        await this.#backupRollback
          .restore(backupVersionId, { automatic: true })
          .catch(() => {});
      await fs.rm(stage, { recursive: true, force: true });
      await this.#appendAudit({
        timestamp: this.#clock().toISOString(),
        actor: approvedBy || "unknown",
        action: "import-rolled-back",
        importId,
        error: error.message,
        runtimeCountBefore,
      }).catch(() => {});
      await fs.rm(preparedFile, { force: true });
      if (this.#jobQueue) {
        const job = this.#jobQueue.get(draftResult?.plannerJobId);
        if (job?.status === "import")
          await this.#jobQueue.transition(job.id, "failed", error.message);
      }
      if (error instanceof SafeImportError) throw error;
      throw new SafeImportError(
        "import_failed",
        `Import rolled back: ${error.message}`,
      );
    }
  }
  async listManifests() {
    let names = [];
    try {
      names = await fs.readdir(this.#manifestsDirectory);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    const reports = [];
    for (const name of names
      .filter(
        (name) => name.endsWith(".json") && !name.endsWith(".prepared.json"),
      )
      .sort())
      reports.push(
        JSON.parse(
          await fs.readFile(path.join(this.#manifestsDirectory, name), "utf8"),
        ),
      );
    return reports;
  }
  async #alreadyImported(importId, ids) {
    const manifests = await this.listManifests();
    return manifests.some(
      (item) =>
        item.importId === importId ||
        item.importedRecordIds?.some((id) => ids.includes(id)),
    );
  }
  async #apply(directory, records) {
    const runtime = await this.#runtime(directory),
      index = runtime.index,
      translations = runtime.translations,
      details = runtime.details;
    const existingTerms = new Set(
      runtime.entries.map((entry) => normalize(entry.term)),
    );
    for (const { record } of records) {
      if (existingTerms.has(normalize(record.title.en)))
        throw new SafeImportError(
          "duplicate_import",
          `Runtime title already exists: ${record.title.en}`,
        );
      let category = index.categories.find((item) =>
        [record.category.key, record.category.en, record.category.tr]
          .map(normalize)
          .includes(normalize(item.category)),
      );
      if (!category) {
        category = {
          category: record.category.tr,
          file: `${record.category.key}.json`,
        };
        index.categories.push(category);
        await this.#writeJson(path.join(directory, category.file), []);
      }
      const file = path.join(directory, category.file),
        entries = JSON.parse(await fs.readFile(file, "utf8"));
      entries.push({
        term: record.title.en,
        tr: record.title.tr,
        cat: category.category,
        abbr: record.abbreviation,
        def: record.definition.tr,
        use: record.when_to_use.tr,
        example: record.real_world_example.en,
        aliases: record.aliases.en,
        tags: record.tags,
        keywords: record.keywords.en,
      });
      await this.#writeJson(file, entries);
      translations[record.title.en] = {
        defEn: record.definition.en,
        useEn: record.when_to_use.en,
      };
      details.entries[record.title.en] = this.#details(record);
      existingTerms.add(normalize(record.title.en));
    }
    index.categories.sort((a, b) => a.category.localeCompare(b.category, "tr"));
    await this.#writeJson(path.join(directory, "index.json"), index);
    await this.#writeJson(
      path.join(directory, index.translations),
      translations,
    );
    await this.#writeJson(path.join(directory, index.details), details);
  }
  #details(record) {
    return {
      simpleExplanation: record.simple_explanation,
      professionalExplanation: record.professional_explanation,
      realWorldExample: record.real_world_example,
      siteExample: record.site_example,
      officeExample: record.office_example,
      interviewQuestions: record.interview_questions,
      formula: record.formula,
      calculatorLinks: record.related_calculators,
      commonMistakes: record.common_mistakes,
      practicalTips: record.practical_tips,
      risks: record.risks,
      bestPractice: record.best_practice,
      ukPractice: record.uk_practice,
      turkeyPractice: record.turkey_practice,
      relatedConcepts: record.related_concepts,
      relatedDocuments: record.related_documents,
      relatedStandards: record.related_standards,
      relatedRegulations: record.related_regulations,
      officialSources: record.sources,
      revisionHistory: record.revision_history,
      difficultyLevel: record.difficulty_level,
      estimatedReadingTimeMinutes: record.estimated_reading_time_minutes,
      frequentlyAskedQuestions: record.frequently_asked_questions,
      visualIllustration: record.visual_illustration,
      futureVideo: record.future_video,
    };
  }
  async #generateIndexes(directory) {
    const runtime = await this.#runtime(directory),
      categoryFiles = new Map(
        runtime.index.categories.map(({ category, file }) => [category, file]),
      );
    const compact = runtime.entries.map((entry) => ({
      term: entry.term,
      tr: entry.tr,
      ...(entry.abbr ? { abbr: entry.abbr } : {}),
      def: entry.def,
      defEn: runtime.translations[entry.term]?.defEn || entry.def,
      cat: entry.cat,
      ...(entry.aliases?.length ? { aliases: entry.aliases } : {}),
      ...(entry.tags?.length ? { tags: entry.tags } : {}),
      ...(entry.keywords?.length ? { keywords: entry.keywords } : {}),
      source: categoryFiles.get(entry.cat),
    }));
    const relationships = runtime.entries.map((entry, indexValue) =>
      runtime.entries
        .map((candidate, candidateIndex) => ({
          index: candidateIndex,
          score:
            overlap(entry.cat, candidate.cat) * 20 +
            overlap(entry.tags, candidate.tags) * 24 +
            overlap(entry.keywords, candidate.keywords) * 18 +
            overlap(
              [entry.tr, entry.abbr, ...values(entry.aliases)],
              [candidate.tr, candidate.abbr, ...values(candidate.aliases)],
            ) *
              12,
        }))
        .filter((item) => item.index !== indexValue)
        .sort(
          (left, right) =>
            right.score - left.score ||
            runtime.entries[left.index].term.localeCompare(
              runtime.entries[right.index].term,
              "en",
            ),
        )
        .slice(0, 8)
        .map((item) => item.index),
    );
    await this.#writeJson(
      path.join(directory, runtime.index.searchIndex),
      compact,
    );
    await this.#writeJson(path.join(directory, runtime.index.relationships), {
      version: 1,
      relationships,
    });
  }
  async #runtime(directory) {
    const index = JSON.parse(
        await fs.readFile(path.join(directory, "index.json"), "utf8"),
      ),
      translations = JSON.parse(
        await fs.readFile(path.join(directory, index.translations), "utf8"),
      ),
      details = JSON.parse(
        await fs.readFile(path.join(directory, index.details), "utf8"),
      ),
      entries = [];
    for (const category of index.categories)
      entries.push(
        ...JSON.parse(
          await fs.readFile(path.join(directory, category.file), "utf8"),
        ),
      );
    return { index, translations, details, entries };
  }
  async #assertRuntimeIntegrity(directory) {
    const runtime = await this.#runtime(directory),
      terms = runtime.entries.map((entry) => normalize(entry.term));
    if (new Set(terms).size !== terms.length)
      throw new SafeImportError(
        "runtime_integrity",
        "Runtime contains duplicate terms.",
      );
    for (const entry of runtime.entries)
      if (
        !runtime.translations[entry.term] ||
        !runtime.details.entries[entry.term]
      )
        throw new SafeImportError(
          "runtime_integrity",
          `Runtime metadata is missing for ${entry.term}.`,
        );
    const search = JSON.parse(
        await fs.readFile(
          path.join(directory, runtime.index.searchIndex),
          "utf8",
        ),
      ),
      relationships = JSON.parse(
        await fs.readFile(
          path.join(directory, runtime.index.relationships),
          "utf8",
        ),
      );
    if (
      search.length !== runtime.entries.length ||
      relationships.relationships?.length !== runtime.entries.length
    )
      throw new SafeImportError(
        "runtime_integrity",
        "Search or relationship index count is inconsistent.",
      );
    for (const links of relationships.relationships)
      if (
        !Array.isArray(links) ||
        links.some(
          (value) =>
            !Number.isInteger(value) ||
            value < 0 ||
            value >= runtime.entries.length,
        )
      )
        throw new SafeImportError(
          "runtime_integrity",
          "Relationship index contains an invalid target.",
        );
  }
  async #hashDirectory(directory) {
    const files = new Map();
    const visit = async (folder) => {
      for (const item of await fs.readdir(folder, { withFileTypes: true })) {
        const file = path.join(folder, item.name);
        if (item.isDirectory()) await visit(file);
        else if (item.isFile())
          files.set(
            path.relative(directory, file).split(path.sep).join("/"),
            crypto
              .createHash("sha256")
              .update(await fs.readFile(file))
              .digest("hex"),
          );
      }
    };
    await visit(directory);
    return files;
  }
  async #appendAudit(event) {
    let document = { version: 1, events: [] };
    try {
      document = JSON.parse(await fs.readFile(this.#auditFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    document.events.push(event);
    await this.#writeJson(this.#auditFile, document);
  }
  async #writeJson(file, value) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(
      temporary,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(temporary, file);
  }
}
