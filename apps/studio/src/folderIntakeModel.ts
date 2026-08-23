import { MAX_BATCH_ITEMS } from "./batchComposerModel";
import {
  isSupportedMediaFile,
  type SourceUploadPolicy,
} from "./sourceUploadPolicy";

export type LocalFolderAcceptedFile = {
  file: File;
  relative_path: string;
};

export type LocalFolderRejectedFile = {
  display_name: string;
  reason: "empty" | "oversized" | "unsupported" | "unsafe_path" | "duplicate";
};

export type LocalFolderPreview = {
  folder_name: string;
  total_count: number;
  supported_count: number;
  accepted: LocalFolderAcceptedFile[];
  rejected: LocalFolderRejectedFile[];
  blocker: "empty" | "over_limit" | null;
};

function normalizeRelativePath(file: File): string | null {
  const raw = file.webkitRelativePath.trim();
  if (!raw || raw.length > 1024 || raw.includes("\\")) return null;
  if (raw.startsWith("/") || /^[a-z]:/i.test(raw)) return null;
  const parts = raw.split("/");
  if (
    parts.length < 2 ||
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        part.includes("\0") ||
        part.length > 255,
    )
  )
    return null;
  return parts.join("/");
}

function safeDisplayName(file: File, relativePath: string | null): string {
  if (relativePath) return relativePath.slice(0, 320);
  return file.name.trim().slice(0, 255) || "Файл без имени";
}

export function buildLocalFolderPreview(
  files: readonly File[],
  policy: SourceUploadPolicy,
): LocalFolderPreview {
  const accepted: LocalFolderAcceptedFile[] = [];
  const rejected: LocalFolderRejectedFile[] = [];
  const seenPaths = new Set<string>();
  let supportedCount = 0;

  const candidates = files
    .map((file) => ({ file, relativePath: normalizeRelativePath(file) }))
    .sort((left, right) =>
      (left.relativePath ?? left.file.name).localeCompare(
        right.relativePath ?? right.file.name,
        "ru",
      ),
    );

  for (const { file, relativePath } of candidates) {
    const displayName = safeDisplayName(file, relativePath);
    if (!relativePath) {
      rejected.push({ display_name: displayName, reason: "unsafe_path" });
      continue;
    }
    const identity = relativePath.toLocaleLowerCase("ru");
    if (seenPaths.has(identity)) {
      rejected.push({ display_name: displayName, reason: "duplicate" });
      continue;
    }
    seenPaths.add(identity);
    if (!isSupportedMediaFile(file, policy)) {
      rejected.push({ display_name: displayName, reason: "unsupported" });
      continue;
    }
    if (file.size <= 0) {
      rejected.push({ display_name: displayName, reason: "empty" });
      continue;
    }
    if (file.size > policy.max_upload_bytes) {
      rejected.push({ display_name: displayName, reason: "oversized" });
      continue;
    }
    supportedCount += 1;
    accepted.push({ file, relative_path: relativePath });
  }

  const firstPath = accepted[0]?.relative_path;
  const folderName = firstPath?.split("/")[0] || "Выбранная папка";
  const blocker =
    supportedCount === 0
      ? "empty"
      : supportedCount > MAX_BATCH_ITEMS
        ? "over_limit"
        : null;

  return {
    folder_name: folderName,
    total_count: files.length,
    supported_count: supportedCount,
    accepted: blocker === "over_limit" ? [] : accepted,
    rejected,
    blocker,
  };
}

export function localFolderRejectedReasonLabel(
  reason: LocalFolderRejectedFile["reason"],
): string {
  return {
    empty: "пустой файл",
    oversized: "превышен лимит размера",
    unsupported: "неподдерживаемый тип",
    unsafe_path: "некорректный относительный путь",
    duplicate: "повторяющийся путь",
  }[reason];
}
