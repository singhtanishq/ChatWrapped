/**
 * Typed worker client with request tracking, progress events and
 * lazy worker creation. One worker instance per kind, reused across calls.
 */

import type { AnalyticsOptions, AnalyticsResult } from "@/features/analytics/types";
import type { ParsedConversation, ParseOptions, ParseResult } from "@/features/types";
import type { DetectedFormat } from "@/features/parsers/detect";
import type { WorkerRequest, WorkerResponse } from "@/workers/protocol";

export interface JobEvents {
  onProgress?: (pct: number, phase: string) => void;
}

class WorkerClient {
  private workers: Partial<Record<"parser" | "analytics", Worker>> = {};
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (v: never) => void;
      reject: (e: Error) => void;
      onProgress?: JobEvents["onProgress"];
    }
  >();

  private ensure(kind: "parser" | "analytics"): Worker {
    const existing = this.workers[kind];
    if (existing) return existing;
    // Static URL literals per branch so the bundler can emit worker chunks
    // (dynamic expressions inside new URL() are not statically analyzable).
    const worker =
      kind === "parser"
        ? new Worker(new URL("../workers/parser.worker.ts", import.meta.url), {
            type: "module",
            name: "chatwrapped-parser",
          })
        : new Worker(new URL("../workers/analytics.worker.ts", import.meta.url), {
            type: "module",
            name: "chatwrapped-analytics",
          });
    this.workers[kind] = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.kind === "progress") {
        this.pending.get(msg.requestId)?.onProgress?.(msg.pct, msg.phase);
        return;
      }
      const entry = this.pending.get(msg.requestId);
      if (!entry) return;
      this.pending.delete(msg.requestId);
      if (msg.error) entry.reject(new Error(msg.error.message));
      else entry.resolve(msg.result as never);
    };
    worker.onerror = (event) => {
      // Fail all pending jobs if the worker itself crashes.
      const err = new Error(event.message || "Worker crashed");
      for (const [, entry] of this.pending) entry.reject(err);
      this.pending.clear();
      delete this.workers[kind];
    };
    return worker;
  }

  private post<T>(
    kind: "parser" | "analytics",
    request: Omit<WorkerRequest, "requestId">,
    events?: JobEvents,
  ): Promise<T> {
    const worker = this.ensure(kind);
    const requestId = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: resolve as never,
        reject,
        onProgress: events?.onProgress,
      });
      worker.postMessage({ ...request, requestId } as WorkerRequest);
    });
  }

  parse(
    content: string,
    format: DetectedFormat,
    options?: ParseOptions,
    events?: JobEvents,
  ): Promise<ParseResult> {
    return this.post("parser", { kind: "parse", content, format, options }, events);
  }

  analyze(
    conversation: ParsedConversation,
    options: AnalyticsOptions,
    events?: JobEvents,
  ): Promise<AnalyticsResult> {
    return this.post("analytics", { kind: "analyze", conversation, options }, events);
  }
}

export const workerClient = new WorkerClient();
