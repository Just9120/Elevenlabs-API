import { formatTime } from "./formatters";
import {
  isApprovedOutputUrl,
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
    <section aria-label="Результаты транскрибации">
      <h5>Результаты</h5>
      {data.output_count > 1 && <p>Документов: {data.output_count}</p>}
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
            <span>Символов: {output.document_character_count ?? "—"}</span>
            <span>Создан: {formatTime(output.document_created_at)}</span>
            {approvedLink ? (
              <ResourceExternalLink
                href={output.web_view_url ?? ""}
                label="Открыть документ"
                ariaLabel="Открыть документ"
              />
            ) : (
              <span>Ссылка недоступна</span>
            )}
            <details className="technical-details job-support-details">
              <summary>Технические сведения</summary>
              <span>Тип источника: {output.source_type || "не указан"}</span>
              <span>Тип результата: {output.output_kind || "не указан"}</span>
              <span>
                Стандарт документа: {output.transcript_standard || "не указан"}
              </span>
              <span>Запись подтверждена: {formatTime(output.persisted_at)}</span>
            </details>
          </article>
        );
      })}
    </section>
  );
}
