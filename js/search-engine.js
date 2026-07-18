(function (global) {
  "use strict";

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
  const GROUPS = [
    {
      key: "title",
      label: "Title",
      weights: [3000, 1800, 1200, 700, 400, 180, 320],
      tiers: [6, 4, 3, 3, 2, 2, 1],
    },
    {
      key: "abbreviation",
      label: "Abbreviation",
      weights: [2500, 1550, 1000, 650, 380, 170, 300],
      tiers: [5, 4, 3, 3, 2, 2, 1],
    },
    {
      key: "alias",
      label: "Alias",
      weights: [2400, 1500, 950, 600, 350, 160, 280],
      tiers: [5, 4, 3, 3, 2, 2, 1],
    },
    {
      key: "keyword",
      label: "Keyword",
      weights: [1000, 700, 500, 320, 210, 100, 160],
      tiers: [3, 3, 3, 3, 2, 2, 1],
    },
    {
      key: "tag",
      label: "Tag",
      weights: [950, 650, 460, 300, 190, 90, 150],
      tiers: [3, 3, 3, 3, 2, 2, 1],
    },
    {
      key: "category",
      label: "Category",
      weights: [850, 580, 400, 260, 170, 80, 140],
      tiers: [3, 3, 3, 3, 2, 2, 1],
    },
    {
      key: "related",
      label: "Related concept",
      weights: [700, 480, 340, 220, 140, 70, 120],
      tiers: [3, 3, 3, 3, 2, 2, 1],
    },
    {
      key: "definition",
      label: "Definition",
      weights: [650, 440, 300, 190, 120, 60, 100],
      tiers: [3, 3, 3, 3, 2, 2, 1],
    },
    {
      key: "practical",
      label: "Practical use",
      weights: [500, 340, 240, 150, 95, 45, 80],
      tiers: [3, 3, 3, 3, 2, 2, 1],
    },
    {
      key: "example",
      label: "Example",
      weights: [400, 280, 190, 120, 75, 35, 65],
      tiers: [3, 3, 3, 3, 2, 2, 1],
    },
  ];
  const MATCH_TYPES = [
    "exact",
    "prefix",
    "contains",
    "word-exact",
    "word-prefix",
    "partial-word",
    "fuzzy",
  ];
  const list = (value) =>
    (Array.isArray(value) ? value : value ? [value] : []).filter(
      (item) => typeof item === "string" && item.trim(),
    );
  const localized = (value) => [value?.en, value?.tr].filter(Boolean);
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
  const queryWords = (value) => {
    const all = words(value),
      meaningful = all.filter((word) => !STOP_WORDS.has(word));
    return meaningful.length ? meaningful : all;
  };

  function distance(left, right, limit) {
    if (Math.abs(left.length - right.length) > limit) return limit + 1;
    let previous = Array.from(
        { length: right.length + 1 },
        (_, index) => index,
      ),
      previousPrevious = null;
    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      let minimum = row;
      for (let column = 1; column <= right.length; column += 1) {
        let value = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
        );
        if (
          previousPrevious &&
          row > 1 &&
          column > 1 &&
          left[row - 1] === right[column - 2] &&
          left[row - 2] === right[column - 1]
        )
          value = Math.min(value, previousPrevious[column - 2] + 1);
        current[column] = value;
        minimum = Math.min(minimum, value);
      }
      if (minimum > limit) return limit + 1;
      previousPrevious = previous;
      previous = current;
    }
    return previous[right.length];
  }

  function fuzzyLimit(word) {
    if (word.length < 4) return 0;
    return word.length >= 8 ? 2 : 1;
  }

  function prepareValues(values) {
    return list(values).map((raw) => ({
      raw,
      normalized: normalize(raw),
      words: words(raw),
    }));
  }

  function project(entry, index) {
    const details = entry.details || {};
    return {
      index,
      identity: normalize(entry.id || entry.term || entry.title),
      sortTitle: String(entry.term || entry.title || ""),
      groups: {
        title: prepareValues([entry.term || entry.title, entry.tr]),
        abbreviation: prepareValues(entry.abbr),
        alias: prepareValues(entry.aliases),
        keyword: prepareValues(entry.keywords),
        tag: prepareValues(entry.tags),
        category: prepareValues([entry.cat, entry.category]),
        related: prepareValues(details.relatedConcepts),
        definition: prepareValues([
          entry.def,
          entry.defEn,
          entry.description,
          ...localized(details.simpleExplanation),
          ...localized(details.professionalExplanation),
        ]),
        practical: prepareValues([
          entry.use,
          entry.useEn,
          ...localized(details.siteExample),
          ...localized(details.officeExample),
          ...list(details.practicalTips?.en),
          ...list(details.practicalTips?.tr),
        ]),
        example: prepareValues([
          entry.example,
          ...localized(details.realWorldExample),
        ]),
      },
    };
  }

  function matchValue(value, normalizedQuery, tokens, weights, tiers) {
    if (!value.normalized) return null;
    let matchIndex = -1;
    if (value.normalized === normalizedQuery) matchIndex = 0;
    else if (value.normalized.startsWith(normalizedQuery)) matchIndex = 1;
    else if (value.normalized.includes(normalizedQuery)) matchIndex = 2;
    else if (tokens.every((token) => value.words.includes(token)))
      matchIndex = 3;
    else if (
      tokens.every((token) =>
        value.words.some((word) => word.startsWith(token)),
      )
    )
      matchIndex = 4;
    else if (
      tokens.every(
        (token) =>
          token.length >= 4 && value.words.some((word) => word.includes(token)),
      )
    )
      matchIndex = 5;
    else {
      let editDistance = 0;
      const fuzzy = tokens.every((token) => {
        const limit = fuzzyLimit(token);
        if (!limit) return false;
        const closest = value.words.reduce((best, word) => {
          if (Math.abs(word.length - token.length) > limit) return best;
          return Math.min(best, distance(word, token, limit));
        }, limit + 1);
        editDistance += closest;
        return closest <= limit;
      });
      if (fuzzy) matchIndex = 6;
      if (matchIndex === 6)
        return {
          matchType: MATCH_TYPES[matchIndex],
          score: Math.max(1, weights[matchIndex] - editDistance * 10),
          tier: tiers[matchIndex],
          editDistance,
          matchedText: value.raw,
        };
    }
    if (matchIndex < 0) return null;
    return {
      matchType: MATCH_TYPES[matchIndex],
      score: weights[matchIndex],
      tier: tiers[matchIndex],
      matchedText: value.raw,
    };
  }

  function explain(record, query, categoryAliases = {}) {
    const normalizedQuery = normalize(query),
      tokens = queryWords(query);
    if (!normalizedQuery || !tokens.length)
      return { score: 0, tier: 0, breakdown: [], reasons: [] };
    const breakdown = [];
    for (const group of GROUPS) {
      const values =
        group.key === "category"
          ? [
              ...record.groups.category,
              ...prepareValues(categoryAliases[record.groups.category[0]?.raw]),
            ]
          : record.groups[group.key];
      let best = null;
      for (const value of values) {
        const match = matchValue(
          value,
          normalizedQuery,
          tokens,
          group.weights,
          group.tiers,
        );
        if (
          match &&
          (!best ||
            match.tier > best.tier ||
            (match.tier === best.tier && match.score > best.score))
        )
          best = match;
      }
      if (best)
        breakdown.push({ field: group.key, label: group.label, ...best });
    }
    return {
      score: breakdown.reduce((total, item) => total + item.score, 0),
      tier: breakdown.reduce(
        (highest, item) => Math.max(highest, item.tier),
        0,
      ),
      breakdown,
      reasons: breakdown.map((item) => item.label),
    };
  }

  function create(entries) {
    const records = entries.map(project),
      vocabulary = new Set(),
      tokenIndex = new Map();
    for (const record of records)
      for (const group of Object.values(record.groups))
        for (const value of group)
          value.words.forEach((word) => {
            if (!STOP_WORDS.has(word)) {
              if (word.length >= 4) vocabulary.add(word);
              if (!tokenIndex.has(word)) tokenIndex.set(word, new Set());
              tokenIndex.get(word).add(record.index);
            }
          });

    function candidates(query, categoryAliases) {
      const tokens = queryWords(query);
      if (
        Object.values(categoryAliases).some((alias) =>
          normalize(alias).includes(normalize(query)),
        )
      )
        return records;
      const tokenSets = tokens.map((token) => {
        const matches = new Set();
        for (const [word, indices] of tokenIndex) {
          const limit = fuzzyLimit(token),
            related =
              word === token ||
              word.startsWith(token) ||
              (token.length >= 4 && word.includes(token)) ||
              (limit > 0 &&
                Math.abs(word.length - token.length) <= limit &&
                distance(word, token, limit) <= limit);
          if (related) indices.forEach((index) => matches.add(index));
        }
        return matches;
      });
      if (!tokenSets.length || tokenSets.some((set) => !set.size))
        return records;
      const smallest = tokenSets.toSorted(
        (left, right) => left.size - right.size,
      )[0];
      return [...smallest]
        .filter((index) => tokenSets.every((set) => set.has(index)))
        .map((index) => records[index]);
    }

    function search(query, categoryAliases = {}) {
      const normalizedQuery = normalize(query);
      if (!normalizedQuery) {
        const seen = new Set();
        return records
          .filter((record) => {
            if (!record.identity || seen.has(record.identity)) return false;
            seen.add(record.identity);
            return true;
          })
          .map((record) => ({
            index: record.index,
            score: 0,
            tier: 0,
            breakdown: [],
            reasons: [],
          }));
      }
      const seen = new Set();
      return candidates(query, categoryAliases)
        .map((record) => ({
          record,
          ...explain(record, query, categoryAliases),
        }))
        .filter((result) => result.score > 0)
        .sort(
          (left, right) =>
            right.tier - left.tier ||
            right.score - left.score ||
            left.record.sortTitle.localeCompare(right.record.sortTitle, "en"),
        )
        .filter((result) => {
          if (!result.record.identity || seen.has(result.record.identity))
            return false;
          seen.add(result.record.identity);
          return true;
        })
        .map(({ record, ...result }) => ({ index: record.index, ...result }));
    }

    function suggest(query, limit = 3) {
      const tokens = queryWords(query);
      if (!tokens.length) return [];
      const suggestions = [];
      for (const token of tokens) {
        const allowed = Math.max(1, fuzzyLimit(token));
        for (const candidate of vocabulary) {
          if (
            candidate === token ||
            Math.abs(candidate.length - token.length) > allowed
          )
            continue;
          const value = distance(candidate, token, allowed);
          if (value <= allowed)
            suggestions.push({ value: candidate, distance: value });
        }
      }
      return [
        ...new Map(
          suggestions
            .sort(
              (left, right) =>
                left.distance - right.distance ||
                left.value.localeCompare(right.value, "en"),
            )
            .map((item) => [item.value, item.value]),
        ).values(),
      ].slice(0, Math.max(0, Math.min(5, Number(limit) || 0)));
    }

    return { search, suggest, records: records.length };
  }

  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  function highlight(value, query) {
    const tokens = queryWords(query);
    if (!tokens.length) return escapeHTML(value);
    return String(value ?? "")
      .split(/([\p{L}\p{N}]+)/gu)
      .map((part) => {
        const word = normalize(part),
          matched =
            word &&
            tokens.some((token) => {
              if (
                word === token ||
                word.startsWith(token) ||
                (token.length >= 4 && word.includes(token))
              )
                return true;
              const limit = fuzzyLimit(token);
              return (
                limit > 0 &&
                Math.abs(word.length - token.length) <= limit &&
                distance(word, token, limit) <= limit
              );
            }),
          safe = escapeHTML(part);
        return matched ? `<mark>${safe}</mark>` : safe;
      })
      .join("");
  }

  global.EMCPBilingualSearch = {
    create,
    normalize,
    highlight,
    weights: GROUPS.map(({ key, label, weights, tiers }) => ({
      key,
      label,
      weights: Object.fromEntries(
        MATCH_TYPES.map((type, index) => [type, weights[index]]),
      ),
      tiers: Object.fromEntries(
        MATCH_TYPES.map((type, index) => [type, tiers[index]]),
      ),
    })),
  };
})(typeof self !== "undefined" ? self : window);
