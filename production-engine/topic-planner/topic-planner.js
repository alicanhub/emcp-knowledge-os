import * as fs from "node:fs/promises";
import * as path from "node:path";

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"];
const DEFAULT_HOURS = { beginner: 2, intermediate: 3, advanced: 5, expert: 8 };

export class TopicPlannerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TopicPlannerError";
    this.code = code;
  }
}

const clone = (value) => structuredClone(value);
const normalize = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const monthKey = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const addMonth = (month, offset) => {
  const [year, index] = month.split("-").map(Number);
  return monthKey(new Date(Date.UTC(year, index - 1 + offset, 1)));
};

export class JsonTopicPlanner {
  #runtime;
  #queue;
  #reportsDirectory;
  #clock;

  constructor({
    runtimeEntries = [],
    queue = null,
    reportsDirectory = null,
    clock = () => new Date(),
  } = {}) {
    if (!Array.isArray(runtimeEntries))
      throw new TopicPlannerError(
        "invalid_runtime",
        "runtimeEntries must be an array.",
      );
    this.#runtime = this.#indexRuntime(runtimeEntries);
    this.#queue = queue;
    this.#reportsDirectory = reportsDirectory;
    this.#clock = clock;
  }

  /** @param {any} options */
  static async fromFiles(options = {}) {
    const {
      runtimeIndexFile,
      queue = null,
      reportsDirectory = null,
      clock,
    } = options;
    if (!runtimeIndexFile)
      throw new TopicPlannerError(
        "missing_runtime_index",
        "A runtime search-index path is required.",
      );
    let runtimeEntries;
    try {
      runtimeEntries = JSON.parse(await fs.readFile(runtimeIndexFile, "utf8"));
    } catch (error) {
      throw new TopicPlannerError(
        "invalid_runtime",
        `Cannot read runtime index: ${error.message}`,
      );
    }
    return new JsonTopicPlanner({
      runtimeEntries,
      queue,
      reportsDirectory,
      clock,
    });
  }

  static async readPack(file, packId = null) {
    let value;
    try {
      value = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      throw new TopicPlannerError(
        "invalid_pack",
        `Cannot read content pack: ${error.message}`,
      );
    }
    const packs = Array.isArray(value) ? value : [value];
    const pack = packId ? packs.find((item) => item.id === packId) : packs[0];
    if (!pack)
      throw new TopicPlannerError(
        "pack_not_found",
        `Content pack not found: ${packId}`,
      );
    return clone(pack);
  }

  generate({ pack, topics, startMonth, monthlyDraftCapacity = 20 }) {
    this.#assertPack(pack);
    if (!Array.isArray(topics))
      throw new TopicPlannerError("invalid_topics", "topics must be an array.");
    if (!Number.isInteger(monthlyDraftCapacity) || monthlyDraftCapacity < 1)
      throw new TopicPlannerError(
        "invalid_capacity",
        "monthlyDraftCapacity must be a positive integer.",
      );
    const firstMonth = startMonth || monthKey(this.#clock());
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(firstMonth))
      throw new TopicPlannerError(
        "invalid_month",
        "startMonth must use YYYY-MM.",
      );

    const { unique, duplicates } = this.#deduplicate(topics);
    const ordered = this.#order(unique);
    const planned = ordered.map((topic, index) => {
      const existing = this.#findRuntime(topic);
      const difficulty =
        topic.difficulty || pack.difficulty_level || "beginner";
      const hours = existing
        ? 0
        : (topic.estimatedHours ?? DEFAULT_HOURS[difficulty]);
      return {
        ...clone(topic),
        difficulty,
        prerequisites: [...(topic.prerequisites || [])],
        learningOrder: index + 1,
        existingRuntimeEntry: Boolean(existing),
        runtimeEntryId: existing?.id || null,
        estimatedDraftHours: hours,
      };
    });
    const draftTopics = planned.filter((topic) => !topic.existingRuntimeEntry);
    const monthlyPlans = [];
    for (
      let offset = 0;
      offset * monthlyDraftCapacity < draftTopics.length;
      offset++
    ) {
      const batch = draftTopics.slice(
        offset * monthlyDraftCapacity,
        (offset + 1) * monthlyDraftCapacity,
      );
      monthlyPlans.push({
        month: addMonth(firstMonth, offset),
        topicIds: batch.map((topic) => topic.id),
        draftCount: batch.length,
        estimatedHours: batch.reduce(
          (sum, topic) => sum + topic.estimatedDraftHours,
          0,
        ),
      });
    }
    return {
      schemaVersion: 1,
      id: `plan.${pack.id}`,
      packId: pack.id,
      packTitle: clone(pack.title),
      generatedAt: this.#clock().toISOString(),
      prerequisites: [...(pack.prerequisites || [])],
      topics: planned,
      duplicates,
      statistics: {
        proposedCount: topics.length,
        uniqueTopicCount: planned.length,
        existingRuntimeCount: planned.length - draftTopics.length,
        estimatedDraftCount: draftTopics.length,
        estimatedWorkloadHours: draftTopics.reduce(
          (sum, topic) => sum + topic.estimatedDraftHours,
          0,
        ),
        monthlyPlanCount: monthlyPlans.length,
      },
      monthlyPlans,
    };
  }

  async writeReport(plan, file = null) {
    this.#assertPlan(plan);
    const destination =
      file ||
      (this.#reportsDirectory &&
        path.join(this.#reportsDirectory, `${plan.id}.json`));
    if (!destination)
      throw new TopicPlannerError(
        "missing_report_path",
        "A report path or reportsDirectory is required.",
      );
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    await fs.rename(temporary, destination);
    return destination;
  }

  async enqueue(
    plan,
    {
      jobId = `${plan.id}.production`,
      priority = "normal",
      dependencies = [],
      maxRetries = 2,
    } = {},
  ) {
    this.#assertPlan(plan);
    if (!this.#queue?.create)
      throw new TopicPlannerError(
        "queue_unavailable",
        "A Job Queue Engine instance is required.",
      );
    return this.#queue.create({
      id: jobId,
      title: `${plan.packTitle.en} production plan`,
      priority,
      dependencies,
      maxRetries,
      payload: {
        kind: "topic-production-plan",
        planId: plan.id,
        packId: plan.packId,
        estimatedDraftCount: plan.statistics.estimatedDraftCount,
        estimatedWorkloadHours: plan.statistics.estimatedWorkloadHours,
        monthlyPlans: plan.monthlyPlans,
        plan: clone(plan),
      },
    });
  }

  #deduplicate(topics) {
    const identities = new Map(),
      unique = [],
      duplicates = [];
    for (const topic of topics) {
      this.#assertTopic(topic);
      const fields = [
        ["id", topic.id],
        ["English title", topic.title.en],
        ["Turkish title", topic.title.tr],
        ["abbreviation", topic.abbreviation],
        ...(topic.aliases?.en || []).map((value) => ["English alias", value]),
        ...(topic.aliases?.tr || []).map((value) => ["Turkish alias", value]),
      ].filter(([, value]) => normalize(value));
      const match = fields
        .map(([field, value]) => ({
          field,
          owner: identities.get(normalize(value)),
        }))
        .find((item) => item.owner);
      if (match) {
        duplicates.push({
          candidateId: topic.id,
          duplicateOf: match.owner,
          matchedBy: match.field,
        });
        continue;
      }
      unique.push(topic);
      for (const [, value] of fields)
        identities.set(normalize(value), topic.id);
    }
    return { unique, duplicates };
  }

  #order(topics) {
    const byId = new Map(
      topics.map((topic, index) => [topic.id, { topic, index }]),
    );
    const remaining = new Map(byId),
      ordered = [],
      completed = new Set();
    for (const topic of topics)
      for (const prerequisite of topic.prerequisites || [])
        if (!byId.has(prerequisite))
          throw new TopicPlannerError(
            "missing_prerequisite",
            `Topic ${topic.id} requires unknown topic ${prerequisite}.`,
          );
    while (remaining.size) {
      const ready = [...remaining.values()]
        .filter(({ topic }) =>
          (topic.prerequisites || []).every((id) => completed.has(id)),
        )
        .sort(
          (a, b) =>
            DIFFICULTIES.indexOf(a.topic.difficulty || "beginner") -
              DIFFICULTIES.indexOf(b.topic.difficulty || "beginner") ||
            a.index - b.index,
        );
      if (!ready.length)
        throw new TopicPlannerError(
          "prerequisite_cycle",
          "Topic prerequisites contain a cycle.",
        );
      const selected = ready[0].topic;
      ordered.push(selected);
      completed.add(selected.id);
      remaining.delete(selected.id);
    }
    return ordered;
  }

  #indexRuntime(entries) {
    return entries.map((entry, index) => {
      const values = [
        entry.id,
        entry.term,
        entry.title?.en,
        entry.title?.tr,
        entry.tr,
        entry.abbreviation,
        ...(entry.aliases?.en || []),
        ...(entry.aliases?.tr || []),
      ]
        .map(normalize)
        .filter(Boolean);
      return {
        id: entry.id || entry.knowledgeId || `runtime.${index}`,
        identities: new Set(values),
      };
    });
  }

  #findRuntime(topic) {
    const identities = [
      topic.id,
      topic.title.en,
      topic.title.tr,
      topic.abbreviation,
      ...(topic.aliases?.en || []),
      ...(topic.aliases?.tr || []),
    ]
      .map(normalize)
      .filter(Boolean);
    return (
      this.#runtime.find((entry) =>
        identities.some((identity) => entry.identities.has(identity)),
      ) || null
    );
  }

  #assertPack(pack) {
    if (
      !pack ||
      typeof pack.id !== "string" ||
      !pack.id ||
      !pack.title?.en ||
      !pack.title?.tr
    )
      throw new TopicPlannerError(
        "invalid_pack",
        "Pack id and bilingual title are required.",
      );
    if (pack.difficulty_level && !DIFFICULTIES.includes(pack.difficulty_level))
      throw new TopicPlannerError(
        "invalid_difficulty",
        `Unknown pack difficulty: ${pack.difficulty_level}`,
      );
  }

  #assertTopic(topic) {
    if (
      !topic ||
      typeof topic.id !== "string" ||
      !topic.id ||
      !topic.title?.en ||
      !topic.title?.tr
    )
      throw new TopicPlannerError(
        "invalid_topic",
        "Every topic needs an id and bilingual title.",
      );
    if (topic.difficulty && !DIFFICULTIES.includes(topic.difficulty))
      throw new TopicPlannerError(
        "invalid_difficulty",
        `Unknown difficulty for ${topic.id}.`,
      );
    if (
      topic.estimatedHours !== undefined &&
      (!Number.isFinite(topic.estimatedHours) || topic.estimatedHours < 0)
    )
      throw new TopicPlannerError(
        "invalid_workload",
        `Invalid estimatedHours for ${topic.id}.`,
      );
  }

  #assertPlan(plan) {
    if (
      !plan ||
      plan.schemaVersion !== 1 ||
      !plan.id ||
      !Array.isArray(plan.topics)
    )
      throw new TopicPlannerError(
        "invalid_plan",
        "A Topic Planner v1 plan is required.",
      );
  }
}
