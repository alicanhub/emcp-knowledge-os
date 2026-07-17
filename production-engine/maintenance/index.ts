import type { JobQueue, QueueJob } from "../job-queue/index";

export type MaintenanceSeverity =
  "critical" | "error" | "warning" | "information";

export type MaintenanceFindingKind =
  | "runtime-integrity"
  | "orphaned-entry"
  | "broken-relationship"
  | "review-due"
  | "search-index"
  | "relationship-index"
  | "backup-health"
  | "dashboard-health";

export interface MaintenanceFinding {
  readonly severity: MaintenanceSeverity;
  readonly kind: MaintenanceFindingKind;
  readonly code: string;
  readonly recordId: string | null;
  readonly path: string | null;
  readonly message: string;
  readonly requiresHumanReview: boolean;
}

export interface MaintenanceRecommendation {
  readonly recordId: string;
  readonly title: string;
  readonly lastReviewedDate: string | null;
  readonly reason: "review-overdue" | "review-date-missing";
}

export interface MonthlyMaintenanceReport {
  readonly version: 1;
  readonly reportId: string;
  readonly period: string;
  readonly generatedAt: string;
  readonly runtime: Readonly<Record<string, unknown>>;
  readonly indexes: Readonly<Record<string, unknown>>;
  readonly backups: Readonly<Record<string, unknown>>;
  readonly dashboard: Readonly<Record<string, unknown>>;
  readonly findings: readonly MaintenanceFinding[];
  readonly recommendations: readonly MaintenanceRecommendation[];
  readonly counts: Readonly<Record<MaintenanceSeverity, number>>;
  readonly healthy: boolean;
}

export interface MaintenanceScheduleItem {
  readonly jobId: string;
  readonly period: string;
  readonly scheduledFor: string;
  readonly job: QueueJob;
}

export interface MonthlyMaintenanceEngine {
  schedule(request?: {
    start?: string;
    months?: number;
    priority?: "low" | "normal" | "high" | "critical";
  }): Promise<readonly MaintenanceScheduleItem[]>;
  run(request?: {
    period?: string;
    jobId?: string;
    reportFile?: string;
  }): Promise<MonthlyMaintenanceReport>;
  exportJson(report: MonthlyMaintenanceReport, file: string): Promise<string>;
}

export interface MaintenanceJobPayload {
  readonly type: "monthly-maintenance";
  readonly period: string;
  readonly scheduledFor: string;
}

export type MaintenanceJobQueue = JobQueue<MaintenanceJobPayload>;

export {
  JsonMonthlyMaintenanceEngine,
  MaintenanceEngineError,
} from "./monthly-maintenance-engine.js";
