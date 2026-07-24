import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TranscriptionAnalyticsPanel } from "./TranscriptionAnalyticsPanel";

const analytics = {
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
      sample_count: 1,
      average_seconds: 3600,
      p50_seconds: 3600,
      p95_seconds: 3600,
    },
    post_provider_output: {
      sample_count: 0,
      average_seconds: null,
      p50_seconds: null,
      p95_seconds: null,
    },
  },
};

describe("TranscriptionAnalyticsPanel", () => {
  it("loads on demand and renders safe aggregate evidence", async () => {
    const loadAnalytics = vi.fn().mockResolvedValue(analytics);
    render(
      <TranscriptionAnalyticsPanel
        projectId="project-private-id"
        loadAnalytics={loadAnalytics}
      />,
    );

    expect(loadAnalytics).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByText("Аналитика транскрибаций"),
    );
    await waitFor(() =>
      expect(loadAnalytics).toHaveBeenCalledWith("project-private-id"),
    );

    expect(await screen.findByText("ElevenLabs · scribe_v2 2")).toBeInTheDocument();
    expect(screen.getByText("Среднее: 1 ч")).toBeInTheDocument();
    const outcomes = screen.getByRole("region", {
      name: "Исходы транскрибаций",
    });
    expect(within(outcomes).getByText("Готово", { exact: false })).toHaveTextContent(
      "Готово 1",
    );
    expect(screen.queryByText("project-private-id")).not.toBeInTheDocument();
    const glossary = screen
      .getByText("Как читать метрики длительности")
      .closest("details");
    expect(glossary).not.toHaveAttribute("open");
    expect(
      within(glossary as HTMLElement).getByText("Медиана"),
    ).toBeInTheDocument();
    expect(
      within(glossary as HTMLElement).getByText("p95"),
    ).toBeInTheDocument();
    expect(
      within(glossary as HTMLElement).getByText("Замеры"),
    ).toBeInTheDocument();
  });

  it("fails closed when the aggregate DTO is malformed", async () => {
    render(
      <TranscriptionAnalyticsPanel
        projectId="p1"
        loadAnalytics={() =>
          Promise.resolve({ ...analytics, transcript_body: "private text" })
        }
      />,
    );

    await userEvent.click(screen.getByText("Аналитика транскрибаций"));
    expect(
      await screen.findByText(/Аналитика временно недоступна/),
    ).toBeInTheDocument();
    expect(screen.queryByText("private text")).not.toBeInTheDocument();
  });
});
