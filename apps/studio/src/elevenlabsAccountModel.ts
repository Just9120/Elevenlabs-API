export type ProviderSnapshotState = "current" | "stale" | "unavailable";

export type ElevenLabsAccount = {
  credential: { id: string; label: string; active_version: number };
  state: ProviderSnapshotState;
  fetched_at: string | null;
  last_attempt_at: string | null;
  error_code: string | null;
  subscription: {
    tier: string;
    status: string;
    period_usage: number;
    period_limit: number;
    period_remaining: number;
    period_unit: "characters";
    reset_at: string | null;
    billing_period: string | null;
    refresh_period: string | null;
    usage_based_billing: {
      enabled: boolean;
      max_extra_credits: string;
    };
    current_overage: { amount: string; currency: string };
    open_invoices: {
      present: boolean;
      count: number;
      total_due_cents: number;
      currency: string;
    };
    next_invoice: {
      amount_due_cents: number;
      subtotal_cents: number;
      tax_cents: number;
      currency: string;
      payment_attempt_at: string | null;
    } | null;
    pending_change_present: boolean;
  } | null;
  workspace_usage: {
    state: ProviderSnapshotState;
    fetched_at: string | null;
    error_code: string | null;
    window: { start: string; end: string; basis: string } | null;
    unit: "credits" | null;
    total: string | null;
    products: Array<{ product_type: string; credits: string }>;
  };
};

const STATE = new Set<ProviderSnapshotState>([
  "current",
  "stale",
  "unavailable",
]);
const DECIMAL = /^(0|[1-9]\d{0,17})(\.\d{1,8})?$/;
const SAFE_VALUE = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,79}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function state(value: unknown): value is ProviderSnapshotState {
  return typeof value === "string" && STATE.has(value as ProviderSnapshotState);
}

function time(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length <= 40 &&
      Number.isFinite(Date.parse(value)))
  );
}

function text(value: unknown, max = 80): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function optionalText(value: unknown, max = 80): value is string | null {
  return value === null || text(value, max);
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function decimal(value: unknown): value is string {
  return typeof value === "string" && DECIMAL.test(value);
}

function currency(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

function parseSubscription(value: unknown): ElevenLabsAccount["subscription"] | undefined {
  if (value === null) return null;
  const source = record(value);
  if (!source) return undefined;
  const billing = record(source.usage_based_billing);
  const overage = record(source.current_overage);
  const invoices = record(source.open_invoices);
  const nextInvoice = source.next_invoice === null ? null : record(source.next_invoice);
  if (
    !text(source.tier) ||
    !text(source.status) ||
    !count(source.period_usage) ||
    !count(source.period_limit) ||
    !count(source.period_remaining) ||
    source.period_unit !== "characters" ||
    !time(source.reset_at) ||
    !optionalText(source.billing_period) ||
    !optionalText(source.refresh_period) ||
    !billing ||
    typeof billing.enabled !== "boolean" ||
    !text(billing.max_extra_credits, 32) ||
    !(billing.max_extra_credits === "unlimited" || /^\d{1,18}$/.test(billing.max_extra_credits)) ||
    !overage ||
    !decimal(overage.amount) ||
    !currency(overage.currency) ||
    !invoices ||
    typeof invoices.present !== "boolean" ||
    !count(invoices.count) ||
    !count(invoices.total_due_cents) ||
    !currency(invoices.currency) ||
    typeof source.pending_change_present !== "boolean"
  ) {
    return undefined;
  }
  if (
    nextInvoice &&
    (!count(nextInvoice.amount_due_cents) ||
      !count(nextInvoice.subtotal_cents) ||
      !count(nextInvoice.tax_cents) ||
      !currency(nextInvoice.currency) ||
      !time(nextInvoice.payment_attempt_at))
  ) {
    return undefined;
  }
  return {
    tier: source.tier as string,
    status: source.status as string,
    period_usage: source.period_usage as number,
    period_limit: source.period_limit as number,
    period_remaining: source.period_remaining as number,
    period_unit: "characters",
    reset_at: source.reset_at as string | null,
    billing_period: source.billing_period as string | null,
    refresh_period: source.refresh_period as string | null,
    usage_based_billing: {
      enabled: billing.enabled as boolean,
      max_extra_credits: billing.max_extra_credits as string,
    },
    current_overage: {
      amount: overage.amount as string,
      currency: overage.currency as string,
    },
    open_invoices: {
      present: invoices.present as boolean,
      count: invoices.count as number,
      total_due_cents: invoices.total_due_cents as number,
      currency: invoices.currency as string,
    },
    next_invoice: nextInvoice
      ? {
          amount_due_cents: nextInvoice.amount_due_cents as number,
          subtotal_cents: nextInvoice.subtotal_cents as number,
          tax_cents: nextInvoice.tax_cents as number,
          currency: nextInvoice.currency as string,
          payment_attempt_at: nextInvoice.payment_attempt_at as string | null,
        }
      : null,
    pending_change_present: source.pending_change_present as boolean,
  };
}

function parseWorkspaceUsage(value: unknown): ElevenLabsAccount["workspace_usage"] | null {
  const source = record(value);
  if (
    !source ||
    !state(source.state) ||
    !time(source.fetched_at) ||
    !optionalText(source.error_code) ||
    !(source.unit === null || source.unit === "credits") ||
    !(source.total === null || decimal(source.total)) ||
    !Array.isArray(source.products) ||
    source.products.length > 64
  ) {
    return null;
  }
  const window = source.window === null ? null : record(source.window);
  if (
    window &&
    (!time(window.start) ||
      window.start === null ||
      !time(window.end) ||
      window.end === null ||
      !text(window.basis, 40))
  ) {
    return null;
  }
  const products: Array<{ product_type: string; credits: string }> = [];
  for (const raw of source.products) {
    const product = record(raw);
    if (
      !product ||
      !text(product.product_type) ||
      !SAFE_VALUE.test(product.product_type as string) ||
      !decimal(product.credits)
    ) {
      return null;
    }
    products.push({
      product_type: product.product_type as string,
      credits: product.credits as string,
    });
  }
  return {
    state: source.state as ProviderSnapshotState,
    fetched_at: source.fetched_at as string | null,
    error_code: source.error_code as string | null,
    window: window
      ? {
          start: window.start as string,
          end: window.end as string,
          basis: window.basis as string,
        }
      : null,
    unit: source.unit as "credits" | null,
    total: source.total as string | null,
    products,
  };
}

export function parseElevenLabsAccount(value: unknown): ElevenLabsAccount | null {
  const source = record(value);
  const credential = record(source?.credential);
  if (
    !source ||
    !credential ||
    !text(credential.id, 36) ||
    !text(credential.label, 120) ||
    !count(credential.active_version) ||
    (credential.active_version as number) < 1 ||
    !state(source.state) ||
    !time(source.fetched_at) ||
    !time(source.last_attempt_at) ||
    !optionalText(source.error_code)
  ) {
    return null;
  }
  const subscription = parseSubscription(source.subscription);
  const workspaceUsage = parseWorkspaceUsage(source.workspace_usage);
  if (subscription === undefined || workspaceUsage === null) return null;
  if (source.state === "unavailable" && subscription !== null) return null;
  return {
    credential: {
      id: credential.id as string,
      label: credential.label as string,
      active_version: credential.active_version as number,
    },
    state: source.state,
    fetched_at: source.fetched_at,
    last_attempt_at: source.last_attempt_at,
    error_code: source.error_code as string | null,
    subscription,
    workspace_usage: workspaceUsage,
  };
}

export function parseElevenLabsAccountsResponse(candidate: unknown): ElevenLabsAccount[] | null {
  const source = record(candidate);
  if (!source || !Array.isArray(source.accounts) || source.accounts.length > 20) {
    return null;
  }
  const accounts: ElevenLabsAccount[] = [];
  for (const raw of source.accounts) {
    const account = parseElevenLabsAccount(raw);
    if (!account) return null;
    accounts.push(account);
  }
  return new Set(accounts.map((account) => account.credential.id)).size ===
    accounts.length
    ? accounts
    : null;
}

export function parseElevenLabsAccountRefreshResponse(candidate: unknown): ElevenLabsAccount | null {
  const source = record(candidate);
  return source ? parseElevenLabsAccount(source.account) : null;
}
