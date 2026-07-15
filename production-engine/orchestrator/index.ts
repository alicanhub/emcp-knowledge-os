import type { BatchValidationReport } from "../batch-validation/index";
import type { DraftGenerationResult } from "../draft-generator/index";
import type { MonthlyMaintenanceReport } from "../maintenance/index";
import type { ProductionPlan } from "../topic-planner/index";

export type ProductionStage =
  | "load-content-pack"
  | "topic-planner"
  | "job-queue"
  | "draft-generator"
  | "research-queue"
  | "human-review"
  | "batch-validation"
  | "safe-import"
  | "backup-rollback"
  | "dashboard-refresh"
  | "monthly-maintenance"
  | "final-report";

export type OrchestratorEventType =
  | "cycle-started"
  | "cycle-resumed"
  | "stage-started"
  | "stage-completed"
  | "stage-skipped"
  | "stage-paused"
  | "stage-failed"
  | "rollback-started"
  | "rollback-completed"
  | "rollback-failed"
  | "cycle-completed";

export interface OrchestratorEvent {
  readonly sequence: number;
  readonly timestamp: string;
  readonly cycleId: string;
  readonly stage: ProductionStage | null;
  readonly type: OrchestratorEventType;
  readonly progressPercentage: number;
  readonly message: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ProductionCycleRequest {
  readonly cycleId: string;
  readonly contentPackFile?: string;
  readonly pack?: Readonly<Record<string, unknown>>;
  readonly topics?: readonly Readonly<Record<string, unknown>>[];
  readonly reviewers?: readonly string[];
  readonly approvedBy?: string;
  readonly deterministicDrafts?: boolean;
  readonly dryRun?: boolean;
  readonly fromStage?: ProductionStage;
  readonly toStage?: ProductionStage;
  readonly stateFile: string;
  readonly reportFile: string;
  readonly onEvent?: (event: OrchestratorEvent) => void;
}

export interface ProductionCycleReport {
  readonly version: 1;
  readonly cycleId: string;
  readonly status: "completed" | "partial" | "awaiting-input" | "failed";
  readonly dryRun: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly progressPercentage: number;
  readonly completedStages: readonly ProductionStage[];
  readonly pendingStages: readonly ProductionStage[];
  readonly currentStage: ProductionStage | null;
  readonly events: readonly OrchestratorEvent[];
  readonly outputs: {
    readonly plan?: ProductionPlan;
    readonly drafts?: DraftGenerationResult;
    readonly validation?: BatchValidationReport;
    readonly maintenance?: MonthlyMaintenanceReport;
    readonly [key: string]: unknown;
  };
  readonly rollback: Readonly<Record<string, unknown>>;
  readonly error: Readonly<Record<string, unknown>> | null;
}

export interface ProductionOrchestrator {
  run(request: ProductionCycleRequest): Promise<ProductionCycleReport>;
}

export {
  JsonProductionOrchestrator,
  ProductionOrchestratorError,
  PRODUCTION_STAGES,
} from "./production-orchestrator.js";
