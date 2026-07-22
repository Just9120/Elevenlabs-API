import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Briefcase,
  Home,
  Settings,
} from "lucide-react";
import * as googlePicker from "./googlePicker";
import type { PickerSession } from "./googlePicker";
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
  isSupportedMediaFile,
  isSupportedSourceMimeType,
  normalizeSourceUploadPolicy,
  sourceUploadAccept,
  type SourceUploadPolicy,
} from "./sourceUploadPolicy";
import "./styles.css";

type User = { email: string; role: string };
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
type Source = {
  id: string;
  project_id: string;
  source_type: "local_upload" | "google_drive";
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  drive_file_url: string | null;
  upload_status: "pending" | "uploaded" | "deleted" | "expired" | "failed";
  uploaded_at: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
  created_at: string;
  updated_at: string;
};
type JobСтатус = "queued" | "processing" | "cancelled" | "failed" | "completed";
type JobSourceСтатус = "queued" | "skipped";
type JobSource = Source & {
  position: number;
  job_source_status: JobSourceСтатус;
};
type JobOutput = {
  source_id?: string;
  source_position: number | null;
  source_name: string | null;
  source_type: string | null;
  output_kind: string | null;
  transcript_standard: string | null;
  web_view_url: string | null;
  link_available: boolean;
  document_character_count: number | null;
  document_created_at: string | null;
  persisted_at: string | null;
};
type JobOutputsResponse = {
  job_id: string;
  job_status: JobСтатус;
  output_count: number;
  outputs: JobOutput[];
};
type JobOutputsState = {
  loading: boolean;
  error: string;
  data: JobOutputsResponse | null;
};
type OutputReconciliationResponse = { job_id: string; job_status: JobСтатус; available: boolean; counts: Record<string, number>; cases: { job_source_id: string; status: string; reason?: string | null; resolved: boolean; last_checked_at?: string | null }[] };
type JobRetryResponse = { job_id: string; job_status: JobСтатус; available: boolean; reason: string; attempt_count: number; max_attempts: number; missing_output_count: number; retry_safe_source_count: number };
type JobRetryState = { loading: boolean; posting: boolean; error: string; message: string; data: JobRetryResponse | null };
type OutputReconciliationCheckResponse = { job_id: string; checked: number; resolved: number; unresolved: number; conflicts: number };
type OutputReconciliationState = { loading: boolean; checking: boolean; error: string; message: string; data: OutputReconciliationResponse | null };
type JobOutputFolder = { name: string; web_view_url: string | null };
type VerifiedOutputFolder = {
  folder_id: string;
  name: string;
  web_view_url: string | null;
};
type ComposerRow = {
  id: string;
  source_id: string;
  output_folder: VerifiedOutputFolder | null;
  title: string;
};
type TranscriptionJob = {
  id: string;
  project_id: string;
  status: JobСтатус;
  title: string | null;
  provider: string | null;
  source_count: number;
  sources?: JobSource[];
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancel_requested_at: string | null;
  attempt_count: number;
  started_at: string | null;
  finished_at: string | null;
  error_code: string | null;
  error_message: string | null;
  output_folder?: JobOutputFolder | null;
};
type JobState = {
  loading: boolean;
  error: string;
  loaded: boolean;
  items: TranscriptionJob[];
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
function formatBytes(value: number | null) {
  if (value == null) return "не указан";
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}
function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}
function retentionOptionLabel(seconds: number) {
  const labels: Record<number, string> = {
    3600: "1 час",
    86400: "24 часа",
    259200: "3 дня",
    604800: "7 дней",
    2592000: "30 дней",
  };
  return labels[seconds] ?? `${seconds} сек.`;
}
function formatUploadLimit(value: number) {
  const mebibytes = value / 1024 / 1024;
  if (mebibytes >= 1)
    return `${Number.isInteger(mebibytes) ? mebibytes : mebibytes.toFixed(1)} МБ`;
  const kibibytes = value / 1024;
  if (kibibytes >= 1)
    return `${Number.isInteger(kibibytes) ? kibibytes : kibibytes.toFixed(1)} КБ`;
  return `${value} байт`;
}
function isUsableJobSource(source: Source) {
  const expiresAt = source.expires_at ? new Date(source.expires_at).getTime() : null;
  return (
    source.upload_status === "uploaded" &&
    !source.deleted_at &&
    (expiresAt == null || expiresAt > Date.now()) &&
    (source.source_type === "google_drive" ||
      source.source_type === "local_upload")
  );
}
function unusableJobSourceReason(source: Source) {
  if (source.deleted_at)
    return "Убранный из проекта файл нельзя добавить в задачу";
  if (source.expires_at && new Date(source.expires_at).getTime() <= Date.now())
    return "Срок хранения временной копии истёк";
  if (source.upload_status !== "uploaded")
    return "Файл ещё не готов для задачи";
  return "Тип файла не поддерживается для задачи";
}
function isSafeDisplayUrl(value: string | null) {
  return Boolean(
    value &&
    /^https?:\/\//i.test(value) &&
    !/\s|token|secret|cipher|presigned|s3:|r2:|key/i.test(value),
  );
}

function safeConfirm(message: string) {
  try {
    return window.confirm(message) !== false;
  } catch {
    return false;
  }
}

function ResourceExternalLink({
  href,
  label,
  ariaLabel,
}: {
  href: string;
  label: string;
  ariaLabel: string;
}) {
  return (
    <a
      className="button-like secondary resource-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
    >
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function jobTitle(job: TranscriptionJob) {
  return job.title?.trim() || `Транскрибация от ${formatTime(job.created_at)}`;
}
function safeJobSources(job: TranscriptionJob) {
  return [...(job.sources ?? [])].sort((a, b) => a.position - b.position);
}
function isApprovedOutputUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "docs.google.com" ||
        url.hostname === "drive.google.com")
    );
  } catch {
    return false;
  }
}
function outputSourceLabel(output: JobOutput) {
  const position =
    output.source_position == null ? "—" : String(output.source_position + 1);
  return `${position}. ${output.source_name || "Файл без имени"}`;
}

function sourceСтатусLabel(status: Source["upload_status"]) {
  const labels: Record<Source["upload_status"], string> = {
    pending: "Загружается",
    uploaded: "Готов",
    deleted: "Убран из проекта",
    expired: "Срок истёк",
    failed: "Ошибка",
  };
  return labels[status];
}

function jobСтатусLabel(status: JobСтатус) {
  const labels: Record<JobСтатус, string> = {
    queued: "В очереди",
    processing: "Обрабатывается",
    cancelled: "Отменена",
    failed: "Ошибка",
    completed: "Завершена",
  };
  return labels[status];
}
function credentialProfileLabel(c: Credential) {
  return c.active_version ? `${c.label} · v${c.active_version}` : c.label;
}
const ELEVENLABS_CREDENTIAL_SESSION_KEY = "studio.elevenlabsCredentialId";
const platformNav: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Обзор", icon: Home },
  { id: "projects", label: "Проекты", icon: Briefcase },
  { id: "settings", label: "Настройки", icon: Settings },
];
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
function Login({ onLogin }: { onLogin: (u: User, csrf: string) => void }) {
  const [bootstrap, setBootstrap] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ bootstrap_required: boolean }>("/auth/bootstrap-status")
      .then((r) => setBootstrap(r.bootstrap_required))
      .catch(() => setError("API временно недоступен."));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const ctx = await api<{ login_csrf_token: string }>(
        "/auth/login-context",
        { method: "POST" },
      );
      const r = await api<{ user: User; csrf_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: fd.get("email"),
          password: fd.get("password"),
          login_csrf_token: ctx.login_csrf_token,
        }),
      });
      onLogin(r.user, r.csrf_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти.");
    }
  }
  if (bootstrap)
    return (
      <main className="auth">
        <section className="card">
          <h1>Требуется первичная настройка</h1>
          <p className="notice">
            Публичной формы администратора нет. Обратитесь к оператору, чтобы
            выполнить bootstrap-admin команду на сервере.
          </p>
        </section>
      </main>
    );
  return (
    <main className="auth">
      <form className="card login" onSubmit={submit}>
        <p className="eyebrow">Studio account</p>
        <h1>Вход</h1>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary">Войти</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
async function csrfMutate<T>(
  path: string,
  csrf: string,
  onCsrf: (csrf: string) => void,
  options: RequestInit,
): Promise<T> {
  return mutateWithCsrfRetry<T>(path, csrf, onCsrf, options);
}
export const __appDiagnosticsTest = { api, csrfMutate };
function SourcesPanel({
  project,
  csrf,
  onCsrf,
  sources,
  onReload,
  onSourceRemoved,
  onError,
}: {
  project: Project;
  csrf: string;
  onCsrf: (csrf: string) => void;
  sources: {
    loading: boolean;
    error: string;
    loaded: boolean;
    items: Source[];
  };
  onReload: (projectId: string) => void;
  onSourceRemoved?: (sourceId: string) => void;
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
      await csrfMutate<{ ok: boolean }>(`/sources/${id}`, csrf, onCsrf, {
        method: "DELETE",
      });
      onSourceRemoved?.(id);
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
        queued_job_uses_source: "Сначала отмените ожидающие задачи, использующие этот файл.",
        processing_job_uses_source: "Дождитесь завершения или отмены текущей обработки.",
        retryable_failed_job_uses_source: "Источник нужен для доступного безопасного повтора задачи.",
      };
      onError(reason && messages[reason] ? messages[reason] : "Не удалось убрать файл из проекта.");
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
                : "Временная копия будет удалена из хранилища Studio."}
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

function newComposerRow(): ComposerRow {
  return {
    id: crypto.randomUUID(),
    source_id: "",
    output_folder: null,
    title: "",
  };
}
function composerSignature(rows: ComposerRow[], credentialId: string) {
  return JSON.stringify({
    provider_credential_id: credentialId || null,
    items: rows.map((row) => ({
      source_id: row.source_id,
      output_folder_id: row.output_folder?.folder_id ?? "",
      title: row.title.trim() || null,
    })),
  });
}
function makeIdempotencyKey() {
  return `batch-${crypto.randomUUID()}`;
}

type BatchCreateResponse = {
  jobs: TranscriptionJob[];
  created_count: number;
  replayed: boolean;
};
function mergeJobsWithBatchOrder(
  jobs: TranscriptionJob[],
  batchJobs: TranscriptionJob[],
) {
  if (batchJobs.length === 0) return jobs;
  const freshById = new Map(jobs.map((job) => [job.id, job]));
  const batchIds = new Set(batchJobs.map((job) => job.id));
  return [
    ...batchJobs.map((job) => freshById.get(job.id) ?? job),
    ...jobs.filter((job) => !batchIds.has(job.id)),
  ];
}

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
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialsError, setCredentialsError] = useState("");
  const [sourceUploadPolicy, setSourceUploadPolicy] =
    useState<SourceUploadPolicy | null>(null);
  const [sourceUploadPolicyError, setSourceUploadPolicyError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [batchJobs, setBatchJobs] = useState<TranscriptionJob[]>([]);
  const [pendingKey, setPendingKey] = useState<{
    signature: string;
    key: string;
  } | null>(null);
  const [detail, setDetail] = useState<
    Record<
      string,
      { loading: boolean; error: string; job: TranscriptionJob | null }
    >
  >({});
  const [outputs, setOutputs] = useState<Record<string, JobOutputsState>>({});
  const [reconciliations, setReconciliations] = useState<Record<string, OutputReconciliationState>>({});
  const [retries, setRetries] = useState<Record<string, JobRetryState>>({});
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
  const rowFolderPickerRef = useRef(false);
  const rowSourcePickerRef = useRef(false);
  useEffect(() => {
    setRows([newComposerRow()]);
    setCreatedSources([]);
    setRemovedSourceIds(new Set());
    setRowIntakeStatus({});
    setRowIntakeErrors({});
    setBatchJobs([]);
    setPendingKey(null);
    setMessage("");
  }, [project.id]);
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
  const signature = composerSignature(rows, selectedCredentialId);
  useEffect(() => {
    setPendingKey((current) =>
      current && current.signature !== signature ? null : current,
    );
  }, [signature]);
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
  const submitBlocker = submitting
    ? "Создание задач…"
    : credentialBlocker
      ? credentialBlocker
      : rows.length === 0
        ? "Добавьте хотя бы одну строку"
        : firstReadinessBlocker;
  const canSubmit =
    !submitting &&
    !credentialsLoading &&
    !credentialsError &&
    Boolean(selectedCredentialId) &&
    rows.length > 0 &&
    rowReadinessResults.every((result) => result.ready);

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
        next[targetIndex] = { ...next[targetIndex], source_id: first.id };
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
      const created = await csrfMutate<{ sources: Source[] }>(
        `/projects/${project.id}/sources/google-picker`,
        csrf,
        onCsrf,
        { method: "POST", body: JSON.stringify({ file_ids: fileIds }) },
      );
      const orderedSources = created.sources;
      if (orderedSources.some((source) => !source)) {
        throw new Error(
          "Не удалось сопоставить выбранные файлы с созданными источниками. Обновите файлы проекта и повторите выбор.",
        );
      }
      placeSourcesInRows(rowId, orderedSources as Source[]);
      setRowIntakeStatus((current) => ({
        ...current,
        [rowId]: `Добавлено файлов: ${orderedSources.length}.`,
      }));
      onReloadSources(project.id);
    } catch (err) {
      setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
      setRowIntakeErrors((current) => ({
        ...current,
        [rowId]:
          err instanceof ApiError && err.status === 422
            ? "Один или несколько файлов не поддерживаются. Выберите аудио, видео или OGG."
            : err instanceof Error
              ? err.message
              : "Не удалось выбрать файлы Google Drive.",
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
  function addRow(sourceId = "") {
    setRows((current) => {
      if (sourceId) {
        const emptyIndex = current.findIndex((row) => !row.source_id);
        if (emptyIndex >= 0) {
          return current.map((row, index) =>
            index === emptyIndex ? { ...row, source_id: sourceId } : row,
          );
        }
      }
      return [...current, { ...newComposerRow(), source_id: sourceId }];
    });
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
        err instanceof Error
          ? err.message
          : "Не удалось проверить папку результата.",
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
    const key =
      pendingKey?.signature === signature
        ? pendingKey.key
        : makeIdempotencyKey();
    setPendingKey({ signature, key });
    setSubmitting(true);
    try {
      const response = await batchMutateWithCsrfRetry<BatchCreateResponse>(
        `/projects/${project.id}/jobs/batch`,
        csrf,
        onCsrf,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({
            provider_credential_id: selectedCredentialId,
            items: rows.map((row) => ({
              source_id: row.source_id,
              output_folder_id: row.output_folder?.folder_id,
              title: row.title.trim() || null,
            })),
          }),
        },
      );
      setBatchJobs(response.jobs);
      setRows([newComposerRow()]);
      setPendingKey(null);
      setMessage(
        response.replayed
          ? `Повтор подтверждён: создано независимых задач: ${response.created_count}.`
          : `Создано независимых задач: ${response.created_count}.`,
      );
      onReloadJobs(project.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setMessage(
          "Конфликт повторной отправки. Проверьте строки и отправьте заново без автоматического повтора.",
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
      setSubmitting(false);
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
  function renderJobCard(job: TranscriptionJob) {
    const currentDetail = detail[job.id];
    const currentOutputs = outputs[job.id];
    const currentReconciliation = reconciliations[job.id];
    const detailedJob = currentDetail?.job;
    const terminal = ["completed", "failed", "cancelled"].includes(job.status);
    return (
      <article
        className={`source-card ${terminal ? "terminal-job" : ""}`}
        key={job.id}
      >
        <b>{jobTitle(job)}</b>
        <span>Статус: {jobСтатусLabel(job.status)}</span>
        <span>Файлов: {job.source_count}</span>
        <span>Создана: {formatTime(job.created_at)}</span>
        {job.output_folder && (
          <span>
            Папка результата: {job.output_folder.name || "Папка Google Drive"}
          </span>
        )}
        {job.output_folder?.web_view_url &&
          isApprovedOutputUrl(job.output_folder.web_view_url) && (
            <ResourceExternalLink
              href={job.output_folder.web_view_url}
              label="Открыть папку результата"
              ariaLabel="Открыть папку результата в Google Drive в новой вкладке"
            />
          )}
        {job.status === "processing" && job.cancel_requested_at && (
          <span>Отмена запрошена: {formatTime(job.cancel_requested_at)}</span>
        )}
        {job.error_message && <span>Ошибка: {job.error_message}</span>}
        <div className="job-actions">
          <button type="button" onClick={() => void loadDetail(job.id)}>
            Открыть
          </button>
          {job.status === "queued" && (
            <button type="button" onClick={() => void cancelJob(job.id)}>
              Отменить
            </button>
          )}
          {job.status === "processing" && !job.cancel_requested_at && (
            <button type="button" onClick={() => void cancelJob(job.id)}>
              Запросить отмену
            </button>
          )}
          {job.status === "processing" && job.cancel_requested_at && (
            <span>Отмена запрошена</span>
          )}
        </div>
        {currentDetail?.loading && (
          <p role="status">Загрузка деталей задачи…</p>
        )}
        {currentDetail?.error && <p className="error">{currentDetail.error}</p>}
        {currentOutputs?.loading && <p role="status">Загрузка результатов…</p>}
        {currentOutputs?.error && (
          <p className="error">{currentOutputs.error}</p>
        )}
        {currentReconciliation?.data?.available && (
          <section className="notice" aria-label={`Output reconciliation ${job.id}`}>
            <b>Требуется проверка результата Google Docs</b>
            <p>Reconciliation не создаёт документ заново и запускается только по нажатию.</p>
            <button type="button" disabled={currentReconciliation.checking} onClick={() => void checkReconciliation(job.id)}>
              {currentReconciliation.checking ? "Проверяем Google Drive…" : "Проверить созданный документ в Google Drive"}
            </button>
            {currentReconciliation.message && <p role="status">{currentReconciliation.message}</p>}
            {currentReconciliation.error && <p className="error">{currentReconciliation.error}</p>}
          </section>
        )}
        {currentOutputs?.data && (
          <section aria-label={`Результаты ${currentOutputs.data.job_id}`}>
            <h5>Результаты</h5>
            <p>
              Состояние задачи: {jobСтатусLabel(currentOutputs.data.job_status)}
            </p>
            <p>Результатов: {currentOutputs.data.output_count}</p>
            {currentOutputs.data.output_count === 0 && (
              <p className="notice">Результаты пока не созданы.</p>
            )}
            {currentOutputs.data.outputs.map((output, index) => {
              const approvedLink =
                output.link_available === true &&
                isApprovedOutputUrl(output.web_view_url);
              return (
                <article
                  className="source-card"
                  key={`${job.id}-output-${index}`}
                >
                  <b>{outputSourceLabel(output)}</b>
                  <span>Тип файла: {output.source_type || "не указан"}</span>
                  <span>
                    Тип результата: {output.output_kind || "не указан"}
                  </span>
                  <span>
                    Формат: {output.transcript_standard || "не указан"}
                  </span>
                  <span>
                    Символов: {output.document_character_count ?? "—"}
                  </span>
                  <span>Создан: {formatTime(output.document_created_at)}</span>
                  <span>Сохранён: {formatTime(output.persisted_at)}</span>
                  {approvedLink ? (
                    <ResourceExternalLink
                      href={output.web_view_url ?? ""}
                      label="Открыть документ"
                      ariaLabel="Открыть документ"
                    />
                  ) : (
                    <span>Ссылка недоступна</span>
                  )}
                </article>
              );
            })}
          </section>
        )}
        {detailedJob && (
          <section aria-label={`Job detail ${detailedJob.id}`}>
            <p>UUID: {detailedJob.id}</p>
            <h5>Папка результата</h5>
            {detailedJob.output_folder ? (
              <p>
                {detailedJob.output_folder.name || "Папка Google Drive"}{" "}
                {isSafeDisplayUrl(detailedJob.output_folder.web_view_url) && (
                  <ResourceExternalLink
                    href={detailedJob.output_folder.web_view_url ?? ""}
                    label="Открыть папку результата"
                    ariaLabel="Открыть папку результата в Google Drive в новой вкладке"
                  />
                )}
              </p>
            ) : (
              <p className="notice">Папка результата не задана.</p>
            )}

            {detailedJob.status === "failed" && (() => {
              const retry = retries[detailedJob.id];
              const reason = retry?.data?.reason;
              const unavailable = reason === "provider_outcome_uncertain" ? "Повтор недоступен: результат внешнего вызова не определён" : reason === "output_reconciliation_required" ? "Требуется проверка созданного документа" : reason === "attempt_limit_reached" ? "Достигнут предел попыток" : reason && reason !== "available" ? "Повтор недоступен" : "";
              return <div className="resource-actions" aria-label="Safe retry action">
                {retry?.data?.available ? <button type="button" onClick={() => void retryJob(detailedJob.id)} disabled={retry.posting}>Повторить безопасную обработку</button> : unavailable ? <span className="notice">{unavailable}</span> : null}
                {retry?.message && <span>{retry.message}</span>}
                {retry?.error && <span className="error">{retry.error}</span>}
              </div>;
            })()}
            <h5>Файлы задачи</h5>
            {safeJobSources(detailedJob).map((source) => (
              <article
                className="source-card"
                key={`${detailedJob.id}-${source.id}`}
              >
                <b>
                  {source.position + 1}. {source.original_filename}
                </b>
                <span>Статус файла: {source.job_source_status}</span>
                <span>Размер: {formatBytes(source.size_bytes)}</span>
                {isSafeDisplayUrl(source.drive_file_url) && (
                  <div className="resource-actions">
                    <ResourceExternalLink
                      href={source.drive_file_url ?? ""}
                      label="Открыть файл в Google Drive"
                      ariaLabel="Открыть файл в Google Drive в новой вкладке"
                    />
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </article>
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
          <button type="button" className="secondary" onClick={() => addRow()}>
            Добавить строку
          </button>
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
                  className="composer-row"
                  key={row.id}
                  aria-label={`Задача ${index + 1}`}
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
                            updateRow(row.id, { source_id: e.target.value });
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
                      Название
                      <input
                        value={row.title}
                        onChange={(e) =>
                          updateRow(row.id, { title: e.target.value })
                        }
                        maxLength={160}
                        placeholder="Необязательно"
                        aria-label={`Название задачи для строки ${index + 1}`}
                      />
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
        <div className="composer-footer">
          <div>
            <b>Строк: {rows.length}</b>
            <span>
              Готово: {completeRowCount} из {rows.length}
            </span>
            {submitBlocker && <span>{submitBlocker}</span>}
          </div>
          <button className="primary" disabled={!canSubmit}>
            {submitting ? "Создание задач…" : `Создать задачи (${rows.length})`}
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
                row.source_id === sourceId ? { ...row, source_id: "" } : row,
              ),
            );
            setMessage("Файл убран из проекта.");
          }}
          onError={onError}
        />
      </details>
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
  requestedCreateProject,
  onRequestedCreateProjectHandled,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
  requestedProjectId: string | null;
  onRequestedProjectHandled: () => void;
  requestedCreateProject: boolean;
  onRequestedCreateProjectHandled: () => void;
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
    if (!requestedCreateProject) return;
    setCreateOpen(true);
    onRequestedCreateProjectHandled();
  }, [requestedCreateProject, onRequestedCreateProjectHandled]);
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
              Выбранный срок применяется к новым файлам после завершения
              загрузки. Уже загруженные файлы сохраняют текущую дату удаления.
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
                <div className="credential-actions">
                  <button
                    type="button"
                    onClick={() => setReplacingCredentialId(c.id)}
                  >
                    Заменить
                  </button>
                  <button onClick={() => action(`/credentials/${c.id}/revoke`)}>
                    Отозвать
                  </button>
                  <button
                    className="danger"
                    onClick={() => action(`/credentials/${c.id}`, "DELETE")}
                  >
                    Удалить
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
          <p className="notice">
            Подключите Google Drive, чтобы выбирать файлы и папку результатов.
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
            <dt>Google Drive готов</dt>
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
  const [requestedCreateProject, setRequestedCreateProject] = useState(false);
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
    setSession({ status: "anonymous", user: null, csrf: "", error: "" });
    clearPwaDiagnosticsSession();
  };
  return (
    <div className="shell">
      <aside className="app-sidebar">
        <div className="brand">
          Studio PWA<span>Транскрибация</span>
        </div>
        <nav className="app-nav" aria-label="Основная навигация">
          {platformNav.map(({ id, label, icon: Icon }) => (
            <button
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => {
                navigate(id);
                if (id === "projects") {
                  setRequestedProjectId(null);
                  setRequestedCreateProject(false);
                }
              }}
              key={id}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        {page === "dashboard" && (
          <OverviewPage
            onNavigate={navigate}
            onCreateProject={() => {
              setRequestedCreateProject(true);
              setRequestedProjectId(null);
              navigate("projects");
            }}
            onOpenProject={(projectId) => {
              setRequestedCreateProject(false);
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
              requestedCreateProject={requestedCreateProject}
              onRequestedCreateProjectHandled={() =>
                setRequestedCreateProject(false)
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
