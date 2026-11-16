/// <reference lib="webworker" />
/**
 * Parser worker: runs WhatsApp/Telegram parsing off the main thread.
 * Analytics runs in its own worker so both can report progress separately.
 */

import { parseConversation } from "@/features/parsers/detect";
import { ParseError } from "@/features/types";
import type { WorkerRequest } from "./protocol";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (req.kind !== "parse") return;
  try {
    // Parsing is fast per file; progress is reported at phase boundaries.
    self.postMessage({ kind: "progress", requestId: req.requestId, phase: "parsing", pct: 20 });
    const result = parseConversation(req.content, req.format, req.options);
    self.postMessage({ kind: "progress", requestId: req.requestId, phase: "parsing", pct: 90 });
    self.postMessage({ kind: "parse", requestId: req.requestId, result });
  } catch (err) {
    const code = err instanceof ParseError ? err.code : "unknown";
    self.postMessage({
      kind: "parse",
      requestId: req.requestId,
      error: { message: err instanceof Error ? err.message : "Unknown parsing error", code },
    });
  }
};
