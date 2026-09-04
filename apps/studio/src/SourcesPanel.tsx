import { useState } from "react";

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
  loadingMore: boolean;
  error: string;
  loaded: boolean;
  items: Source[];
  nextCursor: string | null;
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

type BulkSourceDeletionPreview = {
  preview_token: string;
  eligible_count: number;
  eligible_bytes: number;
  eligible_unknown_size_count: number;
  blocked_count: number;
  blocked_bytes: number;
  blocked_unknown_size_count: number;
  blocked_reasons: Record<string, number>;
  google_drive_files_deleted: 0;
};

type BulkSourceDeletionResponse = {
  ok: true;
  deleted_count: number;
  blocked_count: number;
  blocked_reasons: Record<string, number>;
  cleanup_counts: Record<string, number>;
  google_drive_files_deleted: 0;
};

const bulkBlockerLabels: Record<string, string> = {
  queued_job_uses_source: "используются ожидающей задачей",
  processing_job_uses_source: "используются текущей обработкой",
  retryable_failed_job_uses_source: "нужны для безопасного повтора",
  audio_preparation_uses_source: "используются подготовкой аудио",
  unsupported_source_state: "имеют неподдерживаемое состояние",
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

function sourceReadConfirmsDeletion(value: unknown, sourceId: string) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { id?: unknown }).id === sourceId &&
    (value as { upload_status?: unknown }).upload_status === "deleted" &&
    typeof (value as { deleted_at?: unknown }).deleted_at === "string"
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
  onLoadMore,
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
  onLoadMore: (projectId: string, cursor: string) => void;
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
  const [bulkPreview, setBulkPreview] = useState<BulkSourceDeletionPreview | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  async function previewBulkDeletion() {
    if (bulkPending) return;
    setBulkPending(true);
    setBulkMessage("");
    try {
      const value = await api<BulkSourceDeletionPreview>(
        `/projects/${project.id}/sources/bulk-deletion/preview`,
        { cache: "no-store" },
      );
      if (
        !value ||
        !/^[a-f0-9]{64}$/.test(value.preview_token) ||
        !Number.isInteger(value.eligible_count) ||
        !Number.isInteger(value.blocked_count) ||
        value.google_drive_files_deleted !== 0
      ) {
        throw new Error("invalid_bulk_preview");
      }
      setBulkPreview(value);
    } catch {
      setBulkMessage("Не удалось подготовить безопасный план очистки.");
    } finally {
      setBulkPending(false);
    }
  }

  async function applyBulkDeletion() {
    if (!bulkPreview || bulkPending || bulkPreview.eligible_count === 0) return;
    setBulkPending(true);
    setBulkMessage("");
    try {
      const value = await mutateWithCsrfRetry<BulkSourceDeletionResponse>(
        `/projects/${project.id}/sources/bulk-deletion`,
        csrf,
        onCsrf,
        {
          method: "POST",
          body: JSON.stringify({
            confirm_delete: true,
            expected_preview_token: bulkPreview.preview_token,
            expected_eligible_count: bulkPreview.eligible_count,
            expected_blocked_count: bulkPreview.blocked_count,
          }),
        },
      );
      if (!value || value.ok !== true || value.google_drive_files_deleted !== 0) {
        throw new Error("invalid_bulk_result");
      }
      setBulkPreview(null);
      setBulkMessage(
        `Из Studio убрано файлов: ${value.deleted_count}. Пропущено: ${value.blocked_count}. Файлы Google Drive не удалялись.`,
      );
      onReload(project.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setBulkMessage("Для очистки войдите в аккаунт заново и повторите проверку.");
      } else if (error instanceof ApiError && error.status === 409) {
        setBulkPreview(null);
        setBulkMessage("Состояние файлов изменилось. Нажмите «Очистить все файлы», чтобы проверить новый план.");
      } else {
        setBulkMessage("Studio не подтвердила массовую очистку. Обновите список и повторите проверку.");
        onReload(project.id);
      }
    } finally {
      setBulkPending(false);
    }
  }
  function confirmedDeletionMessage(
    source: Source,
    storageCleanup?: SourceDeletionResponse["storage_cleanup"],
  ) {
    if (storageCleanup === "pending") {
      return source.upload_status === "pending"
        ? "Файл убран из Studio. Временная копия поставлена в очередь на удаление после завершения окна загрузки."
        : "Файл убран из Studio. Временная копия поставлена в очередь фонового удаления; выбранный срок хранения ждать не нужно.";
    }
    return storageCleanup === "completed"
      ? "Файл убран из Studio. Временная копия уже удалена из хранилища."
      : "Файл убран из Studio.";
  }

  function applyConfirmedDeletion(
    source: Source,
    storageCleanup?: SourceDeletionResponse["storage_cleanup"],
  ) {
    onSourceRemoved?.(source, storageCleanup);
  }

  async function reconcileAmbiguousDeletion(source: Source) {
    try {
      const result = await runBoundedRequest((signal) =>
        api<unknown>(`/sources/${source.id}`, {
          signal,
          cache: "no-store",
        }),
      );
      if (
        result.status === "completed" &&
        sourceReadConfirmsDeletion(result.value, source.id)
      ) {
        applyConfirmedDeletion(source);
        return true;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        applyConfirmedDeletion(source);
        return true;
      }
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
            ? "Файл убран из Studio."
            : "Studio не подтвердила удаление файла. Список обновлён; подождите и повторите при необходимости.",
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
            "Studio вернула несогласованное подтверждение удаления. Список файлов обновлён.",
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
            ? "Файл убран из Studio."
            : "Studio не подтвердила удаление файла. Список обновлён; подождите и повторите при необходимости.",
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
            : "Не удалось убрать файл из Studio.",
        tone: "error",
      };
    } finally {
      finishDeletion(
        id,
        notice ?? {
          projectId: project.id,
          sourceId: id,
          message: "Не удалось убрать файл из Studio.",
          tone: "error",
        },
      );
    }
  }
  return (
    <section className="sources" aria-label="Сохранённые файлы Studio">
      <div className="split">
        <h3>Сохранённые файлы Studio</h3>
        <button
          type="button"
          className="danger"
          disabled={bulkPending}
          aria-busy={bulkPending || undefined}
          onClick={() => void previewBulkDeletion()}
        >
          {bulkPending ? "Проверяем…" : "Очистить все файлы"}
        </button>
      </div>
      {bulkMessage && <p className="notice" role="status">{bulkMessage}</p>}
      {bulkPreview && (
        <section className="bulk-deletion-preview" aria-label="План очистки файлов Studio">
          <h4>План очистки</h4>
          <p>
            Можно убрать: <b>{bulkPreview.eligible_count}</b> · известный объём {formatBytes(bulkPreview.eligible_bytes)}.
            {bulkPreview.eligible_unknown_size_count > 0
              ? ` Без размера: ${bulkPreview.eligible_unknown_size_count}.`
              : ""}
          </p>
          <p>
            Будут пропущены: <b>{bulkPreview.blocked_count}</b> · известный объём {formatBytes(bulkPreview.blocked_bytes)}.
          </p>
          {Object.keys(bulkPreview.blocked_reasons).length > 0 && (
            <ul>
              {Object.entries(bulkPreview.blocked_reasons).map(([reason, count]) => (
                <li key={reason}>{bulkBlockerLabels[reason] ?? "нельзя безопасно удалить"}: {count}</li>
              ))}
            </ul>
          )}
          <p className="notice">
            Удаляются только записи и временные копии Studio. Исходные файлы Google Drive останутся на месте.
          </p>
          <div className="actions">
            <button
              type="button"
              className="danger"
              disabled={bulkPending || bulkPreview.eligible_count === 0}
              onClick={() => void applyBulkDeletion()}
            >
              Подтвердить очистку ({bulkPreview.eligible_count})
            </button>
            <button type="button" className="secondary" disabled={bulkPending} onClick={() => setBulkPreview(null)}>
              Отмена
            </button>
          </div>
        </section>
      )}
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
              aria-label={`Убрать из Studio: ${source.original_filename}`}
              disabled={pendingDeletionIds.has(source.id)}
              aria-busy={pendingDeletionIds.has(source.id)}
            >
              {pendingDeletionIds.has(source.id)
                ? "Удаление…"
                : "Убрать из Studio"}
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
      {sources.nextCursor && (
        <button
          type="button"
          className="secondary"
          disabled={sources.loadingMore}
          onClick={() => onLoadMore(project.id, sources.nextCursor ?? "")}
        >
          {sources.loadingMore
            ? "Загружаем файлы…"
            : "Показать ещё файлы"}
        </button>
      )}
      <p className="notice">
        Этот раздел предназначен для просмотра безопасных метаданных и удаления
        файлов из Studio. Исходные файлы Google Drive при этом не удаляются.
      </p>
    </section>
  );
}
