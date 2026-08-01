import { describe, expect, it } from "vitest";
import type { JobСтатус, TranscriptionJob } from "./jobModel";
import {
  groupVisibleJobs,
  jobStatusSnapshot,
  newlyTerminalJobs,
} from "./jobVisibilityModel";

function job(id: string, status: JobСтатус): TranscriptionJob {
  return {
    id,
    project_id: "project-1",
    status,
    title: id,
    provider: "elevenlabs",
    language_mode: "ru",
    diarization_enabled: false,
    source_count: 1,
    created_at: "2026-08-02T12:00:00Z",
    updated_at: "2026-08-02T12:00:00Z",
    cancelled_at: null,
    cancel_requested_at: null,
    attempt_count: status === "queued" ? 0 : 1,
    started_at: status === "queued" ? null : "2026-08-02T12:00:01Z",
    finished_at: status === "completed" ? "2026-08-02T12:01:00Z" : null,
    error_code: null,
    error_message: null,
    output_folder: null,
  };
}

describe("job visibility", () => {
  it("detects only active-to-terminal transitions", () => {
    const previous = new Map<string, JobСтатус>([
      ["completed-now", "processing"],
      ["failed-now", "queued"],
      ["already-completed", "completed"],
    ]);
    const transitioned = newlyTerminalJobs(previous, [
      job("completed-now", "completed"),
      job("failed-now", "failed"),
      job("already-completed", "completed"),
      job("new-history", "completed"),
    ]);

    expect(transitioned.map((item) => item.id)).toEqual([
      "completed-now",
      "failed-now",
    ]);
  });

  it("keeps pinned terminal jobs out of collapsed history", () => {
    const jobs = [
      job("processing", "processing"),
      job("just-completed", "completed"),
      job("old-completed", "completed"),
    ];
    const grouped = groupVisibleJobs(jobs, new Set(["just-completed"]));

    expect(grouped.current.map((item) => item.id)).toEqual(["processing"]);
    expect(grouped.pinnedTerminal.map((item) => item.id)).toEqual([
      "just-completed",
    ]);
    expect(grouped.recent.map((item) => item.id)).toEqual(["old-completed"]);
    expect(jobStatusSnapshot(jobs).get("processing")).toBe("processing");
  });
});
