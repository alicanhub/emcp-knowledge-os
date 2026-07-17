import type { BatchValidationReport } from "../batch-validation/index";
import type { DraftGenerationResult } from "../draft-generator/index";

export interface SafeImportRequest {
  readonly draftResult: DraftGenerationResult;
  readonly validationReport: BatchValidationReport;
  readonly approvedBy: string;
  readonly importId?: string;
}
export interface ImportManifestFile {
  readonly path: string;
  readonly sha256Before: string | null;
  readonly sha256After: string;
}
export interface SafeImportReport {
  readonly version: 1;
  readonly importId: string;
  readonly batchId: string;
  readonly sourcePack: string;
  readonly plannerJobId: string;
  readonly approvedBy: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly runtimeCountBefore: number;
  readonly runtimeCountAfter: number;
  readonly importedRecordIds: readonly string[];
  readonly files: readonly ImportManifestFile[];
  readonly indexesUpdated: true;
  readonly relationshipIntegrity: true;
  readonly rolledBack: false;
  readonly backupVersionId?: string;
}
export interface SafeImportEngine {
  import(request: SafeImportRequest): Promise<SafeImportReport>;
  listManifests(): Promise<readonly SafeImportReport[]>;
}
export { JsonSafeImportEngine, SafeImportError } from "./safe-import-engine.js";
