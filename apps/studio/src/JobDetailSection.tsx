import { formatBytes } from "./formatters";
import {
  jobSourceProcessingСтатусLabel,
  safeJobSources,
  transcriptionLanguageModeLabel,
  type JobOutputsResponse,
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
        <div className="resource-actions" aria-label="Действия после ошибки">
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
