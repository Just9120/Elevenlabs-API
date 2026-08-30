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

  it("renders a processing cancellation timestamp", () => {
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
    expect(screen.queryByText(/Provider failed/)).not.toBeInTheDocument();
  });

  it("localizes a known failure and keeps the code in support details", async () => {
    render(
      <JobCardSummary
        job={{
          ...job,
          status: "failed",
          error_code: "provider_unavailable",
          error_message: "raw provider response",
        }}
      />,
    );

    expect(
      screen.getByText("Сервис распознавания временно недоступен. Попробуйте позже."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw provider response/)).not.toBeInTheDocument();
    expect(screen.getByText("Данные для поддержки")).toBeInTheDocument();
    expect(screen.getByText("Код ошибки: provider_unavailable")).toBeInTheDocument();
  });

  it("does not expose an unknown provider message", () => {
    render(
      <JobCardSummary
        job={{
          ...job,
          status: "failed",
          error_code: "provider_error",
          error_message: "private upstream diagnostic",
        }}
      />,
    );

    expect(
      screen.getByText(/Не удалось завершить обработку/),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("private upstream diagnostic");
  });

  it("keeps a split job identifiable in active state and history", () => {
    render(
      <JobCardSummary
        job={{
          ...job,
          media_clip: { start_seconds: 610, end_seconds: null },
        }}
      />,
    );

    expect(screen.getByText("Часть созвона: 10:10 — конец")).toBeInTheDocument();
  });
});
