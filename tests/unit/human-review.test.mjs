import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  JsonHumanReviewWorkflow,
  HumanReviewError,
} from "../../production-engine/human-review/human-review-workflow.js";
import { JsonJobQueue } from "../../production-engine/job-queue/json-job-queue.js";
import { JsonResearchQueue } from "../../production-engine/research-queue/research-queue.js";

const clock = () => new Date("2026-07-14T15:00:00.000Z");
const draft = {
  draft_id: "finance.review.draft.001",
  id: "finance.review",
  path: "/drafts/finance.review.json",
  planner_job_id: "job.review",
};
const draftResult = {
  plannerJobId: "job.review",
  sourcePack: "pack.004",
  generatedAt: "2026-07-14T14:00:00.000Z",
  drafts: [
    {
      ...draft,
      source_pack: "pack.004",
      version: "1.0.0",
      generated_at: "2026-07-14T14:00:00.000Z",
      updated_at: "2026-07-14T14:00:00.000Z",
      reviewStatus: "draft",
      regeneration: 1,
    },
  ],
  skipped: [],
  reviewedRecordsCreated: 0,
};
const evidence = {
  field: "definition",
  title: "Official evidence",
  publisher: "Official Publisher",
  url: "https://example.gov/evidence",
  accessedAt: "2026-07-14",
  official: true,
  note: "Checked by the research reviewer.",
};

async function fixture(t, { withJobQueue = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-review-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const researchQueue = new JsonResearchQueue(
    path.join(root, "research.json"),
    { clock },
  );
  await researchQueue.createForDrafts(draftResult);
  const jobQueue = withJobQueue
    ? new JsonJobQueue(path.join(root, "jobs.json"), { clock })
    : null;
  if (jobQueue) {
    await jobQueue.create({ id: "job.review", title: "Review job" });
    for (const status of ["planned", "drafting", "research"])
      await jobQueue.transition("job.review", status);
  }
  const workflow = new JsonHumanReviewWorkflow(
    path.join(root, "reviews.json"),
    { researchQueue, jobQueue, clock },
  );
  return { root, researchQueue, jobQueue, workflow };
}

async function verifyResearch(queue) {
  for (const task of queue.list({ draftId: draft.draft_id })) {
    await queue.transition(task.id, "researching");
    await queue.addEvidence(task.id, {
      ...evidence,
      field: task.category,
      url: `https://example.gov/${task.category}`,
    });
    await queue.setConfidence(task.id, 0.9);
    await queue.transition(task.id, "verified");
  }
}

test("requires all research categories before editorial review", async (t) => {
  const { workflow, researchQueue } = await fixture(t);
  await assert.rejects(
    () => workflow.create(draft, ["Editor One"], "Managing Editor"),
    (error) =>
      error instanceof HumanReviewError && error.code === "research_incomplete",
  );
  await verifyResearch(researchQueue);
  const reviewCase = await workflow.create(
    draft,
    ["Editor One"],
    "Managing Editor",
  );
  assert.equal(reviewCase.status, "awaiting-review");
  assert.equal(reviewCase.auditTrail[0].action, "case-created");
});

test("supports field comments, revision requests and multiple rounds", async (t) => {
  const { workflow, researchQueue } = await fixture(t);
  await verifyResearch(researchQueue);
  await workflow.create(draft, ["Editor One", "Editor Two"], "Managing Editor");
  await workflow.beginRound(draft.draft_id, "Editor One");
  let reviewCase = await workflow.addComment(
    draft.draft_id,
    1,
    {
      field: "professional_explanation",
      message: "Clarify the terminology.",
      severity: "blocking",
    },
    "Editor One",
  );
  const commentId = reviewCase.rounds[0].comments[0].id;
  reviewCase = await workflow.decide(
    draft.draft_id,
    1,
    "request-revision",
    "Editor One",
    "Revise the explanation.",
  );
  assert.equal(reviewCase.status, "revision-requested");
  await workflow.resolveComment(
    draft.draft_id,
    1,
    commentId,
    "Content Author",
    "Terminology clarified.",
  );
  reviewCase = await workflow.beginRound(draft.draft_id, "Editor Two");
  assert.equal(reviewCase.rounds.length, 2);
  assert.equal(reviewCase.rounds[1].reviewer, "Editor Two");
  assert.ok(
    reviewCase.auditTrail.some((event) => event.action === "comment-resolved"),
  );
});

test("blocks publishing and approval until editorial requirements pass", async (t) => {
  const { workflow, researchQueue } = await fixture(t);
  await verifyResearch(researchQueue);
  await workflow.create(draft, ["Editor One"], "Managing Editor");
  await workflow.beginRound(draft.draft_id, "Editor One");
  const withComment = await workflow.addComment(
    draft.draft_id,
    1,
    {
      field: "sources",
      message: "Add a direct citation.",
      severity: "required",
    },
    "Editor One",
  );
  assert.equal(workflow.canPublish(draft.draft_id), false);
  assert.throws(
    () => workflow.assertPublishable(draft.draft_id),
    /not approved/,
  );
  await assert.rejects(
    () =>
      workflow.decide(draft.draft_id, 1, "approve", "Editor One", "Approved."),
    /comments must be resolved/,
  );
  await workflow.resolveComment(
    draft.draft_id,
    1,
    withComment.rounds[0].comments[0].id,
    "Content Author",
    "Citation added.",
  );
  const approved = await workflow.decide(
    draft.draft_id,
    1,
    "approve",
    "Editor One",
    "All editorial checks complete.",
  );
  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedBy, "Editor One");
  assert.equal(workflow.canPublish(draft.draft_id), true);
  assert.doesNotThrow(() => workflow.assertPublishable(draft.draft_id));
});

test("integrates review outcomes with Job Queue states", async (t) => {
  const { workflow, researchQueue, jobQueue } = await fixture(t, {
    withJobQueue: true,
  });
  await verifyResearch(researchQueue);
  await workflow.create(draft, ["Editor One"], "Managing Editor");
  await workflow.beginRound(draft.draft_id, "Editor One");
  assert.equal(jobQueue.get("job.review").status, "review");
  await workflow.decide(
    draft.draft_id,
    1,
    "request-revision",
    "Editor One",
    "One more editorial pass.",
  );
  assert.equal(jobQueue.get("job.review").status, "drafting");
  await jobQueue.transition("job.review", "research");
  await workflow.beginRound(draft.draft_id, "Editor One");
  await workflow.decide(
    draft.draft_id,
    2,
    "approve",
    "Editor One",
    "Approved after revision.",
  );
  assert.equal(jobQueue.get("job.review").status, "validation");
});

test("persists audit history and exports JSON review reports", async (t) => {
  const { root, workflow, researchQueue } = await fixture(t);
  await verifyResearch(researchQueue);
  await workflow.create(draft, ["Editor One"], "Managing Editor");
  await workflow.beginRound(draft.draft_id, "Editor One");
  await workflow.decide(
    draft.draft_id,
    1,
    "reject",
    "Editor One",
    "The entry is outside the pack scope.",
  );
  const restored = new JsonHumanReviewWorkflow(
    path.join(root, "reviews.json"),
    { researchQueue, clock },
  );
  await restored.load();
  assert.equal(restored.get(draft.draft_id).status, "rejected");
  assert.ok(restored.get(draft.draft_id).auditTrail.length >= 3);
  const reportFile = path.join(root, "reports", "reviews.json");
  await restored.exportReport(reportFile);
  const report = JSON.parse(await fs.readFile(reportFile, "utf8"));
  assert.equal(report.version, 1);
  assert.equal(report.statistics.rejected, 1);
  assert.equal(report.statistics.rounds, 1);
});
