import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobProgressPipeline } from "./JobProgressPipeline";
import type { JobProgressState } from "./jobProgressModel";

const state: JobProgressState = {
  loading: false,
  error: "",
  data: {
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
        stages: [
          { key: "preparation", status: "completed", applicability: "required" },
          {
            key: "audio_extraction",
            status: "completed",
            applicability: "required",
          },
          { key: "splitting", status: "completed", applicability: "conditional" },
          {
            key: "provider_processing",
            status: "active",
            applicability: "required",
          },
          { key: "part_merge", status: "pending", applicability: "conditional" },
          {
            key: "google_docs_output",
            status: "pending",
            applicability: "required",
          },
        ],
      },
    ],
  },
};

describe("JobProgressPipeline", () => {
  it("renders ordered checkpoint stages and conditional wording", () => {
    render(<JobProgressPipeline jobId="job-1" state={state} />);
    const pipeline = screen.getByLabelText("Прогресс задачи job-1");
    const steps = within(pipeline).getAllByRole("listitem");
    expect(steps).toHaveLength(6);
    expect(steps[0]).toHaveTextContent("Подготовка источника");
    expect(steps[2]).toHaveTextContent("Разбиение на части (при необходимости)");
    expect(steps[2]).toHaveTextContent("Проверено");
    expect(steps[3]).toHaveTextContent("Транскрибация ElevenLabs");
    expect(steps[3]).toHaveTextContent("Выполняется");
    expect(steps[5]).toHaveTextContent("Создание Google Docs");
  });

  it("keeps the last confirmed state visible after a refresh failure", () => {
    render(
      <JobProgressPipeline
        jobId="job-1"
        state={{ ...state, error: "refresh_failed" }}
      />,
    );
    expect(screen.getByLabelText("Прогресс задачи job-1")).toHaveTextContent(
      "показан последний подтверждённый статус",
    );
  });
});
