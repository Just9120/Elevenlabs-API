import { useEffect, useRef, useState } from "react";
import { ApiError, mutateWithCsrfRetry } from "./apiClient";
import * as googlePicker from "./googlePicker";
import type { PickerSession } from "./googlePicker";
import { googlePickerFailureMessage } from "./googlePickerErrors";
import {
  parseTranscriptCatalogImportApply,
  parseTranscriptCatalogImportDryRun,
  parseTranscriptStandardizationApply,
  parseTranscriptStandardizationDryRun,
  type CatalogImportAction,
  type CatalogImportOutcome,
  type MaintenanceReason,
  type StandardizationAction,
  type StandardizationOutcome,
  type TranscriptCatalogImportApply,
  type TranscriptCatalogImportDryRun,
  type TranscriptImportStatus,
  type TranscriptMaintenanceApply,
  type TranscriptMaintenanceDryRun,
  type TranscriptMaintenanceWorkflow,
  type TranscriptSettingsStatus,
  type TranscriptStandardStatus,
  type TranscriptStandardizationApply,
  type TranscriptStandardizationDryRun,
} from "./transcriptMaintenanceModel";

type BusyState =
  | "folder-picker"
  | "document-picker"
  | "dry-run"
  | "apply"
  | null;
type SelectedFolder = { id: string; name: string };
type SelectedDocument = { id: string; name: string };
type Mutate = <T>(path: string, options: RequestInit) => Promise<T>;

const STANDARD_LABELS: Record<TranscriptStandardStatus, string> = {
  current: "Актуальный стандарт",
  outdated: "Требует обновления",
  unstructured: "Без структуры",
  unreadable: "Не удалось прочитать",
};
const IMPORT_LABELS: Record<TranscriptImportStatus, string> = {
  not_imported: "Не импортирован",
  imported_exact: "Уже учтён Studio",
  conflict: "Конфликт",
};
const SETTINGS_LABELS: Record<TranscriptSettingsStatus, string> = {
  exact: "Настройки определены",
  indeterminate: "Настройки не определены",
};
const STANDARDIZATION_ACTION_LABELS: Record<
  StandardizationAction,
  string
> = {
  standardize_document: "Стандартизировать документ",
  unchanged: "Оставить без изменений",
  blocked: "Заблокировано",
};
const CATALOG_ACTION_LABELS: Record<CatalogImportAction, string> = {
  import_metadata: "Импортировать метаданные",
  unchanged: "Оставить без изменений",
  blocked: "Заблокировано",
};
const STANDARDIZATION_OUTCOME_LABELS: Record<
  StandardizationOutcome,
  string
> = {
  standardized: "Документ обновлён",
  already_current: "Уже актуален",
  blocked: "Заблокировано",
};
const CATALOG_OUTCOME_LABELS: Record<CatalogImportOutcome, string> = {
  imported: "Импортировано",
  already_applied: "Уже импортировано",
  unchanged: "Без изменений",
  blocked: "Заблокировано",
  standardization_required: "Сначала нужна стандартизация",
  conflict: "Конфликт",
};
const REASON_LABELS: Record<MaintenanceReason, string> = {
  catalog_conflict: "Конфликт с существующей записью Studio",
  document_unreadable: "Документ недоступен для чтения",
  standardization_required: "Сначала стандартизируйте документ",
  catalog_metadata_conflict: "Метаданные Studio изменились",
};
const ERROR_MESSAGES: Record<string, string> = {
  catalog_google_connection_missing:
    "Подключите Google Drive перед операцией.",
  catalog_google_connection_inactive:
    "Подключение Google Drive неактивно. Обновите его в настройках.",
  catalog_google_reauthorization_required:
    "Google Drive требует повторного подключения.",
  catalog_google_scope_unavailable:
    "Текущего разрешения Google Drive недостаточно для операции.",
  catalog_google_config_unavailable:
    "Интеграция Google Drive временно не настроена.",
  catalog_google_token_unavailable:
    "Google Drive временно недоступен. Повторите попытку позже.",
  catalog_folder_unavailable:
    "Выбранная папка недоступна. Выберите её через Google Picker ещё раз.",
  catalog_google_rate_limited:
    "Google Drive ограничил частоту запросов. Повторите попытку позже.",
  catalog_google_unavailable:
    "Google Drive временно недоступен. Повторите попытку позже.",
  catalog_google_timeout:
    "Google Drive не ответил вовремя. Повторите попытку.",
  catalog_google_response_invalid:
    "Google Drive вернул неожиданный ответ. Повторите попытку позже.",
  catalog_document_unavailable:
    "Один из документов стал недоступен. Запустите dry-run заново.",
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
    "Пустой документ нельзя стандартизировать как транскрипт.",
  catalog_document_limit_exceeded:
    "Один из документов слишком большой для безопасной стандартизации.",
  transcript_selection_invalid: "Выбор документов некорректен.",
  transcript_selection_empty: "Выберите хотя бы один Google Doc.",
  transcript_selection_limit_exceeded:
    "За один запуск можно выбрать не более 50 документов.",
  transcript_selection_duplicate:
    "Один документ выбран несколько раз. Повторите выбор.",
  transcript_folder_invalid: "Выбранная папка некорректна.",
  transcript_document_invalid: "Один из выбранных документов некорректен.",
  transcript_document_not_google_doc:
    "Выбранный файл не является Google Docs документом.",
  transcript_document_out_of_folder:
    "Один из документов находится вне выбранной папки.",
  transcript_document_trashed:
    "Один из выбранных документов находится в корзине.",
};

const OPERATION_COPY = {
  standardization: {
    title: "Стандартизация Google Docs",
    description:
      "Обновляет только явно выбранные Google Docs до transcript_doc_v1.2. " +
      "Каталог Studio и состояние заданий не изменяются.",
    applyLabel: "Подтвердить стандартизацию",
    resultTitle: "Стандартизация завершена",
  },
  catalog_import: {
    title: "Импорт в каталог Studio",
    description:
      "Импортирует только метаданные выбранных актуальных документов в " +
      "Studio. Google Docs не изменяются.",
    applyLabel: "Подтвердить импорт",
    resultTitle: "Импорт завершён",
  },
} as const;

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

function maintenanceErrorMessage(error: unknown): string {
  const reason = apiReason(error);
  if (reason && ERROR_MESSAGES[reason]) return ERROR_MESSAGES[reason];
  if (error instanceof ApiError && error.status === 429) return error.message;
  return "Не удалось выполнить операцию. Повторите попытку.";
}

function safeName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, 160) : fallback;
}

function explicitConfirmation(message: string): boolean {
  try {
    return window.confirm(message) === true;
  } catch {
    return false;
  }
}

function parseDryRun(
  workflow: TranscriptMaintenanceWorkflow,
  value: unknown,
): TranscriptMaintenanceDryRun {
  return workflow === "standardization"
    ? parseTranscriptStandardizationDryRun(value)
    : parseTranscriptCatalogImportDryRun(value);
}

function parseApply(
  workflow: TranscriptMaintenanceWorkflow,
  value: unknown,
): TranscriptMaintenanceApply {
  return workflow === "standardization"
    ? parseTranscriptStandardizationApply(value)
    : parseTranscriptCatalogImportApply(value);
}

function actionableCount(result: TranscriptMaintenanceDryRun): number {
  return result.workflow === "standardization"
    ? result.summary.standardize_document_count
    : result.summary.import_metadata_count;
}

function Reason({ reason }: { reason: MaintenanceReason | null }) {
  if (!reason) return null;
  return (
    <span className="error catalog-item-reason">
      {REASON_LABELS[reason]}
    </span>
  );
}

function Summary({
  entries,
}: {
  entries: { label: string; value: number }[];
}) {
  return (
    <dl className="catalog-migration-summary">
      {entries.map((entry) => (
        <div key={entry.label}>
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StandardizationDryRunResult({
  result,
}: {
  result: TranscriptStandardizationDryRun;
}) {
  return (
    <>
      <Summary
        entries={[
          {
            label: "Выбрано документов",
            value: result.selection_summary.selected_document_count,
          },
          {
            label: "Будут стандартизированы",
            value: result.summary.standardize_document_count,
          },
          { label: "Без изменений", value: result.summary.unchanged_count },
          { label: "Заблокированы", value: result.summary.blocked_count },
        ]}
      />
      <div className="catalog-migration-table-wrap">
        <table className="catalog-migration-table">
          <thead>
            <tr>
              <th>Документ</th>
              <th>Стандарт</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.position}>
                <td>{item.name}</td>
                <td>{STANDARD_LABELS[item.standard_status]}</td>
                <td>
                  {STANDARDIZATION_ACTION_LABELS[item.action]}
                  <Reason reason={item.reason_code} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CatalogDryRunResult({
  result,
}: {
  result: TranscriptCatalogImportDryRun;
}) {
  return (
    <>
      <Summary
        entries={[
          {
            label: "Выбрано документов",
            value: result.selection_summary.selected_document_count,
          },
          {
            label: "Будут импортированы",
            value: result.summary.import_metadata_count,
          },
          { label: "Без изменений", value: result.summary.unchanged_count },
          { label: "Заблокированы", value: result.summary.blocked_count },
        ]}
      />
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
                  {CATALOG_ACTION_LABELS[item.action]}
                  <Reason reason={item.reason_code} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DryRunResult({ result }: { result: TranscriptMaintenanceDryRun }) {
  const title = OPERATION_COPY[result.workflow].title;
  return (
    <div
      className="catalog-migration-result"
      aria-label={`Результат dry-run: ${title}`}
    >
      <h4>План операции</h4>
      {result.workflow === "standardization" ? (
        <StandardizationDryRunResult result={result} />
      ) : (
        <CatalogDryRunResult result={result} />
      )}
    </div>
  );
}

function StandardizationApplyResult({
  result,
}: {
  result: TranscriptStandardizationApply;
}) {
  return (
    <>
      <Summary
        entries={[
          { label: "Стандартизировано", value: result.summary.standardized_count },
          {
            label: "Уже актуальны",
            value: result.summary.already_current_count,
          },
          { label: "Заблокированы", value: result.summary.blocked_count },
        ]}
      />
      <div className="catalog-migration-table-wrap">
        <table className="catalog-migration-table">
          <thead>
            <tr>
              <th>Документ</th>
              <th>Действие</th>
              <th>Результат</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.position}>
                <td>{item.name}</td>
                <td>{STANDARDIZATION_ACTION_LABELS[item.action]}</td>
                <td>
                  {STANDARDIZATION_OUTCOME_LABELS[item.outcome]}
                  <Reason reason={item.reason_code} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CatalogApplyResult({
  result,
}: {
  result: TranscriptCatalogImportApply;
}) {
  return (
    <>
      <Summary
        entries={[
          { label: "Импортировано", value: result.summary.imported_count },
          {
            label: "Уже импортированы",
            value: result.summary.already_applied_count,
          },
          { label: "Без изменений", value: result.summary.unchanged_count },
          {
            label: "Конфликты и блокировки",
            value: result.summary.blocked_count + result.summary.conflict_count,
          },
        ]}
      />
      <div className="catalog-migration-table-wrap">
        <table className="catalog-migration-table">
          <thead>
            <tr>
              <th>Документ</th>
              <th>Действие</th>
              <th>Результат</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.position}>
                <td>{item.name}</td>
                <td>{CATALOG_ACTION_LABELS[item.action]}</td>
                <td>
                  {CATALOG_OUTCOME_LABELS[item.outcome]}
                  <Reason reason={item.reason_code} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ApplyResult({ result }: { result: TranscriptMaintenanceApply }) {
  return (
    <div
      className="catalog-migration-result"
      aria-label={`Результат применения: ${OPERATION_COPY[result.workflow].title}`}
    >
      <h4>{OPERATION_COPY[result.workflow].resultTitle}</h4>
      {result.workflow === "standardization" ? (
        <StandardizationApplyResult result={result} />
      ) : (
        <CatalogApplyResult result={result} />
      )}
    </div>
  );
}

function normalizePickedDocuments(
  docs: googlePicker.PickerSelection[],
): SelectedDocument[] | null {
  if (docs.length < 1 || docs.length > 50) return null;
  const selected: SelectedDocument[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const id = doc.id.trim();
    if (!id || seen.has(id)) return null;
    seen.add(id);
    selected.push({
      id,
      name: safeName(doc.name, "Google Docs документ"),
    });
  }
  return selected;
}

function MaintenanceOperationCard({
  workflow,
  pickerReady,
  mutate,
}: {
  workflow: TranscriptMaintenanceWorkflow;
  pickerReady: boolean;
  mutate: Mutate;
}) {
  const copy = OPERATION_COPY[workflow];
  const [selectedFolder, setSelectedFolder] =
    useState<SelectedFolder | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<
    SelectedDocument[]
  >([]);
  const [dryRun, setDryRun] = useState<TranscriptMaintenanceDryRun | null>(
    null,
  );
  const [applyResult, setApplyResult] =
    useState<TranscriptMaintenanceApply | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState("");
  const pickerActive = useRef(false);
  const operationActive = useRef(false);

  useEffect(() => {
    if (pickerReady) return;
    setSelectedFolder(null);
    setSelectedDocuments([]);
    setDryRun(null);
    setApplyResult(null);
  }, [pickerReady]);

  function resetResult() {
    setDryRun(null);
    setApplyResult(null);
  }

  async function pickerSession(): Promise<PickerSession> {
    return mutate<PickerSession>("/google/picker/session", {
      method: "POST",
    });
  }

  async function chooseFolder() {
    if (!pickerReady || busy || pickerActive.current) return;
    pickerActive.current = true;
    setBusy("folder-picker");
    setMessage("");
    try {
      const result = await googlePicker.openGooglePicker(
        "transcript-folder",
        await pickerSession(),
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
        name: safeName(folder.name, "Выбранная папка Google Drive"),
      });
      setSelectedDocuments([]);
      resetResult();
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

  async function chooseDocuments() {
    if (
      !pickerReady ||
      !selectedFolder ||
      busy ||
      pickerActive.current
    ) {
      return;
    }
    pickerActive.current = true;
    setBusy("document-picker");
    setMessage("");
    try {
      const result = await googlePicker.openGooglePicker(
        "transcript-documents",
        await pickerSession(),
        { parentId: selectedFolder.id },
      );
      if (result.action === "cancel") return;
      if (result.action === "error") {
        setMessage(result.message);
        return;
      }
      const documents = normalizePickedDocuments(result.docs);
      if (!documents) {
        setMessage(
          "Выберите от 1 до 50 уникальных Google Docs в выбранной папке.",
        );
        return;
      }
      setSelectedDocuments(documents);
      resetResult();
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
    if (
      !pickerReady ||
      !selectedFolder ||
      selectedDocuments.length === 0 ||
      busy ||
      operationActive.current
    ) {
      return;
    }
    operationActive.current = true;
    setBusy("dry-run");
    setMessage("");
    resetResult();
    try {
      const raw = await mutate<unknown>(
        `/transcript-maintenance/${workflow === "standardization" ? "standardization" : "catalog-import"}/dry-run`,
        {
          method: "POST",
          body: JSON.stringify({
            folder_id: selectedFolder.id,
            document_ids: selectedDocuments.map((doc) => doc.id),
          }),
        },
      );
      setDryRun(parseDryRun(workflow, raw));
    } catch (error) {
      setDryRun(null);
      setMessage(maintenanceErrorMessage(error));
    } finally {
      operationActive.current = false;
      setBusy(null);
    }
  }

  async function applyOperation() {
    if (
      !pickerReady ||
      !selectedFolder ||
      selectedDocuments.length === 0 ||
      !dryRun ||
      dryRun.workflow !== workflow ||
      actionableCount(dryRun) === 0 ||
      busy ||
      operationActive.current
    ) {
      return;
    }
    if (
      !explicitConfirmation(
        workflow === "standardization"
          ? `Стандартизировать ${actionableCount(dryRun)} выбранных документов? Каталог Studio не изменится.`
          : `Импортировать метаданные ${actionableCount(dryRun)} выбранных документов? Google Docs не изменятся.`,
      )
    ) {
      return;
    }
    operationActive.current = true;
    setBusy("apply");
    setMessage("");
    try {
      const raw = await mutate<unknown>(
        `/transcript-maintenance/${workflow === "standardization" ? "standardization" : "catalog-import"}/apply`,
        {
          method: "POST",
          body: JSON.stringify({
            folder_id: selectedFolder.id,
            document_ids: selectedDocuments.map((doc) => doc.id),
            confirm_apply: true,
          }),
        },
      );
      setApplyResult(parseApply(workflow, raw));
      setDryRun(null);
    } catch (error) {
      setDryRun(null);
      setMessage(maintenanceErrorMessage(error));
    } finally {
      operationActive.current = false;
      setBusy(null);
    }
  }

  const actionable =
    dryRun && dryRun.workflow === workflow ? actionableCount(dryRun) : 0;

  return (
    <section
      className="card transcript-catalog-migration transcript-maintenance-operation"
      aria-labelledby={`transcript-maintenance-${workflow}-title`}
    >
      <span className="tag">Отдельная операция</span>
      <h3 id={`transcript-maintenance-${workflow}-title`}>{copy.title}</h3>
      <p>{copy.description}</p>
      <p className="muted">
        Сначала выберите папку, затем явно выберите документы. Dry-run ничего
        не изменяет. Тексты документов не возвращаются в браузер.
      </p>
      <div className="actions">
        <button
          type="button"
          disabled={!pickerReady || busy !== null}
          onClick={chooseFolder}
        >
          {busy === "folder-picker"
            ? "Открываем папки…"
            : selectedFolder
              ? "Сменить папку"
              : "Выбрать папку"}
        </button>
        <button
          type="button"
          disabled={!pickerReady || !selectedFolder || busy !== null}
          onClick={chooseDocuments}
        >
          {busy === "document-picker"
            ? "Открываем документы…"
            : selectedDocuments.length > 0
              ? "Изменить документы"
              : "Выбрать документы"}
        </button>
        <button
          type="button"
          className="primary"
          disabled={
            !pickerReady ||
            !selectedFolder ||
            selectedDocuments.length === 0 ||
            busy !== null
          }
          onClick={runDryRun}
        >
          {busy === "dry-run" ? "Проверяем…" : "Запустить dry-run"}
        </button>
      </div>
      {selectedFolder && (
        <p className="folder-status" role="status">
          Папка: <b>{selectedFolder.name}</b>. Выбрано документов:{" "}
          <b>{selectedDocuments.length}</b>.
        </p>
      )}
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
      {dryRun && dryRun.workflow === workflow && (
        <DryRunResult result={dryRun} />
      )}
      {dryRun && dryRun.workflow === workflow && (
        <div className="catalog-migration-apply">
          <p>
            Перед применением сервер заново проверит эту папку и тот же набор
            документов. Preview не считается полномочием на другую операцию.
          </p>
          <button
            type="button"
            className="primary"
            disabled={!pickerReady || busy !== null || actionable === 0}
            onClick={applyOperation}
          >
            {busy === "apply"
              ? "Применяем…"
              : `${copy.applyLabel} (${actionable})`}
          </button>
        </div>
      )}
      {applyResult && applyResult.workflow === workflow && (
        <ApplyResult result={applyResult} />
      )}
    </section>
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
  const mutate: Mutate = <T,>(path: string, options: RequestInit) =>
    mutateWithCsrfRetry<T>(path, csrf, onCsrf, options);

  return (
    <section
      className="transcript-maintenance-panel"
      aria-labelledby="transcript-maintenance-title"
    >
      <span className="tag">Обслуживание существующих транскриптов</span>
      <h2 id="transcript-maintenance-title">
        Две независимые операции
      </h2>
      <p>
        Стандартизация изменяет только выбранные Google Docs. Импорт каталога
        изменяет только метаданные Studio. Выбор, dry-run и подтверждение у них
        раздельные.
      </p>
      {googleLoading && (
        <p className="notice">Проверяем подключение Google Drive…</p>
      )}
      {!googleLoading && !googleConnected && (
        <p className="notice">Сначала подключите Google Drive выше.</p>
      )}
      {!googleLoading && googleConnected && !pickerReady && (
        <p className="notice">
          Обновите подключение Google Drive, чтобы выбрать документы.
        </p>
      )}
      <div className="transcript-maintenance-grid">
        <MaintenanceOperationCard
          workflow="standardization"
          pickerReady={pickerReady}
          mutate={mutate}
        />
        <MaintenanceOperationCard
          workflow="catalog_import"
          pickerReady={pickerReady}
          mutate={mutate}
        />
      </div>
    </section>
  );
}
