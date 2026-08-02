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

export function JobCard({
  job,
  detail,
  outputs,
  reconciliation,
  retry,
  progress,
  onOpen,
  onCancel,
  onCheckReconciliation,
  onRetry,
  pinnedTerminal = false,
  onDismissTerminal,
}: {
  job: TranscriptionJob;
  detail: JobDetailState | undefined;
  outputs: JobOutputsState | undefined;
  reconciliation: OutputReconciliationState | undefined;
  retry: JobRetryState | undefined;
  progress: JobProgressState | undefined;
  onOpen: (jobId: string) => void | Promise<void>;
  onCancel: (jobId: string) => void | Promise<void>;
  onCheckReconciliation: (jobId: string) => void | Promise<void>;
  onRetry: (jobId: string) => void | Promise<void>;
  pinnedTerminal?: boolean;
  onDismissTerminal?: (jobId: string) => void | Promise<void>;
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
        <div className="job-terminal-notice" role="status" aria-live="polite">
          <strong>
            {job.status === "completed"
              ? "Задача завершена на 100% — результат доступен ниже."
              : job.status === "failed"
                ? "Задача завершилась ошибкой."
                : "Задача отменена."}
          </strong>
          <button
            className="secondary"
            type="button"
            onClick={() => onDismissTerminal?.(job.id)}
          >
            Убрать в историю
          </button>
        </div>
      )}
      <JobProgressPipeline jobId={job.id} state={progress} />
      <JobCardActions job={job} onOpen={onOpen} onCancel={onCancel} />
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
        <JobDetailSection
          job={detailedJob}
          outputs={outputs?.data ?? null}
          retry={retry}
          onRetry={onRetry}
        />
      )}
    </article>
  );
}
