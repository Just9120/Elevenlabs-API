import { describe, expect, it } from "vitest";
import {
  parseProjectJobCollection,
  parseProjectSourceCollection,
} from "./projectCollectionContracts";

const source = {
  id: "source-safe",
  project_id: "project-safe",
  source_type: "google_drive",
  original_filename: "safe.mp3",
  mime_type: "audio/mpeg",
  size_bytes: 1234,
  drive_file_url: "https://drive.google.com/file/d/safe/view",
  upload_status: "uploaded",
  uploaded_at: "2026-08-14T10:00:00Z",
  expires_at: null,
  deleted_at: null,
  delete_reason: null,
  created_at: "2026-08-14T09:00:00Z",
  updated_at: "2026-08-14T10:00:00Z",
};

const job = {
  id: "job-safe",
  project_id: "project-safe",
  status: "processing",
  title: "Safe job",
  provider: "elevenlabs",
  language_mode: "ru",
  diarization_enabled: true,
  media_clip: null,
  terminal_dismissed_at: null,
  source_count: 1,
  created_at: "2026-08-14T09:00:00Z",
  updated_at: "2026-08-14T10:00:00Z",
  cancelled_at: null,
  cancel_requested_at: null,
  attempt_count: 1,
  started_at: "2026-08-14T09:01:00Z",
  finished_at: null,
  error_code: null,
  error_message: null,
  output_folder: {
    name: "Safe folder",
    web_view_url: "https://drive.google.com/drive/folders/safe",
  },
};

describe("project collection contracts", () => {
  it("reconstructs safe source fields and discards private extras", () => {
    const parsed = parseProjectSourceCollection(
      {
        sources: [
          {
            ...source,
            drive_file_id: "private-drive-id",
            s3_object_key: "private-storage-key",
          },
        ],
        raw_page: "private-page",
      },
      "project-safe",
    );

    expect(parsed).toEqual([source]);
    expect(parsed?.[0]).not.toHaveProperty("drive_file_id");
    expect(parsed?.[0]).not.toHaveProperty("s3_object_key");
  });

  it("rejects cross-project, duplicate, and malformed source rows", () => {
    expect(
      parseProjectSourceCollection(
        { sources: [{ ...source, project_id: "project-other" }] },
        "project-safe",
      ),
    ).toBeNull();
    expect(
      parseProjectSourceCollection({ sources: [source, source] }, "project-safe"),
    ).toBeNull();
    expect(
      parseProjectSourceCollection(
        { sources: [{ ...source, upload_status: "private" }] },
        "project-safe",
      ),
    ).toBeNull();
  });

  it("reconstructs safe job fields and discards private extras", () => {
    const parsed = parseProjectJobCollection(
      {
        jobs: [
          {
            ...job,
            provider_credential_id: "private-credential-id",
            lease_owner_id: "private-worker",
            sources: [{ transcript_body: "private-transcript" }],
          },
        ],
      },
      "project-safe",
    );

    expect(parsed).toEqual([job]);
    expect(parsed?.[0]).not.toHaveProperty("provider_credential_id");
    expect(parsed?.[0]).not.toHaveProperty("lease_owner_id");
    expect(parsed?.[0]).not.toHaveProperty("sources");
  });

  it("rejects cross-project, duplicate, and malformed job rows", () => {
    expect(
      parseProjectJobCollection(
        { jobs: [{ ...job, project_id: "project-other" }] },
        "project-safe",
      ),
    ).toBeNull();
    expect(
      parseProjectJobCollection({ jobs: [job, job] }, "project-safe"),
    ).toBeNull();
    expect(
      parseProjectJobCollection(
        {
          jobs: [
            {
              ...job,
              media_clip: { start_seconds: 10, end_seconds: 5 },
            },
          ],
        },
        "project-safe",
      ),
    ).toBeNull();
  });
});
