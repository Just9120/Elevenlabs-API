import {
  DirectUploadAmbiguousError,
  directUploadTimeoutMs,
  isSafeDirectUploadCapability,
  uploadFileWithProgress,
} from "./directUpload";

class FakeUploadTarget extends EventTarget {}

class FakeRequest extends EventTarget {
  static instances: FakeRequest[] = [];
  readonly upload = new FakeUploadTarget();
  method = "";
  url = "";
  withCredentials = true;
  timeout = 0;
  status = 0;
  headers: Record<string, string> = {};
  body: File | null = null;

  constructor() {
    super();
    FakeRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: File) {
    this.body = body;
  }

  abort() {
    this.dispatchEvent(new Event("abort"));
  }
}

function progress(loaded: number, total: number) {
  const event = new Event("progress") as ProgressEvent;
  Object.defineProperties(event, {
    lengthComputable: { value: true },
    loaded: { value: loaded },
    total: { value: total },
  });
  return event;
}

describe("direct upload transport", () => {
  beforeEach(() => {
    FakeRequest.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeRequest);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("uploads without credentials and exposes bounded byte progress", async () => {
    const file = new File(["1234567890"], "voice.ogg", { type: "audio/ogg" });
    const updates: number[] = [];
    const pending = uploadFileWithProgress({
      url: "https://storage.example/presigned",
      method: "PUT",
      headers: { "Content-Type": "audio/ogg" },
      file,
      timeoutMs: 60_000,
      onProgress: (value) => updates.push(value.percent),
    });
    const request = FakeRequest.instances[0];
    expect(request.withCredentials).toBe(false);
    expect(request.timeout).toBe(60_000);
    expect(request.headers).toEqual({ "Content-Type": "audio/ogg" });
    expect(request.body).toBe(file);
    request.upload.dispatchEvent(progress(4, 10));
    request.status = 200;
    request.dispatchEvent(new Event("load"));

    await expect(pending).resolves.toEqual({ ok: true, status: 200 });
    expect(updates).toEqual([0, 40, 100]);
  });

  it("classifies timeout as ambiguous and never retries the PUT", async () => {
    const pending = uploadFileWithProgress({
      url: "https://storage.example/presigned",
      method: "PUT",
      headers: { "Content-Type": "audio/ogg" },
      file: new File(["voice"], "voice.ogg", { type: "audio/ogg" }),
      timeoutMs: 30_000,
    });
    const request = FakeRequest.instances[0];
    request.dispatchEvent(new Event("timeout"));

    await expect(pending).rejects.toBeInstanceOf(DirectUploadAmbiguousError);
    expect(FakeRequest.instances).toHaveLength(1);
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
