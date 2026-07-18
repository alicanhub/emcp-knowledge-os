import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { self: {}, console };
vm.runInNewContext(fs.readFileSync("js/search-engine.js", "utf8"), context);
vm.runInNewContext(fs.readFileSync("js/command-palette.js", "utf8"), context);
const { createModel, highlight } = context.self.EMCPCommandPalette;

const entries = [
  {
    term: "Loan to Value",
    tr: "Kredi Değer Oranı",
    abbr: "LTV",
    cat: "Finansman",
    def: "Kredi tutarının mülk değerine oranı.",
    defEn: "The loan relative to property value.",
    aliases: ["loan-to-value"],
    keywords: ["mortgage", "ipotek"],
    tags: ["finance"],
  },
  {
    term: "Building Regulations",
    tr: "Yapı Yönetmelikleri",
    cat: "Planlama ve Kamu",
    def: "Yapı standartları.",
    defEn: "Building standards.",
    tags: ["regulation"],
  },
];
const storage = {
  get(key) {
    if (key === "emcpFav") return ["Loan to Value"];
    if (key === "emcpRecent") return ["Building Regulations"];
    return [];
  },
};

test("groups favourites first and removes duplicate knowledge results", () => {
  const model = createModel({ entries });
  const results = model.search("", storage);
  assert.equal(results[0].group, "Favourites");
  assert.equal(results.filter((item) => item.id === "knowledge:0").length, 1);
  assert.equal(results.filter((item) => item.id === "knowledge:1").length, 1);
});

test("searches bilingual knowledge, handbook, calculators and workspace", () => {
  const model = createModel({
    entries,
    chapters: [
      {
        id: "chapter.finance",
        title: { en: "Finance and Mortgages", tr: "Finansman ve Mortgage" },
      },
    ],
    calculators: [
      { title: "Rental Yield", target: "yieldRent", page: "calculators" },
    ],
    commands: [
      {
        id: "workspace",
        group: "Workspace",
        title: "My Workspace",
        subtitle: "Çalışma Alanım",
        action: { type: "workspace" },
      },
    ],
  });
  assert.equal(
    model.search("Kredi Değer", storage)[0].action.type,
    "knowledge",
  );
  assert.equal(model.search("mortgag", storage)[0].group, "Investor Handbook");
  assert.equal(model.search("yield", storage)[0].group, "Calculators");
  assert.equal(model.search("çalışma", storage)[0].group, "Workspace");
  assert.equal(
    model.search("regulation", { get: () => [] })[0].group,
    "Regulations",
  );
});

test("supports fuzzy subsequence matching and character highlighting", () => {
  const model = createModel({ entries });
  assert.equal(model.search("LTV", storage)[0].title, "Loan to Value");
  assert.ok(
    model
      .search("LnVl", storage)
      .some((item) => item.title === "Loan to Value"),
  );
  assert.match(highlight("Loan to Value", "LnVl"), /<mark>/);
});

test("returns an empty list for an unmatched query", () => {
  const model = createModel({ entries });
  assert.equal(model.search("zzzzzzzz", storage).length, 0);
});

test("adds a resumable handbook chapter without displacing favourites", () => {
  const model = createModel({
    entries,
    chapters: [
      {
        id: "chapter.finance",
        title: { en: "Finance and Mortgages", tr: "Finansman ve Mortgage" },
      },
    ],
  });
  const contextualStorage = {
    get: storage.get,
    getRaw: () => "chapter.finance",
  };
  const results = model.search("", contextualStorage);
  assert.equal(results[0].group, "Favourites");
  assert.ok(
    results.some((item) => item.group === "Continue Where You Left Off"),
  );
});

test("caps large result sets for predictable rendering performance", () => {
  const large = Array.from({ length: 5000 }, (_, index) => ({
    term: `Property concept ${index}`,
    tr: `Gayrimenkul kavramı ${index}`,
    cat: "Property",
  }));
  const model = createModel({ entries: large });
  assert.equal(model.search("property", { get: () => [] }).length, 120);
});
