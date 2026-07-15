export type QualityCategory =
  | "completeness"
  | "evidenceCoverage"
  | "citationQuality"
  | "bilingualConsistency"
  | "readability"
  | "reviewFreshness"
  | "relationshipQuality"
  | "calculatorIntegration"
  | "mediaReadiness";

export interface QualityCategoryScore {
  readonly score: number;
  readonly weight: number;
  readonly weightedScore: number;
}

export interface QualityRecommendation {
  readonly category: QualityCategory;
  readonly priority: "high" | "medium" | "low";
  readonly message: string;
}

export interface KnowledgeQualityScore {
  readonly version: 1;
  readonly entryId: string;
  readonly generatedAt: string;
  readonly totalScore: number;
  readonly band: "excellent" | "good" | "needs-improvement" | "critical";
  readonly categories: Readonly<Record<QualityCategory, QualityCategoryScore>>;
  readonly recommendations: readonly QualityRecommendation[];
}

export interface KnowledgeQualityContext {
  readonly evidenceCoveragePercentage?: number;
  readonly knownEntryIds?: readonly string[];
  readonly calculatorIds?: readonly string[];
}

export interface KnowledgeQualityReport {
  readonly version: 1;
  readonly generatedAt: string;
  readonly entries: readonly KnowledgeQualityScore[];
  readonly statistics: {
    readonly count: number;
    readonly averageScore: number;
    readonly minimumScore: number;
    readonly maximumScore: number;
    readonly byBand: Readonly<Record<KnowledgeQualityScore["band"], number>>;
  };
}

export interface KnowledgeQualityScorer {
  score(
    entry: Readonly<Record<string, unknown>>,
    context?: KnowledgeQualityContext,
  ): KnowledgeQualityScore;
  scoreBatch(
    entries: readonly Readonly<Record<string, unknown>>[],
    context?: KnowledgeQualityContext,
  ): KnowledgeQualityReport;
  exportJson(report: KnowledgeQualityReport, file: string): Promise<string>;
}

export {
  WeightedKnowledgeQualityScorer,
  KnowledgeQualityError,
  DEFAULT_QUALITY_WEIGHTS,
} from "./weighted-quality-scorer.js";
