import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JobSource, TranscriptionJob } from "./jobModel";
import type { JobRetryState } from "./jobRecoveryModel";
import { JobDetailSection } from "./JobDetailSection";

function source(
  id: string,
  position: number,
  driveFileUrl: string | null,
): JobSource {
  return {
    id,
    project_id: "project-1",
    source_type: "local_upload",
    original_filename: `${id}.ogg`,
    mime_type: "audio/ogg",
    size_bytes: 1024,
    drive_file_url: driveFileUrl,
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
  status: "failed",
  title: "Interview",
  provider: "elevenlabs",
  language_mode: "ru",
  source_count: 2,
  sources: [
    source("second", 1, "https://evil.example/file/token"),
    source("first", 0, "https://drive.example/file/safe"),
  ],
  created_at: "2026-07-22T10:00:00Z",
  updated_at: "2026-07-22T10:00:00Z",
  cancelled_at: null,
  cancel_requested_at: null,
  attempt_count: 1,
  started_at: null,
  finished_at: null,
  error_code: "provider_error",
  error_message: "Provider failed",
  output_folder: {
    name: "Results",
    web_view_url: "https://drive.example/folder/safe",
  },
};

function retry(overrides: Partial<JobRetryState> = {}): JobRetryState {
  return {
    loading: false,
    posting: false,
    error: "",
    message: "",
    data: {
      job_id: "job-1",
      job_status: "failed",
      available: true,
      reason: "available",
      attempt_count: 1,
      max_attempts: 3,
      missing_output_count: 1,
      retry_safe_source_count: 1,
    },
    ...overrides,
  };
}

describe("JobDetailSection", () => {
  it("renders sorted sources and only safe resource links", () => {
    render(<JobDetailSection job={job} retry={undefined} onRetry={vi.fn()} />);

    const detail = screen.getByLabelText("Job detail job-1");
    expect(detail).toHaveTextContent("Язык: Русский");
    const text = detail.textContent ?? "";
    expect(text.indexOf("1. first.ogg")).toBeLessThan(
      text.indexOf("2. second.ogg"),
    );
    expect(
      within(detail).getByRole("link", {
        name: "Открыть папку результата в Google Drive в новой вкладке",
      }),
    ).toHaveAttribute("href", "https://drive.example/folder/safe");
    expect(
      within(detail).getByRole("link", {
        name: "Открыть файл в Google Drive в новой вкладке",
      }),
    ).toHaveAttribute("href", "https://drive.example/file/safe");
    expect(detail).not.toHaveTextContent("https://evil.example/file/token");
  });

  it("runs an available safe retry for the current job", async () => {
    const onRetry = vi.fn();
    render(<JobDetailSection job={job} retry={retry()} onRetry={onRetry} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Повторить безопасную обработку" }),
    );

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledWith("job-1");
  });

  it("shows unavailable, pending, message, and error retry states", () => {
    const unavailable = retry({
      posting: true,
      message: "Повтор запущен",
      error: "Повтор не выполнен",
      data: {
        ...retry().data!,
        available: false,
        reason: "attempt_limit_reached",
      },
    });
    render(
      <JobDetailSection job={job} retry={unavailable} onRetry={vi.fn()} />,
    );

    const action = screen.getByLabelText("Safe retry action");
    expect(action).toHaveTextContent("Достигнут предел попыток");
    expect(action).toHaveTextContent("Повтор запущен");
    expect(action).toHaveTextContent("Повтор не выполнен");
    expect(within(action).queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the missing output folder state", () => {
    render(
      <JobDetailSection
        job={{ ...job, status: "completed", output_folder: null }}
        retry={undefined}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Папка результата не задана.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Safe retry action")).not.toBeInTheDocument();
  });
});
