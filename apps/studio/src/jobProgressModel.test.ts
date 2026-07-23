import { describe, expect, it } from "vitest";
import {
  JOB_PROGRESS_STAGE_KEYS,
  parseProjectJobProgressResponse,
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
  });
});
