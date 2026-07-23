import {
  composerSignature,
  makeIdempotencyKey,
  mergeJobsWithBatchOrder,
  newComposerRow,
  parseBatchPreflightResponse,
  type ComposerRow,
} from "./batchComposerModel";
import type { TranscriptionJob } from "./jobModel";

function transcriptionJob(id: string, title = id): TranscriptionJob {
  return {
    id,
    project_id: "project-1",
    status: "queued",
    title,
    provider: "elevenlabs",
    source_count: 1,
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:00:00Z",
    cancelled_at: null,
    cancel_requested_at: null,
    attempt_count: 0,
    started_at: null,
    finished_at: null,
    error_code: null,
    error_message: null,
  };
}

describe("batch composer model", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an empty row with an opaque browser identifier", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(newComposerRow()).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      source_id: "",
      output_folder: null,
      title: "",
      reprocess_existing: false,
    });
  });

  it("builds a stable request signature from server-relevant fields only", () => {
    const rows: ComposerRow[] = [
      {
        id: "browser-only-row-id",
        source_id: "source-1",
        output_folder: {
          folder_id: "folder-1",
          name: "Display name",
          web_view_url: "https://drive.google.com/drive/folders/folder-1",
        },
        title: "  Interview  ",
        reprocess_existing: true,
      },
      {
        id: "browser-only-row-id-2",
        source_id: "source-2",
        output_folder: null,
        title: "   ",
        reprocess_existing: false,
      },
    ];

    expect(
      JSON.parse(composerSignature(rows, "credential-1", "detect", true)),
    ).toEqual({
      provider_credential_id: "credential-1",
      language: "detect",
      options: { diarize: true },
      items: [
        {
          source_id: "source-1",
          output_folder_id: "folder-1",
          title: "Interview",
          reprocess_existing: true,
        },
        {
          source_id: "source-2",
          output_folder_id: "",
          title: null,
          reprocess_existing: false,
        },
      ],
    });
    expect(JSON.parse(composerSignature(rows, "", "ru", false))).toEqual(
      expect.objectContaining({ provider_credential_id: null }),
    );
  });

  it("prefixes the opaque idempotency identifier", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000002",
    );

    expect(makeIdempotencyKey()).toBe(
      "batch-00000000-0000-4000-8000-000000000002",
    );
  });

  it("accepts a coherent preflight DTO and rejects malformed or inconsistent plans", () => {
    const valid = {
      provider: "elevenlabs",
      model: "scribe_v2",
      language_mode: "ru",
      diarization_enabled: false,
      existing_result_authority: {
        status: "partial",
        reason_code: "studio_outputs_only",
      },
      items: [
        {
          position: 0,
          title: null,
          source: {
            name: "Safe source",
            source_type: "google_drive",
            mime_type: "audio/mpeg",
            size_bytes: 123,
            duration_seconds: null,
          },
          output_destination: { name: "Safe folder" },
          existing_result_match: {
            status: "no_match",
            accepted_output_count: 0,
            resolution: "not_required",
          },
          planned_outcome: "process",
        },
      ],
      summary: { process_count: 1, skip_count: 0, blocked_count: 0 },
      confirmation_required: true,
    };

    expect(parseBatchPreflightResponse(valid)).toEqual(valid);
    expect(parseBatchPreflightResponse({ ...valid, model: "other" })).toBeNull();
    expect(
      parseBatchPreflightResponse({
        ...valid,
        transcript_body: "must-not-be-accepted",
      }),
    ).toBeNull();
    expect(
      parseBatchPreflightResponse({
        ...valid,
        items: [
          {
            ...valid.items[0],
            existing_result_match: {
              status: "indeterminate",
              accepted_output_count: 0,
              resolution: "required",
            },
            planned_outcome: "blocked",
          },
        ],
        summary: { process_count: 0, skip_count: 0, blocked_count: 1 },
      }),
    ).toBeNull();
    expect(
      parseBatchPreflightResponse({
        ...valid,
        summary: { process_count: 0, skip_count: 1, blocked_count: 0 },
      }),
    ).toBeNull();
    expect(
      parseBatchPreflightResponse({
        ...valid,
        items: [{ ...valid.items[0], position: 2 }],
      }),
    ).toBeNull();
    expect(
      parseBatchPreflightResponse({
        ...valid,
        items: [
          {
            ...valid.items[0],
            existing_result_match: {
              status: "accepted_match",
              accepted_output_count: 1,
              resolution: "required",
            },
            planned_outcome: "process",
          },
        ],
      }),
    ).toBeNull();
    expect(parseBatchPreflightResponse(null)).toBeNull();
  });

  it("keeps batch order, uses fresh jobs, and appends unrelated jobs", () => {
    const currentJobs = [
      transcriptionJob("job-a", "Fresh A"),
      transcriptionJob("job-b", "Fresh B"),
      transcriptionJob("job-c", "Fresh C"),
    ];
    const batchJobs = [
      transcriptionJob("job-b", "Stale B"),
      transcriptionJob("job-d", "Batch D"),
    ];

    const merged = mergeJobsWithBatchOrder(currentJobs, batchJobs);

    expect(merged.map((job) => job.id)).toEqual([
      "job-b",
      "job-d",
      "job-a",
      "job-c",
    ]);
    expect(merged[0].title).toBe("Fresh B");
    expect(merged[1].title).toBe("Batch D");
    expect(currentJobs.map((job) => job.id)).toEqual([
      "job-a",
      "job-b",
      "job-c",
    ]);
  });

  it("returns the original jobs when there is no batch ordering", () => {
    const jobs = [transcriptionJob("job-a")];

    expect(mergeJobsWithBatchOrder(jobs, [])).toBe(jobs);
  });
});
