const OFFICIAL_SOURCE_TYPES = new Set([
  "government-publication",
  "standard",
  "regulation",
  "official-guidance",
]);
const SOURCE_TYPES = new Set([
  "web-research",
  "government-publication",
  "standard",
  "regulation",
  "technical-document",
  "official-guidance",
]);

export class AIResearchConnectorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AIResearchConnectorError";
    this.code = code;
  }
}

const copy = (value) => structuredClone(value);
const clamp = (value) => Math.max(0, Math.min(1, value));
const rounded = (value) => Number(value.toFixed(4));

export class DefaultSourceValidator {
  /** @param {any} options */
  constructor(options = {}) {
    this.maxSourceAgeDays = options.maxSourceAgeDays ?? 730;
  }

  validate(source, now = new Date()) {
    const issues = [];
    let url;
    try {
      url = new URL(source?.url);
      if (url.protocol !== "https:") throw new Error();
    } catch {
      issues.push({
        code: "invalid-url",
        severity: "error",
        message: "Citation URL must be a valid HTTPS URL.",
      });
    }
    for (const field of ["title", "publisher", "note"])
      if (!String(source?.[field] || "").trim())
        issues.push({
          code: `missing-${field}`,
          severity: "error",
          message: `Citation ${field} is required.`,
        });
    if (!SOURCE_TYPES.has(source?.sourceType))
      issues.push({
        code: "invalid-source-type",
        severity: "error",
        message: "Citation source type is unsupported.",
      });
    const accessed = Date.parse(source?.accessedAt);
    if (Number.isNaN(accessed) || accessed > now.valueOf())
      issues.push({
        code: "invalid-access-date",
        severity: "error",
        message: "Citation access date must be valid and not in the future.",
      });
    if (source?.publishedAt) {
      const published = Date.parse(source.publishedAt);
      if (Number.isNaN(published) || published > now.valueOf())
        issues.push({
          code: "invalid-publication-date",
          severity: "error",
          message: "Publication date must be valid and not in the future.",
        });
      else if ((now.valueOf() - published) / 86_400_000 > this.maxSourceAgeDays)
        issues.push({
          code: "source-age-review",
          severity: "warning",
          message: "Source age requires a currentness review.",
        });
    }
    if (OFFICIAL_SOURCE_TYPES.has(source?.sourceType) && !source?.official)
      issues.push({
        code: "official-source-required",
        severity: "error",
        message: "This source type must identify an official publisher.",
      });
    if (OFFICIAL_SOURCE_TYPES.has(source?.sourceType) && !source?.primarySource)
      issues.push({
        code: "primary-source-review",
        severity: "warning",
        message: "The citation is not marked as a primary source.",
      });
    const hasErrors = issues.some((issue) => issue.severity === "error");
    return {
      status: hasErrors
        ? "invalid"
        : issues.length
          ? "requires-review"
          : "valid",
      authoritative: Boolean(
        url && source?.official && source?.primarySource && !hasErrors,
      ),
      issues,
    };
  }
}

export class ProviderNeutralResearchConnector {
  #providers;
  #researchQueue;
  #sourceValidator;
  #clock;

  /** @param {any} options */
  constructor(options = {}) {
    if (!options.researchQueue)
      throw new AIResearchConnectorError(
        "queue-required",
        "A Research Queue is required.",
      );
    if (!Array.isArray(options.providers))
      throw new AIResearchConnectorError(
        "invalid-providers",
        "Providers must be an array of adapters.",
      );
    this.#providers = new Map();
    for (const provider of options.providers) {
      this.#assertProvider(provider);
      if (this.#providers.has(provider.id))
        throw new AIResearchConnectorError(
          "duplicate-provider",
          `Duplicate provider adapter: ${provider.id}`,
        );
      this.#providers.set(provider.id, provider);
    }
    this.#researchQueue = options.researchQueue;
    this.#sourceValidator =
      options.sourceValidator || new DefaultSourceValidator();
    this.#clock = options.clock || (() => new Date());
  }

  async research(request) {
    this.#assertRequest(request);
    let task = this.#researchQueue.get(request.taskId);
    if (!task)
      throw new AIResearchConnectorError(
        "task-not-found",
        `Unknown Research Queue task: ${request.taskId}`,
      );
    if (task.status === "pending")
      task = await this.#researchQueue.transition(task.id, "researching");
    if (task.status !== "researching")
      throw new AIResearchConnectorError(
        "task-not-researching",
        "Connector research requires a pending or researching task.",
      );

    const selected = this.#selectProviders(request);
    if (!selected.length)
      throw new AIResearchConnectorError(
        "provider-unavailable",
        "No provider supports the requested sources and jurisdiction.",
      );
    const providerResults = [];
    const citations = [];
    const rejectedCitations = [];
    const publisherCounts = new Map();
    const responses = [];
    for (const provider of selected) {
      try {
        const response = await provider.research(
          {
            query: request.query,
            field: request.field,
            jurisdiction: request.jurisdiction || null,
            languages: request.languages || ["en", "tr"],
            sourceTypes: request.sourceTypes,
          },
          {
            requestId: request.requestId,
            requestedAt: this.#clock().toISOString(),
            maxResults: request.maxResults || 10,
          },
        );
        if (!Array.isArray(response?.candidates))
          throw new Error("Provider response candidates must be an array.");
        responses.push({ provider, response });
        for (const candidate of response.candidates) {
          const key = String(candidate.citation?.publisher || "").toLowerCase();
          publisherCounts.set(key, (publisherCounts.get(key) || 0) + 1);
        }
      } catch (error) {
        providerResults.push({
          providerId: provider.id,
          status: "failed",
          candidateCount: 0,
          acceptedCount: 0,
          error: error.message,
        });
      }
    }
    for (const { provider, response } of responses) {
      let accepted = 0;
      response.candidates.forEach((candidate, index) => {
        const validation = this.#sourceValidator.validate(
          candidate.citation,
          this.#clock(),
        );
        const corroborated =
          (publisherCounts.get(
            String(candidate.citation?.publisher || "").toLowerCase(),
          ) || 0) > 1;
        const citation = {
          ...copy(candidate.citation),
          id: `${request.requestId}.${provider.id}.${String(index + 1).padStart(3, "0")}`,
          providerId: provider.id,
          validation,
          confidenceScore: this.#score(
            candidate.confidence,
            candidate.citation,
            validation,
            corroborated,
          ),
        };
        if (validation.status === "invalid") rejectedCitations.push(citation);
        else {
          citations.push({ citation, candidate });
          accepted++;
        }
      });
      providerResults.push({
        providerId: provider.id,
        status: "completed",
        candidateCount: response.candidates.length,
        acceptedCount: accepted,
        error: null,
      });
    }
    citations.sort(
      (left, right) =>
        right.citation.confidenceScore - left.citation.confidenceScore ||
        left.citation.id.localeCompare(right.citation.id),
    );
    const limited = citations.slice(0, request.maxResults || 10);
    for (const { citation, candidate } of limited)
      task = await this.#researchQueue.addEvidence(task.id, {
        field: candidate.field || request.field,
        title: citation.title,
        publisher: citation.publisher,
        url: citation.url,
        accessedAt: citation.accessedAt,
        publishedAt: citation.publishedAt || null,
        jurisdiction: citation.jurisdiction || request.jurisdiction || null,
        official: citation.official,
        note: `${candidate.summary} ${citation.note}`.trim(),
      });
    const confidenceScore = limited.length
      ? rounded(
          limited.reduce(
            (sum, item) => sum + item.citation.confidenceScore,
            0,
          ) / limited.length,
        )
      : 0;
    task = await this.#researchQueue.setConfidence(task.id, confidenceScore);
    return {
      version: 1,
      requestId: request.requestId,
      taskId: task.id,
      researchCategory: task.category,
      generatedAt: this.#clock().toISOString(),
      providers: providerResults.sort((a, b) =>
        a.providerId.localeCompare(b.providerId),
      ),
      citations: limited.map((item) => item.citation),
      rejectedCitations,
      confidenceScore,
      queueTask: task,
      requiresHumanVerification: true,
    };
  }

  #selectProviders(request) {
    const requestedIds = request.providerIds
      ? new Set(request.providerIds)
      : null;
    return [...this.#providers.values()]
      .filter((provider) => !requestedIds || requestedIds.has(provider.id))
      .filter((provider) =>
        request.sourceTypes.some((type) =>
          provider.capabilities.sourceTypes.includes(type),
        ),
      )
      .filter(
        (provider) =>
          !request.jurisdiction ||
          provider.capabilities.jurisdictions.includes("*") ||
          provider.capabilities.jurisdictions.includes(request.jurisdiction),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  #score(providerConfidence, source, validation, corroborated) {
    if (!Number.isFinite(providerConfidence)) providerConfidence = 0;
    return rounded(
      clamp(providerConfidence) * 0.5 +
        (source.official ? 0.2 : 0) +
        (source.primarySource ? 0.15 : 0) +
        (validation.status === "valid" ? 0.1 : 0.05) +
        (corroborated ? 0.05 : 0),
    );
  }
  #assertProvider(provider) {
    if (
      !provider?.id ||
      !provider.name ||
      typeof provider.research !== "function" ||
      !Array.isArray(provider.capabilities?.sourceTypes) ||
      !Array.isArray(provider.capabilities?.jurisdictions) ||
      !Array.isArray(provider.capabilities?.languages)
    )
      throw new AIResearchConnectorError(
        "invalid-provider",
        "Provider adapters require identity, capabilities and a research method.",
      );
  }
  #assertRequest(request) {
    if (
      !request?.requestId ||
      !request.taskId ||
      !String(request.query || "").trim() ||
      !String(request.field || "").trim() ||
      !Array.isArray(request.sourceTypes) ||
      !request.sourceTypes.length ||
      request.sourceTypes.some((type) => !SOURCE_TYPES.has(type))
    )
      throw new AIResearchConnectorError(
        "invalid-request",
        "Research request identity, task, query, field and valid source types are required.",
      );
    if (
      request.maxResults !== undefined &&
      (!Number.isInteger(request.maxResults) ||
        request.maxResults < 1 ||
        request.maxResults > 100)
    )
      throw new AIResearchConnectorError(
        "invalid-limit",
        "maxResults must be an integer from 1 to 100.",
      );
  }
}
