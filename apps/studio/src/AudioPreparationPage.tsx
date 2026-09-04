import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { api, mutateWithCsrfRetry } from "./apiClient";
import {
  DirectUploadAmbiguousError,
  directUploadTimeoutMs,
  isMultipartDirectUploadCapability,
  isSafeDirectUploadCapability,
  isSafeMultipartPartCapability,
  parseMultipartStatus,
  uploadFileWithProgress,
  type DirectUploadCapability,
  type DirectUploadProgress,
} from "./directUpload";
import { formatBytes } from "./formatters";
import { DirectDriveUploadPanel } from "./DirectDriveUploadPanel";
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
type SourceMode = "drive" | "local" | "studio" | "direct-drive";
type LocalResultView = LocalAudioResult & { url: string };

const sourceModes: SourceMode[] = ["drive", "local", "studio", "direct-drive"];

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
  if (!value || typeof value !== "object" || typeof (value as AudioJob).id !== "string") throw new Error("Studio вернула некорректное состояние обработки. Обновите страницу и повторите попытку.");
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
    probe_unavailable: "Studio сейчас не может проверить параметры файла. Выгрузите диагностику и обратитесь к администратору.",
    probe_failed: "Не удалось определить параметры одного из исходных файлов.",
    source_unavailable: "Один из исходных файлов больше недоступен.",
    processing_failed: "Studio не смогла обработать выбранные файлы. Выгрузите диагностику для уточнения причины.",
    processing_timeout: "Обработка превысила допустимое время.",
    output_too_large: "Готовый файл превысил допустимый размер результата. Выберите FLAC/mono или разделите обработку на несколько запусков.",
  } as Record<string, string>)[code ?? ""] ?? "Обработка не завершена. Повторите попытку или выгрузите диагностику.";
}

function localErrorLabel(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "";
  if (message === "local_audio_file_count") return `Локально можно обработать от 1 до ${LOCAL_AUDIO_MAX_FILES} файлов за один запуск.`;
  if (message === "local_audio_size_limit") return `Общий размер локальных файлов не должен превышать ${formatBytes(LOCAL_AUDIO_MAX_INPUT_BYTES)}.`;
  if (message === "local_audio_memory_limit") return "Для декодирования этих файлов недостаточно безопасного объёма памяти браузера. Используйте обработку через Studio.";
  if (message === "local_audio_unsupported") return "Этот браузер не поддерживает локальную обработку аудио. Используйте обработку через Studio.";
  if (message.startsWith("local_audio_decode_failed:")) return `Браузер не смог прочитать ${message.split(":").slice(1).join(":")}. Выберите «Загрузить в Studio» и повторите обработку.`;
  if (message === "local_audio_right_channel_unavailable") return "В одном из файлов нет правого звукового канала.";
  if (message === "local_audio_sample_rate_mismatch") return "Браузер декодировал файлы с разной частотой. Обработайте их через Studio.";
  if (reason instanceof DOMException && reason.name === "AbortError") return "Локальная обработка отменена.";
  return "Локальная обработка не завершена. Попробуйте обработку через Studio или другой поддерживаемый файл.";
}

export function AudioPreparationPage({ csrf, onCsrf }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>("drive");
  const [processingPath, setProcessingPath] = useState<ProcessingPath>("studio");
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [operationMode, setOperationMode] = useState<OperationMode>("separate");
  const [manualOrder, setManualOrder] = useState(false);
  const [ephemeral, setEphemeral] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
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

  function selectSourceMode(mode: SourceMode) {
    setSourceMode(mode);
    setError("");
  }

  function sourceTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    mode: SourceMode,
  ) {
    const currentIndex = sourceModes.indexOf(mode);
    let nextIndex: number;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % sourceModes.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + sourceModes.length) % sourceModes.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = sourceModes.length - 1;
    else return;
    event.preventDefault();
    const nextMode = sourceModes[nextIndex];
    selectSourceMode(nextMode);
    document.getElementById(`audio-source-tab-${nextMode}`)?.focus();
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
    setSourceMode("studio");
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
      setSourceMode("drive");
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

  async function readMultipartUploadStatus(sourceId: string, partCount: number) {
    try {
      return parseMultipartStatus(
        await api<unknown>(`/sources/${sourceId}/local-upload/multipart/status`, { cache: "no-store" }),
        partCount,
      );
    } catch {
      return null;
    }
  }

  async function issueMultipartPart(sourceId: string, partNumber: number) {
    const capability = await mutate<unknown>(
      `/sources/${sourceId}/local-upload/multipart/parts/${partNumber}`,
      { method: "POST" },
    );
    if (!isSafeMultipartPartCapability(capability, partNumber)) {
      throw new DirectUploadAmbiguousError("multipart_part_capability_unavailable");
    }
    return capability;
  }

  async function uploadMultipartFile(
    initiated: DirectUploadCapability,
    file: File,
    onProgress: (progress: DirectUploadProgress) => void,
  ) {
    if (!isMultipartDirectUploadCapability(initiated)) {
      throw new Error("invalid_multipart_capability");
    }
    const { part_count: partCount, part_size_bytes: partSize } = initiated.upload;
    for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(file.size, start + partSize);
      const blob = file.slice(start, end, file.type || "application/octet-stream");
      let confirmed = false;
      for (let attempt = 0; attempt < 2 && !confirmed; attempt += 1) {
        const capability = await issueMultipartPart(initiated.source_id, partNumber);
        let outcome: { ok: boolean; status: number } | null = null;
        let ambiguous = false;
        try {
          outcome = await uploadFileWithProgress({
            url: capability.upload.url,
            method: capability.upload.method,
            headers: capability.upload.headers,
            file: blob,
            timeoutMs: directUploadTimeoutMs(capability.upload.expires_in),
            onProgress: (progress) => onProgress({
              loadedBytes: Math.min(file.size, start + progress.loadedBytes),
              totalBytes: file.size,
              percent: file.size > 0
                ? Math.min(100, Math.round(((start + progress.loadedBytes) / file.size) * 100))
                : 0,
            }),
          });
        } catch (reason) {
          if (!(reason instanceof DirectUploadAmbiguousError)) throw reason;
          ambiguous = true;
        }
        if (outcome && !outcome.ok) {
          throw new Error(`${file.name}: часть файла не загрузилась (HTTP ${outcome.status}). Повторите попытку.`);
        }
        const status = await readMultipartUploadStatus(initiated.source_id, partCount);
        confirmed = status?.uploadedParts.includes(partNumber) === true;
        if (!confirmed && !ambiguous) {
          throw new Error(`${file.name}: Studio не подтвердила загруженную часть файла.`);
        }
      }
      if (!confirmed) {
        throw new DirectUploadAmbiguousError("multipart_part_unconfirmed");
      }
      onProgress({
        loadedBytes: end,
        totalBytes: file.size,
        percent: file.size > 0 ? Math.min(100, Math.round((end / file.size) * 100)) : 0,
      });
    }
    await mutate(`/sources/${initiated.source_id}/local-upload/multipart/complete`, { method: "POST" });
  }

  async function addLocalFiles(files: File[]) {
    if (!project || files.length === 0) return;
    if (processingPath === "local") setFormat("copy");
    setProcessingPath("studio");
    setSourceMode("studio");
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
          { method: "POST", body: JSON.stringify({ original_filename: file.name, mime_type: mime, size_bytes: file.size, reference_class: "audio_processing" }) },
        );
        if (!isSafeDirectUploadCapability(initiated, mime)) throw new Error(`${file.name}: Studio не смогла подготовить загрузку. Повторите попытку.`);
        const reportProgress = (progress: DirectUploadProgress) => setUploadProgress({
              ...progress,
              filename: file.name,
              fileIndex: fileIndex + 1,
              fileCount: files.length,
              aggregatePercent: aggregateTotalBytes > 0
                ? Math.min(100, Math.round(((aggregateCompletedBytes + progress.loadedBytes) / aggregateTotalBytes) * 100))
                : 0,
            });
        if (isMultipartDirectUploadCapability(initiated)) {
          await uploadMultipartFile(initiated, file, reportProgress);
        } else {
          let put: { ok: boolean; status: number } | null = null;
          try {
            put = await uploadFileWithProgress({
              url: initiated.upload.url,
              method: initiated.upload.method,
              headers: initiated.upload.headers,
              file,
              timeoutMs: directUploadTimeoutMs(initiated.upload.expires_in),
              onProgress: reportProgress,
            });
          } catch (reason) {
            if (!(reason instanceof DirectUploadAmbiguousError)) throw reason;
          }
          if (put !== null && !put.ok) throw new Error(`${file.name}: файл не загрузился. Повторите попытку.`);
          await mutate(`/sources/${initiated.source_id}/local-upload/complete`, { method: "POST" });
        }
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
        const requestedTitle = title.trim();
        const sourceTitle = sourceStem(source);
        const jobTitle = requestedTitle
          ? groups.length > 1 ? `${requestedTitle} — ${sourceTitle}` : requestedTitle
          : sourceTitle;
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось проверить файлы."); }
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
    setSourceMode("local");
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
      <section className="hero"><div><p className="eyebrow">ПОДГОТОВКА ЗАПИСИ</p><h1>Подготовка аудио</h1><p>Склейте записи, сократите длинные паузы, настройте каналы или просто сохраните исходные файлы в Google Drive.</p></div></section>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="card audio-preparation-card">
        <h2>1. Исходные файлы</h2>
        <div className="tabs audio-source-tabs" role="tablist" aria-label="Способ получения исходных файлов">
          <button id="audio-source-tab-drive" type="button" role="tab" aria-selected={sourceMode === "drive"} aria-controls="audio-source-panel-drive" tabIndex={sourceMode === "drive" ? 0 : -1} className={sourceMode === "drive" ? "active" : ""} onClick={() => selectSourceMode("drive")} onKeyDown={(event) => sourceTabKeyDown(event, "drive")}>Из Google Drive</button>
          <button id="audio-source-tab-local" type="button" role="tab" aria-selected={sourceMode === "local"} aria-controls="audio-source-panel-local" tabIndex={sourceMode === "local" ? 0 : -1} className={sourceMode === "local" ? "active" : ""} onClick={() => selectSourceMode("local")} onKeyDown={(event) => sourceTabKeyDown(event, "local")}>Обработать на устройстве</button>
          <button id="audio-source-tab-studio" type="button" role="tab" aria-selected={sourceMode === "studio"} aria-controls="audio-source-panel-studio" tabIndex={sourceMode === "studio" ? 0 : -1} className={sourceMode === "studio" ? "active" : ""} onClick={() => selectSourceMode("studio")} onKeyDown={(event) => sourceTabKeyDown(event, "studio")}>Загрузить в Studio</button>
          <button id="audio-source-tab-direct-drive" type="button" role="tab" aria-selected={sourceMode === "direct-drive"} aria-controls="audio-source-panel-direct-drive" tabIndex={sourceMode === "direct-drive" ? 0 : -1} className={sourceMode === "direct-drive" ? "active" : ""} onClick={() => selectSourceMode("direct-drive")} onKeyDown={(event) => sourceTabKeyDown(event, "direct-drive")}>В Google Drive без обработки</button>
        </div>
        {sourceMode === "drive" && <div role="tabpanel" id="audio-source-panel-drive" aria-labelledby="audio-source-tab-drive" className="audio-source-mode-panel"><p className="muted">Выберите записи, которые уже находятся в Google Drive.</p><button type="button" onClick={addFromDrive} disabled={busy || !project}>Выбрать файлы в Google Drive</button></div>}
        {sourceMode === "local" && <div role="tabpanel" id="audio-source-panel-local" aria-labelledby="audio-source-tab-local" className="audio-source-mode-panel"><p className="muted">Обработка выполняется в этой вкладке, а исходные файлы не отправляются в Studio.</p><button type="button" onClick={() => localFileInput.current?.click()} disabled={busy}>Выбрать для обработки на устройстве</button><input aria-label="Выбрать файлы для обработки на устройстве" ref={localFileInput} hidden type="file" multiple accept="audio/*,video/*,.ogg" onChange={(event) => chooseLocalFiles(Array.from(event.target.files || []))} /></div>}
        {sourceMode === "studio" && <div role="tabpanel" id="audio-source-panel-studio" aria-labelledby="audio-source-tab-studio" className="audio-source-mode-panel"><p className="muted">Загрузите записи для более совместимой обработки и сохранения результата после закрытия вкладки.</p><details className="technical-details"><summary>Как это работает</summary><p className="muted">Studio хранит временную приватную копию и обрабатывает её на сервере с помощью FFmpeg.</p></details><button type="button" onClick={() => fileInput.current?.click()} disabled={busy || !project}>Выбрать и загрузить в Studio</button><input aria-label="Выбрать файлы для загрузки в Studio" ref={fileInput} hidden type="file" multiple accept="audio/*,video/*,.ogg" onChange={(event) => void addLocalFiles(Array.from(event.target.files || []))} />{uploadProgress && <div className="upload-progress" aria-live="polite"><p><strong>Файл {uploadProgress.fileIndex} из {uploadProgress.fileCount}:</strong> {uploadProgress.filename}</p><progress aria-label="Общий прогресс загрузки в Studio" max="100" value={uploadProgress.aggregatePercent}>{uploadProgress.aggregatePercent}%</progress><small>{uploadProgress.percent}% текущего файла · {formatBytes(uploadProgress.loadedBytes)} из {formatBytes(uploadProgress.totalBytes)} · всего {uploadProgress.aggregatePercent}%</small></div>}</div>}
        {sourceMode === "direct-drive" && project && <DirectDriveUploadPanel projectId={project.id} csrf={csrf} onCsrf={onCsrf} />}
        {sourceMode === "direct-drive" && !project && <p className="notice">Подготавливаем рабочую область…</p>}
        {sourceMode !== "direct-drive" && <><details className="audio-saved-sources">
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
              <span><strong>{file.name}</strong><small>Файл остаётся на устройстве · {formatBytes(file.size)} · дата создания не передаётся браузером</small></span>
              {operationMode === "concat" && localFiles.length > 1 && <span className="audio-order-controls"><button type="button" aria-label={`Переместить локальный файл ${index + 1} выше`} onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button type="button" aria-label={`Переместить локальный файл ${index + 1} ниже`} onClick={() => move(index, 1)} disabled={index === localFiles.length - 1}>↓</button></span>}
            </li>)}
          </ol>
          <p className="notice">{operationMode === "concat" && localFiles.length > 1 ? `Будут локально склеены ${localFiles.length} файла в порядке 1 → ${localFiles.length}.` : `Будет создано локальных WAV-файлов: ${localFiles.length}.`}</p>
          <p className="warning">Браузер не предоставляет надёжную дату создания локального файла. Порядок сохраняется ровно как выбран и может быть изменён вручную.</p>
        </div>}</>}
      </section>
      {sourceMode !== "direct-drive" && <section className="card audio-preparation-card">
        <h2>2. Параметры</h2>
        <div className="audio-settings-grid">
          <label>Сценарий<select value={preset} onChange={(e) => applyPreset(e.target.value as keyof typeof presetDefaults)}><option value="processing_only">Свои настройки</option><option value="lecture">Лекция</option><option value="call">Созвон</option></select></label>
          <label>Формат результата<select aria-label="Формат результата" value={format} disabled={processingPath === "local"} onChange={(e) => applyFormat(e.target.value)}><option value="copy">Сохранить исходный формат</option><option value="wav">WAV</option><option value="flac">FLAC</option></select>{processingPath === "local" && <small>Обработка на устройстве создаёт WAV. Другие варианты доступны при обработке через Studio.</small>}{processingPath === "studio" && format === "flac" && <><small>FLAC сохраняет исходную частоту дискретизации без потерь качества.</small><details className="technical-details"><summary>Технические сведения о FLAC</summary><small>FLAC создаётся в 16-bit PCM без lossy-сжатия.</small></details></>}</label>
          <label>Звуковые каналы<select value={mono} onChange={(e) => applyMono(e.target.value)}><option value="preserve">Сохранить как в оригинале</option><option value="mixdown">Объединить в mono</option><option value="left">Только левый канал</option><option value="right">Только правый канал</option></select></label>
          <label>
            Название результата
            <input
              value={title}
              maxLength={160}
              placeholder="Имя исходного файла"
              onChange={(e) => setTitle(e.target.value)}
            />
            <small>Необязательно. Если оставить поле пустым, используется имя исходного файла.</small>
          </label>
        </div>
        {format !== "copy" && <p className="muted">Для изменения каналов или пауз файл будет перекодирован в выбранный формат.</p>}
        <label className="audio-source-choice"><input type="checkbox" checked={silenceEnabled} onChange={(e) => applySilence(e.target.checked)} /><span>Уменьшить длинные паузы в аудио или видео</span></label>
        {silenceEnabled && <details className="audio-advanced-settings"><summary>Дополнительные настройки пауз</summary><div className="audio-settings-grid"><label>Что считать тишиной, dB<input type="number" min="-60" max="-10" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /><small>Звук тише {threshold} dB считается паузой.</small></label><label>Минимальная пауза, сек<input type="number" min="0.2" max="10" step="0.1" value={minimum} onChange={(e) => setMinimum(Number(e.target.value))} /></label><label>Сколько паузы оставить, сек<input type="number" min="0" max="5" step="0.1" value={keep} onChange={(e) => setKeep(Number(e.target.value))} /></label></div></details>}
        {processingPath === "studio" ? <fieldset className="audio-drive-save"><legend>Сохранение</legend><label><input type="checkbox" checked={saveToDrive} onChange={(e) => setSaveToDrive(e.target.checked)} /> Автоматически сохранить копию в Google Drive</label>{saveToDrive && <div className="actions"><button type="button" onClick={chooseOutputFolder} disabled={busy}>Выбрать папку</button>{driveFolder && <span>{driveFolder.name}</span>}</div>}<small>Скачать результат и передать его в транскрибацию можно будет после обработки независимо от этой настройки.</small></fieldset> : <p className="notice">Локальный результат останется в браузере до закрытия или перезагрузки вкладки. После обработки его можно скачать либо явно загрузить в Studio для Google Drive или транскрибации.</p>}
        {localProgress && <div className="upload-progress" aria-live="polite"><p><strong>{localProgress.stage === "decoding" ? "Декодируем" : localProgress.stage === "processing" ? "Обрабатываем" : localProgress.stage === "encoding" ? "Создаём WAV" : "Читаем файл"}</strong>{localProgress.filename ? `: ${localProgress.filename}` : ""}</p><progress aria-label="Прогресс локальной обработки" max="100" value={localProgress.percent}>{localProgress.percent}%</progress><small>{localProgress.percent}% · исходные файлы не отправляются в сеть</small><button type="button" onClick={() => localAbort.current?.abort()}>Отменить локальную обработку</button></div>}
        <button className="primary" type="button" disabled={busy || planCount === 0 || (processingPath === "studio" && saveToDrive && !driveFolder)} onClick={() => processingPath === "local" ? void processLocally() : void createPreview()}>{processingPath === "local" ? "Обработать на устройстве" : "Проверить файлы и рассчитать"}</button>
      </section>}
      {sourceMode !== "direct-drive" && localResults.length > 0 && <section className="card audio-preparation-card" aria-live="polite"><h2>3. Локальные результаты</h2>{localResults.map((result, index) => <article className="audio-job-result" key={result.url}><h3>{localResults.length > 1 ? `Результат ${index + 1}: ${result.filename}` : result.filename}</h3><p>Исходно: {duration(result.inputDurationSeconds)} · результат: {duration(result.outputDurationSeconds)}</p><div className="actions"><a className="button-like primary" href={result.url} download={result.filename}>Скачать файл</a><button type="button" onClick={() => void uploadLocalResult(result)} disabled={busy}>Загрузить в Studio для Drive или транскрибации</button></div></article>)}</section>}
      {sourceMode !== "direct-drive" && jobs.length > 0 && <section className="card audio-preparation-card" aria-live="polite"><h2>3. Выполнение</h2>{jobs.map((job, index) => <article className="audio-job-result" key={job.id}><h3>{jobs.length > 1 ? `Результат ${index + 1}: ${job.title}` : job.title}</h3><p><strong>{stageLabel(job.progress.stage)}</strong> · {job.progress.percent}%</p><progress max="100" value={job.progress.percent}>{job.progress.percent}%</progress>{job.preview && <p>Исходно: {duration(job.preview.input_duration_seconds)} · ожидаемый результат: {duration(job.preview.estimated_output_duration_seconds)}{job.options?.output_format === "copy" && !job.preview.copy_compatible ? " · требуется WAV или FLAC для объединения этих файлов" : ""}</p>}{job.status === "preview_ready" && <button className="primary" type="button" onClick={() => void start(job)} disabled={busy || (job.options?.output_format === "copy" && job.preview?.copy_compatible === false)}>Запустить обработку</button>}{!terminal.has(job.status) && <button type="button" onClick={() => void cancel(job)} disabled={busy}>Отменить</button>}{job.status === "completed" && <div className="actions">{job.output?.download_ready && <a className="button-like primary" href={`/api/audio-preparations/${job.id}/download`}>Скачать файл</a>}{job.output?.source_id && <button className="primary" type="button" onClick={() => transcribeOutput(job)}>Использовать для транскрибации</button>}{job.output?.source_id && <button type="button" onClick={() => void reuseOutput(job)}>Использовать в новой обработке</button>}{job.output?.google_drive_url && <a className="button-like secondary" href={job.output.google_drive_url} target="_blank" rel="noreferrer">Открыть в Google Drive</a>}</div>}{job.status === "failed" && <p className="error">{errorLabel(job.error_code)}</p>}</article>)}</section>}
    </div>
  );
}
