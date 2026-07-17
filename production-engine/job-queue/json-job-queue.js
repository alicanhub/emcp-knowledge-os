import * as fs from "node:fs/promises";
import * as path from "node:path";

const STATUSES = [
  "pending",
  "planned",
  "drafting",
  "research",
  "review",
  "validation",
  "import",
  "completed",
  "failed",
];
const PRIORITIES = ["low", "normal", "high", "critical"];
const CONTROLS = ["active", "paused", "cancelled"];
const PRIORITY_WEIGHT = { low: 0, normal: 1, high: 2, critical: 3 };
const TRANSITIONS = {
  pending: ["planned", "failed"],
  planned: ["drafting", "failed"],
  drafting: ["research", "review", "failed"],
  research: ["drafting", "review", "failed"],
  review: ["drafting", "validation", "failed"],
  validation: ["drafting", "review", "import", "failed"],
  import: ["completed", "failed"],
  completed: [],
  failed: [],
};

export class QueueError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "QueueError";
    this.code = code;
  }
}

const copy = (value) => structuredClone(value);
const iso = (clock) => clock().toISOString();
const counts = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));

export class JsonJobQueue {
  #file;
  #clock;
  #jobs = new Map();

  constructor(file, { clock = () => new Date() } = {}) {
    if (!file || typeof file !== "string")
      throw new QueueError(
        "invalid_file",
        "A JSON persistence path is required.",
      );
    this.#file = file;
    this.#clock = clock;
  }

  async load() {
    let document;
    try {
      document = JSON.parse(await fs.readFile(this.#file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw new QueueError(
        "invalid_persistence",
        `Cannot load queue: ${error.message}`,
      );
    }
    if (document?.version !== 1 || !Array.isArray(document.jobs))
      throw new QueueError(
        "invalid_persistence",
        "Queue JSON must use version 1 and contain jobs.",
      );
    const loaded = new Map();
    for (const job of document.jobs) {
      this.#assertStoredJob(job);
      if (loaded.has(job.id))
        throw new QueueError(
          "duplicate_job",
          `Duplicate persisted job: ${job.id}`,
        );
      loaded.set(job.id, copy(job));
    }
    this.#jobs = loaded;
    this.#assertDependencies();
  }

  get(jobId) {
    const job = this.#jobs.get(jobId);
    return job ? copy(job) : null;
  }

  list(query = {}) {
    return [...this.#jobs.values()]
      .filter((job) => !query.statuses || query.statuses.includes(job.status))
      .filter(
        (job) => !query.priorities || query.priorities.includes(job.priority),
      )
      .filter(
        (job) =>
          !query.controlStates ||
          query.controlStates.includes(job.controlState),
      )
      .filter(
        (job) =>
          !query.dependency || job.dependencies.includes(query.dependency),
      )
      .sort(
        (a, b) =>
          PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id),
      )
      .map(copy);
  }

  async create(input) {
    this.#assertInput(input);
    if (this.#jobs.has(input.id))
      throw new QueueError("duplicate_job", `Job already exists: ${input.id}`);
    const dependencies = [...new Set(input.dependencies || [])];
    if (dependencies.includes(input.id))
      throw new QueueError(
        "dependency_cycle",
        "A job cannot depend on itself.",
      );
    for (const dependency of dependencies)
      if (!this.#jobs.has(dependency))
        throw new QueueError(
          "missing_dependency",
          `Unknown dependency: ${dependency}`,
        );
    const now = iso(this.#clock);
    const job = {
      id: input.id,
      title: input.title.trim(),
      priority: input.priority || "normal",
      dependencies,
      status: "pending",
      controlState: "active",
      retryCount: 0,
      maxRetries: input.maxRetries ?? 0,
      ...(input.payload === undefined ? {} : { payload: copy(input.payload) }),
      error: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      pausedAt: null,
      cancelledAt: null,
    };
    this.#jobs.set(job.id, job);
    await this.#persistOrRevert(() => this.#jobs.delete(job.id));
    return copy(job);
  }

  async transition(jobId, to, error = "Job failed") {
    const job = this.#required(jobId);
    if (job.controlState !== "active")
      throw new QueueError(
        "job_inactive",
        `Cannot transition a ${job.controlState} job.`,
      );
    if (!STATUSES.includes(to) || !TRANSITIONS[job.status].includes(to))
      throw new QueueError(
        "invalid_transition",
        `Cannot transition ${job.status} to ${to}.`,
      );
    if (
      job.status === "pending" &&
      to === "planned" &&
      !this.#dependenciesComplete(job)
    )
      throw new QueueError(
        "dependencies_incomplete",
        "All dependencies must be completed first.",
      );
    const previous = copy(job);
    const now = iso(this.#clock);
    job.status = to;
    job.updatedAt = now;
    if (!job.startedAt && to !== "pending" && to !== "failed")
      job.startedAt = now;
    job.error = to === "failed" ? String(error || "Job failed") : null;
    job.failedAt = to === "failed" ? now : null;
    if (to === "completed") job.completedAt = now;
    await this.#persistOrRevert(() => this.#jobs.set(jobId, previous));
    return copy(job);
  }

  next() {
    return (
      this.list({ statuses: ["pending"], controlStates: ["active"] }).find(
        (job) => this.#dependenciesComplete(job),
      ) || null
    );
  }

  async pause(jobId) {
    return this.#control(jobId, "paused");
  }

  async resume(jobId) {
    const job = this.#required(jobId);
    if (job.controlState !== "paused")
      throw new QueueError("not_paused", "Only paused jobs can be resumed.");
    return this.#control(jobId, "active");
  }

  async cancel(jobId) {
    return this.#control(jobId, "cancelled");
  }

  async retry(jobId) {
    const job = this.#required(jobId);
    if (job.status !== "failed")
      throw new QueueError("not_failed", "Only failed jobs can be retried.");
    if (job.controlState === "cancelled")
      throw new QueueError(
        "job_cancelled",
        "Cancelled jobs cannot be retried.",
      );
    if (job.retryCount >= job.maxRetries)
      throw new QueueError(
        "retry_exhausted",
        "The retry limit has been reached.",
      );
    const previous = copy(job);
    const now = iso(this.#clock);
    Object.assign(job, {
      status: "pending",
      controlState: "active",
      retryCount: job.retryCount + 1,
      error: null,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      pausedAt: null,
      cancelledAt: null,
    });
    await this.#persistOrRevert(() => this.#jobs.set(jobId, previous));
    return copy(job);
  }

  statistics() {
    const byStatus = counts(STATUSES);
    const byPriority = counts(PRIORITIES);
    let active = 0,
      paused = 0,
      cancelled = 0,
      ready = 0,
      blocked = 0,
      retries = 0;
    for (const job of this.#jobs.values()) {
      byStatus[job.status]++;
      byPriority[job.priority]++;
      if (job.controlState === "active") active++;
      if (job.controlState === "paused") paused++;
      if (job.controlState === "cancelled") cancelled++;
      if (job.status === "pending" && job.controlState === "active") {
        if (this.#dependenciesComplete(job)) ready++;
        else blocked++;
      }
      retries += job.retryCount;
    }
    return {
      total: this.#jobs.size,
      byStatus,
      byPriority,
      active,
      paused,
      cancelled,
      ready,
      blockedByDependencies: blocked,
      retries,
    };
  }

  async #control(jobId, state) {
    const job = this.#required(jobId);
    if (["completed"].includes(job.status))
      throw new QueueError(
        "job_terminal",
        "Completed jobs cannot change control state.",
      );
    if (job.controlState === "cancelled")
      throw new QueueError(
        "job_cancelled",
        "Cancelled jobs cannot change control state.",
      );
    if (job.controlState === state) return copy(job);
    const previous = copy(job);
    const now = iso(this.#clock);
    job.controlState = state;
    job.updatedAt = now;
    job.pausedAt = state === "paused" ? now : null;
    if (state === "cancelled") job.cancelledAt = now;
    await this.#persistOrRevert(() => this.#jobs.set(jobId, previous));
    return copy(job);
  }

  #dependenciesComplete(job) {
    return job.dependencies.every(
      (id) => this.#jobs.get(id)?.status === "completed",
    );
  }

  #required(jobId) {
    const job = this.#jobs.get(jobId);
    if (!job) throw new QueueError("job_not_found", `Unknown job: ${jobId}`);
    return job;
  }

  #assertInput(input) {
    if (
      !input ||
      typeof input !== "object" ||
      typeof input.id !== "string" ||
      !input.id.trim()
    )
      throw new QueueError("invalid_job", "A non-empty job id is required.");
    if (typeof input.title !== "string" || !input.title.trim())
      throw new QueueError("invalid_job", "A non-empty title is required.");
    if (input.priority && !PRIORITIES.includes(input.priority))
      throw new QueueError(
        "invalid_priority",
        `Unknown priority: ${input.priority}`,
      );
    if (
      input.dependencies &&
      (!Array.isArray(input.dependencies) ||
        input.dependencies.some((id) => typeof id !== "string" || !id))
    )
      throw new QueueError(
        "invalid_dependencies",
        "Dependencies must be job id strings.",
      );
    if (
      input.maxRetries !== undefined &&
      (!Number.isInteger(input.maxRetries) || input.maxRetries < 0)
    )
      throw new QueueError(
        "invalid_retry_count",
        "maxRetries must be a non-negative integer.",
      );
  }

  #assertStoredJob(job) {
    this.#assertInput(job);
    if (!STATUSES.includes(job.status) || !CONTROLS.includes(job.controlState))
      throw new QueueError(
        "invalid_persistence",
        `Invalid state for job ${job.id}.`,
      );
    if (
      !Number.isInteger(job.retryCount) ||
      job.retryCount < 0 ||
      job.retryCount > job.maxRetries
    )
      throw new QueueError(
        "invalid_persistence",
        `Invalid retry count for job ${job.id}.`,
      );
    for (const field of ["createdAt", "updatedAt"])
      if (
        typeof job[field] !== "string" ||
        Number.isNaN(Date.parse(job[field]))
      )
        throw new QueueError(
          "invalid_persistence",
          `Invalid ${field} for job ${job.id}.`,
        );
  }

  #assertDependencies() {
    for (const job of this.#jobs.values())
      for (const dependency of job.dependencies)
        if (!this.#jobs.has(dependency))
          throw new QueueError(
            "missing_dependency",
            `Unknown dependency ${dependency} for ${job.id}.`,
          );
    const visiting = new Set(),
      visited = new Set();
    const visit = (id) => {
      if (visiting.has(id))
        throw new QueueError(
          "dependency_cycle",
          `Dependency cycle includes ${id}.`,
        );
      if (visited.has(id)) return;
      visiting.add(id);
      for (const dependency of this.#jobs.get(id).dependencies)
        visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of this.#jobs.keys()) visit(id);
  }

  async #persistOrRevert(revert) {
    try {
      await fs.mkdir(path.dirname(this.#file), { recursive: true });
      const temporary = `${this.#file}.${process.pid}.tmp`;
      await fs.writeFile(
        temporary,
        `${JSON.stringify({ version: 1, jobs: [...this.#jobs.values()] }, null, 2)}\n`,
        "utf8",
      );
      await fs.rename(temporary, this.#file);
    } catch (error) {
      revert();
      throw new QueueError(
        "persistence_failed",
        `Cannot persist queue: ${error.message}`,
      );
    }
  }
}
