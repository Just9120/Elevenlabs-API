import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PwaErrorBoundary } from "./PwaErrorBoundary";
import * as diagnostics from "./pwaDiagnostics";

function Broken() { throw new Error("synthetic-hidden"); }

describe("PwaErrorBoundary", () => {
  it("renders a safe Russian fallback and reports one safe event", async () => {
    const emit = vi.spyOn(diagnostics, "emitPwaDiagnostic").mockImplementation(() => undefined);
    const reload = vi.fn();
    Object.defineProperty(window, "location", { value: { reload }, writable: true });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<PwaErrorBoundary><Broken /></PwaErrorBoundary>);
    expect(screen.getByText("Приложение временно недоступно")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("synthetic-hidden");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("PWA_APP_ERROR", { boundary: "react_boundary", error_code: "app_error", retryable: false });
    await userEvent.click(screen.getByRole("button", { name: "Обновить страницу" }));
    expect(reload).toHaveBeenCalled();
  });
});
