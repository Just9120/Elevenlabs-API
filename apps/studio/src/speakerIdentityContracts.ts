import { api } from "./apiClient";

export type SpeakerProfile = {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export function parseSpeakerProfile(candidate: unknown): SpeakerProfile | null {
  if (!isRecord(candidate)) return null;
  const id = boundedString(candidate.id, 36);
  const displayName = boundedString(candidate.display_name, 160);
  const role = boundedString(candidate.role, 120);
  if (
    !id ||
    !displayName ||
    !role ||
    typeof candidate.active !== "boolean" ||
    !isIsoDate(candidate.created_at) ||
    !isIsoDate(candidate.updated_at)
  ) {
    return null;
  }
  return {
    id,
    display_name: displayName,
    role,
    active: candidate.active,
    created_at: candidate.created_at,
    updated_at: candidate.updated_at,
  };
}

export function parseSpeakerProfileCollection(
  candidate: unknown,
): SpeakerProfile[] | null {
  if (!isRecord(candidate) || !Array.isArray(candidate.profiles)) return null;
  const profiles: SpeakerProfile[] = [];
  for (const raw of candidate.profiles) {
    const profile = parseSpeakerProfile(raw);
    if (!profile || !profile.active) return null;
    profiles.push(profile);
  }
  return new Set(profiles.map((profile) => profile.id)).size === profiles.length
    ? profiles
    : null;
}

export async function requestSpeakerProfiles(
  signal?: AbortSignal,
): Promise<SpeakerProfile[]> {
  const candidate = await api<unknown>("/speaker-profiles", { signal });
  const profiles = parseSpeakerProfileCollection(candidate);
  if (!profiles) throw new Error("invalid_speaker_profile_collection");
  return profiles;
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
    ? value
    : null;
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    Number.isFinite(Date.parse(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
