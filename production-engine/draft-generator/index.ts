import type { ProductionPlan } from "../topic-planner/index";

export interface DraftMetadata {
  readonly draft_id: string;
  readonly source_pack: string;
  readonly planner_job_id: string;
  readonly version: string;
  readonly generated_at: string;
  readonly updated_at: string;
}

export interface GeneratedDraftReference extends DraftMetadata {
  readonly id: string;
  readonly path: string;
  readonly reviewStatus: "draft";
  readonly regeneration: number;
}

export interface SkippedDraft {
  readonly id: string;
  readonly reason: "existing-runtime-entry" | "approved-content-exists";
}

export interface DraftGenerationRequest {
  readonly plannerJobId: string;
  readonly plan: ProductionPlan;
}

export interface DraftGenerationResult {
  readonly plannerJobId: string;
  readonly sourcePack: string;
  readonly generatedAt: string;
  readonly drafts: readonly GeneratedDraftReference[];
  readonly skipped: readonly SkippedDraft[];
  readonly reviewedRecordsCreated: 0;
}

export interface DraftGenerator {
  generate(request: DraftGenerationRequest): Promise<DraftGenerationResult>;
  generateFromQueue(jobId: string): Promise<DraftGenerationResult>;
}

export { JsonDraftGenerator, DraftGeneratorError } from "./draft-generator.js";
