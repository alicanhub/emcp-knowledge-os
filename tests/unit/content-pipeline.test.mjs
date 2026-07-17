import assert from "node:assert/strict";
import test from "node:test";
import {
  allChecks,
  errors,
  loadContent,
  loadLegacy,
  renderReport,
} from "../../scripts/content/lib.mjs";

test("reviewed authoring records pass every content gate", () => {
  const { records, parseIssues } = loadContent({ folders: ["reviewed"] });
  const issues = allChecks(records, parseIssues);

  assert.equal(records.length, 286);
  assert.deepEqual(errors(issues), []);
  assert.ok(records.every(({ record }) => record.review_status === "reviewed"));
});

test("reviewed content preserves legacy records and adds Packs 001, 002 and 003", () => {
  const { records } = loadContent({ folders: ["reviewed"] });
  const legacy = loadLegacy();
  const terms = new Set(legacy.entries.map(({ entry }) => entry.term));

  assert.equal(legacy.entries.length, 378);
  assert.equal(records.filter(({ record }) => record.legacy_term).length, 11);
  assert.ok(
    records
      .filter(({ record }) => record.legacy_term)
      .every(({ record }) => terms.has(record.legacy_term)),
  );
  assert.equal(
    records.filter(({ file }) => file.includes("/pack-001/")).length,
    100,
  );
  assert.equal(
    records.filter(({ file }) => file.includes("/pack-002/")).length,
    100,
  );
  assert.equal(
    records.filter(({ file }) => file.includes("/pack-003/")).length,
    81,
  );
});

test("validation report is readable and includes status totals", () => {
  const { records, parseIssues } = loadContent();
  const report = renderReport(records, allChecks(records, parseIssues));

  assert.match(report, /Reviewed records: 286/);
  assert.match(report, /Result: PASS/);
});
