import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { performance } from "node:perf_hooks";

const context = { window: null };
context.window = context;
vm.runInNewContext(fs.readFileSync("js/search-engine.js", "utf8"), context);
const search = context.EMCPBilingualSearch;
const entries = [
  {
    term: "Loan to Value",
    tr: "Kredi Değer Oranı",
    abbr: "LTV",
    aliases: ["loan-to-value ratio", "kredi değerleme oranı"],
    keywords: ["leverage", "borç oranı"],
    tags: ["mortgage", "ipotek"],
    cat: "Finansman",
    def: "Taşınmaz değerine göre kredi oranı.",
    defEn: "The loan as a proportion of property value.",
    use: "Finansman riskini karşılaştırmak için kullanılır.",
    useEn: "Used in the office to compare finance risk.",
    example: "A £70 loan on £100 value has 70% LTV.",
    details: {
      siteExample: {
        tr: "Şantiyede finansman takibi.",
        en: "Site funding review.",
      },
      officeExample: {
        tr: "Ofiste kredi analizi.",
        en: "Office loan analysis.",
      },
      practicalTips: { tr: ["Borcu kontrol et."], en: ["Check the debt."] },
      relatedConcepts: ["Loan to Cost", "Kredi Maliyet Oranı"],
    },
  },
  {
    term: "Leverage Overview",
    tr: "Kaldıraç Özeti",
    aliases: ["Loan to Value"],
    def: "A definition containing loan to value.",
    cat: "Investment",
  },
  {
    term: "Market Value",
    tr: "Piyasa Değeri",
    abbr: "MV",
    def: "Estimated exchange value.",
    cat: "Valuation",
  },
  {
    term: "Market Value",
    tr: "Piyasa Değeri",
    def: "Duplicate that must not render twice.",
    cat: "Valuation",
  },
];
const engine = search.create(entries);

test("normalizes Turkish characters, punctuation and whitespace", () => {
  assert.equal(
    search.normalize("  KREDİ—DEĞER, ÖLÇÜSÜ!  "),
    "kredi deger olcusu",
  );
  assert.equal(engine.search("kredi değer oranı")[0].index, 0);
  assert.equal(engine.search("KREDI---DEGER   ORANI")[0].index, 0);
});

test("supports bilingual fields and explains matches", () => {
  for (const query of [
    "property value",
    "borç oranı",
    "office loan analysis",
    "Şantiyede finansman",
    "Kredi Maliyet Oranı",
  ])
    assert.equal(engine.search(query)[0].index, 0, query);
  assert.ok(
    engine.search("office loan analysis")[0].reasons.includes("Practical use"),
  );
  assert.ok(
    engine.search("Kredi Maliyet Oranı")[0].reasons.includes("Related concept"),
  );
});

test("enforces exact-title, abbreviation, alias and prefix ranking tiers", () => {
  const exact = engine.search("Loan to Value");
  assert.equal(exact[0].index, 0);
  assert.equal(exact[0].breakdown[0].matchType, "exact");
  assert.equal(engine.search("LTV")[0].breakdown[0].field, "abbreviation");
  assert.equal(
    engine.search("loan-to-value ratio")[0].breakdown[0].field,
    "alias",
  );
  assert.equal(engine.search("Loan to V")[0].index, 0);
});

test("uses controlled typo tolerance and keeps fuzzy below exact matches", () => {
  const typo = engine.search("Markte Value");
  assert.equal(typo[0].index, 2);
  assert.ok(typo[0].breakdown.some((item) => item.matchType === "fuzzy"));
  const exact = engine.search("Market Value")[0];
  assert.equal(exact.index, 2);
  assert.ok(exact.tier > typo[0].tier);
  assert.ok(engine.suggest("markte").includes("market"));
});

test("deduplicates identities and treats empty queries as unscored browsing", () => {
  const empty = engine.search("  ");
  assert.equal(empty.length, 3);
  assert.ok(
    empty.every((item) => item.score === 0 && item.reasons.length === 0),
  );
  assert.equal(
    engine.search("Market Value").filter((item) => [2, 3].includes(item.index))
      .length,
    1,
  );
});

test("highlighting is normalized and escapes source content", () => {
  assert.equal(
    search.highlight("Kredi Değer <script>", "deger"),
    "Kredi <mark>Değer</mark> &lt;script&gt;",
  );
});

test("searches thousands of pre-indexed bilingual records efficiently", () => {
  const records = Array.from({ length: 5000 }, (_, index) => ({
      term: `Property concept ${index}`,
      tr: `Gayrimenkul kavramı ${index}`,
      def: `Definition for concept ${index}`,
      defEn: `English definition ${index}`,
      tags: ["property"],
      cat: "Property",
    })),
    started = performance.now(),
    largeIndex = search.create(records),
    indexedAt = performance.now(),
    results = largeIndex.search("proprty concept 4999"),
    searchedAt = performance.now();
  assert.equal(results[0].index, 4999);
  assert.ok(indexedAt - started < 2000, "5,000-record indexing exceeded 2s");
  assert.ok(searchedAt - indexedAt < 500, "5,000-record search exceeded 500ms");
});
