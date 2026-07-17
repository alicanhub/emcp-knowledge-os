import * as fs from "node:fs/promises";
import * as path from "node:path";

export const RESEARCH_CATEGORIES = [
  "regulations",
  "standards",
  "formulas",
  "calculators",
  "references",
  "uk-guidance",
  "turkey-guidance",
  "examples",
  "glossary-links",
];
const STATUSES = ["pending", "researching", "verified", "rejected"];
const TRANSITIONS = {
  pending: ["researching", "rejected"],
  researching: ["verified", "rejected"],
  verified: [],
  rejected: [],
};
export class ResearchQueueError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ResearchQueueError";
    this.code = code;
  }
}
const clone = (value) => structuredClone(value);
const iso = (clock) => clock().toISOString();
const countMap = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));

export class JsonResearchQueue {
  #file;
  #clock;
  #tasks = new Map();
  /** @param {any} options */
  constructor(file, options = {}) {
    if (!file || typeof file !== "string")
      throw new ResearchQueueError(
        "invalid_file",
        "A research queue JSON path is required.",
      );
    this.#file = file;
    this.#clock = options.clock || (() => new Date());
  }
  async load() {
    let document;
    try {
      document = JSON.parse(await fs.readFile(this.#file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw new ResearchQueueError(
        "invalid_persistence",
        `Cannot load research queue: ${error.message}`,
      );
    }
    if (document?.version !== 1 || !Array.isArray(document.tasks))
      throw new ResearchQueueError(
        "invalid_persistence",
        "Research queue must use version 1 and contain tasks.",
      );
    const tasks = new Map();
    for (const task of document.tasks) {
      this.#assertTask(task);
      if (tasks.has(task.id))
        throw new ResearchQueueError(
          "duplicate_task",
          `Duplicate research task: ${task.id}`,
        );
      tasks.set(task.id, clone(task));
    }
    this.#tasks = tasks;
  }
  async createForDrafts(result) {
    if (!result || !Array.isArray(result.drafts))
      throw new ResearchQueueError(
        "invalid_drafts",
        "A Draft Generator v1 result is required.",
      );
    const created = [],
      addedIds = [],
      now = iso(this.#clock);
    for (const draft of result.drafts)
      for (const category of RESEARCH_CATEGORIES) {
        const id = `${draft.draft_id}.research.${category}`;
        if (this.#tasks.has(id)) continue;
        const task = {
          id,
          draftId: draft.draft_id,
          recordId: draft.id,
          draftPath: draft.path,
          sourcePack: draft.source_pack,
          plannerJobId: draft.planner_job_id,
          category,
          status: "pending",
          confidenceScore: 0,
          evidence: [],
          rejectionReason: null,
          createdAt: now,
          updatedAt: now,
          startedAt: null,
          verifiedAt: null,
          rejectedAt: null,
        };
        this.#tasks.set(id, task);
        addedIds.push(id);
        created.push(clone(task));
      }
    await this.#persistOrRevert(() =>
      addedIds.forEach((id) => this.#tasks.delete(id)),
    );
    return created;
  }
  get(taskId) {
    const task = this.#tasks.get(taskId);
    return task ? clone(task) : null;
  }
  list(query = {}) {
    return [...this.#tasks.values()]
      .filter((task) => !query.draftId || task.draftId === query.draftId)
      .filter((task) => !query.category || task.category === query.category)
      .filter((task) => !query.status || task.status === query.status)
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      )
      .map(clone);
  }
  async transition(taskId, status, rejectionReason = "") {
    const task = this.#required(taskId);
    if (
      !STATUSES.includes(status) ||
      !TRANSITIONS[task.status].includes(status)
    )
      throw new ResearchQueueError(
        "invalid_transition",
        `Cannot transition ${task.status} to ${status}.`,
      );
    if (status === "verified" && task.evidence.length === 0)
      throw new ResearchQueueError(
        "missing_evidence",
        "A task needs evidence before verification.",
      );
    if (status === "verified" && task.confidenceScore <= 0)
      throw new ResearchQueueError(
        "missing_confidence",
        "A verified task needs a positive confidence score.",
      );
    if (status === "rejected" && !String(rejectionReason).trim())
      throw new ResearchQueueError(
        "missing_rejection_reason",
        "Rejected research needs a reason.",
      );
    const previous = clone(task),
      now = iso(this.#clock);
    task.status = status;
    task.updatedAt = now;
    if (status === "researching") task.startedAt = now;
    if (status === "verified") task.verifiedAt = now;
    if (status === "rejected") {
      task.rejectedAt = now;
      task.rejectionReason = String(rejectionReason).trim();
    }
    await this.#persistOrRevert(() => this.#tasks.set(taskId, previous));
    return clone(task);
  }
  async addEvidence(taskId, evidence) {
    const task = this.#required(taskId);
    if (["verified", "rejected"].includes(task.status))
      throw new ResearchQueueError(
        "task_terminal",
        "Evidence cannot be changed after a final decision.",
      );
    this.#assertEvidence(evidence);
    const previous = clone(task),
      now = iso(this.#clock);
    task.evidence.push({
      ...clone(evidence),
      id: `${task.id}.evidence.${String(task.evidence.length + 1).padStart(3, "0")}`,
      createdAt: now,
    });
    task.updatedAt = now;
    await this.#persistOrRevert(() => this.#tasks.set(taskId, previous));
    return clone(task);
  }
  async setConfidence(taskId, score) {
    const task = this.#required(taskId);
    if (["verified", "rejected"].includes(task.status))
      throw new ResearchQueueError(
        "task_terminal",
        "Confidence cannot change after a final decision.",
      );
    if (!Number.isFinite(score) || score < 0 || score > 1)
      throw new ResearchQueueError(
        "invalid_confidence",
        "Confidence must be between 0 and 1.",
      );
    const previous = clone(task);
    task.confidenceScore = score;
    task.updatedAt = iso(this.#clock);
    await this.#persistOrRevert(() => this.#tasks.set(taskId, previous));
    return clone(task);
  }
  statistics() {
    const byStatus = countMap(STATUSES),
      byCategory = countMap(RESEARCH_CATEGORIES);
    let evidenceItems = 0,
      confidence = 0;
    for (const task of this.#tasks.values()) {
      byStatus[task.status]++;
      byCategory[task.category]++;
      evidenceItems += task.evidence.length;
      confidence += task.confidenceScore;
    }
    return {
      total: this.#tasks.size,
      byStatus,
      byCategory,
      evidenceItems,
      averageConfidence: this.#tasks.size
        ? Number((confidence / this.#tasks.size).toFixed(4))
        : 0,
    };
  }
  async exportReport(file) {
    if (!file)
      throw new ResearchQueueError(
        "invalid_report",
        "A JSON report path is required.",
      );
    const report = {
      version: 1,
      generatedAt: iso(this.#clock),
      statistics: this.statistics(),
      tasks: this.list(),
    };
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(
      temporary,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(temporary, file);
    return file;
  }
  #required(taskId) {
    const task = this.#tasks.get(taskId);
    if (!task)
      throw new ResearchQueueError(
        "task_not_found",
        `Unknown research task: ${taskId}`,
      );
    return task;
  }
  #assertEvidence(evidence) {
    for (const field of [
      "field",
      "title",
      "publisher",
      "url",
      "accessedAt",
      "note",
    ])
      if (typeof evidence?.[field] !== "string" || !evidence[field].trim())
        throw new ResearchQueueError(
          "invalid_evidence",
          `Evidence ${field} is required.`,
        );
    try {
      const url = new URL(evidence.url);
      if (url.protocol !== "https:") throw new Error();
    } catch {
      throw new ResearchQueueError(
        "invalid_evidence",
        "Evidence URL must use HTTPS.",
      );
    }
    if (
      Number.isNaN(Date.parse(evidence.accessedAt)) ||
      (evidence.publishedAt && Number.isNaN(Date.parse(evidence.publishedAt)))
    )
      throw new ResearchQueueError(
        "invalid_evidence",
        "Evidence dates must be valid ISO dates.",
      );
    if (typeof evidence.official !== "boolean")
      throw new ResearchQueueError(
        "invalid_evidence",
        "Evidence official must be boolean.",
      );
  }
  #assertTask(task) {
    if (
      !task?.id ||
      !task.draftId ||
      !task.recordId ||
      !RESEARCH_CATEGORIES.includes(task.category) ||
      !STATUSES.includes(task.status)
    )
      throw new ResearchQueueError(
        "invalid_persistence",
        "Persisted research task is invalid.",
      );
    if (
      !Array.isArray(task.evidence) ||
      !Number.isFinite(task.confidenceScore) ||
      task.confidenceScore < 0 ||
      task.confidenceScore > 1
    )
      throw new ResearchQueueError(
        "invalid_persistence",
        `Invalid evidence or confidence for ${task.id}.`,
      );
    task.evidence.forEach((evidence) => this.#assertEvidence(evidence));
  }
  async #persistOrRevert(revert) {
    try {
      await fs.mkdir(path.dirname(this.#file), { recursive: true });
      const temporary = `${this.#file}.${process.pid}.tmp`;
      await fs.writeFile(
        temporary,
        `${JSON.stringify({ version: 1, tasks: [...this.#tasks.values()] }, null, 2)}\n`,
        "utf8",
      );
      await fs.rename(temporary, this.#file);
    } catch (error) {
      revert();
      throw new ResearchQueueError(
        "persistence_failed",
        `Cannot persist research queue: ${error.message}`,
      );
    }
  }
}
