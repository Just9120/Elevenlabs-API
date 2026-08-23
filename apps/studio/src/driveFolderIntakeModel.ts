const MAX_PREVIEW_ITEMS = 500;
const MAX_IMPORT_ITEMS = 50;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const SKIP_REASONS = new Set([
  "unsupported",
  "empty",
  "oversized",
  "creation_time_unavailable",
]);

export type DriveFolderAcceptedItem = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number | null;
  created_time: string;
  relative_path: string;
};

export type DriveFolderSkippedItem = {
  relative_path: string;
  reason:
    | "unsupported"
    | "empty"
    | "oversized"
    | "creation_time_unavailable";
};

export type DriveFolderPreview = {
  folder: { id: string; name: string };
  total_file_count: number;
  folder_count: number;
  supported_count: number;
  skipped_count: number;
  accepted: DriveFolderAcceptedItem[];
  skipped: DriveFolderSkippedItem[];
  blocker: "empty" | "over_limit" | null;
  complete: boolean;
  preview_token: string | null;
};

export function parseDriveFolderPreview(
  candidate: unknown,
): DriveFolderPreview | null {
  if (!isRecord(candidate) || !isRecord(candidate.folder)) return null;
  const folderId = boundedString(candidate.folder.id, 256);
  const folderName = boundedString(candidate.folder.name, 255);
  const totalFileCount = boundedCount(candidate.total_file_count, MAX_PREVIEW_ITEMS);
  const folderCount = boundedCount(candidate.folder_count, MAX_PREVIEW_ITEMS);
  const supportedCount = boundedCount(candidate.supported_count, MAX_IMPORT_ITEMS + 1);
  const skippedCount = boundedCount(candidate.skipped_count, MAX_PREVIEW_ITEMS);
  if (
    !folderId ||
    !DRIVE_ID_PATTERN.test(folderId) ||
    !folderName ||
    totalFileCount === null ||
    folderCount === null ||
    folderCount < 1 ||
    supportedCount === null ||
    skippedCount === null ||
    !Array.isArray(candidate.accepted) ||
    !Array.isArray(candidate.skipped) ||
    candidate.accepted.length > MAX_IMPORT_ITEMS ||
    candidate.skipped.length > MAX_PREVIEW_ITEMS ||
    candidate.skipped.length !== skippedCount ||
    typeof candidate.complete !== "boolean" ||
    (candidate.blocker !== null &&
      candidate.blocker !== "empty" &&
      candidate.blocker !== "over_limit")
  ) {
    return null;
  }
  const accepted = candidate.accepted.map(parseAcceptedItem);
  const skipped = candidate.skipped.map(parseSkippedItem);
  if (accepted.some((item) => item === null) || skipped.some((item) => item === null)) {
    return null;
  }
  const acceptedItems = accepted as DriveFolderAcceptedItem[];
  const skippedItems = skipped as DriveFolderSkippedItem[];
  if (
    new Set(acceptedItems.map((item) => item.id)).size !== acceptedItems.length ||
    totalFileCount < acceptedItems.length + skippedItems.length
  ) {
    return null;
  }
  const importable = candidate.complete && candidate.blocker === null;
  const validBlockedState =
    (candidate.complete && candidate.blocker === "empty") ||
    (!candidate.complete && candidate.blocker === "over_limit");
  const token = candidate.preview_token;
  if (
    (!importable && !validBlockedState) ||
    (importable &&
      (acceptedItems.length === 0 ||
        acceptedItems.length !== supportedCount ||
        typeof token !== "string" ||
        !TOKEN_PATTERN.test(token))) ||
    (!importable && token !== null) ||
    (candidate.blocker === "empty" && supportedCount !== 0) ||
    (candidate.blocker === "over_limit" &&
      (candidate.complete || supportedCount !== MAX_IMPORT_ITEMS + 1))
  ) {
    return null;
  }
  return {
    folder: { id: folderId, name: folderName },
    total_file_count: totalFileCount,
    folder_count: folderCount,
    supported_count: supportedCount,
    skipped_count: skippedCount,
    accepted: acceptedItems,
    skipped: skippedItems,
    blocker: candidate.blocker,
    complete: candidate.complete,
    preview_token: token as string | null,
  };
}

export function driveFolderSkipReasonLabel(
  reason: DriveFolderSkippedItem["reason"],
): string {
  return {
    unsupported: "неподдерживаемый тип",
    empty: "пустой файл",
    oversized: "превышен лимит размера",
    creation_time_unavailable: "недоступна исходная дата создания",
  }[reason];
}

export function driveFolderBlockedMessage(
  preview: DriveFolderPreview,
): string | null {
  if (preview.blocker !== "empty") return null;
  if (preview.total_file_count === 0) {
    return (
      "Drive API не видит файлов в выбранной папке. Папка действительно пуста " +
      "либо текущий узкий доступ Google Drive не разрешает приложению видеть " +
      "вложенные файлы. В таком случае выберите конкретные файлы через «Из Google Drive»."
    );
  }
  const counts = new Map<DriveFolderSkippedItem["reason"], number>();
  for (const item of preview.skipped) {
    counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  }
  const reasonSummary = ([
    "unsupported",
    "empty",
    "oversized",
    "creation_time_unavailable",
  ] as const)
    .flatMap((reason) => {
      const count = counts.get(reason) ?? 0;
      return count > 0 ? [`${driveFolderSkipReasonLabel(reason)}: ${count}`] : [];
    })
    .join("; ");
  return `Найдено файлов: ${preview.total_file_count}, но импортировать нельзя ни один.${
    reasonSummary ? ` Причины: ${reasonSummary}.` : ""
  }`;
}

function parseAcceptedItem(candidate: unknown): DriveFolderAcceptedItem | null {
  if (!isRecord(candidate)) return null;
  const id = boundedString(candidate.id, 256);
  const name = boundedString(candidate.name, 255);
  const mimeType = boundedString(candidate.mime_type, 255);
  const relativePath = boundedString(candidate.relative_path, 2_048);
  const createdTime = boundedString(candidate.created_time, 64);
  if (
    !id ||
    !DRIVE_ID_PATTERN.test(id) ||
    !name ||
    !mimeType ||
    !relativePath ||
    !createdTime ||
    !isNullableNonNegativeInteger(candidate.size_bytes)
  ) {
    return null;
  }
  return {
    id,
    name,
    mime_type: mimeType,
    size_bytes: candidate.size_bytes as number | null,
    created_time: createdTime,
    relative_path: relativePath,
  };
}

function parseSkippedItem(candidate: unknown): DriveFolderSkippedItem | null {
  if (!isRecord(candidate)) return null;
  const relativePath = boundedString(candidate.relative_path, 2_048);
  if (
    !relativePath ||
    typeof candidate.reason !== "string" ||
    !SKIP_REASONS.has(candidate.reason)
  ) {
    return null;
  }
  return {
    relative_path: relativePath,
    reason: candidate.reason as DriveFolderSkippedItem["reason"],
  };
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate);
}

function boundedString(candidate: unknown, maxLength: number): string | null {
  if (typeof candidate !== "string") return null;
  const value = candidate.trim();
  return value.length > 0 && value.length <= maxLength ? value : null;
}

function boundedCount(candidate: unknown, max: number): number | null {
  return Number.isInteger(candidate) &&
    (candidate as number) >= 0 &&
    (candidate as number) <= max
    ? (candidate as number)
    : null;
}

function isNullableNonNegativeInteger(candidate: unknown): boolean {
  return (
    candidate === null ||
    (Number.isInteger(candidate) && (candidate as number) >= 0)
  );
}
