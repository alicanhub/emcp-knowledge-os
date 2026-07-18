import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("emcpFav", JSON.stringify(["LTV"]));
  });
  await page.goto("/");
  await expect(page.locator("#count")).toContainText("378");
});

test("opens with Ctrl+K, Cmd+K and slash and supports keyboard control", async ({
  page,
}) => {
  const palette = page.locator("#commandPalette");
  await page.keyboard.press("Control+k");
  await expect(palette).toHaveClass(/show/);
  await expect(page.locator("#commandPaletteInput")).toBeFocused();
  await page.locator("#commandPaletteInput").fill("LTV");
  await expect(page.locator(".command-group h3").first()).toHaveText(
    "Favourites",
  );
  await expect(page.locator(".command-result mark").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(palette).not.toHaveClass(/show/);
  await expect(page.locator("#modal")).toHaveClass(/show/);

  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+k");
  await expect(palette).toHaveClass(/show/);
  await page.keyboard.press("Escape");
  await expect(palette).not.toHaveClass(/show/);

  await page.locator("#navHome").focus();
  await page.keyboard.press("/");
  await expect(palette).toHaveClass(/show/);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
});

test("groups cross-platform results and shows suggestions for empty results", async ({
  page,
}) => {
  await page.keyboard.press("Control+k");
  const input = page.locator("#commandPaletteInput");
  await input.fill("yield");
  await expect(page.locator(".command-group h3")).toContainText([
    "Knowledge",
    "Calculators",
  ]);
  await input.fill("workspace");
  await expect(page.locator(".command-group h3")).toContainText(["Workspace"]);
  await input.fill("zzzzzzzzzz");
  await expect(page.locator(".command-empty")).toBeVisible();
  await expect(page.locator(".command-suggestions button")).toHaveCount(3);
});

test("mobile search opens the same full-screen accessible palette", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile interaction only");
  await page.locator("#q").tap();
  const palette = page.locator("#commandPalette");
  await expect(palette).toHaveClass(/show/);
  const box = await page.locator(".command-palette-panel").boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.y).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
  expect(box.height).toBeGreaterThanOrEqual(viewport.height - 2);

  const results = await new AxeBuilder({ page })
    .include("#commandPalette")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
