import {
  DirectUploadAmbiguousError,
  directUploadTimeoutMs,
  isMultipartDirectUploadCapability,
  isSafeDirectUploadCapability,
  isSafeMultipartPartCapability,
  parseMultipartStatus,
  uploadFileWithProgress,
} from "./directUpload";

class FakeUploadRequest extends EventTarget {
  static instances: FakeUploadRequest[] = [];

  readonly upload = new EventTarget();
  status = 0;
  timeout = 0;
  withCredentials = true;
  responseURL = "";
  method = "";
  url = "";
  async = false;
  headers: Record<string, string> = {};
  body: Document | XMLHttpRequestBodyInit | null = null;

  constructor() {
    super();
    FakeUploadRequest.instances.push(this);
  }

  open(method: string, url: string, async = true) {
    this.method = method;
    this.url = url;
    this.responseURL = url;
    this.async = async;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: Document | XMLHttpRequestBodyInit | null = null) {
    this.body = body;
  }

  abort() {
    this.dispatchEvent(new ProgressEvent("abort"));
  }

  progress(loaded: number, total: number) {
    this.upload.dispatchEvent(
      new ProgressEvent("progress", {
        lengthComputable: true,
        loaded,
        total,
      }),
    );
  }

  complete(status: number) {
    this.status = status;
    this.upload.dispatchEvent(new ProgressEvent("load"));
    this.dispatchEvent(new ProgressEvent("load"));
  }

  fail(type: "error" | "timeout") {
    this.dispatchEvent(new ProgressEvent(type));
  }
}

describe("direct upload transport", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    FakeUploadRequest.instances = [];
  });

  it("uploads one raw file without credentials and exposes bounded byte progress", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest);
    const file = new File(["1234567890"], "voice.ogg", {
      type: "audio/ogg",
    });
    const updates: number[] = [];
    const pending = uploadFileWithProgress({
      url: "https://storage.example/presigned",
      method: "PUT",
      headers: { "Content-Type": "audio/ogg" },
      file,
      timeoutMs: 60_000,
      onProgress: (value) => updates.push(value.percent),
    });
    const request = FakeUploadRequest.instances[0];
    expect(request).toMatchObject({
      method: "PUT",
      url: "https://storage.example/presigned",
      async: true,
      headers: { "Content-Type": "audio/ogg" },
      timeout: 60_000,
      withCredentials: false,
      body: file,
    });
    request.progress(5, 10);
    request.complete(200);
    await expect(pending).resolves.toEqual({ ok: true, status: 200 });
    expect(updates).toEqual([0, 50, 100]);
    expect(FakeUploadRequest.instances).toHaveLength(1);
  });

  it("classifies timeout as ambiguous and never retries the PUT", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest);
    const pending = uploadFileWithProgress({
      url: "https://storage.example/presigned",
      method: "PUT",
      headers: { "Content-Type": "audio/ogg" },
      file: new File(["voice"], "voice.ogg", { type: "audio/ogg" }),
      timeoutMs: 30_000,
    });
    const rejection = expect(pending).rejects.toBeInstanceOf(DirectUploadAmbiguousError);
    FakeUploadRequest.instances[0].fail("timeout");
    await rejection;
    expect(FakeUploadRequest.instances).toHaveLength(1);
  });

  it("refuses a redirected terminal response without retrying the PUT", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest);
    const pending = uploadFileWithProgress({
      url: "https://storage.example/presigned",
      method: "PUT",
      headers: { "Content-Type": "audio/ogg" },
      file: new File(["voice"], "voice.ogg", { type: "audio/ogg" }),
      timeoutMs: 30_000,
    });
    const request = FakeUploadRequest.instances[0];
    request.responseURL = "https://redirect.example/untrusted";
    request.complete(200);

    await expect(pending).rejects.toMatchObject({
      name: "DirectUploadAmbiguousError",
      message: "direct_upload_redirect",
    });
    expect(FakeUploadRequest.instances).toHaveLength(1);
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

  it("accepts a bounded multipart capability without exposing storage identity", () => {
    const capability = {
      source_id: "source-id",
      upload: {
        mode: "multipart" as const,
        part_size_bytes: 8 * 1024 * 1024,
        part_count: 3,
        expires_in: 3600,
      },
    };
    expect(isSafeDirectUploadCapability(capability, "video/mp4")).toBe(true);
    expect(isMultipartDirectUploadCapability(capability)).toBe(true);
    expect(JSON.stringify(capability)).not.toMatch(/bucket|object_key|upload_id/i);
    expect(
      isSafeDirectUploadCapability(
        { ...capability, upload: { ...capability.upload, part_count: 10_001 } },
        "video/mp4",
      ),
    ).toBe(false);
  });

  it("validates one short-lived part capability and normalized upload status", () => {
    expect(
      isSafeMultipartPartCapability(
        {
          part_number: 2,
          upload: {
            method: "PUT",
            url: "https://storage.example/part?signature=safe",
            headers: {},
            expires_in: 300,
          },
        },
        2,
      ),
    ).toBe(true);
    expect(
      parseMultipartStatus(
        { status: "active", uploaded_parts: [3, 1, 2] },
        3,
      ),
    ).toEqual({ status: "active", uploadedParts: [1, 2, 3] });
    expect(
      parseMultipartStatus(
        { status: "active", uploaded_parts: [1, 1] },
        3,
      ),
    ).toBeNull();
  });
});
