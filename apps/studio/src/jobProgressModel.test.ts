import { describe, expect, it } from "vitest";
import {
  JOB_PROGRESS_STAGE_KEYS,
  confirmedProgressPercent,
  parseProjectJobProgressResponse,
  terminalProgressState,
  type JobProgressState,
} from "./jobProgressModel";

const valid = {
  jobs: [
    {
      job_id: "job-1",
      job_status: "processing",
      tracking_precision: "checkpoint",
      completed_source_count: 0,
      total_source_count: 1,
      active_source_position: 0,
      current_stage: "provider_processing",
      sources: [
        {
          position: 0,
          name: "Interview.mp4",
          status: "processing",
          provider_parts: { completed: 1, total: 4 },
          stages: JOB_PROGRESS_STAGE_KEYS.map((key) => ({
            key,
            status:
              key === "provider_processing"
                ? "active"
                : key === "preparation" ||
                    key === "audio_extraction" ||
                    key === "splitting"
                  ? "completed"
                  : "pending",
            applicability:
              key === "splitting" || key === "part_merge"
                ? "conditional"
                : "required",
          })),
        },
      ],
    },
  ],
};

describe("job progress response parser", () => {
  it("accepts the exact safe checkpoint contract", () => {
    expect(parseProjectJobProgressResponse(valid)).toEqual(valid);
  });

  it("computes only confirmed checkpoints and completes a pinned terminal job", () => {
    const parsed = parseProjectJobProgressResponse(valid);
    expect(parsed).not.toBeNull();
    const state: JobProgressState = {
      loading: false,
      error: "",
      data: parsed!.jobs[0],
    };

    expect(confirmedProgressPercent(state.data!)).toBe(54);
    const completed = terminalProgressState(state, "completed");
    expect(completed?.data?.job_status).toBe("completed");
    expect(completed?.data?.current_stage).toBeNull();
    expect(completed?.data?.completed_source_count).toBe(1);
    expect(confirmedProgressPercent(completed!.data!)).toBe(100);
  });

  it("fails closed on private extras and inconsistent authority", () => {
    expect(
      parseProjectJobProgressResponse({
        ...valid,
        lease_owner_id: "worker-private",
      }),
    ).toBeNull();
    expect(
      parseProjectJobProgressResponse({
        jobs: [{ ...valid.jobs[0], current_stage: "google_docs_output" }],
      }),
    ).toBeNull();
    expect(
      parseProjectJobProgressResponse({
        jobs: [
          {
            ...valid.jobs[0],
            sources: [
              {
                ...valid.jobs[0].sources[0],
                stages: valid.jobs[0].sources[0].stages.map((stage) =>
                  stage.key === "audio_extraction"
                    ? {
                        ...stage,
                        status: "not_applicable",
                        applicability: "required",
                      }
                    : stage,
                ),
              },
            ],
          },
        ],
      }),
    ).toBeNull();
    expect(
      parseProjectJobProgressResponse({
        jobs: [
          {
            ...valid.jobs[0],
            sources: [
              {
                ...valid.jobs[0].sources[0],
                provider_parts: { completed: 5, total: 4 },
              },
            ],
          },
        ],
      }),
    ).toBeNull();
  });
});
