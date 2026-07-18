import { test, expect } from "@playwright/test";

test("knowledge, bilingual dialog and keyboard journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#count")).toContainText("378");
  await page.locator("#enBtn").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("#q").fill("loan to value");
  const result = page.locator("#grid .card").first();
  await expect(result).toContainText("LTV");
  await expect(result.locator("mark").first()).toBeVisible();
  await expect(result.locator(".match-reason")).toContainText("Matched by");
  await result.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#modal")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#modalTitle")).toContainText("LTV");
  expect(await page.locator(".knowledge-section").count()).toBeGreaterThan(33);
  await expect(page.locator(".knowledge-section").first()).toHaveAttribute(
    "open",
    "",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.EMCPApp.entries.find((entry) => entry.term === "LTV").use
            .length > 0,
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal")).toHaveAttribute("aria-hidden", "true");
  await expect(result).toBeFocused();
});

test("search typo tolerance, explanations and no-results guidance", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#enBtn").click();
  await page.locator("#q").fill("markte value");
  await expect(page.locator("#grid .card").first()).toContainText(
    "Market Value",
  );
  await expect(page.locator("#grid .match-reason").first()).toContainText(
    "Title",
  );
  await page.locator("#q").fill("markte");
  await expect(page.locator("#grid .card").first()).toBeVisible();
  await page.locator("#q").fill("zzzzzzzzzz");
  await expect(page.locator(".search-empty strong")).toHaveText(
    "No matching knowledge found",
  );
});

test("knowledge intelligence graph, journeys, breadcrumbs and read-next journey", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-page="knowledge-map"]').click();
  await expect(page.locator("#breadcrumbs")).toContainText(
    /Knowledge Map|Bilgi Haritası/,
  );
  await expect(page.locator("#relationshipHealth")).toContainText("378");
  await expect(page.locator(".knowledge-map-node")).toHaveCount(9);
  await expect(page.locator("#knowledgeJourney > section")).toHaveCount(4);
  await page.locator(".knowledge-map-node").nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".knowledge-map-node.root")).toHaveCount(1);
  await page.locator("#navKnowledge").click();
  await page.locator("#grid .card").first().click();
  await expect(page.locator("#breadcrumbs li")).toHaveCount(4);
  await expect(page.locator(".knowledge-intelligence")).toBeVisible();
  await expect(
    page
      .locator(".knowledge-intelligence summary")
      .filter({ hasText: /Parent concept|Üst kavram/ }),
  ).toContainText(/Parent concept|Üst kavram/);
  await expect(page.locator(".knowledge-intelligence")).toContainText(
    /Read Next|Sonraki Okuma/,
  );
  await page.locator("[data-modal-close]").click();
  await page.locator("#navHome").click();
  await page.locator('[data-page="knowledge-map"]').click();
  await expect(
    page.locator("#intelligenceRecent button").first(),
  ).toBeVisible();
});

test("learning graph, progress timeline and distraction-free study mode", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#enBtn").click();
  await page.locator("#q").fill("planning permission");
  await page.locator("#grid .card").first().click();
  await expect(page.locator(".learning-panel")).toContainText("In Progress");
  await expect(page.locator(".learning-timeline li")).not.toHaveCount(0);
  await expect(page.locator(".knowledge-confidence")).toContainText(
    /Official|Reference/,
  );
  await expect(page.locator(".knowledge-recommendations")).toContainText(
    "You should learn next",
  );
  await expect(page.locator(".knowledge-intelligence")).toContainText(
    "Related construction methods",
  );
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.locator(".learning-panel")).toContainText("Completed");
  await expect(page.locator(".learning-progress")).toHaveAttribute(
    "aria-valuenow",
    "75",
  );
  await page.getByRole("button", { name: "Study mode" }).click();
  await expect(page.locator("#sheet")).toHaveClass(/study-mode/);
  await expect(
    page.getByRole("button", { name: "Exit study mode" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal")).toHaveAttribute("aria-hidden", "true");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("emcpLearningProgress"))[
            "Planning Permission"
          ].status,
      ),
    )
    .toBe("completed");
});

test("calculator and workspace backup journey", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => window.EMCPCalculators))
    .toBeUndefined();
  await page.locator('[data-page="calculators"]').last().click();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.EMCPCalculators)))
    .toBe(true);
  await page.locator("#ltvLoan").fill("700000");
  await page.locator("#ltvValue").fill("1000000");
  await page.locator('[data-calculate="ltv"]').click();
  await expect(page.locator("#ltvResult")).toHaveText("70.00%");
  const backup = await page.evaluate(() => window.EMCPWorkspace.buildExport());
  expect(backup.format).toBe("emcp-workspace");
  expect(backup.version).toBe(1);
  await page.evaluate(
    (payload) => window.EMCPWorkspace.importData(payload, false),
    backup,
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.EMCPWorkspace.getAutomaticBackups().length),
    )
    .toBe(1);
});

test("lazy features, worker search, virtualization and local operations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#count")).toContainText("378");
  expect(await page.locator("#grid .card").count()).toBeLessThan(378);
  const result = await page.evaluate(async () => {
    const values = await window.EMCPKnowledge.searchAsync("loan to value");
    return values[0].entry.term;
  });
  expect(result).toBe("LTV");
  expect(await page.evaluate(() => window.EMCPAssistant)).toBeUndefined();
  await page.locator('[data-page="assistant"]').first().click();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.EMCPAssistant)))
    .toBe(true);
  await page.locator("#assistantQuestion").fill("What is LTV?");
  await page.locator("#assistantForm button").click();
  await expect(page.locator("#assistantOutput")).toContainText("LTV");
  await expect(page.locator(".assistant-confidence")).toBeVisible();
  await expect(page.locator(".assistant-source").first()).toBeVisible();
  await expect(page.locator("#assistantOutput")).toContainText(
    /Evidence used|Kullanılan kanıtlar/,
  );
  await expect(page.locator(".assistant-source small").first()).toContainText(
    /matched|eşleşti/i,
  );
  const snapshot = await page.evaluate(() => window.EMCPOperations.snapshot());
  expect(snapshot.releaseChannel).toBe("stable");
  expect(
    Object.values(snapshot.metrics.days).some((events) => events.app_open >= 1),
  ).toBe(true);
});

test("investor handbook progress, notes, saved chapters and bilingual resume", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#navHandbooks").click();
  await expect(page.locator("#handbookChapters button")).toHaveCount(30);
  await expect(page.locator("#handbookProgress")).toContainText("0%");
  await page.locator("#handbookChapters button").first().click();
  await page.locator('[data-handbook-action="toggle-complete"]').click();
  await expect(page.locator("#handbookProgress")).toContainText("3%");
  await page.locator('[data-handbook-action="toggle-save"]').click();
  await page
    .locator("#handbookNote")
    .fill("Review this chapter before appraisal.");
  await page.locator('[data-handbook-action="save-note"]').click();
  await page.locator("#enBtn").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#handbookChapter h3")).toBeVisible();
  await page.reload();
  await page.locator('[data-page="handbooks"]').first().click();
  await page.locator('[data-handbook-action="resume"]').click();
  await expect(page.locator("#handbookProgress")).toContainText("3%");
  await expect(page.locator("#handbookNote")).toHaveValue(
    "Review this chapter before appraisal.",
  );
});

test("service worker controls a fully cached offline reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect
    .poll(async () => {
      try {
        return await page.evaluate(() => !!navigator.serviceWorker?.controller);
      } catch {
        return false;
      }
    })
    .toBe(true);
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("h1")).toContainText("EMCP Knowledge OS");
  await expect(page.locator("#connectionStatus")).toBeVisible();
  await expect(page.locator("#count")).toContainText("378");
  await page.locator('[data-page="calculators"]').last().click();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.EMCPCalculators)))
    .toBe(true);
  await page.locator("#ltvLoan").fill("70");
  await page.locator("#ltvValue").fill("100");
  await page.locator('[data-calculate="ltv"]').click();
  await expect(page.locator("#ltvResult")).toHaveText("70.00%");
  await page.locator("#navHome").click();
  await page.locator('[data-page="assistant"]').first().click();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.EMCPAssistant)))
    .toBe(true);
  await page.locator("#assistantQuestion").fill("LTV");
  await page.locator("#assistantForm button").click();
  await expect(page.locator("#assistantOutput")).toContainText("LTV");
  await page.locator("#navHandbooks").click();
  await expect(page.locator("#handbookChapters button")).toHaveCount(30);
  await context.setOffline(false);
});
