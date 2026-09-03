import { mutateWithCsrfRetry } from "./apiClient";

export const REALTIME_CAPTION_CHANNEL = "studio-realtime-captions-v1";

export type RealtimeCaptionMessage = {
  kind: "caption";
  project_id: string;
  committed: string[];
  partial: string;
  emitted_at: string;
};

export function makeRealtimeCaptionMessage(
  projectId: string,
  committed: string[],
  partial: string,
): RealtimeCaptionMessage {
  return {
    kind: "caption",
    project_id: projectId,
    committed: committed.slice(-3),
    partial,
    emitted_at: new Date().toISOString(),
  };
}

export function parseRealtimeCaptionMessage(value: unknown): RealtimeCaptionMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<RealtimeCaptionMessage>;
  if (
    candidate.kind !== "caption" ||
    typeof candidate.project_id !== "string" ||
    !candidate.project_id ||
    !Array.isArray(candidate.committed) ||
    candidate.committed.length > 3 ||
    candidate.committed.some((line) => typeof line !== "string" || line.length > 2000) ||
    typeof candidate.partial !== "string" ||
    candidate.partial.length > 2000 ||
    typeof candidate.emitted_at !== "string"
  ) {
    return null;
  }
  return candidate as RealtimeCaptionMessage;
}

export async function deliverRealtimeConsumer(
  projectId: string,
  kind: "youtube_live" | "webhook",
  endpoint: string,
  text: string,
  sequence: number,
  csrf: string,
  onCsrf: (csrf: string) => void,
) {
  await mutateWithCsrfRetry(
    `/projects/${projectId}/realtime/consumers/deliver`,
    csrf,
    onCsrf,
    {
      method: "POST",
      body: JSON.stringify({ kind, endpoint, text, sequence }),
    },
  );
}
