import { useId, type ReactNode } from "react";
import { formatTime } from "./formatters";
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

  return (
    <article className="multi-transcription" aria-labelledby={titleId}>
      <header className="multi-transcription-header">
        <div>
          <h3 id={titleId}>Мульти-транскрибация · {jobs.length}</h3>
          <span className="muted">Создана: {formatTime(jobs[0].created_at)}</span>
        </div>
        <div className="multi-transcription-counts" aria-live="polite">
          <span>Готово: {completedCount}</span>
          <span>В работе: {activeCount}</span>
          <span>Ошибка/отмена: {problemCount}</span>
        </div>
      </header>
      <div className="multi-transcription-progress">
        <span>Завершено элементов: {terminalCount} из {jobs.length}</span>
        <progress
          max={100}
          value={terminalPercent}
          aria-label={`Завершено элементов: ${terminalCount} из ${jobs.length}`}
        >
          {terminalPercent}%
        </progress>
      </div>
      <ol className="multi-transcription-items">
        {jobs.map((job, index) => (
          <li key={job.id}>
            <div className="multi-transcription-item-heading">
              <strong>Элемент {index + 1} из {jobs.length}</strong>
              <span>{jobTitle(job)}</span>
            </div>
            {renderJob(
              job,
              TERMINAL_STATUSES.has(job.status) &&
                job.terminal_dismissed_at === null,
            )}
          </li>
        ))}
      </ol>
    </article>
  );
}
