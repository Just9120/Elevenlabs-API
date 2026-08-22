import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmClearDialog } from "./ConfirmClearDialog";

describe("ConfirmClearDialog", () => {
  it("requires an explicit Да and keeps Нет as a separate safe action", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmClearDialog
        title="Очистить историю?"
        description="Данные не удаляются."
        pending={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Очистить историю?" }))
      .toHaveAttribute("aria-modal", "true");
    await userEvent.click(screen.getByRole("button", { name: "Нет" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Да" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("blocks both actions while the clear request is pending", () => {
    render(
      <ConfirmClearDialog
        title="Очистить?"
        description="Подтверждение"
        pending
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Очищаем…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Нет" })).toBeDisabled();
  });
});
