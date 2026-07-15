import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonJobQueue } from "../../production-engine/job-queue/json-job-queue.js";
import {
  JsonTopicPlanner,
  TopicPlannerError,
} from "../../production-engine/topic-planner/topic-planner.js";

const pack = {
  id: "pack.004",
  title: { en: "Test Pack", tr: "Test Paketi" },
  prerequisites: ["pack.003"],
  difficulty_level: "beginner",
};
const topics = [
  {
    id: "topic.advanced",
    title: { en: "Advanced Analysis", tr: "İleri Analiz" },
    difficulty: "advanced",
    prerequisites: ["topic.foundation"],
  },
  {
    id: "topic.foundation",
    title: { en: "Foundation", tr: "Temel" },
    difficulty: "beginner",
  },
  {
    id: "topic.existing",
    title: { en: "Loan to Value", tr: "Kredi Değer Oranı" },
    difficulty: "intermediate",
  },
  {
    id: "topic.intermediate",
    title: { en: "Intermediate Analysis", tr: "Orta Analiz" },
    difficulty: "intermediate",
    prerequisites: ["topic.foundation"],
    estimatedHours: 4,
  },
  {
    id: "topic.duplicate",
    title: { en: "Different", tr: "Farklı" },
    aliases: { en: ["Foundation"] },
  },
];

function planner(options = {}) {
  return new JsonTopicPlanner({
    runtimeEntries: [
      {
        id: "finance.ltv",
        term: "LTV",
        tr: "Kredi Değer Oranı",
        aliases: { en: ["Loan to Value"] },
      },
    ],
    clock: () => new Date("2026-07-14T10:00:00.000Z"),
    ...options,
  });
}

test("creates an ordered plan, detects duplicates and runtime entries", () => {
  const plan = planner().generate({
    pack,
    topics,
    startMonth: "2026-08",
    monthlyDraftCapacity: 2,
  });
  assert.deepEqual(
    plan.topics.map((topic) => topic.id),
    [
      "topic.foundation",
      "topic.existing",
      "topic.intermediate",
      "topic.advanced",
    ],
  );
  assert.equal(plan.duplicates.length, 1);
  assert.equal(plan.duplicates[0].duplicateOf, "topic.foundation");
  assert.equal(plan.topics[1].existingRuntimeEntry, true);
  assert.equal(plan.topics[1].runtimeEntryId, "finance.ltv");
  assert.deepEqual(plan.prerequisites, ["pack.003"]);
});

test("estimates draft workload and generates capacity-bound monthly plans", () => {
  const plan = planner().generate({
    pack,
    topics,
    startMonth: "2026-08",
    monthlyDraftCapacity: 2,
  });
  assert.deepEqual(plan.statistics, {
    proposedCount: 5,
    uniqueTopicCount: 4,
    existingRuntimeCount: 1,
    estimatedDraftCount: 3,
    estimatedWorkloadHours: 11,
    monthlyPlanCount: 2,
  });
  assert.deepEqual(
    plan.monthlyPlans.map(({ month, draftCount }) => ({ month, draftCount })),
    [
      { month: "2026-08", draftCount: 2 },
      { month: "2026-09", draftCount: 1 },
    ],
  );
  assert.ok(
    plan.monthlyPlans
      .flatMap((month) => month.topicIds)
      .every((id) => id !== "topic.existing"),
  );
});

test("rejects missing and cyclic topic prerequisites", () => {
  assert.throws(
    () =>
      planner().generate({
        pack,
        topics: [{ ...topics[1], prerequisites: ["missing"] }],
      }),
    (error) =>
      error instanceof TopicPlannerError &&
      error.code === "missing_prerequisite",
  );
  const cyclic = [
    { ...topics[1], prerequisites: ["topic.intermediate"] },
    { ...topics[3], prerequisites: ["topic.foundation"] },
  ];
  assert.throws(
    () => planner().generate({ pack, topics: cyclic }),
    (error) =>
      error instanceof TopicPlannerError && error.code === "prerequisite_cycle",
  );
});

test("writes a versioned JSON planning report", async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "emcp-topic-plan-"),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const instance = planner({ reportsDirectory: directory });
  const plan = instance.generate({ pack, topics: topics.slice(0, 2) });
  const file = await instance.writeReport(plan);
  const stored = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(stored.schemaVersion, 1);
  assert.equal(stored.packId, "pack.004");
  assert.equal(stored.statistics.estimatedDraftCount, 2);
});

test("reads pack and runtime files and integrates with Job Queue Engine", async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "emcp-topic-queue-"),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const packFile = path.join(directory, "packs.json");
  const runtimeFile = path.join(directory, "runtime.json");
  await fs.writeFile(packFile, JSON.stringify([pack]));
  await fs.writeFile(
    runtimeFile,
    JSON.stringify([{ id: "finance.ltv", term: "Loan to Value" }]),
  );
  const queue = new JsonJobQueue(path.join(directory, "queue.json"));
  const loadedPack = await JsonTopicPlanner.readPack(packFile, "pack.004");
  const instance = await JsonTopicPlanner.fromFiles({
    runtimeIndexFile: runtimeFile,
    queue,
  });
  const plan = instance.generate({
    pack: loadedPack,
    topics: topics.slice(0, 4),
  });
  const queued = await instance.enqueue(plan, {
    priority: "high",
    maxRetries: 3,
  });
  assert.equal(queued.id, "plan.pack.004.production");
  assert.equal(queued.priority, "high");
  assert.equal(queued.payload.estimatedDraftCount, 3);
  assert.equal(queue.statistics().total, 1);
});
