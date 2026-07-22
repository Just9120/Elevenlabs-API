import {
  isSupportedMediaFile,
  isSupportedSourceMimeType,
  normalizeSourceUploadPolicy,
  sourceUploadAccept,
  type SourceUploadPolicy,
} from "./sourceUploadPolicy";

const policy: SourceUploadPolicy = {
  local_upload_enabled: true,
  max_upload_bytes: 512 * 1024 * 1024,
  supported_mime_prefixes: ["audio/", "video/"],
  supported_mime_types: ["application/ogg"],
};

describe("source upload policy", () => {
  it("normalizes a valid browser-safe policy", () => {
    expect(
      normalizeSourceUploadPolicy({
        local_upload_enabled: false,
        max_upload_bytes: 1024,
        supported_mime_prefixes: [" Audio/ ", "audio/", "VIDEO/"],
        supported_mime_types: [" Application/OGG ", "application/ogg"],
        storage_bucket: "must-be-ignored",
      }),
    ).toEqual({
      local_upload_enabled: false,
      max_upload_bytes: 1024,
      supported_mime_prefixes: ["audio/", "video/"],
      supported_mime_types: ["application/ogg"],
    });
  });

  it.each([
    null,
    "invalid",
    {},
    {
      local_upload_enabled: "true",
      max_upload_bytes: 1024,
      supported_mime_prefixes: ["audio/"],
      supported_mime_types: [],
    },
    {
      local_upload_enabled: true,
      max_upload_bytes: 0,
      supported_mime_prefixes: ["audio/"],
      supported_mime_types: [],
    },
    {
      local_upload_enabled: true,
      max_upload_bytes: 1.5,
      supported_mime_prefixes: ["audio/"],
      supported_mime_types: [],
    },
    {
      local_upload_enabled: true,
      max_upload_bytes: 1024,
      supported_mime_prefixes: "audio/",
      supported_mime_types: [],
    },
    {
      local_upload_enabled: true,
      max_upload_bytes: 1024,
      supported_mime_prefixes: ["audio/", 7],
      supported_mime_types: [],
    },
    {
      local_upload_enabled: true,
      max_upload_bytes: 1024,
      supported_mime_prefixes: [" "],
      supported_mime_types: [],
    },
    {
      local_upload_enabled: true,
      max_upload_bytes: 1024,
      supported_mime_prefixes: [],
      supported_mime_types: [],
    },
  ])("rejects malformed policy %#", (value) => {
    expect(normalizeSourceUploadPolicy(value)).toBeNull();
  });

  it.each([
    ["audio/ogg", true],
    [" VIDEO/MP4 ", true],
    ["application/ogg", true],
    ["application/x-msdownload", false],
    ["", false],
  ])("matches MIME type %j", (mimeType, expected) => {
    expect(isSupportedSourceMimeType(mimeType, policy)).toBe(expected);
  });

  it("builds the file input accept value from the server policy", () => {
    expect(sourceUploadAccept(policy)).toBe(
      "audio/*,video/*,application/ogg",
    );
  });

  it("checks a selected file through the same MIME contract", () => {
    expect(
      isSupportedMediaFile(
        new File(["audio"], "audio.mp3", { type: "audio/mpeg" }),
        policy,
      ),
    ).toBe(true);
    expect(
      isSupportedMediaFile(
        new File(["binary"], "binary.bin", {
          type: "application/octet-stream",
        }),
        policy,
      ),
    ).toBe(false);
  });
});
