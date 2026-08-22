import { useEffect, useRef, useState } from "react";
import { ApiError, api, mutateWithCsrfRetry } from "./apiClient";
import * as googlePicker from "./googlePicker";
import type { PickerSession } from "./googlePicker";
import { googlePickerFailureMessage } from "./googlePickerErrors";
import { ConfirmClearDialog } from "./ConfirmClearDialog";
import {
  cancelLatestRequests,
  LATEST_REQUEST_CANCEL_REASON,
  settleLatestRequest,
} from "./latestRequest";
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
  | "target-picker"
  | "dry-run"
  | "apply"
  | null;
type TranscriptMaintenanceSelectionMode =
  | "folder_tree"
  | "single_document";
type SelectedTarget = { id: string; name: string };
type Mutate = <T>(path: string, options: RequestInit) => Promise<T>;
type GoogleOauthStart = { authorization_url: string; expires_at: string };
type GoogleMaintenanceConnection = {
  connected: boolean;
  status: "active" | "revoked" | "incomplete" | null;
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

const MAINTENANCE_CONNECTION_REQUEST_TIMEOUT_MS = 15_000;

function parseGoogleMaintenanceConnection(
  candidate: unknown,
): GoogleMaintenanceConnection | null {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Record<string, unknown>;
  const status = value.status;
  const googleEmail = value.google_email;
  const scopes = value.scopes;
  const connectedAt = value.connected_at;
  const revokedAt = value.revoked_at;
  if (
    typeof value.connected !== "boolean" ||
    (status !== null &&
      status !== "active" &&
      status !== "revoked" &&
      status !== "incomplete") ||
    (googleEmail !== null &&
      (typeof googleEmail !== "string" ||
        googleEmail.trim().length === 0 ||
        googleEmail.length > 320)) ||
    (scopes !== null &&
      (typeof scopes !== "string" ||
        scopes.trim().length === 0 ||
        scopes.length > 2_048)) ||
    !isNullableIsoDate(connectedAt) ||
    !isNullableIsoDate(revokedAt) ||
    typeof value.configured !== "boolean" ||
    typeof value.account_match !== "boolean" ||
    typeof value.scope_ready !== "boolean" ||
    typeof value.ready !== "boolean" ||
    typeof value.reconnect_required !== "boolean" ||
    (value.connected && status !== "active") ||
    (value.ready &&
      (!value.connected ||
        !value.configured ||
        !value.account_match ||
        !value.scope_ready)) ||
    value.reconnect_required !== Boolean(status && !value.ready)
  ) {
    return null;
  }
  return {
    connected: value.connected,
    status,
    google_email: googleEmail,
    scopes,
    connected_at: connectedAt,
    revoked_at: revokedAt,
    configured: value.configured,
    account_match: value.account_match,
    scope_ready: value.scope_ready,
    ready: value.ready,
    reconnect_required: value.reconnect_required,
  };
}

function isNullableIsoDate(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 64 &&
      Number.isFinite(Date.parse(value)))
  );
}

async function requestGoogleMaintenanceConnection(signal?: AbortSignal) {
  const candidate = await api<unknown>("/google/maintenance/connection", {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const connection = parseGoogleMaintenanceConnection(candidate);
  if (!connection) throw new Error("invalid_maintenance_connection_response");
  return connection;
}

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
  transcript_document_invalid: "Выбранный документ некорректен.",
  transcript_document_not_google_doc:
    "Выберите документ в формате Google Docs.",
  transcript_document_trashed:
    "Выбранный документ находится в корзине Google Drive.",
};

const OPERATION_COPY = {
  standardization: {
    title: "Стандартизация Google Docs",
    description:
      "Обновляет выбранный Google Doc либо рекурсивно сканирует папку и " +
      "обновляет подходящие Google Docs " +
      "до transcript_doc_v1.2. Уже актуальные документы пропускаются. " +
      "Каталог Studio и состояние заданий не изменяются.",
    applyLabel: "Подтвердить стандартизацию",
    resultTitle: "Стандартизация завершена",
  },
  catalog_import: {
    title: "Манифест Studio",
    description:
      "Проверяет выбранный Google Doc либо рекурсивно сканирует папку и " +
      "добавляет в манифест Studio " +
      "только метаданные подходящих актуальных документов. Уже учтённые " +
      "документы пропускаются. Отдельный manifest-файл не создаётся, " +
      "Google Docs не изменяются.",
    applyLabel: "Добавить в манифест Studio",
    resultTitle: "Манифест Studio обновлён",
  },
} as const;

function maintenanceTarget(
  selectionMode: TranscriptMaintenanceSelectionMode,
  target: SelectedTarget,
) {
  return selectionMode === "folder_tree"
    ? { selection_mode: selectionMode, folder_id: target.id }
    : { selection_mode: selectionMode, document_id: target.id };
}

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

function SelectionScanDetails({
  result,
  selectionMode,
}: {
  result: TranscriptMaintenanceDryRun;
  selectionMode: TranscriptMaintenanceSelectionMode;
}) {
  const summary = result.selection_summary;
  if (selectionMode === "single_document") {
    return (
      <p className="muted catalog-scan-details">
        Проверен один выбранный Google Doc. Не удалось прочитать документов:{" "}
        {summary.unreadable_document_count}.
      </p>
    );
  }
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
  selectionMode,
}: {
  result: TranscriptStandardizationDryRun;
  selectionMode: TranscriptMaintenanceSelectionMode;
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
      <SelectionScanDetails
        result={result}
        selectionMode={selectionMode}
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
  selectionMode,
}: {
  result: TranscriptCatalogImportDryRun;
  selectionMode: TranscriptMaintenanceSelectionMode;
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
      <SelectionScanDetails
        result={result}
        selectionMode={selectionMode}
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

function DryRunResult({
  result,
  selectionMode,
}: {
  result: TranscriptMaintenanceDryRun;
  selectionMode: TranscriptMaintenanceSelectionMode;
}) {
  const title = OPERATION_COPY[result.workflow].title;
  return (
    <div
      className="catalog-migration-result"
      aria-label={`Результат dry-run: ${title}`}
    >
      <h4>План операции</h4>
      {result.workflow === "standardization" ? (
        <StandardizationDryRunResult
          result={result}
          selectionMode={selectionMode}
        />
      ) : (
        <CatalogDryRunResult
          result={result}
          selectionMode={selectionMode}
        />
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
  const persistedCount =
    result.summary.imported_count + result.summary.already_applied_count;

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
      {persistedCount > 0 && (
        <p className="muted" role="status">
          Результат сохранён в каталоге Studio. Повторно применять эту
          операцию не нужно. Новый dry-run должен показать сохранённые
          документы как уже учтённые.
        </p>
      )}
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
  const [selectionMode, setSelectionMode] =
    useState<TranscriptMaintenanceSelectionMode>("folder_tree");
  const [selectedTarget, setSelectedTarget] =
    useState<SelectedTarget | null>(null);
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
    setSelectedTarget(null);
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

  function changeSelectionMode(
    nextMode: TranscriptMaintenanceSelectionMode,
  ) {
    if (nextMode === selectionMode) return;
    setSelectionMode(nextMode);
    setSelectedTarget(null);
    setMessage("");
    resetResult();
  }

  async function chooseTarget() {
    if (!operationReady || busy || pickerActive.current) return;
    pickerActive.current = true;
    setBusy("target-picker");
    setMessage("");
    try {
      const result = await googlePicker.openGooglePicker(
        selectionMode === "folder_tree"
          ? "transcript-folder"
          : "transcript-document",
        await pickerSession(),
      );
      if (result.action === "cancel") return;
      if (result.action === "error") {
        setMessage(result.message);
        return;
      }
      const target = result.docs[0];
      if (!target?.id || result.docs.length !== 1) {
        setMessage(
          selectionMode === "folder_tree"
            ? "Выберите одну папку Google Drive."
            : "Выберите один Google Doc.",
        );
        return;
      }
      setSelectedTarget({
        id: target.id,
        name: safeName(
          target.name,
          selectionMode === "folder_tree"
            ? "Выбранная папка Google Drive"
            : "Выбранный Google Doc",
        ),
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
      !selectedTarget ||
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
          body: JSON.stringify(
            maintenanceTarget(selectionMode, selectedTarget),
          ),
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
      !selectedTarget ||
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
          : `Добавить метаданные ${actionableCount(dryRun)} выбранных документов в манифест Studio? Google Docs не изменятся.`,
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
            ...maintenanceTarget(selectionMode, selectedTarget),
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
        Выберите режим и объект. Dry-run ничего не изменит. Тексты документов
        не возвращаются в браузер.
      </p>
      <label
        htmlFor={`transcript-maintenance-${workflow}-selection-mode`}
      >
        Что обработать
      </label>
      <select
        id={`transcript-maintenance-${workflow}-selection-mode`}
        value={selectionMode}
        disabled={!operationReady || busy !== null}
        onChange={(event) =>
          changeSelectionMode(
            event.target.value as TranscriptMaintenanceSelectionMode,
          )
        }
      >
        <option value="folder_tree">Папка и все подпапки</option>
        <option value="single_document">Один конкретный Google Doc</option>
      </select>
      <div className="actions">
        <button
          type="button"
          disabled={!operationReady || busy !== null}
          onClick={chooseTarget}
        >
          {busy === "target-picker"
            ? "Открываем Google Drive…"
            : selectedTarget
              ? selectionMode === "folder_tree"
                ? "Сменить папку"
                : "Сменить документ"
              : selectionMode === "folder_tree"
                ? "Выбрать папку"
                : "Выбрать документ"}
        </button>
        <button
          type="button"
          className="primary"
          disabled={
            !operationReady ||
            !selectedTarget ||
            busy !== null
          }
          onClick={runDryRun}
        >
          {busy === "dry-run" ? "Проверяем…" : "Запустить dry-run"}
        </button>
      </div>
      {selectedTarget && (
        <p className="folder-status" role="status">
          {selectionMode === "folder_tree" ? (
            <>
              Корневая папка: <b>{selectedTarget.name}</b>. Будут проверены
              Google Docs в ней и всех подпапках.
            </>
          ) : (
            <>
              Выбран документ: <b>{selectedTarget.name}</b>. Будет проверен
              только этот Google Doc.
            </>
          )}
        </p>
      )}
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
      {dryRun && dryRun.workflow === workflow && (
        <DryRunResult
          result={dryRun}
          selectionMode={selectionMode}
        />
      )}
      {dryRun && dryRun.workflow === workflow && (
        <div className="catalog-migration-apply">
          <p>
            {selectionMode === "folder_tree"
              ? "Перед применением сервер заново просканирует эту корневую папку и все подпапки."
              : "Перед применением сервер заново проверит именно этот Google Doc."}{" "}
            Preview не считается полномочием на другую операцию.
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
  const [maintenanceReadError, setMaintenanceReadError] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [clearMessage, setClearMessage] = useState("");
  const clearPendingRef = useRef(false);
  const maintenanceRequestEpochsRef = useRef(new Map<string, number>());
  const maintenanceRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );

  async function loadMaintenanceConnection() {
    setMaintenanceLoading(true);
    setMaintenanceMessage("");
    setMaintenanceReadError("");
    await settleLatestRequest(
      maintenanceRequestEpochsRef.current,
      "maintenance-connection",
      requestGoogleMaintenanceConnection,
      (connection) => {
        setMaintenanceConnection(connection);
        setMaintenanceLoading(false);
        setMaintenanceReadError("");
      },
      () => {
        setMaintenanceConnection(null);
        setMaintenanceLoading(false);
        setMaintenanceReadError(
          "Не удалось проверить доступ Google для обслуживания.",
        );
      },
      {
        controllers: maintenanceRequestControllersRef.current,
        timeoutMs: MAINTENANCE_CONNECTION_REQUEST_TIMEOUT_MS,
      },
    );
  }

  useEffect(() => {
    if (!googleConnected) {
      cancelLatestRequests(
        maintenanceRequestEpochsRef.current,
        maintenanceRequestControllersRef.current,
      );
      setMaintenanceConnection(null);
      setMaintenanceLoading(false);
      setMaintenanceReadError("");
      return;
    }
    void loadMaintenanceConnection();
    return () =>
      cancelLatestRequests(
        maintenanceRequestEpochsRef.current,
        maintenanceRequestControllersRef.current,
      );
  }, [googleConnected, maintenanceOauthResult]);

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

  async function clearManifest() {
    if (clearPendingRef.current) return;
    clearPendingRef.current = true;
    setClearPending(true);
    setClearMessage("");
    try {
      const result = await mutate<unknown>("/transcript-catalog/clear", {
        method: "POST",
        body: JSON.stringify({ confirm_clear: true }),
      });
      if (!isCatalogClearResponse(result)) {
        throw new Error("invalid_catalog_clear_response");
      }
      setClearOpen(false);
      setClearMessage(
        "Манифест очищен. Результаты, Google Docs и исходные файлы сохранены.",
      );
    } catch {
      setClearMessage("Не удалось очистить манифест. Повторите попытку.");
    } finally {
      clearPendingRef.current = false;
      setClearPending(false);
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
        Для каждой операции отдельно выберите папку со всеми подпапками либо
        один Google Doc. Стандартизация изменяет только подходящие документы,
        а добавление в манифест — только метаданные Studio. Режим, объект,
        dry-run и подтверждение у операций раздельные.
      </p>
      <section className="card transcript-maintenance-access">
        <h3>Очистка манифеста Studio</h3>
        <p>
          Очистка сбрасывает owner-scoped duplicate history. Она не удаляет
          Google Docs, результаты, исходные файлы, задачи или журнал аудита.
        </p>
        <button
          type="button"
          className="danger"
          disabled={clearPending}
          onClick={() => setClearOpen(true)}
        >
          Очистить манифест
        </button>
        {clearMessage && (
          <p role="status" className="notice">{clearMessage}</p>
        )}
      </section>
      <section
        className="card transcript-maintenance-access"
        aria-labelledby="transcript-maintenance-access-title"
      >
        <span className="tag">Отдельное разрешение</span>
        <h3 id="transcript-maintenance-access-title">
          Доступ Google для обслуживания
        </h3>
        <p>
          Для серверной проверки выбранных папок или документов нужен
          отдельный доступ к метаданным Drive и Google Docs. Его токены не
          передаются в браузер. Выберите тот же Google-аккаунт, который
          подключён выше.
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
                !maintenanceConnection ||
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
        {maintenanceReadError && (
          <div className="error">
            <p role="alert">{maintenanceReadError}</p>
            <button
              type="button"
              className="secondary"
              disabled={maintenanceLoading}
              onClick={() => void loadMaintenanceConnection()}
            >
              Повторить проверку доступа
            </button>
          </div>
        )}
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
          Обновите подключение Google Drive, чтобы выбрать объект.
        </p>
      )}
      {!googleLoading &&
        pickerReady &&
        !maintenanceLoading &&
        !maintenanceReady && (
          <p className="notice">
            Подключите отдельный доступ для обслуживания перед выбором объекта.
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
      {clearOpen && (
        <ConfirmClearDialog
          title="Очистить манифест Studio?"
          description="Предыдущие accepted-result записи перестанут блокировать повторную транскрибацию. Google Docs, результаты, исходные файлы, задачи и аудит не удаляются."
          pending={clearPending}
          onConfirm={() => void clearManifest()}
          onCancel={() => setClearOpen(false)}
        />
      )}
    </section>
  );
}

function isCatalogClearResponse(value: unknown): value is {
  ok: true;
  reset_at: string;
  hidden_evidence_count: number;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.ok === true &&
    typeof candidate.reset_at === "string" &&
    Number.isFinite(Date.parse(candidate.reset_at)) &&
    typeof candidate.hidden_evidence_count === "number" &&
    Number.isInteger(candidate.hidden_evidence_count) &&
    candidate.hidden_evidence_count >= 0
  );
}
