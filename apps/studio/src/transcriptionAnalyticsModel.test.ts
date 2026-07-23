import { describe, expect, it } from "vitest";
import { parseTranscriptionAnalytics } from "./transcriptionAnalyticsModel";

const valid = {
  scope: "project_all_time",
  totals: { jobs: 3, sources: 4, outputs: 1 },
  outcomes: {
    queued: 1,
    processing: 0,
    completed: 1,
    failed: 1,
    cancelled: 0,
  },
  configuration: {
    provider_model: { elevenlabs_scribe_v2: 2, unknown: 1 },
    language_mode: { ru: 2, detect: 1, other: 0 },
    diarization: { enabled: 1, disabled: 2 },
  },
  durations: {
    queue: {
      sample_count: 2,
      average_seconds: 15,
      p50_seconds: 10,
      p95_seconds: 20,
    },
    processing: {
      sample_count: 2,
      average_seconds: 75,
      p50_seconds: 60,
      p95_seconds: 90,
    },
    provider_processing: {
      sample_count: 2,
      average_seconds: 25,
      p50_seconds: 20,
      p95_seconds: 30,
    },
    post_provider_output: {
      sample_count: 0,
      average_seconds: null,
      p50_seconds: null,
      p95_seconds: null,
    },
  },
};

describe("transcription analytics parser", () => {
  it("accepts the exact aggregate contract", () => {
    expect(parseTranscriptionAnalytics(valid)).toEqual(valid);
  });

  it("fails closed on private extras and inconsistent counts", () => {
    expect(
      parseTranscriptionAnalytics({ ...valid, project_id: "private-project" }),
    ).toBeNull();
    expect(
      parseTranscriptionAnalytics({
        ...valid,
        totals: { ...valid.totals, jobs: 4 },
      }),
    ).toBeNull();
    expect(
      parseTranscriptionAnalytics({
        ...valid,
        durations: {
          ...valid.durations,
          queue: {
            ...valid.durations.queue,
            provider_request_started_at: "private-timestamp",
          },
        },
      }),
    ).toBeNull();
  });

  it("rejects incomplete or invalid duration summaries", () => {
    expect(
      parseTranscriptionAnalytics({
        ...valid,
        durations: {
          ...valid.durations,
          queue: {
            sample_count: 0,
            average_seconds: 1,
            p50_seconds: null,
            p95_seconds: null,
          },
        },
      }),
    ).toBeNull();
    expect(
      parseTranscriptionAnalytics({
        ...valid,
        durations: {
          ...valid.durations,
          queue: {
            ...valid.durations.queue,
            p95_seconds: -1,
          },
        },
      }),
    ).toBeNull();
  });
});
