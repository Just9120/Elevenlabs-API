import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import * as googlePicker from "./googlePicker";
import type { PickerSession } from "./googlePicker";
import { googlePickerFailureMessage } from "./googlePickerErrors";
import {
  clearPwaDiagnosticsSession,
  configurePwaDiagnosticsDebugState,
  updatePwaDiagnosticsCsrf,
} from "./pwaDiagnostics";
import {
  ApiError,
  api,
  batchMutateWithCsrfRetry,
  mutateWithCsrfRetry,
  requestJson,
} from "./apiClient";
import {
  parsePlatformRoute,
  pushPlatformRoute,
  type Page,
  type PlatformRoute,
  type SettingsSection,
} from "./platformRouting";
import {
  consumeGoogleOauthResult,
  googleOauthMessages,
  type GoogleOauthResult,
} from "./googleOauthResult";
import {
  formatTime,
  formatBytes,
  formatUploadLimit,
  retentionOptionLabel,
} from "./formatters";
import {
  isSupportedMediaFile,
  isSupportedSourceMimeType,
  normalizeSourceUploadPolicy,
  sourceUploadAccept,
  type SourceUploadPolicy,
} from "./sourceUploadPolicy";
import {
  isUsableJobSource,
  sourceСтатусLabel,
  type Source,
} from "./sourceModel";
import { isSafeDisplayUrl, ResourceExternalLink } from "./resourceLinks";
import { SourcesPanel } from "./SourcesPanel";
import { JobCard } from "./JobCard";
import { Login, type User } from "./Login";
import { PlatformSidebar } from "./PlatformSidebar";
import {
  isApprovedOutputUrl,
  type JobDetailState,
  type JobOutputsResponse,
  type JobOutputsState,
  type JobState,
  type TranscriptionJob,
  type TranscriptionLanguageMode,
} from "./jobModel";
import {
  DEFAULT_TRANSCRIPTION_LANGUAGE_MODE,
  composerSignature,
  buildBatchCreateRequest,
  makeIdempotencyKey,
  mergeJobsWithBatchOrder,
  newComposerRow,
  parseBatchPreflightResponse,
  type BatchCreateResponse,
  type BatchPreflightResponse,
  type ComposerRow,
} from "./batchComposerModel";
import {
  type JobRetryResponse,
  type JobRetryState,
  type OutputReconciliationCheckResponse,
  type OutputReconciliationResponse,
  type OutputReconciliationState,
} from "./jobRecoveryModel";
import {
  parseProjectJobProgressResponse,
  type JobProgressState,
} from "./jobProgressModel";
import { TranscriptionAnalyticsPanel } from "./TranscriptionAnalyticsPanel";
import "./styles.css";

type AccountPreferences = {
  source_retention_ttl_seconds: number;
  allowed_source_retention_ttl_seconds: number[];
};
type Credential = {
  id: string;
  provider: "elevenlabs" | "openai";
  label: string;
  status: string;
  masked_value?: string;
  active_version?: number;
};
type Audit = { id: string; type: string; created_at: string };
type DiagnosticsSystem = {
  environment?: string;
  pwa_mode?: string;
  build?: { web?: string; api?: string; worker?: string };
  google_drive?: { connected?: boolean; scope_ready?: boolean };
  provider_credentials?: { active_count?: number; ready?: boolean };
  diagnostics?: {
    recording_enabled?: boolean;
    debug_recording?: string;
    retention_days?: number;
    debug_retention_hours?: number;
  };
  report_limits?: { max_days?: number; max_timeline_events?: number };
};
type DiagnosticsEvent = {
  id: string;
  occurred_at: string;
  last_occurred_at?: string;
  level: "ERROR" | "WARNING" | "INFO" | "DEBUG";
  component: "web" | "api" | "worker";
  event_code: string;
  project_id?: string | null;
  job_id?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  occurrence_count?: number;
};
type DiagnosticsEventsResponse = {
  events: DiagnosticsEvent[];
  next_cursor?: string | null;
  period: { start: string; end: string };
};
type DiagnosticsDebugSession = {
  active: boolean;
  started_at?: string | null;
  expires_at?: string | null;
  server_time?: string | null;
};
type Project = {
  id: string;
  title: string;
  description: string | null;
  output_drive_folder_id: string | null;
  output_drive_folder_url: string | null;
  output_drive_folder_name: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};
type UploadInit = {
  source_id: string;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expires_in: number;
  };
};
type GoogleConnection = {
  connected: boolean;
  status: string | null;
  google_email: string | null;
  scopes: string | null;
  connected_at: string | null;
  revoked_at: string | null;
  picker_ready?: boolean;
  picker_configured?: boolean;
  picker_scope_ready?: boolean;
  reconnect_required?: boolean;
};
type GoogleOauthStart = { authorization_url: string; expires_at: string };
type SessionBootstrapСтатус =
  | "checking"
  | "authenticated"
  | "anonymous"
  | "error";
type SessionBootstrapState = {
  status: SessionBootstrapСтатус;
  user: User | null;
  csrf: string;
  error: string;
};
const emptySourceState = {
  loading: false,
  error: "",
  loaded: false,
  items: [] as Source[],
};
const emptyJobState: JobState = {
  loading: false,
  error: "",
  loaded: false,
  items: [],
};
function isExpectedPickerSourceBatch(
  value: unknown,
  expectedCount: number,
  projectId: string,
): value is Source[] {
  if (!Array.isArray(value) || value.length !== expectedCount) return false;
  const sourceIds = new Set<string>();
  return value.every((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const source = candidate as Partial<Source>;
    if (
      typeof source.id !== "string" ||
      !source.id ||
      sourceIds.has(source.id) ||
      source.project_id !== projectId ||
      source.source_type !== "google_drive" ||
      source.upload_status !== "uploaded" ||
      typeof source.original_filename !== "string" ||
      !source.original_filename
    ) {
      return false;
    }
    sourceIds.add(source.id);
    return true;
  });
}
function credentialProfileLabel(c: Credential) {
  return c.active_version ? `${c.label} · v${c.active_version}` : c.label;
}
const ELEVENLABS_CREDENTIAL_SESSION_KEY = "studio.elevenlabsCredentialId";
async function bootstrapSession(): Promise<{
  user: User;
  csrf: string;
} | null> {
  const session = await api<{ authenticated: boolean; user?: User }>(
    "/auth/session",
  );
  if (!session.authenticated || !session.user) return null;
  const csrf = await api<{ csrf_token: string }>("/auth/csrf", {
    method: "POST",
  });
  return { user: session.user, csrf: csrf.csrf_token };
}
async function csrfMutate<T>(
  path: string,
  csrf: string,
  onCsrf: (csrf: string) => void,
  options: RequestInit,
): Promise<T> {
  return mutateWithCsrfRetry<T>(path, csrf, onCsrf, options);
}
function safeConfirm(message: string) {
  try {
    return window.confirm(message) === true;
  } catch {
    return false;
  }
}
export const __appDiagnosticsTest = { api, csrfMutate };
function PreparationPanel({
  project,
  csrf,
  onCsrf,
  jobs,
  sources,
  googleConnection,
  pickerBusy,
  setPickerBusy,
  onLoadSources,
  onReloadSources,
  onReloadJobs,
  onError,
}: {
  project: Project;
  csrf: string;
  onCsrf: (csrf: string) => void;
  jobs: JobState;
  sources: typeof emptySourceState;
  googleConnection: GoogleConnection | null;
  pickerBusy: boolean;
  setPickerBusy: (busy: boolean) => void;
  onLoadSources: (projectId: string) => void;
  onReloadSources: (projectId: string) => void;
  onReloadJobs: (projectId: string) => void;
  onError: (message: string) => void;
}) {
  const [rows, setRows] = useState<ComposerRow[]>(() => [newComposerRow()]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [languageMode, setLanguageMode] = useState<TranscriptionLanguageMode>(
    DEFAULT_TRANSCRIPTION_LANGUAGE_MODE,
  );
  const [diarizationEnabled, setDiarizationEnabled] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialsError, setCredentialsError] = useState("");
  const [sourceUploadPolicy, setSourceUploadPolicy] =
    useState<SourceUploadPolicy | null>(null);
  const [sourceUploadPolicyError, setSourceUploadPolicyError] = useState("");
  const [message, setMessage] = useState("");
  const [submissionStage, setSubmissionStage] = useState<
    "preflight" | "create" | null
  >(null);
  const [preflight, setPreflight] = useState<{
    signature: string;
    data: BatchPreflightResponse;
  } | null>(null);
  const [batchJobs, setBatchJobs] = useState<TranscriptionJob[]>([]);
  const [pendingKey, setPendingKey] = useState<{
    signature: string;
    key: string;
  } | null>(null);
  const [detail, setDetail] = useState<Record<string, JobDetailState>>({});
  const [outputs, setOutputs] = useState<Record<string, JobOutputsState>>({});
  const [reconciliations, setReconciliations] = useState<Record<string, OutputReconciliationState>>({});
  const [retries, setRetries] = useState<Record<string, JobRetryState>>({});
  const [progress, setProgress] = useState<Record<string, JobProgressState>>({});
  const [removedSourceIds, setRemovedSourceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [createdSources, setCreatedSources] = useState<Source[]>([]);
  const [rowIntakeStatus, setRowIntakeStatus] = useState<
    Record<string, string>
  >({});
  const [rowIntakeErrors, setRowIntakeErrors] = useState<
    Record<string, string>
  >({});
  const [recentlyAddedRow, setRecentlyAddedRow] = useState<{
    id: string;
    number: number;
  } | null>(null);
  const [rowAdditionStatus, setRowAdditionStatus] = useState("");
  const rowFolderPickerRef = useRef(false);
  const rowSourcePickerRef = useRef(false);
  const rowElementRefs = useRef(new Map<string, HTMLLIElement>());
  const reloadJobsRef = useRef(onReloadJobs);
  useEffect(() => {
    reloadJobsRef.current = onReloadJobs;
  }, [onReloadJobs]);
  useEffect(() => {
    setRows([newComposerRow()]);
    setCreatedSources([]);
    setRemovedSourceIds(new Set());
    setRowIntakeStatus({});
    setRowIntakeErrors({});
    setBatchJobs([]);
    setPendingKey(null);
    setPreflight(null);
    setMessage("");
    setProgress({});
    setLanguageMode(DEFAULT_TRANSCRIPTION_LANGUAGE_MODE);
    setDiarizationEnabled(false);
    setRecentlyAddedRow(null);
    setRowAdditionStatus("");
  }, [project.id]);
  useEffect(() => {
    if (!recentlyAddedRow) return;
    const rowElement = rowElementRefs.current.get(recentlyAddedRow.id);
    const sourceSelect = rowElement?.querySelector<HTMLSelectElement>(
      'select[aria-label^="Существующий файл"]',
    );
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    sourceSelect?.focus({ preventScroll: true });
    rowElement?.scrollIntoView?.({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
    setRowAdditionStatus(
      `Добавлена строка ${recentlyAddedRow.number}. Выберите источник.`,
    );
    const highlightTimeout = window.setTimeout(
      () => setRecentlyAddedRow(null),
      1000,
    );
    return () => window.clearTimeout(highlightTimeout);
  }, [recentlyAddedRow]);
  useEffect(() => {
    if (!rowAdditionStatus) return;
    const statusTimeout = window.setTimeout(
      () => setRowAdditionStatus(""),
      4000,
    );
    return () => window.clearTimeout(statusTimeout);
  }, [rowAdditionStatus]);
  useEffect(() => {
    let cancelled = false;
    setCredentialsLoading(true);
    setCredentialsError("");
    api<{ credentials: Credential[] }>("/credentials")
      .then((r) => {
        if (!cancelled) setCredentials(r.credentials);
      })
      .catch(() => {
        if (!cancelled) {
          setCredentials([]);
          setCredentialsError("Не удалось загрузить подключение ElevenLabs.");
        }
      })
      .finally(() => {
        if (!cancelled) setCredentialsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setSourceUploadPolicy(null);
    setSourceUploadPolicyError("");
    api<unknown>("/sources/upload-policy")
      .then((value) => {
        if (cancelled) return;
        const policy = normalizeSourceUploadPolicy(value);
        if (!policy) throw new Error("Invalid source upload policy");
        setSourceUploadPolicy(policy);
      })
      .catch(() => {
        if (cancelled) return;
        setSourceUploadPolicy(null);
        setSourceUploadPolicyError(
          "Не удалось загрузить правила локальной загрузки. Загрузка с устройства временно недоступна.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const activeElevenLabsCredentials = credentials.filter(
    (credential) =>
      credential.provider === "elevenlabs" && credential.status === "active",
  );
  useEffect(() => {
    if (credentialsLoading || credentialsError) return;
    if (activeElevenLabsCredentials.length === 1) {
      setSelectedCredentialId(activeElevenLabsCredentials[0].id);
      sessionStorage.removeItem(ELEVENLABS_CREDENTIAL_SESSION_KEY);
      return;
    }
    if (activeElevenLabsCredentials.length > 1) {
      const saved =
        sessionStorage.getItem(ELEVENLABS_CREDENTIAL_SESSION_KEY) ?? "";
      if (
        saved &&
        activeElevenLabsCredentials.some(
          (credential) => credential.id === saved,
        )
      ) {
        setSelectedCredentialId(saved);
      } else {
        if (saved) sessionStorage.removeItem(ELEVENLABS_CREDENTIAL_SESSION_KEY);
        setSelectedCredentialId("");
      }
      return;
    }
    sessionStorage.removeItem(ELEVENLABS_CREDENTIAL_SESSION_KEY);
    setSelectedCredentialId("");
  }, [credentialsLoading, credentialsError, activeElevenLabsCredentials]);
  const sourceItems = [
    ...(Array.isArray(sources.items) ? sources.items : []),
    ...createdSources.filter(
      (created) => !sources.items.some((source) => source.id === created.id),
    ),
  ].filter((source) => !removedSourceIds.has(source.id));
  const visibleSources = { ...sources, items: sourceItems };
  const usableSources = sourceItems.filter(isUsableJobSource);
  const usableSourceIds = new Set(usableSources.map((source) => source.id));
  const signature = composerSignature(
    rows,
    selectedCredentialId,
    languageMode,
    diarizationEnabled,
  );
  useEffect(() => {
    setPendingKey((current) =>
      current && current.signature !== signature ? null : current,
    );
  }, [signature]);
  useEffect(() => {
    if (preflight && preflight.signature !== signature) {
      setPreflight(null);
      setMessage("");
    }
  }, [preflight, signature]);
  const invalidSourceRowIds = new Set(
    rows
      .filter((row) => row.source_id && !usableSourceIds.has(row.source_id))
      .map((row) => row.id),
  );
  const duplicatePairs = new Set<string>();
  const seenPairs = new Set<string>();
  rows.forEach((row) => {
    if (!row.source_id || !row.output_folder?.folder_id) return;
    const pair = `${row.source_id}\u0000${row.output_folder.folder_id}`;
    if (seenPairs.has(pair)) duplicatePairs.add(pair);
    seenPairs.add(pair);
  });
  const googlePickerGuidance = (() => {
    if (!googleConnection?.connected) return "Google Drive не подключён.";
    if (googleConnection.reconnect_required)
      return "Переподключите Google Drive в настройках, чтобы выбрать файлы.";
    if (!googleConnection.picker_configured)
      return "Выбор файлов Google Drive временно недоступен.";
    if (!googleConnection.picker_scope_ready)
      return "Разрешение Google Drive для выбора файлов недоступно. Переподключите Google Drive.";
    return "";
  })();
  const driveSourcePickerEnabled = Boolean(
    googleConnection?.picker_ready && !googlePickerGuidance,
  );

  const rowReadinessResults = rows.map((row, index) => {
    const rowNumber = index + 1;
    if (!row.source_id) {
      return { ready: false, reason: `Строка ${rowNumber}: выберите источник` };
    }
    if (!usableSourceIds.has(row.source_id)) {
      return {
        ready: false,
        reason: `Строка ${rowNumber}: выбранный файл больше недоступен`,
      };
    }
    if (!row.output_folder?.folder_id) {
      return {
        ready: false,
        reason: `Строка ${rowNumber}: выберите папку результата`,
      };
    }
    const pair = `${row.source_id}\u0000${row.output_folder.folder_id}`;
    if (duplicatePairs.has(pair)) {
      return {
        ready: false,
        reason: `Строка ${rowNumber}: такая пара файла и папки уже добавлена`,
      };
    }
    return { ready: true, reason: "" };
  });
  const completeRowCount = rowReadinessResults.filter(
    (result) => result.ready,
  ).length;
  const firstReadinessBlocker =
    rowReadinessResults.find((result) => !result.ready)?.reason ?? "";
  const credentialBlocker = credentialsLoading
    ? "Загрузка подключения ElevenLabs…"
    : credentialsError
      ? credentialsError
      : !selectedCredentialId
        ? activeElevenLabsCredentials.length > 1
          ? "Выберите профиль подключения ElevenLabs"
          : "Добавьте активный ключ ElevenLabs в настройках"
        : "";
  const submitting = submissionStage !== null;
  const activePreflight =
    preflight?.signature === signature ? preflight.data : null;
  const activePreflightBlocked =
    (activePreflight?.summary.blocked_count ?? 0) > 0;
  const submitBlocker = submitting
    ? submissionStage === "preflight"
      ? "Проверяем план…"
      : "Создание задач…"
    : credentialBlocker
      ? credentialBlocker
      : rows.length === 0
        ? "Добавьте хотя бы одну строку"
        : firstReadinessBlocker
          ? firstReadinessBlocker
          : activePreflightBlocked
            ? "Для найденных результатов выберите явное решение"
            : "";
  const canSubmit =
    !submitting &&
    !credentialsLoading &&
    !credentialsError &&
    Boolean(selectedCredentialId) &&
    rows.length > 0 &&
    rowReadinessResults.every((result) => result.ready) &&
    !activePreflightBlocked;

  function sourceById(sourceId: string) {
    return sourceItems.find((source) => source.id === sourceId) ?? null;
  }
  function clearRowIntakeError(rowId: string) {
    setRowIntakeErrors((current) => {
      if (!current[rowId]) return current;
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }
  function placeSourcesInRows(targetRowId: string, selected: Source[]) {
    if (selected.length === 0) return;
    clearRowIntakeError(targetRowId);
    setCreatedSources((current) => {
      const existing = new Set(current.map((source) => source.id));
      return [
        ...current,
        ...selected.filter((source) => !existing.has(source.id)),
      ];
    });
    setRows((current) => {
      const targetIndex = current.findIndex((row) => row.id === targetRowId);
      const target = targetIndex >= 0 ? current[targetIndex] : null;
      const canFillTarget = Boolean(target && !target.source_id);
      const next = [...current];
      const [first, ...rest] = selected;
      const sourcesToAppend = canFillTarget ? rest : selected;
      if (canFillTarget && first) {
        next[targetIndex] = {
          ...next[targetIndex],
          source_id: first.id,
          reprocess_existing: false,
        };
      }
      next.push(
        ...sourcesToAppend.map((source) => ({
          ...newComposerRow(),
          source_id: source.id,
        })),
      );
      return next.length > 0 ? next : [newComposerRow()];
    });
  }
  async function chooseRowDriveSources(rowId: string) {
    if (pickerBusy || rowSourcePickerRef.current) return;
    rowSourcePickerRef.current = true;
    setPickerBusy(true);
    setRowIntakeErrors((current) => ({ ...current, [rowId]: "" }));
    setRowIntakeStatus((current) => ({
      ...current,
      [rowId]: "Открываем Google Drive Picker…",
    }));
    try {
      const session = await csrfMutate<PickerSession>(
        "/google/picker/session",
        csrf,
        onCsrf,
        { method: "POST" },
      );
      const result = await googlePicker.openGooglePicker("sources", session);
      if (result.action === "cancel") {
        setRowIntakeStatus((current) => ({
          ...current,
          [rowId]: "Выбор файлов отменён.",
        }));
        return;
      }
      if (result.action === "error") {
        setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
        setRowIntakeErrors((current) => ({
          ...current,
          [rowId]: result.message,
        }));
        return;
      }
      if (
        sourceUploadPolicy &&
        result.docs.some(
          (doc) =>
            doc.mimeType &&
            !isSupportedSourceMimeType(doc.mimeType, sourceUploadPolicy),
        )
      ) {
        setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
        setRowIntakeErrors((current) => ({
          ...current,
          [rowId]:
            "В выборе есть файлы, не поддерживаемые текущими правилами.",
        }));
        return;
      }
      const fileIds = result.docs.map((doc) => doc.id);
      if (fileIds.length === 0) {
        setRowIntakeStatus((current) => ({
          ...current,
          [rowId]: "Google Picker не вернул файлы.",
        }));
        return;
      }
      const created = await csrfMutate<{ sources: unknown }>(
        `/projects/${project.id}/sources/google-picker`,
        csrf,
        onCsrf,
        { method: "POST", body: JSON.stringify({ file_ids: fileIds }) },
      );
      const orderedSources = created.sources;
      if (
        !isExpectedPickerSourceBatch(
          orderedSources,
          fileIds.length,
          project.id,
        )
      ) {
        onReloadSources(project.id);
        throw new Error(
          "Сервер вернул неполный ответ для выбранных файлов. Список файлов обновлён; проверьте добавленные файлы перед повторным выбором.",
        );
      }
      placeSourcesInRows(rowId, orderedSources);
      setRowIntakeStatus((current) => ({
        ...current,
        [rowId]: `Добавлено файлов: ${orderedSources.length}.`,
      }));
      onReloadSources(project.id);
    } catch (err) {
      const pickerFailure = googlePickerFailureMessage(err);
      setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
      setRowIntakeErrors((current) => ({
        ...current,
        [rowId]:
          pickerFailure ??
          (err instanceof ApiError && err.status === 422
            ? "Один или несколько файлов не поддерживаются. Выберите аудио, видео или OGG."
            : err instanceof Error
              ? err.message
              : "Не удалось выбрать файлы Google Drive."),
      }));
    } finally {
      rowSourcePickerRef.current = false;
      setPickerBusy(false);
    }
  }
  async function uploadRowLocalSources(
    rowId: string,
    e: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (!sourceUploadPolicy?.local_upload_enabled) {
      setRowIntakeErrors((current) => ({
        ...current,
        [rowId]:
          sourceUploadPolicyError ||
          "Локальная загрузка временно недоступна. Повторите попытку позже.",
      }));
      return;
    }
    const successful: Source[] = [];
    const failures: string[] = [];
    setRowIntakeErrors((current) => ({ ...current, [rowId]: "" }));
    for (const file of files) {
      if (!isSupportedMediaFile(file, sourceUploadPolicy)) {
        failures.push(
          `${file.name}: тип файла не поддерживается текущими правилами.`,
        );
        continue;
      }
      if (file.size <= 0) {
        failures.push(`${file.name}: файл пустой.`);
        continue;
      }
      if (file.size > sourceUploadPolicy.max_upload_bytes) {
        failures.push(
          `${file.name}: файл больше ${formatUploadLimit(sourceUploadPolicy.max_upload_bytes)}.`,
        );
        continue;
      }
      try {
        setRowIntakeStatus((current) => ({
          ...current,
          [rowId]: `${file.name} — подготовка загрузки…`,
        }));
        const initiated = await csrfMutate<UploadInit>(
          `/projects/${project.id}/sources/local-upload/initiate`,
          csrf,
          onCsrf,
          {
            method: "POST",
            body: JSON.stringify({
              original_filename: file.name,
              mime_type: file.type || "application/octet-stream",
              size_bytes: file.size,
            }),
          },
        );
        setRowIntakeStatus((current) => ({
          ...current,
          [rowId]: `${file.name} — загрузка…`,
        }));
        const put = await fetch(initiated.upload.url, {
          method: initiated.upload.method,
          headers: initiated.upload.headers,
          body: file,
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
        });
        if (!put.ok)
          throw new Error("Не удалось загрузить файл во временное хранилище.");
        const completed = await csrfMutate<Source>(
          `/sources/${initiated.source_id}/local-upload/complete`,
          csrf,
          onCsrf,
          { method: "POST" },
        );
        successful.push(completed);
        placeSourcesInRows(rowId, [completed]);
      } catch (err) {
        failures.push(
          `${file.name}: ${err instanceof Error ? err.message : "не удалось загрузить файл."}`,
        );
      }
    }
    if (successful.length > 0) onReloadSources(project.id);
    setRowIntakeStatus((current) => ({
      ...current,
      [rowId]: successful.length
        ? `Загружено файлов: ${successful.length}.`
        : "",
    }));
    if (failures.length > 0)
      setRowIntakeErrors((current) => ({
        ...current,
        [rowId]: failures.join(" "),
      }));
  }

  function updateRow(rowId: string, patch: Partial<ComposerRow>) {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }
  function addRow() {
    const row = newComposerRow();
    setRows((current) => [...current, row]);
    setRecentlyAddedRow({ id: row.id, number: rows.length + 1 });
  }
  function moveRow(index: number, direction: -1 | 1) {
    setRows((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function chooseRowFolder(rowId: string) {
    if (
      googleConnection?.picker_ready !== true ||
      pickerBusy ||
      rowFolderPickerRef.current
    )
      return;
    rowFolderPickerRef.current = true;
    setPickerBusy(true);
    setMessage("");
    try {
      const session = await csrfMutate<PickerSession>(
        "/google/picker/session",
        csrf,
        onCsrf,
        { method: "POST" },
      );
      const result = await googlePicker.openGooglePicker(
        "output-folder",
        session,
      );
      if (result.action === "cancel") return;
      if (result.action === "error") {
        setMessage(result.message);
        return;
      }
      const folderId = result.docs[0]?.id;
      if (!folderId) {
        setMessage("Выберите одну папку Google Drive.");
        return;
      }
      const verified = await batchMutateWithCsrfRetry<{
        name: string;
        web_view_url: string | null;
      }>(
        `/projects/${project.id}/output-folders/google-picker/verify`,
        csrf,
        onCsrf,
        { method: "POST", body: JSON.stringify({ folder_id: folderId }) },
      );
      updateRow(rowId, {
        output_folder: {
          folder_id: folderId,
          name: verified.name || "Папка Google Drive",
          web_view_url: verified.web_view_url,
        },
      });
    } catch (err) {
      setMessage(
        googlePickerFailureMessage(err) ??
        (err instanceof Error
          ? err.message
          : "Не удалось проверить папку результата."),
      );
    } finally {
      rowFolderPickerRef.current = false;
      setPickerBusy(false);
    }
  }
  async function createBatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    if (submitting) return;
    if (credentialsLoading || credentialsError || !selectedCredentialId) {
      setMessage(credentialBlocker || "Выберите активный профиль ElevenLabs.");
      return;
    }
    if (rows.length === 0) {
      setMessage("Добавьте хотя бы одну строку подготовки.");
      return;
    }
    if (rows.some((row) => !row.source_id || !row.output_folder?.folder_id)) {
      setMessage("В каждой строке выберите готовый файл и папку результата.");
      return;
    }
    if (invalidSourceRowIds.size > 0) {
      setMessage(
        "Одна или несколько строк ссылаются на файл, который уже недоступен. Выберите готовый файл заново.",
      );
      return;
    }
    if (duplicatePairs.size > 0) {
      setMessage(
        "Одинаковые пары файла и папки результата нельзя отправить дважды.",
      );
      return;
    }
    const requestBody = buildBatchCreateRequest(
      rows,
      selectedCredentialId,
      languageMode,
      diarizationEnabled,
    );
    const confirming = activePreflight !== null;
    setSubmissionStage(confirming ? "create" : "preflight");
    try {
      if (!confirming) {
        const rawResponse = await batchMutateWithCsrfRetry<unknown>(
          `/projects/${project.id}/jobs/batch/preflight`,
          csrf,
          onCsrf,
          { method: "POST", body: JSON.stringify(requestBody) },
        );
        const response = parseBatchPreflightResponse(rawResponse);
        if (
          !response ||
          response.items.length !== rows.length
        ) {
          throw new Error("Invalid batch preflight response");
        }
        setPreflight({ signature, data: response });
        setMessage(
          response.summary.blocked_count > 0
            ? "Найдены ранее созданные результаты. Выберите явное решение для каждой заблокированной строки."
            : "Проверка готова. Сверьте план и подтвердите создание задач.",
        );
        return;
      }
      const key =
        pendingKey?.signature === signature
          ? pendingKey.key
          : makeIdempotencyKey();
      setPendingKey({ signature, key });
      const response = await batchMutateWithCsrfRetry<BatchCreateResponse>(
        `/projects/${project.id}/jobs/batch`,
        csrf,
        onCsrf,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(requestBody),
        },
      );
      setBatchJobs(response.jobs);
      setRows([newComposerRow()]);
      setPendingKey(null);
      setPreflight(null);
      setMessage(
        response.replayed
          ? `Повтор подтверждён: создано независимых задач: ${response.created_count}.`
          : `Создано независимых задач: ${response.created_count}.`,
      );
      onReloadJobs(project.id);
    } catch (err) {
      if (!confirming) {
        setMessage(
          err instanceof ApiError && err.status === 422
            ? "План не прошёл серверную проверку. Исправьте файлы, папки или профиль ElevenLabs."
            : "Не удалось проверить план. Задачи не созданы; повторите проверку.",
        );
      } else if (err instanceof ApiError && err.status === 409) {
        setMessage(
          "План изменился или появился существующий результат. Повторите проверку и примите явное решение; задачи не созданы.",
        );
      } else if (err instanceof ApiError && err.status === 422) {
        setMessage(
          "Пакет не прошёл проверку. Строки сохранены — исправьте файлы или папки и отправьте снова.",
        );
      } else {
        setMessage(
          "Не удалось создать пакет задач. Строки и ключ повтора сохранены — можно повторить отправку без изменений.",
        );
      }
    } finally {
      setSubmissionStage(null);
    }
  }
  async function loadDetail(jobId: string) {
    setDetail((current) => ({
      ...current,
      [jobId]: { loading: true, error: "", job: current[jobId]?.job ?? null },
    }));
    setOutputs((current) => ({
      ...current,
      [jobId]: { loading: true, error: "", data: current[jobId]?.data ?? null },
    }));
    void api<TranscriptionJob>(`/jobs/${jobId}`)
      .then((loaded) =>
        setDetail((current) => ({
          ...current,
          [jobId]: { loading: false, error: "", job: loaded },
        })),
      )
      .catch(() =>
        setDetail((current) => ({
          ...current,
          [jobId]: {
            loading: false,
            error: "Не удалось загрузить детали задачи.",
            job: current[jobId]?.job ?? null,
          },
        })),
      );
    void api<JobRetryResponse>(`/jobs/${jobId}/retry`)
      .then((data) => setRetries((current) => ({ ...current, [jobId]: { loading: false, posting: false, error: "", message: "", data } })))
      .catch(() => setRetries((current) => ({ ...current, [jobId]: { loading: false, posting: false, error: "", message: "", data: null } })));
    void api<OutputReconciliationResponse>(`/jobs/${jobId}/output-reconciliation`)
      .then((data) => setReconciliations((current) => ({ ...current, [jobId]: { loading: false, checking: false, error: "", message: "", data } })))
      .catch(() => setReconciliations((current) => ({ ...current, [jobId]: { loading: false, checking: false, error: "", message: "", data: null } })));
    void api<JobOutputsResponse>(`/jobs/${jobId}/outputs`)
      .then((data) =>
        setOutputs((current) => ({
          ...current,
          [jobId]: { loading: false, error: "", data },
        })),
      )
      .catch(() =>
        setOutputs((current) => ({
          ...current,
          [jobId]: {
            loading: false,
            error: "Не удалось загрузить результаты.",
            data: current[jobId]?.data ?? null,
          },
        })),
      );
  }
  async function checkReconciliation(jobId: string) {
    setReconciliations((current) => ({ ...current, [jobId]: { ...(current[jobId] ?? { loading:false, error:"", message:"", data:null }), checking: true, error: "", message: "" } }));
    try {
      const result = await csrfMutate<OutputReconciliationCheckResponse>(`/jobs/${jobId}/output-reconciliation/check`, csrf, onCsrf, { method: "POST" });
      const message = result.resolved > 0 ? "Документ найден и восстановлен." : result.conflicts > 0 ? "Обнаружено несколько подходящих документов. Автоматическое восстановление заблокировано." : "Документ пока не найден в Google Drive.";
      setReconciliations((current) => ({ ...current, [jobId]: { ...(current[jobId] ?? { loading:false, error:"", data:null }), checking: false, message } }));
      await loadDetail(jobId);
      onReloadJobs(project.id);
    } catch (err) {
      setReconciliations((current) => ({ ...current, [jobId]: { ...(current[jobId] ?? { loading:false, message:"", data:null }), checking: false, error: err instanceof ApiError && err.status === 409 ? "Google connection недоступен или reconciliation сейчас невозможен." : "Не удалось проверить Google Drive." } }));
    }
  }

  async function retryJob(jobId: string) {
    setRetries((current) => ({ ...current, [jobId]: { ...(current[jobId] ?? { loading:false, error:"", message:"", data:null }), posting: true, error: "", message: "" } }));
    try {
      const result = await csrfMutate<JobRetryResponse>(`/jobs/${jobId}/retry`, csrf, onCsrf, { method: "POST" });
      setRetries((current) => ({ ...current, [jobId]: { ...(current[jobId] ?? { loading:false, error:"", data:null }), posting: false, data: result, message: "Безопасный повтор поставлен в очередь." } }));
      await loadDetail(jobId);
      onReloadJobs(project.id);
    } catch {
      setRetries((current) => ({ ...current, [jobId]: { ...(current[jobId] ?? { loading:false, message:"", data:null }), posting: false, error: "Повтор сейчас недоступен." } }));
    }
  }

  async function cancelJob(jobId: string) {
    setMessage("");
    try {
      const cancelled = await csrfMutate<TranscriptionJob>(
        `/jobs/${jobId}/cancel`,
        csrf,
        onCsrf,
        { method: "POST" },
      );
      setDetail((current) => ({
        ...current,
        [jobId]: { loading: false, error: "", job: cancelled },
      }));
      setMessage(
        "Запрос отмены отправлен. Уже созданные результаты останутся доступны.",
      );
      onReloadJobs(project.id);
    } catch {
      setMessage("Не удалось отменить задачу. Повторите позже.");
    }
  }
  const displayJobs = mergeJobsWithBatchOrder(jobs.items ?? [], batchJobs);
  const currentJobs = displayJobs.filter((job) =>
    ["queued", "processing"].includes(job.status),
  );
  const recentJobs = displayJobs.filter((job) =>
    ["completed", "failed", "cancelled"].includes(job.status),
  );
  const currentJobIds = currentJobs.map((job) => job.id).sort().join(",");
  useEffect(() => {
    if (!currentJobIds) {
      setProgress({});
      return;
    }
    let stopped = false;
    let timer: number | undefined;
    let confirmedResponse = false;
    const requestedIds = currentJobIds.split(",");
    const refresh = async () => {
      setProgress((current) => {
        const next: Record<string, JobProgressState> = {};
        for (const jobId of requestedIds) {
          next[jobId] = {
            loading: !current[jobId]?.data,
            error: "",
            data: current[jobId]?.data ?? null,
          };
        }
        return next;
      });
      try {
        const raw = await api<unknown>(`/projects/${project.id}/jobs/progress`);
        const parsed = parseProjectJobProgressResponse(raw);
        if (!parsed) throw new Error("Invalid job progress response");
        if (stopped) return;
        confirmedResponse = true;
        const byId = new Map(parsed.jobs.map((item) => [item.job_id, item]));
        setProgress((current) => {
          const next: Record<string, JobProgressState> = {};
          for (const jobId of requestedIds) {
            next[jobId] = {
              loading: false,
              error: "",
              data: byId.get(jobId) ?? current[jobId]?.data ?? null,
            };
          }
          return next;
        });
        if (requestedIds.some((jobId) => !byId.has(jobId))) {
          reloadJobsRef.current(project.id);
          return;
        }
        timer = window.setTimeout(refresh, 5000);
      } catch {
        if (stopped) return;
        setProgress((current) => {
          const next: Record<string, JobProgressState> = {};
          for (const jobId of requestedIds) {
            next[jobId] = {
              loading: false,
              error: "progress_unavailable",
              data: current[jobId]?.data ?? null,
            };
          }
          return next;
        });
        if (confirmedResponse) timer = window.setTimeout(refresh, 10000);
      }
    };
    void refresh();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [currentJobIds, project.id]);
  function renderJobCard(job: TranscriptionJob) {
    const currentDetail = detail[job.id];
    const detailedJob = currentDetail?.job;
    return (
      <JobCard
        key={job.id}
        job={job}
        detail={currentDetail}
        outputs={outputs[job.id]}
        reconciliation={reconciliations[job.id]}
        retry={detailedJob ? retries[detailedJob.id] : undefined}
        progress={
          ["queued", "processing"].includes(job.status)
            ? progress[job.id]
            : undefined
        }
        onOpen={loadDetail}
        onCancel={cancelJob}
        onCheckReconciliation={checkReconciliation}
        onRetry={retryJob}
      />
    );
  }
  return (
    <section className="preparation" aria-label={`Подготовка ${project.title}`}>
      <form
        className="job-creator composer"
        onSubmit={createBatch}
        aria-label="Композитор пакетных задач"
      >
        <div className="composer-header">
          <div>
            <h4>Подготовка задач</h4>
            <p className="muted">
              Одна строка создаёт одну независимую задачу: один файл → одна
              папка результата.
            </p>
          </div>
          <div className="composer-add-row">
            <button type="button" className="secondary" onClick={addRow}>
              Добавить строку
            </button>
            <span
              className="composer-add-row-status"
              role="status"
              aria-live="polite"
              aria-label="Результат добавления строки"
            >
              {rowAdditionStatus}
            </span>
          </div>
        </div>
        <div className="provider-card">
          <div>
            <span className="field-label">Провайдер транскрибации</span>
            <strong>ElevenLabs</strong>
            {selectedCredentialId && !credentialsError && (
              <span className="provider-ready">Подключён и готов</span>
            )}
            <p className="muted">
              Ключи создаются и изменяются только в настройках.
            </p>
          </div>
          {credentialsLoading && <p role="status">Загрузка подключения…</p>}
          {credentialsError && <p className="notice">{credentialsError}</p>}
          {!credentialsLoading &&
            !credentialsError &&
            activeElevenLabsCredentials.length === 0 && (
              <div>
                <p className="notice">
                  Добавьте активный ключ ElevenLabs в настройках, чтобы
                  создавать задачи.
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("studio:navigate-settings"),
                    )
                  }
                >
                  Перейти в настройки
                </button>
              </div>
            )}
          {!credentialsLoading &&
            !credentialsError &&
            activeElevenLabsCredentials.length > 1 && (
              <label className="profile-selector">
                Профиль подключения
                <select
                  aria-label="Профиль подключения"
                  value={selectedCredentialId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedCredentialId(value);
                    if (value) {
                      sessionStorage.setItem(
                        ELEVENLABS_CREDENTIAL_SESSION_KEY,
                        value,
                      );
                    } else {
                      sessionStorage.removeItem(
                        ELEVENLABS_CREDENTIAL_SESSION_KEY,
                      );
                    }
                  }}
                >
                  <option value="">Выберите профиль</option>
                  {activeElevenLabsCredentials.map((credential) => (
                    <option key={credential.id} value={credential.id}>
                      {credentialProfileLabel(credential)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          <label className="profile-selector">
            Язык транскрибации
            <select
              aria-label="Язык транскрибации"
              value={languageMode}
              onChange={(event) => {
                setLanguageMode(
                  event.target.value as TranscriptionLanguageMode,
                );
                setRows((current) =>
                  current.map((row) => ({
                    ...row,
                    reprocess_existing: false,
                  })),
                );
              }}
            >
              <option value="ru">Русский</option>
              <option value="detect">Автоопределение</option>
            </select>
          </label>
          <label className="transcription-toggle">
            <input
              type="checkbox"
              aria-label="Разделять на спикеров"
              checked={diarizationEnabled}
              onChange={(event) => {
                setDiarizationEnabled(event.target.checked);
                setRows((current) =>
                  current.map((row) => ({
                    ...row,
                    reprocess_existing: false,
                  })),
                );
              }}
            />
            <span>
              <strong>Разделять на спикеров</strong>
              <small>
                В документе появятся последовательные блоки Speaker 1,
                Speaker 2 и далее.
              </small>
            </span>
          </label>
        </div>
        <div
          className="composer-status"
          role="status"
          aria-live="polite"
          aria-label="Готовность строк подготовки"
        >
          <b>
            Готово: {completeRowCount} из {rows.length}
          </b>
          <span>
            {firstReadinessBlocker
              ? firstReadinessBlocker
              : "Все строки готовы"}
          </span>
        </div>
        {sourceUploadPolicy?.local_upload_enabled ? (
          <p className="muted">
            Локальная загрузка: до{" "}
            {formatUploadLimit(sourceUploadPolicy.max_upload_bytes)}. Допустимые
            типы получены с сервера.
          </p>
        ) : sourceUploadPolicy ? (
          <p className="notice">Локальная загрузка временно недоступна.</p>
        ) : sourceUploadPolicyError ? (
          <p className="notice">{sourceUploadPolicyError}</p>
        ) : (
          <p className="muted">Загружаем правила локальной загрузки…</p>
        )}
        <fieldset className="composer-rows">
          <legend>Строки подготовки</legend>
          {!sources.loaded && (
            <button type="button" onClick={() => onLoadSources(project.id)}>
              Загрузить существующие файлы проекта
            </button>
          )}
          {sources.loaded && usableSources.length === 0 && (
            <section className="empty-state">
              <p>
                Сначала добавьте хотя бы один готовый файл через строку
                подготовки.
              </p>
            </section>
          )}
          <ol>
            {rows.map((row, index) => {
              const selectedSource = sourceById(row.source_id);
              const pairKey =
                row.source_id && row.output_folder?.folder_id
                  ? `${row.source_id}\u0000${row.output_folder.folder_id}`
                  : "";
              const duplicate = pairKey && duplicatePairs.has(pairKey);
              const rowReadiness = rowReadinessResults[index];
              const rowReady = rowReadiness.ready;
              return (
                <li
                  className={`composer-row${
                    recentlyAddedRow?.id === row.id
                      ? " composer-row-added"
                      : ""
                  }`}
                  key={row.id}
                  aria-label={`Задача ${index + 1}`}
                  ref={(element) => {
                    if (element) rowElementRefs.current.set(row.id, element);
                    else rowElementRefs.current.delete(row.id);
                  }}
                >
                  <div className="composer-row-header">
                    <div>
                      <b>Задача {index + 1}</b>
                      <span>{rowReady ? "Готова" : "Нужно заполнить"}</span>
                    </div>
                    {rows.length > 1 && (
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => moveRow(index, -1)}
                          disabled={index === 0}
                          aria-label={`Поднять строку ${index + 1}`}
                        >
                          Выше
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRow(index, 1)}
                          disabled={index === rows.length - 1}
                          aria-label={`Опустить строку ${index + 1}`}
                        >
                          Ниже
                        </button>
                        <button
                          type="button"
                          className="secondary danger"
                          onClick={() =>
                            setRows((current) =>
                              current.length > 1
                                ? current.filter((item) => item.id !== row.id)
                                : current,
                            )
                          }
                          aria-label={`Удалить строку ${index + 1}`}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="composer-row-grid">
                    <section
                      className="row-source-cell"
                      aria-label={`Источник строки ${index + 1}`}
                    >
                      <label>
                        Источник
                        <select
                          aria-label={`Существующий файл для строки ${index + 1}`}
                          value={row.source_id}
                          onChange={(e) => {
                            updateRow(row.id, {
                              source_id: e.target.value,
                              reprocess_existing: false,
                            });
                            if (e.target.value) clearRowIntakeError(row.id);
                          }}
                        >
                          <option value="">Выберите существующий файл</option>
                          {sourceItems.map((source) => (
                            <option
                              key={source.id}
                              value={source.id}
                              disabled={!isUsableJobSource(source)}
                            >
                              {source.original_filename} ·{" "}
                              {sourceСтатусLabel(source.upload_status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="row-source-actions">
                        <button
                          type="button"
                          className="secondary"
                          aria-label="Выбрать файлы Google Drive"
                          disabled={!driveSourcePickerEnabled || pickerBusy}
                          onClick={() => void chooseRowDriveSources(row.id)}
                        >
                          Из Google Drive
                        </button>
                        <span className="file-picker-control">
                          <label
                            className={`button-like secondary${
                              sourceUploadPolicy?.local_upload_enabled
                                ? ""
                                : " disabled"
                            }`}
                            htmlFor={`local-source-upload-${row.id}`}
                            aria-disabled={
                              !sourceUploadPolicy?.local_upload_enabled
                            }
                          >
                            <span aria-hidden="true">С устройства</span>
                            <span className="visually-hidden">
                              Выбрать файлы с устройства для строки {index + 1}
                            </span>
                          </label>
                          <input
                            id={`local-source-upload-${row.id}`}
                            className="visually-hidden"
                            aria-label={`Выбрать файлы с устройства для строки ${index + 1}`}
                            type="file"
                            multiple
                            accept={
                              sourceUploadPolicy?.local_upload_enabled
                                ? sourceUploadAccept(sourceUploadPolicy)
                                : undefined
                            }
                            disabled={!sourceUploadPolicy?.local_upload_enabled}
                            onChange={(e) =>
                              void uploadRowLocalSources(row.id, e)
                            }
                          />
                        </span>
                      </div>
                      {googlePickerGuidance && (
                        <p className="notice">{googlePickerGuidance}</p>
                      )}
                      {selectedSource && (
                        <div className="selected-source-summary">
                          <b>{selectedSource.original_filename}</b>
                          <span>
                            {selectedSource.source_type === "google_drive"
                              ? "Google Drive"
                              : "С устройства"}
                          </span>
                          <span>
                            Статус:{" "}
                            {sourceСтатусLabel(selectedSource.upload_status)}
                          </span>
                          {selectedSource.source_type === "local_upload" &&
                            selectedSource.expires_at && (
                              <span>
                                Временная копия хранится до:{" "}
                                {formatTime(selectedSource.expires_at)}
                              </span>
                            )}
                          {isSafeDisplayUrl(
                            selectedSource.drive_file_url ?? null,
                          ) && (
                            <ResourceExternalLink
                              href={selectedSource.drive_file_url ?? ""}
                              label="Открыть файл"
                              ariaLabel={`Открыть источник строки ${index + 1} в Google Drive`}
                            />
                          )}
                        </div>
                      )}
                      {rowIntakeStatus[row.id] && (
                        <p role="status" className="muted">
                          {rowIntakeStatus[row.id]}
                        </p>
                      )}
                      {rowIntakeErrors[row.id] && (
                        <p className="error">{rowIntakeErrors[row.id]}</p>
                      )}
                    </section>
                    <div className="folder-cell">
                      <span className="field-label">Папка результата</span>
                      <span>
                        {row.output_folder?.name || "Папка не выбрана"}
                      </span>
                      {row.output_folder?.web_view_url &&
                        isApprovedOutputUrl(row.output_folder.web_view_url) && (
                          <ResourceExternalLink
                            href={row.output_folder.web_view_url}
                            label="Открыть папку"
                            ariaLabel={`Открыть папку результата строки ${index + 1} в Google Drive`}
                          />
                        )}
                      <button
                        type="button"
                        className="secondary"
                        disabled={!googleConnection?.picker_ready || pickerBusy}
                        onClick={() => void chooseRowFolder(row.id)}
                        aria-label={`Выбрать папку результата для строки ${index + 1}`}
                      >
                        {row.output_folder?.folder_id ? "Изменить" : "Выбрать"}
                      </button>
                    </div>
                    <label>
                      Название документа
                      <input
                        value={row.title}
                        onChange={(e) =>
                          updateRow(row.id, { title: e.target.value })
                        }
                        maxLength={160}
                        placeholder="Необязательно"
                        aria-label={`Название задачи для строки ${index + 1}`}
                      />
                      <small className="muted">
                        Необязательно. Если оставить пустым, Google Docs
                        получит имя исходного файла.
                      </small>
                    </label>
                  </div>
                  {invalidSourceRowIds.has(row.id) && (
                    <p className="error">
                      Выбранный файл больше недоступен. Выберите готовый файл
                      заново.
                    </p>
                  )}
                  {duplicate && (
                    <p className="error">
                      Такая пара файла и папки уже добавлена.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </fieldset>
        {activePreflight && (
          <section
            className="batch-preflight"
            aria-label="Проверка перед созданием задач"
          >
            <div className="batch-preflight-header">
              <div>
                <h5>
                  {activePreflightBlocked
                    ? "План требует решения"
                    : "План готов к подтверждению"}
                </h5>
                <p className="muted">
                  ElevenLabs scribe_v2 ·{" "}
                  {activePreflight.language_mode === "ru"
                    ? "Русский"
                    : "Автоопределение"}
                  {" · "}
                  Спикеры:{" "}
                  {activePreflight.diarization_enabled
                    ? "разделять"
                    : "не разделять"}
                </p>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setPreflight(null);
                  setMessage("");
                }}
              >
                Изменить план
              </button>
            </div>
            <ol>
              {activePreflight.items.map((item) => {
                const matchLabel =
                  item.existing_result_match.status === "accepted_match"
                    ? "Есть готовый результат с теми же настройками."
                    : item.existing_result_match.status ===
                        "standardization_required"
                      ? "Есть результат с теми же настройками, но старого стандарта."
                      : item.existing_result_match.status === "indeterminate"
                        ? "Есть результат, настройки которого нельзя подтвердить."
                        : "Совпадений с теми же настройками среди результатов Studio не найдено.";
                const row = rows[item.position];
                return (
                  <li key={item.position}>
                    <div>
                      <b>
                        {item.position + 1}. {item.source.name}
                      </b>
                      <span>
                        {item.source.source_type === "google_drive"
                          ? "Google Drive"
                          : "С устройства"}
                        {item.source.mime_type
                          ? ` · ${item.source.mime_type}`
                          : ""}
                      </span>
                      <span>
                        Размер: {formatBytes(item.source.size_bytes)} ·{" "}
                        Длительность:{" "}
                        {item.source.duration_seconds == null
                          ? "будет определена при подготовке"
                          : `${Math.round(item.source.duration_seconds)} сек.`}
                      </span>
                      <span>{matchLabel}</span>
                    </div>
                    <div>
                      <span>Результат: {item.output_destination.name}</span>
                      <strong>
                        {item.planned_outcome === "process"
                          ? item.existing_result_match.resolution ===
                            "reprocess"
                            ? "План: транскрибировать заново"
                            : "План: обработать"
                          : item.planned_outcome === "skip"
                            ? "План: пропустить"
                            : "План: заблокировано"}
                      </strong>
                      {item.existing_result_match.status !== "no_match" &&
                        row && (
                          <label className="reprocess-decision">
                            <input
                              type="checkbox"
                              checked={row.reprocess_existing}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  reprocess_existing: event.target.checked,
                                })
                              }
                              aria-label={`Транскрибировать заново строку ${item.position + 1}`}
                            />
                            <span>
                              Транскрибировать заново — повтор может списать
                              средства
                            </span>
                          </label>
                        )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {activePreflight.existing_result_authority.status ===
              "partial" && (
              <p className="notice">
                Проверены только принятые результаты Studio. Разовый импорт
                старой коллекции Google Docs ещё не выполнен, поэтому эта
                проверка не видит документы вне Studio.
              </p>
            )}
          </section>
        )}
        <div className="composer-footer">
          <div>
            <b>Строк: {rows.length}</b>
            <span>
              Готово: {completeRowCount} из {rows.length}
            </span>
            {submitBlocker && <span>{submitBlocker}</span>}
          </div>
          <button className="primary" disabled={!canSubmit}>
            {submissionStage === "preflight"
              ? "Проверяем план…"
              : submissionStage === "create"
                ? "Создание задач…"
                : activePreflight
                  ? `Подтвердить и создать (${rows.length})`
                  : `Проверить задачи (${rows.length})`}
          </button>
        </div>
      </form>
      {message && (
        <p
          className={
            message.startsWith("Не удалось") || message.startsWith("Конфликт")
              ? "error"
              : "notice"
          }
        >
          {message}
        </p>
      )}
      <details className="sources project-files">
        <summary className="summary-row">Файлы проекта</summary>
        <SourcesPanel
          project={project}
          csrf={csrf}
          onCsrf={onCsrf}
          sources={visibleSources}
          onReload={onReloadSources}
          onSourceRemoved={(sourceId) => {
            setRemovedSourceIds((current) => new Set(current).add(sourceId));
            const affectedRowIds = rows
              .filter((row) => row.source_id === sourceId)
              .map((row) => row.id);
            if (affectedRowIds.length > 0) {
              setRowIntakeErrors((errors) => {
                const next = { ...errors };
                affectedRowIds.forEach((rowId) => {
                  next[rowId] =
                    "Источник удалён из проекта. Выберите новый файл для этой строки.";
                });
                return next;
              });
            }
            setRows((current) =>
              current.map((row) =>
                row.source_id === sourceId
                  ? {
                      ...row,
                      source_id: "",
                      reprocess_existing: false,
                    }
                  : row,
              ),
            );
            setMessage("Файл убран из проекта.");
          }}
          onError={onError}
        />
      </details>
      <TranscriptionAnalyticsPanel key={project.id} projectId={project.id} />
      <section className="sources" aria-label="Текущие задачи">
        <h4>Текущие задачи</h4>
        {jobs.loading && <p role="status">Загрузка задач…</p>}
        {jobs.error && <p className="error">{jobs.error}</p>}
        {jobs.loaded && !jobs.loading && currentJobs.length === 0 && (
          <p className="notice">Текущих задач нет.</p>
        )}
        {currentJobs.map((job) => renderJobCard(job))}
      </section>
      <details className="recent-jobs">
        <summary>Недавние задачи · {recentJobs.length}</summary>
        {recentJobs.map((job) => renderJobCard(job))}
      </details>{" "}
    </section>
  );
}

function OverviewPage({
  onNavigate,
  onCreateProject,
  onOpenProject,
}: {
  onNavigate: (page: Page) => void;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(false);
  const [googleConnection, setGoogleConnection] =
    useState<GoogleConnection | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleError, setGoogleError] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialsError, setCredentialsError] = useState(false);
  useEffect(() => {
    api<{ projects: Project[] }>("/projects")
      .then((r) =>
        setProjects(
          (r.projects ?? []).filter((project) => !project.archived_at),
        ),
      )
      .catch(() => setProjectsError(true))
      .finally(() => setProjectsLoading(false));
    api<GoogleConnection>("/google/connection")
      .then(setGoogleConnection)
      .catch(() => setGoogleError(true))
      .finally(() => setGoogleLoading(false));
    api<{ credentials: Credential[] }>("/credentials")
      .then((r) => setCredentials(r.credentials ?? []))
      .catch(() => setCredentialsError(true))
      .finally(() => setCredentialsLoading(false));
  }, []);
  const activeCredentials = credentials.filter(
    (credential) => credential.status === "active",
  );
  const recentProjects = [...projects]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 5);
  const googleStatus = googleLoading
    ? "Загрузка…"
    : googleError
      ? "Недоступно"
      : googleConnection?.connected && !googleConnection.reconnect_required
        ? "Подключён"
        : "Нужна настройка";
  const needsAttention = [
    !projectsLoading && !projectsError && projects.length === 0
      ? "Создайте первый проект, чтобы подготовить пакет задач."
      : "",
    !googleLoading &&
    !googleError &&
    (!googleConnection?.connected || googleConnection.reconnect_required)
      ? "Подключите или обновите Google Drive для выбора файлов и папок."
      : "",
    !credentialsLoading && !credentialsError && activeCredentials.length === 0
      ? "Добавьте активный ключ провайдера в настройках."
      : "",
  ].filter(Boolean);
  return (
    <section className="page dashboard-page">
      <header className="page-header split">
        <div>
          <h1 className="page-title">Studio</h1>
          <p>
            Рабочая панель аккаунта: проекты, подключение Drive и готовность
            ключей.
          </p>
        </div>
        <div className="actions">
          <button className="primary" onClick={onCreateProject}>
            Новый проект
          </button>
          {projects.length > 0 && (
            <button onClick={() => onNavigate("projects")}>
              Открыть проекты
            </button>
          )}
        </div>
      </header>
      <div className="summary-grid dashboard-summary">
        <article className="card summary-card" aria-label="Проекты">
          <span className="summary-label">Проекты</span>
          <strong className="summary-value">
            {projectsLoading
              ? "Загрузка…"
              : projectsError
                ? "Недоступно"
                : projects.length}
          </strong>
        </article>
        <article className="card summary-card" aria-label="Google Drive">
          <span className="summary-label">Google Drive</span>
          <strong className="summary-value">{googleStatus}</strong>
        </article>
        <article className="card summary-card" aria-label="Активные ключи">
          <span className="summary-label">Активные ключи</span>
          <strong className="summary-value">
            {credentialsLoading
              ? "Загрузка…"
              : credentialsError
                ? "Недоступно"
                : activeCredentials.length}
          </strong>
        </article>
      </div>
      {(projectsError || googleError || credentialsError) && (
        <p className="notice">
          Часть данных панели сейчас недоступна. Остальные сведения показаны
          ниже.
        </p>
      )}
      {needsAttention.length > 0 && (
        <article className="card attention-card">
          <h2>Требует внимания</h2>
          <ul>
            {needsAttention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      )}
      {projects.length > 0 ? (
        <article className="card recent-projects-card">
          <h2>Последние проекты</h2>
          <div className="recent-project-list">
            {recentProjects.map((project) => (
              <button
                type="button"
                className="recent-project-item"
                key={project.id}
                onClick={() => onOpenProject(project.id)}
              >
                <span>
                  <strong>{project.title}</strong>
                  {project.description && <small>{project.description}</small>}
                </span>
                <span className="muted">
                  Обновлено:{" "}
                  {new Date(project.updated_at).toLocaleString("ru-RU")}
                </span>
              </button>
            ))}
          </div>
        </article>
      ) : (
        !projectsLoading &&
        !projectsError && (
          <article className="card">
            <h2>Рабочий процесс</h2>
            <ol className="workflow">
              <li>1. Проект</li>
              <li>2. Источники</li>
              <li>3. Задача</li>
            </ol>
            <div className="actions">
              <button className="primary" onClick={onCreateProject}>
                Новый проект
              </button>
              <button onClick={() => onNavigate("settings")}>Настройки</button>
            </div>
          </article>
        )
      )}
    </section>
  );
}

function ProjectsPage({
  csrf,
  onCsrf,
  requestedProjectId,
  onRequestedProjectHandled,
  requestedProjectsView,
  onRequestedProjectsViewHandled,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
  requestedProjectId: string | null;
  onRequestedProjectHandled: () => void;
  requestedProjectsView: "browse" | "create" | null;
  onRequestedProjectsViewHandled: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sources, setSources] = useState<
    Record<string, typeof emptySourceState>
  >({});
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState(false);
  const setPickerBusy = (busy: boolean) => {
    setActivePicker(busy);
  };
  const [googleConnection, setGoogleConnection] =
    useState<GoogleConnection | null>(null);
  const load = () => {
    setLoading(true);
    setError("");
    api<{ projects: Project[] }>("/projects")
      .then((r) => {
        setProjects(r.projects);
        setSelectedProjectId((current) => {
          if (current && r.projects.some((project) => project.id === current))
            return current;
          return requestedProjectId &&
            r.projects.some((project) => project.id === requestedProjectId)
            ? requestedProjectId
            : (r.projects[0]?.id ?? null);
        });
        if (r.projects.length === 0) setCreateOpen(true);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить проекты.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    if (!requestedProjectId) return;
    if (projects.some((project) => project.id === requestedProjectId)) {
      setSelectedProjectId(requestedProjectId);
      onRequestedProjectHandled();
    }
  }, [requestedProjectId, projects, onRequestedProjectHandled]);
  useEffect(() => {
    if (!requestedProjectsView) return;
    if (requestedProjectsView === "browse" && loading) return;
    setCreateOpen(
      requestedProjectsView === "create" || projects.length === 0,
    );
    onRequestedProjectsViewHandled();
  }, [
    requestedProjectsView,
    loading,
    projects.length,
    onRequestedProjectsViewHandled,
  ]);
  useEffect(() => {
    api<GoogleConnection>("/google/connection")
      .then(setGoogleConnection)
      .catch(() => setGoogleConnection(null));
  }, []);
  const loadSources = (projectId: string) => {
    setSources((v) => ({
      ...v,
      [projectId]: {
        ...(v[projectId] ?? emptySourceState),
        loading: true,
        error: "",
      },
    }));
    api<{ sources: Source[] }>(`/projects/${projectId}/sources`)
      .then((r) =>
        setSources((v) => ({
          ...v,
          [projectId]: {
            loading: false,
            error: "",
            loaded: true,
            items: r.sources,
          },
        })),
      )
      .catch((err) =>
        setSources((v) => ({
          ...v,
          [projectId]: {
            loading: false,
            error:
              err instanceof Error
                ? err.message
                : "Не удалось загрузить sources.",
            loaded: true,
            items: [],
          },
        })),
      );
  };
  const loadJobs = (projectId: string) => {
    setJobs((v) => ({
      ...v,
      [projectId]: {
        ...(v[projectId] ?? emptyJobState),
        loading: true,
        error: "",
      },
    }));
    api<{ jobs: TranscriptionJob[] }>(`/projects/${projectId}/jobs`)
      .then((r) =>
        setJobs((v) => ({
          ...v,
          [projectId]: {
            loading: false,
            error: "",
            loaded: true,
            items: r.jobs,
          },
        })),
      )
      .catch(() =>
        setJobs((v) => ({
          ...v,
          [projectId]: {
            loading: false,
            error: "Не удалось загрузить jobs.",
            loaded: true,
            items: [],
          },
        })),
      );
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const created = await csrfMutate<Project>("/projects", csrf, onCsrf, {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("project_title"),
          description: fd.get("project_description"),
        }),
      });
      form.reset();
      setCreateOpen(false);
      setSelectedProjectId(created.id);
      load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось создать проект.",
      );
    }
  }
  async function update(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await csrfMutate<Project>(`/projects/${id}`, csrf, onCsrf, {
        method: "PATCH",
        body: JSON.stringify({
          title: fd.get("project_title"),
          description: fd.get("project_description"),
        }),
      });
      setEditing(null);
      load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось сохранить проект.",
      );
    }
  }
  async function archive(id: string) {
    setError("");
    try {
      await csrfMutate<{ ok: boolean }>(
        `/projects/${id}/archive`,
        csrf,
        onCsrf,
        { method: "POST" },
      );
      load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось архивировать проект.",
      );
    }
  }
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const showCreate = createOpen || projects.length === 0;
  const selectedSources = selectedProject
    ? (sources[selectedProject.id] ?? emptySourceState)
    : emptySourceState;
  const selectedJobs = selectedProject
    ? (jobs[selectedProject.id] ?? emptyJobState)
    : emptyJobState;
  useEffect(() => {
    if (!selectedProject) return;
    if (
      !sources[selectedProject.id]?.loaded &&
      !sources[selectedProject.id]?.loading
    )
      loadSources(selectedProject.id);
    if (!jobs[selectedProject.id]?.loaded && !jobs[selectedProject.id]?.loading)
      loadJobs(selectedProject.id);
  }, [selectedProject?.id]);
  return (
    <section className="page">
      <header className="page-header split">
        <div>
          <h1 className="page-title">Проекты</h1>
          <p>
            Создавайте проекты, добавляйте файлы, выбирайте папку результатов и
            запускайте задачи.
          </p>
        </div>
        <button
          className="primary"
          type="button"
          aria-expanded={showCreate}
          onClick={() => setCreateOpen((v) => !v)}
        >
          Новый проект
        </button>
      </header>
      {showCreate && (
        <form className="card project-form" onSubmit={save}>
          <h2>Новый проект</h2>
          <label>
            Название проекта
            <input name="project_title" maxLength={160} required />
          </label>
          <label>
            Описание
            <input name="project_description" maxLength={2000} />
          </label>
          <div className="actions">
            <button className="primary">Создать</button>
            <button type="button" onClick={() => setCreateOpen(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}
      {loading && <p role="status">Загрузка проектов…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && projects.length === 0 && (
        <p className="notice">Пока нет проектов. Создайте первый проект.</p>
      )}
      <div className="workspace-layout">
        <section className="project-list" aria-label="Список проектов">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={
                project.id === selectedProjectId
                  ? "project-list-item active"
                  : "project-list-item"
              }
              onClick={() => {
                setSelectedProjectId(project.id);
              }}
            >
              <strong>{project.title}</strong>
              {project.description && <span>{project.description}</span>}
              <small>
                Обновлено{" "}
                {new Date(project.updated_at).toLocaleDateString("ru-RU")}
              </small>
            </button>
          ))}
        </section>
        <div className="project-detail">
          {selectedProject ? (
            <article className="card workspace-card">
              {editing === selectedProject.id ? (
                <form
                  className="project-edit compact"
                  onSubmit={(e) => update(e, selectedProject.id)}
                >
                  <label>
                    Название проекта
                    <input
                      name="project_title"
                      defaultValue={selectedProject.title}
                      maxLength={160}
                      required
                    />
                  </label>
                  <label>
                    Описание
                    <textarea
                      name="project_description"
                      defaultValue={selectedProject.description ?? ""}
                      maxLength={2000}
                    />
                  </label>
                  <div className="actions">
                    <button className="primary">Сохранить</button>
                    <button type="button" onClick={() => setEditing(null)}>
                      Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <header className="workspace-header split">
                  <div>
                    <h2>{selectedProject.title}</h2>
                    <p>
                      {selectedProject.description || "Описание не добавлено."}
                    </p>
                    <p className="muted">
                      Обновлено:{" "}
                      {new Date(selectedProject.updated_at).toLocaleString(
                        "ru-RU",
                      )}
                    </p>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => setEditing(selectedProject.id)}
                    >
                      Редактировать
                    </button>
                    <button
                      className="danger"
                      type="button"
                      onClick={() => archive(selectedProject.id)}
                    >
                      Архивировать
                    </button>
                  </div>
                </header>
              )}
              <PreparationPanel
                key={selectedProject.id}
                project={selectedProject}
                csrf={csrf}
                onCsrf={onCsrf}
                jobs={selectedJobs}
                sources={selectedSources}
                googleConnection={googleConnection}
                pickerBusy={activePicker}
                setPickerBusy={setPickerBusy}
                onLoadSources={loadSources}
                onReloadSources={loadSources}
                onReloadJobs={loadJobs}
                onError={setError}
              />
            </article>
          ) : (
            <p className="notice">Выберите проект.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function boolText(value: boolean | undefined) {
  if (value === true) return "да";
  if (value === false) return "нет";
  return "—";
}
function safeText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "—";
  return String(value).slice(0, 120);
}
function buildIdentityText(value: unknown) {
  if (value === null || value === undefined || value === "")
    return "не настроено";
  if (typeof value === "string" && value.trim().toLowerCase() === "unknown")
    return "не настроено";
  return safeText(value);
}
function diagnosticsDebugStateText(value: unknown) {
  if (value === "inactive") return "неактивна";
  return safeText(value);
}
function diagnosticsLevelLabel(level: string) {
  const labels: Record<string, string> = {
    ERROR: "Ошибка",
    WARNING: "Предупреждение",
    INFO: "Информация",
    DEBUG: "DEBUG",
  };
  return labels[level] ?? safeText(level);
}
function diagnosticsComponentLabel(component: string) {
  const labels: Record<string, string> = {
    web: "Веб-приложение",
    api: "API",
    worker: "Фоновая обработка",
  };
  return labels[component] ?? safeText(component);
}
function reportFileName() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `studio-diagnostics-${stamp}.md`;
}
async function diagnosticsReportBlob(
  filters: DiagnosticsFilters,
  csrf: string,
  onCsrf: (csrf: string) => void,
): Promise<Blob> {
  const body = JSON.stringify(reportPayload(filters));
  const send = (token: string) =>
    fetch(`/api/diagnostics/report.md`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": token },
      body,
    });
  let res = await send(csrf);
  if (
    !res.ok &&
    (res.status === 401 || res.status === 403 || res.status === 419)
  ) {
    const refreshed = await api<{ csrf_token: string }>("/auth/csrf", {
      method: "POST",
    });
    onCsrf(refreshed.csrf_token);
    res = await send(refreshed.csrf_token);
  }
  if (!res.ok)
    throw new Error("Не удалось подготовить Markdown-отчёт. Повторите позже.");
  return res.blob();
}
type DiagnosticsFilters = {
  days: string;
  level: string;
  component: string;
  eventCode: string;
  projectId: string;
  jobId: string;
};
function reportPayload(filters: DiagnosticsFilters) {
  const end = new Date();
  const days = Math.min(Math.max(Number(filters.days) || 1, 1), 7);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    level: filters.level || undefined,
    component: filters.component || undefined,
    event_code: filters.eventCode.trim() || undefined,
    project_id: filters.projectId.trim() || undefined,
    job_id: filters.jobId.trim() || undefined,
  };
}
const diagnosticsMetadataKeys = new Set([
  "source_count",
  "batch_position",
  "credential_selected",
  "attempt_number",
  "boundary",
  "duration_ms",
  "error_code",
  "retryable",
  "http_status_category",
  "output_count",
  "final_job_status",
  "endpoint_group",
]);
const pwaEventLabels: Record<string, string> = {
  PWA_APP_ERROR: "Ошибка веб-приложения",
  PWA_UNHANDLED_REJECTION: "Необработанная ошибка операции",
  PWA_API_REQUEST_FAILED: "Ошибка запроса к API",
  PWA_ROUTE_ERROR: "Ошибка раздела приложения",
  PWA_SERVICE_WORKER_ERROR: "Ошибка сервис-воркера",
};
const diagnosticsMetadataLabels: Record<string, string> = {
  boundary: "граница",
  duration_ms: "длительность, мс",
  error_code: "код ошибки",
  retryable: "повтор возможен",
  http_status_category: "категория HTTP",
  endpoint_group: "группа API",
};
function pwaEventLabel(code: string) {
  return pwaEventLabels[code] ?? null;
}
function diagnosticsMetadataLabel(key: string) {
  return diagnosticsMetadataLabels[key] ?? null;
}
function debugRemainingText(expiresAt?: string | null) {
  if (!expiresAt) return "—";
  const remaining = Math.max(0, Date.parse(expiresAt) - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function auditLabel(type: string) {
  const labels: Record<string, string> = {
    "google.connected": "Google Drive подключён",
    "google.disconnected": "Google Drive отключён",
    "google.oauth_started": "Начато подключение Google Drive",
    "credential.created": "Ключ создан",
    "credential.replaced": "Ключ заменён",
    "credential.revoked": "Ключ отозван",
    "credential.deleted": "Ключ удалён",
    "admin.bootstrap_created": "Администратор создан",
    "auth.login": "Вход выполнен",
    "auth.login_failed": "Неудачная попытка входа",
    "auth.logout": "Выход выполнен",
    "auth.sessions_revoked": "Другие сеансы завершены",
    "account.preferences_updated": "Настройки хранения обновлены",
    "project.created": "Проект создан",
    "project.updated": "Проект обновлён",
    "project.archived": "Проект архивирован",
    "project.output_folder.google_picker_set":
      "Папка проекта выбрана через Google Drive",
    "source.google_drive.created": "Источник Google Drive добавлен",
    "source.google_picker.created": "Источники выбраны через Google Drive",
    "source.local_upload.initiated": "Загрузка локального источника начата",
    "source.local_upload.completed": "Локальный источник загружен",
    "source.deleted": "Источник удалён",
    "job.created": "Задача создана",
    "job.batch_created": "Пакет задач создан",
    "job.cancelled": "Задача отменена",
    "job.cancel_requested": "Запрошена отмена задачи",
    "google.oauth_failed": "Подключение Google Drive не удалось",
  };
  return labels[type] ?? "Событие безопасности";
}
function SettingsPage({
  user,
  csrf,
  onCsrf,
  onLogout,
  oauthResult,
  section,
  onSectionChange,
}: {
  user: User;
  csrf: string;
  onCsrf: (csrf: string) => void;
  onLogout: () => void;
  oauthResult: GoogleOauthResult | null;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [events, setEvents] = useState<Audit[]>([]);
  const [googleConnection, setGoogleConnection] =
    useState<GoogleConnection | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleMessage, setGoogleMessage] = useState("");
  const [googleStarting, setGoogleStarting] = useState(false);
  const [accountPreferences, setAccountPreferences] =
    useState<AccountPreferences | null>(null);
  const [retentionSelection, setRetentionSelection] = useState("86400");
  const [retentionState, setRetentionState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionMessage, setRetentionMessage] = useState("");
  const [error, setError] = useState("");
  const [createCredentialOpen, setCreateCredentialOpen] = useState(false);
  const [replacingCredentialId, setReplacingCredentialId] = useState<
    string | null
  >(null);
  const loadGoogleConnection = () => {
    setGoogleLoading(true);
    setGoogleMessage("");
    api<GoogleConnection>("/google/connection")
      .then((r) => setGoogleConnection(r))
      .catch(() => {
        setGoogleConnection(null);
        setGoogleMessage("Google Drive сейчас недоступен.");
      })
      .finally(() => setGoogleLoading(false));
  };
  const loadAccountPreferences = () => {
    setRetentionState("loading");
    setRetentionMessage("");
    api<AccountPreferences>("/account/preferences")
      .then((preferences) => {
        if (
          !Array.isArray(preferences.allowed_source_retention_ttl_seconds) ||
          !preferences.allowed_source_retention_ttl_seconds.includes(
            preferences.source_retention_ttl_seconds,
          )
        ) {
          throw new Error("invalid account preferences");
        }
        setAccountPreferences(preferences);
        setRetentionSelection(
          String(preferences.source_retention_ttl_seconds),
        );
        setRetentionState("ready");
      })
      .catch(() => {
        setAccountPreferences(null);
        setRetentionState("error");
      });
  };
  const load = () => {
    api<{ credentials: Credential[] }>("/credentials").then((r) =>
      setCredentials(r.credentials),
    );
    api<{ events: Audit[] }>("/audit-events").then((r) => setEvents(r.events));
    loadGoogleConnection();
    loadAccountPreferences();
  };
  useEffect(load, []);
  const safeMutate = <T,>(path: string, options: RequestInit) =>
    csrfMutate<T>(path, csrf, onCsrf, options);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await safeMutate("/credentials", {
        method: "POST",
        body: JSON.stringify({
          provider: fd.get("provider"),
          label: fd.get("credential_label"),
          raw_value: fd.get("credential_raw_value"),
        }),
      });
      form.reset();
      setCreateCredentialOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }
  async function replace(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const selected = credentials.find((c) => c.id === id);
    if (!selected) return setError("Выберите ключ для замены.");
    try {
      await safeMutate(`/credentials/${id}/replace`, {
        method: "POST",
        body: JSON.stringify({
          provider: selected.provider,
          label: selected.label,
          raw_value: fd.get("replacement_credential_raw_value"),
        }),
      });
      form.reset();
      setReplacingCredentialId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }
  async function saveRetentionPreference(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const selected = Number(retentionSelection);
    if (
      !accountPreferences?.allowed_source_retention_ttl_seconds.includes(
        selected,
      )
    ) {
      setRetentionMessage("Выберите доступный срок хранения.");
      return;
    }
    setRetentionSaving(true);
    setRetentionMessage("");
    try {
      const preferences = await safeMutate<AccountPreferences>(
        "/account/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({ source_retention_ttl_seconds: selected }),
        },
      );
      setAccountPreferences(preferences);
      setRetentionSelection(
        String(preferences.source_retention_ttl_seconds),
      );
      setRetentionMessage("Срок хранения сохранён.");
    } catch {
      setRetentionMessage("Не удалось сохранить срок хранения.");
    } finally {
      setRetentionSaving(false);
    }
  }
  const action = async (path: string, method = "POST") => {
    setError("");
    try {
      await safeMutate(path, { method });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  };
  const connectGoogle = async () => {
    if (googleStarting) return;
    setGoogleStarting(true);
    setGoogleMessage("");
    try {
      const r = await safeMutate<GoogleOauthStart>("/google/oauth/start", {
        method: "POST",
      });
      window.location.assign(r.authorization_url);
    } catch {
      setGoogleMessage(
        "Не удалось начать подключение Google Drive. Попробуйте позже или проверьте настройки OAuth.",
      );
      setGoogleStarting(false);
    }
  };
  const disconnectGoogle = async () => {
    setGoogleMessage("");
    try {
      const r = await safeMutate<GoogleConnection>("/google/connection", {
        method: "DELETE",
      });
      setGoogleConnection(r);
    } catch {
      setGoogleMessage("Не удалось отключить Google Drive. Попробуйте позже.");
    }
  };
  const googleCanDisconnect = Boolean(
    googleConnection?.connected || googleConnection?.status === "revoked",
  );
  const oauthMessage =
    oauthResult === "connected"
      ? !googleLoading && googleConnection?.connected
        ? googleOauthMessages.connected
        : ""
      : oauthResult
        ? googleOauthMessages[oauthResult]
        : "";
  return (
    <section className="card wide">
      <h2>Настройки</h2>
      <div className="tabs" role="tablist" aria-label="Разделы настроек">
        <button
          type="button"
          role="tab"
          aria-selected={section === "account"}
          className={section === "account" ? "active" : ""}
          onClick={() => onSectionChange("account")}
        >
          Аккаунт
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "diagnostics"}
          className={section === "diagnostics" ? "active" : ""}
          onClick={() => onSectionChange("diagnostics")}
        >
          Диагностика
        </button>
      </div>
      {section === "diagnostics" ? (
        <DiagnosticsSettings csrf={csrf} onCsrf={onCsrf} auditEvents={events} />
      ) : (
        <>
          <h2>Настройки аккаунта</h2>
          {oauthMessage && (
            <p className="notice" role="status">
              {oauthMessage}
            </p>
          )}
          <section className="account-card">
            <div>
              <b>{user.email}</b>
              <span className="muted">{user.role}</span>
            </div>
            <button className="secondary" onClick={onLogout}>
              Выйти
            </button>
          </section>
          <h3>Хранение локальных файлов</h3>
          <section className="card retention-preferences">
            <p>
              Это срок хранения временной копии в приватном объектном
              хранилище (S3/R2) для новых файлов, загруженных с устройства.
              После срока копия удаляется. Ссылки на Google Drive и результаты
              Google Docs не затрагиваются. Уже загруженные файлы сохраняют
              текущую дату удаления.
            </p>
            {retentionState === "loading" && (
              <p role="status">Загружаем настройку хранения…</p>
            )}
            {retentionState === "error" && (
              <div className="error">
                <p>Не удалось загрузить настройку хранения.</p>
                <button type="button" onClick={loadAccountPreferences}>
                  Повторить
                </button>
              </div>
            )}
            {retentionState === "ready" && accountPreferences && (
              <form
                className="retention-preferences-form"
                aria-label="Настройка хранения локальных файлов"
                onSubmit={saveRetentionPreference}
              >
                <label>
                  Срок хранения
                  <select
                    aria-label="Срок хранения локальных файлов"
                    value={retentionSelection}
                    onChange={(event) => {
                      setRetentionSelection(event.target.value);
                      setRetentionMessage("");
                    }}
                  >
                    {accountPreferences.allowed_source_retention_ttl_seconds.map(
                      (seconds) => (
                        <option key={seconds} value={seconds}>
                          {retentionOptionLabel(seconds)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button className="primary" disabled={retentionSaving}>
                  {retentionSaving ? "Сохраняем…" : "Сохранить срок"}
                </button>
              </form>
            )}
            {retentionMessage && (
              <p role="status" className="notice">
                {retentionMessage}
              </p>
            )}
          </section>
          <h3>Ключи провайдеров</h3>
          <p className="notice">
            Ключи не сохраняются в браузере и никогда не отображаются обратно.
          </p>
          <button
            type="button"
            aria-expanded={createCredentialOpen}
            onClick={() => setCreateCredentialOpen((open) => !open)}
          >
            Добавить ключ
          </button>
          {createCredentialOpen && (
            <form className="inline" onSubmit={save} autoComplete="off">
              <select name="provider" aria-label="Провайдер">
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
              </select>
              <input
                name="credential_label"
                autoComplete="off"
                placeholder="Метка"
                required
              />
              <input
                name="credential_raw_value"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                placeholder="Новый ключ"
                required
              />
              <button className="primary">Создать</button>
              <button
                type="button"
                onClick={() => setCreateCredentialOpen(false)}
              >
                Отмена
              </button>
            </form>
          )}
          {error && <p className="error">{error}</p>}
          <div className="grid">
            {credentials.map((c) => (
              <article className="card" key={c.id}>
                <span className="tag">{c.provider}</span>
                <h3>{c.label}</h3>
                <p>
                  {c.status} · v{c.active_version ?? "—"} · {c.masked_value}
                </p>
                <p className="muted">
                  Отключение запрещает использовать ключ в задачах, но сохраняет
                  его версии. Удаление навсегда стирает сохранённые значения
                  ключа без возможности восстановления.
                </p>
                <div className="credential-actions">
                  <button
                    type="button"
                    onClick={() => setReplacingCredentialId(c.id)}
                  >
                    Заменить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        safeConfirm(
                          `Отключить ключ «${c.label}»? Он станет недоступен для новых и выполняющихся задач, но история версий сохранится.`,
                        )
                      )
                        void action(`/credentials/${c.id}/revoke`);
                    }}
                  >
                    Отключить
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (
                        safeConfirm(
                          `Удалить ключ «${c.label}» навсегда? Все сохранённые значения будут стёрты без возможности восстановления.`,
                        )
                      )
                        void action(`/credentials/${c.id}`, "DELETE");
                    }}
                  >
                    Удалить навсегда
                  </button>
                </div>
                {replacingCredentialId === c.id && (
                  <form
                    className="inline"
                    onSubmit={(event) => replace(event, c.id)}
                    aria-label={`Заменить ключ ${c.label}`}
                    autoComplete="off"
                  >
                    <input
                      name="replacement_credential_raw_value"
                      type="password"
                      autoComplete="new-password"
                      spellCheck={false}
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                      placeholder="Новый ключ для замены"
                      required
                    />
                    <button className="primary">Сохранить</button>
                    <button
                      type="button"
                      onClick={() => setReplacingCredentialId(null)}
                    >
                      Отмена
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
          <h3>Google Drive</h3>
          <p
            className={
              googleConnection?.connected && googleConnection.picker_ready
                ? "muted"
                : "notice"
            }
          >
            {googleLoading
              ? "Проверяем подключение Google Drive…"
              : googleConnection?.connected
                ? googleConnection.picker_ready
                  ? "Google Drive подключён. Актуальность доступа проверяется при каждом открытии Picker."
                  : googleConnection.reconnect_required ||
                      !googleConnection.picker_scope_ready
                    ? "Подключение Google Drive нужно обновить, чтобы выбирать файлы и папку результатов."
                    : "Google Drive подключён, но Google Picker пока не настроен."
                : "Подключите Google Drive, чтобы выбирать файлы и папку результатов."}
          </p>
          <article className="card">
            <span className="tag">Google Drive</span>
            {googleLoading ? (
              <p>Проверяем статус подключения…</p>
            ) : googleConnection?.connected ? (
              <>
                <h3>Google Drive подключён</h3>
                <p>
                  <b>{googleConnection.google_email ?? "—"}</b>
                </p>
                <p className="muted">
                  Подключён {formatTime(googleConnection.connected_at)}
                </p>
                <details className="technical-details">
                  <summary>Технические сведения</summary>
                  <dl className="meta technical-meta">
                    <dt>Статус</dt>
                    <dd>{googleConnection.status ?? "—"}</dd>
                    <dt>Разрешения</dt>
                    <dd>{googleConnection.scopes ?? "—"}</dd>
                    <dt>Отключено</dt>
                    <dd>{formatTime(googleConnection.revoked_at)}</dd>
                    <dt>Требуется переподключение</dt>
                    <dd>
                      {googleConnection.reconnect_required ? "да" : "нет"}
                    </dd>
                  </dl>
                </details>
                {googleConnection.reconnect_required && (
                  <div className="notice" role="status">
                    Для выбора файлов и папок нужно обновить подключение Google
                    Drive.
                  </div>
                )}
                {googleConnection.reconnect_required && (
                  <button
                    className="primary"
                    type="button"
                    disabled={googleStarting}
                    onClick={connectGoogle}
                  >
                    Переподключить Google Drive
                  </button>
                )}
              </>
            ) : googleConnection ? (
              <>
                <h3>Google Drive не подключён</h3>
                <p>
                  Подключите аккаунт, чтобы выбирать файлы и папку результатов.
                </p>
                {googleConnection.revoked_at && (
                  <p className="muted">
                    Статус: {googleConnection.status ?? "revoked"}
                  </p>
                )}
                <button
                  className="primary"
                  disabled={googleStarting}
                  onClick={connectGoogle}
                >
                  Подключить Google Drive
                </button>
              </>
            ) : (
              <p>Google Drive недоступен.</p>
            )}
            {googleCanDisconnect && (
              <button onClick={disconnectGoogle}>Отключить Google Drive</button>
            )}
            {googleMessage && <p className="error">{googleMessage}</p>}
          </article>
          <details className="card security-log">
            <summary className="summary-row">
              <span>Журнал безопасности</span>
            </summary>
            <ul>
              {events
                .filter((e) => e.type !== "auth.csrf_refreshed")
                .slice(0, 20)
                .map((e) => (
                  <li key={e.id}>
                    {auditLabel(e.type)} ·{" "}
                    {new Date(e.created_at).toLocaleString("ru-RU")}
                  </li>
                ))}
            </ul>
            <details>
              <summary>Технические события</summary>
              <ul>
                {events.slice(0, 20).map((e) => (
                  <li key={e.id}>
                    {e.type} · {new Date(e.created_at).toLocaleString("ru-RU")}
                  </li>
                ))}
              </ul>
            </details>
          </details>
        </>
      )}
    </section>
  );
}

function DiagnosticsSettings({
  csrf,
  onCsrf,
  auditEvents,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
  auditEvents: Audit[];
}) {
  const [system, setSystem] = useState<DiagnosticsSystem | null>(null);
  const [systemState, setSystemState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [filters, setFilters] = useState<DiagnosticsFilters>({
    days: "1",
    level: "",
    component: "",
    eventCode: "",
    projectId: "",
    jobId: "",
  });
  const [timeline, setTimeline] = useState<DiagnosticsEvent[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [eventsState, setEventsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [exportState, setExportState] = useState("");
  const [debugSession, setDebugSession] =
    useState<DiagnosticsDebugSession | null>(null);
  const [debugState, setDebugState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [debugActionState, setDebugActionState] = useState("");
  const [debugDuration, setDebugDuration] = useState("10");
  const [debugTick, setDebugTick] = useState(0);
  const debugRefreshInFlight = useRef(false);
  const expiredDebugRefreshRequested = useRef(false);
  const loadEvents = (cursor?: string) => {
    setEventsState("loading");
    const params = new URLSearchParams({ page_size: "25" });
    if (cursor) {
      params.set("cursor", cursor);
    } else {
      const payload = reportPayload(filters);
      params.set("start", payload.start);
      params.set("end", payload.end);
      if (payload.level) params.set("level", payload.level);
      if (payload.component) params.set("component", payload.component);
      if (payload.event_code) params.set("event_code", payload.event_code);
      if (payload.project_id) params.set("project_id", payload.project_id);
      if (payload.job_id) params.set("job_id", payload.job_id);
    }
    api<DiagnosticsEventsResponse>(`/diagnostics/events?${params.toString()}`)
      .then((r) => {
        setTimeline((current) =>
          cursor ? [...current, ...r.events] : r.events,
        );
        setPeriod(r.period);
        setNextCursor(r.next_cursor ?? null);
        setEventsState("ready");
      })
      .catch(() => {
        if (!cursor) setTimeline([]);
        setEventsState("error");
      });
  };
  useEffect(() => {
    api<DiagnosticsSystem>("/diagnostics/system")
      .then((r) => {
        setSystem(r);
        setSystemState("ready");
      })
      .catch(() => setSystemState("error"));
    loadEvents();
  }, []);
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTimeline([]);
    setNextCursor(null);
    loadEvents();
  };
  const updateFilter =
    (name: keyof DiagnosticsFilters) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFilters((current) => ({ ...current, [name]: event.target.value }));
  const loadDebugSession = (options: { keepReady?: boolean } = {}) => {
    if (debugRefreshInFlight.current) return;
    debugRefreshInFlight.current = true;
    if (!options.keepReady) setDebugState("loading");
    api<DiagnosticsDebugSession>("/diagnostics/debug-session")
      .then((status) => {
        expiredDebugRefreshRequested.current = false;
        setDebugSession(status);
        configurePwaDiagnosticsDebugState({
          active: status.active,
          expiresAt: status.expires_at,
        });
        setDebugState("ready");
      })
      .catch(() => {
        configurePwaDiagnosticsDebugState({ active: false });
        setDebugState("error");
      })
      .finally(() => {
        debugRefreshInFlight.current = false;
      });
  };
  useEffect(loadDebugSession, [csrf]);
  useEffect(() => {
    const timer = window.setInterval(
      () => setDebugTick((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const debugLocallyActive = Boolean(
    debugSession?.active &&
    debugSession.expires_at &&
    Date.parse(debugSession.expires_at) > Date.now(),
  );
  const activeDebugSession = debugLocallyActive ? debugSession : null;
  useEffect(() => {
    if (!debugSession?.active || !debugSession.expires_at) return;
    if (Date.parse(debugSession.expires_at) > Date.now()) return;
    configurePwaDiagnosticsDebugState({ active: false });
    setDebugSession((current) =>
      current ? { ...current, active: false } : current,
    );
    if (expiredDebugRefreshRequested.current) return;
    expiredDebugRefreshRequested.current = true;
    loadDebugSession({ keepReady: true });
  }, [debugTick, debugSession?.active, debugSession?.expires_at, csrf]);
  const startDebug = async () => {
    setDebugActionState("Включаем DEBUG…");
    try {
      const status = await csrfMutate<DiagnosticsDebugSession>(
        "/diagnostics/debug-session",
        csrf,
        onCsrf,
        {
          method: "POST",
          body: JSON.stringify({ duration_minutes: Number(debugDuration) }),
        },
      );
      setDebugSession(status);
      configurePwaDiagnosticsDebugState({
        active: status.active,
        expiresAt: status.expires_at,
      });
      setDebugActionState("DEBUG включена.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        loadDebugSession();
        setDebugActionState(
          "DEBUG уже активна в другой вкладке. Статус обновлён.",
        );
        return;
      }
      setDebugActionState("Не удалось включить DEBUG.");
    }
  };
  const stopDebug = async () => {
    setDebugActionState("Останавливаем DEBUG…");
    try {
      await csrfMutate<DiagnosticsDebugSession>(
        "/diagnostics/debug-session",
        csrf,
        onCsrf,
        { method: "DELETE" },
      );
      configurePwaDiagnosticsDebugState({ active: false });
      loadDebugSession();
      setDebugActionState("DEBUG остановлена.");
    } catch {
      setDebugActionState("Не удалось остановить DEBUG.");
    }
  };

  const exportReport = async () => {
    setExportState("Готовим Markdown-отчёт…");
    try {
      const blob = await diagnosticsReportBlob(filters, csrf, onCsrf);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = reportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportState("Markdown-отчёт скачан.");
    } catch (err) {
      setExportState(
        err instanceof Error
          ? err.message
          : "Не удалось скачать Markdown-отчёт.",
      );
    }
  };
  return (
    <div className="diagnostics-page">
      <h2>Диагностика</h2>
      <p className="notice">
        Раздел показывает только безопасные сведения для вашего аккаунта.
      </p>
      <section className="card" aria-labelledby="system-diagnostics-title">
        <h3 id="system-diagnostics-title">Состояние системы</h3>
        {systemState === "loading" && <p role="status">Загружаем состояние…</p>}
        {systemState === "error" && (
          <p className="error">
            Не удалось загрузить состояние. Повторите позже.
          </p>
        )}
        {systemState === "ready" && system && (
          <dl className="meta">
            <dt>Сборка веб-приложения</dt>
            <dd>{buildIdentityText(system.build?.web)}</dd>
            <dt>Сборка API</dt>
            <dd>{buildIdentityText(system.build?.api)}</dd>
            <dt>Сборка фоновой обработки</dt>
            <dd>{buildIdentityText(system.build?.worker)}</dd>
            <dt>Среда</dt>
            <dd>{safeText(system.environment ?? system.pwa_mode)}</dd>
            <dt>Google Drive подключён</dt>
            <dd>{boolText(system.google_drive?.connected)}</dd>
            <dt>Разрешение Google Drive получено</dt>
            <dd>{boolText(system.google_drive?.scope_ready)}</dd>
            <dt>Ключи готовы</dt>
            <dd>{boolText(system.provider_credentials?.ready)}</dd>
            <dt>Активных ключей</dt>
            <dd>{safeText(system.provider_credentials?.active_count)}</dd>
            <dt>Запись диагностики</dt>
            <dd>{boolText(system.diagnostics?.recording_enabled)}</dd>
            <dt>DEBUG-запись</dt>
            <dd>
              {diagnosticsDebugStateText(system.diagnostics?.debug_recording)}
            </dd>
            <dt>Хранение обычных событий</dt>
            <dd>{safeText(system.diagnostics?.retention_days)} дней</dd>
            <dt>Хранение DEBUG</dt>
            <dd>{safeText(system.diagnostics?.debug_retention_hours)} часов</dd>
            <dt>Максимум дней в отчёте</dt>
            <dd>{safeText(system.report_limits?.max_days)}</dd>
            <dt>Максимум событий в отчёте</dt>
            <dd>{safeText(system.report_limits?.max_timeline_events)}</dd>
          </dl>
        )}
      </section>
      <section className="card" aria-labelledby="timeline-title">
        <h3 id="timeline-title">События диагностики</h3>
        <div
          className="diagnostics-export"
          aria-labelledby="diagnostics-export-title"
        >
          <h4 id="diagnostics-export-title">Экспорт диагностики</h4>
          <p className="muted">
            Markdown-отчёт может включать безопасные события PWA, API и фоновой
            обработки согласно выбранным фильтрам. Аудит безопасности остаётся
            отдельным разделом и в этот отчёт не входит.
          </p>
          <button type="button" className="secondary" onClick={exportReport}>
            Скачать Markdown
          </button>
          {exportState && <p role="status">{exportState}</p>}
        </div>
        <form className="diagnostics-filters" onSubmit={applyFilters}>
          <label>
            Период
            <select value={filters.days} onChange={updateFilter("days")}>
              <option value="1">1 день</option>
              <option value="3">3 дня</option>
              <option value="7">7 дней</option>
            </select>
          </label>
          <label>
            Уровень
            <select value={filters.level} onChange={updateFilter("level")}>
              <option value="">Все</option>
              <option value="ERROR">Ошибка</option>
              <option value="WARNING">Предупреждение</option>
              <option value="INFO">Информация</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </label>
          <label>
            Компонент
            <select
              value={filters.component}
              onChange={updateFilter("component")}
            >
              <option value="">Все</option>
              <option value="web">Веб</option>
              <option value="api">API</option>
              <option value="worker">Фоновая обработка</option>
            </select>
          </label>
          <label>
            Код события
            <input
              value={filters.eventCode}
              onChange={updateFilter("eventCode")}
              placeholder="Например JOB_CREATED"
            />
          </label>
          <label>
            Проект
            <input
              value={filters.projectId}
              onChange={updateFilter("projectId")}
              placeholder="необязательно"
            />
          </label>
          <label>
            Задача
            <input
              value={filters.jobId}
              onChange={updateFilter("jobId")}
              placeholder="необязательно"
            />
          </label>
          <button type="submit">Применить фильтры</button>
        </form>
        {period && (
          <p className="muted">
            Период: {formatTime(period.start)} — {formatTime(period.end)}
          </p>
        )}
        {eventsState === "loading" && timeline.length === 0 && (
          <p role="status">Загружаем события…</p>
        )}
        {eventsState === "error" && (
          <div className="error">
            <p>Не удалось загрузить события.</p>
            <button type="button" onClick={() => loadEvents()}>
              Повторить
            </button>
          </div>
        )}
        {eventsState === "ready" && timeline.length === 0 && (
          <p className="notice">За выбранный период событий нет.</p>
        )}
        <ul className="diagnostics-events">
          {timeline.map((event) => (
            <li key={event.id} className="diagnostics-event">
              <div className="diagnostics-event-header">
                <strong>{event.event_code}</strong>
                {pwaEventLabel(event.event_code) && (
                  <span className="pwa-event-label">
                    {pwaEventLabel(event.event_code)}
                  </span>
                )}
                <span>·</span>
                <span>{diagnosticsLevelLabel(event.level)}</span>
                <span>·</span>
                <span>{diagnosticsComponentLabel(event.component)}</span>
                <span>·</span>
                <time dateTime={event.occurred_at}>
                  {formatTime(event.occurred_at)}
                </time>
                <span>·</span>
                <span>повторов: {event.occurrence_count ?? 1}</span>
              </div>
              {event.metadata && (
                <dl className="diagnostics-metadata">
                  {Object.entries(event.metadata)
                    .filter(([key]) => diagnosticsMetadataKeys.has(key))
                    .slice(0, 8)
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>
                          <span>{safeText(key)}</span>
                          {diagnosticsMetadataLabel(key) && (
                            <span className="metadata-local-label">
                              {" "}
                              · {diagnosticsMetadataLabel(key)}
                            </span>
                          )}
                        </dt>
                        <dd>{safeText(value)}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
        {nextCursor && (
          <button type="button" onClick={() => loadEvents(nextCursor)}>
            Показать ещё
          </button>
        )}
      </section>
      <section
        className="card pwa-diagnostics-card"
        aria-labelledby="pwa-diagnostics-title"
      >
        <h3 id="pwa-diagnostics-title">Диагностика PWA</h3>
        <p className="notice">
          Сбор DEBUG пока не включён по умолчанию. Браузер отправляет только
          закрытые безопасные события: ошибки приложения, необработанные
          операции, ошибки API, разделов и сервис-воркера.
        </p>
        {debugState === "loading" && <p role="status">Проверяем DEBUG…</p>}
        {debugState === "error" && (
          <div className="error">
            <p>Не удалось загрузить статус DEBUG.</p>
            <button type="button" onClick={() => loadDebugSession()}>
              Повторить
            </button>
          </div>
        )}
        {debugState === "ready" && activeDebugSession ? (
          <div className="debug-panel debug-active" role="status">
            <strong>DEBUG активна</strong>
            <p>Начало: {formatTime(activeDebugSession.started_at ?? null)}</p>
            <p>Истекает: {formatTime(activeDebugSession.expires_at ?? null)}</p>
            <p className="debug-countdown">
              Осталось: {debugRemainingText(activeDebugSession.expires_at)}
            </p>
            <button
              type="button"
              className="danger"
              disabled={debugActionState.endsWith("…")}
              onClick={stopDebug}
            >
              Остановить DEBUG
            </button>
          </div>
        ) : debugState === "ready" ? (
          <div className="debug-panel" role="status">
            <strong>DEBUG не активна</strong>
            <p className="muted">
              DEBUG временная, серверная и автоматически истекает. Браузер не
              продлевает срок.
            </p>
            <label className="debug-duration-label">
              Длительность DEBUG
              <select
                value={debugDuration}
                onChange={(event) => setDebugDuration(event.target.value)}
              >
                <option value="5">5 минут</option>
                <option value="10">10 минут</option>
                <option value="15">15 минут</option>
                <option value="30">30 минут</option>
              </select>
            </label>
            <button
              type="button"
              className="primary"
              disabled={debugActionState.endsWith("…")}
              onClick={startDebug}
            >
              Включить DEBUG
            </button>
          </div>
        ) : null}
        {debugActionState && (
          <p
            role="status"
            className={
              debugActionState.includes("Не удалось") ? "error" : "muted"
            }
          >
            {debugActionState}
          </p>
        )}
      </section>
      <section
        className="card security-log"
        aria-labelledby="security-audit-title"
      >
        <h3 id="security-audit-title">Аудит безопасности</h3>
        <p className="muted">Аудит отделён от диагностики транскрибации.</p>
        <ul>
          {auditEvents
            .filter((e) => e.type !== "auth.csrf_refreshed")
            .slice(0, 20)
            .map((e) => (
              <li key={e.id}>
                {auditLabel(e.type)} · {formatTime(e.created_at)}
              </li>
            ))}
        </ul>
        {auditEvents.length === 0 && (
          <p className="notice">Событий аудита нет.</p>
        )}
      </section>
    </div>
  );
}
function PlatformShell() {
  const [oauthResult] = useState<GoogleOauthResult | null>(() =>
    consumeGoogleOauthResult(),
  );
  const initialRoute = parsePlatformRoute();
  const [route, setRoute] = useState<PlatformRoute>(() =>
    oauthResult && initialRoute.page === "dashboard"
      ? { page: "settings", settingsSection: "account" }
      : initialRoute,
  );
  const page = route.page;
  const settingsSection = route.settingsSection;
  const [requestedProjectId, setRequestedProjectId] = useState<string | null>(
    null,
  );
  const [requestedProjectsView, setRequestedProjectsView] = useState<
    "browse" | "create" | null
  >(null);
  const [projectsOpened, setProjectsOpened] = useState(false);
  const navigate = (
    nextPage: Page,
    nextSettingsSection: SettingsSection = "account",
  ) => {
    if (nextPage === "projects") setProjectsOpened(true);
    const nextRoute = {
      page: nextPage,
      settingsSection:
        nextPage === "settings" ? nextSettingsSection : "account",
    };
    setRoute(nextRoute);
    pushPlatformRoute(nextRoute.page, nextRoute.settingsSection);
  };
  useEffect(() => {
    const handler = () => navigate("settings");
    window.addEventListener("studio:navigate-settings", handler);
    return () =>
      window.removeEventListener("studio:navigate-settings", handler);
  }, []);
  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = parsePlatformRoute();
      if (nextRoute.page === "projects") setProjectsOpened(true);
      setRoute(nextRoute);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    if (page === "projects") setProjectsOpened(true);
  }, [page]);
  const [session, setSession] = useState<SessionBootstrapState>({
    status: "checking",
    user: null,
    csrf: "",
    error: "",
  });
  const checkSession = () => {
    setSession({ status: "checking", user: null, csrf: "", error: "" });
    bootstrapSession()
      .then((result) => {
        if (!result) {
          setSession({ status: "anonymous", user: null, csrf: "", error: "" });
          return;
        }
        setSession({
          status: "authenticated",
          user: result.user,
          csrf: result.csrf,
          error: "",
        });
        updatePwaDiagnosticsCsrf(result.csrf);
        configurePwaDiagnosticsDebugState({ active: false });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setSession({ status: "anonymous", user: null, csrf: "", error: "" });
          return;
        }
        setSession({
          status: "error",
          user: null,
          csrf: "",
          error: "Не удалось проверить сессию. Повторите попытку.",
        });
      });
  };
  useEffect(checkSession, []);
  if (session.status === "checking")
    return (
      <main className="auth">
        <section className="card">
          <p role="status">Проверяем сессию…</p>
        </section>
      </main>
    );
  if (session.status === "error")
    return (
      <main className="auth">
        <section className="card">
          <p className="error">{session.error}</p>
          <button type="button" className="primary" onClick={checkSession}>
            Повторить
          </button>
        </section>
      </main>
    );
  if (session.status === "anonymous" || !session.user)
    return (
      <Login
        onLogin={(u, t) => {
          setSession({ status: "authenticated", user: u, csrf: t, error: "" });
          updatePwaDiagnosticsCsrf(t);
          configurePwaDiagnosticsDebugState({ active: false });
          navigate("dashboard");
        }}
      />
    );
  const user = session.user;
  const csrf = session.csrf;
  const logout = async () => {
    let token = csrf;
    if (!token) {
      const refreshed = await requestJson<{ csrf_token: string }>(
        "/auth/csrf",
        {
          method: "POST",
        },
      );
      token = refreshed.csrf_token;
      setSession((current) => ({ ...current, csrf: token }));
      updatePwaDiagnosticsCsrf(token);
      configurePwaDiagnosticsDebugState({ active: false });
    }
    await api("/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": token },
    }).catch(() => undefined);
    navigate("dashboard");
    setSession({ status: "anonymous", user: null, csrf: "", error: "" });
    clearPwaDiagnosticsSession();
  };
  return (
    <div className="shell">
      <PlatformSidebar
        page={page}
        onNavigate={(nextPage) => {
          navigate(nextPage);
          if (nextPage === "projects") {
            setRequestedProjectId(null);
            setRequestedProjectsView("browse");
          }
        }}
      />
      <main>
        {page === "dashboard" && (
          <OverviewPage
            onNavigate={(nextPage) => {
              if (nextPage === "projects") {
                setRequestedProjectId(null);
                setRequestedProjectsView("browse");
              }
              navigate(nextPage);
            }}
            onCreateProject={() => {
              setRequestedProjectsView("create");
              setRequestedProjectId(null);
              navigate("projects");
            }}
            onOpenProject={(projectId) => {
              setRequestedProjectsView("browse");
              setRequestedProjectId(projectId);
              navigate("projects");
            }}
          />
        )}
        {projectsOpened && (
          <div hidden={page !== "projects"}>
            <ProjectsPage
              csrf={csrf}
              onCsrf={(token) => {
                setSession((current) => ({ ...current, csrf: token }));
                updatePwaDiagnosticsCsrf(token);
              }}
              requestedProjectId={requestedProjectId}
              onRequestedProjectHandled={() => setRequestedProjectId(null)}
              requestedProjectsView={requestedProjectsView}
              onRequestedProjectsViewHandled={() =>
                setRequestedProjectsView(null)
              }
            />
          </div>
        )}
        {page === "settings" && (
          <SettingsPage
            user={user}
            csrf={csrf}
            onCsrf={(token) => {
              setSession((current) => ({ ...current, csrf: token }));
              updatePwaDiagnosticsCsrf(token);
            }}
            onLogout={logout}
            oauthResult={oauthResult}
            section={settingsSection}
            onSectionChange={(section) => navigate("settings", section)}
          />
        )}
      </main>
    </div>
  );
}
export default function App() {
  return <PlatformShell />;
}
