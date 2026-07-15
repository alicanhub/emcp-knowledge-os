/** Shared, implementation-independent contracts for Content Production Engine v1. */
export type ISODate = `${number}-${number}-${number}`;
export type ISODateTime = string;
export type ContentPackId = `pack.${string}`;
export type ContentJobId = `job.${string}`;
export type KnowledgeEntryId = string;
export type CalculatorId = string;
export type HandbookChapterId = string;

export interface LocalizedText {
  readonly en: string;
  readonly tr: string;
}

export type Difficulty = "beginner" | "intermediate" | "advanced" | "expert";
export type Jurisdiction = string;
export type JobStatus =
  | "planned"
  | "researching"
  | "drafting"
  | "validating"
  | "awaiting-review"
  | "approved"
  | "imported"
  | "published"
  | "rejected"
  | "blocked";

export interface ContentProductionJob {
  readonly jobId: ContentJobId;
  readonly title: LocalizedText;
  readonly targetPack: ContentPackId;
  readonly subjectArea: LocalizedText;
  readonly targetAudience: LocalizedText;
  readonly jurisdictions: readonly Jurisdiction[];
  readonly difficultyRange: readonly Difficulty[];
  readonly targetReviewedEntryCount: number;
  readonly targetDraftEntryCount: number;
  readonly priority: "low" | "normal" | "high" | "critical";
  readonly dependencies: readonly ContentJobId[];
  readonly requiredSourceDomains: readonly string[];
  readonly requiredCalculators: readonly CalculatorId[];
  readonly requiredHandbookChapters: readonly HandbookChapterId[];
  readonly requiredChecklists: readonly string[];
  readonly requiredCaseStudies: readonly string[];
  readonly requiredDocumentGuides: readonly string[];
  readonly status: JobStatus;
  readonly createdDate: ISODate;
  readonly startedDate: ISODate | null;
  readonly completedDate: ISODate | null;
  readonly reviewer: string | null;
  readonly notes: LocalizedText;
}

export interface ArtifactReference {
  readonly kind: string;
  readonly id: string;
  readonly path: string;
  readonly sha256?: string;
}

export interface ValidationFinding {
  readonly severity: "error" | "warning" | "information";
  readonly code: string;
  readonly message: string;
  readonly artifact?: ArtifactReference;
  readonly field?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly findings: readonly ValidationFinding[];
}

export interface CommandContext {
  readonly workspaceRoot: string;
  readonly requestedAt: ISODateTime;
  readonly actor: string;
}

export interface Clock {
  now(): Date;
}

export interface JsonReader {
  read<T>(path: string): Promise<T>;
}

export interface JsonWriter {
  writeAtomically<T>(path: string, value: T): Promise<void>;
}

export interface FileCatalog {
  list(pattern: string): Promise<readonly string[]>;
  exists(path: string): Promise<boolean>;
  hash(path: string): Promise<string>;
}
