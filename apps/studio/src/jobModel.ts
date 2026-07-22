import { formatTime } from "./formatters";
import type { Source } from "./sourceModel";

export type JobСтатус =
  | "queued"
  | "processing"
  | "cancelled"
  | "failed"
  | "completed";
export type JobSourceСтатус = "queued" | "skipped";
export type JobSource = Source & {
  position: number;
  job_source_status: JobSourceСтатус;
};
export type JobOutput = {
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
export type JobOutputsResponse = {
  job_id: string;
  job_status: JobСтатус;
  output_count: number;
  outputs: JobOutput[];
};
export type JobOutputsState = {
  loading: boolean;
  error: string;
  data: JobOutputsResponse | null;
};
export type JobOutputFolder = { name: string; web_view_url: string | null };
export type TranscriptionJob = {
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
export type JobState = {
  loading: boolean;
  error: string;
  loaded: boolean;
  items: TranscriptionJob[];
};

export function jobTitle(job: TranscriptionJob) {
  return job.title?.trim() || `Транскрибация от ${formatTime(job.created_at)}`;
}

export function safeJobSources(job: TranscriptionJob) {
  return [...(job.sources ?? [])].sort((a, b) => a.position - b.position);
}

export function isApprovedOutputUrl(value: string | null) {
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

export function outputSourceLabel(output: JobOutput) {
  const position =
    output.source_position == null ? "—" : String(output.source_position + 1);
  return `${position}. ${output.source_name || "Файл без имени"}`;
}

export function jobСтатусLabel(status: JobСтатус) {
  const labels: Record<JobСтатус, string> = {
    queued: "В очереди",
    processing: "Обрабатывается",
    cancelled: "Отменена",
    failed: "Ошибка",
    completed: "Завершена",
  };
  return labels[status];
}
