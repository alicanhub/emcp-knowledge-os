import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonJobQueue } from "../../production-engine/job-queue/json-job-queue.js";
import {
  JsonProductionDashboard,
  ProductionDashboardError,
} from "../../production-engine/dashboard/production-dashboard.js";

const clock = () => new Date("2026-07-14T19:00:00.000Z");
const plan = {
  schemaVersion: 1,
  id: "plan.pack.004",
  packId: "pack.004",
  packTitle: { en: "Pack", tr: "Paket" },
  generatedAt: "2026-07-14T18:00:00.000Z",
  prerequisites: [],
  duplicates: [],
  statistics: {
    proposedCount: 2,
    uniqueTopicCount: 2,
    existingRuntimeCount: 1,
    estimatedDraftCount: 1,
    estimatedWorkloadHours: 2,
    monthlyPlanCount: 1,
  },
  monthlyPlans: [
    {
      month: "2026-08",
      topicIds: ["topic.new"],
      draftCount: 1,
      estimatedHours: 2,
    },
  ],
  topics: [
    {
      id: "topic.existing",
      title: { en: "Existing", tr: "Mevcut" },
      difficulty: "beginner",
      prerequisites: [],
      learningOrder: 1,
      existingRuntimeEntry: true,
      runtimeEntryId: "runtime.existing",
      estimatedDraftHours: 0,
    },
    {
      id: "topic.new",
      title: { en: "New", tr: "Yeni" },
      difficulty: "beginner",
      prerequisites: [],
      learningOrder: 2,
      existingRuntimeEntry: false,
      runtimeEntryId: null,
      estimatedDraftHours: 2,
    },
  ],
};
const draftResult = {
  plannerJobId: "job.dashboard",
  sourcePack: "pack.004",
  generatedAt: "2026-07-14T18:10:00.000Z",
  drafts: [
    {
      id: "topic.new",
      path: "/drafts/topic.new.json",
      reviewStatus: "draft",
      regeneration: 1,
      draft_id: "topic.new.draft.001",
      source_pack: "pack.004",
      planner_job_id: "job.dashboard",
      version: "1.0.0",
      generated_at: "2026-07-14T18:10:00.000Z",
      updated_at: "2026-07-14T18:10:00.000Z",
    },
  ],
  skipped: [{ id: "topic.existing", reason: "existing-runtime-entry" }],
  reviewedRecordsCreated: 0,
};
const reviewCase = {
  draftId: "topic.new.draft.001",
  status: "approved",
  rounds: [{ comments: [{ id: "comment.1" }] }],
};
const batchReport = {
  version: 1,
  batchId: "batch.dashboard",
  sourcePack: "pack.004",
  plannerJobId: "job.dashboard",
  generatedAt: "2026-07-14T18:30:00.000Z",
  counts: { drafts: 1, critical: 0, errors: 0, warnings: 1, information: 0 },
  findings: [
    {
      severity: "warning",
      code: "example",
      message: "Example warning",
      draftId: "topic.new.draft.001",
      field: null,
      path: null,
    },
  ],
  validForPublishing: true,
};

async function dashboardFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-dashboard-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobQueue = new JsonJobQueue(path.join(root, "jobs.json"), { clock });
  await jobQueue.create({
    id: "job.dashboard",
    title: "Dashboard job",
    priority: "high",
  });
  for (const status of [
    "planned",
    "drafting",
    "research",
    "review",
    "validation",
    "import",
    "completed",
  ])
    await jobQueue.transition("job.dashboard", status);
  const researchQueue = {
    statistics: () => ({
      total: 9,
      byStatus: { pending: 0, researching: 0, verified: 9, rejected: 0 },
      byCategory: { regulations: 1 },
      evidenceItems: 12,
      averageConfidence: 0.9,
    }),
  };
  const reviewWorkflow = {
    list: () => [structuredClone(reviewCase)],
    canPublish: () => true,
  };
  const safeImport = {
    listManifests: async () => [
      {
        importId: "import.dashboard",
        batchId: "batch.dashboard",
        completedAt: "2026-07-14T18:45:00.000Z",
        runtimeCountAfter: 379,
        importedRecordIds: ["topic.new"],
      },
    ],
  };
  const backupRollback = {
    list: async () => [
      {
        versionId: "backup.v1",
        type: "full",
        createdAt: "2026-07-14T18:40:00.000Z",
      },
      {
        versionId: "backup.v2",
        type: "incremental",
        createdAt: "2026-07-14T18:50:00.000Z",
      },
    ],
    history: async () => [
      { action: "backup-created", versionId: "backup.v1" },
      { action: "automatic-rollback", versionId: "backup.v1" },
    ],
  };
  const dashboard = new JsonProductionDashboard({
    jobQueue,
    topicPlans: [plan],
    draftResults: [draftResult],
    researchQueue,
    reviewWorkflow,
    batchReports: [batchReport],
    safeImport,
    backupRollback,
    clock,
  });
  return { root, dashboard };
}

test("aggregates every production engine layer into overall metrics", async (t) => {
  const { dashboard } = await dashboardFixture(t);
  const snapshot = await dashboard.snapshot();
  assert.equal(snapshot.jobQueue.total, 1);
  assert.equal(snapshot.jobQueue.byStatus.completed, 1);
  assert.equal(snapshot.topicPlanner.completionPercentage, 100);
  assert.equal(snapshot.draftGenerator.draftsGenerated, 1);
  assert.equal(snapshot.researchQueue.verifiedPercentage, 100);
  assert.equal(snapshot.humanReview.byStatus.approved, 1);
  assert.equal(snapshot.batchValidation.passed, 1);
  assert.equal(snapshot.safeImport.recordsImported, 1);
  assert.equal(snapshot.backupRollback.fullSnapshots, 1);
  assert.equal(snapshot.backupRollback.incrementalSnapshots, 1);
  assert.equal(snapshot.backupRollback.automaticRollbacks, 1);
  assert.equal(snapshot.overall.productionCompletionPercentage, 100);
});

test("returns immutable snapshots and protects itself from input mutation", async (t) => {
  const { dashboard } = await dashboardFixture(t);
  const supplied = structuredClone(plan);
  dashboard.setTopicPlans([supplied]);
  supplied.topics.length = 0;
  const snapshot = await dashboard.snapshot();
  assert.equal(snapshot.topicPlanner.plannedTopics, 2);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.topicPlanner.plansByPack), true);
  assert.throws(() => {
    snapshot.topicPlanner.plans = 99;
  }, TypeError);
});

test("exports dashboard snapshots as JSON and supports empty services", async (t) => {
  const { root, dashboard } = await dashboardFixture(t);
  const file = path.join(root, "reports", "dashboard.json");
  await dashboard.exportJson(file);
  const report = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(report.version, 1);
  assert.equal(report.safeImport.imports, 1);
  const empty = await new JsonProductionDashboard({ clock }).snapshot();
  assert.equal(empty.jobQueue.total, 0);
  assert.equal(empty.overall.productionCompletionPercentage, 0);
  await assert.rejects(
    () => dashboard.exportJson(""),
    (error) =>
      error instanceof ProductionDashboardError &&
      error.code === "invalid_export",
  );
});
