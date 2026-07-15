import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { EvidenceGatedAIDraftWriter } from "../../production-engine/ai-draft-writer/evidence-gated-draft-writer.js";
import { ProviderNeutralResearchConnector } from "../../production-engine/ai-research-connector/provider-neutral-connector.js";
import { JsonDraftGenerator } from "../../production-engine/draft-generator/draft-generator.js";
import { JsonResearchQueue } from "../../production-engine/research-queue/research-queue.js";
import { JsonTopicPlanner } from "../../production-engine/topic-planner/topic-planner.js";

const clock = () => new Date("2026-07-14T23:00:00.000Z");
const pack = {
  id: "pack.004",
  title: { en: "Planning Basics", tr: "Planlama Temelleri" },
};
const topic = {
  id: "planning.test-topic",
  title: { en: "Test Topic", tr: "Test Konusu" },
  difficulty: "beginner",
};
const officialCitation = {
  title: "Official topic guidance",
  publisher: "Official Authority",
  url: "https://official.example.gov/topic",
  accessedAt: "2026-07-14",
  publishedAt: "2026-06-01",
  jurisdiction: "United Kingdom",
  sourceType: "official-guidance",
  official: true,
  primarySource: true,
  note: "Supports the introductory explanation.",
};

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-ai-writer-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const plan = new JsonTopicPlanner({ runtimeEntries: [], clock }).generate({
    pack,
    topics: [topic],
    startMonth: "2026-08",
  });
  const generator = new JsonDraftGenerator({
    draftsDirectory: path.join(root, "drafts"),
    approvedDirectory: path.join(root, "reviewed"),
    clock,
  });
  const draftResult = await generator.generate({
    plannerJobId: "job.ai-writer",
    plan,
  });
  const researchQueue = new JsonResearchQueue(
    path.join(root, "research.json"),
    {
      clock,
    },
  );
  const tasks = await researchQueue.createForDrafts(draftResult);
  return { root, plan, generator, draftResult, researchQueue, tasks };
}

async function addVerifiedEvidence(queue, task, overrides = {}) {
  await queue.transition(task.id, "researching");
  await queue.addEvidence(task.id, {
    field: overrides.field || "simple_explanation",
    title: overrides.title || officialCitation.title,
    publisher: officialCitation.publisher,
    url: overrides.url || officialCitation.url,
    accessedAt: officialCitation.accessedAt,
    publishedAt: officialCitation.publishedAt,
    jurisdiction: officialCitation.jurisdiction,
    official: true,
    note: overrides.note || officialCitation.note,
  });
  await queue.setConfidence(task.id, 0.9);
  return queue.transition(task.id, "verified");
}

test("deterministically generates a complete bilingual v2 draft without fabricating unsupported facts", async (t) => {
  const { plan, generator, draftResult, researchQueue } = await fixture(t);
  const connector = new ProviderNeutralResearchConnector({
    researchQueue,
    clock,
    providers: [
      {
        id: "local-test-adapter",
        name: "Local test adapter",
        capabilities: {
          sourceTypes: ["official-guidance"],
          jurisdictions: ["United Kingdom"],
          languages: ["en", "tr"],
        },
        research: async () => ({
          providerRequestId: "provider.request.1",
          warnings: [],
          candidates: [
            {
              field: "simple_explanation",
              summary: "Official evidence candidate.",
              citation: officialCitation,
              confidence: 0.9,
            },
          ],
        }),
      },
    ],
  });
  const referencesTask = researchQueue
    .list({ draftId: draftResult.drafts[0].draft_id })
    .find((item) => item.category === "references");
  await connector.research({
    requestId: "writer.research.1",
    taskId: referencesTask.id,
    query: "Official topic guidance",
    field: "simple_explanation",
    jurisdiction: "United Kingdom",
    sourceTypes: ["official-guidance"],
  });
  await researchQueue.transition(referencesTask.id, "verified");
  const writer = new EvidenceGatedAIDraftWriter({
    draftGenerator: generator,
    researchQueue,
    clock,
  });
  const request = {
    plannerJobId: "job.ai-writer",
    plan,
    draftResult,
    deterministic: true,
  };
  const first = await writer.write(request);
  const firstJson = await fs.readFile(draftResult.drafts[0].path, "utf8");
  const second = await writer.write(request);
  const secondJson = await fs.readFile(draftResult.drafts[0].path, "utf8");
  assert.equal(firstJson, secondJson);
  assert.equal(first.providerId, null);
  assert.equal(first.quality[0].evidenceSupportedSections, 0);
  assert.equal(first.quality[0].verifiedEvidenceItems, 1);
  assert.equal(first.quality[0].bilingualCompletenessPercentage, 100);
  assert.equal(typeof first.quality[0].knowledgeQuality.totalScore, "number");
  assert.equal(first.quality[0].knowledgeQuality.entryId, topic.id);
  assert.equal(second.quality[0].sourceCount, 1);
  const draft = JSON.parse(secondJson);
  assert.match(draft.simple_explanation.en, /research is required/i);
  assert.match(draft.simple_explanation.tr, /araştırması gereklidir/i);
  assert.equal(draft.formula, null);
  assert.equal(draft.sources.length, 1);
  assert.equal(draft.review_status, "draft");
  const schema = JSON.parse(
    await fs.readFile("schemas/content-entry.schema.json", "utf8"),
  );
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(draft), true, JSON.stringify(validate.errors));
});

test("accepts bilingual provider sections only when exact verified evidence supports them", async (t) => {
  const { plan, generator, draftResult, researchQueue, tasks } =
    await fixture(t);
  const referencesTask = tasks.find((item) => item.category === "references");
  const formulasTask = tasks.find((item) => item.category === "formulas");
  const verifiedReferences = await addVerifiedEvidence(
    researchQueue,
    referencesTask,
  );
  const verifiedFormulas = await addVerifiedEvidence(
    researchQueue,
    formulasTask,
    {
      field: "formula",
      title: "Verified formula source",
      url: "https://official.example.gov/formula",
      note: "Verified expression: A = B.",
    },
  );
  const referenceEvidenceId = verifiedReferences.evidence[0].id;
  const formulaEvidenceId = verifiedFormulas.evidence[0].id;
  const writer = new EvidenceGatedAIDraftWriter({
    draftGenerator: generator,
    researchQueue,
    clock,
    provider: {
      id: "provider-neutral-test",
      name: "Provider-neutral test writer",
      write: async () => ({
        warnings: [],
        sections: {
          simple_explanation: {
            value: {
              en: "Evidence-supported beginner explanation.",
              tr: "Kanıtla desteklenen başlangıç açıklaması.",
            },
            evidenceIds: [referenceEvidenceId],
          },
          formula: {
            value: {
              expression: "A = B",
              variables: [
                {
                  symbol: "A",
                  description: { en: "Result", tr: "Sonuç" },
                },
              ],
              notes: { en: "Verified formula.", tr: "Doğrulanmış formül." },
            },
            evidenceIds: [formulaEvidenceId],
          },
          related_regulations: {
            value: [
              {
                title: {
                  en: "Claimed regulation",
                  tr: "İddia edilen düzenleme",
                },
                reference: "X",
                url: officialCitation.url,
              },
            ],
            evidenceIds: [referenceEvidenceId],
          },
        },
      }),
    },
  });
  const result = await writer.write({
    plannerJobId: "job.ai-writer",
    plan,
    draftResult,
    deterministic: false,
  });
  const draft = JSON.parse(
    await fs.readFile(draftResult.drafts[0].path, "utf8"),
  );
  assert.equal(
    draft.simple_explanation.en,
    "Evidence-supported beginner explanation.",
  );
  assert.equal(draft.formula.expression, "A = B");
  assert.deepEqual(draft.related_regulations, []);
  assert.equal(result.quality[0].evidenceSupportedSections, 2);
  assert.ok(
    result.quality[0].unsupportedSections.includes("related_regulations"),
  );
  assert.equal(result.providerId, "provider-neutral-test");
});

test("refuses to modify reviewed content or use provider mode without an adapter", async (t) => {
  const { plan, generator, draftResult, researchQueue } = await fixture(t);
  const writer = new EvidenceGatedAIDraftWriter({
    draftGenerator: generator,
    researchQueue,
    clock,
  });
  await assert.rejects(
    () =>
      writer.write({
        plannerJobId: "job.ai-writer",
        plan,
        draftResult,
        deterministic: false,
      }),
    /requires a draft-writing adapter/,
  );
  const file = draftResult.drafts[0].path;
  const draft = JSON.parse(await fs.readFile(file, "utf8"));
  draft.review_status = "reviewed";
  await fs.writeFile(file, JSON.stringify(draft));
  await assert.rejects(
    () =>
      writer.write({
        plannerJobId: "job.ai-writer",
        plan,
        draftResult,
      }),
    /cannot modify non-draft content/,
  );
});
