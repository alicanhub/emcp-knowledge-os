export type QueueJobStatus =
  | "pending"
  | "planned"
  | "drafting"
  | "research"
  | "review"
  | "validation"
  | "import"
  | "completed"
  | "failed";

export type QueuePriority = "low" | "normal" | "high" | "critical";
export type QueueControlState = "active" | "paused" | "cancelled";

export interface QueueJobInput<TPayload = unknown> {
  readonly id: string;
  readonly title: string;
  readonly priority?: QueuePriority;
  readonly dependencies?: readonly string[];
  readonly maxRetries?: number;
  readonly payload?: TPayload;
}

export interface QueueJob<TPayload = unknown> {
  readonly id: string;
  readonly title: string;
  readonly priority: QueuePriority;
  readonly dependencies: readonly string[];
  readonly status: QueueJobStatus;
  readonly controlState: QueueControlState;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly payload?: TPayload;
  readonly error: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly failedAt: string | null;
  readonly pausedAt: string | null;
  readonly cancelledAt: string | null;
}

export interface QueueQuery {
  readonly statuses?: readonly QueueJobStatus[];
  readonly priorities?: readonly QueuePriority[];
  readonly controlStates?: readonly QueueControlState[];
  readonly dependency?: string;
}

export interface QueueStatistics {
  readonly total: number;
  readonly byStatus: Readonly<Record<QueueJobStatus, number>>;
  readonly byPriority: Readonly<Record<QueuePriority, number>>;
  readonly active: number;
  readonly paused: number;
  readonly cancelled: number;
  readonly ready: number;
  readonly blockedByDependencies: number;
  readonly retries: number;
}

export interface JobQueue<TPayload = unknown> {
  load(): Promise<void>;
  get(jobId: string): QueueJob<TPayload> | null;
  list(query?: QueueQuery): readonly QueueJob<TPayload>[];
  create(input: QueueJobInput<TPayload>): Promise<QueueJob<TPayload>>;
  transition(
    jobId: string,
    to: QueueJobStatus,
    error?: string,
  ): Promise<QueueJob<TPayload>>;
  next(): QueueJob<TPayload> | null;
  pause(jobId: string): Promise<QueueJob<TPayload>>;
  resume(jobId: string): Promise<QueueJob<TPayload>>;
  cancel(jobId: string): Promise<QueueJob<TPayload>>;
  retry(jobId: string): Promise<QueueJob<TPayload>>;
  statistics(): QueueStatistics;
}

export { JsonJobQueue, QueueError } from "./json-job-queue.js";
