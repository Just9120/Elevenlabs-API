import { formatTime } from "./formatters";
import {
  isApprovedOutputUrl,
  jobTitle,
  jobСтатусLabel,
  type TranscriptionJob,
} from "./jobModel";
import { ResourceExternalLink } from "./resourceLinks";

export function JobCardSummary({ job }: { job: TranscriptionJob }) {
  return (
    <>
      <b>{jobTitle(job)}</b>
      <span>Статус: {jobСтатусLabel(job.status)}</span>
      <span>Файлов: {job.source_count}</span>
      <span>Создана: {formatTime(job.created_at)}</span>
      {job.output_folder && (
        <span>
          Папка результата: {job.output_folder.name || "Папка Google Drive"}
        </span>
      )}
      {job.output_folder?.web_view_url &&
        isApprovedOutputUrl(job.output_folder.web_view_url) && (
          <ResourceExternalLink
            href={job.output_folder.web_view_url}
            label="Открыть папку результата"
            ariaLabel="Открыть папку результата в Google Drive в новой вкладке"
          />
        )}
      {job.status === "processing" && job.cancel_requested_at && (
        <span>Отмена запрошена: {formatTime(job.cancel_requested_at)}</span>
      )}
      {job.error_message && <span>Ошибка: {job.error_message}</span>}
    </>
  );
}
