import type { TranscriptionJob } from "./jobModel";

const ACTIVE_STATUSES = new Set(["queued", "processing"]);

export type TranscriptionPresentation = {
  id: string;
  kind: "single" | "multi";
  jobs: TranscriptionJob[];
};

export type TranscriptionPresentationGroups = {
  current: TranscriptionPresentation[];
  pinnedTerminal: TranscriptionPresentation[];
  recent: TranscriptionPresentation[];
};

export function buildTranscriptionPresentations(
  jobs: TranscriptionJob[],
): TranscriptionPresentation[] {
  const presentations: TranscriptionPresentation[] = [];
  const batches = new Map<string, TranscriptionPresentation>();

  for (const job of jobs) {
    if (!job.batch) {
      presentations.push({ id: `job:${job.id}`, kind: "single", jobs: [job] });
      continue;
    }
    const existing = batches.get(job.batch.id);
    if (existing) {
      existing.jobs.push(job);
      continue;
    }
    const presentation: TranscriptionPresentation = {
      id: `batch:${job.batch.id}`,
      kind: "multi",
      jobs: [job],
    };
    batches.set(job.batch.id, presentation);
    presentations.push(presentation);
  }

  for (const presentation of presentations) {
    if (presentation.kind === "multi") {
      presentation.jobs.sort(
        (left, right) =>
          (left.batch?.position ?? 0) - (right.batch?.position ?? 0),
      );
    }
  }
  return presentations;
}

export function groupTranscriptionPresentations(
  jobs: TranscriptionJob[],
): TranscriptionPresentationGroups {
  const groups: TranscriptionPresentationGroups = {
    current: [],
    pinnedTerminal: [],
    recent: [],
  };
  for (const presentation of buildTranscriptionPresentations(jobs)) {
    if (presentation.jobs.some((job) => ACTIVE_STATUSES.has(job.status))) {
      groups.current.push(presentation);
    } else if (
      presentation.jobs.some((job) => job.terminal_dismissed_at === null)
    ) {
      groups.pinnedTerminal.push(presentation);
    } else {
      groups.recent.push(presentation);
    }
  }
  return groups;
}
