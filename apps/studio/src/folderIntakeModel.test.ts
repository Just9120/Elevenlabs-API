import { describe, expect, it } from "vitest";
import {
  buildLocalFolderPreview,
  localFolderRejectedReasonLabel,
} from "./folderIntakeModel";
import type { SourceUploadPolicy } from "./sourceUploadPolicy";

const policy: SourceUploadPolicy = {
  local_upload_enabled: true,
  max_upload_bytes: 10,
  supported_mime_prefixes: ["audio/", "video/"],
  supported_mime_types: ["application/ogg"],
};

function folderFile(
  path: string,
  options: FilePropertyBag & { size?: number } = {},
) {
  const content = "x".repeat(options.size ?? 1);
  const file = new File([content], path.split("/").at(-1) ?? "file", options);
  Object.defineProperty(file, "webkitRelativePath", {
    configurable: true,
    value: path,
  });
  return file;
}

describe("local folder intake model", () => {
  it("orders nested supported files and keeps only relative paths", () => {
    const preview = buildLocalFolderPreview(
      [
        folderFile("Calls/nested/b.mp4", { type: "video/mp4" }),
        folderFile("Calls/a.mp3", { type: "audio/mpeg" }),
      ],
      policy,
    );

    expect(preview).toMatchObject({
      folder_name: "Calls",
      total_count: 2,
      supported_count: 2,
      blocker: null,
      rejected: [],
    });
    expect(preview.accepted.map((item) => item.relative_path)).toEqual([
      "Calls/a.mp3",
      "Calls/nested/b.mp4",
    ]);
  });

  it("classifies unsupported, empty, oversized, duplicate and unsafe files", () => {
    const duplicate = folderFile("Calls/a.mp3", { type: "audio/mpeg" });
    const unsafe = folderFile("C:/private/secret.mp3", {
      type: "audio/mpeg",
    });
    const preview = buildLocalFolderPreview(
      [
        folderFile("Calls/a.mp3", { type: "audio/mpeg" }),
        duplicate,
        folderFile("Calls/empty.mp3", { type: "audio/mpeg", size: 0 }),
        folderFile("Calls/large.mp3", { type: "audio/mpeg", size: 11 }),
        folderFile("Calls/readme.txt", { type: "text/plain" }),
        unsafe,
      ],
      policy,
    );

    expect(preview.supported_count).toBe(1);
    expect(preview.rejected.map((item) => item.reason)).toHaveLength(5);
    expect(preview.rejected.map((item) => item.reason)).toEqual(
      expect.arrayContaining([
        "unsafe_path",
        "duplicate",
        "empty",
        "oversized",
        "unsupported",
      ]),
    );
    expect(localFolderRejectedReasonLabel("unsupported")).toBe(
      "неподдерживаемый тип",
    );
  });

  it("fails closed before upload when supported files exceed the batch limit", () => {
    const files = Array.from({ length: 51 }, (_, index) =>
      folderFile(`Calls/${String(index).padStart(2, "0")}.mp3`, {
        type: "audio/mpeg",
      }),
    );
    const preview = buildLocalFolderPreview(files, policy);

    expect(preview.blocker).toBe("over_limit");
    expect(preview.supported_count).toBe(51);
    expect(preview.accepted).toEqual([]);
  });

  it("rejects an empty or unsupported-only folder", () => {
    expect(buildLocalFolderPreview([], policy).blocker).toBe("empty");
    expect(
      buildLocalFolderPreview(
        [folderFile("Calls/readme.txt", { type: "text/plain" })],
        policy,
      ).blocker,
    ).toBe("empty");
  });
});
