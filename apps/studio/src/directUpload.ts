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
  if (typeof file.stream !== "function" || typeof ReadableStream !== "function") {
    return Promise.reject(new Error("direct_upload_progress_unsupported"));
  }
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort(signal.reason);
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort("direct_upload_timeout");
  }, timeoutMs);
  let loadedBytes = 0;
  onProgress?.(boundedProgress(0, file.size));
  const reader = file.stream().getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(streamController) {
      const chunk = await reader.read();
      if (chunk.done) {
        streamController.close();
        return;
      }
      loadedBytes += chunk.value.byteLength;
      onProgress?.(boundedProgress(loadedBytes, file.size));
      streamController.enqueue(chunk.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  const requestOptions: RequestInit & { duplex: "half" } = {
    method,
    headers,
    body,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal: controller.signal,
    duplex: "half",
  };
  return fetch(url, requestOptions)
    .then((response) => {
      onProgress?.(boundedProgress(file.size, file.size));
      return { ok: response.ok, status: response.status };
    })
    .catch(() => {
      if (timedOut) throw new DirectUploadAmbiguousError("direct_upload_timeout");
      if (signal?.aborted) throw new DirectUploadAmbiguousError("direct_upload_aborted");
      throw new DirectUploadAmbiguousError("direct_upload_network_error");
    })
    .finally(() => {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    });
}
