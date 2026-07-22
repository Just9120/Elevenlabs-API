import type { TranscriptionJob } from "./jobModel";

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
};
export type BatchCreateResponse = {
  jobs: TranscriptionJob[];
  created_count: number;
  replayed: boolean;
};

export function newComposerRow(): ComposerRow {
  return {
    id: crypto.randomUUID(),
    source_id: "",
    output_folder: null,
    title: "",
  };
}

export function composerSignature(rows: ComposerRow[], credentialId: string) {
  return JSON.stringify({
    provider_credential_id: credentialId || null,
    items: rows.map((row) => ({
      source_id: row.source_id,
      output_folder_id: row.output_folder?.folder_id ?? "",
      title: row.title.trim() || null,
    })),
  });
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
