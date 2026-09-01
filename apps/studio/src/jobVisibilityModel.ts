import type { JobСтатус, TranscriptionJob } from "./jobModel";

const ACTIVE_JOB_STATUSES = new Set<JobСтатус>(["queued", "processing"]);
const TERMINAL_JOB_STATUSES = new Set<JobСтатус>([
  "completed",
  "failed",
  "cancelled",
]);

export type VisibleJobGroups = {
  current: TranscriptionJob[];
  pinnedTerminal: TranscriptionJob[];
  recent: TranscriptionJob[];
};

export function jobStatusSnapshot(jobs: TranscriptionJob[]) {
  return new Map(jobs.map((job) => [job.id, job.status]));
}

export function newlyTerminalJobs(
  previous: ReadonlyMap<string, JobСтатус> | null,
  jobs: TranscriptionJob[],
) {
  if (!previous) return [];
  return jobs.filter((job) => {
    const previousStatus = previous.get(job.id);
    return (
      previousStatus !== undefined &&
      ACTIVE_JOB_STATUSES.has(previousStatus) &&
      TERMINAL_JOB_STATUSES.has(job.status)
    );
  });
}

export function groupVisibleJobs(
  jobs: TranscriptionJob[],
): VisibleJobGroups {
  const current: TranscriptionJob[] = [];
  const pinnedTerminal: TranscriptionJob[] = [];
  const recent: TranscriptionJob[] = [];

  for (const job of jobs) {
    if (ACTIVE_JOB_STATUSES.has(job.status)) current.push(job);
    else if (
      TERMINAL_JOB_STATUSES.has(job.status) &&
      (job.history_attention_required === true ||
        job.terminal_dismissed_at === null)
    )
      pinnedTerminal.push(job);
    else if (TERMINAL_JOB_STATUSES.has(job.status)) recent.push(job);
  }

  return { current, pinnedTerminal, recent };
}
