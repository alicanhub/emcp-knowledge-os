import * as fs from "node:fs/promises";
import * as path from "node:path";

export const PRODUCTION_STAGES = Object.freeze([
  "load-content-pack",
  "topic-planner",
  "job-queue",
  "draft-generator",
  "research-queue",
  "human-review",
  "batch-validation",
  "safe-import",
  "backup-rollback",
  "dashboard-refresh",
  "monthly-maintenance",
  "final-report",
]);

export class ProductionOrchestratorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProductionOrchestratorError";
    this.code = code;
  }
}
class OrchestratorPause extends Error {
  constructor(message, data = {}) {
    super(message);
    this.data = data;
  }
}

const copy = (value) => structuredClone(value);
const percent = (count) =>
  Number(((count / PRODUCTION_STAGES.length) * 100).toFixed(1));

export class JsonProductionOrchestrator {
  #planner;
  #jobQueue;
  #draftGenerator;
  #researchQueue;
  #humanReview;
  #batchValidator;
  #safeImport;
  #backupRollback;
  #dashboard;
  #maintenance;
  #aiDraftWriter;
  #qualityScorer;
  #clock;

  /** @param {any} services */
  constructor(services = {}) {
    const required = [
      "topicPlanner",
      "jobQueue",
      "draftGenerator",
      "researchQueue",
      "humanReview",
      "batchValidator",
      "safeImport",
      "backupRollback",
      "dashboard",
      "maintenance",
    ];
    const missing = required.filter((name) => !services[name]);
    if (missing.length)
      throw new ProductionOrchestratorError(
        "missing_services",
        `Missing production services: ${missing.join(", ")}`,
      );
    this.#planner = services.topicPlanner;
    this.#jobQueue = services.jobQueue;
    this.#draftGenerator = services.draftGenerator;
    this.#researchQueue = services.researchQueue;
    this.#humanReview = services.humanReview;
    this.#batchValidator = services.batchValidator;
    this.#safeImport = services.safeImport;
    this.#backupRollback = services.backupRollback;
    this.#dashboard = services.dashboard;
    this.#maintenance = services.maintenance;
    this.#aiDraftWriter = services.aiDraftWriter || null;
    this.#qualityScorer = services.qualityScorer || null;
    this.#clock = services.clock || (() => new Date());
  }

  /** @param {any} request */
  async run(request) {
    this.#assertRequest(request);
    const state = await this.#loadOrCreateState(request);
    const from = request.fromStage
      ? PRODUCTION_STAGES.indexOf(request.fromStage)
      : 0;
    const to = request.toStage
      ? PRODUCTION_STAGES.indexOf(request.toStage)
      : PRODUCTION_STAGES.length - 1;
    if (from > to)
      throw new ProductionOrchestratorError(
        "invalid_range",
        "fromStage must not follow toStage.",
      );
    this.#event(
      state,
      state.events.length ? "cycle-resumed" : "cycle-started",
      null,
      `Production cycle ${state.events.length ? "resumed" : "started"}.`,
      {},
      request,
    );
    state.status = "running";
    await this.#persist(state, request.stateFile);

    for (let index = from; index <= to; index++) {
      const stage = PRODUCTION_STAGES[index];
      if (state.completedStages.includes(stage)) {
        this.#event(
          state,
          "stage-skipped",
          stage,
          "Stage restored from checkpoint.",
          { reason: "already-completed" },
          request,
        );
        continue;
      }
      if (
        index > 0 &&
        from === 0 &&
        !state.completedStages.includes(PRODUCTION_STAGES[index - 1])
      )
        break;
      state.currentStage = stage;
      this.#event(
        state,
        "stage-started",
        stage,
        `Started ${stage}.`,
        {},
        request,
      );
      await this.#persist(state, request.stateFile);
      try {
        const output = await this.#execute(stage, state, request);
        state.outputs[stage] = output;
        state.completedStages.push(stage);
        state.currentStage = null;
        this.#event(
          state,
          "stage-completed",
          stage,
          `Completed ${stage}.`,
          this.#summary(stage, output),
          request,
        );
        await this.#persist(state, request.stateFile);
      } catch (error) {
        if (error instanceof OrchestratorPause) {
          state.status = "awaiting-input";
          this.#event(
            state,
            "stage-paused",
            stage,
            error.message,
            error.data,
            request,
          );
          await this.#persist(state, request.stateFile);
          return this.#finish(state, request, "awaiting-input");
        }
        state.status = "failed";
        state.error = { stage, name: error.name, message: error.message };
        this.#event(
          state,
          "stage-failed",
          stage,
          error.message,
          { name: error.name },
          request,
        );
        await this.#rollback(state, request);
        await this.#persist(state, request.stateFile);
        return this.#finish(state, request, "failed");
      }
    }
    const completed = state.completedStages.length === PRODUCTION_STAGES.length;
    return this.#finish(state, request, completed ? "completed" : "partial");
  }

  async #execute(stage, state, request) {
    if (stage === "load-content-pack") {
      const document = request.contentPackFile
        ? JSON.parse(await fs.readFile(request.contentPackFile, "utf8"))
        : { pack: request.pack, topics: request.topics };
      const pack = document.pack || document;
      const topics = document.topics || request.topics || [];
      if (!pack?.id || !pack?.title || !Array.isArray(topics))
        throw new ProductionOrchestratorError(
          "invalid_pack",
          "Content Pack must contain an id, bilingual title and topics.",
        );
      return { pack, topics, source: request.contentPackFile || "request" };
    }
    const loaded = state.outputs["load-content-pack"];
    if (stage === "topic-planner")
      return this.#planner.generate({
        pack: loaded.pack,
        topics: loaded.topics,
      });
    if (stage === "job-queue") {
      if (request.dryRun)
        return {
          dryRun: true,
          jobId: this.#jobId(state),
          action: "create-job",
        };
      const enqueued = await this.#planner.enqueue(
        state.outputs["topic-planner"],
        {
          jobId: this.#jobId(state),
        },
      );
      return this.#jobQueue.get(this.#jobId(state)) || enqueued;
    }
    if (stage === "draft-generator") {
      if (request.dryRun)
        return {
          dryRun: true,
          action: "generate-drafts",
          estimatedDraftCount:
            state.outputs["topic-planner"].statistics.estimatedDraftCount,
        };
      return this.#draftGenerator.generateFromQueue(this.#jobId(state));
    }
    if (stage === "research-queue") {
      if (request.dryRun)
        return { dryRun: true, action: "create-research-tasks" };
      const drafts = state.outputs["draft-generator"];
      const existing = drafts.drafts.flatMap((draft) =>
        this.#researchQueue.list({ draftId: draft.draft_id }),
      );
      const expected = drafts.drafts.length * 9;
      const tasks =
        existing.length === expected
          ? existing
          : await this.#researchQueue.createForDrafts(drafts);
      return { tasks, statistics: this.#researchQueue.statistics() };
    }
    if (stage === "human-review") {
      if (request.dryRun) return { dryRun: true, action: "await-human-review" };
      const drafts = state.outputs["draft-generator"].drafts;
      const pendingResearch = drafts.filter((draft) =>
        this.#researchQueue
          .list({ draftId: draft.draft_id })
          .some((task) => task.status !== "verified"),
      );
      if (pendingResearch.length)
        throw new OrchestratorPause(
          "Research verification is required before editorial review.",
          { draftIds: pendingResearch.map((draft) => draft.draft_id) },
        );
      if (this.#aiDraftWriter && !state.outputs["ai-draft-writer"]) {
        const written = await this.#aiDraftWriter.write({
          plannerJobId: this.#jobId(state),
          plan: state.outputs["topic-planner"],
          draftResult: state.outputs["draft-generator"],
          deterministic: request.deterministicDrafts !== false,
        });
        state.outputs["ai-draft-writer"] = written;
        state.outputs["draft-generator"] = written.draftResult;
        const quality = written.quality
          .map((item) => item.knowledgeQuality)
          .filter(Boolean);
        if (quality.length) state.outputs["knowledge-quality"] = quality;
      }
      if (this.#qualityScorer && !state.outputs["knowledge-quality"]) {
        state.outputs["knowledge-quality"] = await Promise.all(
          drafts.map(async (draft) =>
            this.#qualityScorer.score(
              JSON.parse(await fs.readFile(draft.path, "utf8")),
              { evidenceCoveragePercentage: 100 },
            ),
          ),
        );
      }
      const cases = [];
      for (const draft of drafts) {
        let reviewCase = this.#humanReview.get(draft.draft_id);
        if (!reviewCase)
          reviewCase = await this.#humanReview.create(
            draft,
            request.reviewers || [],
            request.approvedBy || "production-orchestrator",
          );
        cases.push(reviewCase);
      }
      const awaitingApproval = cases.filter(
        (item) => !this.#humanReview.canPublish(item.draftId),
      );
      if (awaitingApproval.length)
        throw new OrchestratorPause(
          "Human approval is required before validation.",
          { draftIds: awaitingApproval.map((item) => item.draftId) },
        );
      return { cases };
    }
    if (stage === "batch-validation") {
      if (request.dryRun) return { dryRun: true, action: "validate-batch" };
      return this.#batchValidator.validateJob(
        this.#jobId(state),
        state.outputs["draft-generator"],
        `batch.${state.cycleId}`,
      );
    }
    if (stage === "safe-import") {
      if (request.dryRun) return { dryRun: true, action: "safe-import" };
      return this.#safeImport.import({
        draftResult: state.outputs["draft-generator"],
        validationReport: state.outputs["batch-validation"],
        approvedBy: request.approvedBy || "production-orchestrator",
        importId: `import.${state.cycleId}`,
      });
    }
    if (stage === "backup-rollback") {
      if (request.dryRun) return { dryRun: true, action: "post-import-backup" };
      return this.#backupRollback.createSnapshot({
        type: "incremental",
        versionId: `post-import.${state.cycleId}`,
      });
    }
    if (stage === "dashboard-refresh") {
      const plan = state.outputs["topic-planner"];
      if (plan && !request.dryRun) this.#dashboard.setTopicPlans([plan]);
      const drafts = state.outputs["draft-generator"];
      if (drafts && !request.dryRun) this.#dashboard.setDraftResults([drafts]);
      const validation = state.outputs["batch-validation"];
      if (validation && !request.dryRun)
        this.#dashboard.setBatchReports([validation]);
      const quality = state.outputs["knowledge-quality"];
      if (quality && !request.dryRun)
        this.#dashboard.setQualityReports?.(quality);
      return this.#dashboard.snapshot();
    }
    if (stage === "monthly-maintenance") {
      if (request.dryRun)
        return { dryRun: true, action: "monthly-maintenance" };
      return this.#maintenance.run({
        period: this.#clock().toISOString().slice(0, 7),
      });
    }
    return {
      cycleId: state.cycleId,
      stagesCompleted: state.completedStages.length + 1,
      importedRecords:
        state.outputs["safe-import"]?.importedRecordIds?.length || 0,
      maintenanceHealthy: state.outputs["monthly-maintenance"]?.healthy ?? null,
    };
  }

  async #loadOrCreateState(request) {
    try {
      const state = JSON.parse(await fs.readFile(request.stateFile, "utf8"));
      if (state.version !== 1 || state.cycleId !== request.cycleId)
        throw new ProductionOrchestratorError(
          "state_mismatch",
          "Checkpoint does not match this production cycle.",
        );
      if (state.dryRun !== Boolean(request.dryRun))
        throw new ProductionOrchestratorError(
          "mode_mismatch",
          "Cannot resume a cycle in a different dry-run mode.",
        );
      return state;
    } catch (error) {
      if (error instanceof ProductionOrchestratorError) throw error;
      if (error.code !== "ENOENT")
        throw new ProductionOrchestratorError(
          "invalid_state",
          `Cannot load checkpoint: ${error.message}`,
        );
    }
    const now = this.#clock().toISOString();
    return {
      version: 1,
      cycleId: request.cycleId,
      dryRun: Boolean(request.dryRun),
      status: "pending",
      startedAt: now,
      updatedAt: now,
      currentStage: null,
      completedStages: [],
      outputs: {},
      events: [],
      rollback: { attempted: false, completed: false, versionId: null },
      error: null,
    };
  }

  async #finish(state, request, status) {
    state.status = status;
    state.currentStage =
      status === "awaiting-input" ? state.currentStage : null;
    state.updatedAt = this.#clock().toISOString();
    if (status === "completed")
      this.#event(
        state,
        "cycle-completed",
        null,
        "Production cycle completed.",
        {},
        request,
      );
    await this.#persist(state, request.stateFile);
    const report = this.#report(state, status);
    await this.#writeJson(request.reportFile, report);
    return report;
  }

  async #rollback(state, request) {
    const imported = state.outputs["safe-import"];
    const versionId = imported?.backupVersionId;
    if (!versionId || request.dryRun) return;
    state.rollback = { attempted: true, completed: false, versionId };
    this.#event(
      state,
      "rollback-started",
      "backup-rollback",
      `Restoring ${versionId}.`,
      { versionId },
      request,
    );
    try {
      const report = await this.#backupRollback.restore(versionId, {
        automatic: true,
      });
      state.rollback = { attempted: true, completed: true, versionId, report };
      this.#event(
        state,
        "rollback-completed",
        "backup-rollback",
        `Restored ${versionId}.`,
        { versionId },
        request,
      );
    } catch (error) {
      state.rollback = {
        attempted: true,
        completed: false,
        versionId,
        error: error.message,
      };
      this.#event(
        state,
        "rollback-failed",
        "backup-rollback",
        error.message,
        { versionId },
        request,
      );
    }
  }

  #report(state, status) {
    return {
      version: 1,
      cycleId: state.cycleId,
      status,
      dryRun: state.dryRun,
      startedAt: state.startedAt,
      completedAt: this.#clock().toISOString(),
      progressPercentage: percent(state.completedStages.length),
      completedStages: copy(state.completedStages),
      pendingStages: PRODUCTION_STAGES.filter(
        (stage) => !state.completedStages.includes(stage),
      ),
      currentStage: state.currentStage,
      events: copy(state.events),
      outputs: copy(state.outputs),
      rollback: copy(state.rollback),
      error: state.error ? copy(state.error) : null,
    };
  }

  #event(state, type, stage, message, data, request) {
    const event = {
      sequence: state.events.length + 1,
      timestamp: this.#clock().toISOString(),
      cycleId: state.cycleId,
      stage,
      type,
      progressPercentage: percent(state.completedStages.length),
      message,
      data: copy(data),
    };
    state.events.push(event);
    request.onEvent?.(copy(event));
  }
  #jobId(state) {
    return `job.${state.cycleId}`;
  }
  #summary(stage, output) {
    if (stage === "topic-planner") return { topics: output.topics.length };
    if (stage === "draft-generator")
      return { drafts: output.drafts?.length || 0 };
    if (stage === "research-queue") return { tasks: output.tasks?.length || 0 };
    if (stage === "batch-validation")
      return { valid: output.validForPublishing ?? null };
    if (stage === "safe-import")
      return { imported: output.importedRecordIds?.length || 0 };
    return {};
  }
  #assertRequest(request) {
    if (!request?.cycleId || !request.stateFile || !request.reportFile)
      throw new ProductionOrchestratorError(
        "invalid_request",
        "cycleId, stateFile and reportFile are required.",
      );
    for (const stage of [request.fromStage, request.toStage])
      if (stage && !PRODUCTION_STAGES.includes(stage))
        throw new ProductionOrchestratorError(
          "invalid_stage",
          `Unknown production stage: ${stage}`,
        );
  }
  async #persist(state, file) {
    state.updatedAt = this.#clock().toISOString();
    await this.#writeJson(file, state);
  }
  async #writeJson(file, value) {
    const target = path.resolve(file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${process.pid}`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
    await fs.rename(temporary, target);
  }
}
