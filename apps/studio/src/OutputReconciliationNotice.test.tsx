import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OutputReconciliationState } from "./jobRecoveryModel";
import { OutputReconciliationNotice } from "./OutputReconciliationNotice";

function reconciliation(
  overrides: Partial<OutputReconciliationState> = {},
): OutputReconciliationState {
  return {
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
    ...overrides,
  };
}

describe("OutputReconciliationNotice", () => {
  it("starts an explicit reconciliation check for the current job", async () => {
    const onCheck = vi.fn();
    render(
      <OutputReconciliationNotice
        jobId="job-1"
        state={reconciliation()}
        onCheck={onCheck}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Проверить созданный документ в Google Drive",
      }),
    );

    expect(onCheck).toHaveBeenCalledOnce();
    expect(onCheck).toHaveBeenCalledWith("job-1");
  });

  it("disables the action while checking and renders safe status text", () => {
    render(
      <OutputReconciliationNotice
        jobId="job-1"
        state={reconciliation({
          checking: true,
          message: "Проверка завершена: 1",
          error: "Не удалось проверить Google Drive.",
        })}
        onCheck={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Проверяем Google Drive…" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Проверка завершена: 1",
    );
    expect(screen.getByText("Не удалось проверить Google Drive.")).toHaveClass(
      "error",
    );
  });
});
