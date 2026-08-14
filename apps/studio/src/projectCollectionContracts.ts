import { api } from "./apiClient";
import type {
  JobMediaClip,
  JobOutputFolder,
  TranscriptionJob,
} from "./jobModel";
import { LATEST_REQUEST_CANCEL_REASON } from "./latestRequest";
import type { Source } from "./sourceModel";

const JOB_STATUSES = new Set([
  "queued",
  "processing",
  "cancelled",
  "failed",
  "completed",
]);
const SOURCE_STATUSES = new Set([
  "pending",
  "uploaded",
  "deleted",
  "expired",
  "failed",
]);

export function parseProjectSourceCollection(
  candidate: unknown,
  projectId: string,
): Source[] | null {
  if (!isRecord(candidate) || !Array.isArray(candidate.sources)) return null;
  const sources: Source[] = [];
  for (const rawSource of candidate.sources) {
    const source = parseSource(rawSource, projectId);
    if (!source) return null;
    sources.push(source);
  }
  return hasUniqueIds(sources) ? sources : null;
}

export function parseProjectJobCollection(
  candidate: unknown,
  projectId: string,
): TranscriptionJob[] | null {
  if (!isRecord(candidate) || !Array.isArray(candidate.jobs)) return null;
  const jobs: TranscriptionJob[] = [];
  for (const rawJob of candidate.jobs) {
    const job = parseJob(rawJob, projectId);
    if (!job) return null;
    jobs.push(job);
  }
  return hasUniqueIds(jobs) ? jobs : null;
}

export async function requestProjectSourceCollection(
  projectId: string,
  signal?: AbortSignal,
): Promise<Source[]> {
  const candidate = await api<unknown>(`/projects/${projectId}/sources`, {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const sources = parseProjectSourceCollection(candidate, projectId);
  if (!sources) throw new Error("invalid_project_source_collection");
  return sources;
}

export async function requestProjectJobCollection(
  projectId: string,
  signal?: AbortSignal,
): Promise<TranscriptionJob[]> {
  const candidate = await api<unknown>(`/projects/${projectId}/jobs`, {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const jobs = parseProjectJobCollection(candidate, projectId);
  if (!jobs) throw new Error("invalid_project_job_collection");
  return jobs;
}

function parseSource(candidate: unknown, projectId: string): Source | null {
  if (!isRecord(candidate)) return null;
  const id = boundedString(candidate.id, 36);
  const candidateProjectId = boundedString(candidate.project_id, 36);
  const originalFilename = boundedString(candidate.original_filename, 255);
  const mimeType = nullableBoundedString(candidate.mime_type, 255);
  const driveFileUrl = nullableBoundedString(candidate.drive_file_url, 2_000);
  const deleteReason = nullableBoundedString(candidate.delete_reason, 80);
  if (
    !id ||
    candidateProjectId !== projectId ||
    !originalFilename ||
    (candidate.source_type !== "local_upload" &&
      candidate.source_type !== "google_drive") ||
    !SOURCE_STATUSES.has(String(candidate.upload_status)) ||
    mimeType === undefined ||
    driveFileUrl === undefined ||
    deleteReason === undefined ||
    !isNullableNonNegativeInteger(candidate.size_bytes) ||
    !isNullableIsoDate(candidate.uploaded_at) ||
    !isNullableIsoDate(candidate.expires_at) ||
    !isNullableIsoDate(candidate.deleted_at) ||
    !isIsoDate(candidate.created_at) ||
    !isIsoDate(candidate.updated_at)
  ) {
    return null;
  }
  return {
    id,
    project_id: candidateProjectId,
    source_type: candidate.source_type,
    original_filename: originalFilename,
    mime_type: mimeType,
    size_bytes: candidate.size_bytes,
    drive_file_url: driveFileUrl,
    upload_status: candidate.upload_status as Source["upload_status"],
    uploaded_at: candidate.uploaded_at,
    expires_at: candidate.expires_at,
    deleted_at: candidate.deleted_at,
    delete_reason: deleteReason,
    created_at: candidate.created_at,
    updated_at: candidate.updated_at,
  };
}

function parseJob(
  candidate: unknown,
  projectId: string,
): TranscriptionJob | null {
  if (!isRecord(candidate)) return null;
  const id = boundedString(candidate.id, 36);
  const candidateProjectId = boundedString(candidate.project_id, 36);
  const title = nullableBoundedString(candidate.title, 160);
  const provider = nullableBoundedString(candidate.provider, 40);
  const errorCode = nullableBoundedString(candidate.error_code, 80);
  const errorMessage = nullableBoundedString(candidate.error_message, 512);
  const mediaClip = parseOptionalMediaClip(candidate.media_clip);
  const outputFolder = parseOptionalOutputFolder(candidate.output_folder);
  const languageMode = candidate.language_mode;
  const diarizationEnabled = candidate.diarization_enabled;
  const terminalDismissedAt = candidate.terminal_dismissed_at;
  if (
    !id ||
    candidateProjectId !== projectId ||
    !JOB_STATUSES.has(String(candidate.status)) ||
    title === undefined ||
    provider === undefined ||
    errorCode === undefined ||
    errorMessage === undefined ||
    mediaClip === false ||
    outputFolder === false ||
    (languageMode !== undefined &&
      languageMode !== null &&
      languageMode !== "ru" &&
      languageMode !== "detect") ||
    (diarizationEnabled !== undefined &&
      typeof diarizationEnabled !== "boolean") ||
    (terminalDismissedAt !== undefined &&
      !isNullableIsoDate(terminalDismissedAt)) ||
    !isNonNegativeInteger(candidate.source_count) ||
    !isIsoDate(candidate.created_at) ||
    !isIsoDate(candidate.updated_at) ||
    !isNullableIsoDate(candidate.cancelled_at) ||
    !isNullableIsoDate(candidate.cancel_requested_at) ||
    !isNonNegativeInteger(candidate.attempt_count) ||
    !isNullableIsoDate(candidate.started_at) ||
    !isNullableIsoDate(candidate.finished_at)
  ) {
    return null;
  }
  return {
    id,
    project_id: candidateProjectId,
    status: candidate.status as TranscriptionJob["status"],
    title,
    provider,
    ...(languageMode !== undefined ? { language_mode: languageMode } : {}),
    ...(diarizationEnabled !== undefined
      ? { diarization_enabled: diarizationEnabled }
      : {}),
    ...(candidate.media_clip !== undefined ? { media_clip: mediaClip } : {}),
    ...(terminalDismissedAt !== undefined
      ? { terminal_dismissed_at: terminalDismissedAt }
      : {}),
    source_count: candidate.source_count,
    created_at: candidate.created_at,
    updated_at: candidate.updated_at,
    cancelled_at: candidate.cancelled_at,
    cancel_requested_at: candidate.cancel_requested_at,
    attempt_count: candidate.attempt_count,
    started_at: candidate.started_at,
    finished_at: candidate.finished_at,
    error_code: errorCode,
    error_message: errorMessage,
    ...(candidate.output_folder !== undefined
      ? { output_folder: outputFolder }
      : {}),
  };
}

function parseOptionalMediaClip(
  candidate: unknown,
): JobMediaClip | null | false | undefined {
  if (candidate === undefined) return undefined;
  if (candidate === null) return null;
  if (!isRecord(candidate)) return false;
  const start = candidate.start_seconds;
  const end = candidate.end_seconds;
  if (
    !isNullableNonNegativeInteger(start) ||
    !isNullableNonNegativeInteger(end) ||
    (start !== null && start > 604_800) ||
    (end !== null && end > 604_800) ||
    (end !== null && end <= (start ?? 0)) ||
    (start === 0 && end === null) ||
    (start === null && end === null)
  ) {
    return false;
  }
  return { start_seconds: start, end_seconds: end };
}

function parseOptionalOutputFolder(
  candidate: unknown,
): JobOutputFolder | null | false | undefined {
  if (candidate === undefined) return undefined;
  if (candidate === null) return null;
  if (!isRecord(candidate)) return false;
  const name = boundedString(candidate.name, 512);
  const webViewUrl = nullableBoundedString(candidate.web_view_url, 2_000);
  if (!name || webViewUrl === undefined) return false;
  return { name, web_view_url: webViewUrl };
}

function boundedString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
    ? value
    : null;
}

function nullableBoundedString(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && value.length <= maxLength
    ? value
    : undefined;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNullableNonNegativeInteger(
  value: unknown,
): value is number | null {
  return value === null || isNonNegativeInteger(value);
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    Number.isFinite(Date.parse(value))
  );
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function hasUniqueIds(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
