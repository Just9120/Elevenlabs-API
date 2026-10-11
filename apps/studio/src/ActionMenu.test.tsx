import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionMenu } from "./ActionMenu";

describe("ActionMenu", () => {
  it("supports keyboard navigation, skips unavailable actions and restores focus", async () => {
    const remove = vi.fn();
    render(<ActionMenu label="Действия с тестовой папкой" items={[
      { id: "open", label: "Открыть", href: "https://drive.google.com/drive/folders/test" },
      { id: "pending", label: "Недоступно", disabled: true },
      { id: "remove", label: "Убрать из избранного", danger: true, onSelect: remove },
    ]} />);
    const launcher = screen.getByRole("button", { name: "Действия с тестовой папкой" });
    launcher.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Открыть" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Убрать из избранного" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(launcher).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{End}{Enter}");
    expect(remove).toHaveBeenCalledOnce();
    expect(launcher).toHaveFocus();
  });

  it("closes on outside clicks and prevents unsafe navigation", async () => {
    render(<><ActionMenu label="Действия" items={[{ id: "bad", label: "Небезопасная ссылка", href: "javascript:alert(1)" }]} /><button>Снаружи</button></>);
    await userEvent.click(screen.getByRole("button", { name: "Действия" }));
    expect(screen.getByRole("menuitem")).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Снаружи" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
