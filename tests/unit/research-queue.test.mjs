import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonDraftGenerator } from "../../production-engine/draft-generator/draft-generator.js";
import { JsonJobQueue } from "../../production-engine/job-queue/json-job-queue.js";
import {
  JsonResearchQueue,
  RESEARCH_CATEGORIES,
} from "../../production-engine/research-queue/research-queue.js";
import { JsonTopicPlanner } from "../../production-engine/topic-planner/topic-planner.js";

const clock = () => new Date("2026-07-14T14:00:00.000Z");
const draftResult = {
  plannerJobId: "job.plan-004",
  sourcePack: "pack.004",
  generatedAt: "2026-07-14T12:00:00.000Z",
  drafts: [
    {
      id: "finance.test",
      path: "/drafts/finance.test.json",
      reviewStatus: "draft",
      regeneration: 1,
      draft_id: "finance.test.draft.001",
      source_pack: "pack.004",
      planner_job_id: "job.plan-004",
      version: "1.0.0",
      generated_at: "2026-07-14T12:00:00.000Z",
      updated_at: "2026-07-14T12:00:00.000Z",
    },
  ],
  skipped: [],
  reviewedRecordsCreated: 0,
};
const evidence = {
  field: "uk_practice",
  title: "Official guidance",
  publisher: "GOV.UK",
  url: "https://www.gov.uk/example",
  accessedAt: "2026-07-14",
  publishedAt: null,
  jurisdiction: "United Kingdom",
  official: true,
  note: "Supports the field after human review.",
};

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-research-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "research.json");
  return { root, file, queue: new JsonResearchQueue(file, { clock }) };
}

test("creates every research category for each generated draft", async (t) => {
  const { queue } = await fixture(t);
  const created = await queue.createForDrafts(draftResult);
  assert.equal(created.length, 9);
  assert.deepEqual(
    new Set(created.map((task) => task.category)),
    new Set(RESEARCH_CATEGORIES),
  );
  assert.ok(
    created.every(
      (task) => task.status === "pending" && task.confidenceScore === 0,
    ),
  );
  assert.equal((await queue.createForDrafts(draftResult)).length, 0);
  assert.equal(queue.statistics().byStatus.pending, 9);
});

test("stores multiple evidence items and verifies with confidence", async (t) => {
  const { queue } = await fixture(t);
  const [task] = await queue.createForDrafts(draftResult);
  await queue.transition(task.id, "researching");
  await queue.addEvidence(task.id, evidence);
  const withTwo = await queue.addEvidence(task.id, {
    ...evidence,
    field: "risks",
    title: "Second source",
    url: "https://www.gov.uk/second",
  });
  assert.equal(withTwo.evidence.length, 2);
  assert.equal(withTwo.evidence[1].id.endsWith("evidence.002"), true);
  await assert.rejects(
    () => queue.transition(task.id, "verified"),
    /confidence score/,
  );
  await queue.setConfidence(task.id, 0.9);
  const verified = await queue.transition(task.id, "verified");
  assert.equal(verified.status, "verified");
  assert.equal(verified.confidenceScore, 0.9);
  await assert.rejects(
    () => queue.addEvidence(task.id, evidence),
    /final decision/,
  );
});

test("requires reasons for rejected research and enforces transitions", async (t) => {
  const { queue } = await fixture(t);
  const [task] = await queue.createForDrafts(draftResult);
  await assert.rejects(
    () => queue.transition(task.id, "rejected"),
    /needs a reason/,
  );
  const rejected = await queue.transition(
    task.id,
    "rejected",
    "Source does not support the claim.",
  );
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejectionReason, "Source does not support the claim.");
  await assert.rejects(
    () => queue.transition(task.id, "researching"),
    /Cannot transition/,
  );
});

test("persists tasks and exports a deterministic JSON report", async (t) => {
  const { root, file, queue } = await fixture(t);
  const [task] = await queue.createForDrafts(draftResult);
  await queue.transition(task.id, "researching");
  await queue.addEvidence(task.id, evidence);
  await queue.setConfidence(task.id, 0.75);
  const restored = new JsonResearchQueue(file, { clock });
  await restored.load();
  assert.equal(restored.get(task.id).evidence.length, 1);
  assert.equal(restored.get(task.id).confidenceScore, 0.75);
  const reportFile = path.join(root, "reports", "research.json");
  await restored.exportReport(reportFile);
  const report = JSON.parse(await fs.readFile(reportFile, "utf8"));
  assert.equal(report.version, 1);
  assert.equal(report.statistics.total, 9);
  assert.equal(report.tasks.length, 9);
});

test("Draft Generator creates research tasks and advances its Job Queue job", async (t) => {
  const { root, queue: researchQueue } = await fixture(t);
  const jobQueue = new JsonJobQueue(path.join(root, "jobs.json"), { clock });
  const planner = new JsonTopicPlanner({
    runtimeEntries: [],
    queue: jobQueue,
    clock,
  });
  const plan = planner.generate({
    pack: { id: "pack.004", title: { en: "Test Pack", tr: "Test Paketi" } },
    topics: [
      {
        id: "test.topic",
        title: { en: "Test Topic", tr: "Test Konusu" },
        difficulty: "beginner",
      },
    ],
    startMonth: "2026-08",
  });
  await planner.enqueue(plan, { jobId: "job.research-integration" });
  const draftsDirectory = path.join(root, "drafts"),
    approvedDirectory = path.join(root, "approved");
  await fs.mkdir(approvedDirectory);
  const generator = new JsonDraftGenerator({
    draftsDirectory,
    approvedDirectory,
    queue: jobQueue,
    researchQueue,
    clock,
  });
  const generated = await generator.generateFromQueue(
    "job.research-integration",
  );
  assert.equal(generated.drafts.length, 1);
  assert.equal(researchQueue.statistics().total, 9);
  assert.equal(jobQueue.get("job.research-integration").status, "research");
});
