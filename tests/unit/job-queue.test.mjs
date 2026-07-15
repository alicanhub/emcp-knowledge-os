import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  JsonJobQueue,
  QueueError,
} from "../../production-engine/job-queue/json-job-queue.js";

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-job-queue-"));
  let tick = 0;
  const file = path.join(directory, "queue.json");
  const queue = new JsonJobQueue(file, {
    clock: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
  return { directory, file, queue };
}

async function complete(queue, id) {
  for (const status of [
    "planned",
    "drafting",
    "research",
    "review",
    "validation",
    "import",
    "completed",
  ])
    await queue.transition(id, status);
}

test("runs the complete queue lifecycle and records timestamps", async (t) => {
  const { directory, queue } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const created = await queue.create({ id: "job.001", title: "Pack 001" });
  assert.equal(created.status, "pending");
  await complete(queue, created.id);
  const completed = queue.get(created.id);
  assert.equal(completed.status, "completed");
  assert.ok(completed.startedAt);
  assert.ok(completed.completedAt);
  assert.ok(Date.parse(completed.updatedAt) >= Date.parse(completed.createdAt));
  await assert.rejects(
    () => queue.transition(created.id, "failed"),
    /Cannot transition completed/,
  );
});

test("orders ready work by priority and blocks incomplete dependencies", async (t) => {
  const { directory, queue } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await queue.create({ id: "job.base", title: "Base", priority: "normal" });
  await queue.create({ id: "job.high", title: "High", priority: "high" });
  await queue.create({
    id: "job.blocked",
    title: "Blocked",
    priority: "critical",
    dependencies: ["job.base"],
  });
  assert.equal(queue.next().id, "job.high");
  await assert.rejects(
    () => queue.transition("job.blocked", "planned"),
    /dependencies must be completed/i,
  );
  let stats = queue.statistics();
  assert.equal(stats.ready, 2);
  assert.equal(stats.blockedByDependencies, 1);
  await complete(queue, "job.base");
  assert.equal(queue.next().id, "job.blocked");
  stats = queue.statistics();
  assert.equal(stats.byPriority.critical, 1);
  assert.equal(stats.byStatus.completed, 1);
});

test("pauses, resumes and permanently cancels jobs", async (t) => {
  const { directory, queue } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await queue.create({ id: "job.control", title: "Controlled" });
  const paused = await queue.pause("job.control");
  assert.equal(paused.controlState, "paused");
  assert.ok(paused.pausedAt);
  assert.equal(queue.next(), null);
  await assert.rejects(
    () => queue.transition("job.control", "planned"),
    /paused job/,
  );
  assert.equal((await queue.resume("job.control")).controlState, "active");
  const cancelled = await queue.cancel("job.control");
  assert.equal(cancelled.controlState, "cancelled");
  assert.ok(cancelled.cancelledAt);
  await assert.rejects(() => queue.resume("job.control"), /Only paused/);
});

test("enforces retry limits and clears failure state", async (t) => {
  const { directory, queue } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await queue.create({ id: "job.retry", title: "Retry", maxRetries: 1 });
  await queue.transition("job.retry", "failed", "Source unavailable");
  assert.equal(queue.get("job.retry").error, "Source unavailable");
  const retried = await queue.retry("job.retry");
  assert.equal(retried.status, "pending");
  assert.equal(retried.retryCount, 1);
  assert.equal(retried.error, null);
  await queue.transition("job.retry", "failed");
  await assert.rejects(() => queue.retry("job.retry"), /retry limit/i);
});

test("persists and defensively reloads JSON", async (t) => {
  const { directory, file, queue } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await queue.create({
    id: "job.saved",
    title: "Saved",
    payload: { pack: "003" },
  });
  await queue.pause("job.saved");
  const restored = new JsonJobQueue(file);
  await restored.load();
  assert.deepEqual(restored.get("job.saved").payload, { pack: "003" });
  assert.equal(restored.get("job.saved").controlState, "paused");

  await fs.writeFile(file, '{"version":1,"jobs":[{"id":"broken"}]}');
  const invalid = new JsonJobQueue(file);
  await assert.rejects(
    () => invalid.load(),
    (error) => error instanceof QueueError,
  );
});

test("rejects duplicate jobs and missing dependencies", async (t) => {
  const { directory, queue } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await queue.create({ id: "job.unique", title: "Unique" });
  await assert.rejects(
    () => queue.create({ id: "job.unique", title: "Again" }),
    /already exists/,
  );
  await assert.rejects(
    () =>
      queue.create({
        id: "job.child",
        title: "Child",
        dependencies: ["job.missing"],
      }),
    /Unknown dependency/,
  );
});
