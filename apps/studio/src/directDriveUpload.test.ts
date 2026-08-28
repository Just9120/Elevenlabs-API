import { DirectUploadAmbiguousError } from "./directUpload";
import {
  DIRECT_DRIVE_UPLOAD_APP_PROPERTY,
  DIRECT_DRIVE_UPLOAD_MAX_FILES,
  directDriveFileSelectionError,
  parseDirectDriveUploadSession,
  uploadDirectDriveFile,
  type DirectDriveUploadItem,
} from "./directDriveUpload";


const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174000";

function item(file = new File(["audio"], "Запись.wav", { type: "audio/wav" })):
  DirectDriveUploadItem {
  return { operationId: OPERATION_ID, file };
}

function sessionCandidate(capability = "a".repeat(96)) {
  return {
    access_token: "memory-token",
    expires_in: 3600,
    folder: { name: "Результаты" },
    policy: {
      max_files: 20,
      max_file_bytes: 512 * 1024 * 1024,
      max_total_bytes: 2 * 1024 * 1024 * 1024,
      supported_mime_prefixes: ["audio/", "video/"],
      supported_mime_types: ["application/ogg"],
    },
    uploads: [{ operation_id: OPERATION_ID, capability }],
  };
}

function json(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("directDriveUpload", () => {
  it("rejects unsupported, empty, over-count and over-total browser selections", () => {
    expect(directDriveFileSelectionError([new File(["x"], "note.txt", { type: "text/plain" })]))
      .toMatch(/audio\/video/i);
    expect(directDriveFileSelectionError([new File([], "empty.wav", { type: "audio/wav" })]))
      .toMatch(/пустой/i);
    expect(directDriveFileSelectionError(
      Array.from({ length: DIRECT_DRIVE_UPLOAD_MAX_FILES + 1 }, (_, index) =>
        new File(["x"], `${index}.wav`, { type: "audio/wav" }),
      ),
    )).toMatch(/20/);
    const huge = new File(["x"], "huge.wav", { type: "audio/wav" });
    Object.defineProperty(huge, "size", { value: 2 * 1024 * 1024 * 1024 + 1 });
    expect(directDriveFileSelectionError([huge])).toMatch(/2 ГБ/);
  });

  it("accepts only a bounded session matching every requested operation", () => {
    const parsed = parseDirectDriveUploadSession(sessionCandidate(), [item()]);
    expect(parsed?.accessToken).toBe("memory-token");
    expect(parsed?.folderName).toBe("Результаты");
    expect(parsed?.capabilities.get(OPERATION_ID)).toBe("a".repeat(96));

    expect(parseDirectDriveUploadSession(
      { ...sessionCandidate(), access_token: "token with spaces" },
      [item()],
    )).toBeNull();
    expect(parseDirectDriveUploadSession(
      { ...sessionCandidate(), uploads: [] },
      [item()],
    )).toBeNull();
    expect(parseDirectDriveUploadSession(
      { ...sessionCandidate(), uploads: [{ operation_id: OPERATION_ID, capability: "https://secret" }] },
      [item()],
    )).toBeNull();
  });

  it("reuses an existing idempotency marker without starting or sending bytes", async () => {
    const fetchMock = vi.fn(async () => json({ files: [{ id: "existing-file" }] }));
    const transport = vi.fn();
    const progress = vi.fn();

    await expect(uploadDirectDriveFile({
      item: item(),
      folderId: "folder-id",
      accessToken: "memory-token",
      expiresIn: 3600,
      fetchImpl: fetchMock as typeof fetch,
      uploadTransport: transport,
      onProgress: progress,
    })).resolves.toEqual({ fileId: "existing-file", reused: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    const lookupUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(lookupUrl.searchParams.get("q")).toContain(
      `key='${DIRECT_DRIVE_UPLOAD_APP_PROPERTY}' and value='${OPERATION_ID}'`,
    );
    expect(transport).not.toHaveBeenCalled();
    expect(progress).toHaveBeenLastCalledWith({
      loadedBytes: 5,
      totalBytes: 5,
      percent: 100,
    });
  });

  it("creates one resumable session, preserves metadata and verifies the marker after upload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ files: [] }))
      .mockResolvedValueOnce(new Response(null, {
        status: 200,
        headers: {
          Location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=opaque",
        },
      }))
      .mockResolvedValueOnce(json({ files: [{ id: "created-file" }] }));
    const transport = vi.fn(async (request) => {
      request.onProgress?.({ loadedBytes: 5, totalBytes: 5, percent: 100 });
      return { ok: true, status: 200 };
    });

    await expect(uploadDirectDriveFile({
      item: item(),
      folderId: "folder-id",
      accessToken: "memory-token",
      expiresIn: 3600,
      fetchImpl: fetchMock as typeof fetch,
      uploadTransport: transport,
    })).resolves.toEqual({ fileId: "created-file", reused: false });

    const start = fetchMock.mock.calls[1];
    const metadata = JSON.parse(String((start[1] as RequestInit).body));
    expect(metadata).toEqual({
      name: "Запись.wav",
      parents: ["folder-id"],
      appProperties: { [DIRECT_DRIVE_UPLOAD_APP_PROPERTY]: OPERATION_ID },
    });
    expect((start[1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer memory-token",
      "X-Upload-Content-Type": "audio/wav",
      "X-Upload-Content-Length": "5",
    });
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0][0]).toMatchObject({
      url: "https://www.googleapis.com/upload/drive/v3/files?upload_id=opaque",
      file: expect.objectContaining({ name: "Запись.wav", type: "audio/wav", size: 5 }),
    });
  });

  it("fails closed on an unsafe upload location and preserves ambiguous cancellation", async () => {
    const unsafeFetch = vi
      .fn()
      .mockResolvedValueOnce(json({ files: [] }))
      .mockResolvedValueOnce(new Response(null, {
        status: 200,
        headers: { Location: "https://evil.test/upload?upload_id=opaque" },
      }));
    const transport = vi.fn();
    await expect(uploadDirectDriveFile({
      item: item(),
      folderId: "folder-id",
      accessToken: "memory-token",
      expiresIn: 3600,
      fetchImpl: unsafeFetch as typeof fetch,
      uploadTransport: transport,
    })).rejects.toThrow("direct_drive_session_invalid");
    expect(transport).not.toHaveBeenCalled();

    const abortedFetch = vi
      .fn()
      .mockResolvedValueOnce(json({ files: [] }))
      .mockResolvedValueOnce(new Response(null, {
        status: 200,
        headers: {
          Location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=opaque",
        },
      }));
    await expect(uploadDirectDriveFile({
      item: item(),
      folderId: "folder-id",
      accessToken: "memory-token",
      expiresIn: 3600,
      fetchImpl: abortedFetch as typeof fetch,
      uploadTransport: vi.fn(async () => {
        throw new DirectUploadAmbiguousError("direct_upload_aborted");
      }),
    })).rejects.toMatchObject({ name: "DirectUploadAmbiguousError" });
  });
});
