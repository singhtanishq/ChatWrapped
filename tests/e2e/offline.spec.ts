import { expect, test } from "@playwright/test";

/**
 * Offline workflow test (Part 14): after the app is cached, the full
 * core workflow — demo load, analytics, story, PNG download — must work
 * with the network disconnected.
 */

test("core workflow works offline after first visit", async ({ page, context }) => {
  // 1. Load online and let the service worker cache everything.
  await page.goto("app/?demo=friends");
  await expect(page.getByRole("heading", { name: /You & Maya/i })).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, {
    timeout: 15_000,
  });
  // Touch the heavy routes online once so their chunks are cached.
  await page.getByRole("button", { name: "Go to Story" }).click();
  await expect(page.locator(".theme-surface")).toBeVisible();
  await page.getByRole("button", { name: "Go to Cards" }).click();
  await expect(page.getByText(/Share Card Studio/i)).toBeVisible();
  await page.waitForTimeout(1500);

  // 2. Go fully offline.
  await context.setOffline(true);
  try {
    // 3. Reload the app from cache — the hash restores the cards step and the
    //    demo deep-link regenerates data locally, proving full offline hydration.
    await page.reload();
    await expect(
      page
        .getByRole("heading", { name: /Share Card Studio|Import your conversation|You & Maya/i })
        .first(),
    ).toBeVisible({ timeout: 20_000 });

    // 4. Run the workflow offline (session state survives? No — reload clears
    //    memory; the demo regenerates locally without network).
    await page.goto("app/?demo=friends");
    await expect(page.getByRole("heading", { name: /You & Maya/i }).first()).toBeVisible({
      timeout: 30_000,
    });

    // 5. Story works offline.
    await page.getByRole("button", { name: "Go to Story" }).click();
    await expect(page.locator(".theme-surface").first()).toBeVisible({ timeout: 20_000 });

    // 6. Card PNG generation + download works offline.
    await page.getByRole("button", { name: "Go to Cards" }).click();
    await expect(page.getByText(/Share Card Studio/i)).toBeVisible();
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("button", { name: /Download this card/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/chatwrapped-.*\.png$/);
  } finally {
    await context.setOffline(false);
  }
});
