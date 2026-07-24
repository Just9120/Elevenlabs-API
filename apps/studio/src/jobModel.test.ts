import {
  isApprovedOutputUrl,
  jobSourceProcessingСтатус,
  jobSourceProcessingСтатусLabel,
  jobTitle,
  jobСтатусLabel,
  outputSourceLabel,
  safeJobSources,
  type JobOutput,
  type JobSource,
  type TranscriptionJob,
} from "./jobModel";

function jobSource(id: string, position: number): JobSource {
  return {
    id,
    project_id: "project-1",
    source_type: "local_upload",
    original_filename: `${id}.ogg`,
    mime_type: "audio/ogg",
    size_bytes: 1024,
    drive_file_url: null,
    upload_status: "uploaded",
    uploaded_at: "2026-07-22T09:00:00Z",
    expires_at: null,
    deleted_at: null,
    delete_reason: null,
    created_at: "2026-07-22T08:00:00Z",
    updated_at: "2026-07-22T09:00:00Z",
    position,
    job_source_status: "queued",
  };
}

const job: TranscriptionJob = {
  id: "job-1",
  project_id: "project-1",
  status: "queued",
  title: "  Интервью  ",
  provider: "elevenlabs",
  source_count: 2,
  sources: [jobSource("source-2", 1), jobSource("source-1", 0)],
  created_at: "2026-07-22T10:00:00Z",
  updated_at: "2026-07-22T10:00:00Z",
  cancelled_at: null,
  cancel_requested_at: null,
  attempt_count: 0,
  started_at: null,
  finished_at: null,
  error_code: null,
  error_message: null,
  output_folder: null,
};

function output(overrides: Partial<JobOutput> = {}): JobOutput {
  return {
    source_id: "source-1",
    source_position: 0,
    source_name: "recording.ogg",
    source_type: "local_upload",
    output_kind: "google_doc",
    transcript_standard: "standard",
    web_view_url: "https://docs.google.com/document/d/safe-id/edit",
    link_available: true,
    document_character_count: 42,
    document_created_at: "2026-07-22T10:00:00Z",
    persisted_at: "2026-07-22T10:01:00Z",
    ...overrides,
  };
}

describe("job model", () => {
  it("uses a trimmed explicit title and falls back to the creation time", () => {
    expect(jobTitle(job)).toBe("Интервью");
    expect(jobTitle({ ...job, title: " " })).toBe(
      `Транскрибация от ${new Date(job.created_at).toLocaleString("ru-RU")}`,
    );
  });

  it("sorts a copy of job sources and handles missing sources", () => {
    const original = [...(job.sources ?? [])];

    expect(safeJobSources(job).map((source) => source.id)).toEqual([
      "source-1",
      "source-2",
    ]);
    expect(job.sources).toEqual(original);
    expect(safeJobSources({ ...job, sources: undefined })).toEqual([]);
  });

  it.each([
    ["https://docs.google.com/document/d/safe-id/edit", true],
    ["https://drive.google.com/file/d/safe-id/view", true],
    ["http://docs.google.com/document/d/safe-id/edit", false],
    ["https://evil.docs.google.com/document/d/safe-id/edit", false],
    ["https://example.test/document/d/safe-id/edit", false],
    ["not-a-url", false],
    [null, false],
  ] as const)("validates output URL %j", (value, expected) => {
    expect(isApprovedOutputUrl(value)).toBe(expected);
  });

  it("builds safe source labels with one-based positions and fallbacks", () => {
    expect(outputSourceLabel(output())).toBe("1. recording.ogg");
    expect(
      outputSourceLabel(output({ source_position: null, source_name: null })),
    ).toBe("—. Файл без имени");
  });

  it("uses persisted output evidence and the terminal job contract for source status", () => {
    const source = jobSource("source-1", 0);
    const failedJob = { ...job, status: "failed" as const };
    const outputData = {
      job_id: failedJob.id,
      job_status: failedJob.status,
      output_count: 1,
      outputs: [output()],
    };

    expect(jobSourceProcessingСтатус(failedJob, source, outputData)).toBe(
      "completed",
    );
    expect(
      jobSourceProcessingСтатусLabel(failedJob, source, outputData),
    ).toBe("Завершена");
    expect(
      jobSourceProcessingСтатус(
        failedJob,
        jobSource("source-2", 1),
        outputData,
      ),
    ).toBe("failed");
    expect(
      jobSourceProcessingСтатус(
        { ...job, status: "completed" },
        source,
        null,
      ),
    ).toBe("completed");
  });

  it.each([
    ["queued", "В очереди"],
    ["processing", "Обрабатывается"],
    ["cancelled", "Отменена"],
    ["failed", "Ошибка"],
    ["completed", "Завершена"],
  ] as const)("labels %s status", (status, expected) => {
    expect(jobСтатусLabel(status)).toBe(expected);
  });
});
