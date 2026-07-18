import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: null };
context.window = context;
vm.runInNewContext(fs.readFileSync("js/search-engine.js", "utf8"), context);
vm.runInNewContext(fs.readFileSync("js/assistant-engine.js", "utf8"), context);
const assistant = context.EMCPAssistantEngine,
  normalize = context.EMCPBilingualSearch.normalize;

const record = (overrides = {}) => ({
  term: "Loan to Value",
  tr: "Kredi Değer Oranı",
  abbr: "LTV",
  def: "Kredi tutarının taşınmaz değerine oranıdır.",
  defEn: "The loan amount as a proportion of the property value.",
  cat: "Finansman",
  details: {
    formula: {
      expression: "LTV = Loan / Property Value × 100",
      notes: {
        en: "Expressed as a percentage.",
        tr: "Yüzde olarak gösterilir.",
      },
    },
    risks: {
      en: ["Higher leverage can increase financing exposure."],
      tr: ["Daha yüksek kaldıraç finansman riskini artırabilir."],
    },
    realWorldExample: {
      en: "A property purchase may be assessed using its LTV.",
      tr: "Bir konut alımı LTV oranıyla değerlendirilebilir.",
    },
  },
  ...overrides,
});
const result = (entry, index, score, tier, reasons) => ({
  entry,
  index,
  _s: score,
  _tier: tier,
  reasons,
});

test("understands Turkish, English and mixed-language questions", () => {
  assert.equal(
    assistant.understand("LTV nedir?", normalize, "en").language,
    "tr",
  );
  assert.equal(
    assistant.understand("What is LTV?", normalize, "tr").language,
    "en",
  );
  assert.equal(
    assistant.understand("What is LTV ve riskleri?", normalize, "tr").language,
    "mixed",
  );
});

test("combines multiple local records without adding unsupported prose", () => {
  const model = assistant.compose({
    question: "Compare LTV and LTC",
    normalize,
    language: "en",
    results: [
      result(record(), 0, 2500, 5, ["Abbreviation"]),
      result(
        record({
          term: "Loan to Cost",
          tr: "Kredi Maliyet Oranı",
          abbr: "LTC",
          defEn: "The loan amount as a proportion of total project cost.",
        }),
        1,
        2400,
        5,
        ["Abbreviation"],
      ),
    ],
  });
  assert.equal(model.found, true);
  assert.equal(model.evidence.length, 2);
  assert.deepEqual(
    Array.from(model.paragraphs, (item) => item.title),
    ["Loan to Value", "Loan to Cost"],
  );
  assert.equal(model.confidence, "high");
});

test("reports insufficient evidence instead of inventing requested fields", () => {
  const noFormula = assistant.compose({
    question: "What is the formula for market evidence?",
    normalize,
    language: "en",
    results: [
      result(
        record({
          term: "Market Evidence",
          tr: "Piyasa Kanıtı",
          defEn: "Information from relevant market transactions.",
          details: {},
        }),
        0,
        700,
        3,
        ["Title"],
      ),
    ],
  });
  assert.ok(noFormula.unsupported.includes("formula"));
  assert.equal(noFormula.confidence, "medium");
  const empty = assistant.compose({
    question: "unknown",
    normalize,
    language: "en",
    results: [],
  });
  assert.equal(empty.found, false);
  assert.equal(empty.confidence, "low");
});

test("rejects weak secondary matches and preserves search ranking", () => {
  const selected = assistant.selectEvidence([
    result(record(), 0, 2500, 5, ["Abbreviation"]),
    result(record({ term: "Weak match" }), 1, 80, 1, ["Example"]),
  ]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].index, 0);
});
