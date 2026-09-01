import { JobCardActions } from "./JobCardActions";
import { JobCardSummary } from "./JobCardSummary";
import { JobDetailSection } from "./JobDetailSection";
import { JobOutputsSection } from "./JobOutputsSection";
import type {
  JobDetailState,
  JobOutputsState,
  TranscriptionJob,
} from "./jobModel";
import type {
  JobRetryState,
  OutputReconciliationState,
} from "./jobRecoveryModel";
import { OutputReconciliationNotice } from "./OutputReconciliationNotice";
import { JobProgressPipeline } from "./JobProgressPipeline";
import type { JobProgressState } from "./jobProgressModel";
import { SpeakerIdentityPanel } from "./SpeakerIdentityPanel";

export function JobCard({
  job,
  detail,
  outputs,
  reconciliation,
  retry,
  progress,
  onOpen,
  onCancel,
  cancelPending = false,
  onCheckReconciliation,
  onRetry,
  pinnedTerminal = false,
  attentionRequired = false,
  dismissPending = false,
  onDismissTerminal,
  csrf,
  onCsrf,
  onSpeakerUpdated,
}: {
  job: TranscriptionJob;
  detail: JobDetailState | undefined;
  outputs: JobOutputsState | undefined;
  reconciliation: OutputReconciliationState | undefined;
  retry: JobRetryState | undefined;
  progress: JobProgressState | undefined;
  onOpen: (jobId: string) => void | Promise<void>;
  onCancel: (jobId: string) => void | Promise<void>;
  cancelPending?: boolean;
  onCheckReconciliation: (jobId: string) => void | Promise<void>;
  onRetry: (jobId: string) => void | Promise<void>;
  pinnedTerminal?: boolean;
  attentionRequired?: boolean;
  dismissPending?: boolean;
  onDismissTerminal?: (jobId: string) => void | Promise<void>;
  csrf?: string;
  onCsrf?: (csrf: string) => void;
  onSpeakerUpdated?: (jobId: string) => void | Promise<void>;
}) {
  const detailedJob = detail?.job;
  const terminal = ["completed", "failed", "cancelled"].includes(job.status);

  return (
    <article
      className={`source-card ${terminal ? "terminal-job" : ""}${
        pinnedTerminal ? " pinned-terminal-job" : ""
      }`}
    >
      <JobCardSummary job={job} />
      {pinnedTerminal && (
        <div
          className={`job-terminal-notice job-terminal-notice-${job.status}`}
          role={job.status === "failed" ? "alert" : "status"}
          aria-live={job.status === "failed" ? "assertive" : "polite"}
        >
          <strong>
            {attentionRequired
              ? "Эта задача требует решения и сохранена после очистки истории."
              : job.status === "completed"
              ? "Задача завершена на 100% — результат доступен ниже."
              : job.status === "failed"
                ? "Задача завершилась ошибкой."
                : "Задача отменена."}
          </strong>
          {!attentionRequired && (
            <button
              className="secondary"
              type="button"
              disabled={dismissPending}
              aria-busy={dismissPending}
              onClick={() => onDismissTerminal?.(job.id)}
            >
              Убрать в историю
            </button>
          )}
        </div>
      )}
      <JobProgressPipeline jobId={job.id} state={progress} />
      <JobCardActions
        job={job}
        onOpen={onOpen}
        onCancel={onCancel}
        cancelPending={cancelPending}
      />
      {detail?.loading && <p role="status">Загрузка деталей задачи…</p>}
      {detail?.error && <p className="error">{detail.error}</p>}
      {outputs?.loading && <p role="status">Загрузка результатов…</p>}
      {outputs?.error && <p className="error">{outputs.error}</p>}
      {reconciliation?.data?.available && (
        <OutputReconciliationNotice
          jobId={job.id}
          state={reconciliation}
          onCheck={onCheckReconciliation}
        />
      )}
      {outputs?.data && <JobOutputsSection jobId={job.id} data={outputs.data} />}
      {detailedJob && (
        <>
          <JobDetailSection
            job={detailedJob}
            outputs={outputs?.data ?? null}
            retry={retry}
            onRetry={onRetry}
          />
          {csrf && onCsrf && onSpeakerUpdated && (
            <SpeakerIdentityPanel
              job={detailedJob}
              csrf={csrf}
              onCsrf={onCsrf}
              onJobUpdated={() => onSpeakerUpdated(detailedJob.id)}
            />
          )}
        </>
      )}
    </article>
  );
}
