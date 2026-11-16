/**
 * Export helpers: PNG download, native share and ZIP bundling.
 */

import JSZip from "jszip";
import { cardFileName, renderCardPng, type CardRenderOptions } from "./cardRenderer";
import type { StorySlide } from "../stories/generate";

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Native device sharing with graceful fallback to download. */
export async function shareCard(options: CardRenderOptions): Promise<"shared" | "downloaded"> {
  const blob = await renderCardPng(options);
  const fileName = cardFileName(options.slide, options.theme, options.size);
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const file = new File([blob], fileName, { type: "image/png" });
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: "ChatWrapped",
        text: options.caption ?? "My ChatWrapped recap",
      });
      return "shared";
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}

export interface ZipProgress {
  done: number;
  total: number;
}

/** Bundle one PNG per slide into a ZIP and download it. */
export async function exportZip(
  slides: StorySlide[],
  buildOptions: (slide: StorySlide) => CardRenderOptions,
  onProgress?: (p: ZipProgress) => void,
): Promise<{ fileName: string; count: number }> {
  const zip = new JSZip();
  const theme = buildOptions(slides[0]!).theme;
  const usedNames = new Set<string>();
  let done = 0;
  for (const slide of slides) {
    const options = buildOptions(slide);
    let name = cardFileName(slide, options.theme, options.size);
    let n = 2;
    while (usedNames.has(name))
      name = cardFileName(slide, options.theme, options.size).replace(/\.png$/, `-${n++}.png`);
    usedNames.add(name);
    const blob = await renderCardPng(options);
    zip.file(name, blob);
    done++;
    onProgress?.({ done, total: slides.length });
  }
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `chatwrapped-${theme.id}-recap-${dateStamp}.zip`;
  const content = await zip.generateAsync({ type: "blob", compression: "STORE" });
  downloadBlob(content, fileName);
  return { fileName, count: slides.length };
}
