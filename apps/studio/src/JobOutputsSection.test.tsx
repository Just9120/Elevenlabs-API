import { render, screen, within } from "@testing-library/react";
import type { JobOutput, JobOutputsResponse } from "./jobModel";
import { JobOutputsSection } from "./JobOutputsSection";

function output(overrides: Partial<JobOutput> = {}): JobOutput {
  return {
    source_id: "source-1",
    source_position: 0,
    source_name: "recording.ogg",
    source_type: "local_upload",
    output_kind: "google_doc",
    transcript_standard: "standard",
    web_view_url: "https://docs.google.com/document/d/safe-id/edit",
    link_available: true,
    document_character_count: 42,
    document_created_at: "2026-07-22T10:00:00Z",
    persisted_at: "2026-07-22T10:01:00Z",
    ...overrides,
  };
}

function response(overrides: Partial<JobOutputsResponse> = {}) {
  return {
    job_id: "job-1",
    job_status: "processing" as const,
    output_count: 1,
    outputs: [output()],
    ...overrides,
  };
}

describe("JobOutputsSection", () => {
  it("renders the explicit empty state without output links", () => {
    render(
      <JobOutputsSection
        jobId="job-1"
        data={response({ output_count: 0, outputs: [] })}
      />,
    );

    const section = screen.getByLabelText("Результаты job-1");
    expect(section).toHaveTextContent(/Состояние задачи:\s*Обрабатывается/);
    expect(section).toHaveTextContent("Результатов: 0");
    expect(section).toHaveTextContent("Результаты пока не созданы.");
    expect(within(section).queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders output metadata and an approved Google document link", () => {
    render(<JobOutputsSection jobId="job-1" data={response()} />);

    const section = screen.getByLabelText("Результаты job-1");
    expect(section).toHaveTextContent("1. recording.ogg");
    expect(section).toHaveTextContent("Тип файла: local_upload");
    expect(section).toHaveTextContent("Тип результата: google_doc");
    expect(section).toHaveTextContent("Формат: standard");
    expect(section).toHaveTextContent("Символов: 42");
    expect(
      within(section).getByRole("link", { name: "Открыть документ" }),
    ).toHaveAttribute(
      "href",
      "https://docs.google.com/document/d/safe-id/edit",
    );
  });

  it("does not expose an unapproved output URL", () => {
    const unsafeUrl = "https://evil.example/document/token";
    render(
      <JobOutputsSection
        jobId="job-1"
        data={response({ outputs: [output({ web_view_url: unsafeUrl })] })}
      />,
    );

    const section = screen.getByLabelText("Результаты job-1");
    expect(section).toHaveTextContent("Ссылка недоступна");
    expect(within(section).queryByRole("link")).not.toBeInTheDocument();
    expect(section).not.toHaveTextContent(unsafeUrl);
  });
});
