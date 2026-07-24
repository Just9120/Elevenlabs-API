import { ApiError, mutateWithCsrfRetry } from "./apiClient";
import { formatBytes, formatTime } from "./formatters";
import { isSafeDisplayUrl, ResourceExternalLink } from "./resourceLinks";
import {
  isUsableJobSource,
  sourceСтатусLabel,
  unusableJobSourceReason,
  type Source,
} from "./sourceModel";

type SourcesState = {
  loading: boolean;
  error: string;
  loaded: boolean;
  items: Source[];
};

type SourceDeletionResponse = {
  ok: boolean;
  source_state?: string;
  storage_cleanup?: "not_applicable" | "pending" | "completed";
};

function isExpectedDeletionResponse(
  value: SourceDeletionResponse,
  source: Source,
) {
  return (
    value.ok === true &&
    value.source_state === "deleted" &&
    (source.source_type === "google_drive"
      ? value.storage_cleanup === "not_applicable"
      : value.storage_cleanup === "pending" ||
        value.storage_cleanup === "completed")
  );
}

function safeConfirm(message: string) {
  try {
    return window.confirm(message) !== false;
  } catch {
    return false;
  }
}

export function SourcesPanel({
  project,
  csrf,
  onCsrf,
  sources,
  onReload,
  onSourceRemoved,
  onError,
}: {
  project: { id: string; title: string };
  csrf: string;
  onCsrf: (csrf: string) => void;
  sources: SourcesState;
  onReload: (projectId: string) => void;
  onSourceRemoved?: (
    source: Source,
    storageCleanup?: SourceDeletionResponse["storage_cleanup"],
  ) => void;
  onError: (message: string) => void;
}) {
  async function deleteSource(id: string) {
    const source = sources.items.find((item) => item.id === id);
    const message =
      source?.source_type === "google_drive"
        ? "Источник будет убран только из Studio. Файл останется на Google Drive."
        : "Источник будет убран из Studio. Временная копия будет удалена из хранилища после безопасной проверки связанных задач.";
    if (!safeConfirm(message)) return;
    try {
      const result = await mutateWithCsrfRetry<SourceDeletionResponse>(
        `/sources/${id}`,
        csrf,
        onCsrf,
        { method: "DELETE" },
      );
      if (!source || !isExpectedDeletionResponse(result, source)) {
        onError(
          "Сервер вернул несогласованное подтверждение удаления. Список файлов обновлён.",
        );
        onReload(project.id);
        return;
      }
      onSourceRemoved?.(source, result.storage_cleanup);
      onReload(project.id);
    } catch (error) {
      const detail =
        error instanceof ApiError &&
        error.data &&
        typeof error.data === "object" &&
        "detail" in error.data
          ? (error.data as { detail?: unknown }).detail
          : null;
      const reason =
        detail && typeof detail === "object" && "reason" in detail
          ? (detail as { reason?: string }).reason
          : null;
      const messages: Record<string, string> = {
        queued_job_uses_source:
          "Сначала отмените ожидающие задачи, использующие этот файл.",
        processing_job_uses_source:
          "Дождитесь завершения или отмены текущей обработки.",
        retryable_failed_job_uses_source:
          "Источник нужен для доступного безопасного повтора задачи.",
      };
      onError(
        reason && messages[reason]
          ? messages[reason]
          : "Не удалось убрать файл из проекта.",
      );
    }
  }

  return (
    <section className="sources" aria-label={`Источники ${project.title}`}>
      <h4>Источники</h4>
      {sources.loading && <p role="status">Загрузка файлов…</p>}
      {sources.error && <p className="error">{sources.error}</p>}
      {sources.loaded && !sources.loading && sources.items.length === 0 && (
        <p className="notice">Источники пока не добавлены.</p>
      )}
      {sources.items.map((source) => (
        <article className="source-card" key={source.id}>
          <b>{source.original_filename}</b>
          <span>
            {source.source_type === "google_drive"
              ? "Google Drive"
              : "С устройства"}
          </span>
          <span>Статус: {sourceСтатусLabel(source.upload_status)}</span>
          {!isUsableJobSource(source) && (
            <span>{unusableJobSourceReason(source)}</span>
          )}
          <span>Размер: {formatBytes(source.size_bytes)}</span>
          {source.source_type === "local_upload" && source.expires_at && (
            <span>Хранится до: {formatTime(source.expires_at)}</span>
          )}
          <div className="resource-actions">
            {isSafeDisplayUrl(source.drive_file_url) && (
              <ResourceExternalLink
                href={source.drive_file_url ?? ""}
                label="Открыть файл в Google Drive"
                ariaLabel="Открыть файл в Google Drive в новой вкладке"
              />
            )}
            <div className="source-removal-note">
              {source.source_type === "google_drive"
                ? "Файл останется на Google Drive."
                : "Временную копию удалит фоновая очистка Studio."}
            </div>
            <button
              type="button"
              onClick={() => deleteSource(source.id)}
              aria-label={`Убрать из проекта: ${source.original_filename}`}
            >
              Убрать из проекта
            </button>
          </div>
          <details>
            <summary>Технические сведения</summary>
            <span>MIME: {source.mime_type || "не указан"}</span>
            <span>Загружен: {formatTime(source.uploaded_at)}</span>
            <span>Истекает: {formatTime(source.expires_at)}</span>
            <span>Удалён: {formatTime(source.deleted_at)}</span>
            {source.delete_reason && (
              <span>Причина: {source.delete_reason}</span>
            )}
          </details>
        </article>
      ))}
      <p className="notice">
        Добавление файлов выполняется в строках подготовки выше. Этот раздел —
        только для просмотра безопасных метаданных и удаления файлов из проекта.
      </p>
    </section>
  );
}
