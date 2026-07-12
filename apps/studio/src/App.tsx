import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  ClipboardList,
  Home,
  PlusCircle,
  Settings,
} from "lucide-react";
import { buildSegmentPlan, hasSegmentErrors, type Segment } from "./segments";
import * as googlePicker from "./googlePicker";
import type { PickerSession } from "./googlePicker";
import "./styles.css";

// Platform mode is selected at build time by VITE_STUDIO_PLATFORM_MODE.
const platformMode = import.meta.env.VITE_STUDIO_PLATFORM_MODE === "platform";
const appUrl =
  import.meta.env.VITE_APP_PUBLIC_URL ?? "https://studio.librechat.online";
type Page = "dashboard" | "projects" | "new" | "jobs" | "settings";
type User = { email: string; role: string };
type Credential = {
  id: string;
  provider: "elevenlabs" | "openai";
  label: string;
  status: string;
  masked_value?: string;
  active_version?: number;
};
type Audit = { id: string; type: string; created_at: string };
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
  drive_file_id: string | null;
  drive_file_url: string | null;
  upload_status: "pending" | "uploaded" | "deleted" | "expired" | "failed";
  uploaded_at: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
  created_at: string;
  updated_at: string;
};
type JobStatus = "queued" | "processing" | "cancelled" | "failed" | "completed";
type JobSourceStatus = "queued" | "skipped";
type JobSource = Source & {
  position: number;
  job_source_status: JobSourceStatus;
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
  job_status: JobStatus;
  output_count: number;
  outputs: JobOutput[];
};
type JobOutputsState = {
  loading: boolean;
  error: string;
  data: JobOutputsResponse | null;
};
type TranscriptionJob = {
  id: string;
  project_id: string;
  status: JobStatus;
  title: string | null;
  provider: string | null;
  provider_credential_id: string | null;
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
const LOCAL_UPLOAD_LIMIT_BYTES = 536870912;
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
function isUsableJobSource(source: Source) {
  return (
    source.upload_status === "uploaded" &&
    !source.deleted_at &&
    (source.source_type === "google_drive" ||
      source.source_type === "local_upload")
  );
}
function unusableJobSourceReason(source: Source) {
  if (source.deleted_at) return "Удалённый source нельзя добавить в job";
  if (source.upload_status !== "uploaded") return "Source ещё не готов для job";
  return "Source type не поддерживается для job";
}
function isSafeDisplayUrl(value: string | null) {
  return Boolean(
    value &&
    /^https?:\/\//i.test(value) &&
    !/\s|token|secret|cipher|presigned|s3:|r2:|key/i.test(value),
  );
}
function jobTitle(job: TranscriptionJob) {
  return job.title?.trim() || `Job ${job.id}`;
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
  return `${position}. ${output.source_name || "Source без имени"}`;
}
function jobStatusLabel(status: JobStatus) {
  const labels: Record<JobStatus, string> = {
    queued: "Queued",
    processing: "В обработке",
    cancelled: "Cancelled · terminal",
    failed: "Failed · safe error metadata only",
    completed: "Completed",
  };
  return labels[status];
}
function credentialDisplay(c: Credential) {
  return [
    c.provider,
    c.label,
    c.masked_value,
    c.active_version ? `v${c.active_version}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
function isSupportedMediaFile(file: File) {
  return (
    file.type.startsWith("audio/") ||
    file.type.startsWith("video/") ||
    file.type === "application/ogg"
  );
}
const nav: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Панель", icon: Home },
  { id: "projects", label: "Проекты", icon: Briefcase },
  { id: "new", label: "Новая транскрибация", icon: PlusCircle },
  { id: "jobs", label: "Задачи", icon: ClipboardList },
  { id: "settings", label: "Настройки", icon: Settings },
];
const demoProjects = [
  "Интервью продукта — демо",
  "Подкаст о локализации — демо",
  "Исследование звонков — демо",
];
const demoJobs = [
  { title: "Демо: ожидание серверной очереди", state: "Прототип" },
  { title: "Демо: проверка сегментов", state: "UI-only" },
];
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  if (!res.ok)
    throw new Error(
      res.status === 429
        ? "Слишком много попыток. Попробуйте позже."
        : "Операция не выполнена. Проверьте данные и повторите.",
    );
  return res.json();
}
function NewTranscription() {
  const [file, setFile] = useState<File | null>(null);
  const [segments, setSegments] = useState<Segment[]>([
    { id: crypto.randomUUID(), title: "", end: "" },
  ]);
  const plan = useMemo(() => buildSegmentPlan(segments), [segments]);
  const invalid = hasSegmentErrors(segments);
  return (
    <section className="card wide">
      <p className="eyebrow">Локально в браузере</p>
      <h2>Новая транскрибация</h2>
      <p className="notice">
        Файл не загружается на сервер. Provider calls, Google Drive/Docs и
        серверные задачи появятся позже.
      </p>
      <label className="drop">
        Выберите audio/video файл
        <input
          type="file"
          accept="audio/*,video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <dl className="meta">
          <dt>Файл</dt>
          <dd>{file.name}</dd>
          <dt>Размер</dt>
          <dd>{(file.size / 1024 / 1024).toFixed(2)} MB</dd>
          <dt>Тип</dt>
          <dd>{file.type || "не указан браузером"}</dd>
        </dl>
      )}
      <div className="builder">
        <h3>Сегменты будущих документов</h3>
        {segments.map((s, i) => (
          <div className="segment" key={s.id}>
            <strong>Часть {i + 1}</strong>
            <label>
              Название Google Doc (прототип)
              <input
                value={s.title}
                onChange={(e) =>
                  setSegments((v) =>
                    v.map((x) =>
                      x.id === s.id ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
                placeholder={`Часть ${i + 1}`}
              />
            </label>
            {i < segments.length - 1 ? (
              <label>
                Конец части
                <input
                  value={s.end}
                  onChange={(e) =>
                    setSegments((v) =>
                      v.map((x) =>
                        x.id === s.id ? { ...x, end: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="MM:SS"
                  aria-invalid={Boolean(plan[i]?.error)}
                />
              </label>
            ) : (
              <span className="pill">До конца записи</span>
            )}
            <button
              type="button"
              onClick={() =>
                setSegments((v) => [
                  ...v,
                  { id: crypto.randomUUID(), title: "", end: "" },
                ])
              }
            >
              Добавить часть
            </button>
            {plan[i]?.error && <p className="error">{plan[i].error}</p>}
          </div>
        ))}
      </div>
      <ol className="timeline">
        {plan.map((p) => (
          <li key={p.index}>
            <b>{p.title}</b>
            <span>
              {p.start} → {p.endLabel}
            </span>
          </li>
        ))}
      </ol>
      <button className="primary" disabled={!file || invalid}>
        Подготовить черновик задачи
      </button>
    </section>
  );
}
function StaticShell() {
  const [page, setPage] = useState<Page>("dashboard");
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          Studio PWA<span>UI foundation</span>
        </div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
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
          <section className="hero">
            <p className="eyebrow">Русскоязычная Studio</p>
            <h1>Панель готова к установке</h1>
            <p>
              Это статический PWA-фундамент: app shell и прототипы будущих
              сценариев без входа, API, транскрибации и интеграций.
            </p>
            <button className="primary" onClick={() => setPage("new")}>
              Создать черновик
            </button>
          </section>
        )}
        {page === "projects" && (
          <section className="grid">
            <h2>Проекты</h2>
            {demoProjects.map((p) => (
              <article className="card" key={p}>
                <span className="tag">Демо-данные</span>
                <h3>{p}</h3>
                <p>Клиентский прототип, не связан с Drive или manifest.</p>
              </article>
            ))}
          </section>
        )}
        {page === "new" && <NewTranscription />}
        {page === "jobs" && (
          <section className="grid">
            <h2>Задачи</h2>
            {demoJobs.map((j) => (
              <article className="card" key={j.title}>
                <span className="tag">{j.state}</span>
                <h3>{j.title}</h3>
                <p>Реальная очередь и provider processing ещё не подключены.</p>
              </article>
            ))}
          </section>
        )}
        {page === "settings" && (
          <section className="card wide">
            <h2>Настройки</h2>
            <p>Публичный URL приложения:</p>
            <code>{appUrl}</code>
            <p className="notice">
              Статический режим не обращается к `/api` и не требует PostgreSQL,
              Redis или секретов.
            </p>
          </section>
        )}
      </main>
    </div>
  );
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
  try {
    return await api<T>(path, {
      ...options,
      headers: { "x-csrf-token": csrf, ...(options.headers ?? {}) },
    });
  } catch {
    const refreshed = await api<{ csrf_token: string }>("/auth/csrf", {
      method: "POST",
    });
    onCsrf(refreshed.csrf_token);
    return api<T>(path, {
      ...options,
      headers: {
        "x-csrf-token": refreshed.csrf_token,
        ...(options.headers ?? {}),
      },
    });
  }
}
function SourcesPanel({
  project,
  csrf,
  onCsrf,
  sources,
  googleConnection,
  pickerBusy,
  setPickerBusy,
  onReload,
  onError,
}: {
  project: Project;
  csrf: string;
  onCsrf: (csrf: string) => void;
  sources: { loading: boolean; error: string; loaded: boolean; items: Source[] };
  googleConnection: GoogleConnection | null;
  pickerBusy: boolean;
  setPickerBusy: (busy: boolean) => void;
  onReload: (projectId: string) => void;
  onError: (message: string) => void;
}) {
  const [uploadState, setUploadState] = useState("");
  const [pickerState, setPickerState] = useState("");
  const [pickerError, setPickerError] = useState("");
  const sourcePickerOpeningRef = useRef(false);
  const pickerReady = Boolean(googleConnection?.picker_ready);
  async function pickerSession() {
    return csrfMutate<PickerSession>("/google/picker/session", csrf, onCsrf, {
      method: "POST",
    });
  }
  async function chooseDriveSources() {
    if (pickerBusy || sourcePickerOpeningRef.current) return;
    sourcePickerOpeningRef.current = true;
    setPickerBusy(true);
    setPickerError("");
    setPickerState("Открываем Google Drive Picker…");
    try {
      const session = await pickerSession();
      const result = await googlePicker.openGooglePicker("sources", session);
      if (result.action === "cancel") {
        setPickerState("Выбор файлов отменён.");
        return;
      }
      if (result.action === "error") {
        setPickerState("");
        setPickerError(result.message);
        return;
      }
      const fileIds = result.docs.map((doc) => doc.id);
      if (fileIds.length === 0) {
        setPickerState("Google Picker не вернул файлы.");
        return;
      }
      const created = await csrfMutate<{ sources: Source[] }>(
        `/projects/${project.id}/sources/google-picker`,
        csrf,
        onCsrf,
        { method: "POST", body: JSON.stringify({ file_ids: fileIds }) },
      );
      setPickerState(`Добавлено sources: ${created.sources.length}.`);
      onReload(project.id);
    } catch (err) {
      setPickerState("");
      onError(err instanceof Error ? err.message : "Не удалось выбрать файлы Google Drive.");
    } finally {
      sourcePickerOpeningRef.current = false;
      setPickerBusy(false);
    }
  }
  async function uploadLocal(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return onError("Выберите audio/video файл для загрузки.");
    if (!isSupportedMediaFile(file)) return onError("Поддерживаются только audio/video файлы или OGG.");
    if (file.size <= 0) return onError("Файл пустой. Выберите другой source файл.");
    if (file.size > LOCAL_UPLOAD_LIMIT_BYTES) return onError("Файл больше 512 MB. Выберите меньший временный source файл.");
    try {
      setUploadState("Подготовка upload…");
      const initiated = await csrfMutate<UploadInit>(`/projects/${project.id}/sources/local-upload/initiate`, csrf, onCsrf, { method: "POST", body: JSON.stringify({ original_filename: file.name, mime_type: file.type || "application/octet-stream", size_bytes: file.size }) });
      setUploadState("Загрузка во временное хранилище…");
      const put = await fetch(initiated.upload.url, { method: initiated.upload.method, headers: initiated.upload.headers, body: file });
      if (!put.ok) throw new Error("Не удалось загрузить файл во временное хранилище. Проверьте CORS/bucket policy и повторите.");
      setUploadState("Подтверждение upload…");
      await csrfMutate<Source>(`/sources/${initiated.source_id}/local-upload/complete`, csrf, onCsrf, { method: "POST" });
      setUploadState("Файл загружен и готов как временный source.");
      onReload(project.id);
    } catch (err) {
      setUploadState("Ошибка upload.");
      onError(err instanceof Error ? err.message : "Не удалось загрузить локальный source файл.");
    }
  }
  async function deleteSource(id: string) {
    try { await csrfMutate<{ ok: boolean }>(`/sources/${id}`, csrf, onCsrf, { method: "DELETE" }); onReload(project.id); }
    catch (err) { onError(err instanceof Error ? err.message : "Не удалось удалить source."); }
  }
  return (
    <section className="sources" aria-label={`Sources ${project.title}`}>
      <h4>Sources проекта</h4>
      {sources.loading && <p role="status">Загрузка sources…</p>}
      {sources.error && <p className="error">{sources.error}</p>}
      {sources.loaded && !sources.loading && sources.items.length === 0 && <p className="notice">Source records пока не добавлены.</p>}
      {sources.items.map((source) => (
        <article className="source-card" key={source.id}>
          <b>{source.original_filename}</b><span>{source.source_type === "google_drive" ? "Google Drive metadata" : "Local temporary upload"}</span>
          <span>Статус: {source.upload_status}</span><span>Размер: {formatBytes(source.size_bytes)}</span><span>MIME: {source.mime_type || "не указан"}</span>
          <span>Uploaded: {formatTime(source.uploaded_at)}</span><span>Expires: {formatTime(source.expires_at)}</span><span>Deleted: {formatTime(source.deleted_at)}</span>
          {source.delete_reason && <span>Reason: {source.delete_reason}</span>}
          {isSafeDisplayUrl(source.drive_file_url) && <a href={source.drive_file_url ?? undefined}>Открыть в Google Drive</a>}
          <button type="button" onClick={() => deleteSource(source.id)}>Удалить source</button>
        </article>
      ))}
      <section className="source-form" aria-label="Google Drive Picker sources">
        <h5>Google Drive</h5>
        {!googleConnection?.connected && <p className="notice">Google Drive не подключён.</p>}
        {googleConnection?.connected && googleConnection.reconnect_required && <p className="notice">Google Drive подключён, но для выбора файлов требуется повторная авторизация с правом drive.file. Откройте Настройки и нажмите «Переподключить Google Drive».</p>}
        {googleConnection?.connected && !googleConnection.picker_configured && <p className="notice">Google Picker временно недоступен: runtime-настройки не завершены.</p>}
        {pickerReady && <p className="notice">Google Drive подключён. Файлы выбираются через официальный Picker; Studio сохранит metadata только после server-side проверки.</p>}
        <button type="button" className="primary" disabled={!pickerReady || pickerBusy} onClick={chooseDriveSources}>Выбрать файлы из Google Drive</button>
        {pickerState && <p role="status">{pickerState}</p>}
        {pickerError && <p className="error">{pickerError}</p>}
      </section>
      <label className="drop compact">Загрузить временный локальный audio/video source<input type="file" accept="audio/*,video/*,.ogg,.oga,application/ogg" onChange={uploadLocal} /></label>
      {uploadState && <p role="status">{uploadState}</p>}
    </section>
  );
}

function JobsPanel({
  project,
  csrf,
  onCsrf,
  jobs,
  sources,
  onLoadSources,
  onReloadJobs,
}: {
  project: Project;
  csrf: string;
  onCsrf: (csrf: string) => void;
  jobs: JobState;
  sources: typeof emptySourceState;
  onLoadSources: (projectId: string) => void;
  onReloadJobs: (projectId: string) => void;
}) {
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialsError, setCredentialsError] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<
    Record<
      string,
      { loading: boolean; error: string; job: TranscriptionJob | null }
    >
  >({});
  const [outputs, setOutputs] = useState<Record<string, JobOutputsState>>({});
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
          setCredentialsError(
            "Credentials сейчас недоступны. Job можно создать без credential.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCredentialsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const activeCredentials = credentials.filter(
    (credential) => credential.status === "active",
  );
  const usableSourceCount = sources.loaded
    ? sources.items.filter(isUsableJobSource).length
    : 0;
  const selectedCredential = activeCredentials.find(
    (credential) => credential.id === selectedCredentialId,
  );
  const usableSelected = selectedSourceIds.filter((id) =>
    sources.items.some(
      (source) => source.id === id && isUsableJobSource(source),
    ),
  );
  async function createJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    if (!sources.loaded) {
      setMessage("Сначала загрузите sources проекта.");
      return;
    }
    if (usableSelected.length === 0) {
      setMessage("Выберите хотя бы один готовый source для job.");
      return;
    }
    try {
      const created = await csrfMutate<TranscriptionJob>(
        `/projects/${project.id}/jobs`,
        csrf,
        onCsrf,
        {
          method: "POST",
          body: JSON.stringify({
            source_ids: usableSelected,
            title: title.trim() || null,
            provider_credential_id: selectedCredentialId || null,
          }),
        },
      );
      setTitle("");
      setSelectedSourceIds([]);
      setSelectedCredentialId("");
      setDetail((current) => ({
        ...current,
        [created.id]: { loading: false, error: "", job: created },
      }));
      setMessage(
        "Job создана. Статус lifecycle и доступные output records отслеживаются отдельно.",
      );
      onReloadJobs(project.id);
    } catch {
      setMessage(
        "Не удалось создать job. Проверьте выбранные sources и повторите.",
      );
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
      .then((loaded) => {
        setDetail((current) => ({
          ...current,
          [jobId]: { loading: false, error: "", job: loaded },
        }));
      })
      .catch(() => {
        setDetail((current) => ({
          ...current,
          [jobId]: {
            loading: false,
            error: "Не удалось загрузить детали job.",
            job: current[jobId]?.job ?? null,
          },
        }));
      });
    void api<JobOutputsResponse>(`/jobs/${jobId}/outputs`)
      .then((data) => {
        setOutputs((current) => ({
          ...current,
          [jobId]: { loading: false, error: "", data },
        }));
      })
      .catch(() => {
        setOutputs((current) => ({
          ...current,
          [jobId]: {
            loading: false,
            error: "Не удалось загрузить outputs job.",
            data: current[jobId]?.data ?? null,
          },
        }));
      });
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
        "Запрос отмены отправлен или job уже терминальна. Доступные output records, если они есть, остаются отдельными от lifecycle status.",
      );
      onReloadJobs(project.id);
    } catch {
      setMessage("Не удалось отменить job. Повторите безопасно позже.");
    }
  }
  return (
    <section className="sources" aria-label={`Jobs ${project.title}`}>
      <h4>Jobs проекта</h4>
      {jobs.loading && <p role="status">Загрузка jobs…</p>}
      {jobs.error && <p className="error">{jobs.error}</p>}
      <div className="notice" aria-label="Job lifecycle boundary">
        <p>
          Job lifecycle status и persisted output records отображаются отдельно.
        </p>
        <p>
          Processing, failed, cancelled и completed jobs могут иметь частичные
          outputs.
        </p>
        <p>
          UI загружает outputs только по кнопке деталей job; production-live
          processing и deployment не подтверждены.
        </p>
      </div>
      {jobs.loaded && !jobs.loading && jobs.items.length === 0 && (
        <p className="notice">Job records пока не созданы.</p>
      )}
      <section
        className="source-form"
        aria-label="Project job readiness checklist"
      >
        <h5>Readiness checklist перед future processing</h5>
        <ul>
          <li>
            Sources:{" "}
            {sources.loaded
              ? `${usableSourceCount} usable uploaded source(s)`
              : "sources ещё не загружены"}
            {!sources.loaded && " — загрузите sources для readiness preview."}
            {sources.loaded &&
              usableSourceCount === 0 &&
              " — нет uploaded usable sources."}
          </li>
          <li>
            BYOK credential:{" "}
            {selectedCredential
              ? `${credentialDisplay(selectedCredential)} selected`
              : "не выбран — optional для record creation."}
            {!selectedCredential &&
              (activeCredentials.length > 0
                ? " Future processing потребует выбрать active provider credential."
                : " Active provider credential недоступен; future processing потребует active BYOK credential.")}
          </li>
          <li>
            Output folder:{" "}
            {project.output_drive_folder_id
              ? `configured (${project.output_drive_folder_name || project.output_drive_folder_id})`
              : "не настроен — Google Docs output требует output Drive folder."}
          </li>
          <li>
            Processing: checklist не запускает worker/provider execution и не
            подтверждает production-live runtime.
          </li>
        </ul>
        <p className="notice">
          Checklist только объясняет readiness и не запускает processing.
        </p>
      </section>
      <form className="source-form" onSubmit={createJob}>
        <h5>Создать queued job из sources</h5>
        {!sources.loaded ? (
          <p className="notice">
            Сначала загрузите sources проекта, затем выберите готовые записи.
          </p>
        ) : (
          sources.items.map((source) => {
            const usable = isUsableJobSource(source);
            return (
              <label key={source.id}>
                <input
                  type="checkbox"
                  disabled={!usable}
                  checked={selectedSourceIds.includes(source.id)}
                  onChange={(e) =>
                    setSelectedSourceIds((current) =>
                      e.target.checked
                        ? [...current, source.id]
                        : current.filter((id) => id !== source.id),
                    )
                  }
                />
                {source.original_filename} · {source.upload_status}
                {!usable && <span> — {unusableJobSourceReason(source)}</span>}
              </label>
            );
          })
        )}
        {!sources.loaded && (
          <button type="button" onClick={() => onLoadSources(project.id)}>
            Загрузить sources для job
          </button>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название job (необязательно)"
          aria-label="Название job"
          maxLength={160}
        />
        <label>
          Provider credential для processing
          <select
            aria-label="Provider credential для processing"
            value={selectedCredentialId}
            onChange={(e) => setSelectedCredentialId(e.target.value)}
          >
            <option value="">Без credential</option>
            {activeCredentials.map((credential) => (
              <option key={credential.id} value={credential.id}>
                {credentialDisplay(credential)}
              </option>
            ))}
          </select>
        </label>
        {credentialsLoading && <p role="status">Загрузка credentials…</p>}
        {!credentialsLoading && credentialsError && (
          <p className="notice">{credentialsError}</p>
        )}
        {!credentialsLoading &&
          !credentialsError &&
          activeCredentials.length === 0 && (
            <p className="notice">
              Активных BYOK credentials нет. Job будет создана без credential.
            </p>
          )}
        <button className="primary" disabled={!sources.loaded}>
          Создать job
        </button>
      </form>
      {message && (
        <p className={message.startsWith("Не удалось") ? "error" : "notice"}>
          {message}
        </p>
      )}
      {jobs.items.map((job) => {
        const currentDetail = detail[job.id];
        const currentOutputs = outputs[job.id];
        const detailedJob = currentDetail?.job;
        return (
          <article className="source-card" key={job.id}>
            <b>{jobTitle(job)}</b>
            <span>Статус: {jobStatusLabel(job.status)}</span>
            <span>Sources: {job.source_count}</span>
            <span>Created: {formatTime(job.created_at)}</span>
            <span>Updated: {formatTime(job.updated_at)}</span>
            <span>Cancelled: {formatTime(job.cancelled_at)}</span>
            <span>Attempts: {job.attempt_count ?? 0}</span>
            {job.status === "processing" && job.cancel_requested_at && (
              <span>
                Отмена запрошена: {formatTime(job.cancel_requested_at)}
              </span>
            )}
            {job.error_code && <span>Error code: {job.error_code}</span>}
            {job.error_message && <span>Error: {job.error_message}</span>}
            <button type="button" onClick={() => void loadDetail(job.id)}>
              Показать детали job
            </button>
            {job.status === "queued" && (
              <button type="button" onClick={() => void cancelJob(job.id)}>
                Отменить queued record
              </button>
            )}
            {job.status === "processing" && !job.cancel_requested_at && (
              <button type="button" onClick={() => void cancelJob(job.id)}>
                Запросить отмену processing
              </button>
            )}
            {job.status === "processing" && job.cancel_requested_at && (
              <button type="button" disabled>
                Отмена запрошена
              </button>
            )}
            {currentDetail?.loading && (
              <p role="status">Загрузка деталей job…</p>
            )}
            {currentDetail?.error && (
              <p className="error">{currentDetail.error}</p>
            )}
            {currentOutputs?.loading && (
              <p role="status">Загрузка outputs job…</p>
            )}
            {currentOutputs?.error && (
              <p className="error">{currentOutputs.error}</p>
            )}
            {currentOutputs?.data && (
              <section aria-label={`Job outputs ${currentOutputs.data.job_id}`}>
                <h5>Outputs job</h5>
                <p>
                  Lifecycle status из outputs:{" "}
                  {jobStatusLabel(currentOutputs.data.job_status)}
                </p>
                <p>Output records: {currentOutputs.data.output_count}</p>
                <p className="notice">
                  Output availability не означает, что job завершена.
                </p>
                {currentOutputs.data.output_count === 0 && (
                  <p className="notice">Output records пока не найдены.</p>
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
                      <span>
                        Source type: {output.source_type || "не указан"}
                      </span>
                      <span>
                        Output kind: {output.output_kind || "не указан"}
                      </span>
                      <span>
                        Transcript standard:{" "}
                        {output.transcript_standard || "не указан"}
                      </span>
                      <span>
                        Document characters:{" "}
                        {output.document_character_count ?? "—"}
                      </span>
                      <span>
                        Document created:{" "}
                        {formatTime(output.document_created_at)}
                      </span>
                      <span>Persisted: {formatTime(output.persisted_at)}</span>
                      {approvedLink ? (
                        <a
                          href={output.web_view_url ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Открыть output в Google
                        </a>
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
                <h5>Sources job</h5>
                {safeJobSources(detailedJob).map((source) => (
                  <article
                    className="source-card"
                    key={`${detailedJob.id}-${source.id}`}
                  >
                    <b>
                      {source.position + 1}. {source.original_filename}
                    </b>
                    <span>Job source status: {source.job_source_status}</span>
                    <span>Source type: {source.source_type}</span>
                    <span>Upload status: {source.upload_status}</span>
                    <span>MIME: {source.mime_type || "не указан"}</span>
                    <span>Размер: {formatBytes(source.size_bytes)}</span>
                    <span>Uploaded: {formatTime(source.uploaded_at)}</span>
                    <span>Deleted: {formatTime(source.deleted_at)}</span>
                    {source.drive_file_id && (
                      <span>Drive file ID: {source.drive_file_id}</span>
                    )}
                    {isSafeDisplayUrl(source.drive_file_url) && (
                      <a href={source.drive_file_url ?? undefined}>
                        Drive file URL
                      </a>
                    )}
                  </article>
                ))}
              </section>
            )}
          </article>
        );
      })}
    </section>
  );
}

function ProjectsPage({
  csrf,
  onCsrf,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sources, setSources] = useState<
    Record<string, typeof emptySourceState>
  >({});
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [expandedJobs, setExpandedJobs] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState(false);
  const activePickerRef = useRef(false);
  const setPickerBusy = (busy: boolean) => {
    activePickerRef.current = busy;
    setActivePicker(busy);
  };
  const [googleConnection, setGoogleConnection] = useState<GoogleConnection | null>(null);
  const load = () => {
    setLoading(true);
    setError("");
    api<{ projects: Project[] }>("/projects")
      .then((r) => setProjects(r.projects))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить проекты.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => { api<GoogleConnection>("/google/connection").then(setGoogleConnection).catch(() => setGoogleConnection(null)); }, []);
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
  const expand = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next && !sources[id]?.loaded) loadSources(id);
  };
  const expandJobs = (id: string) => {
    const next = expandedJobs === id ? null : id;
    setExpandedJobs(next);
    if (next && !jobs[id]?.loaded) loadJobs(id);
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await csrfMutate<Project>("/projects", csrf, onCsrf, {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("project_title"),
          description: fd.get("project_description"),
        }),
      });
      form.reset();
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
  async function patchFolder(
    id: string,
    body: Record<string, FormDataEntryValue | null>,
  ) {
    setError("");
    try {
      await csrfMutate<Project>(`/projects/${id}`, csrf, onCsrf, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось сохранить Drive folder metadata.",
      );
    }
  }
  async function clearFolder(id: string) {
    await patchFolder(id, {
      output_drive_folder_id: null,
      output_drive_folder_url: null,
      output_drive_folder_name: null,
    });
  }
  async function chooseOutputFolder(id: string) {
    if (activePickerRef.current) return;
    setPickerBusy(true);
    setError("");
    try {
      const session = await csrfMutate<PickerSession>("/google/picker/session", csrf, onCsrf, { method: "POST" });
      const result = await googlePicker.openGooglePicker("output-folder", session);
      if (result.action === "cancel") return;
      if (result.action === "error") { setError(result.message); return; }
      const folderId = result.docs[0]?.id;
      if (!folderId) { setError("Выберите одну папку Google Drive."); return; }
      await csrfMutate<Project>(`/projects/${id}/output-folder/google-picker`, csrf, onCsrf, { method: "POST", body: JSON.stringify({ folder_id: folderId }) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выбрать папку результатов.");
    } finally {
      setPickerBusy(false);
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
  return (
    <section className="card wide">
      <p className="eyebrow">Platform API</p>
      <h2>Проекты</h2>
      <p className="notice">
      Проекты и sources загружаются из same-origin API. Google Drive Picker используется для выбора файлов и папки результатов; worker rollout остаётся отдельным операторским шагом.
      </p>
      <form className="inline project-form" onSubmit={save}>
        <input
          name="project_title"
          placeholder="Название проекта"
          maxLength={160}
          required
        />
        <input
          name="project_description"
          placeholder="Описание (необязательно)"
          maxLength={2000}
        />
        <button className="primary">Создать проект</button>
      </form>
      {loading && <p role="status">Загрузка проектов…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && projects.length === 0 && (
        <p className="notice">
          Пока нет проектов. Создайте первый проект, чтобы подготовить рабочее
          пространство.
        </p>
      )}
      <div className="grid project-grid">
        {projects.map((p) => (
          <article className="card project-card" key={p.id}>
            <span className="tag">Активный проект</span>
            {editing === p.id ? (
              <form className="project-edit" onSubmit={(e) => update(e, p.id)}>
                <input
                  name="project_title"
                  defaultValue={p.title}
                  maxLength={160}
                  required
                />
                <textarea
                  name="project_description"
                  defaultValue={p.description ?? ""}
                  maxLength={2000}
                  placeholder="Описание"
                />
                <button className="primary">Сохранить</button>
                <button type="button" onClick={() => setEditing(null)}>
                  Отмена
                </button>
              </form>
            ) : (
              <>
                <h3>{p.title}</h3>
                <p>{p.description || "Описание не добавлено."}</p>
                <p className="muted">
                  Обновлено: {new Date(p.updated_at).toLocaleString("ru-RU")}
                </p>
                <div className="folder-status">
                  <b>Output Google Drive folder</b>
                  {p.output_drive_folder_id ? (
                    <p>
                      Настроена: {p.output_drive_folder_name || "без имени"} ·
                      ID {p.output_drive_folder_id}{" "}
                      {p.output_drive_folder_url && (
                        <a href={p.output_drive_folder_url}>Folder URL</a>
                      )}
                    </p>
                  ) : (
                    <p>Папка результата не настроена.</p>
                  )}
                </div>
                <div className="source-form" aria-label="Output folder Google Picker">
                  <button className="primary" type="button" disabled={!googleConnection?.picker_ready || activePicker} onClick={() => chooseOutputFolder(p.id)}>
                    Выбрать папку для результатов
                  </button>
                  <button type="button" onClick={() => clearFolder(p.id)}>
                    Очистить папку результатов
                  </button>
                  {googleConnection?.connected && googleConnection.reconnect_required && <p className="notice">Google Drive подключён, но для выбора папки результатов требуется повторная авторизация с правом drive.file. Откройте Настройки и нажмите «Переподключить Google Drive».</p>}
                  {googleConnection?.connected && !googleConnection.picker_configured && <p className="notice">Google Picker временно недоступен.</p>}
                </div>
                <button onClick={() => setEditing(p.id)}>Редактировать</button>
                <button onClick={() => archive(p.id)}>Архивировать</button>
                <button onClick={() => expand(p.id)}>
                  {expanded === p.id ? "Скрыть sources" : "Показать sources"}
                </button>
                <button onClick={() => expandJobs(p.id)}>
                  {expandedJobs === p.id ? "Скрыть jobs" : "Показать jobs"}
                </button>
                {expanded === p.id && (
                  <SourcesPanel
                    project={p}
                    csrf={csrf}
                    onCsrf={onCsrf}
                    sources={sources[p.id] ?? emptySourceState}
                    googleConnection={googleConnection}
                    pickerBusy={activePicker}
                    setPickerBusy={setPickerBusy}
                    onReload={loadSources}
                    onError={setError}
                  />
                )}
                {expandedJobs === p.id && (
                  <JobsPanel
                    project={p}
                    csrf={csrf}
                    onCsrf={onCsrf}
                    jobs={jobs[p.id] ?? emptyJobState}
                    sources={sources[p.id] ?? emptySourceState}
                    onLoadSources={loadSources}
                    onReloadJobs={loadJobs}
                  />
                )}
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
function SettingsPage({
  user,
  csrf,
  onCsrf,
  onLogout,
}: {
  user: User;
  csrf: string;
  onCsrf: (csrf: string) => void;
  onLogout: () => void;
}) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [events, setEvents] = useState<Audit[]>([]);
  const [googleConnection, setGoogleConnection] =
    useState<GoogleConnection | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleMessage, setGoogleMessage] = useState("");
  const [googleStarting, setGoogleStarting] = useState(false);
  const [error, setError] = useState("");
  const loadGoogleConnection = () => {
    setGoogleLoading(true);
    setGoogleMessage("");
    api<GoogleConnection>("/google/connection")
      .then((r) => setGoogleConnection(r))
      .catch(() => {
        setGoogleConnection(null);
        setGoogleMessage("Google Drive connection сейчас недоступен.");
      })
      .finally(() => setGoogleLoading(false));
  };
  const load = () => {
    api<{ credentials: Credential[] }>("/credentials").then((r) =>
      setCredentials(r.credentials),
    );
    api<{ events: Audit[] }>("/audit-events").then((r) => setEvents(r.events));
    loadGoogleConnection();
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
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }
  async function replace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const id = String(fd.get("credential_id") ?? "");
    const selected = credentials.find((c) => c.id === id);
    if (!selected) return setError("Выберите credential для замены.");
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
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
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
      setGoogleMessage("Не удалось начать подключение Google Drive. Попробуйте позже или проверьте настройки OAuth.");
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
  return (
    <section className="card wide">
      <h2>Настройки аккаунта</h2>
      <p>
        Аккаунт: <b>{user.email}</b> ({user.role})
      </p>
      <button onClick={onLogout}>Выйти</button>
      <h3>BYOK credentials</h3>
      <p className="notice">
        Ключи отправляются только same-origin API, не сохраняются в браузере и
        никогда не отображаются обратно.
      </p>
      <form className="inline" onSubmit={save} autoComplete="off">
        <select name="provider">
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
      </form>
      <form
        className="inline"
        onSubmit={replace}
        aria-label="Заменить credential"
        autoComplete="off"
      >
        <select name="credential_id" required>
          <option value="">Выберите credential</option>
          {credentials.map((c) => (
            <option key={c.id} value={c.id}>
              {c.provider} · {c.label} · {c.masked_value}
            </option>
          ))}
        </select>
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
        <button className="primary">Заменить</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {credentials.map((c) => (
          <article className="card" key={c.id}>
            <span className="tag">{c.provider}</span>
            <h3>{c.label}</h3>
            <p>
              {c.status} · v{c.active_version ?? "—"} · {c.masked_value}
            </p>
            <button onClick={() => action(`/credentials/${c.id}/revoke`)}>
              Отозвать
            </button>
            <button onClick={() => action(`/credentials/${c.id}`, "DELETE")}>
              Удалить
            </button>
          </article>
        ))}
      </div>
      <h3>Google Drive connection</h3>
      <p className="notice">
        Подключение подтверждает доступ Google Drive для Picker и server-side
        проверки выбранных файлов/папок. Worker rollout и production smoke остаются отдельными операторскими шагами.
      </p>
      <article className="card">
        <span className="tag">Google Drive</span>
        {googleLoading ? (
          <p>Проверяем статус подключения…</p>
        ) : googleConnection?.connected ? (
          <>
            <h3>Drive подключён</h3>
            <dl className="meta">
              <dt>Email Google</dt>
              <dd>{googleConnection.google_email ?? "—"}</dd>
              <dt>Status</dt>
              <dd>{googleConnection.status ?? "—"}</dd>
              <dt>Scopes</dt>
              <dd>{googleConnection.scopes ?? "—"}</dd>
              <dt>Connected</dt>
              <dd>{formatTime(googleConnection.connected_at)}</dd>
              <dt>Revoked</dt>
              <dd>{formatTime(googleConnection.revoked_at)}</dd>
            </dl>
            {googleConnection.reconnect_required && (
              <div className="notice" role="status">
                Google Drive подключён, но для выбора файлов через Picker нужно повторно авторизовать доступ с правом drive.file. Текущее подключение будет сохранено до успешного завершения нового OAuth callback.
              </div>
            )}
            {googleConnection.reconnect_required && (
              <button className="primary" type="button" disabled={googleStarting} onClick={connectGoogle}>
                Переподключить Google Drive
              </button>
            )}
          </>
        ) : googleConnection ? (
          <>
            <h3>Drive не подключён</h3>
            <p>
              Status: {googleConnection.status ?? "disconnected"}
              {googleConnection.revoked_at
                ? ` · revoked ${formatTime(googleConnection.revoked_at)}`
                : ""}
            </p>
            <button className="primary" disabled={googleStarting} onClick={connectGoogle}>
              Подключить Google Drive
            </button>
          </>
        ) : (
          <p>Google Drive connection недоступен.</p>
        )}
        {googleCanDisconnect && (
          <button onClick={disconnectGoogle}>Отключить Google Drive</button>
        )}
        {googleMessage && <p className="error">{googleMessage}</p>}
      </article>
      <h3>События безопасности</h3>
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            {e.type} · {new Date(e.created_at).toLocaleString("ru-RU")}
          </li>
        ))}
      </ul>
    </section>
  );
}
function PlatformShell() {
  const [page, setPage] = useState<Page>("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [csrf, setCsrf] = useState("");
  useEffect(() => {
    api<{ authenticated: boolean; user: User }>("/auth/session")
      .then((r) => {
        setUser(r.user);
        return api<{ csrf_token: string }>("/auth/csrf", { method: "POST" });
      })
      .then((r) => setCsrf(r.csrf_token))
      .catch(() => undefined);
  }, []);
  if (!user)
    return (
      <Login
        onLogin={(u, t) => {
          setUser(u);
          setCsrf(t);
        }}
      />
    );
  const logout = async () => {
    let token = csrf;
    if (!token) {
      const refreshed = await api<{ csrf_token: string }>("/auth/csrf", {
        method: "POST",
      });
      token = refreshed.csrf_token;
      setCsrf(token);
    }
    await api("/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": token },
    }).catch(() => undefined);
    setUser(null);
    setCsrf("");
  };
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          Studio PWA<span>Platform core</span>
        </div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
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
          <section className="hero">
            <p className="eyebrow">Русскоязычная Studio</p>
            <h1>Панель аккаунта готова</h1>
            <p>
              Подключены вход, серверная сессия и BYOK-настройки. Транскрибация,
              загрузки, Google и очереди остаются прототипом.
            </p>
            <button className="primary" onClick={() => setPage("new")}>
              Создать черновик
            </button>
          </section>
        )}
        {page === "projects" && <ProjectsPage csrf={csrf} onCsrf={setCsrf} />}
        {page === "new" && <NewTranscription />}
        {page === "jobs" && (
          <section className="grid">
            <h2>Задачи</h2>
            {demoJobs.map((j) => (
              <article className="card" key={j.title}>
                <span className="tag">{j.state}</span>
                <h3>{j.title}</h3>
                <p>Реальная очередь и provider processing ещё не подключены.</p>
              </article>
            ))}
          </section>
        )}
        {page === "settings" && (
          <SettingsPage
            user={user}
            csrf={csrf}
            onCsrf={setCsrf}
            onLogout={logout}
          />
        )}
      </main>
    </div>
  );
}
export default function App({
  mode = platformMode ? "platform" : "static",
}: { mode?: "static" | "platform" } = {}) {
  return mode === "platform" ? <PlatformShell /> : <StaticShell />;
}
