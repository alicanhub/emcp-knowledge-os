import type { QueuePriority } from "../job-queue/index";

export type TopicDifficulty =
  "beginner" | "intermediate" | "advanced" | "expert";

export interface BilingualText {
  readonly en: string;
  readonly tr: string;
}

export interface ContentPackDefinition {
  readonly id: string;
  readonly title: BilingualText;
  readonly prerequisites?: readonly string[];
  readonly difficulty_level?: TopicDifficulty;
  readonly related_knowledge_entries?: readonly string[];
}

export interface TopicCandidate {
  readonly id: string;
  readonly title: BilingualText;
  readonly group?: BilingualText;
  readonly aliases?: {
    readonly en?: readonly string[];
    readonly tr?: readonly string[];
  };
  readonly abbreviation?: string;
  readonly prerequisites?: readonly string[];
  readonly difficulty?: TopicDifficulty;
  readonly estimatedHours?: number;
}

export interface PlannedTopic extends TopicCandidate {
  readonly learningOrder: number;
  readonly existingRuntimeEntry: boolean;
  readonly runtimeEntryId: string | null;
  readonly estimatedDraftHours: number;
}

export interface DuplicateTopic {
  readonly candidateId: string;
  readonly duplicateOf: string;
  readonly matchedBy: string;
}

export interface MonthlyProductionPlan {
  readonly month: string;
  readonly topicIds: readonly string[];
  readonly draftCount: number;
  readonly estimatedHours: number;
}

export interface ProductionPlan {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly packId: string;
  readonly packTitle: BilingualText;
  readonly generatedAt: string;
  readonly prerequisites: readonly string[];
  readonly topics: readonly PlannedTopic[];
  readonly duplicates: readonly DuplicateTopic[];
  readonly statistics: {
    readonly proposedCount: number;
    readonly uniqueTopicCount: number;
    readonly existingRuntimeCount: number;
    readonly estimatedDraftCount: number;
    readonly estimatedWorkloadHours: number;
    readonly monthlyPlanCount: number;
  };
  readonly monthlyPlans: readonly MonthlyProductionPlan[];
}

/** Backward-compatible name retained for dependent engine boundaries. */
export type TopicPlan = ProductionPlan;

export interface PlanRequest {
  readonly pack: ContentPackDefinition;
  readonly topics: readonly TopicCandidate[];
  readonly startMonth?: string;
  readonly monthlyDraftCapacity?: number;
}

export interface QueuePlanRequest {
  readonly jobId?: string;
  readonly priority?: QueuePriority;
  readonly dependencies?: readonly string[];
  readonly maxRetries?: number;
}

export interface TopicPlanner {
  generate(request: PlanRequest): ProductionPlan;
  writeReport(plan: ProductionPlan, file?: string): Promise<string>;
  enqueue(plan: ProductionPlan, request?: QueuePlanRequest): Promise<unknown>;
}

export { JsonTopicPlanner, TopicPlannerError } from "./topic-planner.js";
