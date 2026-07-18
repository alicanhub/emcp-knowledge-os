import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test("Turkish and English interfaces have no WCAG A/AA violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#favCount")).toHaveText("0");
  await expect(page.locator("#count")).toContainText("378");
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(page.locator(".bottom")).toHaveAttribute(
    "aria-label",
    "Ana gezinme",
  );
  let results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  expect(results.violations).toEqual([]);

  await page.locator("#enBtn").click();
  await page.locator("#themeBtn").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".bottom")).toHaveAttribute(
    "aria-label",
    "Primary navigation",
  );
  results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  expect(results.violations).toEqual([]);

  await page.locator("#q").fill("zzzzzzzzzz");
  await expect(page.locator(".search-empty")).toBeVisible();
  results = await new AxeBuilder({ page })
    .include("#page-knowledge")
    .withTags(wcagTags)
    .analyze();
  expect(results.violations).toEqual([]);

  await page.locator("#q").fill("");
  await page.locator("#navKnowledge").click();
  await page.locator("#grid .card").first().click();
  results = await new AxeBuilder({ page })
    .include("#modal")
    .withTags(wcagTags)
    .analyze();
  expect(results.violations).toEqual([]);

  await page.keyboard.press("Escape");
  await page.locator("#navHandbooks").click();
  await expect(page.locator("#handbookChapters button")).toHaveCount(30);
  results = await new AxeBuilder({ page })
    .include("#page-handbooks")
    .withTags(wcagTags)
    .analyze();
  expect(results.violations).toEqual([]);
});

test("controls are labelled and reduced-motion preferences are honoured", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page
    .locator("body")
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).transitionDuration),
    );
  expect(duration).toBeLessThanOrEqual(0.001);

  const knowledgeCard = page.locator('[data-page="knowledge"]').first();
  await knowledgeCard.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#page-knowledge")).toHaveClass(/active/);

  await page.locator('[data-page="calculators"]').last().click();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.EMCPCalculators)))
    .toBe(true);
  const unlabelled = await page
    .locator("#page-calculators input")
    .evaluateAll((inputs) =>
      inputs
        .filter(
          (input) =>
            input.labels.length === 0 && !input.getAttribute("aria-label"),
        )
        .map((input) => input.id),
    );
  expect(unlabelled).toEqual([]);
});

test("local content dashboard is read-only and accessible", async ({
  page,
}) => {
  await page.goto("/admin/content-dashboard.html");
  await expect(page.locator("h1")).toHaveText(
    "EMCP Content Production Dashboard",
  );
  await expect(page.locator("#summary .metric")).toHaveCount(14);
  await expect(
    page.locator("input, textarea, select, [contenteditable=true]"),
  ).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
