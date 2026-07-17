import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { JsonDraftGenerator } from "../../production-engine/draft-generator/draft-generator.js";
import { JsonJobQueue } from "../../production-engine/job-queue/json-job-queue.js";
import { JsonTopicPlanner } from "../../production-engine/topic-planner/topic-planner.js";

const fixedClock = () => new Date("2026-07-14T12:30:00.000Z");
const pack = {
  id: "pack.004",
  title: { en: "Finance Basics", tr: "Finans Temelleri" },
  difficulty_level: "beginner",
};
const topics = [
  {
    id: "finance.new-concept",
    title: { en: "New Concept", tr: "Yeni Kavram" },
    abbreviation: "NC",
    aliases: { en: ["New Finance Concept"], tr: ["Yeni Finans Kavramı"] },
    difficulty: "beginner",
  },
  {
    id: "finance.existing",
    title: { en: "Existing Concept", tr: "Mevcut Kavram" },
    difficulty: "intermediate",
  },
];

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-drafts-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const draftsDirectory = path.join(root, "drafts");
  const approvedDirectory = path.join(root, "reviewed");
  await fs.mkdir(approvedDirectory, { recursive: true });
  return { root, draftsDirectory, approvedDirectory };
}

function plan(
  runtimeEntries = [{ id: "finance.existing", term: "Existing Concept" }],
) {
  return new JsonTopicPlanner({ runtimeEntries, clock: fixedClock }).generate({
    pack,
    topics,
    startMonth: "2026-08",
  });
}

test("generates deterministic bilingual Knowledge Entry v2 JSON", async (t) => {
  const folders = await fixture(t);
  const generator = new JsonDraftGenerator({ ...folders, clock: fixedClock });
  const result = await generator.generate({
    plannerJobId: "job.plan-004",
    plan: plan(),
  });
  assert.equal(result.reviewedRecordsCreated, 0);
  assert.equal(result.drafts.length, 1);
  assert.deepEqual(result.skipped, [
    { id: "finance.existing", reason: "existing-runtime-entry" },
  ]);
  const draft = JSON.parse(await fs.readFile(result.drafts[0].path, "utf8"));
  assert.equal(draft.draft_id, "finance.new-concept.draft.001");
  assert.equal(draft.source_pack, "pack.004");
  assert.equal(draft.planner_job_id, "job.plan-004");
  assert.equal(draft.version, "1.0.0");
  assert.equal(draft.generated_at, "2026-07-14T12:30:00.000Z");
  assert.equal(draft.review_status, "draft");
  assert.equal(draft.title.en, "New Concept");
  assert.equal(draft.title.tr, "Yeni Kavram");
  for (const field of [
    "simple_explanation",
    "professional_explanation",
    "real_world_example",
    "site_example",
    "office_example",
    "interview_questions",
    "worked_example",
    "common_mistakes",
    "practical_tips",
    "risks",
    "best_practice",
    "uk_practice",
    "turkey_practice",
    "related_standards",
    "related_regulations",
    "frequently_asked_questions",
    "visual_illustration",
    "future_video",
  ])
    assert.ok(Object.hasOwn(draft, field), `missing ${field}`);

  const schema = JSON.parse(
    await fs.readFile("schemas/content-entry.schema.json", "utf8"),
  );
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(draft), true, JSON.stringify(validate.errors));
});

test("regenerates to a new version without overwriting earlier drafts", async (t) => {
  const folders = await fixture(t);
  const generator = new JsonDraftGenerator({ ...folders, clock: fixedClock });
  const request = { plannerJobId: "job.plan-004", plan: plan([]) };
  const first = await generator.generate(request);
  const original = await fs.readFile(first.drafts[0].path, "utf8");
  const second = await generator.generate(request);
  assert.equal(second.drafts[0].regeneration, 2);
  assert.equal(second.drafts[0].draft_id, "finance.new-concept.draft.002");
  assert.equal(await fs.readFile(first.drafts[0].path, "utf8"), original);
  assert.notEqual(second.drafts[0].path, first.drafts[0].path);
});

test("never generates over approved content", async (t) => {
  const folders = await fixture(t);
  await fs.writeFile(
    path.join(folders.approvedDirectory, "approved.json"),
    JSON.stringify({ id: "finance.new-concept", review_status: "reviewed" }),
  );
  const generator = new JsonDraftGenerator({ ...folders, clock: fixedClock });
  const result = await generator.generate({
    plannerJobId: "job.plan-004",
    plan: plan([]),
  });
  assert.equal(
    result.drafts.some((draft) => draft.id === "finance.new-concept"),
    false,
  );
  assert.ok(
    result.skipped.some(
      (item) =>
        item.id === "finance.new-concept" &&
        item.reason === "approved-content-exists",
    ),
  );
});

test("consumes Topic Planner queue jobs and advances queue state", async (t) => {
  const folders = await fixture(t);
  const queue = new JsonJobQueue(path.join(folders.root, "queue.json"), {
    clock: fixedClock,
  });
  const planner = new JsonTopicPlanner({
    runtimeEntries: [],
    queue,
    clock: fixedClock,
  });
  const productionPlan = planner.generate({
    pack,
    topics,
    startMonth: "2026-08",
  });
  await planner.enqueue(productionPlan, { jobId: "job.plan-004" });
  const generator = new JsonDraftGenerator({
    ...folders,
    queue,
    clock: fixedClock,
  });
  const result = await generator.generateFromQueue("job.plan-004");
  assert.equal(result.drafts.length, 2);
  assert.equal(queue.get("job.plan-004").status, "research");
  assert.equal(queue.get("job.plan-004").payload.plan.id, "plan.pack.004");
});
