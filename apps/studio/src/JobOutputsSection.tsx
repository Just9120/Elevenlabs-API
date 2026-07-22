import { formatTime } from "./formatters";
import {
  isApprovedOutputUrl,
  jobСтатусLabel,
  outputSourceLabel,
  type JobOutputsResponse,
} from "./jobModel";
import { ResourceExternalLink } from "./resourceLinks";

export function JobOutputsSection({
  jobId,
  data,
}: {
  jobId: string;
  data: JobOutputsResponse;
}) {
  return (
    <section aria-label={`Результаты ${data.job_id}`}>
      <h5>Результаты</h5>
      <p>Состояние задачи: {jobСтатусLabel(data.job_status)}</p>
      <p>Результатов: {data.output_count}</p>
      {data.output_count === 0 && (
        <p className="notice">Результаты пока не созданы.</p>
      )}
      {data.outputs.map((output, index) => {
        const approvedLink =
          output.link_available === true &&
          isApprovedOutputUrl(output.web_view_url);
        return (
          <article className="source-card" key={`${jobId}-output-${index}`}>
            <b>{outputSourceLabel(output)}</b>
            <span>Тип файла: {output.source_type || "не указан"}</span>
            <span>Тип результата: {output.output_kind || "не указан"}</span>
            <span>
              Формат: {output.transcript_standard || "не указан"}
            </span>
            <span>Символов: {output.document_character_count ?? "—"}</span>
            <span>Создан: {formatTime(output.document_created_at)}</span>
            <span>Сохранён: {formatTime(output.persisted_at)}</span>
            {approvedLink ? (
              <ResourceExternalLink
                href={output.web_view_url ?? ""}
                label="Открыть документ"
                ariaLabel="Открыть документ"
              />
            ) : (
              <span>Ссылка недоступна</span>
            )}
          </article>
        );
      })}
    </section>
  );
}
