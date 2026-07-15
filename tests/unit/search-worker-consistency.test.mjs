import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const entries = [
  {
    term: "Alpha",
    tr: "Alfa",
    abbr: "ALP",
    aliases: ["first marker"],
    tags: ["tag marker"],
    keywords: ["keyword marker"],
    def: "definition marker",
    defEn: "English definition marker",
    description: "description marker",
    use: "usage Turkish marker",
    useEn: "usage English marker",
    example: "worked example marker",
    cat: "Finance",
    category: "Investment",
    details: {
      simpleExplanation: { en: "simple English marker", tr: "basit işaret" },
      professionalExplanation: {
        en: "professional English marker",
        tr: "profesyonel işaret",
      },
      realWorldExample: { en: "real world marker", tr: "gerçek dünya işareti" },
      siteExample: { en: "site marker", tr: "şantiye işareti" },
      officeExample: { en: "office marker", tr: "ofis işareti" },
      practicalTips: {
        en: ["practical marker"],
        tr: ["uygulama işareti"],
      },
    },
  },
  { term: "Beta", def: "unrelated content", cat: "Legal" },
];

function synchronousSearch(query, categoryAliases = {}) {
  const context = {
    clearTimeout,
    setTimeout,
    EMCPCore: { schemas: { knowledgeEntries: (value) => value } },
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync("js/knowledge.js", "utf8"), context);
  context.EMCPKnowledge.setEntries(entries);
  return context.EMCPKnowledge.search(query, categoryAliases).map(
    ({ index, _s }) => ({ index, score: _s }),
  );
}

function workerSearch(query, categoryAliases = {}) {
  let listener;
  let response;
  const context = {
    self: {
      addEventListener: (_type, callback) => {
        listener = callback;
      },
      postMessage: (message) => {
        response = message;
      },
    },
  };
  vm.runInNewContext(fs.readFileSync("js/search-worker.js", "utf8"), context);
  listener({ data: { type: "index", entries } });
  listener({ data: { type: "search", id: 1, query, categoryAliases } });
  return response.results.map(({ index, score }) => ({ index, score }));
}

test("worker search matches synchronous search for every searchable field", () => {
  const queries = [
    "Alpha",
    "Alfa",
    "ALP",
    "first marker",
    "tag marker",
    "keyword marker",
    "definition marker",
    "English definition marker",
    "description marker",
    "usage Turkish marker",
    "usage English marker",
    "worked example marker",
    "simple English marker",
    "basit işaret",
    "professional English marker",
    "profesyonel işaret",
    "real world marker",
    "gerçek dünya işareti",
    "site marker",
    "şantiye işareti",
    "office marker",
    "ofis işareti",
    "practical marker",
    "uygulama işareti",
    "Investment",
  ];
  for (const query of queries)
    assert.deepEqual(workerSearch(query), synchronousSearch(query), query);

  const categoryAliases = { Finance: "money marker" };
  assert.deepEqual(
    workerSearch("money marker", categoryAliases),
    synchronousSearch("money marker", categoryAliases),
  );
});
