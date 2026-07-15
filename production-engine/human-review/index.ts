export type ReviewCaseStatus =
  | "awaiting-review"
  | "in-review"
  | "revision-requested"
  | "approved"
  | "rejected";
export type ReviewDecision = "approve" | "reject" | "request-revision";
export type CommentSeverity = "suggestion" | "required" | "blocking";

export interface ReviewCommentInput {
  readonly field: string;
  readonly message: string;
  readonly severity: CommentSeverity;
}
export interface ReviewComment extends ReviewCommentInput {
  readonly id: string;
  readonly author: string;
  readonly createdAt: string;
  readonly resolved: boolean;
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
  readonly resolution: string | null;
}
export interface ReviewRound {
  readonly number: number;
  readonly reviewer: string;
  readonly status: "open" | "revision-requested" | "approved" | "rejected";
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly comments: readonly ReviewComment[];
  readonly decisionNote: string | null;
}
export interface AuditEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly details: Readonly<Record<string, unknown>>;
}
export interface ReviewCase {
  readonly id: string;
  readonly draftId: string;
  readonly recordId: string;
  readonly draftPath: string;
  readonly plannerJobId: string;
  readonly assignedReviewers: readonly string[];
  readonly status: ReviewCaseStatus;
  readonly rounds: readonly ReviewRound[];
  readonly auditTrail: readonly AuditEvent[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly rejectedBy: string | null;
  readonly rejectedAt: string | null;
  readonly quality?: Readonly<Record<string, unknown>> | null;
}
export interface HumanReviewWorkflow {
  load(): Promise<void>;
  get(draftId: string): ReviewCase | null;
  list(): readonly ReviewCase[];
  create(
    draft: {
      draft_id: string;
      id: string;
      path: string;
      planner_job_id: string;
    },
    reviewers: readonly string[],
    actor: string,
  ): Promise<ReviewCase>;
  beginRound(draftId: string, reviewer: string): Promise<ReviewCase>;
  addComment(
    draftId: string,
    round: number,
    comment: ReviewCommentInput,
    reviewer: string,
  ): Promise<ReviewCase>;
  resolveComment(
    draftId: string,
    round: number,
    commentId: string,
    actor: string,
    resolution: string,
  ): Promise<ReviewCase>;
  decide(
    draftId: string,
    round: number,
    decision: ReviewDecision,
    reviewer: string,
    note: string,
  ): Promise<ReviewCase>;
  canPublish(draftId: string): boolean;
  assertPublishable(draftId: string): void;
  exportReport(file: string): Promise<string>;
}
export {
  JsonHumanReviewWorkflow,
  HumanReviewError,
} from "./human-review-workflow.js";
