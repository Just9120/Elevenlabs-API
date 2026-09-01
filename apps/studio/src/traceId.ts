const TRACE_ID = /^trace_[A-Za-z0-9_-]{16,64}$/;
let fallbackCounter = 0;

export function isTraceId(value: unknown): value is string {
  return typeof value === "string" && TRACE_ID.test(value);
}

export function newTraceId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return `trace_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }
  fallbackCounter = (fallbackCounter + 1) % 0xffff_ffff;
  return `trace_${Date.now().toString(16).padStart(12, "0")}${fallbackCounter.toString(16).padStart(8, "0")}`;
}

export function withTraceHeader(options: RequestInit = {}): RequestInit {
  const source = options.headers;
  if (source instanceof Headers) {
    const headers = new Headers(source);
    if (!isTraceId(headers.get("x-trace-id"))) headers.set("x-trace-id", newTraceId());
    return { ...options, headers };
  }
  if (Array.isArray(source)) {
    const headers = source.map(([name, value]) => [name, value] as [string, string]);
    const traceEntry = headers.find(([name]) => name.toLowerCase() === "x-trace-id");
    if (traceEntry && !isTraceId(traceEntry[1])) traceEntry[1] = newTraceId();
    else if (!traceEntry) headers.push(["x-trace-id", newTraceId()]);
    return { ...options, headers };
  }
  const headers = { ...(source ?? {}) } as Record<string, string>;
  const traceKey = Object.keys(headers).find((name) => name.toLowerCase() === "x-trace-id");
  if (traceKey && !isTraceId(headers[traceKey])) headers[traceKey] = newTraceId();
  else if (!traceKey) headers["x-trace-id"] = newTraceId();
  return { ...options, headers };
}

export function traceHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers || Array.isArray(headers)) {
    return Object.fromEntries(new Headers(headers).entries());
  }
  return { ...headers };
}
