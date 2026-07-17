import type { BatchValidationReport } from "../batch-validation/index";
import type { BackupManifest } from "../backup-rollback/index";
import type { DraftGenerationResult } from "../draft-generator/index";
import type { KnowledgeQualityScore } from "../knowledge-quality/index";
import type { ProductionPlan } from "../topic-planner/index";

export interface ProductionDashboardSnapshot {
  readonly version: 1;
  readonly generatedAt: string;
  readonly jobQueue: Readonly<Record<string, unknown>>;
  readonly topicPlanner: Readonly<Record<string, unknown>>;
  readonly draftGenerator: Readonly<Record<string, unknown>>;
  readonly researchQueue: Readonly<Record<string, unknown>>;
  readonly humanReview: Readonly<Record<string, unknown>>;
  readonly batchValidation: Readonly<Record<string, unknown>>;
  readonly safeImport: Readonly<Record<string, unknown>>;
  readonly backupRollback: Readonly<Record<string, unknown>>;
  readonly overall: Readonly<Record<string, unknown>>;
  readonly knowledgeQuality: Readonly<Record<string, unknown>>;
}
export interface ProductionDashboardService {
  snapshot(): Promise<ProductionDashboardSnapshot>;
  exportJson(file: string): Promise<string>;
  setTopicPlans(plans: readonly ProductionPlan[]): void;
  setDraftResults(results: readonly DraftGenerationResult[]): void;
  setBatchReports(reports: readonly BatchValidationReport[]): void;
  setQualityReports(reports: readonly KnowledgeQualityScore[]): void;
}
export interface BackupHistoryReader {
  list(): Promise<readonly BackupManifest[]>;
  history(): Promise<readonly Record<string, unknown>[]>;
}
export {
  JsonProductionDashboard,
  ProductionDashboardError,
} from "./production-dashboard.js";
