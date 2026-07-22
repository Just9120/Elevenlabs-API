import { formatBytes } from "./formatters";
import { safeJobSources, type TranscriptionJob } from "./jobModel";
import {
  retryUnavailableLabel,
  type JobRetryState,
} from "./jobRecoveryModel";
import { isSafeDisplayUrl, ResourceExternalLink } from "./resourceLinks";

export function JobDetailSection({
  job,
  retry,
  onRetry,
}: {
  job: TranscriptionJob;
  retry: JobRetryState | undefined;
  onRetry: (jobId: string) => void | Promise<void>;
}) {
  const unavailable = retryUnavailableLabel(retry?.data?.reason);

  return (
    <section aria-label={`Job detail ${job.id}`}>
      <p>UUID: {job.id}</p>
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
        <div className="resource-actions" aria-label="Safe retry action">
          {retry?.data?.available ? (
            <button
              type="button"
              onClick={() => void onRetry(job.id)}
              disabled={retry.posting}
            >
              Повторить безопасную обработку
            </button>
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
          <span>Статус файла: {source.job_source_status}</span>
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
    </section>
  );
}
