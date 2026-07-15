import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonProductionDashboard } from "../../production-engine/dashboard/production-dashboard.js";
import { JsonHumanReviewWorkflow } from "../../production-engine/human-review/human-review-workflow.js";
import {
  DEFAULT_QUALITY_WEIGHTS,
  KnowledgeQualityError,
  WeightedKnowledgeQualityScorer,
} from "../../production-engine/knowledge-quality/weighted-quality-scorer.js";

const clock = () => new Date("2026-07-14T23:30:00.000Z");
const localized = (value) => ({ en: value, tr: `${value} Türkçe` });
const localizedList = (value) => ({ en: [value], tr: [`${value} Türkçe`] });

function completeEntry() {
  return {
    id: "quality.entry",
    title: localized("Quality entry"),
    summary: localized("A short and clear summary."),
    simple_explanation: localized(
      "A beginner can understand this explanation.",
    ),
    professional_explanation: localized(
      "A professional explanation uses precise terminology.",
    ),
    definition: localized("A concise definition."),
    real_world_example: localized("A practical project example."),
    site_example: localized("A practical site example."),
    office_example: localized("A practical office example."),
    interview_questions: {
      en: [{ question: "What is it?", answer: "A supported answer." }],
      tr: [{ question: "Bu nedir?", answer: "Desteklenen cevap." }],
    },
    category: { key: "quality", en: "Quality", tr: "Kalite" },
    subcategory: { key: "test", en: "Test", tr: "Test" },
    aliases: localizedList("Quality alias"),
    keywords: localizedList("quality"),
    formula: {
      expression: "A = B",
      variables: [{ symbol: "A", description: localized("Result") }],
      notes: localized("Verified formula note."),
    },
    worked_example: localized("A worked calculation example."),
    when_to_use: localized("Use this during appraisal."),
    use_cases: localizedList("Appraisal"),
    risks: localizedList("Incorrect assumptions"),
    common_mistakes: localizedList("Using stale evidence"),
    practical_tips: localizedList("Check current sources"),
    best_practice: localizedList("Record assumptions"),
    uk_practice: localized("Current UK practice summary."),
    turkey_practice: localized("Current Turkey practice summary."),
    related_concepts: ["quality.related"],
    related_calculators: ["calculator.quality"],
    related_documents: [],
    related_standards: [],
    related_regulations: [],
    frequently_asked_questions: {
      en: [{ question: "Why use it?", answer: "For consistent analysis." }],
      tr: [{ question: "Neden kullanılır?", answer: "Tutarlı analiz için." }],
    },
    visual_illustration: {
      status: "available",
      caption: localized("Quality illustration"),
      url: "https://example.com/quality.svg",
    },
    future_video: {
      status: "not_applicable",
      caption: localized("Video not required"),
      url: null,
    },
    jurisdiction: ["United Kingdom", "Turkey"],
    sources: [
      {
        title: "Official guidance",
        publisher: "Official Authority",
        url: "https://official.example.gov/guidance",
        publication_date: "2026-06-01",
        accessed_date: "2026-07-14",
        citation_note: "Supports the factual explanations in this entry.",
      },
    ],
    revision_history: [
      {
        version: "1.0.0",
        date: "2026-07-01",
        summary: localized("Professional review"),
        reviewer: "Quality Reviewer",
      },
    ],
    reviewed_date: "2026-07-01",
    review_status: "reviewed",
    content_version: "1.0.0",
  };
}

test("calculates a transparent weighted score from all nine categories", () => {
  const scorer = new WeightedKnowledgeQualityScorer({ clock });
  const result = scorer.score(completeEntry(), {
    evidenceCoveragePercentage: 100,
    knownEntryIds: ["quality.entry", "quality.related"],
    calculatorIds: ["calculator.quality"],
  });
  assert.equal(Object.keys(result.categories).length, 9);
  assert.equal(
    Object.values(result.categories).reduce(
      (sum, category) => sum + category.weight,
      0,
    ),
    100,
  );
  assert.equal(
    result.totalScore,
    Number(
      Object.values(result.categories)
        .reduce((sum, category) => sum + category.weightedScore, 0)
        .toFixed(1),
    ),
  );
  assert.ok(result.totalScore >= 85);
  assert.equal(result.categories.calculatorIntegration.score, 100);
  assert.equal(result.categories.relationshipQuality.score, 100);
});

test("scores weak drafts lower and returns ordered improvement recommendations", () => {
  const scorer = new WeightedKnowledgeQualityScorer({ clock });
  const weak = completeEntry();
  weak.summary = localized("Summary research is required for this entry.");
  weak.simple_explanation = { en: "English only", tr: "" };
  weak.sources = [];
  weak.reviewed_date = null;
  weak.review_status = "draft";
  weak.related_concepts = ["quality.entry", "missing.entry", "missing.entry"];
  weak.related_calculators = [];
  weak.visual_illustration.status = "planned";
  weak.future_video.status = "planned";
  const result = scorer.score(weak, {
    evidenceCoveragePercentage: 0,
    knownEntryIds: ["quality.entry"],
    calculatorIds: ["calculator.quality"],
  });
  assert.ok(result.totalScore < 70);
  assert.ok(result.recommendations.length >= 5);
  assert.ok(
    result.recommendations.some(
      (item) => item.category === "citationQuality" && item.priority === "high",
    ),
  );
  assert.equal(result.categories.calculatorIntegration.score, 0);
});

test("exports batch quality reports as JSON", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "emcp-quality-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const scorer = new WeightedKnowledgeQualityScorer({ clock });
  const report = scorer.scoreBatch([
    completeEntry(),
    { ...completeEntry(), id: "quality.second" },
  ]);
  const file = path.join(root, "reports", "quality.json");
  await scorer.exportJson(report, file);
  const stored = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(stored.statistics.count, 2);
  assert.equal(stored.entries.length, 2);
  assert.deepEqual(DEFAULT_QUALITY_WEIGHTS, {
    completeness: 18,
    evidenceCoverage: 16,
    citationQuality: 14,
    bilingualConsistency: 14,
    readability: 10,
    reviewFreshness: 10,
    relationshipQuality: 8,
    calculatorIntegration: 5,
    mediaReadiness: 5,
  });
  assert.throws(
    () => new WeightedKnowledgeQualityScorer({ weights: { completeness: 1 } }),
    (error) =>
      error instanceof KnowledgeQualityError &&
      error.code === "invalid-weights",
  );
});

test("persists quality metrics in Human Review and exposes aggregates in the Dashboard", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "emcp-quality-integration-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const entry = completeEntry();
  entry.draft_id = "quality.entry.draft.001";
  entry.planner_job_id = "job.quality";
  const draftPath = path.join(root, "draft.json");
  await fs.writeFile(draftPath, JSON.stringify(entry));
  const categories = [
    "regulations",
    "standards",
    "formulas",
    "calculators",
    "references",
    "uk-guidance",
    "turkey-guidance",
    "examples",
    "glossary-links",
  ];
  const tasks = categories.map((category) => ({
    category,
    status: "verified",
  }));
  const researchQueue = {
    list: ({ category, status } = {}) =>
      tasks.filter(
        (task) =>
          (!category || task.category === category) &&
          (!status || task.status === status),
      ),
  };
  const scorer = new WeightedKnowledgeQualityScorer({ clock });
  const workflow = new JsonHumanReviewWorkflow(
    path.join(root, "reviews.json"),
    { researchQueue, qualityScorer: scorer, clock },
  );
  const reviewCase = await workflow.create(
    {
      draft_id: entry.draft_id,
      id: entry.id,
      path: draftPath,
      planner_job_id: entry.planner_job_id,
    },
    ["Quality Reviewer"],
    "Managing Editor",
  );
  assert.equal(typeof reviewCase.quality.totalScore, "number");
  const dashboard = new JsonProductionDashboard({
    qualityReports: [reviewCase.quality],
    clock,
  });
  const snapshot = await dashboard.snapshot();
  assert.equal(snapshot.knowledgeQuality.entries, 1);
  assert.equal(
    snapshot.overall.averageKnowledgeQuality,
    reviewCase.quality.totalScore,
  );
});
