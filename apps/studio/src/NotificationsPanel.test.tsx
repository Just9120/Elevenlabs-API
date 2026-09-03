import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { NotificationsPanel, parseNotificationPreferences } from "./NotificationsPanel";
import { api, mutateWithCsrfRetry } from "./apiClient";

vi.mock("./apiClient", async () => {
  const actual = await vi.importActual<typeof import("./apiClient")>("./apiClient");
  return {
    ...actual,
    api: vi.fn(),
    mutateWithCsrfRetry: vi.fn(),
  };
});

const payload = {
  channels: {
    web_push: {
      enabled: false,
      configured: false,
      subscription_count: 0,
      vapid_public_key: null,
    },
    email: { enabled: false, configured: true },
    telegram: { enabled: false, configured: false },
  },
  recent_deliveries: [],
};

describe("NotificationsPanel", () => {
  beforeEach(() => {
    vi.mocked(api).mockResolvedValue(payload);
    vi.mocked(mutateWithCsrfRetry).mockResolvedValue({
      ...payload,
      channels: {
        ...payload.channels,
        email: { enabled: true, configured: true },
      },
    });
  });

  it("rejects incomplete server payloads", () => {
    expect(parseNotificationPreferences({ channels: {}, recent_deliveries: [] })).toBeNull();
    expect(parseNotificationPreferences(payload)).not.toBeNull();
  });

  it("shows unavailable channels honestly and opts email in explicitly", async () => {
    const onCsrf = vi.fn();
    render(<NotificationsPanel csrf="csrf-safe" onCsrf={onCsrf} />);

    expect(await screen.findByText("Уведомления в браузере")).toBeInTheDocument();
    expect(screen.getAllByText("Пока не настроено на сервере")).toHaveLength(2);

    const buttons = screen.getAllByRole("button", { name: "Включить" });
    expect(buttons[0]).toBeDisabled();
    expect(buttons[2]).toBeDisabled();
    await userEvent.click(buttons[1]);

    await waitFor(() =>
      expect(mutateWithCsrfRetry).toHaveBeenCalledWith(
        "/notifications/preferences",
        "csrf-safe",
        onCsrf,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ email_enabled: true }),
        }),
      ),
    );
    expect(await screen.findByText("Канал включён.")).toBeInTheDocument();
  });

  it("allows an existing opt-in to be disabled when its transport is unavailable", async () => {
    vi.mocked(api).mockResolvedValue({
      ...payload,
      channels: {
        ...payload.channels,
        email: { enabled: true, configured: false },
      },
    });
    vi.mocked(mutateWithCsrfRetry).mockResolvedValue(payload);
    const onCsrf = vi.fn();
    render(<NotificationsPanel csrf="csrf-safe" onCsrf={onCsrf} />);

    const disable = await screen.findByRole("button", { name: "Выключить" });
    expect(disable).toBeEnabled();
    await userEvent.click(disable);

    await waitFor(() =>
      expect(mutateWithCsrfRetry).toHaveBeenCalledWith(
        "/notifications/preferences",
        "csrf-safe",
        onCsrf,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ email_enabled: false }),
        }),
      ),
    );
  });
});
