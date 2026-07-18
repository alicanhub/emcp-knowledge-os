import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const values = new Map(),
  localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
const context = { window: null, localStorage, console };
context.window = context;
vm.runInNewContext(fs.readFileSync("js/core.js", "utf8"), context);
vm.runInNewContext(fs.readFileSync("js/search-engine.js", "utf8"), context);
vm.runInNewContext(fs.readFileSync("js/knowledge.js", "utf8"), context);
const index = JSON.parse(fs.readFileSync("data/knowledge/index.json"));
const entries = index.categories.flatMap((category) =>
  JSON.parse(fs.readFileSync(`data/knowledge/${category.file}`)),
);
const english = JSON.parse(
  fs.readFileSync(`data/knowledge/${index.translations}`),
);
context.EMCPKnowledge.setEntries(
  entries.map((entry) => ({ ...entry, ...english[entry.term] })),
);

test("exact abbreviations rank first", () =>
  assert.equal(context.EMCPKnowledge.search("LTV")[0].entry.term, "LTV"));
test("English aliases retrieve bilingual entries", () =>
  assert.equal(
    context.EMCPKnowledge.search("loan to value")[0].entry.term,
    "LTV",
  ));
test("Turkish normalization is diacritic tolerant", () =>
  assert.ok(
    context.EMCPKnowledge.search("finansman").some(
      (result) => result.entry.cat === "Finansman",
    ),
  ));
test("empty queries return the complete library", () =>
  assert.equal(context.EMCPKnowledge.search("").length, 378));
