import assert from "node:assert/strict";
import fs from "node:fs";

const base = "data/knowledge";
const read = (file) => JSON.parse(fs.readFileSync(`${base}/${file}`, "utf8"));
const index = read("index.json");
const translations = read(index.translations);
const categoryFiles = new Map(
  index.categories.map(({ category, file }) => [category, file]),
);
const entries = index.categories.flatMap(({ file }) => read(file));
const compact = entries.map((entry) => ({
  term: entry.term,
  tr: entry.tr,
  ...(entry.abbr ? { abbr: entry.abbr } : {}),
  def: entry.def,
  defEn: translations[entry.term]?.defEn || entry.def,
  use: entry.use,
  useEn: translations[entry.term]?.useEn || entry.use,
  example: entry.example,
  cat: entry.cat,
  ...(entry.aliases?.length ? { aliases: entry.aliases } : {}),
  ...(entry.tags?.length ? { tags: entry.tags } : {}),
  ...(entry.keywords?.length ? { keywords: entry.keywords } : {}),
  source: categoryFiles.get(entry.cat),
}));

const normalize = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const values = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const overlap = (left, right) => {
  const rightSet = new Set(values(right).map(normalize));
  return values(left)
    .map(normalize)
    .filter((value) => value && rightSet.has(value)).length;
};
const relationships = entries.map((entry, indexValue) =>
  entries
    .map((candidate, candidateIndex) => ({
      index: candidateIndex,
      score:
        overlap(entry.cat, candidate.cat) * 20 +
        overlap(entry.tags, candidate.tags) * 24 +
        overlap(entry.keywords, candidate.keywords) * 18 +
        overlap(
          [entry.tr, entry.abbr, ...values(entry.aliases)],
          [candidate.tr, candidate.abbr, ...values(candidate.aliases)],
        ) *
          12,
    }))
    .filter((item) => item.index !== indexValue)
    .sort(
      (left, right) =>
        right.score - left.score ||
        entries[left.index].term.localeCompare(entries[right.index].term, "en"),
    )
    .slice(0, 8)
    .map((item) => item.index),
);

const outputs = {
  "search-index.json": `${JSON.stringify(compact, null, 2)}\n`,
  "relationships.json": `${JSON.stringify({ version: 1, relationships }, null, 2)}\n`,
};
if (process.argv.includes("--check")) {
  for (const [file, content] of Object.entries(outputs))
    assert.equal(
      fs.readFileSync(`${base}/${file}`, "utf8"),
      content,
      `${file} is stale; run npm run generate:indexes`,
    );
  console.log(`Precomputed indexes are current for ${entries.length} entries.`);
} else {
  for (const [file, content] of Object.entries(outputs))
    fs.writeFileSync(`${base}/${file}`, content);
  console.log(
    `Generated search and relationship indexes for ${entries.length} entries.`,
  );
}
