/// <reference lib="webworker" />
/**
 * Analytics worker: computes statistics off the main thread.
 */

import { computeAnalytics } from "@/features/analytics";
import type { WorkerRequest } from "./protocol";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (req.kind !== "analyze") return;
  try {
    self.postMessage({ kind: "progress", requestId: req.requestId, phase: "analyzing", pct: 30 });
    const result = computeAnalytics(req.conversation, req.options);
    self.postMessage({ kind: "progress", requestId: req.requestId, phase: "analyzing", pct: 90 });
    self.postMessage({ kind: "analyze", requestId: req.requestId, result });
  } catch (err) {
    self.postMessage({
      kind: "analyze",
      requestId: req.requestId,
      error: {
        message: err instanceof Error ? err.message : "Unknown analytics error",
        code: "analytics-error",
      },
    });
  }
};

void computeAnalytics;
