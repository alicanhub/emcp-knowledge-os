import * as fs from "node:fs/promises";
import * as path from "node:path";

const DAY = 86_400_000;
const QUEUE_PATH = [
  "planned",
  "drafting",
  "research",
  "review",
  "validation",
  "import",
  "completed",
];

export class MaintenanceEngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MaintenanceEngineError";
    this.code = code;
  }
}

const clone = (value) => structuredClone(value);
const periodOf = (date) => date.toISOString().slice(0, 7);
const firstOfMonth = (value) => {
  const date = value ? new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.valueOf()))
    throw new MaintenanceEngineError("invalid_period", "Use a YYYY-MM period.");
  return date;
};
const addMonths = (date, count) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
const normalize = (value) => String(value || "").trim();

export class JsonMonthlyMaintenanceEngine {
  #runtimeDirectory;
  #queue;
  #backupRollback;
  #dashboard;
  #clock;
  #reviewMaxAgeDays;
  #backupMaxAgeDays;

  /** @param {any} options */
  constructor(options = {}) {
    if (!options.runtimeDirectory)
      throw new MaintenanceEngineError(
        "invalid_runtime",
        "A runtime knowledge directory is required.",
      );
    this.#runtimeDirectory = options.runtimeDirectory;
    this.#queue = options.jobQueue || null;
    this.#backupRollback = options.backupRollback || null;
    this.#dashboard = options.dashboard || null;
    this.#clock = options.clock || (() => new Date());
    this.#reviewMaxAgeDays = options.reviewMaxAgeDays ?? 365;
    this.#backupMaxAgeDays = options.backupMaxAgeDays ?? 35;
  }

  /** @param {any} request */
  async schedule(request = {}) {
    const { start, months = 12, priority = "normal" } = request;
    if (!this.#queue)
      throw new MaintenanceEngineError(
        "queue_required",
        "Scheduling requires a Job Queue.",
      );
    if (!Number.isInteger(months) || months < 1 || months > 120)
      throw new MaintenanceEngineError(
        "invalid_months",
        "Months must be an integer from 1 to 120.",
      );
    const beginning = start
      ? firstOfMonth(start)
      : firstOfMonth(periodOf(this.#clock()));
    const scheduled = [];
    for (let offset = 0; offset < months; offset++) {
      const date = addMonths(beginning, offset);
      const period = periodOf(date);
      const jobId = `maintenance.${period}`;
      const existing = this.#queue.get(jobId);
      const job =
        existing ||
        (await this.#queue.create({
          id: jobId,
          title: `Monthly maintenance — ${period}`,
          priority,
          payload: {
            type: "monthly-maintenance",
            period,
            scheduledFor: date.toISOString().slice(0, 10),
          },
        }));
      scheduled.push({
        jobId,
        period,
        scheduledFor: date.toISOString().slice(0, 10),
        job,
      });
    }
    return clone(scheduled);
  }

  /** @param {any} request */
  async run(request = {}) {
    const { period = periodOf(this.#clock()), jobId, reportFile } = request;
    firstOfMonth(period);
    const resolvedJobId = jobId || `maintenance.${period}`;
    try {
      if (this.#queue && this.#queue.get(resolvedJobId))
        await this.#advanceJob(resolvedJobId, "validation");
      const report = await this.#scan(period);
      if (reportFile) await this.exportJson(report, reportFile);
      if (this.#queue && this.#queue.get(resolvedJobId))
        await this.#advanceJob(resolvedJobId, "completed");
      return report;
    } catch (error) {
      const job = this.#queue?.get(resolvedJobId);
      if (job && !["completed", "failed"].includes(job.status))
        await this.#queue.transition(resolvedJobId, "failed", error.message);
      throw error;
    }
  }

  async exportJson(report, file) {
    if (!file || typeof file !== "string")
      throw new MaintenanceEngineError(
        "invalid_export",
        "A JSON report path is required.",
      );
    const target = path.resolve(file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${process.pid}`;
    await fs.writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`);
    await fs.rename(temporary, target);
    return target;
  }

  async #scan(period) {
    const generatedAt = this.#clock().toISOString();
    const findings = [];
    const recommendations = [];
    const runtime = await this.#readRuntime(findings);
    const indexes = this.#checkIndexes(runtime, findings);
    this.#checkReviews(runtime, findings, recommendations);
    const backups = await this.#checkBackups(findings);
    const dashboard = await this.#checkDashboard(findings);
    const counts = { critical: 0, error: 0, warning: 0, information: 0 };
    for (const finding of findings) counts[finding.severity]++;
    return {
      version: 1,
      reportId: `maintenance.${period}`,
      period,
      generatedAt,
      runtime: {
        entries: runtime.entries.length,
        categories: runtime.categories,
        translations: Object.keys(runtime.translations).length,
        details: Object.keys(runtime.details).length,
      },
      indexes,
      backups,
      dashboard,
      findings,
      recommendations,
      counts,
      healthy: counts.critical === 0 && counts.error === 0,
    };
  }

  async #readRuntime(findings) {
    let index;
    try {
      index = await this.#readJson("index.json");
    } catch (error) {
      this.#finding(
        findings,
        "critical",
        "runtime-integrity",
        "index-unreadable",
        null,
        "index.json",
        error.message,
      );
      throw new MaintenanceEngineError("runtime_unreadable", error.message);
    }
    if (!Array.isArray(index.categories))
      throw new MaintenanceEngineError(
        "runtime_invalid",
        "Runtime index categories are invalid.",
      );
    const entries = [];
    const categoryNames = new Set();
    for (const category of index.categories) {
      if (categoryNames.has(category.category))
        this.#finding(
          findings,
          "error",
          "runtime-integrity",
          "duplicate-category",
          category.category,
          "index.json",
          `Duplicate category: ${category.category}`,
        );
      categoryNames.add(category.category);
      try {
        const records = await this.#readJson(category.file);
        if (!Array.isArray(records))
          throw new Error("Category data must be an array.");
        for (const record of records)
          entries.push({ ...record, source: category.file });
      } catch (error) {
        this.#finding(
          findings,
          "critical",
          "runtime-integrity",
          "category-unreadable",
          category.category,
          category.file,
          error.message,
        );
      }
    }
    const translations = await this.#optionalJson(index.translations, {});
    const detailsDocument = await this.#optionalJson(index.details, {
      entries: {},
    });
    const searchIndex = await this.#optionalJson(index.searchIndex, null);
    const relationships = await this.#optionalJson(index.relationships, null);
    const titles = new Set();
    for (const entry of entries) {
      if (!normalize(entry.term))
        this.#finding(
          findings,
          "error",
          "runtime-integrity",
          "missing-title",
          null,
          entry.source,
          "Runtime entry has no English title.",
        );
      else if (titles.has(entry.term))
        this.#finding(
          findings,
          "error",
          "runtime-integrity",
          "duplicate-title",
          entry.term,
          entry.source,
          `Duplicate runtime title: ${entry.term}`,
        );
      titles.add(entry.term);
      if (!normalize(entry.tr) || !normalize(entry.def))
        this.#finding(
          findings,
          "error",
          "runtime-integrity",
          "incomplete-runtime-entry",
          entry.term,
          entry.source,
          `${entry.term} is missing Turkish title or definition.`,
        );
      if (!translations[entry.term])
        this.#finding(
          findings,
          "error",
          "runtime-integrity",
          "missing-translation",
          entry.term,
          index.translations,
          `${entry.term} is absent from the translation index.`,
        );
    }
    const details = detailsDocument?.entries || {};
    for (const title of Object.keys(details))
      if (!titles.has(title))
        this.#finding(
          findings,
          "warning",
          "orphaned-entry",
          "orphaned-detail",
          title,
          index.details,
          `${title} has details but no runtime entry.`,
          true,
        );
    return {
      entries,
      categories: categoryNames.size,
      translations,
      details,
      searchIndex,
      relationships,
      index,
      titles,
    };
  }

  #checkIndexes(runtime, findings) {
    const searchValid =
      Array.isArray(runtime.searchIndex) &&
      runtime.searchIndex.length === runtime.entries.length &&
      runtime.searchIndex.every(
        (item, index) => item.term === runtime.entries[index].term,
      );
    if (!searchValid)
      this.#finding(
        findings,
        "error",
        "search-index",
        "search-index-stale",
        null,
        runtime.index.searchIndex,
        "Search index does not match runtime entry order and count.",
      );
    const rows = runtime.relationships?.relationships;
    let broken = 0;
    if (!Array.isArray(rows) || rows.length !== runtime.entries.length)
      broken++;
    else
      rows.forEach((row, source) => {
        if (!Array.isArray(row)) {
          broken++;
          return;
        }
        const seen = new Set();
        for (const target of row) {
          if (
            !Number.isInteger(target) ||
            target < 0 ||
            target >= runtime.entries.length ||
            target === source ||
            seen.has(target)
          )
            broken++;
          seen.add(target);
        }
        if (row.length === 0 && runtime.entries.length > 1)
          this.#finding(
            findings,
            "warning",
            "orphaned-entry",
            "no-relationships",
            runtime.entries[source]?.term || null,
            runtime.index.relationships,
            `${runtime.entries[source]?.term || `Entry ${source}`} has no relationships.`,
            true,
          );
      });
    if (broken)
      this.#finding(
        findings,
        "error",
        "broken-relationship",
        "relationship-index-invalid",
        null,
        runtime.index.relationships,
        `Relationship index contains ${broken} invalid row or reference condition(s).`,
      );
    return {
      searchIndexValid: searchValid,
      relationshipIndexValid: broken === 0,
      brokenRelationships: broken,
    };
  }

  #checkReviews(runtime, findings, recommendations) {
    const cutoff = this.#clock().valueOf() - this.#reviewMaxAgeDays * DAY;
    for (const entry of runtime.entries) {
      const detail = runtime.details[entry.term];
      const dates = (detail?.revisionHistory || [])
        .map((revision) => revision.date)
        .filter(Boolean)
        .sort();
      const lastReviewedDate = detail?.reviewedDate || dates.at(-1) || null;
      const dateValue = lastReviewedDate
        ? Date.parse(lastReviewedDate)
        : Number.NaN;
      if (!lastReviewedDate || Number.isNaN(dateValue) || dateValue < cutoff) {
        const reason =
          lastReviewedDate && !Number.isNaN(dateValue)
            ? "review-overdue"
            : "review-date-missing";
        recommendations.push({
          recordId: entry.id || entry.term,
          title: entry.term,
          lastReviewedDate,
          reason,
        });
        this.#finding(
          findings,
          "warning",
          "review-due",
          reason,
          entry.id || entry.term,
          entry.source,
          `${entry.term} should be re-reviewed.`,
          true,
        );
      }
    }
  }

  async #checkBackups(findings) {
    if (!this.#backupRollback) {
      this.#finding(
        findings,
        "warning",
        "backup-health",
        "backup-service-unavailable",
        null,
        null,
        "Backup health could not be verified.",
      );
      return {
        available: false,
        snapshots: 0,
        latestVersionId: null,
        latestVerified: false,
        ageDays: null,
      };
    }
    const manifests = await this.#backupRollback.list();
    const latest =
      [...manifests]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .at(-1) || null;
    if (!latest) {
      this.#finding(
        findings,
        "error",
        "backup-health",
        "backup-missing",
        null,
        null,
        "No runtime backup snapshot exists.",
      );
      return {
        available: true,
        snapshots: 0,
        latestVersionId: null,
        latestVerified: false,
        ageDays: null,
      };
    }
    const verified = await this.#backupRollback.verify(latest.versionId);
    const ageDays = Math.max(
      0,
      Math.floor(
        (this.#clock().valueOf() - Date.parse(latest.createdAt)) / DAY,
      ),
    );
    if (!verified)
      this.#finding(
        findings,
        "critical",
        "backup-health",
        "backup-corrupt",
        latest.versionId,
        null,
        `Latest backup ${latest.versionId} failed checksum verification.`,
      );
    if (ageDays > this.#backupMaxAgeDays)
      this.#finding(
        findings,
        "warning",
        "backup-health",
        "backup-stale",
        latest.versionId,
        null,
        `Latest backup is ${ageDays} days old.`,
      );
    return {
      available: true,
      snapshots: manifests.length,
      latestVersionId: latest.versionId,
      latestVerified: verified,
      ageDays,
    };
  }

  async #checkDashboard(findings) {
    if (!this.#dashboard) {
      this.#finding(
        findings,
        "warning",
        "dashboard-health",
        "dashboard-service-unavailable",
        null,
        null,
        "Production dashboard health could not be verified.",
      );
      return { available: false, healthy: false, generatedAt: null };
    }
    try {
      const snapshot = await this.#dashboard.snapshot();
      const healthy =
        snapshot?.version === 1 &&
        Boolean(snapshot.generatedAt) &&
        Boolean(snapshot.overall) &&
        Boolean(snapshot.jobQueue);
      if (!healthy)
        this.#finding(
          findings,
          "error",
          "dashboard-health",
          "dashboard-invalid",
          null,
          null,
          "Production dashboard returned an incomplete snapshot.",
        );
      return {
        available: true,
        healthy,
        generatedAt: snapshot?.generatedAt || null,
      };
    } catch (error) {
      this.#finding(
        findings,
        "error",
        "dashboard-health",
        "dashboard-unavailable",
        null,
        null,
        error.message,
      );
      return { available: true, healthy: false, generatedAt: null };
    }
  }

  async #advanceJob(jobId, target) {
    let job = this.#queue.get(jobId);
    if (!job) return;
    const targetIndex = QUEUE_PATH.indexOf(target);
    while (job.status !== target) {
      const currentIndex = QUEUE_PATH.indexOf(job.status);
      const next =
        job.status === "pending" ? "planned" : QUEUE_PATH[currentIndex + 1];
      if (!next || QUEUE_PATH.indexOf(next) > targetIndex) break;
      job = await this.#queue.transition(jobId, next);
    }
  }

  async #readJson(file) {
    return JSON.parse(
      await fs.readFile(path.join(this.#runtimeDirectory, file), "utf8"),
    );
  }
  async #optionalJson(file, fallback) {
    if (!file) return fallback;
    try {
      return await this.#readJson(file);
    } catch {
      return fallback;
    }
  }
  #finding(
    findings,
    severity,
    kind,
    code,
    recordId,
    file,
    message,
    requiresHumanReview = false,
  ) {
    findings.push({
      severity,
      kind,
      code,
      recordId,
      path: file,
      message,
      requiresHumanReview,
    });
  }
}
