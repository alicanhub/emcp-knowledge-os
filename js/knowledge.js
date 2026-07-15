(function (global) {
  "use strict";
  const core = global.EMCPCore;
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
  let entries = [],
    relationshipIndex = [],
    manifest = null,
    activeBase = "data/knowledge",
    activeFetcher = null,
    translationsPromise = null,
    worker = null,
    workerSequence = 0;
  const categoryPromises = new Map(),
    workerRequests = new Map();

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
  const scoreValues = (values, query, weights) =>
    (Array.isArray(values) ? values : [values]).reduce(
      (best, value) => Math.max(best, scoreValue(value, query, weights)),
      0,
    );
  function score(entry, query, categoryAliases = {}) {
    const q = normalize(query);
    if (!q) return 1;
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
      scoreValues(entry.term || entry.title, q, title) +
      scoreValues([entry.tr, entry.abbr, ...list(entry.aliases)], q, alias) +
      scoreValues(entry.tags || [], q, tag) +
      scoreValues(entry.keywords || [], q, tag) +
      scoreValues(
        [
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
        q,
        description,
      ) +
      scoreValues(
        [entry.cat, entry.category, categoryAliases[entry.cat]],
        q,
        category,
      )
    );
  }
  function search(query, categoryAliases = {}) {
    const text = String(query || "").trim();
    return entries
      .map((entry, index) => ({
        entry,
        index,
        _s: score(entry, text, categoryAliases),
      }))
      .filter((item) => item._s > 0)
      .sort(
        (left, right) =>
          right._s - left._s ||
          left.entry.term.localeCompare(right.entry.term, "en"),
      );
  }
  function setEntries(value) {
    entries = core.schemas.knowledgeEntries(value);
    initializeWorker();
    return entries;
  }

  function initializeWorker() {
    if (!global.Worker || global.EMCPOperations?.flags?.workerSearch === false)
      return;
    if (!worker) {
      try {
        worker = new Worker("js/search-worker.js");
        worker.addEventListener("message", (event) => {
          const request = workerRequests.get(event.data?.id);
          if (!request) return;
          workerRequests.delete(event.data.id);
          request(event.data.results || []);
        });
        worker.addEventListener("error", () => {
          worker?.terminate();
          worker = null;
          workerRequests.forEach((resolve) => resolve(null));
          workerRequests.clear();
        });
      } catch {
        worker = null;
      }
    }
    worker?.postMessage({ type: "index", entries });
  }

  function searchAsync(query, categoryAliases = {}) {
    if (!worker) return Promise.resolve(search(query, categoryAliases));
    const id = ++workerSequence;
    return new Promise((resolve) => {
      const timeout = global.setTimeout(() => {
        workerRequests.delete(id);
        resolve(search(query, categoryAliases));
      }, 2000);
      workerRequests.set(id, (results) => {
        global.clearTimeout(timeout);
        if (!results) return resolve(search(query, categoryAliases));
        resolve(
          results
            .map(({ index, score: resultScore }) => ({
              entry: entries[index],
              index,
              _s: resultScore,
            }))
            .filter((item) => item.entry),
        );
      });
      worker.postMessage({ type: "search", id, query, categoryAliases });
    });
  }

  async function responseJSON(url, fetcher) {
    const response = await fetcher(url, { credentials: "same-origin" });
    if (!response?.ok) throw new Error(`Unable to load ${url}`);
    return response.json();
  }
  async function load({
    base = "data/knowledge",
    fetcher = global.fetch?.bind(global),
  } = {}) {
    if (typeof fetcher !== "function")
      throw new TypeError("Fetch is unavailable");
    activeBase = base;
    activeFetcher = fetcher;
    manifest = core.schemas.knowledgeIndex(
      await responseJSON(`${base}/index.json`, fetcher),
    );
    const compact = core.schemas.knowledgeSearchEntries(
      await responseJSON(`${base}/${manifest.searchIndex}`, fetcher),
    );
    const details = core.schemas.knowledgeDetails(
      await responseJSON(`${base}/${manifest.details}`, fetcher),
    );
    const terms = new Set();
    compact.forEach((entry) => {
      if (terms.has(entry.term))
        throw new TypeError(`Duplicate knowledge term: ${entry.term}`);
      terms.add(entry.term);
    });
    relationshipIndex = core.schemas.relationships(
      await responseJSON(`${base}/${manifest.relationships}`, fetcher),
      compact.length,
    );
    entries = compact.map((entry) => ({
      ...entry,
      details: details[String(entry.term)] || null,
    }));
    categoryPromises.clear();
    translationsPromise = null;
    initializeWorker();
    return entries;
  }

  async function translations() {
    if (!manifest?.translations) return {};
    translationsPromise ||= responseJSON(
      `${activeBase}/${manifest.translations}`,
      activeFetcher,
    ).then(core.schemas.translations);
    return translationsPromise;
  }

  async function loadCategory(categoryOrFile) {
    if (!manifest || !activeFetcher) throw new Error("Knowledge is not loaded");
    const category = manifest.categories.find(
      (item) => item.name === categoryOrFile || item.file === categoryOrFile,
    );
    if (!category) throw new TypeError("Unknown knowledge category");
    if (!categoryPromises.has(category.file))
      categoryPromises.set(
        category.file,
        Promise.all([
          responseJSON(`${activeBase}/${category.file}`, activeFetcher).then(
            core.schemas.knowledgeEntries,
          ),
          translations(),
        ]).then(([values, translated]) => {
          if (values.some((entry) => entry.cat !== category.name))
            throw new TypeError(
              `Knowledge category mismatch: ${category.file}`,
            );
          const byTerm = new Map(values.map((entry) => [entry.term, entry]));
          entries = entries.map((entry) => {
            const full = byTerm.get(entry.term);
            return full
              ? { ...entry, ...full, ...(translated[entry.term] || {}) }
              : entry;
          });
          initializeWorker();
          return values;
        }),
      );
    return categoryPromises.get(category.file);
  }

  async function hydrate(index) {
    const entry = entries[Number(index)];
    if (!entry) return null;
    if (!entry.use || !entry.example)
      await loadCategory(entry.source || entry.cat);
    return entries[Number(index)] || null;
  }

  function related(index) {
    return (relationshipIndex[Number(index)] || []).slice();
  }

  global.EMCPKnowledge = {
    load,
    setEntries,
    search,
    searchAsync,
    score,
    normalize,
    loadCategory,
    hydrate,
    related,
    get entries() {
      return entries.slice();
    },
  };
})(window);
