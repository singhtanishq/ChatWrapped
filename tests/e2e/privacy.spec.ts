import { expect, test } from "@playwright/test";

/**
 * Privacy network audit (Part 13.3).
 *
 * During import, parsing, analytics, story generation and export, verify
 * that no request carries conversation content and everything stays
 * same-origin. ChatWrapped makes zero third-party requests.
 */

test("no non-static network activity during the full demo workflow", async ({ page }) => {
  const requests: Array<{ url: URL; body: string | null }> = [];

  page.on("request", (req) => {
    let body: string | null = null;
    try {
      body = req.postData() ?? null;
    } catch {
      body = null;
    }
    requests.push({ url: new URL(req.url()), body });
  });

  await page.goto("app/?demo=friends");
  await expect(page.getByRole("heading", { name: /You & Maya/i })).toBeVisible({ timeout: 30_000 });

  // Walk through story and cards to force all pipelines to run.
  await page.getByRole("button", { name: "Go to Story" }).click();
  await expect(page.locator(".theme-surface")).toBeVisible();
  await page.getByRole("button", { name: "Go to Cards" }).click();
  await expect(page.getByText(/Share Card Studio/i)).toBeVisible();
  await page.waitForTimeout(800);

  const origins = new Set(requests.map((r) => r.url.origin));
  const host = new URL(page.url()).origin;
  origins.delete(host);
  expect([...origins], "every request must be same-origin (no analytics, no CDNs)").toEqual([]);

  // No request may contain any synthetic message text.
  const forbidden = [
    "watch the finale",
    "coziest coffee shop",
    "ramen place opened",
    "Messages and calls are end-to-end encrypted.",
  ];
  for (const r of requests) {
    for (const needle of forbidden) {
      expect(r.url.href).not.toContain(encodeURIComponent(needle));
      expect(r.url.href).not.toContain(needle);
      if (r.body)
        expect(r.body, `POST body to ${r.url.href} must not contain chat text`).not.toContain(
          needle,
        );
    }
  }

  // Only static asset kinds should be fetched.
  const allowed =
    /\.(js|css|woff2?|svg|png|webmanifest|json|txt|ico)$|\/(ChatWrapped\/)?$|sw\.js$|sitemap/i;
  const suspicious = requests.filter((r) => !allowed.test(r.url.pathname));
  expect(
    suspicious.map((s) => s.url.pathname),
    "only static assets may be requested",
  ).toEqual([]);

  // No websockets / beacons were used.
  const ws = requests.filter((r) => r.url.protocol === "ws:" || r.url.protocol === "wss:");
  expect(ws).toHaveLength(0);
});

test("service worker registers for offline support", async ({ page }) => {
  await page.goto("app/");
  await expect(page.getByRole("heading", { name: /Import your conversation/i })).toBeVisible();
  await page.waitForFunction(
    () =>
      navigator.serviceWorker?.controller !== null ||
      navigator.serviceWorker?.ready.then(() => true),
    undefined,
    {
      timeout: 15_000,
    },
  );
  const registered = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length > 0;
  });
  expect(registered, "a service worker should be registered").toBe(true);
});
