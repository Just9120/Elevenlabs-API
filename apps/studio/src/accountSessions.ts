import { api } from "./apiClient";
import { LATEST_REQUEST_CANCEL_REASON } from "./latestRequest";


export const ACTIVE_SESSION_LIMIT = 100;

export type ActiveSession = {
  id: string;
  is_current: boolean;
  created_at: string;
  last_seen_at: string | null;
  expires_at: string;
};

export type ActiveSessionsResponse = {
  sessions: ActiveSession[];
  truncated: boolean;
  limit: number;
};

function isDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function hasExactKeys(candidate: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(candidate).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function parseActiveSession(candidate: unknown): ActiveSession | null {
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as Record<string, unknown>;
  if (
    !hasExactKeys(row, [
      "created_at",
      "expires_at",
      "id",
      "is_current",
      "last_seen_at",
    ]) ||
    typeof row.id !== "string" ||
    row.id.length === 0 ||
    row.id.length > 36 ||
    typeof row.is_current !== "boolean" ||
    !isDate(row.created_at) ||
    !(row.last_seen_at === null || isDate(row.last_seen_at)) ||
    !isDate(row.expires_at) ||
    Date.parse(row.created_at) >= Date.parse(row.expires_at)
  ) {
    return null;
  }
  return {
    id: row.id,
    is_current: row.is_current,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    expires_at: row.expires_at,
  };
}

export function parseActiveSessionsResponse(
  candidate: unknown,
): ActiveSessionsResponse | null {
  if (!candidate || typeof candidate !== "object") return null;
  const response = candidate as Record<string, unknown>;
  if (
    !hasExactKeys(response, ["limit", "sessions", "truncated"]) ||
    !Array.isArray(response.sessions) ||
    response.sessions.length === 0 ||
    response.sessions.length > ACTIVE_SESSION_LIMIT ||
    typeof response.truncated !== "boolean" ||
    response.limit !== ACTIVE_SESSION_LIMIT
  ) {
    return null;
  }
  const sessions: ActiveSession[] = [];
  for (const candidateSession of response.sessions) {
    const session = parseActiveSession(candidateSession);
    if (!session) return null;
    sessions.push(session);
  }
  if (
    new Set(sessions.map((session) => session.id)).size !== sessions.length ||
    sessions.filter((session) => session.is_current).length !== 1 ||
    !sessions[0]?.is_current
  ) {
    return null;
  }
  return {
    sessions,
    truncated: response.truncated,
    limit: ACTIVE_SESSION_LIMIT,
  };
}

export async function requestActiveSessions(
  signal?: AbortSignal,
): Promise<ActiveSessionsResponse> {
  const candidate = await api<unknown>("/auth/sessions", {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const parsed = parseActiveSessionsResponse(candidate);
  if (!parsed) throw new Error("invalid_active_sessions_response");
  return parsed;
}

export function parseTargetedRevokeResponse(candidate: unknown) {
  if (!candidate || typeof candidate !== "object") return null;
  const response = candidate as Record<string, unknown>;
  return hasExactKeys(response, ["active", "revoked"]) &&
    typeof response.revoked === "boolean" && response.active === false
    ? { revoked: response.revoked, active: false as const }
    : null;
}

export function parseRevokeOtherResponse(candidate: unknown) {
  if (!candidate || typeof candidate !== "object") return null;
  const response = candidate as Record<string, unknown>;
  const revoked = response.revoked;
  return hasExactKeys(response, ["revoked"]) &&
    Number.isSafeInteger(revoked) && (revoked as number) >= 0
    ? { revoked: revoked as number }
    : null;
}

export function targetedRevokeIsConfirmed(
  response: ActiveSessionsResponse,
  sessionId: string,
) {
  return !response.sessions.some((session) => session.id === sessionId);
}

export function revokeOtherIsConfirmed(response: ActiveSessionsResponse) {
  return (
    !response.truncated &&
    response.sessions.every((session) => session.is_current)
  );
}
