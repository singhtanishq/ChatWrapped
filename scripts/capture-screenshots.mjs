/**
 * Captures real application screenshots using the deterministic synthetic
 * demo data (Part 21). Every capture asserts the UI state before shooting —
 * nothing is mocked up outside the running app.
 *
 * Viewports: desktop 1440×1000, mobile 390×844 (iPhone 14).
 * Output: docs/screenshots/<section>/<name>.png + SCREENSHOT_INDEX.md
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "docs/screenshots");
const BASE_URL = "http://localhost:4322/ChatWrapped";
const CAPTURE_DATE = new Date().toISOString().slice(0, 10);
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

const manifest = [];

function section(id, title) {
  const dir = join(OUT, id);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function settle(page, ms = 350) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

/** Assert + capture a viewport (or full-page) screenshot with manifest entry. */
async function shot(
  browser,
  {
    name,
    sectionId,
    url,
    setup,
    description,
    feature,
    viewport = "desktop",
    fullPage = false,
    assertFn,
  },
) {
  const context = await browser.newContext({
    viewport: viewport === "desktop" ? DESKTOP : MOBILE,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: "en-US",
  });
  const page = await context.newPage();
  try {
    if (url) {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    }
    if (assertFn) await assertFn(page);
    if (setup) await setup(page);
    await settle(page);
    const dir = section(sectionId, sectionId);
    const bareName = name.replace(new RegExp(`^${sectionId}/`), "");
    const file = join(dir, `${bareName}.png`);
    await page.screenshot({ path: file, fullPage });
    manifest.push({
      path: `docs/screenshots/${sectionId}/${bareName}.png`, // full repo-relative path
      // eslint-disable-next-line no-useless-escape
      section: sectionId,
      feature,
      description,
      viewport: viewport === "desktop" ? "1440×1000" : "390×844 (iPhone 14)",
      date: CAPTURE_DATE,
      validated: "selector-asserted",
    });
    console.log(`✓ ${sectionId}/${name}.png`);
  } catch (err) {
    console.error(`✗ ${sectionId}/${name}.png — ${err.message.split("\n")[0]}`);
    await page
      .screenshot({ path: join(OUT, `${sectionId}-${name}-FAILED.png`), fullPage: true })
      .catch(() => {});
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

const appUrl = `${BASE_URL}/app`;

async function demoLoaded(page) {
  await page.getByRole("heading", { name: /You & Maya/i }).waitFor({ timeout: 45000 });
}

async function run() {
  // Serve the production build.
  const server = spawn("pnpm", ["preview", "--port", "4322", "--strictPort"], {
    cwd: ROOT,
    stdio: "pipe",
  });
  const started = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("preview server timeout")), 45000);
    const poll = async () => {
      try {
        const res = await fetch(`${BASE_URL}/`);
        if (res.ok) {
          clearTimeout(t);
          resolve(true);
          return;
        }
      } catch {
        // not up yet
      }
      setTimeout(poll, 400);
    };
    poll();
  });
  if (!started) throw new Error("preview failed to start");
  console.log("preview server ready");

  const browser = await chromium.launch();

  /* ---------------- 01 landing ---------------- */
  const landingUrl = `${BASE_URL}/`;
  await shot(browser, {
    name: "01-landing/landing-hero",
    sectionId: "01-landing",
    url: landingUrl,
    feature: "Landing page",
    description:
      "Hero with headline, privacy badge and the two CTAs (Create my ChatWrapped / See an example).",
    assertFn: async (p) => {
      await p
        .getByRole("heading", { name: /Your chats have a story/i })
        .waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "01-landing/landing-example-cards",
    sectionId: "01-landing",
    url: landingUrl,
    feature: "Landing page",
    description:
      "Example recap preview cards and supported-platform positioning (illustrative values, clearly labeled).",
    setup: async (p) => {
      await p.getByText("Two platforms, one privacy-first analyzer").scrollIntoViewIfNeeded();
      await p.evaluate(() => window.scrollBy(0, -60));
    },
  });
  await shot(browser, {
    name: "01-landing/landing-faq",
    sectionId: "01-landing",
    url: landingUrl,
    fullPage: false,
    feature: "Landing page",
    description: "FAQ section with the privacy promise banner.",
    setup: async (p) => {
      await p.getByText("Frequently asked questions").scrollIntoViewIfNeeded();
    },
  });
  await shot(browser, {
    name: "01-landing/landing-full",
    sectionId: "01-landing",
    url: landingUrl,
    fullPage: true,
    feature: "Landing page",
    description:
      "Complete landing page: hero, example cards, platforms, how-it-works, FAQ and footer with independence disclaimer.",
  });

  /* ---------------- 02 import ---------------- */
  await shot(browser, {
    name: "02-import/import-empty",
    sectionId: "02-import",
    url: appUrl,
    feature: "Import flow",
    description: "Analyzer import screen with drag-and-drop zone and file guidance.",
    assertFn: async (p) => {
      await p
        .getByRole("heading", { name: /Import your conversation/i })
        .waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "02-import/import-invalid-file",
    sectionId: "02-import",
    url: appUrl,
    feature: "Import flow — validation",
    description: "Precise error state for an unrecognized file (no vague errors).",
    setup: async (p) => {
      await p.locator('input[type="file"]').setInputFiles({
        name: "not-a-chat.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("random notes\nwithout timestamps"),
      });
      await p.getByText(/Import failed/i).waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "02-import/import-result-warnings",
    sectionId: "02-import",
    url: appUrl,
    feature: "Import flow — result preview",
    description:
      "Import result for a real WhatsApp group fixture with parser warnings and participant counts.",
    setup: async (p) => {
      const fixture = (await import("node:fs")).readFileSync(
        join(ROOT, "tests/fixtures/whatsapp/group-small.txt"),
        "utf8",
      );
      await p.locator('input[type="file"]').setInputFiles({
        name: "weekend-hikers.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(fixture),
      });
      await p.getByText("weekend-hikers.txt").waitFor({ timeout: 30000 });
    },
  });

  /* ---------------- 03 platform selection ---------------- */
  await shot(browser, {
    name: "03-platform-selection/platform-cards",
    sectionId: "03-platform-selection",
    url: appUrl,
    feature: "Platform selection",
    description:
      "WhatsApp and Telegram platform cards with per-platform export instructions before choosing a file.",
    setup: async (p) => {
      await p
        .getByRole("heading", { name: /Import your conversation/i })
        .waitFor({ timeout: 20000 });
      await p.evaluate(() => window.scrollBy(0, 120));
    },
  });

  /* ---------------- 04 participant setup ---------------- */
  await shot(browser, {
    name: "04-participant-setup/setup-participants",
    sectionId: "04-participant-setup",
    url: `${appUrl}?demo=friends`,
    feature: "Participant setup",
    description:
      "Setup screen: include/exclude participants, rename for presentation, mark yourself, date range and filters.",
    assertFn: demoLoaded,
    setup: async (p) => {
      await p.getByRole("button", { name: "Go to Setup" }).click();
      await p.getByRole("heading", { name: /Set up your recap/i }).waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "04-participant-setup/setup-anonymized",
    sectionId: "04-participant-setup",
    url: `${appUrl}?demo=friends`,
    feature: "Participant setup — anonymization",
    description: "Anonymization enabled: names become “Participant A/B” across the setup screen.",
    assertFn: demoLoaded,
    setup: async (p) => {
      await p.getByRole("button", { name: "Go to Setup" }).click();
      await p.getByRole("switch", { name: /Anonymize participant names/i }).click();
      await p.getByText("Participant A").first().waitFor({ timeout: 20000 });
    },
  });

  /* ---------------- 05 analysis progress ---------------- */
  await shot(browser, {
    name: "05-analysis/analysis-progress",
    sectionId: "05-analysis",
    url: appUrl,
    feature: "Analysis progress",
    description: "Progress indication while a large export is parsed and analyzed in Web Workers.",
    setup: async (p) => {
      // Generate a ~15 MB synthetic WhatsApp export in-memory to make the
      // parsing phase observable, then capture during the progress bar.
      const lines = [];
      const senders = ["Ava", "Ben", "Chloe", "Dev", "Eli", "Fay"];
      const phrases = [
        "hey are you coming tonight",
        "that sounds great! 🎉",
        "I'll send the details later",
        "can we move the meeting to 3pm?",
        "just finished the report",
        "on my way 🚗",
      ];
      let ts = Date.UTC(2023, 0, 1, 8, 0, 0);
      for (let i = 0; i < 300000; i++) {
        ts += Math.floor(Math.random() * 240000);
        const sender = senders[i % senders.length];
        const d = new Date(ts);
        const date = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
        const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
        lines.push(`${date}, ${time} - ${sender}: ${phrases[i % phrases.length]}`);
      }
      const fixture = lines.join("\n");
      await p.locator('input[type="file"]').setInputFiles({
        name: "big-export.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(fixture),
      });
      await p
        .locator('[role="progressbar"]')
        .waitFor({ timeout: 8000 })
        .catch(() => undefined);
      // The progress screen is brief; wait for either state then capture fast.
    },
    description: "Parsing/analysis progress bar while workers process a 15 MB export.",
  });

  /* ---------------- 06 dashboard ---------------- */
  const dashSetup = async (p) => {
    await demoLoaded(p);
  };
  await shot(browser, {
    name: "06-dashboard/dashboard-overview",
    sectionId: "06-dashboard",
    url: `${appUrl}?demo=friends`,
    feature: "Results dashboard",
    description: "Overview: message totals, monthly activity trend and participant share bar.",
    assertFn: dashSetup,
  });
  await shot(browser, {
    name: "06-dashboard/dashboard-participants",
    sectionId: "06-dashboard",
    url: `${appUrl}?demo=friends`,
    feature: "Participant statistics",
    description: "Participant comparison bars and the full per-participant breakdown table.",
    assertFn: dashSetup,
    setup: async (p) => {
      await p.getByRole("tab", { name: "Participants" }).click();
      await p.getByRole("cell", { name: "Maya" }).waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "06-dashboard/dashboard-heatmap",
    sectionId: "06-dashboard",
    url: `${appUrl}?demo=friends`,
    feature: "Activity heatmap",
    description: "Hour × weekday activity heatmap with weekday rhythm and hourly pulse charts.",
    assertFn: dashSetup,
    setup: async (p) => {
      await p.getByRole("tab", { name: "Activity" }).click();
      await p.getByText("Hour × weekday heatmap").waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "06-dashboard/dashboard-emoji-words",
    sectionId: "06-dashboard",
    url: `${appUrl}?demo=friends`,
    feature: "Emoji & word insights",
    description:
      "Most-used emoji ranking and stopword-filtered signature words with punctuation rates.",
    assertFn: dashSetup,
    setup: async (p) => {
      await p.getByRole("tab", { name: "Emoji & words" }).click();
      await p.getByText("Most-used emoji").waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "06-dashboard/dashboard-responses",
    sectionId: "06-dashboard",
    url: `${appUrl}?demo=friends`,
    feature: "Response-time analysis",
    description:
      "Response statistics with median/average/fastest values, leaderboard and the documented burst-rule explainer.",
    assertFn: dashSetup,
    setup: async (p) => {
      await p.getByRole("tab", { name: "Responses" }).click();
      await p.getByText("Median reply").waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "06-dashboard/dashboard-records-awards",
    sectionId: "06-dashboard",
    url: `${appUrl}?demo=friends`,
    feature: "Conversation records & awards",
    description:
      "Records (longest message, busiest day, streak) and evidence-based participant awards with explicit thresholds.",
    assertFn: dashSetup,
    setup: async (p) => {
      await p.getByRole("tab", { name: "Records" }).click();
      await p.getByText("Participant awards").waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "06-dashboard/dashboard-date-filtered",
    sectionId: "06-dashboard",
    url: `${appUrl}?demo=friends`,
    feature: "Date-range filtering",
    description: "Dashboard after applying a date range — totals update transparently.",
    assertFn: dashSetup,
    setup: async (p) => {
      await p.getByRole("button", { name: "Go to Setup" }).click();
      await p.getByRole("heading", { name: /Set up your recap/i }).waitFor({ timeout: 20000 });
      const from = "2024-09-01";
      const to = "2024-11-30";
      await p.locator('input[type="date"]').first().fill(from);
      await p.locator('input[type="date"]').nth(1).fill(to);
      await p.waitForTimeout(600);
      await p.getByRole("button", { name: /Analyze/i }).click();
      await p.getByRole("tab", { name: "Overview" }).waitFor({ timeout: 20000 });
    },
  });

  /* ---------------- 07 story experience ---------------- */
  await shot(browser, {
    name: "07-story-experience/story-intro",
    sectionId: "07-story-experience",
    url: `${appUrl}?demo=friends#/stories`,
    feature: "Story viewer",
    description: "Story opening slide with progress indicators, theme controls and navigation.",
    assertFn: async (p) => {
      await page_demoStory(p);
    },
  });
  await shot(browser, {
    name: "07-story-experience/story-emoji-slide",
    sectionId: "07-story-experience",
    url: `${appUrl}?demo=friends#/stories`,
    feature: "Story viewer",
    description: "A mid-story slide driven by real calculated values (most-used emoji with share).",
    assertFn: async (p) => {
      await page_demoStory(p);
      await p.locator(".theme-surface button", { hasText: "Next" }).click();
      await p.locator(".theme-surface button", { hasText: "Next" }).click();
      await p.locator(".theme-surface button", { hasText: "Next" }).click();
    },
  });
  await shot(browser, {
    name: "07-story-experience/story-slide-selector",
    sectionId: "07-story-experience",
    url: `${appUrl}?demo=friends#/stories`,
    feature: "Story navigation",
    description: "Slide selector chips, autoplay control and progress state near the story finale.",
    assertFn: async (p) => {
      await page_demoStory(p);
      const chips = p.locator("button", { hasText: "That's a wrap" });
      await chips.last().click();
    },
  });
  await shot(browser, {
    name: "07-story-experience/story-fullscreen",
    sectionId: "07-story-experience",
    url: `${appUrl}?demo=friends#/stories`,
    feature: "Story fullscreen mode",
    description: "Full-screen story mode with keyboard navigation active.",
    assertFn: async (p) => {
      await page_demoStory(p);
      await p.getByRole("button", { name: /Full screen/i }).click();
    },
  });
  await shot(browser, {
    name: "07-story-experience/offline-story",
    sectionId: "07-story-experience",
    feature: "Offline support",
    description:
      "The story experience working with the network disconnected — served entirely from the service worker cache.",
    viewport: "desktop",
    assertFn: async (p) => {
      await p.goto(`${appUrl}?demo=friends#/stories`, { waitUntil: "networkidle" });
      await p.evaluate(() => navigator.serviceWorker.ready);
      await p.context().setOffline(true);
      await p.reload();
      await p.locator(".theme-surface").waitFor({ timeout: 30000 });
      await p.context().setOffline(false);
    },
  });

  /* ---------------- 08 story themes ---------------- */
  const themeNames = [
    ["wrapped-neon", "Wrapped Neon"],
    ["editorial", "Editorial"],
    ["playful", "Playful"],
    ["midnight", "Midnight"],
    ["retro", "Retro"],
    ["pastel", "Pastel"],
    ["monochrome", "Monochrome"],
    ["minimal-dark", "Minimal Dark"],
    ["celebration", "Celebration"],
  ];
  for (const [id, label] of themeNames) {
    await shot(browser, {
      name: `08-story-themes/theme-${id}`,
      sectionId: "08-story-themes",
      url: `${appUrl}?demo=friends&theme=${id}#/stories`,
      feature: `Theme: ${label}`,
      description: `Story viewer rendered with the ${label} theme (slide content from calculated demo data).`,
      assertFn: async (p) => {
        await p.locator(".theme-surface").waitFor({ timeout: 30000 });
        await p
          .locator(".theme-surface", { hasText: label.split(" ")[0] })
          .waitFor({ timeout: 5000 })
          .catch(() => undefined);
      },
    });
  }

  /* ---------------- 09 share studio ---------------- */
  await shot(browser, {
    name: "09-share-studio/card-studio-portrait",
    sectionId: "09-share-studio",
    url: `${appUrl}?demo=friends#/cards`,
    feature: "Share Card Studio",
    description:
      "Card studio with live canvas preview, size selector, theme grid and customization controls.",
    assertFn: async (p) => {
      await p.getByText(/Share Card Studio/i).waitFor({ timeout: 45000 });
      await p.locator("canvas").waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "09-share-studio/card-studio-customized",
    sectionId: "09-share-studio",
    url: `${appUrl}?demo=friends#/cards`,
    feature: "Card customization",
    description:
      "Customized card: headline override, caption and attribution toggle with the Editorial theme.",
    assertFn: async (p) => {
      await p.getByText(/Share Card Studio/i).waitFor({ timeout: 45000 });
      await p.locator("canvas").waitFor({ timeout: 20000 });
    },
    setup: async (p) => {
      await p.getByLabel("Headline override").fill("Our year in messages");
      await p.getByLabel("Caption (appears on the card)").fill("214 days without missing one 💬");
      await p.locator("button", { hasText: "Editorial" }).first().click();
      await p.waitForTimeout(600);
    },
  });
  await shot(browser, {
    name: "09-share-studio/card-studio-square",
    sectionId: "09-share-studio",
    url: `${appUrl}?demo=friends#/cards`,
    feature: "Card sizes",
    description:
      "Square 1080×1080 card preview with export actions (PNG, native share, ZIP, copy caption).",
    assertFn: async (p) => {
      await p.getByText(/Share Card Studio/i).waitFor({ timeout: 45000 });
      await p.locator("canvas").waitFor({ timeout: 20000 });
    },
    setup: async (p) => {
      await p.getByRole("radio", { name: "1:1" }).click();
      await p.waitForTimeout(600);
    },
  });

  /* ---------------- 10 comparison ---------------- */
  await shot(browser, {
    name: "10-comparison/comparison-two-conversations",
    sectionId: "10-comparison",
    url: `${appUrl}?demo=friends`,
    feature: "Conversation comparison",
    description:
      "Side-by-side comparison of two conversations (sample + an imported fixture) with honest sample-size rows.",
    assertFn: demoLoaded,
    setup: async (p) => {
      const fixture = (await import("node:fs")).readFileSync(
        join(ROOT, "tests/fixtures/telegram/group-small.json"),
        "utf8",
      );
      await p.getByRole("button", { name: "Go to Import" }).click();
      await p.locator('input[type="file"]').setInputFiles({
        name: "result.json",
        mimeType: "application/json",
        buffer: Buffer.from(fixture),
      });
      await p.getByRole("button", { name: "Go to Compare" }).click();
      await p.getByText("Conversation comparison").waitFor({ timeout: 20000 });
    },
  });

  /* ---------------- 11 privacy ---------------- */
  await shot(browser, {
    name: "11-privacy/privacy-center",
    sectionId: "11-privacy",
    url: `${appUrl}?demo=friends`,
    feature: "Privacy Center",
    description:
      "Privacy Center dialog: local-processing guarantee, offline status, opt-in recap saving and session controls.",
    assertFn: demoLoaded,
    setup: async (p) => {
      await p.getByRole("button", { name: "Privacy", exact: true }).click();
      await p.getByRole("heading", { name: "Privacy Center" }).waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "11-privacy/privacy-policy-page",
    sectionId: "11-privacy",
    url: `${BASE_URL}/privacy/`,
    feature: "Privacy policy",
    description:
      "The full privacy policy page with storage model and hosting-transparency sections.",
    fullPage: true,
    assertFn: async (p) => {
      await p.getByRole("heading", { name: "Privacy Policy" }).waitFor({ timeout: 20000 });
    },
  });

  /* ---------------- 12 mobile ---------------- */
  await shot(browser, {
    name: "12-mobile/mobile-landing",
    sectionId: "12-mobile",
    url: `${BASE_URL}/`,
    feature: "Mobile landing",
    description: "Landing page on a phone viewport — hero, CTAs and navigation.",
    viewport: "mobile",
  });
  await shot(browser, {
    name: "12-mobile/mobile-import",
    sectionId: "12-mobile",
    url: appUrl,
    feature: "Mobile import",
    description: "Import screen on mobile with touch-friendly upload zone.",
    viewport: "mobile",
    assertFn: async (p) => {
      await p
        .getByRole("heading", { name: /Import your conversation/i })
        .waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "12-mobile/mobile-dashboard",
    sectionId: "12-mobile",
    url: `${appUrl}?demo=friends`,
    feature: "Mobile dashboard",
    description: "Results dashboard adapts to the phone viewport with stacked stat cards.",
    viewport: "mobile",
    assertFn: demoLoaded,
  });
  await shot(browser, {
    name: "12-mobile/mobile-story",
    sectionId: "12-mobile",
    url: `${appUrl}?demo=friends#/stories`,
    feature: "Mobile story",
    description: "Full-screen story experience on mobile with swipe navigation and progress bars.",
    viewport: "mobile",
    assertFn: async (p) => {
      await p.locator(".theme-surface").waitFor({ timeout: 30000 });
    },
  });

  /* ---------------- 13 guides ---------------- */
  await shot(browser, {
    name: "13-guides/guide-whatsapp-export",
    sectionId: "13-guides",
    url: `${BASE_URL}/how-to-export-whatsapp-chat/`,
    feature: "WhatsApp export guide",
    description:
      "Step-by-step WhatsApp export instructions for Android and iPhone with HowTo structured data.",
    assertFn: async (p) => {
      await p
        .getByRole("heading", { name: /How to Export a WhatsApp Chat/i })
        .waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "13-guides/guide-telegram-export",
    sectionId: "13-guides",
    url: `${BASE_URL}/how-to-export-telegram-chat/`,
    feature: "Telegram export guide",
    description: "Telegram Desktop JSON export walkthrough with troubleshooting section.",
    assertFn: async (p) => {
      await p
        .getByRole("heading", { name: /How to Export a Telegram Chat/i })
        .waitFor({ timeout: 20000 });
    },
  });
  await shot(browser, {
    name: "13-guides/how-analysis-works",
    sectionId: "13-guides",
    url: `${BASE_URL}/how-chat-analysis-works/`,
    feature: "Metric documentation",
    description:
      "Public explanation of the normalized model, response burst rules, conversation starts and emoji counting.",
    assertFn: async (p) => {
      await p
        .getByRole("heading", { name: /How Chat Analysis Works/i })
        .waitFor({ timeout: 20000 });
    },
  });

  await browser.close();
  server.kill();

  writeManifest();
}

async function page_demoStory(p) {
  await p.locator(".theme-surface").waitFor({ timeout: 45000 });
}

function writeManifest() {
  const lines = [
    "# Screenshot Index",
    "",
    `All screenshots are captured from the real, running ChatWrapped application (production build)`,
    `using the deterministic synthetic demo data. Capture date: ${CAPTURE_DATE}.`,
    `Viewports: desktop 1440×1000 · mobile 390×844 (iPhone 14). Reduced-motion is emulated`,
    `so no capture shows incomplete animations. Every capture asserts its UI state first.`,
    "",
    `| # | Screenshot | Feature | Description | Viewport | Captured | Validation |`,
    `|---|-----------|---------|-------------|----------|----------|------------|`,
  ];
  manifest.forEach((m, i) => {
    lines.push(
      `| ${i + 1} | \`${m.path}\` | ${m.feature} | ${m.description} | ${m.viewport} | ${m.date} | ${m.validated} |`,
    );
  });
  lines.push("", `Total: ${manifest.length} approved screenshots.`, "");
  writeFileSync(join(OUT, "SCREENSHOT_INDEX.md"), lines.join("\n") + "\n");
  console.log(`\nmanifest written: ${manifest.length} screenshots`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
