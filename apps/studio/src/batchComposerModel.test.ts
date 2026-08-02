import {
  buildBatchCreateRequest,
  composerSignature,
  formatSplitBoundary,
  makeIdempotencyKey,
  mergeJobsWithBatchOrder,
  newComposerRow,
  parseSplitBoundary,
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
      split_to_two_projects: false,
      split_boundary: "",
      second_output_folder: null,
      second_title: "",
      second_reprocess_existing: false,
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
        split_to_two_projects: false,
        split_boundary: "",
        second_output_folder: null,
        second_title: "",
        second_reprocess_existing: false,
      },
      {
        id: "browser-only-row-id-2",
        source_id: "source-2",
        output_folder: null,
        title: "   ",
        reprocess_existing: false,
        split_to_two_projects: false,
        split_boundary: "",
        second_output_folder: null,
        second_title: "",
        second_reprocess_existing: false,
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

  it("parses a manual boundary and expands one row into complementary jobs", () => {
    expect(parseSplitBoundary("10:10")).toBe(610);
    expect(parseSplitBoundary("1:02:03")).toBe(3723);
    expect(formatSplitBoundary(610)).toBe("10:10");
    expect(formatSplitBoundary(3723)).toBe("1:02:03");
    expect(parseSplitBoundary("10:60")).toBeNull();
    expect(parseSplitBoundary("0:00")).toBeNull();
    expect(parseSplitBoundary("text")).toBeNull();

    const row = newComposerRow();
    const request = buildBatchCreateRequest(
      [
        {
          ...row,
          source_id: "source-1",
          output_folder: {
            folder_id: "project-one",
            name: "Project one",
            web_view_url: null,
          },
          title: "First project",
          split_to_two_projects: true,
          split_boundary: "10:10",
          second_output_folder: {
            folder_id: "project-two",
            name: "Project two",
            web_view_url: null,
          },
          second_title: "Second project",
        },
      ],
      "credential-1",
      "ru",
      false,
    );

    expect(request.items).toEqual([
      {
        source_id: "source-1",
        output_folder_id: "project-one",
        title: "First project",
        reprocess_existing: false,
        media_clip_start_seconds: 0,
        media_clip_end_seconds: 610,
      },
      {
        source_id: "source-1",
        output_folder_id: "project-two",
        title: "Second project",
        reprocess_existing: false,
        media_clip_start_seconds: 610,
        media_clip_end_seconds: null,
      },
    ]);
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
        reason_code: "unlinked_catalog_entries_excluded",
      },
      items: [
        {
          position: 0,
          title: null,
          media_clip: null,
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
          provider_attempt_authority: {
            status: "available",
            reason_code: null,
          },
          planned_outcome: "process",
        },
      ],
      summary: { process_count: 1, skip_count: 0, blocked_count: 0 },
      confirmation_required: true,
    };

    expect(parseBatchPreflightResponse(valid)).toEqual(valid);
    expect(
      parseBatchPreflightResponse({
        ...valid,
        existing_result_authority: {
          status: "partial",
          reason_code: "studio_outputs_only",
        },
      }),
    ).toBeNull();
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
            provider_attempt_authority: {
              status: "blocked",
              reason_code: "equivalent_provider_outcome_unresolved",
            },
            planned_outcome: "blocked",
          },
        ],
        summary: { process_count: 0, skip_count: 0, blocked_count: 1 },
      }),
    ).not.toBeNull();
    expect(
      parseBatchPreflightResponse({
        ...valid,
        items: [
          {
            ...valid.items[0],
            provider_attempt_authority: {
              status: "blocked",
              reason_code: null,
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
