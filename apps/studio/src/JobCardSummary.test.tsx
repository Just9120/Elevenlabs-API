import { render, screen } from "@testing-library/react";
import type { TranscriptionJob } from "./jobModel";
import { JobCardSummary } from "./JobCardSummary";

const job: TranscriptionJob = {
  id: "job-1",
  project_id: "project-1",
  status: "queued",
  title: "  Interview  ",
  provider: "elevenlabs",
  source_count: 2,
  created_at: "2026-07-22T10:00:00Z",
  updated_at: "2026-07-22T10:00:00Z",
  cancelled_at: null,
  cancel_requested_at: null,
  attempt_count: 0,
  started_at: null,
  finished_at: null,
  error_code: null,
  error_message: null,
  output_folder: {
    name: "Results",
    web_view_url: "https://drive.google.com/drive/folders/safe-id",
  },
};

describe("JobCardSummary", () => {
  it("renders job metadata and an approved result folder link", () => {
    render(<JobCardSummary job={job} />);

    expect(screen.getByText("Interview")).toBeInTheDocument();
    expect(screen.getByText(/Статус:\s*В очереди/)).toBeInTheDocument();
    expect(screen.getByText(/Файлов:\s*2/)).toBeInTheDocument();
    expect(screen.getByText(/Папка результата:\s*Results/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Открыть папку результата в Google Drive в новой вкладке",
      }),
    ).toHaveAttribute("href", "https://drive.google.com/drive/folders/safe-id");
  });

  it("does not expose an unapproved result folder URL", () => {
    const unsafeUrl = "https://evil.example/folder/token";
    render(
      <JobCardSummary
        job={{
          ...job,
          output_folder: { name: "Unsafe folder", web_view_url: unsafeUrl },
        }}
      />,
    );

    expect(screen.getByText(/Папка результата:\s*Unsafe folder/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(unsafeUrl);
  });

  it("renders a processing cancellation timestamp and a safe error summary", () => {
    render(
      <JobCardSummary
        job={{
          ...job,
          status: "processing",
          cancel_requested_at: "2026-07-22T10:05:00Z",
          error_message: "Provider failed",
        }}
      />,
    );

    expect(screen.getByText(/Отмена запрошена:/)).toBeInTheDocument();
    expect(screen.getByText("Ошибка: Provider failed")).toBeInTheDocument();
  });
});
