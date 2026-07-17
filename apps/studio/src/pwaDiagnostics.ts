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
  endpoint_group:
    | "auth"
    | "projects"
    | "sources"
    | "jobs"
    | "google"
    | "credentials"
    | "diagnostics"
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
const ENDPOINT_GROUPS = new Set(["auth", "projects", "sources", "jobs", "google", "credentials", "diagnostics", "unknown"]);
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
  if (typeof record.endpoint_group === "string" && ENDPOINT_GROUPS.has(record.endpoint_group)) out.endpoint_group = record.endpoint_group as SafeMetadata["endpoint_group"];
  return out;
}

export function configurePwaDiagnosticsSession({ csrf, debugActive, expiresAt }: { csrf: string; debugActive?: boolean; expiresAt?: string | null }) {
  csrfToken = csrf;
  if (debugActive && expiresAt) {
    const expiry = Date.parse(expiresAt);
    debugActiveUntil = Number.isFinite(expiry) && expiry > now() ? expiry : 0;
  } else {
    debugActiveUntil = 0;
  }
  void flushPwaDiagnostics();
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
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
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
  const onRejection = () => emitPwaDiagnostic("PWA_UNHANDLED_REJECTION", { boundary: "app", error_code: "unhandled_rejection", retryable: false });
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
