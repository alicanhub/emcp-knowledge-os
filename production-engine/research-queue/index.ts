import type { DraftGenerationResult } from "../draft-generator/index";

export type ResearchCategory =
  | "regulations"
  | "standards"
  | "formulas"
  | "calculators"
  | "references"
  | "uk-guidance"
  | "turkey-guidance"
  | "examples"
  | "glossary-links";
export type ResearchStatus =
  "pending" | "researching" | "verified" | "rejected";

export interface EvidenceInput {
  readonly field: string;
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly accessedAt: string;
  readonly publishedAt?: string | null;
  readonly jurisdiction?: string | null;
  readonly official: boolean;
  readonly note: string;
}
export interface EvidenceItem extends EvidenceInput {
  readonly id: string;
  readonly createdAt: string;
}
export interface ResearchTask {
  readonly id: string;
  readonly draftId: string;
  readonly recordId: string;
  readonly draftPath: string;
  readonly sourcePack: string;
  readonly plannerJobId: string;
  readonly category: ResearchCategory;
  readonly status: ResearchStatus;
  readonly confidenceScore: number;
  readonly evidence: readonly EvidenceItem[];
  readonly rejectionReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly verifiedAt: string | null;
  readonly rejectedAt: string | null;
}
export interface ResearchStatistics {
  readonly total: number;
  readonly byStatus: Readonly<Record<ResearchStatus, number>>;
  readonly byCategory: Readonly<Record<ResearchCategory, number>>;
  readonly evidenceItems: number;
  readonly averageConfidence: number;
}
export interface ResearchQueue {
  load(): Promise<void>;
  createForDrafts(
    result: DraftGenerationResult,
  ): Promise<readonly ResearchTask[]>;
  get(taskId: string): ResearchTask | null;
  list(query?: {
    draftId?: string;
    category?: ResearchCategory;
    status?: ResearchStatus;
  }): readonly ResearchTask[];
  transition(
    taskId: string,
    status: ResearchStatus,
    rejectionReason?: string,
  ): Promise<ResearchTask>;
  addEvidence(taskId: string, evidence: EvidenceInput): Promise<ResearchTask>;
  setConfidence(taskId: string, score: number): Promise<ResearchTask>;
  statistics(): ResearchStatistics;
  exportReport(file: string): Promise<string>;
}
export { JsonResearchQueue, ResearchQueueError } from "./research-queue.js";
