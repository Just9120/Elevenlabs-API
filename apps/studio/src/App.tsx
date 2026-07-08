import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  ClipboardList,
  Home,
  PlusCircle,
  Settings,
} from "lucide-react";
import { buildSegmentPlan, hasSegmentErrors, type Segment } from "./segments";
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
type UploadInit = {
  source_id: string;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expires_in: number;
  };
};
const LOCAL_UPLOAD_LIMIT_BYTES = 536870912;
const emptySourceState = {
  loading: false,
  error: "",
  loaded: false,
  items: [] as Source[],
};
function formatBytes(value: number | null) {
  if (value == null) return "не указан";
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}
function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
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
  onReload,
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
  onError: (message: string) => void;
}) {
  const [uploadState, setUploadState] = useState("");
  async function addDriveSource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const rawSize = String(fd.get("size_bytes") ?? "").trim();
    try {
      await csrfMutate<Source>(
        `/projects/${project.id}/sources/google-drive`,
        csrf,
        onCsrf,
        {
          method: "POST",
          body: JSON.stringify({
            drive_file_id: fd.get("drive_file_id"),
            drive_file_url: fd.get("drive_file_url") || null,
            original_filename: fd.get("original_filename"),
            mime_type: fd.get("mime_type") || null,
            size_bytes: rawSize ? Number(rawSize) : null,
          }),
        },
      );
      form.reset();
      onReload(project.id);
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Не удалось добавить Google Drive source metadata.",
      );
    }
  }
  async function uploadLocal(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return onError("Выберите audio/video файл для загрузки.");
    if (!isSupportedMediaFile(file))
      return onError("Поддерживаются только audio/video файлы или OGG.");
    if (file.size <= 0)
      return onError("Файл пустой. Выберите другой source файл.");
    if (file.size > LOCAL_UPLOAD_LIMIT_BYTES)
      return onError(
        "Файл больше 512 MB. Выберите меньший временный source файл.",
      );
    try {
      setUploadState("Подготовка upload…");
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
      setUploadState("Загрузка во временное хранилище…");
      const put = await fetch(initiated.upload.url, {
        method: initiated.upload.method,
        headers: initiated.upload.headers,
        body: file,
      });
      if (!put.ok)
        throw new Error(
          "Не удалось загрузить файл во временное хранилище. Проверьте CORS/bucket policy и повторите.",
        );
      setUploadState("Подтверждение upload…");
      await csrfMutate<Source>(
        `/sources/${initiated.source_id}/local-upload/complete`,
        csrf,
        onCsrf,
        { method: "POST" },
      );
      setUploadState("Файл загружен и готов как временный source.");
      onReload(project.id);
    } catch (err) {
      setUploadState("Ошибка upload.");
      onError(
        err instanceof Error
          ? err.message
          : "Не удалось загрузить локальный source файл.",
      );
    }
  }
  async function deleteSource(id: string) {
    try {
      await csrfMutate<{ ok: boolean }>(`/sources/${id}`, csrf, onCsrf, {
        method: "DELETE",
      });
      onReload(project.id);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Не удалось удалить source.",
      );
    }
  }
  return (
    <section className="sources" aria-label={`Sources ${project.title}`}>
      <h4>Sources проекта</h4>
      {sources.loading && <p role="status">Загрузка sources…</p>}
      {sources.error && <p className="error">{sources.error}</p>}
      {sources.loaded && !sources.loading && sources.items.length === 0 && (
        <p className="notice">Source records пока не добавлены.</p>
      )}
      {sources.items.map((source) => (
        <article className="source-card" key={source.id}>
          <b>{source.original_filename}</b>
          <span>
            {source.source_type === "google_drive"
              ? "Google Drive metadata"
              : "Local temporary upload"}
          </span>
          <span>Статус: {source.upload_status}</span>
          <span>Размер: {formatBytes(source.size_bytes)}</span>
          <span>MIME: {source.mime_type || "не указан"}</span>
          <span>Uploaded: {formatTime(source.uploaded_at)}</span>
          <span>Expires: {formatTime(source.expires_at)}</span>
          <span>Deleted: {formatTime(source.deleted_at)}</span>
          {source.delete_reason && <span>Reason: {source.delete_reason}</span>}
          {source.drive_file_id && (
            <span>Drive file ID: {source.drive_file_id}</span>
          )}
          {source.drive_file_url && (
            <a href={source.drive_file_url}>Drive file URL</a>
          )}
          <button type="button" onClick={() => deleteSource(source.id)}>
            Удалить source
          </button>
        </article>
      ))}
      <form className="source-form" onSubmit={addDriveSource}>
        <p className="notice">
          Google Drive source metadata only: файл не проверяется, OAuth/Drive
          API пока не вызываются.
        </p>
        <input name="drive_file_id" placeholder="Drive file ID" required />
        <input
          name="drive_file_url"
          placeholder="Drive file URL (необязательно)"
        />
        <input
          name="original_filename"
          placeholder="Original filename"
          required
        />
        <input name="mime_type" placeholder="MIME type (необязательно)" />
        <input
          name="size_bytes"
          type="number"
          min="0"
          placeholder="Size bytes (необязательно)"
        />
        <button className="primary">Добавить Drive metadata</button>
      </form>
      <label className="drop compact">
        Загрузить временный локальный audio/video source
        <input
          type="file"
          accept="audio/*,video/*,.ogg,.oga,application/ogg"
          onChange={uploadLocal}
        />
      </label>
      {uploadState && <p role="status">{uploadState}</p>}
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
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
  const expand = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next && !sources[id]?.loaded) loadSources(id);
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
  async function saveFolder(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await patchFolder(id, {
      output_drive_folder_id: fd.get("output_drive_folder_id"),
      output_drive_folder_url: fd.get("output_drive_folder_url") || null,
      output_drive_folder_name: fd.get("output_drive_folder_name") || null,
    });
  }
  async function clearFolder(id: string) {
    await patchFolder(id, {
      output_drive_folder_id: null,
      output_drive_folder_url: null,
      output_drive_folder_name: null,
    });
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
        Проекты и sources загружаются из same-origin API. Provider
        transcription, Google OAuth/Drive picker, Google Docs и очереди ещё не
        подключены.
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
                <form
                  className="source-form"
                  onSubmit={(e) => saveFolder(e, p.id)}
                >
                  <input
                    name="output_drive_folder_id"
                    defaultValue={p.output_drive_folder_id ?? ""}
                    placeholder="Output Drive folder ID"
                    required
                  />
                  <input
                    name="output_drive_folder_url"
                    defaultValue={p.output_drive_folder_url ?? ""}
                    placeholder="Folder URL (необязательно)"
                  />
                  <input
                    name="output_drive_folder_name"
                    defaultValue={p.output_drive_folder_name ?? ""}
                    placeholder="Folder display name (необязательно)"
                  />
                  <button className="primary">Сохранить output folder</button>
                  <button type="button" onClick={() => clearFolder(p.id)}>
                    Очистить output folder
                  </button>
                </form>
                <button onClick={() => setEditing(p.id)}>Редактировать</button>
                <button onClick={() => archive(p.id)}>Архивировать</button>
                <button onClick={() => expand(p.id)}>
                  {expanded === p.id ? "Скрыть sources" : "Показать sources"}
                </button>
                {expanded === p.id && (
                  <SourcesPanel
                    project={p}
                    csrf={csrf}
                    onCsrf={onCsrf}
                    sources={sources[p.id] ?? emptySourceState}
                    onReload={loadSources}
                    onError={setError}
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
  const [error, setError] = useState("");
  const load = () => {
    api<{ credentials: Credential[] }>("/credentials").then((r) =>
      setCredentials(r.credentials),
    );
    api<{ events: Audit[] }>("/audit-events").then((r) => setEvents(r.events));
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
