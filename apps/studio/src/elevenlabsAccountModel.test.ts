import { describe, expect, it } from "vitest";

import {
  parseElevenLabsAccount,
  parseElevenLabsAccountsResponse,
} from "./elevenlabsAccountModel";


export const validAccount = {
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
    open_invoices: {
      present: true,
      count: 1,
      total_due_cents: 125,
      currency: "USD",
    },
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
    products: [
      { product_type: "speech-to-text", credits: "140.00000000" },
    ],
  },
};

describe("ElevenLabs account parser", () => {
  it("accepts bounded provider account actuals", () => {
    expect(parseElevenLabsAccount(validAccount)).toEqual(validAccount);
    expect(parseElevenLabsAccountsResponse({ accounts: [validAccount] })).toEqual([
      validAccount,
    ]);
  });

  it.each([null, 0, 125])("preserves optional invoice amounts as %s", (amount) => {
    const account = {
      ...validAccount,
      subscription: {
        ...validAccount.subscription,
        next_invoice: {
          ...validAccount.subscription.next_invoice,
          subtotal_cents: amount,
          tax_cents: amount,
          payment_attempt_at: null,
        },
      },
    };
    expect(parseElevenLabsAccount(account)).toEqual(account);
  });

  it.each([undefined, -1, true, 1.5, "0", {}, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid optional invoice amount %s",
    (amount) => {
      for (const field of ["subtotal_cents", "tax_cents"]) {
        expect(parseElevenLabsAccount({
          ...validAccount,
          subscription: {
            ...validAccount.subscription,
            next_invoice: { ...validAccount.subscription.next_invoice, [field]: amount },
          },
        })).toBeNull();
      }
    },
  );

  it("keeps invoice amount due required", () => {
    expect(parseElevenLabsAccount({
      ...validAccount,
      subscription: {
        ...validAccount.subscription,
        next_invoice: { ...validAccount.subscription.next_invoice, amount_due_cents: null },
      },
    })).toBeNull();
  });

  it("rejects fabricated units, invalid money, duplicate credentials and hidden payload additions", () => {
    expect(
      parseElevenLabsAccount({
        ...validAccount,
        subscription: { ...validAccount.subscription, period_unit: "minutes" },
      }),
    ).toBeNull();
    expect(
      parseElevenLabsAccount({
        ...validAccount,
        subscription: {
          ...validAccount.subscription,
          current_overage: { amount: "NaN", currency: "USD" },
        },
      }),
    ).toBeNull();
    expect(
      parseElevenLabsAccountsResponse({ accounts: [validAccount, validAccount] }),
    ).toBeNull();
    const sanitized = parseElevenLabsAccount({
      ...validAccount,
      api_key: "top-level-secret",
      credential: { ...validAccount.credential, api_key: "credential-secret" },
      subscription: { ...validAccount.subscription, api_key: "provider-secret" },
      workspace_usage: {
        ...validAccount.workspace_usage,
        api_key: "usage-secret",
      },
    });
    expect(sanitized).not.toBeNull();
    expect(JSON.stringify(sanitized)).not.toContain("api_key");
    expect(JSON.stringify(sanitized)).not.toContain("secret");
  });

  it("accepts explicit unavailable without inventing subscription values", () => {
    const unavailable = {
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
    };
    expect(parseElevenLabsAccount(unavailable)).toEqual(unavailable);
  });
});
