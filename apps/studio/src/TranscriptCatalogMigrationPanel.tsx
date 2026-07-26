import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  mutateWithCsrfRetry,
} from "./apiClient";
import * as googlePicker from "./googlePicker";
import type { PickerSession } from "./googlePicker";
import { googlePickerFailureMessage } from "./googlePickerErrors";
import {
  parseCatalogMigrationApply,
  parseCatalogMigrationDryRun,
  type CatalogImportStatus,
  type CatalogMigrationAction,
  type CatalogMigrationApply,
  type CatalogMigrationDryRun,
  type CatalogMigrationOutcome,
  type CatalogSettingsStatus,
  type CatalogStandardStatus,
  type CatalogStandardizationOutcome,
} from "./transcriptCatalogMigrationModel";

type BusyState = "picker" | "dry-run" | "apply" | null;
type SelectedFolder = { id: string; name: string };

const STANDARD_LABELS: Record<CatalogStandardStatus, string> = {
  current: "Актуальный стандарт",
  outdated: "Требует обновления",
  unstructured: "Без структуры",
  unreadable: "Не удалось прочитать",
};
const IMPORT_LABELS: Record<CatalogImportStatus, string> = {
  not_imported: "Не импортирован",
  imported_exact: "Уже в каталоге",
  conflict: "Конфликт каталога",
};
const SETTINGS_LABELS: Record<CatalogSettingsStatus, string> = {
  exact: "Настройки определены",
  indeterminate: "Настройки не определены",
};
const ACTION_LABELS: Record<CatalogMigrationAction, string> = {
  import_metadata: "Импортировать метаданные",
  standardize_and_import: "Стандартизировать и импортировать",
  standardize_document: "Стандартизировать документ",
  unchanged: "Оставить без изменений",
  blocked: "Заблокировано",
};
const OUTCOME_LABELS: Record<CatalogMigrationOutcome, string> = {
  imported: "Импортировано",
  already_applied: "Уже применено",
  unchanged: "Без изменений",
  blocked: "Заблокировано",
  conflict: "Конфликт",
};
const STANDARDIZATION_LABELS: Record<
  CatalogStandardizationOutcome,
  string
> = {
  not_required: "Не требовалась",
  changed: "Документ обновлён",
  already_current: "Уже актуален",
  blocked: "Заблокирована",
};
const ERROR_MESSAGES: Record<string, string> = {
  catalog_google_connection_missing:
    "Подключите Google Drive перед миграцией каталога.",
  catalog_google_connection_inactive:
    "Подключение Google Drive неактивно. Обновите его в настройках.",
  catalog_google_reauthorization_required:
    "Google Drive требует повторного подключения.",
  catalog_google_scope_unavailable:
    "Текущего разрешения Google Drive недостаточно для миграции.",
  catalog_google_config_unavailable:
    "Интеграция Google Drive временно не настроена.",
  catalog_google_token_unavailable:
    "Google Drive временно недоступен. Повторите попытку позже.",
  catalog_folder_unavailable:
    "Выбранная папка недоступна приложению. Выберите её через Google Picker ещё раз.",
  catalog_google_rate_limited:
    "Google Drive ограничил частоту запросов. Повторите попытку позже.",
  catalog_google_unavailable:
    "Google Drive временно недоступен. Повторите попытку позже.",
  catalog_google_timeout:
    "Google Drive не ответил вовремя. Повторите попытку.",
  catalog_google_response_invalid:
    "Google Drive вернул неожиданный ответ. Повторите попытку позже.",
  catalog_scan_incomplete:
    "Сканирование папки не завершилось. Результат не применён.",
  catalog_scan_limit_exceeded:
    "В папке слишком много документов для одной миграции.",
  catalog_document_unavailable:
    "Один из документов стал недоступен. Запустите проверку заново.",
  catalog_document_write_rejected:
    "Google Drive отклонил изменение документа.",
  catalog_document_revision_changed:
    "Документ изменился после проверки. Запустите dry-run заново.",
  catalog_document_multiple_tabs:
    "Документ с несколькими вкладками нельзя стандартизировать автоматически.",
  catalog_document_content_unsupported:
    "Структура одного из документов не поддерживается.",
  catalog_document_classification_changed:
    "Состояние документа изменилось. Запустите dry-run заново.",
  catalog_document_empty:
    "Пустой документ нельзя импортировать как транскрипт.",
  catalog_document_limit_exceeded:
    "Один из документов слишком большой для безопасной стандартизации.",
};

function apiReason(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.data) return null;
  const payload = error.data;
  if (typeof payload !== "object" || !("detail" in payload)) return null;
  const detail = (payload as { detail?: unknown }).detail;
  if (!detail || typeof detail !== "object" || !("reason" in detail)) {
    return null;
  }
  const reason = (detail as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : null;
}

function catalogErrorMessage(error: unknown): string {
  const reason = apiReason(error);
  if (reason && ERROR_MESSAGES[reason]) return ERROR_MESSAGES[reason];
  if (error instanceof ApiError && error.status === 429) return error.message;
  return "Не удалось выполнить миграцию. Повторите попытку.";
}

function safeFolderName(value: unknown): string {
  if (typeof value !== "string") return "Выбранная папка Google Drive";
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, 160) : "Выбранная папка Google Drive";
}

function explicitConfirmation(message: string): boolean {
  try {
    return window.confirm(message) === true;
  } catch {
    return false;
  }
}

function DryRunResult({ result }: { result: CatalogMigrationDryRun }) {
  const actionable =
    result.summary.import_metadata_count +
    result.summary.standardize_and_import_count +
    result.summary.standardize_document_count;
  return (
    <div className="catalog-migration-result" aria-label="Результат dry-run">
      <h4>План миграции</h4>
      <dl className="catalog-migration-summary">
        <div>
          <dt>Google Docs в папке</dt>
          <dd>{result.scan_summary.google_document_count}</dd>
        </div>
        <div>
          <dt>Будут изменены или импортированы</dt>
          <dd>{actionable}</dd>
        </div>
        <div>
          <dt>Без изменений</dt>
          <dd>{result.summary.unchanged_count}</dd>
        </div>
        <div>
          <dt>Заблокированы</dt>
          <dd>{result.summary.blocked_count}</dd>
        </div>
      </dl>
      <p className="muted">
        Найдено вложенных папок: {result.scan_summary.nested_folder_count}.
        Пропущено других файлов:{" "}
        {result.scan_summary.skipped_non_document_count}.
      </p>
      {result.summary.blocked_count > 0 && (
        <p className="notice">
          Заблокированные документы останутся без изменений. Проверьте причины
          в списке.
        </p>
      )}
      {result.scan_summary.nested_folder_count > 0 && (
        <p className="notice">
          Вложенные папки обнаружены, но не обходятся. При необходимости
          выберите каждую из них отдельным запуском.
        </p>
      )}
      <div className="catalog-migration-table-wrap">
        <table className="catalog-migration-table">
          <thead>
            <tr>
              <th>Документ</th>
              <th>Стандарт</th>
              <th>Каталог</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.position}>
                <td>{item.name}</td>
                <td>{STANDARD_LABELS[item.standard_status]}</td>
                <td>
                  {IMPORT_LABELS[item.import_status]}
                  <span className="muted catalog-settings-status">
                    {SETTINGS_LABELS[item.settings_status]}
                  </span>
                </td>
                <td>
                  {ACTION_LABELS[item.action]}
                  {item.reason_code === "catalog_conflict" && (
                    <span className="error catalog-item-reason">
                      Требуется отдельное разрешение конфликта
                    </span>
                  )}
                  {item.reason_code === "document_unreadable" && (
                    <span className="error catalog-item-reason">
                      Документ недоступен для чтения
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApplyResult({ result }: { result: CatalogMigrationApply }) {
  return (
    <div
      className="catalog-migration-result"
      aria-label="Результат применения миграции"
    >
      <h4>Миграция завершена</h4>
      <dl className="catalog-migration-summary">
        <div>
          <dt>Импортировано</dt>
          <dd>{result.summary.imported_count}</dd>
        </div>
        <div>
          <dt>Документов стандартизировано</dt>
          <dd>{result.summary.document_standardized_count}</dd>
        </div>
        <div>
          <dt>Уже было применено</dt>
          <dd>{result.summary.already_applied_count}</dd>
        </div>
        <div>
          <dt>Конфликты и блокировки</dt>
          <dd>
            {result.summary.conflict_count + result.summary.blocked_count}
          </dd>
        </div>
      </dl>
      <div className="catalog-migration-table-wrap">
        <table className="catalog-migration-table">
          <thead>
            <tr>
              <th>Документ</th>
              <th>Действие</th>
              <th>Результат</th>
              <th>Стандартизация</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.position}>
                <td>{item.name}</td>
                <td>{ACTION_LABELS[item.action]}</td>
                <td>{OUTCOME_LABELS[item.outcome]}</td>
                <td>
                  {STANDARDIZATION_LABELS[item.standardization_outcome]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TranscriptCatalogMigrationPanel({
  csrf,
  onCsrf,
  googleConnected,
  googleLoading,
  pickerReady,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
  googleConnected: boolean;
  googleLoading: boolean;
  pickerReady: boolean;
}) {
  const [selectedFolder, setSelectedFolder] =
    useState<SelectedFolder | null>(null);
  const [dryRun, setDryRun] = useState<CatalogMigrationDryRun | null>(null);
  const [applyResult, setApplyResult] =
    useState<CatalogMigrationApply | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState("");
  const pickerActive = useRef(false);
  const operationActive = useRef(false);

  const mutate = <T,>(path: string, options: RequestInit) =>
    mutateWithCsrfRetry<T>(path, csrf, onCsrf, options);

  useEffect(() => {
    if (pickerReady) return;
    setSelectedFolder(null);
    setDryRun(null);
    setApplyResult(null);
  }, [pickerReady]);

  async function chooseFolder() {
    if (!pickerReady || busy || pickerActive.current) return;
    pickerActive.current = true;
    setBusy("picker");
    setMessage("");
    try {
      const session = await mutate<PickerSession>(
        "/google/picker/session",
        { method: "POST" },
      );
      const result = await googlePicker.openGooglePicker(
        "catalog-folder",
        session,
      );
      if (result.action === "cancel") return;
      if (result.action === "error") {
        setMessage(result.message);
        return;
      }
      const folder = result.docs[0];
      if (!folder?.id || result.docs.length !== 1) {
        setMessage("Выберите одну папку Google Drive.");
        return;
      }
      setSelectedFolder({
        id: folder.id,
        name: safeFolderName(folder.name),
      });
      setDryRun(null);
      setApplyResult(null);
    } catch (error) {
      setMessage(
        googlePickerFailureMessage(error) ??
          "Не удалось открыть Google Picker.",
      );
    } finally {
      pickerActive.current = false;
      setBusy(null);
    }
  }

  async function runDryRun() {
    if (!pickerReady || !selectedFolder || busy || operationActive.current) {
      return;
    }
    operationActive.current = true;
    setBusy("dry-run");
    setMessage("");
    setDryRun(null);
    setApplyResult(null);
    try {
      const raw = await mutate<unknown>(
        "/transcript-catalog/migration/dry-run",
        {
          method: "POST",
          body: JSON.stringify({ folder_id: selectedFolder.id }),
        },
      );
      setDryRun(parseCatalogMigrationDryRun(raw));
    } catch (error) {
      setDryRun(null);
      setMessage(catalogErrorMessage(error));
    } finally {
      operationActive.current = false;
      setBusy(null);
    }
  }

  async function applyMigration() {
    if (
      !pickerReady ||
      !selectedFolder ||
      !dryRun ||
      busy ||
      operationActive.current
    ) {
      return;
    }
    const actionable =
      dryRun.summary.import_metadata_count +
      dryRun.summary.standardize_and_import_count +
      dryRun.summary.standardize_document_count;
    if (actionable === 0) return;
    if (
      !explicitConfirmation(
        `Применить миграцию к папке «${selectedFolder.name}»? ` +
          "Подходящие Google Docs будут стандартизированы на месте, " +
          "а безопасные метаданные будут импортированы в Studio.",
      )
    ) {
      return;
    }
    operationActive.current = true;
    setBusy("apply");
    setMessage("");
    try {
      const raw = await mutate<unknown>(
        "/transcript-catalog/migration/apply",
        {
          method: "POST",
          body: JSON.stringify({
            folder_id: selectedFolder.id,
            confirm_apply: true,
          }),
        },
      );
      setApplyResult(parseCatalogMigrationApply(raw));
      setDryRun(null);
    } catch (error) {
      setDryRun(null);
      setMessage(catalogErrorMessage(error));
    } finally {
      operationActive.current = false;
      setBusy(null);
    }
  }

  const actionable = dryRun
    ? dryRun.summary.import_metadata_count +
      dryRun.summary.standardize_and_import_count +
      dryRun.summary.standardize_document_count
    : 0;

  return (
    <section
      className="card transcript-catalog-migration"
      aria-labelledby="transcript-catalog-migration-title"
    >
      <span className="tag">Одноразовая операция</span>
      <h3 id="transcript-catalog-migration-title">
        Миграция каталога транскриптов
      </h3>
      <p>
        Выберите существующую папку с Google Docs. Сначала Studio выполнит
        безопасную проверку без изменений. Применение запускается отдельно и
        может обновить подходящие документы до{" "}
        <code>transcript_doc_v1.2</code> на месте.
      </p>
      <p className="muted">
        Транскрипция и LLM не вызываются. Тексты документов не сохраняются в
        Studio и не возвращаются в браузер. Обрабатываются только Google Docs
        непосредственно в выбранной папке.
      </p>
      {googleLoading && (
        <p className="notice">Проверяем подключение Google Drive…</p>
      )}
      {!googleLoading && !googleConnected && (
        <p className="notice">Сначала подключите Google Drive выше.</p>
      )}
      {!googleLoading && googleConnected && !pickerReady && (
        <p className="notice">
          Обновите подключение Google Drive, чтобы выбрать папку.
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          disabled={!pickerReady || busy !== null}
          onClick={chooseFolder}
        >
          {busy === "picker"
            ? "Открываем Google Drive…"
            : selectedFolder
              ? "Выбрать другую папку"
              : "Выбрать папку каталога"}
        </button>
        <button
          type="button"
          className="primary"
          disabled={!pickerReady || !selectedFolder || busy !== null}
          onClick={runDryRun}
        >
          {busy === "dry-run" ? "Проверяем…" : "Запустить dry-run"}
        </button>
      </div>
      {selectedFolder && (
        <p className="folder-status" role="status">
          Выбрана папка: <b>{selectedFolder.name}</b>
        </p>
      )}
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
      {dryRun && <DryRunResult result={dryRun} />}
      {dryRun && (
        <div className="catalog-migration-apply">
          <p>
            Перед применением сервер заново просканирует папку и не будет
            доверять сохранённому preview.
          </p>
          <button
            type="button"
            className="primary"
            disabled={!pickerReady || busy !== null || actionable === 0}
            onClick={applyMigration}
          >
            {busy === "apply"
              ? "Применяем…"
              : `Подтвердить и применить (${actionable})`}
          </button>
        </div>
      )}
      {applyResult && <ApplyResult result={applyResult} />}
    </section>
  );
}
