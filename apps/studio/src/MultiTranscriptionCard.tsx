import { useId, type ReactNode } from "react";
import { jobTitle, type TranscriptionJob } from "./jobModel";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export function MultiTranscriptionCard({
  jobs,
  renderJob,
}: {
  jobs: TranscriptionJob[];
  renderJob: (job: TranscriptionJob, pinnedTerminal: boolean) => ReactNode;
}) {
  const titleId = useId();
  const terminalCount = jobs.filter((job) =>
    TERMINAL_STATUSES.has(job.status),
  ).length;
  const completedCount = jobs.filter(
    (job) => job.status === "completed",
  ).length;
  const activeCount = jobs.filter(
    (job) => job.status === "queued" || job.status === "processing",
  ).length;
  const problemCount = jobs.filter(
    (job) => job.status === "failed" || job.status === "cancelled",
  ).length;
  const terminalPercent = Math.floor((terminalCount / jobs.length) * 100);
  const grouped = jobs.length > 1;

  return (
    <article className="multi-transcription" aria-labelledby={titleId}>
      <header className="multi-transcription-header">
        <div>
          <h3 id={titleId}>
            {grouped ? `Группа транскрибаций · ${jobs.length}` : "Транскрибация"}
          </h3>
        </div>
        <div className="multi-transcription-counts" aria-live="polite">
          <span>Готово: {completedCount}</span>
          <span>В работе: {activeCount}</span>
          <span>Ошибка/отмена: {problemCount}</span>
        </div>
      </header>
      <div className="multi-transcription-progress">
        <span>Завершено: {terminalCount} из {jobs.length}</span>
        <progress
          max={100}
          value={terminalPercent}
          aria-label={`Завершено: ${terminalCount} из ${jobs.length}`}
        >
          {terminalPercent}%
        </progress>
      </div>
      {grouped ? (
        <ol className="multi-transcription-items">
          {jobs.map((job, index) => (
            <li key={job.id}>
              <div className="multi-transcription-item-heading">
                <strong>Транскрибация {index + 1} из {jobs.length}</strong>
                <span>{jobTitle(job)}</span>
              </div>
              {renderJob(
                job,
                TERMINAL_STATUSES.has(job.status) &&
                  (job.history_attention_required === true ||
                    job.terminal_dismissed_at === null),
              )}
            </li>
          ))}
        </ol>
      ) : (
        renderJob(
          jobs[0],
          TERMINAL_STATUSES.has(jobs[0].status) &&
            (jobs[0].history_attention_required === true ||
              jobs[0].terminal_dismissed_at === null),
        )
      )}
    </article>
  );
}
