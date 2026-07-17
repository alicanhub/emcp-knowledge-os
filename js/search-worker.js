"use strict";

let records = [];
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "about",
  "bana",
  "bir",
  "bu",
  "can",
  "define",
  "do",
  "does",
  "explain",
  "for",
  "hakkinda",
  "how",
  "i",
  "icin",
  "ile",
  "in",
  "is",
  "lutfen",
  "me",
  "my",
  "nasil",
  "ne",
  "nedir",
  "of",
  "on",
  "or",
  "please",
  "tell",
  "the",
  "to",
  "ve",
  "veya",
  "what",
  "whats",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);
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
const words = (value) => normalize(value).split(" ").filter(Boolean);
const meaningfulWords = (value) =>
  words(value).filter((word) => !STOP_WORDS.has(word));
const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);
function scoreValue(value, query, weights) {
  const field = normalize(value),
    queryWords = meaningfulWords(query),
    fieldWords = words(value);
  if (!field || !query) return 0;
  if (field === query) return weights.exact;
  if (field.startsWith(query)) return weights.starts;
  if (field.includes(query)) return weights.includes;
  let total = 0;
  for (const word of queryWords) {
    if (fieldWords.includes(word)) total += weights.wordExact;
    else if (
      word.length >= 3 &&
      fieldWords.some((fieldWord) => fieldWord.startsWith(word))
    )
      total += weights.wordStart;
    else if (
      word.length >= 4 &&
      fieldWords.some((fieldWord) => fieldWord.includes(word))
    )
      total += weights.wordPartial;
  }
  return total;
}
const scoreValues = (items, query, weights) =>
  (Array.isArray(items) ? items : [items]).reduce(
    (best, value) => Math.max(best, scoreValue(value, query, weights)),
    0,
  );
function score(record, query, categoryAliases) {
  const title = {
      exact: 2000,
      starts: 1200,
      includes: 800,
      wordExact: 300,
      wordStart: 200,
      wordPartial: 100,
    },
    alias = {
      exact: 1600,
      starts: 1000,
      includes: 650,
      wordExact: 250,
      wordStart: 160,
      wordPartial: 80,
    },
    tag = {
      exact: 600,
      starts: 450,
      includes: 300,
      wordExact: 150,
      wordStart: 100,
      wordPartial: 50,
    },
    description = {
      exact: 280,
      starts: 200,
      includes: 160,
      wordExact: 60,
      wordStart: 40,
      wordPartial: 20,
    },
    category = {
      exact: 420,
      starts: 300,
      includes: 220,
      wordExact: 80,
      wordStart: 55,
      wordPartial: 30,
    };
  return (
    scoreValues(record.term, query, title) +
    scoreValues(record.aliases, query, alias) +
    scoreValues(record.tags, query, tag) +
    scoreValues(record.keywords, query, tag) +
    scoreValues(record.description, query, description) +
    scoreValues(
      [record.cat, record.category, categoryAliases[record.cat]],
      query,
      category,
    )
  );
}
self.addEventListener("message", (event) => {
  if (event.data?.type === "index") {
    records = (event.data.entries || []).map((entry) => ({
      term: entry.term || entry.title,
      aliases: [entry.tr, entry.abbr, ...list(entry.aliases)],
      tags: entry.tags || [],
      keywords: entry.keywords || [],
      description: [
        entry.def,
        entry.defEn,
        entry.description,
        entry.use,
        entry.useEn,
        entry.example,
        entry.details?.simpleExplanation?.en,
        entry.details?.simpleExplanation?.tr,
        entry.details?.professionalExplanation?.en,
        entry.details?.professionalExplanation?.tr,
        entry.details?.realWorldExample?.en,
        entry.details?.realWorldExample?.tr,
        entry.details?.siteExample?.en,
        entry.details?.siteExample?.tr,
        entry.details?.officeExample?.en,
        entry.details?.officeExample?.tr,
        ...(entry.details?.practicalTips?.en || []),
        ...(entry.details?.practicalTips?.tr || []),
      ],
      cat: entry.cat || entry.category || "",
      category: entry.category,
    }));
    return;
  }
  if (event.data?.type !== "search") return;
  const query = normalize(event.data.query);
  const results = records
    .map((record, index) => ({
      index,
      score: query ? score(record, query, event.data.categoryAliases || {}) : 1,
    }))
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        records[left.index].term.localeCompare(records[right.index].term, "en"),
    );
  self.postMessage({ id: event.data.id, results });
});
