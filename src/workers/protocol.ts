/**
 * Typed, versioned Web Worker protocol.
 *
 * All heavy work (parsing, analytics) runs in workers so the UI thread
 * stays responsive. Messages are plain structured-clone objects.
 */

import type { AnalyticsOptions, AnalyticsResult } from "../features/analytics/types";
import type { ParsedConversation, ParseOptions, ParseResult } from "../features/types";
import type { DetectedFormat } from "../features/parsers/detect";

export type WorkerRequestId = number;

export interface ParseRequest {
  kind: "parse";
  requestId: WorkerRequestId;
  content: string;
  format: DetectedFormat;
  options?: ParseOptions;
}

export interface AnalyzeRequest {
  kind: "analyze";
  requestId: WorkerRequestId;
  conversation: ParsedConversation;
  options: AnalyticsOptions;
}

export type WorkerRequest = ParseRequest | AnalyzeRequest;

export interface ParseResponse {
  kind: "parse";
  requestId: WorkerRequestId;
  result?: ParseResult;
  error?: { message: string; code: string };
}

export interface AnalyzeResponse {
  kind: "analyze";
  requestId: WorkerRequestId;
  result?: AnalyticsResult;
  error?: { message: string; code: string };
}

export interface ProgressEvent {
  kind: "progress";
  requestId: WorkerRequestId;
  phase: "reading" | "parsing" | "analyzing";
  pct: number;
}

export type WorkerResponse = ParseResponse | AnalyzeResponse | ProgressEvent;
