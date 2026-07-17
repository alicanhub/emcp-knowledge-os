import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonResearchQueue } from "../../production-engine/research-queue/research-queue.js";
import {
  AIResearchConnectorError,
  DefaultSourceValidator,
  ProviderNeutralResearchConnector,
} from "../../production-engine/ai-research-connector/provider-neutral-connector.js";

const clock = () => new Date("2026-07-14T22:00:00.000Z");
const draftResult = {
  plannerJobId: "job.research-connector",
  sourcePack: "pack.004",
  generatedAt: clock().toISOString(),
  drafts: [
    {
      id: "planning.permission",
      path: "/drafts/planning.permission.json",
      reviewStatus: "draft",
      regeneration: 1,
      draft_id: "planning.permission.draft.001",
      source_pack: "pack.004",
      planner_job_id: "job.research-connector",
      version: "1.0.0",
      generated_at: clock().toISOString(),
      updated_at: clock().toISOString(),
    },
  ],
  skipped: [],
  reviewedRecordsCreated: 0,
};
const sourceTypes = [
  "web-research",
  "government-publication",
  "standard",
  "regulation",
  "technical-document",
  "official-guidance",
];
const citation = {
  title: "Official planning guidance",
  publisher: "Planning Authority",
  url: "https://planning.example.gov/guidance",
  accessedAt: "2026-07-14",
  publishedAt: "2026-06-01",
  jurisdiction: "United Kingdom",
  sourceType: "official-guidance",
  official: true,
  primarySource: true,
  documentIdentifier: "GUIDE-001",
  section: "Applications",
  note: "Primary guidance for the factual claim.",
};

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-ai-research-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const queue = new JsonResearchQueue(path.join(root, "research.json"), {
    clock,
  });
  const tasks = await queue.createForDrafts(draftResult);
  const task = tasks.find((item) => item.category === "uk-guidance");
  return { root, queue, task };
}

const provider = (id, candidates, overrides = {}) => ({
  id,
  name: `Provider ${id}`,
  capabilities: {
    sourceTypes,
    jurisdictions: ["United Kingdom", "Turkey"],
    languages: ["en", "tr"],
  },
  research: async () => ({
    providerRequestId: `${id}.request`,
    candidates,
    warnings: [],
  }),
  ...overrides,
});
const requestFor = (taskId) => ({
  requestId: "connector.request.001",
  taskId,
  query: "Current official planning guidance",
  field: "ukPractice",
  jurisdiction: "United Kingdom",
  languages: ["en", "tr"],
  sourceTypes: ["official-guidance", "government-publication"],
});

test("normalizes multiple provider results into citations and Research Queue evidence", async (t) => {
  const { queue, task } = await fixture(t);
  const providers = [
    provider("alpha", [
      {
        field: "ukPractice",
        summary: "Explains the official application process.",
        citation,
        confidence: 0.9,
      },
    ]),
    provider("beta", [
      {
        field: "relatedRegulations",
        summary: "Confirms the governing publication.",
        citation: {
          ...citation,
          url: "https://planning.example.gov/regulation",
        },
        confidence: 0.8,
      },
    ]),
  ];
  const connector = new ProviderNeutralResearchConnector({
    providers,
    researchQueue: queue,
    clock,
  });
  const report = await connector.research(requestFor(task.id));
  assert.equal(report.providers.length, 2);
  assert.equal(report.citations.length, 2);
  assert.equal(report.citations[0].validation.authoritative, true);
  assert.equal(report.citations[0].confidenceScore, 0.95);
  assert.equal(report.confidenceScore, 0.925);
  assert.equal(report.queueTask.evidence.length, 2);
  assert.equal(report.queueTask.status, "researching");
  assert.equal(report.requiresHumanVerification, true);
  assert.equal(queue.get(task.id).status, "researching");
});

test("rejects invalid citations without adding them as evidence", async (t) => {
  const { queue, task } = await fixture(t);
  const connector = new ProviderNeutralResearchConnector({
    providers: [
      provider("invalid", [
        {
          field: "ukPractice",
          summary: "Unsupported secondary claim.",
          citation: {
            ...citation,
            url: "http://unverified.example/article",
            official: false,
          },
          confidence: 1,
        },
      ]),
    ],
    researchQueue: queue,
    clock,
  });
  const report = await connector.research(requestFor(task.id));
  assert.equal(report.citations.length, 0);
  assert.equal(report.rejectedCitations.length, 1);
  assert.equal(report.confidenceScore, 0);
  assert.equal(report.queueTask.evidence.length, 0);
  assert.ok(
    report.rejectedCitations[0].validation.issues.some(
      (issue) => issue.code === "official-source-required",
    ),
  );
});

test("routes by capability and contains individual provider failures", async (t) => {
  const { queue, task } = await fixture(t);
  const connector = new ProviderNeutralResearchConnector({
    providers: [
      provider("failed", [], {
        research: async () => {
          throw new Error("Adapter unavailable");
        },
      }),
      provider("turkey-only", [], {
        capabilities: {
          sourceTypes: ["official-guidance"],
          jurisdictions: ["Turkey"],
          languages: ["tr"],
        },
      }),
      provider("working", [
        {
          field: "ukPractice",
          summary: "Verified source candidate.",
          citation,
          confidence: 0.8,
        },
      ]),
    ],
    researchQueue: queue,
    clock,
  });
  const report = await connector.research(requestFor(task.id));
  assert.deepEqual(
    report.providers.map((item) => item.providerId),
    ["failed", "working"],
  );
  assert.equal(report.providers[0].status, "failed");
  assert.equal(report.providers[1].status, "completed");
  assert.equal(report.citations.length, 1);
});

test("source validator distinguishes invalid, review-required and authoritative sources", () => {
  const validator = new DefaultSourceValidator({ maxSourceAgeDays: 365 });
  const valid = validator.validate(citation, clock());
  assert.equal(valid.status, "valid");
  assert.equal(valid.authoritative, true);
  const stale = validator.validate(
    { ...citation, publishedAt: "2020-01-01" },
    clock(),
  );
  assert.equal(stale.status, "requires-review");
  const invalid = validator.validate(
    { ...citation, publisher: "", accessedAt: "2030-01-01" },
    clock(),
  );
  assert.equal(invalid.status, "invalid");
});

test("validates adapter identity and request boundaries without external configuration", async (t) => {
  const { queue, task } = await fixture(t);
  assert.throws(
    () =>
      new ProviderNeutralResearchConnector({
        providers: [{ id: "incomplete" }],
        researchQueue: queue,
      }),
    (error) =>
      error instanceof AIResearchConnectorError &&
      error.code === "invalid-provider",
  );
  const connector = new ProviderNeutralResearchConnector({
    providers: [provider("valid", [])],
    researchQueue: queue,
    clock,
  });
  await assert.rejects(
    () => connector.research({ ...requestFor(task.id), sourceTypes: [] }),
    (error) =>
      error instanceof AIResearchConnectorError &&
      error.code === "invalid-request",
  );
});
