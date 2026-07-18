interface Window {
  EMCPCore: {
    schemas: {
      knowledgeEntries(value: unknown): Array<Record<string, unknown>>;
      knowledgeSearchEntries(value: unknown): Array<Record<string, unknown>>;
      knowledgeDetails(value: unknown): Record<string, Record<string, any>>;
      relationships(value: unknown, entryCount?: number): number[][];
      knowledgeIndex(value: unknown): {
        categories: Array<{ name: string; file: string }>;
        translations: string | null;
        searchIndex: string;
        relationships: string;
        details: string;
      };
      translations(
        value: unknown,
      ): Record<string, { defEn: string; useEn: string }>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  EMCPKnowledge: Record<string, unknown>;
  EMCPKnowledgeIntelligence: Record<string, unknown>;
  EMCPBilingualSearch: {
    create(entries: Array<Record<string, any>>): {
      search(
        query: unknown,
        categoryAliases?: Record<string, string>,
      ): Array<{
        index: number;
        score: number;
        tier: number;
        breakdown: Array<Record<string, any>>;
        reasons: string[];
      }>;
      suggest(query: unknown, limit?: number): string[];
      records: number;
    };
    normalize(value: unknown): string;
    highlight(value: unknown, query: unknown): string;
    weights: Array<Record<string, any>>;
  };
  EMCPCalculatorModel: Record<string, unknown>;
  EMCPDOM: Record<string, unknown>;
  EMCPApp: {
    entries: Array<Record<string, any>>;
    showPage(name: string): boolean;
    openTerm(index: number): Promise<boolean>;
    [key: string]: any;
  };
  EMCPI18n: Record<string, unknown>;
  EMCPAssistant: Record<string, unknown>;
  EMCPAssistantEngine: Record<string, unknown>;
  EMCPCalculators: Record<string, unknown>;
  EMCPWorkspace: Record<string, unknown>;
  EMCPPWA: Record<string, unknown>;
  EMCPOperations: Record<string, any>;
  EMCPFeatures: Record<string, any>;
  EMCPVirtualList: Record<string, any>;
  EMCPAIGuard: Record<string, any>;
  EMCPHandbook: Record<string, any>;
}
