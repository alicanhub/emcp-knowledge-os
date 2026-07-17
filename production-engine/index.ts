import type { CommandContext, ContentJobId, ContentPackId } from "./contracts";

export interface ProductionEngineCommand {
  readonly name: string;
  readonly jobId?: ContentJobId;
  readonly packId?: ContentPackId;
  readonly dryRun: boolean;
}

export interface ProductionEngineResult {
  readonly command: string;
  readonly succeeded: boolean;
  readonly artifactPaths: readonly string[];
}

export interface ProductionEngine {
  execute(
    command: ProductionEngineCommand,
    context: CommandContext,
  ): Promise<ProductionEngineResult>;
}

export type * from "./contracts";
export type * from "./knowledge-quality/index";
export {
  WeightedKnowledgeQualityScorer,
  KnowledgeQualityError,
  DEFAULT_QUALITY_WEIGHTS,
} from "./knowledge-quality/weighted-quality-scorer.js";
export type * from "./ai-draft-writer/index";
export {
  EvidenceGatedAIDraftWriter,
  AIDraftWriterError,
} from "./ai-draft-writer/evidence-gated-draft-writer.js";
export type * from "./ai-research-connector/index";
export {
  ProviderNeutralResearchConnector,
  DefaultSourceValidator,
  AIResearchConnectorError,
} from "./ai-research-connector/provider-neutral-connector.js";
export type * from "./orchestrator/index";
export {
  JsonProductionOrchestrator,
  ProductionOrchestratorError,
  PRODUCTION_STAGES,
} from "./orchestrator/production-orchestrator.js";
