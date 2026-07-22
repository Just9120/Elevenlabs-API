import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JobСтатус, TranscriptionJob } from "./jobModel";
import { JobCardActions } from "./JobCardActions";

function job(
  status: JobСтатус,
  cancelRequestedAt: string | null = null,
): TranscriptionJob {
  return {
    id: "job-1",
    project_id: "project-1",
    status,
    title: "Interview",
    provider: "elevenlabs",
    source_count: 1,
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:00:00Z",
    cancelled_at: null,
    cancel_requested_at: cancelRequestedAt,
    attempt_count: 0,
    started_at: null,
    finished_at: null,
    error_code: null,
    error_message: null,
    output_folder: null,
  };
}

describe("JobCardActions", () => {
  it("opens and cancels a queued job", async () => {
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    render(
      <JobCardActions
        job={job("queued")}
        onOpen={onOpen}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    await userEvent.click(screen.getByRole("button", { name: "Отменить" }));

    expect(onOpen).toHaveBeenCalledWith("job-1");
    expect(onCancel).toHaveBeenCalledWith("job-1");
  });

  it("requests cancellation for an active processing job", async () => {
    const onCancel = vi.fn();
    render(
      <JobCardActions
        job={job("processing")}
        onOpen={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Запросить отмену" }),
    );

    expect(onCancel).toHaveBeenCalledWith("job-1");
    expect(screen.queryByText("Отмена запрошена")).not.toBeInTheDocument();
  });

  it("locks cancellation after a processing cancellation request", () => {
    render(
      <JobCardActions
        job={job("processing", "2026-07-22T10:05:00Z")}
        onOpen={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Отмена запрошена")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Запросить отмену" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Отменить" }),
    ).not.toBeInTheDocument();
  });

  it.each(["completed", "failed", "cancelled"] as const)(
    "only opens a terminal %s job",
    (status) => {
      render(
        <JobCardActions
          job={job(status)}
          onOpen={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "Открыть" })).toBeInTheDocument();
      expect(screen.getAllByRole("button")).toHaveLength(1);
    },
  );
});
