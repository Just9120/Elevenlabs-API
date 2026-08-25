import { useEffect, useMemo, useRef, useState } from "react";
import { api, mutateWithCsrfRetry } from "./apiClient";
import {
  DirectUploadAmbiguousError,
  directUploadTimeoutMs,
  isSafeDirectUploadCapability,
  uploadFileWithProgress,
  type DirectUploadProgress,
} from "./directUpload";
import { formatBytes } from "./formatters";
import {
  LOCAL_AUDIO_MAX_FILES,
  LOCAL_AUDIO_MAX_INPUT_BYTES,
  processLocalAudioFiles,
  type LocalAudioProgress,
  type LocalAudioResult,
} from "./localAudioProcessing";
import * as googlePicker from "./googlePicker";
import { isUsableJobSource, type Source } from "./sourceModel";

type Project = { id: string; title: string };
type AudioJob = {
  id: string;
  status: "preview_queued" | "analyzing" | "preview_ready" | "queued" | "processing" | "cancelled" | "failed" | "completed";
  title: string;
  options?: { output_format?: string };
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
  processing_only: { format: "copy", mono: "preserve", silence: false, threshold: -45, minimum: 1, keep: 0.3 },
  lecture: { format: "flac", mono: "mixdown", silence: true, threshold: -45, minimum: 1.2, keep: 0.35 },
  call: { format: "flac", mono: "mixdown", silence: true, threshold: -45, minimum: 1.8, keep: 0.5 },
} as const;

type UploadProgressView = DirectUploadProgress & {
  filename: string;
  fileIndex: number;
  fileCount: number;
  aggregatePercent: number;
};

type OperationMode = "separate" | "concat";
type ProcessingPath = "studio" | "local";
type LocalResultView = LocalAudioResult & { url: string };

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

function sourceCreatedLabel(source: Source | undefined) {
  if (!source?.source_created_at) return "Дата создания не определена";
  const value = new Date(source.source_created_at);
  if (!Number.isFinite(value.getTime())) return "Дата создания не определена";
  return `Создан: ${new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)}`;
}

function sourceStem(source: Source | undefined) {
  const name = source?.original_filename?.trim() || "Файл";
  return name.replace(/\.[^.]+$/, "") || "Файл";
}

function stageLabel(stage: string) {
  return ({
    preview_queued: "Ожидает проверки",
    validating: "Проверяем файлы",
    preview_ready: "Проверка завершена",
    queued: "Ожидает обработки",
    materializing: "Подготавливаем файлы",
    processing: "Обрабатываем аудио",
    storing: "Сохраняем результат",
    google_drive_upload: "Сохраняем копию в Google Drive",
    completed: "Готово",
    cancelled: "Отменено",
    failed: "Не завершено",
  } as Record<string, string>)[stage] ?? "Выполняется";
}

function errorLabel(code: string | null) {
  return ({
    invalid_input: "Не удалось прочитать один из исходных файлов. Проверьте его целостность и повторите попытку.",
    copy_incompatible: "Файлы нельзя объединить без перекодирования. Выберите WAV или FLAC.",
    channel_unavailable: "Выбранный канал отсутствует в одном из файлов.",
    media_integrity_failed: "Один из файлов повреждён или содержит ошибки декодирования.",
    source_unavailable: "Один из исходных файлов больше недоступен.",
    processing_timeout: "Обработка превысила допустимое время.",
  } as Record<string, string>)[code ?? ""] ?? "Обработка не завершена. Повторите попытку или выгрузите диагностику.";
}

function localErrorLabel(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "";
  if (message === "local_audio_file_count") return `Локально можно обработать от 1 до ${LOCAL_AUDIO_MAX_FILES} файлов за один запуск.`;
  if (message === "local_audio_size_limit") return `Общий размер локальных файлов не должен превышать ${formatBytes(LOCAL_AUDIO_MAX_INPUT_BYTES)}.`;
  if (message === "local_audio_memory_limit") return "Для декодирования этих файлов недостаточно безопасного объёма памяти браузера. Используйте обработку через Studio.";
  if (message === "local_audio_unsupported") return "Этот браузер не поддерживает локальную обработку аудио. Используйте обработку через Studio.";
  if (message.startsWith("local_audio_decode_failed:")) return `Браузер не смог декодировать ${message.split(":").slice(1).join(":")}. Загрузите файл в Studio для server-side FFmpeg обработки.`;
  if (message === "local_audio_right_channel_unavailable") return "В одном из файлов нет правого звукового канала.";
  if (message === "local_audio_sample_rate_mismatch") return "Браузер декодировал файлы с разной частотой. Обработайте их через Studio.";
  if (reason instanceof DOMException && reason.name === "AbortError") return "Локальная обработка отменена.";
  return "Локальная обработка не завершена. Попробуйте обработку через Studio или другой поддерживаемый файл.";
}

export function AudioPreparationPage({ csrf, onCsrf }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [processingPath, setProcessingPath] = useState<ProcessingPath>("studio");
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [operationMode, setOperationMode] = useState<OperationMode>("separate");
  const [manualOrder, setManualOrder] = useState(false);
  const [ephemeral, setEphemeral] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("Обработанное аудио");
  const [preset, setPreset] = useState("processing_only");
  const [format, setFormat] = useState("copy");
  const [mono, setMono] = useState("preserve");
  const [silenceEnabled, setSilenceEnabled] = useState(false);
  const [threshold, setThreshold] = useState(-45);
  const [minimum, setMinimum] = useState(1);
  const [keep, setKeep] = useState(0.3);
  const [saveToDrive, setSaveToDrive] = useState(false);
  const [driveFolder, setDriveFolder] = useState<{ id: string; name: string } | null>(null);
  const [jobs, setJobs] = useState<AudioJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgressView | null>(null);
  const [localProgress, setLocalProgress] = useState<LocalAudioProgress | null>(null);
  const [localResults, setLocalResults] = useState<LocalResultView[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const localFileInput = useRef<HTMLInputElement>(null);
  const localAbort = useRef<AbortController | null>(null);
  const localResultUrls = useRef<string[]>([]);

  const usable = useMemo(() => sources.filter(isUsableJobSource), [sources]);
  const orderedSelected = useMemo(() => {
    if (manualOrder) return selected;
    const position = new Map(selected.map((id, index) => [id, index]));
    return [...selected].sort((leftId, rightId) => {
      const left = sources.find((source) => source.id === leftId);
      const right = sources.find((source) => source.id === rightId);
      const leftTime = left?.source_created_at ? Date.parse(left.source_created_at) : Number.NaN;
      const rightTime = right?.source_created_at ? Date.parse(right.source_created_at) : Number.NaN;
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
      if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) return Number.isFinite(leftTime) ? -1 : 1;
      return (position.get(leftId) ?? 0) - (position.get(rightId) ?? 0);
    });
  }, [manualOrder, selected, sources]);
  const planCount = processingPath === "local" ? localFiles.length : selected.length;

  useEffect(() => () => {
    localAbort.current?.abort();
    localResultUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

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
        if (active && jobs.length > 0) setJobs([parseJob(jobs[0])]);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Не удалось открыть обработку аудио."))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (jobs.length === 0 || jobs.every((job) => terminal.has(job.status))) return;
    const timer = window.setInterval(() => {
      void Promise.all(jobs.map((job) => terminal.has(job.status)
        ? Promise.resolve(job)
        : api<unknown>(`/audio-preparations/${job.id}`, { cache: "no-store" }).then(parseJob)))
        .then(setJobs)
        .catch(() => setError("Не удалось обновить прогресс. Повторите позже."));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [jobs]);

  function toggleSource(id: string) {
    if (processingPath === "local") setFormat("copy");
    setProcessingPath("studio");
    setLocalFiles([]);
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setManualOrder(false);
  }

  function move(index: number, offset: number) {
    if (processingPath === "local") {
      setLocalFiles((current) => {
        const next = [...current];
        const target = index + offset;
        if (target < 0 || target >= next.length) return current;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
      return;
    }
    setSelected(() => {
      const next = [...orderedSelected];
      const target = index + offset;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setManualOrder(true);
  }

  function applyPreset(value: keyof typeof presetDefaults) {
    const next = presetDefaults[value];
    setPreset(value); setFormat(processingPath === "local" ? "wav" : next.format); setMono(next.mono); setSilenceEnabled(next.silence);
    setThreshold(next.threshold); setMinimum(next.minimum); setKeep(next.keep);
  }

  function applyFormat(value: string) {
    if (processingPath === "local") return;
    setFormat(value);
    if (value === "copy") { setMono("preserve"); setSilenceEnabled(false); }
  }

  function applyMono(value: string) {
    setMono(value);
    if (value !== "preserve" && format === "copy") setFormat("flac");
  }

  function applySilence(enabled: boolean) {
    setSilenceEnabled(enabled);
    if (enabled && format === "copy") setFormat("flac");
  }

  async function reuseOutput(job: AudioJob) {
    if (!project || !job.output?.source_id) return;
    await reloadSources(project.id);
    setSelected([job.output.source_id]);
    setProcessingPath("studio");
    setLocalFiles([]);
    setEphemeral(new Set());
    setJobs([]);
  }

  function transcribeOutput(job: AudioJob) {
    const sourceId = job.output?.source_id;
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
      if (processingPath === "local") setFormat("copy");
      setProcessingPath("studio");
      setLocalFiles([]);
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
        setSaveToDrive(true);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось выбрать папку Google Drive."); }
    finally { setBusy(false); }
  }

  async function addLocalFiles(files: File[]) {
    if (!project || files.length === 0) return;
    if (processingPath === "local") setFormat("copy");
    setProcessingPath("studio");
    setLocalFiles([]);
    setBusy(true); setError("");
    const uploaded: string[] = [];
    const failures: string[] = [];
    const aggregateTotalBytes = files.reduce((total, file) => total + file.size, 0);
    let aggregateCompletedBytes = 0;
    for (const [fileIndex, file] of files.entries()) {
      try {
        const mime = file.type || "application/octet-stream";
        const initiated = await mutate<unknown>(
          `/projects/${project.id}/sources/local-upload/initiate`,
          { method: "POST", body: JSON.stringify({ original_filename: file.name, mime_type: mime, size_bytes: file.size }) },
        );
        if (!isSafeDirectUploadCapability(initiated, mime)) throw new Error(`${file.name}: сервер вернул небезопасный ответ для загрузки.`);
        let put: { ok: boolean; status: number } | null = null;
        try {
          put = await uploadFileWithProgress({
            url: initiated.upload.url,
            method: initiated.upload.method,
            headers: initiated.upload.headers,
            file,
            timeoutMs: directUploadTimeoutMs(initiated.upload.expires_in),
            onProgress: (progress) => setUploadProgress({
              ...progress,
              filename: file.name,
              fileIndex: fileIndex + 1,
              fileCount: files.length,
              aggregatePercent: aggregateTotalBytes > 0
                ? Math.min(100, Math.round(((aggregateCompletedBytes + progress.loadedBytes) / aggregateTotalBytes) * 100))
                : 0,
            }),
          });
        } catch (reason) {
          if (!(reason instanceof DirectUploadAmbiguousError)) throw reason;
        }
        if (put !== null && !put.ok) throw new Error(`${file.name}: временное хранилище отклонило загрузку (${put.status}).`);
        await mutate(`/sources/${initiated.source_id}/local-upload/complete`, { method: "POST" });
        uploaded.push(initiated.source_id);
      } catch (reason) {
        const message = reason instanceof Error && reason.message === "direct_upload_progress_unsupported"
          ? "браузер не поддерживает безопасную загрузку с progress; используйте актуальный Chrome/Edge."
          : reason instanceof Error ? reason.message : "не удалось загрузить файл.";
        failures.push(`${file.name}: ${message}`);
      } finally {
        aggregateCompletedBytes += file.size;
      }
    }
    try {
      if (uploaded.length > 0) await reloadSources(project.id);
      setSelected((current) => [...current, ...uploaded.filter((id) => !current.includes(id))]);
      setEphemeral((current) => new Set([...current, ...uploaded]));
      if (failures.length > 0) {
        setError(uploaded.length > 0
          ? `Загрузка завершена частично: ${failures.join(" ")}`
          : `Не удалось загрузить файлы: ${failures.join(" ")}`);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось обновить список загруженных файлов."); }
    finally { setBusy(false); setUploadProgress(null); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function createPreview() {
    if (!project || selected.length === 0) return;
    setBusy(true); setError(""); setJobs([]);
    try {
      const groups = operationMode === "concat"
        ? [orderedSelected]
        : orderedSelected.map((sourceId) => [sourceId]);
      const created: AudioJob[] = [];
      for (const group of groups) {
        const source = sources.find((candidate) => candidate.id === group[0]);
        const jobTitle = groups.length > 1 ? `${title} — ${sourceStem(source)}` : title;
        const value = await mutate<unknown>(`/projects/${project.id}/audio-preparations`, {
          method: "POST",
          body: JSON.stringify({
            title: jobTitle,
            source_ids: group,
            ephemeral_source_ids: group.filter((id) => ephemeral.has(id)),
            manual_order: operationMode === "concat" ? manualOrder : true,
            options: { preset, output_format: format, mono_mode: mono, silence_enabled: silenceEnabled, silence_threshold_db: threshold, silence_min_duration_seconds: minimum, silence_keep_duration_seconds: keep, output_name_template: "{title}" },
            output_destination: saveToDrive ? "google_drive" : "download",
            output_drive_folder_id: saveToDrive ? driveFolder?.id : null,
          }),
        });
        created.push(parseJob(value));
        setJobs([...created]);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось создать preview."); }
    finally { setBusy(false); }
  }

  function chooseLocalFiles(files: File[]) {
    if (files.length === 0) return;
    if (files.length > LOCAL_AUDIO_MAX_FILES) {
      setError(`Локально можно обработать не более ${LOCAL_AUDIO_MAX_FILES} файлов за один запуск.`);
      return;
    }
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes <= 0 || totalBytes > LOCAL_AUDIO_MAX_INPUT_BYTES) {
      setError(`Общий размер локальных файлов не должен превышать ${formatBytes(LOCAL_AUDIO_MAX_INPUT_BYTES)}.`);
      return;
    }
    setError("");
    setProcessingPath("local");
    setLocalFiles(files);
    setSelected([]);
    setEphemeral(new Set());
    setFormat("wav");
    setSaveToDrive(false);
    setJobs([]);
    setLocalResults((current) => {
      current.forEach((result) => URL.revokeObjectURL(result.url));
      localResultUrls.current = [];
      return [];
    });
    setOperationMode("separate");
    if (localFileInput.current) localFileInput.current.value = "";
  }

  async function processLocally() {
    if (localFiles.length === 0 || busy) return;
    setBusy(true);
    setError("");
    setJobs([]);
    localAbort.current?.abort();
    const controller = new AbortController();
    localAbort.current = controller;
    try {
      const results = await processLocalAudioFiles(
        localFiles,
        {
          operationMode,
          channelMode: mono as "preserve" | "mixdown" | "left" | "right",
          silenceEnabled,
          silenceThresholdDb: threshold,
          silenceMinimumSeconds: minimum,
          silenceKeepSeconds: keep,
          title,
        },
        setLocalProgress,
        controller.signal,
      );
      localResultUrls.current.forEach((url) => URL.revokeObjectURL(url));
      const views = results.map((result) => ({ ...result, url: URL.createObjectURL(result.blob) }));
      localResultUrls.current = views.map((result) => result.url);
      setLocalResults(views);
    } catch (reason) {
      setError(localErrorLabel(reason));
    } finally {
      if (localAbort.current === controller) localAbort.current = null;
      setLocalProgress(null);
      setBusy(false);
    }
  }

  async function uploadLocalResult(result: LocalResultView) {
    const file = new File([result.blob], result.filename, {
      type: "audio/wav",
      lastModified: Date.now(),
    });
    await addLocalFiles([file]);
  }

  async function start(job: AudioJob) {
    setBusy(true); setError("");
    try { const updated = parseJob(await mutate(`/audio-preparations/${job.id}/start`, { method: "POST" })); setJobs((current) => current.map((item) => item.id === updated.id ? updated : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось запустить обработку."); }
    finally { setBusy(false); }
  }

  async function cancel(job: AudioJob) {
    setBusy(true); setError("");
    try { const updated = parseJob(await mutate(`/audio-preparations/${job.id}/cancel`, { method: "POST" })); setJobs((current) => current.map((item) => item.id === updated.id ? updated : item)); }
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
          <button type="button" onClick={() => localFileInput.current?.click()} disabled={busy}>Обработать на устройстве</button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || !project}>Загрузить в Studio</button>
          <input aria-label="Выбрать файлы для обработки на устройстве" ref={localFileInput} hidden type="file" multiple accept="audio/*,video/*,.ogg" onChange={(event) => chooseLocalFiles(Array.from(event.target.files || []))} />
          <input aria-label="Выбрать файлы для загрузки в Studio" ref={fileInput} hidden type="file" multiple accept="audio/*,video/*,.ogg" onChange={(event) => void addLocalFiles(Array.from(event.target.files || []))} />
        </div>
        <p className="muted"><strong>На устройстве</strong> не отправляет исходные файлы в Studio и создаёт WAV в текущей вкладке. <strong>Загрузить в Studio</strong> использует временное S3-хранилище и server-side FFmpeg для максимальной совместимости.</p>
        {uploadProgress && <div className="upload-progress" aria-live="polite">
          <p><strong>Файл {uploadProgress.fileIndex} из {uploadProgress.fileCount}:</strong> {uploadProgress.filename}</p>
          <progress aria-label="Общий прогресс загрузки в Studio" max="100" value={uploadProgress.aggregatePercent}>{uploadProgress.aggregatePercent}%</progress>
          <small>{uploadProgress.percent}% текущего файла · {formatBytes(uploadProgress.loadedBytes)} из {formatBytes(uploadProgress.totalBytes)} · всего {uploadProgress.aggregatePercent}%</small>
        </div>}
        <details className="audio-saved-sources">
          <summary>Выбрать из сохранённых файлов Studio</summary>
          <div className="audio-source-grid">
            {usable.length === 0 && <p className="notice">Сохранённых файлов пока нет. Добавьте их с устройства или Google Drive.</p>}
            {usable.map((source) => <label key={source.id} className="audio-source-choice"><input type="checkbox" checked={selected.includes(source.id)} onChange={() => toggleSource(source.id)} /><span>{source.original_filename}<small>{source.source_type === "google_drive" ? "Google Drive" : "Временная копия · удалится после операции, максимум через 24 часа"}</small></span></label>)}
          </div>
        </details>
        {planCount > 0 && <p className="notice">Выбрано файлов: {planCount} · {processingPath === "local" ? "обработка на устройстве" : "обработка через Studio"}</p>}
        {planCount > 1 && <fieldset className="audio-operation-mode">
          <legend>Что сделать с выбранными файлами</legend>
          <label><input type="radio" name="audio-operation-mode" checked={operationMode === "separate"} onChange={() => setOperationMode("separate")} /> Обработать каждый отдельно</label>
          <label><input type="radio" name="audio-operation-mode" checked={operationMode === "concat"} onChange={() => setOperationMode("concat")} /> Склеить в один файл</label>
        </fieldset>}
        {processingPath === "studio" && selected.length > 0 && <div className="audio-selection-plan">
          <h3>{operationMode === "concat" && selected.length > 1 ? "Порядок склейки" : "План результатов"}</h3>
          <ol className="audio-order-list">
            {orderedSelected.map((id, index) => {
              const source = sources.find((candidate) => candidate.id === id);
              return <li key={id}>
                <span className="audio-order-index" aria-hidden="true">{index + 1}</span>
                <span><strong>{source?.original_filename || "Файл"}</strong><small>{sourceCreatedLabel(source)} · {source?.source_type === "google_drive" ? "Google Drive" : "Studio"}{source?.size_bytes ? ` · ${formatBytes(source.size_bytes)}` : ""}</small></span>
                {operationMode === "concat" && selected.length > 1 && <span className="audio-order-controls"><button type="button" aria-label={`Переместить файл ${index + 1} выше`} onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button type="button" aria-label={`Переместить файл ${index + 1} ниже`} onClick={() => move(index, 1)} disabled={index === selected.length - 1}>↓</button></span>}
              </li>;
            })}
          </ol>
          <p className="notice">{operationMode === "concat" && selected.length > 1 ? `Будут склеены ${selected.length} файла в порядке 1 → ${selected.length}.` : `Будет создано результатов: ${selected.length}.`}</p>
          {operationMode === "concat" && orderedSelected.some((id) => !sources.find((source) => source.id === id)?.source_created_at) && <p className="warning">Для части файлов дата создания не определена. Проверьте порядок вручную: название файла не используется как источник времени.</p>}
        </div>}
        {processingPath === "local" && localFiles.length > 0 && <div className="audio-selection-plan">
          <h3>{operationMode === "concat" && localFiles.length > 1 ? "Порядок склейки" : "План результатов"}</h3>
          <ol className="audio-order-list">
            {localFiles.map((file, index) => <li key={`${file.name}:${file.size}:${file.lastModified}:${index}`}>
              <span className="audio-order-index" aria-hidden="true">{index + 1}</span>
              <span><strong>{file.name}</strong><small>Файл остаётся на устройстве · {formatBytes(file.size)} · дата создания недоступна browser File API</small></span>
              {operationMode === "concat" && localFiles.length > 1 && <span className="audio-order-controls"><button type="button" aria-label={`Переместить локальный файл ${index + 1} выше`} onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button type="button" aria-label={`Переместить локальный файл ${index + 1} ниже`} onClick={() => move(index, 1)} disabled={index === localFiles.length - 1}>↓</button></span>}
            </li>)}
          </ol>
          <p className="notice">{operationMode === "concat" && localFiles.length > 1 ? `Будут локально склеены ${localFiles.length} файла в порядке 1 → ${localFiles.length}.` : `Будет создано локальных WAV-файлов: ${localFiles.length}.`}</p>
          <p className="warning">Браузер не предоставляет надёжную дату создания локального media file. Порядок сохраняется ровно как выбран и может быть изменён вручную.</p>
        </div>}
      </section>
      <section className="card audio-preparation-card">
        <h2>2. Параметры</h2>
        <div className="audio-settings-grid">
          <label>Сценарий<select value={preset} onChange={(e) => applyPreset(e.target.value as keyof typeof presetDefaults)}><option value="processing_only">Свои настройки</option><option value="lecture">Лекция</option><option value="call">Созвон</option></select></label>
          <label>Формат результата<select aria-label="Формат результата" value={format} disabled={processingPath === "local"} onChange={(e) => applyFormat(e.target.value)}><option value="copy">Сохранить исходный формат</option><option value="wav">WAV</option><option value="flac">FLAC</option></select>{processingPath === "local" && <small>Локальная обработка создаёт WAV. FLAC и сохранение исходного container доступны через Studio.</small>}</label>
          <label>Звуковые каналы<select value={mono} onChange={(e) => applyMono(e.target.value)}><option value="preserve">Сохранить как в оригинале</option><option value="mixdown">Объединить в mono</option><option value="left">Только левый канал</option><option value="right">Только правый канал</option></select></label>
          <label>Название результата<input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} /></label>
        </div>
        {format !== "copy" && <p className="muted">Для изменения каналов или пауз файл будет перекодирован в выбранный формат.</p>}
        <label className="audio-source-choice"><input type="checkbox" checked={silenceEnabled} onChange={(e) => applySilence(e.target.checked)} /><span>Уменьшить длинные паузы в аудио или видео</span></label>
        {silenceEnabled && <details className="audio-advanced-settings"><summary>Дополнительные настройки пауз</summary><div className="audio-settings-grid"><label>Что считать тишиной, dB<input type="number" min="-60" max="-10" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /><small>Звук тише {threshold} dB считается паузой.</small></label><label>Минимальная пауза, сек<input type="number" min="0.2" max="10" step="0.1" value={minimum} onChange={(e) => setMinimum(Number(e.target.value))} /></label><label>Сколько паузы оставить, сек<input type="number" min="0" max="5" step="0.1" value={keep} onChange={(e) => setKeep(Number(e.target.value))} /></label></div></details>}
        {processingPath === "studio" ? <fieldset className="audio-drive-save"><legend>Сохранение</legend><label><input type="checkbox" checked={saveToDrive} onChange={(e) => setSaveToDrive(e.target.checked)} /> Автоматически сохранить копию в Google Drive</label>{saveToDrive && <div className="actions"><button type="button" onClick={chooseOutputFolder} disabled={busy}>Выбрать папку</button>{driveFolder && <span>{driveFolder.name}</span>}</div>}<small>Скачать результат и передать его в транскрибацию можно будет после обработки независимо от этой настройки.</small></fieldset> : <p className="notice">Локальный результат останется в браузере до закрытия или перезагрузки вкладки. После обработки его можно скачать либо явно загрузить в Studio для Google Drive или транскрибации.</p>}
        {localProgress && <div className="upload-progress" aria-live="polite"><p><strong>{localProgress.stage === "decoding" ? "Декодируем" : localProgress.stage === "processing" ? "Обрабатываем" : localProgress.stage === "encoding" ? "Создаём WAV" : "Читаем файл"}</strong>{localProgress.filename ? `: ${localProgress.filename}` : ""}</p><progress aria-label="Прогресс локальной обработки" max="100" value={localProgress.percent}>{localProgress.percent}%</progress><small>{localProgress.percent}% · исходные файлы не отправляются в сеть</small><button type="button" onClick={() => localAbort.current?.abort()}>Отменить локальную обработку</button></div>}
        <button className="primary" type="button" disabled={busy || planCount === 0 || !title.trim() || (processingPath === "studio" && saveToDrive && !driveFolder)} onClick={() => processingPath === "local" ? void processLocally() : void createPreview()}>{processingPath === "local" ? "Обработать на устройстве" : "Проверить файлы и рассчитать"}</button>
      </section>
      {localResults.length > 0 && <section className="card audio-preparation-card" aria-live="polite"><h2>3. Локальные результаты</h2>{localResults.map((result, index) => <article className="audio-job-result" key={result.url}><h3>{localResults.length > 1 ? `Результат ${index + 1}: ${result.filename}` : result.filename}</h3><p>Исходно: {duration(result.inputDurationSeconds)} · результат: {duration(result.outputDurationSeconds)}</p><div className="actions"><a className="button-like primary" href={result.url} download={result.filename}>Скачать файл</a><button type="button" onClick={() => void uploadLocalResult(result)} disabled={busy}>Загрузить в Studio для Drive или транскрибации</button></div></article>)}</section>}
      {jobs.length > 0 && <section className="card audio-preparation-card" aria-live="polite"><h2>3. Выполнение</h2>{jobs.map((job, index) => <article className="audio-job-result" key={job.id}><h3>{jobs.length > 1 ? `Результат ${index + 1}: ${job.title}` : job.title}</h3><p><strong>{stageLabel(job.progress.stage)}</strong> · {job.progress.percent}%</p><progress max="100" value={job.progress.percent}>{job.progress.percent}%</progress>{job.preview && <p>Исходно: {duration(job.preview.input_duration_seconds)} · ожидаемый результат: {duration(job.preview.estimated_output_duration_seconds)}{job.options?.output_format === "copy" && !job.preview.copy_compatible ? " · требуется WAV или FLAC для объединения этих файлов" : ""}</p>}{job.status === "preview_ready" && <button className="primary" type="button" onClick={() => void start(job)} disabled={busy || (job.options?.output_format === "copy" && job.preview?.copy_compatible === false)}>Запустить обработку</button>}{!terminal.has(job.status) && <button type="button" onClick={() => void cancel(job)} disabled={busy}>Отменить</button>}{job.status === "completed" && <div className="actions">{job.output?.download_ready && <a className="button-like primary" href={`/api/audio-preparations/${job.id}/download`}>Скачать файл</a>}{job.output?.source_id && <button className="primary" type="button" onClick={() => transcribeOutput(job)}>Использовать для транскрибации</button>}{job.output?.source_id && <button type="button" onClick={() => void reuseOutput(job)}>Использовать в новой обработке</button>}{job.output?.google_drive_url && <a className="button-like secondary" href={job.output.google_drive_url} target="_blank" rel="noreferrer">Открыть в Google Drive</a>}</div>}{job.status === "failed" && <p className="error">{errorLabel(job.error_code)}</p>}</article>)}</section>}
    </div>
  );
}
