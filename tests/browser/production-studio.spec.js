import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const snapshot = {
  version: 1,
  cycleId: "cycle.studio",
  status: "partial",
  progressPercentage: 50,
  generatedAt: "2026-07-14T23:45:00.000Z",
  completedStages: [
    "load-content-pack",
    "topic-planner",
    "job-queue",
    "draft-generator",
    "research-queue",
    "human-review",
  ],
  currentStage: "batch-validation",
  jobs: [
    {
      id: "job.studio",
      title: "Studio production job",
      status: "validation",
      priority: "high",
      updatedAt: "2026-07-14T23:44:00.000Z",
    },
  ],
  outputs: {
    "research-queue": {
      statistics: {
        total: 9,
        byStatus: { pending: 0, researching: 0, verified: 9, rejected: 0 },
        verifiedPercentage: 100,
      },
    },
    "batch-validation": {
      validForPublishing: true,
      findings: [{ severity: "warning" }],
    },
    "safe-import": {
      importId: "import.studio",
      importedRecordIds: ["entry.one"],
      runtimeCountBefore: 378,
      runtimeCountAfter: 379,
      indexesUpdated: true,
    },
    "knowledge-quality": [
      {
        entryId: "entry.one",
        totalScore: 82,
        band: "good",
        recommendations: [{ category: "mediaReadiness" }],
        categories: {
          completeness: { score: 90 },
          evidenceCoverage: { score: 80 },
          citationQuality: { score: 85 },
        },
      },
    ],
    "dashboard-refresh": {
      jobQueue: { total: 1 },
      draftGenerator: { draftsGenerated: 1 },
      researchQueue: {
        total: 9,
        verifiedPercentage: 100,
        byStatus: { verified: 9 },
      },
      humanReview: {
        totalCases: 1,
        byStatus: { approved: 1 },
      },
      batchValidation: { passed: 1, failed: 0 },
      safeImport: { imports: 1, recordsImported: 1 },
      backupRollback: { snapshots: 2, automaticRollbacks: 0 },
      overall: {
        plannedTopics: 1,
        completedJobs: 0,
        productionCompletionPercentage: 50,
      },
    },
  },
};

test("Production Studio renders the complete read-only workflow and starts only on request", async ({
  page,
}) => {
  await page.goto("/admin/production-studio.html");
  await expect(page.locator("h1")).toHaveText("Production command centre");
  await expect(page.locator("#pipeline .stage")).toHaveCount(12);
  await expect(page.locator("body")).not.toHaveAttribute("data-active", "true");
  await expect(
    page.locator("input, textarea, select, [contenteditable=true]"),
  ).toHaveCount(0);

  await page.evaluate(
    (value) => window.EMCPProductionStudio.render(value),
    snapshot,
  );
  await expect(page.locator("#progressValue")).toHaveText("50%");
  await expect(page.locator("#pipeline .stage.completed")).toHaveCount(6);
  await expect(page.locator("#pipeline .stage.active")).toHaveCount(1);
  await expect(page.locator("#jobs tr")).toHaveCount(1);
  await expect(page.locator("#researchCount")).toHaveText("9");
  await expect(page.locator("#reviewCount")).toHaveText("1");
  await expect(page.locator("#validationBadge")).toHaveText("Passed");
  await expect(page.locator("#importCount")).toHaveText("1");
  await expect(page.locator("#qualityScore")).toHaveText("82");

  await page.evaluate(() => {
    window.__productionStartEvents = 0;
    window.addEventListener(
      "emcp:production-start-request",
      () => window.__productionStartEvents++,
    );
  });
  await page.locator("#startButton").click();
  await expect(page.locator("body")).toHaveAttribute("data-active", "true");
  await expect(page.locator("#modeLabel")).toHaveText("Monitoring active");
  await expect
    .poll(() => page.evaluate(() => window.__productionStartEvents))
    .toBe(1);
  await expect(page.locator("#studioStatus")).toContainText(
    "Studio itself remains read-only",
  );
});

test("Production Studio is accessible and responsive at tablet width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/admin/production-studio.html");
  await page.evaluate(
    (value) => window.EMCPProductionStudio.render(value),
    snapshot,
  );
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.locator("#pipeline .stage")).toHaveCount(12);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
