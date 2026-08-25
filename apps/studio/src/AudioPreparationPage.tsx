import { useEffect, useMemo, useRef, useState } from "react";
import { api, mutateWithCsrfRetry } from "./apiClient";
import * as googlePicker from "./googlePicker";
import { isUsableJobSource, type Source } from "./sourceModel";

type Project = { id: string; title: string };
type AudioJob = {
  id: string;
  status: "preview_queued" | "analyzing" | "preview_ready" | "queued" | "processing" | "cancelled" | "failed" | "completed";
  title: string;
  input_count: number;
  inputs: { position: number; filename: string; source_type: string; ephemeral_reference: boolean }[];
  preview: { input_duration_seconds: number; estimated_output_duration_seconds: number; copy_compatible: boolean } | null;
  progress: { percent: number; stage: string };
  output: { download_ready: boolean; source_id: string; google_drive_url: string | null; duration_seconds: number | null } | null;
  error_code: string | null;
};

type Props = { csrf: string; onCsrf: (value: string) => void };

const terminal = new Set(["preview_ready", "cancelled", "failed", "completed"]);
const presetDefaults = {
  processing_only: { format: "wav", mono: "preserve", silence: false, threshold: -40, minimum: 1, keep: 0.3, template: "{title}" },
  lecture: { format: "flac", mono: "mixdown", silence: true, threshold: -38, minimum: 1.2, keep: 0.35, template: "{date}_{title}" },
  call: { format: "flac", mono: "mixdown", silence: true, threshold: -42, minimum: 1.8, keep: 0.5, template: "{date}_{time}_{title}" },
} as const;

function duration(seconds: number) {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function parseWorkspace(value: unknown): Project | null {
  const project = value && typeof value === "object" ? (value as { project?: unknown }).project : null;
  return project && typeof project === "object" && typeof (project as Project).id === "string" && typeof (project as Project).title === "string"
    ? (project as Project)
    : null;
}

function parseSources(value: unknown): Source[] {
  const rows = value && typeof value === "object" ? (value as { sources?: unknown }).sources : null;
  return Array.isArray(rows) ? (rows as Source[]).filter((row) => row && typeof row.id === "string") : [];
}

function parseJob(value: unknown): AudioJob {
  if (!value || typeof value !== "object" || typeof (value as AudioJob).id !== "string") throw new Error("Сервер вернул некорректное состояние обработки.");
  return value as AudioJob;
}

export function AudioPreparationPage({ csrf, onCsrf }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [ephemeral, setEphemeral] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("Обработанное аудио");
  const [preset, setPreset] = useState("processing_only");
  const [format, setFormat] = useState("wav");
  const [mono, setMono] = useState("preserve");
  const [silenceEnabled, setSilenceEnabled] = useState(false);
  const [threshold, setThreshold] = useState(-40);
  const [minimum, setMinimum] = useState(1);
  const [keep, setKeep] = useState(0.3);
  const [template, setTemplate] = useState("{title}");
  const [destination, setDestination] = useState<"download" | "google_drive">("download");
  const [driveFolder, setDriveFolder] = useState<{ id: string; name: string } | null>(null);
  const [job, setJob] = useState<AudioJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const usable = useMemo(() => sources.filter(isUsableJobSource), [sources]);

  async function mutate<T>(path: string, options: RequestInit) {
    return mutateWithCsrfRetry<T>(path, csrf, onCsrf, options);
  }

  async function reloadSources(projectId: string) {
    setSources(parseSources(await api(`/projects/${projectId}/sources`, { cache: "no-store" })));
  }

  useEffect(() => {
    let active = true;
    setBusy(true);
    void mutate<unknown>("/transcriptions/workspace", { method: "POST" })
      .then(async (value) => {
        const workspace = parseWorkspace(value);
        if (!workspace) throw new Error("Не удалось подготовить рабочую область.");
        if (!active) return;
        setProject(workspace);
        await reloadSources(workspace.id);
        const collection = await api<unknown>(`/projects/${workspace.id}/audio-preparations`, { cache: "no-store" });
        const jobs = collection && typeof collection === "object" && Array.isArray((collection as { jobs?: unknown }).jobs)
          ? (collection as { jobs: unknown[] }).jobs
          : [];
        if (active && jobs.length > 0) setJob(parseJob(jobs[0]));
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Не удалось открыть обработку аудио."))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!job || terminal.has(job.status)) return;
    const timer = window.setInterval(() => {
      void api<unknown>(`/audio-preparations/${job.id}`, { cache: "no-store" })
        .then((value) => setJob(parseJob(value)))
        .catch(() => setError("Не удалось обновить прогресс. Повторите позже."));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  function toggleSource(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function move(index: number, offset: number) {
    setSelected((current) => {
      const next = [...current];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function applyPreset(value: keyof typeof presetDefaults) {
    const next = presetDefaults[value];
    setPreset(value); setFormat(next.format); setMono(next.mono); setSilenceEnabled(next.silence);
    setThreshold(next.threshold); setMinimum(next.minimum); setKeep(next.keep); setTemplate(next.template);
  }

  function applyFormat(value: string) {
    setFormat(value);
    if (value === "copy") { setMono("preserve"); setSilenceEnabled(false); }
  }

  async function reuseOutput() {
    if (!project || !job?.output?.source_id) return;
    await reloadSources(project.id);
    setSelected([job.output.source_id]);
    setEphemeral(new Set());
    setJob(null);
  }

  function transcribeOutput() {
    const sourceId = job?.output?.source_id;
    if (!sourceId) return;
    window.dispatchEvent(
      new CustomEvent("studio:transcribe-source", {
        detail: { sourceId },
      }),
    );
  }

  async function pickerSession() {
    return mutate<googlePicker.PickerSession>("/google/picker/session", { method: "POST" });
  }

  async function addFromDrive() {
    if (!project || busy) return;
    setBusy(true); setError("");
    try {
      const result = await googlePicker.openGooglePicker("sources", await pickerSession());
      if (result.action !== "picked" || result.docs.length === 0) return;
      const response = await mutate<{ sources: Source[] }>(`/projects/${project.id}/sources/google-picker`, {
        method: "POST", body: JSON.stringify({ file_ids: result.docs.map((doc) => doc.id) }),
      });
      await reloadSources(project.id);
      setSelected((current) => [...new Set([...current, ...response.sources.map((source) => source.id)])]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось добавить Google Drive файлы."); }
    finally { setBusy(false); }
  }

  async function chooseOutputFolder() {
    setBusy(true); setError("");
    try {
      const result = await googlePicker.openGooglePicker("output-folder", await pickerSession());
      if (result.action === "picked" && result.docs.length === 1) {
        setDriveFolder({ id: result.docs[0].id, name: result.docs[0].name || "Папка Google Drive" });
        setDestination("google_drive");
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось выбрать папку Google Drive."); }
    finally { setBusy(false); }
  }

  async function addLocalFiles(files: File[]) {
    if (!project || files.length === 0) return;
    setBusy(true); setError("");
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const mime = file.type || "application/octet-stream";
        const initiated = await mutate<{ source_id: string; upload: { method: string; url: string; headers: Record<string, string> } }>(
          `/projects/${project.id}/sources/local-upload/initiate`,
          { method: "POST", body: JSON.stringify({ original_filename: file.name, mime_type: mime, size_bytes: file.size }) },
        );
        const put = await fetch(initiated.upload.url, { method: initiated.upload.method, headers: initiated.upload.headers, body: file, credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" });
        if (!put.ok) throw new Error(`${file.name}: временная загрузка не завершена.`);
        await mutate(`/sources/${initiated.source_id}/local-upload/complete`, { method: "POST" });
        uploaded.push(initiated.source_id);
      }
      await reloadSources(project.id);
      setSelected((current) => [...current, ...uploaded.filter((id) => !current.includes(id))]);
      setEphemeral((current) => new Set([...current, ...uploaded]));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось загрузить локальные файлы."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function createPreview() {
    if (!project || selected.length === 0) return;
    setBusy(true); setError(""); setJob(null);
    try {
      const value = await mutate<unknown>(`/projects/${project.id}/audio-preparations`, {
        method: "POST",
        body: JSON.stringify({
          title, source_ids: selected, ephemeral_source_ids: selected.filter((id) => ephemeral.has(id)), manual_order: true,
          options: { preset, output_format: format, mono_mode: mono, silence_enabled: silenceEnabled, silence_threshold_db: threshold, silence_min_duration_seconds: minimum, silence_keep_duration_seconds: keep, output_name_template: template },
          output_destination: destination, output_drive_folder_id: destination === "google_drive" ? driveFolder?.id : null,
        }),
      });
      setJob(parseJob(value));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось создать preview."); }
    finally { setBusy(false); }
  }

  async function start() {
    if (!job) return;
    setBusy(true); setError("");
    try { setJob(parseJob(await mutate(`/audio-preparations/${job.id}/start`, { method: "POST" }))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось запустить обработку."); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!job) return;
    setBusy(true); setError("");
    try { setJob(parseJob(await mutate(`/audio-preparations/${job.id}/cancel`, { method: "POST" }))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось отменить обработку."); }
    finally { setBusy(false); }
  }

  return (
    <div className="audio-preparation-page">
      <section className="hero"><div><p className="eyebrow">AUDIO WORKSPACE</p><h1>Обработка аудио</h1><p>Склейте файлы, уберите длинные паузы, выберите mono-режим и подготовьте WAV/FLAC до транскрибации.</p></div></section>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="card audio-preparation-card">
        <h2>1. Исходные файлы</h2>
        <div className="actions">
          <button type="button" onClick={addFromDrive} disabled={busy || !project}>Из Google Drive</button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || !project}>С устройства</button>
          <input ref={fileInput} hidden type="file" multiple accept="audio/*,video/*,.ogg" onChange={(event) => void addLocalFiles(Array.from(event.target.files || []))} />
        </div>
        <details className="audio-saved-sources">
          <summary>Выбрать из сохранённых файлов Studio</summary>
          <div className="audio-source-grid">
            {usable.length === 0 && <p className="notice">Сохранённых файлов пока нет. Добавьте их с устройства или Google Drive.</p>}
            {usable.map((source) => <label key={source.id} className="audio-source-choice"><input type="checkbox" checked={selected.includes(source.id)} onChange={() => toggleSource(source.id)} /><span>{source.original_filename}<small>{source.source_type === "google_drive" ? "Google Drive" : "Временная копия · удалится после операции, максимум через 24 часа"}</small></span></label>)}
          </div>
        </details>
        {selected.length > 0 && <p className="notice">Выбрано файлов: {selected.length}</p>}
        {selected.length > 1 && <ol className="audio-order-list">{selected.map((id, index) => <li key={id}><span>{sources.find((source) => source.id === id)?.original_filename || "Файл"}</span><button type="button" onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === selected.length - 1}>↓</button></li>)}</ol>}
      </section>
      <section className="card audio-preparation-card">
        <h2>2. Параметры</h2>
        <div className="audio-settings-grid">
          <label>Preset<select value={preset} onChange={(e) => applyPreset(e.target.value as keyof typeof presetDefaults)}><option value="processing_only">Обработка</option><option value="lecture">Лекция</option><option value="call">Звонок</option></select></label>
          <label>Формат<select value={format} onChange={(e) => applyFormat(e.target.value)}><option value="wav">WAV</option><option value="flac">FLAC</option><option value="copy">Без перекодирования</option></select></label>
          <label>Каналы<select value={mono} onChange={(e) => setMono(e.target.value)} disabled={format === "copy"}><option value="preserve">Сохранить</option><option value="mixdown">Свести в mono</option><option value="left">Левый канал</option><option value="right">Правый канал</option></select></label>
          <label>Название<input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>Шаблон файла<input value={template} maxLength={160} onChange={(e) => setTemplate(e.target.value)} /><small>{"{date}, {time}, {project}, {title}"}</small></label>
        </div>
        <label className="audio-source-choice"><input type="checkbox" checked={silenceEnabled} disabled={format === "copy"} onChange={(e) => setSilenceEnabled(e.target.checked)} /><span>Уменьшить длинные паузы</span></label>
        {silenceEnabled && format !== "copy" && <div className="audio-settings-grid"><label>Порог, dB<input type="number" min="-60" max="-10" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></label><label>Минимальная пауза, сек<input type="number" min="0.2" max="10" step="0.1" value={minimum} onChange={(e) => setMinimum(Number(e.target.value))} /></label><label>Оставить, сек<input type="number" min="0" max="5" step="0.1" value={keep} onChange={(e) => setKeep(Number(e.target.value))} /></label></div>}
        <fieldset><legend>Результат</legend><label><input type="radio" checked={destination === "download"} onChange={() => setDestination("download")} /> Скачать</label><label><input type="radio" checked={destination === "google_drive"} onChange={() => setDestination("google_drive")} /> Google Drive</label><button type="button" onClick={chooseOutputFolder} disabled={busy}>Выбрать папку</button>{driveFolder && <span>{driveFolder.name}</span>}</fieldset>
        <button className="primary" type="button" disabled={busy || selected.length === 0 || !title.trim() || (destination === "google_drive" && !driveFolder)} onClick={createPreview}>Проверить и рассчитать</button>
      </section>
      {job && <section className="card audio-preparation-card" aria-live="polite"><h2>3. Выполнение</h2><p><strong>{job.progress.stage}</strong> · {job.progress.percent}%</p><progress max="100" value={job.progress.percent}>{job.progress.percent}%</progress>{job.preview && <p>Исходно: {duration(job.preview.input_duration_seconds)} · ожидаемый результат: {duration(job.preview.estimated_output_duration_seconds)}{format === "copy" && !job.preview.copy_compatible ? " · файлы несовместимы для copy" : ""}</p>}{job.status === "preview_ready" && <button className="primary" type="button" onClick={start} disabled={busy || (format === "copy" && job.preview?.copy_compatible === false)}>Запустить обработку</button>}{!terminal.has(job.status) && <button type="button" onClick={cancel} disabled={busy}>Отменить</button>}{job.status === "completed" && <div className="actions">{job.output?.download_ready && <a className="button-like primary" href={`/api/audio-preparations/${job.id}/download`}>Скачать результат</a>}{job.output?.source_id && <button className="primary" type="button" onClick={transcribeOutput}>Транскрибировать результат</button>}{job.output?.source_id && <button type="button" onClick={() => void reuseOutput()}>Использовать в новой обработке</button>}{job.output?.google_drive_url && <a className="button-like secondary" href={job.output.google_drive_url} target="_blank" rel="noreferrer">Открыть в Google Drive</a>}</div>}{job.status === "failed" && <p className="error">Обработка не завершена: {job.error_code || "processing_failed"}</p>}</section>}
    </div>
  );
}
