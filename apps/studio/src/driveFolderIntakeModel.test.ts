import { describe, expect, it } from "vitest";
import {
  driveFolderBlockedMessage,
  driveFolderSkipReasonLabel,
  parseDriveFolderPreview,
} from "./driveFolderIntakeModel";

const validPreview = {
  folder: { id: "folder", name: "Calls" },
  total_file_count: 2,
  folder_count: 2,
  supported_count: 1,
  skipped_count: 1,
  accepted: [
    {
      id: "file-a",
      name: "a.mp3",
      mime_type: "audio/mpeg",
      size_bytes: 10,
      created_time: "2026-08-20T10:00:00Z",
      relative_path: "Calls/a.mp3",
    },
  ],
  skipped: [
    { relative_path: "Calls/readme.txt", reason: "unsupported" },
  ],
  blocker: null,
  complete: true,
  preview_token: "a".repeat(64),
};

describe("Drive folder intake contracts", () => {
  it("accepts a complete bounded server preview", () => {
    expect(parseDriveFolderPreview(validPreview)).toEqual(validPreview);
    expect(driveFolderSkipReasonLabel("creation_time_unavailable")).toBe(
      "недоступна исходная дата создания",
    );
  });

  it.each([
    { ...validPreview, preview_token: "raw-secret" },
    { ...validPreview, supported_count: 2 },
    { ...validPreview, skipped_count: 0 },
    {
      ...validPreview,
      accepted: [validPreview.accepted[0], validPreview.accepted[0]],
      supported_count: 2,
      total_file_count: 3,
    },
    {
      ...validPreview,
      skipped: [{ relative_path: "Calls/x", reason: "private" }],
    },
  ])("fails closed on malformed or inconsistent payload %#", (payload) => {
    expect(parseDriveFolderPreview(payload)).toBeNull();
  });

  it("accepts only the explicit 51+ over-limit blocker shape", () => {
    expect(
      parseDriveFolderPreview({
        ...validPreview,
        total_file_count: 51,
        supported_count: 51,
        skipped_count: 0,
        accepted: [],
        skipped: [],
        blocker: "over_limit",
        complete: false,
        preview_token: null,
      }),
    ).not.toBeNull();
  });

  it("explains empty visibility and summarizes rejected reasons", () => {
    const invisible = parseDriveFolderPreview({
      ...validPreview,
      total_file_count: 0,
      supported_count: 0,
      skipped_count: 0,
      accepted: [],
      skipped: [],
      blocker: "empty",
      complete: true,
      preview_token: null,
    });
    expect(invisible).not.toBeNull();
    expect(driveFolderBlockedMessage(invisible!)).toContain(
      "текущий узкий доступ Google Drive",
    );
    expect(driveFolderBlockedMessage(invisible!)).toContain(
      "«Из Google Drive»",
    );

    const rejected = parseDriveFolderPreview({
      ...validPreview,
      total_file_count: 2,
      supported_count: 0,
      skipped_count: 2,
      accepted: [],
      skipped: [
        { relative_path: "Calls/a.pdf", reason: "unsupported" },
        {
          relative_path: "Calls/old.mp3",
          reason: "creation_time_unavailable",
        },
      ],
      blocker: "empty",
      complete: true,
      preview_token: null,
    });
    expect(rejected).not.toBeNull();
    expect(driveFolderBlockedMessage(rejected!)).toContain(
      "неподдерживаемый тип: 1",
    );
    expect(driveFolderBlockedMessage(rejected!)).toContain(
      "недоступна исходная дата создания: 1",
    );
  });
});
