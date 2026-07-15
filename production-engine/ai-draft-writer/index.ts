import type { DraftGenerationResult } from "../draft-generator/index";
import type { KnowledgeQualityScore } from "../knowledge-quality/index";
import type { ProductionPlan } from "../topic-planner/index";

export interface EvidenceBoundSection {
  readonly value: unknown;
  readonly evidenceIds: readonly string[];
}

export interface DraftWritingProviderRequest {
  readonly topic: Readonly<Record<string, unknown>>;
  readonly plan: ProductionPlan;
  readonly currentDraft: Readonly<Record<string, unknown>>;
  readonly verifiedEvidence: readonly Readonly<Record<string, unknown>>[];
  readonly languages: readonly ["en", "tr"];
}

export interface DraftWritingProviderResponse {
  readonly sections: Readonly<Record<string, EvidenceBoundSection>>;
  readonly warnings: readonly string[];
}

/** Future AI adapters implement this interface; no provider SDK is required. */
export interface DraftWritingProviderAdapter {
  readonly id: string;
  readonly name: string;
  write(
    request: DraftWritingProviderRequest,
  ): Promise<DraftWritingProviderResponse>;
}

export interface DraftQualityMetrics {
  readonly draftId: string;
  readonly factualSections: number;
  readonly evidenceSupportedSections: number;
  readonly unsupportedSections: readonly string[];
  readonly verifiedEvidenceItems: number;
  readonly sourceCount: number;
  readonly bilingualCompletenessPercentage: number;
  readonly evidenceCoveragePercentage: number;
  readonly deterministic: boolean;
  readonly knowledgeQuality: KnowledgeQualityScore;
}

export interface AIDraftWritingRequest {
  readonly plannerJobId: string;
  readonly plan: ProductionPlan;
  readonly draftResult: DraftGenerationResult;
  readonly deterministic?: boolean;
}

export interface AIDraftWritingResult {
  readonly version: 1;
  readonly writerVersion: "1.0.0";
  readonly generatedAt: string;
  readonly deterministic: boolean;
  readonly providerId: string | null;
  readonly draftResult: DraftGenerationResult;
  readonly quality: readonly DraftQualityMetrics[];
}

export interface AIDraftWriter {
  write(request: AIDraftWritingRequest): Promise<AIDraftWritingResult>;
  generateFromQueue(
    jobId: string,
    options?: { deterministic?: boolean },
  ): Promise<AIDraftWritingResult>;
}

export {
  EvidenceGatedAIDraftWriter,
  AIDraftWriterError,
} from "./evidence-gated-draft-writer.js";
