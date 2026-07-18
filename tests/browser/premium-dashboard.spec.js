import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("emcpRecent", JSON.stringify(["LTV", "ROI"]));
    localStorage.setItem("emcpFav", JSON.stringify(["LTV"]));
    localStorage.setItem(
      "emcpHandbookInvestorLastChapter",
      "handbook.investor.chapter-01",
    );
    const date = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      "emcpProductMetrics",
      JSON.stringify({
        version: 1,
        days: { [date]: { calculator_ltv: 4, calculator_yield: 2 } },
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator("#smartDashboard")).toHaveAttribute(
    "aria-busy",
    "false",
  );
});

test("smart dashboard renders personalised, actionable sections", async ({
  page,
}) => {
  await expect(page.locator(".dashboard-feature")).toContainText(
    "Yatırımcı Zihniyeti",
  );
  await expect(page.locator(".dashboard-card")).toHaveCount(4);
  await expect(page.locator(".dashboard-card").nth(0)).toContainText("LTV");
  await expect(page.locator(".dashboard-card").nth(1)).toContainText("LTV");
  await expect(page.locator(".dashboard-card").nth(3)).toContainText(
    "LTV Hesaplayıcı",
  );
  await page
    .locator(".dashboard-card")
    .nth(0)
    .locator("button")
    .first()
    .click();
  await expect(page.locator("#modal")).toHaveClass(/show/);
});

test("premium dashboard and command preview meet WCAG AA", async ({ page }) => {
  let results = await new AxeBuilder({ page })
    .include("#smartDashboard")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);

  await page.keyboard.press("Control+k");
  await page.locator("#commandPaletteInput").fill("LTV");
  await expect(page.locator("#commandPalettePreview")).toContainText("LTV");
  results = await new AxeBuilder({ page })
    .include("#commandPalette")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("command palette prioritises context and windows long result lists", async ({
  page,
}) => {
  await page.keyboard.press("Control+k");
  await expect(page.locator("#commandPaletteResults")).toContainText(
    "Continue Where You Left Off",
  );
  await expect(page.locator(".command-result").first()).toContainText("LTV");
  await page.locator("#commandPaletteInput").fill("a");
  await expect(page.locator(".command-result").first()).toBeVisible();
  expect(await page.locator(".command-result").count()).toBeLessThanOrEqual(32);
});
