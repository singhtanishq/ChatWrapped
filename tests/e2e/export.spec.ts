import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Export tests (Part 16.4): exact image dimensions, PNG validity,
 * ZIP integrity and card counts — verified from the real downloads.
 */

function pngSize(buffer: Buffer): { width: number; height: number } {
  // PNG signature (8 bytes) + IHDR chunk: length(4) type(4) width(4) height(4)
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("single card download is a valid PNG with exact dimensions", async ({ page }) => {
  await page.goto("app/?demo=friends#/cards");
  await expect(page.getByText(/Share Card Studio/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas").first()).toBeVisible();

  // Default size is portrait 1080x1350.
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByRole("button", { name: /Download this card/i }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const buffer = readFileSync(join(path!));
  const { width, height } = pngSize(buffer);
  expect(width).toBe(1080);
  expect(height).toBe(1350);
  expect(download.suggestedFilename()).toMatch(/^chatwrapped-wrapped-neon-portrait-.*\.png$/);

  // Switch to story size and verify again.
  await page.getByRole("radio", { name: "9:16" }).first().click();
  const dl2 = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByRole("button", { name: /Download this card/i }).click();
  const d2 = await dl2;
  const { width: w2, height: h2 } = pngSize(readFileSync(join(await d2.path()!)));
  expect(w2).toBe(1080);
  expect(h2).toBe(1920);
});

test("ZIP export bundles one PNG per slide", async ({ page }) => {
  await page.goto("app/?demo=friends#/cards");
  await expect(page.getByText(/Share Card Studio/i)).toBeVisible({ timeout: 30_000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  await page.getByRole("button", { name: /Export all .* cards as ZIP/i }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const buffer = readFileSync(join(path!));

  // ZIP local file header signature: PK\x03\x04
  expect(buffer.subarray(0, 4).toString("ascii")).toBe("PK\x03\x04");
  expect(download.suggestedFilename()).toMatch(/^chatwrapped-.*-recap-\d{4}-\d{2}-\d{2}\.zip$/);

  // ZIP central directory: locate the EOCD record, then count PNG entries.
  // (Local headers may use data descriptors, so scanning them is unreliable.)
  const eocdSig = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 66_000; i--) {
    if (buffer.readUInt32LE(i) === eocdSig) {
      eocd = i;
      break;
    }
  }
  expect(eocd, "end-of-central-directory record must exist").toBeGreaterThanOrEqual(0);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  expect(entryCount, "one PNG card per slide").toBeGreaterThanOrEqual(8);
  expect(entryCount).toBeLessThanOrEqual(20);

  const cdOffset = buffer.readUInt32LE(eocd + 16);
  let off = cdOffset;
  const names: string[] = [];
  for (let i = 0; i < entryCount; i++) {
    expect(buffer.readUInt32LE(off), "central directory signature").toBe(0x02014b50);
    const nameLen = buffer.readUInt16LE(off + 28);
    const extraLen = buffer.readUInt16LE(off + 30);
    const commentLen = buffer.readUInt16LE(off + 32);
    names.push(buffer.subarray(off + 46, off + 46 + nameLen).toString("ascii"));
    off += 46 + nameLen + extraLen + commentLen;
  }
  expect(names.every((n) => /^chatwrapped-.*\.png$/.test(n))).toBe(true);
  expect(new Set(names).size, "no duplicate card names").toBe(names.length);
});
