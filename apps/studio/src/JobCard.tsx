import { useState } from "react";

import { JobCardActions } from "./JobCardActions";
import { JobCardSummary } from "./JobCardSummary";
import { JobDetailSection } from "./JobDetailSection";
import { JobOutputsSection } from "./JobOutputsSection";
import type {
  JobDetailState,
  JobOutputsState,
  TranscriptionJob,
} from "./jobModel";
import { jobTitle } from "./jobModel";
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
  attentionResolutionPending = false,
  attentionCandidates = [],
  onResolveAttention,
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
  attentionResolutionPending?: boolean;
  attentionCandidates?: TranscriptionJob[];
  onResolveAttention?: (
    jobId: string,
    resolution: "acknowledged_no_result" | "linked_later_result",
    linkedJobId?: string,
  ) => void | Promise<void>;
  csrf?: string;
  onCsrf?: (csrf: string) => void;
  onSpeakerUpdated?: (jobId: string) => void | Promise<void>;
}) {
  const detailedJob = detail?.job;
  const terminal = ["completed", "failed", "cancelled"].includes(job.status);
  const [linkedJobId, setLinkedJobId] = useState("");
  const body = (
    <>
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
    </>
  );

  return (
    <article
      className={`source-card ${terminal ? "terminal-job" : ""}${
        pinnedTerminal ? " pinned-terminal-job" : ""
      }`}
      data-job-id={job.id}
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
          {attentionRequired && (
            <div className="attention-resolution-controls">
              <p>
                Сначала проверьте Google Drive ещё раз. Если результата нет,
                подтвердите это явно: провайдер мог уже списать средства.
              </p>
              <button
                type="button"
                className="secondary"
                disabled={attentionResolutionPending || reconciliation?.checking}
                onClick={() => onCheckReconciliation(job.id)}
              >
                Проверить результат ещё раз
              </button>
              {attentionCandidates.length > 0 && (
                <label>
                  Более поздний подтверждённый результат
                  <select
                    value={linkedJobId}
                    disabled={attentionResolutionPending}
                    onChange={(event) => setLinkedJobId(event.target.value)}
                  >
                    <option value="">Выберите задачу</option>
                    {attentionCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {jobTitle(candidate)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="actions">
                {attentionCandidates.length > 0 && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={!linkedJobId || attentionResolutionPending}
                    onClick={() =>
                      onResolveAttention?.(
                        job.id,
                        "linked_later_result",
                        linkedJobId,
                      )
                    }
                  >
                    Связать и убрать в историю
                  </button>
                )}
                <button
                  type="button"
                  className="danger"
                  disabled={attentionResolutionPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Подтвердить, что результата нет? ElevenLabs мог уже списать средства за этот запрос. Решение сохранится в журнале.",
                      )
                    ) {
                      void onResolveAttention?.(job.id, "acknowledged_no_result");
                    }
                  }}
                >
                  Подтвердить: результата нет
                </button>
              </div>
            </div>
          )}
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
      {attentionRequired ? (
        <details className="attention-job-details">
          <summary>Показать детали старой ошибки</summary>
          {body}
        </details>
      ) : body}
    </article>
  );
}
