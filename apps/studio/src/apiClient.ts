import { emitPwaDiagnostic } from "./pwaDiagnostics";


export type ApiRequestOptions = RequestInit & {
  ignoredAbortReason?: unknown;
};

export class ApiError extends Error {
  status: number;
  data?: unknown;
  requestId?: string;

  constructor(status: number, message: string, data?: unknown, requestId?: string) {
    super(message);
    this.status = status;
    this.data = data;
    this.requestId = requestId;
  }
}

function diagnosticEndpointGroup(path: string) {
  if (path.startsWith("/auth")) return "auth";
  if (path.startsWith("/projects")) return "projects";
  if (path.startsWith("/sources")) return "sources";
  if (path.startsWith("/jobs")) return "jobs";
  if (path.startsWith("/google")) return "google";
  if (path.startsWith("/provider-accounts")) return "provider_accounts";
  if (path.startsWith("/credentials")) return "credentials";
  if (path.startsWith("/diagnostics")) return "diagnostics";
  if (path.startsWith("/transcript-catalog")) return "transcript_catalog";
  if (path.startsWith("/transcript-maintenance")) {
    return "transcript_maintenance";
  }
  return "unknown";
}

function statusCategory(status?: number) {
  if (!status || status < 100 || status > 599) return "unknown";
  return `${Math.floor(status / 100)}xx`;
}

function isRetryableApiFailure(status?: number) {
  return !status || status === 408 || status === 429 || status >= 500;
}

function emitApiFailure(path: string, startedAt: number, status?: number, requestId?: string) {
  if (path.startsWith("/diagnostics/pwa-events")) return;
  emitPwaDiagnostic("PWA_API_REQUEST_FAILED", {
    boundary: "api_request",
    error_code: "api_request_failed",
    endpoint_group: diagnosticEndpointGroup(path),
    http_status_category: statusCategory(status),
    ...(status && status >= 100 && status <= 599 ? { http_status: status } : {}),
    ...(requestId ? { upstream_request_id: requestId } : {}),
    duration_ms: performance.now() - startedAt,
    retryable: isRetryableApiFailure(status),
  });
}

async function requestResponse(
  path: string,
  options: RequestInit = {},
  csrf?: string,
): Promise<Response> {
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
    let data: unknown;
    try {
      data = await res.clone().json();
    } catch {
      data = null;
    }
    const responseRequestId = res.headers?.get?.("x-request-id") ?? undefined;
    throw new ApiError(
      res.status,
      res.status === 429
        ? "Слишком много попыток. Попробуйте позже."
        : "Операция не выполнена. Проверьте данные и повторите.",
      data,
      responseRequestId,
    );
  }
  return res;
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  csrf?: string,
): Promise<T> {
  const response = await requestResponse(path, options, csrf);
  return response.json();
}

export async function api<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { ignoredAbortReason, ...requestOptions } = options;
  const startedAt = performance.now();
  try {
    return await requestJson<T>(path, requestOptions);
  } catch (err) {
    const ignoredAbort =
      ignoredAbortReason !== undefined &&
      requestOptions.signal?.aborted === true &&
      requestOptions.signal.reason === ignoredAbortReason;
    if (!ignoredAbort) {
      emitApiFailure(
        path,
        startedAt,
        err instanceof ApiError ? err.status : undefined,
        err instanceof ApiError ? err.requestId : undefined,
      );
    }
    throw err;
  }
}

export async function apiResponse(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  const { ignoredAbortReason, ...requestOptions } = options;
  const startedAt = performance.now();
  try {
    return await requestResponse(path, requestOptions);
  } catch (err) {
    const ignoredAbort =
      ignoredAbortReason !== undefined &&
      requestOptions.signal?.aborted === true &&
      requestOptions.signal.reason === ignoredAbortReason;
    if (!ignoredAbort) {
      emitApiFailure(
        path,
        startedAt,
        err instanceof ApiError ? err.status : undefined,
        err instanceof ApiError ? err.requestId : undefined,
      );
    }
    throw err;
  }
}

function isCsrfRejection(err: unknown) {
  const data =
    err instanceof ApiError && err.data && typeof err.data === "object"
      ? (err.data as { detail?: unknown })
      : null;
  const detail =
    data?.detail && typeof data.detail === "object"
      ? (data.detail as { reason?: unknown })
      : null;
  return (
    err instanceof ApiError &&
    err.status === 403 &&
    detail?.reason === "csrf_token_invalid"
  );
}

function parseRefreshedCsrf(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== "object") return null;
  const csrf = (candidate as { csrf_token?: unknown }).csrf_token;
  return typeof csrf === "string" &&
    csrf.length > 0 &&
    csrf.length <= 4096 &&
    csrf === csrf.trim()
    ? csrf
    : null;
}

export async function responseWithCsrfRetry(
  path: string,
  csrf: string,
  onCsrf: (csrf: string) => void,
  options: RequestInit,
): Promise<Response> {
  const startedAt = performance.now();
  try {
    return await requestResponse(path, options, csrf);
  } catch (err) {
    if (!isCsrfRejection(err)) {
      emitApiFailure(
        path,
        startedAt,
        err instanceof ApiError ? err.status : undefined,
        err instanceof ApiError ? err.requestId : undefined,
      );
      throw err;
    }
    try {
      const candidate = await requestJson<unknown>("/auth/csrf", {
        method: "POST",
        signal: options.signal,
      });
      const refreshedCsrf = parseRefreshedCsrf(candidate);
      if (!refreshedCsrf) {
        throw new Error("invalid_csrf_refresh_response", { cause: err });
      }
      onCsrf(refreshedCsrf);
      return await requestResponse(path, options, refreshedCsrf);
    } catch (retryErr) {
      emitApiFailure(
        path,
        startedAt,
        retryErr instanceof ApiError ? retryErr.status : undefined,
        retryErr instanceof ApiError ? retryErr.requestId : undefined,
      );
      throw retryErr;
    }
  }
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
        err instanceof ApiError ? err.requestId : undefined,
      );
      throw err;
    }
    try {
      const refreshed = await requestJson<{ csrf_token: string }>(
        "/auth/csrf",
        { method: "POST", signal: options.signal },
      );
      onCsrf(refreshed.csrf_token);
      return await requestJson<T>(path, options, refreshed.csrf_token);
    } catch (retryErr) {
      emitApiFailure(
        path,
        startedAt,
        retryErr instanceof ApiError ? retryErr.status : undefined,
        retryErr instanceof ApiError ? retryErr.requestId : undefined,
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
