import { newTraceId } from "./traceId";

export type PwaDiagnosticEventCode =
  | "PWA_APP_ERROR"
  | "PWA_UNHANDLED_REJECTION"
  | "PWA_API_REQUEST_FAILED"
  | "PWA_ROUTE_ERROR"
  | "PWA_SERVICE_WORKER_ERROR";

type SafeMetadata = Partial<{
  boundary: "app" | "react_boundary" | "api_request" | "service_worker" | "route";
  duration_ms: number;
  error_code:
    | "app_error"
    | "unhandled_rejection"
    | "api_request_failed"
    | "service_worker_error"
    | "route_error";
  retryable: boolean;
  http_status_category: "1xx" | "2xx" | "3xx" | "4xx" | "5xx" | "unknown";
  http_status: number;
  upstream_request_id: string;
  rejection_category: "abort" | "type_error" | "error" | "other";
  endpoint_group:
    | "auth"
    | "projects"
    | "sources"
    | "jobs"
    | "google"
    | "credentials"
    | "diagnostics"
    | "realtime"
    | "transcript_catalog"
    | "transcript_maintenance"
    | "unknown";
}>;

type QueuedEvent = { event_code: PwaDiagnosticEventCode; metadata: SafeMetadata; level?: "DEBUG" };

const EVENT_CODES = new Set<PwaDiagnosticEventCode>([
  "PWA_APP_ERROR",
  "PWA_UNHANDLED_REJECTION",
  "PWA_API_REQUEST_FAILED",
  "PWA_ROUTE_ERROR",
  "PWA_SERVICE_WORKER_ERROR",
]);
const ROUTINE_DEBUG_EVENTS = new Set<PwaDiagnosticEventCode>([
  "PWA_API_REQUEST_FAILED",
  "PWA_SERVICE_WORKER_ERROR",
]);
const HTTP_CATEGORIES = new Set(["1xx", "2xx", "3xx", "4xx", "5xx", "unknown"]);
const ENDPOINT_GROUPS = new Set(["auth", "projects", "sources", "jobs", "google", "credentials", "diagnostics", "realtime", "transcript_catalog", "transcript_maintenance", "unknown"]);
const REJECTION_CATEGORIES = new Set(["abort", "type_error", "error", "other"]);
const REQUEST_ID = /^req_[A-Za-z0-9_-]{16,64}$/;
const BOUNDARIES = new Set(["app", "react_boundary", "api_request", "service_worker", "route"]);
const ERROR_CODES = new Set(["app_error", "unhandled_rejection", "api_request_failed", "service_worker_error", "route_error"]);
const MAX_QUEUE = 20;
const MAX_DUPES = 32;
const DUPE_WINDOW_MS = 5000;
const MAX_DURATION_MS = 300000;

let csrfToken = "";
let debugActiveUntil = 0;
let queue: QueuedEvent[] = [];
let flushing = false;
let handlersInstalled = false;
const recent = new Map<string, number>();

function now() { return Date.now(); }
function isDebugActive() { return debugActiveUntil > now(); }
function pruneDupes(t = now()) {
  for (const [key, seen] of recent) if (t - seen > DUPE_WINDOW_MS) recent.delete(key);
  while (recent.size > MAX_DUPES) recent.delete(recent.keys().next().value as string);
}
function sanitizeMetadata(input: unknown): SafeMetadata {
  const out: SafeMetadata = {};
  if (!input || typeof input !== "object" || input instanceof Error || input instanceof Event) return out;
  const record = input as Record<string, unknown>;
  if (typeof record.boundary === "string" && BOUNDARIES.has(record.boundary)) out.boundary = record.boundary as SafeMetadata["boundary"];
  if (Number.isFinite(record.duration_ms)) out.duration_ms = Math.max(0, Math.min(MAX_DURATION_MS, Math.round(record.duration_ms as number)));
  if (typeof record.error_code === "string" && ERROR_CODES.has(record.error_code)) out.error_code = record.error_code as SafeMetadata["error_code"];
  if (typeof record.retryable === "boolean") out.retryable = record.retryable;
  if (typeof record.http_status_category === "string" && HTTP_CATEGORIES.has(record.http_status_category)) out.http_status_category = record.http_status_category as SafeMetadata["http_status_category"];
  if (Number.isInteger(record.http_status) && (record.http_status as number) >= 100 && (record.http_status as number) <= 599) out.http_status = record.http_status as number;
  if (typeof record.upstream_request_id === "string" && REQUEST_ID.test(record.upstream_request_id)) out.upstream_request_id = record.upstream_request_id;
  if (typeof record.rejection_category === "string" && REJECTION_CATEGORIES.has(record.rejection_category)) out.rejection_category = record.rejection_category as SafeMetadata["rejection_category"];
  if (typeof record.endpoint_group === "string" && ENDPOINT_GROUPS.has(record.endpoint_group)) out.endpoint_group = record.endpoint_group as SafeMetadata["endpoint_group"];
  return out;
}

export function updatePwaDiagnosticsCsrf(csrf: string) {
  csrfToken = csrf;
  void flushPwaDiagnostics();
}
export function configurePwaDiagnosticsDebugState({ active, expiresAt }: { active: boolean; expiresAt?: string | null }) {
  if (active && expiresAt) {
    const expiry = Date.parse(expiresAt);
    debugActiveUntil = Number.isFinite(expiry) && expiry > now() ? expiry : 0;
  } else {
    debugActiveUntil = 0;
  }
}
export function configurePwaDiagnosticsSession({ csrf, debugActive, expiresAt }: { csrf: string; debugActive?: boolean; expiresAt?: string | null }) {
  updatePwaDiagnosticsCsrf(csrf);
  if (typeof debugActive === "boolean") {
    configurePwaDiagnosticsDebugState({ active: debugActive, expiresAt });
  }
}
export function clearPwaDiagnosticsSession() {
  csrfToken = "";
  debugActiveUntil = 0;
  queue = [];
  recent.clear();
}
export function emitPwaDiagnostic(eventCode: PwaDiagnosticEventCode, metadata: unknown, options: { dedupe?: boolean } = {}) {
  if (!EVENT_CODES.has(eventCode)) return;
  const safe = sanitizeMetadata(metadata);
  const candidate: QueuedEvent = { event_code: eventCode, metadata: safe };
  if (ROUTINE_DEBUG_EVENTS.has(eventCode) && isDebugActive()) candidate.level = "DEBUG";
  if (options.dedupe !== false) {
    const key = JSON.stringify(candidate);
    const t = now();
    pruneDupes(t);
    if (recent.has(key)) return;
    recent.set(key, t);
  }
  queue.push(candidate);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  void flushPwaDiagnostics();
}
export async function flushPwaDiagnostics() {
  if (!csrfToken || flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0, MAX_QUEUE);
  try {
    await fetch("/api/diagnostics/pwa-events", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken, "x-trace-id": newTraceId() },
      body: JSON.stringify({ events: batch }),
    });
  } catch { /* best effort: failed batch is not retried */ }
  finally {
    flushing = false;
    if (csrfToken && queue.length > 0) {
      window.setTimeout(() => { void flushPwaDiagnostics(); }, 0);
    }
  }
}
export function installPwaGlobalErrorHandlers() {
  if (handlersInstalled || typeof window === "undefined") return () => undefined;
  const onError = () => emitPwaDiagnostic("PWA_APP_ERROR", { boundary: "app", error_code: "app_error", retryable: false });
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const rejectionCategory =
      reason instanceof DOMException && reason.name === "AbortError"
        ? "abort"
        : reason instanceof TypeError
          ? "type_error"
          : reason instanceof Error
            ? "error"
            : "other";
    emitPwaDiagnostic("PWA_UNHANDLED_REJECTION", { boundary: "app", error_code: "unhandled_rejection", retryable: false, rejection_category: rejectionCategory });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  handlersInstalled = true;
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    handlersInstalled = false;
  };
}
export function emitPwaServiceWorkerError() {
  emitPwaDiagnostic("PWA_SERVICE_WORKER_ERROR", { boundary: "service_worker", error_code: "service_worker_error", retryable: true });
}
export const __pwaDiagnosticsTest = { sanitizeMetadata, MAX_QUEUE, MAX_DUPES, DUPE_WINDOW_MS };
