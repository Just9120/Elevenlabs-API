import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { PasswordResetPanel } from "./PasswordResetPanel";

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

it("requests access email without revealing whether the account exists", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({accepted: true, delivery: "configured"})));
  vi.stubGlobal("fetch", fetcher);
  render(<PasswordResetPanel />);
  await userEvent.click(screen.getByRole("button", { name: "Забыли пароль?" }));
  await userEvent.type(screen.getByLabelText("Email аккаунта"), "synthetic@example.test");
  await userEvent.click(screen.getByRole("button", { name: "Получить письмо" }));
  expect(await screen.findByText(/Если аккаунт существует/)).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledWith("/api/auth/password-reset/request", expect.objectContaining({ method: "POST" }));
});

it("removes the single-use token from the URL and confirms the new password", async () => {
  const token = "x".repeat(43);
  window.history.replaceState(null, "", `/#password-reset=${token}`);
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ok: true})));
  vi.stubGlobal("fetch", fetcher);
  render(<PasswordResetPanel />);
  expect(window.location.hash).toBe("");
  expect(screen.queryByText(token)).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Новый пароль"), "synthetic-new-password");
  await userEvent.click(screen.getByRole("button", { name: "Изменить пароль" }));
  expect(await screen.findByText(/Пароль изменён/)).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledWith("/api/auth/password-reset/confirm", expect.objectContaining({
    body: JSON.stringify({token, new_password: "synthetic-new-password"})
  }));
});
