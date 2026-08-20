import {
  buildBatchCreateRequest,
  composerSegmentPlanIssue,
  composerSignature,
  formatSegmentBoundary,
  makeIdempotencyKey,
  mergeJobsWithBatchOrder,
  newComposerRow,
  parseSegmentBoundary,
  parseBatchPreflightResponse,
  resizeComposerSegments,
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
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");

    expect(newComposerRow()).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      source_id: "",
      output_folder: null,
      segments: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          start_boundary: "0:00",
          end_boundary: "",
          ends_at_source_end: true,
          title: "",
          reprocess_existing: false,
        },
      ],
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
        segments: [
          {
            id: "segment-1",
            start_boundary: "0:00",
            end_boundary: "",
            ends_at_source_end: true,
            title: "  Interview  ",
            reprocess_existing: true,
          },
        ],
      },
      {
        id: "browser-only-row-id-2",
        source_id: "source-2",
        output_folder: null,
        segments: [
          {
            id: "segment-2",
            start_boundary: "0:00",
            end_boundary: "",
            ends_at_source_end: true,
            title: "   ",
            reprocess_existing: false,
          },
        ],
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

  it("parses boundaries and expands one row into arbitrary ordered jobs", () => {
    expect(parseSegmentBoundary("0:00")).toBe(0);
    expect(parseSegmentBoundary("10:10")).toBe(610);
    expect(parseSegmentBoundary("1:02:03")).toBe(3723);
    expect(formatSegmentBoundary(610)).toBe("10:10");
    expect(formatSegmentBoundary(3723)).toBe("1:02:03");
    expect(parseSegmentBoundary("10:60")).toBeNull();
    expect(parseSegmentBoundary("text")).toBeNull();

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
          segments: [
            {
              id: "segment-a",
              start_boundary: "0:00",
              end_boundary: "10:10",
              ends_at_source_end: false,
              title: "First fragment",
              reprocess_existing: false,
            },
            {
              id: "segment-b",
              start_boundary: "10:10",
              end_boundary: "15:15",
              ends_at_source_end: false,
              title: "Second fragment",
              reprocess_existing: true,
            },
            {
              id: "segment-c",
              start_boundary: "15:20",
              end_boundary: "",
              ends_at_source_end: true,
              title: "Third fragment",
              reprocess_existing: false,
            },
          ],
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
        title: "First fragment",
        reprocess_existing: false,
        media_clip_start_seconds: 0,
        media_clip_end_seconds: 610,
      },
      {
        source_id: "source-1",
        output_folder_id: "project-one",
        title: "Second fragment",
        reprocess_existing: true,
        media_clip_start_seconds: 610,
        media_clip_end_seconds: 915,
      },
      {
        source_id: "source-1",
        output_folder_id: "project-one",
        title: "Third fragment",
        reprocess_existing: false,
        media_clip_start_seconds: 920,
        media_clip_end_seconds: null,
      },
    ]);
  });

  it("resizes a plan and rejects malformed, overlapping, or open middle fragments", () => {
    const row = newComposerRow();
    const resized = resizeComposerSegments(row.segments, 3);

    expect(resized).toHaveLength(3);
    expect(resized[0].ends_at_source_end).toBe(false);
    expect(resized[2].ends_at_source_end).toBe(true);
    expect(composerSegmentPlanIssue(resized)).toContain("фрагмент 1");

    const valid = resized.map((segment, index) => ({
      ...segment,
      start_boundary: ["0:00", "10:10", "15:20"][index],
      end_boundary: ["10:10", "15:15", ""][index],
    }));
    expect(composerSegmentPlanIssue(valid)).toBeNull();
    expect(
      composerSegmentPlanIssue([
        { ...valid[0], end_boundary: "10:20" },
        { ...valid[1], start_boundary: "10:10" },
        valid[2],
      ]),
    ).toContain("не пересекаться");
    expect(
      composerSegmentPlanIssue([
        { ...valid[0], ends_at_source_end: true },
        valid[1],
        valid[2],
      ]),
    ).toContain("только последний");
  });

  it("enforces both per-row and total batch segment limits", () => {
    const row = newComposerRow();
    expect(() => resizeComposerSegments(row.segments, 0)).toThrow(
      "Invalid segment count",
    );
    expect(() => resizeComposerSegments(row.segments, 51)).toThrow(
      "Invalid segment count",
    );

    const rowWithSegments = (id: string, count: number): ComposerRow => ({
      ...newComposerRow(),
      id,
      source_id: `source-${id}`,
      output_folder: {
        folder_id: "shared-folder",
        name: "Shared folder",
        web_view_url: null,
      },
      segments: resizeComposerSegments(newComposerRow().segments, count).map(
        (segment, index) => ({
          ...segment,
          start_boundary: `${index}:00`,
          end_boundary: index === count - 1 ? "" : `${index + 1}:00`,
          ends_at_source_end: index === count - 1,
        }),
      ),
    });

    expect(() =>
      buildBatchCreateRequest(
        [rowWithSegments("a", 25), rowWithSegments("b", 26)],
        "credential-1",
        "ru",
        false,
      ),
    ).toThrow("Batch item limit exceeded");
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
      language_mode: "en",
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
