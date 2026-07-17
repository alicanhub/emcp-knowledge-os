import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonJobQueue } from "../../production-engine/job-queue/json-job-queue.js";
import {
  JsonMonthlyMaintenanceEngine,
  MaintenanceEngineError,
} from "../../production-engine/maintenance/monthly-maintenance-engine.js";

const clock = () => new Date("2026-07-14T20:00:00.000Z");
const writeJson = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
};

async function fixture(t, { broken = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-maintenance-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const runtimeDirectory = path.join(root, "runtime");
  const entries = [
    {
      id: "entry.current",
      term: "Current Entry",
      tr: "Güncel Kayıt",
      def: "Tanım",
      cat: "Test",
    },
    {
      id: "entry.old",
      term: "Old Entry",
      tr: "Eski Kayıt",
      def: "Tanım",
      cat: "Test",
    },
  ];
  await writeJson(path.join(runtimeDirectory, "index.json"), {
    translations: "en.json",
    searchIndex: "search-index.json",
    relationships: "relationships.json",
    details: "details.json",
    categories: [{ category: "Test", file: "test.json" }],
  });
  await writeJson(path.join(runtimeDirectory, "test.json"), entries);
  await writeJson(path.join(runtimeDirectory, "en.json"), {
    "Current Entry": { defEn: "Definition" },
    "Old Entry": { defEn: "Definition" },
  });
  await writeJson(
    path.join(runtimeDirectory, "search-index.json"),
    broken ? [{ term: "Wrong" }] : entries.map(({ term }) => ({ term })),
  );
  await writeJson(path.join(runtimeDirectory, "relationships.json"), {
    version: 1,
    relationships: broken ? [[4], []] : [[1], [0]],
  });
  await writeJson(path.join(runtimeDirectory, "details.json"), {
    version: 2,
    entries: {
      "Current Entry": {
        revisionHistory: [{ date: "2026-06-01", version: "1.0.0" }],
      },
      "Old Entry": {
        revisionHistory: [{ date: "2024-01-01", version: "1.0.0" }],
      },
      "Orphan Detail": {
        revisionHistory: [{ date: "2026-01-01", version: "1.0.0" }],
      },
    },
  });
  const queue = new JsonJobQueue(path.join(root, "queue.json"), { clock });
  const backupRollback = {
    list: async () => [
      {
        versionId: "backup.current",
        createdAt: "2026-07-10T00:00:00.000Z",
      },
    ],
    verify: async (versionId) => versionId === "backup.current",
  };
  const dashboard = {
    snapshot: async () => ({
      version: 1,
      generatedAt: clock().toISOString(),
      overall: { productionCompletionPercentage: 75 },
      jobQueue: { total: 1 },
    }),
  };
  const engine = new JsonMonthlyMaintenanceEngine({
    runtimeDirectory,
    jobQueue: queue,
    backupRollback,
    dashboard,
    clock,
    reviewMaxAgeDays: 365,
  });
  return { root, queue, engine };
}

test("schedules recurring monthly maintenance jobs idempotently", async (t) => {
  const { queue, engine } = await fixture(t);
  const scheduled = await engine.schedule({ start: "2026-08", months: 3 });
  assert.deepEqual(
    scheduled.map((item) => item.jobId),
    ["maintenance.2026-08", "maintenance.2026-09", "maintenance.2026-10"],
  );
  assert.equal(queue.statistics().total, 3);
  await engine.schedule({ start: "2026-08", months: 3 });
  assert.equal(queue.statistics().total, 3);
  assert.equal(
    queue.get("maintenance.2026-08").payload.type,
    "monthly-maintenance",
  );
});

test("audits runtime, indexes, reviews, backups and dashboard health", async (t) => {
  const { queue, engine } = await fixture(t);
  await engine.schedule({ start: "2026-07", months: 1, priority: "high" });
  const report = await engine.run({ period: "2026-07" });
  assert.equal(report.runtime.entries, 2);
  assert.equal(report.indexes.searchIndexValid, true);
  assert.equal(report.indexes.relationshipIndexValid, true);
  assert.equal(report.backups.latestVerified, true);
  assert.equal(report.dashboard.healthy, true);
  assert.deepEqual(
    report.recommendations.map((item) => item.recordId),
    ["entry.old"],
  );
  assert.equal(
    report.findings.some((item) => item.code === "orphaned-detail"),
    true,
  );
  assert.equal(queue.get("maintenance.2026-07").status, "completed");
});

test("detects stale indexes and broken relationships", async (t) => {
  const { engine } = await fixture(t, { broken: true });
  const report = await engine.run({ period: "2026-07" });
  assert.equal(report.healthy, false);
  assert.equal(report.indexes.searchIndexValid, false);
  assert.equal(report.indexes.relationshipIndexValid, false);
  assert.ok(report.indexes.brokenRelationships > 0);
  assert.equal(report.counts.error, 2);
});

test("exports deterministic JSON reports atomically", async (t) => {
  const { root, engine } = await fixture(t);
  const file = path.join(root, "reports", "maintenance.json");
  const report = await engine.run({ period: "2026-07", reportFile: file });
  const stored = JSON.parse(await fs.readFile(file, "utf8"));
  assert.deepEqual(stored, report);
  assert.equal(stored.reportId, "maintenance.2026-07");
  await assert.rejects(
    () => engine.exportJson(report, ""),
    (error) =>
      error instanceof MaintenanceEngineError &&
      error.code === "invalid_export",
  );
});
