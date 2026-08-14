import { act, render, screen, waitFor, within } from "@testing-library/react";
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
    language_mode: { ru: 1, en: 1, detect: 1, other: 0 },
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
      expect(loadAnalytics).toHaveBeenCalledWith(
        "project-private-id",
        expect.any(AbortSignal),
      ),
    );

    expect(await screen.findByText("ElevenLabs · scribe_v2 2")).toBeInTheDocument();
    expect(screen.getByText(/английский 1/)).toBeInTheDocument();
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

  it("bounds a stalled read and retries without exposing raw failures", async () => {
    let requests = 0;
    let stalledSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        requests += 1;
        if (requests === 1) {
          stalledSignal = init?.signal;
          return new Promise<Response>((_resolve, reject) => {
            stalledSignal?.addEventListener("abort", () =>
              reject(new Error("raw-analytics-timeout")),
            );
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify(analytics), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }),
    );
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      render(<TranscriptionAnalyticsPanel projectId="p1" />);
      await userEvent.click(screen.getByText("Аналитика транскрибаций"));
      expect(
        await screen.findByText(/Аналитика временно недоступна/),
      ).toBeInTheDocument();
      expect(stalledSignal?.aborted).toBe(true);
      expect(requests).toBe(1);
      expect(document.body.textContent).not.toContain("raw-analytics-timeout");

      await userEvent.click(screen.getByRole("button", { name: "Обновить" }));
      expect(await screen.findByText("Задачи")).toBeInTheDocument();
      expect(requests).toBe(2);
    } finally {
      timeoutSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("aborts project teardown and ignores a late stale success", async () => {
    let staleSignal: AbortSignal | undefined;
    let resolveStale: ((value: unknown) => void) | undefined;
    const currentAnalytics = {
      ...analytics,
      durations: {
        ...analytics.durations,
        queue: {
          sample_count: 2,
          average_seconds: 99,
          p50_seconds: 90,
          p95_seconds: 120,
        },
      },
    };
    const loadAnalytics = vi.fn((projectId: string, signal?: AbortSignal) => {
      if (projectId === "p1") {
        staleSignal = signal;
        return new Promise((resolve) => {
          resolveStale = resolve;
        });
      }
      return Promise.resolve(currentAnalytics);
    });
    const { rerender } = render(
      <TranscriptionAnalyticsPanel
        key="p1"
        projectId="p1"
        loadAnalytics={loadAnalytics}
      />,
    );
    await userEvent.click(screen.getByText("Аналитика транскрибаций"));
    await waitFor(() => expect(resolveStale).toBeDefined());

    rerender(
      <TranscriptionAnalyticsPanel
        key="p2"
        projectId="p2"
        loadAnalytics={loadAnalytics}
      />,
    );
    expect(staleSignal?.aborted).toBe(true);
    await userEvent.click(screen.getByText("Аналитика транскрибаций"));
    expect(await screen.findByText("Среднее: 1 мин 39 с")).toBeInTheDocument();

    await act(async () => resolveStale?.(analytics));
    expect(screen.getByText("Среднее: 1 мин 39 с")).toBeInTheDocument();
    expect(screen.queryByText("Среднее: 15 с")).not.toBeInTheDocument();
  });

  it("preserves confirmed aggregates when an explicit refresh fails", async () => {
    const loadAnalytics = vi
      .fn()
      .mockResolvedValueOnce(analytics)
      .mockRejectedValueOnce(new Error("raw-analytics-refresh-failure"));
    render(
      <TranscriptionAnalyticsPanel
        projectId="p1"
        loadAnalytics={loadAnalytics}
      />,
    );
    await userEvent.click(screen.getByText("Аналитика транскрибаций"));
    expect(await screen.findByText("ElevenLabs · scribe_v2 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Обновить" }));
    expect(
      await screen.findByText(/показана последняя подтверждённая версия/),
    ).toBeInTheDocument();
    expect(screen.getByText("ElevenLabs · scribe_v2 2")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(
      "raw-analytics-refresh-failure",
    );
    expect(loadAnalytics).toHaveBeenCalledTimes(2);
  });
});
