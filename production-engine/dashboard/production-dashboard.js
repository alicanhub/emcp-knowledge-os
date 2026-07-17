import * as fs from "node:fs/promises";
import * as path from "node:path";

export class ProductionDashboardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProductionDashboardError";
    this.code = code;
  }
}
const percentage = (value, total) =>
  total ? Number(((value / total) * 100).toFixed(1)) : 0;
const counts = (values, keys) =>
  Object.fromEntries(
    keys.map((key) => [
      key,
      values.filter((item) => item.status === key).length,
    ]),
  );
const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
};

export class JsonProductionDashboard {
  #jobQueue;
  #researchQueue;
  #reviewWorkflow;
  #safeImport;
  #backupRollback;
  #clock;
  #topicPlans;
  #draftResults;
  #batchReports;
  #qualityReports;
  /** @param {any} options */
  constructor(options = {}) {
    this.#jobQueue = options.jobQueue || null;
    this.#researchQueue = options.researchQueue || null;
    this.#reviewWorkflow = options.reviewWorkflow || null;
    this.#safeImport = options.safeImport || null;
    this.#backupRollback = options.backupRollback || null;
    this.#clock = options.clock || (() => new Date());
    this.setTopicPlans(options.topicPlans || []);
    this.setDraftResults(options.draftResults || []);
    this.setBatchReports(options.batchReports || []);
    this.setQualityReports(options.qualityReports || []);
  }
  setTopicPlans(plans) {
    if (!Array.isArray(plans))
      throw new ProductionDashboardError(
        "invalid_plans",
        "Topic plans must be an array.",
      );
    this.#topicPlans = structuredClone(plans);
  }
  setDraftResults(results) {
    if (!Array.isArray(results))
      throw new ProductionDashboardError(
        "invalid_drafts",
        "Draft results must be an array.",
      );
    this.#draftResults = structuredClone(results);
  }
  setBatchReports(reports) {
    if (!Array.isArray(reports))
      throw new ProductionDashboardError(
        "invalid_batches",
        "Batch reports must be an array.",
      );
    this.#batchReports = structuredClone(reports);
  }
  setQualityReports(reports) {
    if (!Array.isArray(reports))
      throw new ProductionDashboardError(
        "invalid-quality",
        "Quality reports must be an array.",
      );
    this.#qualityReports = structuredClone(reports);
  }
  async snapshot() {
    const jobs = this.#jobQueue?.list?.() || [],
      jobStats = this.#jobQueue?.statistics?.() || this.#emptyJobs();
    const researchStats =
        this.#researchQueue?.statistics?.() || this.#emptyResearch(),
      reviews = this.#reviewWorkflow?.list?.() || [];
    const imports = this.#safeImport?.listManifests
        ? await this.#safeImport.listManifests()
        : [],
      backups = this.#backupRollback?.list
        ? await this.#backupRollback.list()
        : [],
      backupHistory = this.#backupRollback?.history
        ? await this.#backupRollback.history()
        : [];
    const plannedTopics = this.#topicPlans.reduce(
        (sum, plan) => sum + plan.topics.length,
        0,
      ),
      existingTopics = this.#topicPlans.reduce(
        (sum, plan) =>
          sum +
          plan.topics.filter((topic) => topic.existingRuntimeEntry).length,
        0,
      );
    const generatedIds = new Set(
        this.#draftResults.flatMap((result) =>
          result.drafts.map((draft) => draft.id),
        ),
      ),
      generatedTopics = this.#topicPlans.reduce(
        (sum, plan) =>
          sum +
          plan.topics.filter((topic) => generatedIds.has(topic.id)).length,
        0,
      ),
      completedTopics = existingTopics + generatedTopics;
    const draftReferences = this.#draftResults.flatMap(
        (result) => result.drafts,
      ),
      skippedDrafts = this.#draftResults.flatMap(
        (result) => result.skipped || [],
      );
    const reviewStatuses = counts(reviews, [
        "awaiting-review",
        "in-review",
        "revision-requested",
        "approved",
        "rejected",
      ]),
      reviewRounds = reviews.reduce((sum, item) => sum + item.rounds.length, 0),
      reviewComments = reviews.reduce(
        (sum, item) =>
          sum +
          item.rounds.reduce(
            (total, round) => total + round.comments.length,
            0,
          ),
        0,
      );
    const validationPassed = this.#batchReports.filter(
        (report) => report.validForPublishing,
      ).length,
      validationFindings = this.#batchReports.flatMap(
        (report) => report.findings || [],
      ),
      backupRestores = backupHistory.filter((event) =>
        ["backup-restored", "automatic-rollback"].includes(event.action),
      );
    const stagePercentages = [
      percentage(completedTopics, plannedTopics),
      percentage(
        researchStats.byStatus?.verified || 0,
        researchStats.total || 0,
      ),
      percentage(reviewStatuses.approved || 0, reviews.length),
      percentage(validationPassed, this.#batchReports.length),
    ];
    const snapshot = {
      version: 1,
      generatedAt: this.#clock().toISOString(),
      jobQueue: {
        ...jobStats,
        jobs: jobs.length,
        completionPercentage: percentage(
          jobStats.byStatus?.completed || 0,
          jobStats.total || 0,
        ),
      },
      topicPlanner: {
        plans: this.#topicPlans.length,
        plannedTopics,
        existingRuntimeTopics: existingTopics,
        generatedTopics,
        completedTopics,
        remainingTopics: Math.max(0, plannedTopics - completedTopics),
        monthlyProductionBatches: this.#topicPlans.reduce(
          (sum, plan) => sum + plan.monthlyPlans.length,
          0,
        ),
        completionPercentage: percentage(completedTopics, plannedTopics),
        plansByPack: this.#topicPlans.map((plan) => ({
          planId: plan.id,
          packId: plan.packId,
          planned: plan.topics.length,
          completed: plan.topics.filter(
            (topic) => topic.existingRuntimeEntry || generatedIds.has(topic.id),
          ).length,
        })),
      },
      draftGenerator: {
        generationRuns: this.#draftResults.length,
        draftsGenerated: draftReferences.length,
        skippedDrafts: skippedDrafts.length,
        regenerations: draftReferences.filter((draft) => draft.regeneration > 1)
          .length,
        packs: [
          ...new Set(this.#draftResults.map((result) => result.sourcePack)),
        ].length,
      },
      researchQueue: {
        ...researchStats,
        verifiedPercentage: percentage(
          researchStats.byStatus?.verified || 0,
          researchStats.total || 0,
        ),
        rejectedPercentage: percentage(
          researchStats.byStatus?.rejected || 0,
          researchStats.total || 0,
        ),
      },
      humanReview: {
        totalCases: reviews.length,
        byStatus: reviewStatuses,
        rounds: reviewRounds,
        comments: reviewComments,
        publishableCases: reviews.filter((item) =>
          this.#reviewWorkflow?.canPublish?.(item.draftId),
        ).length,
        approvalPercentage: percentage(
          reviewStatuses.approved || 0,
          reviews.length,
        ),
      },
      batchValidation: {
        reports: this.#batchReports.length,
        passed: validationPassed,
        failed: this.#batchReports.length - validationPassed,
        passPercentage: percentage(validationPassed, this.#batchReports.length),
        findings: {
          critical: validationFindings.filter(
            (item) => item.severity === "critical",
          ).length,
          error: validationFindings.filter((item) => item.severity === "error")
            .length,
          warning: validationFindings.filter(
            (item) => item.severity === "warning",
          ).length,
          information: validationFindings.filter(
            (item) => item.severity === "information",
          ).length,
        },
        latest: this.#batchReports.at(-1)
          ? {
              batchId: this.#batchReports.at(-1).batchId,
              validForPublishing: this.#batchReports.at(-1).validForPublishing,
            }
          : null,
      },
      safeImport: {
        imports: imports.length,
        recordsImported: imports.reduce(
          (sum, item) => sum + (item.importedRecordIds?.length || 0),
          0,
        ),
        latestImport: imports.at(-1)
          ? {
              importId: imports.at(-1).importId,
              completedAt: imports.at(-1).completedAt,
              runtimeCountAfter: imports.at(-1).runtimeCountAfter,
            }
          : null,
        history: imports.map((item) => ({
          importId: item.importId,
          batchId: item.batchId,
          completedAt: item.completedAt,
          records: item.importedRecordIds?.length || 0,
        })),
      },
      backupRollback: {
        snapshots: backups.length,
        fullSnapshots: backups.filter((item) => item.type === "full").length,
        incrementalSnapshots: backups.filter(
          (item) => item.type === "incremental",
        ).length,
        restores: backupRestores.length,
        automaticRollbacks: backupRestores.filter(
          (item) => item.action === "automatic-rollback",
        ).length,
        latestSnapshot: backups.at(-1)
          ? {
              versionId: backups.at(-1).versionId,
              type: backups.at(-1).type,
              createdAt: backups.at(-1).createdAt,
            }
          : null,
        history: backupHistory,
      },
      knowledgeQuality: {
        entries: this.#qualityReports.length,
        averageScore: this.#qualityReports.length
          ? Number(
              (
                this.#qualityReports.reduce(
                  (sum, item) => sum + item.totalScore,
                  0,
                ) / this.#qualityReports.length
              ).toFixed(1),
            )
          : 0,
        belowTarget: this.#qualityReports.filter((item) => item.totalScore < 70)
          .length,
        byBand: counts(
          this.#qualityReports.map((item) => ({ status: item.band })),
          ["excellent", "good", "needs-improvement", "critical"],
        ),
        reports: this.#qualityReports,
      },
      overall: {
        plannedTopics,
        draftsGenerated: draftReferences.length,
        researchTasks: researchStats.total || 0,
        verifiedResearchTasks: researchStats.byStatus?.verified || 0,
        reviewCases: reviews.length,
        approvedReviews: reviewStatuses.approved || 0,
        validationReports: this.#batchReports.length,
        validatedBatches: validationPassed,
        imports: imports.length,
        recordsImported: imports.reduce(
          (sum, item) => sum + (item.importedRecordIds?.length || 0),
          0,
        ),
        completedJobs: jobStats.byStatus?.completed || 0,
        averageKnowledgeQuality: this.#qualityReports.length
          ? Number(
              (
                this.#qualityReports.reduce(
                  (sum, item) => sum + item.totalScore,
                  0,
                ) / this.#qualityReports.length
              ).toFixed(1),
            )
          : 0,
        productionCompletionPercentage: Number(
          (
            stagePercentages.reduce((sum, value) => sum + value, 0) /
            stagePercentages.length
          ).toFixed(1),
        ),
      },
    };
    return deepFreeze(snapshot);
  }
  async exportJson(file) {
    if (!file)
      throw new ProductionDashboardError(
        "invalid_export",
        "A dashboard JSON path is required.",
      );
    const snapshot = await this.snapshot();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(
      temporary,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(temporary, file);
    return file;
  }
  #emptyJobs() {
    return {
      total: 0,
      byStatus: {
        pending: 0,
        planned: 0,
        drafting: 0,
        research: 0,
        review: 0,
        validation: 0,
        import: 0,
        completed: 0,
        failed: 0,
      },
      byPriority: { low: 0, normal: 0, high: 0, critical: 0 },
      active: 0,
      paused: 0,
      cancelled: 0,
      ready: 0,
      blockedByDependencies: 0,
      retries: 0,
    };
  }
  #emptyResearch() {
    return {
      total: 0,
      byStatus: { pending: 0, researching: 0, verified: 0, rejected: 0 },
      byCategory: {},
      evidenceItems: 0,
      averageConfidence: 0,
    };
  }
}
