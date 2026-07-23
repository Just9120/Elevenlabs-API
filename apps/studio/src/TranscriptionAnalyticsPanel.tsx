import { useEffect, useRef, useState } from "react";
import { api } from "./apiClient";
import {
  parseTranscriptionAnalytics,
  type AnalyticsDurationSummary,
  type TranscriptionAnalytics,
} from "./transcriptionAnalyticsModel";

type AnalyticsState = {
  status: "idle" | "loading" | "ready" | "error";
  data: TranscriptionAnalytics | null;
};

type AnalyticsLoader = (projectId: string) => Promise<unknown>;

const EMPTY_STATE: AnalyticsState = { status: "idle", data: null };

const OUTCOME_LABELS: Array<
  [keyof TranscriptionAnalytics["outcomes"], string]
> = [
  ["queued", "В очереди"],
  ["processing", "В обработке"],
  ["completed", "Готово"],
  ["failed", "Ошибки"],
  ["cancelled", "Отменено"],
];

const DURATION_LABELS: Array<
  [keyof TranscriptionAnalytics["durations"], string]
> = [
  ["queue", "Ожидание в очереди"],
  ["processing", "Обработка задачи"],
  ["provider_processing", "ElevenLabs"],
  ["post_provider_output", "После ElevenLabs до результата"],
];

function formatDuration(value: number | null) {
  if (value === null) return "Нет данных";
  const seconds = Math.round(value);
  if (seconds < 60) return `${seconds} с`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60)
    return remainingSeconds > 0
      ? `${minutes} мин ${remainingSeconds} с`
      : `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${hours} ч ${remainingMinutes} мин`
    : `${hours} ч`;
}

function DurationCard({
  label,
  summary,
}: {
  label: string;
  summary: AnalyticsDurationSummary;
}) {
  return (
    <article className="analytics-metric">
      <span className="muted">{label}</span>
      <strong>{formatDuration(summary.average_seconds)}</strong>
      {summary.sample_count > 0 ? (
        <small>
          медиана {formatDuration(summary.p50_seconds)} · p95{" "}
          {formatDuration(summary.p95_seconds)} · замеров {summary.sample_count}
        </small>
      ) : (
        <small>Появится после завершённых серверных этапов.</small>
      )}
    </article>
  );
}

export function TranscriptionAnalyticsPanel({
  projectId,
  loadAnalytics = (id) =>
    api<unknown>(`/projects/${id}/transcription-analytics`),
}: {
  projectId: string;
  loadAnalytics?: AnalyticsLoader;
}) {
  const [state, setState] = useState<AnalyticsState>(EMPTY_STATE);
  const requestGeneration = useRef(0);

  useEffect(() => {
    requestGeneration.current += 1;
    setState(EMPTY_STATE);
    return () => {
      requestGeneration.current += 1;
    };
  }, [projectId]);

  async function load() {
    const generation = ++requestGeneration.current;
    setState((current) => ({
      status: "loading",
      data: current.data,
    }));
    try {
      const parsed = parseTranscriptionAnalytics(
        await loadAnalytics(projectId),
      );
      if (!parsed) throw new Error("Invalid transcription analytics response");
      if (requestGeneration.current !== generation) return;
      setState({ status: "ready", data: parsed });
    } catch {
      if (requestGeneration.current !== generation) return;
      setState((current) => ({ status: "error", data: current.data }));
    }
  }

  const analytics = state.data;
  return (
    <details
      className="transcription-analytics"
      onToggle={(event) => {
        if (event.currentTarget.open && state.status === "idle") void load();
      }}
    >
      <summary>Аналитика транскрибаций</summary>
      <div className="analytics-content">
        <div className="split analytics-heading">
          <p className="muted">
            Агрегаты за всё время проекта без текстов транскриптов и приватных
            идентификаторов.
          </p>
          <button
            className="secondary"
            disabled={state.status === "loading"}
            onClick={() => void load()}
            type="button"
          >
            {state.status === "loading" ? "Обновляем…" : "Обновить"}
          </button>
        </div>
        {state.status === "loading" && !analytics && (
          <p role="status">Загрузка аналитики…</p>
        )}
        {state.status === "error" && !analytics && (
          <p className="notice">
            Аналитика временно недоступна. Попробуйте обновить позднее.
          </p>
        )}
        {analytics && (
          <>
            <div className="analytics-total-grid">
              <article>
                <span>Задачи</span>
                <strong>{analytics.totals.jobs}</strong>
              </article>
              <article>
                <span>Источники</span>
                <strong>{analytics.totals.sources}</strong>
              </article>
              <article>
                <span>Результаты</span>
                <strong>{analytics.totals.outputs}</strong>
              </article>
            </div>

            <section aria-label="Исходы транскрибаций">
              <h5>Исходы</h5>
              <div className="analytics-outcomes">
                {OUTCOME_LABELS.map(([key, label]) => (
                  <span key={key}>
                    {label} <b>{analytics.outcomes[key]}</b>
                  </span>
                ))}
              </div>
            </section>

            <section aria-label="Выбранные настройки транскрибаций">
              <h5>Настройки</h5>
              <div className="analytics-config-grid">
                <article>
                  <b>Провайдер и модель</b>
                  <span>
                    ElevenLabs · scribe_v2{" "}
                    {analytics.configuration.provider_model.elevenlabs_scribe_v2}
                  </span>
                  {analytics.configuration.provider_model.unknown > 0 && (
                    <small>
                      Не определено:{" "}
                      {analytics.configuration.provider_model.unknown}
                    </small>
                  )}
                </article>
                <article>
                  <b>Язык</b>
                  <span>
                    Русский {analytics.configuration.language_mode.ru} ·
                    автоопределение{" "}
                    {analytics.configuration.language_mode.detect}
                  </span>
                  {analytics.configuration.language_mode.other > 0 && (
                    <small>
                      Другой режим:{" "}
                      {analytics.configuration.language_mode.other}
                    </small>
                  )}
                </article>
                <article>
                  <b>Спикеры</b>
                  <span>
                    Разделение включено{" "}
                    {analytics.configuration.diarization.enabled} · выключено{" "}
                    {analytics.configuration.diarization.disabled}
                  </span>
                </article>
              </div>
            </section>

            <section aria-label="Длительности этапов транскрибаций">
              <h5>Средняя длительность</h5>
              <div className="analytics-duration-grid">
                {DURATION_LABELS.map(([key, label]) => (
                  <DurationCard
                    key={key}
                    label={label}
                    summary={analytics.durations[key]}
                  />
                ))}
              </div>
              <p className="muted analytics-footnote">
                Последний интервал объединяет слияние частей и создание
                результата в Google Docs. Незавершённые этапы в статистику не
                входят.
              </p>
            </section>
          </>
        )}
        {state.status === "error" && analytics && (
          <p className="notice">
            Не удалось обновить данные; показана последняя подтверждённая
            версия.
          </p>
        )}
      </div>
    </details>
  );
}
