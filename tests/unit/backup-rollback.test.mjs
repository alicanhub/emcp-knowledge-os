import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  JsonBackupRollbackEngine,
  BackupRollbackError,
} from "../../production-engine/backup-rollback/backup-rollback-engine.js";

const clock = () => new Date("2026-07-14T18:00:00.000Z");
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-backup-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const runtimeDirectory = path.join(root, "runtime");
  await writeJson(path.join(runtimeDirectory, "index.json"), {
    categories: [{ category: "Finance", file: "finance.json" }],
  });
  await writeJson(path.join(runtimeDirectory, "finance.json"), [
    { term: "Entry One" },
  ]);
  await fs.writeFile(path.join(runtimeDirectory, "auxiliary.txt"), "initial\n");
  const engine = new JsonBackupRollbackEngine({
    runtimeDirectory,
    backupDirectory: path.join(root, "backups"),
    reportsDirectory: path.join(root, "reports"),
    auditFile: path.join(root, "audit.json"),
    clock,
  });
  return { root, runtimeDirectory, engine };
}

test("creates full snapshots with checksummed manifests and reports", async (t) => {
  const { root, engine } = await fixture(t);
  const report = await engine.createSnapshot({
    type: "full",
    versionId: "backup.v1",
  });
  assert.equal(report.manifest.type, "full");
  assert.equal(report.manifest.runtimeCount, 1);
  assert.equal(report.manifest.changedFiles.length, 3);
  assert.ok(
    report.manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)),
  );
  assert.equal(await engine.verify("backup.v1"), true);
  const storedReport = JSON.parse(
    await fs.readFile(
      path.join(root, "reports", "backup.v1.backup.json"),
      "utf8",
    ),
  );
  assert.equal(storedReport.integrityVerified, true);
  const audit = JSON.parse(
    await fs.readFile(path.join(root, "audit.json"), "utf8"),
  );
  assert.equal(audit.events[0].action, "backup-created");
  const history = await engine.history();
  assert.equal(history.length, 1);
  assert.equal(history[0].versionId, "backup.v1");
});

test("stores only changed files in incremental snapshots", async (t) => {
  const { root, runtimeDirectory, engine } = await fixture(t);
  await engine.createSnapshot({ type: "full", versionId: "backup.v1" });
  await writeJson(path.join(runtimeDirectory, "finance.json"), [
    { term: "Entry One" },
    { term: "Entry Two" },
  ]);
  await fs.writeFile(path.join(runtimeDirectory, "notes.txt"), "added\n");
  await fs.rm(path.join(runtimeDirectory, "auxiliary.txt"));
  const report = await engine.createSnapshot({
    type: "incremental",
    versionId: "backup.v2",
  });
  assert.equal(report.manifest.parentVersionId, "backup.v1");
  assert.deepEqual(report.manifest.changedFiles.sort(), [
    "finance.json",
    "notes.txt",
  ]);
  assert.deepEqual(report.manifest.deletedFiles, ["auxiliary.txt"]);
  assert.equal(
    report.manifest.files.find((file) => file.path === "index.json")
      .storedInVersion,
    "backup.v1",
  );
  assert.equal(
    await fs
      .readdir(path.join(root, "backups", "backup.v2", "files"))
      .then((items) => items.includes("index.json")),
    false,
  );
  assert.equal(await engine.verify("backup.v2"), true);
});

test("restores full and incremental versions by ID", async (t) => {
  const { root, runtimeDirectory, engine } = await fixture(t);
  await engine.createSnapshot({ type: "full", versionId: "backup.v1" });
  await writeJson(path.join(runtimeDirectory, "finance.json"), [
    { term: "Entry One" },
    { term: "Entry Two" },
  ]);
  await engine.createSnapshot({ type: "incremental", versionId: "backup.v2" });
  await writeJson(path.join(runtimeDirectory, "finance.json"), [
    { term: "Corrupted live state" },
  ]);
  let report = await engine.restore("backup.v1");
  assert.equal(report.runtimeCount, 1);
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(runtimeDirectory, "finance.json"), "utf8"),
    ),
    [{ term: "Entry One" }],
  );
  report = await engine.restore("backup.v2", { automatic: true });
  assert.equal(report.runtimeCount, 2);
  assert.equal(report.automatic, true);
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(runtimeDirectory, "finance.json"), "utf8"),
    ),
    [{ term: "Entry One" }, { term: "Entry Two" }],
  );
  const audit = JSON.parse(
    await fs.readFile(path.join(root, "audit.json"), "utf8"),
  );
  assert.ok(
    audit.events.some((event) => event.action === "automatic-rollback"),
  );
});

test("refuses restore when any backup checksum is invalid", async (t) => {
  const { root, runtimeDirectory, engine } = await fixture(t);
  await engine.createSnapshot({ type: "full", versionId: "backup.v1" });
  const before = await fs.readFile(
    path.join(runtimeDirectory, "finance.json"),
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "backups", "backup.v1", "files", "finance.json"),
    "tampered\n",
  );
  await assert.rejects(
    () => engine.restore("backup.v1"),
    (error) =>
      error instanceof BackupRollbackError && error.code === "integrity_failed",
  );
  assert.equal(
    await fs.readFile(path.join(runtimeDirectory, "finance.json"), "utf8"),
    before,
  );
});
