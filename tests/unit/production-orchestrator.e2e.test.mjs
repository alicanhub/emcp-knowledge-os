import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonJobQueue } from "../../production-engine/job-queue/json-job-queue.js";
import {
  JsonProductionOrchestrator,
  PRODUCTION_STAGES,
} from "../../production-engine/orchestrator/production-orchestrator.js";

const clock = () => new Date("2026-07-14T21:00:00.000Z");
const pack = { id: "pack.004", title: { en: "Pack Four", tr: "Paket Dört" } };
const topics = [
  {
    id: "topic.one",
    title: { en: "Topic One", tr: "Konu Bir" },
    difficulty: "beginner",
  },
];

async function fixture(
  t,
  { researchVerified = true, failBackup = false, withAIWriter = false } = {},
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-orchestrator-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const queue = new JsonJobQueue(path.join(root, "queue.json"), { clock });
  const calls = [];
  const plan = {
    schemaVersion: 1,
    id: "plan.pack.004",
    packId: "pack.004",
    packTitle: pack.title,
    generatedAt: clock().toISOString(),
    prerequisites: [],
    topics: [
      {
        ...topics[0],
        learningOrder: 1,
        existingRuntimeEntry: false,
        runtimeEntryId: null,
        estimatedDraftHours: 2,
      },
    ],
    duplicates: [],
    statistics: {
      proposedCount: 1,
      uniqueTopicCount: 1,
      existingRuntimeCount: 0,
      estimatedDraftCount: 1,
      estimatedWorkloadHours: 2,
      monthlyPlanCount: 1,
    },
    monthlyPlans: [
      {
        month: "2026-08",
        topicIds: ["topic.one"],
        draftCount: 1,
        estimatedHours: 2,
      },
    ],
  };
  const draft = {
    id: "topic.one",
    draft_id: "topic.one.draft.001",
    path: path.join(root, "draft.json"),
    planner_job_id: "job.cycle.one",
    source_pack: "pack.004",
    version: "1.0.0",
    generated_at: clock().toISOString(),
    updated_at: clock().toISOString(),
    reviewStatus: "draft",
    regeneration: 1,
  };
  const draftResult = {
    plannerJobId: "job.cycle.one",
    sourcePack: "pack.004",
    generatedAt: clock().toISOString(),
    drafts: [draft],
    skipped: [],
    reviewedRecordsCreated: 0,
  };
  let researchStatus = researchVerified ? "verified" : "pending";
  const tasks = Array.from({ length: 9 }, (_, index) => ({
    id: `research.${index}`,
    draftId: draft.draft_id,
    status: researchStatus,
  }));
  const reviewCase = {
    draftId: draft.draft_id,
    status: "approved",
    rounds: [],
  };
  const validation = {
    version: 1,
    batchId: "batch.cycle.one",
    sourcePack: "pack.004",
    plannerJobId: "job.cycle.one",
    generatedAt: clock().toISOString(),
    counts: { drafts: 1, critical: 0, errors: 0, warnings: 0, information: 0 },
    findings: [],
    validForPublishing: true,
  };
  const services = {
    clock,
    jobQueue: queue,
    topicPlanner: {
      generate: () => (calls.push("plan"), structuredClone(plan)),
      enqueue: async (_plan, request) => {
        calls.push("queue");
        await queue.create({ id: request.jobId, title: "Production cycle" });
        return queue.transition(request.jobId, "planned");
      },
    },
    draftGenerator: {
      generateFromQueue: async (jobId) => {
        calls.push("draft");
        await queue.transition(jobId, "drafting");
        return structuredClone(draftResult);
      },
    },
    researchQueue: {
      list: ({ draftId }) =>
        draftId === draft.draft_id
          ? tasks.map((item) => ({ ...item, status: researchStatus }))
          : [],
      createForDrafts: async () => (calls.push("research"), tasks),
      statistics: () => ({
        total: 9,
        byStatus: {
          pending: researchStatus === "pending" ? 9 : 0,
          researching: 0,
          verified: researchStatus === "verified" ? 9 : 0,
          rejected: 0,
        },
      }),
    },
    humanReview: {
      get: () => reviewCase,
      create: async () => reviewCase,
      canPublish: () => true,
    },
    batchValidator: {
      validateJob: async () => (
        calls.push("validate"),
        structuredClone(validation)
      ),
    },
    safeImport: {
      import: async () => {
        calls.push("import");
        return {
          version: 1,
          importId: "import.cycle.one",
          batchId: validation.batchId,
          importedRecordIds: ["topic.one"],
          backupVersionId: "backup.pre-import",
        };
      },
    },
    backupRollback: {
      createSnapshot: async () => {
        calls.push("backup");
        if (failBackup) throw new Error("Backup storage unavailable");
        return {
          operation: "backup",
          manifest: { versionId: "post-import.cycle.one" },
        };
      },
      restore: async (versionId) => (
        calls.push(`restore:${versionId}`),
        { operation: "restore", versionId }
      ),
    },
    dashboard: {
      setTopicPlans: () => calls.push("dashboard:plans"),
      setDraftResults: () => calls.push("dashboard:drafts"),
      setBatchReports: () => calls.push("dashboard:batches"),
      snapshot: async () => (
        calls.push("dashboard"),
        {
          version: 1,
          generatedAt: clock().toISOString(),
          jobQueue: {},
          overall: {},
        }
      ),
    },
    maintenance: {
      run: async () => (
        calls.push("maintenance"),
        {
          version: 1,
          reportId: "maintenance.2026-07",
          healthy: true,
          findings: [],
        }
      ),
    },
  };
  if (withAIWriter)
    services.aiDraftWriter = {
      write: async (request) => {
        calls.push("ai-draft-writer");
        return {
          version: 1,
          writerVersion: "1.0.0",
          generatedAt: clock().toISOString(),
          deterministic: request.deterministic,
          providerId: null,
          draftResult: request.draftResult,
          quality: [
            {
              draftId: request.draftResult.drafts[0].draft_id,
              evidenceCoveragePercentage: 0,
              knowledgeQuality: {
                version: 1,
                entryId: "topic.one",
                generatedAt: clock().toISOString(),
                totalScore: 60,
                band: "needs-improvement",
                categories: {},
                recommendations: [],
              },
            },
          ],
        };
      },
    };
  const orchestrator = new JsonProductionOrchestrator(services);
  const request = {
    cycleId: "cycle.one",
    pack,
    topics,
    reviewers: ["reviewer@example.com"],
    approvedBy: "editor@example.com",
    stateFile: path.join(root, "cycle.state.json"),
    reportFile: path.join(root, "cycle.report.json"),
  };
  return {
    root,
    queue,
    calls,
    orchestrator,
    request,
    setResearchVerified: () => {
      researchStatus = "verified";
    },
  };
}

test("runs the complete production workflow and emits ordered events", async (t) => {
  const { orchestrator, request, calls } = await fixture(t);
  const observed = [];
  const report = await orchestrator.run({
    ...request,
    onEvent: (event) => observed.push(event),
  });
  assert.equal(report.status, "completed");
  assert.deepEqual(report.completedStages, PRODUCTION_STAGES);
  assert.equal(report.progressPercentage, 100);
  assert.equal(report.outputs["safe-import"].importedRecordIds.length, 1);
  assert.equal(report.outputs["monthly-maintenance"].healthy, true);
  assert.equal(observed[0].type, "cycle-started");
  assert.equal(observed.at(-1).type, "cycle-completed");
  assert.deepEqual(
    observed.map((event) => event.sequence),
    observed.map((_, index) => index + 1),
  );
  assert.ok(calls.includes("maintenance"));
  const stored = JSON.parse(await fs.readFile(request.reportFile, "utf8"));
  assert.equal(stored.status, "completed");
});

test("supports partial execution and checkpoint resume", async (t) => {
  const { orchestrator, request, calls } = await fixture(t);
  const partial = await orchestrator.run({
    ...request,
    toStage: "topic-planner",
  });
  assert.equal(partial.status, "partial");
  assert.deepEqual(partial.completedStages, [
    "load-content-pack",
    "topic-planner",
  ]);
  const resumed = await orchestrator.run(request);
  assert.equal(resumed.status, "completed");
  assert.equal(calls.filter((call) => call === "plan").length, 1);
  assert.ok(resumed.events.some((event) => event.type === "cycle-resumed"));
});

test("pauses for research and resumes without repeating completed stages", async (t) => {
  const { orchestrator, request, setResearchVerified } = await fixture(t, {
    researchVerified: false,
  });
  const paused = await orchestrator.run(request);
  assert.equal(paused.status, "awaiting-input");
  assert.equal(paused.currentStage, "human-review");
  setResearchVerified();
  const resumed = await orchestrator.run(request);
  assert.equal(resumed.status, "completed");
  assert.equal(
    resumed.events.filter((event) => event.type === "stage-paused").length,
    1,
  );
});

test("dry run plans all stages without mutating production services", async (t) => {
  const { orchestrator, request, queue, calls } = await fixture(t);
  const report = await orchestrator.run({ ...request, dryRun: true });
  assert.equal(report.status, "completed");
  assert.equal(report.dryRun, true);
  assert.equal(queue.statistics().total, 0);
  assert.equal(calls.includes("draft"), false);
  assert.equal(calls.includes("import"), false);
  assert.equal(calls.includes("backup"), false);
  assert.equal(calls.includes("maintenance"), false);
});

test("automatically rolls back a completed import when a later stage fails", async (t) => {
  const { orchestrator, request, calls } = await fixture(t, {
    failBackup: true,
  });
  const report = await orchestrator.run(request);
  assert.equal(report.status, "failed");
  assert.equal(report.error.stage, "backup-rollback");
  assert.equal(report.rollback.completed, true);
  assert.ok(calls.includes("restore:backup.pre-import"));
  assert.ok(report.events.some((event) => event.type === "rollback-completed"));
});

test("runs the optional evidence-gated AI writer before Human Review", async (t) => {
  const { orchestrator, request, calls } = await fixture(t, {
    withAIWriter: true,
  });
  const report = await orchestrator.run({
    ...request,
    deterministicDrafts: true,
  });
  assert.equal(report.status, "completed");
  assert.equal(report.outputs["ai-draft-writer"].deterministic, true);
  assert.equal(report.outputs["knowledge-quality"][0].totalScore, 60);
  assert.equal(calls.filter((item) => item === "ai-draft-writer").length, 1);
  assert.ok(
    calls.indexOf("ai-draft-writer") < calls.indexOf("validate"),
    "writer must run before validation",
  );
});
