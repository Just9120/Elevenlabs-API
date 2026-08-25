import {
  DirectUploadAmbiguousError,
  directUploadTimeoutMs,
  isSafeDirectUploadCapability,
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
});
