import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSecurityPanel } from "./AccountSecurityPanel";
import { ApiError } from "./apiClient";


const api = vi.fn();
const mutateWithCsrfRetry = vi.fn();

vi.mock("./apiClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("./apiClient")>();
  return {
    ...original,
    api: (...args: unknown[]) => api(...args),
    mutateWithCsrfRetry: (...args: unknown[]) => mutateWithCsrfRetry(...args),
  };
});

const disabledStatus = {
  totp_enabled: false,
  totp_enrollment_pending: false,
  recent_auth_expires_at: null,
  password_reset_delivery: "not_configured",
};

describe("Account security panel", () => {
  beforeEach(() => {
    api.mockReset();
    mutateWithCsrfRetry.mockReset();
    api.mockResolvedValue(disabledStatus);
  });

  it("supports recent reauthentication, QR enrollment and one-time recovery codes", async () => {
    mutateWithCsrfRetry.mockImplementation((path: string) => {
      if (path === "/auth/reauth") {
        return Promise.resolve({ ok: true });
      }
      if (path === "/auth/totp/enroll") {
        return Promise.resolve({
          secret: "JBSWY3DPEHPK3PXP",
          otpauth_uri: "otpauth://totp/VoiceOps%20Studio%3Aowner",
          qr_svg_data_uri: "data:image/svg+xml;base64,PHN2Zy8+",
        });
      }
      if (path === "/auth/totp/confirm") {
        api.mockResolvedValue({ ...disabledStatus, totp_enabled: true });
        return Promise.resolve({ recovery_codes: ["AAAA1111-BBBB2222"] });
      }
      throw new Error(`Unexpected mutation: ${path}`);
    });
    const onCsrf = vi.fn();
    render(<AccountSecurityPanel csrf="csrf" onCsrf={onCsrf} />);
    await screen.findByRole("heading", { name: "Защита аккаунта" });

    await userEvent.type(screen.getByLabelText("Пароль"), "correct password");
    await userEvent.click(
      screen.getByRole("button", { name: "Подтвердить личность" }),
    );
    expect(
      await screen.findByText(/Личность подтверждена/),
    ).toBeInTheDocument();
    expect(mutateWithCsrfRetry).toHaveBeenCalledWith(
      "/auth/reauth",
      "csrf",
      onCsrf,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          password: "correct password",
          verification_code: undefined,
          recovery_code: undefined,
        }),
      }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Включить двухфакторную защиту" }),
    );
    expect(
      await screen.findByRole("img", { name: "QR-код для настройки TOTP" }),
    ).toHaveAttribute("src", "data:image/svg+xml;base64,PHN2Zy8+");
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Код подтверждения"), "123456");
    await userEvent.click(
      screen.getByRole("button", { name: "Подтвердить и включить" }),
    );
    const recoveryHeading = await screen.findByText(/показываются один раз/);
    const recoveryNotice = recoveryHeading.closest("div");
    expect(recoveryNotice).not.toBeNull();
    expect(recoveryNotice).toHaveTextContent("показываются один раз");
    expect(within(recoveryNotice as HTMLElement).getByText("AAAA1111-BBBB2222")).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(3);
  });

  it("turns a recent-auth server decision into an actionable safe message", async () => {
    mutateWithCsrfRetry.mockRejectedValue(
      new ApiError(409, "safe", {
        detail: { reason: "recent_reauthentication_required" },
      }),
    );
    render(<AccountSecurityPanel csrf="csrf" onCsrf={vi.fn()} />);
    await screen.findByRole("heading", { name: "Защита аккаунта" });
    await userEvent.click(
      screen.getByRole("button", { name: "Включить двухфакторную защиту" }),
    );
    expect(
      await screen.findByText("Сначала подтвердите личность паролем."),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("recent_reauthentication_required");
  });

  it("fails closed on malformed security state", async () => {
    api.mockResolvedValue({ ...disabledStatus, totp_enabled: "yes" });
    render(<AccountSecurityPanel csrf="csrf" onCsrf={vi.fn()} />);
    expect(
      await screen.findByText("Не удалось загрузить настройки защиты аккаунта."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Включить двухфакторную защиту" }),
    ).not.toBeInTheDocument();
  });
});
