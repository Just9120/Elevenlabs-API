import type { TranscriptionJob } from "./jobModel";

export function JobCardActions({
  job,
  onOpen,
  onCancel,
}: {
  job: TranscriptionJob;
  onOpen: (jobId: string) => void | Promise<void>;
  onCancel: (jobId: string) => void | Promise<void>;
}) {
  return (
    <div className="job-actions">
      <button type="button" onClick={() => void onOpen(job.id)}>
        Открыть
      </button>
      {job.status === "queued" && (
        <button type="button" onClick={() => void onCancel(job.id)}>
          Отменить
        </button>
      )}
      {job.status === "processing" && !job.cancel_requested_at && (
        <button type="button" onClick={() => void onCancel(job.id)}>
          Запросить отмену
        </button>
      )}
      {job.status === "processing" && job.cancel_requested_at && (
        <span>Отмена запрошена</span>
      )}
    </div>
  );
}
