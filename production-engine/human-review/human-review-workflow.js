import * as fs from "node:fs/promises";
import * as path from "node:path";
import { RESEARCH_CATEGORIES } from "../research-queue/research-queue.js";

export class HumanReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HumanReviewError";
    this.code = code;
  }
}
const clone = (value) => structuredClone(value);
const iso = (clock) => clock().toISOString();

export class JsonHumanReviewWorkflow {
  #file;
  #researchQueue;
  #jobQueue;
  #clock;
  #qualityScorer;
  #cases = new Map();
  /** @param {any} options */
  constructor(file, options = {}) {
    if (!file)
      throw new HumanReviewError(
        "invalid_file",
        "A review workflow JSON path is required.",
      );
    if (!options.researchQueue)
      throw new HumanReviewError(
        "research_unavailable",
        "A Research Queue is required.",
      );
    this.#file = file;
    this.#researchQueue = options.researchQueue;
    this.#jobQueue = options.jobQueue || null;
    this.#clock = options.clock || (() => new Date());
    this.#qualityScorer = options.qualityScorer || null;
  }
  async load() {
    let document;
    try {
      document = JSON.parse(await fs.readFile(this.#file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw new HumanReviewError(
        "invalid_persistence",
        `Cannot load reviews: ${error.message}`,
      );
    }
    if (document?.version !== 1 || !Array.isArray(document.cases))
      throw new HumanReviewError(
        "invalid_persistence",
        "Review JSON must use version 1 and contain cases.",
      );
    const cases = new Map();
    for (const reviewCase of document.cases) {
      this.#assertCase(reviewCase);
      if (cases.has(reviewCase.draftId))
        throw new HumanReviewError(
          "duplicate_case",
          `Duplicate review case: ${reviewCase.draftId}`,
        );
      cases.set(reviewCase.draftId, clone(reviewCase));
    }
    this.#cases = cases;
  }
  get(draftId) {
    const value = this.#cases.get(draftId);
    return value ? clone(value) : null;
  }
  list() {
    return [...this.#cases.values()]
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      )
      .map(clone);
  }
  async create(draft, reviewers, actor) {
    if (!draft?.draft_id || !draft.id || !draft.path || !draft.planner_job_id)
      throw new HumanReviewError(
        "invalid_draft",
        "A generated draft reference is required.",
      );
    this.#assertPeople(reviewers, "reviewers");
    this.#assertPerson(actor, "actor");
    if (this.#cases.has(draft.draft_id))
      throw new HumanReviewError(
        "duplicate_case",
        `Review case already exists: ${draft.draft_id}`,
      );
    this.#assertResearchComplete(draft.draft_id);
    const now = iso(this.#clock),
      reviewCase = {
        id: `review.${draft.draft_id}`,
        draftId: draft.draft_id,
        recordId: draft.id,
        draftPath: draft.path,
        plannerJobId: draft.planner_job_id,
        assignedReviewers: [...new Set(reviewers)],
        status: "awaiting-review",
        rounds: [],
        auditTrail: [],
        createdAt: now,
        updatedAt: now,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        quality: await this.#scoreDraft(draft),
      };
    this.#audit(reviewCase, actor, "case-created", {
      reviewers: reviewCase.assignedReviewers,
    });
    this.#cases.set(reviewCase.draftId, reviewCase);
    await this.#persistOrRevert(() => this.#cases.delete(reviewCase.draftId));
    return clone(reviewCase);
  }
  async beginRound(draftId, reviewer) {
    const reviewCase = this.#required(draftId);
    this.#assertAssigned(reviewCase, reviewer);
    if (!["awaiting-review", "revision-requested"].includes(reviewCase.status))
      throw new HumanReviewError(
        "invalid_case_state",
        `Cannot begin a round while ${reviewCase.status}.`,
      );
    this.#assertResearchComplete(draftId);
    const previous = clone(reviewCase),
      now = iso(this.#clock);
    reviewCase.rounds.push({
      number: reviewCase.rounds.length + 1,
      reviewer,
      status: "open",
      openedAt: now,
      closedAt: null,
      comments: [],
      decisionNote: null,
    });
    reviewCase.status = "in-review";
    reviewCase.updatedAt = now;
    this.#audit(reviewCase, reviewer, "round-opened", {
      round: reviewCase.rounds.length,
    });
    await this.#persistOrRevert(() => this.#cases.set(draftId, previous));
    await this.#transitionJob(reviewCase, "review");
    return clone(reviewCase);
  }
  async addComment(draftId, roundNumber, comment, reviewer) {
    const reviewCase = this.#required(draftId),
      round = this.#openRound(reviewCase, roundNumber);
    this.#assertAssigned(reviewCase, reviewer);
    if (round.reviewer !== reviewer)
      throw new HumanReviewError(
        "reviewer_mismatch",
        "Only the round reviewer can comment.",
      );
    if (
      !comment?.field?.trim() ||
      !comment?.message?.trim() ||
      !["suggestion", "required", "blocking"].includes(comment.severity)
    )
      throw new HumanReviewError(
        "invalid_comment",
        "Field, message and valid severity are required.",
      );
    const previous = clone(reviewCase),
      now = iso(this.#clock),
      item = {
        ...clone(comment),
        field: comment.field.trim(),
        message: comment.message.trim(),
        id: `${reviewCase.id}.round-${roundNumber}.comment-${String(round.comments.length + 1).padStart(3, "0")}`,
        author: reviewer,
        createdAt: now,
        resolved: false,
        resolvedBy: null,
        resolvedAt: null,
        resolution: null,
      };
    round.comments.push(item);
    reviewCase.updatedAt = now;
    this.#audit(reviewCase, reviewer, "comment-added", {
      round: roundNumber,
      commentId: item.id,
      field: item.field,
      severity: item.severity,
    });
    await this.#persistOrRevert(() => this.#cases.set(draftId, previous));
    return clone(reviewCase);
  }
  async resolveComment(draftId, roundNumber, commentId, actor, resolution) {
    const reviewCase = this.#required(draftId),
      round = this.#round(reviewCase, roundNumber);
    this.#assertPerson(actor, "actor");
    const comment = round.comments.find((item) => item.id === commentId);
    if (!comment)
      throw new HumanReviewError(
        "comment_not_found",
        `Unknown comment: ${commentId}`,
      );
    if (comment.resolved)
      throw new HumanReviewError(
        "comment_resolved",
        "Comment is already resolved.",
      );
    if (!String(resolution).trim())
      throw new HumanReviewError(
        "invalid_resolution",
        "A resolution note is required.",
      );
    const previous = clone(reviewCase),
      now = iso(this.#clock);
    Object.assign(comment, {
      resolved: true,
      resolvedBy: actor,
      resolvedAt: now,
      resolution: String(resolution).trim(),
    });
    reviewCase.updatedAt = now;
    this.#audit(reviewCase, actor, "comment-resolved", {
      round: roundNumber,
      commentId,
    });
    await this.#persistOrRevert(() => this.#cases.set(draftId, previous));
    return clone(reviewCase);
  }
  async decide(draftId, roundNumber, decision, reviewer, note) {
    const reviewCase = this.#required(draftId),
      round = this.#openRound(reviewCase, roundNumber);
    this.#assertAssigned(reviewCase, reviewer);
    if (round.reviewer !== reviewer)
      throw new HumanReviewError(
        "reviewer_mismatch",
        "Only the round reviewer can decide.",
      );
    if (!String(note).trim())
      throw new HumanReviewError(
        "invalid_decision",
        "A decision note is required.",
      );
    if (
      !RESEARCH_CATEGORIES.every(
        (category) =>
          this.#researchQueue.list({ draftId, category, status: "verified" })
            .length > 0,
      )
    )
      throw new HumanReviewError(
        "research_incomplete",
        "All research categories must remain verified.",
      );
    const unresolved = reviewCase.rounds
      .flatMap((item) => item.comments)
      .filter(
        (comment) =>
          !comment.resolved &&
          ["required", "blocking"].includes(comment.severity),
      );
    if (decision === "approve" && unresolved.length)
      throw new HumanReviewError(
        "unresolved_comments",
        "Required and blocking comments must be resolved before approval.",
      );
    if (!["approve", "reject", "request-revision"].includes(decision))
      throw new HumanReviewError(
        "invalid_decision",
        `Unknown decision: ${decision}`,
      );
    const previous = clone(reviewCase),
      now = iso(this.#clock);
    round.status =
      decision === "request-revision"
        ? "revision-requested"
        : decision === "approve"
          ? "approved"
          : "rejected";
    round.closedAt = now;
    round.decisionNote = String(note).trim();
    reviewCase.updatedAt = now;
    if (decision === "approve") {
      reviewCase.quality = await this.#scoreDraft({
        path: reviewCase.draftPath,
        draft_id: reviewCase.draftId,
      });
      reviewCase.status = "approved";
      reviewCase.approvedBy = reviewer;
      reviewCase.approvedAt = now;
    }
    if (decision === "reject") {
      reviewCase.status = "rejected";
      reviewCase.rejectedBy = reviewer;
      reviewCase.rejectedAt = now;
    }
    if (decision === "request-revision")
      reviewCase.status = "revision-requested";
    this.#audit(reviewCase, reviewer, `decision-${decision}`, {
      round: roundNumber,
      note: round.decisionNote,
    });
    await this.#persistOrRevert(() => this.#cases.set(draftId, previous));
    await this.#transitionJob(
      reviewCase,
      decision === "approve"
        ? "validation"
        : decision === "request-revision"
          ? "drafting"
          : "failed",
      note,
    );
    return clone(reviewCase);
  }
  canPublish(draftId) {
    const reviewCase = this.#cases.get(draftId);
    return Boolean(
      reviewCase?.status === "approved" &&
      reviewCase.approvedBy &&
      reviewCase.approvedAt,
    );
  }
  assertPublishable(draftId) {
    if (!this.canPublish(draftId))
      throw new HumanReviewError(
        "not_approved",
        `Draft is not approved for publishing: ${draftId}`,
      );
  }
  async exportReport(file) {
    if (!file)
      throw new HumanReviewError(
        "invalid_report",
        "A JSON report path is required.",
      );
    const cases = this.list(),
      report = {
        version: 1,
        generatedAt: iso(this.#clock),
        statistics: {
          total: cases.length,
          awaitingReview: cases.filter(
            (item) => item.status === "awaiting-review",
          ).length,
          inReview: cases.filter((item) => item.status === "in-review").length,
          revisionRequested: cases.filter(
            (item) => item.status === "revision-requested",
          ).length,
          approved: cases.filter((item) => item.status === "approved").length,
          rejected: cases.filter((item) => item.status === "rejected").length,
          rounds: cases.reduce((sum, item) => sum + item.rounds.length, 0),
          comments: cases.reduce(
            (sum, item) =>
              sum +
              item.rounds.reduce(
                (count, round) => count + round.comments.length,
                0,
              ),
            0,
          ),
          averageQualityScore: this.#averageQuality(cases),
        },
        cases,
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
  #assertResearchComplete(draftId) {
    const tasks = this.#researchQueue.list({ draftId });
    if (
      tasks.length !== RESEARCH_CATEGORIES.length ||
      !RESEARCH_CATEGORIES.every((category) =>
        tasks.some(
          (task) => task.category === category && task.status === "verified",
        ),
      )
    )
      throw new HumanReviewError(
        "research_incomplete",
        "All nine research categories must be verified before review.",
      );
  }
  async #scoreDraft(draft) {
    if (!this.#qualityScorer) return null;
    const entry = JSON.parse(await fs.readFile(draft.path, "utf8"));
    const tasks = this.#researchQueue.list({ draftId: draft.draft_id });
    return this.#qualityScorer.score(entry, {
      evidenceCoveragePercentage:
        (tasks.filter((task) => task.status === "verified").length /
          RESEARCH_CATEGORIES.length) *
        100,
    });
  }
  #averageQuality(cases) {
    const scores = cases
      .map((item) => item.quality?.totalScore)
      .filter(Number.isFinite);
    return scores.length
      ? Number(
          (
            scores.reduce((sum, value) => sum + value, 0) / scores.length
          ).toFixed(1),
        )
      : null;
  }
  async #transitionJob(reviewCase, to, error = "Review rejected") {
    if (!this.#jobQueue) return;
    const job = this.#jobQueue.get(reviewCase.plannerJobId);
    if (!job)
      throw new HumanReviewError(
        "job_not_found",
        `Planner job not found: ${reviewCase.plannerJobId}`,
      );
    if (job.status === to) return;
    await this.#jobQueue.transition(job.id, to, error);
  }
  #audit(reviewCase, actor, action, details) {
    reviewCase.auditTrail.push({
      id: `${reviewCase.id}.audit.${String(reviewCase.auditTrail.length + 1).padStart(3, "0")}`,
      timestamp: iso(this.#clock),
      actor,
      action,
      details: clone(details),
    });
  }
  #required(draftId) {
    const reviewCase = this.#cases.get(draftId);
    if (!reviewCase)
      throw new HumanReviewError(
        "case_not_found",
        `Unknown review case: ${draftId}`,
      );
    return reviewCase;
  }
  #round(reviewCase, number) {
    const round = reviewCase.rounds.find((item) => item.number === number);
    if (!round)
      throw new HumanReviewError(
        "round_not_found",
        `Unknown review round: ${number}`,
      );
    return round;
  }
  #openRound(reviewCase, number) {
    const round = this.#round(reviewCase, number);
    if (round.status !== "open")
      throw new HumanReviewError("round_closed", "The review round is closed.");
    return round;
  }
  #assertPerson(value, field) {
    if (typeof value !== "string" || !value.trim())
      throw new HumanReviewError(
        "invalid_reviewer",
        `${field} must be a non-empty name.`,
      );
  }
  #assertPeople(values, field) {
    if (!Array.isArray(values) || values.length === 0)
      throw new HumanReviewError(
        "invalid_reviewer",
        `${field} must contain at least one reviewer.`,
      );
    values.forEach((value) => this.#assertPerson(value, field));
  }
  #assertAssigned(reviewCase, reviewer) {
    this.#assertPerson(reviewer, "reviewer");
    if (!reviewCase.assignedReviewers.includes(reviewer))
      throw new HumanReviewError(
        "reviewer_not_assigned",
        `${reviewer} is not assigned to this case.`,
      );
  }
  #assertCase(value) {
    if (
      !value?.id ||
      !value.draftId ||
      !value.recordId ||
      !Array.isArray(value.rounds) ||
      !Array.isArray(value.auditTrail)
    )
      throw new HumanReviewError(
        "invalid_persistence",
        "Persisted review case is invalid.",
      );
  }
  async #persistOrRevert(revert) {
    try {
      await fs.mkdir(path.dirname(this.#file), { recursive: true });
      const temporary = `${this.#file}.${process.pid}.tmp`;
      await fs.writeFile(
        temporary,
        `${JSON.stringify({ version: 1, cases: [...this.#cases.values()] }, null, 2)}\n`,
        "utf8",
      );
      await fs.rename(temporary, this.#file);
    } catch (error) {
      revert();
      throw new HumanReviewError(
        "persistence_failed",
        `Cannot persist reviews: ${error.message}`,
      );
    }
  }
}
