import type { ResearchCategory, ResearchTask } from "../research-queue/index";

export type ResearchSourceType =
  | "web-research"
  | "government-publication"
  | "standard"
  | "regulation"
  | "technical-document"
  | "official-guidance";

export interface ResearchProviderCapabilities {
  readonly sourceTypes: readonly ResearchSourceType[];
  readonly jurisdictions: readonly string[];
  readonly languages: readonly string[];
}

export interface ResearchProviderContext {
  readonly requestId: string;
  readonly requestedAt: string;
  readonly maxResults: number;
}

export interface ProviderResearchRequest {
  readonly query: string;
  readonly field: string;
  readonly jurisdiction: string | null;
  readonly languages: readonly string[];
  readonly sourceTypes: readonly ResearchSourceType[];
}

export interface CitationInput {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly accessedAt: string;
  readonly publishedAt?: string | null;
  readonly jurisdiction?: string | null;
  readonly sourceType: ResearchSourceType;
  readonly official: boolean;
  readonly primarySource: boolean;
  readonly documentIdentifier?: string | null;
  readonly section?: string | null;
  readonly note: string;
}

export interface ProviderResearchCandidate {
  readonly field: string;
  readonly summary: string;
  readonly citation: CitationInput;
  readonly confidence: number;
}

export interface ProviderResearchResponse {
  readonly providerRequestId: string;
  readonly candidates: readonly ProviderResearchCandidate[];
  readonly warnings: readonly string[];
}

/** Implemented by future local or remote adapters; the connector has no vendor dependency. */
export interface ResearchProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ResearchProviderCapabilities;
  research(
    request: ProviderResearchRequest,
    context: ResearchProviderContext,
  ): Promise<ProviderResearchResponse>;
}

export type SourceValidationStatus = "valid" | "invalid" | "requires-review";
export interface SourceValidationIssue {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
}
export interface SourceValidationResult {
  readonly status: SourceValidationStatus;
  readonly authoritative: boolean;
  readonly issues: readonly SourceValidationIssue[];
}
export interface SourceValidator {
  validate(source: CitationInput, now: Date): SourceValidationResult;
}

export interface ResearchCitation extends CitationInput {
  readonly id: string;
  readonly providerId: string;
  readonly validation: SourceValidationResult;
  readonly confidenceScore: number;
}

export interface ConnectorResearchRequest {
  readonly requestId: string;
  readonly taskId: string;
  readonly query: string;
  readonly field: string;
  readonly jurisdiction?: string | null;
  readonly languages?: readonly string[];
  readonly sourceTypes: readonly ResearchSourceType[];
  readonly providerIds?: readonly string[];
  readonly maxResults?: number;
}

export interface ProviderExecutionResult {
  readonly providerId: string;
  readonly status: "completed" | "failed" | "skipped";
  readonly candidateCount: number;
  readonly acceptedCount: number;
  readonly error: string | null;
}

export interface ConnectorResearchReport {
  readonly version: 1;
  readonly requestId: string;
  readonly taskId: string;
  readonly researchCategory: ResearchCategory;
  readonly generatedAt: string;
  readonly providers: readonly ProviderExecutionResult[];
  readonly citations: readonly ResearchCitation[];
  readonly rejectedCitations: readonly ResearchCitation[];
  readonly confidenceScore: number;
  readonly queueTask: ResearchTask;
  readonly requiresHumanVerification: true;
}

export interface AIResearchConnector {
  research(request: ConnectorResearchRequest): Promise<ConnectorResearchReport>;
}

export {
  ProviderNeutralResearchConnector,
  DefaultSourceValidator,
  AIResearchConnectorError,
} from "./provider-neutral-connector.js";
