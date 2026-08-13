import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import * as googlePicker from "./googlePicker";
import type { PickerSession } from "./googlePicker";
import { googlePickerFailureMessage } from "./googlePickerErrors";
import {
  clearPwaDiagnosticsSession,
  configurePwaDiagnosticsDebugState,
  emitPwaDiagnostic,
  updatePwaDiagnosticsCsrf,
} from "./pwaDiagnostics";
import {
  ApiError,
  api,
  batchMutateWithCsrfRetry,
  mutateWithCsrfRetry,
  requestJson,
} from "./apiClient";
import {
  cancelLatestRequests,
  LATEST_REQUEST_CANCEL_REASON,
  settleLatestRequest,
} from "./latestRequest";
import {
  parsePlatformRoute,
  pushPlatformRoute,
  resolveRequestedProjectsView,
  type Page,
  type PlatformRoute,
  type ProjectsViewRequest,
  type SettingsSection,
} from "./platformRouting";
import {
  consumeGoogleMaintenanceOauthResult,
  consumeGoogleOauthResult,
  googleOauthMessages,
  type GoogleMaintenanceOauthResult,
  type GoogleOauthResult,
} from "./googleOauthResult";
import {
  formatTime,
  formatBytes,
  formatUploadLimit,
  retentionOptionLabel,
} from "./formatters";
import {
  isSupportedMediaFile,
  isSupportedSourceMimeType,
  normalizeSourceUploadPolicy,
  sourceUploadAccept,
  type SourceUploadPolicy,
} from "./sourceUploadPolicy";
import {
  isUsableJobSource,
  sourceСтатусLabel,
  type Source,
} from "./sourceModel";
import { isSafeDisplayUrl, ResourceExternalLink } from "./resourceLinks";
import {
  SourcesPanel,
  type SourceDeletionNotice,
} from "./SourcesPanel";
import { JobCard } from "./JobCard";
import { Login, type User } from "./Login";
import { PlatformSidebar } from "./PlatformSidebar";
import {
  isApprovedOutputUrl,
  type JobDetailState,
  type JobOutputsResponse,
  type JobOutputsState,
  type JobState,
  type TranscriptionJob,
  type TranscriptionLanguageMode,
} from "./jobModel";
import {
  DEFAULT_TRANSCRIPTION_LANGUAGE_MODE,
  composerSignature,
  buildBatchCreateRequest,
  expandComposerRows,
  formatSplitBoundary,
  makeIdempotencyKey,
  mergeJobsWithBatchOrder,
  newComposerRow,
  parseBatchPreflightResponse,
  parseSplitBoundary,
  type BatchCreateRequest,
  type BatchCreateResponse,
  type BatchPreflightResponse,
  type ComposerRow,
} from "./batchComposerModel";
import {
  type JobRetryResponse,
  type JobRetryState,
  type OutputReconciliationCheckResponse,
  type OutputReconciliationResponse,
  type OutputReconciliationState,
} from "./jobRecoveryModel";
import {
  cancellationIsConfirmed,
  dismissalIsConfirmed,
  reconciliationCheckIsConfirmed,
  retryIsConfirmed,
  runBoundedRequest,
} from "./jobMutationRequest";
import {
  parseProjectJobProgressResponse,
  terminalProgressState,
  updateRequestedProgressStates,
  type JobProgressState,
} from "./jobProgressModel";
import {
  JOB_PROGRESS_POLLING_STOP_REASON,
  startJobProgressPolling,
} from "./jobProgressPolling";
import { groupVisibleJobs } from "./jobVisibilityModel";
import { TranscriptionAnalyticsPanel } from "./TranscriptionAnalyticsPanel";
import { TranscriptCatalogMigrationPanel } from "./TranscriptCatalogMigrationPanel";
import { LiveTranscriptionPanel } from "./LiveTranscriptionPanel";
import {
  readStudioThemePreference,
  setStudioThemePreference,
  type StudioThemePreference,
} from "./theme";
import "./styles.css";

const SOURCE_RETENTION_TTL_OPTIONS_SECONDS = [
  3600, 86400, 259200, 604800, 2592000,
] as const;
type AccountPreferences = {
  source_retention_ttl_seconds: number;
  allowed_source_retention_ttl_seconds: number[];
};
function isExpectedAccountPreferences(
  candidate: unknown,
): candidate is AccountPreferences {
  if (!candidate || typeof candidate !== "object") return false;
  const preferences = candidate as Partial<AccountPreferences>;
  return (
    Number.isInteger(preferences.source_retention_ttl_seconds) &&
    Array.isArray(preferences.allowed_source_retention_ttl_seconds) &&
    preferences.allowed_source_retention_ttl_seconds.length ===
      SOURCE_RETENTION_TTL_OPTIONS_SECONDS.length &&
    preferences.allowed_source_retention_ttl_seconds.every(
      (seconds, index) =>
        seconds === SOURCE_RETENTION_TTL_OPTIONS_SECONDS[index],
    ) &&
    preferences.allowed_source_retention_ttl_seconds.includes(
      preferences.source_retention_ttl_seconds as number,
    )
  );
}
type Credential = {
  id: string;
  provider: "elevenlabs" | "openai";
  label: string;
  status: "active" | "revoked";
  masked_value: string | null;
  active_version: number | null;
};
function isExpectedCredential(candidate: unknown): candidate is Credential {
  if (!candidate || typeof candidate !== "object") return false;
  const credential = candidate as Partial<Credential>;
  return (
    typeof credential.id === "string" &&
    credential.id.length > 0 &&
    (credential.provider === "elevenlabs" || credential.provider === "openai") &&
    typeof credential.label === "string" &&
    credential.label.trim().length > 0 &&
    (credential.status === "active" || credential.status === "revoked") &&
    (credential.masked_value === null ||
      (typeof credential.masked_value === "string" &&
        credential.masked_value.length > 0)) &&
    (credential.active_version === null ||
      (Number.isInteger(credential.active_version) &&
        (credential.active_version as number) > 0))
  );
}
function parseCredentialCollection(candidate: unknown): Credential[] | null {
  if (!candidate || typeof candidate !== "object") return null;
  const credentials = (candidate as { credentials?: unknown }).credentials;
  if (!Array.isArray(credentials) || !credentials.every(isExpectedCredential)) {
    return null;
  }
  if (
    new Set(credentials.map((credential) => credential.id)).size !==
    credentials.length
  ) {
    return null;
  }
  return credentials;
}
async function requestCredentialCollection(
  signal?: AbortSignal,
): Promise<Credential[]> {
  const candidate = await api<unknown>("/credentials", {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const credentials = parseCredentialCollection(candidate);
  if (credentials === null) throw new Error("invalid_credentials_response");
  return credentials;
}
function isExpectedCredentialCreateResponse(
  candidate: unknown,
): candidate is Pick<Credential, "id" | "provider" | "label" | "status" | "masked_value"> {
  if (!candidate || typeof candidate !== "object") return false;
  const response = candidate as Record<string, unknown>;
  return (
    typeof response.id === "string" &&
    response.id.length > 0 &&
    (response.provider === "elevenlabs" || response.provider === "openai") &&
    typeof response.label === "string" &&
    response.label.trim().length > 0 &&
    response.status === "active" &&
    typeof response.masked_value === "string" &&
    response.masked_value.length > 0
  );
}
function isExpectedCredentialReplaceResponse(
  candidate: unknown,
): candidate is { ok: true; active_version: number; masked_value: string } {
  if (!candidate || typeof candidate !== "object") return false;
  const response = candidate as Record<string, unknown>;
  return (
    response.ok === true &&
    Number.isInteger(response.active_version) &&
    (response.active_version as number) > 0 &&
    typeof response.masked_value === "string" &&
    response.masked_value.length > 0
  );
}
function isExpectedOkResponse(candidate: unknown): candidate is { ok: true } {
  return (
    Boolean(candidate) &&
    typeof candidate === "object" &&
    (candidate as { ok?: unknown }).ok === true
  );
}
type Audit = { id: string; type: string; created_at: string };
type DiagnosticsSystem = {
  environment?: string;
  pwa_mode?: string;
  build?: { web?: string; api?: string; worker?: string };
  google_drive?: { connected?: boolean; scope_ready?: boolean };
  provider_credentials?: { active_count?: number; ready?: boolean };
  diagnostics?: {
    recording_enabled?: boolean;
    debug_recording?: string;
    retention_days?: number;
    debug_retention_hours?: number;
  };
  report_limits?: { max_days?: number; max_timeline_events?: number };
};
type DiagnosticsEvent = {
  id: string;
  occurred_at: string;
  last_occurred_at?: string;
  level: "ERROR" | "WARNING" | "INFO" | "DEBUG";
  component: "web" | "api" | "worker";
  event_code: string;
  project_id?: string | null;
  job_id?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  occurrence_count?: number;
};

function apiErrorDetailReason(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.data) return null;
  const payload = error.data;
  if (typeof payload !== "object" || !("detail" in payload)) return null;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail !== "object" || detail === null || !("reason" in detail)) {
    return null;
  }
  const reason = (detail as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : null;
}

type DiagnosticsEventsResponse = {
  events: DiagnosticsEvent[];
  next_cursor?: string | null;
  period: { start: string; end: string };
};
type DiagnosticsDebugSession = {
  active: boolean;
  started_at?: string | null;
  expires_at?: string | null;
  server_time?: string | null;
};
type Project = {
  id: string;
  title: string;
  description: string | null;
  output_drive_folder_id: string | null;
  output_drive_folder_url: string | null;
  output_drive_folder_name: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};
function isExpectedProject(candidate: unknown): candidate is Project {
  if (!candidate || typeof candidate !== "object") return false;
  const project = candidate as Partial<Project>;
  const nullableString = (value: unknown) =>
    value === null || typeof value === "string";
  const nullableDate = (value: unknown) =>
    value === null ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)));
  return (
    typeof project.id === "string" &&
    project.id.length > 0 &&
    typeof project.title === "string" &&
    project.title.length > 0 &&
    nullableString(project.description) &&
    nullableString(project.output_drive_folder_id) &&
    nullableString(project.output_drive_folder_url) &&
    nullableString(project.output_drive_folder_name) &&
    typeof project.created_at === "string" &&
    Number.isFinite(Date.parse(project.created_at)) &&
    typeof project.updated_at === "string" &&
    Number.isFinite(Date.parse(project.updated_at)) &&
    nullableDate(project.archived_at)
  );
}
function parseProjectCollection(candidate: unknown): Project[] | null {
  if (!candidate || typeof candidate !== "object") return null;
  const projects = (candidate as { projects?: unknown }).projects;
  if (!Array.isArray(projects) || !projects.every(isExpectedProject)) {
    return null;
  }
  if (new Set(projects.map((project) => project.id)).size !== projects.length) {
    return null;
  }
  return projects;
}
async function requestProjectCollection(
  signal?: AbortSignal,
): Promise<Project[]> {
  const candidate = await api<unknown>("/projects", {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const projects = parseProjectCollection(candidate);
  if (projects === null) throw new Error("invalid_projects_response");
  return projects;
}
type UploadInit = {
  source_id: string;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expires_in: number;
  };
};
type GoogleConnection = {
  connected: boolean;
  status: "active" | "revoked" | "error" | null;
  google_email: string | null;
  scopes: string | null;
  connected_at: string | null;
  revoked_at: string | null;
  picker_ready: boolean;
  picker_configured: boolean;
  picker_scope_ready: boolean;
  reconnect_required: boolean;
};
type GoogleConnectionReadState = "loading" | "ready" | "unavailable";
type GoogleOauthStart = { authorization_url: string; expires_at: string };
function isExpectedGoogleConnection(
  candidate: unknown,
): candidate is GoogleConnection {
  if (!candidate || typeof candidate !== "object") return false;
  const connection = candidate as Partial<GoogleConnection>;
  const nullableDate = (value: unknown) =>
    value === null ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)));
  const nullableString = (value: unknown, maxLength: number) =>
    value === null ||
    (typeof value === "string" && value.length > 0 && value.length <= maxLength);
  const statusIsExpected =
    connection.status === null ||
    connection.status === "active" ||
    connection.status === "revoked" ||
    connection.status === "error";
  if (
    typeof connection.connected !== "boolean" ||
    !statusIsExpected ||
    !nullableString(connection.google_email, 320) ||
    !nullableString(connection.scopes, 4096) ||
    !nullableDate(connection.connected_at) ||
    !nullableDate(connection.revoked_at) ||
    typeof connection.picker_ready !== "boolean" ||
    typeof connection.picker_configured !== "boolean" ||
    typeof connection.picker_scope_ready !== "boolean" ||
    typeof connection.reconnect_required !== "boolean"
  ) {
    return false;
  }
  return (
    connection.connected === (connection.status === "active") &&
    (!connection.picker_scope_ready || connection.connected) &&
    connection.picker_ready ===
      (connection.picker_configured && connection.picker_scope_ready) &&
    connection.reconnect_required ===
      (connection.connected && !connection.picker_scope_ready) &&
    (connection.status !== null ||
      (connection.google_email === null &&
        connection.scopes === null &&
        connection.connected_at === null &&
        connection.revoked_at === null))
  );
}
async function requestGoogleConnection(
  signal?: AbortSignal,
): Promise<GoogleConnection> {
  const candidate = await api<unknown>("/google/connection", {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  if (!isExpectedGoogleConnection(candidate)) {
    throw new Error("invalid_google_connection_response");
  }
  return candidate;
}
function isExpectedGoogleOauthStart(
  candidate: unknown,
): candidate is GoogleOauthStart {
  if (!candidate || typeof candidate !== "object") return false;
  const response = candidate as Partial<GoogleOauthStart>;
  if (
    typeof response.authorization_url !== "string" ||
    response.authorization_url.length > 8192 ||
    typeof response.expires_at !== "string" ||
    !Number.isFinite(Date.parse(response.expires_at))
  ) {
    return false;
  }
  try {
    const url = new URL(response.authorization_url);
    const allowedParameters = new Set([
      "client_id",
      "redirect_uri",
      "response_type",
      "scope",
      "state",
      "access_type",
      "prompt",
    ]);
    if (
      url.origin !== "https://accounts.google.com" ||
      url.pathname !== "/o/oauth2/v2/auth" ||
      url.username ||
      url.password ||
      url.hash ||
      [...url.searchParams.keys()].some((key) => !allowedParameters.has(key)) ||
      [...allowedParameters].some(
        (key) => url.searchParams.getAll(key).length !== 1,
      ) ||
      url.searchParams.get("response_type") !== "code" ||
      url.searchParams.get("access_type") !== "offline" ||
      url.searchParams.get("prompt") !== "consent" ||
      !url.searchParams.get("client_id") ||
      !url.searchParams.get("redirect_uri") ||
      !url.searchParams.get("state")
    ) {
      return false;
    }
    const scopes = url.searchParams.get("scope")?.split(" ") ?? [];
    return (
      scopes.length === 3 &&
      new Set(scopes).size === scopes.length &&
      scopes.includes("openid") &&
      scopes.includes("email") &&
      scopes.includes("https://www.googleapis.com/auth/drive.file")
    );
  } catch {
    return false;
  }
}
type SessionBootstrapСтатус =
  | "checking"
  | "authenticated"
  | "anonymous"
  | "error";
type SessionBootstrapState = {
  status: SessionBootstrapСтатус;
  user: User | null;
  csrf: string;
  error: string;
};
const emptySourceState = {
  loading: false,
  error: "",
  loaded: false,
  items: [] as Source[],
};
const emptyJobState: JobState = {
  loading: false,
  error: "",
  loaded: false,
  items: [],
};
function isExpectedGooglePickerSession(
  candidate: unknown,
): candidate is PickerSession {
  if (!candidate || typeof candidate !== "object") return false;
  const session = candidate as Partial<PickerSession>;
  return (
    typeof session.access_token === "string" &&
    session.access_token.trim().length > 0 &&
    typeof session.api_key === "string" &&
    session.api_key.trim().length > 0 &&
    typeof session.app_id === "string" &&
    session.app_id.trim().length > 0 &&
    session.scope_ready === true
  );
}
function isExpectedPickerSourceBatch(
  value: unknown,
  expectedCount: number,
  projectId: string,
): value is Source[] {
  if (!Array.isArray(value) || value.length !== expectedCount) return false;
  const sourceIds = new Set<string>();
  return value.every((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const source = candidate as Partial<Source>;
    if (
      typeof source.id !== "string" ||
      !source.id ||
      sourceIds.has(source.id) ||
      source.project_id !== projectId ||
      source.source_type !== "google_drive" ||
      source.upload_status !== "uploaded" ||
      typeof source.original_filename !== "string" ||
      !source.original_filename
    ) {
      return false;
    }
    sourceIds.add(source.id);
    return true;
  });
}
function isExpectedVerifiedGooglePickerFolder(
  candidate: unknown,
): candidate is { name: string; web_view_url: string | null } {
  if (!candidate || typeof candidate !== "object") return false;
  const folder = candidate as { name?: unknown; web_view_url?: unknown };
  return (
    typeof folder.name === "string" &&
    folder.name.trim().length > 0 &&
    (folder.web_view_url === null || typeof folder.web_view_url === "string")
  );
}
function credentialProfileLabel(c: Credential) {
  return c.active_version ? `${c.label} · v${c.active_version}` : c.label;
}
function isRetryableLocalUploadCompletionFailure(err: unknown) {
  return (
    err instanceof TypeError ||
    (err instanceof ApiError &&
      (err.status === 403 ||
        err.status === 408 ||
        err.status === 419 ||
        err.status >= 500))
  );
}
function isAmbiguousLocalUploadInitiationFailure(err: unknown) {
  return (
    err instanceof TypeError ||
    (err instanceof ApiError && (err.status === 408 || err.status >= 500))
  );
}
function localUploadHttpStatusCategory(status: number) {
  return status >= 100 && status <= 599
    ? (`${Math.floor(status / 100)}xx` as
        | "1xx"
        | "2xx"
        | "3xx"
        | "4xx"
        | "5xx")
    : "unknown";
}
function reportLocalUploadPutFailure(status?: number) {
  emitPwaDiagnostic("PWA_API_REQUEST_FAILED", {
    boundary: "api_request",
    error_code: "api_request_failed",
    endpoint_group: "sources",
    http_status_category:
      status === undefined ? "unknown" : localUploadHttpStatusCategory(status),
    retryable:
      status === undefined || status === 408 || status === 429 || status >= 500,
  });
}
function localUploadPutFailureMessage(status: number) {
  if (status === 401 || status === 403)
    return "Временная ссылка на загрузку отклонена. Обновите страницу и повторите попытку.";
  if (status === 408 || status === 429 || status >= 500)
    return "Временное хранилище сейчас недоступно. Повторите попытку позже.";
  if (status >= 400 && status < 500)
    return "Хранилище отклонило загрузку. Обновите страницу и повторите; если ошибка вернётся, сообщите администратору время попытки.";
  return "Не удалось загрузить файл во временное хранилище.";
}
function isSafeLocalUploadInit(
  candidate: unknown,
  expectedContentType: string,
): candidate is UploadInit {
  if (!candidate || typeof candidate !== "object") return false;
  const sourceId = (candidate as { source_id?: unknown }).source_id;
  const upload = (candidate as { upload?: unknown }).upload;
  if (
    typeof sourceId !== "string" ||
    !sourceId ||
    sourceId.length > 128 ||
    /\s/.test(sourceId) ||
    !upload ||
    typeof upload !== "object"
  )
    return false;
  const value = upload as Record<string, unknown>;
  if (
    value.method !== "PUT" ||
    !Number.isInteger(value.expires_in) ||
    (value.expires_in as number) < 60 ||
    (value.expires_in as number) > 900 ||
    !value.headers ||
    typeof value.headers !== "object" ||
    Array.isArray(value.headers)
  )
    return false;
  const headers = value.headers as Record<string, unknown>;
  if (
    Object.keys(headers).length !== 1 ||
    headers["Content-Type"] !== expectedContentType
  )
    return false;
  if (typeof value.url !== "string") return false;
  try {
    const url = new URL(value.url);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  } catch {
    return false;
  }
}
function isExpectedCompletedLocalSource(
  candidate: unknown,
  {
    sourceId,
    projectId,
    mimeType,
    sizeBytes,
  }: {
    sourceId: string;
    projectId: string;
    mimeType: string;
    sizeBytes: number;
  },
): candidate is Source {
  if (!candidate || typeof candidate !== "object") return false;
  const source = candidate as Partial<Source>;
  const validDate = (value: unknown) =>
    typeof value === "string" && Number.isFinite(Date.parse(value));
  return (
    source.id === sourceId &&
    source.project_id === projectId &&
    source.source_type === "local_upload" &&
    source.upload_status === "uploaded" &&
    typeof source.original_filename === "string" &&
    Boolean(source.original_filename) &&
    source.original_filename.length <= 255 &&
    source.mime_type === mimeType &&
    source.size_bytes === sizeBytes &&
    source.drive_file_url === null &&
    validDate(source.uploaded_at) &&
    validDate(source.expires_at) &&
    source.deleted_at === null &&
    source.delete_reason === null &&
    validDate(source.created_at) &&
    validDate(source.updated_at)
  );
}
const ELEVENLABS_CREDENTIAL_SESSION_KEY = "studio.elevenlabsCredentialId";
const JOB_DETAIL_REQUEST_TIMEOUT_MS = 15_000;
const PROJECT_COLLECTION_REQUEST_TIMEOUT_MS = 15_000;
const PROJECT_MUTATION_REQUEST_TIMEOUT_MS = 20_000;
const CREDENTIAL_COLLECTION_REQUEST_TIMEOUT_MS = 15_000;
const CREDENTIAL_MUTATION_REQUEST_TIMEOUT_MS = 20_000;
const ACCOUNT_PREFERENCES_REQUEST_TIMEOUT_MS = 15_000;
const SOURCE_UPLOAD_POLICY_REQUEST_TIMEOUT_MS = 15_000;
const ACCOUNT_PREFERENCES_MUTATION_TIMEOUT_MS = 20_000;
const GOOGLE_CONNECTION_REQUEST_TIMEOUT_MS = 15_000;
const GOOGLE_CONNECTION_MUTATION_TIMEOUT_MS = 20_000;
async function bootstrapSession(): Promise<{
  user: User;
  csrf: string;
} | null> {
  const session = await api<{ authenticated: boolean; user?: User }>(
    "/auth/session",
  );
  if (!session.authenticated || !session.user) return null;
  const csrf = await api<{ csrf_token: string }>("/auth/csrf", {
    method: "POST",
  });
  return { user: session.user, csrf: csrf.csrf_token };
}
async function csrfMutate<T>(
  path: string,
  csrf: string,
  onCsrf: (csrf: string) => void,
  options: RequestInit,
): Promise<T> {
  return mutateWithCsrfRetry<T>(path, csrf, onCsrf, options);
}
async function readAccountPreferencesBounded(): Promise<AccountPreferences | null> {
  try {
    const result = await runBoundedRequest(
      (signal) => api<unknown>("/account/preferences", { signal }),
      ACCOUNT_PREFERENCES_REQUEST_TIMEOUT_MS,
    );
    return result.status === "completed" &&
      isExpectedAccountPreferences(result.value)
      ? result.value
      : null;
  } catch {
    return null;
  }
}
async function readGoogleConnectionBounded(): Promise<GoogleConnection | null> {
  try {
    const result = await runBoundedRequest(
      (signal) => requestGoogleConnection(signal),
      GOOGLE_CONNECTION_REQUEST_TIMEOUT_MS,
    );
    return result.status === "completed" ? result.value : null;
  } catch {
    return null;
  }
}
async function requestSourceUploadPolicy(
  signal?: AbortSignal,
): Promise<SourceUploadPolicy> {
  const candidate = await api<unknown>("/sources/upload-policy", {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const policy = normalizeSourceUploadPolicy(candidate);
  if (!policy) throw new Error("invalid_source_upload_policy_response");
  return policy;
}
async function readCredentialCollectionBounded(): Promise<Credential[] | null> {
  try {
    const result = await runBoundedRequest(
      (signal) => requestCredentialCollection(signal),
      CREDENTIAL_COLLECTION_REQUEST_TIMEOUT_MS,
    );
    return result.status === "completed" ? result.value : null;
  } catch {
    return null;
  }
}
async function readAfterJobMutationTimeout<T>(path: string): Promise<T | null> {
  try {
    const result = await runBoundedRequest((signal) =>
      api<T>(path, { signal }),
    );
    return result.status === "completed" ? result.value : null;
  } catch {
    return null;
  }
}
function safeConfirm(message: string) {
  try {
    return window.confirm(message) === true;
  } catch {
    return false;
  }
}
export const __appDiagnosticsTest = { api, csrfMutate };
type JobMutationKind = "cancel" | "retry" | "reconciliation" | "dismiss";
type JobMutationNotice = {
  projectId: string;
  kind: JobMutationKind;
  jobId: string;
  message: string;
  tone: "notice" | "error";
};
type ProjectMutationKind = "create" | "update" | "archive";
type ProjectMutationOperation = {
  kind: ProjectMutationKind;
  projectId: string | null;
};
type ProjectMutationNotice = ProjectMutationOperation & {
  message: string;
  tone: "notice" | "error";
};
type CredentialMutationKind = "create" | "replace" | "revoke" | "delete";
type CredentialMutationOperation = {
  kind: CredentialMutationKind;
  credentialId: string | null;
  generation: number;
};
type CredentialMutationNotice = Pick<
  CredentialMutationOperation,
  "kind" | "credentialId"
> & {
  message: string;
  tone: "notice" | "error";
};
type RetentionMutationOperation = { generation: number };
type RetentionMutationNotice = {
  message: string;
  tone: "notice" | "error";
  refreshOnMount: boolean;
};
type GoogleConnectionMutationKind = "oauth-start" | "disconnect";
type GoogleConnectionMutationOperation = {
  kind: GoogleConnectionMutationKind;
  generation: number;
};
type GoogleConnectionMutationNotice = {
  kind: GoogleConnectionMutationKind;
  message: string;
  tone: "notice" | "error";
  refreshOnMount: boolean;
};
function credentialMutationKey(
  operation: Pick<CredentialMutationOperation, "credentialId">,
) {
  return operation.credentialId ?? "create";
}
function credentialMutationOperationMatches(
  left: CredentialMutationOperation,
  right: CredentialMutationOperation,
) {
  return (
    left.kind === right.kind &&
    left.credentialId === right.credentialId &&
    left.generation === right.generation
  );
}
function isAmbiguousCredentialMutationFailure(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && (error.status === 408 || error.status >= 500))
  );
}
function isAmbiguousRetentionMutationFailure(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && (error.status === 408 || error.status >= 500))
  );
}
function isAmbiguousGoogleConnectionMutationFailure(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && (error.status === 408 || error.status >= 500))
  );
}
function projectMutationKey(operation: ProjectMutationOperation) {
  return `${operation.kind}:${operation.projectId ?? "new"}`;
}
function isAmbiguousProjectMutationFailure(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && (error.status === 408 || error.status >= 500))
  );
}
type LocalUploadCompletionState =
  | { status: "uploaded"; source: Source }
  | { status: "pending" }
  | { status: "unavailable" };

type LocalUploadOperation = {
  projectId: string;
  panelId: string;
  rowId: string;
};

type LocalUploadNotice = LocalUploadOperation & {
  message: string;
  tone: "notice" | "error";
};

type GooglePickerOperationKind = "sources" | "folder:first" | "folder:second";
type GooglePickerOperation = {
  projectId: string;
  panelId: string;
  rowId: string;
  kind: GooglePickerOperationKind;
};
type GooglePickerNotice = GooglePickerOperation & {
  message: string;
  tone: "notice" | "error";
};
type GooglePickerOutcome = Pick<GooglePickerNotice, "message" | "tone">;

function googlePickerOperationKey(operation: GooglePickerOperation) {
  return `${operation.projectId}:${operation.panelId}:${operation.rowId}:${operation.kind}`;
}

function localUploadOperationKey(operation: LocalUploadOperation) {
  return `${operation.projectId}:${operation.panelId}:${operation.rowId}`;
}

type BatchSubmission = {
  signature: string;
  key: string;
  requestBody: BatchCreateRequest;
  status: "pending" | "ambiguous";
};
function jobMutationKey(kind: JobMutationKind, jobId: string) {
  return `${kind}:${jobId}`;
}
function PreparationPanel({
  project,
  csrf,
  onCsrf,
  jobs,
  sources,
  googleConnection,
  googleConnectionState,
  onReloadGoogleConnection,
  activeGooglePicker,
  googlePickerNotices,
  beginGooglePicker,
  finishGooglePicker,
  onLoadSources,
  onReloadSources,
  onReloadJobs,
  pendingJobMutations,
  jobMutationNotices,
  beginJobMutation,
  finishJobMutation,
  pendingSourceDeletions,
  sourceDeletionNotices,
  beginSourceDeletion,
  finishSourceDeletion,
  pendingLocalUploads,
  localUploadNotices,
  beginLocalUpload,
  finishLocalUpload,
  batchSubmission,
  beginBatchSubmission,
  retryBatchSubmission,
  markBatchSubmissionAmbiguous,
  clearBatchSubmission,
}: {
  project: Project;
  csrf: string;
  onCsrf: (csrf: string) => void;
  jobs: JobState;
  sources: typeof emptySourceState;
  googleConnection: GoogleConnection | null;
  googleConnectionState: GoogleConnectionReadState;
  onReloadGoogleConnection: () => void;
  activeGooglePicker: GooglePickerOperation | null;
  googlePickerNotices: Readonly<Record<string, GooglePickerNotice>>;
  beginGooglePicker: (operation: GooglePickerOperation) => boolean;
  finishGooglePicker: (
    operation: GooglePickerOperation,
    outcome?: GooglePickerOutcome,
  ) => void;
  onLoadSources: (projectId: string) => void;
  onReloadSources: (projectId: string) => void;
  onReloadJobs: (projectId: string) => void;
  pendingJobMutations: ReadonlySet<string>;
  jobMutationNotices: Readonly<Record<string, JobMutationNotice>>;
  beginJobMutation: (kind: JobMutationKind, jobId: string) => boolean;
  finishJobMutation: (
    kind: JobMutationKind,
    jobId: string,
    notice?: JobMutationNotice,
  ) => void;
  pendingSourceDeletions: ReadonlySet<string>;
  sourceDeletionNotices: Readonly<Record<string, SourceDeletionNotice>>;
  beginSourceDeletion: (sourceId: string) => boolean;
  finishSourceDeletion: (
    sourceId: string,
    notice: SourceDeletionNotice,
  ) => void;
  pendingLocalUploads: readonly LocalUploadOperation[];
  localUploadNotices: Readonly<Record<string, LocalUploadNotice>>;
  beginLocalUpload: (operation: LocalUploadOperation) => boolean;
  finishLocalUpload: (
    operation: LocalUploadOperation,
    notice: LocalUploadNotice,
  ) => void;
  batchSubmission: BatchSubmission | null;
  beginBatchSubmission: (
    submission: Omit<BatchSubmission, "status">,
  ) => boolean;
  retryBatchSubmission: (key: string) => boolean;
  markBatchSubmissionAmbiguous: (key: string) => void;
  clearBatchSubmission: (key: string) => void;
}) {
  const googlePickerPanelId = useId();
  const pickerBusy = activeGooglePicker !== null;
  const detachedGooglePickerPending =
    activeGooglePicker?.projectId === project.id &&
    activeGooglePicker.panelId !== googlePickerPanelId;
  const googlePickerBusyInOtherProject =
    activeGooglePicker !== null && activeGooglePicker.projectId !== project.id;
  const visibleGooglePickerNotices = Object.values(googlePickerNotices).filter(
    (notice) =>
      notice.projectId === project.id && notice.panelId !== googlePickerPanelId,
  );
  const localUploadPanelId = useId();
  const projectPendingLocalUploads = pendingLocalUploads.filter(
    (operation) => operation.projectId === project.id,
  );
  const detachedLocalUploadPending = projectPendingLocalUploads.some(
    (operation) => operation.panelId !== localUploadPanelId,
  );
  const localUploadBusyRows = new Set(
    projectPendingLocalUploads
      .filter((operation) => operation.panelId === localUploadPanelId)
      .map((operation) => operation.rowId),
  );
  const localUploadIsBusy = (rowId: string) =>
    detachedLocalUploadPending || localUploadBusyRows.has(rowId);
  const visibleLocalUploadNotices = Object.values(localUploadNotices).filter(
    (notice) =>
      notice.projectId === project.id &&
      notice.panelId !== localUploadPanelId,
  );
  const [rows, setRows] = useState<ComposerRow[]>(() => [newComposerRow()]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [languageMode, setLanguageMode] = useState<TranscriptionLanguageMode>(
    DEFAULT_TRANSCRIPTION_LANGUAGE_MODE,
  );
  const [diarizationEnabled, setDiarizationEnabled] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialsError, setCredentialsError] = useState("");
  const [sourceUploadPolicy, setSourceUploadPolicy] =
    useState<SourceUploadPolicy | null>(null);
  const [sourceUploadPolicyError, setSourceUploadPolicyError] = useState("");
  const [message, setMessage] = useState("");
  const [submissionStage, setSubmissionStage] = useState<
    "preflight" | "create" | null
  >(null);
  const [preflight, setPreflight] = useState<{
    signature: string;
    data: BatchPreflightResponse;
  } | null>(null);
  const [batchJobs, setBatchJobs] = useState<TranscriptionJob[]>([]);
  const [detail, setDetail] = useState<Record<string, JobDetailState>>({});
  const [outputs, setOutputs] = useState<Record<string, JobOutputsState>>({});
  const [reconciliations, setReconciliations] = useState<Record<string, OutputReconciliationState>>({});
  const [retries, setRetries] = useState<Record<string, JobRetryState>>({});
  const [progress, setProgress] = useState<Record<string, JobProgressState>>({});

  const [removedSourceIds, setRemovedSourceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [createdSources, setCreatedSources] = useState<Source[]>([]);
  const [rowIntakeStatus, setRowIntakeStatus] = useState<
    Record<string, string>
  >({});
  const [rowIntakeErrors, setRowIntakeErrors] = useState<
    Record<string, string>
  >({});
  const [recentlyAddedRow, setRecentlyAddedRow] = useState<{
    id: string;
    number: number;
  } | null>(null);
  const [rowAdditionStatus, setRowAdditionStatus] = useState("");
  const rowFolderPickerRef = useRef(false);
  const rowSourcePickerRef = useRef(false);
  const localUploadCsrfRef = useRef(csrf);
  const rowElementRefs = useRef(new Map<string, HTMLLIElement>());
  const reloadJobsRef = useRef(onReloadJobs);
  const jobRequestEpochsRef = useRef(new Map<string, number>());
  const jobRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );
  const prerequisiteRequestEpochsRef = useRef(new Map<string, number>());
  const prerequisiteRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );

  useEffect(() => {
    localUploadCsrfRef.current = csrf;
  }, [csrf]);
  useEffect(() => {
    reloadJobsRef.current = onReloadJobs;
  }, [onReloadJobs]);
  useEffect(
    () => () =>
      cancelLatestRequests(
        jobRequestEpochsRef.current,
        jobRequestControllersRef.current,
      ),
    [],
  );
  useEffect(
    () => () =>
      cancelLatestRequests(
        prerequisiteRequestEpochsRef.current,
        prerequisiteRequestControllersRef.current,
      ),
    [],
  );
  useEffect(() => {
    setRows([newComposerRow()]);
    setCreatedSources([]);
    setRemovedSourceIds(new Set());
    setRowIntakeStatus({});
    setRowIntakeErrors({});
    setBatchJobs([]);
    setPreflight(null);
    setMessage("");
    setProgress({});

    setLanguageMode(DEFAULT_TRANSCRIPTION_LANGUAGE_MODE);
    setDiarizationEnabled(false);
    setRecentlyAddedRow(null);
    setRowAdditionStatus("");
  }, [project.id]);
  useEffect(() => {
    if (!recentlyAddedRow) return;
    const rowElement = rowElementRefs.current.get(recentlyAddedRow.id);
    const sourceSelect = rowElement?.querySelector<HTMLSelectElement>(
      'select[aria-label^="Существующий файл"]',
    );
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    sourceSelect?.focus({ preventScroll: true });
    rowElement?.scrollIntoView?.({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
    setRowAdditionStatus(
      `Добавлена строка ${recentlyAddedRow.number}. Выберите источник.`,
    );
    const highlightTimeout = window.setTimeout(
      () => setRecentlyAddedRow(null),
      1000,
    );
    return () => window.clearTimeout(highlightTimeout);
  }, [recentlyAddedRow]);
  useEffect(() => {
    if (!rowAdditionStatus) return;
    const statusTimeout = window.setTimeout(
      () => setRowAdditionStatus(""),
      4000,
    );
    return () => window.clearTimeout(statusTimeout);
  }, [rowAdditionStatus]);
  const loadCredentials = () => {
    setCredentialsLoading(true);
    setCredentialsError("");
    void settleLatestRequest(
      prerequisiteRequestEpochsRef.current,
      "preparation:credentials",
      requestCredentialCollection,
      (nextCredentials) => {
        setCredentials(nextCredentials);
        setCredentialsLoading(false);
      },
      () => {
        setCredentialsError("Не удалось загрузить подключение ElevenLabs.");
        setCredentialsLoading(false);
      },
      {
        controllers: prerequisiteRequestControllersRef.current,
        timeoutMs: CREDENTIAL_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const loadSourceUploadPolicy = () => {
    setSourceUploadPolicy(null);
    setSourceUploadPolicyError("");
    void settleLatestRequest(
      prerequisiteRequestEpochsRef.current,
      "preparation:source-upload-policy",
      requestSourceUploadPolicy,
      (policy) => {
        setSourceUploadPolicy(policy);
      },
      () => {
        setSourceUploadPolicyError(
          "Не удалось загрузить правила локальной загрузки. Загрузка с устройства временно недоступна.",
        );
      },
      {
        controllers: prerequisiteRequestControllersRef.current,
        timeoutMs: SOURCE_UPLOAD_POLICY_REQUEST_TIMEOUT_MS,
      },
    );
  };
  useEffect(() => {
    loadCredentials();
    loadSourceUploadPolicy();
  }, []);
  const activeElevenLabsCredentials = credentials.filter(
    (credential) =>
      credential.provider === "elevenlabs" && credential.status === "active",
  );
  useEffect(() => {
    if (credentialsLoading || credentialsError) return;
    if (activeElevenLabsCredentials.length === 1) {
      setSelectedCredentialId(activeElevenLabsCredentials[0].id);
      sessionStorage.removeItem(ELEVENLABS_CREDENTIAL_SESSION_KEY);
      return;
    }
    if (activeElevenLabsCredentials.length > 1) {
      const saved =
        sessionStorage.getItem(ELEVENLABS_CREDENTIAL_SESSION_KEY) ?? "";
      if (
        saved &&
        activeElevenLabsCredentials.some(
          (credential) => credential.id === saved,
        )
      ) {
        setSelectedCredentialId(saved);
      } else {
        if (saved) sessionStorage.removeItem(ELEVENLABS_CREDENTIAL_SESSION_KEY);
        setSelectedCredentialId("");
      }
      return;
    }
    sessionStorage.removeItem(ELEVENLABS_CREDENTIAL_SESSION_KEY);
    setSelectedCredentialId("");
  }, [credentialsLoading, credentialsError, activeElevenLabsCredentials]);
  const sourceItems = [
    ...(Array.isArray(sources.items) ? sources.items : []),
    ...createdSources.filter(
      (created) => !sources.items.some((source) => source.id === created.id),
    ),
  ].filter((source) => !removedSourceIds.has(source.id));
  const visibleSources = { ...sources, items: sourceItems };
  const usableSources = sourceItems.filter(isUsableJobSource);
  const usableSourceIds = new Set(usableSources.map((source) => source.id));
  const signature = composerSignature(
    rows,
    selectedCredentialId,
    languageMode,
    diarizationEnabled,
  );
  useEffect(() => {
    if (preflight && preflight.signature !== signature) {
      setPreflight(null);
      setMessage("");
    }
  }, [preflight, signature]);
  const invalidSourceRowIds = new Set(
    rows
      .filter((row) => row.source_id && !usableSourceIds.has(row.source_id))
      .map((row) => row.id),
  );
  const duplicateRowIds = new Set<string>();
  const seenPairs = new Map<string, string>();
  rows.forEach((row) => {
    if (!row.source_id || !row.output_folder?.folder_id) return;
    const boundary = row.split_to_two_projects
      ? parseSplitBoundary(row.split_boundary)
      : null;
    const scopes = row.split_to_two_projects && boundary !== null
      ? [
          `${row.source_id}\u0000${row.output_folder.folder_id}\u00000\u0000${boundary}`,
          row.second_output_folder?.folder_id
            ? `${row.source_id}\u0000${row.second_output_folder.folder_id}\u0000${boundary}\u0000end`
            : "",
        ]
      : [`${row.source_id}\u0000${row.output_folder.folder_id}\u0000full`];
    scopes.filter(Boolean).forEach((scope) => {
      const previousRowId = seenPairs.get(scope);
      if (previousRowId) {
        duplicateRowIds.add(previousRowId);
        duplicateRowIds.add(row.id);
      } else {
        seenPairs.set(scope, row.id);
      }
    });
  });
  const googlePickerGuidance = (() => {
    if (googleConnectionState !== "ready") return "";
    if (!googleConnection?.connected) return "Google Drive не подключён.";
    if (googleConnection.reconnect_required)
      return "Переподключите Google Drive в настройках, чтобы выбрать файлы.";
    if (!googleConnection.picker_configured)
      return "Выбор файлов Google Drive временно недоступен.";
    if (!googleConnection.picker_scope_ready)
      return "Разрешение Google Drive для выбора файлов недоступно. Переподключите Google Drive.";
    return "";
  })();
  const driveSourcePickerEnabled = Boolean(
    googleConnectionState === "ready" &&
      googleConnection?.picker_ready &&
      !googlePickerGuidance,
  );

  const rowReadinessResults = rows.map((row, index) => {
    const rowNumber = index + 1;
    if (!row.source_id) {
      return { ready: false, reason: `Строка ${rowNumber}: выберите источник` };
    }
    if (!usableSourceIds.has(row.source_id)) {
      return {
        ready: false,
        reason: `Строка ${rowNumber}: выбранный файл больше недоступен`,
      };
    }
    if (!row.output_folder?.folder_id) {
      return {
        ready: false,
        reason: `Строка ${rowNumber}: выберите папку результата`,
      };
    }
    if (row.split_to_two_projects) {
      const boundary = parseSplitBoundary(row.split_boundary);
      if (boundary === null) {
        return {
          ready: false,
          reason: `Строка ${rowNumber}: укажите границу в формате ММ:СС или ЧЧ:ММ:СС`,
        };
      }
      if (!row.second_output_folder?.folder_id) {
        return {
          ready: false,
          reason: `Строка ${rowNumber}: выберите папку второй части`,
        };
      }
      if (
        row.second_output_folder.folder_id === row.output_folder.folder_id
      ) {
        return {
          ready: false,
          reason: `Строка ${rowNumber}: для двух проектов нужны разные папки`,
        };
      }
    }
    if (duplicateRowIds.has(row.id)) {
      return {
        ready: false,
        reason: `Строка ${rowNumber}: такая пара файла и папки уже добавлена`,
      };
    }
    return { ready: true, reason: "" };
  });
  const completeRowCount = rowReadinessResults.filter(
    (result) => result.ready,
  ).length;
  const firstReadinessBlocker =
    rowReadinessResults.find((result) => !result.ready)?.reason ?? "";
  const credentialBlocker = credentialsLoading
    ? "Загрузка подключения ElevenLabs…"
    : credentialsError
      ? credentialsError
      : !selectedCredentialId
        ? activeElevenLabsCredentials.length > 1
          ? "Выберите профиль подключения ElevenLabs"
          : "Добавьте активный ключ ElevenLabs в настройках"
        : "";
  const submitting =
    submissionStage !== null || batchSubmission?.status === "pending";
  const activePreflight =
    preflight?.signature === signature ? preflight.data : null;
  const expandedComposerItems = (() => {
    try {
      return expandComposerRows(rows);
    } catch {
      return [];
    }
  })();
  const plannedJobCount = rows.reduce(
    (count, row) => count + (row.split_to_two_projects ? 2 : 1),
    0,
  );
  const activeProviderAuthorityBlocked =
    activePreflight?.items.some(
      (item) => item.provider_attempt_authority.status === "blocked",
    ) ?? false;
  const activePreflightBlocked =
    (activePreflight?.summary.blocked_count ?? 0) > 0;
  const submitBlocker = submitting
    ? submissionStage === "preflight"
      ? "Проверяем план…"
      : "Создание задач…"
    : batchSubmission?.status === "ambiguous"
      ? "Сначала подтвердите исход предыдущей отправки"
      : credentialBlocker
        ? credentialBlocker
      : rows.length === 0
        ? "Добавьте хотя бы одну строку"
        : firstReadinessBlocker
          ? firstReadinessBlocker
          : activePreflightBlocked
            ? activeProviderAuthorityBlocked
              ? "Предыдущая транскрибация ещё выполняется или требует проверки"
              : "Для найденных результатов выберите явное решение"
            : "";
  const canSubmit =
    !submitting &&
    batchSubmission === null &&
    !credentialsLoading &&
    !credentialsError &&
    Boolean(selectedCredentialId) &&
    rows.length > 0 &&
    rowReadinessResults.every((result) => result.ready) &&
    !activePreflightBlocked;

  function sourceById(sourceId: string) {
    return sourceItems.find((source) => source.id === sourceId) ?? null;
  }
  function clearRowIntakeError(rowId: string) {
    setRowIntakeErrors((current) => {
      if (!current[rowId]) return current;
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }
  function placeSourcesInRows(targetRowId: string, selected: Source[]) {
    if (selected.length === 0) return;
    clearRowIntakeError(targetRowId);
    setCreatedSources((current) => {
      const existing = new Set(current.map((source) => source.id));
      return [
        ...current,
        ...selected.filter((source) => !existing.has(source.id)),
      ];
    });
    setRows((current) => {
      const targetIndex = current.findIndex((row) => row.id === targetRowId);
      const target = targetIndex >= 0 ? current[targetIndex] : null;
      const canFillTarget = Boolean(target && !target.source_id);
      const next = [...current];
      const [first, ...rest] = selected;
      const sourcesToAppend = canFillTarget ? rest : selected;
      if (canFillTarget && first) {
        next[targetIndex] = {
          ...next[targetIndex],
          source_id: first.id,
          reprocess_existing: false,
          second_reprocess_existing: false,
        };
      }
      next.push(
        ...sourcesToAppend.map((source) => ({
          ...newComposerRow(),
          source_id: source.id,
        })),
      );
      return next.length > 0 ? next : [newComposerRow()];
    });
  }
  async function readLocalUploadCompletionState(
    sourceId: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<LocalUploadCompletionState> {
    try {
      const result = await runBoundedRequest((signal) =>
        api<unknown>(`/projects/${project.id}/sources`, {
          signal,
          cache: "no-store",
        }),
      );
      if (result.status === "timed_out") return { status: "unavailable" };
      const value = result.value;
      if (!value || typeof value !== "object" || !("sources" in value)) {
        return { status: "unavailable" };
      }
      const items = (value as { sources?: unknown }).sources;
      if (!Array.isArray(items)) return { status: "unavailable" };
      const matches = items.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          (item as { id?: unknown }).id === sourceId,
      );
      if (matches.length !== 1) return { status: "unavailable" };
      const source = matches[0];
      const expected = { sourceId, projectId: project.id, mimeType, sizeBytes };
      if (isExpectedCompletedLocalSource(source, expected)) {
        return { status: "uploaded", source };
      }
      if (
        source &&
        typeof source === "object" &&
        (source as Partial<Source>).project_id === project.id &&
        (source as Partial<Source>).source_type === "local_upload" &&
        (source as Partial<Source>).upload_status === "pending" &&
        (source as Partial<Source>).mime_type === mimeType &&
        (source as Partial<Source>).size_bytes === sizeBytes &&
        (source as Partial<Source>).deleted_at === null
      ) {
        return { status: "pending" };
      }
      return { status: "unavailable" };
    } catch {
      return { status: "unavailable" };
    }
  }

  async function completeLocalUpload(
    sourceId: string,
    mimeType: string,
    sizeBytes: number,
  ) {
    const completeOnce = () =>
      runBoundedRequest((signal) =>
        csrfMutate<unknown>(
          `/sources/${sourceId}/local-upload/complete`,
          localUploadCsrfRef.current,
          (token) => {
            localUploadCsrfRef.current = token;
            onCsrf(token);
          },
          { method: "POST", signal },
        ),
      );
    const expected = {
      sourceId,
      projectId: project.id,
      mimeType,
      sizeBytes,
    };
    const validateCompleted = (candidate: unknown) => {
      if (!isExpectedCompletedLocalSource(candidate, expected)) {
        onReloadSources(project.id);
        throw new Error(
          "Сервер вернул несогласованное подтверждение загрузки. Список файлов обновлён; проверьте его перед повторной попыткой.",
        );
      }
      return candidate;
    };
    const reconcile = () =>
      readLocalUploadCompletionState(sourceId, mimeType, sizeBytes);

    let first;
    try {
      first = await completeOnce();
    } catch (err) {
      if (!isRetryableLocalUploadCompletionFailure(err)) throw err;
      first = { status: "timed_out" as const };
    }
    if (first.status === "completed") {
      return validateCompleted(first.value);
    }

    const firstState = await reconcile();
    if (firstState.status === "uploaded") return firstState.source;
    if (firstState.status !== "pending") {
      onReloadSources(project.id);
      throw new Error(
        "Сервер не подтвердил завершение загрузки. Список файлов обновлён; подождите и повторите при необходимости.",
      );
    }

    let second;
    let secondError: unknown;
    try {
      second = await completeOnce();
    } catch (err) {
      secondError = err;
      second = { status: "timed_out" as const };
    }
    if (second.status === "completed") {
      return validateCompleted(second.value);
    }
    const finalState = await reconcile();
    if (finalState.status === "uploaded") return finalState.source;
    if (
      secondError &&
      !isRetryableLocalUploadCompletionFailure(secondError)
    ) {
      throw secondError;
    }
    onReloadSources(project.id);
    throw new Error(
      "Сервер не подтвердил завершение загрузки. Список файлов обновлён; подождите и повторите при необходимости.",
    );
  }

  async function acquireGooglePickerSession() {
    let bounded;
    try {
      bounded = await runBoundedRequest((signal) =>
        csrfMutate<unknown>(
          "/google/picker/session",
          csrf,
          onCsrf,
          { method: "POST", signal },
        ),
      );
    } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      throw new Error(
        "Не удалось открыть Google Picker. Проверьте соединение и повторите попытку.",
        { cause: err },
      );
    }
    if (bounded.status === "timed_out") {
      throw new Error(
        "Google Picker не ответил вовремя. Повторите попытку.",
      );
    }
    if (!isExpectedGooglePickerSession(bounded.value)) {
      throw new Error(
        "Сервер вернул некорректную сессию Google Picker. Повторите попытку позже.",
      );
    }
    return bounded.value;
  }
  async function createGooglePickerSourceBatch(fileIds: string[]) {
    let bounded;
    try {
      bounded = await runBoundedRequest((signal) =>
        csrfMutate<unknown>(
          `/projects/${project.id}/sources/google-picker`,
          csrf,
          onCsrf,
          {
            method: "POST",
            body: JSON.stringify({ file_ids: fileIds }),
            signal,
          },
        ),
      );
    } catch (err) {
      const definitiveClientFailure =
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408;
      if (definitiveClientFailure) throw err;
      onReloadSources(project.id);
      throw new Error(
        "Сервер не подтвердил добавление файлов Google Drive. Список файлов обновлён; проверьте его перед повторным выбором.",
        { cause: err },
      );
    }
    if (bounded.status === "timed_out") {
      onReloadSources(project.id);
      throw new Error(
        "Сервер не подтвердил добавление файлов Google Drive. Список файлов обновлён; проверьте его перед повторным выбором.",
      );
    }
    const payload = bounded.value;
    const orderedSources =
      payload && typeof payload === "object" && "sources" in payload
        ? (payload as { sources?: unknown }).sources
        : undefined;
    if (
      !isExpectedPickerSourceBatch(
        orderedSources,
        fileIds.length,
        project.id,
      )
    ) {
      onReloadSources(project.id);
      throw new Error(
        "Сервер вернул неполный ответ для выбранных файлов. Список файлов обновлён; проверьте добавленные файлы перед повторным выбором.",
      );
    }
    return orderedSources;
  }
  async function chooseRowDriveSources(rowId: string) {
    const operation: GooglePickerOperation = {
      projectId: project.id,
      panelId: googlePickerPanelId,
      rowId,
      kind: "sources",
    };
    if (rowSourcePickerRef.current || !beginGooglePicker(operation)) return;
    rowSourcePickerRef.current = true;
    let outcome: GooglePickerOutcome | undefined;
    setRowIntakeErrors((current) => ({ ...current, [rowId]: "" }));
    setRowIntakeStatus((current) => ({
      ...current,
      [rowId]: "Открываем Google Drive Picker…",
    }));
    try {
      const session = await acquireGooglePickerSession();
      const result = await googlePicker.openGooglePicker("sources", session);
      if (result.action === "cancel") {
        const message = "Выбор файлов отменён.";
        setRowIntakeStatus((current) => ({
          ...current,
          [rowId]: message,
        }));
        outcome = { message, tone: "notice" };
        return;
      }
      if (result.action === "error") {
        setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
        setRowIntakeErrors((current) => ({
          ...current,
          [rowId]: result.message,
        }));
        outcome = { message: result.message, tone: "error" };
        return;
      }
      if (
        sourceUploadPolicy &&
        result.docs.some(
          (doc) =>
            doc.mimeType &&
            !isSupportedSourceMimeType(doc.mimeType, sourceUploadPolicy),
        )
      ) {
        const message =
          "В выборе есть файлы, не поддерживаемые текущими правилами.";
        setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
        setRowIntakeErrors((current) => ({
          ...current,
          [rowId]: message,
        }));
        outcome = { message, tone: "error" };
        return;
      }
      const fileIds = result.docs.map((doc) => doc.id);
      if (fileIds.length === 0) {
        const message = "Google Picker не вернул файлы.";
        setRowIntakeStatus((current) => ({
          ...current,
          [rowId]: message,
        }));
        outcome = { message, tone: "error" };
        return;
      }
      const orderedSources = await createGooglePickerSourceBatch(fileIds);
      placeSourcesInRows(rowId, orderedSources);
      setRowIntakeStatus((current) => ({
        ...current,
        [rowId]: `Добавлено файлов: ${orderedSources.length}.`,
      }));
      onReloadSources(project.id);
      outcome = {
        message:
          "Файлы Google Drive добавлены в проект. Выберите их в нужных строках заново.",
        tone: "notice",
      };
    } catch (err) {
      const pickerFailure = googlePickerFailureMessage(err);
      const message =
        pickerFailure ??
        (err instanceof ApiError && err.status === 422
          ? "Один или несколько файлов не поддерживаются. Выберите аудио, видео или OGG."
          : err instanceof Error
            ? err.message
            : "Не удалось выбрать файлы Google Drive.");
      setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
      setRowIntakeErrors((current) => ({
        ...current,
        [rowId]: message,
      }));
      outcome = { message, tone: "error" };
    } finally {
      rowSourcePickerRef.current = false;
      finishGooglePicker(operation, outcome);
    }
  }
  async function initiateLocalUpload(
    originalFilename: string,
    mimeType: string,
    sizeBytes: number,
  ) {
    let bounded;
    try {
      bounded = await runBoundedRequest((signal) =>
        csrfMutate<unknown>(
          `/projects/${project.id}/sources/local-upload/initiate`,
          localUploadCsrfRef.current,
          (token) => {
            localUploadCsrfRef.current = token;
            onCsrf(token);
          },
          {
            method: "POST",
            body: JSON.stringify({
              original_filename: originalFilename,
              mime_type: mimeType,
              size_bytes: sizeBytes,
            }),
            signal,
          },
        ),
      );
    } catch (err) {
      if (!isAmbiguousLocalUploadInitiationFailure(err)) throw err;
      onReloadSources(project.id);
      throw new Error(
        "Сервер не подтвердил подготовку загрузки. Список файлов обновлён; проверьте его перед новой попыткой.",
        { cause: err },
      );
    }
    if (bounded.status === "timed_out") {
      onReloadSources(project.id);
      throw new Error(
        "Сервер не подтвердил подготовку загрузки. Список файлов обновлён; проверьте его перед новой попыткой.",
      );
    }
    if (!isSafeLocalUploadInit(bounded.value, mimeType)) {
      onReloadSources(project.id);
      throw new Error(
        "Сервер вернул небезопасный ответ для загрузки. Список файлов обновлён; повторите попытку позже.",
      );
    }
    return bounded.value;
  }

  async function uploadRowLocalSources(
    rowId: string,
    e: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || localUploadIsBusy(rowId)) return;
    if (!sourceUploadPolicy?.local_upload_enabled) {
      setRowIntakeErrors((current) => ({
        ...current,
        [rowId]:
          sourceUploadPolicyError ||
          "Локальная загрузка временно недоступна. Повторите попытку позже.",
      }));
      return;
    }
    const operation: LocalUploadOperation = {
      projectId: project.id,
      panelId: localUploadPanelId,
      rowId,
    };
    if (!beginLocalUpload(operation)) return;
    let persistentNotice: LocalUploadNotice = {
      ...operation,
      message:
        "Локальная загрузка не завершена. Проверьте список файлов проекта перед повторной попыткой.",
      tone: "error",
    };
    try {
      const successful: Source[] = [];
      const failures: string[] = [];
      setRowIntakeErrors((current) => ({ ...current, [rowId]: "" }));
      for (const file of files) {
        if (!isSupportedMediaFile(file, sourceUploadPolicy)) {
          failures.push(
            `${file.name}: тип файла не поддерживается текущими правилами.`,
          );
          continue;
        }
        if (file.size <= 0) {
          failures.push(`${file.name}: файл пустой.`);
          continue;
        }
        if (file.size > sourceUploadPolicy.max_upload_bytes) {
          failures.push(
            `${file.name}: файл больше ${formatUploadLimit(sourceUploadPolicy.max_upload_bytes)}.`,
          );
          continue;
        }
        try {
          setRowIntakeStatus((current) => ({
            ...current,
            [rowId]: `${file.name} — подготовка загрузки…`,
          }));
          const expectedContentType =
            file.type || "application/octet-stream";
          const initiated = await initiateLocalUpload(
            file.name,
            expectedContentType,
            file.size,
          );
          setRowIntakeStatus((current) => ({
            ...current,
            [rowId]: `${file.name} — загрузка…`,
          }));
          let put: Response | null = null;
          let putIsAmbiguous = false;
          try {
            const boundedPut = await runBoundedRequest((signal) =>
              fetch(initiated.upload.url, {
                method: initiated.upload.method,
                headers: initiated.upload.headers,
                body: file,
                cache: "no-store",
                credentials: "omit",
                redirect: "error",
                referrerPolicy: "no-referrer",
                signal,
              }),
            );
            if (boundedPut.status === "completed") put = boundedPut.value;
            else putIsAmbiguous = true;
          } catch {
            putIsAmbiguous = true;
          }
          if (putIsAmbiguous) {
            reportLocalUploadPutFailure();
            setRowIntakeStatus((current) => ({
              ...current,
              [rowId]: `${file.name} — проверяем результат загрузки…`,
            }));
            const recovered = await completeLocalUpload(
              initiated.source_id,
              expectedContentType,
              file.size,
            );
            successful.push(recovered);
            placeSourcesInRows(rowId, [recovered]);
            continue;
          }
          if (put === null) {
            throw new Error("Не удалось загрузить файл во временное хранилище.");
          }
          if (!put.ok) {
            reportLocalUploadPutFailure(put.status);
            throw new Error(localUploadPutFailureMessage(put.status));
          }
          setRowIntakeStatus((current) => ({
            ...current,
            [rowId]: `${file.name} — подтверждаем загрузку…`,
          }));
          const completed = await completeLocalUpload(
            initiated.source_id,
            expectedContentType,
            file.size,
          );
          successful.push(completed);
          placeSourcesInRows(rowId, [completed]);
        } catch (err) {
          failures.push(
            `${file.name}: ${err instanceof Error ? err.message : "не удалось загрузить файл."}`,
          );
        }
      }
      if (successful.length > 0) onReloadSources(project.id);
      setRowIntakeStatus((current) => ({
        ...current,
        [rowId]: successful.length
          ? `Загружено файлов: ${successful.length}.`
          : "",
      }));
      if (failures.length > 0)
        setRowIntakeErrors((current) => ({
          ...current,
          [rowId]: failures.join(" "),
        }));
      persistentNotice = {
        ...operation,
        message:
          failures.length === 0
            ? "Локальная загрузка завершена. Обновлённый список файлов доступен в проекте."
            : successful.length > 0
              ? "Локальная загрузка завершена частично. Проверьте список файлов проекта и повторите неудачные файлы при необходимости."
              : "Локальная загрузка не завершена. Проверьте список файлов проекта перед повторной попыткой.",
        tone: failures.length === 0 ? "notice" : "error",
      };
    } finally {
      finishLocalUpload(operation, persistentNotice);
    }
  }

  function updateRow(rowId: string, patch: Partial<ComposerRow>) {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }
  function addRow() {
    const row = newComposerRow();
    setRows((current) => [...current, row]);
    setRecentlyAddedRow({ id: row.id, number: rows.length + 1 });
  }
  function moveRow(index: number, direction: -1 | 1) {
    setRows((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function chooseRowFolder(
    rowId: string,
    target: "first" | "second" = "first",
  ) {
    if (!driveSourcePickerEnabled || rowFolderPickerRef.current) return;
    const operation: GooglePickerOperation = {
      projectId: project.id,
      panelId: googlePickerPanelId,
      rowId,
      kind: target === "second" ? "folder:second" : "folder:first",
    };
    if (!beginGooglePicker(operation)) return;
    rowFolderPickerRef.current = true;
    let outcome: GooglePickerOutcome | undefined;
    setMessage("");
    try {
      const session = await acquireGooglePickerSession();
      const result = await googlePicker.openGooglePicker(
        "output-folder",
        session,
      );
      if (result.action === "cancel") {
        outcome = { message: "Выбор папки отменён.", tone: "notice" };
        return;
      }
      if (result.action === "error") {
        setMessage(result.message);
        outcome = { message: result.message, tone: "error" };
        return;
      }
      const folderId = result.docs[0]?.id;
      if (!folderId) {
        const message = "Выберите одну папку Google Drive.";
        setMessage(message);
        outcome = { message, tone: "error" };
        return;
      }
      let boundedVerification;
      try {
        boundedVerification = await runBoundedRequest((signal) =>
          batchMutateWithCsrfRetry<unknown>(
            `/projects/${project.id}/output-folders/google-picker/verify`,
            csrf,
            onCsrf,
            {
              method: "POST",
              body: JSON.stringify({ folder_id: folderId }),
              signal,
            },
          ),
        );
      } catch (err) {
        const message =
          googlePickerFailureMessage(err) ??
          (err instanceof ApiError && err.status === 422
            ? "Выбранная папка Google Drive недоступна для записи."
            : "Не удалось проверить папку результата. Повторите попытку.");
        setMessage(message);
        outcome = { message, tone: "error" };
        return;
      }
      if (boundedVerification.status === "timed_out") {
        const message =
          "Проверка папки результата заняла слишком много времени. Повторите выбор.";
        setMessage(message);
        outcome = { message, tone: "error" };
        return;
      }
      if (!isExpectedVerifiedGooglePickerFolder(boundedVerification.value)) {
        const message =
          "Сервер вернул некорректные данные папки результата. Повторите выбор позже.";
        setMessage(message);
        outcome = { message, tone: "error" };
        return;
      }
      const verified = boundedVerification.value;
      const outputFolder = {
        folder_id: folderId,
        name: verified.name,
        web_view_url: verified.web_view_url,
      };
      updateRow(
        rowId,
        target === "second"
          ? { second_output_folder: outputFolder }
          : { output_folder: outputFolder },
      );
      outcome = {
        message:
          "Папка Google Drive проверена, но прежняя строка больше не открыта. Выберите папку для строки повторно.",
        tone: "notice",
      };
    } catch (err) {
      const message =
        googlePickerFailureMessage(err) ??
        (err instanceof Error
          ? err.message
          : "Не удалось проверить папку результата.");
      setMessage(message);
      outcome = { message, tone: "error" };
    } finally {
      rowFolderPickerRef.current = false;
      finishGooglePicker(operation, outcome);
    }
  }
  async function performBatchCreation(
    requestBody: BatchCreateRequest,
    key: string,
  ) {
    try {
      const result = await runBoundedRequest((signal) =>
        batchMutateWithCsrfRetry<BatchCreateResponse>(
          `/projects/${project.id}/jobs/batch`,
          csrf,
          onCsrf,
          {
            method: "POST",
            headers: { "Idempotency-Key": key },
            body: JSON.stringify(requestBody),
            signal,
          },
        ),
      );
      if (result.status === "timed_out") {
        markBatchSubmissionAmbiguous(key);
        setMessage("");
        return;
      }
      const response = result.value;
      clearBatchSubmission(key);
      setBatchJobs(response.jobs);
      setRows([newComposerRow()]);
      setPreflight(null);
      setMessage(
        response.replayed
          ? `Повтор подтверждён: создано независимых задач: ${response.created_count}.`
          : `Создано независимых задач: ${response.created_count}.`,
      );
      onReloadJobs(project.id);
    } catch (err) {
      const definitiveClientFailure =
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408;
      if (definitiveClientFailure) clearBatchSubmission(key);
      else markBatchSubmissionAmbiguous(key);
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        apiErrorDetailReason(err) === "provider_authority_conflict"
      ) {
        setPreflight(null);
        setMessage(
          "Появилась активная или неразрешённая предыдущая транскрибация. Задачи не созданы; проверьте план заново после разрешения её статуса.",
        );
      } else if (err instanceof ApiError && err.status === 409) {
        setPreflight(null);
        setMessage(
          "План изменился или появился существующий результат. Повторите проверку и примите явное решение; задачи не созданы.",
        );
      } else if (err instanceof ApiError && err.status === 422) {
        setPreflight(null);
        setMessage(
          "Пакет не прошёл проверку. Строки сохранены — исправьте файлы или папки и отправьте снова.",
        );
      } else if (definitiveClientFailure) {
        setMessage(
          "Сервер отклонил создание пакета. Задачи не созданы; проверьте план и повторите отправку.",
        );
      } else {
        setMessage("");
      }
    }
  }
  async function replayAmbiguousBatch() {
    if (!batchSubmission || batchSubmission.status !== "ambiguous") return;
    if (!retryBatchSubmission(batchSubmission.key)) return;
    setMessage("");
    setSubmissionStage("create");
    try {
      await performBatchCreation(
        batchSubmission.requestBody,
        batchSubmission.key,
      );
    } finally {
      setSubmissionStage(null);
    }
  }
  async function createBatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    if (submitting) return;
    if (credentialsLoading || credentialsError || !selectedCredentialId) {
      setMessage(credentialBlocker || "Выберите активный профиль ElevenLabs.");
      return;
    }
    if (rows.length === 0) {
      setMessage("Добавьте хотя бы одну строку подготовки.");
      return;
    }
    if (firstReadinessBlocker) {
      setMessage(firstReadinessBlocker);
      return;
    }
    if (invalidSourceRowIds.size > 0) {
      setMessage(
        "Одна или несколько строк ссылаются на файл, который уже недоступен. Выберите готовый файл заново.",
      );
      return;
    }
    if (duplicateRowIds.size > 0) {
      setMessage(
        "Одинаковые пары файла и папки результата нельзя отправить дважды.",
      );
      return;
    }
    const requestBody = buildBatchCreateRequest(
      rows,
      selectedCredentialId,
      languageMode,
      diarizationEnabled,
    );
    const confirming = activePreflight !== null;
    if (batchSubmission) {
      setMessage("Сначала подтвердите исход предыдущей отправки пакета.");
      return;
    }
    setSubmissionStage(confirming ? "create" : "preflight");
    try {
      if (!confirming) {
        const result = await runBoundedRequest((signal) =>
          batchMutateWithCsrfRetry<unknown>(
            `/projects/${project.id}/jobs/batch/preflight`,
            csrf,
            onCsrf,
            { method: "POST", body: JSON.stringify(requestBody), signal },
          ),
        );
        if (result.status === "timed_out") {
          setMessage(
            "Проверка плана заняла слишком много времени. Задачи не создавались; повторите проверку.",
          );
          return;
        }
        const response = parseBatchPreflightResponse(result.value);
        if (
          !response ||
          response.items.length !== requestBody.items.length
        ) {
          throw new Error("Invalid batch preflight response");
        }
        setPreflight({ signature, data: response });
        const providerAuthorityBlocked = response.items.some(
          (item) => item.provider_attempt_authority.status === "blocked",
        );
        setMessage(
          response.summary.blocked_count > 0
            ? providerAuthorityBlocked
              ? "Найдена активная или неразрешённая предыдущая транскрибация. Повторная обработка заблокирована до разрешения её статуса."
              : "Найдены ранее созданные результаты. Выберите явное решение для каждой заблокированной строки."
            : "Проверка готова. Сверьте план и подтвердите создание задач.",
        );
        return;
      }
      const key = makeIdempotencyKey();
      if (!beginBatchSubmission({ signature, key, requestBody })) {
        setMessage(
          "Отправка пакета уже выполняется или требует подтверждения исхода.",
        );
        return;
      }
      await performBatchCreation(requestBody, key);
    } catch (err) {
      setMessage(
        err instanceof ApiError && err.status === 422
          ? "План не прошёл серверную проверку. Исправьте файлы, папки или профиль ElevenLabs."
          : "Не удалось проверить план. Задачи не созданы; повторите проверку.",
      );
    } finally {
      setSubmissionStage(null);
    }
  }
  function settleLatestJobRead<T>(
    key: string,
    path: string,
    onSuccess: (value: T) => void,
    onFailure: (error: unknown) => void,
  ) {
    return settleLatestRequest(
      jobRequestEpochsRef.current,
      key,
      (signal) =>
        api<T>(path, {
          signal,
          ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
        }),
      onSuccess,
      onFailure,
      {
        controllers: jobRequestControllersRef.current,
        timeoutMs: JOB_DETAIL_REQUEST_TIMEOUT_MS,
      },
    );
  }

  async function loadDetail(jobId: string) {
    setDetail((current) => ({
      ...current,
      [jobId]: { loading: true, error: "", job: current[jobId]?.job ?? null },
    }));
    setOutputs((current) => ({
      ...current,
      [jobId]: { loading: true, error: "", data: current[jobId]?.data ?? null },
    }));
    await Promise.all([
      settleLatestJobRead<TranscriptionJob>(
        `detail:${jobId}`,
        `/jobs/${jobId}`,
        (loaded) =>
          setDetail((current) => ({
            ...current,
            [jobId]: { loading: false, error: "", job: loaded },
          })),
        () =>
          setDetail((current) => ({
            ...current,
            [jobId]: {
              loading: false,
              error: "Не удалось загрузить детали задачи.",
              job: current[jobId]?.job ?? null,
            },
          })),
      ),
      settleLatestJobRead<JobRetryResponse>(
        `retry:${jobId}`,
        `/jobs/${jobId}/retry`,
        (data) =>
          setRetries((current) => ({
            ...current,
            [jobId]: {
              loading: false,
              posting: false,
              error: "",
              message: "",
              data,
            },
          })),
        () =>
          setRetries((current) => ({
            ...current,
            [jobId]: {
              loading: false,
              posting: false,
              error: "",
              message: "",
              data: null,
            },
          })),
      ),
      settleLatestJobRead<OutputReconciliationResponse>(
        `reconciliation:${jobId}`,
        `/jobs/${jobId}/output-reconciliation`,
        (data) =>
          setReconciliations((current) => ({
            ...current,
            [jobId]: {
              loading: false,
              checking: false,
              error: "",
              message: "",
              data,
            },
          })),
        () =>
          setReconciliations((current) => ({
            ...current,
            [jobId]: {
              loading: false,
              checking: false,
              error: "",
              message: "",
              data: null,
            },
          })),
      ),
      settleLatestJobRead<JobOutputsResponse>(
        `outputs:${jobId}`,
        `/jobs/${jobId}/outputs`,
        (data) =>
          setOutputs((current) => ({
            ...current,
            [jobId]: { loading: false, error: "", data },
          })),
        () =>
          setOutputs((current) => ({
            ...current,
            [jobId]: {
              loading: false,
              error: "Не удалось загрузить результаты.",
              data: current[jobId]?.data ?? null,
            },
          })),
      ),
    ]);
  }
  async function checkReconciliation(jobId: string) {
    if (!beginJobMutation("reconciliation", jobId)) return;
    let notice: JobMutationNotice | undefined;
    const beforeReconciliation = reconciliations[jobId]?.data ?? null;
    setReconciliations((current) => ({
      ...current,
      [jobId]: {
        ...(current[jobId] ?? {
          loading: false,
          error: "",
          message: "",
          data: null,
        }),
        checking: true,
        error: "",
        message: "",
      },
    }));
    try {
      const request = await runBoundedRequest((signal) =>
        csrfMutate<OutputReconciliationCheckResponse>(
          `/jobs/${jobId}/output-reconciliation/check`,
          csrf,
          onCsrf,
          { method: "POST", signal },
        ),
      );
      if (request.status === "timed_out") {
        const observed =
          await readAfterJobMutationTimeout<OutputReconciliationResponse>(
            `/jobs/${jobId}/output-reconciliation`,
          );
        const confirmed =
          observed !== null &&
          reconciliationCheckIsConfirmed(beforeReconciliation, observed);
        const message = confirmed
          ? "Сервер не ответил вовремя, но завершение проверки подтверждено по актуальному состоянию."
          : "Сервер не ответил вовремя. Результат проверки не подтверждён; обновите состояние перед повтором.";
        setReconciliations((current) => ({
          ...current,
          [jobId]: {
            ...(current[jobId] ?? {
              loading: false,
              data: null,
            }),
            checking: false,
            data: observed ?? current[jobId]?.data ?? null,
            error: confirmed ? "" : message,
            message: confirmed ? message : "",
          },
        }));
        notice = {
          projectId: project.id,
          kind: "reconciliation",
          jobId,
          message,
          tone: confirmed ? "notice" : "error",
        };
        void loadDetail(jobId);
        onReloadJobs(project.id);
        return;
      }
      const result = request.value;
      const message =
        result.resolved > 0
          ? "Документ найден и восстановлен."
          : result.conflicts > 0
            ? "Обнаружено несколько подходящих документов. Автоматическое восстановление заблокировано."
            : "Документ пока не найден в Google Drive.";
      setReconciliations((current) => ({
        ...current,
        [jobId]: {
          ...(current[jobId] ?? { loading: false, error: "", data: null }),
          checking: false,
          message,
        },
      }));
      notice = {
        projectId: project.id,
        kind: "reconciliation",
        jobId,
        message,
        tone: "notice",
      };
      void loadDetail(jobId);
      onReloadJobs(project.id);
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? "Google connection недоступен или reconciliation сейчас невозможен."
          : "Не удалось проверить Google Drive.";
      setReconciliations((current) => ({
        ...current,
        [jobId]: {
          ...(current[jobId] ?? {
            loading: false,
            message: "",
            data: null,
          }),
          checking: false,
          error: message,
        },
      }));
      notice = {
        projectId: project.id,
        kind: "reconciliation",
        jobId,
        message,
        tone: "error",
      };
    } finally {
      finishJobMutation("reconciliation", jobId, notice);
    }
  }

  async function retryJob(jobId: string) {
    if (!beginJobMutation("retry", jobId)) return;
    let notice: JobMutationNotice | undefined;
    const beforeRetry = retries[jobId]?.data ?? null;
    setRetries((current) => ({
      ...current,
      [jobId]: {
        ...(current[jobId] ?? {
          loading: false,
          error: "",
          message: "",
          data: null,
        }),
        posting: true,
        error: "",
        message: "",
      },
    }));
    try {
      const partialMode = [
        "partial_provider_resume_available",
        "partial_provider_restart_available",
      ].includes(beforeRetry?.reason ?? "");
      const request = await runBoundedRequest((signal) =>
        csrfMutate<JobRetryResponse>(
          `/jobs/${jobId}/retry`,
          csrf,
          onCsrf,
          {
            method: "POST",
            signal,
            body: partialMode
              ? JSON.stringify({ confirm_remaining_provider_cost: true })
              : undefined,
          },
        ),
      );
      if (request.status === "timed_out") {
        const observed = await readAfterJobMutationTimeout<JobRetryResponse>(
          `/jobs/${jobId}/retry`,
        );
        const confirmed =
          observed !== null && retryIsConfirmed(beforeRetry, observed);
        const message = confirmed
          ? "Сервер не ответил вовремя, но повтор подтверждён по актуальному состоянию задачи."
          : "Сервер не ответил вовремя. Статус повтора не подтверждён; проверьте задачу перед новым запуском.";
        setRetries((current) => ({
          ...current,
          [jobId]: {
            ...(current[jobId] ?? {
              loading: false,
              data: null,
            }),
            posting: false,
            data: observed ?? current[jobId]?.data ?? null,
            error: confirmed ? "" : message,
            message: confirmed ? message : "",
          },
        }));
        notice = {
          projectId: project.id,
          kind: "retry",
          jobId,
          message,
          tone: confirmed ? "notice" : "error",
        };
        void loadDetail(jobId);
        onReloadJobs(project.id);
        return;
      }
      const result = request.value;
      const message = partialMode
        ? "Подтверждённая обработка поставлена в очередь."
        : "Безопасный повтор поставлен в очередь.";
      setRetries((current) => ({
        ...current,
        [jobId]: {
          ...(current[jobId] ?? { loading: false, error: "", data: null }),
          posting: false,
          data: result,
          message,
        },
      }));
      notice = {
        projectId: project.id,
        kind: "retry",
        jobId,
        message,
        tone: "notice",
      };
      void loadDetail(jobId);
      onReloadJobs(project.id);
    } catch {
      const message = "Повтор сейчас недоступен.";
      setRetries((current) => ({
        ...current,
        [jobId]: {
          ...(current[jobId] ?? {
            loading: false,
            message: "",
            data: null,
          }),
          posting: false,
          error: message,
        },
      }));
      notice = {
        projectId: project.id,
        kind: "retry",
        jobId,
        message,
        tone: "error",
      };
    } finally {
      finishJobMutation("retry", jobId, notice);
    }
  }

  async function cancelJob(jobId: string) {
    if (!beginJobMutation("cancel", jobId)) return;
    let notice: JobMutationNotice | undefined;
    setMessage("");
    try {
      const request = await runBoundedRequest((signal) =>
        csrfMutate<TranscriptionJob>(
          `/jobs/${jobId}/cancel`,
          csrf,
          onCsrf,
          { method: "POST", signal },
        ),
      );
      if (request.status === "timed_out") {
        const observed = await readAfterJobMutationTimeout<TranscriptionJob>(
          `/jobs/${jobId}`,
        );
        const confirmed =
          observed !== null && cancellationIsConfirmed(observed);
        if (observed) {
          setDetail((current) => ({
            ...current,
            [jobId]: { loading: false, error: "", job: observed },
          }));
        }
        notice = {
          projectId: project.id,
          kind: "cancel",
          jobId,
          message: confirmed
            ? "Сервер не ответил вовремя, но отмена подтверждена по актуальному состоянию задачи."
            : "Сервер не ответил вовремя. Актуальное состояние не подтверждает отмену; проверьте задачу перед повтором.",
          tone: confirmed ? "notice" : "error",
        };
        onReloadJobs(project.id);
        return;
      }
      const cancelled = request.value;
      setDetail((current) => ({
        ...current,
        [jobId]: { loading: false, error: "", job: cancelled },
      }));
      notice = {
        projectId: project.id,
        kind: "cancel",
        jobId,
        message:
          "Запрос отмены отправлен. Уже созданные результаты останутся доступны.",
        tone: "notice",
      };
      onReloadJobs(project.id);
    } catch {
      notice = {
        projectId: project.id,
        kind: "cancel",
        jobId,
        message: "Не удалось отменить задачу. Повторите позже.",
        tone: "error",
      };
    } finally {
      finishJobMutation("cancel", jobId, notice);
    }
  }
  const displayJobs = mergeJobsWithBatchOrder(jobs.items ?? [], batchJobs);
  const {
    current: currentJobs,
    pinnedTerminal: pinnedTerminalJobs,
    recent: recentJobs,
  } = groupVisibleJobs(displayJobs);
  useEffect(() => {
    for (const job of pinnedTerminalJobs) {
      if (!detail[job.id]) void loadDetail(job.id);
    }
  }, [displayJobs]);
  const currentJobIds = currentJobs.map((job) => job.id).sort().join(",");
  useEffect(() => {
    if (!currentJobIds) {
      return;
    }
    const requestedIds = currentJobIds.split(",");
    return startJobProgressPolling(
      async ({ isStopped, signal }) => {
        setProgress((current) => {
          return updateRequestedProgressStates(current, requestedIds, (_jobId, previous) => ({
              loading: !previous?.data,
              error: "",
              data: previous?.data ?? null,
            }));
        });
        const raw = await api<unknown>(`/projects/${project.id}/jobs/progress`, {
          signal,
          ignoredAbortReason: JOB_PROGRESS_POLLING_STOP_REASON,
        });
        const parsed = parseProjectJobProgressResponse(raw);
        if (!parsed) throw new Error("Invalid job progress response");
        if (isStopped()) return;
        const byId = new Map(parsed.jobs.map((item) => [item.job_id, item]));
        setProgress((current) => {
          return updateRequestedProgressStates(current, requestedIds, (jobId, previous) => ({
              loading: false,
              error: "",
              data: byId.get(jobId) ?? previous?.data ?? null,
            }));
        });
        if (requestedIds.some((jobId) => !byId.has(jobId))) {
          void reloadJobsRef.current(project.id);
        }
      },
      () => {
        setProgress((current) => {
          return updateRequestedProgressStates(current, requestedIds, (_jobId, previous) => ({
              loading: false,
              error: "progress_unavailable",
              data: previous?.data ?? null,
            }));
        });
      },
    );
  }, [currentJobIds, project.id]);
  async function dismissTerminalJob(jobId: string) {
    if (!beginJobMutation("dismiss", jobId)) return;
    let notice: JobMutationNotice | undefined;
    setMessage("");
    try {
      const request = await runBoundedRequest((signal) =>
        csrfMutate<TranscriptionJob>(
          `/jobs/${jobId}/dismiss`,
          csrf,
          onCsrf,
          { method: "POST", signal },
        ),
      );
      if (request.status === "timed_out") {
        const observed = await readAfterJobMutationTimeout<TranscriptionJob>(
          `/jobs/${jobId}`,
        );
        const confirmed =
          observed !== null && dismissalIsConfirmed(observed);
        if (observed) {
          setDetail((current) => ({
            ...current,
            [jobId]: { loading: false, error: "", job: observed },
          }));
        }
        if (confirmed) {
          setProgress((current) => {
            const next = { ...current };
            delete next[jobId];
            return next;
          });
        }
        notice = {
          projectId: project.id,
          kind: "dismiss",
          jobId,
          message: confirmed
            ? "Сервер не ответил вовремя, но перенос в историю подтверждён по актуальному состоянию."
            : "Сервер не ответил вовремя. Перенос в историю не подтверждён; обновите состояние перед повтором.",
          tone: confirmed ? "notice" : "error",
        };
        onReloadJobs(project.id);
        return;
      }
      const dismissed = request.value;
      setDetail((current) => ({
        ...current,
        [jobId]: { loading: false, error: "", job: dismissed },
      }));
      setProgress((current) => {
        const next = { ...current };
        delete next[jobId];
        return next;
      });
      await onReloadJobs(project.id);
    } catch {
      notice = {
        projectId: project.id,
        kind: "dismiss",
        jobId,
        message: "Не удалось убрать задачу в историю. Повторите позже.",
        tone: "error",
      };
    } finally {
      finishJobMutation("dismiss", jobId, notice);
    }
  }
  function renderJobCard(job: TranscriptionJob, pinnedTerminal = false) {
    const currentDetail = detail[job.id];
    const detailedJob = currentDetail?.job;
    const reconciliation = reconciliations[job.id];
    const retry = detailedJob ? retries[detailedJob.id] : undefined;
    return (
      <JobCard
        key={job.id}
        job={job}
        detail={currentDetail}
        outputs={outputs[job.id]}
        reconciliation={
          reconciliation
            ? {
                ...reconciliation,
                checking:
                  reconciliation.checking ||
                  pendingJobMutations.has(
                    jobMutationKey("reconciliation", job.id),
                  ),
              }
            : undefined
        }
        retry={
          retry
            ? {
                ...retry,
                posting:
                  retry.posting ||
                  pendingJobMutations.has(jobMutationKey("retry", job.id)),
              }
            : undefined
        }
        progress={
          ["queued", "processing"].includes(job.status)
            ? progress[job.id]
            : pinnedTerminal
              ? terminalProgressState(progress[job.id], job.status)
              : undefined
        }
        onOpen={loadDetail}
        onCancel={cancelJob}
        cancelPending={pendingJobMutations.has(
          jobMutationKey("cancel", job.id),
        )}
        onCheckReconciliation={checkReconciliation}
        onRetry={retryJob}
        pinnedTerminal={pinnedTerminal}
        dismissPending={pendingJobMutations.has(
          jobMutationKey("dismiss", job.id),
        )}
        onDismissTerminal={dismissTerminalJob}
      />
    );
  }
  const visibleJobMutationNotices = Object.values(jobMutationNotices).filter(
    (notice) => {
      if (notice.projectId !== project.id) return false;
      if (notice.kind === "retry") {
        const local = retries[notice.jobId];
        return !(local?.message || local?.error);
      }
      if (notice.kind === "reconciliation") {
        const local = reconciliations[notice.jobId];
        return !(local?.message || local?.error);
      }
      return true;
    },
  );
  return (
    <section className="preparation" aria-label={`Подготовка ${project.title}`}>
      {detachedGooglePickerPending && (
        <p className="muted" role="status">
          Выбор в Google Drive для этого проекта ещё выполняется. Дождитесь
          завершения перед новой попыткой.
        </p>
      )}
      {googlePickerBusyInOtherProject && (
        <p className="muted" role="status">
          Google Picker занят операцией в другом проекте. Дождитесь её
          завершения.
        </p>
      )}
      {visibleGooglePickerNotices.map((notice) => (
        <p
          key={googlePickerOperationKey(notice)}
          className={notice.tone}
          role="status"
        >
          {notice.message}
        </p>
      ))}
      {detachedLocalUploadPending && (
        <p className="muted" role="status">
          Загрузка файлов для этого проекта ещё выполняется. Дождитесь
          завершения перед новым выбором.
        </p>
      )}
      {visibleLocalUploadNotices.map((notice) => (
        <p
          key={localUploadOperationKey(notice)}
          className={notice.tone}
          role="status"
        >
          {notice.message}
        </p>
      ))}
      <form
        className="job-creator composer"
        onSubmit={createBatch}
        aria-label="Композитор пакетных задач"
      >
        <div className="composer-header">
          <div>
            <h4>Подготовка задач</h4>
            <p className="muted">
              Одна строка создаёт одну независимую задачу: один файл → одна
              папка результата.
            </p>
          </div>
          <div className="composer-add-row">
            <button type="button" className="secondary" onClick={addRow}>
              Добавить строку
            </button>
            <span
              className="composer-add-row-status"
              role="status"
              aria-live="polite"
              aria-label="Результат добавления строки"
            >
              {rowAdditionStatus}
            </span>
          </div>
        </div>
        <div className="provider-card">
          <div>
            <span className="field-label">Провайдер транскрибации</span>
            <strong>ElevenLabs</strong>
            {selectedCredentialId && !credentialsError && (
              <span className="provider-ready">Подключён и готов</span>
            )}
            <p className="muted">
              Ключи создаются и изменяются только в настройках.
            </p>
          </div>
          {credentialsLoading && <p role="status">Загрузка подключения…</p>}
          {credentialsError && (
            <div className="notice" role="alert">
              <p>{credentialsError}</p>
              <button type="button" onClick={loadCredentials}>
                Повторить загрузку подключения ElevenLabs
              </button>
            </div>
          )}
          {!credentialsLoading &&
            !credentialsError &&
            activeElevenLabsCredentials.length === 0 && (
              <div>
                <p className="notice">
                  Добавьте активный ключ ElevenLabs в настройках, чтобы
                  создавать задачи.
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("studio:navigate-settings"),
                    )
                  }
                >
                  Перейти в настройки
                </button>
              </div>
            )}
          {!credentialsLoading &&
            !credentialsError &&
            activeElevenLabsCredentials.length > 1 && (
              <label className="profile-selector">
                Профиль подключения
                <select
                  aria-label="Профиль подключения"
                  value={selectedCredentialId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedCredentialId(value);
                    if (value) {
                      sessionStorage.setItem(
                        ELEVENLABS_CREDENTIAL_SESSION_KEY,
                        value,
                      );
                    } else {
                      sessionStorage.removeItem(
                        ELEVENLABS_CREDENTIAL_SESSION_KEY,
                      );
                    }
                  }}
                >
                  <option value="">Выберите профиль</option>
                  {activeElevenLabsCredentials.map((credential) => (
                    <option key={credential.id} value={credential.id}>
                      {credentialProfileLabel(credential)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          <label className="profile-selector">
            Язык транскрибации
            <select
              aria-label="Язык транскрибации"
              value={languageMode}
              onChange={(event) => {
                setLanguageMode(
                  event.target.value as TranscriptionLanguageMode,
                );
                setRows((current) =>
                  current.map((row) => ({
                    ...row,
                    reprocess_existing: false,
                    second_reprocess_existing: false,
                  })),
                );
              }}
            >
              <option value="ru">Русский</option>
              <option value="detect">Автоопределение</option>
            </select>
          </label>
          <label className="transcription-toggle">
            <input
              type="checkbox"
              aria-label="Разделять на спикеров"
              checked={diarizationEnabled}
              onChange={(event) => {
                setDiarizationEnabled(event.target.checked);
                setRows((current) =>
                  current.map((row) => ({
                    ...row,
                    reprocess_existing: false,
                    second_reprocess_existing: false,
                  })),
                );
              }}
            />
            <span>
              <strong>Разделять на спикеров</strong>
              <small>
                В документе появятся последовательные блоки Speaker 1,
                Speaker 2 и далее.
              </small>
            </span>
          </label>
        </div>
        <div
          className="composer-status"
          role="status"
          aria-live="polite"
          aria-label="Готовность строк подготовки"
        >
          <b>
            Готово: {completeRowCount} из {rows.length}
          </b>
          <span>
            {firstReadinessBlocker
              ? firstReadinessBlocker
              : "Все строки готовы"}
          </span>
        </div>
        {sourceUploadPolicy?.local_upload_enabled ? (
          <p className="muted">
            Локальная загрузка: до{" "}
            {formatUploadLimit(sourceUploadPolicy.max_upload_bytes)}. Допустимые
            типы получены с сервера.
          </p>
        ) : sourceUploadPolicy ? (
          <p className="notice">Локальная загрузка временно недоступна.</p>
        ) : sourceUploadPolicyError ? (
          <div className="notice" role="alert">
            <p>{sourceUploadPolicyError}</p>
            <button type="button" onClick={loadSourceUploadPolicy}>
              Повторить загрузку правил
            </button>
          </div>
        ) : (
          <p className="muted">Загружаем правила локальной загрузки…</p>
        )}
        {googleConnectionState === "loading" && (
          <p className="muted" role="status">
            Проверяем подключение Google Drive…
          </p>
        )}
        {googleConnectionState === "unavailable" && (
          <div className="notice" role="alert">
            <p>Не удалось проверить подключение Google Drive.</p>
            <button type="button" onClick={onReloadGoogleConnection}>
              Повторить проверку Google Drive
            </button>
          </div>
        )}
        <fieldset className="composer-rows">
          <legend>Строки подготовки</legend>
          {!sources.loaded && (
            <button type="button" onClick={() => onLoadSources(project.id)}>
              Загрузить существующие файлы проекта
            </button>
          )}
          {sources.loaded && usableSources.length === 0 && (
            <section className="empty-state">
              <p>
                Сначала добавьте хотя бы один готовый файл через строку
                подготовки.
              </p>
            </section>
          )}
          <ol>
            {rows.map((row, index) => {
              const selectedSource = sourceById(row.source_id);
              const duplicate = duplicateRowIds.has(row.id);
              const rowReadiness = rowReadinessResults[index];
              const rowReady = rowReadiness.ready;
              return (
                <li
                  className={`composer-row${
                    recentlyAddedRow?.id === row.id
                      ? " composer-row-added"
                      : ""
                  }`}
                  key={row.id}
                  aria-label={`Задача ${index + 1}`}
                  ref={(element) => {
                    if (element) rowElementRefs.current.set(row.id, element);
                    else rowElementRefs.current.delete(row.id);
                  }}
                >
                  <div className="composer-row-header">
                    <div>
                      <b>Задача {index + 1}</b>
                      <span>{rowReady ? "Готова" : "Нужно заполнить"}</span>
                    </div>
                    {rows.length > 1 && (
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => moveRow(index, -1)}
                          disabled={index === 0}
                          aria-label={`Поднять строку ${index + 1}`}
                        >
                          Выше
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRow(index, 1)}
                          disabled={index === rows.length - 1}
                          aria-label={`Опустить строку ${index + 1}`}
                        >
                          Ниже
                        </button>
                        <button
                          type="button"
                          className="secondary danger"
                          onClick={() =>
                            setRows((current) =>
                              current.length > 1
                                ? current.filter((item) => item.id !== row.id)
                                : current,
                            )
                          }
                          aria-label={`Удалить строку ${index + 1}`}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="composer-row-grid">
                    <section
                      className="row-source-cell"
                      aria-label={`Источник строки ${index + 1}`}
                    >
                      <label>
                        Источник
                        <select
                          aria-label={`Существующий файл для строки ${index + 1}`}
                          value={row.source_id}
                          onChange={(e) => {
                            updateRow(row.id, {
                              source_id: e.target.value,
                              reprocess_existing: false,
                              second_reprocess_existing: false,
                            });
                            if (e.target.value) clearRowIntakeError(row.id);
                          }}
                        >
                          <option value="">Выберите существующий файл</option>
                          {sourceItems.map((source) => (
                            <option
                              key={source.id}
                              value={source.id}
                              disabled={!isUsableJobSource(source)}
                            >
                              {source.original_filename} ·{" "}
                              {sourceСтатусLabel(source.upload_status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="row-source-actions">
                        <button
                          type="button"
                          className="secondary"
                          aria-label="Выбрать файлы Google Drive"
                          disabled={!driveSourcePickerEnabled || pickerBusy}
                          onClick={() => void chooseRowDriveSources(row.id)}
                        >
                          Из Google Drive
                        </button>
                        <span className="file-picker-control">
                          <label
                            className={`button-like secondary${
                              sourceUploadPolicy?.local_upload_enabled &&
                              !localUploadIsBusy(row.id)
                                ? ""
                                : " disabled"
                            }`}
                            htmlFor={`local-source-upload-${row.id}`}
                            aria-disabled={
                              !sourceUploadPolicy?.local_upload_enabled ||
                              localUploadIsBusy(row.id)
                            }
                          >
                            <span aria-hidden="true">С устройства</span>
                            <span className="visually-hidden">
                              Выбрать файлы с устройства для строки {index + 1}
                            </span>
                          </label>
                          <input
                            id={`local-source-upload-${row.id}`}
                            className="visually-hidden"
                            aria-label={`Выбрать файлы с устройства для строки ${index + 1}`}
                            type="file"
                            multiple
                            accept={
                              sourceUploadPolicy?.local_upload_enabled
                                ? sourceUploadAccept(sourceUploadPolicy)
                                : undefined
                            }
                            disabled={
                              !sourceUploadPolicy?.local_upload_enabled ||
                              localUploadIsBusy(row.id)
                            }
                            aria-busy={localUploadIsBusy(row.id)}
                            onChange={(e) =>
                              void uploadRowLocalSources(row.id, e)
                            }
                          />
                        </span>
                      </div>
                      {googlePickerGuidance && (
                        <p className="notice">{googlePickerGuidance}</p>
                      )}
                      {selectedSource && (
                        <div className="selected-source-summary">
                          <b>{selectedSource.original_filename}</b>
                          <span>
                            {selectedSource.source_type === "google_drive"
                              ? "Google Drive"
                              : "С устройства"}
                          </span>
                          <span>
                            Статус:{" "}
                            {sourceСтатусLabel(selectedSource.upload_status)}
                          </span>
                          {selectedSource.source_type === "local_upload" &&
                            selectedSource.expires_at && (
                              <span>
                                Временная копия хранится до:{" "}
                                {formatTime(selectedSource.expires_at)}
                              </span>
                            )}
                          {isSafeDisplayUrl(
                            selectedSource.drive_file_url ?? null,
                          ) && (
                            <ResourceExternalLink
                              href={selectedSource.drive_file_url ?? ""}
                              label="Открыть файл"
                              ariaLabel={`Открыть источник строки ${index + 1} в Google Drive`}
                            />
                          )}
                        </div>
                      )}
                      {rowIntakeStatus[row.id] && (
                        <p role="status" className="muted">
                          {rowIntakeStatus[row.id]}
                        </p>
                      )}
                      {rowIntakeErrors[row.id] && (
                        <p className="error">{rowIntakeErrors[row.id]}</p>
                      )}
                    </section>
                    <div className="folder-cell">
                      <span className="field-label">
                        {row.split_to_two_projects
                          ? "Папка первой части"
                          : "Папка результата"}
                      </span>
                      <span>
                        {row.output_folder?.name || "Папка не выбрана"}
                      </span>
                      {row.output_folder?.web_view_url &&
                        isApprovedOutputUrl(row.output_folder.web_view_url) && (
                          <ResourceExternalLink
                            href={row.output_folder.web_view_url}
                            label="Открыть папку"
                            ariaLabel={`Открыть папку результата строки ${index + 1} в Google Drive`}
                          />
                        )}
                      <button
                        type="button"
                        className="secondary"
                        disabled={!driveSourcePickerEnabled || pickerBusy}
                        onClick={() => void chooseRowFolder(row.id)}
                        aria-label={`Выбрать папку результата для строки ${index + 1}`}
                      >
                        {row.output_folder?.folder_id ? "Изменить" : "Выбрать"}
                      </button>
                    </div>
                    <label>
                      {row.split_to_two_projects
                        ? "Название первой части"
                        : "Название документа"}
                      <input
                        value={row.title}
                        onChange={(e) =>
                          updateRow(row.id, { title: e.target.value })
                        }
                        maxLength={160}
                        placeholder="Необязательно"
                        aria-label={`Название задачи для строки ${index + 1}`}
                      />
                      <small className="muted">
                        Необязательно. Если оставить пустым, Google Docs
                        получит имя исходного файла.
                      </small>
                    </label>
                  </div>
                  <label className="split-project-toggle">
                    <input
                      type="checkbox"
                      checked={row.split_to_two_projects}
                      onChange={(event) =>
                        updateRow(row.id, {
                          split_to_two_projects: event.target.checked,
                          reprocess_existing: false,
                          second_reprocess_existing: false,
                        })
                      }
                    />
                    <span>
                      Разделить созвон на два проекта и создать два документа
                    </span>
                  </label>
                  {row.split_to_two_projects && (
                    <section
                      className="split-project-panel"
                      aria-label={
                        "Разделение строки " + (index + 1) + " на два проекта"
                      }
                    >
                      <label>
                        Граница между проектами
                        <input
                          value={row.split_boundary}
                          onChange={(event) =>
                            updateRow(row.id, {
                              split_boundary: event.target.value,
                              reprocess_existing: false,
                              second_reprocess_existing: false,
                            })
                          }
                          inputMode="numeric"
                          placeholder="10:10"
                          aria-label={
                            "Граница разделения строки " + (index + 1)
                          }
                        />
                        <small className="muted">
                          Формат ММ:СС или ЧЧ:ММ:СС. Первая часть: начало —
                          {parseSplitBoundary(row.split_boundary) === null
                            ? " граница"
                            : " " +
                              formatSplitBoundary(
                                parseSplitBoundary(row.split_boundary) ?? 0,
                              )}
                          ; вторая: от границы до конца.
                        </small>
                      </label>
                      <div className="folder-cell">
                        <span className="field-label">Папка второй части</span>
                        <span>
                          {row.second_output_folder?.name ||
                            "Папка не выбрана"}
                        </span>
                        {row.second_output_folder?.web_view_url &&
                          isApprovedOutputUrl(
                            row.second_output_folder.web_view_url,
                          ) && (
                            <ResourceExternalLink
                              href={row.second_output_folder.web_view_url}
                              label="Открыть папку"
                              ariaLabel={
                                "Открыть папку второй части строки " +
                                (index + 1) +
                                " в Google Drive"
                              }
                            />
                          )}
                        <button
                          type="button"
                          className="secondary"
                          disabled={
                            !driveSourcePickerEnabled || pickerBusy
                          }
                          onClick={() =>
                            void chooseRowFolder(row.id, "second")
                          }
                          aria-label={
                            "Выбрать папку второй части для строки " +
                            (index + 1)
                          }
                        >
                          {row.second_output_folder?.folder_id
                            ? "Изменить"
                            : "Выбрать"}
                        </button>
                      </div>
                      <label>
                        Название второй части
                        <input
                          value={row.second_title}
                          onChange={(event) =>
                            updateRow(row.id, {
                              second_title: event.target.value,
                            })
                          }
                          maxLength={160}
                          placeholder="Необязательно"
                          aria-label={
                            "Название второй части строки " + (index + 1)
                          }
                        />
                      </label>
                      {row.output_folder?.folder_id &&
                        row.second_output_folder?.folder_id ===
                          row.output_folder.folder_id && (
                          <p className="error">
                            Выберите разные папки для двух проектов.
                          </p>
                        )}
                    </section>
                  )}
                  {invalidSourceRowIds.has(row.id) && (
                    <p className="error">
                      Выбранный файл больше недоступен. Выберите готовый файл
                      заново.
                    </p>
                  )}
                  {duplicate && (
                    <p className="error">
                      Такая пара файла и папки уже добавлена.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </fieldset>
        {activePreflight && (
          <section
            className="batch-preflight"
            aria-label="Проверка перед созданием задач"
          >
            <div className="batch-preflight-header">
              <div>
                <h5>
                  {activePreflightBlocked
                    ? activeProviderAuthorityBlocked
                      ? "План временно заблокирован"
                      : "План требует решения"
                    : "План готов к подтверждению"}
                </h5>
                <p className="muted">
                  ElevenLabs scribe_v2 ·{" "}
                  {activePreflight.language_mode === "ru"
                    ? "Русский"
                    : "Автоопределение"}
                  {" · "}
                  Спикеры:{" "}
                  {activePreflight.diarization_enabled
                    ? "разделять"
                    : "не разделять"}
                </p>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setPreflight(null);
                  setMessage("");
                }}
              >
                Изменить план
              </button>
            </div>
            <ol>
              {activePreflight.items.map((item) => {
                const matchLabel =
                  item.existing_result_match.status === "accepted_match"
                    ? "Есть готовый результат с теми же настройками."
                    : item.existing_result_match.status ===
                        "standardization_required"
                      ? "Есть результат с теми же настройками, но старого стандарта."
                      : item.existing_result_match.status === "indeterminate"
                        ? "Есть результат, настройки которого нельзя подтвердить."
                        : "Совпадений с теми же настройками среди результатов Studio и точно связанных записей каталога не найдено.";
                const providerAuthorityLabel =
                  item.provider_attempt_authority.reason_code ===
                  "equivalent_provider_work_in_flight"
                    ? "Для этого источника уже выполняется транскрибация. Дождитесь её завершения и повторите проверку."
                    : item.provider_attempt_authority.reason_code ===
                        "equivalent_provider_outcome_unresolved"
                      ? "Предыдущая транскрибация имеет неопределённый результат. Сначала проверьте её статус; повторная обработка заблокирована."
                      : null;
                const expandedItem = expandedComposerItems[item.position];
                const row = rows.find(
                  (candidate) => candidate.id === expandedItem?.row_id,
                );
                const clipLabel = item.media_clip
                  ? item.media_clip.start_seconds === 0
                    ? `Начало — ${formatSplitBoundary(item.media_clip.end_seconds ?? 0)}`
                    : `${formatSplitBoundary(item.media_clip.start_seconds ?? 0)} — конец`
                  : null;
                return (
                  <li key={item.position}>
                    <div>
                      <b>
                        {item.position + 1}. {item.source.name}
                      </b>
                      <span>
                        {item.source.source_type === "google_drive"
                          ? "Google Drive"
                          : "С устройства"}
                        {item.source.mime_type
                          ? ` · ${item.source.mime_type}`
                          : ""}
                      </span>
                      <span>
                        Размер: {formatBytes(item.source.size_bytes)} ·{" "}
                        Длительность:{" "}
                        {item.source.duration_seconds == null
                          ? "будет определена при подготовке"
                          : `${Math.round(item.source.duration_seconds)} сек.`}
                      </span>
                      <span>{matchLabel}</span>
                      {clipLabel && <span>Часть файла: {clipLabel}</span>}
                      {providerAuthorityLabel && (
                        <span className="error">{providerAuthorityLabel}</span>
                      )}
                    </div>
                    <div>
                      <span>Результат: {item.output_destination.name}</span>
                      <strong>
                        {item.planned_outcome === "process"
                          ? item.existing_result_match.resolution ===
                            "reprocess"
                            ? "План: транскрибировать заново"
                            : "План: обработать"
                          : item.planned_outcome === "skip"
                            ? "План: пропустить"
                            : "План: заблокировано"}
                      </strong>
                      {item.existing_result_match.status !== "no_match" &&
                        row && (
                          <label className="reprocess-decision">
                            <input
                              type="checkbox"
                              checked={
                                expandedItem?.segment === "second"
                                  ? row.second_reprocess_existing
                                  : row.reprocess_existing
                              }
                              disabled={
                                item.provider_attempt_authority.status ===
                                "blocked"
                              }
                              onChange={(event) => {
                                const reprocess = event.target.checked;
                                updateRow(
                                  row.id,
                                  expandedItem?.segment === "second"
                                    ? {
                                        second_reprocess_existing: reprocess,
                                      }
                                    : { reprocess_existing: reprocess },
                                );
                              }}
                              aria-label={`Транскрибировать заново строку ${item.position + 1}`}
                            />
                            <span>
                              Транскрибировать заново — повтор может списать
                              средства
                            </span>
                          </label>
                        )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {activePreflight.existing_result_authority.status ===
              "partial" && (
              <p className="notice">
                Проверены принятые результаты Studio и записи импортированного
                каталога, для которых исходник указан точно. Документы без
                подтверждённой связи с исходником не считаются совпадениями.
              </p>
            )}
          </section>
        )}
        <div className="composer-footer">
          <div>
            <b>Строк: {rows.length}</b>
            <span>Будет создано задач: {plannedJobCount}</span>
            <span>
              Готово: {completeRowCount} из {rows.length}
            </span>
            {submitBlocker && <span>{submitBlocker}</span>}
          </div>
          <button className="primary" disabled={!canSubmit}>
            {submissionStage === "preflight"
              ? "Проверяем план…"
              : submissionStage === "create"
                ? "Создание задач…"
                : activePreflight
                  ? `Подтвердить и создать (${plannedJobCount})`
                  : `Проверить задачи (${plannedJobCount})`}
          </button>
        </div>
      </form>
      {message && (
        <p
          className={
            message.startsWith("Не удалось") || message.startsWith("Конфликт")
              ? "error"
              : "notice"
          }
        >
          {message}
        </p>
      )}
      {batchSubmission?.status === "pending" && submissionStage === null && (
        <p className="notice" role="status">
          Подтверждение пакета выполняется. Дождитесь ответа перед новой отправкой.
        </p>
      )}
      {batchSubmission?.status === "ambiguous" && (
        <section
          className="error"
          aria-label="Неопределённый исход создания пакета"
        >
          <p>
            Сервер не подтвердил исход отправки. Новая отправка заблокирована,
            чтобы не создать дубликаты.
          </p>
          <button type="button" onClick={replayAmbiguousBatch}>
            Повторить подтверждение пакета
          </button>
        </section>
      )}
      {visibleJobMutationNotices.map((notice) => (
        <p
          key={jobMutationKey(notice.kind, notice.jobId)}
          className={notice.tone}
          role="status"
        >
          {notice.message}
        </p>
      ))}
      <details className="sources project-files">
        <summary className="summary-row">Файлы проекта</summary>
        <SourcesPanel
          project={project}
          csrf={csrf}
          onCsrf={onCsrf}
          sources={visibleSources}
          onReload={onReloadSources}
          onSourceRemoved={(source) => {
            const sourceId = source.id;
            setRemovedSourceIds((current) => new Set(current).add(sourceId));
            const affectedRowIds = rows
              .filter((row) => row.source_id === sourceId)
              .map((row) => row.id);
            if (affectedRowIds.length > 0) {
              setRowIntakeErrors((errors) => {
                const next = { ...errors };
                affectedRowIds.forEach((rowId) => {
                  next[rowId] =
                    "Источник удалён из проекта. Выберите новый файл для этой строки.";
                });
                return next;
              });
            }
            setRows((current) =>
              current.map((row) =>
                row.source_id === sourceId
                  ? {
                      ...row,
                      source_id: "",
                      reprocess_existing: false,
                      second_reprocess_existing: false,
                    }
                  : row,
              ),
            );
          }}
          pendingDeletionIds={pendingSourceDeletions}
          deletionNotices={sourceDeletionNotices}
          beginDeletion={beginSourceDeletion}
          finishDeletion={finishSourceDeletion}
        />
      </details>
      <TranscriptionAnalyticsPanel key={project.id} projectId={project.id} />
      <section className="sources" aria-label="Текущие задачи">
        <h4>Текущие задачи</h4>
        {jobs.loading && <p role="status">Загрузка задач…</p>}
        {jobs.error && <p className="error">{jobs.error}</p>}
        {jobs.loaded &&
          !jobs.loading &&
          currentJobs.length === 0 &&
          pinnedTerminalJobs.length === 0 && (
          <p className="notice">Текущих задач нет.</p>
        )}
        {currentJobs.map((job) => renderJobCard(job))}
        {pinnedTerminalJobs.map((job) => renderJobCard(job, true))}
      </section>
      <details className="recent-jobs">
        <summary>Недавние задачи · {recentJobs.length}</summary>
        {recentJobs.map((job) => renderJobCard(job))}
      </details>{" "}
    </section>
  );
}

function OverviewPage({
  onNavigate,
  onCreateProject,
  onOpenProject,
}: {
  onNavigate: (page: Page) => void;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(false);
  const [googleConnection, setGoogleConnection] =
    useState<GoogleConnection | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleError, setGoogleError] = useState(false);
  const requestEpochsRef = useRef(new Map<string, number>());
  const requestControllersRef = useRef(new Map<string, AbortController>());
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialsError, setCredentialsError] = useState(false);
  const loadProjects = () => {
    setProjectsLoading(true);
    setProjectsError(false);
    void settleLatestRequest(
      requestEpochsRef.current,
      "overview:projects",
      requestProjectCollection,
      (nextProjects) => {
        setProjects(nextProjects.filter((project) => !project.archived_at));
        setProjectsError(false);
        setProjectsLoading(false);
      },
      () => {
        setProjectsError(true);
        setProjectsLoading(false);
      },
      {
        controllers: requestControllersRef.current,
        timeoutMs: PROJECT_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const loadGoogleConnection = () => {
    setGoogleLoading(true);
    setGoogleError(false);
    void settleLatestRequest(
      requestEpochsRef.current,
      "overview:google-connection",
      requestGoogleConnection,
      (connection) => {
        setGoogleConnection(connection);
        setGoogleError(false);
        setGoogleLoading(false);
      },
      () => {
        setGoogleError(true);
        setGoogleLoading(false);
      },
      {
        controllers: requestControllersRef.current,
        timeoutMs: GOOGLE_CONNECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const loadCredentials = () => {
    setCredentialsLoading(true);
    setCredentialsError(false);
    void settleLatestRequest(
      requestEpochsRef.current,
      "overview:credentials",
      requestCredentialCollection,
      (nextCredentials) => {
        setCredentials(nextCredentials);
        setCredentialsError(false);
        setCredentialsLoading(false);
      },
      () => {
        setCredentialsError(true);
        setCredentialsLoading(false);
      },
      {
        controllers: requestControllersRef.current,
        timeoutMs: CREDENTIAL_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  useEffect(() => {
    loadProjects();
    loadGoogleConnection();
    loadCredentials();
  }, []);
  useEffect(
    () => () =>
      cancelLatestRequests(
        requestEpochsRef.current,
        requestControllersRef.current,
      ),
    [],
  );
  const activeCredentials = credentials.filter(
    (credential) => credential.status === "active",
  );
  const recentProjects = [...projects]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 5);
  const googleStatus = googleLoading
    ? "Загрузка…"
    : googleError
      ? "Недоступно"
      : googleConnection?.connected && !googleConnection.reconnect_required
        ? "Подключён"
        : "Нужна настройка";
  const needsAttention = [
    !projectsLoading && !projectsError && projects.length === 0
      ? "Создайте первый проект, чтобы подготовить пакет задач."
      : "",
    !googleLoading &&
    !googleError &&
    (!googleConnection?.connected || googleConnection.reconnect_required)
      ? "Подключите или обновите Google Drive для выбора файлов и папок."
      : "",
    !credentialsLoading && !credentialsError && activeCredentials.length === 0
      ? "Добавьте активный ключ провайдера в настройках."
      : "",
  ].filter(Boolean);
  return (
    <section className="page dashboard-page">
      <header className="page-header split">
        <div>
          <h1 className="page-title">Studio</h1>
          <p>
            Рабочая панель аккаунта: проекты, подключение Drive и готовность
            ключей.
          </p>
        </div>
        <div className="actions">
          <button className="primary" onClick={onCreateProject}>
            Новый проект
          </button>
          {projects.length > 0 && (
            <button onClick={() => onNavigate("projects")}>
              Открыть проекты
            </button>
          )}
        </div>
      </header>
      <div className="summary-grid dashboard-summary">
        <article className="card summary-card" aria-label="Проекты">
          <span className="summary-label">Проекты</span>
          <strong className="summary-value">
            {projectsLoading
              ? "Загрузка…"
              : projectsError
                ? "Недоступно"
                : projects.length}
          </strong>
          {projectsError && (
            <button type="button" onClick={loadProjects}>
              Повторить
            </button>
          )}
        </article>
        <article className="card summary-card" aria-label="Google Drive">
          <span className="summary-label">Google Drive</span>
          <strong className="summary-value">{googleStatus}</strong>
          {googleError && (
            <button type="button" onClick={loadGoogleConnection}>
              Повторить
            </button>
          )}
        </article>
        <article className="card summary-card" aria-label="Активные ключи">
          <span className="summary-label">Активные ключи</span>
          <strong className="summary-value">
            {credentialsLoading
              ? "Загрузка…"
              : credentialsError
                ? "Недоступно"
                : activeCredentials.length}
          </strong>
          {credentialsError && (
            <button type="button" onClick={loadCredentials}>
              Повторить
            </button>
          )}
        </article>
      </div>
      {(projectsError || googleError || credentialsError) && (
        <p className="notice">
          Часть данных панели сейчас недоступна. Остальные сведения показаны
          ниже.
        </p>
      )}
      {needsAttention.length > 0 && (
        <article className="card attention-card">
          <h2>Требует внимания</h2>
          <ul>
            {needsAttention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      )}
      {projects.length > 0 ? (
        <article className="card recent-projects-card">
          <h2>Последние проекты</h2>
          <div className="recent-project-list">
            {recentProjects.map((project) => (
              <button
                type="button"
                className="recent-project-item"
                key={project.id}
                onClick={() => onOpenProject(project.id)}
              >
                <span>
                  <strong>{project.title}</strong>
                  {project.description && <small>{project.description}</small>}
                </span>
                <span className="muted">
                  Обновлено:{" "}
                  {new Date(project.updated_at).toLocaleString("ru-RU")}
                </span>
              </button>
            ))}
          </div>
        </article>
      ) : (
        !projectsLoading &&
        !projectsError && (
          <article className="card">
            <h2>Рабочий процесс</h2>
            <ol className="workflow">
              <li>1. Проект</li>
              <li>2. Источники</li>
              <li>3. Задача</li>
            </ol>
            <div className="actions">
              <button className="primary" onClick={onCreateProject}>
                Новый проект
              </button>
              <button onClick={() => onNavigate("settings")}>Настройки</button>
            </div>
          </article>
        )
      )}
    </section>
  );
}

function ProjectsPage({
  active,
  csrf,
  onCsrf,
  requestedProjectId,
  onRequestedProjectHandled,
  requestedProjectsView,
  onRequestedProjectsViewHandled,
}: {
  active: boolean;
  csrf: string;
  onCsrf: (csrf: string) => void;
  requestedProjectId: string | null;
  onRequestedProjectHandled: () => void;
  requestedProjectsView: ProjectsViewRequest;
  onRequestedProjectsViewHandled: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sources, setSources] = useState<
    Record<string, typeof emptySourceState>
  >({});
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const pendingProjectMutationsRef = useRef(new Set<string>());
  const [pendingProjectMutations, setPendingProjectMutations] = useState<
    Set<string>
  >(() => new Set());
  const [projectMutationNotices, setProjectMutationNotices] = useState<
    Record<string, ProjectMutationNotice>
  >({});
  const activeGooglePickerRef = useRef<GooglePickerOperation | null>(null);
  const [activeGooglePicker, setActiveGooglePicker] =
    useState<GooglePickerOperation | null>(null);
  const [googlePickerNotices, setGooglePickerNotices] = useState<
    Record<string, GooglePickerNotice>
  >({});
  const [transcriptionMode, setTranscriptionMode] = useState<"batch" | "live">(
    "batch",
  );
  const [liveTranscripts, setLiveTranscripts] = useState<
    Record<string, string[]>
  >({});
  const requestEpochsRef = useRef(new Map<string, number>());
  const requestControllersRef = useRef(new Map<string, AbortController>());
  const pendingJobMutationsRef = useRef(new Set<string>());
  const [pendingJobMutations, setPendingJobMutations] = useState<Set<string>>(
    () => new Set(),
  );
  const [jobMutationNotices, setJobMutationNotices] = useState<
    Record<string, JobMutationNotice>
  >({});
  const pendingSourceDeletionsRef = useRef(new Set<string>());
  const [pendingSourceDeletions, setPendingSourceDeletions] = useState<
    Set<string>
  >(() => new Set());
  const [sourceDeletionNotices, setSourceDeletionNotices] = useState<
    Record<string, SourceDeletionNotice>
  >({});
  const beginSourceDeletion = (sourceId: string) => {
    if (pendingSourceDeletionsRef.current.has(sourceId)) return false;
    pendingSourceDeletionsRef.current.add(sourceId);
    setPendingSourceDeletions(new Set(pendingSourceDeletionsRef.current));
    setSourceDeletionNotices((current) => {
      if (!current[sourceId]) return current;
      const next = { ...current };
      delete next[sourceId];
      return next;
    });
    return true;
  };
  const finishSourceDeletion = (
    sourceId: string,
    notice: SourceDeletionNotice,
  ) => {
    if (!pendingSourceDeletionsRef.current.delete(sourceId)) return;
    setPendingSourceDeletions(new Set(pendingSourceDeletionsRef.current));
    setSourceDeletionNotices((current) => ({
      ...current,
      [sourceId]: notice,
    }));
  };
  const localUploadOperationsRef = useRef(
    new Map<string, LocalUploadOperation>(),
  );
  const [pendingLocalUploads, setPendingLocalUploads] = useState<
    LocalUploadOperation[]
  >([]);
  const [localUploadNotices, setLocalUploadNotices] = useState<
    Record<string, LocalUploadNotice>
  >({});
  const publishPendingLocalUploads = () =>
    setPendingLocalUploads(
      Array.from(localUploadOperationsRef.current.values()),
    );
  const beginLocalUpload = (operation: LocalUploadOperation) => {
    if (
      Array.from(localUploadOperationsRef.current.values()).some(
        (current) =>
          current.projectId === operation.projectId &&
          current.panelId !== operation.panelId,
      )
    ) {
      return false;
    }
    const key = localUploadOperationKey(operation);
    if (localUploadOperationsRef.current.has(key)) return false;
    localUploadOperationsRef.current.set(key, operation);
    publishPendingLocalUploads();
    setLocalUploadNotices((current) => {
      const next: Record<string, LocalUploadNotice> = {};
      Object.entries(current).forEach(([noticeKey, notice]) => {
        if (notice.projectId !== operation.projectId) {
          next[noticeKey] = notice;
        }
      });
      return next;
    });
    return true;
  };
  const finishLocalUpload = (
    operation: LocalUploadOperation,
    notice: LocalUploadNotice,
  ) => {
    const key = localUploadOperationKey(operation);
    if (!localUploadOperationsRef.current.delete(key)) return;
    publishPendingLocalUploads();
    setLocalUploadNotices((current) => ({
      ...current,
      [key]: { ...notice, ...operation },
    }));
  };
  const batchSubmissionsRef = useRef(new Map<string, BatchSubmission>());
  const [batchSubmissions, setBatchSubmissions] = useState<
    Record<string, BatchSubmission>
  >({});
  const publishBatchSubmission = (
    projectId: string,
    submission: BatchSubmission | null,
  ) => {
    setBatchSubmissions((current) => {
      const next = { ...current };
      if (submission) next[projectId] = submission;
      else delete next[projectId];
      return next;
    });
  };
  const beginBatchSubmission = (
    projectId: string,
    submission: Omit<BatchSubmission, "status">,
  ) => {
    if (batchSubmissionsRef.current.has(projectId)) return false;
    const pending: BatchSubmission = { ...submission, status: "pending" };
    batchSubmissionsRef.current.set(projectId, pending);
    publishBatchSubmission(projectId, pending);
    return true;
  };
  const retryBatchSubmission = (projectId: string, key: string) => {
    const current = batchSubmissionsRef.current.get(projectId);
    if (!current || current.key !== key || current.status !== "ambiguous") {
      return false;
    }
    const pending: BatchSubmission = { ...current, status: "pending" };
    batchSubmissionsRef.current.set(projectId, pending);
    publishBatchSubmission(projectId, pending);
    return true;
  };
  const markBatchSubmissionAmbiguous = (projectId: string, key: string) => {
    const current = batchSubmissionsRef.current.get(projectId);
    if (!current || current.key !== key) return;
    const ambiguous: BatchSubmission = { ...current, status: "ambiguous" };
    batchSubmissionsRef.current.set(projectId, ambiguous);
    publishBatchSubmission(projectId, ambiguous);
  };
  const clearBatchSubmission = (projectId: string, key: string) => {
    const current = batchSubmissionsRef.current.get(projectId);
    if (!current || current.key !== key) return;
    batchSubmissionsRef.current.delete(projectId);
    publishBatchSubmission(projectId, null);
  };
  const beginJobMutation = (kind: JobMutationKind, jobId: string) => {
    const key = jobMutationKey(kind, jobId);
    if (pendingJobMutationsRef.current.has(key)) return false;
    pendingJobMutationsRef.current.add(key);
    setPendingJobMutations(new Set(pendingJobMutationsRef.current));
    setJobMutationNotices((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    return true;
  };
  const finishJobMutation = (
    kind: JobMutationKind,
    jobId: string,
    notice?: JobMutationNotice,
  ) => {
    const key = jobMutationKey(kind, jobId);
    if (!pendingJobMutationsRef.current.delete(key)) return;
    setPendingJobMutations(new Set(pendingJobMutationsRef.current));
    if (notice)
      setJobMutationNotices((current) => ({ ...current, [key]: notice }));
  };
  const beginGooglePicker = (operation: GooglePickerOperation) => {
    if (activeGooglePickerRef.current) return false;
    activeGooglePickerRef.current = operation;
    setActiveGooglePicker(operation);
    setGooglePickerNotices((current) => {
      if (!current[operation.projectId]) return current;
      const next = { ...current };
      delete next[operation.projectId];
      return next;
    });
    return true;
  };
  const finishGooglePicker = (
    operation: GooglePickerOperation,
    outcome?: GooglePickerOutcome,
  ) => {
    const activeOperation = activeGooglePickerRef.current;
    if (
      !activeOperation ||
      googlePickerOperationKey(activeOperation) !==
        googlePickerOperationKey(operation)
    )
      return;
    activeGooglePickerRef.current = null;
    setActiveGooglePicker(null);
    if (outcome) {
      setGooglePickerNotices((current) => ({
        ...current,
        [operation.projectId]: { ...operation, ...outcome },
      }));
    }
  };
  const beginProjectMutation = (operation: ProjectMutationOperation) => {
    const key = projectMutationKey(operation);
    if (pendingProjectMutationsRef.current.has(key)) return false;
    pendingProjectMutationsRef.current.add(key);
    setPendingProjectMutations(new Set(pendingProjectMutationsRef.current));
    setProjectMutationNotices((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    return true;
  };
  const finishProjectMutation = (
    operation: ProjectMutationOperation,
    notice?: ProjectMutationNotice,
  ) => {
    const key = projectMutationKey(operation);
    if (!pendingProjectMutationsRef.current.delete(key)) return;
    setPendingProjectMutations(new Set(pendingProjectMutationsRef.current));
    if (notice) {
      setProjectMutationNotices((current) => ({
        ...current,
        [key]: notice,
      }));
    }
  };
  const [googleConnection, setGoogleConnection] =
    useState<GoogleConnection | null>(null);
  const [googleConnectionState, setGoogleConnectionState] =
    useState<GoogleConnectionReadState>("loading");
  const loadGoogleConnection = () => {
    setGoogleConnectionState("loading");
    void settleLatestRequest(
      requestEpochsRef.current,
      "projects:google-connection",
      requestGoogleConnection,
      (connection) => {
        setGoogleConnection(connection);
        setGoogleConnectionState("ready");
      },
      () => setGoogleConnectionState("unavailable"),
      {
        controllers: requestControllersRef.current,
        timeoutMs: GOOGLE_CONNECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const load = async ({ reportFailure = true } = {}): Promise<
    Project[] | null
  > => {
    let observed: Project[] | null = null;
    setLoading(true);
    if (reportFailure) setError("");
    await settleLatestRequest(
      requestEpochsRef.current,
      "projects",
      requestProjectCollection,
      (nextProjects) => {
        observed = nextProjects;
        setProjects(nextProjects);
        setSelectedProjectId((current) => {
          if (
            current &&
            nextProjects.some((project) => project.id === current)
          ) {
            return current;
          }
          return requestedProjectId &&
            nextProjects.some((project) => project.id === requestedProjectId)
            ? requestedProjectId
            : (nextProjects[0]?.id ?? null);
        });
        if (nextProjects.length === 0) setCreateOpen(true);
        setLoading(false);
        setError("");
      },
      (loadError) => {
        if (reportFailure) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "Не удалось загрузить проекты.",
          );
        }
        setLoading(false);
      },
      {
        controllers: requestControllersRef.current,
        timeoutMs: PROJECT_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
    return observed;
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(
    () => () =>
      cancelLatestRequests(
        requestEpochsRef.current,
        requestControllersRef.current,
      ),
    [],
  );
  useEffect(() => {
    if (!requestedProjectId) return;
    if (projects.some((project) => project.id === requestedProjectId)) {
      setSelectedProjectId(requestedProjectId);
      onRequestedProjectHandled();
    }
  }, [requestedProjectId, projects, onRequestedProjectHandled]);
  useEffect(() => {
    const nextCreateOpen = resolveRequestedProjectsView(
      requestedProjectsView,
      {
        loading,
        projectCount: projects.length,
      },
    );
    if (nextCreateOpen === null) return;
    setCreateOpen(nextCreateOpen);
    onRequestedProjectsViewHandled();
  }, [
    requestedProjectsView,
    loading,
    projects.length,
    onRequestedProjectsViewHandled,
  ]);
  useEffect(() => {
    if (active) loadGoogleConnection();
  }, [active]);
  const loadSources = (projectId: string) => {
    const requestKey = `sources:${projectId}`;
    setSources((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? emptySourceState),
        loading: true,
        error: "",
      },
    }));
    void settleLatestRequest(
      requestEpochsRef.current,
      requestKey,
      (signal) =>
        api<{ sources: Source[] }>(`/projects/${projectId}/sources`, {
          signal,
          ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
        }),
      (result) =>
        setSources((current) => ({
          ...current,
          [projectId]: {
            loading: false,
            error: "",
            loaded: true,
            items: result.sources,
          },
        })),
      () =>
        setSources((current) => ({
          ...current,
          [projectId]: {
            loading: false,
            error: "Не удалось загрузить файлы проекта.",
            loaded: true,
            items: current[projectId]?.items ?? [],
          },
        })),
      {
        controllers: requestControllersRef.current,
        timeoutMs: PROJECT_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const loadJobs = (projectId: string) => {
    const requestKey = `jobs:${projectId}`;
    setJobs((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? emptyJobState),
        loading: true,
        error: "",
      },
    }));
    void settleLatestRequest(
      requestEpochsRef.current,
      requestKey,
      (signal) =>
        api<{ jobs: TranscriptionJob[] }>(`/projects/${projectId}/jobs`, {
          signal,
          ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
        }),
      (result) =>
        setJobs((current) => ({
          ...current,
          [projectId]: {
            loading: false,
            error: "",
            loaded: true,
            items: result.jobs,
          },
        })),
      () =>
        setJobs((current) => ({
          ...current,
          [projectId]: {
            loading: false,
            error: "Не удалось загрузить задачи проекта.",
            loaded: true,
            items: current[projectId]?.items ?? [],
          },
        })),
      {
        controllers: requestControllersRef.current,
        timeoutMs: PROJECT_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const operation: ProjectMutationOperation = {
      kind: "create",
      projectId: null,
    };
    if (!beginProjectMutation(operation)) return;
    let notice: ProjectMutationNotice | undefined;
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("project_title") ?? "");
    const description = String(fd.get("project_description") ?? "");
    const reconcileAmbiguousCreate = async () => {
      const observed = await load({ reportFailure: false });
      notice = {
        ...operation,
        message: observed
          ? "Сервер не подтвердил создание проекта. Список проектов обновлён; проверьте его перед повторной попыткой."
          : "Сервер не подтвердил создание проекта, а обновить список не удалось. Не повторяйте отправку, пока не проверите проекты после обновления страницы.",
        tone: "error",
      };
    };
    try {
      const request = await runBoundedRequest(
        (signal) =>
          csrfMutate<unknown>("/projects", csrf, onCsrf, {
            method: "POST",
            signal,
            body: JSON.stringify({ title, description }),
          }),
        PROJECT_MUTATION_REQUEST_TIMEOUT_MS,
      );
      if (request.status === "timed_out") {
        await reconcileAmbiguousCreate();
        return;
      }
      const created = request.value;
      if (!isExpectedProject(created) || created.archived_at !== null) {
        await reconcileAmbiguousCreate();
        return;
      }
      form.reset();
      setCreateOpen(false);
      setProjects((current) => [
        created,
        ...current.filter((project) => project.id !== created.id),
      ]);
      setSelectedProjectId(created.id);
      await load({ reportFailure: false });
      notice = {
        ...operation,
        message: "Проект создан.",
        tone: "notice",
      };
    } catch (err) {
      if (isAmbiguousProjectMutationFailure(err)) {
        await reconcileAmbiguousCreate();
      } else {
        notice = {
          ...operation,
          message: "Не удалось создать проект. Проверьте данные и повторите.",
          tone: "error",
        };
      }
    } finally {
      finishProjectMutation(operation, notice);
    }
  }
  async function update(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const operation: ProjectMutationOperation = {
      kind: "update",
      projectId: id,
    };
    if (!beginProjectMutation(operation)) return;
    let notice: ProjectMutationNotice | undefined;
    setError("");
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("project_title") ?? "");
    const description = String(fd.get("project_description") ?? "");
    const beforeUpdate = projects.find((project) => project.id === id) ?? null;
    const requestedStateChanged =
      beforeUpdate !== null &&
      (beforeUpdate.title !== title ||
        (beforeUpdate.description ?? "") !== description);
    const reconcileUpdate = async () => {
      const observed = await load({ reportFailure: false });
      const confirmed =
        observed?.some(
          (project) =>
            project.id === id &&
            project.title === title &&
            (project.description ?? "") === description &&
            (requestedStateChanged ||
              (beforeUpdate !== null &&
                project.updated_at !== beforeUpdate.updated_at)),
        ) === true;
      if (confirmed) setEditing((current) => (current === id ? null : current));
      notice = {
        ...operation,
        message: confirmed
          ? "Сервер не ответил ожидаемым образом, но сохранение подтверждено по актуальному списку проектов."
          : observed
            ? "Сервер не подтвердил сохранение. Список проектов обновлён; проверьте проект перед повторной попыткой."
            : "Сервер не подтвердил сохранение, а обновить список проектов не удалось. Обновите страницу перед повторной попыткой.",
        tone: confirmed ? "notice" : "error",
      };
    };
    try {
      const request = await runBoundedRequest(
        (signal) =>
          csrfMutate<unknown>(`/projects/${id}`, csrf, onCsrf, {
            method: "PATCH",
            signal,
            body: JSON.stringify({ title, description }),
          }),
        PROJECT_MUTATION_REQUEST_TIMEOUT_MS,
      );
      if (request.status === "timed_out") {
        await reconcileUpdate();
        return;
      }
      const updated = request.value;
      if (
        !isExpectedProject(updated) ||
        updated.id !== id ||
        updated.archived_at !== null
      ) {
        await reconcileUpdate();
        return;
      }
      setProjects((current) =>
        current.map((project) => (project.id === id ? updated : project)),
      );
      setEditing(null);
      await load({ reportFailure: false });
      notice = {
        ...operation,
        message: "Изменения проекта сохранены.",
        tone: "notice",
      };
    } catch (err) {
      if (isAmbiguousProjectMutationFailure(err)) {
        await reconcileUpdate();
      } else {
        notice = {
          ...operation,
          message: "Не удалось сохранить проект. Проверьте данные и повторите.",
          tone: "error",
        };
      }
    } finally {
      finishProjectMutation(operation, notice);
    }
  }
  async function archive(id: string) {
    const operation: ProjectMutationOperation = {
      kind: "archive",
      projectId: id,
    };
    if (!beginProjectMutation(operation)) return;
    let notice: ProjectMutationNotice | undefined;
    setError("");
    const reconcileArchive = async () => {
      const observed = await load({ reportFailure: false });
      const confirmed =
        observed !== null &&
        !observed.some((project) => project.id === operation.projectId);
      notice = {
        ...operation,
        message: confirmed
          ? "Архивация подтверждена по актуальному списку проектов."
          : observed
            ? "Сервер не подтвердил архивацию. Проект остаётся в актуальном списке; проверьте его перед повторной попыткой."
            : "Сервер не подтвердил архивацию, а обновить список проектов не удалось. Обновите страницу перед повторной попыткой.",
        tone: confirmed ? "notice" : "error",
      };
    };
    try {
      const request = await runBoundedRequest(
        (signal) =>
          csrfMutate<unknown>(
            `/projects/${id}/archive`,
            csrf,
            onCsrf,
            { method: "POST", signal },
          ),
        PROJECT_MUTATION_REQUEST_TIMEOUT_MS,
      );
      if (request.status === "timed_out") {
        await reconcileArchive();
        return;
      }
      const response = request.value;
      if (
        !response ||
        typeof response !== "object" ||
        (response as { ok?: unknown }).ok !== true
      ) {
        await reconcileArchive();
        return;
      }
      setProjects((current) =>
        current.filter((project) => project.id !== id),
      );
      setSelectedProjectId((current) =>
        current === id
          ? (projects.find((project) => project.id !== id)?.id ?? null)
          : current,
      );
      setEditing((current) => (current === id ? null : current));
      await load({ reportFailure: false });
      notice = {
        ...operation,
        message: "Проект архивирован.",
        tone: "notice",
      };
    } catch (err) {
      if (isAmbiguousProjectMutationFailure(err)) {
        await reconcileArchive();
      } else {
        notice = {
          ...operation,
          message: "Не удалось архивировать проект. Обновите список и повторите.",
          tone: "error",
        };
      }
    } finally {
      finishProjectMutation(operation, notice);
    }
  }
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const createMutationKey = projectMutationKey({
    kind: "create",
    projectId: null,
  });
  const createPending = pendingProjectMutations.has(createMutationKey);
  const createNotice = projectMutationNotices[createMutationKey];
  const updatePending = selectedProject
    ? pendingProjectMutations.has(
        projectMutationKey({ kind: "update", projectId: selectedProject.id }),
      )
    : false;
  const archivePending = selectedProject
    ? pendingProjectMutations.has(
        projectMutationKey({ kind: "archive", projectId: selectedProject.id }),
      )
    : false;
  const selectedProjectMutationNotices = selectedProject
    ? Object.entries(projectMutationNotices).filter(
        ([, notice]) => notice.projectId === selectedProject.id,
      )
    : [];
  const showCreate = createOpen || projects.length === 0;
  const selectedSources = selectedProject
    ? (sources[selectedProject.id] ?? emptySourceState)
    : emptySourceState;
  const selectedJobs = selectedProject
    ? (jobs[selectedProject.id] ?? emptyJobState)
    : emptyJobState;
  useEffect(() => {
    if (!selectedProject) return;
    if (
      !sources[selectedProject.id]?.loaded &&
      !sources[selectedProject.id]?.loading
    )
      loadSources(selectedProject.id);
    if (!jobs[selectedProject.id]?.loaded && !jobs[selectedProject.id]?.loading)
      loadJobs(selectedProject.id);
  }, [selectedProject?.id]);
  useEffect(() => setTranscriptionMode("batch"), [selectedProject?.id]);
  return (
    <section className="page">
      <header className="page-header split">
        <div>
          <h1 className="page-title">Проекты</h1>
          <p>
            Создавайте проекты, добавляйте файлы, выбирайте папку результатов и
            запускайте задачи.
          </p>
        </div>
        <button
          className="primary"
          type="button"
          aria-expanded={showCreate}
          aria-busy={createPending || undefined}
          disabled={createPending}
          onClick={() => {
            onRequestedProjectsViewHandled();
            setCreateOpen((v) => !v);
          }}
        >
          Новый проект
        </button>
      </header>
      {showCreate && (
        <form
          className="card project-form"
          aria-busy={createPending || undefined}
          onSubmit={save}
        >
          <h2>Новый проект</h2>
          <label>
            Название проекта
            <input name="project_title" maxLength={160} required />
          </label>
          <label>
            Описание
            <input name="project_description" maxLength={2000} />
          </label>
          <div className="actions">
            <button
              className="primary"
              aria-busy={createPending || undefined}
              disabled={createPending}
            >
              {createPending ? "Создание…" : "Создать"}
            </button>
            <button
              type="button"
              disabled={createPending}
              onClick={() => setCreateOpen(false)}
            >
              Отмена
            </button>
          </div>
          {createNotice && (
            <p
              className={createNotice.tone}
              role={createNotice.tone === "error" ? "alert" : "status"}
            >
              {createNotice.message}
            </p>
          )}
        </form>
      )}
      {loading && <p role="status">Загрузка проектов…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && projects.length === 0 && (
        <p className="notice">Пока нет проектов. Создайте первый проект.</p>
      )}
      <div className="workspace-layout">
        <section className="project-list" aria-label="Список проектов">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={
                project.id === selectedProjectId
                  ? "project-list-item active"
                  : "project-list-item"
              }
              onClick={() => {
                setSelectedProjectId(project.id);
              }}
            >
              <strong>{project.title}</strong>
              {project.description && <span>{project.description}</span>}
              <small>
                Обновлено{" "}
                {new Date(project.updated_at).toLocaleDateString("ru-RU")}
              </small>
            </button>
          ))}
        </section>
        <div className="project-detail">
          {selectedProject ? (
            <>
              {selectedProjectMutationNotices.map(([key, notice]) => (
                <p
                  key={key}
                  className={notice.tone}
                  role={notice.tone === "error" ? "alert" : "status"}
                >
                  {notice.message}
                </p>
              ))}
              <article className="card workspace-card">
              {editing === selectedProject.id ? (
                <form
                  className="project-edit compact"
                  aria-busy={updatePending || undefined}
                  onSubmit={(e) => update(e, selectedProject.id)}
                >
                  <label>
                    Название проекта
                    <input
                      name="project_title"
                      defaultValue={selectedProject.title}
                      maxLength={160}
                      required
                    />
                  </label>
                  <label>
                    Описание
                    <textarea
                      name="project_description"
                      defaultValue={selectedProject.description ?? ""}
                      maxLength={2000}
                    />
                  </label>
                  <div className="actions">
                    <button
                      className="primary"
                      aria-busy={updatePending || undefined}
                      disabled={updatePending}
                    >
                      {updatePending ? "Сохранение…" : "Сохранить"}
                    </button>
                    <button
                      type="button"
                      disabled={updatePending}
                      onClick={() => setEditing(null)}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <header className="workspace-header split">
                  <div>
                    <h2>{selectedProject.title}</h2>
                    <p>
                      {selectedProject.description || "Описание не добавлено."}
                    </p>
                    <p className="muted">
                      Обновлено:{" "}
                      {new Date(selectedProject.updated_at).toLocaleString(
                        "ru-RU",
                      )}
                    </p>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      disabled={archivePending}
                      onClick={() => setEditing(selectedProject.id)}
                    >
                      Редактировать
                    </button>
                    <button
                      className="danger"
                      type="button"
                      aria-busy={archivePending || undefined}
                      disabled={archivePending}
                      onClick={() => archive(selectedProject.id)}
                    >
                      {archivePending ? "Архивация…" : "Архивировать"}
                    </button>
                  </div>
                </header>
              )}
              <div
                className="tabs transcription-mode-tabs"
                role="tablist"
                aria-label="Режим транскрибации"
              >
                <button
                  id="transcription-tab-batch"
                  type="button"
                  role="tab"
                  aria-controls="transcription-panel-batch"
                  aria-selected={transcriptionMode === "batch"}
                  onClick={() => setTranscriptionMode("batch")}
                >
                  Пакетная транскрибация
                </button>
                <button
                  id="transcription-tab-live"
                  type="button"
                  role="tab"
                  aria-controls="transcription-panel-live"
                  aria-selected={transcriptionMode === "live"}
                  onClick={() => setTranscriptionMode("live")}
                >
                  Live-транскрибация
                </button>
              </div>
              <div
                id="transcription-panel-batch"
                role="tabpanel"
                aria-labelledby="transcription-tab-batch"
                hidden={transcriptionMode !== "batch"}
              >
                <PreparationPanel
                  key={selectedProject.id}
                  project={selectedProject}
                  csrf={csrf}
                  onCsrf={onCsrf}
                  jobs={selectedJobs}
                  sources={selectedSources}
                  googleConnection={googleConnection}
                  googleConnectionState={googleConnectionState}
                  onReloadGoogleConnection={loadGoogleConnection}
                  activeGooglePicker={activeGooglePicker}
                  googlePickerNotices={googlePickerNotices}
                  beginGooglePicker={beginGooglePicker}
                  finishGooglePicker={finishGooglePicker}
                  onLoadSources={loadSources}
                  onReloadSources={loadSources}
                  onReloadJobs={loadJobs}
                  pendingJobMutations={pendingJobMutations}
                  jobMutationNotices={jobMutationNotices}
                  beginJobMutation={beginJobMutation}
                  finishJobMutation={finishJobMutation}
                  pendingSourceDeletions={pendingSourceDeletions}
                  sourceDeletionNotices={sourceDeletionNotices}
                  beginSourceDeletion={beginSourceDeletion}
                  finishSourceDeletion={finishSourceDeletion}
                  pendingLocalUploads={pendingLocalUploads}
                  localUploadNotices={localUploadNotices}
                  beginLocalUpload={beginLocalUpload}
                  finishLocalUpload={finishLocalUpload}
                  batchSubmission={
                    batchSubmissions[selectedProject.id] ?? null
                  }
                  beginBatchSubmission={(submission) =>
                    beginBatchSubmission(selectedProject.id, submission)
                  }
                  retryBatchSubmission={(key) =>
                    retryBatchSubmission(selectedProject.id, key)
                  }
                  markBatchSubmissionAmbiguous={(key) =>
                    markBatchSubmissionAmbiguous(selectedProject.id, key)
                  }
                  clearBatchSubmission={(key) =>
                    clearBatchSubmission(selectedProject.id, key)
                  }
                />
              </div>
              <div
                id="transcription-panel-live"
                role="tabpanel"
                aria-labelledby="transcription-tab-live"
                hidden={transcriptionMode !== "live"}
              >
                <LiveTranscriptionPanel
                  key={selectedProject.id}
                  projectId={selectedProject.id}
                  csrf={csrf}
                  onCsrf={onCsrf}
                  active={active && transcriptionMode === "live"}
                  initialSegments={liveTranscripts[selectedProject.id] ?? []}
                  onSegmentsChange={(segments) =>
                    setLiveTranscripts((current) => ({
                      ...current,
                      [selectedProject.id]: segments,
                    }))
                  }
                />
              </div>
            </article>
            </>
          ) : (
            <p className="notice">Выберите проект.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function boolText(value: boolean | undefined) {
  if (value === true) return "да";
  if (value === false) return "нет";
  return "—";
}
function safeText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "—";
  return String(value).slice(0, 120);
}
function buildIdentityText(value: unknown) {
  if (value === null || value === undefined || value === "")
    return "не настроено";
  if (typeof value === "string" && value.trim().toLowerCase() === "unknown")
    return "не настроено";
  return safeText(value);
}
function diagnosticsDebugStateText(value: unknown) {
  if (value === "inactive") return "неактивна";
  return safeText(value);
}
function diagnosticsLevelLabel(level: string) {
  const labels: Record<string, string> = {
    ERROR: "Ошибка",
    WARNING: "Предупреждение",
    INFO: "Информация",
    DEBUG: "DEBUG",
  };
  return labels[level] ?? safeText(level);
}
function diagnosticsComponentLabel(component: string) {
  const labels: Record<string, string> = {
    web: "Веб-приложение",
    api: "API",
    worker: "Фоновая обработка",
  };
  return labels[component] ?? safeText(component);
}
function reportFileName() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `studio-diagnostics-${stamp}.md`;
}
async function diagnosticsReportBlob(
  filters: DiagnosticsFilters,
  csrf: string,
  onCsrf: (csrf: string) => void,
): Promise<Blob> {
  const body = JSON.stringify(reportPayload(filters));
  const send = (token: string) =>
    fetch(`/api/diagnostics/report.md`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": token },
      body,
    });
  let res = await send(csrf);
  if (
    !res.ok &&
    (res.status === 401 || res.status === 403 || res.status === 419)
  ) {
    const refreshed = await api<{ csrf_token: string }>("/auth/csrf", {
      method: "POST",
    });
    onCsrf(refreshed.csrf_token);
    res = await send(refreshed.csrf_token);
  }
  if (!res.ok)
    throw new Error("Не удалось подготовить Markdown-отчёт. Повторите позже.");
  return res.blob();
}
type DiagnosticsFilters = {
  days: string;
  level: string;
  component: string;
  eventCode: string;
  projectId: string;
  jobId: string;
};
function reportPayload(filters: DiagnosticsFilters) {
  const end = new Date();
  const days = Math.min(Math.max(Number(filters.days) || 1, 1), 7);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    level: filters.level || undefined,
    component: filters.component || undefined,
    event_code: filters.eventCode.trim() || undefined,
    project_id: filters.projectId.trim() || undefined,
    job_id: filters.jobId.trim() || undefined,
  };
}
const diagnosticsMetadataKeys = new Set([
  "source_count",
  "batch_position",
  "credential_selected",
  "attempt_number",
  "boundary",
  "duration_ms",
  "error_code",
  "retryable",
  "http_status_category",
  "output_count",
  "final_job_status",
  "endpoint_group",
]);
const pwaEventLabels: Record<string, string> = {
  PWA_APP_ERROR: "Ошибка веб-приложения",
  PWA_UNHANDLED_REJECTION: "Необработанная ошибка операции",
  PWA_API_REQUEST_FAILED: "Ошибка запроса к API",
  PWA_ROUTE_ERROR: "Ошибка раздела приложения",
  PWA_SERVICE_WORKER_ERROR: "Ошибка сервис-воркера",
};
const diagnosticsMetadataLabels: Record<string, string> = {
  boundary: "граница",
  duration_ms: "длительность, мс",
  error_code: "код ошибки",
  retryable: "повтор возможен",
  http_status_category: "категория HTTP",
  endpoint_group: "группа API",
};
function pwaEventLabel(code: string) {
  return pwaEventLabels[code] ?? null;
}
function diagnosticsMetadataLabel(key: string) {
  return diagnosticsMetadataLabels[key] ?? null;
}
function debugRemainingText(expiresAt?: string | null) {
  if (!expiresAt) return "—";
  const remaining = Math.max(0, Date.parse(expiresAt) - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function auditLabel(type: string) {
  const labels: Record<string, string> = {
    "google.connected": "Google Drive подключён",
    "google.disconnected": "Google Drive отключён",
    "google.oauth_started": "Начато подключение Google Drive",
    "credential.created": "Ключ создан",
    "credential.replaced": "Ключ заменён",
    "credential.revoked": "Ключ отозван",
    "credential.deleted": "Ключ удалён",
    "admin.bootstrap_created": "Администратор создан",
    "auth.login": "Вход выполнен",
    "auth.login_failed": "Неудачная попытка входа",
    "auth.logout": "Выход выполнен",
    "auth.sessions_revoked": "Другие сеансы завершены",
    "account.preferences_updated": "Настройки хранения обновлены",
    "project.created": "Проект создан",
    "project.updated": "Проект обновлён",
    "project.archived": "Проект архивирован",
    "project.output_folder.google_picker_set":
      "Папка проекта выбрана через Google Drive",
    "source.google_drive.created": "Источник Google Drive добавлен",
    "source.google_picker.created": "Источники выбраны через Google Drive",
    "source.local_upload.initiated": "Загрузка локального источника начата",
    "source.local_upload.completed": "Локальный источник загружен",
    "source.deleted": "Источник удалён",
    "job.created": "Задача создана",
    "job.batch_created": "Пакет задач создан",
    "job.cancelled": "Задача отменена",
    "job.cancel_requested": "Запрошена отмена задачи",
    "google.oauth_failed": "Подключение Google Drive не удалось",
    "google.maintenance_oauth_started":
      "Запрошено подключение доступа Google для обслуживания",
    "google.maintenance_oauth_failed":
      "Подключение доступа Google для обслуживания не удалось",
    "google.maintenance_connected":
      "Доступ Google для обслуживания подключён",
    "google.maintenance_disconnected":
      "Доступ Google для обслуживания отключён",
    "transcript_catalog.migration_applied":
      "Миграция каталога транскриптов применена",
    "transcript_standardization.applied":
      "Стандартизация Google Docs применена",
    "transcript_catalog.import_applied":
      "Метаданные добавлены в манифест Studio",
  };
  return labels[type] ?? "Событие безопасности";
}
function SettingsPage({
  user,
  csrf,
  onCsrf,
  onLogout,
  oauthResult,
  maintenanceOauthResult,
  credentialMutations,
  credentialMutationNotices,
  beginCredentialMutation,
  finishCredentialMutation,
  retentionMutation,
  retentionMutationNotice,
  beginRetentionMutation,
  finishRetentionMutation,
  acknowledgeRetentionMutationRefresh,
  googleConnectionMutation,
  googleConnectionMutationNotice,
  beginGoogleConnectionMutation,
  finishGoogleConnectionMutation,
  isGoogleConnectionMutationActive,
  acknowledgeGoogleConnectionMutationRefresh,
  section,
  onSectionChange,
}: {
  user: User;
  csrf: string;
  onCsrf: (csrf: string) => void;
  onLogout: () => void;
  oauthResult: GoogleOauthResult | null;
  maintenanceOauthResult: GoogleMaintenanceOauthResult | null;
  credentialMutations: CredentialMutationOperation[];
  credentialMutationNotices: Record<string, CredentialMutationNotice>;
  beginCredentialMutation: (
    kind: CredentialMutationKind,
    credentialId: string | null,
  ) => CredentialMutationOperation | null;
  finishCredentialMutation: (
    operation: CredentialMutationOperation,
    notice?: CredentialMutationNotice,
  ) => void;
  retentionMutation: RetentionMutationOperation | null;
  retentionMutationNotice: RetentionMutationNotice | null;
  beginRetentionMutation: () => RetentionMutationOperation | null;
  finishRetentionMutation: (
    operation: RetentionMutationOperation,
    notice?: RetentionMutationNotice,
  ) => void;
  acknowledgeRetentionMutationRefresh: () => void;
  googleConnectionMutation: GoogleConnectionMutationOperation | null;
  googleConnectionMutationNotice: GoogleConnectionMutationNotice | null;
  beginGoogleConnectionMutation: (
    kind: GoogleConnectionMutationKind,
  ) => GoogleConnectionMutationOperation | null;
  finishGoogleConnectionMutation: (
    operation: GoogleConnectionMutationOperation,
    notice?: GoogleConnectionMutationNotice,
  ) => void;
  isGoogleConnectionMutationActive: (
    operation: GoogleConnectionMutationOperation,
  ) => boolean;
  acknowledgeGoogleConnectionMutationRefresh: () => void;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialsMessage, setCredentialsMessage] = useState("");
  const credentialRequestEpochsRef = useRef(new Map<string, number>());
  const credentialRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );
  const settingsMountedRef = useRef(true);
  const [events, setEvents] = useState<Audit[]>([]);
  const [googleConnection, setGoogleConnection] =
    useState<GoogleConnection | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleMessage, setGoogleMessage] = useState("");
  const googleRequestEpochsRef = useRef(new Map<string, number>());
  const googleRequestControllersRef = useRef(new Map<string, AbortController>());
  const [accountPreferences, setAccountPreferences] =
    useState<AccountPreferences | null>(null);
  const retentionRequestEpochsRef = useRef(new Map<string, number>());
  const retentionRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );
  const [retentionSelection, setRetentionSelection] = useState("86400");
  const [retentionState, setRetentionState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [retentionMessage, setRetentionMessage] = useState("");
  const [themePreference, setThemePreference] =
    useState<StudioThemePreference>(() => readStudioThemePreference());
  const [createCredentialOpen, setCreateCredentialOpen] = useState(false);
  const [replacingCredentialId, setReplacingCredentialId] = useState<
    string | null
  >(null);
  const loadGoogleConnection = async ({ reportFailure = true } = {}): Promise<
    GoogleConnection | null
  > => {
    let observed: GoogleConnection | null = null;
    const hadConnection = googleConnection !== null;
    if (!hadConnection) setGoogleLoading(true);
    if (reportFailure) setGoogleMessage("");
    await settleLatestRequest(
      googleRequestEpochsRef.current,
      "settings:google-connection",
      requestGoogleConnection,
      (connection) => {
        observed = connection;
        setGoogleConnection(connection);
        setGoogleLoading(false);
        setGoogleMessage("");
      },
      () => {
        setGoogleLoading(false);
        if (reportFailure) {
          setGoogleMessage(
            hadConnection
              ? "Не удалось обновить статус Google Drive. Последнее подтверждённое состояние сохранено."
              : "Не удалось загрузить статус Google Drive. Повторите попытку.",
          );
        }
      },
      {
        controllers: googleRequestControllersRef.current,
        timeoutMs: GOOGLE_CONNECTION_REQUEST_TIMEOUT_MS,
      },
    );
    return observed;
  };
  const reconcileGoogleConnection = () =>
    settingsMountedRef.current
      ? loadGoogleConnection({ reportFailure: false })
      : readGoogleConnectionBounded();
  const loadAccountPreferences = async ({ reportFailure = true } = {}): Promise<
    AccountPreferences | null
  > => {
    let observed: AccountPreferences | null = null;
    const hadPreferences = accountPreferences !== null;
    if (!hadPreferences) setRetentionState("loading");
    if (reportFailure) setRetentionMessage("");
    await settleLatestRequest(
      retentionRequestEpochsRef.current,
      "settings:account-preferences",
      async (signal) => {
        const candidate = await api<unknown>("/account/preferences", {
          signal,
          ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
        });
        if (!isExpectedAccountPreferences(candidate)) {
          throw new Error("invalid_account_preferences_response");
        }
        return candidate;
      },
      (preferences) => {
        observed = preferences;
        setAccountPreferences(preferences);
        setRetentionSelection(
          String(preferences.source_retention_ttl_seconds),
        );
        setRetentionState("ready");
        setRetentionMessage("");
      },
      () => {
        setRetentionState(hadPreferences ? "ready" : "error");
        if (reportFailure) {
          setRetentionMessage(
            hadPreferences
              ? "Не удалось обновить настройку хранения. Последнее подтверждённое значение сохранено."
              : "Не удалось загрузить настройку хранения. Повторите попытку.",
          );
        }
      },
      {
        controllers: retentionRequestControllersRef.current,
        timeoutMs: ACCOUNT_PREFERENCES_REQUEST_TIMEOUT_MS,
      },
    );
    return observed;
  };
  const reconcileAccountPreferences = () =>
    settingsMountedRef.current
      ? loadAccountPreferences({ reportFailure: false })
      : readAccountPreferencesBounded();
  const loadAuditEvents = () => {
    api<{ events: Audit[] }>("/audit-events")
      .then((result) => setEvents(result.events))
      .catch(() => setEvents([]));
  };
  const loadCredentials = async ({ reportFailure = true } = {}): Promise<
    Credential[] | null
  > => {
    let observed: Credential[] | null = null;
    setCredentialsLoading(true);
    if (reportFailure) setCredentialsMessage("");
    await settleLatestRequest(
      credentialRequestEpochsRef.current,
      "settings:credentials",
      requestCredentialCollection,
      (nextCredentials) => {
        observed = nextCredentials;
        setCredentials(nextCredentials);
        setCredentialsLoading(false);
        setCredentialsMessage("");
      },
      () => {
        if (reportFailure) {
          setCredentialsMessage(
            "Не удалось загрузить ключи провайдеров. Повторите попытку.",
          );
        }
        setCredentialsLoading(false);
      },
      {
        controllers: credentialRequestControllersRef.current,
        timeoutMs: CREDENTIAL_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
    return observed;
  };
  const reconcileCredentials = () =>
    settingsMountedRef.current
      ? loadCredentials({ reportFailure: false })
      : readCredentialCollectionBounded();
  useEffect(() => {
    settingsMountedRef.current = true;
    void loadCredentials();
    loadAuditEvents();
    void loadGoogleConnection();
    void loadAccountPreferences();
    return () => {
      settingsMountedRef.current = false;
      cancelLatestRequests(
        credentialRequestEpochsRef.current,
        credentialRequestControllersRef.current,
      );
      cancelLatestRequests(
        retentionRequestEpochsRef.current,
        retentionRequestControllersRef.current,
      );
      cancelLatestRequests(
        googleRequestEpochsRef.current,
        googleRequestControllersRef.current,
      );
    };
  }, []);
  useEffect(() => {
    if (retentionMutation || !retentionMutationNotice?.refreshOnMount) return;
    acknowledgeRetentionMutationRefresh();
    void loadAccountPreferences({ reportFailure: false });
  }, [retentionMutation, retentionMutationNotice]);
  useEffect(() => {
    if (
      googleConnectionMutation ||
      !googleConnectionMutationNotice?.refreshOnMount
    ) {
      return;
    }
    acknowledgeGoogleConnectionMutationRefresh();
    void loadGoogleConnection({ reportFailure: false });
  }, [googleConnectionMutation, googleConnectionMutationNotice]);
  const safeMutate = <T,>(path: string, options: RequestInit) =>
    csrfMutate<T>(path, csrf, onCsrf, options);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const operation = beginCredentialMutation("create", null);
    if (!operation) return;
    let notice: CredentialMutationNotice | undefined;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const provider = String(fd.get("provider") ?? "") as Credential["provider"];
    const label = String(fd.get("credential_label") ?? "").trim();
    const rawValue = String(fd.get("credential_raw_value") ?? "");
    const rawInput = form.elements.namedItem(
      "credential_raw_value",
    ) as HTMLInputElement | null;
    if (rawInput) rawInput.value = "";
    const reconcileAmbiguousCreate = async () => {
      const observed = await reconcileCredentials();
      notice = {
        kind: operation.kind,
        credentialId: operation.credentialId,
        message: observed
          ? "Сервер не подтвердил создание ключа. Список обновлён; проверьте его перед повторной попыткой. Значение ключа нужно ввести заново."
          : "Сервер не подтвердил создание ключа, а обновить список не удалось. Обновите страницу перед повторной попыткой; значение ключа нужно ввести заново.",
        tone: "error",
      };
    };
    try {
      const request = await runBoundedRequest(
        (signal) =>
          safeMutate<unknown>("/credentials", {
            method: "POST",
            signal,
            body: JSON.stringify({ provider, label, raw_value: rawValue }),
          }),
        CREDENTIAL_MUTATION_REQUEST_TIMEOUT_MS,
      );
      if (request.status === "timed_out") {
        await reconcileAmbiguousCreate();
        return;
      }
      const created = request.value;
      if (
        !isExpectedCredentialCreateResponse(created) ||
        created.provider !== provider ||
        created.label !== label
      ) {
        await reconcileAmbiguousCreate();
        return;
      }
      if (settingsMountedRef.current) {
        form.reset();
        setCreateCredentialOpen(false);
        await loadCredentials({ reportFailure: false });
      } else {
        await readCredentialCollectionBounded();
      }
      notice = {
        kind: operation.kind,
        credentialId: operation.credentialId,
        message: "Ключ провайдера создан.",
        tone: "notice",
      };
    } catch (error) {
      if (isAmbiguousCredentialMutationFailure(error)) {
        await reconcileAmbiguousCreate();
      } else {
        notice = {
          kind: operation.kind,
          credentialId: operation.credentialId,
          message: "Не удалось создать ключ. Проверьте данные и введите значение ключа заново.",
          tone: "error",
        };
      }
    } finally {
      finishCredentialMutation(operation, notice);
      if (settingsMountedRef.current) loadAuditEvents();
    }
  }
  async function replace(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const selected = credentials.find((credential) => credential.id === id);
    if (!selected) {
      setCredentialsMessage("Выберите ключ для замены.");
      return;
    }
    const operation = beginCredentialMutation("replace", id);
    if (!operation) return;
    let notice: CredentialMutationNotice | undefined;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const rawValue = String(fd.get("replacement_credential_raw_value") ?? "");
    const rawInput = form.elements.namedItem(
      "replacement_credential_raw_value",
    ) as HTMLInputElement | null;
    if (rawInput) rawInput.value = "";
    const previousVersion = selected.active_version;
    const reconcileAmbiguousReplace = async () => {
      const observed = await reconcileCredentials();
      const confirmed =
        observed?.some(
          (credential) =>
            credential.id === id &&
            credential.status === "active" &&
            credential.active_version !== null &&
            (previousVersion === null ||
              credential.active_version > previousVersion),
        ) === true;
      if (confirmed && settingsMountedRef.current) {
        setReplacingCredentialId((current) => (current === id ? null : current));
      }
      notice = {
        kind: operation.kind,
        credentialId: operation.credentialId,
        message: confirmed
          ? "Замена ключа подтверждена по актуальному списку."
          : observed
            ? "Сервер не подтвердил замену ключа. Список обновлён; проверьте версию перед повторной попыткой. Значение ключа нужно ввести заново."
            : "Сервер не подтвердил замену ключа, а обновить список не удалось. Обновите страницу перед повторной попыткой; значение ключа нужно ввести заново.",
        tone: confirmed ? "notice" : "error",
      };
    };
    try {
      const request = await runBoundedRequest(
        (signal) =>
          safeMutate<unknown>(`/credentials/${id}/replace`, {
            method: "POST",
            signal,
            body: JSON.stringify({
              provider: selected.provider,
              label: selected.label,
              raw_value: rawValue,
            }),
          }),
        CREDENTIAL_MUTATION_REQUEST_TIMEOUT_MS,
      );
      if (request.status === "timed_out") {
        await reconcileAmbiguousReplace();
        return;
      }
      const replaced = request.value;
      if (
        !isExpectedCredentialReplaceResponse(replaced) ||
        (previousVersion !== null && replaced.active_version <= previousVersion)
      ) {
        await reconcileAmbiguousReplace();
        return;
      }
      if (settingsMountedRef.current) {
        setCredentials((current) =>
          current.map((credential) =>
            credential.id === id
              ? {
                  ...credential,
                  status: "active",
                  active_version: replaced.active_version,
                  masked_value: replaced.masked_value,
                }
              : credential,
          ),
        );
        form.reset();
        setReplacingCredentialId(null);
        await loadCredentials({ reportFailure: false });
      } else {
        await readCredentialCollectionBounded();
      }
      notice = {
        kind: operation.kind,
        credentialId: operation.credentialId,
        message: "Ключ провайдера заменён.",
        tone: "notice",
      };
    } catch (error) {
      if (isAmbiguousCredentialMutationFailure(error)) {
        await reconcileAmbiguousReplace();
      } else {
        notice = {
          kind: operation.kind,
          credentialId: operation.credentialId,
          message: "Не удалось заменить ключ. Проверьте данные и введите значение ключа заново.",
          tone: "error",
        };
      }
    } finally {
      finishCredentialMutation(operation, notice);
      if (settingsMountedRef.current) loadAuditEvents();
    }
  }
  async function saveRetentionPreference(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const selected = Number(retentionSelection);
    if (
      !accountPreferences?.allowed_source_retention_ttl_seconds.includes(
        selected,
      )
    ) {
      setRetentionMessage("Выберите доступный срок хранения.");
      return;
    }
    const operation = beginRetentionMutation();
    if (!operation) return;
    let notice: RetentionMutationNotice | undefined;
    const previousConfirmed = accountPreferences.source_retention_ttl_seconds;
    setRetentionMessage("");
    const reconcileAmbiguousPreference = async () => {
      const observed = await reconcileAccountPreferences();
      const confirmed =
        observed?.source_retention_ttl_seconds === selected;
      if (!observed && settingsMountedRef.current) {
        setRetentionSelection(String(previousConfirmed));
        setRetentionState("ready");
      }
      notice = {
        message: confirmed
          ? "Сохранение срока подтверждено по актуальной настройке аккаунта."
          : observed
            ? "Сервер не подтвердил сохранение. Показано актуальное значение; проверьте его перед повторной попыткой."
            : "Сервер не подтвердил сохранение, а обновить настройку не удалось. Сохранено последнее подтверждённое значение; обновите страницу перед повторной попыткой.",
        tone: confirmed ? "notice" : "error",
        refreshOnMount: !settingsMountedRef.current,
      };
    };
    try {
      const request = await runBoundedRequest(
        (signal) =>
          safeMutate<unknown>("/account/preferences", {
            method: "PATCH",
            signal,
            body: JSON.stringify({
              source_retention_ttl_seconds: selected,
            }),
          }),
        ACCOUNT_PREFERENCES_MUTATION_TIMEOUT_MS,
      );
      if (request.status === "timed_out") {
        await reconcileAmbiguousPreference();
        return;
      }
      const preferences = request.value;
      if (
        !isExpectedAccountPreferences(preferences) ||
        preferences.source_retention_ttl_seconds !== selected
      ) {
        await reconcileAmbiguousPreference();
        return;
      }
      if (settingsMountedRef.current) {
        setAccountPreferences(preferences);
        setRetentionSelection(
          String(preferences.source_retention_ttl_seconds),
        );
        setRetentionState("ready");
      }
      notice = {
        message: "Срок хранения сохранён.",
        tone: "notice",
        refreshOnMount: !settingsMountedRef.current,
      };
    } catch (error) {
      if (isAmbiguousRetentionMutationFailure(error)) {
        await reconcileAmbiguousPreference();
      } else {
        if (settingsMountedRef.current) {
          setRetentionSelection(String(previousConfirmed));
          setRetentionState("ready");
        }
        notice = {
          message: "Не удалось сохранить срок хранения. Проверьте значение и повторите.",
          tone: "error",
          refreshOnMount: false,
        };
      }
    } finally {
      finishRetentionMutation(operation, notice);
      if (settingsMountedRef.current) loadAuditEvents();
    }
  }  const mutateCredential = async (
    kind: "revoke" | "delete",
    credential: Credential,
  ) => {
    const operation = beginCredentialMutation(kind, credential.id);
    if (!operation) return;
    let notice: CredentialMutationNotice | undefined;
    const reconcileAmbiguousMutation = async () => {
      const observed = await reconcileCredentials();
      const confirmed =
        kind === "delete"
          ? observed !== null &&
            !observed.some((candidate) => candidate.id === credential.id)
          : observed?.some(
              (candidate) =>
                candidate.id === credential.id && candidate.status === "revoked",
            ) === true;
      notice = {
        kind: operation.kind,
        credentialId: operation.credentialId,
        message: confirmed
          ? kind === "delete"
            ? "Удаление ключа подтверждено по актуальному списку."
            : "Отключение ключа подтверждено по актуальному списку."
          : observed
            ? `Сервер не подтвердил ${kind === "delete" ? "удаление" : "отключение"} ключа. Список обновлён; проверьте статус перед повторной попыткой.`
            : `Сервер не подтвердил ${kind === "delete" ? "удаление" : "отключение"} ключа, а обновить список не удалось. Обновите страницу перед повторной попыткой.`,
        tone: confirmed ? "notice" : "error",
      };
    };
    try {
      const request = await runBoundedRequest(
        (signal) =>
          safeMutate<unknown>(
            kind === "delete"
              ? `/credentials/${credential.id}`
              : `/credentials/${credential.id}/revoke`,
            { method: kind === "delete" ? "DELETE" : "POST", signal },
          ),
        CREDENTIAL_MUTATION_REQUEST_TIMEOUT_MS,
      );
      if (request.status === "timed_out") {
        await reconcileAmbiguousMutation();
        return;
      }
      if (!isExpectedOkResponse(request.value)) {
        await reconcileAmbiguousMutation();
        return;
      }
      if (settingsMountedRef.current) {
        setCredentials((current) =>
          kind === "delete"
            ? current.filter((candidate) => candidate.id !== credential.id)
            : current.map((candidate) =>
                candidate.id === credential.id
                  ? { ...candidate, status: "revoked" }
                  : candidate,
              ),
        );
        if (kind === "delete") {
          setReplacingCredentialId((current) =>
            current === credential.id ? null : current,
          );
        }
        await loadCredentials({ reportFailure: false });
      } else {
        await readCredentialCollectionBounded();
      }
      notice = {
        kind: operation.kind,
        credentialId: operation.credentialId,
        message:
          kind === "delete"
            ? "Ключ провайдера удалён без возможности восстановления."
            : "Ключ провайдера отключён.",
        tone: "notice",
      };
    } catch (error) {
      if (isAmbiguousCredentialMutationFailure(error)) {
        await reconcileAmbiguousMutation();
      } else {
        notice = {
          kind: operation.kind,
          credentialId: operation.credentialId,
          message:
            kind === "delete"
              ? "Не удалось удалить ключ. Обновите список и повторите."
              : "Не удалось отключить ключ. Обновите список и повторите.",
          tone: "error",
        };
      }
    } finally {
      finishCredentialMutation(operation, notice);
      if (settingsMountedRef.current) loadAuditEvents();
    }
  };
  const connectGoogle = async () => {
    const operation = beginGoogleConnectionMutation("oauth-start");
    if (!operation) return;
    let notice: GoogleConnectionMutationNotice | undefined;
    setGoogleMessage("");
    const reconcileAmbiguousStart = async () => {
      if (!isGoogleConnectionMutationActive(operation)) return;
      const observed = await reconcileGoogleConnection();
      if (!isGoogleConnectionMutationActive(operation)) return;
      notice = {
        kind: operation.kind,
        message: observed
          ? "Сервер не подтвердил начало подключения. Статус Google Drive обновлён; не повторяйте запрос, пока не проверите состояние подключения."
          : "Сервер не подтвердил начало подключения, а обновить статус Google Drive не удалось. Обновите страницу перед новой попыткой.",
        tone: "error",
        refreshOnMount: !settingsMountedRef.current,
      };
    };
    try {
      const request = await runBoundedRequest(
        (signal) =>
          safeMutate<unknown>("/google/oauth/start", {
            method: "POST",
            signal,
          }),
        GOOGLE_CONNECTION_MUTATION_TIMEOUT_MS,
      );
      if (
        request.status === "timed_out" ||
        !isExpectedGoogleOauthStart(request.value)
      ) {
        await reconcileAmbiguousStart();
        return;
      }
      if (!isGoogleConnectionMutationActive(operation)) return;
      window.location.assign(request.value.authorization_url);
    } catch (error) {
      if (isAmbiguousGoogleConnectionMutationFailure(error)) {
        await reconcileAmbiguousStart();
      } else {
        notice = {
          kind: operation.kind,
          message:
            "Не удалось начать подключение Google Drive. Попробуйте позже или проверьте настройки OAuth.",
          tone: "error",
          refreshOnMount: false,
        };
      }
    } finally {
      finishGoogleConnectionMutation(operation, notice);
      if (settingsMountedRef.current) loadAuditEvents();
    }
  };
  const disconnectGoogle = async () => {
    const operation = beginGoogleConnectionMutation("disconnect");
    if (!operation) return;
    let notice: GoogleConnectionMutationNotice | undefined;
    setGoogleMessage("");
    const reconcileAmbiguousDisconnect = async () => {
      if (!isGoogleConnectionMutationActive(operation)) return;
      const observed = await reconcileGoogleConnection();
      if (!isGoogleConnectionMutationActive(operation)) return;
      const confirmed = Boolean(
        observed &&
          !observed.connected &&
          (observed.status === "revoked" || observed.status === null),
      );
      notice = {
        kind: operation.kind,
        message: confirmed
          ? "Отключение Google Drive подтверждено по актуальному состоянию."
          : observed
            ? "Сервер не подтвердил отключение. Показан актуальный статус; проверьте его перед повторной попыткой."
            : "Сервер не подтвердил отключение, а обновить статус Google Drive не удалось. Обновите страницу перед повторной попыткой.",
        tone: confirmed ? "notice" : "error",
        refreshOnMount: !settingsMountedRef.current,
      };
    };
    try {
      const request = await runBoundedRequest(
        (signal) =>
          safeMutate<unknown>("/google/connection", {
            method: "DELETE",
            signal,
          }),
        GOOGLE_CONNECTION_MUTATION_TIMEOUT_MS,
      );
      if (
        request.status === "timed_out" ||
        !isExpectedGoogleConnection(request.value) ||
        request.value.connected ||
        (request.value.status !== "revoked" && request.value.status !== null)
      ) {
        await reconcileAmbiguousDisconnect();
        return;
      }
      if (settingsMountedRef.current) setGoogleConnection(request.value);
      notice = {
        kind: operation.kind,
        message: "Google Drive отключён.",
        tone: "notice",
        refreshOnMount: !settingsMountedRef.current,
      };
    } catch (error) {
      if (isAmbiguousGoogleConnectionMutationFailure(error)) {
        await reconcileAmbiguousDisconnect();
      } else {
        notice = {
          kind: operation.kind,
          message: "Не удалось отключить Google Drive. Обновите статус и повторите.",
          tone: "error",
          refreshOnMount: false,
        };
      }
    } finally {
      finishGoogleConnectionMutation(operation, notice);
      if (settingsMountedRef.current) loadAuditEvents();
    }
  };
  const googleCanDisconnect = Boolean(
    googleConnection?.connected || googleConnection?.status === "error",
  );
  const oauthMessage =
    oauthResult === "connected"
      ? !googleLoading && googleConnection?.connected
        ? googleOauthMessages.connected
        : ""
      : oauthResult
        ? googleOauthMessages[oauthResult]
        : "";
  const createCredentialPending = credentialMutations.some(
    (operation) => operation.credentialId === null,
  );
  const credentialMutationFor = (credentialId: string) =>
    credentialMutations.find(
      (operation) => operation.credentialId === credentialId,
    ) ?? null;
  const credentialsUnavailable = credentialsLoading || Boolean(credentialsMessage);  return (
    <section className="card wide">
      <h2>Настройки</h2>
      <div className="tabs" role="tablist" aria-label="Разделы настроек">
        <button
          type="button"
          role="tab"
          aria-selected={section === "account"}
          className={section === "account" ? "active" : ""}
          onClick={() => onSectionChange("account")}
        >
          Аккаунт
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "diagnostics"}
          className={section === "diagnostics" ? "active" : ""}
          onClick={() => onSectionChange("diagnostics")}
        >
          Диагностика
        </button>
      </div>
      {section === "diagnostics" ? (
        <DiagnosticsSettings csrf={csrf} onCsrf={onCsrf} auditEvents={events} />
      ) : (
        <>
          <h2>Настройки аккаунта</h2>
          {oauthMessage && (
            <p className="notice" role="status">
              {oauthMessage}
            </p>
          )}
          <section className="account-card">
            <div>
              <b>{user.email}</b>
              <span className="muted">{user.role}</span>
            </div>
            <button className="secondary" onClick={onLogout}>
              Выйти
            </button>
          </section>
          <h3>Оформление</h3>
          <section className="card theme-preferences">
            <label>
              Тема интерфейса
              <select
                aria-label="Тема интерфейса"
                value={themePreference}
                onChange={(event) => {
                  const preference = event.target.value as StudioThemePreference;
                  setThemePreference(preference);
                  setStudioThemePreference(preference);
                }}
              >
                <option value="system">Системная</option>
                <option value="light">Светлая</option>
                <option value="dark">Тёмная</option>
              </select>
            </label>
            <p className="muted">
              Системная тема следует настройке устройства. Выбор сохраняется
              только в этом браузере и не содержит данных аккаунта.
            </p>
          </section>
          <h3>Хранение локальных файлов</h3>
          <section className="card retention-preferences">
            <p>
              Это срок хранения временной копии в приватном объектном
              хранилище (S3/R2) для новых файлов, загруженных с устройства.
              После срока копия удаляется. Ссылки на Google Drive и результаты
              Google Docs не затрагиваются. Уже загруженные файлы сохраняют
              текущую дату удаления.
            </p>
            {retentionState === "loading" && (
              <p role="status">Загружаем настройку хранения…</p>
            )}
            {retentionState === "error" && (
              <div className="error">
                <p role="alert">
                  {retentionMessage || "Не удалось загрузить настройку хранения."}
                </p>
                <button
                  type="button"
                  onClick={() => void loadAccountPreferences()}
                >
                  Повторить
                </button>
              </div>
            )}
            {retentionState === "ready" && accountPreferences && (
              <form
                className="retention-preferences-form"
                aria-label="Настройка хранения локальных файлов"
                aria-busy={retentionMutation !== null || undefined}
                onSubmit={saveRetentionPreference}
              >
                <label>
                  Срок хранения
                  <select
                    aria-label="Срок хранения локальных файлов"
                    value={retentionSelection}
                    disabled={retentionMutation !== null}
                    onChange={(event) => {
                      setRetentionSelection(event.target.value);
                      setRetentionMessage("");
                    }}
                  >
                    {accountPreferences.allowed_source_retention_ttl_seconds.map(
                      (seconds) => (
                        <option key={seconds} value={seconds}>
                          {retentionOptionLabel(seconds)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={retentionMutation !== null}
                  aria-busy={retentionMutation !== null || undefined}
                >
                  {retentionMutation ? "Сохраняем…" : "Сохранить срок"}
                </button>
              </form>
            )}
            {retentionState !== "error" && retentionMessage && (
              <p role="alert" className="error">
                {retentionMessage}
              </p>
            )}
            {retentionMutationNotice && (
              <p
                role={
                  retentionMutationNotice.tone === "error" ? "alert" : "status"
                }
                className={retentionMutationNotice.tone}
              >
                {retentionMutationNotice.message}
              </p>
            )}
          </section>
          <h3>Ключи провайдеров</h3>
          <p className="notice">
            Ключи не сохраняются в браузере и никогда не отображаются обратно.
          </p>
          {credentialMutations.length > 0 && (
            <p role="status" className="notice">
              Операция с ключом выполняется. Её статус сохранится при переходе между разделами.
            </p>
          )}
          {Object.entries(credentialMutationNotices).map(([key, notice]) => (
            <p
              key={`${key}:${notice.kind}`}
              className={notice.tone}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.message}
            </p>
          ))}
          {credentialsMessage && (
            <div className="error">
              <p role="alert">{credentialsMessage}</p>
              <button type="button" onClick={() => void loadCredentials()}>
                Повторить
              </button>
            </div>
          )}
          {credentialsLoading && (
            <p role="status">Загружаем ключи провайдеров…</p>
          )}
          <button
            type="button"
            aria-expanded={createCredentialOpen}
            aria-busy={createCredentialPending || undefined}
            disabled={createCredentialPending || credentialsUnavailable}
            onClick={() => setCreateCredentialOpen((open) => !open)}
          >
            {createCredentialPending ? "Создаём ключ…" : "Добавить ключ"}
          </button>
          {createCredentialOpen && (
            <form
              className="inline"
              onSubmit={save}
              autoComplete="off"
              aria-busy={createCredentialPending || undefined}
            >
              <select
                name="provider"
                aria-label="Провайдер"
                disabled={createCredentialPending}
              >
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
              </select>
              <input
                name="credential_label"
                autoComplete="off"
                placeholder="Метка"
                disabled={createCredentialPending}
                required
              />
              <input
                name="credential_raw_value"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                placeholder="Новый ключ"
                disabled={createCredentialPending}
                required
              />
              <button className="primary" disabled={createCredentialPending}>
                {createCredentialPending ? "Создаём…" : "Создать"}
              </button>
              <button
                type="button"
                disabled={createCredentialPending}
                onClick={() => setCreateCredentialOpen(false)}
              >
                Отмена
              </button>
            </form>
          )}
          <div className="grid">
            {credentials.map((credential) => {
              const activeMutation = credentialMutationFor(credential.id);
              const mutationPending = activeMutation !== null;
              return (
                <article
                  className="card"
                  key={credential.id}
                  aria-busy={mutationPending || undefined}
                >
                  <span className="tag">{credential.provider}</span>
                  <h3>{credential.label}</h3>
                  <p>
                    {credential.status} · v{credential.active_version ?? "—"} ·{" "}
                    {credential.masked_value ?? "—"}
                  </p>
                  <p className="muted">
                    Отключение запрещает использовать ключ в задачах, но сохраняет
                    его версии. Удаление навсегда стирает сохранённые значения
                    ключа без возможности восстановления.
                  </p>
                  <div className="credential-actions">
                    <button
                      type="button"
                      disabled={mutationPending || credentialsUnavailable}
                      onClick={() => setReplacingCredentialId(credential.id)}
                    >
                      Заменить
                    </button>
                    <button
                      type="button"
                      disabled={mutationPending || credentialsUnavailable}
                      aria-busy={activeMutation?.kind === "revoke" || undefined}
                      onClick={() => {
                        if (
                          safeConfirm(
                            `Отключить ключ «${credential.label}»? Он станет недоступен для новых и выполняющихся задач, но история версий сохранится.`,
                          )
                        ) {
                          void mutateCredential("revoke", credential);
                        }
                      }}
                    >
                      {activeMutation?.kind === "revoke"
                        ? "Отключаем…"
                        : "Отключить"}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={mutationPending || credentialsUnavailable}
                      aria-busy={activeMutation?.kind === "delete" || undefined}
                      onClick={() => {
                        if (
                          safeConfirm(
                            `Удалить ключ «${credential.label}» навсегда? Все сохранённые значения будут стёрты без возможности восстановления.`,
                          )
                        ) {
                          void mutateCredential("delete", credential);
                        }
                      }}
                    >
                      {activeMutation?.kind === "delete"
                        ? "Удаляем…"
                        : "Удалить навсегда"}
                    </button>
                  </div>
                  {replacingCredentialId === credential.id && (
                    <form
                      className="inline"
                      onSubmit={(event) => replace(event, credential.id)}
                      aria-label={`Заменить ключ ${credential.label}`}
                      aria-busy={activeMutation?.kind === "replace" || undefined}
                      autoComplete="off"
                    >
                      <input
                        name="replacement_credential_raw_value"
                        type="password"
                        autoComplete="new-password"
                        spellCheck={false}
                        data-1p-ignore="true"
                        data-lpignore="true"
                        data-bwignore="true"
                        placeholder="Новый ключ для замены"
                        disabled={mutationPending}
                        required
                      />
                      <button className="primary" disabled={mutationPending}>
                        {activeMutation?.kind === "replace"
                          ? "Сохраняем…"
                          : "Сохранить"}
                      </button>
                      <button
                        type="button"
                        disabled={mutationPending}
                        onClick={() => setReplacingCredentialId(null)}
                      >
                        Отмена
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>          <h3>Google Drive</h3>
          <p
            className={
              googleConnection?.connected && googleConnection.picker_ready
                ? "muted"
                : "notice"
            }
          >
            {googleLoading
              ? "Проверяем подключение Google Drive…"
              : googleConnection?.connected
                ? googleConnection.picker_ready
                  ? "Google Drive подключён. Актуальность доступа проверяется при каждом открытии Picker."
                  : googleConnection.reconnect_required ||
                      !googleConnection.picker_scope_ready
                    ? "Подключение Google Drive нужно обновить, чтобы выбирать файлы и папку результатов."
                    : "Google Drive подключён, но Google Picker пока не настроен."
                : "Подключите Google Drive, чтобы выбирать файлы и папку результатов."}
          </p>
          <article className="card">
            <span className="tag">Google Drive</span>
            {googleLoading ? (
              <p>Проверяем статус подключения…</p>
            ) : googleConnection?.connected ? (
              <>
                <h3>Google Drive подключён</h3>
                <p>
                  <b>{googleConnection.google_email ?? "—"}</b>
                </p>
                <p className="muted">
                  Подключён {formatTime(googleConnection.connected_at)}
                </p>
                <details className="technical-details">
                  <summary>Технические сведения</summary>
                  <dl className="meta technical-meta">
                    <dt>Статус</dt>
                    <dd>{googleConnection.status ?? "—"}</dd>
                    <dt>Разрешения</dt>
                    <dd>{googleConnection.scopes ?? "—"}</dd>
                    <dt>Отключено</dt>
                    <dd>{formatTime(googleConnection.revoked_at)}</dd>
                    <dt>Требуется переподключение</dt>
                    <dd>
                      {googleConnection.reconnect_required ? "да" : "нет"}
                    </dd>
                  </dl>
                </details>
                {googleConnection.reconnect_required && (
                  <div className="notice" role="status">
                    Для выбора файлов и папок нужно обновить подключение Google
                    Drive.
                  </div>
                )}
                {googleConnection.reconnect_required && (
                  <button
                    className="primary"
                    type="button"
                    disabled={googleConnectionMutation !== null}
                    aria-busy={googleConnectionMutation !== null || undefined}
                    onClick={connectGoogle}
                  >
                    Переподключить Google Drive
                  </button>
                )}
              </>
            ) : googleConnection ? (
              <>
                <h3>Google Drive не подключён</h3>
                <p>
                  Подключите аккаунт, чтобы выбирать файлы и папку результатов.
                </p>
                {googleConnection.revoked_at && (
                  <p className="muted">
                    Статус: {googleConnection.status ?? "revoked"}
                  </p>
                )}
                <button
                  className="primary"
                  disabled={googleConnectionMutation !== null}
                  aria-busy={googleConnectionMutation !== null || undefined}
                  onClick={connectGoogle}
                >
                  Подключить Google Drive
                </button>
              </>
            ) : (
              <>
                <p>Google Drive недоступен.</p>
                <button
                  type="button"
                  disabled={googleConnectionMutation !== null}
                  onClick={() => void loadGoogleConnection()}
                >
                  Повторить проверку Google Drive
                </button>
              </>
            )}
            {googleCanDisconnect && (
              <button
                type="button"
                disabled={googleConnectionMutation !== null}
                aria-busy={googleConnectionMutation !== null || undefined}
                onClick={disconnectGoogle}
              >
                Отключить Google Drive
              </button>
            )}
            {googleMessage && <p className="error">{googleMessage}</p>}
            {googleConnectionMutationNotice && (
              <p
                role={
                  googleConnectionMutationNotice.tone === "error"
                    ? "alert"
                    : "status"
                }
                className={googleConnectionMutationNotice.tone}
              >
                {googleConnectionMutationNotice.message}
              </p>
            )}
          </article>
          <TranscriptCatalogMigrationPanel
            csrf={csrf}
            onCsrf={onCsrf}
            googleConnected={googleConnection?.connected === true}
            googleLoading={googleLoading}
            pickerReady={googleConnection?.picker_ready === true}
            maintenanceOauthResult={maintenanceOauthResult}
          />
          <details className="card security-log">
            <summary className="summary-row">
              <span>Журнал безопасности</span>
            </summary>
            <ul>
              {events
                .filter((e) => e.type !== "auth.csrf_refreshed")
                .slice(0, 20)
                .map((e) => (
                  <li key={e.id}>
                    {auditLabel(e.type)} ·{" "}
                    {new Date(e.created_at).toLocaleString("ru-RU")}
                  </li>
                ))}
            </ul>
            <details>
              <summary>Технические события</summary>
              <ul>
                {events.slice(0, 20).map((e) => (
                  <li key={e.id}>
                    {e.type} · {new Date(e.created_at).toLocaleString("ru-RU")}
                  </li>
                ))}
              </ul>
            </details>
          </details>
        </>
      )}
    </section>
  );
}

function DiagnosticsSettings({
  csrf,
  onCsrf,
  auditEvents,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
  auditEvents: Audit[];
}) {
  const [system, setSystem] = useState<DiagnosticsSystem | null>(null);
  const [systemState, setSystemState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [filters, setFilters] = useState<DiagnosticsFilters>({
    days: "1",
    level: "",
    component: "",
    eventCode: "",
    projectId: "",
    jobId: "",
  });
  const [timeline, setTimeline] = useState<DiagnosticsEvent[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [eventsState, setEventsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [exportState, setExportState] = useState("");
  const [debugSession, setDebugSession] =
    useState<DiagnosticsDebugSession | null>(null);
  const [debugState, setDebugState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [debugActionState, setDebugActionState] = useState("");
  const [debugDuration, setDebugDuration] = useState("10");
  const [debugTick, setDebugTick] = useState(0);
  const debugRefreshInFlight = useRef(false);
  const expiredDebugRefreshRequested = useRef(false);
  const loadEvents = (cursor?: string) => {
    setEventsState("loading");
    const params = new URLSearchParams({ page_size: "25" });
    if (cursor) {
      params.set("cursor", cursor);
    } else {
      const payload = reportPayload(filters);
      params.set("start", payload.start);
      params.set("end", payload.end);
      if (payload.level) params.set("level", payload.level);
      if (payload.component) params.set("component", payload.component);
      if (payload.event_code) params.set("event_code", payload.event_code);
      if (payload.project_id) params.set("project_id", payload.project_id);
      if (payload.job_id) params.set("job_id", payload.job_id);
    }
    api<DiagnosticsEventsResponse>(`/diagnostics/events?${params.toString()}`)
      .then((r) => {
        setTimeline((current) =>
          cursor ? [...current, ...r.events] : r.events,
        );
        setPeriod(r.period);
        setNextCursor(r.next_cursor ?? null);
        setEventsState("ready");
      })
      .catch(() => {
        if (!cursor) setTimeline([]);
        setEventsState("error");
      });
  };
  useEffect(() => {
    api<DiagnosticsSystem>("/diagnostics/system")
      .then((r) => {
        setSystem(r);
        setSystemState("ready");
      })
      .catch(() => setSystemState("error"));
    loadEvents();
  }, []);
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTimeline([]);
    setNextCursor(null);
    loadEvents();
  };
  const updateFilter =
    (name: keyof DiagnosticsFilters) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFilters((current) => ({ ...current, [name]: event.target.value }));
  const loadDebugSession = (options: { keepReady?: boolean } = {}) => {
    if (debugRefreshInFlight.current) return;
    debugRefreshInFlight.current = true;
    if (!options.keepReady) setDebugState("loading");
    api<DiagnosticsDebugSession>("/diagnostics/debug-session")
      .then((status) => {
        expiredDebugRefreshRequested.current = false;
        setDebugSession(status);
        configurePwaDiagnosticsDebugState({
          active: status.active,
          expiresAt: status.expires_at,
        });
        setDebugState("ready");
      })
      .catch(() => {
        configurePwaDiagnosticsDebugState({ active: false });
        setDebugState("error");
      })
      .finally(() => {
        debugRefreshInFlight.current = false;
      });
  };
  useEffect(loadDebugSession, [csrf]);
  useEffect(() => {
    const timer = window.setInterval(
      () => setDebugTick((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const debugLocallyActive = Boolean(
    debugSession?.active &&
    debugSession.expires_at &&
    Date.parse(debugSession.expires_at) > Date.now(),
  );
  const activeDebugSession = debugLocallyActive ? debugSession : null;
  useEffect(() => {
    if (!debugSession?.active || !debugSession.expires_at) return;
    if (Date.parse(debugSession.expires_at) > Date.now()) return;
    configurePwaDiagnosticsDebugState({ active: false });
    setDebugSession((current) =>
      current ? { ...current, active: false } : current,
    );
    if (expiredDebugRefreshRequested.current) return;
    expiredDebugRefreshRequested.current = true;
    loadDebugSession({ keepReady: true });
  }, [debugTick, debugSession?.active, debugSession?.expires_at, csrf]);
  const startDebug = async () => {
    setDebugActionState("Включаем DEBUG…");
    try {
      const status = await csrfMutate<DiagnosticsDebugSession>(
        "/diagnostics/debug-session",
        csrf,
        onCsrf,
        {
          method: "POST",
          body: JSON.stringify({ duration_minutes: Number(debugDuration) }),
        },
      );
      setDebugSession(status);
      configurePwaDiagnosticsDebugState({
        active: status.active,
        expiresAt: status.expires_at,
      });
      setDebugActionState("DEBUG включена.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        loadDebugSession();
        setDebugActionState(
          "DEBUG уже активна в другой вкладке. Статус обновлён.",
        );
        return;
      }
      setDebugActionState("Не удалось включить DEBUG.");
    }
  };
  const stopDebug = async () => {
    setDebugActionState("Останавливаем DEBUG…");
    try {
      await csrfMutate<DiagnosticsDebugSession>(
        "/diagnostics/debug-session",
        csrf,
        onCsrf,
        { method: "DELETE" },
      );
      configurePwaDiagnosticsDebugState({ active: false });
      loadDebugSession();
      setDebugActionState("DEBUG остановлена.");
    } catch {
      setDebugActionState("Не удалось остановить DEBUG.");
    }
  };

  const exportReport = async () => {
    setExportState("Готовим Markdown-отчёт…");
    try {
      const blob = await diagnosticsReportBlob(filters, csrf, onCsrf);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = reportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportState("Markdown-отчёт скачан.");
    } catch (err) {
      setExportState(
        err instanceof Error
          ? err.message
          : "Не удалось скачать Markdown-отчёт.",
      );
    }
  };
  return (
    <div className="diagnostics-page">
      <h2>Диагностика</h2>
      <p className="notice">
        Раздел показывает только безопасные сведения для вашего аккаунта.
      </p>
      <section className="card" aria-labelledby="system-diagnostics-title">
        <h3 id="system-diagnostics-title">Состояние системы</h3>
        {systemState === "loading" && <p role="status">Загружаем состояние…</p>}
        {systemState === "error" && (
          <p className="error">
            Не удалось загрузить состояние. Повторите позже.
          </p>
        )}
        {systemState === "ready" && system && (
          <dl className="meta">
            <dt>Сборка веб-приложения</dt>
            <dd>{buildIdentityText(system.build?.web)}</dd>
            <dt>Сборка API</dt>
            <dd>{buildIdentityText(system.build?.api)}</dd>
            <dt>Сборка фоновой обработки</dt>
            <dd>{buildIdentityText(system.build?.worker)}</dd>
            <dt>Среда</dt>
            <dd>{safeText(system.environment ?? system.pwa_mode)}</dd>
            <dt>Google Drive подключён</dt>
            <dd>{boolText(system.google_drive?.connected)}</dd>
            <dt>Разрешение Google Drive получено</dt>
            <dd>{boolText(system.google_drive?.scope_ready)}</dd>
            <dt>Ключи готовы</dt>
            <dd>{boolText(system.provider_credentials?.ready)}</dd>
            <dt>Активных ключей</dt>
            <dd>{safeText(system.provider_credentials?.active_count)}</dd>
            <dt>Запись диагностики</dt>
            <dd>{boolText(system.diagnostics?.recording_enabled)}</dd>
            <dt>DEBUG-запись</dt>
            <dd>
              {diagnosticsDebugStateText(system.diagnostics?.debug_recording)}
            </dd>
            <dt>Хранение обычных событий</dt>
            <dd>{safeText(system.diagnostics?.retention_days)} дней</dd>
            <dt>Хранение DEBUG</dt>
            <dd>{safeText(system.diagnostics?.debug_retention_hours)} часов</dd>
            <dt>Максимум дней в отчёте</dt>
            <dd>{safeText(system.report_limits?.max_days)}</dd>
            <dt>Максимум событий в отчёте</dt>
            <dd>{safeText(system.report_limits?.max_timeline_events)}</dd>
          </dl>
        )}
      </section>
      <section className="card" aria-labelledby="timeline-title">
        <h3 id="timeline-title">События диагностики</h3>
        <div
          className="diagnostics-export"
          aria-labelledby="diagnostics-export-title"
        >
          <h4 id="diagnostics-export-title">Экспорт диагностики</h4>
          <p className="muted">
            Markdown-отчёт может включать безопасные события PWA, API и фоновой
            обработки согласно выбранным фильтрам. Аудит безопасности остаётся
            отдельным разделом и в этот отчёт не входит.
          </p>
          <button type="button" className="secondary" onClick={exportReport}>
            Скачать Markdown
          </button>
          {exportState && <p role="status">{exportState}</p>}
        </div>
        <form className="diagnostics-filters" onSubmit={applyFilters}>
          <label>
            Период
            <select value={filters.days} onChange={updateFilter("days")}>
              <option value="1">1 день</option>
              <option value="3">3 дня</option>
              <option value="7">7 дней</option>
            </select>
          </label>
          <label>
            Уровень
            <select value={filters.level} onChange={updateFilter("level")}>
              <option value="">Все</option>
              <option value="ERROR">Ошибка</option>
              <option value="WARNING">Предупреждение</option>
              <option value="INFO">Информация</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </label>
          <label>
            Компонент
            <select
              value={filters.component}
              onChange={updateFilter("component")}
            >
              <option value="">Все</option>
              <option value="web">Веб</option>
              <option value="api">API</option>
              <option value="worker">Фоновая обработка</option>
            </select>
          </label>
          <label>
            Код события
            <input
              value={filters.eventCode}
              onChange={updateFilter("eventCode")}
              placeholder="Например JOB_CREATED"
            />
          </label>
          <label>
            Проект
            <input
              value={filters.projectId}
              onChange={updateFilter("projectId")}
              placeholder="необязательно"
            />
          </label>
          <label>
            Задача
            <input
              value={filters.jobId}
              onChange={updateFilter("jobId")}
              placeholder="необязательно"
            />
          </label>
          <button type="submit">Применить фильтры</button>
        </form>
        {period && (
          <p className="muted">
            Период: {formatTime(period.start)} — {formatTime(period.end)}
          </p>
        )}
        {eventsState === "loading" && timeline.length === 0 && (
          <p role="status">Загружаем события…</p>
        )}
        {eventsState === "error" && (
          <div className="error">
            <p>Не удалось загрузить события.</p>
            <button type="button" onClick={() => loadEvents()}>
              Повторить
            </button>
          </div>
        )}
        {eventsState === "ready" && timeline.length === 0 && (
          <p className="notice">За выбранный период событий нет.</p>
        )}
        <ul className="diagnostics-events">
          {timeline.map((event) => (
            <li key={event.id} className="diagnostics-event">
              <div className="diagnostics-event-header">
                <strong>{event.event_code}</strong>
                {pwaEventLabel(event.event_code) && (
                  <span className="pwa-event-label">
                    {pwaEventLabel(event.event_code)}
                  </span>
                )}
                <span>·</span>
                <span>{diagnosticsLevelLabel(event.level)}</span>
                <span>·</span>
                <span>{diagnosticsComponentLabel(event.component)}</span>
                <span>·</span>
                <time dateTime={event.occurred_at}>
                  {formatTime(event.occurred_at)}
                </time>
                <span>·</span>
                <span>повторов: {event.occurrence_count ?? 1}</span>
              </div>
              {event.metadata && (
                <dl className="diagnostics-metadata">
                  {Object.entries(event.metadata)
                    .filter(([key]) => diagnosticsMetadataKeys.has(key))
                    .slice(0, 8)
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>
                          <span>{safeText(key)}</span>
                          {diagnosticsMetadataLabel(key) && (
                            <span className="metadata-local-label">
                              {" "}
                              · {diagnosticsMetadataLabel(key)}
                            </span>
                          )}
                        </dt>
                        <dd>{safeText(value)}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
        {nextCursor && (
          <button type="button" onClick={() => loadEvents(nextCursor)}>
            Показать ещё
          </button>
        )}
      </section>
      <section
        className="card pwa-diagnostics-card"
        aria-labelledby="pwa-diagnostics-title"
      >
        <h3 id="pwa-diagnostics-title">Диагностика PWA</h3>
        <p className="notice">
          Сбор DEBUG пока не включён по умолчанию. Браузер отправляет только
          закрытые безопасные события: ошибки приложения, необработанные
          операции, ошибки API, разделов и сервис-воркера.
        </p>
        {debugState === "loading" && <p role="status">Проверяем DEBUG…</p>}
        {debugState === "error" && (
          <div className="error">
            <p>Не удалось загрузить статус DEBUG.</p>
            <button type="button" onClick={() => loadDebugSession()}>
              Повторить
            </button>
          </div>
        )}
        {debugState === "ready" && activeDebugSession ? (
          <div className="debug-panel debug-active" role="status">
            <strong>DEBUG активна</strong>
            <p>Начало: {formatTime(activeDebugSession.started_at ?? null)}</p>
            <p>Истекает: {formatTime(activeDebugSession.expires_at ?? null)}</p>
            <p className="debug-countdown">
              Осталось: {debugRemainingText(activeDebugSession.expires_at)}
            </p>
            <button
              type="button"
              className="danger"
              disabled={debugActionState.endsWith("…")}
              onClick={stopDebug}
            >
              Остановить DEBUG
            </button>
          </div>
        ) : debugState === "ready" ? (
          <div className="debug-panel" role="status">
            <strong>DEBUG не активна</strong>
            <p className="muted">
              DEBUG временная, серверная и автоматически истекает. Браузер не
              продлевает срок.
            </p>
            <label className="debug-duration-label">
              Длительность DEBUG
              <select
                value={debugDuration}
                onChange={(event) => setDebugDuration(event.target.value)}
              >
                <option value="5">5 минут</option>
                <option value="10">10 минут</option>
                <option value="15">15 минут</option>
                <option value="30">30 минут</option>
              </select>
            </label>
            <button
              type="button"
              className="primary"
              disabled={debugActionState.endsWith("…")}
              onClick={startDebug}
            >
              Включить DEBUG
            </button>
          </div>
        ) : null}
        {debugActionState && (
          <p
            role="status"
            className={
              debugActionState.includes("Не удалось") ? "error" : "muted"
            }
          >
            {debugActionState}
          </p>
        )}
      </section>
      <section
        className="card security-log"
        aria-labelledby="security-audit-title"
      >
        <h3 id="security-audit-title">Аудит безопасности</h3>
        <p className="muted">Аудит отделён от диагностики транскрибации.</p>
        <ul>
          {auditEvents
            .filter((e) => e.type !== "auth.csrf_refreshed")
            .slice(0, 20)
            .map((e) => (
              <li key={e.id}>
                {auditLabel(e.type)} · {formatTime(e.created_at)}
              </li>
            ))}
        </ul>
        {auditEvents.length === 0 && (
          <p className="notice">Событий аудита нет.</p>
        )}
      </section>
    </div>
  );
}
function PlatformShell() {
  const [oauthResult] = useState<GoogleOauthResult | null>(() =>
    consumeGoogleOauthResult(),
  );
  const [maintenanceOauthResult] =
    useState<GoogleMaintenanceOauthResult | null>(() =>
      consumeGoogleMaintenanceOauthResult(),
    );
  const initialRoute = parsePlatformRoute();
  const [route, setRoute] = useState<PlatformRoute>(() =>
    (oauthResult || maintenanceOauthResult) &&
    initialRoute.page === "dashboard"
      ? { page: "settings", settingsSection: "account" }
      : initialRoute,
  );
  const page = route.page;
  const settingsSection = route.settingsSection;
  const [requestedProjectId, setRequestedProjectId] = useState<string | null>(
    null,
  );
  const [requestedProjectsView, setRequestedProjectsView] = useState<
    ProjectsViewRequest
  >(null);
  const [projectsOpened, setProjectsOpened] = useState(false);
  const credentialMutationGenerationRef = useRef(0);
  const activeCredentialMutationsRef = useRef(
    new Map<string, CredentialMutationOperation>(),
  );
  const [credentialMutations, setCredentialMutations] = useState<
    CredentialMutationOperation[]
  >([]);
  const [credentialMutationNotices, setCredentialMutationNotices] = useState<
    Record<string, CredentialMutationNotice>
  >({});
  const publishCredentialMutations = () =>
    setCredentialMutations(
      Array.from(activeCredentialMutationsRef.current.values()),
    );
  const beginCredentialMutation = (
    kind: CredentialMutationKind,
    credentialId: string | null,
  ): CredentialMutationOperation | null => {
    const key = credentialId ?? "create";
    if (activeCredentialMutationsRef.current.has(key)) return null;
    const operation: CredentialMutationOperation = {
      kind,
      credentialId,
      generation: credentialMutationGenerationRef.current,
    };
    activeCredentialMutationsRef.current.set(key, operation);
    publishCredentialMutations();
    setCredentialMutationNotices((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    return operation;
  };
  const finishCredentialMutation = (
    operation: CredentialMutationOperation,
    notice?: CredentialMutationNotice,
  ) => {
    const key = credentialMutationKey(operation);
    const activeOperation = activeCredentialMutationsRef.current.get(key);
    if (
      !activeOperation ||
      !credentialMutationOperationMatches(activeOperation, operation)
    ) {
      return;
    }
    activeCredentialMutationsRef.current.delete(key);
    publishCredentialMutations();
    if (notice) {
      setCredentialMutationNotices((current) => ({
        ...current,
        [key]: notice,
      }));
    }
  };
  const clearCredentialMutationSession = () => {
    credentialMutationGenerationRef.current += 1;
    activeCredentialMutationsRef.current.clear();
    setCredentialMutations([]);
    setCredentialMutationNotices({});
  };  const retentionMutationGenerationRef = useRef(0);
  const activeRetentionMutationRef = useRef<RetentionMutationOperation | null>(
    null,
  );
  const [retentionMutation, setRetentionMutation] =
    useState<RetentionMutationOperation | null>(null);
  const [retentionMutationNotice, setRetentionMutationNotice] =
    useState<RetentionMutationNotice | null>(null);
  const beginRetentionMutation = (): RetentionMutationOperation | null => {
    if (activeRetentionMutationRef.current) return null;
    const operation = {
      generation: retentionMutationGenerationRef.current,
    };
    activeRetentionMutationRef.current = operation;
    setRetentionMutation(operation);
    setRetentionMutationNotice(null);
    return operation;
  };
  const finishRetentionMutation = (
    operation: RetentionMutationOperation,
    notice?: RetentionMutationNotice,
  ) => {
    if (activeRetentionMutationRef.current !== operation) return;
    activeRetentionMutationRef.current = null;
    setRetentionMutation(null);
    if (notice) setRetentionMutationNotice(notice);
  };
  const acknowledgeRetentionMutationRefresh = () => {
    setRetentionMutationNotice((current) =>
      current?.refreshOnMount
        ? { ...current, refreshOnMount: false }
        : current,
    );
  };
  const clearRetentionMutationSession = () => {
    retentionMutationGenerationRef.current += 1;
    activeRetentionMutationRef.current = null;
    setRetentionMutation(null);
    setRetentionMutationNotice(null);
  };
  const googleConnectionMutationGenerationRef = useRef(0);
  const activeGoogleConnectionMutationRef =
    useRef<GoogleConnectionMutationOperation | null>(null);
  const [googleConnectionMutation, setGoogleConnectionMutation] =
    useState<GoogleConnectionMutationOperation | null>(null);
  const [googleConnectionMutationNotice, setGoogleConnectionMutationNotice] =
    useState<GoogleConnectionMutationNotice | null>(null);
  const beginGoogleConnectionMutation = (
    kind: GoogleConnectionMutationKind,
  ): GoogleConnectionMutationOperation | null => {
    if (activeGoogleConnectionMutationRef.current) return null;
    const operation = {
      kind,
      generation: googleConnectionMutationGenerationRef.current,
    };
    activeGoogleConnectionMutationRef.current = operation;
    setGoogleConnectionMutation(operation);
    setGoogleConnectionMutationNotice(null);
    return operation;
  };
  const finishGoogleConnectionMutation = (
    operation: GoogleConnectionMutationOperation,
    notice?: GoogleConnectionMutationNotice,
  ) => {
    if (activeGoogleConnectionMutationRef.current !== operation) return;
    activeGoogleConnectionMutationRef.current = null;
    setGoogleConnectionMutation(null);
    if (notice) setGoogleConnectionMutationNotice(notice);
  };
  const isGoogleConnectionMutationActive = (
    operation: GoogleConnectionMutationOperation,
  ) => activeGoogleConnectionMutationRef.current === operation;
  const acknowledgeGoogleConnectionMutationRefresh = () => {
    setGoogleConnectionMutationNotice((current) =>
      current?.refreshOnMount
        ? { ...current, refreshOnMount: false }
        : current,
    );
  };
  const clearGoogleConnectionMutationSession = () => {
    googleConnectionMutationGenerationRef.current += 1;
    activeGoogleConnectionMutationRef.current = null;
    setGoogleConnectionMutation(null);
    setGoogleConnectionMutationNotice(null);
  };
  const clearSettingsMutationSession = () => {
    clearCredentialMutationSession();
    clearRetentionMutationSession();
    clearGoogleConnectionMutationSession();
  };
  const navigate = (
    nextPage: Page,
    nextSettingsSection: SettingsSection = "account",
  ) => {
    if (nextPage === "projects") setProjectsOpened(true);
    const nextRoute = {
      page: nextPage,
      settingsSection:
        nextPage === "settings" ? nextSettingsSection : "account",
    };
    setRoute(nextRoute);
    pushPlatformRoute(nextRoute.page, nextRoute.settingsSection);
  };
  useEffect(() => {
    const handler = () => navigate("settings");
    window.addEventListener("studio:navigate-settings", handler);
    return () =>
      window.removeEventListener("studio:navigate-settings", handler);
  }, []);
  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = parsePlatformRoute();
      if (nextRoute.page === "projects") setProjectsOpened(true);
      setRoute(nextRoute);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    if (page === "projects") setProjectsOpened(true);
  }, [page]);
  const [session, setSession] = useState<SessionBootstrapState>({
    status: "checking",
    user: null,
    csrf: "",
    error: "",
  });
  const checkSession = () => {
    setSession({ status: "checking", user: null, csrf: "", error: "" });
    bootstrapSession()
      .then((result) => {
        if (!result) {
          setSession({ status: "anonymous", user: null, csrf: "", error: "" });
          return;
        }
        setSession({
          status: "authenticated",
          user: result.user,
          csrf: result.csrf,
          error: "",
        });
        updatePwaDiagnosticsCsrf(result.csrf);
        configurePwaDiagnosticsDebugState({ active: false });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setSession({ status: "anonymous", user: null, csrf: "", error: "" });
          return;
        }
        setSession({
          status: "error",
          user: null,
          csrf: "",
          error: "Не удалось проверить сессию. Повторите попытку.",
        });
      });
  };
  useEffect(checkSession, []);
  if (session.status === "checking")
    return (
      <main className="auth">
        <section className="card">
          <p role="status">Проверяем сессию…</p>
        </section>
      </main>
    );
  if (session.status === "error")
    return (
      <main className="auth">
        <section className="card">
          <p className="error">{session.error}</p>
          <button type="button" className="primary" onClick={checkSession}>
            Повторить
          </button>
        </section>
      </main>
    );
  if (session.status === "anonymous" || !session.user)
    return (
      <Login
        onLogin={(u, t) => {
          clearSettingsMutationSession();
          setSession({ status: "authenticated", user: u, csrf: t, error: "" });
          updatePwaDiagnosticsCsrf(t);
          configurePwaDiagnosticsDebugState({ active: false });
          navigate("dashboard");
        }}
      />
    );
  const user = session.user;
  const csrf = session.csrf;
  const logout = async () => {
    let token = csrf;
    if (!token) {
      const refreshed = await requestJson<{ csrf_token: string }>(
        "/auth/csrf",
        {
          method: "POST",
        },
      );
      token = refreshed.csrf_token;
      setSession((current) => ({ ...current, csrf: token }));
      updatePwaDiagnosticsCsrf(token);
      configurePwaDiagnosticsDebugState({ active: false });
    }
    await api("/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": token },
    }).catch(() => undefined);
    navigate("dashboard");
    clearSettingsMutationSession();
    setSession({ status: "anonymous", user: null, csrf: "", error: "" });
    clearPwaDiagnosticsSession();
  };
  return (
    <div className="shell">
      <PlatformSidebar
        page={page}
        onNavigate={(nextPage) => {
          navigate(nextPage);
          if (nextPage === "projects") {
            setRequestedProjectId(null);
            setRequestedProjectsView("browse");
          }
        }}
      />
      <main>
        {page === "dashboard" && (
          <OverviewPage
            onNavigate={(nextPage) => {
              if (nextPage === "projects") {
                setRequestedProjectId(null);
                setRequestedProjectsView("browse");
              }
              navigate(nextPage);
            }}
            onCreateProject={() => {
              setRequestedProjectsView("create");
              setRequestedProjectId(null);
              navigate("projects");
            }}
            onOpenProject={(projectId) => {
              setRequestedProjectsView("browse");
              setRequestedProjectId(projectId);
              navigate("projects");
            }}
          />
        )}
        {projectsOpened && (
          <div hidden={page !== "projects"}>
            <ProjectsPage
              active={page === "projects"}
              csrf={csrf}
              onCsrf={(token) => {
                setSession((current) => ({ ...current, csrf: token }));
                updatePwaDiagnosticsCsrf(token);
              }}
              requestedProjectId={requestedProjectId}
              onRequestedProjectHandled={() => setRequestedProjectId(null)}
              requestedProjectsView={requestedProjectsView}
              onRequestedProjectsViewHandled={() =>
                setRequestedProjectsView(null)
              }
            />
          </div>
        )}
        {page === "settings" && (
          <SettingsPage
            user={user}
            csrf={csrf}
            onCsrf={(token) => {
              setSession((current) => ({ ...current, csrf: token }));
              updatePwaDiagnosticsCsrf(token);
            }}
            onLogout={logout}
            oauthResult={oauthResult}
            maintenanceOauthResult={maintenanceOauthResult}
            credentialMutations={credentialMutations}
            credentialMutationNotices={credentialMutationNotices}
            beginCredentialMutation={beginCredentialMutation}
            finishCredentialMutation={finishCredentialMutation}
            retentionMutation={retentionMutation}
            retentionMutationNotice={retentionMutationNotice}
            beginRetentionMutation={beginRetentionMutation}
            finishRetentionMutation={finishRetentionMutation}
            acknowledgeRetentionMutationRefresh={
              acknowledgeRetentionMutationRefresh
            }
            googleConnectionMutation={googleConnectionMutation}
            googleConnectionMutationNotice={googleConnectionMutationNotice}
            beginGoogleConnectionMutation={beginGoogleConnectionMutation}
            finishGoogleConnectionMutation={finishGoogleConnectionMutation}
            isGoogleConnectionMutationActive={isGoogleConnectionMutationActive}
            acknowledgeGoogleConnectionMutationRefresh={
              acknowledgeGoogleConnectionMutationRefresh
            }
            section={settingsSection}
            onSectionChange={(section) => navigate("settings", section)}
          />
        )}
      </main>
    </div>
  );
}
export default function App() {
  return <PlatformShell />;
}
