import type { JobUsageCost } from "./jobModel";

function formatConfirmedDuration(seconds: number) {
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = seconds - hours * 3600 - minutes * 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ч`);
  if (minutes > 0) parts.push(`${minutes} мин`);
  if (remainder > 0 || parts.length === 0) {
    parts.push(
      `${remainder.toLocaleString("ru-RU", {
        maximumFractionDigits: 3,
      })} с`,
    );
  }
  return parts.join(" ");
}

function formatFixedUsd(value: string) {
  const [whole, rawFraction = ""] = value.split(".");
  const fraction = rawFraction.replace(/0+$/, "").padEnd(2, "0");
  return `${whole},${fraction} USD`;
}

export function JobUsageCostSummary({ usageCost }: { usageCost?: JobUsageCost }) {
  if (!usageCost || usageCost.accounting_status === "unavailable") {
    return (
      <p className="notice">
        Для этой задачи нет подтверждённых данных о расходе.
      </p>
    );
  }
  if (usageCost.accounting_status === "not_started") {
    return (
      <p className="notice">Подтверждённый расход пока не зафиксирован.</p>
    );
  }

  const duration = usageCost.confirmed_billed_duration_seconds;
  const cost = usageCost.confirmed_provider_cost;
  if (duration === null || cost === null) return null;
  const incompleteMessage =
    usageCost.accounting_status === "uncertain"
      ? "Показана только подтверждённая часть. Итоговый расход неопределён и может быть выше."
      : usageCost.accounting_status === "confirmed_partial"
        ? "Показана подтверждённая часть; полный учёт появится после завершения задачи."
        : null;

  return (
    <article className="source-card" aria-label="Расход сервиса распознавания по задаче">
      <span>
        Подтверждённая длительность: <strong>{formatConfirmedDuration(duration)}</strong>
      </span>
      <span>
        Номинальная стоимость: <strong>{formatFixedUsd(cost)}</strong>
      </span>
      {incompleteMessage && <p className="notice">{incompleteMessage}</p>}
      <p className="muted">
        Это расчётная стоимость по подтверждённой длительности и сохранённому тарифу,
        а не фактическое списание. Остаток на счёте, расходы сверх лимита и счета
        показаны отдельно в Настройки → Подключения.
      </p>
      {usageCost.rate_snapshot && (
        <details className="technical-details">
          <summary>Основание расчёта</summary>
          <p>
            Тариф: {formatFixedUsd(usageCost.rate_snapshot.rate_per_hour)}/ч ·
            действует с {new Date(
              `${usageCost.rate_snapshot.effective_date}T00:00:00Z`,
            ).toLocaleDateString("ru-RU")}
          </p>
          <p className="muted">
            Источник: официальные публичные тарифы {usageCost.rate_snapshot.source === "yandex_public_api_pricing" ? "Yandex SpeechKit" : "ElevenLabs"}. Для уже созданной
            задачи snapshot не заменяется новым тарифом.
          </p>
        </details>
      )}
    </article>
  );
}
