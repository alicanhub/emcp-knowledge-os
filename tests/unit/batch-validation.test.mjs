import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  JsonBatchValidator,
  BatchValidationError,
} from "../../production-engine/batch-validation/batch-validator.js";
import { JsonDraftGenerator } from "../../production-engine/draft-generator/draft-generator.js";
import { JsonHumanReviewWorkflow } from "../../production-engine/human-review/human-review-workflow.js";
import { JsonJobQueue } from "../../production-engine/job-queue/json-job-queue.js";
import { JsonResearchQueue } from "../../production-engine/research-queue/research-queue.js";
import { JsonTopicPlanner } from "../../production-engine/topic-planner/topic-planner.js";

const clock = () => new Date("2026-07-14T16:00:00.000Z");
const source = {
  field: "definition",
  title: "Official source",
  publisher: "Official Publisher",
  url: "https://example.gov/source",
  accessedAt: "2026-07-14",
  official: true,
  note: "Verified for validation testing.",
};

async function pipeline(t, topicCount = 1) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-batch-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobQueue = new JsonJobQueue(path.join(root, "jobs.json"), { clock });
  const researchQueue = new JsonResearchQueue(
    path.join(root, "research.json"),
    { clock },
  );
  const planner = new JsonTopicPlanner({
    runtimeEntries: [],
    queue: jobQueue,
    clock,
  });
  const topics = Array.from({ length: topicCount }, (_, index) => ({
    id: `validation.topic-${index + 1}`,
    title: {
      en: `Validation Topic ${index + 1}`,
      tr: `Doğrulama Konusu ${index + 1}`,
    },
    abbreviation: `VT${index + 1}`,
    aliases: {
      en: [`Validation Alias ${index + 1}`],
      tr: [`Doğrulama Adı ${index + 1}`],
    },
    difficulty: "beginner",
  }));
  const plan = planner.generate({
    pack: {
      id: "pack.004",
      title: { en: "Validation Pack", tr: "Doğrulama Paketi" },
    },
    topics,
    startMonth: "2026-08",
  });
  await planner.enqueue(plan, { jobId: "job.validation" });
  const approvedDirectory = path.join(root, "approved");
  await fs.mkdir(approvedDirectory);
  const generator = new JsonDraftGenerator({
    draftsDirectory: path.join(root, "drafts"),
    approvedDirectory,
    queue: jobQueue,
    researchQueue,
    clock,
  });
  const draftResult = await generator.generateFromQueue("job.validation");
  for (const task of researchQueue.list()) {
    await researchQueue.transition(task.id, "researching");
    await researchQueue.addEvidence(task.id, {
      ...source,
      field: task.category,
      url: `https://example.gov/${task.recordId}/${task.category}`,
    });
    await researchQueue.setConfidence(task.id, 0.9);
    await researchQueue.transition(task.id, "verified");
  }
  const reviewWorkflow = new JsonHumanReviewWorkflow(
    path.join(root, "reviews.json"),
    { researchQueue, jobQueue, clock },
  );
  for (const draft of draftResult.drafts) {
    await reviewWorkflow.create(
      draft,
      ["Validation Editor"],
      "Managing Editor",
    );
    await reviewWorkflow.beginRound(draft.draft_id, "Validation Editor");
    await reviewWorkflow.decide(
      draft.draft_id,
      1,
      "approve",
      "Validation Editor",
      "Approved for batch validation.",
    );
    if (draft !== draftResult.drafts.at(-1)) {
      await jobQueue.transition("job.validation", "import");
      throw new Error(
        "Multi-draft Job Queue approval is not supported by this fixture.",
      );
    }
  }
  const validator = new JsonBatchValidator({
    schemaFile: "schemas/content-entry.schema.json",
    runtimeEntries: [],
    calculatorIds: ["ltv", "roi"],
    researchQueue,
    reviewWorkflow,
    jobQueue,
    clock,
  });
  return {
    root,
    jobQueue,
    researchQueue,
    reviewWorkflow,
    draftResult,
    validator,
  };
}

test("validates an approved generated v2 batch and allows publishing", async (t) => {
  const { draftResult, validator } = await pipeline(t);
  const report = await validator.validate(draftResult, "batch.valid");
  assert.equal(report.validForPublishing, true);
  assert.equal(report.counts.critical, 0);
  assert.equal(report.counts.errors, 0);
  assert.doesNotThrow(() => validator.assertPublishable(report));
});

test("detects schema, required, bilingual, formula, calculator, metadata and reference failures", async (t) => {
  const { draftResult, validator } = await pipeline(t);
  const reference = draftResult.drafts[0];
  const record = JSON.parse(await fs.readFile(reference.path, "utf8"));
  delete record.simple_explanation;
  record.risks.tr = [];
  record.formula = {
    expression: "",
    variables: [],
    notes: { en: "Formula note", tr: "Formül notu" },
  };
  record.related_calculators = ["invented-calculator"];
  record.related_concepts = ["missing.concept"];
  record.source_pack = "pack.wrong";
  await fs.writeFile(reference.path, JSON.stringify(record));
  const report = await validator.validate(draftResult, "batch.invalid");
  const codes = new Set(report.findings.map((item) => item.code));
  for (const code of [
    "schema",
    "required_field",
    "bilingual_missing",
    "formula_expression",
    "invalid_calculator",
    "broken_reference",
    "metadata_mismatch",
  ])
    assert.ok(codes.has(code), `missing ${code}`);
  assert.equal(report.validForPublishing, false);
  assert.throws(
    () => validator.assertPublishable(report),
    (error) =>
      error instanceof BatchValidationError &&
      error.code === "validation_failed",
  );
});

test("detects duplicate runtime identities and missing upstream approval", async (t) => {
  const { draftResult, researchQueue, root } = await pipeline(t);
  const record = JSON.parse(
    await fs.readFile(draftResult.drafts[0].path, "utf8"),
  );
  const validator = new JsonBatchValidator({
    schemaFile: "schemas/content-entry.schema.json",
    runtimeEntries: [
      {
        id: "runtime.other",
        term: record.title.en,
        tr: "Başka Başlık",
        abbreviation: record.abbreviation,
        aliases: { en: [record.aliases.en[0]], tr: [] },
      },
    ],
    calculatorIds: [],
    researchQueue,
    reviewWorkflow: { canPublish: () => false },
    clock,
  });
  const report = await validator.validate(draftResult, "batch.duplicates");
  const codes = new Set(report.findings.map((item) => item.code));
  assert.ok(codes.has("duplicate_title"));
  assert.ok(codes.has("duplicate_alias"));
  assert.ok(codes.has("duplicate_abbreviation"));
  assert.ok(codes.has("review_not_approved"));
  await validator.exportReport(
    report,
    path.join(root, "reports", "batch.json"),
  );
  const stored = JSON.parse(
    await fs.readFile(path.join(root, "reports", "batch.json"), "utf8"),
  );
  assert.equal(stored.batchId, "batch.duplicates");
  assert.equal(stored.validForPublishing, false);
});

test("advances passing validation jobs to Import and fails critical batches", async (t) => {
  const valid = await pipeline(t);
  const passed = await valid.validator.validateJob(
    "job.validation",
    valid.draftResult,
    "batch.job-valid",
  );
  assert.equal(passed.validForPublishing, true);
  assert.equal(valid.jobQueue.get("job.validation").status, "import");

  const invalid = await pipeline(t);
  const record = JSON.parse(
    await fs.readFile(invalid.draftResult.drafts[0].path, "utf8"),
  );
  record.related_calculators = ["missing"];
  await fs.writeFile(
    invalid.draftResult.drafts[0].path,
    JSON.stringify(record),
  );
  const failed = await invalid.validator.validateJob(
    "job.validation",
    invalid.draftResult,
    "batch.job-invalid",
  );
  assert.equal(failed.validForPublishing, false);
  assert.equal(invalid.jobQueue.get("job.validation").status, "failed");
});
