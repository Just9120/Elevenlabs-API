import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElevenLabsAccountPanel } from "./ElevenLabsAccountPanel";


const validAccount = {
  credential: { id: "cred-1", label: "Основной", active_version: 2 },
  state: "current",
  fetched_at: "2026-08-30T12:00:00Z",
  last_attempt_at: "2026-08-30T12:00:00Z",
  error_code: null,
  subscription: {
    tier: "creator",
    status: "active",
    period_usage: 2500,
    period_limit: 10000,
    period_remaining: 7500,
    period_unit: "characters",
    reset_at: "2026-09-01T00:00:00Z",
    billing_period: "monthly_period",
    refresh_period: "monthly_period",
    usage_based_billing: { enabled: true, max_extra_credits: "5000" },
    current_overage: { amount: "1.25000000", currency: "USD" },
    open_invoices: { present: true, count: 1, total_due_cents: 125, currency: "USD" },
    next_invoice: {
      amount_due_cents: 2299,
      subtotal_cents: 2000,
      tax_cents: 299,
      currency: "USD",
      payment_attempt_at: "2026-09-01T00:00:00Z",
    },
    pending_change_present: false,
  },
  workspace_usage: {
    state: "current",
    fetched_at: "2026-08-30T12:00:00Z",
    error_code: null,
    window: {
      start: "2026-08-01T00:00:00Z",
      end: "2026-08-30T12:00:00Z",
      basis: "provider_reset_period",
    },
    unit: "credits",
    total: "140.00000000",
    products: [{ product_type: "speech-to-text", credits: "140.00000000" }],
  },
};


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

describe("ElevenLabs account panel", () => {
  beforeEach(() => {
    api.mockReset();
    mutateWithCsrfRetry.mockReset();
  });

  it("separates provider actuals from nominal job cost and refreshes explicitly", async () => {
    api.mockResolvedValue({ accounts: [validAccount] });
    mutateWithCsrfRetry.mockResolvedValue({
      account: {
        ...validAccount,
        subscription: {
          ...validAccount.subscription,
          current_overage: { amount: "2.50000000", currency: "USD" },
        },
      },
    });
    const onCsrf = vi.fn();
    render(
      <ElevenLabsAccountPanel csrf="csrf-value" onCsrf={onCsrf} />,
    );

    expect(await screen.findByText("creator")).toBeInTheDocument();
    expect(screen.getByText(/2 500 из 10 000/)).toBeInTheDocument();
    expect(screen.getByText(/оставшиеся кредиты и дополнительные расходы/)).toBeInTheDocument();
    expect(screen.getByText(/без пересчёта в минуты/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("api_key");

    await userEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(mutateWithCsrfRetry).toHaveBeenCalledTimes(1));
    expect(mutateWithCsrfRetry).toHaveBeenCalledWith(
      "/provider-accounts/elevenlabs/cred-1/refresh",
      "csrf-value",
      onCsrf,
      { method: "POST" },
    );
    expect(await screen.findByText(/2,50/)).toBeInTheDocument();
  });

  it("shows scope failure without fabricating billing values", async () => {
    api.mockResolvedValue({
      accounts: [
        {
          ...validAccount,
          state: "unavailable",
          fetched_at: null,
          error_code: "provider_scope_rejected",
          subscription: null,
          workspace_usage: {
            state: "unavailable",
            fetched_at: null,
            error_code: "provider_scope_rejected",
            window: null,
            unit: null,
            total: null,
            products: [],
          },
        },
      ],
    });
    render(<ElevenLabsAccountPanel csrf="csrf" onCsrf={vi.fn()} />);
    expect((await screen.findAllByText(/не хватает доступа/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Актуальные данные подписки пока не получены/)).toBeInTheDocument();
    expect(screen.queryByText("creator")).not.toBeInTheDocument();
  });

  it("shows account data when invoice breakdown and payment date are unavailable", async () => {
    api.mockResolvedValue({ accounts: [{
      ...validAccount,
      subscription: {
        ...validAccount.subscription,
        next_invoice: {
          ...validAccount.subscription.next_invoice,
          subtotal_cents: null,
          tax_cents: null,
          payment_attempt_at: null,
        },
      },
    }] });
    render(<ElevenLabsAccountPanel csrf="csrf" onCsrf={vi.fn()} />);
    expect(await screen.findByText("creator")).toBeInTheDocument();
    expect(screen.getByText(/22,99/)).toBeInTheDocument();
    expect(screen.getByText("ElevenLabs не передал дату оплаты")).toBeInTheDocument();
    expect(screen.queryByText(/Актуальные данные подписки пока не получены/)).not.toBeInTheDocument();
  });
});
