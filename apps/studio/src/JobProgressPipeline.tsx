import type {
  JobProgressStage,
  JobProgressStageKey,
  JobProgressState,
} from "./jobProgressModel";
import { confirmedProgressPercent } from "./jobProgressModel";

const STAGE_LABELS: Record<JobProgressStageKey, string> = {
  preparation: "Подготовка источника",
  audio_extraction: "Извлечение аудио",
  splitting: "Разбиение на части (при необходимости)",
  provider_processing: "Транскрибация ElevenLabs",
  part_merge: "Слияние частей (при необходимости)",
  google_docs_output: "Создание Google Docs",
};

function statusLabel(stage: JobProgressStage) {
  if (stage.status === "pending") return "Ожидает";
  if (stage.status === "active") return "Выполняется";
  if (stage.status === "failed") return "Ошибка";
  if (stage.status === "cancelled") return "Отменено";
  if (stage.status === "not_applicable") return "Не требуется";
  return stage.applicability === "conditional" ? "Проверено" : "Готово";
}

export function JobProgressPipeline({
  jobId,
  state,
}: {
  jobId: string;
  state: JobProgressState | undefined;
}) {
  if (!state) return null;
  if (state.loading && !state.data)
    return <p role="status">Загрузка прогресса…</p>;
  if (!state.data)
    return (
      <p className="notice">
        Прогресс временно недоступен. Обновите страницу позднее.
      </p>
    );

  const progress = state.data;
  const percent = confirmedProgressPercent(progress);
  return (
    <section
      className="job-progress"
      aria-label={`Прогресс задачи ${jobId}`}
      aria-live="polite"
    >
      <div className="job-progress-header">
        <strong>Этапы обработки</strong>
        <strong>{percent}%</strong>
      </div>
      <progress
        className="job-progress-meter"
        max={100}
        value={percent}
        aria-label="Подтверждённый прогресс"
      >
        {percent}%
      </progress>
      <span>
        Готово файлов: {progress.completed_source_count} из{" "}
        {progress.total_source_count}
      </span>
      <p className="muted">
        Процент обновляется только после подтверждённых этапов обработки.
      </p>
      {progress.sources.map((source) => (
        <div className="job-progress-source" key={source.position}>
          <b>
            {source.position + 1}. {source.name}
          </b>
          {source.provider_parts && (
            <span className="muted">
              Части ElevenLabs: {source.provider_parts.completed} из{" "}
              {source.provider_parts.total}
            </span>
          )}
          <ol className="job-progress-steps">
            {source.stages.map((stage) => (
              <li
                className={`job-progress-step progress-${stage.status}`}
                key={stage.key}
              >
                <span aria-hidden="true" className="job-progress-marker" />
                <span>{STAGE_LABELS[stage.key]}</span>
                <small>{statusLabel(stage)}</small>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {state.error && (
        <p className="notice">
          Не удалось обновить прогресс; показан последний подтверждённый статус.
        </p>
      )}
    </section>
  );
}
