import { emitPwaDiagnostic } from "./pwaDiagnostics";


export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function diagnosticEndpointGroup(path: string) {
  if (path.startsWith("/auth")) return "auth";
  if (path.startsWith("/projects")) return "projects";
  if (path.startsWith("/sources")) return "sources";
  if (path.startsWith("/jobs")) return "jobs";
  if (path.startsWith("/google")) return "google";
  if (path.startsWith("/credentials")) return "credentials";
  if (path.startsWith("/diagnostics")) return "diagnostics";
  return "unknown";
}

function statusCategory(status?: number) {
  if (!status || status < 100 || status > 599) return "unknown";
  return `${Math.floor(status / 100)}xx`;
}

function isRetryableApiFailure(status?: number) {
  return !status || status === 408 || status === 429 || status >= 500;
}

function emitApiFailure(path: string, startedAt: number, status?: number) {
  if (path.startsWith("/diagnostics/pwa-events")) return;
  emitPwaDiagnostic("PWA_API_REQUEST_FAILED", {
    boundary: "api_request",
    error_code: "api_request_failed",
    endpoint_group: diagnosticEndpointGroup(path),
    http_status_category: statusCategory(status),
    duration_ms: performance.now() - startedAt,
    retryable: isRetryableApiFailure(status),
  });
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  csrf?: string,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(csrf ? { "x-csrf-token": csrf } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.clone().json();
    } catch {
      data = null;
    }
    throw new ApiError(
      res.status,
      res.status === 429
        ? "Слишком много попыток. Попробуйте позже."
        : "Операция не выполнена. Проверьте данные и повторите.",
      data,
    );
  }
  return res.json();
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await requestJson<T>(path, options);
  } catch (err) {
    emitApiFailure(
      path,
      startedAt,
      err instanceof ApiError ? err.status : undefined,
    );
    throw err;
  }
}

function isCsrfRejection(err: unknown) {
  return (
    err instanceof ApiError &&
    (err.status === 401 || err.status === 403 || err.status === 419)
  );
}

export async function mutateWithCsrfRetry<T>(
  path: string,
  csrf: string,
  onCsrf: (csrf: string) => void,
  options: RequestInit,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await requestJson<T>(path, options, csrf);
  } catch (err) {
    if (!isCsrfRejection(err)) {
      emitApiFailure(
        path,
        startedAt,
        err instanceof ApiError ? err.status : undefined,
      );
      throw err;
    }
    try {
      const refreshed = await requestJson<{ csrf_token: string }>(
        "/auth/csrf",
        { method: "POST" },
      );
      onCsrf(refreshed.csrf_token);
      return await requestJson<T>(path, options, refreshed.csrf_token);
    } catch (retryErr) {
      emitApiFailure(
        path,
        startedAt,
        retryErr instanceof ApiError ? retryErr.status : undefined,
      );
      throw retryErr;
    }
  }
}

export async function batchMutateWithCsrfRetry<T>(
  path: string,
  csrf: string,
  onCsrf: (csrf: string) => void,
  options: RequestInit,
): Promise<T> {
  return mutateWithCsrfRetry<T>(path, csrf, onCsrf, options);
}
