import { formatBytes } from "./formatters";
import {
  jobSourceProcessingСтатусLabel,
  safeJobSources,
  transcriptionLanguageModeLabel,
  type JobOutputsResponse,
  type JobUsageCost,
  type TranscriptionJob,
} from "./jobModel";
import {
  isPartialProviderResume,
  isPartialProviderRestart,
  providerFailureLabel,
  retryUnavailableLabel,
  type JobRetryState,
} from "./jobRecoveryModel";
import { isSafeDisplayUrl, ResourceExternalLink } from "./resourceLinks";

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

function JobUsageCostSummary({ usageCost }: { usageCost?: JobUsageCost }) {
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
    <article className="source-card" aria-label="Расход ElevenLabs по задаче">
      <span>
        Подтверждённая длительность: <strong>{formatConfirmedDuration(duration)}</strong>
      </span>
      <span>
        Номинальная стоимость: <strong>{formatFixedUsd(cost)}</strong>
      </span>
      {incompleteMessage && <p className="notice">{incompleteMessage}</p>}
      <p className="muted">
        Это nominal оценка по подтверждённой длительности и сохранённому тарифу,
        а не фактическое списание. Account-level остаток, overage и invoices
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
            Источник: официальные публичные тарифы ElevenLabs. Для уже созданной
            задачи snapshot не заменяется новым тарифом.
          </p>
        </details>
      )}
    </article>
  );
}

export function JobDetailSection({
  job,
  outputs,
  retry,
  onRetry,
}: {
  job: TranscriptionJob;
  outputs: JobOutputsResponse | null;
  retry: JobRetryState | undefined;
  onRetry: (jobId: string) => void | Promise<void>;
}) {
  const unavailable = retryUnavailableLabel(retry?.data?.reason);
  const partialResume = isPartialProviderResume(retry?.data);
  const partialRestart = isPartialProviderRestart(retry?.data);

  return (
    <section aria-label="Подробности транскрибации">
      <p>Язык: {transcriptionLanguageModeLabel(job.language_mode)}</p>
      <p>
        Разделение спикеров: {job.diarization_enabled ? "Включено" : "Выключено"}
      </p>
      <h5>Расход ElevenLabs</h5>
      <JobUsageCostSummary usageCost={job.usage_cost} />
      <h5>Папка результата</h5>
      {job.output_folder ? (
        <p>
          {job.output_folder.name || "Папка Google Drive"}{" "}
          {isSafeDisplayUrl(job.output_folder.web_view_url) && (
            <ResourceExternalLink
              href={job.output_folder.web_view_url ?? ""}
              label="Открыть папку результата"
              ariaLabel="Открыть папку результата в Google Drive в новой вкладке"
            />
          )}
        </p>
      ) : (
        <p className="notice">Папка результата не задана.</p>
      )}

      {job.status === "failed" && (
        <div
          className="resource-actions"
          role="region"
          aria-label="Действия после ошибки"
        >
          {retry?.data?.available ? (
            <>
              {partialResume && (
                <span className="notice">
                  Сохранено частей: {retry.data.resumable_provider_part_count ?? 0} из{" "}
                  {retry.data.provider_total_part_count ?? 0}. Уже готовые части не будут
                  повторно отправлены в ElevenLabs. Причина остановки:{" "}
                  {providerFailureLabel(retry.data.provider_failure_code)}.
                </span>
              )}
              {partialRestart && (
                <span className="notice">
                  Сохранённые части больше недоступны. При продолжении весь файл
                  будет отправлен в ElevenLabs заново и может повторно списать
                  средства. Причина предыдущей остановки:{" "}
                  {providerFailureLabel(retry.data.provider_failure_code)}.
                </span>
              )}
              <button
                type="button"
                onClick={() => void onRetry(job.id)}
                disabled={retry.posting}
                aria-busy={retry.posting}
              >
                {partialResume
                  ? "Продолжить оставшиеся части"
                  : partialRestart
                    ? "Начать транскрибацию заново"
                  : "Повторить безопасную обработку"}
              </button>
            </>
          ) : unavailable ? (
            <span className="notice">{unavailable}</span>
          ) : null}
          {retry?.message && <span>{retry.message}</span>}
          {retry?.error && <span className="error">{retry.error}</span>}
        </div>
      )}
      <h5>Файлы задачи</h5>
      {safeJobSources(job).map((source) => (
        <article className="source-card" key={`${job.id}-${source.id}`}>
          <b>
            {source.position + 1}. {source.original_filename}
          </b>
          <span>
            Статус обработки:{" "}
            {jobSourceProcessingСтатусLabel(job, source, outputs)}
          </span>
          <span>Размер: {formatBytes(source.size_bytes)}</span>
          {isSafeDisplayUrl(source.drive_file_url) && (
            <div className="resource-actions">
              <ResourceExternalLink
                href={source.drive_file_url ?? ""}
                label="Открыть файл в Google Drive"
                ariaLabel="Открыть файл в Google Drive в новой вкладке"
              />
            </div>
          )}
        </article>
      ))}
      <details className="technical-details job-support-details">
        <summary>Данные для поддержки</summary>
        <p>Идентификатор задачи: {job.id}</p>
      </details>
    </section>
  );
}
