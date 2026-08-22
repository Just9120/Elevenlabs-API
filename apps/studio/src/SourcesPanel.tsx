import { ApiError, api, mutateWithCsrfRetry } from "./apiClient";
import { runBoundedRequest } from "./jobMutationRequest";
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

export type SourceDeletionNotice = {
  projectId: string;
  sourceId: string;
  message: string;
  tone: "notice" | "error";
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

function isAmbiguousDeletionFailure(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && (error.status === 408 || error.status >= 500))
  );
}

function sourceListConfirmsAbsence(value: unknown, sourceId: string) {
  if (!value || typeof value !== "object" || !("sources" in value)) {
    return false;
  }
  const items = (value as { sources?: unknown }).sources;
  if (!Array.isArray(items)) return false;
  const ids: string[] = [];
  for (const item of items) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { id?: unknown }).id !== "string"
    ) {
      return false;
    }
    ids.push((item as { id: string }).id);
  }
  return !ids.includes(sourceId);
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
  pendingDeletionIds,
  deletionNotices,
  beginDeletion,
  finishDeletion,
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
  pendingDeletionIds: ReadonlySet<string>;
  deletionNotices: Readonly<Record<string, SourceDeletionNotice>>;
  beginDeletion: (sourceId: string) => boolean;
  finishDeletion: (
    sourceId: string,
    notice: SourceDeletionNotice,
  ) => void;
}) {
  function confirmedDeletionMessage(
    source: Source,
    storageCleanup?: SourceDeletionResponse["storage_cleanup"],
  ) {
    if (storageCleanup === "pending") {
      return source.upload_status === "pending"
        ? "Файл убран из проекта. Временная копия поставлена в очередь на удаление после завершения окна загрузки."
        : "Файл убран из проекта. Временная копия поставлена в очередь фонового удаления; выбранный срок хранения ждать не нужно.";
    }
    return storageCleanup === "completed"
      ? "Файл убран из проекта. Временная копия уже удалена из хранилища."
      : "Файл убран из проекта.";
  }

  function applyConfirmedDeletion(
    source: Source,
    storageCleanup?: SourceDeletionResponse["storage_cleanup"],
  ) {
    onSourceRemoved?.(source, storageCleanup);
    onReload(project.id);
  }

  async function reconcileAmbiguousDeletion(source: Source) {
    try {
      const result = await runBoundedRequest((signal) =>
        api<unknown>(`/projects/${project.id}/sources`, {
          signal,
          cache: "no-store",
        }),
      );
      if (
        result.status === "completed" &&
        sourceListConfirmsAbsence(result.value, source.id)
      ) {
        applyConfirmedDeletion(source);
        return true;
      }
    } catch {
      // The predefined ambiguous outcome below remains authoritative.
    }
    onReload(project.id);
    return false;
  }

  async function deleteSource(id: string) {
    const source = sources.items.find((item) => item.id === id);
    if (!source || pendingDeletionIds.has(id)) return;
    const message =
      source.source_type === "google_drive"
        ? "Источник будет убран только из Studio. Файл останется на Google Drive."
        : "Источник будет убран из Studio. Временная копия будет удалена из хранилища после безопасной проверки связанных задач.";
    if (!safeConfirm(message) || !beginDeletion(id)) return;
    let notice: SourceDeletionNotice | null = null;
    try {
      const bounded = await runBoundedRequest((signal) =>
        mutateWithCsrfRetry<SourceDeletionResponse>(
          `/sources/${id}`,
          csrf,
          onCsrf,
          { method: "DELETE", signal },
        ),
      );
      if (bounded.status === "timed_out") {
        const confirmed = await reconcileAmbiguousDeletion(source);
        notice = {
          projectId: project.id,
          sourceId: id,
          message: confirmed
            ? "Файл убран из проекта."
            : "Сервер не подтвердил удаление файла. Список файлов обновлён; подождите и повторите при необходимости.",
          tone: confirmed ? "notice" : "error",
        };
        return;
      }
      const result = bounded.value;
      if (!isExpectedDeletionResponse(result, source)) {
        onReload(project.id);
        notice = {
          projectId: project.id,
          sourceId: id,
          message:
            "Сервер вернул несогласованное подтверждение удаления. Список файлов обновлён.",
          tone: "error",
        };
        return;
      }
      applyConfirmedDeletion(source, result.storage_cleanup);
      notice = {
        projectId: project.id,
        sourceId: id,
        message: confirmedDeletionMessage(source, result.storage_cleanup),
        tone: "notice",
      };
    } catch (error) {
      if (isAmbiguousDeletionFailure(error)) {
        const confirmed = await reconcileAmbiguousDeletion(source);
        notice = {
          projectId: project.id,
          sourceId: id,
          message: confirmed
            ? "Файл убран из проекта."
            : "Сервер не подтвердил удаление файла. Список файлов обновлён; подождите и повторите при необходимости.",
          tone: confirmed ? "notice" : "error",
        };
        return;
      }
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
      notice = {
        projectId: project.id,
        sourceId: id,
        message:
          reason && messages[reason]
            ? messages[reason]
            : "Не удалось убрать файл из проекта.",
        tone: "error",
      };
    } finally {
      finishDeletion(
        id,
        notice ?? {
          projectId: project.id,
          sourceId: id,
          message: "Не удалось убрать файл из проекта.",
          tone: "error",
        },
      );
    }
  }
  return (
    <section className="sources" aria-label={`Источники ${project.title}`}>
      <h2>Источники</h2>
      {Object.values(deletionNotices)
        .filter((notice) => notice.projectId === project.id)
        .map((notice) => (
          <p
            key={notice.sourceId}
            className={notice.tone}
            role="status"
          >
            {notice.message}
          </p>
        ))}
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
          <span>
            Создан исходный файл: {source.source_created_at
              ? formatTime(source.source_created_at)
              : "не удалось определить"}
          </span>
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
              disabled={pendingDeletionIds.has(source.id)}
              aria-busy={pendingDeletionIds.has(source.id)}
            >
              {pendingDeletionIds.has(source.id)
                ? "Удаление…"
                : "Убрать из проекта"}
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
