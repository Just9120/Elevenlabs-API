import { useEffect, useRef, useState } from "react";

import { api, mutateWithCsrfRetry } from "./apiClient";
import {
  parseElevenLabsAccountRefreshResponse,
  parseElevenLabsAccountsResponse,
  type ElevenLabsAccount,
} from "./elevenlabsAccountModel";
import { formatTime } from "./formatters";


const POLL_INTERVAL_MS = 60_000;

const ERROR_MESSAGES: Record<string, string> = {
  credential_unavailable: "Сохранённый ключ недоступен. Замените или подключите его заново.",
  provider_authentication_rejected: "ElevenLabs отклонил ключ. Проверьте или замените его.",
  provider_scope_rejected:
    "Ключу не хватает доступа к User/Subscription или Workspace Analytics либо не подходит IP allowlist.",
  provider_request_rejected: "ElevenLabs отклонил запрос статистики.",
  provider_rate_limited: "ElevenLabs временно ограничил обновление. Последние данные сохранены.",
  provider_timeout: "ElevenLabs не ответил вовремя. Последние данные сохранены.",
  provider_unavailable: "Статистика ElevenLabs временно недоступна.",
  malformed_provider_response: "ElevenLabs вернул неподдерживаемый формат статистики.",
};

function errorMessage(code: string | null) {
  return code ? ERROR_MESSAGES[code] ?? "Не удалось обновить данные ElevenLabs." : "";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatMoneyAmount(amount: string, currency: string) {
  const numeric = Number(amount);
  if (Number.isFinite(numeric) && Math.abs(numeric) <= 1_000_000_000_000) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(numeric);
  }
  return `${amount} ${currency}`;
}

function formatMoneyCents(cents: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function subscriptionStatus(value: string) {
  const labels: Record<string, string> = {
    active: "активна",
    free: "бесплатный план",
    trial: "пробный период",
    past_due: "есть просроченная оплата",
    canceled: "отменена",
    cancelled: "отменена",
  };
  return labels[value] ?? value;
}

function subscriptionTierLabel(value: string) {
  const labels: Record<string, string> = {
    free: "Бесплатный",
    starter: "Starter",
    creator: "Creator",
    pro: "Pro",
    scale: "Scale",
    business: "Business",
    enterprise: "Enterprise",
  };
  return labels[value.toLowerCase()] ?? value;
}

function snapshotLabel(account: ElevenLabsAccount) {
  if (account.state === "current") return "Актуально";
  if (account.state === "stale") return "Последние подтверждённые данные";
  return "Данные недоступны";
}

function AccountCard({
  account,
  refreshing,
  onRefresh,
}: {
  account: ElevenLabsAccount;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const subscription = account.subscription;
  const usage = account.workspace_usage;
  return (
    <article className="card provider-account-card" aria-busy={refreshing || undefined}>
      <div className="split">
        <div>
          <span className={`tag provider-account-state ${account.state}`}>
            {snapshotLabel(account)}
          </span>
          <h4>{account.credential.label}</h4>
        </div>
        <button type="button" disabled={refreshing} onClick={onRefresh}>
          {refreshing ? "Обновляем…" : "Обновить"}
        </button>
      </div>
      <p className="muted">
        Получено: {formatTime(account.fetched_at)}
      </p>
      {account.error_code && (
        <p className="notice" role="status">
          {errorMessage(account.error_code)}
        </p>
      )}
      {!subscription ? (
        <p>Актуальные данные подписки пока не получены.</p>
      ) : (
        <>
          <div className="analytics-total-grid provider-account-metrics">
            <article>
              <span>Основная подписка</span>
              <strong>
                {subscription.tier.toLowerCase() === "payg"
                  ? "Нет данных"
                  : subscriptionTierLabel(subscription.tier)}
              </strong>
              <small>
                {subscription.tier.toLowerCase() === "payg"
                  ? "ElevenLabs вернул способ оплаты PAYG, но не название плана"
                  : subscriptionStatus(subscription.status)}
              </small>
            </article>
            <article>
              <span>Лимит API в текущем периоде</span>
              <strong>
                {formatCount(subscription.period_usage)} из{" "}
                {formatCount(subscription.period_limit)}
              </strong>
              <small>Осталось: {formatCount(subscription.period_remaining)}</small>
            </article>
            <article>
              <span>PAYG / оплата сверх лимита</span>
              <strong>
                {formatMoneyAmount(
                  subscription.current_overage.amount,
                  subscription.current_overage.currency,
                )}
              </strong>
              <small>
                {subscription.usage_based_billing.enabled
                  ? "Оплата по фактическому использованию включена"
                  : "Оплата по фактическому использованию выключена"}
              </small>
            </article>
            <article>
              <span>Следующий счёт</span>
              <strong>
                {subscription.next_invoice
                  ? formatMoneyCents(
                      subscription.next_invoice.amount_due_cents,
                      subscription.next_invoice.currency,
                    )
                  : "Нет данных"}
              </strong>
              <small>
                {subscription.next_invoice?.payment_attempt_at
                  ? `Попытка оплаты: ${formatTime(subscription.next_invoice.payment_attempt_at)}`
                  : "ElevenLabs не передал дату оплаты"}
              </small>
            </article>
          </div>
          <p className="muted">
            Новый расчётный период: {formatTime(subscription.reset_at)}. Единицы
            использования показаны без пересчёта в минуты, потому что ElevenLabs
            не передаёт для этого подтверждённый коэффициент.
          </p>
          <p className="muted">
            Основная подписка и PAYG показаны отдельно. Порядок списания между
            ними не указан: ElevenLabs не передал его в данных аккаунта.
          </p>
          {subscription.pending_change_present && (
            <p className="notice" role="status">
              ElevenLabs сообщает о запланированном изменении подписки. Новый
              plan/status появится после применения изменения provider-ом.
            </p>
          )}
          {subscription.open_invoices.present && (
            <p className="notice" role="status">
              Открытых invoices: {subscription.open_invoices.count}; к оплате{" "}
              {formatMoneyCents(
                subscription.open_invoices.total_due_cents,
                subscription.open_invoices.currency,
              )}.
            </p>
          )}
        </>
      )}
      <details className="technical-details">
        <summary>Usage по продуктам</summary>
        {usage.error_code && <p className="notice">{errorMessage(usage.error_code)}</p>}
        {usage.state === "unavailable" ? (
          <p>Разбивка credits по продуктам пока недоступна.</p>
        ) : (
          <>
            <p className="muted">
              Окно: {formatTime(usage.window?.start ?? null)} —{" "}
              {formatTime(usage.window?.end ?? null)} · всего {usage.total ?? "0"}{" "}
              credits. Обновлено {formatTime(usage.fetched_at)}.
            </p>
            {usage.products.length === 0 ? (
              <p>За выбранное окно provider не вернул расход.</p>
            ) : (
              <dl className="meta technical-meta">
                {usage.products.map((product) => (
                  <div key={product.product_type}>
                    <dt>{product.product_type}</dt>
                    <dd>{product.credits} credits</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </details>
    </article>
  );
}

export function ElevenLabsAccountPanel({
  csrf,
  onCsrf,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
}) {
  const [accounts, setAccounts] = useState<ElevenLabsAccount[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const mounted = useRef(true);

  async function load({ quiet = false } = {}) {
    if (!quiet && accounts.length === 0) setState("loading");
    try {
      const candidate = await api<unknown>("/provider-accounts/elevenlabs");
      const parsed = parseElevenLabsAccountsResponse(candidate);
      if (!parsed) throw new Error("invalid_elevenlabs_accounts_response");
      if (!mounted.current) return;
      setAccounts(parsed);
      setState("ready");
    } catch {
      if (!mounted.current) return;
      setState(accounts.length > 0 ? "ready" : "error");
    }
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ quiet: true });
    }, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
    };
  }, []);

  async function refresh(account: ElevenLabsAccount) {
    const credentialId = account.credential.id;
    if (refreshing.has(credentialId)) return;
    setRefreshing((current) => new Set(current).add(credentialId));
    try {
      const candidate = await mutateWithCsrfRetry<unknown>(
        `/provider-accounts/elevenlabs/${credentialId}/refresh`,
        csrf,
        onCsrf,
        { method: "POST" },
      );
      const parsed = parseElevenLabsAccountRefreshResponse(candidate);
      if (!parsed) throw new Error("invalid_elevenlabs_account_refresh_response");
      if (!mounted.current) return;
      setAccounts((current) =>
        current.map((item) =>
          item.credential.id === credentialId ? parsed : item,
        ),
      );
      setState("ready");
    } catch {
      if (mounted.current) setState("error");
    } finally {
      if (mounted.current) {
        setRefreshing((current) => {
          const next = new Set(current);
          next.delete(credentialId);
          return next;
        });
      }
    }
  }

  return (
    <section className="provider-account-panel" aria-labelledby="elevenlabs-account-title">
      <h3 id="elevenlabs-account-title">Подписка и расходы ElevenLabs</h3>
      <p className="muted">
        Здесь показаны текущий план, оставшиеся кредиты и дополнительные
        расходы, которые сообщает ElevenLabs. Пока этот экран открыт, Studio
        автоматически проверяет обновления примерно раз в пять минут.
      </p>
      {state === "loading" && <p role="status">Получаем данные ElevenLabs…</p>}
      {state === "error" && accounts.length === 0 && (
        <div className="error">
          <p role="alert">Не удалось получить данные подписки ElevenLabs.</p>
          <button type="button" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      )}
      {state === "error" && accounts.length > 0 && (
        <p className="notice" role="status">
          Обновление не подтвердилось; показаны последние полученные данные.
        </p>
      )}
      {state === "ready" && accounts.length === 0 && (
        <p className="notice">Добавьте активный key ElevenLabs ниже.</p>
      )}
      <div className="grid provider-account-grid">
        {accounts.map((account) => (
          <AccountCard
            key={account.credential.id}
            account={account}
            refreshing={refreshing.has(account.credential.id)}
            onRefresh={() => void refresh(account)}
          />
        ))}
      </div>
    </section>
  );
}
