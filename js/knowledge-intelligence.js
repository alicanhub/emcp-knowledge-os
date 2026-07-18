(function (global) {
  "use strict";

  const LEVELS = ["beginner", "intermediate", "advanced", "expert"],
    STAGES = [
      [
        "planning",
        ["planning", "planlama", "permission", "regulation", "mevzuat"],
      ],
      [
        "design",
        ["design", "tasarim", "architect", "specification", "drawing"],
      ],
      [
        "procurement",
        ["procurement", "ihale", "tender", "contractor", "supply"],
      ],
      [
        "construction",
        ["construction", "insaat", "site", "santiye", "build", "work"],
      ],
      ["inspection", ["inspection", "survey", "snag", "defect", "kontrol"]],
      ["completion", ["completion", "handover", "teslim", "warranty"]],
      [
        "operation",
        ["operation", "management", "maintenance", "rent", "lease", "tenant"],
      ],
    ],
    list = (value) => (Array.isArray(value) ? value : value ? [value] : []),
    unique = (items, key = (item) => item) => {
      const seen = new Set();
      return items.filter((item) => {
        const value = key(item);
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    };

  function create({ entries, related, normalize, chapters = [] }) {
    const values = list(entries),
      entryIndex = new Map(
        values.map((entry, index) => [normalize(entry.term), index]),
      ),
      categories = [
        ...new Set(values.map((entry) => entry.cat).filter(Boolean)),
      ],
      chapterLinks = new Map();
    for (const chapter of list(chapters))
      for (const reference of list(chapter.related_knowledge_entries)) {
        const key = normalize(reference);
        if (!chapterLinks.has(key)) chapterLinks.set(key, []);
        chapterLinks.get(key).push(chapter);
      }

    function relationships(index) {
      return unique(
        list(related(index))
          .filter(
            (relatedIndex) =>
              Number.isInteger(relatedIndex) &&
              relatedIndex >= 0 &&
              relatedIndex < values.length &&
              relatedIndex !== index,
          )
          .map((relatedIndex) => ({
            index: relatedIndex,
            entry: values[relatedIndex],
          })),
        (item) => item.index,
      );
    }

    function stageFor(entry) {
      const primary = normalize(
          [
            entry.term,
            entry.tr,
            ...list(entry.tags),
            ...list(entry.keywords),
            entry.use,
            entry.useEn,
          ].join(" "),
        ),
        secondary = normalize([entry.cat, entry.def, entry.defEn].join(" ")),
        findStage = (haystack) =>
          STAGES.find(([, keywords]) =>
            keywords.some((keyword) => haystack.includes(normalize(keyword))),
          )?.[0];
      return findStage(primary) || findStage(secondary) || "operation";
    }

    function regulationsFor(entry, relatedItems) {
      const details = entry.details || {},
        recorded = [
          ...list(details.relatedRegulations),
          ...list(details.relatedStandards),
        ].filter((item) =>
          normalize(
            `${item?.title?.en || item?.title || ""} ${item?.reference || ""}`,
          ).includes("building regulation"),
        ),
        buildingEntry = relatedItems.find((item) =>
          normalize(item.entry.term).includes("building regulation"),
        );
      return {
        recorded,
        relatedEntry: buildingEntry || null,
      };
    }

    function forEntry(index, recentTerms = []) {
      const entry = values[index];
      if (!entry) return null;
      const relatedItems = relationships(index),
        recent = new Set(list(recentTerms).map(normalize)),
        sameCategory = values
          .map((candidate, candidateIndex) => ({
            entry: candidate,
            index: candidateIndex,
          }))
          .filter(
            (item) => item.index !== index && item.entry.cat === entry.cat,
          ),
        readNext =
          relatedItems.find(
            (item) => !recent.has(normalize(item.entry.term)),
          ) ||
          sameCategory.find(
            (item) => !recent.has(normalize(item.entry.term)),
          ) ||
          relatedItems[0] ||
          sameCategory[0] ||
          null,
        handbook = unique(
          [
            ...list(chapterLinks.get(normalize(entry.term))),
            ...list(chapterLinks.get(normalize(entry.tr))),
            ...list(chapterLinks.get(normalize(entry.abbr))),
          ],
          (chapter) => chapter.id,
        );
      return {
        parent: { type: "category", title: entry.cat },
        children: [],
        opposites: [],
        related: relatedItems.slice(0, 8),
        frequentlyTogether: relatedItems.slice(0, 4),
        buildingRegulations: regulationsFor(entry, relatedItems),
        handbook,
        stage: stageFor(entry),
        readNext,
      };
    }

    function journeys() {
      return categories.map((category) => {
        const categoryEntries = values
          .map((entry, index) => ({ entry, index }))
          .filter((item) => item.entry.cat === category);
        return {
          topic: category,
          levels: Object.fromEntries(
            LEVELS.map((level) => [
              level,
              categoryEntries.filter(
                (item) =>
                  (item.entry.details?.difficultyLevel || "beginner") === level,
              ),
            ]),
          ),
        };
      });
    }

    function graph(index) {
      const root = values[index] ? index : 0,
        neighbours = relationships(root).slice(0, 8),
        nodes = [
          { index: root, entry: values[root], root: true },
          ...neighbours,
        ];
      return {
        nodes,
        edges: neighbours.map((item) => ({ from: root, to: item.index })),
      };
    }

    function validate() {
      const issues = [];
      if (!values.length) issues.push({ type: "empty-runtime" });
      values.forEach((entry, index) => {
        if (!entry.term || !entry.cat)
          issues.push({ type: "incomplete-entry", index });
        for (const relatedIndex of list(related(index))) {
          if (
            !Number.isInteger(relatedIndex) ||
            relatedIndex < 0 ||
            relatedIndex >= values.length ||
            relatedIndex === index
          )
            issues.push({ type: "broken-relationship", index, relatedIndex });
        }
        for (const concept of list(entry.details?.relatedConcepts))
          if (!entryIndex.has(normalize(concept)))
            issues.push({
              type: "unresolved-related-concept",
              index,
              concept,
            });
      });
      return {
        valid: !issues.some((issue) => issue.type === "broken-relationship"),
        entries: values.length,
        relationships: values.reduce(
          (total, _entry, index) => total + relationships(index).length,
          0,
        ),
        issues,
      };
    }

    return { categories, forEntry, journeys, graph, validate, stageFor };
  }

  global.EMCPKnowledgeIntelligence = { create, levels: LEVELS.slice() };
})(typeof self !== "undefined" ? self : window);
