import type { DraftGenerationResult } from "../draft-generator/index";

export type ValidationSeverity =
  "critical" | "error" | "warning" | "information";
export interface BatchValidationFinding {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly draftId: string | null;
  readonly field: string | null;
  readonly path: string | null;
}
export interface BatchValidationReport {
  readonly version: 1;
  readonly batchId: string;
  readonly sourcePack: string;
  readonly plannerJobId: string;
  readonly generatedAt: string;
  readonly counts: {
    readonly drafts: number;
    readonly critical: number;
    readonly errors: number;
    readonly warnings: number;
    readonly information: number;
  };
  readonly findings: readonly BatchValidationFinding[];
  readonly validForPublishing: boolean;
}
export interface BatchValidator {
  validate(
    result: DraftGenerationResult,
    batchId?: string,
  ): Promise<BatchValidationReport>;
  validateJob(
    jobId: string,
    result: DraftGenerationResult,
    batchId?: string,
  ): Promise<BatchValidationReport>;
  assertPublishable(report: BatchValidationReport): void;
  exportReport(report: BatchValidationReport, file: string): Promise<string>;
}
export { JsonBatchValidator, BatchValidationError } from "./batch-validator.js";
