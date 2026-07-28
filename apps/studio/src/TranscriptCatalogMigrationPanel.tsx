import { useEffect, useRef, useState } from "react";
import { ApiError, api, mutateWithCsrfRetry } from "./apiClient";
import * as googlePicker from "./googlePicker";
import type { PickerSession } from "./googlePicker";
import { googlePickerFailureMessage } from "./googlePickerErrors";
import {
  googleMaintenanceOauthMessages,
  type GoogleMaintenanceOauthResult,
} from "./googleOauthResult";
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
  | "dry-run"
  | "apply"
  | null;
type SelectedFolder = { id: string; name: string };
type Mutate = <T>(path: string, options: RequestInit) => Promise<T>;
type GoogleOauthStart = { authorization_url: string; expires_at: string };
type GoogleMaintenanceConnection = {
  connected: boolean;
  status: string | null;
  google_email: string | null;
  scopes: string | null;
  connected_at: string | null;
  revoked_at: string | null;
  configured: boolean;
  account_match: boolean;
  scope_ready: boolean;
  ready: boolean;
  reconnect_required: boolean;
};

const STANDARD_LABELS: Record<TranscriptStandardStatus, string> = {
  current: "Актуальный стандарт",
  outdated: "Требует обновления",
  unstructured: "Без структуры",
  unreadable: "Не удалось прочитать",
};
const IMPORT_LABELS: Record<TranscriptImportStatus, string> = {
  not_imported: "Не добавлен в манифест",
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
  import_metadata: "Добавить метаданные в манифест",
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
  imported: "Добавлено в манифест",
  already_applied: "Уже есть в манифесте",
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
  catalog_document_unavailable:
    "Документ стал недоступен во время применения",
  catalog_document_write_rejected:
    "Google Drive отклонил изменение документа",
  catalog_document_revision_changed:
    "Документ изменился после проверки",
  catalog_document_multiple_tabs:
    "Документ с несколькими вкладками не поддерживается",
  catalog_document_content_unsupported:
    "Структура документа не поддерживается",
  catalog_document_classification_changed:
    "Состояние документа изменилось после проверки",
  catalog_document_empty:
    "Пустой документ нельзя стандартизировать",
  catalog_document_limit_exceeded:
    "Документ слишком большой для безопасной стандартизации",
  catalog_document_response_invalid:
    "Google Docs вернул некорректную структуру документа",
};
const ERROR_MESSAGES: Record<string, string> = {
  catalog_google_connection_missing:
    "Подключите Google Drive перед операцией.",
  catalog_google_connection_inactive:
    "Подключение Google Drive неактивно. Обновите его в настройках.",
  catalog_google_maintenance_connection_missing:
    "Подключите отдельный доступ Google для обслуживания папок.",
  catalog_google_maintenance_connection_inactive:
    "Доступ Google для обслуживания неактивен. Подключите его заново.",
  catalog_google_maintenance_account_mismatch:
    "Подключите для обслуживания тот же Google-аккаунт, что и основной.",
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
  transcript_folder_invalid: "Выбранная папка некорректна.",
};

const OPERATION_COPY = {
  standardization: {
    title: "Стандартизация Google Docs",
    description:
      "Рекурсивно сканирует выбранную папку и обновляет подходящие Google Docs " +
      "до transcript_doc_v1.2. Уже актуальные документы пропускаются. " +
      "Каталог Studio и состояние заданий не изменяются.",
    applyLabel: "Подтвердить стандартизацию",
    resultTitle: "Стандартизация завершена",
  },
  catalog_import: {
    title: "Манифест Studio",
    description:
      "Рекурсивно сканирует выбранную папку и добавляет в манифест Studio " +
      "только метаданные подходящих актуальных документов. Уже учтённые " +
      "документы пропускаются. Отдельный manifest-файл не создаётся, " +
      "Google Docs не изменяются.",
    applyLabel: "Добавить в манифест Studio",
    resultTitle: "Манифест Studio обновлён",
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

function RecursiveScanDetails({
  result,
}: {
  result: TranscriptMaintenanceDryRun;
}) {
  const summary = result.selection_summary;
  return (
    <p className="muted catalog-scan-details">
      Вложенных папок: {summary.nested_folder_count}. Пропущено других файлов:{" "}
      {summary.skipped_non_document_count}. Страниц Drive просканировано:{" "}
      {summary.pages_scanned}. Не удалось прочитать документов:{" "}
      {summary.unreadable_document_count}.
    </p>
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
            label: "Google Docs найдено",
            value: result.selection_summary.google_document_count,
          },
          {
            label: "Будут стандартизированы",
            value: result.summary.standardize_document_count,
          },
          { label: "Без изменений", value: result.summary.unchanged_count },
          { label: "Заблокированы", value: result.summary.blocked_count },
        ]}
      />
      <RecursiveScanDetails result={result} />
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
            label: "Google Docs найдено",
            value: result.selection_summary.google_document_count,
          },
          {
            label: "Будут добавлены в манифест",
            value: result.summary.import_metadata_count,
          },
          { label: "Без изменений", value: result.summary.unchanged_count },
          { label: "Заблокированы", value: result.summary.blocked_count },
        ]}
      />
      <RecursiveScanDetails result={result} />
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
          {
            label: "Добавлены в манифест",
            value: result.summary.imported_count,
          },
          {
            label: "Уже были в манифесте",
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

function MaintenanceOperationCard({
  workflow,
  operationReady,
  mutate,
}: {
  workflow: TranscriptMaintenanceWorkflow;
  operationReady: boolean;
  mutate: Mutate;
}) {
  const copy = OPERATION_COPY[workflow];
  const [selectedFolder, setSelectedFolder] =
    useState<SelectedFolder | null>(null);
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
    if (operationReady) return;
    setSelectedFolder(null);
    setDryRun(null);
    setApplyResult(null);
  }, [operationReady]);

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
    if (!operationReady || busy || pickerActive.current) return;
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
      !operationReady ||
      !selectedFolder ||
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
      !operationReady ||
      !selectedFolder ||
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
          ? `Стандартизировать ${actionableCount(dryRun)} найденных документов? Каталог Studio не изменится.`
          : `Добавить метаданные ${actionableCount(dryRun)} найденных документов в манифест Studio? Google Docs не изменятся.`,
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
        Выберите корневую папку. Dry-run рекурсивно проверит её и все подпапки,
        но ничего не изменит. Тексты документов не возвращаются в браузер.
      </p>
      <div className="actions">
        <button
          type="button"
          disabled={!operationReady || busy !== null}
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
          className="primary"
          disabled={
            !operationReady ||
            !selectedFolder ||
            busy !== null
          }
          onClick={runDryRun}
        >
          {busy === "dry-run" ? "Проверяем…" : "Запустить dry-run"}
        </button>
      </div>
      {selectedFolder && (
        <p className="folder-status" role="status">
          Корневая папка: <b>{selectedFolder.name}</b>. Будут проверены Google
          Docs в ней и всех подпапках.
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
            Перед применением сервер заново просканирует эту корневую папку и
            все подпапки. Preview не считается полномочием на другую операцию.
          </p>
          <button
            type="button"
            className="primary"
            disabled={!operationReady || busy !== null || actionable === 0}
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
  maintenanceOauthResult,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
  googleConnected: boolean;
  googleLoading: boolean;
  pickerReady: boolean;
  maintenanceOauthResult: GoogleMaintenanceOauthResult | null;
}) {
  const mutate: Mutate = <T,>(path: string, options: RequestInit) =>
    mutateWithCsrfRetry<T>(path, csrf, onCsrf, options);
  const [maintenanceConnection, setMaintenanceConnection] =
    useState<GoogleMaintenanceConnection | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceStarting, setMaintenanceStarting] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  useEffect(() => {
    let active = true;
    if (!googleConnected) {
      setMaintenanceConnection(null);
      setMaintenanceLoading(false);
      return () => {
        active = false;
      };
    }
    setMaintenanceLoading(true);
    setMaintenanceMessage("");
    api<GoogleMaintenanceConnection>("/google/maintenance/connection")
      .then((connection) => {
        if (active) setMaintenanceConnection(connection);
      })
      .catch(() => {
        if (!active) return;
        setMaintenanceConnection(null);
        setMaintenanceMessage(
          "Не удалось проверить доступ Google для обслуживания.",
        );
      })
      .finally(() => {
        if (active) setMaintenanceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    googleConnected,
    maintenanceOauthResult,
  ]);

  async function connectMaintenance() {
    if (
      maintenanceStarting ||
      !pickerReady ||
      maintenanceConnection?.configured === false
    ) {
      return;
    }
    setMaintenanceStarting(true);
    setMaintenanceMessage("");
    try {
      const result = await mutate<GoogleOauthStart>(
        "/google/maintenance/oauth/start",
        { method: "POST" },
      );
      window.location.assign(result.authorization_url);
    } catch {
      setMaintenanceMessage(
        "Не удалось начать подключение доступа для обслуживания.",
      );
      setMaintenanceStarting(false);
    }
  }

  async function disconnectMaintenance() {
    setMaintenanceMessage("");
    try {
      const connection = await mutate<GoogleMaintenanceConnection>(
        "/google/maintenance/connection",
        { method: "DELETE" },
      );
      setMaintenanceConnection(connection);
    } catch {
      setMaintenanceMessage(
        "Не удалось отключить доступ Google для обслуживания.",
      );
    }
  }

  const maintenanceReady = maintenanceConnection?.ready === true;
  const operationReady = pickerReady && maintenanceReady;
  const oauthMessage =
    maintenanceOauthResult === "connected"
      ? !maintenanceLoading && maintenanceReady
        ? googleMaintenanceOauthMessages.connected
        : ""
      : maintenanceOauthResult
        ? googleMaintenanceOauthMessages[maintenanceOauthResult]
        : "";

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
        Стандартизация изменяет только подходящие Google Docs в выбранном
        дереве папок. Добавление в манифест изменяет только метаданные Studio.
        Корневая папка, dry-run и подтверждение у операций раздельные.
      </p>
      <section
        className="card transcript-maintenance-access"
        aria-labelledby="transcript-maintenance-access-title"
      >
        <span className="tag">Отдельное разрешение</span>
        <h3 id="transcript-maintenance-access-title">
          Доступ Google для обслуживания
        </h3>
        <p>
          Для рекурсивного сканирования нужен отдельный server-only доступ к
          метаданным Drive и Google Docs. Его токены не передаются в браузер.
          Выберите тот же Google-аккаунт, который подключён выше.
        </p>
        {maintenanceLoading ? (
          <p className="notice">Проверяем доступ для обслуживания…</p>
        ) : maintenanceReady ? (
          <p className="notice" role="status">
            Расширенный доступ подключён
            {maintenanceConnection?.google_email
              ? `: ${maintenanceConnection.google_email}`
              : ""}
            .
          </p>
        ) : (
          <p className="notice">
            Расширенный доступ ещё не готов. Операции обслуживания
            заблокированы.
          </p>
        )}
        {oauthMessage && (
          <p className="notice" role="status">
            {oauthMessage}
          </p>
        )}
        {maintenanceConnection?.configured === false && (
          <p className="error" role="alert">
            OAuth для обслуживания не настроен на сервере.
          </p>
        )}
        {maintenanceConnection &&
          !maintenanceConnection.account_match &&
          maintenanceConnection.connected && (
            <p className="error" role="alert">
              Подключён другой Google-аккаунт. Переподключите доступ.
            </p>
          )}
        <div className="actions">
          {!maintenanceReady && (
            <button
              type="button"
              className="primary"
              disabled={
                maintenanceLoading ||
                maintenanceStarting ||
                !pickerReady ||
                maintenanceConnection?.configured === false
              }
              onClick={connectMaintenance}
            >
              {maintenanceStarting
                ? "Открываем Google…"
                : maintenanceConnection?.reconnect_required
                  ? "Переподключить доступ"
                  : "Подключить доступ"}
            </button>
          )}
          {maintenanceConnection?.connected && (
            <button type="button" onClick={disconnectMaintenance}>
              Отключить доступ
            </button>
          )}
        </div>
        {maintenanceMessage && (
          <p className="error" role="alert">
            {maintenanceMessage}
          </p>
        )}
      </section>
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
      {!googleLoading &&
        pickerReady &&
        !maintenanceLoading &&
        !maintenanceReady && (
          <p className="notice">
            Подключите отдельный доступ для обслуживания перед выбором папки.
          </p>
        )}
      <div className="transcript-maintenance-grid">
        <MaintenanceOperationCard
          workflow="standardization"
          operationReady={operationReady}
          mutate={mutate}
        />
        <MaintenanceOperationCard
          workflow="catalog_import"
          operationReady={operationReady}
          mutate={mutate}
        />
      </div>
    </section>
  );
}
