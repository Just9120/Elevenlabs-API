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

export function JobCard({
  job,
  detail,
  outputs,
  reconciliation,
  retry,
  onOpen,
  onCancel,
  onCheckReconciliation,
  onRetry,
}: {
  job: TranscriptionJob;
  detail: JobDetailState | undefined;
  outputs: JobOutputsState | undefined;
  reconciliation: OutputReconciliationState | undefined;
  retry: JobRetryState | undefined;
  onOpen: (jobId: string) => void | Promise<void>;
  onCancel: (jobId: string) => void | Promise<void>;
  onCheckReconciliation: (jobId: string) => void | Promise<void>;
  onRetry: (jobId: string) => void | Promise<void>;
}) {
  const detailedJob = detail?.job;
  const terminal = ["completed", "failed", "cancelled"].includes(job.status);

  return (
    <article className={`source-card ${terminal ? "terminal-job" : ""}`}>
      <JobCardSummary job={job} />
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
        <JobDetailSection job={detailedJob} retry={retry} onRetry={onRetry} />
      )}
    </article>
  );
}
