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

  it("focuses the safe action, traps Tab, closes on Escape, and returns focus", async () => {
    const onCancel = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "Открыть";
    document.body.append(trigger);
    trigger.focus();
    const view = render(
      <ConfirmClearDialog
        title="Очистить?"
        description="Подтверждение"
        pending={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const no = screen.getByRole("button", { name: "Нет" });
    const yes = screen.getByRole("button", { name: "Да" });
    expect(no).toHaveFocus();
    await userEvent.tab();
    expect(yes).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(no).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();

    view.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
