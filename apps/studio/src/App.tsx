import {
  ChangeEvent,
  FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
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
  responseWithCsrfRetry,
} from "./apiClient";
import {
  cancelLatestRequests,
  LATEST_REQUEST_CANCEL_REASON,
  settleLatestRequest,
} from "./latestRequest";
import {
  parsePlatformRoute,
  pushPlatformRoute,
  type Page,
  type PlatformRoute,
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
  DirectUploadAmbiguousError,
  directUploadTimeoutMs,
  isSafeDirectUploadCapability,
  uploadFileWithProgress,
  type DirectUploadProgress,
} from "./directUpload";
import {
  isUsableJobSource,
  reconcileOptimisticSources,
  sourceСтатусLabel,
  type Source,
} from "./sourceModel";
import { isSafeDisplayUrl, ResourceExternalLink } from "./resourceLinks";
import {
  SourcesPanel,
  type SourceDeletionNotice,
} from "./SourcesPanel";
import { JobCard } from "./JobCard";
import { Login } from "./Login";
import {
  parseAuthenticatedSessionResponse,
  parseCsrfResponse,
  parseLogoutResponse,
  type User,
} from "./authContracts";
import {
  requestCredentialCollection,
  type Credential,
} from "./credentialContracts";
import {
  parseJobDetailResponse,
  parseJobSummaryResponse,
  requestJobDetail,
  requestJobOutputs,
  requestProjectJobPage,
  requestProjectSourcePage,
} from "./projectCollectionContracts";
import { PlatformSidebar } from "./PlatformSidebar";
import { AudioPreparationPage } from "./AudioPreparationPage";
import { appendUniqueItems } from "./collectionPageModel";
import {
  isApprovedOutputUrl,
  type JobDetailState,
  type JobOutputsResponse,
  type JobOutputsState,
  type JobState,
  type TranscriptionJob,
  type TranscriptionLanguageMode,
  transcriptionLanguageModeLabel,
} from "./jobModel";
import {
  DEFAULT_TRANSCRIPTION_LANGUAGE_MODE,
  MAX_BATCH_ITEMS,
  clearComposerReprocessDecisions,
  composerSegmentPlanIssue,
  composerSignature,
  buildBatchCreateRequest,
  expandComposerRows,
  formatSegmentBoundary,
  makeIdempotencyKey,
  mergeJobsWithBatchOrder,
  newComposerRow,
  parseBatchPreflightResponse,
  resizeComposerSegments,
  type BatchCreateRequest,
  type BatchCreateResponse,
  type BatchPreflightResponse,
  type ComposerRow,
  type ComposerSegment,
  type VerifiedOutputFolder,
} from "./batchComposerModel";
import {
  parseJobRetryResponse,
  parseOutputReconciliationCheckResponse,
  parseOutputReconciliationResponse,
  type JobRetryResponse,
  type JobRetryState,
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
import {
  groupTranscriptionPresentations,
  type TranscriptionPresentation,
} from "./multiTranscriptionModel";
import { MultiTranscriptionCard } from "./MultiTranscriptionCard";
import { TranscriptionAnalyticsPanel } from "./TranscriptionAnalyticsPanel";
import { TranscriptCatalogMigrationPanel } from "./TranscriptCatalogMigrationPanel";
import { LiveTranscriptionPanel } from "./LiveTranscriptionPanel";
import { ConfirmClearDialog } from "./ConfirmClearDialog";
import { FolderImportDialog } from "./FolderImportDialog";
import { AccountSessionsPanel } from "./AccountSessionsPanel";
import {
  buildLocalFolderPreview,
  localFolderRejectedReasonLabel,
  type LocalFolderRejectedFile,
  type LocalFolderPreview,
} from "./folderIntakeModel";
import {
  driveFolderBlockedMessage,
  driveFolderSkipReasonLabel,
  parseDriveFolderPreview,
  type DriveFolderPreview,
  type DriveFolderSkippedItem,
} from "./driveFolderIntakeModel";
import {
  applyStudioAccentColor,
  isStudioAccentColor,
  readStudioThemePreference,
  setStudioThemePreference,
  STUDIO_ACCENT_COLORS,
  type StudioAccentColor,
  type StudioThemePreference,
} from "./theme";
import "./styles.css";

const SOURCE_RETENTION_TTL_OPTIONS_SECONDS = [
  3600, 86400, 259200, 604800, 2592000,
] as const;
type AccountPreferences = {
  source_retention_ttl_seconds: number;
  allowed_source_retention_ttl_seconds: number[];
  accent_color: StudioAccentColor;
  allowed_accent_colors: StudioAccentColor[];
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
    ) &&
    isStudioAccentColor(preferences.accent_color) &&
    Array.isArray(preferences.allowed_accent_colors) &&
    preferences.allowed_accent_colors.length === STUDIO_ACCENT_COLORS.length &&
    preferences.allowed_accent_colors.every(
      (color, index) => color === STUDIO_ACCENT_COLORS[index],
    ) &&
    preferences.allowed_accent_colors.includes(preferences.accent_color)
  );
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
type AuditPage = {
  items: Audit[];
  nextCursor: string | null;
  pageSize: number;
};
function parseAuditCollection(candidate: unknown): AuditPage | null {
  if (!candidate || typeof candidate !== "object") return null;
  const rawEvents = (candidate as { events?: unknown }).events;
  if (!Array.isArray(rawEvents) || rawEvents.length > 50) return null;
  const events: Audit[] = [];
  for (const rawEvent of rawEvents) {
    if (!rawEvent || typeof rawEvent !== "object") return null;
    const event = rawEvent as Record<string, unknown>;
    if (
      typeof event.id !== "string" ||
      event.id.length === 0 ||
      event.id.length > 36 ||
      typeof event.type !== "string" ||
      event.type.length === 0 ||
      event.type.length > 80 ||
      typeof event.created_at !== "string" ||
      !Number.isFinite(Date.parse(event.created_at))
    ) {
      return null;
    }
    events.push({
      id: event.id,
      type: event.type,
      created_at: event.created_at,
    });
  }
  if (new Set(events.map((event) => event.id)).size !== events.length) {
    return null;
  }
  const rawCursor = (candidate as { next_cursor?: unknown }).next_cursor;
  const rawPageSize = (candidate as { page_size?: unknown }).page_size;
  const nextCursor = rawCursor === undefined ? null : rawCursor;
  const pageSize = rawPageSize === undefined ? 50 : rawPageSize;
  if (
    !Number.isSafeInteger(pageSize) ||
    (pageSize as number) < 1 ||
    (pageSize as number) > 100 ||
    events.length > (pageSize as number) ||
    (nextCursor !== null &&
      (typeof nextCursor !== "string" ||
        nextCursor.length === 0 ||
        nextCursor.length > 1_200 ||
        !/^[A-Za-z0-9_-]+$/.test(nextCursor) ||
        events.length !== pageSize))
  ) {
    return null;
  }
  return { items: events, nextCursor, pageSize: pageSize as number };
}
async function requestAuditCollection(
  signal?: AbortSignal,
  cursor: string | null = null,
): Promise<AuditPage> {
  if (!cursor) {
    const candidate = await api<unknown>("/audit-events", {
      signal,
      ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
    });
    const page = parseAuditCollection(candidate);
    if (page === null) throw new Error("invalid_audit_events_response");
    return page;
  }
  const search = new URLSearchParams({ page_size: "50" });
  search.set("cursor", cursor);
  const candidate = await api<unknown>(`/audit-events?${search.toString()}`, {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const page = parseAuditCollection(candidate);
  if (page === null) throw new Error("invalid_audit_events_response");
  return page;
}
type DiagnosticsSystem = {
  environment?: string;
  pwa_mode?: string;
  release_version?: string;
  schema_revision?: string;
  build?: { web?: string; api?: string; worker?: string };
  components?: Record<"web" | "api" | "worker", {
    status?: string;
    release_version?: string;
    build_id?: string;
    commit_sha?: string;
    heartbeat_age_seconds?: number;
  }>;
  health?: {
    backend?: string;
    database?: string;
    queue?: { status?: string; queued?: number; processing?: number; oldest_queued_age_seconds?: number };
    worker?: { status?: string };
    object_storage?: { status?: string; probe?: string };
    stt_provider?: { status?: string; availability?: string; probe?: string; configured_credentials?: number };
  };
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
function isDiagnosticsRecord(
  candidate: unknown,
): candidate is Record<string, unknown> {
  return Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate);
}
function hasOptionalDiagnosticsString(
  record: Record<string, unknown>,
  key: string,
) {
  return (
    record[key] === undefined ||
    (typeof record[key] === "string" && (record[key] as string).length <= 120)
  );
}
function hasOptionalDiagnosticsBoolean(
  record: Record<string, unknown>,
  key: string,
) {
  return record[key] === undefined || typeof record[key] === "boolean";
}
function hasOptionalDiagnosticsCount(
  record: Record<string, unknown>,
  key: string,
) {
  return (
    record[key] === undefined ||
    (Number.isInteger(record[key]) && (record[key] as number) >= 0)
  );
}
function parseDiagnosticsSystem(candidate: unknown): DiagnosticsSystem | null {
  if (!isDiagnosticsRecord(candidate)) return null;
  const build = candidate.build;
  const googleDrive = candidate.google_drive;
  const credentials = candidate.provider_credentials;
  const diagnostics = candidate.diagnostics;
  const reportLimits = candidate.report_limits;
  const components = candidate.components;
  const health = candidate.health;
  if (
    !isDiagnosticsRecord(build) ||
    !isDiagnosticsRecord(googleDrive) ||
    !isDiagnosticsRecord(credentials) ||
    !isDiagnosticsRecord(diagnostics) ||
    !isDiagnosticsRecord(reportLimits) ||
    !hasOptionalDiagnosticsString(candidate, "environment") ||
    !hasOptionalDiagnosticsString(candidate, "pwa_mode") ||
    !hasOptionalDiagnosticsString(candidate, "release_version") ||
    !hasOptionalDiagnosticsString(candidate, "schema_revision") ||
    !["web", "api", "worker"].every((key) =>
      hasOptionalDiagnosticsString(build, key),
    ) ||
    !["connected", "scope_ready"].every((key) =>
      hasOptionalDiagnosticsBoolean(googleDrive, key),
    ) ||
    !hasOptionalDiagnosticsCount(credentials, "active_count") ||
    !hasOptionalDiagnosticsBoolean(credentials, "ready") ||
    !hasOptionalDiagnosticsBoolean(diagnostics, "recording_enabled") ||
    !hasOptionalDiagnosticsString(diagnostics, "debug_recording") ||
    !hasOptionalDiagnosticsCount(diagnostics, "retention_days") ||
    !hasOptionalDiagnosticsCount(diagnostics, "debug_retention_hours") ||
    !hasOptionalDiagnosticsCount(reportLimits, "max_days") ||
    !hasOptionalDiagnosticsCount(reportLimits, "max_timeline_events")
  ) {
    return null;
  }
  if (components !== undefined) {
    if (!isDiagnosticsRecord(components)) return null;
    for (const component of ["web", "api", "worker"] as const) {
      const value = components[component];
      if (
        !isDiagnosticsRecord(value) ||
        !["status", "release_version", "build_id", "commit_sha"].every((key) =>
          hasOptionalDiagnosticsString(value, key),
        ) ||
        !hasOptionalDiagnosticsCount(value, "heartbeat_age_seconds")
      ) return null;
    }
  }
  if (health !== undefined) {
    if (!isDiagnosticsRecord(health)) return null;
    const queue = health.queue;
    const worker = health.worker;
    const storage = health.object_storage;
    const provider = health.stt_provider;
    if (
      !hasOptionalDiagnosticsString(health, "backend") ||
      !hasOptionalDiagnosticsString(health, "database") ||
      !isDiagnosticsRecord(queue) ||
      !isDiagnosticsRecord(worker) ||
      !isDiagnosticsRecord(storage) ||
      !isDiagnosticsRecord(provider) ||
      !hasOptionalDiagnosticsString(queue, "status") ||
      !hasOptionalDiagnosticsCount(queue, "queued") ||
      !hasOptionalDiagnosticsCount(queue, "processing") ||
      !hasOptionalDiagnosticsCount(queue, "oldest_queued_age_seconds") ||
      !hasOptionalDiagnosticsString(worker, "status") ||
      !hasOptionalDiagnosticsString(storage, "status") ||
      !hasOptionalDiagnosticsString(storage, "probe") ||
      !hasOptionalDiagnosticsString(provider, "status") ||
      !hasOptionalDiagnosticsString(provider, "availability") ||
      !hasOptionalDiagnosticsString(provider, "probe") ||
      !hasOptionalDiagnosticsCount(provider, "configured_credentials")
    ) return null;
  }
  return {
    environment: candidate.environment as string | undefined,
    pwa_mode: candidate.pwa_mode as string | undefined,
    release_version: candidate.release_version as string | undefined,
    schema_revision: candidate.schema_revision as string | undefined,
    build: {
      web: build.web as string | undefined,
      api: build.api as string | undefined,
      worker: build.worker as string | undefined,
    },
    components: components as DiagnosticsSystem["components"],
    health: health as DiagnosticsSystem["health"],
    google_drive: {
      connected: googleDrive.connected as boolean | undefined,
      scope_ready: googleDrive.scope_ready as boolean | undefined,
    },
    provider_credentials: {
      active_count: credentials.active_count as number | undefined,
      ready: credentials.ready as boolean | undefined,
    },
    diagnostics: {
      recording_enabled: diagnostics.recording_enabled as boolean | undefined,
      debug_recording: diagnostics.debug_recording as string | undefined,
      retention_days: diagnostics.retention_days as number | undefined,
      debug_retention_hours: diagnostics.debug_retention_hours as
        | number
        | undefined,
    },
    report_limits: {
      max_days: reportLimits.max_days as number | undefined,
      max_timeline_events: reportLimits.max_timeline_events as
        | number
        | undefined,
    },
  };
}
function parseDiagnosticsEvent(candidate: unknown): DiagnosticsEvent | null {
  if (!isDiagnosticsRecord(candidate)) return null;
  const occurredAt =
    typeof candidate.occurred_at === "string"
      ? Date.parse(candidate.occurred_at)
      : Number.NaN;
  const occurrenceCount = candidate.occurrence_count;
  if (
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    candidate.id.length > 128 ||
    !Number.isFinite(occurredAt) ||
    !["ERROR", "WARNING", "INFO", "DEBUG"].includes(
      String(candidate.level),
    ) ||
    !["web", "api", "worker"].includes(String(candidate.component)) ||
    typeof candidate.event_code !== "string" ||
    candidate.event_code.length === 0 ||
    candidate.event_code.length > 80 ||
    (occurrenceCount !== undefined &&
      (!Number.isInteger(occurrenceCount) || (occurrenceCount as number) < 1)) ||
    (candidate.metadata !== undefined &&
      !isDiagnosticsRecord(candidate.metadata))
  ) {
    return null;
  }
  const metadata: Record<string, string | number | boolean | null> = {};
  if (isDiagnosticsRecord(candidate.metadata)) {
    for (const [key, value] of Object.entries(candidate.metadata)) {
      if (!diagnosticsMetadataKeys.has(key)) continue;
      if (
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
      ) {
        return null;
      }
      if (typeof value === "string" && value.length > 120) return null;
      if (typeof value === "number" && !Number.isFinite(value)) return null;
      metadata[key] = value;
    }
  }
  return {
    id: candidate.id,
    occurred_at: candidate.occurred_at as string,
    level: candidate.level as DiagnosticsEvent["level"],
    component: candidate.component as DiagnosticsEvent["component"],
    event_code: candidate.event_code,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(occurrenceCount === undefined
      ? {}
      : { occurrence_count: occurrenceCount as number }),
  };
}
function parseDiagnosticsEventsResponse(
  candidate: unknown,
): DiagnosticsEventsResponse | null {
  if (
    !isDiagnosticsRecord(candidate) ||
    !Array.isArray(candidate.events) ||
    candidate.events.length > 25 ||
    !isDiagnosticsRecord(candidate.period) ||
    typeof candidate.period.start !== "string" ||
    typeof candidate.period.end !== "string" ||
    (candidate.next_cursor !== undefined &&
      candidate.next_cursor !== null &&
      (typeof candidate.next_cursor !== "string" ||
        candidate.next_cursor.length === 0 ||
        candidate.next_cursor.length > 1200))
  ) {
    return null;
  }
  const start = Date.parse(candidate.period.start);
  const end = Date.parse(candidate.period.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  const events: DiagnosticsEvent[] = [];
  const eventIds = new Set<string>();
  for (const rawEvent of candidate.events) {
    const event = parseDiagnosticsEvent(rawEvent);
    if (!event || eventIds.has(event.id)) return null;
    eventIds.add(event.id);
    events.push(event);
  }
  return {
    events,
    next_cursor: candidate.next_cursor as string | null | undefined,
    period: { start: candidate.period.start, end: candidate.period.end },
  };
}
async function requestDiagnosticsSystem(
  signal?: AbortSignal,
): Promise<DiagnosticsSystem> {
  const candidate = await api<unknown>("/diagnostics/system", {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const system = parseDiagnosticsSystem(candidate);
  if (!system) throw new Error("invalid_diagnostics_system_response");
  return system;
}
async function requestDiagnosticsEvents(
  query: string,
  signal?: AbortSignal,
): Promise<DiagnosticsEventsResponse> {
  const candidate = await api<unknown>(`/diagnostics/events?${query}`, {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const response = parseDiagnosticsEventsResponse(candidate);
  if (!response) throw new Error("invalid_diagnostics_events_response");
  return response;
}
type DiagnosticsDebugSession = {
  active: boolean;
  started_at?: string | null;
  expires_at?: string | null;
};
function parseDiagnosticsDebugSession(
  candidate: unknown,
): DiagnosticsDebugSession | null {
  if (!candidate || typeof candidate !== "object") return null;
  const response = candidate as Record<string, unknown>;
  if (typeof response.active !== "boolean") return null;
  if (!response.active) {
    return { active: false, started_at: null, expires_at: null };
  }
  if (
    typeof response.started_at !== "string" ||
    typeof response.expires_at !== "string"
  ) {
    return null;
  }
  const startedAt = Date.parse(response.started_at);
  const expiresAt = Date.parse(response.expires_at);
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= startedAt
  ) {
    return null;
  }
  return {
    active: true,
    started_at: response.started_at,
    expires_at: response.expires_at,
  };
}
async function requestDiagnosticsDebugSession(
  signal?: AbortSignal,
): Promise<DiagnosticsDebugSession> {
  const candidate = await api<unknown>("/diagnostics/debug-session", {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const status = parseDiagnosticsDebugSession(candidate);
  if (!status) throw new Error("invalid_diagnostics_debug_session_response");
  return status;
}
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
type ProjectPage = {
  items: Project[];
  nextCursor: string | null;
  pageSize: number;
};
function parseProjectCollection(candidate: unknown): ProjectPage | null {
  if (!candidate || typeof candidate !== "object") return null;
  const projects = (candidate as { projects?: unknown }).projects;
  if (!Array.isArray(projects) || !projects.every(isExpectedProject)) {
    return null;
  }
  if (new Set(projects.map((project) => project.id)).size !== projects.length) {
    return null;
  }
  const rawCursor = (candidate as { next_cursor?: unknown }).next_cursor;
  const rawPageSize = (candidate as { page_size?: unknown }).page_size;
  const nextCursor = rawCursor === undefined ? null : rawCursor;
  const pageSize = rawPageSize === undefined ? 50 : rawPageSize;
  if (
    !Number.isSafeInteger(pageSize) ||
    (pageSize as number) < 1 ||
    (pageSize as number) > 100 ||
    projects.length > (pageSize as number) ||
    (nextCursor !== null &&
      (typeof nextCursor !== "string" ||
        nextCursor.length === 0 ||
        nextCursor.length > 1_200 ||
        !/^[A-Za-z0-9_-]+$/.test(nextCursor) ||
        projects.length !== pageSize))
  ) {
    return null;
  }
  return { items: projects, nextCursor, pageSize: pageSize as number };
}
function parseTranscriptionWorkspace(candidate: unknown): Project | null {
  if (!candidate || typeof candidate !== "object") return null;
  const response = candidate as { project?: unknown; created?: unknown };
  if (
    typeof response.created !== "boolean" ||
    !isExpectedProject(response.project) ||
    response.project.archived_at !== null
  ) {
    return null;
  }
  return response.project;
}
async function requestProjectCollection(
  signal?: AbortSignal,
  cursor: string | null = null,
): Promise<ProjectPage> {
  if (!cursor) {
    const candidate = await api<unknown>("/projects", {
      signal,
      ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
    });
    const page = parseProjectCollection(candidate);
    if (page === null) throw new Error("invalid_projects_response");
    return page;
  }
  const search = new URLSearchParams({ page_size: "50" });
  search.set("cursor", cursor);
  const candidate = await api<unknown>(`/projects?${search.toString()}`, {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const page = parseProjectCollection(candidate);
  if (page === null) throw new Error("invalid_projects_response");
  return page;
}
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
type UploadProgressView = DirectUploadProgress & {
  filename: string;
  fileIndex: number;
  fileCount: number;
  aggregatePercent: number;
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
      scopes.length === 4 &&
      new Set(scopes).size === scopes.length &&
      scopes.includes("openid") &&
      scopes.includes("email") &&
      scopes.includes("https://www.googleapis.com/auth/drive.file") &&
      scopes.includes("https://www.googleapis.com/auth/drive.readonly")
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
  loadingMore: false,
  error: "",
  loaded: false,
  items: [] as Source[],
  nextCursor: null as string | null,
};
const emptyJobState: JobState = {
  loading: false,
  loadingMore: false,
  error: "",
  loaded: false,
  items: [],
  nextCursor: null,
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
type OutputFolderFavorite = {
  id: string;
  drive_folder_id: string;
  name: string;
  web_view_url: string;
  created_at: string;
  updated_at: string;
};
function parseOutputFolderFavorite(candidate: unknown): OutputFolderFavorite | null {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Partial<OutputFolderFavorite>;
  if (
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.drive_folder_id !== "string" ||
    !value.drive_folder_id ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    typeof value.web_view_url !== "string" ||
    !isApprovedOutputUrl(value.web_view_url) ||
    typeof value.created_at !== "string" ||
    !Number.isFinite(Date.parse(value.created_at)) ||
    typeof value.updated_at !== "string" ||
    !Number.isFinite(Date.parse(value.updated_at))
  ) {
    return null;
  }
  return value as OutputFolderFavorite;
}
function parseOutputFolderFavoriteCollection(candidate: unknown): OutputFolderFavorite[] | null {
  if (!candidate || typeof candidate !== "object") return null;
  const rows = (candidate as { favorites?: unknown }).favorites;
  if (!Array.isArray(rows)) return null;
  const parsed = rows.map(parseOutputFolderFavorite);
  if (parsed.some((row) => row === null)) return null;
  const favorites = parsed as OutputFolderFavorite[];
  return new Set(favorites.map((row) => row.id)).size === favorites.length &&
    new Set(favorites.map((row) => row.drive_folder_id)).size === favorites.length
    ? favorites
    : null;
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
    (source.source_created_at === null || source.source_created_at === undefined) &&
    (source.source_created_at_provenance === null ||
      source.source_created_at_provenance === undefined) &&
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
const TRANSCRIPTION_WORKSPACE_REQUEST_TIMEOUT_MS = 20_000;
const CREDENTIAL_COLLECTION_REQUEST_TIMEOUT_MS = 15_000;
const CREDENTIAL_MUTATION_REQUEST_TIMEOUT_MS = 20_000;
const ACCOUNT_PREFERENCES_REQUEST_TIMEOUT_MS = 15_000;
const SOURCE_UPLOAD_POLICY_REQUEST_TIMEOUT_MS = 15_000;
const SESSION_BOOTSTRAP_REQUEST_TIMEOUT_MS = 15_000;
const LOGOUT_REQUEST_TIMEOUT_MS = 20_000;
const DIAGNOSTICS_READ_REQUEST_TIMEOUT_MS = 15_000;
const DIAGNOSTICS_EXPORT_REQUEST_TIMEOUT_MS = 20_000;
const DIAGNOSTICS_DEBUG_REQUEST_TIMEOUT_MS = 15_000;
const DIAGNOSTICS_DEBUG_MUTATION_TIMEOUT_MS = 20_000;
const AUDIT_EVENT_REQUEST_TIMEOUT_MS = 15_000;
const ACCOUNT_PREFERENCES_MUTATION_TIMEOUT_MS = 20_000;
const GOOGLE_CONNECTION_REQUEST_TIMEOUT_MS = 15_000;
const GOOGLE_CONNECTION_MUTATION_TIMEOUT_MS = 20_000;
async function bootstrapSession(signal?: AbortSignal): Promise<{
  user: User;
  csrf: string;
}> {
  const sessionCandidate = await api<unknown>("/auth/session", {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const user = parseAuthenticatedSessionResponse(sessionCandidate);
  if (!user) throw new Error("invalid_auth_session_response");
  const csrfCandidate = await api<unknown>("/auth/csrf", {
    method: "POST",
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const csrf = parseCsrfResponse(csrfCandidate, user);
  if (!csrf) throw new Error("invalid_auth_csrf_response");
  return { user, csrf };
}
async function requestLogout(
  currentCsrf: string,
  user: User,
  signal?: AbortSignal,
): Promise<void> {
  let csrf = currentCsrf;
  if (!csrf) {
    const csrfCandidate = await api<unknown>("/auth/csrf", {
      method: "POST",
      signal,
      ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
    });
    const refreshedCsrf = parseCsrfResponse(csrfCandidate, user);
    if (!refreshedCsrf) throw new Error("invalid_logout_csrf_response");
    csrf = refreshedCsrf;
  }
  const responseCandidate = await api<unknown>("/auth/logout", {
    method: "POST",
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
    headers: { "x-csrf-token": csrf },
  });
  if (!parseLogoutResponse(responseCandidate)) {
    throw new Error("invalid_logout_response");
  }
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
async function requestJobRetryRead(jobId: string, signal?: AbortSignal) {
  const candidate = await api<unknown>(`/jobs/${jobId}/retry`, {
    signal,
    ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
  });
  const retry = parseJobRetryResponse(candidate, jobId);
  if (!retry) throw new Error("invalid_job_retry_response");
  return retry;
}
async function requestOutputReconciliationRead(
  jobId: string,
  signal?: AbortSignal,
) {
  const candidate = await api<unknown>(
    `/jobs/${jobId}/output-reconciliation`,
    {
      signal,
      ignoredAbortReason: LATEST_REQUEST_CANCEL_REASON,
    },
  );
  const reconciliation = parseOutputReconciliationResponse(candidate, jobId);
  if (!reconciliation) {
    throw new Error("invalid_output_reconciliation_response");
  }
  return reconciliation;
}
async function readAfterJobMutationTimeout<T>(
  request: (signal?: AbortSignal) => Promise<T>,
): Promise<T | null> {
  try {
    const result = await runBoundedRequest(request);
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
function navigateTabList<T extends string>(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  values: readonly T[],
  onSelect: (value: T) => void,
) {
  if (
    event.key !== "ArrowLeft" &&
    event.key !== "ArrowRight" &&
    event.key !== "ArrowUp" &&
    event.key !== "ArrowDown" &&
    event.key !== "Home" &&
    event.key !== "End"
  ) {
    return;
  }
  const tabs = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    ) ?? [],
  );
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0 || tabs.length !== values.length) return;
  event.preventDefault();
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? (currentIndex + 1) % tabs.length
          : (currentIndex - 1 + tabs.length) % tabs.length;
  tabs[nextIndex]?.focus();
  onSelect(values[nextIndex]);
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

type GooglePickerOperationKind = "sources" | "source-folder" | "folder:first";
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
  requestedSourceId,
  onRequestedSourceHandled,
  googleConnection,
  googleConnectionState,
  onReloadGoogleConnection,
  activeGooglePicker,
  googlePickerNotices,
  beginGooglePicker,
  finishGooglePicker,
  onLoadSources,
  onLoadMoreSources,
  onReloadSources,
  onReloadJobs,
  onLoadMoreJobs,
  pendingJobMutations,
  jobMutationNotices,
  beginJobMutation,
  finishJobMutation,
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
  requestedSourceId: string | null;
  onRequestedSourceHandled: () => void;
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
  onLoadMoreSources: (projectId: string, cursor: string) => void;
  onReloadSources: (projectId: string) => void;
  onReloadJobs: (projectId: string) => void;
  onLoadMoreJobs: (projectId: string, cursor: string) => void;
  pendingJobMutations: ReadonlySet<string>;
  jobMutationNotices: Readonly<Record<string, JobMutationNotice>>;
  beginJobMutation: (kind: JobMutationKind, jobId: string) => boolean;
  finishJobMutation: (
    kind: JobMutationKind,
    jobId: string,
    notice?: JobMutationNotice,
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
  const [folderFavorites, setFolderFavorites] = useState<OutputFolderFavorite[]>([]);
  const [folderFavoritesLoaded, setFolderFavoritesLoaded] = useState(false);
  const [folderFavoritesLoading, setFolderFavoritesLoading] = useState(false);
  const [folderFavoritesError, setFolderFavoritesError] = useState("");
  const [folderFavoriteMutation, setFolderFavoriteMutation] = useState<string | null>(null);
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
  const [historyClearOpen, setHistoryClearOpen] = useState(false);
  const [historyClearPending, setHistoryClearPending] = useState(false);
  const [historyClearMessage, setHistoryClearMessage] = useState("");
  const historyClearPendingRef = useRef(false);

  const [removedSourceIds, setRemovedSourceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [createdSources, setCreatedSources] = useState<Source[]>([]);
  const [rowIntakeStatus, setRowIntakeStatus] = useState<
    Record<string, string>
  >({});
  const [rowUploadProgress, setRowUploadProgress] = useState<
    Record<string, UploadProgressView | undefined>
  >({});
  const [rowIntakeErrors, setRowIntakeErrors] = useState<
    Record<string, string>
  >({});
  const [localFolderPreview, setLocalFolderPreview] = useState<{
    rowId: string;
    preview: LocalFolderPreview;
  } | null>(null);
  const [driveFolderPreview, setDriveFolderPreview] = useState<{
    rowId: string;
    preview: DriveFolderPreview;
  } | null>(null);
  const [driveFolderApplyPending, setDriveFolderApplyPending] = useState(false);
  const [recentlyAddedRow, setRecentlyAddedRow] = useState<{
    id: string;
    number: number;
  } | null>(null);
  const [rowAdditionStatus, setRowAdditionStatus] = useState("");
  const rowFolderPickerRef = useRef(false);
  const rowSourcePickerRef = useRef(false);
  const driveFolderApplyRef = useRef(false);
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
    setLocalFolderPreview(null);
    setDriveFolderPreview(null);
    setDriveFolderApplyPending(false);
    driveFolderApplyRef.current = false;
    setFolderFavorites([]);
    setFolderFavoritesLoaded(false);
    setFolderFavoritesLoading(false);
    setFolderFavoritesError("");
    setFolderFavoriteMutation(null);
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
      `Добавлена задача ${recentlyAddedRow.number}. Выберите источник.`,
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
  useEffect(() => {
    if (!sources.loaded || sources.loading || sources.error) return;
    setCreatedSources((current) => {
      const pending = reconcileOptimisticSources(current, sources.items);
      return pending.length === current.length ? current : pending;
    });
  }, [sources.loaded, sources.loading, sources.error, sources.items]);
  const sourceItems = [
    ...(Array.isArray(sources.items) ? sources.items : []),
    ...createdSources.filter(
      (created) => !sources.items.some((source) => source.id === created.id),
    ),
  ].filter((source) => !removedSourceIds.has(source.id));
  const usableSources = sourceItems.filter(isUsableJobSource);
  const usableSourceIds = new Set(usableSources.map((source) => source.id));
  useEffect(() => {
    if (!requestedSourceId || !sources.loaded) return;
    const requestedSource = usableSources.find(
      (source) => source.id === requestedSourceId,
    );
    if (!requestedSource) {
      setMessage(
        "Подготовленный результат больше недоступен. Выберите другой источник.",
      );
      onRequestedSourceHandled();
      return;
    }
    setRows((current) => {
      const emptyIndex = current.findIndex((row) => !row.source_id);
      if (emptyIndex >= 0) {
        return current.map((row, index) =>
          index === emptyIndex ? { ...row, source_id: requestedSourceId } : row,
        );
      }
      return [
        ...current,
        { ...newComposerRow(), source_id: requestedSourceId },
      ];
    });
    setMessage("Результат обработки добавлен в новую задачу транскрибации.");
    onRequestedSourceHandled();
  }, [requestedSourceId, sources.loaded]);
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
    let expanded;
    try {
      expanded = expandComposerRows([row]);
    } catch {
      return;
    }
    expanded.forEach(({ request_item: item }) => {
      const scope = [
        item.source_id,
        item.output_folder_id,
        item.media_clip_start_seconds ?? "full",
        item.media_clip_end_seconds ?? "end",
      ].join("\u0000");
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
      return { ready: false, reason: `Задача ${rowNumber}: выберите источник` };
    }
    if (!usableSourceIds.has(row.source_id)) {
      return {
        ready: false,
        reason: `Задача ${rowNumber}: выбранный файл больше недоступен`,
      };
    }
    if (!row.output_folder?.folder_id) {
      return {
        ready: false,
        reason: `Задача ${rowNumber}: выберите папку результата`,
      };
    }
    const segmentIssue = composerSegmentPlanIssue(row.segments);
    if (segmentIssue) {
      return {
        ready: false,
        reason: `Задача ${rowNumber}: ${segmentIssue}`,
      };
    }
    if (duplicateRowIds.has(row.id)) {
      return {
        ready: false,
        reason: `Задача ${rowNumber}: такой источник, папка и диапазон уже добавлены`,
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
    (count, row) => count + row.segments.length,
    0,
  );
  const batchLimitBlocker =
    plannedJobCount > MAX_BATCH_ITEMS
      ? `Один batch поддерживает не более ${MAX_BATCH_ITEMS} фрагментов`
      : "";
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
        ? "Добавьте хотя бы одну задачу"
        : batchLimitBlocker
          ? batchLimitBlocker
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
    plannedJobCount <= MAX_BATCH_ITEMS &&
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
      const sharedOutputFolder = target?.output_folder
        ? { ...target.output_folder }
        : null;
      const next = [...current];
      const [first, ...rest] = selected;
      const sourcesToAppend = canFillTarget ? rest : selected;
      if (canFillTarget && first) {
        next[targetIndex] = clearComposerReprocessDecisions({
          ...next[targetIndex],
          source_id: first.id,
        });
      }
      next.push(
        ...sourcesToAppend.map((source) => ({
          ...newComposerRow(),
          source_id: source.id,
          output_folder: sharedOutputFolder
            ? { ...sharedOutputFolder }
            : null,
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
        api<unknown>(`/sources/${sourceId}`, {
          signal,
          cache: "no-store",
        }),
      );
      if (result.status === "timed_out") return { status: "unavailable" };
      const value = result.value;
      const source = value;
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
          "Файлы Google Drive добавлены в Studio. Выберите их в нужных задачах заново.",
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
  async function chooseRowDriveFolder(rowId: string) {
    const operation: GooglePickerOperation = {
      projectId: project.id,
      panelId: googlePickerPanelId,
      rowId,
      kind: "source-folder",
    };
    if (rowSourcePickerRef.current || !beginGooglePicker(operation)) return;
    rowSourcePickerRef.current = true;
    let outcome: GooglePickerOutcome | undefined;
    setRowIntakeErrors((current) => ({ ...current, [rowId]: "" }));
    setRowIntakeStatus((current) => ({
      ...current,
      [rowId]: "Открываем выбор папки Google Drive…",
    }));
    try {
      const session = await acquireGooglePickerSession();
      const result = await googlePicker.openGooglePicker(
        "source-folder",
        session,
      );
      if (result.action === "cancel") {
        const message = "Выбор папки отменён.";
        setRowIntakeStatus((current) => ({ ...current, [rowId]: message }));
        outcome = { message, tone: "notice" };
        return;
      }
      if (result.action === "error") {
        throw new Error(result.message);
      }
      if (result.docs.length !== 1) {
        throw new Error("Google Picker не вернул одну папку.");
      }
      setRowIntakeStatus((current) => ({
        ...current,
        [rowId]: "Проверяем содержимое папки…",
      }));
      const bounded = await runBoundedRequest((signal) =>
        csrfMutate<unknown>(
          `/projects/${project.id}/sources/google-folder/preview`,
          csrf,
          onCsrf,
          {
            method: "POST",
            body: JSON.stringify({ folder_id: result.docs[0].id }),
            signal,
          },
        ),
      );
      if (bounded.status === "timed_out") {
        throw new Error(
          "Проверка папки Google Drive не завершилась вовремя. Повторите выбор.",
        );
      }
      const preview = parseDriveFolderPreview(bounded.value);
      if (!preview) {
        throw new Error(
          "Сервер вернул некорректный preview папки. Повторите выбор позже.",
        );
      }
      if (preview.blocker === "over_limit") {
        throw new Error(
          "В папке найдено более 50 поддерживаемых файлов. Выберите меньшую папку.",
        );
      }
      if (preview.blocker === "empty" || !preview.preview_token) {
        setDriveFolderPreview({ rowId, preview });
        const message =
          driveFolderBlockedMessage(preview) ??
          "Папка не готова к безопасному импорту.";
        setRowIntakeStatus((current) => ({
          ...current,
          [rowId]: "Проверка завершена: доступных файлов для импорта нет.",
        }));
        outcome = { message, tone: "error" };
        return;
      }
      setDriveFolderPreview({ rowId, preview });
      setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
      outcome = {
        message: `Папка проверена: ${preview.supported_count} файлов готовы к импорту.`,
        tone: "notice",
      };
    } catch (err) {
      const pickerFailure = googlePickerFailureMessage(err);
      const detail =
        err instanceof ApiError &&
        err.data &&
        typeof err.data === "object" &&
        "detail" in err.data &&
        typeof (err.data as { detail?: unknown }).detail === "string"
          ? (err.data as { detail: string }).detail
          : null;
      const message =
        pickerFailure ??
        (detail === "google_drive_folder_depth_limit" ||
        detail === "google_drive_folder_page_limit" ||
        detail === "google_drive_folder_item_limit"
          ? "Папка слишком большая или глубокая для безопасного импорта. Выберите меньшую папку."
          : detail === "google_drive_folder_cycle" ||
              detail === "google_drive_folder_duplicate_id" ||
              detail === "google_drive_folder_repeated_page_token"
            ? "Структура папки Google Drive неоднозначна. Импорт остановлен без изменений."
            : err instanceof Error
              ? err.message
              : "Не удалось проверить папку Google Drive.");
      setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
      setRowIntakeErrors((current) => ({ ...current, [rowId]: message }));
      outcome = { message, tone: "error" };
    } finally {
      rowSourcePickerRef.current = false;
      finishGooglePicker(operation, outcome);
    }
  }
  async function applyRowDriveFolder() {
    const selection = driveFolderPreview;
    if (!selection || driveFolderApplyRef.current) return;
    const { rowId, preview } = selection;
    if (!preview.preview_token) return;
    driveFolderApplyRef.current = true;
    setDriveFolderApplyPending(true);
    setDriveFolderPreview(null);
    setRowIntakeErrors((current) => ({ ...current, [rowId]: "" }));
    setRowIntakeStatus((current) => ({
      ...current,
      [rowId]: "Добавляем файлы из папки Google Drive…",
    }));
    try {
      let bounded;
      try {
        bounded = await runBoundedRequest((signal) =>
          csrfMutate<unknown>(
            `/projects/${project.id}/sources/google-folder/apply`,
            csrf,
            onCsrf,
            {
              method: "POST",
              body: JSON.stringify({
                folder_id: preview.folder.id,
                preview_token: preview.preview_token,
              }),
              signal,
            },
          ),
        );
      } catch (err) {
        const definitive =
          err instanceof ApiError &&
          err.status >= 400 &&
          err.status < 500 &&
          err.status !== 408 &&
          err.status !== 429;
        if (definitive) throw err;
        onReloadSources(project.id);
        throw new Error(
          "Сервер не подтвердил импорт папки. Список файлов обновлён; проверьте его и только затем явно выберите папку снова.",
          { cause: err },
        );
      }
      if (bounded.status === "timed_out") {
        onReloadSources(project.id);
        throw new Error(
          "Сервер не подтвердил импорт папки. Список файлов обновлён; проверьте его и только затем явно выберите папку снова.",
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
          preview.supported_count,
          project.id,
        )
      ) {
        onReloadSources(project.id);
        throw new Error(
          "Сервер вернул неполный результат импорта. Список файлов обновлён; проверьте его перед новым выбором.",
        );
      }
      placeSourcesInRows(rowId, orderedSources);
      setRowIntakeStatus((current) => ({
        ...current,
        [rowId]: `Добавлено файлов из папки: ${orderedSources.length}.`,
      }));
      onReloadSources(project.id);
    } catch (err) {
      const detail =
        err instanceof ApiError &&
        err.data &&
        typeof err.data === "object" &&
        "detail" in err.data &&
        typeof (err.data as { detail?: unknown }).detail === "string"
          ? (err.data as { detail: string }).detail
          : null;
      const message =
        detail === "google_drive_folder_changed"
          ? "Содержимое папки изменилось после preview. Выберите папку снова и проверьте новый список."
          : err instanceof Error
            ? err.message
            : "Не удалось импортировать папку Google Drive.";
      setRowIntakeStatus((current) => ({ ...current, [rowId]: "" }));
      setRowIntakeErrors((current) => ({ ...current, [rowId]: message }));
    } finally {
      driveFolderApplyRef.current = false;
      setDriveFolderApplyPending(false);
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
    if (!isSafeDirectUploadCapability(bounded.value, mimeType)) {
      onReloadSources(project.id);
      throw new Error(
        "Сервер вернул небезопасный ответ для загрузки. Список файлов обновлён; повторите попытку позже.",
      );
    }
    return bounded.value;
  }

  async function uploadRowLocalSources(rowId: string, files: File[]) {
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
      const aggregateTotalBytes = files.reduce((total, file) => total + file.size, 0);
      let aggregateCompletedBytes = 0;
      setRowIntakeErrors((current) => ({ ...current, [rowId]: "" }));
      for (const [fileIndex, file] of files.entries()) {
        const queueLabel = `Файл ${fileIndex + 1} из ${files.length}`;
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
            [rowId]: `${queueLabel}: ${file.name} — подготовка загрузки…`,
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
            [rowId]: `${queueLabel}: ${file.name} — загрузка 0%…`,
          }));
          let put: { ok: boolean; status: number } | null = null;
          let putIsAmbiguous = false;
          try {
            put = await uploadFileWithProgress({
              url: initiated.upload.url,
              method: initiated.upload.method,
              headers: initiated.upload.headers,
              file,
              timeoutMs: directUploadTimeoutMs(initiated.upload.expires_in),
              onProgress: (progress) => {
                setRowIntakeStatus((current) => ({
                  ...current,
                  [rowId]: `${queueLabel}: ${file.name} — ${progress.percent}% (${formatBytes(progress.loadedBytes)} из ${formatBytes(progress.totalBytes)})`,
                }));
                setRowUploadProgress((current) => ({
                  ...current,
                  [rowId]: {
                    ...progress,
                    filename: file.name,
                    fileIndex: fileIndex + 1,
                    fileCount: files.length,
                    aggregatePercent:
                      aggregateTotalBytes > 0
                        ? Math.min(
                            100,
                            Math.round(
                              ((aggregateCompletedBytes + progress.loadedBytes) /
                                aggregateTotalBytes) *
                                100,
                            ),
                          )
                        : 0,
                  },
                }));
              },
            });
          } catch (reason) {
            if (!(reason instanceof DirectUploadAmbiguousError)) {
              throw reason;
            }
            putIsAmbiguous = true;
          }
          if (putIsAmbiguous) {
            reportLocalUploadPutFailure();
            setRowIntakeStatus((current) => ({
              ...current,
              [rowId]: `${queueLabel}: ${file.name} — проверяем результат загрузки…`,
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
            [rowId]: `${queueLabel}: ${file.name} — подтверждаем загрузку…`,
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
        } finally {
          aggregateCompletedBytes += file.size;
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
      setRowUploadProgress((current) => ({ ...current, [rowId]: undefined }));
      finishLocalUpload(operation, persistentNotice);
    }
  }

  function previewRowLocalFolder(
    rowId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
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
    const preview = buildLocalFolderPreview(files, sourceUploadPolicy);
    if (preview.blocker === "over_limit") {
      setRowIntakeErrors((current) => ({
        ...current,
        [rowId]: `В папке найдено ${preview.supported_count} поддерживаемых файлов. Один batch допускает не более ${MAX_BATCH_ITEMS}; выберите меньшую папку.`,
      }));
      return;
    }
    if (preview.blocker === "empty") {
      setRowIntakeErrors((current) => ({
        ...current,
        [rowId]:
          preview.total_count === 0
            ? "Выбранная папка не содержит файлов."
            : "В выбранной папке нет поддерживаемых непустых файлов допустимого размера.",
      }));
      return;
    }
    setRowIntakeErrors((current) => ({ ...current, [rowId]: "" }));
    setLocalFolderPreview({ rowId, preview });
  }

  function updateRow(rowId: string, patch: Partial<ComposerRow>) {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }
  function applyVerifiedOutputFolder(
    rowId: string,
    outputFolder: VerifiedOutputFolder,
  ) {
    setRows((current) => {
      const target = current.find((row) => row.id === rowId);
      if (!target) return current;
      const fillUnassignedRows = target.output_folder === null;
      return current.map((row) =>
        row.id === rowId || (fillUnassignedRows && row.output_folder === null)
          ? { ...row, output_folder: { ...outputFolder } }
          : row,
      );
    });
  }
  function updateSegment(
    rowId: string,
    segmentId: string,
    patch: Partial<ComposerSegment>,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              segments: row.segments.map((segment) =>
                segment.id === segmentId
                  ? { ...segment, ...patch }
                  : segment,
              ),
            }
          : row,
      ),
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
  async function chooseRowFolder(rowId: string) {
    if (!driveSourcePickerEnabled || rowFolderPickerRef.current) return;
    const operation: GooglePickerOperation = {
      projectId: project.id,
      panelId: googlePickerPanelId,
      rowId,
      kind: "folder:first",
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
      applyVerifiedOutputFolder(rowId, outputFolder);
      outcome = {
        message:
          "Папка Google Drive проверена, но прежняя задача больше не открыта. Выберите папку для задачи повторно.",
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
  async function loadFolderFavorites() {
    if (folderFavoritesLoading) return;
    setFolderFavoritesLoading(true);
    setFolderFavoritesError("");
    try {
      const bounded = await runBoundedRequest((signal) =>
        api<unknown>("/output-folder-favorites", {
          signal,
          cache: "no-store",
        }),
      );
      if (bounded.status === "timed_out") throw new Error("timeout");
      const parsed = parseOutputFolderFavoriteCollection(bounded.value);
      if (parsed === null) throw new Error("invalid_response");
      setFolderFavorites(parsed);
      setFolderFavoritesLoaded(true);
    } catch {
      setFolderFavoritesError("Не удалось загрузить избранные папки.");
    } finally {
      setFolderFavoritesLoading(false);
    }
  }
  async function saveRowFolderFavorite(row: ComposerRow) {
    const folderId = row.output_folder?.folder_id;
    if (!folderId || folderFavoriteMutation) return;
    setFolderFavoriteMutation(`save:${folderId}`);
    setFolderFavoritesError("");
    try {
      const bounded = await runBoundedRequest((signal) =>
        batchMutateWithCsrfRetry<unknown>(
          "/output-folder-favorites/google-picker",
          csrf,
          onCsrf,
          {
            method: "POST",
            body: JSON.stringify({ folder_id: folderId }),
            signal,
          },
        ),
      );
      if (bounded.status === "timed_out") throw new Error("timeout");
      const favorite = parseOutputFolderFavorite(bounded.value);
      if (!favorite) throw new Error("invalid_response");
      setFolderFavorites((current) => [
        favorite,
        ...current.filter((item) => item.id !== favorite.id),
      ]);
      setFolderFavoritesLoaded(true);
    } catch {
      setFolderFavoritesError("Не удалось добавить папку в избранное.");
    } finally {
      setFolderFavoriteMutation(null);
    }
  }
  async function chooseFavoriteFolder(rowId: string, favorite: OutputFolderFavorite) {
    if (folderFavoriteMutation) return;
    setFolderFavoriteMutation(`choose:${favorite.id}`);
    setFolderFavoritesError("");
    try {
      const bounded = await runBoundedRequest((signal) =>
        batchMutateWithCsrfRetry<unknown>(
          `/projects/${project.id}/output-folders/google-picker/verify`,
          csrf,
          onCsrf,
          {
            method: "POST",
            body: JSON.stringify({ folder_id: favorite.drive_folder_id }),
            signal,
          },
        ),
      );
      if (bounded.status === "timed_out") throw new Error("timeout");
      if (!isExpectedVerifiedGooglePickerFolder(bounded.value)) {
        throw new Error("invalid_response");
      }
      updateRow(rowId, {
        output_folder: {
          folder_id: favorite.drive_folder_id,
          name: bounded.value.name,
          web_view_url: bounded.value.web_view_url,
        },
      });
    } catch {
      setFolderFavoritesError(
        "Избранная папка больше не подтверждена для записи. Выберите другую или удалите её из списка.",
      );
    } finally {
      setFolderFavoriteMutation(null);
    }
  }
  async function deleteFolderFavorite(favorite: OutputFolderFavorite) {
    if (folderFavoriteMutation) return;
    setFolderFavoriteMutation(`delete:${favorite.id}`);
    setFolderFavoritesError("");
    try {
      const bounded = await runBoundedRequest((signal) =>
        batchMutateWithCsrfRetry<{ ok: boolean }>(
          `/output-folder-favorites/${favorite.id}`,
          csrf,
          onCsrf,
          { method: "DELETE", signal },
        ),
      );
      if (bounded.status === "timed_out" || bounded.value.ok !== true) {
        throw new Error("unconfirmed");
      }
      setFolderFavorites((current) =>
        current.filter((item) => item.id !== favorite.id),
      );
    } catch {
      setFolderFavoritesError("Не удалось удалить папку из избранного.");
    } finally {
      setFolderFavoriteMutation(null);
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
          ? `Повтор подтверждён: мульти-транскрибация содержит элементов: ${response.created_count}.`
          : `Создана мульти-транскрибация. Элементов: ${response.created_count}.`,
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
          "Пакет не прошёл проверку. Задачи сохранены — исправьте файлы или папки и отправьте снова.",
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
      setMessage("Добавьте хотя бы одну задачу подготовки.");
      return;
    }
    if (firstReadinessBlocker) {
      setMessage(firstReadinessBlocker);
      return;
    }
    if (invalidSourceRowIds.size > 0) {
      setMessage(
        "Одна или несколько задач ссылаются на файл, который уже недоступен. Выберите готовый файл заново.",
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
              : "Найдены ранее созданные результаты. Выберите явное решение для каждой заблокированной задачи."
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
    request: (signal?: AbortSignal) => Promise<T>,
    onSuccess: (value: T) => void,
    onFailure: (error: unknown) => void,
  ) {
    return settleLatestRequest(
      jobRequestEpochsRef.current,
      key,
      request,
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
        (signal) => requestJobDetail(jobId, project.id, signal),
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
        (signal) => requestJobRetryRead(jobId, signal),
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
        (signal) => requestOutputReconciliationRead(jobId, signal),
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
        (signal) => requestJobOutputs(jobId, signal),
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
      const request = await runBoundedRequest(async (signal) => {
        const candidate = await csrfMutate<unknown>(
          `/jobs/${jobId}/output-reconciliation/check`,
          csrf,
          onCsrf,
          { method: "POST", signal },
        );
        const parsed = parseOutputReconciliationCheckResponse(
          candidate,
          jobId,
        );
        if (!parsed) {
          throw new Error("invalid_output_reconciliation_check_response");
        }
        return parsed;
      });
      if (request.status === "timed_out") {
        const observed =
          await readAfterJobMutationTimeout<OutputReconciliationResponse>(
            (signal) => requestOutputReconciliationRead(jobId, signal),
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
      const request = await runBoundedRequest(async (signal) => {
        const candidate = await csrfMutate<unknown>(
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
        );
        const parsed = parseJobRetryResponse(candidate, jobId);
        if (!parsed) throw new Error("invalid_job_retry_response");
        return parsed;
      });
      if (request.status === "timed_out") {
        const observed = await readAfterJobMutationTimeout<JobRetryResponse>(
          (signal) => requestJobRetryRead(jobId, signal),
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
      const request = await runBoundedRequest(async (signal) => {
        const candidate = await csrfMutate<unknown>(
          `/jobs/${jobId}/cancel`,
          csrf,
          onCsrf,
          { method: "POST", signal },
        );
        const parsed = parseJobDetailResponse(candidate, project.id, jobId);
        if (!parsed || !cancellationIsConfirmed(parsed)) {
          throw new Error("invalid_job_cancel_response");
        }
        return parsed;
      });
      if (request.status === "timed_out") {
        const observed = await readAfterJobMutationTimeout<TranscriptionJob>(
          (signal) => requestJobDetail(jobId, project.id, signal),
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
  async function clearHistory() {
    if (historyClearPendingRef.current) return;
    historyClearPendingRef.current = true;
    setHistoryClearPending(true);
    setHistoryClearMessage("");
    try {
      const result = await mutateWithCsrfRetry<unknown>(
        `/projects/${project.id}/history/clear`,
        csrf,
        onCsrf,
        {
          method: "POST",
          body: JSON.stringify({ confirm_clear: true }),
        },
      );
      if (!isProjectClearResponse(result)) {
        throw new Error("invalid_history_clear_response");
      }
      setHistoryClearOpen(false);
      setHistoryClearMessage(
        "История очищена. Задачи в очереди и обработке сохранены.",
      );
      onReloadJobs(project.id);
    } catch {
      setHistoryClearMessage("Не удалось очистить историю. Повторите попытку.");
    } finally {
      historyClearPendingRef.current = false;
      setHistoryClearPending(false);
    }
  }
  const displayJobs = mergeJobsWithBatchOrder(jobs.items ?? [], batchJobs);
  const {
    current: currentTranscriptions,
    pinnedTerminal: pinnedTerminalTranscriptions,
    recent: recentTranscriptions,
  } = groupTranscriptionPresentations(displayJobs);
  useEffect(() => {
    for (const job of displayJobs) {
      if (
        !["completed", "failed", "cancelled"].includes(job.status) ||
        job.terminal_dismissed_at !== null
      ) {
        continue;
      }
      if (!detail[job.id]) void loadDetail(job.id);
    }
  }, [displayJobs]);
  const currentJobIds = displayJobs
    .filter((job) => ["queued", "processing"].includes(job.status))
    .slice(0, 50)
    .map((job) => job.id)
    .sort()
    .join(",");
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
        const progressSearch = new URLSearchParams();
        requestedIds.forEach((jobId) => progressSearch.append("job_id", jobId));
        const raw = await api<unknown>(`/projects/${project.id}/jobs/progress?${progressSearch.toString()}`, {
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
      const request = await runBoundedRequest(async (signal) => {
        const candidate = await csrfMutate<unknown>(
          `/jobs/${jobId}/dismiss`,
          csrf,
          onCsrf,
          { method: "POST", signal },
        );
        const parsed = parseJobSummaryResponse(candidate, project.id, jobId);
        if (!parsed || !dismissalIsConfirmed(parsed)) {
          throw new Error("invalid_job_dismiss_response");
        }
        return parsed;
      });
      if (request.status === "timed_out") {
        const observed = await readAfterJobMutationTimeout<TranscriptionJob>(
          (signal) => requestJobDetail(jobId, project.id, signal),
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
        csrf={csrf}
        onCsrf={onCsrf}
        onSpeakerUpdated={async (jobId) => {
          await loadDetail(jobId);
          await onReloadJobs(project.id);
        }}
      />
    );
  }
  function renderTranscriptionPresentation(
    presentation: TranscriptionPresentation,
  ) {
    if (presentation.kind === "single") {
      const job = presentation.jobs[0];
      return renderJobCard(
        job,
        ["completed", "failed", "cancelled"].includes(job.status) &&
          job.terminal_dismissed_at === null,
      );
    }
    return (
      <MultiTranscriptionCard
        key={presentation.id}
        jobs={presentation.jobs}
        renderJob={renderJobCard}
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
      {sources.error && (
        <div className="error" role="alert">
          <p>{sources.error}</p>
          <button type="button" onClick={() => onReloadSources(project.id)}>
            Повторить загрузку файлов
          </button>
        </div>
      )}
      <form
        className="job-creator composer"
        onSubmit={createBatch}
        aria-label="Композитор пакетных задач"
      >
        <div className="composer-header">
          <div>
            <h2>Подготовка задач</h2>
            <p className="muted">
              Одна задача создаёт один элемент мульти-транскрибации: один файл
              или фрагмент → один документ в выбранной папке.
            </p>
          </div>
          <div className="composer-add-row">
            <button type="button" className="secondary" onClick={addRow}>
              Добавить задачу
            </button>
            <span
              className="composer-add-row-status"
              role="status"
              aria-live="polite"
              aria-label="Результат добавления задачи"
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
                      new CustomEvent("studio:navigate-settings", {
                        detail: { section: "connections" },
                      }),
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
                  current.map(clearComposerReprocessDecisions),
                );
              }}
            >
              <option value="ru">Русский</option>
              <option value="en">Английский</option>
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
                  current.map(clearComposerReprocessDecisions),
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
          aria-label="Готовность задач подготовки"
        >
          <b>
            Готово: {completeRowCount} из {rows.length}
          </b>
          <span>
            {firstReadinessBlocker
              ? firstReadinessBlocker
              : "Все задачи готовы"}
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
          <legend>Задачи подготовки</legend>
          {!sources.loaded && (
            <button type="button" onClick={() => onLoadSources(project.id)}>
              Загрузить сохранённые файлы Studio
            </button>
          )}
          {sources.nextCursor && (
            <button
              type="button"
              className="secondary"
              disabled={sources.loadingMore}
              onClick={() =>
                onLoadMoreSources(project.id, sources.nextCursor ?? "")
              }
            >
              {sources.loadingMore
                ? "Загружаем файлы…"
                : "Показать ещё сохранённые файлы"}
            </button>
          )}
          {sources.loaded && usableSources.length === 0 && (
            <section className="empty-state">
              <p>
                Сначала добавьте хотя бы один готовый файл в задачу
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
                          aria-label={`Поднять задачу ${index + 1}`}
                        >
                          Выше
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRow(index, 1)}
                          disabled={index === rows.length - 1}
                          aria-label={`Опустить задачу ${index + 1}`}
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
                          aria-label={`Удалить задачу ${index + 1}`}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="composer-row-grid">
                    <section
                      className="row-source-cell"
                      aria-label={`Источник задачи ${index + 1}`}
                    >
                      <label>
                        Источник
                        <select
                          aria-label={`Существующий файл для задачи ${index + 1}`}
                          value={row.source_id}
                          onChange={(e) => {
                            updateRow(row.id, {
                              source_id: e.target.value,
                              segments: row.segments.map((segment) => ({
                                ...segment,
                                reprocess_existing: false,
                              })),
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
                        <button
                          type="button"
                          className="secondary"
                          aria-label={`Выбрать папку-источник Google Drive для задачи ${index + 1}`}
                          disabled={
                            !driveSourcePickerEnabled ||
                            pickerBusy ||
                            driveFolderApplyPending
                          }
                          onClick={() => void chooseRowDriveFolder(row.id)}
                        >
                          Папка Google Drive
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
                              Выбрать файлы с устройства для задачи {index + 1}
                            </span>
                          </label>
                          <input
                            id={`local-source-upload-${row.id}`}
                            className="visually-hidden"
                            aria-label={`Выбрать файлы с устройства для задачи ${index + 1}`}
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
                            onChange={(event) => {
                              const files = Array.from(
                                event.target.files ?? [],
                              );
                              event.target.value = "";
                              void uploadRowLocalSources(row.id, files);
                            }}
                          />
                        </span>
                        <span className="file-picker-control">
                          <label
                            className={`button-like secondary${
                              sourceUploadPolicy?.local_upload_enabled &&
                              !localUploadIsBusy(row.id)
                                ? ""
                                : " disabled"
                            }`}
                            htmlFor={`local-source-folder-${row.id}`}
                            aria-disabled={
                              !sourceUploadPolicy?.local_upload_enabled ||
                              localUploadIsBusy(row.id)
                            }
                          >
                            <span aria-hidden="true">Папка с устройства</span>
                            <span className="visually-hidden">
                              Выбрать папку с устройства для задачи {index + 1}
                            </span>
                          </label>
                          <input
                            ref={(element) => {
                              element?.setAttribute("webkitdirectory", "");
                              element?.setAttribute("directory", "");
                            }}
                            id={`local-source-folder-${row.id}`}
                            className="visually-hidden"
                            aria-label={`Выбрать папку с устройства для задачи ${index + 1}`}
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
                            onChange={(event) =>
                              previewRowLocalFolder(row.id, event)
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
                          <span>
                            Создан исходный файл: {selectedSource.source_created_at
                              ? formatTime(selectedSource.source_created_at)
                              : "не удалось определить"}
                          </span>
                          {isSafeDisplayUrl(
                            selectedSource.drive_file_url ?? null,
                          ) && (
                            <ResourceExternalLink
                              href={selectedSource.drive_file_url ?? ""}
                              label="Открыть файл"
                              ariaLabel={`Открыть источник задачи ${index + 1} в Google Drive`}
                            />
                          )}
                        </div>
                      )}
                      {rowIntakeStatus[row.id] && (
                        <p role="status" className="muted">
                          {rowIntakeStatus[row.id]}
                        </p>
                      )}
                      {rowUploadProgress[row.id] && (
                        <div className="upload-progress" aria-live="polite">
                          <progress
                            aria-label={`Общая загрузка файлов для задачи ${index + 1}`}
                            max="100"
                            value={rowUploadProgress[row.id]?.aggregatePercent ?? 0}
                          >
                            {rowUploadProgress[row.id]?.aggregatePercent ?? 0}%
                          </progress>
                          <small>
                            Общий прогресс: {rowUploadProgress[row.id]?.aggregatePercent ?? 0}%
                          </small>
                        </div>
                      )}
                      {rowIntakeErrors[row.id] && (
                        <p className="error">{rowIntakeErrors[row.id]}</p>
                      )}
                    </section>
                    <div className="folder-cell">
                      <span className="field-label">Папка результата</span>
                      <span>
                        {row.output_folder?.name || "Папка не выбрана"}
                      </span>
                      {row.output_folder?.web_view_url &&
                        isApprovedOutputUrl(row.output_folder.web_view_url) && (
                          <ResourceExternalLink
                            href={row.output_folder.web_view_url}
                            label="Открыть папку"
                            ariaLabel={`Открыть папку результата задачи ${index + 1} в Google Drive`}
                          />
                        )}
                      <button
                        type="button"
                        className="secondary"
                        disabled={!driveSourcePickerEnabled || pickerBusy}
                        onClick={() => void chooseRowFolder(row.id)}
                        aria-label={`Выбрать папку результата для задачи ${index + 1}`}
                      >
                        {row.output_folder?.folder_id ? "Изменить" : "Выбрать"}
                      </button>
                      {row.output_folder?.folder_id && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={folderFavoriteMutation !== null}
                          aria-busy={folderFavoriteMutation === `save:${row.output_folder.folder_id}`}
                          onClick={() => void saveRowFolderFavorite(row)}
                        >
                          {folderFavorites.some(
                            (favorite) =>
                              favorite.drive_folder_id ===
                              row.output_folder?.folder_id,
                          )
                            ? "Обновить в избранном"
                            : "Добавить в избранное"}
                        </button>
                      )}
                      <details
                        onToggle={(event) => {
                          if (
                            event.currentTarget.open &&
                            !folderFavoritesLoaded &&
                            !folderFavoritesLoading
                          ) {
                            void loadFolderFavorites();
                          }
                        }}
                      >
                        <summary>Избранные папки</summary>
                        {folderFavoritesLoading && (
                          <p role="status">Загрузка избранных папок…</p>
                        )}
                        {folderFavoritesError && (
                          <p className="error">{folderFavoritesError}</p>
                        )}
                        {folderFavoritesLoaded && folderFavorites.length === 0 && (
                          <p className="muted">Избранных папок пока нет.</p>
                        )}
                        {folderFavorites.map((favorite) => (
                          <div className="resource-actions" key={favorite.id}>
                            <button
                              type="button"
                              className="secondary"
                              disabled={folderFavoriteMutation !== null}
                              aria-busy={folderFavoriteMutation === `choose:${favorite.id}`}
                              onClick={() =>
                                void chooseFavoriteFolder(row.id, favorite)
                              }
                            >
                              Выбрать: {favorite.name}
                            </button>
                            <ResourceExternalLink
                              href={favorite.web_view_url}
                              label="Открыть"
                              ariaLabel={`Открыть избранную папку ${favorite.name} в Google Drive`}
                            />
                            <button
                              type="button"
                              className="secondary danger"
                              disabled={folderFavoriteMutation !== null}
                              aria-busy={folderFavoriteMutation === `delete:${favorite.id}`}
                              onClick={() => void deleteFolderFavorite(favorite)}
                            >
                              Удалить
                            </button>
                          </div>
                        ))}
                        {folderFavoritesError && !folderFavoritesLoading && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => void loadFolderFavorites()}
                          >
                            Повторить
                          </button>
                        )}
                      </details>
                    </div>
                  </div>
                  <details
                    className="segment-plan-panel"
                    aria-label={`Фрагментация задачи ${index + 1}`}
                  >
                    <summary className="segment-plan-summary">
                      <span>Разделить файл на фрагменты</span>
                      <span className="muted">
                        {row.segments.length === 1
                          ? "Весь файл"
                          : `${row.segments.length} фрагмента`}
                      </span>
                    </summary>
                    <label className="segment-count-control">
                      Количество фрагментов
                      <input
                        type="number"
                        min={1}
                        max={MAX_BATCH_ITEMS}
                        value={row.segments.length}
                        onChange={(event) => {
                          const count = Number(event.target.value);
                          if (
                            Number.isInteger(count) &&
                            count >= 1 &&
                            count <= MAX_BATCH_ITEMS
                          ) {
                            updateRow(row.id, {
                              segments: resizeComposerSegments(
                                row.segments,
                                count,
                              ),
                            });
                          }
                        }}
                        aria-label={`Количество фрагментов задачи ${index + 1}`}
                      />
                      <small className="muted">
                        Каждый фрагмент станет отдельной задачей и отдельным
                        документом в выбранной папке. Максимум: {MAX_BATCH_ITEMS}.
                      </small>
                    </label>
                    <ol className="segment-editor-list">
                      {row.segments.map((segment, segmentIndex) => {
                        const isLast = segmentIndex === row.segments.length - 1;
                        return (
                          <li className="segment-editor" key={segment.id}>
                            <b>Фрагмент {segmentIndex + 1}</b>
                            <div className="segment-boundaries">
                              <label>
                                Начало
                                <input
                                  value={segment.start_boundary}
                                  onChange={(event) =>
                                    updateSegment(row.id, segment.id, {
                                      start_boundary: event.target.value,
                                      reprocess_existing: false,
                                    })
                                  }
                                  inputMode="numeric"
                                  placeholder="0:00"
                                  aria-label={`Начало фрагмента ${segmentIndex + 1} задачи ${index + 1}`}
                                />
                              </label>
                              <label>
                                Конец
                                <input
                                  value={segment.end_boundary}
                                  disabled={segment.ends_at_source_end}
                                  onChange={(event) =>
                                    updateSegment(row.id, segment.id, {
                                      end_boundary: event.target.value,
                                      reprocess_existing: false,
                                    })
                                  }
                                  inputMode="numeric"
                                  placeholder="10:10"
                                  aria-label={`Конец фрагмента ${segmentIndex + 1} задачи ${index + 1}`}
                                />
                              </label>
                              <label className="segment-end-toggle">
                                <input
                                  type="checkbox"
                                  checked={segment.ends_at_source_end}
                                  disabled={!isLast}
                                  onChange={(event) =>
                                    updateSegment(row.id, segment.id, {
                                      ends_at_source_end: event.target.checked,
                                      end_boundary: event.target.checked
                                        ? ""
                                        : segment.end_boundary,
                                      reprocess_existing: false,
                                    })
                                  }
                                />
                                <span>До конца файла</span>
                              </label>
                            </div>
                            <label>
                              Название документа
                              <input
                                value={segment.title}
                                onChange={(event) =>
                                  updateSegment(row.id, segment.id, {
                                    title: event.target.value,
                                  })
                                }
                                maxLength={160}
                                placeholder="Необязательно"
                                aria-label={`Название фрагмента ${segmentIndex + 1} задачи ${index + 1}`}
                              />
                              <small className="muted">
                                Необязательно. Если оставить пустым, Google Docs
                                получит имя исходного файла.
                              </small>
                            </label>
                          </li>
                        );
                      })}
                    </ol>
                    {composerSegmentPlanIssue(row.segments) && (
                      <p className="error">
                        {composerSegmentPlanIssue(row.segments)}
                      </p>
                    )}
                  </details>
                  {invalidSourceRowIds.has(row.id) && (
                    <p className="error">
                      Выбранный файл больше недоступен. Выберите готовый файл
                      заново.
                    </p>
                  )}
                  {duplicate && (
                    <p className="error">
                      Такой источник, папка и диапазон уже добавлены.
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
                <h3>
                  {activePreflightBlocked
                    ? activeProviderAuthorityBlocked
                      ? "План временно заблокирован"
                      : "План требует решения"
                    : "План готов к подтверждению"}
                </h3>
                <p className="muted">
                  ElevenLabs scribe_v2 ·{" "}
                  {transcriptionLanguageModeLabel(
                    activePreflight.language_mode,
                  )}
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
                const segment = row?.segments.find(
                  (candidate) => candidate.id === expandedItem?.segment_id,
                );
                const clipLabel = item.media_clip
                  ? `${item.media_clip.start_seconds === 0 ? "Начало" : formatSegmentBoundary(item.media_clip.start_seconds ?? 0)} — ${item.media_clip.end_seconds === null ? "конец" : formatSegmentBoundary(item.media_clip.end_seconds)}`
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
                        row &&
                        segment && (
                          <label className="reprocess-decision">
                            <input
                              type="checkbox"
                              checked={segment.reprocess_existing}
                              disabled={
                                item.provider_attempt_authority.status ===
                                "blocked"
                              }
                              onChange={(event) => {
                                const reprocess = event.target.checked;
                                updateSegment(
                                  row.id,
                                  segment.id,
                                  { reprocess_existing: reprocess },
                                );
                              }}
                              aria-label={`Транскрибировать заново задачу ${item.position + 1}`}
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
            <b>Задач: {rows.length}</b>
            <span>Элементов мульти-транскрибации: {plannedJobCount}</span>
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
      <TranscriptionAnalyticsPanel
        key={project.id}
        projectId={project.id}
        csrf={csrf}
        onCsrf={onCsrf}
      />
      <section className="sources" aria-label="Текущие транскрибации">
        <h2>Текущие транскрибации</h2>
        {jobs.loading && <p role="status">Загрузка задач…</p>}
        {jobs.error && <p className="error">{jobs.error}</p>}
        {jobs.loaded &&
          !jobs.loading &&
          currentTranscriptions.length === 0 &&
          pinnedTerminalTranscriptions.length === 0 && (
          <p className="notice">Текущих транскрибаций нет.</p>
        )}
        {currentTranscriptions.map(renderTranscriptionPresentation)}
        {pinnedTerminalTranscriptions.map(renderTranscriptionPresentation)}
      </section>
      <details className="recent-jobs">
        <summary>Недавние транскрибации · {recentTranscriptions.length}</summary>
        {(recentTranscriptions.length > 0 ||
          pinnedTerminalTranscriptions.length > 0) && (
          <button
            type="button"
            className="danger"
            disabled={historyClearPending}
            onClick={() => setHistoryClearOpen(true)}
          >
            Очистить историю
          </button>
        )}
        {historyClearMessage && (
          <p role="status" className="notice">
            {historyClearMessage}
          </p>
        )}
        {recentTranscriptions.map(renderTranscriptionPresentation)}
        {jobs.nextCursor && (
          <button
            type="button"
            className="secondary"
            disabled={jobs.loadingMore}
            onClick={() => onLoadMoreJobs(project.id, jobs.nextCursor ?? "")}
          >
            {jobs.loadingMore
              ? "Загружаем транскрибации…"
              : "Показать ещё транскрибации"}
          </button>
        )}
      </details>{" "}
      {historyClearOpen && (
        <ConfirmClearDialog
          title="Очистить историю?"
          description="Завершённые, отменённые и неуспешные задачи исчезнут из списка. Задачи в очереди и обработке, результаты, Google Docs и журнал аудита не удаляются."
          pending={historyClearPending}
          onConfirm={() => void clearHistory()}
          onCancel={() => setHistoryClearOpen(false)}
        />
      )}
      {localFolderPreview && (
        <FolderImportDialog
          preview={localFolderPreview.preview}
          targetFolderName={
            rows.find((row) => row.id === localFolderPreview.rowId)
              ?.output_folder?.name ?? null
          }
          rejectedReasonLabel={(reason) =>
            localFolderRejectedReasonLabel(
              reason as LocalFolderRejectedFile["reason"],
            )
          }
          onConfirm={() => {
            const selection = localFolderPreview;
            setLocalFolderPreview(null);
            void uploadRowLocalSources(
              selection.rowId,
              selection.preview.accepted.map((item) => item.file),
            );
          }}
          onCancel={() => setLocalFolderPreview(null)}
        />
      )}
      {driveFolderPreview && (
        <FolderImportDialog
          preview={{
            folder_name: driveFolderPreview.preview.folder.name,
            total_count: driveFolderPreview.preview.total_file_count,
            supported_count: driveFolderPreview.preview.supported_count,
            accepted: driveFolderPreview.preview.accepted,
            rejected: driveFolderPreview.preview.skipped.map((item) => ({
              display_name: item.relative_path,
              reason: item.reason,
            })),
          }}
          targetFolderName={
            rows.find((row) => row.id === driveFolderPreview.rowId)
              ?.output_folder?.name ?? null
          }
          rejectedReasonLabel={(reason) =>
            driveFolderSkipReasonLabel(
              reason as DriveFolderSkippedItem["reason"],
            )
          }
          blockedMessage={driveFolderBlockedMessage(
            driveFolderPreview.preview,
          )}
          onConfirm={() => void applyRowDriveFolder()}
          onCancel={() => setDriveFolderPreview(null)}
        />
      )}
    </section>
  );
}

function isProjectClearResponse(value: unknown): value is {
  ok: true;
  reset_at: string;
  hidden_job_count: number;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.ok === true &&
    typeof candidate.reset_at === "string" &&
    Number.isFinite(Date.parse(candidate.reset_at)) &&
    typeof candidate.hidden_job_count === "number" &&
    Number.isInteger(candidate.hidden_job_count) &&
    candidate.hidden_job_count >= 0
  );
}

function OverviewPage({
  onNavigate,
  onOpenTranscriptions,
}: {
  onNavigate: (page: Page) => void;
  onOpenTranscriptions: () => void;
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
      (page) => {
        setProjects(page.items.filter((project) => !project.archived_at));
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
  const googleStatus = googleLoading
    ? "Загрузка…"
    : googleError
      ? "Недоступно"
      : googleConnection?.connected && !googleConnection.reconnect_required
        ? "Подключён"
        : "Нужна настройка";
  const needsAttention = [
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
          <h1 className="page-title">VoiceOps Studio</h1>
          <p>
            Рабочая панель аккаунта: обработка аудио, транскрибации,
            подключение Drive и готовность ключей.
          </p>
        </div>
        <div className="actions">
          <button onClick={() => onNavigate("audio")}>
            Открыть обработку аудио
          </button>
          <button className="primary" onClick={onOpenTranscriptions}>
            Открыть транскрибации
          </button>
        </div>
      </header>
      <div className="summary-grid dashboard-summary">
        <article className="card summary-card" aria-label="Транскрибации">
          <span className="summary-label">Транскрибации</span>
          <strong className="summary-value">
            {projectsLoading
              ? "Загрузка…"
              : projectsError
                ? "Недоступно"
                : projects.length > 0
                  ? "Доступны"
                  : "Подготовятся при открытии"}
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
      {!projectsLoading && !projectsError && projects.length === 0 && (
        <article className="card">
          <h2>Начать работу</h2>
          <p>
            Рабочая область создаётся автоматически при первом открытии. Затем
            подготовьте аудио либо выберите обычную или Live-транскрибацию.
          </p>
          <div className="actions">
            <button onClick={() => onNavigate("audio")}>
              Открыть обработку аудио
            </button>
            <button className="primary" onClick={onOpenTranscriptions}>
              Открыть транскрибации
            </button>
            <button onClick={() => onNavigate("settings")}>Настройки</button>
          </div>
        </article>
      )}
    </section>
  );
}

function ProjectsPage({
  active,
  ownerUserId,
  csrf,
  onCsrf,
  requestedProjectId,
  onRequestedProjectHandled,
  requestedSourceId,
  onRequestedSourceHandled,
}: {
  active: boolean;
  ownerUserId: string;
  csrf: string;
  onCsrf: (csrf: string) => void;
  requestedProjectId: string | null;
  onRequestedProjectHandled: () => void;
  requestedSourceId: string | null;
  onRequestedSourceHandled: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsNextCursor, setProjectsNextCursor] = useState<string | null>(
    null,
  );
  const [projectsLoadingMore, setProjectsLoadingMore] = useState(false);
  const [sources, setSources] = useState<
    Record<string, typeof emptySourceState>
  >({});
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const workspaceEnsurePendingRef = useRef(false);
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
  const wasActiveRef = useRef(active);
  const pendingJobMutationsRef = useRef(new Set<string>());
  const [pendingJobMutations, setPendingJobMutations] = useState<Set<string>>(
    () => new Set(),
  );
  const [jobMutationNotices, setJobMutationNotices] = useState<
    Record<string, JobMutationNotice>
  >({});
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
  const applyProjectCollection = (
    nextProjects: Project[],
    nextCursor: string | null,
    append = false,
  ) => {
    setProjectsNextCursor(nextCursor);
    if (append) {
      setProjects((current) => appendUniqueItems(current, nextProjects));
      return;
    }
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
  };
  const ensureWorkspace = async () => {
    if (workspaceEnsurePendingRef.current) return;
    workspaceEnsurePendingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const request = await runBoundedRequest(
        (signal) =>
          mutateWithCsrfRetry<unknown>(
            "/transcriptions/workspace",
            csrf,
            onCsrf,
            { method: "POST", signal },
          ),
        TRANSCRIPTION_WORKSPACE_REQUEST_TIMEOUT_MS,
      );
      const workspace =
        request.status === "completed"
          ? parseTranscriptionWorkspace(request.value)
          : null;
      if (workspace) {
        applyProjectCollection([workspace], null);
        return;
      }
      const reconciliation = await runBoundedRequest(
        requestProjectCollection,
        PROJECT_COLLECTION_REQUEST_TIMEOUT_MS,
      );
      if (
        reconciliation.status !== "completed" ||
        reconciliation.value.items.length === 0
      ) {
        throw new Error("transcription_workspace_not_observed");
      }
      applyProjectCollection(
        reconciliation.value.items,
        reconciliation.value.nextCursor,
      );
    } catch (workspaceError) {
      setError(
        workspaceError instanceof ApiError
          ? workspaceError.message
          : "Не удалось подготовить рабочую область транскрибаций.",
      );
    } finally {
      workspaceEnsurePendingRef.current = false;
      setLoading(false);
    }
  };
  const load = () => {
    setLoading(true);
    setError("");
    void settleLatestRequest(
      requestEpochsRef.current,
      "projects",
      requestProjectCollection,
      (page) => {
        if (page.items.length === 0) {
          void ensureWorkspace();
          return;
        }
        applyProjectCollection(page.items, page.nextCursor);
        setLoading(false);
        setError("");
      },
      (loadError) => {
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : "Не удалось загрузить транскрибации.",
        );
        setLoading(false);
      },
      {
        controllers: requestControllersRef.current,
        timeoutMs: PROJECT_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const loadMoreProjects = () => {
    if (!projectsNextCursor || projectsLoadingMore) return;
    const cursor = projectsNextCursor;
    setProjectsLoadingMore(true);
    void settleLatestRequest(
      requestEpochsRef.current,
      "projects:more",
      (signal) => requestProjectCollection(signal, cursor),
      (page) => {
        applyProjectCollection(page.items, page.nextCursor, true);
        setProjectsLoadingMore(false);
      },
      () => {
        setProjectsLoadingMore(false);
        setError("Не удалось загрузить следующие рабочие области.");
      },
      {
        controllers: requestControllersRef.current,
        timeoutMs: PROJECT_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
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
    if (active) loadGoogleConnection();
  }, [active]);
  const loadSources = (projectId: string, cursor: string | null = null) => {
    const append = cursor !== null;
    const requestKey = `sources:${projectId}`;
    setSources((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? emptySourceState),
        loading: !append,
        loadingMore: append,
        error: "",
      },
    }));
    void settleLatestRequest(
      requestEpochsRef.current,
      requestKey,
      (signal) => requestProjectSourcePage(projectId, cursor, signal),
      (page) =>
        setSources((current) => ({
          ...current,
          [projectId]: {
            loading: false,
            loadingMore: false,
            error: "",
            loaded: true,
            items: append
              ? appendUniqueItems(current[projectId]?.items ?? [], page.items)
              : page.items,
            nextCursor: page.nextCursor,
          },
        })),
      () =>
        setSources((current) => ({
          ...current,
          [projectId]: {
            loading: false,
            loadingMore: false,
            error: "Не удалось загрузить сохранённые файлы Studio.",
            loaded: true,
            items: current[projectId]?.items ?? [],
            nextCursor: current[projectId]?.nextCursor ?? null,
          },
        })),
      {
        controllers: requestControllersRef.current,
        timeoutMs: PROJECT_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const loadJobs = (projectId: string, cursor: string | null = null) => {
    const append = cursor !== null;
    const requestKey = `jobs:${projectId}`;
    setJobs((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? emptyJobState),
        loading: !append,
        loadingMore: append,
        error: "",
      },
    }));
    void settleLatestRequest(
      requestEpochsRef.current,
      requestKey,
      (signal) => requestProjectJobPage(projectId, cursor, signal),
      (page) =>
        setJobs((current) => ({
          ...current,
          [projectId]: {
            loading: false,
            loadingMore: false,
            error: "",
            loaded: true,
            items: append
              ? appendUniqueItems(current[projectId]?.items ?? [], page.items)
              : page.items,
            nextCursor: page.nextCursor,
          },
        })),
      () =>
        setJobs((current) => ({
          ...current,
          [projectId]: {
            loading: false,
            loadingMore: false,
            error: "Не удалось загрузить задачи проекта.",
            loaded: true,
            items: current[projectId]?.items ?? [],
            nextCursor: current[projectId]?.nextCursor ?? null,
          },
        })),
      {
        controllers: requestControllersRef.current,
        timeoutMs: PROJECT_COLLECTION_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
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
  useEffect(() => {
    const becameActive = active && !wasActiveRef.current;
    wasActiveRef.current = active;
    if (!becameActive || !selectedProject) return;
    loadSources(selectedProject.id);
  }, [active, selectedProject?.id]);
  useEffect(() => setTranscriptionMode("batch"), [selectedProject?.id]);
  return (
    <section className="page transcriptions-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Транскрибации</h1>
          <p>
            Обычная обработка файлов и Live-транскрибация находятся в одном
            рабочем пространстве.
          </p>
        </div>
      </header>
      {loading && <p role="status">Подготавливаем транскрибации…</p>}
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={load}>
            Повторить
          </button>
        </div>
      )}
      {!loading && !error && projects.length === 0 && (
        <div className="notice">
          <p>Рабочая область транскрибаций пока недоступна.</p>
          <button type="button" onClick={() => void ensureWorkspace()}>
            Подготовить
          </button>
        </div>
      )}
      {!loading && !error && projects.length > 1 && (
        <details className="card legacy-workspace-switcher">
          <summary>Прежние рабочие области · {projects.length}</summary>
          <p className="muted">
            Они сохранены для доступа к ранее созданным данным. Новые
            транскрибации не требуют ручного создания или архивации проектов.
          </p>
          <div className="legacy-workspace-list">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={
                  project.id === selectedProjectId ? "active" : undefined
                }
                aria-pressed={project.id === selectedProjectId}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <strong>{project.title}</strong>
                <small>
                  Обновлено{" "}
                  {new Date(project.updated_at).toLocaleDateString("ru-RU")}
                </small>
              </button>
            ))}
          </div>
          {projectsNextCursor && (
            <button
              type="button"
              className="secondary"
              disabled={projectsLoadingMore}
              onClick={loadMoreProjects}
            >
              {projectsLoadingMore
                ? "Загружаем рабочие области…"
                : "Показать ещё рабочие области"}
            </button>
          )}
        </details>
      )}
      {!loading && !error && selectedProject ? (
        <article className="card workspace-card">
          {projects.length > 1 && (
            <p className="workspace-context muted">
              Открыта прежняя рабочая область: {selectedProject.title}
            </p>
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
                  tabIndex={transcriptionMode === "batch" ? 0 : -1}
                  onClick={() => setTranscriptionMode("batch")}
                  onKeyDown={(event) =>
                    navigateTabList(
                      event,
                      ["batch", "live"] as const,
                      setTranscriptionMode,
                    )
                  }
                >
                  Обычная транскрибация
                </button>
                <button
                  id="transcription-tab-live"
                  type="button"
                  role="tab"
                  aria-controls="transcription-panel-live"
                  aria-selected={transcriptionMode === "live"}
                  tabIndex={transcriptionMode === "live" ? 0 : -1}
                  onClick={() => setTranscriptionMode("live")}
                  onKeyDown={(event) =>
                    navigateTabList(
                      event,
                      ["batch", "live"] as const,
                      setTranscriptionMode,
                    )
                  }
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
                  requestedSourceId={requestedSourceId}
                  onRequestedSourceHandled={onRequestedSourceHandled}
                  googleConnection={googleConnection}
                  googleConnectionState={googleConnectionState}
                  onReloadGoogleConnection={loadGoogleConnection}
                  activeGooglePicker={activeGooglePicker}
                  googlePickerNotices={googlePickerNotices}
                  beginGooglePicker={beginGooglePicker}
                  finishGooglePicker={finishGooglePicker}
                  onLoadSources={loadSources}
                  onLoadMoreSources={(projectId, cursor) =>
                    loadSources(projectId, cursor)
                  }
                  onReloadSources={loadSources}
                  onReloadJobs={loadJobs}
                  onLoadMoreJobs={(projectId, cursor) =>
                    loadJobs(projectId, cursor)
                  }
                  pendingJobMutations={pendingJobMutations}
                  jobMutationNotices={jobMutationNotices}
                  beginJobMutation={beginJobMutation}
                  finishJobMutation={finishJobMutation}
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
                  ownerUserId={ownerUserId}
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
      ) : !loading && !error && projects.length > 0 ? (
        <p role="status">Открываем транскрибации…</p>
      ) : null}
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
const DIAGNOSTICS_REPORT_FORMATS = {
  md: { label: "Markdown", mediaType: "text/markdown" },
  json: { label: "JSON", mediaType: "application/json" },
  yaml: { label: "YAML", mediaType: "application/yaml" },
  toml: { label: "TOML", mediaType: "application/toml" },
} as const;
type DiagnosticsReportFormat = keyof typeof DIAGNOSTICS_REPORT_FORMATS;
function reportFileName(reportFormat: DiagnosticsReportFormat) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `studio-diagnostics-${stamp}.${reportFormat}`;
}
async function diagnosticsReportBlob(
  filters: DiagnosticsFilters,
  context: DiagnosticsReportContext,
  csrf: string,
  onCsrf: (csrf: string) => void,
  reportFormat: DiagnosticsReportFormat,
  signal?: AbortSignal,
): Promise<Blob> {
  const body = JSON.stringify(reportPayload(filters, context));
  const response = await responseWithCsrfRetry(
    `/diagnostics/report.${reportFormat}`,
    csrf,
    onCsrf,
    {
      method: "POST",
      body,
      signal,
    },
  );
  const contentType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const cacheControl = response.headers.get("cache-control") ?? "";
  if (
    contentType !== DIAGNOSTICS_REPORT_FORMATS[reportFormat].mediaType ||
    !/^attachment(?:;|$)/i.test(contentDisposition) ||
    !new RegExp(
      `filename="?[^";]+\\.${reportFormat}"?(?:;|$)`,
      "i",
    ).test(contentDisposition) ||
    !cacheControl
      .split(",")
      .some((directive) => directive.trim().toLowerCase() === "no-store")
  ) {
    throw new Error("invalid_diagnostics_report_response");
  }
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("invalid_diagnostics_report_response");
  }
  return blob;
}
type DiagnosticsFilters = {
  days: string;
  level: string;
  component: string;
  eventCode: string;
  projectId: string;
  jobId: string;
};
type DiagnosticsReportContext = {
  problemDescription: string;
  operationReference: string;
};
function reportPayload(
  filters: DiagnosticsFilters,
  context: DiagnosticsReportContext = {
    problemDescription: "",
    operationReference: "",
  },
) {
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
    problem_description: context.problemDescription.trim() || undefined,
    operation_reference: context.operationReference.trim() || undefined,
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
  "http_status",
  "upstream_request_id",
  "rejection_category",
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
  http_status: "статус HTTP",
  upstream_request_id: "request ID исходного ответа",
  rejection_category: "категория rejected promise",
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
    "auth.session_revoked": "Отдельная сессия завершена",
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
    "transcript_catalog.cleared": "Манифест Studio очищен",
    "history.cleared": "История транскрибаций очищена",
    "analytics.cleared": "Аналитика транскрибаций очищена",
  };
  return labels[type] ?? "Событие безопасности";
}

function SourceStorageSettings({
  csrf,
  onCsrf,
  active,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
  active: boolean;
}) {
  const [workspace, setWorkspace] = useState<Project | null>(null);
  const [sources, setSources] = useState({ ...emptySourceState });
  const [workspaceState, setWorkspaceState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const pendingDeletionIdsRef = useRef(new Set<string>());
  const [pendingDeletionIds, setPendingDeletionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [deletionNotices, setDeletionNotices] = useState<
    Record<string, SourceDeletionNotice>
  >({});
  const loadedOnceRef = useRef(false);

  const loadSources = async (
    projectId: string,
    cursor: string | null = null,
  ) => {
    const append = cursor !== null;
    setSources((current) => ({
      ...current,
      loading: !append,
      loadingMore: append,
      error: "",
    }));
    try {
      const page = await requestProjectSourcePage(projectId, cursor);
      setSources((current) => ({
        loading: false,
        loadingMore: false,
        error: "",
        loaded: true,
        items: append
          ? appendUniqueItems(current.items, page.items)
          : page.items,
        nextCursor: page.nextCursor,
      }));
    } catch {
      setSources((current) => ({
        ...current,
        loading: false,
        loadingMore: false,
        loaded: true,
        error: "Не удалось загрузить сохранённые файлы Studio.",
      }));
    }
  };

  const loadWorkspace = async () => {
    setWorkspaceState("loading");
    try {
      const page = await requestProjectCollection();
      const current =
        page.items.find((project) => project.archived_at === null) ?? null;
      setWorkspace(current);
      setWorkspaceState("ready");
      if (current) await loadSources(current.id);
    } catch {
      setWorkspace(null);
      setWorkspaceState("error");
    }
  };

  useEffect(() => {
    if (!active || loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    void loadWorkspace();
  }, [active]);

  const beginDeletion = (sourceId: string) => {
    if (pendingDeletionIdsRef.current.has(sourceId)) return false;
    pendingDeletionIdsRef.current.add(sourceId);
    setPendingDeletionIds(new Set(pendingDeletionIdsRef.current));
    setDeletionNotices((current) => {
      if (!current[sourceId]) return current;
      const next = { ...current };
      delete next[sourceId];
      return next;
    });
    return true;
  };

  const finishDeletion = (
    sourceId: string,
    notice: SourceDeletionNotice,
  ) => {
    pendingDeletionIdsRef.current.delete(sourceId);
    setPendingDeletionIds(new Set(pendingDeletionIdsRef.current));
    setDeletionNotices((current) => ({ ...current, [sourceId]: notice }));
  };

  return (
    <section aria-labelledby="stored-files-title">
      <h2 id="stored-files-title">Файлы и хранилище</h2>
      <p className="muted">
        Здесь находятся безопасные метаданные файлов, доступных для новых
        задач. Добавление файлов выполняется непосредственно при подготовке
        транскрибации или обработке аудио.
      </p>
      {workspaceState === "loading" && (
        <p role="status">Загружаем сохранённые файлы…</p>
      )}
      {workspaceState === "error" && (
        <div className="error" role="alert">
          <p>Не удалось открыть хранилище файлов.</p>
          <button type="button" onClick={() => void loadWorkspace()}>
            Повторить
          </button>
        </div>
      )}
      {workspaceState === "ready" && !workspace && (
        <p className="notice">
          Рабочая область ещё не создана. Откройте транскрибации, чтобы
          подготовить её.
        </p>
      )}
      {workspaceState === "ready" && workspace && (
        <SourcesPanel
          project={workspace}
          csrf={csrf}
          onCsrf={onCsrf}
          sources={sources}
          onReload={loadSources}
          onLoadMore={(projectId, cursor) => loadSources(projectId, cursor)}
          onSourceRemoved={(source) =>
            setSources((current) => ({
              ...current,
              items: current.items.filter((item) => item.id !== source.id),
            }))
          }
          pendingDeletionIds={pendingDeletionIds}
          deletionNotices={deletionNotices}
          beginDeletion={beginDeletion}
          finishDeletion={finishDeletion}
        />
      )}
    </section>
  );
}

const SETTINGS_SECTION_IDS = [
  "account",
  "connections",
  "files",
  "appearance",
  "diagnostics",
] as const;
const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  account: "Аккаунт",
  connections: "Подключения",
  files: "Файлы и хранилище",
  appearance: "Оформление",
  diagnostics: "Диагностика",
};

function SettingsPage({
  user,
  csrf,
  onCsrf,
  onLogout,
  logoutPending,
  logoutError,
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
  logoutPending: boolean;
  logoutError: string;
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
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null);
  const [auditLoadingMore, setAuditLoadingMore] = useState(false);
  const [auditState, setAuditState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [auditMessage, setAuditMessage] = useState("");
  const auditRequestEpochsRef = useRef(new Map<string, number>());
  const auditRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );
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
  const [accentSelection, setAccentSelection] =
    useState<StudioAccentColor>("blue");
  const [accentSaving, setAccentSaving] = useState(false);
  const [accentMessage, setAccentMessage] = useState("");
  const accentMutationPendingRef = useRef(false);
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
        setAccentSelection(preferences.accent_color);
        applyStudioAccentColor(preferences.accent_color);
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
  const loadAuditEvents = async ({
    reportFailure = true,
    cursor = null,
  }: {
    reportFailure?: boolean;
    cursor?: string | null;
  } = {}) => {
    const append = cursor !== null;
    const hadConfirmedEvents = auditState === "ready";
    if (!hadConfirmedEvents && !append) setAuditState("loading");
    if (append) setAuditLoadingMore(true);
    if (reportFailure) setAuditMessage("");
    await settleLatestRequest(
      auditRequestEpochsRef.current,
      "settings:audit-events",
      (signal) => requestAuditCollection(signal, cursor),
      (page) => {
        setEvents((current) =>
          append ? appendUniqueItems(current, page.items) : page.items,
        );
        setAuditNextCursor(page.nextCursor);
        setAuditLoadingMore(false);
        setAuditState("ready");
        setAuditMessage("");
      },
      () => {
        setAuditLoadingMore(false);
        setAuditState(hadConfirmedEvents ? "ready" : "error");
        if (reportFailure) {
          setAuditMessage(
            hadConfirmedEvents
              ? "Не удалось обновить аудит безопасности. Последний подтверждённый список сохранён."
              : "Не удалось загрузить аудит безопасности. Повторите попытку.",
          );
        }
      },
      {
        controllers: auditRequestControllersRef.current,
        timeoutMs: AUDIT_EVENT_REQUEST_TIMEOUT_MS,
      },
    );
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
    void loadAuditEvents();
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
      cancelLatestRequests(
        auditRequestEpochsRef.current,
        auditRequestControllersRef.current,
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
      if (settingsMountedRef.current) {
        void loadAuditEvents({ reportFailure: false });
      }
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
      if (settingsMountedRef.current) {
        void loadAuditEvents({ reportFailure: false });
      }
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
      if (settingsMountedRef.current) {
        void loadAuditEvents({ reportFailure: false });
      }
    }
  }
  async function saveAccentPreference(selected: StudioAccentColor) {
    if (accentMutationPendingRef.current || !accountPreferences) return;
    const previousConfirmed = accountPreferences.accent_color;
    accentMutationPendingRef.current = true;
    setAccentSaving(true);
    setAccentSelection(selected);
    setAccentMessage("");
    applyStudioAccentColor(selected);
    try {
      const request = await runBoundedRequest(
        (signal) =>
          safeMutate<unknown>("/account/preferences", {
            method: "PATCH",
            signal,
            body: JSON.stringify({ accent_color: selected }),
          }),
        ACCOUNT_PREFERENCES_MUTATION_TIMEOUT_MS,
      );
      const preferences =
        request.status === "completed" &&
        isExpectedAccountPreferences(request.value) &&
        request.value.accent_color === selected
          ? request.value
          : await reconcileAccountPreferences();
      if (!preferences) {
        setAccentSelection(previousConfirmed);
        applyStudioAccentColor(previousConfirmed);
        setAccentMessage(
          "Сервер не подтвердил цвет. Сохранено последнее подтверждённое значение.",
        );
      } else {
        setAccountPreferences(preferences);
        setAccentSelection(preferences.accent_color);
        applyStudioAccentColor(preferences.accent_color);
        setAccentMessage(
          preferences.accent_color === selected
            ? "Цвет интерфейса сохранён."
            : "Сервер не подтвердил выбранный цвет. Показано актуальное значение.",
        );
      }
    } catch {
      const preferences = await reconcileAccountPreferences();
      const confirmed = preferences?.accent_color ?? previousConfirmed;
      setAccentSelection(confirmed);
      applyStudioAccentColor(confirmed);
      setAccentMessage(
        preferences?.accent_color === selected
          ? "Сохранение цвета подтверждено по актуальной настройке аккаунта."
          : "Не удалось сохранить цвет. Показано последнее подтверждённое значение.",
      );
    } finally {
      accentMutationPendingRef.current = false;
      if (settingsMountedRef.current) setAccentSaving(false);
    }
  }
  const mutateCredential = async (
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
      if (settingsMountedRef.current) {
        void loadAuditEvents({ reportFailure: false });
      }
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
      if (settingsMountedRef.current) {
        void loadAuditEvents({ reportFailure: false });
      }
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
      if (settingsMountedRef.current) {
        void loadAuditEvents({ reportFailure: false });
      }
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
      <h1 className="page-title">Настройки</h1>
      <div
        className="tabs settings-section-tabs"
        role="tablist"
        aria-label="Разделы настроек"
      >
        {SETTINGS_SECTION_IDS.map((settingsSection) => (
          <button
            key={settingsSection}
            id={`settings-tab-${settingsSection}`}
            type="button"
            role="tab"
            aria-controls={`settings-panel-${settingsSection}`}
            aria-selected={section === settingsSection}
            tabIndex={section === settingsSection ? 0 : -1}
            className={section === settingsSection ? "active" : ""}
            onClick={() => onSectionChange(settingsSection)}
            onKeyDown={(event) =>
              navigateTabList(event, SETTINGS_SECTION_IDS, onSectionChange)
            }
          >
            {SETTINGS_SECTION_LABELS[settingsSection]}
          </button>
        ))}
      </div>
      {section === "diagnostics" ? (
        <div
          id="settings-panel-diagnostics"
          role="tabpanel"
          aria-labelledby="settings-tab-diagnostics"
        >
          <DiagnosticsSettings
            csrf={csrf}
            onCsrf={onCsrf}
            auditEvents={events}
            auditState={auditState}
            auditMessage={auditMessage}
            onRetryAudit={() => void loadAuditEvents()}
            auditNextCursor={auditNextCursor}
            auditLoadingMore={auditLoadingMore}
            onLoadMoreAudit={() =>
              void loadAuditEvents({ cursor: auditNextCursor })
            }
          />
        </div>
      ) : (
        <div
          id={`settings-panel-${section}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${section}`}
        >
          {section === "account" && (
            <>
              <h2>Аккаунт</h2>
              <section className="account-card">
                <div>
                  <b>{user.email}</b>
                  <span className="muted">Роль: {user.role}</span>
                </div>
                <button
                  className="secondary"
                  onClick={onLogout}
                  disabled={logoutPending}
                >
                  {logoutPending ? "Выходим…" : "Выйти"}
                </button>
              </section>
              {logoutError && (
                <p className="error" role="alert">
                  {logoutError}
                </p>
              )}
              <AccountSessionsPanel csrf={csrf} onCsrf={onCsrf} />
            </>
          )}
          {section === "appearance" && (
            <section aria-labelledby="appearance-settings-title">
              <h2 id="appearance-settings-title">Оформление</h2>
              <div className="card theme-preferences">
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
            <label>
              Цвет интерфейса
              <select
                aria-label="Цвет интерфейса"
                value={accentSelection}
                disabled={!accountPreferences || accentSaving}
                onChange={(event) => {
                  const selected = event.target.value;
                  if (isStudioAccentColor(selected)) {
                    void saveAccentPreference(selected);
                  }
                }}
              >
                <option value="blue">Синий</option>
                <option value="violet">Фиолетовый</option>
                <option value="teal">Бирюзовый</option>
                <option value="rose">Розовый</option>
              </select>
            </label>
            {accentMessage && (
              <p role="status" className="notice">
                {accentMessage}
              </p>
            )}
              </div>
            </section>
          )}
          <div hidden={section !== "files"}>
              <SourceStorageSettings
                csrf={csrf}
                onCsrf={onCsrf}
                active={section === "files"}
              />
              <h3>Срок хранения локальных файлов</h3>
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
          </div>
          {section === "connections" && (
            <section aria-labelledby="connections-settings-title">
          <h2 id="connections-settings-title">Подключения</h2>
          {oauthMessage && (
            <p className="notice" role="status">
              {oauthMessage}
            </p>
          )}
          <h3>Ключи провайдеров</h3>
          <p className="notice">
            Ключи не сохраняются в браузере и никогда не отображаются обратно.
            Текущие обычная и Live-транскрибации выполняются только через
            ElevenLabs. OpenAI key можно безопасно хранить для будущих
            интеграций, но текущий execution flow его не использует.
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
                <option value="openai">
                  OpenAI — только хранение, не для текущей транскрибации
                </option>
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
                  {credential.provider === "openai" && (
                    <p className="notice">
                      Этот key хранится зашифрованно, но не используется
                      текущей обычной или Live-транскрибацией.
                    </p>
                  )}
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
            </section>
          )}
          {section === "account" && (
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
          )}
        </div>
      )}
    </section>
  );
}

function DiagnosticsSettings({
  csrf,
  onCsrf,
  auditEvents,
  auditState,
  auditMessage,
  onRetryAudit,
  auditNextCursor,
  auditLoadingMore,
  onLoadMoreAudit,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
  auditEvents: Audit[];
  auditState: "loading" | "ready" | "error";
  auditMessage: string;
  onRetryAudit: () => void;
  auditNextCursor: string | null;
  auditLoadingMore: boolean;
  onLoadMoreAudit: () => void;
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
  const [reportContext, setReportContext] = useState<DiagnosticsReportContext>({
    problemDescription: "",
    operationReference: "",
  });
  const [reportFormat, setReportFormat] =
    useState<DiagnosticsReportFormat>("md");
  const [timeline, setTimeline] = useState<DiagnosticsEvent[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [eventsState, setEventsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [exportState, setExportState] = useState("");
  const [exportPending, setExportPending] = useState(false);
  const [debugSession, setDebugSession] =
    useState<DiagnosticsDebugSession | null>(null);
  const [debugState, setDebugState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [debugActionState, setDebugActionState] = useState("");
  const [debugMutationPending, setDebugMutationPending] = useState(false);
  const [debugDuration, setDebugDuration] = useState("10");
  const [debugTick, setDebugTick] = useState(0);
  const debugMutationPendingRef = useRef(false);
  const debugRequestEpochsRef = useRef(new Map<string, number>());
  const debugRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );
  const diagnosticsReadEpochsRef = useRef(new Map<string, number>());
  const diagnosticsReadControllersRef = useRef(
    new Map<string, AbortController>(),
  );
  const eventsPagePendingRef = useRef(false);
  const exportPendingRef = useRef(false);
  const exportRequestEpochsRef = useRef(new Map<string, number>());
  const exportRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );
  const [failedEventsCursor, setFailedEventsCursor] = useState<string | null>(
    null,
  );
  const expiredDebugRefreshRequested = useRef(false);
  const loadEvents = (cursor?: string) => {
    if (cursor && eventsPagePendingRef.current) return;
    eventsPagePendingRef.current = Boolean(cursor);
    setEventsState("loading");
    setFailedEventsCursor(null);
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
    void settleLatestRequest(
      diagnosticsReadEpochsRef.current,
      "diagnostics:events",
      (signal) => requestDiagnosticsEvents(params.toString(), signal),
      (r) => {
        eventsPagePendingRef.current = false;
        setTimeline((current) =>
          cursor
            ? [
                ...current,
                ...r.events.filter(
                  (event) => !current.some((item) => item.id === event.id),
                ),
              ]
            : r.events,
        );
        setPeriod(r.period);
        setNextCursor(r.next_cursor ?? null);
        setEventsState("ready");
      },
      () => {
        eventsPagePendingRef.current = false;
        setFailedEventsCursor(cursor ?? null);
        if (!cursor) {
          setTimeline([]);
          setPeriod(null);
          setNextCursor(null);
        }
        setEventsState("error");
      },
      {
        controllers: diagnosticsReadControllersRef.current,
        timeoutMs: DIAGNOSTICS_READ_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const loadSystem = () => {
    setSystemState("loading");
    void settleLatestRequest(
      diagnosticsReadEpochsRef.current,
      "diagnostics:system",
      requestDiagnosticsSystem,
      (response) => {
        setSystem(response);
        setSystemState("ready");
      },
      () => {
        setSystem(null);
        setSystemState("error");
      },
      {
        controllers: diagnosticsReadControllersRef.current,
        timeoutMs: DIAGNOSTICS_READ_REQUEST_TIMEOUT_MS,
      },
    );
  };
  useEffect(() => {
    loadSystem();
    loadEvents();
    return () => {
      eventsPagePendingRef.current = false;
      exportPendingRef.current = false;
      cancelLatestRequests(
        diagnosticsReadEpochsRef.current,
        diagnosticsReadControllersRef.current,
      );
      cancelLatestRequests(
        exportRequestEpochsRef.current,
        exportRequestControllersRef.current,
      );
    };
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
  const applyDebugSession = (status: DiagnosticsDebugSession) => {
    setDebugSession(status);
    configurePwaDiagnosticsDebugState({
      active: status.active,
      expiresAt: status.expires_at,
    });
    setDebugState("ready");
  };
  const loadDebugSession = (options: { keepReady?: boolean } = {}) => {
    if (!options.keepReady) setDebugState("loading");
    void settleLatestRequest(
      debugRequestEpochsRef.current,
      "diagnostics:debug-session-read",
      requestDiagnosticsDebugSession,
      (status) => {
        expiredDebugRefreshRequested.current = false;
        applyDebugSession(status);
      },
      () => {
        configurePwaDiagnosticsDebugState({ active: false });
        setDebugState("error");
      },
      {
        controllers: debugRequestControllersRef.current,
        timeoutMs: DIAGNOSTICS_DEBUG_REQUEST_TIMEOUT_MS,
      },
    );
  };
  useEffect(() => {
    loadDebugSession();
  }, [csrf]);
  useEffect(
    () => () => {
      debugMutationPendingRef.current = false;
      cancelLatestRequests(
        debugRequestEpochsRef.current,
        debugRequestControllersRef.current,
      );
    },
    [],
  );
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
  const finishDebugMutation = () => {
    debugMutationPendingRef.current = false;
    setDebugMutationPending(false);
  };
  const reconcileDebugMutation = (
    kind: "start" | "stop",
    conflict = false,
  ) => {
    setDebugActionState("Проверяем актуальный статус DEBUG…");
    void settleLatestRequest(
      debugRequestEpochsRef.current,
      "diagnostics:debug-session-read",
      requestDiagnosticsDebugSession,
      (status) => {
        applyDebugSession(status);
        finishDebugMutation();
        if (kind === "start") {
          setDebugActionState(
            status.active
              ? conflict
                ? "DEBUG уже активна в другой вкладке. Статус обновлён."
                : "DEBUG включена. Статус подтверждён."
              : "Не удалось подтвердить включение DEBUG. Повторите попытку.",
          );
          return;
        }
        setDebugActionState(
          status.active
            ? "Не удалось подтвердить остановку DEBUG. Повторите попытку."
            : "DEBUG остановлена. Статус подтверждён.",
        );
      },
      () => {
        finishDebugMutation();
        setDebugActionState(
          kind === "start"
            ? "Не удалось подтвердить включение DEBUG. Повторите попытку."
            : "Не удалось подтвердить остановку DEBUG. Повторите попытку.",
        );
      },
      {
        controllers: debugRequestControllersRef.current,
        timeoutMs: DIAGNOSTICS_DEBUG_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const mutateDebugSession = (kind: "start" | "stop") => {
    if (debugMutationPendingRef.current) return;
    debugMutationPendingRef.current = true;
    setDebugMutationPending(true);
    setDebugActionState(
      kind === "start" ? "Включаем DEBUG…" : "Останавливаем DEBUG…",
    );
    void settleLatestRequest(
      debugRequestEpochsRef.current,
      "diagnostics:debug-session-mutation",
      async (signal) => {
        const candidate = await csrfMutate<unknown>(
          "/diagnostics/debug-session",
          csrf,
          onCsrf,
          {
            method: kind === "start" ? "POST" : "DELETE",
            signal,
            ...(kind === "start"
              ? {
                  body: JSON.stringify({
                    duration_minutes: Number(debugDuration),
                  }),
                }
              : {}),
          },
        );
        const status = parseDiagnosticsDebugSession(candidate);
        if (!status) {
          throw new Error("invalid_diagnostics_debug_session_response");
        }
        return status;
      },
      (status) => {
        const confirmed = kind === "start" ? status.active : !status.active;
        if (!confirmed) {
          reconcileDebugMutation(kind);
          return;
        }
        applyDebugSession(status);
        finishDebugMutation();
        setDebugActionState(
          kind === "start" ? "DEBUG включена." : "DEBUG остановлена.",
        );
      },
      (failure) => {
        reconcileDebugMutation(
          kind,
          kind === "start" &&
            failure instanceof ApiError &&
            failure.status === 409,
        );
      },
      {
        controllers: debugRequestControllersRef.current,
        timeoutMs: DIAGNOSTICS_DEBUG_MUTATION_TIMEOUT_MS,
      },
    );
  };
  const startDebug = () => mutateDebugSession("start");
  const stopDebug = () => mutateDebugSession("stop");

  const finishExport = () => {
    exportPendingRef.current = false;
    setExportPending(false);
  };
  const exportReport = (reportFormat: DiagnosticsReportFormat) => {
    if (exportPendingRef.current) return;
    const formatLabel = DIAGNOSTICS_REPORT_FORMATS[reportFormat].label;
    exportPendingRef.current = true;
    setExportPending(true);
    setExportState(`Готовим ${formatLabel}-отчёт…`);
    void settleLatestRequest(
      exportRequestEpochsRef.current,
      "diagnostics:report-export",
      (signal) =>
        diagnosticsReportBlob(
          filters,
          reportContext,
          csrf,
          onCsrf,
          reportFormat,
          signal,
        ),
      (blob) => {
        let url: string | null = null;
        let anchor: HTMLAnchorElement | null = null;
        try {
          url = URL.createObjectURL(blob);
          anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = reportFileName(reportFormat);
          document.body.appendChild(anchor);
          anchor.click();
          setExportState(`${formatLabel}-отчёт скачан.`);
        } catch {
          setExportState(
            `Не удалось скачать ${formatLabel}-отчёт. Повторите попытку.`,
          );
        } finally {
          anchor?.remove();
          if (url) URL.revokeObjectURL(url);
          finishExport();
        }
      },
      () => {
        finishExport();
        setExportState(
          `Не удалось скачать ${formatLabel}-отчёт. Повторите попытку.`,
        );
      },
      {
        controllers: exportRequestControllersRef.current,
        timeoutMs: DIAGNOSTICS_EXPORT_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const visibleAuditEvents = auditEvents
    .filter((event) => event.type !== "auth.csrf_refreshed")
    .slice(0, 20);
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
          <div className="error">
            <p>Не удалось загрузить состояние.</p>
            <button type="button" onClick={loadSystem}>
              Повторить загрузку состояния
            </button>
          </div>
        )}
        {systemState === "ready" && system && (
          <dl className="meta">
            <dt>Сборка веб-приложения</dt>
            <dd>{buildIdentityText(system.build?.web)}</dd>
            <dt>Сборка API</dt>
            <dd>{buildIdentityText(system.build?.api)}</dd>
            <dt>Сборка фоновой обработки</dt>
            <dd>{buildIdentityText(system.build?.worker)}</dd>
            <dt>Версия релиза</dt>
            <dd>{safeText(system.release_version)}</dd>
            <dt>Commit веб-приложения</dt>
            <dd>{safeText(system.components?.web?.commit_sha)}</dd>
            <dt>Commit API</dt>
            <dd>{safeText(system.components?.api?.commit_sha)}</dd>
            <dt>Commit фоновой обработки</dt>
            <dd>{safeText(system.components?.worker?.commit_sha)}</dd>
            <dt>Ревизия схемы БД</dt>
            <dd>{safeText(system.schema_revision)}</dd>
            <dt>Backend</dt>
            <dd>{safeText(system.health?.backend)}</dd>
            <dt>PostgreSQL</dt>
            <dd>{safeText(system.health?.database)}</dd>
            <dt>Очередь</dt>
            <dd>{safeText(system.health?.queue?.status)} · ожидают {safeText(system.health?.queue?.queued)} · выполняются {safeText(system.health?.queue?.processing)}</dd>
            <dt>Worker</dt>
            <dd>{safeText(system.health?.worker?.status)} · heartbeat {safeText(system.components?.worker?.heartbeat_age_seconds)} сек. назад</dd>
            <dt>Object storage</dt>
            <dd>{safeText(system.health?.object_storage?.status)} · {safeText(system.health?.object_storage?.probe)}</dd>
            <dt>STT provider</dt>
            <dd>{safeText(system.health?.stt_provider?.status)} · availability {safeText(system.health?.stt_provider?.availability)} · probe {safeText(system.health?.stt_provider?.probe)}</dd>
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
        <form
          className="diagnostics-export"
          aria-labelledby="diagnostics-export-title"
          onSubmit={applyFilters}
        >
          <h4 id="diagnostics-export-title">
            Диагностический пакет для анализа
          </h4>
          <p className="muted">
            Опишите проблему и скачайте sanitized bundle для анализа reasoning
            model или специалистом. Не вводите пароли, API keys, token values и
            содержимое транскрипций. Аудит безопасности в пакет не входит.
          </p>
          <div className="diagnostics-bundle-fields">
            <label>
              Что произошло
              <textarea
                value={reportContext.problemDescription}
                maxLength={1000}
                rows={4}
                placeholder="Кратко опишите действие, ожидаемый результат и фактическую проблему"
                onChange={(event) =>
                  setReportContext((current) => ({
                    ...current,
                    problemDescription: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Связанная операция или задача
              <input
                value={reportContext.operationReference}
                maxLength={160}
                placeholder="Необязательно: название, время или ID"
                onChange={(event) =>
                  setReportContext((current) => ({
                    ...current,
                    operationReference: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Период
              <select value={filters.days} onChange={updateFilter("days")}>
                <option value="1">1 день</option>
                <option value="3">3 дня</option>
                <option value="7">7 дней</option>
              </select>
            </label>
            <label>
              Формат пакета
              <select
                value={reportFormat}
                onChange={(event) =>
                  setReportFormat(event.target.value as DiagnosticsReportFormat)
                }
              >
                {Object.entries(DIAGNOSTICS_REPORT_FORMATS).map(
                  ([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <details className="diagnostics-advanced-filters">
            <summary>Расширенные технические фильтры</summary>
            <p className="muted">
              Используйте их только по рекомендации специалиста. Код события и
              internal IDs не нужны для обычной выгрузки.
            </p>
            <div className="diagnostics-filters">
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
                Internal workspace ID
                <input
                  value={filters.projectId}
                  onChange={updateFilter("projectId")}
                  placeholder="Необязательно"
                />
              </label>
              <label>
                Internal task ID
                <input
                  value={filters.jobId}
                  onChange={updateFilter("jobId")}
                  placeholder="Необязательно"
                />
              </label>
            </div>
          </details>
          <div className="actions">
            <button type="submit" className="secondary">
              Обновить события
            </button>
            <button
              type="button"
              className="primary"
              disabled={exportPending}
              aria-busy={exportPending || undefined}
              onClick={() => exportReport(reportFormat)}
            >
              Скачать диагностический пакет
            </button>
          </div>
          {exportState && (
            <p
              role="status"
              className={exportState.startsWith("Не удалось") ? "error" : undefined}
            >
              {exportState}
            </p>
          )}
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
            <button
              type="button"
              onClick={() => loadEvents(failedEventsCursor ?? undefined)}
            >
              Повторить загрузку событий
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
        {nextCursor && eventsState !== "error" && (
          <button
            type="button"
            disabled={eventsState === "loading"}
            aria-busy={eventsState === "loading" || undefined}
            onClick={() => loadEvents(nextCursor)}
          >
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
              Повторить проверку DEBUG
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
              disabled={debugMutationPending}
              aria-busy={debugMutationPending || undefined}
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
              disabled={debugMutationPending}
              aria-busy={debugMutationPending || undefined}
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
        aria-busy={auditState === "loading" || undefined}
      >
        <h3 id="security-audit-title">Аудит безопасности</h3>
        <p className="muted">Аудит отделён от диагностики транскрибации.</p>
        {auditState === "loading" && (
          <p role="status" className="muted">
            Загружаем события аудита…
          </p>
        )}
        {(auditState === "error" || auditMessage) && (
          <div className="error">
            <p role="alert">
              {auditMessage ||
                "Не удалось загрузить аудит безопасности. Повторите попытку."}
            </p>
            <button type="button" className="secondary" onClick={onRetryAudit}>
              Повторить загрузку аудита
            </button>
          </div>
        )}
        {auditState === "ready" && (
          <ul>
            {visibleAuditEvents.map((event) => (
              <li key={event.id}>
                {auditLabel(event.type)} · {formatTime(event.created_at)}
              </li>
            ))}
          </ul>
        )}
        {auditState === "ready" && auditNextCursor && (
          <button
            type="button"
            className="secondary"
            disabled={auditLoadingMore}
            onClick={onLoadMoreAudit}
          >
            {auditLoadingMore
              ? "Загружаем события…"
              : "Показать ещё события аудита"}
          </button>
        )}
        {auditState === "ready" &&
          visibleAuditEvents.length === 0 &&
          !auditMessage && (
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
      ? { page: "settings", settingsSection: "connections" }
      : initialRoute,
  );
  const page = route.page;
  const settingsSection = route.settingsSection;
  const [requestedProjectId, setRequestedProjectId] = useState<string | null>(
    null,
  );
  const [requestedSourceId, setRequestedSourceId] = useState<string | null>(
    null,
  );
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
    const handler = (event: Event) => {
      const requestedSection = (
        event as CustomEvent<{ section?: SettingsSection }>
      ).detail?.section;
      navigate(
        "settings",
        requestedSection && SETTINGS_SECTION_IDS.includes(requestedSection)
          ? requestedSection
          : "account",
      );
    };
    window.addEventListener("studio:navigate-settings", handler);
    return () =>
      window.removeEventListener("studio:navigate-settings", handler);
  }, []);
  useEffect(() => {
    const handler = (event: Event) => {
      const sourceId = (event as CustomEvent<{ sourceId?: unknown }>).detail
        ?.sourceId;
      if (typeof sourceId !== "string" || sourceId.length === 0) return;
      setRequestedSourceId(sourceId);
      setRequestedProjectId(null);
      navigate("projects");
    };
    window.addEventListener("studio:transcribe-source", handler);
    return () =>
      window.removeEventListener("studio:transcribe-source", handler);
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
  const [logoutState, setLogoutState] = useState({
    pending: false,
    error: "",
  });
  const logoutPendingRef = useRef(false);
  const sessionRequestEpochsRef = useRef(new Map<string, number>());
  const sessionRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );
  const sessionGenerationRef = useRef(0);
  const invalidateSessionBootstrap = () => {
    sessionGenerationRef.current += 1;
    cancelLatestRequests(
      sessionRequestEpochsRef.current,
      sessionRequestControllersRef.current,
    );
  };
  const checkSession = () => {
    const generation = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = generation;
    setSession({ status: "checking", user: null, csrf: "", error: "" });
    void settleLatestRequest(
      sessionRequestEpochsRef.current,
      "platform:session-bootstrap",
      bootstrapSession,
      (result) => {
        if (sessionGenerationRef.current !== generation) return;
        setSession({
          status: "authenticated",
          user: result.user,
          csrf: result.csrf,
          error: "",
        });
        updatePwaDiagnosticsCsrf(result.csrf);
        configurePwaDiagnosticsDebugState({ active: false });
      },
      (err) => {
        if (sessionGenerationRef.current !== generation) return;
        if (err instanceof ApiError && err.status === 401) {
          setSession({ status: "anonymous", user: null, csrf: "", error: "" });
          clearPwaDiagnosticsSession();
          return;
        }
        setSession({
          status: "error",
          user: null,
          csrf: "",
          error: "Не удалось проверить сессию. Повторите попытку.",
        });
      },
      {
        controllers: sessionRequestControllersRef.current,
        timeoutMs: SESSION_BOOTSTRAP_REQUEST_TIMEOUT_MS,
      },
    );
  };
  useEffect(() => {
    checkSession();
    return () => invalidateSessionBootstrap();
  }, []);
  useEffect(() => {
    applyStudioAccentColor(session.user?.accent_color ?? "blue");
  }, [session.user?.accent_color]);
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
          <p className="error" role="alert">{session.error}</p>
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
          invalidateSessionBootstrap();
          logoutPendingRef.current = false;
          setLogoutState({ pending: false, error: "" });
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
  const finishAnonymousLogout = () => {
    invalidateSessionBootstrap();
    logoutPendingRef.current = false;
    setLogoutState({ pending: false, error: "" });
    navigate("dashboard");
    clearSettingsMutationSession();
    setSession({ status: "anonymous", user: null, csrf: "", error: "" });
    clearPwaDiagnosticsSession();
  };
  const showLogoutFailure = () => {
    logoutPendingRef.current = false;
    setLogoutState({
      pending: false,
      error: "Не удалось подтвердить выход. Повторите попытку.",
    });
  };
  const reconcileLogout = (generation: number) => {
    void settleLatestRequest(
      sessionRequestEpochsRef.current,
      "platform:logout-reconcile",
      bootstrapSession,
      (result) => {
        if (sessionGenerationRef.current !== generation) return;
        setSession({
          status: "authenticated",
          user: result.user,
          csrf: result.csrf,
          error: "",
        });
        updatePwaDiagnosticsCsrf(result.csrf);
        configurePwaDiagnosticsDebugState({ active: false });
        showLogoutFailure();
      },
      (failure) => {
        if (sessionGenerationRef.current !== generation) return;
        if (failure instanceof ApiError && failure.status === 401) {
          finishAnonymousLogout();
          return;
        }
        showLogoutFailure();
      },
      {
        controllers: sessionRequestControllersRef.current,
        timeoutMs: SESSION_BOOTSTRAP_REQUEST_TIMEOUT_MS,
      },
    );
  };
  const logout = () => {
    if (logoutPendingRef.current) return;
    invalidateSessionBootstrap();
    const generation = sessionGenerationRef.current;
    logoutPendingRef.current = true;
    setLogoutState({ pending: true, error: "" });
    void settleLatestRequest(
      sessionRequestEpochsRef.current,
      "platform:logout",
      (signal) => requestLogout(csrf, user, signal),
      () => {
        if (sessionGenerationRef.current !== generation) return;
        finishAnonymousLogout();
      },
      () => {
        if (sessionGenerationRef.current !== generation) return;
        reconcileLogout(generation);
      },
      {
        controllers: sessionRequestControllersRef.current,
        timeoutMs: LOGOUT_REQUEST_TIMEOUT_MS,
      },
    );
  };
  return (
    <div className="shell">
      <PlatformSidebar
        page={page}
        onNavigate={(nextPage) => {
          navigate(nextPage);
          if (nextPage === "projects") {
            setRequestedProjectId(null);
            setRequestedSourceId(null);
          }
        }}
      />
      <main>
        {page === "dashboard" && (
          <OverviewPage
            onNavigate={(nextPage) => {
              if (nextPage === "projects") {
                setRequestedProjectId(null);
              }
              navigate(nextPage);
            }}
            onOpenTranscriptions={() => {
              setRequestedProjectId(null);
              navigate("projects");
            }}
          />
        )}
        {projectsOpened && (
          <div hidden={page !== "projects"}>
            <ProjectsPage
              active={page === "projects"}
              ownerUserId={user.email}
              csrf={csrf}
              onCsrf={(token) => {
                setSession((current) => ({ ...current, csrf: token }));
                updatePwaDiagnosticsCsrf(token);
              }}
              requestedProjectId={requestedProjectId}
              onRequestedProjectHandled={() => setRequestedProjectId(null)}
              requestedSourceId={requestedSourceId}
              onRequestedSourceHandled={() => setRequestedSourceId(null)}
            />
          </div>
        )}
        {page === "audio" && (
          <AudioPreparationPage
            csrf={csrf}
            onCsrf={(token) => {
              setSession((current) => ({ ...current, csrf: token }));
              updatePwaDiagnosticsCsrf(token);
            }}
          />
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
            logoutPending={logoutState.pending}
            logoutError={logoutState.error}
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
