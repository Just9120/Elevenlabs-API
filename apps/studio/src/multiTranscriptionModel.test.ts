import { describe, expect, it } from "vitest";
import type { JobСтатус, TranscriptionJob } from "./jobModel";
import {
  buildTranscriptionPresentations,
  groupTranscriptionPresentations,
} from "./multiTranscriptionModel";

function job(
  id: string,
  status: JobСтатус,
  batch?: { id: string; position: number },
  terminalDismissedAt: string | null = null,
): TranscriptionJob {
  return {
    id,
    project_id: "project-1",
    status,
    title: id,
    provider: "elevenlabs",
    batch,
    terminal_dismissed_at: terminalDismissedAt,
    source_count: 1,
    created_at: "2026-08-22T10:00:00Z",
    updated_at: "2026-08-22T10:00:00Z",
    cancelled_at: null,
    cancel_requested_at: null,
    attempt_count: 0,
    started_at: null,
    finished_at: null,
    error_code: null,
    error_message: null,
  };
}

describe("multi-transcription presentation", () => {
  it("collapses one batch into one ordered presentation", () => {
    const batchId = "multi_0123456789abcdef0123456789abcdef";
    const presentations = buildTranscriptionPresentations([
      job("newest-single", "queued"),
      job("batch-second", "processing", { id: batchId, position: 1 }),
      job("batch-first", "completed", { id: batchId, position: 0 }),
      job("oldest-single", "completed"),
    ]);

    expect(presentations.map((item) => item.id)).toEqual([
      "job:newest-single",
      `batch:${batchId}`,
      "job:oldest-single",
    ]);
    expect(presentations[1].kind).toBe("multi");
    expect(presentations[1].jobs.map((item) => item.id)).toEqual([
      "batch-first",
      "batch-second",
    ]);
  });

  it("keeps the complete batch current or pinned instead of splitting its items", () => {
    const batchId = "multi_fedcba9876543210fedcba9876543210";
    const active = groupTranscriptionPresentations([
      job("done", "completed", { id: batchId, position: 0 }),
      job("active", "processing", { id: batchId, position: 1 }),
    ]);
    expect(active.current).toHaveLength(1);
    expect(active.pinnedTerminal).toHaveLength(0);

    const pinned = groupTranscriptionPresentations([
      job("dismissed", "completed", { id: batchId, position: 0 }, "2026-08-22T11:00:00Z"),
      job("failed", "failed", { id: batchId, position: 1 }),
    ]);
    expect(pinned.pinnedTerminal).toHaveLength(1);
    expect(pinned.recent).toHaveLength(0);
  });

  it("pins a dismissed terminal task that still requires attention", () => {
    const recovery = job(
      "recovery",
      "failed",
      undefined,
      "2026-08-22T11:00:00Z",
    );
    recovery.history_attention_required = true;

    const groups = groupTranscriptionPresentations([recovery]);

    expect(groups.pinnedTerminal).toHaveLength(1);
    expect(groups.recent).toHaveLength(0);
  });
});
