(function (global) {
  "use strict";

  const STATES = ["saved", "in-progress", "completed", "mastered"],
    STORAGE_KEY = "emcpLearningProgress",
    object = (value) =>
      value !== null && typeof value === "object" && !Array.isArray(value);

  function create({ storage, now = () => new Date().toISOString() }) {
    function read() {
      const value = storage.get(STORAGE_KEY, {});
      if (!object(value)) return {};
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([term, item]) =>
              typeof term === "string" &&
              term.length <= 300 &&
              object(item) &&
              STATES.includes(item.status),
          )
          .slice(0, 5000)
          .map(([term, item]) => [
            term,
            {
              status: item.status,
              updatedAt:
                typeof item.updatedAt === "string" ? item.updatedAt : "",
              visits: Math.max(0, Number(item.visits) || 0),
            },
          ]),
      );
    }

    function set(term, status) {
      if (typeof term !== "string" || !term.trim() || !STATES.includes(status))
        return false;
      const values = read(),
        previous = values[term];
      values[term] = {
        status,
        updatedAt: now(),
        visits: previous?.visits || 0,
      };
      storage.set(STORAGE_KEY, values);
      return values[term];
    }

    function visit(term) {
      if (typeof term !== "string" || !term.trim()) return false;
      const values = read(),
        previous = values[term] || { status: "in-progress", visits: 0 };
      values[term] = {
        status: previous.status,
        updatedAt: now(),
        visits: previous.visits + 1,
      };
      storage.set(STORAGE_KEY, values);
      return values[term];
    }

    function get(term) {
      return read()[term] || null;
    }

    function timeline(entries) {
      const values = read();
      return entries
        .map((entry, index) => ({ entry, index, progress: values[entry.term] }))
        .filter((item) => item.progress)
        .sort(
          (left, right) =>
            Date.parse(left.progress.updatedAt || 0) -
              Date.parse(right.progress.updatedAt || 0) ||
            left.index - right.index,
        );
    }

    function percentage(term, reading = 0) {
      const state = get(term)?.status;
      if (state === "mastered") return 100;
      if (state === "completed") return 75;
      if (state === "in-progress") return Math.max(20, Math.min(60, reading));
      if (state === "saved") return 10;
      return 0;
    }

    return { get, set, visit, read, timeline, percentage };
  }

  global.EMCPLearningEngine = {
    create,
    states: STATES.slice(),
    storageKey: STORAGE_KEY,
  };
})(typeof self !== "undefined" ? self : window);
