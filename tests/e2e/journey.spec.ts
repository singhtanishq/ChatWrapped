import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Full visitor journey (Part 16.5) against the production build served by
 * `astro preview`. Uses the synthetic demo for repeatable assertions and a
 * real fixture file for the import path.
 */

const FIXTURE = join(process.cwd(), "tests/fixtures/whatsapp/group-small.txt");

async function loadDemo(page: Page) {
  await page.goto("app/?demo=friends");
  await expect(page.getByRole("heading", { name: /You & Maya/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("text=Sample data").first()).toBeVisible();
}

test.describe("visitor journey", () => {
  test("landing page loads with CTAs", async ({ page }) => {
    await page.goto("");
    await expect(page.getByRole("heading", { name: /Your chats have a story/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create my ChatWrapped/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /See an example/i }).first()).toBeVisible();
    await expect(page.locator("text=processed entirely in your browser").first()).toBeVisible();
  });

  test("demo flow: dashboard, story, themes, cards", async ({ page }) => {
    await loadDemo(page);

    // Dashboard shows real demo numbers
    await expect(page.getByText(/eligible messages/i).first()).toBeVisible();
    await page.getByRole("tab", { name: /Participants/i }).click();
    await expect(page.getByRole("cell", { name: "Maya" })).toBeVisible();
    await page.getByRole("tab", { name: /Activity/i }).click();
    await expect(page.getByText(/heatmap/i)).toBeVisible();
    await page.getByRole("tab", { name: /Records/i }).click();
    await expect(page.getByText(/Participant awards|awards/i).first()).toBeVisible();

    // Story
    await page.getByRole("button", { name: /Play the story/i }).click();
    await expect(page.locator(".theme-surface")).toBeVisible({ timeout: 15_000 });
    // navigate slides via Next
    const nextBtn = page.locator(".theme-surface button", { hasText: "Next" });
    await nextBtn.click();
    await expect(page.locator(".theme-surface button", { hasText: "Prev" })).toBeEnabled();
    // switch theme
    await page.locator("button", { hasText: "Editorial" }).first().click();
    await expect(page.locator(".theme-surface")).toHaveCSS(
      "background-color",
      "rgb(250, 247, 242)",
      { timeout: 10_000 },
    );
    await page.locator("button", { hasText: "Wrapped Neon" }).first().click();

    // Cards step renders canvas
    await page.getByRole("button", { name: /Cards/i }).click();
    await expect(page.getByText(/Share Card Studio/i)).toBeVisible();
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
  });

  test("real file import end-to-end (group fixture)", async ({ page }) => {
    await page.goto("app/");
    const buffer = readFileSync(FIXTURE);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "group-small.txt", mimeType: "text/plain", buffer });
    await expect(page.getByText("group-small.txt").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("label", { hasText: "Maya" }).first()).toBeVisible();
    await expect(page.locator("label", { hasText: "Sofia" }).first()).toBeVisible();
    // Continue to dashboard
    await page.getByRole("button", { name: /Analyze/i }).click();
    await expect(page.getByRole("tab", { name: /Overview/i })).toBeVisible();
    // Anonymize toggle affects names
    await page.getByRole("button", { name: /Filters/i }).click();
    await page.getByRole("switch", { name: /Anonymize participant names/i }).click();
    await expect(page.locator("text=Participant A").first()).toBeVisible();
  });

  test("invalid file shows precise error", async ({ page }) => {
    await page.goto("app/");
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: "garbage.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("this is not a chat export at all\nno timestamps here"),
      });
    await expect(page.getByText(/Import failed|could not be recognized/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("privacy center opens and clear works", async ({ page }) => {
    await loadDemo(page);
    await page.getByRole("button", { name: "Privacy", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Privacy Center" })).toBeVisible();
    await expect(page.getByText(/Local processing/i).first()).toBeVisible();
    // Two-step confirm: arm, then confirm.
    await page.getByRole("button", { name: /Clear all parsed data/i }).click();
    await page.getByRole("button", { name: /Really clear everything/i }).click();
    await expect(page.getByRole("heading", { name: /Import your conversation/i })).toBeVisible();
    await expect(page.getByText(/Conversations in this session/)).not.toBeVisible();
  });

  test("keyboard navigation works in story", async ({ page }) => {
    await page.goto("app/?demo=friends#/stories");
    await expect(page.locator(".theme-surface")).toBeVisible({ timeout: 30_000 });
    const counterBefore = await page.locator(".theme-surface span.tabular-nums").textContent();
    await page.keyboard.press("ArrowRight");
    const counterAfter = await page.locator(".theme-surface span.tabular-nums").textContent();
    expect(counterBefore).not.toBe(counterAfter);
  });
});
