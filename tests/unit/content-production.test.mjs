import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  dryRun,
  queue,
  validateJobs,
  validatePack,
} from "../../scripts/content/production-engine.mjs";

test("content jobs are schema-valid and folder-consistent", () => {
  const result = validateJobs();
  assert.equal(result.count, 1);
  assert.deepEqual(result.issues, []);
});

test("master queue covers the complete 100-pack roadmap", () => {
  const result = queue();
  assert.equal(result.packs.length, 100);
  assert.equal(result.packs[0].pack_id, "pack.001");
  assert.equal(result.packs[99].pack_id, "pack.100");
  assert.ok(result.next_recommended_pack);
});

test("Pack 003 batch and safe-import preview pass", () => {
  const pack = validatePack("pack.003");
  assert.equal(pack.reviewed_records, 100);
  assert.deepEqual(pack.findings, []);
  const preview = dryRun();
  assert.equal(preview.can_import, true);
  assert.equal(preview.current_runtime_count, 378);
  assert.ok(
    fs.existsSync("content/reports/production/safe-import-dry-run.json"),
  );
});
