(function (global) {
  "use strict";
  const core = global.EMCPCore;
  const engine = global.EMCPBilingualSearch;
  if (!engine) throw new Error("Bilingual search engine is unavailable");
  let entries = [],
    relationshipIndex = [],
    searchable = engine.create([]),
    manifest = null,
    activeBase = "data/knowledge",
    activeFetcher = null,
    translationsPromise = null,
    worker = null,
    workerSequence = 0;
  const categoryPromises = new Map(),
    workerRequests = new Map();
  const normalize = engine.normalize;
  function rebuildSearch() {
    searchable = engine.create(entries);
  }
  function mapResult(result) {
    return {
      entry: entries[result.index],
      index: result.index,
      _s: result.score,
      _tier: result.tier,
      breakdown: result.breakdown,
      reasons: result.reasons,
    };
  }
  function score(entry, query, categoryAliases = {}) {
    return engine.create([entry]).search(query, categoryAliases)[0]?.score || 0;
  }
  function search(query, categoryAliases = {}) {
    return searchable.search(query, categoryAliases).map(mapResult);
  }
  function setEntries(value) {
    entries = core.schemas.knowledgeEntries(value);
    rebuildSearch();
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
        resolve(results.map(mapResult).filter((item) => item.entry));
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
    rebuildSearch();
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
          rebuildSearch();
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
    highlight: engine.highlight,
    suggest: (query, limit) => searchable.suggest(query, limit),
    get weights() {
      return engine.weights;
    },
    loadCategory,
    hydrate,
    related,
    get entries() {
      return entries.slice();
    },
  };
})(window);
