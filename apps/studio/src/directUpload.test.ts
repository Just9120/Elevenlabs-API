import {
  DirectUploadAmbiguousError,
  directUploadTimeoutMs,
  isSafeDirectUploadCapability,
  uploadFileWithProgress,
} from "./directUpload";

function fileWithStream(contents: string, name: string, type: string) {
  const file = new File([contents], name, { type });
  const bytes = new TextEncoder().encode(contents);
  Object.defineProperty(file, "stream", {
    value: () => new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  });
  return file;
}

describe("direct upload transport", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uploads without credentials or redirects and exposes bounded byte progress", async () => {
    const file = fileWithStream("1234567890", "voice.ogg", "audio/ogg");
    const updates: number[] = [];
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, options?: RequestInit & { duplex?: string }) => {
      const reader = (options?.body as ReadableStream<Uint8Array>).getReader();
      while (!(await reader.read()).done) {
        // Consume the request stream exactly as the browser transport would.
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const pending = uploadFileWithProgress({
      url: "https://storage.example/presigned",
      method: "PUT",
      headers: { "Content-Type": "audio/ogg" },
      file,
      timeoutMs: 60_000,
      onProgress: (value) => updates.push(value.percent),
    });
    await expect(pending).resolves.toEqual({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "audio/ogg" },
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      duplex: "half",
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(updates[0]).toBe(0);
    expect(updates.at(-1)).toBe(100);
  });

  it("classifies timeout as ambiguous and never retries the PUT", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = uploadFileWithProgress({
      url: "https://storage.example/presigned",
      method: "PUT",
      headers: { "Content-Type": "audio/ogg" },
      file: fileWithStream("voice", "voice.ogg", "audio/ogg"),
      timeoutMs: 30_000,
    });
    const rejection = expect(pending).rejects.toBeInstanceOf(DirectUploadAmbiguousError);
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("derives a bounded timeout inside the capability lifetime", () => {
    expect(directUploadTimeoutMs(60)).toBe(45_000);
    expect(directUploadTimeoutMs(900)).toBe(600_000);
  });

  it("accepts only a short-lived HTTPS PUT capability with one content-type header", () => {
    expect(
      isSafeDirectUploadCapability(
        {
          source_id: "source-id",
          upload: {
            method: "PUT",
            url: "https://storage.example/presigned?signature=safe",
            headers: { "Content-Type": "audio/ogg" },
            expires_in: 300,
          },
        },
        "audio/ogg",
      ),
    ).toBe(true);
    expect(
      isSafeDirectUploadCapability(
        {
          source_id: "source-id",
          upload: {
            method: "PUT",
            url: "http://storage.example/private",
            headers: { "Content-Type": "audio/ogg", Authorization: "secret" },
            expires_in: 300,
          },
        },
        "audio/ogg",
      ),
    ).toBe(false);
  });
});
