import {
  DirectUploadAmbiguousError,
  uploadFileWithProgress,
  type DirectUploadProgress,
  type DirectUploadResult,
} from "./directUpload";


export const DIRECT_DRIVE_UPLOAD_MAX_FILES = 20;
export const DIRECT_DRIVE_UPLOAD_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
export const DIRECT_DRIVE_UPLOAD_APP_PROPERTY = "studioDirectUploadId";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files";
const OPERATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{80,1200}$/;

export type DirectDriveUploadItem = {
  operationId: string;
  file: File;
};

export type DirectDriveUploadPolicy = {
  max_files: number;
  max_file_bytes: number;
  max_total_bytes: number;
  supported_mime_prefixes: string[];
  supported_mime_types: string[];
};

export type DirectDriveUploadSession = {
  accessToken: string;
  expiresIn: number;
  folderName: string;
  policy: DirectDriveUploadPolicy;
  capabilities: Map<string, string>;
};

export type DirectDriveFileReference = {
  fileId: string;
  reused: boolean;
};

type UploadTransport = (request: {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  file: File;
  timeoutMs: number;
  signal?: AbortSignal;
  onProgress?: (progress: DirectUploadProgress) => void;
}) => Promise<DirectUploadResult>;

export class DirectDriveUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectDriveUploadError";
  }
}

export function newDirectDriveOperationId() {
  const value = globalThis.crypto?.randomUUID?.().toLowerCase();
  if (!value || !OPERATION_ID_PATTERN.test(value)) {
    throw new DirectDriveUploadError("direct_drive_operation_unavailable");
  }
  return value;
}

export function directDriveFileSelectionError(files: File[]) {
  if (files.length < 1 || files.length > DIRECT_DRIVE_UPLOAD_MAX_FILES) {
    return `Можно выбрать от 1 до ${DIRECT_DRIVE_UPLOAD_MAX_FILES} файлов.`;
  }
  for (const file of files) {
    if (!isSupportedMediaMime(file.type)) {
      return `${file.name}: выберите audio/video файл с определяемым MIME type.`;
    }
    if (file.size < 1) return `${file.name}: пустой файл загрузить нельзя.`;
    if (
      !file.name ||
      file.name.length > 255 ||
      file.name === "." ||
      file.name === ".." ||
      /[/\\]/.test(file.name) ||
      [...file.name].some((character) => character.charCodeAt(0) < 32)
    ) {
      return "Один из файлов имеет неподдерживаемое имя.";
    }
  }
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > DIRECT_DRIVE_UPLOAD_MAX_TOTAL_BYTES) {
    return "Общий размер выбранных файлов не должен превышать 2 ГБ.";
  }
  return null;
}

export function parseDirectDriveUploadSession(
  candidate: unknown,
  expectedItems: DirectDriveUploadItem[],
): DirectDriveUploadSession | null {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Record<string, unknown>;
  if (
    typeof value.access_token !== "string" ||
    !value.access_token ||
    value.access_token.length > 8192 ||
    /\s/.test(value.access_token) ||
    !Number.isInteger(value.expires_in) ||
    Number(value.expires_in) < 60 ||
    Number(value.expires_in) > 3600 ||
    !value.folder ||
    typeof value.folder !== "object" ||
    typeof (value.folder as { name?: unknown }).name !== "string" ||
    !(value.folder as { name: string }).name ||
    (value.folder as { name: string }).name.length > 512
  ) {
    return null;
  }
  const policy = normalizePolicy(value.policy);
  if (!policy || !Array.isArray(value.uploads)) return null;
  const expected = new Set(expectedItems.map((item) => item.operationId));
  if (expected.size !== expectedItems.length || value.uploads.length !== expected.size)
    return null;
  const capabilities = new Map<string, string>();
  for (const raw of value.uploads) {
    if (!raw || typeof raw !== "object") return null;
    const operationId = (raw as { operation_id?: unknown }).operation_id;
    const capability = (raw as { capability?: unknown }).capability;
    if (
      typeof operationId !== "string" ||
      !OPERATION_ID_PATTERN.test(operationId) ||
      !expected.has(operationId) ||
      capabilities.has(operationId) ||
      typeof capability !== "string" ||
      !CAPABILITY_PATTERN.test(capability)
    ) {
      return null;
    }
    capabilities.set(operationId, capability);
  }
  return {
    accessToken: value.access_token,
    expiresIn: Number(value.expires_in),
    folderName: (value.folder as { name: string }).name,
    policy,
    capabilities,
  };
}

export async function uploadDirectDriveFile({
  item,
  folderId,
  accessToken,
  expiresIn,
  signal,
  onProgress,
  fetchImpl = fetch,
  uploadTransport = uploadFileWithProgress,
}: {
  item: DirectDriveUploadItem;
  folderId: string;
  accessToken: string;
  expiresIn: number;
  signal?: AbortSignal;
  onProgress?: (progress: DirectUploadProgress) => void;
  fetchImpl?: typeof fetch;
  uploadTransport?: UploadTransport;
}): Promise<DirectDriveFileReference> {
  requireSafeUploadInputs(item, folderId, accessToken);
  const existing = await findExistingDirectDriveFile({
    operationId: item.operationId,
    folderId,
    accessToken,
    fetchImpl,
    signal,
  });
  if (existing) {
    onProgress?.({
      loadedBytes: item.file.size,
      totalBytes: item.file.size,
      percent: 100,
    });
    return { fileId: existing, reused: true };
  }
  const uploadUrl = await createResumableDriveSession({
    item,
    folderId,
    accessToken,
    fetchImpl,
    signal,
  });
  const result = await uploadTransport({
    url: uploadUrl,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": item.file.type,
    },
    file: item.file,
    timeoutMs: Math.max(
      30_000,
      Math.min(45 * 60 * 1000, (expiresIn - 30) * 1000),
    ),
    signal,
    onProgress,
  });
  if (!result.ok) {
    if (result.status === 401 || result.status === 403)
      throw new DirectDriveUploadError("direct_drive_reauthorization_required");
    throw new DirectDriveUploadError("direct_drive_upload_rejected");
  }
  const created = await findExistingDirectDriveFile({
    operationId: item.operationId,
    folderId,
    accessToken,
    fetchImpl,
    signal,
  });
  if (!created)
    throw new DirectUploadAmbiguousError("direct_drive_result_not_visible");
  return { fileId: created, reused: false };
}

async function createResumableDriveSession({
  item,
  folderId,
  accessToken,
  fetchImpl,
  signal,
}: {
  item: DirectDriveUploadItem;
  folderId: string;
  accessToken: string;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    uploadType: "resumable",
    supportsAllDrives: "true",
    fields: "id",
  });
  const response = await fetchImpl(`${GOOGLE_DRIVE_UPLOAD_URL}?${params}`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": item.file.type,
      "X-Upload-Content-Length": String(item.file.size),
    },
    body: JSON.stringify({
      name: item.file.name,
      parents: [folderId],
      appProperties: {
        [DIRECT_DRIVE_UPLOAD_APP_PROPERTY]: item.operationId,
      },
    }),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new DirectDriveUploadError("direct_drive_reauthorization_required");
    throw new DirectDriveUploadError("direct_drive_session_rejected");
  }
  const location = response.headers.get("Location");
  if (!isSafeResumableLocation(location))
    throw new DirectDriveUploadError("direct_drive_session_invalid");
  return location;
}

async function findExistingDirectDriveFile({
  operationId,
  folderId,
  accessToken,
  fetchImpl,
  signal,
}: {
  operationId: string;
  folderId: string;
  accessToken: string;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
}) {
  const query = `'${folderId}' in parents and trashed = false and appProperties has { key='${DIRECT_DRIVE_UPLOAD_APP_PROPERTY}' and value='${operationId}' }`;
  const params = new URLSearchParams({
    q: query,
    spaces: "drive",
    pageSize: "2",
    fields: "files(id),nextPageToken",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await fetchImpl(`${GOOGLE_DRIVE_FILES_URL}?${params}`, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new DirectDriveUploadError("direct_drive_reauthorization_required");
    throw new DirectDriveUploadError("direct_drive_lookup_failed");
  }
  const payload: unknown = await response.json();
  const files =
    payload && typeof payload === "object"
      ? (payload as { files?: unknown }).files
      : null;
  if (!Array.isArray(files) || files.length > 1)
    throw new DirectDriveUploadError("direct_drive_lookup_ambiguous");
  if (files.length === 0) return null;
  const fileId = files[0] && typeof files[0] === "object"
    ? (files[0] as { id?: unknown }).id
    : null;
  if (typeof fileId !== "string" || !DRIVE_ID_PATTERN.test(fileId))
    throw new DirectDriveUploadError("direct_drive_lookup_invalid");
  return fileId;
}

function normalizePolicy(value: unknown): DirectDriveUploadPolicy | null {
  if (!value || typeof value !== "object") return null;
  const policy = value as Partial<DirectDriveUploadPolicy>;
  if (
    !Number.isInteger(policy.max_files) ||
    Number(policy.max_files) < 1 ||
    Number(policy.max_files) > DIRECT_DRIVE_UPLOAD_MAX_FILES ||
    !Number.isSafeInteger(policy.max_file_bytes) ||
    Number(policy.max_file_bytes) < 1 ||
    !Number.isSafeInteger(policy.max_total_bytes) ||
    Number(policy.max_total_bytes) < 1 ||
    Number(policy.max_total_bytes) > DIRECT_DRIVE_UPLOAD_MAX_TOTAL_BYTES ||
    !Array.isArray(policy.supported_mime_prefixes) ||
    !Array.isArray(policy.supported_mime_types)
  ) return null;
  const prefixes = normalizeStringList(policy.supported_mime_prefixes);
  const types = normalizeStringList(policy.supported_mime_types);
  if (!prefixes || !types || prefixes.length + types.length === 0) return null;
  return {
    max_files: Number(policy.max_files),
    max_file_bytes: Number(policy.max_file_bytes),
    max_total_bytes: Number(policy.max_total_bytes),
    supported_mime_prefixes: prefixes,
    supported_mime_types: types,
  };
}

function normalizeStringList(values: unknown[]) {
  const normalized = values.map((item) =>
    typeof item === "string" ? item.trim().toLowerCase() : "",
  );
  if (normalized.some((item) => !item)) return null;
  return [...new Set(normalized)];
}

function isSupportedMediaMime(value: string) {
  const mime = value.trim().toLowerCase();
  return mime.startsWith("audio/") || mime.startsWith("video/") || mime === "application/ogg";
}

function requireSafeUploadInputs(
  item: DirectDriveUploadItem,
  folderId: string,
  accessToken: string,
) {
  const selectionError = directDriveFileSelectionError([item.file]);
  if (
    selectionError ||
    !OPERATION_ID_PATTERN.test(item.operationId) ||
    !DRIVE_ID_PATTERN.test(folderId) ||
    !accessToken ||
    accessToken.length > 8192 ||
    /\s/.test(accessToken)
  ) throw new DirectDriveUploadError("direct_drive_input_invalid");
}

function isSafeResumableLocation(value: string | null): value is string {
  if (!value || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "www.googleapis.com" &&
      url.pathname === "/upload/drive/v3/files" &&
      url.searchParams.has("upload_id") &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash
    );
  } catch {
    return false;
  }
}
