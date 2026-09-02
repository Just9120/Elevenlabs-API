export type SourceUploadPolicy = {
  local_upload_enabled: boolean;
  max_upload_bytes: number;
  multipart_threshold_bytes: number;
  multipart_part_size_bytes: number;
  media_duration_warning_seconds?: number;
  media_max_duration_seconds?: number;
  supported_mime_prefixes: string[];
  supported_mime_types: string[];
};

export function normalizeSourceUploadPolicy(
  value: unknown,
): SourceUploadPolicy | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SourceUploadPolicy>;
  const durationPolicyPresent =
    candidate.media_duration_warning_seconds !== undefined ||
    candidate.media_max_duration_seconds !== undefined;
  if (
    typeof candidate.local_upload_enabled !== "boolean" ||
    !Number.isSafeInteger(candidate.max_upload_bytes) ||
    Number(candidate.max_upload_bytes) <= 0 ||
    !Number.isSafeInteger(candidate.multipart_threshold_bytes) ||
    Number(candidate.multipart_threshold_bytes) < 5 * 1024 * 1024 ||
    !Number.isSafeInteger(candidate.multipart_part_size_bytes) ||
    Number(candidate.multipart_part_size_bytes) < 5 * 1024 * 1024 ||
    Number(candidate.multipart_part_size_bytes) > Number(candidate.multipart_threshold_bytes) ||
    (durationPolicyPresent &&
      (!Number.isSafeInteger(candidate.media_duration_warning_seconds) ||
        Number(candidate.media_duration_warning_seconds) <= 0 ||
        !Number.isSafeInteger(candidate.media_max_duration_seconds) ||
        Number(candidate.media_max_duration_seconds) <=
          Number(candidate.media_duration_warning_seconds))) ||
    !Array.isArray(candidate.supported_mime_prefixes) ||
    !Array.isArray(candidate.supported_mime_types)
  )
    return null;
  const prefixes = candidate.supported_mime_prefixes
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const types = candidate.supported_mime_types
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (
    prefixes.length !== candidate.supported_mime_prefixes.length ||
    types.length !== candidate.supported_mime_types.length ||
    prefixes.length + types.length === 0
  )
    return null;
  return {
    local_upload_enabled: candidate.local_upload_enabled,
    max_upload_bytes: Number(candidate.max_upload_bytes),
    multipart_threshold_bytes: Number(candidate.multipart_threshold_bytes),
    multipart_part_size_bytes: Number(candidate.multipart_part_size_bytes),
    ...(durationPolicyPresent
      ? {
          media_duration_warning_seconds: Number(
            candidate.media_duration_warning_seconds,
          ),
          media_max_duration_seconds: Number(candidate.media_max_duration_seconds),
        }
      : {}),
    supported_mime_prefixes: [...new Set(prefixes)],
    supported_mime_types: [...new Set(types)],
  };
}

export function isSupportedSourceMimeType(
  mimeType: string,
  policy: SourceUploadPolicy,
) {
  const normalized = mimeType.trim().toLowerCase();
  return (
    policy.supported_mime_prefixes.some((prefix) =>
      normalized.startsWith(prefix),
    ) || policy.supported_mime_types.includes(normalized)
  );
}

export function sourceUploadAccept(policy: SourceUploadPolicy) {
  return [
    ...policy.supported_mime_prefixes.map((prefix) => `${prefix}*`),
    ...policy.supported_mime_types,
  ].join(",");
}

export function isSupportedMediaFile(
  file: File,
  policy: SourceUploadPolicy,
) {
  return isSupportedSourceMimeType(file.type, policy);
}
