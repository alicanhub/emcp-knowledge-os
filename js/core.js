(function (global) {
  "use strict";

  const LIMITS = {
    string: 20000,
    name: 300,
    id: 200,
    list: 5000,
    collections: 500,
    scenarios: 1000,
    notes: 2000,
  };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const clone = (value) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  };
  const cleanString = (value, max = LIMITS.string) =>
    typeof value === "string" ? value.slice(0, max) : "";
  const cleanId = (value) =>
    cleanString(value, LIMITS.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const validDate = (value) =>
    typeof value === "string" && !Number.isNaN(Date.parse(value))
      ? value
      : new Date(0).toISOString();
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

  function parseJSON(raw, fallback) {
    if (typeof raw !== "string" || !raw.trim()) return clone(fallback);
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Ignoring malformed JSON:", error);
      return clone(fallback);
    }
  }

  function storageArea() {
    try {
      const area = global.localStorage;
      const key = "__emcp_storage_test__";
      area.setItem(key, "1");
      area.removeItem(key);
      return area;
    } catch (error) {
      console.warn("Persistent storage unavailable:", error);
      return null;
    }
  }
  const persistent = storageArea();
  const memory = new Map();
  const storage = {
    getRaw(key) {
      if (memory.has(key)) return memory.get(key);
      try {
        return persistent?.getItem(key) ?? null;
      } catch (error) {
        console.warn(`Unable to read ${key}:`, error);
        return null;
      }
    },
    setRaw(key, value) {
      const text = String(value);
      memory.set(key, text);
      try {
        persistent?.setItem(key, text);
        return true;
      } catch (error) {
        console.warn(`Unable to persist ${key}:`, error);
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        persistent?.removeItem(key);
        return true;
      } catch (error) {
        console.warn(`Unable to remove ${key}:`, error);
        return false;
      }
    },
    get(key, fallback, normalize = (value) => value) {
      const parsed = parseJSON(this.getRaw(key), fallback);
      try {
        return normalize(parsed);
      } catch (error) {
        console.warn(`Invalid stored data for ${key}:`, error);
        return clone(fallback);
      }
    },
    set(key, value) {
      try {
        const json = JSON.stringify(value);
        return typeof json === "string" ? this.setRaw(key, json) : false;
      } catch (error) {
        console.warn(`Unable to serialise ${key}:`, error);
        return false;
      }
    },
  };

  function stringList(
    value,
    { maxItems = LIMITS.list, maxLength = LIMITS.name } = {},
  ) {
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value
          .slice(0, maxItems)
          .filter((item) => typeof item === "string")
          .map((item) => item.slice(0, maxLength)),
      ),
    ];
  }

  function normalizeCollection(item) {
    if (!object(item)) return null;
    const id = cleanId(item.id),
      name = cleanString(item.name, 80).trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      terms: stringList(item.terms),
      createdAt: validDate(item.createdAt),
    };
  }
  function collections(value) {
    return Array.isArray(value)
      ? value
          .slice(0, LIMITS.collections)
          .map(normalizeCollection)
          .filter(Boolean)
      : [];
  }

  function notes(value) {
    if (!object(value)) return {};
    const result = Object.create(null);
    Object.entries(value)
      .slice(0, LIMITS.notes)
      .forEach(([key, note]) => {
        const safeKey = cleanString(key, 500),
          safeNote = cleanString(note, LIMITS.string);
        if (safeKey && typeof note === "string") result[safeKey] = safeNote;
      });
    return result;
  }

  const SNAPSHOT_KEYS = [
    "dealLoan",
    "dealPropertyValue",
    "dealCost",
    "dealGdv",
    "dealRent",
  ];
  function scenario(item) {
    if (!object(item) || !object(item.inputs)) return null;
    const id = cleanId(item.id),
      name = cleanString(item.name, LIMITS.name).trim();
    if (!id || !name) return null;
    const inputs = { dealName: cleanString(item.inputs.dealName, LIMITS.name) };
    for (const key of SNAPSHOT_KEYS) {
      const raw = item.inputs[key];
      if (
        !own(item.inputs, key) ||
        (typeof raw !== "number" && typeof raw !== "string") ||
        (typeof raw === "string" && !raw.trim())
      )
        return null;
      const number = Number(raw);
      if (!Number.isFinite(number) || number < 0) return null;
      inputs[key] = number;
    }
    return {
      id,
      name,
      inputs,
      createdAt: validDate(item.createdAt),
      updatedAt: validDate(item.updatedAt),
    };
  }
  function scenarios(value) {
    return Array.isArray(value)
      ? value.slice(0, LIMITS.scenarios).map(scenario).filter(Boolean)
      : [];
  }

  const safeFile = (value) =>
    typeof value === "string" && /^[a-z0-9][a-z0-9-]*\.json$/.test(value)
      ? value
      : null;
  function knowledgeIndex(value) {
    if (
      !object(value) ||
      !Array.isArray(value.categories) ||
      !value.categories.length ||
      value.categories.length > 50
    )
      throw new TypeError("Invalid knowledge index");
    const categories = value.categories.map((category) => {
      if (!object(category)) throw new TypeError("Invalid knowledge category");
      const file = safeFile(category.file),
        name = cleanString(category.name || category.category, 120).trim();
      if (!file) throw new TypeError("Unsafe knowledge file path");
      if (!name) throw new TypeError("Knowledge category name is required");
      return { name, file };
    });
    const translations =
      value.translations === undefined ? null : safeFile(value.translations);
    if (value.translations !== undefined && !translations)
      throw new TypeError("Unsafe translation file path");
    const searchIndex = safeFile(value.searchIndex),
      relationships = safeFile(value.relationships),
      details = safeFile(value.details);
    if (!searchIndex || !relationships || !details)
      throw new TypeError("Knowledge precomputed indexes are required");
    return { categories, translations, searchIndex, relationships, details };
  }
  const localizedText = (value) => ({
    en: cleanString(value?.en),
    tr: cleanString(value?.tr),
  });
  const localizedList = (value) => ({
    en: stringList(value?.en, { maxItems: 100, maxLength: 2000 }),
    tr: stringList(value?.tr, { maxItems: 100, maxLength: 2000 }),
  });
  const questionList = (value) => ({
    en: (Array.isArray(value?.en) ? value.en : [])
      .slice(0, 100)
      .map((item) => ({
        question: cleanString(item?.question, 2000),
        answer: cleanString(item?.answer, 10000),
      })),
    tr: (Array.isArray(value?.tr) ? value.tr : [])
      .slice(0, 100)
      .map((item) => ({
        question: cleanString(item?.question, 2000),
        answer: cleanString(item?.answer, 10000),
      })),
  });
  function knowledgeDetails(value) {
    if (!object(value) || value.version !== 2 || !object(value.entries))
      throw new TypeError("Invalid knowledge details index");
    const result = Object.create(null);
    Object.entries(value.entries)
      .slice(0, 20000)
      .forEach(([term, details]) => {
        const key = cleanString(term, 300);
        if (!key || !object(details)) return;
        result[key] = {
          simpleExplanation: localizedText(details.simpleExplanation),
          professionalExplanation: localizedText(
            details.professionalExplanation,
          ),
          realWorldExample: localizedText(details.realWorldExample),
          siteExample: localizedText(details.siteExample),
          officeExample: localizedText(details.officeExample),
          interviewQuestions: questionList(details.interviewQuestions),
          formula: object(details.formula) ? clone(details.formula) : null,
          calculatorLinks: stringList(details.calculatorLinks, {
            maxItems: 50,
            maxLength: 160,
          }),
          commonMistakes: localizedList(details.commonMistakes),
          practicalTips: localizedList(details.practicalTips),
          risks: localizedList(details.risks),
          bestPractice: localizedList(details.bestPractice),
          ukPractice: localizedText(details.ukPractice),
          turkeyPractice: localizedText(details.turkeyPractice),
          relatedConcepts: stringList(details.relatedConcepts, {
            maxItems: 100,
            maxLength: 300,
          }),
          relatedDocuments: Array.isArray(details.relatedDocuments)
            ? clone(details.relatedDocuments.slice(0, 100))
            : [],
          relatedStandards: Array.isArray(details.relatedStandards)
            ? clone(details.relatedStandards.slice(0, 100))
            : [],
          relatedRegulations: Array.isArray(details.relatedRegulations)
            ? clone(details.relatedRegulations.slice(0, 100))
            : [],
          officialSources: Array.isArray(details.officialSources)
            ? clone(details.officialSources.slice(0, 100))
            : [],
          revisionHistory: Array.isArray(details.revisionHistory)
            ? clone(details.revisionHistory.slice(0, 100))
            : [],
          difficultyLevel: [
            "beginner",
            "intermediate",
            "advanced",
            "expert",
          ].includes(details.difficultyLevel)
            ? details.difficultyLevel
            : "beginner",
          estimatedReadingTimeMinutes: Math.min(
            240,
            Math.max(
              1,
              Math.round(Number(details.estimatedReadingTimeMinutes) || 1),
            ),
          ),
          frequentlyAskedQuestions: questionList(
            details.frequentlyAskedQuestions,
          ),
          visualIllustration: object(details.visualIllustration)
            ? clone(details.visualIllustration)
            : {},
          futureVideo: object(details.futureVideo)
            ? clone(details.futureVideo)
            : {},
        };
      });
    return result;
  }
  function knowledgeSearchEntries(value) {
    if (!Array.isArray(value) || !value.length || value.length > 20000)
      throw new TypeError("Invalid knowledge search index");
    return value.map((entry, index) => {
      if (!object(entry))
        throw new TypeError(`Invalid knowledge search entry ${index}`);
      const required = ["term", "tr", "def", "defEn", "cat", "source"];
      if (required.some((key) => !cleanString(entry[key]).trim()))
        throw new TypeError(`Incomplete knowledge search entry ${index}`);
      const source = safeFile(entry.source);
      if (!source) throw new TypeError("Unsafe knowledge source path");
      return {
        term: cleanString(entry.term, 300),
        tr: cleanString(entry.tr, 300),
        abbr: cleanString(entry.abbr, 80),
        def: cleanString(entry.def),
        defEn: cleanString(entry.defEn),
        use: cleanString(entry.use),
        useEn: cleanString(entry.useEn),
        example: cleanString(entry.example),
        cat: cleanString(entry.cat, 120),
        source,
        aliases: stringList(entry.aliases, { maxItems: 100, maxLength: 300 }),
        tags: stringList(entry.tags, { maxItems: 100, maxLength: 100 }),
        keywords: stringList(entry.keywords, { maxItems: 100, maxLength: 100 }),
      };
    });
  }
  function relationships(value, entryCount = 1000) {
    if (
      !object(value) ||
      value.version !== 1 ||
      !Array.isArray(value.relationships)
    )
      throw new TypeError("Invalid relationship index");
    if (value.relationships.length !== entryCount)
      throw new TypeError("Relationship index length does not match runtime");
    return value.relationships.map((items, index) => {
      if (
        !Array.isArray(items) ||
        items.length > 20 ||
        items.some(
          (item) =>
            !Number.isInteger(item) ||
            item < 0 ||
            item >= entryCount ||
            item === index,
        ) ||
        new Set(items).size !== items.length
      )
        throw new TypeError(`Broken relationship list at index ${index}`);
      return items.slice();
    });
  }
  function runtimeConfig(value) {
    if (!object(value)) throw new TypeError("Invalid runtime configuration");
    const releaseChannel = ["stable", "beta", "canary"].includes(
      value.releaseChannel,
    )
      ? value.releaseChannel
      : "stable";
    const source = object(value.flags) ? value.flags : {};
    return {
      releaseChannel,
      flags: {
        workerSearch: source.workerSearch !== false,
        virtualResults: source.virtualResults !== false,
        preloadFeatures: source.preloadFeatures === true,
        localAnalytics: source.localAnalytics !== false,
        performanceMonitoring: source.performanceMonitoring !== false,
      },
    };
  }
  function knowledgeEntries(value) {
    if (!Array.isArray(value) || value.length > 20000)
      throw new TypeError("Invalid knowledge entries");
    return value.map((entry, index) => {
      if (!object(entry))
        throw new TypeError(`Invalid knowledge entry ${index}`);
      const required = ["term", "tr", "def", "use", "cat"];
      if (
        required.some((key) => !cleanString(entry[key], LIMITS.string).trim())
      )
        throw new TypeError(`Incomplete knowledge entry ${index}`);
      return {
        term: cleanString(entry.term, 300),
        tr: cleanString(entry.tr, 300),
        abbr: cleanString(entry.abbr, 80),
        def: cleanString(entry.def),
        use: cleanString(entry.use),
        example: cleanString(entry.example),
        cat: cleanString(entry.cat, 120),
        aliases: stringList(entry.aliases, { maxItems: 100, maxLength: 300 }),
        tags: stringList(entry.tags, { maxItems: 100, maxLength: 100 }),
        keywords: stringList(entry.keywords, { maxItems: 100, maxLength: 100 }),
        defEn: cleanString(entry.defEn),
        useEn: cleanString(entry.useEn),
        description: cleanString(entry.description),
        category: cleanString(entry.category, 120),
        title: cleanString(entry.title, 300),
      };
    });
  }
  function translations(value) {
    if (!object(value)) throw new TypeError("Invalid knowledge translations");
    const result = Object.create(null);
    Object.entries(value)
      .slice(0, 20000)
      .forEach(([term, translation]) => {
        if (!object(translation)) return;
        const key = cleanString(term, 300);
        if (key)
          result[key] = {
            defEn: cleanString(translation.defEn),
            useEn: cleanString(translation.useEn),
          };
      });
    return result;
  }

  function workspaceBackup(payload) {
    if (
      !object(payload) ||
      payload.format !== "emcp-workspace" ||
      payload.version !== 1 ||
      !object(payload.data)
    )
      throw new TypeError("Unsupported workspace backup");
    const data = payload.data;
    if (
      !Array.isArray(data.favourites) ||
      !Array.isArray(data.recent) ||
      !Array.isArray(data.collections) ||
      !object(data.notes) ||
      !Array.isArray(data.scenarios)
    )
      throw new TypeError("Invalid workspace backup");
    return {
      favourites: stringList(data.favourites),
      recent: stringList(data.recent),
      collections: collections(data.collections),
      notes: notes(data.notes),
      scenarios: scenarios(data.scenarios),
      preferences: {
        language: data.preferences?.language === "en" ? "en" : "tr",
        theme: data.preferences?.theme === "dark" ? "dark" : "light",
      },
    };
  }

  function sanitizeHTML(value) {
    const html = String(value ?? "");
    if (!global.document?.createElement) return escapeHTML(html);
    const template = global.document.createElement("template");
    template.innerHTML = html;
    const allowed = new Set(["P", "STRONG", "B", "EM", "I", "BR"]);
    const clean = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1 || !allowed.has(child.tagName)) {
          child.replaceWith(
            global.document.createTextNode(child.textContent || ""),
          );
          return;
        }
        [...child.attributes].forEach((attribute) =>
          child.removeAttribute(attribute.name),
        );
        clean(child);
      });
    };
    clean(template.content);
    return template.innerHTML;
  }

  global.EMCPCore = {
    LIMITS,
    object,
    own,
    clone,
    cleanString,
    cleanId,
    validDate,
    escapeHTML,
    parseJSON,
    storage,
    stringList,
    sanitizeHTML,
    schemas: {
      collections,
      notes,
      scenario,
      scenarios,
      knowledgeIndex,
      knowledgeEntries,
      knowledgeSearchEntries,
      knowledgeDetails,
      relationships,
      runtimeConfig,
      translations,
      workspaceBackup,
    },
  };
})(window);
