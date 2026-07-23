import type { JobСтатус } from "./jobModel";

export const JOB_PROGRESS_STAGE_KEYS = [
  "preparation",
  "audio_extraction",
  "splitting",
  "provider_processing",
  "part_merge",
  "google_docs_output",
] as const;

export type JobProgressStageKey = (typeof JOB_PROGRESS_STAGE_KEYS)[number];
export type JobProgressStageStatus =
  | "pending"
  | "active"
  | "completed"
  | "failed"
  | "cancelled"
  | "not_applicable";
export type JobProgressStage = {
  key: JobProgressStageKey;
  status: JobProgressStageStatus;
  applicability: "required" | "conditional" | "not_applicable";
};
export type JobSourceProgress = {
  position: number;
  name: string;
  status:
    | "queued"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled"
    | "skipped";
  stages: JobProgressStage[];
};
export type JobProgress = {
  job_id: string;
  job_status: Extract<JobСтатус, "queued" | "processing">;
  tracking_precision: "checkpoint";
  completed_source_count: number;
  total_source_count: number;
  active_source_position: number | null;
  current_stage: JobProgressStageKey | null;
  sources: JobSourceProgress[];
};
export type ProjectJobProgressResponse = { jobs: JobProgress[] };
export type JobProgressState = {
  loading: boolean;
  error: string;
  data: JobProgress | null;
};

const STAGE_STATUSES = new Set<JobProgressStageStatus>([
  "pending",
  "active",
  "completed",
  "failed",
  "cancelled",
  "not_applicable",
]);
const SOURCE_STATUSES = new Set<JobSourceProgress["status"]>([
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "skipped",
]);
const APPLICABILITY = new Set<JobProgressStage["applicability"]>([
  "required",
  "conditional",
  "not_applicable",
]);

export function parseProjectJobProgressResponse(
  value: unknown,
): ProjectJobProgressResponse | null {
  if (!isRecord(value) || !hasExactKeys(value, ["jobs"]) || !Array.isArray(value.jobs))
    return null;
  const parsed: JobProgress[] = [];
  const jobIds = new Set<string>();
  for (const item of value.jobs) {
    const progress = parseJobProgress(item);
    if (!progress || jobIds.has(progress.job_id)) return null;
    jobIds.add(progress.job_id);
    parsed.push(progress);
  }
  return { jobs: parsed };
}

function parseJobProgress(value: unknown): JobProgress | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "job_id",
      "job_status",
      "tracking_precision",
      "completed_source_count",
      "total_source_count",
      "active_source_position",
      "current_stage",
      "sources",
    ]) ||
    typeof value.job_id !== "string" ||
    value.job_id.length === 0 ||
    !["queued", "processing"].includes(String(value.job_status)) ||
    value.tracking_precision !== "checkpoint" ||
    !isNonNegativeInteger(value.completed_source_count) ||
    !isNonNegativeInteger(value.total_source_count) ||
    value.completed_source_count > value.total_source_count ||
    !isNullableNonNegativeInteger(value.active_source_position) ||
    !isNullableStageKey(value.current_stage) ||
    !Array.isArray(value.sources)
  ) {
    return null;
  }
  const sources: JobSourceProgress[] = [];
  const positions = new Set<number>();
  for (const source of value.sources) {
    const parsed = parseSourceProgress(source);
    if (!parsed || positions.has(parsed.position)) return null;
    positions.add(parsed.position);
    sources.push(parsed);
  }
  if (
    value.active_source_position !== null &&
    !positions.has(value.active_source_position)
  )
    return null;
  if (
    value.total_source_count !==
    sources.filter((source) => source.status !== "skipped").length
  )
    return null;
  const activeStages = sources.flatMap((source) =>
    source.stages.filter((stage) =>
      ["active", "failed", "cancelled"].includes(stage.status),
    ),
  );
  if (
    (value.current_stage === null && activeStages.length > 0) ||
    (value.current_stage !== null &&
      (activeStages.length !== 1 || activeStages[0].key !== value.current_stage))
  )
    return null;
  return value as JobProgress;
}

function parseSourceProgress(value: unknown): JobSourceProgress | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["position", "name", "status", "stages"]) ||
    !isNonNegativeInteger(value.position) ||
    typeof value.name !== "string" ||
    value.name.length === 0 ||
    !SOURCE_STATUSES.has(value.status as JobSourceProgress["status"]) ||
    !Array.isArray(value.stages) ||
    value.stages.length !== JOB_PROGRESS_STAGE_KEYS.length
  )
    return null;
  const stages: JobProgressStage[] = [];
  for (const [index, stage] of value.stages.entries()) {
    if (
      !isRecord(stage) ||
      !hasExactKeys(stage, ["key", "status", "applicability"]) ||
      stage.key !== JOB_PROGRESS_STAGE_KEYS[index] ||
      !STAGE_STATUSES.has(stage.status as JobProgressStageStatus) ||
      !APPLICABILITY.has(
        stage.applicability as JobProgressStage["applicability"],
      ) ||
      (stage.applicability === "not_applicable") !==
        (stage.status === "not_applicable")
    )
      return null;
    stages.push(stage as JobProgressStage);
  }
  return { ...value, stages } as JobSourceProgress;
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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNullableNonNegativeInteger(value: unknown) {
  return value === null || isNonNegativeInteger(value);
}

function isNullableStageKey(value: unknown): value is JobProgressStageKey | null {
  return (
    value === null ||
    JOB_PROGRESS_STAGE_KEYS.includes(value as JobProgressStageKey)
  );
}
