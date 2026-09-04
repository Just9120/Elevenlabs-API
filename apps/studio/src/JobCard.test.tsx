import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JobDetailState, TranscriptionJob } from "./jobModel";
import type {
  JobRetryState,
  OutputReconciliationState,
} from "./jobRecoveryModel";
import { JobCard } from "./JobCard";

const job: TranscriptionJob = {
  id: "job-1",
  project_id: "project-1",
  status: "failed",
  title: "Interview",
  provider: "elevenlabs",
  source_count: 0,
  sources: [],
  created_at: "2026-07-22T10:00:00Z",
  updated_at: "2026-07-22T10:00:00Z",
  cancelled_at: null,
  cancel_requested_at: null,
  attempt_count: 1,
  started_at: null,
  finished_at: null,
  error_code: "provider_error",
  error_message: "Provider failed",
  output_folder: null,
};

const detail: JobDetailState = {
  loading: false,
  error: "",
  job,
};

const reconciliation: OutputReconciliationState = {
  loading: false,
  checking: false,
  error: "",
  message: "",
  data: {
    job_id: "job-1",
    job_status: "failed",
    available: true,
    counts: {},
    cases: [],
  },
};

const retry: JobRetryState = {
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
};

function renderCard(
  overrides: Partial<React.ComponentProps<typeof JobCard>> = {},
) {
  const props: React.ComponentProps<typeof JobCard> = {
    job,
    detail,
    outputs: {
      loading: false,
      error: "",
      data: {
        job_id: "job-1",
        job_status: "failed",
        output_count: 0,
        outputs: [],
      },
    },
    reconciliation,
    retry,
    progress: undefined,
    onOpen: vi.fn(),
    onCancel: vi.fn(),
    onCheckReconciliation: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<JobCard {...props} />);
  return props;
}

describe("JobCard", () => {
  it("composes terminal job sections and routes job operations", async () => {
    const props = renderCard();

    expect(screen.getByText("Interview").closest("article")).toHaveClass(
      "terminal-job",
    );
    expect(screen.getByLabelText("Результаты транскрибации")).toBeInTheDocument();
    expect(screen.getByLabelText("Подробности транскрибации")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Проверка результата в Google Drive"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    await userEvent.click(
      screen.getByRole("button", {
        name: "Проверить созданный документ в Google Drive",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Повторить безопасную обработку" }),
    );

    expect(props.onOpen).toHaveBeenCalledWith("job-1");
    expect(props.onCheckReconciliation).toHaveBeenCalledWith("job-1");
    expect(props.onRetry).toHaveBeenCalledWith("job-1");
  });

  it("renders independent detail and output loading failures", () => {
    renderCard({
      job: { ...job, status: "queued", error_message: null },
      detail: {
        loading: true,
        error: "Не удалось загрузить детали задачи.",
        job: null,
      },
      outputs: {
        loading: true,
        error: "Не удалось загрузить результаты.",
        data: null,
      },
      reconciliation: undefined,
      retry: undefined,
    });

    expect(screen.getByText("Загрузка деталей задачи…")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByText("Загрузка результатов…")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByText("Не удалось загрузить детали задачи.")).toHaveClass(
      "error",
    );
    expect(screen.getByText("Не удалось загрузить результаты.")).toHaveClass(
      "error",
    );
    expect(screen.getByText("Interview").closest("article")).not.toHaveClass(
      "terminal-job",
    );
  });

  it("keeps a newly completed job visible until it is dismissed to history", async () => {
    const onDismissTerminal = vi.fn();
    renderCard({
      job: {
        ...job,
        status: "completed",
        error_code: null,
        error_message: null,
        finished_at: "2026-08-02T12:01:00Z",
      },
      pinnedTerminal: true,
      onDismissTerminal,
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Задача завершена на 100% — результат доступен ниже.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Убрать в историю" }),
    );
    expect(onDismissTerminal).toHaveBeenCalledWith("job-1");
  });

  it("disables terminal dismissal while its request is pending", async () => {
    const onDismissTerminal = vi.fn();
    renderCard({
      pinnedTerminal: true,
      dismissPending: true,
      onDismissTerminal,
    });

    const button = screen.getByRole("button", { name: "Убрать в историю" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onDismissTerminal).not.toHaveBeenCalled();
  });

  it("keeps an uncertain provider outcome compact until the user resolves it", async () => {
    const onCheckReconciliation = vi.fn();
    const onResolveAttention = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const candidate: TranscriptionJob = {
      ...job,
      id: "job-2",
      status: "completed",
      title: "Подтверждённый результат",
      error_code: null,
      error_message: null,
      created_at: "2026-07-23T10:00:00Z",
      finished_at: "2026-07-23T10:05:00Z",
    };

    renderCard({
      pinnedTerminal: true,
      attentionRequired: true,
      attentionCandidates: [candidate],
      onCheckReconciliation,
      onResolveAttention,
    });

    const details = screen
      .getByText("Показать детали старой ошибки")
      .closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(
      screen.queryByRole("button", { name: "Убрать в историю" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Проверить результат ещё раз" }),
    );
    expect(onCheckReconciliation).toHaveBeenCalledWith("job-1");

    await userEvent.selectOptions(
      screen.getByLabelText("Более поздний подтверждённый результат"),
      "job-2",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Связать и убрать в историю" }),
    );
    expect(onResolveAttention).toHaveBeenCalledWith(
      "job-1",
      "linked_later_result",
      "job-2",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Подтвердить: результата нет" }),
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("мог уже списать средства"),
    );
    expect(onResolveAttention).toHaveBeenCalledWith(
      "job-1",
      "acknowledged_no_result",
    );
  });
});
