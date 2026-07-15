import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonBackupRollbackEngine } from "../../production-engine/backup-rollback/backup-rollback-engine.js";
import { JsonDraftGenerator } from "../../production-engine/draft-generator/draft-generator.js";
import { JsonJobQueue } from "../../production-engine/job-queue/json-job-queue.js";
import {
  JsonSafeImportEngine,
  SafeImportError,
} from "../../production-engine/safe-import/safe-import-engine.js";
import { JsonTopicPlanner } from "../../production-engine/topic-planner/topic-planner.js";

const clock = () => new Date("2026-07-14T17:00:00.000Z");
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
async function runtimeFixture(root) {
  const runtime = path.join(root, "runtime");
  await writeJson(path.join(runtime, "index.json"), {
    translations: "en.json",
    searchIndex: "search-index.json",
    relationships: "relationships.json",
    details: "details.json",
    categories: [{ category: "Finansman", file: "finance.json" }],
  });
  const entry = {
    term: "Existing Entry",
    tr: "Mevcut Kayıt",
    cat: "Finansman",
    abbr: "EE",
    def: "Mevcut tanım.",
    use: "Mevcut kullanım.",
    example: "Existing example.",
    tags: ["existing"],
  };
  await writeJson(path.join(runtime, "finance.json"), [entry]);
  await writeJson(path.join(runtime, "en.json"), {
    "Existing Entry": { defEn: "Existing definition.", useEn: "Existing use." },
  });
  await writeJson(path.join(runtime, "details.json"), {
    version: 2,
    entries: { "Existing Entry": {} },
  });
  await writeJson(path.join(runtime, "search-index.json"), [
    {
      term: entry.term,
      tr: entry.tr,
      abbr: entry.abbr,
      def: entry.def,
      defEn: "Existing definition.",
      cat: entry.cat,
      tags: entry.tags,
      source: "finance.json",
    },
  ]);
  await writeJson(path.join(runtime, "relationships.json"), {
    version: 1,
    relationships: [[]],
  });
  return runtime;
}
async function draftFixture(root) {
  const plan = new JsonTopicPlanner({ runtimeEntries: [], clock }).generate({
    pack: {
      id: "pack.004",
      title: { en: "Import Pack", tr: "İçe Aktarma Paketi" },
    },
    topics: [
      {
        id: "finance.imported",
        title: { en: "Imported Entry", tr: "İçe Aktarılan Kayıt" },
        abbreviation: "IE",
        aliases: { en: ["Imported Concept"], tr: ["Aktarılan Kavram"] },
        difficulty: "beginner",
      },
    ],
    startMonth: "2026-08",
  });
  const approvedDirectory = path.join(root, "approved");
  await fs.mkdir(approvedDirectory);
  return new JsonDraftGenerator({
    draftsDirectory: path.join(root, "drafts"),
    approvedDirectory,
    clock,
  }).generate({ plannerJobId: "job.import", plan });
}
const validationReport = {
  version: 1,
  batchId: "batch.import",
  sourcePack: "pack.004",
  plannerJobId: "job.import",
  generatedAt: "2026-07-14T16:00:00.000Z",
  counts: { drafts: 1, critical: 0, errors: 0, warnings: 0, information: 0 },
  findings: [],
  validForPublishing: true,
};
const validator = {
  assertPublishable(report) {
    if (!report.validForPublishing) throw new Error("blocked");
  },
};
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-import-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const runtimeDirectory = await runtimeFixture(root),
    draftResult = await draftFixture(root);
  const engine = new JsonSafeImportEngine({
    runtimeDirectory,
    manifestsDirectory: path.join(root, "manifests"),
    backupsDirectory: path.join(root, "backups"),
    auditFile: path.join(root, "audit", "imports.json"),
    batchValidator: validator,
    clock,
    ...options,
  });
  return { root, runtimeDirectory, draftResult, engine };
}
async function hashes(directory) {
  const result = {};
  for (const name of (await fs.readdir(directory)).sort()) {
    const file = path.join(directory, name);
    if ((await fs.stat(file)).isFile())
      result[name] = crypto
        .createHash("sha256")
        .update(await fs.readFile(file))
        .digest("hex");
  }
  return result;
}

test("imports validated drafts transactionally and regenerates runtime indexes", async (t) => {
  const { root, runtimeDirectory, draftResult, engine } = await fixture(t);
  const report = await engine.import({
    draftResult,
    validationReport,
    approvedBy: "Import Approver",
    importId: "import.004-001",
  });
  assert.equal(report.runtimeCountBefore, 1);
  assert.equal(report.runtimeCountAfter, 2);
  assert.deepEqual(report.importedRecordIds, ["finance.imported"]);
  const search = JSON.parse(
    await fs.readFile(path.join(runtimeDirectory, "search-index.json"), "utf8"),
  );
  const relationships = JSON.parse(
    await fs.readFile(
      path.join(runtimeDirectory, "relationships.json"),
      "utf8",
    ),
  );
  assert.equal(search.length, 2);
  assert.equal(relationships.relationships.length, 2);
  assert.ok(
    relationships.relationships
      .flat()
      .every((index) => index >= 0 && index < 2),
  );
  assert.equal((await engine.listManifests()).length, 1);
  const audit = JSON.parse(
    await fs.readFile(path.join(root, "audit", "imports.json"), "utf8"),
  );
  assert.equal(audit.events.at(-1).action, "import-completed");
  assert.ok(report.files.every((file) => file.sha256After));
});

test("prevents duplicate record and import-id reuse", async (t) => {
  const { draftResult, engine } = await fixture(t);
  await engine.import({
    draftResult,
    validationReport,
    approvedBy: "Approver",
    importId: "import.once",
  });
  await assert.rejects(
    () =>
      engine.import({
        draftResult,
        validationReport,
        approvedBy: "Approver",
        importId: "import.twice",
      }),
    (error) =>
      error instanceof SafeImportError && error.code === "duplicate_import",
  );
});

test("automatically restores the exact runtime state after a post-swap failure", async (t) => {
  const { root, runtimeDirectory, draftResult } = await fixture(t);
  const before = await hashes(runtimeDirectory);
  const backupRollback = new JsonBackupRollbackEngine({
    runtimeDirectory,
    backupDirectory: path.join(root, "versioned-backups"),
    reportsDirectory: path.join(root, "backup-reports"),
    auditFile: path.join(root, "backup-audit.json"),
    clock,
  });
  const engine = new JsonSafeImportEngine({
    runtimeDirectory,
    manifestsDirectory: path.join(root, "manifests-failure"),
    backupsDirectory: path.join(root, "backups-failure"),
    auditFile: path.join(root, "audit-failure.json"),
    batchValidator: validator,
    clock,
    backupRollback,
    faultInjector: (stage) => {
      if (stage === "after-swap") throw new Error("Simulated disk failure");
    },
  });
  await assert.rejects(
    () =>
      engine.import({
        draftResult,
        validationReport,
        approvedBy: "Approver",
        importId: "import.rollback",
      }),
    /rolled back/i,
  );
  assert.deepEqual(await hashes(runtimeDirectory), before);
  assert.equal((await engine.listManifests()).length, 0);
  const audit = JSON.parse(
    await fs.readFile(path.join(root, "audit-failure.json"), "utf8"),
  );
  assert.equal(audit.events.at(-1).action, "import-rolled-back");
  const backupAudit = JSON.parse(
    await fs.readFile(path.join(root, "backup-audit.json"), "utf8"),
  );
  assert.ok(
    backupAudit.events.some((event) => event.action === "automatic-rollback"),
  );
});

test("blocks unvalidated batches before creating a transaction", async (t) => {
  const { runtimeDirectory, draftResult, engine } = await fixture(t);
  const before = await hashes(runtimeDirectory);
  await assert.rejects(
    () =>
      engine.import({
        draftResult,
        validationReport: { ...validationReport, validForPublishing: false },
        approvedBy: "Approver",
      }),
    /blocked/,
  );
  assert.deepEqual(await hashes(runtimeDirectory), before);
});

test("integrates successful imports with the Job Queue", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-import-job-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const runtimeDirectory = await runtimeFixture(root),
    draftResult = await draftFixture(root);
  const jobQueue = new JsonJobQueue(path.join(root, "jobs.json"), { clock });
  await jobQueue.create({ id: "job.import", title: "Import job" });
  for (const status of [
    "planned",
    "drafting",
    "research",
    "review",
    "validation",
    "import",
  ])
    await jobQueue.transition("job.import", status);
  const engine = new JsonSafeImportEngine({
    runtimeDirectory,
    manifestsDirectory: path.join(root, "manifests"),
    backupsDirectory: path.join(root, "backups"),
    auditFile: path.join(root, "audit.json"),
    batchValidator: validator,
    jobQueue,
    clock,
  });
  await engine.import({
    draftResult,
    validationReport,
    approvedBy: "Approver",
    importId: "import.job",
  });
  assert.equal(jobQueue.get("job.import").status, "completed");
});
