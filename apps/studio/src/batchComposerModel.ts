import type {
  TranscriptionJob,
  TranscriptionLanguageMode,
} from "./jobModel";

export const DEFAULT_TRANSCRIPTION_LANGUAGE_MODE: TranscriptionLanguageMode =
  "ru";

export type VerifiedOutputFolder = {
  folder_id: string;
  name: string;
  web_view_url: string | null;
};
export type ComposerRow = {
  id: string;
  source_id: string;
  output_folder: VerifiedOutputFolder | null;
  title: string;
  reprocess_existing: boolean;
};
export type BatchCreateResponse = {
  jobs: TranscriptionJob[];
  created_count: number;
  replayed: boolean;
};
export type BatchCreateRequest = {
  provider_credential_id: string | null;
  language: TranscriptionLanguageMode;
  options: { diarize: boolean };
  items: {
    source_id: string;
    output_folder_id: string;
    title: string | null;
    reprocess_existing: boolean;
  }[];
};
export type BatchPreflightItem = {
  position: number;
  title: string | null;
  source: {
    name: string;
    source_type: "local_upload" | "google_drive" | "unknown";
    mime_type: string | null;
    size_bytes: number | null;
    duration_seconds: number | null;
  };
  output_destination: { name: string };
  existing_result_match: {
    status:
      | "accepted_match"
      | "standardization_required"
      | "indeterminate"
      | "no_match";
    accepted_output_count: number;
    resolution: "not_required" | "required" | "reprocess";
  };
  planned_outcome: "process" | "skip" | "blocked";
};
export type BatchPreflightResponse = {
  provider: "elevenlabs";
  model: "scribe_v2";
  language_mode: TranscriptionLanguageMode;
  diarization_enabled: boolean;
  existing_result_authority: {
    status: "partial" | "available";
    reason_code: string | null;
  };
  items: BatchPreflightItem[];
  summary: {
    process_count: number;
    skip_count: number;
    blocked_count: number;
  };
  confirmation_required: true;
};

export function newComposerRow(): ComposerRow {
  return {
    id: crypto.randomUUID(),
    source_id: "",
    output_folder: null,
    title: "",
    reprocess_existing: false,
  };
}

export function composerSignature(
  rows: ComposerRow[],
  credentialId: string,
  languageMode: TranscriptionLanguageMode,
  diarizationEnabled: boolean,
) {
  return JSON.stringify(
    buildBatchCreateRequest(
      rows,
      credentialId,
      languageMode,
      diarizationEnabled,
    ),
  );
}

export function buildBatchCreateRequest(
  rows: ComposerRow[],
  credentialId: string,
  languageMode: TranscriptionLanguageMode,
  diarizationEnabled: boolean,
): BatchCreateRequest {
  return {
    provider_credential_id: credentialId || null,
    language: languageMode,
    options: { diarize: diarizationEnabled },
    items: rows.map((row) => ({
      source_id: row.source_id,
      output_folder_id: row.output_folder?.folder_id ?? "",
      title: row.title.trim() || null,
      reprocess_existing: row.reprocess_existing,
    })),
  };
}

export function parseBatchPreflightResponse(
  value: unknown,
): BatchPreflightResponse | null {
  if (!isRecord(value)) return null;
  if (
    !hasExactKeys(value, [
      "provider",
      "model",
      "language_mode",
      "diarization_enabled",
      "existing_result_authority",
      "items",
      "summary",
      "confirmation_required",
    ]) ||
    value.provider !== "elevenlabs" ||
    value.model !== "scribe_v2" ||
    !["ru", "detect"].includes(String(value.language_mode)) ||
    typeof value.diarization_enabled !== "boolean" ||
    value.confirmation_required !== true ||
    !isRecord(value.existing_result_authority) ||
    !hasExactKeys(value.existing_result_authority, ["status", "reason_code"]) ||
    !["partial", "available"].includes(
      String(value.existing_result_authority.status),
    ) ||
    !isNullableString(value.existing_result_authority.reason_code) ||
    !Array.isArray(value.items) ||
    !isRecord(value.summary) ||
    !hasExactKeys(value.summary, [
      "process_count",
      "skip_count",
      "blocked_count",
    ])
  ) {
    return null;
  }
  if (
    (value.existing_result_authority.status === "partial" &&
      value.existing_result_authority.reason_code !== "studio_outputs_only") ||
    (value.existing_result_authority.status === "available" &&
      value.existing_result_authority.reason_code !== null)
  ) {
    return null;
  }
  const items = value.items;
  if (!items.every((item, index) => isPreflightItem(item, index))) return null;
  const counts = [
    value.summary.process_count,
    value.summary.skip_count,
    value.summary.blocked_count,
  ];
  if (!counts.every(isNonNegativeInteger)) return null;
  const outcomes = items.map((item) =>
    isRecord(item) ? item.planned_outcome : null,
  );
  if (
    value.summary.process_count !==
      outcomes.filter((outcome) => outcome === "process").length ||
    value.summary.skip_count !==
      outcomes.filter((outcome) => outcome === "skip").length ||
    value.summary.blocked_count !==
      outcomes.filter((outcome) => outcome === "blocked").length
  ) {
    return null;
  }
  return value as BatchPreflightResponse;
}

function isPreflightItem(value: unknown, expectedPosition: number) {
  if (!isRecord(value) || !isRecord(value.source)) return false;
  if (
    !hasExactKeys(value, [
      "position",
      "title",
      "source",
      "output_destination",
      "existing_result_match",
      "planned_outcome",
    ]) ||
    !hasExactKeys(value.source, [
      "name",
      "source_type",
      "mime_type",
      "size_bytes",
      "duration_seconds",
    ]) ||
    value.position !== expectedPosition ||
    !isNullableString(value.title) ||
    typeof value.source.name !== "string" ||
    !["local_upload", "google_drive", "unknown"].includes(
      String(value.source.source_type),
    ) ||
    !isNullableString(value.source.mime_type) ||
    !isNullableNonNegativeNumber(value.source.size_bytes) ||
    !isNullableNonNegativeNumber(value.source.duration_seconds) ||
    !isRecord(value.output_destination) ||
    !hasExactKeys(value.output_destination, ["name"]) ||
    typeof value.output_destination.name !== "string" ||
    !isRecord(value.existing_result_match) ||
    !hasExactKeys(value.existing_result_match, [
      "status",
      "accepted_output_count",
      "resolution",
    ]) ||
    ![
      "accepted_match",
      "standardization_required",
      "indeterminate",
      "no_match",
    ].includes(
      String(value.existing_result_match.status),
    ) ||
    !isNonNegativeInteger(
      value.existing_result_match.accepted_output_count,
    ) ||
    !["not_required", "required", "reprocess"].includes(
      String(value.existing_result_match.resolution),
    ) ||
    !["process", "skip", "blocked"].includes(String(value.planned_outcome))
  ) {
    return false;
  }
  const status = String(value.existing_result_match.status);
  const resolution = String(value.existing_result_match.resolution);
  const outcome = String(value.planned_outcome);
  const acceptedOutputCount =
    value.existing_result_match.accepted_output_count;
  if (
    status !== "no_match" &&
    (!isNonNegativeInteger(acceptedOutputCount) || acceptedOutputCount < 1)
  ) {
    return false;
  }
  const coherentDecision =
    (status === "no_match" &&
      resolution === "not_required" &&
      outcome === "process") ||
    (status !== "no_match" &&
      ((resolution === "required" && outcome === "blocked") ||
        (resolution === "reprocess" && outcome === "process")));
  return (
    coherentDecision &&
    value.source.name.length > 0 &&
    value.output_destination.name.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNullableNonNegativeNumber(value: unknown) {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}

export function makeIdempotencyKey() {
  return `batch-${crypto.randomUUID()}`;
}

export function mergeJobsWithBatchOrder(
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
