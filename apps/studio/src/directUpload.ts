export type DirectUploadProgress = {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
};

export type DirectUploadResult = {
  ok: boolean;
  status: number;
};

export type DirectUploadCapability = {
  source_id: string;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expires_in: number;
  };
};

export class DirectUploadAmbiguousError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectUploadAmbiguousError";
  }
}

export function isSafeDirectUploadCapability(
  candidate: unknown,
  expectedContentType: string,
): candidate is DirectUploadCapability {
  if (!candidate || typeof candidate !== "object") return false;
  const sourceId = (candidate as { source_id?: unknown }).source_id;
  const upload = (candidate as { upload?: unknown }).upload;
  if (
    typeof sourceId !== "string" ||
    !sourceId ||
    sourceId.length > 128 ||
    /\s/.test(sourceId) ||
    !upload ||
    typeof upload !== "object"
  )
    return false;
  const value = upload as Record<string, unknown>;
  if (
    value.method !== "PUT" ||
    !Number.isInteger(value.expires_in) ||
    (value.expires_in as number) < 60 ||
    (value.expires_in as number) > 900 ||
    !value.headers ||
    typeof value.headers !== "object" ||
    Array.isArray(value.headers)
  )
    return false;
  const headers = value.headers as Record<string, unknown>;
  if (
    Object.keys(headers).length !== 1 ||
    headers["Content-Type"] !== expectedContentType
  )
    return false;
  if (typeof value.url !== "string") return false;
  try {
    const url = new URL(value.url);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  } catch {
    return false;
  }
}

type DirectUploadRequest = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  file: File;
  timeoutMs: number;
  signal?: AbortSignal;
  onProgress?: (progress: DirectUploadProgress) => void;
};

function boundedProgress(loaded: number, total: number): DirectUploadProgress {
  const safeTotal = Math.max(0, Number.isFinite(total) ? total : 0);
  const safeLoaded = Math.min(
    safeTotal || Number.MAX_SAFE_INTEGER,
    Math.max(0, Number.isFinite(loaded) ? loaded : 0),
  );
  return {
    loadedBytes: safeLoaded,
    totalBytes: safeTotal,
    percent:
      safeTotal > 0
        ? Math.max(0, Math.min(100, Math.round((safeLoaded / safeTotal) * 100)))
        : 0,
  };
}

export function directUploadTimeoutMs(expiresInSeconds: number) {
  const capabilityWindow = Math.max(30, expiresInSeconds - 15) * 1000;
  return Math.min(10 * 60 * 1000, capabilityWindow);
}

export function uploadFileWithProgress({
  url,
  method,
  headers,
  file,
  timeoutMs,
  signal,
  onProgress,
}: DirectUploadRequest): Promise<DirectUploadResult> {
  if (typeof XMLHttpRequest !== "function") {
    return Promise.reject(new Error("direct_upload_progress_unsupported"));
  }
  if (signal?.aborted) {
    return Promise.reject(
      new DirectUploadAmbiguousError("direct_upload_aborted"),
    );
  }

  return new Promise<DirectUploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;
    let abortedBySignal = false;

    const cleanup = () => signal?.removeEventListener("abort", abort);
    const finish = (
      outcome:
        | { kind: "resolve"; value: DirectUploadResult }
        | { kind: "reject"; reason: DirectUploadAmbiguousError },
    ) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (outcome.kind === "resolve") resolve(outcome.value);
      else reject(outcome.reason);
    };
    const rejectAmbiguous = (reason: string) =>
      finish({
        kind: "reject",
        reason: new DirectUploadAmbiguousError(reason),
      });
    const abort = () => {
      abortedBySignal = true;
      request.abort();
    };

    request.upload.addEventListener("progress", (event) => {
      const total = event.lengthComputable && event.total > 0
        ? event.total
        : file.size;
      onProgress?.(boundedProgress(event.loaded, total));
    });
    request.upload.addEventListener("load", () => {
      onProgress?.(boundedProgress(file.size, file.size));
    });
    request.addEventListener("load", () => {
      if (request.responseURL) {
        try {
          if (new URL(request.responseURL).href !== new URL(url).href) {
            rejectAmbiguous("direct_upload_redirect");
            return;
          }
        } catch {
          rejectAmbiguous("direct_upload_redirect");
          return;
        }
      }
      finish({
        kind: "resolve",
        value: {
          ok: request.status >= 200 && request.status < 300,
          status: request.status,
        },
      });
    });
    request.addEventListener("error", () =>
      rejectAmbiguous("direct_upload_network_error"),
    );
    request.addEventListener("timeout", () =>
      rejectAmbiguous("direct_upload_timeout"),
    );
    request.addEventListener("abort", () =>
      rejectAmbiguous(
        abortedBySignal
          ? "direct_upload_aborted"
          : "direct_upload_network_error",
      ),
    );

    signal?.addEventListener("abort", abort, { once: true });
    onProgress?.(boundedProgress(0, file.size));
    try {
      request.open(method, url, true);
      request.withCredentials = false;
      request.timeout = timeoutMs;
      for (const [name, value] of Object.entries(headers)) {
        request.setRequestHeader(name, value);
      }
      request.send(file);
    } catch {
      rejectAmbiguous("direct_upload_network_error");
    }
  });
}
