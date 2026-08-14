import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App, { __appDiagnosticsTest } from "./App";
import * as googlePicker from "./googlePicker";
import { computeGooglePickerSize } from "./googlePicker";
import {
  clearPwaDiagnosticsSession,
  configurePwaDiagnosticsSession,
  emitPwaDiagnostic,
} from "./pwaDiagnostics";
const originalLocation = window.location;
const json = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
    text: () => Promise.resolve(JSON.stringify(body)),
    blob: () =>
      Promise.resolve(
        body instanceof Blob
          ? body
          : new Blob([JSON.stringify(body)], { type: "application/json" }),
      ),
  } as Response);
function googleConnectionFixture(overrides: Record<string, unknown> = {}) {
  return {
    connected: false,
    status: null,
    google_email: null,
    scopes: null,
    connected_at: null,
    revoked_at: null,
    picker_configured: false,
    picker_scope_ready: false,
    picker_ready: false,
    reconnect_required: false,
    ...overrides,
  };
}
function googleOauthStartFixture(overrides: Record<string, unknown> = {}) {
  return {
    authorization_url:
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=test-client.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fstudio.test%2Fapi%2Fgoogle%2Foauth%2Fcallback&response_type=code&scope=openid+email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file&state=secret-state&access_type=offline&prompt=consent",
    expires_at: "2026-08-13T12:00:00Z",
    ...overrides,
  };
}
function projectFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-fixture",
    title: "Fixture project",
    description: null,
    created_at: "2026-08-13T10:00:00Z",
    updated_at: "2026-08-13T11:00:00Z",
    archived_at: null,
    output_drive_folder_id: null,
    output_drive_folder_url: null,
    output_drive_folder_name: null,
    ...overrides,
  };
}
function credentialFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "credential-fixture",
    provider: "elevenlabs",
    label: "Fixture credential",
    status: "active",
    masked_value: "••••safe",
    active_version: 1,
    ...overrides,
  };
}
function batchPreflightJson(init?: RequestInit) {
  const request = JSON.parse(String(init?.body ?? "{}")) as {
    language?: "ru" | "detect";
    options?: { diarize?: boolean };
    items?: {
      title?: string | null;
      reprocess_existing?: boolean;
      media_clip_start_seconds?: number | null;
      media_clip_end_seconds?: number | null;
    }[];
  };
  const items = request.items ?? [];
  return json({
    provider: "elevenlabs",
    model: "scribe_v2",
    language_mode: request.language ?? "ru",
    diarization_enabled: request.options?.diarize === true,
    existing_result_authority: {
      status: "partial",
      reason_code: "unlinked_catalog_entries_excluded",
    },
    items: items.map((item, position) => ({
      position,
      title: item.title ?? null,
      media_clip:
        item.media_clip_start_seconds != null ||
        item.media_clip_end_seconds != null
          ? {
              start_seconds: item.media_clip_start_seconds ?? null,
              end_seconds: item.media_clip_end_seconds ?? null,
            }
          : null,
      source: {
        name: `Safe source ${position + 1}`,
        source_type: position % 2 === 0 ? "google_drive" : "local_upload",
        mime_type: position % 2 === 0 ? "video/mp4" : "audio/ogg",
        size_bytes: 2048 * (position + 1),
        duration_seconds: null,
      },
      output_destination: { name: `Safe folder ${position + 1}` },
      existing_result_match: {
        status: "no_match",
        accepted_output_count: 0,
        resolution: "not_required",
      },
      provider_attempt_authority: {
        status: "available",
        reason_code: null,
      },
      planned_outcome: "process",
    })),
    summary: {
      process_count: items.length,
      skip_count: 0,
      blocked_count: 0,
    },
    confirmation_required: true,
  });
}

function isBatchPreflightRequest(url: string, init?: RequestInit) {
  return url.endsWith("/jobs/batch/preflight") && init?.method === "POST";
}
function progressStages(
  current:
    | "preparation"
    | "provider_processing"
    | "part_merge"
    | "google_docs_output"
    | null,
  video = true,
) {
  const keys = [
    "preparation",
    "audio_extraction",
    "splitting",
    "provider_processing",
    "part_merge",
    "google_docs_output",
  ];
  const currentIndex = current ? keys.indexOf(current) : -1;
  return keys.map((key, index) => {
    const notApplicable = key === "audio_extraction" && !video;
    return {
      key,
      status: notApplicable
        ? "not_applicable"
        : currentIndex < 0
          ? "pending"
          : index < currentIndex
            ? "completed"
            : index === currentIndex
              ? "active"
              : "pending",
      applicability: notApplicable
        ? "not_applicable"
        : key === "splitting" || key === "part_merge"
          ? "conditional"
          : "required",
    };
  });
}
function renderApp() {
  render(<App />);
}
function postedPwaEventsFrom(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith("/api/diagnostics/pwa-events"))
    .flatMap(
      ([, init]) => JSON.parse(String((init as RequestInit).body)).events,
    );
}

function installFakeGooglePicker() {
  googlePicker.resetGooglePickerLoaderForTests();
  let callback: ((data: unknown) => void) | null = null;
  const viewIds: string[] = [];
  const viewModes: string[] = [];
  const viewParents: string[] = [];
  const includeFolders: boolean[] = [];
  const selectFolderEnabled: boolean[] = [];
  const builderCalls: { method: string; args: unknown[] }[] = [];
  const setVisible = vi.fn();
  class FakeView {
    constructor(viewId: string) {
      viewIds.push(viewId);
    }
    setIncludeFolders(value: boolean) {
      includeFolders.push(value);
      return this;
    }
    setSelectFolderEnabled(value: boolean) {
      selectFolderEnabled.push(value);
      return this;
    }
    setMode(mode: string) {
      viewModes.push(mode);
      return this;
    }
    setParent(parentId: string) {
      viewParents.push(parentId);
      return this;
    }
  }
  class FakeBuilder {
    addView() {
      builderCalls.push({ method: "addView", args: [] });
      return this;
    }
    enableFeature(feature: string) {
      builderCalls.push({ method: "enableFeature", args: [feature] });
      return this;
    }
    setOAuthToken() {
      return this;
    }
    setDeveloperKey() {
      return this;
    }
    setAppId() {
      return this;
    }
    setLocale(locale: string) {
      builderCalls.push({ method: "setLocale", args: [locale] });
      return this;
    }
    setSize(width: number, height: number) {
      builderCalls.push({ method: "setSize", args: [width, height] });
      return this;
    }
    setTitle(title: string) {
      builderCalls.push({ method: "setTitle", args: [title] });
      return this;
    }
    setOrigin(origin: string) {
      builderCalls.push({ method: "setOrigin", args: [origin] });
      return this;
    }
    setMaxItems(maxItems: number) {
      builderCalls.push({ method: "setMaxItems", args: [maxItems] });
      return this;
    }
    setCallback(cb: (data: unknown) => void) {
      builderCalls.push({ method: "setCallback", args: [cb] });
      callback = cb;
      return this;
    }
    build() {
      return { setVisible };
    }
  }
  window.gapi = { load: vi.fn((_name: string, cb: () => void) => cb()) };
  window.google = {
    picker: {
      Action: { PICKED: "picked", CANCEL: "cancel", ERROR: "error" },
      DocsView: FakeView,
      PickerBuilder: FakeBuilder,
      ViewId: { DOCS: "docs", FOLDERS: "folders" },
      DocsViewMode: { LIST: "list" },
      Feature: { MULTISELECT_ENABLED: "multi" },
    },
  };
  return {
    loadScript: async () => {
      const script = await waitFor(() => {
        const node = document.head.querySelector<HTMLScriptElement>(
          'script[data-studio-google-picker="true"]',
        );
        expect(node).not.toBeNull();
        return node;
      });
      script?.onload?.(new Event("load"));
    },
    trigger: (data: unknown) => {
      if (!callback) throw new Error("Picker callback was not registered");
      callback(data);
    },
    waitForCallback: () => waitFor(() => expect(callback).not.toBeNull()),
    setVisible,
    viewIds,
    viewModes,
    viewParents,
    includeFolders,
    selectFolderEnabled,
    builderCalls,
  };
}

type OutputFixtureOptions = {
  jobStatus?: "queued" | "processing" | "completed" | "failed" | "cancelled";
  outputCount?: number;
  outputs?: unknown[];
  detailOk?: boolean;
  outputsOk?: boolean;
  detailErrorBody?: unknown;
  outputsErrorBody?: unknown;
  retryResponse?: unknown;
  reconciliationResponse?: unknown;
  terminalDismissedAt?: string | null;
  includeSecondProject?: boolean;
};

function installFocusedOutputFixture(options: OutputFixtureOptions = {}) {
  const jobStatus = options.jobStatus ?? "processing";
  const outputCount = options.outputCount ?? options.outputs?.length ?? 1;
  const outputs = options.outputs ?? [
    {
      source_id: "source-id-not-rendered",
      source_position: 0,
      source_name: `${jobStatus}-source`,
      source_type: "google_drive",
      output_kind: "transcript",
      transcript_standard: "transcript_doc_v1.2",
      web_view_url: "https://docs.google.com/document/d/focused-safe/edit",
      link_available: true,
      document_character_count: 456,
      document_created_at: "2026-07-02T00:10:00Z",
      persisted_at: "2026-07-02T00:11:00Z",
    },
  ];
  (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/session"))
        return json({
          authenticated: true,
          user: { email: "user@example.com", role: "admin" },
        });
      if (url.endsWith("/api/auth/csrf"))
        return json({ csrf_token: "csrf-after-refresh" });
      if (url.endsWith("/api/projects"))
        return json({
          projects: [
            {
              id: "p1",
              title: "Research calls",
              description: null,
              created_at: "2026-07-01T00:00:00",
              updated_at: "2026-07-01T00:00:00",
              archived_at: null,
              output_drive_folder_id: null,
              output_drive_folder_url: null,
              output_drive_folder_name: null,
            },
            ...(options.includeSecondProject
              ? [
                  {
                    id: "p2",
                    title: "Project Two",
                    description: null,
                    created_at: "2026-07-02T00:00:00",
                    updated_at: "2026-07-02T00:00:00",
                    archived_at: null,
                    output_drive_folder_id: null,
                    output_drive_folder_url: null,
                    output_drive_folder_name: null,
                  },
                ]
              : []),
          ],
        });
      if (url.endsWith("/api/credentials"))
        return json({
          credentials: [
            {
              id: "cred-active",
              provider: "elevenlabs",
              label: "Primary STT",
              status: "active",
              masked_value: "••••1234",
              active_version: 2,
            },
          ],
        });
      if (url.endsWith("/api/projects/p2/sources") && !init?.method)
        return json({ sources: [] });
      if (url.endsWith("/api/projects/p2/jobs") && !init?.method)
        return json({ jobs: [] });
      if (url.endsWith("/api/projects/p1/sources") && !init?.method)
        return json({
          sources: [
            {
              id: "source-focused",
              project_id: "p1",
              source_type: "google_drive",
              original_filename: "focused-source.mp3",
              mime_type: "audio/mpeg",
              size_bytes: 1234,
              drive_file_id: null,
              drive_file_url: null,
              upload_status: "uploaded",
              uploaded_at: "2026-07-01T00:01:00Z",
              expires_at: null,
              deleted_at: null,
              delete_reason: null,
              created_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-01T00:00:00Z",
            },
          ],
        });
      if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
        return json({
          jobs: [
            {
              id: "job-focused",
              project_id: "p1",
              status: jobStatus,
              title: "Focused output job",
              provider: null,
              provider_credential_id: "cred-active",
              terminal_dismissed_at: options.terminalDismissedAt ?? null,
              source_count: 1,
              created_at: "2026-07-02T00:00:00Z",
              updated_at: "2026-07-02T00:01:00Z",
              cancelled_at:
                jobStatus === "cancelled" ? "2026-07-02T00:02:00Z" : null,
              cancel_requested_at: null,
              attempt_count: 1,
              started_at: "2026-07-02T00:00:30Z",
              finished_at: ["completed", "failed", "cancelled"].includes(
                jobStatus,
              )
                ? "2026-07-02T00:03:00Z"
                : null,
              error_code: jobStatus === "failed" ? "SAFE_FAILED" : null,
              error_message: jobStatus === "failed" ? "Safe failure" : null,
            },
          ],
        });
      if (
        options.reconciliationResponse !== undefined &&
        url.endsWith("/api/jobs/job-focused/output-reconciliation") &&
        !init?.method
      )
        return json(options.reconciliationResponse);
      if (
        options.retryResponse !== undefined &&
        url.endsWith("/api/jobs/job-focused/retry") &&
        !init?.method
      )
        return json(options.retryResponse);
      if (url.endsWith("/api/jobs/job-focused/outputs"))
        return options.outputsOk === false
          ? json(
              options.outputsErrorBody ?? { detail: "raw sql traceback token" },
              false,
              500,
            )
          : json({
              job_id: "job-focused",
              job_status: jobStatus,
              output_count: outputCount,
              outputs,
            });
      if (url.endsWith("/api/jobs/job-focused"))
        return options.detailOk === false
          ? json(
              options.detailErrorBody ?? {
                detail: "raw detail traceback token",
              },
              false,
              500,
            )
          : json({
              id: "job-focused",
              project_id: "p1",
              status: jobStatus,
              title: "Focused output job",
              provider: null,
              provider_credential_id: "cred-active",
              terminal_dismissed_at: options.terminalDismissedAt ?? null,
              source_count: 1,
              created_at: "2026-07-02T00:00:00Z",
              updated_at: "2026-07-02T00:01:00Z",
              cancelled_at:
                jobStatus === "cancelled" ? "2026-07-02T00:02:00Z" : null,
              cancel_requested_at: null,
              attempt_count: 1,
              started_at: "2026-07-02T00:00:30Z",
              finished_at: ["completed", "failed", "cancelled"].includes(
                jobStatus,
              )
                ? "2026-07-02T00:03:00Z"
                : null,
              error_code: jobStatus === "failed" ? "SAFE_FAILED" : null,
              error_message: jobStatus === "failed" ? "Safe failure" : null,
              sources: [
                {
                  id: "source-detail-id-not-output-id",
                  project_id: "p1",
                  position: 0,
                  job_source_status: "queued",
                  source_type: "google_drive",
                  original_filename: "focused-source.mp3",
                  mime_type: "audio/mpeg",
                  size_bytes: 1234,
                  drive_file_id: null,
                  drive_file_url: null,
                  upload_status: "uploaded",
                  uploaded_at: "2026-07-01T00:01:00Z",
                  expires_at: null,
                  deleted_at: null,
                  delete_reason: null,
                  created_at: "2026-07-01T00:00:00Z",
                  updated_at: "2026-07-01T00:00:00Z",
                },
              ],
            });
      return json({ credentials: [], events: [] });
    },
  );
}

async function waitForPlatformOverview() {
  expect(
    await screen.findByRole("heading", { name: "Studio" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Обзор", current: "page" }),
  ).toBeInTheDocument();
}

async function openPlatformNavPage(name: "Обзор" | "Проекты" | "Настройки") {
  await waitFor(() =>
    expect(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Обзор",
      }),
    ).toBeInTheDocument(),
  );
  await userEvent.click(
    within(screen.getByRole("navigation")).getByRole("button", { name }),
  );
}

async function openProjectsPage() {
  await openPlatformNavPage("Проекты");
  expect(
    await screen.findByRole("heading", { name: "Проекты" }),
  ).toBeInTheDocument();
}

async function openSelectedProjectJobs() {
  await openProjectsPage();
  await screen.findByRole("form", { name: "Композитор пакетных задач" });
}

async function chooseExistingSource(rowNumber: number, sourceName: string) {
  const select = await screen.findByLabelText(
    `Существующий файл для строки ${rowNumber}`,
  );
  const option = within(select).getByRole("option", {
    name: new RegExp(sourceName),
  });
  await userEvent.selectOptions(select, option);
}

async function chooseResultFolder(
  rowNumber = 1,
  folderId = "folder-123",
  expectedDisplayName?: string,
) {
  vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValueOnce({
    action: "picked",
    docs: [{ id: folderId }],
  } as Awaited<ReturnType<typeof googlePicker.openGooglePicker>>);
  const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
  const previousFetch = fetchMock.getMockImplementation();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (
      url.endsWith("/api/google/picker/session") &&
      init?.method === "POST"
    ) {
      return json({
        access_token: "ya29.test-access-token",
        api_key: "public-picker-key",
        app_id: "123456789",
        scope_ready: true,
      });
    }
    if (
      url.includes("/api/projects/") &&
      url.endsWith("/output-folders/google-picker/verify") &&
      init?.method === "POST"
    ) {
      if (!expectedDisplayName) {
        const previousResponse = await previousFetch?.(url, init);
        if (previousResponse) {
          const candidate = (await previousResponse
            .clone()
            .json()
            .catch(() => null)) as {
            name?: unknown;
            web_view_url?: unknown;
          } | null;
          if (
            candidate &&
            typeof candidate.name === "string" &&
            candidate.name.trim() &&
            (candidate.web_view_url === null ||
              typeof candidate.web_view_url === "string")
          ) {
            return previousResponse;
          }
        }
      }
      return json({
        name: expectedDisplayName ?? "Папка Google Drive",
        web_view_url: `https://drive.google.com/drive/folders/${folderId}`,
      });
    }
    return previousFetch?.(url, init) ?? json({ ok: true });
  });
  await userEvent.click(
    await screen.findByRole("button", {
      name: `Выбрать папку результата для строки ${rowNumber}`,
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", {
        name: `Выбрать папку результата для строки ${rowNumber}`,
      }),
    ).toHaveTextContent("Изменить"),
  );
  if (expectedDisplayName) {
    expect(screen.getAllByText(expectedDisplayName).length).toBeGreaterThan(0);
  }
}

async function reviewAndConfirmBatch() {
  await userEvent.click(
    screen.getByRole("button", { name: /\u041fроверить задачи \(\d+\)/ }),
  );
  await screen.findByLabelText("Проверка перед созданием задач");
  await userEvent.click(
    screen.getByRole("button", {
      name: /\u041fодтвердить и создать \(\d+\)/,
    }),
  );
}

async function openSettingsPage() {
  await openPlatformNavPage("Настройки");
  expect(
    await screen.findByRole("heading", { name: "Настройки аккаунта" }),
  ).toBeInTheDocument();
}

async function openFocusedJobsList() {
  renderApp();
  await openSelectedProjectJobs();
  expect(await screen.findByText("Focused output job")).toBeInTheDocument();
}
describe("Studio PWA", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getDisplayMedia: vi.fn(),
        getUserMedia: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    window.history.replaceState({}, "", "/");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    googlePicker.resetGooglePickerLoaderForTests();
    delete window.gapi;
    delete window.google;
    document.head
      .querySelectorAll('script[data-studio-google-picker="true"]')
      .forEach((node) => node.remove());
    localStorage.clear();
    sessionStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themePreference;
    document.documentElement.style.colorScheme = "";
    let localUploadIndex = 0;
    const localUploadMetadata = new Map<
      string,
      { mime_type: string; size_bytes: number }
    >();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (isBatchPreflightRequest(url, init))
          return batchPreflightJson(init);
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({
            csrf_token: "csrf-after-refresh",
            user: { email: "user@example.com", role: "admin" },
          });
        if (
          url.endsWith("/api/account/preferences") &&
          init?.method === "PATCH"
        ) {
          const payload = JSON.parse(String(init.body));
          return json({
            source_retention_ttl_seconds:
              payload.source_retention_ttl_seconds,
            allowed_source_retention_ttl_seconds: [
              3600, 86400, 259200, 604800, 2592000,
            ],
          });
        }
        if (url.endsWith("/api/account/preferences"))
          return json({
            source_retention_ttl_seconds: 86400,
            allowed_source_retention_ttl_seconds: [
              3600, 86400, 259200, 604800, 2592000,
            ],
          });
        if (url.endsWith("/api/sources/upload-policy"))
          return json({
            local_upload_enabled: true,
            max_upload_bytes: 536870912,
            supported_mime_prefixes: ["audio/", "video/"],
            supported_mime_types: ["application/ogg"],
          });
        if (url.endsWith("/api/auth/bootstrap-status"))
          return json({ bootstrap_required: false });
        if (url.endsWith("/api/auth/login-context"))
          return json({ login_csrf_token: "login-csrf" });
        if (url.endsWith("/api/auth/login"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
            csrf_token: "csrf",
          });
        if (url.endsWith("/api/auth/logout")) return json({ ok: true });
        if (url.endsWith("/api/projects") && init?.method === "POST")
          return json({
            id: "p2",
            title: "Created project",
            description: "",
            created_at: "2026-07-01T00:00:00",
            updated_at: "2026-07-01T00:00:00",
            archived_at: null,
            output_drive_folder_id: null,
            output_drive_folder_url: null,
            output_drive_folder_name: null,
          });
        if (url.includes("/api/projects/") && init?.method === "PATCH")
          return json({
            id: "p1",
            title: "Renamed project",
            description: "",
            created_at: "2026-07-01T00:00:00",
            updated_at: "2026-07-01T00:00:00",
            archived_at: null,
            output_drive_folder_id: null,
            output_drive_folder_url: null,
            output_drive_folder_name: null,
          });
        if (url.endsWith("/archive") && init?.method === "POST")
          return json({ ok: true });
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: "Research calls",
                description: "Customer interview notes",
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
                archived_at: null,
                output_drive_folder_id: "folder-123",
                output_drive_folder_url:
                  "https://drive.example/folders/folder-123",
                output_drive_folder_name: "Transcripts",
              },
            ],
          });
        if (url.endsWith("/api/google/drive/files/drive-file-2/metadata"))
          return json({
            id: "drive-file-2",
            name: "verified-drive-call.mov",
            mime_type: "video/quicktime",
            size_bytes: 1234,
            web_view_link: "https://drive.example/file/2",
            created_time: "2026-07-01T00:00:00Z",
            modified_time: "2026-07-02T00:00:00Z",
            is_folder: false,
          });
        if (url.endsWith("/api/google/drive/folders/folder-children/children"))
          return json({
            folder_id: "folder-children",
            items: [
              {
                id: "child-file-1",
                name: "child-call.mp3",
                mime_type: "audio/mpeg",
                size_bytes: 4096,
                web_view_link: "https://drive.example/file/child-1",
                created_time: "2026-07-03T00:00:00Z",
                modified_time: "2026-07-04T00:00:00Z",
                is_folder: false,
              },
              {
                id: "child-folder-1",
                name: "Nested folder",
                mime_type: "application/vnd.google-apps.folder",
                size_bytes: null,
                web_view_link: "https://drive.example/folder/nested",
                created_time: "2026-07-05T00:00:00Z",
                modified_time: "2026-07-06T00:00:00Z",
                is_folder: true,
              },
            ],
            next_page_token: "next-token",
          });
        if (
          url.endsWith(
            "/api/google/drive/folders/folder-children/children?page_token=next-token",
          )
        )
          return json({
            folder_id: "folder-children",
            items: [
              {
                id: "child-file-2",
                name: "second-child.wav",
                mime_type: "audio/wav",
                size_bytes: null,
                web_view_link: null,
                created_time: null,
                modified_time: "2026-07-07T00:00:00Z",
                is_folder: false,
              },
            ],
            next_page_token: null,
          });
        if (url.endsWith("/api/credentials") && !init?.method)
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
          return json({ jobs: [] });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "s1",
                project_id: "p1",
                source_type: "google_drive",
                original_filename:
                  "Лекция 1. Личность как психологическое явление.flac",
                mime_type: "video/mp4",
                size_bytes: 2048,
                drive_file_id: "drive-file-1",
                drive_file_url: "https://drive.example/file/1",
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:01:00",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
              {
                id: "s-local",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "local-temp.ogg",
                mime_type: "audio/ogg",
                size_bytes: 1024,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:02:00",
                expires_at: "2099-01-02T00:02:00Z",
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
            ],
          });
        if (
          url.endsWith("/api/google/picker/session") &&
          init?.method === "POST"
        )
          return json({
            access_token: "ya29.test-access-token",
            api_key: "public-picker-key",
            app_id: "123456789",
            scope_ready: true,
          });
        if (
          url.endsWith("/api/projects/p1/sources/google-picker") &&
          init?.method === "POST"
        )
          return json({
            sources: [
              {
                id: "s-picker-1",
                project_id: "p1",
                source_type: "google_drive",
                original_filename: "picked-first.mp4",
                mime_type: "video/mp4",
                size_bytes: 10,
                drive_file_url: "https://drive.example/file-1",
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
              {
                id: "s-picker-2",
                project_id: "p1",
                source_type: "google_drive",
                original_filename: "picked-second.mp4",
                mime_type: "video/mp4",
                size_bytes: 20,
                drive_file_url: "https://drive.example/file-2",
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
            ],
          });
        if (
          url.endsWith(
            "/api/projects/p1/output-folders/google-picker/verify",
          ) &&
          init?.method === "POST"
        )
          return json({
            name: "Default folder",
            web_view_url: "https://drive.example/folders/folder-123",
          });
        if (
          url.endsWith("/api/projects/p1/sources/google-drive") &&
          init?.method === "POST"
        )
          return json({ id: "s2" });
        if (
          url.endsWith("/api/projects/p1/sources/local-upload/initiate") &&
          init?.method === "POST"
        ) {
          localUploadIndex += 1;
          const sourceId = `local-source-${localUploadIndex}`;
          const request = JSON.parse(String(init.body)) as {
            mime_type: string;
            size_bytes: number;
          };
          localUploadMetadata.set(sourceId, request);
          return json({
            source_id: sourceId,
            upload: {
              method: "PUT",
              url: `https://upload.example/presigned-${localUploadIndex}`,
              headers: { "Content-Type": request.mime_type },
              expires_in: 900,
            },
          });
        }
        if (url.startsWith("https://upload.example/presigned"))
          return json({}, true, 200);
        if (
          url.includes("/api/sources/local-source-") &&
          url.endsWith("/local-upload/complete") &&
          init?.method === "POST"
        ) {
          const sourceId =
            url.match(/local-source-\d+/)?.[0] ?? "local-source-1";
          const metadata = localUploadMetadata.get(sourceId) ?? {
            mime_type: "audio/ogg",
            size_bytes: 11,
          };
          return json({
            id: sourceId,
            project_id: "p1",
            source_type: "local_upload",
            original_filename: `${sourceId}.ogg`,
            mime_type: metadata.mime_type,
            size_bytes: metadata.size_bytes,
            drive_file_id: null,
            drive_file_url: null,
            upload_status: "uploaded",
            uploaded_at: "2099-01-01T00:00:00Z",
            expires_at: "2099-01-02T00:00:00Z",
            deleted_at: null,
            delete_reason: null,
            created_at: "2026-07-01T00:00:00Z",
            updated_at: "2026-07-01T00:00:00Z",
          });
        }
        if (url.endsWith("/api/sources/s1") && init?.method === "DELETE")
          return json({
            ok: true,
            source_state: "deleted",
            storage_cleanup: "not_applicable",
          });
        if (
          url.endsWith("/api/sources/s-local") &&
          init?.method === "DELETE"
        )
          return json({
            ok: true,
            source_state: "deleted",
            storage_cleanup: "pending",
          });
        if (url.endsWith("/api/credentials") && init?.method === "POST") {
          const request = JSON.parse(String(init.body)) as {
            provider: "elevenlabs" | "openai";
            label: string;
          };
          return json({
            id: "c1",
            provider: request.provider,
            label: request.label,
            status: "active",
            masked_value: "••••safe",
          });
        }
        if (url.endsWith("/replace"))
          return json({
            ok: true,
            active_version: 2,
            masked_value: "••••safe",
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "c1",
                provider: "elevenlabs",
                label: "main",
                status: "active",
                masked_value: "••••1234",
                active_version: 1,
              },
            ],
          });
        if (url.endsWith("/api/audit-events"))
          return json({
            events: [
              {
                id: "e1",
                type: "credential.created",
                created_at: new Date().toISOString(),
              },
            ],
          });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            environment: "production",
            build: { web: "web-safe", api: "api-safe", worker: "worker-safe" },
            google_drive: { connected: true, scope_ready: true },
            provider_credentials: { active_count: 1, ready: true },
            diagnostics: {
              recording_enabled: true,
              debug_recording: "inactive",
              retention_days: 14,
              debug_retention_hours: 24,
            },
            report_limits: { max_days: 7, max_timeline_events: 5000 },
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [],
            next_cursor: null,
            period: {
              start: "2026-07-15T00:00:00",
              end: "2026-07-16T00:00:00",
            },
          });
        if (
          url.endsWith("/api/diagnostics/report.md") &&
          init?.method === "POST"
        )
          return json(new Blob(["# Safe report"], { type: "text/markdown" }));
        if (url.endsWith("/api/google/connection") && init?.method === "DELETE")
          return json(
            googleConnectionFixture({
              status: "revoked",
              google_email: "safe.user@example.com",
              scopes: "https://www.googleapis.com/auth/drive.file",
              connected_at: "2026-07-01T00:00:00",
              revoked_at: "2026-07-02T00:00:00",
            }),
          );
        if (url.endsWith("/api/google/maintenance/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes:
              "openid email https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/documents",
            connected_at: "2026-07-28T00:00:00Z",
            revoked_at: null,
            configured: true,
            account_match: true,
            scope_ready: true,
            ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "openid email https://www.googleapis.com/auth/drive.file",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: true,
            picker_ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/google/oauth/start") && init?.method === "POST")
          return json(googleOauthStartFixture());
        if (
          url.endsWith("/api/projects/p1/jobs/batch") &&
          init?.method === "POST"
        )
          return json({ jobs: [], created_count: 0, replayed: false });
        return json({ ok: true });
      }),
    );
  });
  it("uses the authenticated platform shell as the default app entrypoint", async () => {
    render(<App />);
    await waitForPlatformOverview();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("keeps batch transcription intact and opens Live inside the selected project", async () => {
    renderApp();
    await openProjectsPage();
    expect(
      await screen.findByRole("form", { name: "Композитор пакетных задач" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Пакетная транскрибация" }),
    ).toHaveAttribute("aria-selected", "true");

    await userEvent.click(
      screen.getByRole("tab", { name: "Live-транскрибация" }),
    );
    const livePanel = await screen.findByRole("region", {
      name: "Live-транскрибация",
    });
    expect(livePanel).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Композитор пакетных задач" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Микрофон или аудиовход")).not.toBeChecked();
    expect(screen.getByLabelText("Звук вкладки или экрана")).toBeChecked();
    expect(screen.getByRole("button", { name: "Начать" })).toBeEnabled();
    expect(screen.getByText(/не сохраняется в Studio/i)).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", {
      name: "Основная навигация",
    });
    await userEvent.click(within(navigation).getByRole("button", { name: "Обзор" }));
    await waitFor(() =>
      expect(
        within(navigation).getByRole("button", { name: "Обзор" }),
      ).toHaveAttribute("aria-current", "page"),
    );
    expect(
      screen.getByRole("region", {
        name: "Live-транскрибация",
        hidden: true,
      }),
    ).toBe(livePanel);

    await userEvent.click(
      within(navigation).getByRole("button", { name: "Проекты" }),
    );
    expect(
      await screen.findByRole("region", { name: "Live-транскрибация" }),
    ).toBe(livePanel);

    await userEvent.click(
      screen.getByRole("tab", { name: "Пакетная транскрибация" }),
    );
    expect(
      await screen.findByRole("form", { name: "Композитор пакетных задач" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "Live-транскрибация",
        hidden: true,
      }),
    ).toBe(livePanel);
    expect(livePanel.closest('[role="tabpanel"]')).toHaveAttribute("hidden");
  });

  it("opens approved Drive resource links in new tabs with compact action labels", async () => {
    renderApp();
    await openProjectsPage();

    expect(screen.queryByText("Папка по умолчанию")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: "Открыть папку в Google Drive в новой вкладке",
      }),
    ).not.toBeInTheDocument();

    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    const sourceLink = await screen.findByRole("link", {
      name: "Открыть файл в Google Drive в новой вкладке",
    });
    expect(sourceLink).toHaveAttribute("href", "https://drive.example/file/1");
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(sourceLink).toHaveClass("button-like", "secondary", "resource-link");
    expect(sourceLink.closest(".resource-actions")).not.toBeNull();
    expect(sourceLink).toHaveTextContent("↗");
    expect(
      screen
        .getByRole("button", {
          name: "Убрать из проекта: Лекция 1. Личность как психологическое явление.flac",
        })
        .closest(".resource-actions"),
    ).not.toBeNull();
    expect(screen.getAllByText("Убрать из проекта")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Удалить" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Файл останется на Google Drive."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Временную копию удалит фоновая очистка Studio."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Убрать из проекта: local-temp.ogg" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Хранится до:/)).toBeInTheDocument();
    expect(
      screen.getByText("Лекция 1. Личность как психологическое явление.flac"),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("______");
  });

  it("removes a Drive source only from the active project list", async () => {
    let sourceLoads = 0;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf")) return json({ csrf_token: "csrf" });
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: "Research calls",
                description: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
                archived_at: null,
                output_drive_folder_id: "folder-default",
                output_drive_folder_url:
                  "https://drive.google.com/drive/folders/folder-default",
                output_drive_folder_name: "Default folder",
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
          return json({ jobs: [] });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method) {
          sourceLoads += 1;
          return json({
            sources:
              sourceLoads === 1
                ? [
                    {
                      id: "s1",
                      project_id: "p1",
                      source_type: "google_drive",
                      original_filename:
                        "Лекция 1. Личность как психологическое явление.flac",
                      mime_type: "audio/flac",
                      size_bytes: 2048,
                      drive_file_id: "drive-file-1",
                      drive_file_url:
                        "https://drive.google.com/file/d/drive-file-1/view",
                      upload_status: "uploaded",
                      uploaded_at: "2026-07-01T00:01:00",
                      expires_at: null,
                      deleted_at: null,
                      delete_reason: null,
                      created_at: "2026-07-01T00:00:00",
                      updated_at: "2026-07-01T00:00:00",
                    },
                  ]
                : [],
          });
        }
        if (url.endsWith("/api/sources/s1") && init?.method === "DELETE")
          return json({
            ok: true,
            source_state: "deleted",
            storage_cleanup: "not_applicable",
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "openid email https://www.googleapis.com/auth/drive.file",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: true,
            picker_ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        return json({ ok: true });
      },
    );
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    const removeButton = await screen.findByRole("button", {
      name: "Убрать из проекта: Лекция 1. Личность как психологическое явление.flac",
    });
    await userEvent.click(removeButton);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/sources/s1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) =>
          String(url).includes("google") &&
          ["DELETE", "PATCH", "PUT", "POST"].includes(String(init?.method)),
      ),
    ).toBe(false);
    expect(
      await screen.findByText("Источники пока не добавлены."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Лекция 1. Личность как психологическое явление.flac"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: "Открыть файл в Google Drive в новой вкладке",
      }),
    ).not.toBeInTheDocument();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    expect(screen.queryByText(/Лекция 1\. Личность/)).not.toBeInTheDocument();
  });



  it("fails source removal closed when confirmation throws", async () => {
    vi.spyOn(window, "confirm").mockImplementation(() => {
      throw new Error("confirm unavailable");
    });
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", { name: "Убрать из проекта: local-temp.ogg" }),
    );
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) => String(url).endsWith("/api/sources/s-local") && init?.method === "DELETE",
      ),
    ).toBe(false);
  });

  it("confirms source removal text and sends at most one DELETE", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "Убрать из проекта: Лекция 1. Личность как психологическое явление.flac",
      }),
    );
    expect(confirm).toHaveBeenCalledWith(
      "Источник будет убран только из Studio. Файл останется на Google Drive.",
    );
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) => String(url).endsWith("/api/sources/s1") && init?.method === "DELETE",
      ),
    ).toBe(false);

    confirm.mockReturnValue(true);
    await userEvent.click(
      screen.getByRole("button", { name: "Убрать из проекта: local-temp.ogg" }),
    );
    expect(confirm).toHaveBeenLastCalledWith(
      "Источник будет убран из Studio. Временная копия будет удалена из хранилища после безопасной проверки связанных задач.",
    );
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, init]) => String(url).endsWith("/api/sources/s-local") && init?.method === "DELETE",
      ),
    ).toHaveLength(1);
  });

  it("bounds and deduplicates stalled source deletion before reconciling absence", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const requestSignals: AbortSignal[] = [];
    let deleteStarted = false;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/sources" &&
        !init?.method &&
        deleteStarted
      ) {
        return json({ sources: [] });
      }
      if (url === "/api/sources/s1" && init?.method === "DELETE") {
        deleteStarted = true;
        const signal = init.signal;
        if (!signal) throw new Error("source deletion signal is missing");
        requestSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    const removeButton = screen.getByRole("button", {
      name: "Убрать из проекта: Лекция 1. Личность как психологическое явление.flac",
    });

    vi.useFakeTimers();
    try {
      fireEvent.click(removeButton);
      fireEvent.click(removeButton);
      await act(async () => {
        await Promise.resolve();
      });

      expect(requestSignals).toHaveLength(1);
      expect(removeButton).toBeDisabled();
      expect(removeButton).toHaveAttribute("aria-busy", "true");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(requestSignals[0]?.aborted).toBe(true);
      expect(
        baseFetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/projects/p1/sources" &&
            init?.cache === "no-store",
        ),
      ).toBe(true);
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            url === "/api/sources/s1" && init?.method === "DELETE",
        ),
      ).toHaveLength(1);
      expect(screen.getByText("Файл убран из проекта.")).toBeInTheDocument();
      expect(
        screen.queryByText("Лекция 1. Личность как психологическое явление.flac"),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps a source visible when an ambiguous deletion is not reconciled", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/sources/s1" && init?.method === "DELETE") {
        return Promise.reject(new TypeError("raw transport detail"));
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    const removeButton = screen.getByRole("button", {
      name: "Убрать из проекта: Лекция 1. Личность как психологическое явление.flac",
    });
    await userEvent.click(removeButton);

    expect(
      await screen.findByText(
        "Сервер не подтвердил удаление файла. Список файлов обновлён; подождите и повторите при необходимости.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Лекция 1. Личность как психологическое явление.flac"),
    ).toBeInTheDocument();
    await waitFor(() => expect(removeButton).toBeEnabled());
    expect(removeButton).toHaveAttribute("aria-busy", "false");
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/sources/s1" && init?.method === "DELETE",
      ),
    ).toHaveLength(1);
    expect(document.body).not.toHaveTextContent("raw transport detail");
  });
  it("reports queued background cleanup after removing an uploaded local source", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url.endsWith("/api/sources/s-local") &&
        init?.method === "DELETE"
      )
        return json({
          ok: true,
          source_state: "deleted",
          storage_cleanup: "pending",
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", { name: "Убрать из проекта: local-temp.ogg" }),
    );
    expect(
      await screen.findByText(
        "Файл убран из проекта. Временная копия поставлена в очередь фонового удаления; выбранный срок хранения ждать не нужно.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps a source visible when an inconsistent delete reload fails", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let failSourceReload = false;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        failSourceReload &&
        url.endsWith("/api/projects/p1/sources") &&
        !init?.method
      )
        return json({ detail: "raw source reload failure" }, false, 500);
      if (
        url.endsWith("/api/sources/s-local") &&
        init?.method === "DELETE"
      )
        return json({
          ok: false,
          source_state: "uploaded",
          storage_cleanup: "not_applicable",
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    expect(await screen.findByText("local-temp.ogg")).toBeInTheDocument();
    failSourceReload = true;
    await userEvent.click(
      screen.getByRole("button", { name: "Убрать из проекта: local-temp.ogg" }),
    );

    expect(
      await screen.findByText(
        "Сервер вернул несогласованное подтверждение удаления. Список файлов обновлён.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Не удалось загрузить файлы проекта."),
    ).toBeInTheDocument();
    expect(screen.getByText("local-temp.ogg")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw source reload failure");
    expect(
      screen.queryByText(/Временная копия поставлена в очередь/),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["queued_job_uses_source", "Сначала отмените ожидающие задачи, использующие этот файл."],
    ["processing_job_uses_source", "Дождитесь завершения или отмены текущей обработки."],
    ["retryable_failed_job_uses_source", "Источник нужен для доступного безопасного повтора задачи."],
  ])("shows safe blocked-removal message for %s", async (reason, message) => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/sources/s-local") && init?.method === "DELETE")
        return json({ detail: { reason } }, false, 409);
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", { name: "Убрать из проекта: local-temp.ogg" }),
    );
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("job_");
    expect(document.body.textContent).not.toContain("cleanup_owner");
    expect(document.body.textContent).not.toContain("retry_stage");
  });

  it("keeps the source card and shows a safe ambiguous outcome after a 5xx removal", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf")) return json({ csrf_token: "csrf" });
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: "Research calls",
                description: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
                archived_at: null,
                output_drive_folder_id: null,
                output_drive_folder_url: null,
                output_drive_folder_name: null,
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
          return json({ jobs: [] });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "s1",
                project_id: "p1",
                source_type: "google_drive",
                original_filename: "safe-drive.mp4",
                mime_type: "video/mp4",
                size_bytes: 2048,
                drive_file_id: "drive-file-1",
                drive_file_url:
                  "https://drive.google.com/file/d/drive-file-1/view",
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:01:00",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
            ],
          });
        if (url.endsWith("/api/sources/s1") && init?.method === "DELETE")
          return json({}, false, 500);
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "openid email",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: null,
            picker_configured: false,
            picker_scope_ready: false,
            picker_ready: false,
            reconnect_required: false,
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        return json({ ok: true });
      },
    );
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Убрать из проекта: safe-drive.mp4",
      }),
    );
    expect(
      await screen.findByText(
        "Сервер не подтвердил удаление файла. Список файлов обновлён; подождите и повторите при необходимости.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("safe-drive.mp4")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("удален с Google Drive");
  });

  it("renders actionable dashboard summaries, recent projects, and no permanent onboarding", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/projects") && !init?.method)
        return json({
          projects: [
            {
              id: "older",
              title: "Older",
              description: null,
              created_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-01T00:00:00Z",
              archived_at: null,
              output_drive_folder_id: null,
              output_drive_folder_url: null,
              output_drive_folder_name: null,
            },
            {
              id: "newer",
              title: "Newer",
              description: "Latest notes",
              created_at: "2026-07-02T00:00:00Z",
              updated_at: "2026-07-03T00:00:00Z",
              archived_at: null,
              output_drive_folder_id: "folder-new",
              output_drive_folder_url: "https://drive.example/folders/new",
              output_drive_folder_name: "Ready folder",
            },
          ],
        });
      if (url.endsWith("/api/google/connection"))
        return json({
          connected: true,
          status: "active",
          google_email: "user@example.com",
          scopes: "openid email",
          connected_at: "2026-07-01T00:00:00Z",
          revoked_at: null,
          picker_ready: true,
          picker_configured: true,
          picker_scope_ready: true,
          reconnect_required: false,
        });
      if (url.endsWith("/api/credentials"))
        return json({
          credentials: [
            {
              id: "c1",
              provider: "elevenlabs",
              label: "main",
              status: "active",
              masked_value: "••••1234",
              active_version: 1,
            },
          ],
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await waitForPlatformOverview();
    expect(await screen.findByText("Последние проекты")).toBeInTheDocument();
    expect(screen.getByLabelText("Проекты")).toHaveTextContent("2");
    expect(screen.getByLabelText("Google Drive")).toHaveTextContent(
      "Подключён",
    );
    expect(screen.getByLabelText("Активные ключи")).toHaveTextContent("1");
    expect(
      screen
        .getByText("Newer")
        .compareDocumentPosition(screen.getByText("Older")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("Рабочий процесс")).not.toBeInTheDocument();
    expect(screen.queryByText("Требует внимания")).not.toBeInTheDocument();
  });

  it("renders empty dashboard onboarding and primary project action", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/projects") && !init?.method)
        return json({ projects: [] });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await waitForPlatformOverview();
    expect(await screen.findByText("Рабочий процесс")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Новый проект" }).length,
    ).toBeGreaterThan(0);
  });

  it("keeps successful dashboard data when one dashboard request fails without raw errors", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/connection"))
        return json({ detail: "Traceback raw stack" }, false, 500);
      if (url.endsWith("/api/credentials"))
        return json({
          credentials: [
            {
              id: "c1",
              provider: "elevenlabs",
              label: "main",
              status: "active",
              masked_value: "••••1234",
              active_version: 1,
            },
          ],
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await waitForPlatformOverview();
    expect(await screen.findByText("Последние проекты")).toBeInTheDocument();
    expect(screen.getByLabelText("Проекты")).toHaveTextContent("1");
    expect(screen.getByLabelText("Google Drive")).toHaveTextContent(
      "Недоступно",
    );
    expect(screen.getByLabelText("Активные ключи")).toHaveTextContent("1");
    expect(screen.getByText(/Часть данных панели/)).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Подключите или обновите Google Drive для выбора файлов и папок.",
      ),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Traceback raw stack");
  });

  it("bounds the dashboard Google connection read and retries explicitly", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const connectionSignals: AbortSignal[] = [];
    let connectionReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/google/connection" && !init?.method) {
        connectionReads += 1;
        if (connectionReads > 1) {
          return json(
            googleConnectionFixture({
              connected: true,
              status: "active",
              google_email: "safe.user@example.com",
              scopes: "openid email https://www.googleapis.com/auth/drive.file",
              connected_at: "2026-08-13T12:00:00Z",
              picker_configured: true,
              picker_scope_ready: true,
              picker_ready: true,
            }),
          );
        }
        const signal = init.signal;
        if (!signal) throw new Error("Google connection signal is missing");
        connectionSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await waitForPlatformOverview();
      const card = screen.getByLabelText("Google Drive");
      await waitFor(() => expect(card).toHaveTextContent("Недоступно"));
      expect(connectionSignals).toHaveLength(1);
      expect(connectionSignals[0]?.aborted).toBe(true);
      await userEvent.click(
        within(card).getByRole("button", { name: "Повторить" }),
      );
      await waitFor(() => expect(card).toHaveTextContent("Подключён"));
      expect(connectionReads).toBe(2);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("fails Projects Google connection closed on malformed data and retries", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let connectionReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/google/connection" && !init?.method) {
        connectionReads += 1;
        if (connectionReads === 2) {
          return json(
            googleConnectionFixture({
              connected: true,
              status: null,
              raw_refresh_token: "raw-projects-google-secret",
            }),
          );
        }
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    expect(
      await screen.findByText("Не удалось проверить подключение Google Drive."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
    ).toBeDisabled();
    expect(document.body.textContent).not.toContain("raw-projects-google-secret");
    expect(document.body.textContent).not.toContain("Google Drive не подключён.");

    await userEvent.click(
      screen.getByRole("button", {
        name: "Повторить проверку Google Drive",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
      ).toBeEnabled(),
    );
    expect(connectionReads).toBe(3);
  });

  it("keeps the latest Projects Google state after a late pre-remount read", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let connectionReads = 0;
    let resolveFirstProjectsRead: ((response: Response) => void) | undefined;
    const connected = googleConnectionFixture({
      connected: true,
      status: "active",
      google_email: "safe.user@example.com",
      scopes: "openid email https://www.googleapis.com/auth/drive.file",
      connected_at: "2026-08-13T12:00:00Z",
      picker_configured: true,
      picker_scope_ready: true,
      picker_ready: true,
    });
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/google/connection" && !init?.method) {
        connectionReads += 1;
        if (connectionReads === 1) return json(connected);
        if (connectionReads === 2) {
          return new Promise<Response>((resolve) => {
            resolveFirstProjectsRead = resolve;
          });
        }
        return json(googleConnectionFixture());
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await waitFor(() => expect(resolveFirstProjectsRead).toBeDefined());
    await openSettingsPage();
    await screen.findByText("Google Drive не подключён");
    await openProjectsPage();
    expect(
      await screen.findByText("Google Drive не подключён."),
    ).toBeInTheDocument();
    const driveButton = screen.getByRole("button", { name: "Выбрать файлы Google Drive" });
    expect(driveButton).toBeDisabled();

    await act(async () => resolveFirstProjectsRead?.(await json(connected)));
    expect(screen.getByText("Google Drive не подключён.")).toBeInTheDocument();
    expect(driveButton).toBeDisabled();
    expect(connectionReads).toBe(4);
  });

  it("bounds dashboard project and credential reads with independent retries", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const projectSignals: AbortSignal[] = [];
    const credentialSignals: AbortSignal[] = [];
    let projectReads = 0;
    let credentialReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && !init?.method) {
        projectReads += 1;
        if (projectReads > 1) return defaultFetch?.(url, init) ?? json({ projects: [] });
        const signal = init.signal;
        if (!signal) throw new Error("Project signal is missing");
        projectSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      if (url === "/api/credentials" && !init?.method) {
        credentialReads += 1;
        if (credentialReads > 1)
          return defaultFetch?.(url, init) ?? json({ credentials: [] });
        const signal = init.signal;
        if (!signal) throw new Error("Credential signal is missing");
        credentialSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await waitForPlatformOverview();
      const projectsCard = screen.getByLabelText("Проекты");
      const credentialsCard = screen.getByLabelText("Активные ключи");
      await waitFor(() => expect(projectsCard).toHaveTextContent("Недоступно"));
      await waitFor(() => expect(credentialsCard).toHaveTextContent("Недоступно"));
      expect(screen.getByLabelText("Google Drive")).toHaveTextContent("Подключён");
      expect(projectSignals[0]?.aborted).toBe(true);
      expect(credentialSignals[0]?.aborted).toBe(true);

      await userEvent.click(
        within(projectsCard).getByRole("button", { name: "Повторить" }),
      );
      await userEvent.click(
        within(credentialsCard).getByRole("button", { name: "Повторить" }),
      );
      await waitFor(() => expect(projectsCard).toHaveTextContent("1"));
      await waitFor(() => expect(credentialsCard).toHaveTextContent("1"));
      expect(projectReads).toBe(2);
      expect(credentialReads).toBe(2);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("rejects duplicate dashboard collections without rendering raw fields", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let projectReads = 0;
    let credentialReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && !init?.method) {
        projectReads += 1;
        if (projectReads === 1) {
          return json({
            projects: [
              projectFixture({ id: "duplicate", title: "raw-project-value" }),
              projectFixture({ id: "duplicate", title: "other duplicate" }),
            ],
          });
        }
      }
      if (url === "/api/credentials" && !init?.method) {
        credentialReads += 1;
        if (credentialReads === 1) {
          return json({
            credentials: [
              credentialFixture({
                id: "duplicate",
                masked_value: "raw-credential-value",
              }),
              credentialFixture({ id: "duplicate", label: "duplicate label" }),
            ],
          });
        }
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await waitForPlatformOverview();
    const projectsCard = screen.getByLabelText("Проекты");
    const credentialsCard = screen.getByLabelText("Активные ключи");
    await waitFor(() => expect(projectsCard).toHaveTextContent("Недоступно"));
    await waitFor(() => expect(credentialsCard).toHaveTextContent("Недоступно"));
    expect(document.body.textContent).not.toContain("raw-project-value");
    expect(document.body.textContent).not.toContain("raw-credential-value");

    await userEvent.click(
      within(projectsCard).getByRole("button", { name: "Повторить" }),
    );
    await userEvent.click(
      within(credentialsCard).getByRole("button", { name: "Повторить" }),
    );
    await waitFor(() => expect(projectsCard).toHaveTextContent("1"));
    await waitFor(() => expect(credentialsCard).toHaveTextContent("1"));
  });

  it("ignores a late dashboard project retry after Overview remount", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let projectReads = 0;
    let olderRetrySignal: AbortSignal | undefined;
    let resolveOlderRetry: ((response: Response) => void) | undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && !init?.method) {
        projectReads += 1;
        if (projectReads === 1)
          return json({ detail: "raw-project-failure" }, false, 503);
        if (projectReads === 2) {
          olderRetrySignal = init.signal;
          return new Promise<Response>((resolve) => {
            resolveOlderRetry = resolve;
          });
        }
        if (projectReads === 4) {
          return json({
            projects: [
              projectFixture({ id: "new-1", title: "Newest one" }),
              projectFixture({ id: "new-2", title: "Newest two" }),
            ],
          });
        }
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await waitForPlatformOverview();
    const initialProjectsCard = screen.getByLabelText("Проекты");
    await waitFor(() =>
      expect(initialProjectsCard).toHaveTextContent("Недоступно"),
    );
    await userEvent.click(
      within(initialProjectsCard).getByRole("button", { name: "Повторить" }),
    );
    await waitFor(() => expect(resolveOlderRetry).toBeDefined());

    await openProjectsPage();
    expect(olderRetrySignal?.aborted).toBe(true);
    await openPlatformNavPage("Обзор");
    await waitForPlatformOverview();
    const currentProjectsCard = screen.getByLabelText("Проекты");
    await waitFor(() => expect(currentProjectsCard).toHaveTextContent("2"));
    expect(await screen.findByText("Newest one")).toBeInTheDocument();
    expect(projectReads).toBe(4);

    await act(async () =>
      resolveOlderRetry?.(
        await json({
          projects: [projectFixture({ id: "old", title: "Late older result" })],
        }),
      ),
    );
    expect(currentProjectsCard).toHaveTextContent("2");
    expect(screen.queryByText("Late older result")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw-project-failure");
  });

  it("opens the project creation form only for the dashboard new-project action", async () => {
    renderApp();
    await waitForPlatformOverview();
    await userEvent.click(
      await screen.findByRole("button", { name: "Открыть проекты" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Проекты" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Название проекта")).not.toBeInTheDocument();

    await openPlatformNavPage("Обзор");
    await userEvent.click(
      within(await screen.findByRole("banner")).getByRole("button", {
        name: "Новый проект",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Проекты" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Название проекта"),
    ).toBeInTheDocument();

    await openPlatformNavPage("Обзор");
    await userEvent.click(
      await screen.findByRole("button", { name: "Открыть проекты" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Проекты" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Название проекта")).not.toBeInTheDocument();
  });

  it("keeps the project creation form open after a delayed project browse load", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let delayProjectsRead = false;
    let releaseProjectsRead: (() => void) | undefined;
    const projectsReadGate = new Promise<void>((resolve) => {
      releaseProjectsRead = resolve;
    });
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        delayProjectsRead &&
        url.endsWith("/api/projects") &&
        !init?.method
      ) {
        return projectsReadGate.then(
          () => defaultFetch?.(url, init) ?? json({ ok: true }),
        );
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await waitForPlatformOverview();
    expect(await screen.findByText("Последние проекты")).toBeInTheDocument();

    delayProjectsRead = true;
    await openPlatformNavPage("Проекты");
    expect(
      await screen.findByRole("heading", { name: "Проекты" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Загрузка проектов…")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Новый проект" }));
    expect(
      await screen.findByLabelText("Название проекта"),
    ).toBeInTheDocument();

    await act(async () => {
      releaseProjectsRead?.();
      await projectsReadGate;
    });

    await waitFor(() =>
      expect(screen.queryByText("Загрузка проектов…")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Название проекта")).toBeInTheDocument();
  });

  it("opens a recent project directly in the preparation workspace", async () => {
    renderApp();
    await waitForPlatformOverview();
    await userEvent.click(
      await screen.findByRole("button", { name: /Research calls/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Проекты" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Research calls" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("form", { name: "Композитор пакетных задач" }),
    ).toBeInTheDocument();
  });

  it("Google Picker loader deduplicates success and retries after load failure", async () => {
    googlePicker.resetGooglePickerLoaderForTests();
    window.gapi = { load: vi.fn((_name: string, cb: () => void) => cb()) };
    const first = googlePicker.loadGooglePicker();
    const second = googlePicker.loadGooglePicker();
    expect(first).toBe(second);
    const script = document.head.querySelector<HTMLScriptElement>(
      'script[data-studio-google-picker="true"]',
    );
    expect(script).not.toBeNull();
    script?.onload?.(new Event("load"));
    await expect(first).resolves.toBeUndefined();
    expect(
      document.head.querySelectorAll(
        'script[data-studio-google-picker="true"]',
      ),
    ).toHaveLength(1);

    googlePicker.resetGooglePickerLoaderForTests();
    delete window.gapi;
    document.head
      .querySelectorAll('script[data-studio-google-picker="true"]')
      .forEach((node) => node.remove());
    const failed = googlePicker.loadGooglePicker();
    const failedScript = document.head.querySelector<HTMLScriptElement>(
      'script[data-studio-google-picker="true"]',
    );
    failedScript?.onerror?.(new Event("error"));
    await expect(failed).rejects.toThrow("Google Picker не загрузился");
    expect(
      document.head.querySelector('script[data-studio-google-picker="true"]'),
    ).toBeNull();

    window.gapi = { load: vi.fn((_name: string, cb: () => void) => cb()) };
    const retried = googlePicker.loadGooglePicker();
    document.head
      .querySelector<HTMLScriptElement>(
        'script[data-studio-google-picker="true"]',
      )
      ?.onload?.(new Event("load"));
    await expect(retried).resolves.toBeUndefined();
  });

  it("Google Picker callback normalizes picked/cancel/error and is idempotent without token persistence", async () => {
    googlePicker.resetGooglePickerLoaderForTests();
    window.gapi = { load: vi.fn((_name: string, cb: () => void) => cb()) };
    let callback: ((data: unknown) => void) | null = null;
    class FakeView {
      setIncludeFolders() {
        return this;
      }
      setSelectFolderEnabled() {
        return this;
      }
      setMode() {
        return this;
      }
      setParent() {
        return this;
      }
    }
    class FakeBuilder {
      addView() {
        return this;
      }
      enableFeature() {
        return this;
      }
      setOAuthToken() {
        return this;
      }
      setDeveloperKey() {
        return this;
      }
      setAppId() {
        return this;
      }
      setLocale() {
        return this;
      }
      setSize() {
        return this;
      }
      setTitle() {
        return this;
      }
      setOrigin() {
        return this;
      }
      setMaxItems() {
        return this;
      }
      setCallback(cb: (data: unknown) => void) {
        callback = cb;
        return this;
      }
      build() {
        return { setVisible: vi.fn() };
      }
    }
    window.google = {
      picker: {
        Action: { PICKED: "picked", CANCEL: "cancel", ERROR: "error" },
        DocsView: FakeView,
        PickerBuilder: FakeBuilder,
        ViewId: { DOCS: "docs", FOLDERS: "folders" },
        DocsViewMode: { LIST: "list" },
        Feature: { MULTISELECT_ENABLED: "multi" },
      },
    };
    const pickerSession = {
      access_token: "ya29.secret",
      api_key: "public",
      app_id: "app",
      scope_ready: true,
    };
    const pickedPromise = googlePicker.openGooglePicker("sources", pickerSession);
    expect(pickerSession.access_token).toBe("");
    document.head
      .querySelector<HTMLScriptElement>(
        'script[data-studio-google-picker="true"]',
      )
      ?.onload?.(new Event("load"));
    await waitFor(() => expect(callback).not.toBeNull());
    callback?.({
      action: "picked",
      docs: [{ id: "file-1", name: "Name", mimeType: "audio/mpeg" }],
    });
    callback?.({ action: "error", raw: "raw-google-payload" });
    await expect(pickedPromise).resolves.toEqual({
      action: "picked",
      docs: [{ id: "file-1", name: "Name", mimeType: "audio/mpeg" }],
    });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.body.textContent).not.toContain("ya29.secret");

    callback = null;
    const cancelPromise = googlePicker.openGooglePicker("output-folder", {
      access_token: "ya29.cancel",
      api_key: "public",
      app_id: "app",
      scope_ready: true,
    });
    await waitFor(() => expect(callback).not.toBeNull());
    callback?.({ action: "cancel" });
    await expect(cancelPromise).resolves.toEqual({ action: "cancel" });

    callback = null;
    const errorPromise = googlePicker.openGooglePicker("sources", {
      access_token: "ya29.error",
      api_key: "public",
      app_id: "app",
      scope_ready: true,
    });
    await waitFor(() => expect(callback).not.toBeNull());
    callback?.({ action: "error", raw: "raw-google-payload" });
    await expect(errorPromise).resolves.toEqual({
      action: "error",
      message: "Google Picker вернул ошибку. Повторите попытку.",
    });
    expect(document.body.textContent).not.toContain("raw-google-payload");
  });

  it("computes deterministic Google Picker sizes within viewport and minimum constraints", () => {
    expect(computeGooglePickerSize(1920, 1080)).toEqual({
      width: 1051,
      height: 650,
    });
    expect(computeGooglePickerSize(1366, 768)).toEqual({
      width: 1051,
      height: 650,
    });
    expect(computeGooglePickerSize(800, 600)).toEqual({
      width: 752,
      height: 552,
    });
    expect(computeGooglePickerSize(480, 320)).toEqual({
      width: 566,
      height: 350,
    });
    const computed = computeGooglePickerSize(1024.8, 700.2);
    expect(Number.isInteger(computed.width)).toBe(true);
    expect(Number.isInteger(computed.height)).toBe(true);
  });

  it("configures Google Picker source and folder presentations separately", async () => {
    googlePicker.resetGooglePickerLoaderForTests();
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1366,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 768,
    });
    let callback: ((data: unknown) => void) | null = null;
    const viewIds: string[] = [];
    const viewModes: string[] = [];
    const viewParents: string[] = [];
    const includeFolders: boolean[] = [];
    const viewMimeTypes: string[] = [];
    const selectFolderEnabled: boolean[] = [];
    const builderCalls: { method: string; args: unknown[] }[] = [];
    class FakeView {
      constructor(viewId: string) {
        viewIds.push(viewId);
      }
      setIncludeFolders(value: boolean) {
        includeFolders.push(value);
        return this;
      }
      setMimeTypes(mimeTypes: string) {
        viewMimeTypes.push(mimeTypes);
        return this;
      }
      setSelectFolderEnabled(value: boolean) {
        selectFolderEnabled.push(value);
        return this;
      }
      setMode(mode: string) {
        viewModes.push(mode);
        return this;
      }
      setParent(parentId: string) {
        viewParents.push(parentId);
        return this;
      }
    }
    class FakeBuilder {
      addView() {
        return this;
      }
      enableFeature(feature: string) {
        builderCalls.push({ method: "enableFeature", args: [feature] });
        return this;
      }
      setOAuthToken(token: string) {
        builderCalls.push({ method: "setOAuthToken", args: [token] });
        return this;
      }
      setDeveloperKey(key: string) {
        builderCalls.push({ method: "setDeveloperKey", args: [key] });
        return this;
      }
      setAppId(appId: string) {
        builderCalls.push({ method: "setAppId", args: [appId] });
        return this;
      }
      setLocale(locale: string) {
        builderCalls.push({ method: "setLocale", args: [locale] });
        return this;
      }
      setSize(width: number, height: number) {
        builderCalls.push({ method: "setSize", args: [width, height] });
        return this;
      }
      setTitle(title: string) {
        builderCalls.push({ method: "setTitle", args: [title] });
        return this;
      }
      setOrigin(origin: string) {
        builderCalls.push({ method: "setOrigin", args: [origin] });
        return this;
      }
      setMaxItems(maxItems: number) {
        builderCalls.push({ method: "setMaxItems", args: [maxItems] });
        return this;
      }
      setSelectableMimeTypes(mimeTypes: string) {
        builderCalls.push({
          method: "setSelectableMimeTypes",
          args: [mimeTypes],
        });
        return this;
      }
      setCallback(cb: (data: unknown) => void) {
        builderCalls.push({ method: "setCallback", args: [cb] });
        callback = cb;
        return this;
      }
      build() {
        return { setVisible: vi.fn() };
      }
    }
    window.gapi = { load: vi.fn((_name: string, cb: () => void) => cb()) };
    window.google = {
      picker: {
        Action: { PICKED: "picked", CANCEL: "cancel", ERROR: "error" },
        DocsView: FakeView,
        PickerBuilder: FakeBuilder,
        ViewId: { DOCS: "docs", FOLDERS: "folders" },
        DocsViewMode: { LIST: "list" },
        Feature: { MULTISELECT_ENABLED: "multi" },
      },
    };

    const sourcePromise = googlePicker.openGooglePicker("sources", {
      access_token: "ya29.source",
      api_key: "public",
      app_id: "app",
      scope_ready: true,
    });
    document.head
      .querySelector<HTMLScriptElement>(
        'script[data-studio-google-picker="true"]',
      )
      ?.onload?.(new Event("load"));
    await waitFor(() => expect(callback).not.toBeNull());
    callback?.({ action: "cancel" });
    await expect(sourcePromise).resolves.toEqual({ action: "cancel" });

    callback = null;
    const folderPromise = googlePicker.openGooglePicker("output-folder", {
      access_token: "ya29.folder",
      api_key: "public",
      app_id: "app",
      scope_ready: true,
    });
    await waitFor(() => expect(callback).not.toBeNull());
    callback?.({ action: "cancel" });
    await expect(folderPromise).resolves.toEqual({ action: "cancel" });

    callback = null;
    const catalogFolderPromise = googlePicker.openGooglePicker(
      "catalog-folder",
      {
        access_token: "ya29.catalog",
        api_key: "public",
        app_id: "app",
        scope_ready: true,
      },
    );
    await waitFor(() => expect(callback).not.toBeNull());
    callback?.({ action: "cancel" });
    await expect(catalogFolderPromise).resolves.toEqual({ action: "cancel" });

    callback = null;
    const transcriptFolderPromise = googlePicker.openGooglePicker(
      "transcript-folder",
      {
        access_token: "ya29.transcript-folder",
        api_key: "public",
        app_id: "app",
        scope_ready: true,
      },
    );
    await waitFor(() => expect(callback).not.toBeNull());
    callback?.({ action: "cancel" });
    await expect(transcriptFolderPromise).resolves.toEqual({
      action: "cancel",
    });

    callback = null;
    const transcriptDocumentPromise = googlePicker.openGooglePicker(
      "transcript-document",
      {
        access_token: "ya29.transcript-document",
        api_key: "public",
        app_id: "app",
        scope_ready: true,
      },
    );
    await waitFor(() => expect(callback).not.toBeNull());
    callback?.({ action: "cancel" });
    await expect(transcriptDocumentPromise).resolves.toEqual({
      action: "cancel",
    });

    expect(viewIds).toEqual([
      "docs",
      "folders",
      "folders",
      "folders",
      "docs",
    ]);
    expect(viewModes).toEqual(["list", "list", "list", "list", "list"]);
    expect(viewParents).toEqual(["root", "root", "root", "root", "root"]);
    expect(includeFolders).toEqual([true, true, true, true, true]);
    expect(viewMimeTypes).toEqual([
      "application/vnd.google-apps.document",
    ]);
    expect(selectFolderEnabled).toEqual([true, true, true]);
    expect(builderCalls).toContainEqual({ method: "setLocale", args: ["ru"] });
    expect(builderCalls).toContainEqual({
      method: "setTitle",
      args: ["Выберите аудио или видео"],
    });
    expect(builderCalls).toContainEqual({
      method: "setTitle",
      args: ["Выберите папку для результатов"],
    });
    expect(builderCalls).toContainEqual({
      method: "setTitle",
      args: ["Выберите папку каталога транскриптов"],
    });
    expect(builderCalls).toContainEqual({
      method: "setTitle",
      args: ["Выберите папку с транскриптами"],
    });
    expect(builderCalls).toContainEqual({
      method: "setTitle",
      args: ["Выберите один Google Doc"],
    });
    expect(builderCalls).toContainEqual({
      method: "setSize",
      args: [1051, 650],
    });
    expect(builderCalls).toContainEqual({
      method: "setOrigin",
      args: [window.location.origin],
    });
    expect(builderCalls).toContainEqual({
      method: "setOAuthToken",
      args: ["ya29.source"],
    });
    expect(builderCalls).toContainEqual({
      method: "setOAuthToken",
      args: ["ya29.folder"],
    });
    expect(builderCalls).toContainEqual({
      method: "setOAuthToken",
      args: ["ya29.catalog"],
    });
    expect(builderCalls).toContainEqual({
      method: "setOAuthToken",
      args: ["ya29.transcript-folder"],
    });
    expect(builderCalls).toContainEqual({
      method: "setOAuthToken",
      args: ["ya29.transcript-document"],
    });
    expect(builderCalls).toContainEqual({
      method: "setDeveloperKey",
      args: ["public"],
    });
    expect(builderCalls).toContainEqual({ method: "setAppId", args: ["app"] });
    expect(builderCalls).toContainEqual({ method: "setMaxItems", args: [50] });
    expect(builderCalls).toContainEqual({ method: "setMaxItems", args: [1] });
    expect(builderCalls).toContainEqual({
      method: "setSelectableMimeTypes",
      args: ["application/vnd.google-apps.document"],
    });
    expect(
      builderCalls.filter((call) => call.method === "enableFeature"),
    ).toEqual([{ method: "enableFeature", args: ["multi"] }]);
    expect(
      builderCalls.filter((call) => call.method === "setCallback"),
    ).toHaveLength(5);
    expect(
      builderCalls.some((call) => call.args.includes("support_drives")),
    ).toBe(false);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it("refreshes in-memory CSRF and renders settings without browser storage secrets", async () => {
    renderApp();
    await waitForPlatformOverview();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/csrf",
      expect.objectContaining({ method: "POST" }),
    );
    await openSettingsPage();
    await screen.findByText(/Ключи провайдеров/);
    expect(
      screen.getByRole("heading", {
        name: "Стандартизация Google Docs",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Манифест Studio",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/••••1234/)).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("persists the local-source retention choice through account settings", async () => {
    renderApp();
    await openSettingsPage();

    const retention = await screen.findByRole("combobox", {
      name: "Срок хранения локальных файлов",
    });
    expect(
      screen.getByText(/приватном объектном хранилище \(S3\/R2\)/),
    ).toHaveTextContent(
      "Ссылки на Google Drive и результаты Google Docs не затрагиваются.",
    );
    expect(retention).toHaveValue("86400");
    expect(
      within(retention).getByRole("option", { name: "1 час" }),
    ).toBeInTheDocument();
    expect(
      within(retention).getByRole("option", { name: "30 дней" }),
    ).toBeInTheDocument();

    await userEvent.selectOptions(retention, "604800");
    await userEvent.click(
      screen.getByRole("button", { name: "Сохранить срок" }),
    );

    await screen.findByText("Срок хранения сохранён.");
    expect(fetch).toHaveBeenCalledWith(
      "/api/account/preferences",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "x-csrf-token": "csrf-after-refresh",
        }),
        body: JSON.stringify({ source_retention_ttl_seconds: 604800 }),
      }),
    );
    expect(retention).toHaveValue("604800");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("bounds a stalled retention read and fails closed with retry", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const retentionSignals: AbortSignal[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/account/preferences" && !init?.method) {
        const signal = init.signal;
        if (!signal) throw new Error("retention-read signal is missing");
        retentionSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openSettingsPage();
      expect(
        await screen.findByText(
          "Не удалось загрузить настройку хранения. Повторите попытку.",
        ),
      ).toBeInTheDocument();
      expect(retentionSignals).toHaveLength(1);
      expect(retentionSignals[0]?.aborted).toBe(true);
      expect(screen.getByRole("button", { name: "Повторить" })).toBeEnabled();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("rejects a malformed retention response before rendering choices", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) =>
      url === "/api/account/preferences" && !init?.method
        ? json({
            source_retention_ttl_seconds: 86400,
            allowed_source_retention_ttl_seconds: [86400],
          })
        : (defaultFetch?.(url, init) ?? json({ ok: true })),
    );

    renderApp();
    await openSettingsPage();
    expect(
      await screen.findByText(
        "Не удалось загрузить настройку хранения. Повторите попытку.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", {
        name: "Срок хранения локальных файлов",
      }),
    ).not.toBeInTheDocument();
  });

  it("bounds and deduplicates retention save with authoritative confirmation", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const mutationSignals: AbortSignal[] = [];
    let serverTtl = 86400;
    let preferenceReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/account/preferences" && !init?.method) {
        preferenceReads += 1;
        return json({
          source_retention_ttl_seconds: serverTtl,
          allowed_source_retention_ttl_seconds: [
            3600, 86400, 259200, 604800, 2592000,
          ],
        });
      }
      if (url === "/api/account/preferences" && init?.method === "PATCH") {
        serverTtl = JSON.parse(String(init.body)).source_retention_ttl_seconds;
        const signal = init.signal;
        if (!signal) throw new Error("retention-save signal is missing");
        mutationSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    const retention = await screen.findByRole("combobox", {
      name: "Срок хранения локальных файлов",
    });
    await userEvent.selectOptions(retention, "604800");
    const form = retention.closest("form");
    if (!form) throw new Error("retention form is missing");
    const readsBeforeMutation = preferenceReads;

    vi.useFakeTimers();
    try {
      fireEvent.submit(form);
      fireEvent.submit(form);
      await act(async () => {
        await Promise.resolve();
      });
      expect(mutationSignals).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Сохраняем…" })).toBeDisabled();
      expect(form).toHaveAttribute("aria-busy", "true");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      vi.useRealTimers();
      expect(
        await screen.findByText(
          "Сохранение срока подтверждено по актуальной настройке аккаунта.",
        ),
      ).toBeInTheDocument();
      expect(mutationSignals[0]?.aborted).toBe(true);
      expect(preferenceReads).toBe(readsBeforeMutation + 1);
      expect(retention).toHaveValue("604800");
      expect(screen.getByRole("button", { name: "Сохранить срок" })).toBeEnabled();
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            url === "/api/account/preferences" && init?.method === "PATCH",
        ),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps retention mutation ownership and result across Settings remount", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let serverTtl = 86400;
    let preferenceReads = 0;
    let resolvePatch: ((response: Response) => void) | undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/account/preferences" && !init?.method) {
        preferenceReads += 1;
        return json({
          source_retention_ttl_seconds: serverTtl,
          allowed_source_retention_ttl_seconds: [
            3600, 86400, 259200, 604800, 2592000,
          ],
        });
      }
      if (url === "/api/account/preferences" && init?.method === "PATCH") {
        return new Promise<Response>((resolve) => {
          resolvePatch = resolve;
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    const retention = await screen.findByRole("combobox", {
      name: "Срок хранения локальных файлов",
    });
    await userEvent.selectOptions(retention, "604800");
    const form = retention.closest("form");
    if (!form) throw new Error("retention form is missing");
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(resolvePatch).toBeDefined());
    expect(screen.getByRole("button", { name: "Сохраняем…" })).toBeDisabled();

    await openProjectsPage();
    await openSettingsPage();
    expect(
      await screen.findByRole("button", { name: "Сохраняем…" }),
    ).toBeDisabled();
    serverTtl = 604800;
    const failedResponse = await json(
      { detail: "raw-retention-failure-must-not-render" },
      false,
      503,
    );
    await act(async () => resolvePatch?.(failedResponse));
    expect(
      await screen.findByText(
        "Сохранение срока подтверждено по актуальной настройке аккаунта.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", {
          name: "Срок хранения локальных файлов",
        }),
      ).toHaveValue("604800"),
    );
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/account/preferences" && init?.method === "PATCH",
      ),
    ).toHaveLength(1);
    expect(document.body.textContent).not.toContain(
      "raw-retention-failure-must-not-render",
    );

    const readsBeforeFinalReopen = preferenceReads;
    await openProjectsPage();
    await openSettingsPage();
    await screen.findByRole("combobox", {
      name: "Срок хранения локальных файлов",
    });
    expect(preferenceReads).toBe(readsBeforeFinalReopen + 1);
  });

  it("restores a different authoritative retention value after ambiguity", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let preferenceReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/account/preferences" && !init?.method) {
        preferenceReads += 1;
        return json({
          source_retention_ttl_seconds:
            preferenceReads === 1 ? 86400 : 259200,
          allowed_source_retention_ttl_seconds: [
            3600, 86400, 259200, 604800, 2592000,
          ],
        });
      }
      if (url === "/api/account/preferences" && init?.method === "PATCH")
        return json({ detail: "raw-ambiguous-retention" }, false, 503);
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    const retention = await screen.findByRole("combobox", {
      name: "Срок хранения локальных файлов",
    });
    await userEvent.selectOptions(retention, "604800");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить срок" }));
    expect(
      await screen.findByText(
        "Сервер не подтвердил сохранение. Показано актуальное значение; проверьте его перед повторной попыткой.",
      ),
    ).toBeInTheDocument();
    expect(retention).toHaveValue("259200");
    expect(document.body.textContent).not.toContain("raw-ambiguous-retention");
  });
  it("restores the last confirmed retention value when reconciliation fails", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let preferenceReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/account/preferences" && !init?.method) {
        preferenceReads += 1;
        return preferenceReads === 1
          ? json({
              source_retention_ttl_seconds: 86400,
              allowed_source_retention_ttl_seconds: [
                3600, 86400, 259200, 604800, 2592000,
              ],
            })
          : json({ detail: "raw-retention-read-failure" }, false, 500);
      }
      if (url === "/api/account/preferences" && init?.method === "PATCH")
        return json({ detail: "raw-retention-write-failure" }, false, 503);
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    const retention = await screen.findByRole("combobox", {
      name: "Срок хранения локальных файлов",
    });
    await userEvent.selectOptions(retention, "604800");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить срок" }));
    expect(
      await screen.findByText(
        "Сервер не подтвердил сохранение, а обновить настройку не удалось. Сохранено последнее подтверждённое значение; обновите страницу перед повторной попыткой.",
      ),
    ).toBeInTheDocument();
    expect(retention).toHaveValue("86400");
    expect(document.body.textContent).not.toContain("raw-retention-read-failure");
    expect(document.body.textContent).not.toContain("raw-retention-write-failure");
  });
  it("renders disconnected Google Drive state", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/connection"))
        return json(googleConnectionFixture());
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openSettingsPage();
    expect(
      await screen.findByText("Google Drive не подключён"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Подключите Google Drive, чтобы выбирать файлы и папку результатов.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Подключить Google Drive" }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/google/connection",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("renders connected Google Drive safe metadata without raw tokens", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/google/connection"))
          return json(
            googleConnectionFixture({
              connected: true,
              status: "active",
              google_email: "safe.user@example.com",
              scopes: "https://www.googleapis.com/auth/drive.file",
              connected_at: "2026-07-01T00:00:00",
              picker_configured: true,
              picker_scope_ready: true,
              picker_ready: true,
              refresh_token: "raw-refresh-token-never-render",
            }),
          );
        return json({ ok: true });
      },
    );
    renderApp();
    await openSettingsPage();
    expect(
      await screen.findByText("Google Drive подключён"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Подключите Google Drive, чтобы выбирать файлы и папку результатов.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("safe.user@example.com")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(
      screen.getByText("https://www.googleapis.com/auth/drive.file"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("raw-refresh-token-never-render"),
    ).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("starts Google OAuth with CSRF and navigates without storing OAuth data", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/connection"))
        return json(googleConnectionFixture());
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true,
    });
    renderApp();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Подключить Google Drive" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/google/oauth/start",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const startCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]) => url === "/api/google/oauth/start");
    expect(startCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(assign).toHaveBeenCalledWith(
      String(googleOauthStartFixture().authorization_url),
    );
    expect(document.body).not.toHaveTextContent("secret-state");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("disconnects Google Drive with CSRF", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            environment: "production",
            build: { web: "web-safe", api: "api-safe", worker: "worker-safe" },
            google_drive: { connected: true, scope_ready: true },
            provider_credentials: { active_count: 1, ready: true },
            diagnostics: {
              recording_enabled: true,
              debug_recording: "inactive",
              retention_days: 14,
              debug_retention_hours: 24,
            },
            report_limits: { max_days: 7, max_timeline_events: 5000 },
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [],
            next_cursor: null,
            period: {
              start: "2026-07-15T00:00:00",
              end: "2026-07-16T00:00:00",
            },
          });
        if (
          url.endsWith("/api/diagnostics/report.md") &&
          init?.method === "POST"
        )
          return json(new Blob(["# Safe report"], { type: "text/markdown" }));
        if (url.endsWith("/api/google/connection") && init?.method === "DELETE")
          return json(
            googleConnectionFixture({
              status: "revoked",
              google_email: "safe.user@example.com",
              scopes: "https://www.googleapis.com/auth/drive.file",
              connected_at: "2026-07-01T00:00:00",
              revoked_at: "2026-07-02T00:00:00",
            }),
          );
        if (url.endsWith("/api/google/connection"))
          return json(
            googleConnectionFixture({
              connected: true,
              status: "active",
              google_email: "safe.user@example.com",
              scopes: "https://www.googleapis.com/auth/drive.file",
              connected_at: "2026-07-01T00:00:00",
              picker_configured: true,
              picker_scope_ready: true,
              picker_ready: true,
            }),
          );
        return json({ ok: true });
      },
    );
    renderApp();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Отключить Google Drive" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/google/connection",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    const deleteCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url, init]) =>
        url === "/api/google/connection" && init?.method === "DELETE",
    );
    expect(deleteCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(await screen.findByText(/Статус: revoked/)).toBeInTheDocument();
  });

  it("bounds stalled Google connection reads and exposes an explicit retry", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const connectionSignals: AbortSignal[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/google/connection" && !init?.method) {
        const signal = init.signal;
        if (!signal) throw new Error("Google connection signal is missing");
        connectionSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openSettingsPage();
      expect(
        await screen.findByText(
          "Не удалось загрузить статус Google Drive. Повторите попытку.",
        ),
      ).toBeInTheDocument();
      expect(connectionSignals).toHaveLength(2);
      expect(connectionSignals.every((signal) => signal.aborted)).toBe(true);
      const retry = screen.getByRole("button", {
        name: "Повторить проверку Google Drive",
      });
      await userEvent.click(retry);
      await waitFor(() => expect(connectionSignals).toHaveLength(3));
      await waitFor(() => expect(connectionSignals[2]?.aborted).toBe(true));
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("rejects malformed Google connection state without rendering raw fields", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) =>
      url === "/api/google/connection" && !init?.method
        ? json(
            googleConnectionFixture({
              connected: true,
              status: null,
              raw_refresh_token: "raw-google-connection-secret",
            }),
          )
        : (defaultFetch?.(url, init) ?? json({ ok: true })),
    );

    renderApp();
    await openSettingsPage();
    expect(
      await screen.findByText(
        "Не удалось загрузить статус Google Drive. Повторите попытку.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Подключить Google Drive" }),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(
      "raw-google-connection-secret",
    );
  });

  it("bounds and deduplicates OAuth start without replay after ambiguity", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const mutationSignals: AbortSignal[] = [];
    let connectionReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/google/connection" && !init?.method) {
        connectionReads += 1;
        return json(googleConnectionFixture());
      }
      if (url === "/api/google/oauth/start" && init?.method === "POST") {
        const signal = init.signal;
        if (!signal) throw new Error("Google OAuth start signal is missing");
        mutationSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true,
    });

    renderApp();
    await openSettingsPage();
    const connect = await screen.findByRole("button", {
      name: "Подключить Google Drive",
    });
    const readsBeforeMutation = connectionReads;
    vi.useFakeTimers();
    try {
      fireEvent.click(connect);
      fireEvent.click(connect);
      await act(async () => Promise.resolve());
      expect(mutationSignals).toHaveLength(1);
      expect(connect).toBeDisabled();
      expect(connect).toHaveAttribute("aria-busy", "true");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      vi.useRealTimers();
      expect(
        await screen.findByText(
          "Сервер не подтвердил начало подключения. Статус Google Drive обновлён; не повторяйте запрос, пока не проверите состояние подключения.",
        ),
      ).toBeInTheDocument();
      expect(mutationSignals[0]?.aborted).toBe(true);
      expect(connectionReads).toBe(readsBeforeMutation + 1);
      expect(assign).not.toHaveBeenCalled();
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            url === "/api/google/oauth/start" && init?.method === "POST",
        ),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects an untrusted OAuth URL and performs one safe reconciliation", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let connectionReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/google/connection" && !init?.method) {
        connectionReads += 1;
        return json(googleConnectionFixture());
      }
      if (url === "/api/google/oauth/start" && init?.method === "POST")
        return json(
          googleOauthStartFixture({
            authorization_url:
              "https://evil.example/oauth?state=raw-google-oauth-secret",
          }),
        );
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true,
    });

    renderApp();
    await openSettingsPage();
    const readsBeforeMutation = connectionReads;
    await userEvent.click(
      await screen.findByRole("button", { name: "Подключить Google Drive" }),
    );
    expect(
      await screen.findByText(
        "Сервер не подтвердил начало подключения. Статус Google Drive обновлён; не повторяйте запрос, пока не проверите состояние подключения.",
      ),
    ).toBeInTheDocument();
    expect(connectionReads).toBe(readsBeforeMutation + 1);
    expect(assign).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("raw-google-oauth-secret");
  });

  it("keeps disconnect ownership and outcome across a Settings remount", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let connectionReads = 0;
    let serverDisconnected = false;
    let resolveDelete: ((response: Response) => void) | undefined;
    const activeConnection = () =>
      googleConnectionFixture({
        connected: true,
        status: "active",
        google_email: "safe.user@example.com",
        scopes: "openid email https://www.googleapis.com/auth/drive.file",
        connected_at: "2026-07-01T00:00:00Z",
        picker_configured: true,
        picker_scope_ready: true,
        picker_ready: true,
      });
    const revokedConnection = () =>
      googleConnectionFixture({
        status: "revoked",
        google_email: "safe.user@example.com",
        scopes: "openid email https://www.googleapis.com/auth/drive.file",
        connected_at: "2026-07-01T00:00:00Z",
        revoked_at: "2026-08-13T12:00:00Z",
      });
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/google/connection" && !init?.method) {
        connectionReads += 1;
        return json(serverDisconnected ? revokedConnection() : activeConnection());
      }
      if (url === "/api/google/connection" && init?.method === "DELETE")
        return new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    const disconnect = await screen.findByRole("button", {
      name: "Отключить Google Drive",
    });
    fireEvent.click(disconnect);
    fireEvent.click(disconnect);
    await waitFor(() => expect(resolveDelete).toBeDefined());
    await openProjectsPage();
    await openSettingsPage();
    expect(
      await screen.findByRole("button", { name: "Отключить Google Drive" }),
    ).toBeDisabled();

    serverDisconnected = true;
    const failedResponse = await json(
      { detail: "raw-google-disconnect-failure" },
      false,
      503,
    );
    await act(async () => resolveDelete?.(failedResponse));
    expect(
      await screen.findByText(
        "Отключение Google Drive подтверждено по актуальному состоянию.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Google Drive не подключён")).toBeInTheDocument();
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/google/connection" && init?.method === "DELETE",
      ),
    ).toHaveLength(1);
    expect(document.body.textContent).not.toContain(
      "raw-google-disconnect-failure",
    );

    const readsBeforeFinalReopen = connectionReads;
    await openProjectsPage();
    await openSettingsPage();
    await screen.findByText("Google Drive не подключён");
    expect(connectionReads).toBe(readsBeforeFinalReopen + 2);
  });

  it("keeps the authoritative connected state after an ambiguous disconnect", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let connectionReads = 0;
    const activeConnection = googleConnectionFixture({
      connected: true,
      status: "active",
      google_email: "safe.user@example.com",
      scopes: "openid email https://www.googleapis.com/auth/drive.file",
      connected_at: "2026-07-01T00:00:00Z",
      picker_configured: true,
      picker_scope_ready: true,
      picker_ready: true,
    });
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/google/connection" && !init?.method) {
        connectionReads += 1;
        return json(activeConnection);
      }
      if (url === "/api/google/connection" && init?.method === "DELETE")
        return json({ detail: "raw-google-still-connected" }, false, 503);
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    const readsBeforeMutation = connectionReads;
    await userEvent.click(
      await screen.findByRole("button", { name: "Отключить Google Drive" }),
    );
    expect(
      await screen.findByText(
        "Сервер не подтвердил отключение. Показан актуальный статус; проверьте его перед повторной попыткой.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Google Drive подключён")).toBeInTheDocument();
    expect(connectionReads).toBe(readsBeforeMutation + 1);
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/google/connection" && init?.method === "DELETE",
      ),
    ).toHaveLength(1);
    expect(document.body.textContent).not.toContain(
      "raw-google-still-connected",
    );
  });
  it("invalidates a late OAuth start response after logout", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let resolveStart: ((response: Response) => void) | undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/google/connection" && !init?.method)
        return json(googleConnectionFixture());
      if (url === "/api/google/oauth/start" && init?.method === "POST")
        return new Promise<Response>((resolve) => {
          resolveStart = resolve;
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true,
    });

    renderApp();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Подключить Google Drive" }),
    );
    await waitFor(() => expect(resolveStart).toBeDefined());
    await userEvent.click(screen.getByRole("button", { name: "Выйти" }));
    expect(
      await screen.findByRole("heading", { name: "Вход" }),
    ).toBeInTheDocument();

    const successfulResponse = await json(googleOauthStartFixture());
    await act(async () => resolveStart?.(successfulResponse));
    expect(assign).not.toHaveBeenCalled();
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/google/oauth/start" && init?.method === "POST",
      ),
    ).toHaveLength(1);
    expect(document.body.textContent).not.toContain("secret-state");
  });
  it("supports credential replacement without rendering raw key", async () => {
    renderApp();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Заменить" }),
    );
    await userEvent.type(
      screen.getByPlaceholderText("Новый ключ для замены"),
      "raw-secret-never-render",
    );
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(
      screen.queryByText("raw-secret-never-render"),
    ).not.toBeInTheDocument();
  });

  it("explains and confirms credential disable and permanent deletion", async () => {
    const confirm = vi.mocked(window.confirm);
    confirm.mockReturnValue(false);
    renderApp();
    await openSettingsPage();

    expect(
      await screen.findByText(/Отключение запрещает использовать ключ/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Отключить" }),
    );
    expect(confirm).toHaveBeenLastCalledWith(
      "Отключить ключ «Primary STT»? Он станет недоступен для новых и выполняющихся задач, но история версий сохранится.",
    );
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) => url === "/api/credentials/cred-active/revoke",
      ),
    ).toBe(false);

    confirm.mockReturnValue(true);
    await userEvent.click(
      screen.getByRole("button", { name: "Отключить" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/credentials/cred-active/revoke",
        expect.objectContaining({ method: "POST" }),
      ),
    );

    confirm.mockReturnValue(false);
    await userEvent.click(
      screen.getByRole("button", { name: "Удалить навсегда" }),
    );
    expect(confirm).toHaveBeenLastCalledWith(
      "Удалить ключ «Primary STT» навсегда? Все сохранённые значения будут стёрты без возможности восстановления.",
    );
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) =>
          url === "/api/credentials/cred-active" && init?.method === "DELETE",
      ),
    ).toBe(false);

    confirm.mockReturnValue(true);
    await userEvent.click(
      screen.getByRole("button", { name: "Удалить навсегда" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/credentials/cred-active",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("creates credentials with raw_value while using credential-specific field names", async () => {
    renderApp();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Добавить ключ" }),
    );
    await userEvent.type(
      await screen.findByPlaceholderText("Метка"),
      "primary-provider",
    );
    await userEvent.type(
      screen.getByPlaceholderText("Новый ключ"),
      "fake-provider-token",
    );
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/credentials",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const createCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url, init]) => url === "/api/credentials" && init?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      label: "primary-provider",
      raw_value: "fake-provider-token",
    });
  });

  it("bounds a stalled credential-list read and exposes a safe retry", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const credentialSignals: AbortSignal[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/credentials" && !init?.method) {
        const signal = init?.signal;
        if (!signal) throw new Error("credential-list signal is missing");
        credentialSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openSettingsPage();
      expect(
        await screen.findByText(
          "Не удалось загрузить ключи провайдеров. Повторите попытку.",
        ),
      ).toBeInTheDocument();
      expect(credentialSignals).toHaveLength(2);
      expect(credentialSignals[0]?.aborted).toBe(true);
      expect(credentialSignals[1]?.aborted).toBe(true);
      expect(
        screen.getByRole("button", { name: "Добавить ключ" }),
      ).toBeDisabled();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("rejects a malformed credential collection before rendering actions", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) =>
      url === "/api/credentials" && !init?.method
        ? json({ credentials: [{ id: "unsafe-incomplete-record" }] })
        : (defaultFetch?.(url, init) ?? json({ ok: true })),
    );

    renderApp();
    await openSettingsPage();
    expect(
      await screen.findByText(
        "Не удалось загрузить ключи провайдеров. Повторите попытку.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("unsafe-incomplete-record")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Заменить" })).not.toBeInTheDocument();
  });

  it("bounds and deduplicates credential creation while clearing the raw value", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const createSignals: AbortSignal[] = [];
    let credentialReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/credentials" && !init?.method) credentialReads += 1;
      if (url === "/api/credentials" && init?.method === "POST") {
        const signal = init.signal;
        if (!signal) throw new Error("credential-create signal is missing");
        createSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Добавить ключ" }),
    );
    const label = await screen.findByPlaceholderText("Метка");
    const rawValue = screen.getByPlaceholderText("Новый ключ");
    await userEvent.type(label, "deadline-safe");
    await userEvent.type(rawValue, "raw-secret-cleared-immediately");
    const form = label.closest("form");
    if (!form) throw new Error("credential-create form is missing");
    const readsBeforeCreate = credentialReads;

    vi.useFakeTimers();
    try {
      fireEvent.submit(form);
      fireEvent.submit(form);
      await act(async () => {
        await Promise.resolve();
      });
      expect(createSignals).toHaveLength(1);
      expect(rawValue).toHaveValue("");
      expect(label).toHaveValue("deadline-safe");
      expect(
        screen.getByRole("button", { name: "Создаём…" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Создаём ключ…" }),
      ).toHaveAttribute("aria-busy", "true");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      vi.useRealTimers();
      expect(
        await screen.findByText(
          "Сервер не подтвердил создание ключа. Список обновлён; проверьте его перед повторной попыткой. Значение ключа нужно ввести заново.",
        ),
      ).toBeInTheDocument();
      expect(createSignals[0]?.aborted).toBe(true);
      expect(credentialReads).toBe(readsBeforeCreate + 1);
      expect(rawValue).toHaveValue("");
      expect(label).toHaveValue("deadline-safe");
      expect(screen.getByRole("button", { name: "Создать" })).toBeEnabled();
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            url === "/api/credentials" && init?.method === "POST",
        ),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an ambiguous credential replacement owned across navigation", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let resolveReplace: ((response: Response) => void) | undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/credentials/cred-active/replace" &&
        init?.method === "POST"
      ) {
        return new Promise<Response>((resolve) => {
          resolveReplace = resolve;
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Заменить" }),
    );
    const rawValue = screen.getByPlaceholderText("Новый ключ для замены");
    await userEvent.type(rawValue, "raw-navigation-secret");
    const form = rawValue.closest("form");
    if (!form) throw new Error("credential-replace form is missing");
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(resolveReplace).toBeDefined());
    expect(rawValue).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Сохраняем…" }),
    ).toBeDisabled();
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/credentials/cred-active/replace" &&
          init?.method === "POST",
      ),
    ).toHaveLength(1);

    await openProjectsPage();
    const failedResponse = await json(
      { detail: "raw-provider-failure-must-not-render" },
      false,
      503,
    );
    await act(async () => resolveReplace?.(failedResponse));
    await openSettingsPage();
    expect(
      await screen.findByText(
        "Сервер не подтвердил замену ключа. Список обновлён; проверьте версию перед повторной попыткой. Значение ключа нужно ввести заново.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Заменить" })).toBeEnabled();
    expect(document.body.textContent).not.toContain("raw-navigation-secret");
    expect(document.body.textContent).not.toContain(
      "raw-provider-failure-must-not-render",
    );
  });

  it("confirms an ambiguous revoke only from the credential list", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let revoked = false;
    let revokeCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/credentials" && !init?.method) {
        return json({
          credentials: [
            {
              id: "cred-active",
              provider: "elevenlabs",
              label: "Primary STT",
              status: revoked ? "revoked" : "active",
              masked_value: "••••1234",
              active_version: 2,
            },
          ],
        });
      }
      if (
        url === "/api/credentials/cred-active/revoke" &&
        init?.method === "POST"
      ) {
        revokeCalls += 1;
        revoked = true;
        return json({ detail: "ambiguous-after-revoke" }, false, 503);
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Отключить" }),
    );
    expect(
      await screen.findByText(
        "Отключение ключа подтверждено по актуальному списку.",
      ),
    ).toBeInTheDocument();
    expect(revokeCalls).toBe(1);
    expect(screen.getByText(/revoked · v2/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("ambiguous-after-revoke");
  });
  it("confirms an ambiguous permanent deletion only from the credential list", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let deleted = false;
    let deleteCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/credentials" && !init?.method) {
        return json({
          credentials: deleted
            ? []
            : [
                {
                  id: "cred-active",
                  provider: "elevenlabs",
                  label: "Primary STT",
                  status: "active",
                  masked_value: "••••1234",
                  active_version: 2,
                },
              ],
        });
      }
      if (
        url === "/api/credentials/cred-active" &&
        init?.method === "DELETE"
      ) {
        deleteCalls += 1;
        deleted = true;
        return json({ detail: "ambiguous-after-delete" }, false, 503);
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Удалить навсегда" }),
    );
    expect(
      await screen.findByText(
        "Удаление ключа подтверждено по актуальному списку.",
      ),
    ).toBeInTheDocument();
    expect(deleteCalls).toBe(1);
    expect(
      screen.queryByRole("heading", { name: "Primary STT" }),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("ambiguous-after-delete");
  });
  it("platform projects page loads /api/projects and renders populated projects", async () => {
    renderApp();
    await openProjectsPage();
    expect(
      await screen.findByRole("heading", { name: "Research calls" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Customer interview notes").length,
    ).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
  it("platform projects page supports empty and error states", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/projects")) return json({ projects: [] });
        return json({ ok: true });
      },
    );
    renderApp();
    await openProjectsPage();
    expect(await screen.findByText(/Пока нет проектов/)).toBeInTheDocument();

    cleanup();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/projects"))
          return json({ detail: "broken" }, false, 500);
        return json({ ok: true });
      },
    );
    renderApp();
    await openProjectsPage();
    expect(
      await screen.findByText(/Операция не выполнена/),
    ).toBeInTheDocument();
  });
  it("platform projects page creates, edits, and archives projects with CSRF", async () => {
    renderApp();
    await openProjectsPage();
    await screen.findByRole("heading", { name: "Research calls" });
    await userEvent.click(screen.getByRole("button", { name: "Новый проект" }));
    await userEvent.type(
      await screen.findByLabelText("Название проекта"),
      "Created project",
    );
    await userEvent.type(screen.getByLabelText("Описание"), "Brief");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const createCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url, init]) => url === "/api/projects" && init?.method === "POST",
    );
    expect(createCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      title: "Created project",
      description: "Brief",
    });
    await waitFor(() =>
      expect(
        (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([url, init]) => url === "/api/projects" && !init?.method,
        ),
      ).toHaveLength(3),
    );
    expect(
      screen.queryByText(/Cannot read properties of null.*reset/),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Редактировать" }),
    );
    const editTitle = screen.getByDisplayValue("Research calls");
    await userEvent.clear(editTitle);
    await userEvent.type(editTitle, "Renamed project");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/p1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Архивировать" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/p1/archive",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("bounds a stalled project-list read and exposes a safe retryable error", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const projectSignals: AbortSignal[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && !init?.method) {
        const signal = init?.signal;
        if (!signal) throw new Error("project-list signal is missing");
        projectSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openProjectsPage();
      expect(
        await screen.findByText("Не удалось загрузить проекты."),
      ).toBeInTheDocument();
      expect(projectSignals).toHaveLength(2);
      expect(projectSignals[0]?.aborted).toBe(true);
      expect(projectSignals[1]?.aborted).toBe(true);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("bounds and deduplicates project creation without losing the draft", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const createSignals: AbortSignal[] = [];
    let projectReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && !init?.method) projectReads += 1;
      if (url === "/api/projects" && init?.method === "POST") {
        const signal = init.signal;
        if (!signal) throw new Error("project-create signal is missing");
        createSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await screen.findByRole("heading", { name: "Research calls" });
    await userEvent.click(screen.getByRole("button", { name: "Новый проект" }));
    const title = await screen.findByLabelText("Название проекта");
    const description = screen.getByLabelText("Описание");
    await userEvent.type(title, "Draft survives timeout");
    await userEvent.type(description, "Do not reset this draft");
    const form = title.closest("form");
    if (!form) throw new Error("project-create form is missing");
    const readsBeforeCreate = projectReads;
    vi.useFakeTimers();
    try {
      fireEvent.submit(form);
      fireEvent.submit(form);
      await act(async () => {
        await Promise.resolve();
      });
      expect(createSignals).toHaveLength(1);
      expect(
        screen.getByRole("button", { name: "Создание…" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Создание…" }),
      ).toHaveAttribute("aria-busy", "true");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      vi.useRealTimers();
      expect(
        await screen.findByText(
          "Сервер не подтвердил создание проекта. Список проектов обновлён; проверьте его перед повторной попыткой.",
        ),
      ).toBeInTheDocument();
      expect(createSignals[0]?.aborted).toBe(true);
      expect(projectReads).toBe(readsBeforeCreate + 1);
      expect(title).toHaveValue("Draft survives timeout");
      expect(description).toHaveValue("Do not reset this draft");
      expect(screen.getByRole("button", { name: "Создать" })).toBeEnabled();
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            url === "/api/projects" && init?.method === "POST",
        ),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an ambiguous project update owned by its project across a switch", async () => {
    installFocusedOutputFixture({ includeSecondProject: true });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let resolveUpdate: ((response: Response) => void) | undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects/p1" && init?.method === "PATCH") {
        return new Promise<Response>((resolve) => {
          resolveUpdate = resolve;
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await screen.findByRole("heading", { name: "Research calls" });
    await userEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    const title = screen.getByDisplayValue("Research calls");
    await userEvent.clear(title);
    await userEvent.type(title, "Ambiguous rename");
    const form = title.closest("form");
    if (!form) throw new Error("project-update form is missing");
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(resolveUpdate).toBeDefined());
    expect(
      screen.getByRole("button", { name: "Сохранение…" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Сохранение…" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/projects/p1" && init?.method === "PATCH",
      ),
    ).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /Project Two/ }));
    expect(
      await screen.findByRole("heading", { name: "Project Two" }),
    ).toBeInTheDocument();
    const failedResponse = await json(
      { detail: "raw-private-project-update-failure" },
      false,
      503,
    );
    await act(async () => resolveUpdate?.(failedResponse));
    await waitFor(() =>
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) => url === "/api/projects" && !init?.method,
        ).length,
      ).toBeGreaterThan(1),
    );
    expect(
      screen.queryByText(/Сервер не подтвердил сохранение/),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(
      "raw-private-project-update-failure",
    );

    await userEvent.click(screen.getByRole("button", { name: /Research calls/ }));
    expect(
      await screen.findByText(
        "Сервер не подтвердил сохранение. Список проектов обновлён; проверьте проект перед повторной попыткой.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled();
  });

  it("confirms an ambiguous archive only from the authoritative project list", async () => {
    installFocusedOutputFixture({ includeSecondProject: true });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let archiveAttempted = false;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects/p1/archive" && init?.method === "POST") {
        archiveAttempted = true;
        return json(
          { detail: "raw-private-project-archive-failure" },
          false,
          503,
        );
      }
      if (url === "/api/projects" && !init?.method && archiveAttempted) {
        return json({
          projects: [
            {
              id: "p2",
              title: "Project Two",
              description: null,
              created_at: "2026-07-02T00:00:00Z",
              updated_at: "2026-07-02T00:00:00Z",
              archived_at: null,
              output_drive_folder_id: null,
              output_drive_folder_url: null,
              output_drive_folder_name: null,
            },
          ],
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await screen.findByRole("heading", { name: "Research calls" });
    fireEvent.click(screen.getByRole("button", { name: "Архивировать" }));
    fireEvent.click(screen.getByRole("button", { name: "Архивация…" }));

    expect(
      await screen.findByRole("heading", { name: "Project Two" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Research calls/ }),
    ).not.toBeInTheDocument();
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/projects/p1/archive" && init?.method === "POST",
      ),
    ).toHaveLength(1);
    expect(document.body.textContent).not.toContain(
      "raw-private-project-archive-failure",
    );
  });
  it("shows compact preparation readiness status", async () => {
    renderApp();
    await openProjectsPage();
    await screen.findByRole("heading", { name: "Подготовка задач" });
    const status = await screen.findByLabelText("Готовность строк подготовки");
    expect(status).toHaveTextContent("Готово: 0 из 1");
    expect(status).toHaveTextContent("Строка 1: выберите источник");
    expect(screen.getByText("Название документа")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Необязательно. Если оставить пустым, Google Docs получит имя исходного файла.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Готовность" }),
    ).not.toBeInTheDocument();
  });

  it("derives readiness, blockers, and submit state from row readiness", async () => {
    renderApp();
    await openProjectsPage();

    const readiness = await screen.findByLabelText(
      "Готовность строк подготовки",
    );
    expect(readiness).toHaveTextContent("Готово: 0 из 1");
    expect(readiness).toHaveTextContent("Строка 1: выберите источник");
    expect(
      screen.queryByRole("button", { name: "Поднять строку 1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Удалить строку 1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    ).toBeDisabled();

    await chooseExistingSource(1, "Лекция 1");
    expect(readiness).toHaveTextContent("Готово: 0 из 1");
    expect(readiness).toHaveTextContent("Строка 1: выберите папку результата");
    await chooseResultFolder(1);
    expect(readiness).toHaveTextContent("Готово: 1 из 1");
    expect(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    ).toBeEnabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Добавить строку" }),
    );
    expect(
      screen.getByRole("status", { name: "Результат добавления строки" }),
    ).toHaveTextContent("Добавлена строка 2. Выберите источник.");
    await waitFor(() =>
      expect(
        screen.getByLabelText("Существующий файл для строки 2"),
      ).toHaveFocus(),
    );
    await chooseExistingSource(2, "Лекция 1");
    await chooseResultFolder(2);
    expect(readiness).toHaveTextContent("Готово: 0 из 2");
    expect(readiness).toHaveTextContent(
      "Строка 1: такая пара файла и папки уже добавлена",
    );
    expect(
      screen.getAllByText("Такая пара файла и папки уже добавлена.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Проверить задачи (2)" }),
    ).toBeDisabled();

    await chooseExistingSource(2, "local-temp");
    expect(readiness).toHaveTextContent("Готово: 2 из 2");
    expect(readiness).toHaveTextContent("Все строки готовы");
    expect(
      screen.getByRole("button", { name: "Проверить задачи (2)" }),
    ).toBeEnabled();
  });

  it("shows server-authoritative batch preflight and invalidates it after edits", async () => {
    renderApp();
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1);
    await userEvent.selectOptions(
      screen.getByLabelText("Язык транскрибации"),
      "detect",
    );
    await userEvent.click(screen.getByLabelText("Разделять на спикеров"));

    await userEvent.click(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    );

    const preview = await screen.findByLabelText(
      "Проверка перед созданием задач",
    );
    expect(preview).toHaveTextContent("ElevenLabs scribe_v2");
    expect(preview).toHaveTextContent("Автоопределение");
    expect(preview).toHaveTextContent("Спикеры: разделять");
    expect(preview).toHaveTextContent("Safe source 1");
    expect(preview).toHaveTextContent("Safe folder 1");
    expect(preview).toHaveTextContent("План: обработать");
    expect(preview).toHaveTextContent(
      "Совпадений с теми же настройками среди результатов Studio и точно связанных записей каталога не найдено.",
    );
    expect(preview).toHaveTextContent(
      "Проверены принятые результаты Studio и записи импортированного каталога",
    );
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) =>
          url === "/api/projects/p1/jobs/batch/preflight" &&
          init?.method === "POST",
      ),
    ).toBe(true);
    const preflightCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url, init]) =>
        url === "/api/projects/p1/jobs/batch/preflight" &&
        init?.method === "POST",
    );
    expect(preflightCall?.[1]?.headers).not.toHaveProperty("Idempotency-Key");
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) =>
          url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
      ),
    ).toBe(false);

    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 1"),
      " Уточнение",
    );
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Проверка перед созданием задач"),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    ).toBeEnabled();
  });

  it("offers and persists system, light, and dark appearance choices", async () => {
    renderApp();
    await openSettingsPage();
    const selector = screen.getByLabelText("Тема интерфейса");
    expect(selector).toHaveValue("system");
    await userEvent.selectOptions(selector, "dark");
    expect(localStorage.getItem("studio-theme-preference")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    await userEvent.selectOptions(selector, "light");
    expect(localStorage.getItem("studio-theme-preference")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("builds two project jobs from one source and a manual boundary", async () => {
    renderApp();
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1, "folder-project-one");

    await userEvent.click(
      screen.getByLabelText(
        "Разделить созвон на два проекта и создать два документа",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Проверить задачи (2)" }),
    ).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("Граница разделения строки 1"),
      "10:10",
    );
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValueOnce({
      action: "picked",
      docs: [{ id: "folder-project-two" }],
    } as Awaited<ReturnType<typeof googlePicker.openGooglePicker>>);
    await userEvent.click(
      screen.getByRole("button", {
        name: "Выбрать папку второй части для строки 1",
      }),
    );
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 1"),
      "Проект один",
    );
    await userEvent.type(
      screen.getByLabelText("Название второй части строки 1"),
      "Проект два",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Проверить задачи (2)" }),
    );
    const preview = await screen.findByLabelText(
      "Проверка перед созданием задач",
    );
    expect(preview).toHaveTextContent("Часть файла: Начало — 10:10");
    expect(preview).toHaveTextContent("Часть файла: 10:10 — конец");
    const preflightCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url, init]) =>
        url === "/api/projects/p1/jobs/batch/preflight" &&
        init?.method === "POST",
    );
    const body = JSON.parse(String(preflightCall?.[1]?.body));
    expect(body.items).toEqual([
      expect.objectContaining({
        source_id: "s1",
        output_folder_id: "folder-project-one",
        title: "Проект один",
        media_clip_start_seconds: 0,
        media_clip_end_seconds: 610,
      }),
      expect.objectContaining({
        source_id: "s1",
        output_folder_id: "folder-project-two",
        title: "Проект два",
        media_clip_start_seconds: 610,
        media_clip_end_seconds: null,
      }),
    ]);
  });

  it("blocks an existing result until the user explicitly accepts paid reprocessing", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (isBatchPreflightRequest(url, init)) {
        const request = JSON.parse(String(init?.body ?? "{}")) as {
          language?: "ru" | "detect";
          options?: { diarize?: boolean };
          items?: {
            title?: string | null;
            reprocess_existing?: boolean;
          }[];
        };
        const reprocess = request.items?.[0]?.reprocess_existing === true;
        return json({
          provider: "elevenlabs",
          model: "scribe_v2",
          language_mode: request.language ?? "ru",
          diarization_enabled: request.options?.diarize === true,
          existing_result_authority: {
            status: "partial",
            reason_code: "unlinked_catalog_entries_excluded",
          },
          items: [
            {
              position: 0,
              title: request.items?.[0]?.title ?? null,
              media_clip: null,
              source: {
                name: "Safe source 1",
                source_type: "google_drive",
                mime_type: "audio/mpeg",
                size_bytes: 2048,
                duration_seconds: null,
              },
              output_destination: { name: "Safe folder 1" },
              existing_result_match: {
                status: "accepted_match",
                accepted_output_count: 1,
                resolution: reprocess ? "reprocess" : "required",
              },
              provider_attempt_authority: {
                status: "available",
                reason_code: null,
              },
              planned_outcome: reprocess ? "process" : "blocked",
            },
          ],
          summary: {
            process_count: reprocess ? 1 : 0,
            skip_count: 0,
            blocked_count: reprocess ? 0 : 1,
          },
          confirmation_required: true,
        });
      }
      if (
        url === "/api/projects/p1/jobs/batch" &&
        init?.method === "POST"
      ) {
        return json({ jobs: [], created_count: 1, replayed: false });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    );

    const blocked = await screen.findByLabelText(
      "Проверка перед созданием задач",
    );
    expect(blocked).toHaveTextContent("План требует решения");
    expect(blocked).toHaveTextContent(
      "Есть готовый результат с теми же настройками.",
    );
    expect(blocked).toHaveTextContent("План: заблокировано");
    expect(
      screen.getByRole("button", {
        name: "Подтвердить и создать (1)",
      }),
    ).toBeDisabled();
    expect(
      baseFetch.mock.calls.some(
        ([url, init]) =>
          url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
      ),
    ).toBe(false);

    await userEvent.click(
      screen.getByLabelText("Транскрибировать заново строку 1"),
    );
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Проверка перед созданием задач"),
      ).not.toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    );

    const approved = await screen.findByLabelText(
      "Проверка перед созданием задач",
    );
    expect(approved).toHaveTextContent("План: транскрибировать заново");
    expect(
      screen.getByRole("button", {
        name: "Подтвердить и создать (1)",
      }),
    ).toBeEnabled();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Подтвердить и создать (1)",
      }),
    );
    await waitFor(() =>
      expect(
        baseFetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
        ),
      ).toBe(true),
    );
    const createCall = baseFetch.mock.calls.find(
      ([url, init]) =>
        url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            reprocess_existing: true,
          }),
        ],
      }),
    );
  });

  it.each([
    [
      "equivalent_provider_work_in_flight",
      "Для этого источника уже выполняется транскрибация. Дождитесь её завершения и повторите проверку.",
    ],
    [
      "equivalent_provider_outcome_unresolved",
      "Предыдущая транскрибация имеет неопределённый результат. Сначала проверьте её статус; повторная обработка заблокирована.",
    ],
  ] as const)(
    "keeps provider authority %s blocked even when accepted-output reprocessing is available",
    async (reasonCode, expectedCopy) => {
      const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
      const defaultFetch = baseFetch.getMockImplementation();
      baseFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (isBatchPreflightRequest(url, init)) {
          return json({
            provider: "elevenlabs",
            model: "scribe_v2",
            language_mode: "ru",
            diarization_enabled: false,
            existing_result_authority: {
              status: "partial",
              reason_code: "unlinked_catalog_entries_excluded",
            },
            items: [
              {
                position: 0,
                title: null,
                media_clip: null,
                source: {
                  name: "Safe source 1",
                  source_type: "google_drive",
                  mime_type: "audio/mpeg",
                  size_bytes: 2048,
                  duration_seconds: null,
                },
                output_destination: { name: "Safe folder 1" },
                existing_result_match: {
                  status: "accepted_match",
                  accepted_output_count: 1,
                  resolution: "required",
                },
                provider_attempt_authority: {
                  status: "blocked",
                  reason_code: reasonCode,
                },
                planned_outcome: "blocked",
              },
            ],
            summary: {
              process_count: 0,
              skip_count: 0,
              blocked_count: 1,
            },
            confirmation_required: true,
          });
        }
        return defaultFetch?.(url, init) ?? json({ ok: true });
      });

      renderApp();
      await openProjectsPage();
      await chooseExistingSource(1, "Лекция 1");
      await chooseResultFolder(1);
      await userEvent.click(
        screen.getByRole("button", { name: "Проверить задачи (1)" }),
      );

      const blocked = await screen.findByLabelText(
        "Проверка перед созданием задач",
      );
      expect(blocked).toHaveTextContent("План временно заблокирован");
      expect(blocked).toHaveTextContent(expectedCopy);
      expect(
        screen.getByText(
          "Найдена активная или неразрешённая предыдущая транскрибация. Повторная обработка заблокирована до разрешения её статуса.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(
          "Найдены ранее созданные результаты. Выберите явное решение для каждой заблокированной строки.",
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Предыдущая транскрибация ещё выполняется или требует проверки",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Транскрибировать заново строку 1"),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", {
          name: "Подтвердить и создать (1)",
        }),
      ).toBeDisabled();
      expect(
        baseFetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/projects/p1/jobs/batch" &&
            init?.method === "POST",
        ),
      ).toBe(false);
    },
  );

  it("invalidates a stale plan after a create-time provider authority race", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (isBatchPreflightRequest(url, init)) {
        return batchPreflightJson(init);
      }
      if (
        url === "/api/projects/p1/jobs/batch" &&
        init?.method === "POST"
      ) {
        return json(
          { detail: { reason: "provider_authority_conflict" } },
          false,
          409,
        );
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    );
    await screen.findByLabelText("Проверка перед созданием задач");

    await userEvent.click(
      screen.getByRole("button", {
        name: "Подтвердить и создать (1)",
      }),
    );

    expect(
      await screen.findByText(
        "Появилась активная или неразрешённая предыдущая транскрибация. Задачи не созданы; проверьте план заново после разрешения её статуса.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Проверка перед созданием задач"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    ).toBeEnabled();
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/projects/p1/jobs/batch" &&
          init?.method === "POST",
      ),
    ).toHaveLength(1);
  });

  it("keeps rows incomplete when a selected source has no row result folder", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/projects") && !init?.method)
        return json({
          projects: [
            {
              id: "p1",
              title: "Research calls",
              description: "Customer interview notes",
              created_at: "2026-07-01T00:00:00",
              updated_at: "2026-07-01T00:00:00",
              archived_at: null,
              output_drive_folder_id: null,
              output_drive_folder_url: null,
              output_drive_folder_name: null,
            },
          ],
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");

    const readiness = screen.getByLabelText("Готовность строк подготовки");
    expect(readiness).toHaveTextContent("Готово: 0 из 1");
    expect(readiness).toHaveTextContent("Строка 1: выберите папку результата");
    expect(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    ).toBeDisabled();
  });

  it("exposes submitting progress as the submit button accessible name", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let resolveBatch: ((value: Response) => void) | null = null;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url.endsWith("/api/projects/p1/jobs/batch") &&
        init?.method === "POST"
      ) {
        return new Promise<Response>((resolve) => {
          resolveBatch = resolve;
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    );
    await screen.findByLabelText("Проверка перед созданием задач");
    await userEvent.click(
      screen.getByRole("button", { name: "Подтвердить и создать (1)" }),
    );

    expect(
      await screen.findByRole("button", { name: "Создание задач…" }),
    ).toBeDisabled();
    await act(async () => {
      resolveBatch?.({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ jobs: [], created_count: 1, replayed: false }),
        text: () => Promise.resolve("{}"),
      } as Response);
    });
    resolveBatch?.({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ jobs: [], created_count: 1, replayed: false }),
      text: () => Promise.resolve("{}"),
    } as Response);
  });

  it("bounds stalled batch preflight without creating jobs", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const requestSignals: AbortSignal[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (isBatchPreflightRequest(url, init)) {
        const signal = init?.signal;
        if (!signal) throw new Error("batch preflight signal is missing");
        requestSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1);

    vi.useFakeTimers();
    try {
      fireEvent.click(
        screen.getByRole("button", { name: "Проверить задачи (1)" }),
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(requestSignals).toHaveLength(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(requestSignals[0]?.aborted).toBe(true);
      expect(
        screen.getByText(
          "Проверка плана заняла слишком много времени. Задачи не создавались; повторите проверку.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Проверить задачи (1)" }),
      ).toBeEnabled();
      expect(
        baseFetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/projects/p1/jobs/batch" &&
            init?.method === "POST",
        ),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it("bounds stalled batch creation without an automatic duplicate POST", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const requestSignals: AbortSignal[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/jobs/batch" &&
        init?.method === "POST"
      ) {
        const signal = init.signal;
        if (!signal) throw new Error("batch create signal is missing");
        requestSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    );
    await screen.findByLabelText("Проверка перед созданием задач");

    vi.useFakeTimers();
    try {
      fireEvent.click(
        screen.getByRole("button", {
          name: "Подтвердить и создать (1)",
        }),
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(requestSignals).toHaveLength(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(requestSignals[0]?.aborted).toBe(true);
      expect(
        screen.getByLabelText("Неопределённый исход создания пакета"),
      ).toHaveTextContent("Новая отправка заблокирована");
      expect(
        screen.getByRole("button", {
          name: "Повторить подтверждение пакета",
        }),
      ).toBeEnabled();
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            url === "/api/projects/p1/jobs/batch" &&
            init?.method === "POST",
        ),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates, lists, details, and cancels project jobs safely with CSRF", async () => {
    const secretLike =
      "sk-live-raw-token refresh_token encrypted_ciphertext s3://secret-key https://upload.example/leak";
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "openid email https://www.googleapis.com/auth/drive.file",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: true,
            picker_ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
                raw_value: secretLike,
                ciphertext: secretLike,
                nonce: secretLike,
              },
              {
                id: "cred-revoked",
                provider: "elevenlabs",
                label: "Revoked STT",
                status: "revoked",
                masked_value: "••••9999",
                active_version: 1,
              },
            ],
          });
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: "Research calls",
                description: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
                archived_at: null,
                output_drive_folder_id: "folder-default",
                output_drive_folder_url:
                  "https://drive.google.com/drive/folders/folder-default",
                output_drive_folder_name: "Default folder",
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "s1",
                project_id: "p1",
                source_type: "google_drive",
                original_filename: "ready-drive.mp4",
                mime_type: "video/mp4",
                size_bytes: 2048,
                drive_file_id: "drive-file-1",
                drive_file_url: "https://drive.example/file/1",
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:01:00",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
              {
                id: "s2",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "ready-local.ogg",
                mime_type: "audio/ogg",
                size_bytes: 4096,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:02:00",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
              {
                id: "s3",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "pending-local.ogg",
                mime_type: "audio/ogg",
                size_bytes: 1024,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "pending",
                uploaded_at: null,
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
              {
                id: "s4",
                project_id: "p1",
                source_type: "google_drive",
                original_filename: "deleted-drive.mp4",
                mime_type: "video/mp4",
                size_bytes: null,
                drive_file_id: "drive-file-4",
                drive_file_url: secretLike,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:03:00",
                expires_at: null,
                deleted_at: "2026-07-01T00:04:00",
                delete_reason: "user",
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
            ],
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
          return json({
            jobs: [
              {
                id: "job-1",
                project_id: "p1",
                status: "queued",
                title: "Queued review",
                provider: null,
                provider_credential_id: "cred-safe-id-not-rendered",
                source_count: 2,
                created_at: "2026-07-02T00:00:00Z",
                updated_at: "2026-07-02T00:01:00Z",
                cancelled_at: null,
                cancel_requested_at: null,
                attempt_count: 0,
                started_at: null,
                finished_at: null,
                error_code: null,
                error_message: null,
              },
              {
                id: "job-processing",
                project_id: "p1",
                status: "processing",
                title: "Processing review",
                provider: null,
                provider_credential_id: "cred-active",
                source_count: 1,
                created_at: "2026-07-02T00:00:00Z",
                updated_at: "2026-07-02T00:03:00Z",
                cancelled_at: null,
                cancel_requested_at: "2026-07-02T00:03:00Z",
                attempt_count: 2,
                started_at: "2026-07-02T00:01:00Z",
                finished_at: null,
                error_code: null,
                error_message: null,
              },
              {
                id: "job-2",
                project_id: "p1",
                status: "failed",
                title: null,
                provider: null,
                provider_credential_id: "cred-active",
                source_count: 1,
                created_at: "2026-07-03T00:00:00Z",
                updated_at: "2026-07-03T00:01:00Z",
                cancelled_at: null,
                cancel_requested_at: null,
                attempt_count: 0,
                started_at: null,
                finished_at: null,
                error_code: "SAFE_CODE",
                error_message: "Safe visible error",
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs/progress"))
          return json({
            jobs: [
              {
                job_id: "job-1",
                job_status: "queued",
                tracking_precision: "checkpoint",
                completed_source_count: 0,
                total_source_count: 2,
                active_source_position: null,
                current_stage: null,
                sources: [
                  {
                    position: 0,
                    name: "ready-drive.mp4",
                    status: "queued",
                    provider_parts: null,
                    stages: progressStages(null),
                  },
                  {
                    position: 1,
                    name: "ready-local.ogg",
                    status: "queued",
                    provider_parts: null,
                    stages: progressStages(null, false),
                  },
                ],
              },
              {
                job_id: "job-processing",
                job_status: "processing",
                tracking_precision: "checkpoint",
                completed_source_count: 0,
                total_source_count: 1,
                active_source_position: 0,
                current_stage: "provider_processing",
                sources: [
                  {
                    position: 0,
                    name: "processing.mp4",
                    status: "processing",
                    provider_parts: null,
                    stages: progressStages("provider_processing"),
                  },
                ],
              },
            ],
          });
        if (isBatchPreflightRequest(url, init))
          return batchPreflightJson(init);
        if (
          url.endsWith("/api/projects/p1/jobs/batch") &&
          init?.method === "POST"
        )
          return json({
            jobs: [
              {
                id: "job-created",
                project_id: "p1",
                status: "queued",
                title: "Created from UI",
                provider: null,
                provider_credential_id: "cred-active",
                source_count: 1,
                sources: [],
                output_folder: {
                  name: "Default folder",
                  web_view_url:
                    "https://drive.google.com/drive/folders/folder-default",
                },
                created_at: "2026-07-04T00:00:00Z",
                updated_at: "2026-07-04T00:00:00Z",
                cancelled_at: null,
                cancel_requested_at: null,
                attempt_count: 0,
                started_at: null,
                finished_at: null,
                error_code: null,
                error_message: null,
              },
            ],
            created_count: 1,
            replayed: false,
          });
        if (url.endsWith("/api/jobs/job-1/outputs"))
          return json({
            job_id: "job-1",
            job_status: "processing",
            output_count: 3,
            outputs: [
              {
                source_id: "internal-source-id",
                source_position: 1,
                source_name: "second-output",
                source_type: "local_upload",
                output_kind: "transcript",
                transcript_standard: "plain",
                web_view_url:
                  "https://docs.google.com/document/d/doc-safe/edit",
                link_available: true,
                document_character_count: 222,
                document_created_at: "2026-07-02T00:10:00Z",
                persisted_at: "2026-07-02T00:11:00Z",
              },
              {
                source_id: "hidden-source-id",
                source_position: 0,
                source_name: "first-output",
                source_type: "google_drive",
                output_kind: "transcript",
                transcript_standard: "plain",
                web_view_url: null,
                link_available: false,
                document_character_count: 111,
                document_created_at: "2026-07-02T00:08:00Z",
                persisted_at: "2026-07-02T00:09:00Z",
              },
              {
                source_id: "unsafe-source-id",
                source_position: 2,
                source_name: "unsafe-output",
                source_type: "google_drive",
                output_kind: "transcript",
                transcript_standard: "plain",
                web_view_url: "https://evil.example/doc-token-storage",
                link_available: false,
                document_character_count: 333,
                document_created_at: "2026-07-02T00:12:00Z",
                persisted_at: "2026-07-02T00:13:00Z",
                transcript_text: "secret transcript body",
                credential_token: "credential-token",
                storage_key: "storage/private/key",
              },
            ],
          });
        if (url.endsWith("/api/jobs/job-1"))
          return json({
            id: "job-1",
            project_id: "p1",
            status: "queued",
            title: "Queued review",
            provider: null,
            provider_credential_id: "cred-active",
            source_count: 2,
            created_at: "2026-07-02T00:00:00Z",
            updated_at: "2026-07-02T00:01:00Z",
            cancelled_at: null,
            started_at: null,
            finished_at: null,
            error_code: null,
            error_message: null,
            sources: [
              {
                id: "s2",
                project_id: "p1",
                position: 1,
                job_source_status: "queued",
                source_type: "local_upload",
                original_filename: "ready-local.ogg",
                mime_type: "audio/ogg",
                size_bytes: 4096,
                drive_file_id: null,
                drive_file_url: secretLike,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:02:00",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
              {
                id: "s1",
                project_id: "p1",
                position: 0,
                job_source_status: "queued",
                source_type: "google_drive",
                original_filename: "ready-drive.mp4",
                mime_type: "video/mp4",
                size_bytes: 2048,
                drive_file_id: "drive-file-1",
                drive_file_url: "https://drive.example/file/job-source",
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:01:00",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
            ],
          });
        if (url.endsWith("/api/jobs/job-1/cancel") && init?.method === "POST")
          return json({
            id: "job-1",
            project_id: "p1",
            status: "cancelled",
            title: "Queued review",
            provider: null,
            provider_credential_id: "cred-active",
            source_count: 2,
            sources: [],
            created_at: "2026-07-02T00:00:00Z",
            updated_at: "2026-07-02T00:02:00Z",
            cancelled_at: "2026-07-02T00:02:00Z",
            cancel_requested_at: null,
            attempt_count: 0,
            started_at: null,
            finished_at: null,
            error_code: null,
            error_message: null,
          });
        return json({});
      },
    );
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/p1/jobs",
        expect.objectContaining({ credentials: "same-origin" }),
      ),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/credentials",
        expect.objectContaining({ credentials: "same-origin" }),
      ),
    );
    expect(await screen.findByText("Queued review")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Подготовка задач" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Создайте задачу из готовых файлов проекта."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Готовность строк подготовки"),
    ).toHaveTextContent("Готово: 0 из 1");
    expect(document.body.textContent).not.toContain("worker/provider");
    expect(screen.getByText(/Транскрибация от/)).toBeInTheDocument();
    expect(screen.getByText("Статус: В очереди")).toBeInTheDocument();
    expect(screen.getByText("Статус: Ошибка")).toBeInTheDocument();
    expect(screen.getByText("Статус: Обрабатывается")).toBeInTheDocument();
    expect(screen.getByText(/Отмена запрошена:/)).toBeInTheDocument();
    expect(screen.getByText("Отмена запрошена")).toBeInTheDocument();
    expect(screen.getByText("Файлов: 2")).toBeInTheDocument();
    const processingProgress = await screen.findByLabelText(
      "Прогресс задачи job-processing",
    );
    expect(processingProgress).toHaveTextContent("Подготовка источника");
    expect(processingProgress).toHaveTextContent("Извлечение аудио");
    expect(processingProgress).toHaveTextContent(
      "Разбиение на части (при необходимости)",
    );
    expect(processingProgress).toHaveTextContent("Транскрибация ElevenLabs");
    expect(processingProgress).toHaveTextContent(
      "Слияние частей (при необходимости)",
    );
    expect(processingProgress).toHaveTextContent("Создание Google Docs");
    expect(
      within(processingProgress).getByText("Транскрибация ElevenLabs")
        .parentElement,
    ).toHaveTextContent("Выполняется");
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url]) => url === "/api/projects/p1/jobs/progress",
      ),
    ).toHaveLength(1);
    expect(screen.queryByText("Error code: SAFE_CODE")).not.toBeInTheDocument();
    expect(screen.getByText("Ошибка: Safe visible error")).toBeInTheDocument();

    expect((await screen.findAllByText(/ready-drive/))[0]).toBeInTheDocument();
    expect(
      screen.getByLabelText("Готовность строк подготовки"),
    ).toHaveTextContent("Готово:");
    expect(
      screen.getByText(/Файл ещё не готов для задачи/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Убранный из проекта файл нельзя добавить в задачу/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Существующий файл для строки 1")).getByRole(
        "option",
        { name: /pending-local\.ogg/ },
      ),
    ).toBeDisabled();
    expect(
      within(screen.getByLabelText("Существующий файл для строки 1")).getByRole(
        "option",
        { name: /deleted-drive\.mp4/ },
      ),
    ).toBeDisabled();
    await chooseExistingSource(1, "ready-drive.mp4");
    await chooseResultFolder(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Добавить строку" }),
    );
    await chooseExistingSource(2, "ready-local.ogg");
    await chooseResultFolder(2);
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 1"),
      "Created from UI",
    );
    const profileSelect = screen.queryByLabelText("Профиль подключения");
    if (profileSelect) {
      await userEvent.selectOptions(profileSelect, "cred-active");
    }
    const languageSelect = screen.getByLabelText("Язык транскрибации");
    expect(languageSelect).toHaveValue("ru");
    await userEvent.selectOptions(languageSelect, "detect");
    const diarizationToggle = screen.getByLabelText("Разделять на спикеров");
    expect(diarizationToggle).not.toBeChecked();
    await userEvent.click(diarizationToggle);
    await reviewAndConfirmBatch();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/p1/jobs/batch",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const createCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url, init]) =>
        url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
    );
    expect(createCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      provider_credential_id: "cred-active",
      language: "detect",
      options: { diarize: true },
      items: [
        {
          source_id: "s1",
          output_folder_id: "folder-123",
          title: "Created from UI",
          reprocess_existing: false,
        },
        {
          source_id: "s2",
          output_folder_id: "folder-123",
          title: null,
          reprocess_existing: false,
        },
      ],
    });

    const queuedJobCard = screen.getByText("Queued review").closest("article");
    expect(queuedJobCard).not.toBeNull();
    await userEvent.click(
      within(queuedJobCard as HTMLElement).getByRole("button", {
        name: "Открыть",
      }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/jobs/job-1",
        expect.objectContaining({ credentials: "same-origin" }),
      ),
    );
    const detail = await screen.findByLabelText("Job detail job-1");
    expect(within(detail).getByText("1. ready-drive.mp4")).toBeInTheDocument();
    expect(within(detail).getByText("2. ready-local.ogg")).toBeInTheDocument();
    expect(
      within(detail).getAllByText("Статус обработки: В очереди"),
    ).toHaveLength(2);
    const jobSourceLink = within(detail).getByRole("link", {
      name: "Открыть файл в Google Drive в новой вкладке",
    });
    expect(jobSourceLink).toHaveAttribute(
      "href",
      "https://drive.example/file/job-source",
    );
    expect(jobSourceLink).toHaveAttribute("target", "_blank");
    expect(jobSourceLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(jobSourceLink.closest(".resource-actions")).not.toBeNull();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/jobs/job-1/outputs",
        expect.objectContaining({ credentials: "same-origin" }),
      ),
    );
    const outputCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]) => url === "/api/jobs/job-1/outputs");
    expect(outputCall?.[1]?.headers).not.toHaveProperty("x-csrf-token");
    const outputs = await screen.findByLabelText("Результаты job-1");
    expect(outputs).toHaveTextContent(/Состояние задачи:\s*Обрабатывается/);
    expect(outputs).toHaveTextContent("Результатов: 3");
    expect(outputs).toHaveTextContent("2. second-output");
    expect(outputs).toHaveTextContent("1. first-output");
    expect(outputs.textContent?.indexOf("2. second-output")).toBeLessThan(
      outputs.textContent?.indexOf("1. first-output") ?? 0,
    );
    const outputLink = within(outputs).getByRole("link", {
      name: "Открыть документ",
    });
    expect(outputLink).toHaveAttribute(
      "href",
      "https://docs.google.com/document/d/doc-safe/edit",
    );
    expect(outputLink).toHaveAttribute("target", "_blank");
    expect(outputLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(outputs).toHaveTextContent("Ссылка недоступна");
    expect(
      within(outputs).queryByText("https://evil.example/doc-token-storage"),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("secret transcript body");
    expect(document.body.textContent).not.toContain("credential-token");
    expect(document.body.textContent).not.toContain("storage/private/key");
    expect(document.body.textContent).not.toContain("internal-source-id");

    await userEvent.click(
      within(queuedJobCard as HTMLElement).getByRole("button", {
        name: "Отменить",
      }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/jobs/job-1/cancel",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const cancelCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]) => url === "/api/jobs/job-1/cancel");
    expect(cancelCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(
      await screen.findByText(
        "Запрос отмены отправлен. Уже созданные результаты останутся доступны.",
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw-token");
    expect(document.body.textContent).not.toContain("refresh_token");
    expect(document.body.textContent).not.toContain("encrypted_ciphertext");
    expect(document.body.textContent).not.toContain(
      "https://upload.example/leak",
    );
    expect(document.body.textContent).not.toContain("cred-active");
    expect(document.body.textContent).not.toContain("cred-revoked");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("uses Google Picker actions instead of manual Drive ID forms in platform projects", async () => {
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    expect(
      screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Drive file/folder ID"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Drive folder ID"),
    ).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("Google multiselect creates one ordered row per source with independent folder selectors", async () => {
    const picker = installFakeGooglePicker();
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
    );
    await picker.loadScript();
    await picker.waitForCallback();
    expect(picker.viewIds).toContain("docs");
    const sessionCalls = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(([url]) => url === "/api/google/picker/session");
    expect(sessionCalls).toHaveLength(1);
    expect(sessionCalls[0]?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    picker.trigger({
      action: "picked",
      docs: [
        {
          id: "file-1",
          name: "leaky-name",
          mimeType: "video/mp4",
          url: "https://drive.example/leaky",
        },
        { id: "file-2", token: "ya29.leaky" },
      ],
    });
    const mutationCall = await waitFor(() => {
      const call = (
        fetch as unknown as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        ([url, init]) =>
          url === "/api/projects/p1/sources/google-picker" &&
          init?.method === "POST",
      );
      expect(call).toBeTruthy();
      return call;
    });
    expect(JSON.parse(String(mutationCall?.[1]?.body))).toEqual({
      file_ids: ["file-1", "file-2"],
    });
    expect(String(mutationCall?.[1]?.body)).not.toContain("leaky-name");
    expect(String(mutationCall?.[1]?.body)).not.toContain("video/mp4");
    expect(String(mutationCall?.[1]?.body)).not.toContain("drive.example");
    expect(String(mutationCall?.[1]?.body)).not.toContain("ya29");
    await waitFor(() =>
      expect(screen.getAllByText("picked-first.mp4").length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("picked-second.mp4").length).toBeGreaterThan(0);
    expect(document.body.textContent?.indexOf("picked-first.mp4")).toBeLessThan(
      document.body.textContent?.indexOf("picked-second.mp4") ?? 0,
    );
    expect(screen.getByLabelText("Источник строки 1")).toHaveTextContent(
      "picked-first.mp4",
    );
    expect(screen.getByLabelText("Источник строки 2")).toHaveTextContent(
      "picked-second.mp4",
    );
    expect(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 1",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 2",
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 1",
      }),
    );
    await picker.waitForCallback();
    picker.trigger({ action: "picked", docs: [{ id: "folder-1" }] });
    await screen.findByText("Default folder");
    await userEvent.click(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 2",
      }),
    );
    await picker.waitForCallback();
    picker.trigger({ action: "picked", docs: [{ id: "folder-2" }] });
    await waitFor(() =>
      expect(screen.getAllByText("Default folder").length).toBeGreaterThan(1),
    );
    await reviewAndConfirmBatch();
    const batchCall = await waitFor(() => {
      const call = (
        fetch as unknown as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        ([url, init]) =>
          url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
      );
      expect(call).toBeTruthy();
      return call;
    });
    expect(JSON.parse(String(batchCall?.[1]?.body)).items).toMatchObject([
      { source_id: "s-picker-1", output_folder_id: "folder-1" },
      { source_id: "s-picker-2", output_folder_id: "folder-2" },
    ]);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.body.textContent).not.toContain("ya29.test-access-token");
  });

  it("fails Google multiselect closed when the API response cannot cover every picked file", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url.endsWith("/api/projects/p1/sources/google-picker") &&
        init?.method === "POST"
      ) {
        return json({
          sources: [
            {
              id: "s-picker-only",
              project_id: "p1",
              source_type: "google_drive",
              original_filename: "picked-only.mp4",
              mime_type: "video/mp4",
              size_bytes: 10,
              drive_file_url: "https://drive.example/file-only",
              upload_status: "uploaded",
              uploaded_at: "2026-07-01T00:00:00Z",
              expires_at: null,
              deleted_at: null,
              delete_reason: null,
              created_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-01T00:00:00Z",
            },
          ],
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValueOnce({
      action: "picked",
      docs: [{ id: "file-1" }, { id: "file-2" }],
    });

    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
    );

    expect(
      await screen.findByText(
        "Сервер вернул неполный ответ для выбранных файлов. Список файлов обновлён; проверьте добавленные файлы перед повторным выбором.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").filter((item) =>
      item.classList.contains("composer-row"),
    )).toHaveLength(1);
    expect(screen.getByLabelText("Источник строки 1")).not.toHaveTextContent(
      "picked-only.mp4",
    );
    await waitFor(() =>
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            url === "/api/projects/p1/sources" && !init?.method,
        ),
      ).toHaveLength(2),
    );
  });

  it("renders refreshed authoritative job data for returned batch IDs before existing history", async () => {
    let jobListCalls = 0;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "drive.file",
            connected_at: "2026-07-01T00:00:00Z",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: true,
            picker_ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: "Research calls",
                description: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
                archived_at: null,
                output_drive_folder_id: "folder-default",
                output_drive_folder_url:
                  "https://drive.google.com/drive/folders/folder-default",
                output_drive_folder_name: "Default folder",
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "s1",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "ready-local.ogg",
                mime_type: "audio/ogg",
                size_bytes: 10,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs") && !init?.method) {
          jobListCalls += 1;
          return json({
            jobs:
              jobListCalls < 2
                ? [
                    {
                      id: "job-existing",
                      project_id: "p1",
                      status: "failed",
                      title: "Existing history",
                      provider: null,
                      provider_credential_id: "cred-active",
                      source_count: 1,
                      created_at: "2026-07-01T00:00:00Z",
                      updated_at: "2026-07-01T00:01:00Z",
                      cancelled_at: null,
                      cancel_requested_at: null,
                      attempt_count: 0,
                      started_at: null,
                      finished_at: null,
                      error_code: "SAFE",
                      error_message: "Still visible",
                    },
                  ]
                : [
                    {
                      id: "job-created",
                      project_id: "p1",
                      status: "completed",
                      title: "Fresh authoritative",
                      provider: null,
                      provider_credential_id: "cred-active",
                      source_count: 1,
                      output_folder: {
                        name: "Fresh folder",
                        web_view_url:
                          "https://drive.google.com/drive/folders/fresh",
                      },
                      created_at: "2026-07-02T00:00:00Z",
                      updated_at: "2026-07-02T00:05:00Z",
                      cancelled_at: null,
                      cancel_requested_at: null,
                      attempt_count: 1,
                      started_at: "2026-07-02T00:01:00Z",
                      finished_at: "2026-07-02T00:04:00Z",
                      error_code: null,
                      error_message: null,
                    },
                    {
                      id: "job-existing",
                      project_id: "p1",
                      status: "failed",
                      title: "Existing history",
                      provider: null,
                      provider_credential_id: "cred-active",
                      source_count: 1,
                      created_at: "2026-07-01T00:00:00Z",
                      updated_at: "2026-07-01T00:01:00Z",
                      cancelled_at: null,
                      cancel_requested_at: null,
                      attempt_count: 0,
                      started_at: null,
                      finished_at: null,
                      error_code: "SAFE",
                      error_message: "Still visible",
                    },
                  ],
          });
        }
        if (isBatchPreflightRequest(url, init))
          return batchPreflightJson(init);
        if (
          url.endsWith("/api/projects/p1/jobs/batch") &&
          init?.method === "POST"
        )
          return json({
            jobs: [
              {
                id: "job-created",
                project_id: "p1",
                status: "queued",
                title: "Stale create",
                provider: null,
                provider_credential_id: "cred-active",
                source_count: 1,
                output_folder: { name: "Stale folder", web_view_url: null },
                created_at: "2026-07-02T00:00:00Z",
                updated_at: "2026-07-02T00:00:00Z",
                cancelled_at: null,
                cancel_requested_at: null,
                attempt_count: 0,
                started_at: null,
                finished_at: null,
                error_code: null,
                error_message: null,
              },
            ],
            created_count: 1,
            replayed: true,
          });
        if (url.endsWith("/api/jobs/job-created/outputs"))
          return json({
            job_id: "job-created",
            job_status: "completed",
            output_count: 0,
            outputs: [],
          });
        return json({ ok: true });
      },
    );
    renderApp();
    await openSelectedProjectJobs();
    await chooseExistingSource(1, "ready-local.ogg");
    await chooseResultFolder(1);
    await reviewAndConfirmBatch();
    expect(await screen.findByText("Fresh authoritative")).toBeInTheDocument();
    expect(screen.getByText("Статус: Завершена")).toBeInTheDocument();
    expect(
      screen.getByText("Папка результата: Fresh folder"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Stale create")).not.toBeInTheDocument();
    expect(screen.getByText("Existing history")).toBeInTheDocument();
    expect(
      document.body.textContent?.indexOf("Fresh authoritative"),
    ).toBeLessThan(document.body.textContent?.indexOf("Existing history") ?? 0);
  });

  it("blocks removed sources immediately while source reload is still pending", async () => {
    let resolveReload: (value: Response) => void = () => undefined;
    let sourceListCalls = 0;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "drive.file",
            connected_at: "2026-07-01T00:00:00Z",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: true,
            picker_ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: "Research calls",
                description: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
                archived_at: null,
                output_drive_folder_id: "folder-default",
                output_drive_folder_url:
                  "https://drive.google.com/drive/folders/folder-default",
                output_drive_folder_name: "Default folder",
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
          return json({ jobs: [] });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method) {
          sourceListCalls += 1;
          if (sourceListCalls > 1)
            return new Promise((resolve) => {
              resolveReload = resolve;
            });
          return json({
            sources: [
              {
                id: "s1",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "remove-me.ogg",
                mime_type: "audio/ogg",
                size_bytes: 10,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
              {
                id: "s2",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "replacement.ogg",
                mime_type: "audio/ogg",
                size_bytes: 12,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
            ],
          });
        }
        if (url.endsWith("/api/sources/s1") && init?.method === "DELETE")
          return json({
            ok: true,
            source_state: "deleted",
            storage_cleanup: "pending",
          });
        if (
          url.endsWith("/api/projects/p1/jobs/batch") &&
          init?.method === "POST"
        )
          return json({ jobs: [], created_count: 0, replayed: false });
        return json({ ok: true });
      },
    );
    renderApp();
    await openSelectedProjectJobs();
    await chooseExistingSource(1, "remove-me.ogg");
    await chooseResultFolder(1, "folder-default");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 1"),
      "Keep title",
    );
    expect(screen.getAllByText("Папка Google Drive").length).toBeGreaterThan(0);
    await userEvent.click(
      screen.getByRole("button", { name: "Убрать из проекта: remove-me.ogg" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/sources/s1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(
      within(
        screen.getByLabelText("Существующий файл для строки 1"),
      ).queryByRole("option", { name: /remove-me.ogg/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Источник удалён из проекта/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep title")).toBeInTheDocument();
    expect(screen.getAllByText("Папка Google Drive").length).toBeGreaterThan(0);
    await chooseExistingSource(1, "replacement.ogg");
    expect(
      screen.queryByText(/Источник удалён из проекта/),
    ).not.toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("Существующий файл для строки 1"),
      "",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Проверить задачи \(\d+\)/ }),
    );
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) =>
          url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
      ),
    ).toBe(false);
    resolveReload(
      await json({
        sources: [
          {
            id: "s1",
            project_id: "p1",
            source_type: "local_upload",
            original_filename: "remove-me.ogg",
            mime_type: "audio/ogg",
            size_bytes: 10,
            drive_file_id: null,
            drive_file_url: null,
            upload_status: "uploaded",
            uploaded_at: "2026-07-01T00:00:00Z",
            expires_at: null,
            deleted_at: null,
            delete_reason: null,
            created_at: "2026-07-01T00:00:00Z",
            updated_at: "2026-07-01T00:00:00Z",
          },
        ],
      }),
    );
    await waitFor(() => expect(sourceListCalls).toBeGreaterThan(1));
    expect(
      within(
        screen.getByLabelText("Существующий файл для строки 1"),
      ).queryByRole("option", { name: /remove-me.ogg/ }),
    ).not.toBeInTheDocument();
  });

  it("row folder verification retries only CSRF rejections and never ordinary failures", async () => {
    const scenarios: Array<{
      name: string;
      response: "422" | "500" | "502" | "network";
    }> = [
      { name: "422", response: "422" },
      { name: "500", response: "500" },
      { name: "502", response: "502" },
      { name: "network", response: "network" },
    ];
    for (const scenario of scenarios) {
      cleanup();
      googlePicker.resetGooglePickerLoaderForTests();
      vi.restoreAllMocks();
      let verifyCalls = 0;
      vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValue({
        action: "picked",
        docs: [{ id: `folder-${scenario.name}` }],
      } as Awaited<ReturnType<typeof googlePicker.openGooglePicker>>);
      (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, init?: RequestInit) => {
          if (url.endsWith("/api/auth/session"))
            return json({
              authenticated: true,
              user: { email: "user@example.com", role: "admin" },
            });
          if (url.endsWith("/api/auth/csrf"))
            return json({ csrf_token: "csrf-after-refresh" });
          if (url.endsWith("/api/google/connection"))
            return json({
              connected: true,
              status: "active",
              google_email: "safe.user@example.com",
              scopes: "drive.file",
              connected_at: "2026-07-01T00:00:00Z",
              revoked_at: null,
              picker_configured: true,
              picker_scope_ready: true,
              picker_ready: true,
              reconnect_required: false,
            });
          if (url.endsWith("/api/google/picker/session"))
            return json({
              access_token: "picker-token",
              api_key: "public",
              app_id: "app",
              scope_ready: true,
            });
          if (url.endsWith("/api/credentials"))
            return json({ credentials: [] });
          if (url.endsWith("/api/projects"))
            return json({
              projects: [
                {
                  id: "p1",
                  title: "Research calls",
                  description: null,
                  created_at: "2026-07-01T00:00:00Z",
                  updated_at: "2026-07-01T00:00:00Z",
                  archived_at: null,
                  output_drive_folder_id: null,
                  output_drive_folder_url: null,
                  output_drive_folder_name: null,
                },
              ],
            });
          if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
            return json({ jobs: [] });
          if (url.endsWith("/api/projects/p1/sources") && !init?.method)
            return json({
              sources: [
                {
                  id: "s1",
                  project_id: "p1",
                  source_type: "local_upload",
                  original_filename: "ready-local.ogg",
                  mime_type: "audio/ogg",
                  size_bytes: 10,
                  drive_file_id: null,
                  drive_file_url: null,
                  upload_status: "uploaded",
                  uploaded_at: "2026-07-01T00:00:00Z",
                  expires_at: null,
                  deleted_at: null,
                  delete_reason: null,
                  created_at: "2026-07-01T00:00:00Z",
                  updated_at: "2026-07-01T00:00:00Z",
                },
              ],
            });
          if (
            url.endsWith(
              "/api/projects/p1/output-folders/google-picker/verify",
            ) &&
            init?.method === "POST"
          ) {
            verifyCalls += 1;
            if (scenario.response === "network")
              return Promise.reject(new Error("network down"));
            return json(
              { detail: "safe failure" },
              false,
              Number(scenario.response),
            );
          }
          return json({ ok: true });
        },
      );
      renderApp();
      await openSelectedProjectJobs();
      await userEvent.click(
        await screen.findByRole("button", { name: "Добавить строку" }),
      );
      await userEvent.click(
        screen.getByRole("button", {
          name: "Выбрать папку результата для строки 1",
        }),
      );
      await waitFor(() => expect(verifyCalls).toBe(1));
      expect(screen.getAllByText("Папка не выбрана")[0]).toBeInTheDocument();
    }

    cleanup();
    googlePicker.resetGooglePickerLoaderForTests();
    vi.restoreAllMocks();
    let verifyCalls = 0;
    const verifyBodies: string[] = [];
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValue({
      action: "picked",
      docs: [{ id: "folder-csrf" }],
    } as Awaited<ReturnType<typeof googlePicker.openGooglePicker>>);
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({
            csrf_token: verifyCalls > 0 ? "csrf-refreshed" : "csrf-initial",
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "drive.file",
            connected_at: "2026-07-01T00:00:00Z",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: true,
            picker_ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/google/picker/session"))
          return json({
            access_token: "picker-token",
            api_key: "public",
            app_id: "app",
            scope_ready: true,
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: "Research calls",
                description: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
                archived_at: null,
                output_drive_folder_id: null,
                output_drive_folder_url: null,
                output_drive_folder_name: null,
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
          return json({ jobs: [] });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "s1",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "ready-local.ogg",
                mime_type: "audio/ogg",
                size_bytes: 10,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
            ],
          });
        if (
          url.endsWith(
            "/api/projects/p1/output-folders/google-picker/verify",
          ) &&
          init?.method === "POST"
        ) {
          verifyCalls += 1;
          verifyBodies.push(String(init.body));
          return verifyCalls === 1
            ? json({ detail: { reason: "csrf_token_invalid" } }, false, 403)
            : json({
                name: "Verified folder",
                web_view_url:
                  "https://drive.google.com/drive/folders/folder-csrf",
              });
        }
        return json({ ok: true });
      },
    );
    renderApp();
    await openSelectedProjectJobs();
    await userEvent.click(
      await screen.findByRole("button", { name: "Добавить строку" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 1",
      }),
    );
    expect(await screen.findByText("Verified folder")).toBeInTheDocument();
    expect(verifyCalls).toBe(2);
    expect(verifyBodies).toEqual([
      JSON.stringify({ folder_id: "folder-csrf" }),
      JSON.stringify({ folder_id: "folder-csrf" }),
    ]);
  });

  it("preserves the preparation composer draft across project tab switches", async () => {
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });

    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1, "folder-one");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 1"),
      "First draft title",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Добавить строку" }),
    );
    await chooseExistingSource(2, "local-temp.ogg");
    await chooseResultFolder(2, "folder-two");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 2"),
      "Second draft title",
    );

    await openPlatformNavPage("Обзор");
    await openPlatformNavPage("Проекты");
    await screen.findByRole("form", { name: "Композитор пакетных задач" });

    const rows = screen
      .getAllByRole("listitem")
      .filter((item) => item.classList.contains("composer-row"));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(
      "Лекция 1. Личность как психологическое явление.flac",
    );
    expect(rows[0]).toHaveTextContent("Default folder");
    expect(
      within(rows[0]).getByLabelText("Название задачи для строки 1"),
    ).toHaveValue("First draft title");
    expect(rows[1]).toHaveTextContent("local-temp.ogg");
    expect(rows[1]).toHaveTextContent("Default folder");
    expect(
      within(rows[1]).getByLabelText("Название задачи для строки 2"),
    ).toHaveValue("Second draft title");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("preserves the same-project composer draft while editing and saving metadata", async () => {
    let saved = false;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "drive.file",
            connected_at: "2026-07-01T00:00:00Z",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: true,
            picker_ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-1",
                provider: "elevenlabs",
                label: "Main key",
                status: "active",
                masked_value: "••••1234",
                active_version: 1,
              },
            ],
          });
        if (url.endsWith("/api/projects/p1") && init?.method === "PATCH") {
          saved = true;
          return json({
            id: "p1",
            title: "Renamed Project One",
            description: "Updated description",
            created_at: "2026-07-01T00:00:00Z",
            updated_at: "2026-07-03T00:00:00Z",
            archived_at: null,
            output_drive_folder_id: "folder-one",
            output_drive_folder_url:
              "https://drive.google.com/drive/folders/folder-one",
            output_drive_folder_name: "One default",
          });
        }
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: saved ? "Renamed Project One" : "Project One",
                description: saved
                  ? "Updated description"
                  : "Original description",
                created_at: "2026-07-01T00:00:00Z",
                updated_at: saved
                  ? "2026-07-03T00:00:00Z"
                  : "2026-07-01T00:00:00Z",
                archived_at: null,
                output_drive_folder_id: "folder-one",
                output_drive_folder_url:
                  "https://drive.google.com/drive/folders/folder-one",
                output_drive_folder_name: "One default",
              },
              {
                id: "p2",
                title: "Project Two",
                description: null,
                created_at: "2026-07-02T00:00:00Z",
                updated_at: "2026-07-02T00:00:00Z",
                archived_at: null,
                output_drive_folder_id: "folder-two",
                output_drive_folder_url:
                  "https://drive.google.com/drive/folders/folder-two",
                output_drive_folder_name: "Two default",
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "p1-source-a",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "p1-alpha.ogg",
                mime_type: "audio/ogg",
                size_bytes: 10,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
              {
                id: "p1-source-b",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "p1-beta.ogg",
                mime_type: "audio/ogg",
                size_bytes: 20,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
            ],
          });
        if (url.endsWith("/api/projects/p2/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "p2-source-a",
                project_id: "p2",
                source_type: "local_upload",
                original_filename: "p2-clean.ogg",
                mime_type: "audio/ogg",
                size_bytes: 30,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-02T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-02T00:00:00Z",
                updated_at: "2026-07-02T00:00:00Z",
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
          return json({ jobs: [] });
        if (url.endsWith("/api/projects/p2/jobs") && !init?.method)
          return json({ jobs: [] });
        return json({ ok: true });
      },
    );

    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await chooseExistingSource(1, "p1-alpha.ogg");
    await chooseResultFolder(1, "folder-one");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 1"),
      "Alpha draft",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Добавить строку" }),
    );
    await chooseExistingSource(2, "p1-beta.ogg");
    await chooseResultFolder(2, "folder-two");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 2"),
      "Beta draft",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Редактировать" }),
    );
    expect(
      screen.getByRole("form", { name: "Композитор пакетных задач" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Ключ провайдера")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Alpha draft")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Beta draft")).toBeInTheDocument();
    expect(screen.getAllByText("Папка Google Drive").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.getByDisplayValue("Alpha draft")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Beta draft")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ключ провайдера")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Редактировать" }),
    );
    await userEvent.clear(screen.getByLabelText("Название проекта"));
    await userEvent.type(
      screen.getByLabelText("Название проекта"),
      "Renamed Project One",
    );
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(
      await screen.findByRole("heading", { name: "Renamed Project One" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alpha draft")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Beta draft")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ключ провайдера")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two .*02\.07\.2026/ }),
    );
    await screen.findByText("p2-clean.ogg");
    expect(screen.queryByDisplayValue("Alpha draft")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Beta draft")).not.toBeInTheDocument();
    expect(screen.getByText("Подключён и готов")).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("isolates composer state and preserves ambiguous batch recovery across project switches", async () => {
    let projectACreateCalls = 0;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "drive.file",
            connected_at: "2026-07-01T00:00:00Z",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: true,
            picker_ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "pA",
                title: "Project A",
                description: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
                archived_at: null,
                output_drive_folder_id: "folder-a",
                output_drive_folder_url:
                  "https://drive.google.com/drive/folders/folder-a",
                output_drive_folder_name: "A default",
              },
              {
                id: "pB",
                title: "Project B",
                description: null,
                created_at: "2026-07-02T00:00:00Z",
                updated_at: "2026-07-02T00:00:00Z",
                archived_at: null,
                output_drive_folder_id: "folder-b",
                output_drive_folder_url:
                  "https://drive.google.com/drive/folders/folder-b",
                output_drive_folder_name: "B default",
              },
            ],
          });
        if (url.endsWith("/api/projects/pA/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "source-a",
                project_id: "pA",
                source_type: "local_upload",
                original_filename: "project-a-source.ogg",
                mime_type: "audio/ogg",
                size_bytes: 10,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
            ],
          });
        if (url.endsWith("/api/projects/pB/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "source-b",
                project_id: "pB",
                source_type: "local_upload",
                original_filename: "project-b-source.ogg",
                mime_type: "audio/ogg",
                size_bytes: 20,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-02T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-02T00:00:00Z",
                updated_at: "2026-07-02T00:00:00Z",
              },
            ],
          });
        if (url.endsWith("/api/projects/pA/jobs") && !init?.method)
          return json({
            jobs: [
              {
                id: "job-a",
                project_id: "pA",
                status: "completed",
                title: "A completed job",
                provider: null,
                provider_credential_id: "cred-active",
                source_count: 1,
                output_folder: {
                  name: "A result folder",
                  web_view_url:
                    "https://drive.google.com/drive/folders/a-result",
                },
                created_at: "2026-07-01T01:00:00Z",
                updated_at: "2026-07-01T01:05:00Z",
                cancelled_at: null,
                cancel_requested_at: null,
                attempt_count: 1,
                started_at: "2026-07-01T01:01:00Z",
                finished_at: "2026-07-01T01:04:00Z",
                error_code: null,
                error_message: null,
              },
            ],
          });
        if (url.endsWith("/api/projects/pB/jobs") && !init?.method)
          return json({ jobs: [] });
        if (url.endsWith("/api/jobs/job-a"))
          return json({
            id: "job-a",
            project_id: "pA",
            status: "completed",
            title: "A completed job",
            provider: null,
            provider_credential_id: "cred-active",
            source_count: 1,
            created_at: "2026-07-01T01:00:00Z",
            updated_at: "2026-07-01T01:05:00Z",
            cancelled_at: null,
            cancel_requested_at: null,
            attempt_count: 1,
            started_at: "2026-07-01T01:01:00Z",
            finished_at: "2026-07-01T01:04:00Z",
            error_code: null,
            error_message: null,
            sources: [
              {
                id: "source-a",
                project_id: "pA",
                position: 0,
                job_source_status: "completed",
                source_type: "local_upload",
                original_filename: "project-a-source.ogg",
                mime_type: "audio/ogg",
                size_bytes: 10,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
            ],
          });
        if (url.endsWith("/api/jobs/job-a/outputs"))
          return json({
            job_id: "job-a",
            job_status: "completed",
            output_count: 1,
            outputs: [
              {
                source_id: "source-a",
                source_position: 0,
                source_name: "project-a-output",
                source_type: "local_upload",
                output_kind: "transcript",
                transcript_standard: "plain",
                web_view_url: null,
                link_available: false,
                document_character_count: 10,
                document_created_at: "2026-07-01T01:03:00Z",
                persisted_at: "2026-07-01T01:04:00Z",
              },
            ],
          });
        if (isBatchPreflightRequest(url, init))
          return batchPreflightJson(init);
        if (
          url.endsWith("/api/projects/pA/jobs/batch") &&
          init?.method === "POST"
        ) {
          projectACreateCalls += 1;
          if (projectACreateCalls === 1) {
            return Promise.reject(new Error("temporary batch outage"));
          }
          return json({
            jobs: [],
            created_count: 1,
            replayed: true,
          });
        }
        if (
          url.endsWith("/api/projects/pB/jobs/batch") &&
          init?.method === "POST"
        )
          return json({
            jobs: [
              {
                id: "job-b-created",
                project_id: "pB",
                status: "queued",
                title: "B clean submit",
                provider: null,
                provider_credential_id: "cred-active",
                source_count: 1,
                created_at: "2026-07-02T01:00:00Z",
                updated_at: "2026-07-02T01:00:00Z",
                cancelled_at: null,
                cancel_requested_at: null,
                attempt_count: 0,
                started_at: null,
                finished_at: null,
                error_code: null,
                error_message: null,
              },
            ],
            created_count: 1,
            replayed: false,
          });
        return json({ ok: true });
      },
    );

    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await chooseExistingSource(1, "project-a-source.ogg");
    await chooseResultFolder(1, "folder-a");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 1"),
      "Project A row title",
    );
    await userEvent.click(
      within(
        screen.getByText("A completed job").closest("article") as HTMLElement,
      ).getByRole("button", { name: "Открыть" }),
    );
    expect(
      await screen.findByLabelText("Job detail job-a"),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText("Результаты job-a")).toHaveTextContent(
      "project-a-output",
    );
    await reviewAndConfirmBatch();
    expect(
      await screen.findByLabelText("Неопределённый исход создания пакета"),
    ).toHaveTextContent("Новая отправка заблокирована");

    await userEvent.click(
      screen.getByRole("button", { name: /Project B .*02\.07\.2026/ }),
    );
    await screen.findByRole("form", { name: "Композитор пакетных задач" });

    expect(
      screen.queryByDisplayValue("Project A row title"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("A default")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Неопределённый исход создания пакета"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("A completed job")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Job detail job-a")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Результаты job-a")).not.toBeInTheDocument();
    expect(screen.queryByText("project-a-output")).not.toBeInTheDocument();
    expect(screen.getAllByText("Папка не выбрана").length).toBeGreaterThan(0);
    await chooseExistingSource(1, "project-b-source.ogg");
    await chooseResultFolder(1, "folder-b");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 1"),
      "B clean submit",
    );
    await reviewAndConfirmBatch();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/pB/jobs/batch",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const bCreateCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url, init]) =>
        url === "/api/projects/pB/jobs/batch" && init?.method === "POST",
    );
    expect(JSON.parse(String(bCreateCall?.[1]?.body))).toEqual({
      provider_credential_id: "cred-active",
      language: "ru",
      options: { diarize: false },
      items: [
        {
          source_id: "source-b",
          output_folder_id: "folder-b",
          title: "B clean submit",
          reprocess_existing: false,
        },
      ],
    });
    const firstACreateCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url, init]) =>
        url === "/api/projects/pA/jobs/batch" && init?.method === "POST",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Project A .*01\.07\.2026/ }),
    );
    expect(
      await screen.findByLabelText("Неопределённый исход создания пакета"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Проверить задачи (1)" }),
    ).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Повторить подтверждение пакета",
      }),
    );
    expect(
      await screen.findByText(
        "Повтор подтверждён: создано независимых задач: 1.",
      ),
    ).toBeInTheDocument();
    const aCreateCalls = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      ([url, init]) =>
        url === "/api/projects/pA/jobs/batch" && init?.method === "POST",
    );
    expect(aCreateCalls).toHaveLength(2);
    expect(aCreateCalls[1]?.[1]?.headers).toMatchObject({
      "Idempotency-Key": (
        firstACreateCall?.[1]?.headers as Record<string, string>
      )["Idempotency-Key"],
    });
    expect(aCreateCalls[1]?.[1]?.body).toBe(firstACreateCall?.[1]?.body);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("source Picker cancel/error and duplicate clicks do not create source mutations", async () => {
    let picker = installFakeGooglePicker();
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    const button = screen.getByRole("button", {
      name: "Выбрать файлы Google Drive",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await picker.loadScript();
    await picker.waitForCallback();
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url]) => url === "/api/google/picker/session",
      ),
    ).toHaveLength(1);
    picker.trigger({ action: "cancel" });
    await screen.findByText("Выбор файлов отменён.");
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) => url === "/api/projects/p1/sources/google-picker",
      ),
    ).toBe(false);

    cleanup();
    vi.clearAllMocks();
    picker = installFakeGooglePicker();
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
    );
    await picker.loadScript();
    await picker.waitForCallback();
    picker.trigger({ action: "error", raw: "raw-google-payload" });
    expect(
      await screen.findByText(
        "Google Picker вернул ошибку. Повторите попытку.",
      ),
    ).toBeInTheDocument();
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) => url === "/api/projects/p1/sources/google-picker",
      ),
    ).toBe(false);
    expect(document.body.textContent).not.toContain("raw-google-payload");
  });

  it("bounds stalled Google Picker sessions without replay and releases the source action", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const sessionSignals: AbortSignal[] = [];
    let sessionCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url.endsWith("/api/google/picker/session") &&
        init?.method === "POST"
      ) {
        sessionCalls += 1;
        const signal = init.signal;
        if (!signal) throw new Error("Picker session signal is missing");
        sessionSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openProjectsPage();
      const button = await screen.findByRole("button", {
        name: "Выбрать файлы Google Drive",
      });
      await userEvent.click(button);

      expect(
        await screen.findByText(
          "Google Picker не ответил вовремя. Повторите попытку.",
        ),
      ).toBeInTheDocument();
      expect(sessionCalls).toBe(1);
      expect(sessionSignals).toHaveLength(1);
      expect(sessionSignals[0]?.aborted).toBe(true);
      expect(button).toBeEnabled();
      expect(
        document.head.querySelector(
          'script[data-studio-google-picker="true"]',
        ),
      ).toBeNull();
      expect(
        baseFetch.mock.calls.some(
          ([url]) => url === "/api/projects/p1/sources/google-picker",
        ),
      ).toBe(false);

      await userEvent.click(button);
      await waitFor(() => expect(sessionCalls).toBe(2));
      await waitFor(() => expect(sessionSignals[1]?.aborted).toBe(true));
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("fails closed on a malformed Google Picker session without exposing its payload", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url.endsWith("/api/google/picker/session") &&
        init?.method === "POST"
      ) {
        return json({
          access_token: "raw-private-google-token",
          api_key: " ",
          app_id: "app",
          scope_ready: true,
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    const button = await screen.findByRole("button", {
      name: "Выбрать файлы Google Drive",
    });
    await userEvent.click(button);

    expect(
      await screen.findByText(
        "Сервер вернул некорректную сессию Google Picker. Повторите попытку позже.",
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(
      "raw-private-google-token",
    );
    expect(button).toBeEnabled();
    expect(
      document.head.querySelector(
        'script[data-studio-google-picker="true"]',
      ),
    ).toBeNull();
    expect(
      baseFetch.mock.calls.some(
        ([url]) => url === "/api/projects/p1/sources/google-picker",
      ),
    ).toBe(false);
  });

  it("closes an unresponsive Google Picker and ignores a late selection", async () => {
    const picker = installFakeGooglePicker();
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 300_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openProjectsPage();
      const button = await screen.findByRole("button", {
        name: "Выбрать файлы Google Drive",
      });
      await userEvent.click(button);
      await picker.loadScript();
      await picker.waitForCallback();

      expect(
        await screen.findByText(
          "Время выбора в Google Picker истекло. Повторите попытку.",
        ),
      ).toBeInTheDocument();
      expect(picker.setVisible).toHaveBeenNthCalledWith(1, true);
      expect(picker.setVisible).toHaveBeenNthCalledWith(2, false);
      expect(button).toBeEnabled();

      picker.trigger({ action: "picked", docs: [{ id: "late-file" }] });
      await act(async () => {
        await Promise.resolve();
      });
      expect(
        (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
          ([url]) => url === "/api/projects/p1/sources/google-picker",
        ),
      ).toBe(false);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
  it("bounds ambiguous Google source creation without replay and refreshes sources", async () => {
    const picker = installFakeGooglePicker();
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const mutationSignals: AbortSignal[] = [];
    let mutationCalls = 0;
    let sourceReadsAfterMutation = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/sources" &&
        !init?.method &&
        mutationCalls > 0
      ) {
        sourceReadsAfterMutation += 1;
      }
      if (
        url === "/api/projects/p1/sources/google-picker" &&
        init?.method === "POST"
      ) {
        mutationCalls += 1;
        const signal = init.signal;
        if (!signal) throw new Error("Google source signal is missing");
        mutationSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openProjectsPage();
      const button = await screen.findByRole("button", {
        name: "Выбрать файлы Google Drive",
      });
      await userEvent.click(button);
      await picker.loadScript();
      await picker.waitForCallback();
      picker.trigger({ action: "picked", docs: [{ id: "file-timeout" }] });

      expect(
        await screen.findByText(
          "Сервер не подтвердил добавление файлов Google Drive. Список файлов обновлён; проверьте его перед повторным выбором.",
        ),
      ).toBeInTheDocument();
      expect(mutationCalls).toBe(1);
      expect(mutationSignals).toHaveLength(1);
      expect(mutationSignals[0]?.aborted).toBe(true);
      await waitFor(() => expect(sourceReadsAfterMutation).toBeGreaterThan(0));
      expect(button).toBeEnabled();
      expect(
        screen.getByLabelText("Источник строки 1"),
      ).not.toHaveTextContent("file-timeout");
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("treats a Google source 5xx as ambiguous without exposing or replaying it", async () => {
    const picker = installFakeGooglePicker();
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let mutationCalls = 0;
    let sourceReadsAfterMutation = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/sources" &&
        !init?.method &&
        mutationCalls > 0
      ) {
        sourceReadsAfterMutation += 1;
      }
      if (
        url === "/api/projects/p1/sources/google-picker" &&
        init?.method === "POST"
      ) {
        mutationCalls += 1;
        return json(
          { detail: "raw-private-google-source-failure" },
          false,
          503,
        );
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    const button = await screen.findByRole("button", {
      name: "Выбрать файлы Google Drive",
    });
    await userEvent.click(button);
    await picker.loadScript();
    await picker.waitForCallback();
    picker.trigger({ action: "picked", docs: [{ id: "file-503" }] });

    expect(
      await screen.findByText(
        "Сервер не подтвердил добавление файлов Google Drive. Список файлов обновлён; проверьте его перед повторным выбором.",
      ),
    ).toBeInTheDocument();
    expect(mutationCalls).toBe(1);
    await waitFor(() => expect(sourceReadsAfterMutation).toBeGreaterThan(0));
    expect(button).toBeEnabled();
    expect(document.body.textContent).not.toContain(
      "raw-private-google-source-failure",
    );
  });

  it("bounds stalled Google folder verification and releases all Picker actions", async () => {
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValueOnce({
      action: "picked",
      docs: [{ id: "folder-timeout" }],
    } as Awaited<ReturnType<typeof googlePicker.openGooglePicker>>);
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const verifySignals: AbortSignal[] = [];
    let verifyCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/output-folders/google-picker/verify" &&
        init?.method === "POST"
      ) {
        verifyCalls += 1;
        const signal = init.signal;
        if (!signal) throw new Error("Folder verify signal is missing");
        verifySignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openProjectsPage();
      const folderButton = await screen.findByRole("button", {
        name: "Выбрать папку результата для строки 1",
      });
      await userEvent.click(folderButton);

      expect(
        await screen.findByText(
          "Проверка папки результата заняла слишком много времени. Повторите выбор.",
        ),
      ).toBeInTheDocument();
      expect(verifyCalls).toBe(1);
      expect(verifySignals).toHaveLength(1);
      expect(verifySignals[0]?.aborted).toBe(true);
      expect(folderButton).toBeEnabled();
      expect(folderButton).toHaveTextContent("Выбрать");
      expect(
        screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
      ).toBeEnabled();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("rejects malformed Google folder verification without using its values", async () => {
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValueOnce({
      action: "picked",
      docs: [{ id: "folder-malformed" }],
    } as Awaited<ReturnType<typeof googlePicker.openGooglePicker>>);
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/output-folders/google-picker/verify" &&
        init?.method === "POST"
      ) {
        return json({
          name: " ",
          web_view_url: "https://drive.example/raw-private-folder",
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    const folderButton = await screen.findByRole("button", {
      name: "Выбрать папку результата для строки 1",
    });
    await userEvent.click(folderButton);

    expect(
      await screen.findByText(
        "Сервер вернул некорректные данные папки результата. Повторите выбор позже.",
      ),
    ).toBeInTheDocument();
    expect(folderButton).toBeEnabled();
    expect(folderButton).toHaveTextContent("Выбрать");
    expect(document.body.textContent).not.toContain("raw-private-folder");
  });

  it("keeps Google Picker ownership and safe outcomes across project switches", async () => {
    const picker = installFakeGooglePicker();
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const sourceResolvers: Array<(response: Response) => void> = [];
    const folderResolvers: Array<(response: Response) => void> = [];
    let sourceMutationCalls = 0;
    let folderVerificationCalls = 0;
    let sourceReadsAfterMutation = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && !init?.method) {
        return json({
          projects: [
            {
              id: "p1",
              title: "Research calls",
              description: "Customer interview notes",
              created_at: "2026-07-01T00:00:00",
              updated_at: "2026-07-01T00:00:00",
              archived_at: null,
              output_drive_folder_id: null,
              output_drive_folder_url: null,
              output_drive_folder_name: null,
            },
            {
              id: "p2",
              title: "Project Two",
              description: null,
              created_at: "2026-07-02T00:00:00",
              updated_at: "2026-07-02T00:00:00",
              archived_at: null,
              output_drive_folder_id: null,
              output_drive_folder_url: null,
              output_drive_folder_name: null,
            },
          ],
        });
      }
      if (url === "/api/projects/p2/sources" && !init?.method)
        return json({ sources: [] });
      if (url === "/api/projects/p2/jobs" && !init?.method)
        return json({ jobs: [] });
      if (
        url === "/api/projects/p1/sources" &&
        !init?.method &&
        sourceMutationCalls > 0
      ) {
        sourceReadsAfterMutation += 1;
      }
      if (
        url === "/api/projects/p1/sources/google-picker" &&
        init?.method === "POST"
      ) {
        sourceMutationCalls += 1;
        return new Promise<Response>((resolve) => {
          sourceResolvers.push(resolve);
        });
      }
      if (
        url === "/api/projects/p1/output-folders/google-picker/verify" &&
        init?.method === "POST"
      ) {
        folderVerificationCalls += 1;
        return new Promise<Response>((resolve) => {
          folderResolvers.push(resolve);
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    const sourceButton = await screen.findByRole("button", {
      name: "Выбрать файлы Google Drive",
    });
    await userEvent.click(sourceButton);
    await picker.loadScript();
    await picker.waitForCallback();
    picker.trigger({ action: "picked", docs: [{ id: "file-remount" }] });
    await waitFor(() => expect(sourceMutationCalls).toBe(1));

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    expect(
      await screen.findByText(
        "Google Picker занят операцией в другом проекте. Дождитесь её завершения.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/Файлы Google Drive добавлены в проект/),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    expect(
      await screen.findByText(
        "Выбор в Google Drive для этого проекта ещё выполняется. Дождитесь завершения перед новой попыткой.",
      ),
    ).toBeInTheDocument();
    const restoredSourceButton = screen.getByRole("button", {
      name: "Выбрать файлы Google Drive",
    });
    expect(restoredSourceButton).toBeDisabled();
    restoredSourceButton.click();
    expect(sourceMutationCalls).toBe(1);

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    await act(async () => {
      sourceResolvers[0]?.(
        await json({
          sources: [
            {
              id: "source-remount",
              project_id: "p1",
              source_type: "google_drive",
              original_filename: "remount-source.mp4",
              mime_type: "video/mp4",
              size_bytes: 10,
              drive_file_url: "https://drive.example/file-remount",
              upload_status: "uploaded",
              uploaded_at: "2026-07-01T00:00:00Z",
              expires_at: null,
              deleted_at: null,
              delete_reason: null,
              created_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-01T00:00:00Z",
            },
          ],
        }),
      );
    });
    await waitFor(() => expect(sourceReadsAfterMutation).toBeGreaterThan(0));
    expect(
      screen.queryByText(
        "Файлы Google Drive добавлены в проект. Выберите их в нужных строках заново.",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    expect(
      await screen.findByText(
        "Файлы Google Drive добавлены в проект. Выберите их в нужных строках заново.",
      ),
    ).toBeInTheDocument();
    const folderButton = screen.getByRole("button", {
      name: "Выбрать папку результата для строки 1",
    });
    await userEvent.click(folderButton);
    await waitFor(() =>
      expect(
        picker.builderCalls.filter((call) => call.method === "setCallback"),
      ).toHaveLength(2),
    );
    expect(
      screen.queryByText(
        "Файлы Google Drive добавлены в проект. Выберите их в нужных строках заново.",
      ),
    ).not.toBeInTheDocument();
    picker.trigger({ action: "picked", docs: [{ id: "folder-remount" }] });
    await waitFor(() => expect(folderVerificationCalls).toBe(1));

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    expect(
      await screen.findByText(
        "Google Picker занят операцией в другом проекте. Дождитесь её завершения.",
      ),
    ).toBeInTheDocument();
    await act(async () => {
      folderResolvers[0]?.(
        await json({
          name: "Verified remount folder",
          web_view_url: "https://drive.example/folder-remount",
        }),
      );
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
      ).toBeEnabled(),
    );
    expect(
      screen.queryByText(/Папка Google Drive проверена/),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    expect(
      await screen.findByText(
        "Папка Google Drive проверена, но прежняя строка больше не открыта. Выберите папку для строки повторно.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 1",
      }),
    ).toBeEnabled();
    expect(sourceMutationCalls).toBe(1);
    expect(folderVerificationCalls).toBe(1);
  });
  it("shows an actionable safe message when Picker session requires reconnect", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url.endsWith("/api/google/picker/session") &&
        init?.method === "POST"
      )
        return json(
          {
            detail: "google_reauthorization_required",
            raw: "private-google-response",
          },
          false,
          409,
        );
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Выбрать файлы Google Drive",
      }),
    );

    expect(
      await screen.findByText(
        "Переподключите Google Drive в настройках и повторите выбор.",
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("private-google-response");
  });

  it("disables row folder selection while Google Drive is disconnected without requesting Picker session", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/connection"))
        return json({
          connected: false,
          status: "missing",
          google_email: null,
          scopes: "",
          connected_at: null,
          revoked_at: null,
          picker_configured: false,
          picker_scope_ready: false,
          picker_ready: false,
          reconnect_required: false,
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    const button = await screen.findByRole("button", {
      name: "Выбрать папку результата для строки 1",
    });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) => url === "/api/google/picker/session",
      ),
    ).toBe(false);
  });

  it("keeps row folder selection unavailable for reconnect or Picker readiness problems", async () => {
    const scenarios = [
      {
        reconnect_required: true,
        picker_scope_ready: true,
        picker_configured: true,
      },
      {
        reconnect_required: false,
        picker_scope_ready: false,
        picker_configured: true,
      },
      {
        reconnect_required: false,
        picker_scope_ready: true,
        picker_configured: false,
      },
    ];
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();

    for (const scenario of scenarios) {
      cleanup();
      vi.clearAllMocks();
      baseFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "openid email https://www.googleapis.com/auth/drive.file",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: null,
            picker_configured: scenario.picker_configured,
            picker_scope_ready: scenario.picker_scope_ready,
            picker_ready: false,
            reconnect_required: scenario.reconnect_required,
          });
        return defaultFetch?.(url, init) ?? json({ ok: true });
      });

      renderApp();
      await openProjectsPage();
      const button = await screen.findByRole("button", {
        name: "Выбрать папку результата для строки 1",
      });
      expect(button).toBeDisabled();
      await userEvent.click(button);
      expect(
        (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
          ([url]) => url === "/api/google/picker/session",
        ),
      ).toBe(false);
    }
  });

  it("row output-folder Picker verifies only folder ID and guards duplicate opens", async () => {
    const picker = installFakeGooglePicker();
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    const button = screen.getByRole("button", {
      name: "Выбрать папку результата для строки 1",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await picker.loadScript();
    await picker.waitForCallback();
    expect(picker.viewIds).toContain("folders");
    expect(picker.viewModes).toContain("list");
    expect(picker.viewParents).toContain("root");
    expect(picker.includeFolders).toContain(true);
    expect(picker.selectFolderEnabled).toEqual([true]);
    expect(
      picker.builderCalls.filter((call) => call.method === "enableFeature"),
    ).toEqual([]);
    expect(picker.builderCalls).toContainEqual({
      method: "setMaxItems",
      args: [1],
    });
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url]) => url === "/api/google/picker/session",
      ),
    ).toHaveLength(1);
    picker.trigger({
      action: "picked",
      docs: [
        {
          id: "folder-picked",
          name: "Folder Name",
          mimeType: "application/vnd.google-apps.folder",
          token: "ya29.leaky",
        },
      ],
    });
    const folderCall = await waitFor(() => {
      const call = (
        fetch as unknown as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        ([url, init]) =>
          url === "/api/projects/p1/output-folders/google-picker/verify" &&
          init?.method === "POST",
      );
      expect(call).toBeTruthy();
      return call;
    });
    expect(JSON.parse(String(folderCall?.[1]?.body))).toEqual({
      folder_id: "folder-picked",
    });
    expect(folderCall?.[1]?.headers).toEqual(
      expect.objectContaining({ "x-csrf-token": "csrf-after-refresh" }),
    );
    expect(String(folderCall?.[1]?.body)).not.toContain("Folder Name");
    expect(String(folderCall?.[1]?.body)).not.toContain(
      "application/vnd.google-apps.folder",
    );
    expect(String(folderCall?.[1]?.body)).not.toContain("raw-google-payload");
    expect(String(folderCall?.[1]?.body)).not.toContain("ya29");
    expect(document.body.textContent).not.toContain("Folder Name");
    expect(document.body.textContent).not.toContain("ya29");
    expect(document.body.textContent).not.toContain("raw-google-payload");
  });

  it("row output-folder Picker cancel/error does not mutate project folder and source/folder cannot open simultaneously", async () => {
    let picker = installFakeGooglePicker();
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
    );
    expect(
      screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
    ).toBeDisabled();
    await picker.loadScript();
    await picker.waitForCallback();
    picker.trigger({ action: "cancel" });
    await screen.findByText("Выбор файлов отменён.");
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) =>
          url === "/api/projects/p1/output-folders/google-picker/verify",
      ),
    ).toBe(false);

    cleanup();
    vi.clearAllMocks();
    picker = installFakeGooglePicker();
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 1",
      }),
    );
    await picker.loadScript();
    await picker.waitForCallback();
    picker.trigger({ action: "error", raw: "raw-google-payload" });
    expect(
      await screen.findByText(
        "Google Picker вернул ошибку. Повторите попытку.",
      ),
    ).toBeInTheDocument();
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) =>
          url === "/api/projects/p1/output-folders/google-picker/verify",
      ),
    ).toBe(false);
    expect(document.body.textContent).not.toContain("raw-google-payload");

    cleanup();
    vi.clearAllMocks();
    picker = installFakeGooglePicker();
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 1",
      }),
    );
    await picker.loadScript();
    await picker.waitForCallback();
    picker.trigger({ action: "picked", docs: [] });
    expect(
      await screen.findByText("Выберите одну папку Google Drive."),
    ).toBeInTheDocument();
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) =>
          url === "/api/projects/p1/output-folders/google-picker/verify",
      ),
    ).toBe(false);
  });

  it("reconnect-required state provides a Settings recovery action", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: "Research calls",
                description: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
                archived_at: null,
                output_drive_folder_id: null,
                output_drive_folder_url: null,
                output_drive_folder_name: null,
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method)
          return json({ sources: [] });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "openid email",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: false,
            picker_ready: false,
            reconnect_required: true,
          });
        if (url.endsWith("/api/google/oauth/start") && init?.method === "POST")
          return json(googleOauthStartFixture({}));
        return json({ credentials: [], events: [] });
      },
    );
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, assign },
      configurable: true,
    });
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await waitFor(() =>
      expect(document.body.textContent).toContain(
        "Переподключите Google Drive",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Выбрать файлы Google Drive" }),
    ).toBeDisabled();
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Переподключить Google Drive",
      }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/google/oauth/start",
      expect.objectContaining({ method: "POST" }),
    );
    expect(assign).toHaveBeenCalledWith(
      String(googleOauthStartFixture().authorization_url),
    );
  });

  it("allows creating a job without credential when credential loading fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "openid email https://www.googleapis.com/auth/drive.file",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: null,
            picker_configured: true,
            picker_scope_ready: true,
            picker_ready: true,
            reconnect_required: false,
          });
        if (url.endsWith("/api/credentials"))
          return json({ detail: "raw backend detail ignored" }, false, 503);
        if (url.endsWith("/api/projects"))
          return json({
            projects: [
              {
                id: "p1",
                title: "Research calls",
                description: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
                archived_at: null,
                output_drive_folder_id: "folder-default",
                output_drive_folder_url:
                  "https://drive.google.com/drive/folders/folder-default",
                output_drive_folder_name: "Default folder",
              },
            ],
          });
        if (url.endsWith("/api/projects/p1/jobs") && !init?.method)
          return json({ jobs: [] });
        if (url.endsWith("/api/projects/p1/sources") && !init?.method)
          return json({
            sources: [
              {
                id: "s1",
                project_id: "p1",
                source_type: "local_upload",
                original_filename: "ready-local.ogg",
                mime_type: "audio/ogg",
                size_bytes: 4096,
                drive_file_id: null,
                drive_file_url: null,
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:02:00",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00",
                updated_at: "2026-07-01T00:00:00",
              },
            ],
          });
        if (
          url.endsWith("/api/projects/p1/jobs/batch") &&
          init?.method === "POST"
        )
          return json({
            jobs: [
              {
                id: "job-created",
                project_id: "p1",
                status: "queued",
                title: null,
                provider: null,
                provider_credential_id: "cred-active",
                source_count: 1,
                sources: [],
                output_folder: {
                  name: "Default folder",
                  web_view_url:
                    "https://drive.google.com/drive/folders/folder-default",
                },
                created_at: "2026-07-04T00:00:00Z",
                updated_at: "2026-07-04T00:00:00Z",
                cancelled_at: null,
                cancel_requested_at: null,
                attempt_count: 0,
                started_at: null,
                finished_at: null,
                error_code: null,
                error_message: null,
              },
            ],
            created_count: 1,
            replayed: false,
          });
        return json({});
      },
    );
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Проверить задачи \(\d+\)/ }),
      ).toBeDisabled(),
    );
    expect(
      screen.queryByText("raw backend detail ignored"),
    ).not.toBeInTheDocument();

    await chooseExistingSource(1, "ready-local.ogg");
    await chooseResultFolder(1);
    expect(
      screen.getByRole("button", { name: /Проверить задачи \(\d+\)/ }),
    ).toBeDisabled();
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) =>
          url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
      ),
    ).toBe(false);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("bounds stalled project source and job collection reads", async () => {
    installFocusedOutputFixture({ jobStatus: "completed" });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const stalledPaths = new Set([
      "/api/projects/p1/sources",
      "/api/projects/p1/jobs",
    ]);
    const requestSignals: AbortSignal[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (stalledPaths.has(String(url)) && !init?.method) {
        const signal = init?.signal;
        if (!signal) throw new Error("project collection signal is missing");
        requestSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({});
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 0 : delay,
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openProjectsPage();
      await screen.findByRole("form", {
        name: "Композитор пакетных задач",
      });

      expect(
        await screen.findByText("Не удалось загрузить файлы проекта."),
      ).toBeInTheDocument();
      expect(
        await screen.findByText("Не удалось загрузить задачи проекта."),
      ).toBeInTheDocument();
      expect(requestSignals).toHaveLength(2);
      expect(requestSignals.every((signal) => signal.aborted)).toBe(true);
      expect(screen.queryByText("Загрузка файлов…")).not.toBeInTheDocument();
      expect(screen.queryByText("Загрузка задач…")).not.toBeInTheDocument();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("does not request job outputs until explicit job detail opening", async () => {
    installFocusedOutputFixture();
    renderApp();
    await waitForPlatformOverview();
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([url]) =>
        String(url).endsWith("/api/jobs/job-focused/outputs"),
      ),
    ).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /Проекты/ }));
    await screen.findByRole("heading", { name: "Research calls" });
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([url]) =>
        String(url).endsWith("/api/jobs/job-focused/outputs"),
      ),
    ).toBe(false);

    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    expect(await screen.findByText("Focused output job")).toBeInTheDocument();
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([url]) =>
        String(url).endsWith("/api/jobs/job-focused/outputs"),
      ),
    ).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/jobs/job-focused/outputs",
        expect.objectContaining({ credentials: "same-origin" }),
      ),
    );
    const outputCalls = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(([url]) => url === "/api/jobs/job-focused/outputs");
    expect(outputCalls).toHaveLength(1);
    expect(outputCalls[0]?.[1]?.method).toBeUndefined();
    expect(outputCalls[0]?.[1]?.headers).not.toHaveProperty("x-csrf-token");
  });

  it("bounds stalled job detail reads and leaves safe retryable UI", async () => {
    installFocusedOutputFixture({ jobStatus: "processing" });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const stalledPaths = new Set([
      "/api/jobs/job-focused",
      "/api/jobs/job-focused/retry",
      "/api/jobs/job-focused/output-reconciliation",
      "/api/jobs/job-focused/outputs",
    ]);
    const requestSignals: AbortSignal[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (stalledPaths.has(String(url)) && !init?.method) {
        const signal = init?.signal;
        if (!signal) throw new Error("job detail request signal is missing");
        requestSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({});
    });

    await openFocusedJobsList();
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Открыть" }));
      expect(screen.getByText("Загрузка деталей задачи…")).toBeInTheDocument();
      expect(screen.getByText("Загрузка результатов…")).toBeInTheDocument();
      expect(requestSignals).toHaveLength(4);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });

      expect(requestSignals.every((signal) => signal.aborted)).toBe(true);
      expect(
        screen.getByText("Не удалось загрузить детали задачи."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Не удалось загрузить результаты."),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Загрузка деталей задачи…"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Загрузка результатов…"),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps only the latest repeated job detail refresh", async () => {
    installFocusedOutputFixture();
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let detailCalls = 0;
    let outputCalls = 0;
    let resolveStaleDetail: ((response: Response) => void) | undefined;
    let resolveStaleOutputs: ((response: Response) => void) | undefined;
    const staleDetail = new Promise<Response>((resolve) => {
      resolveStaleDetail = resolve;
    });
    const staleOutputs = new Promise<Response>((resolve) => {
      resolveStaleOutputs = resolve;
    });
    const detailBody = (sourceName: string) => ({
      id: "job-focused",
      project_id: "p1",
      status: "processing",
      title: "Focused output job",
      provider: null,
      provider_credential_id: "cred-active",
      source_count: 1,
      created_at: "2026-07-02T00:00:00Z",
      updated_at: "2026-07-02T00:01:00Z",
      cancelled_at: null,
      cancel_requested_at: null,
      attempt_count: 1,
      started_at: "2026-07-02T00:00:30Z",
      finished_at: null,
      error_code: null,
      error_message: null,
      sources: [
        {
          id: "source-detail-id-not-output-id",
          project_id: "p1",
          position: 0,
          job_source_status: "queued",
          source_type: "google_drive",
          original_filename: sourceName,
          mime_type: "audio/mpeg",
          size_bytes: 1234,
          drive_file_id: null,
          drive_file_url: null,
          upload_status: "uploaded",
          uploaded_at: "2026-07-01T00:01:00Z",
          expires_at: null,
          deleted_at: null,
          delete_reason: null,
          created_at: "2026-07-01T00:00:00Z",
          updated_at: "2026-07-01T00:00:00Z",
        },
      ],
    });
    const outputsBody = (sourceName: string) => ({
      job_id: "job-focused",
      job_status: "processing",
      output_count: 1,
      outputs: [
        {
          source_id: "source-id-not-rendered",
          source_position: 0,
          source_name: sourceName,
          source_type: "google_drive",
          output_kind: "transcript",
          transcript_standard: "transcript_doc_v1.2",
          web_view_url:
            "https://docs.google.com/document/d/focused-safe/edit",
          link_available: true,
          document_character_count: 456,
          document_created_at: "2026-07-02T00:10:00Z",
          persisted_at: "2026-07-02T00:11:00Z",
        },
      ],
    });

    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith("/api/jobs/job-focused") && !init?.method) {
        detailCalls += 1;
        return detailCalls === 1
          ? staleDetail
          : json(detailBody("fresh-detail.mp3"));
      }
      if (
        requestUrl.endsWith("/api/jobs/job-focused/outputs") &&
        !init?.method
      ) {
        outputCalls += 1;
        return outputCalls === 1
          ? staleOutputs
          : json(outputsBody("fresh-output"));
      }
      return defaultFetch?.(url, init) ?? json({});
    });

    await openFocusedJobsList();
    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    await waitFor(() => {
      expect(detailCalls).toBe(1);
      expect(outputCalls).toBe(1);
    });
    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    await waitFor(() => {
      expect(detailCalls).toBe(2);
      expect(outputCalls).toBe(2);
    });

    expect(
      await screen.findByLabelText("Job detail job-focused"),
    ).toHaveTextContent("fresh-detail.mp3");
    expect(
      await screen.findByLabelText("Результаты job-focused"),
    ).toHaveTextContent("fresh-output");

    await act(async () => {
      resolveStaleDetail?.(await json(detailBody("stale-detail.mp3")));
      resolveStaleOutputs?.(await json(outputsBody("stale-output")));
    });

    expect(screen.getByLabelText("Job detail job-focused")).toHaveTextContent(
      "fresh-detail.mp3",
    );
    expect(screen.getByLabelText("Результаты job-focused")).toHaveTextContent(
      "fresh-output",
    );
    expect(document.body.textContent).not.toContain("stale-detail.mp3");
    expect(document.body.textContent).not.toContain("stale-output");
  });

  it("deduplicates terminal dismissal and unlocks after failure", async () => {
    installFocusedOutputFixture({ jobStatus: "completed" });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const dismissResolvers: Array<(response: Response) => void> = [];
    let dismissCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).endsWith("/api/jobs/job-focused/dismiss") &&
        init?.method === "POST"
      ) {
        dismissCalls += 1;
        return new Promise<Response>((resolve) => {
          dismissResolvers.push(resolve);
        });
      }
      return defaultFetch?.(url, init) ?? json({});
    });

    await openFocusedJobsList();
    const dismissButton = screen.getByRole("button", {
      name: "Убрать в историю",
    });
    act(() => {
      dismissButton.click();
      dismissButton.click();
    });

    await waitFor(() => expect(dismissCalls).toBe(1));
    expect(dismissButton).toBeDisabled();
    expect(dismissButton).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      dismissResolvers[0]?.(
        await json({ detail: "raw dismissal failure" }, false, 500),
      );
    });
    expect(
      await screen.findByText(
        "Не удалось убрать задачу в историю. Повторите позже.",
      ),
    ).toBeInTheDocument();
    const unlockedButton = screen.getByRole("button", {
      name: "Убрать в историю",
    });
    await waitFor(() => expect(unlockedButton).toBeEnabled());

    await userEvent.click(unlockedButton);
    await waitFor(() => expect(dismissCalls).toBe(2));
    dismissResolvers[1]?.(
      await json({
        id: "job-focused",
        project_id: "p1",
        status: "completed",
        title: "Focused output job",
        provider: null,
        provider_credential_id: "cred-active",
        terminal_dismissed_at: "2026-07-02T00:04:00Z",
        source_count: 1,
        sources: [],
        created_at: "2026-07-02T00:00:00Z",
        updated_at: "2026-07-02T00:04:00Z",
        cancelled_at: null,
        cancel_requested_at: null,
        attempt_count: 1,
        started_at: "2026-07-02T00:00:30Z",
        finished_at: "2026-07-02T00:03:00Z",
        error_code: null,
        error_message: null,
      }),
    );
    await waitFor(() =>
      expect(
        (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([url]) => url === "/api/projects/p1/jobs",
        ).length,
      ).toBeGreaterThan(1),
    );

    expect(dismissCalls).toBe(2);
    expect(document.body.textContent).not.toContain("raw dismissal failure");
  });

  it("deduplicates in-flight cancellation and unlocks after failure", async () => {
    installFocusedOutputFixture({ jobStatus: "queued" });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const cancelResolvers: Array<(response: Response) => void> = [];
    let cancelCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).endsWith("/api/jobs/job-focused/cancel") &&
        init?.method === "POST"
      ) {
        cancelCalls += 1;
        return new Promise<Response>((resolve) => {
          cancelResolvers.push(resolve);
        });
      }
      return defaultFetch?.(url, init) ?? json({});
    });

    await openFocusedJobsList();
    const cancelButton = screen.getByRole("button", { name: "Отменить" });
    act(() => {
      cancelButton.click();
      cancelButton.click();
    });

    await waitFor(() => expect(cancelCalls).toBe(1));
    expect(cancelButton).toBeDisabled();
    expect(cancelButton).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      cancelResolvers[0]?.(
        await json({ detail: "raw cancellation failure" }, false, 500),
      );
    });
    expect(
      await screen.findByText("Не удалось отменить задачу. Повторите позже."),
    ).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Отменить" });
    await waitFor(() => expect(retryButton).toBeEnabled());

    await userEvent.click(retryButton);
    await waitFor(() => expect(cancelCalls).toBe(2));
    cancelResolvers[1]?.(
      await json({
        id: "job-focused",
        project_id: "p1",
        status: "cancelled",
        title: "Focused output job",
        provider: null,
        provider_credential_id: "cred-active",
        source_count: 1,
        sources: [],
        created_at: "2026-07-02T00:00:00Z",
        updated_at: "2026-07-02T00:02:00Z",
        cancelled_at: "2026-07-02T00:02:00Z",
        cancel_requested_at: null,
        attempt_count: 0,
        started_at: null,
        finished_at: "2026-07-02T00:02:00Z",
        error_code: null,
        error_message: null,
      }),
    );

    expect(
      await screen.findByText(
        "Запрос отмены отправлен. Уже созданные результаты останутся доступны.",
      ),
    ).toBeInTheDocument();
    expect(cancelCalls).toBe(2);
    expect(document.body.textContent).not.toContain("raw cancellation failure");
  });

  it("keeps source deletion ownership and safe outcomes across project switches", async () => {
    installFocusedOutputFixture({
      jobStatus: "processing",
      includeSecondProject: true,
    });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let deleteCalls = 0;
    let deleteSettled = false;
    let deleteConfirmed = false;
    let sourceReadsAfterSettlement = 0;
    const deleteResolvers: Array<(response: Response) => void> = [];
    const ambiguousNotice =
      "\u0421\u0435\u0440\u0432\u0435\u0440 \u043d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043b \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0444\u0430\u0439\u043b\u0430. \u0421\u043f\u0438\u0441\u043e\u043a \u0444\u0430\u0439\u043b\u043e\u0432 \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d; \u043f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u0440\u0438 \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e\u0441\u0442\u0438.";
    const successNotice = "\u0424\u0430\u0439\u043b \u0443\u0431\u0440\u0430\u043d \u0438\u0437 \u043f\u0440\u043e\u0435\u043a\u0442\u0430.";
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects/p1/sources" && !init?.method) {
        if (deleteSettled) sourceReadsAfterSettlement += 1;
        if (deleteConfirmed) return json({ sources: [] });
      }
      if (url === "/api/sources/source-focused" && init?.method === "DELETE") {
        deleteCalls += 1;
        return new Promise<Response>((resolve) => {
          deleteResolvers.push(resolve);
        });
      }
      return defaultFetch?.(url, init) ?? json({});
    });

    await openFocusedJobsList();
    const removeButton = screen.getByRole("button", {
      name: "Убрать из проекта: focused-source.mp3",
    });
    await userEvent.click(removeButton);
    await waitFor(() => expect(deleteCalls).toBe(1));

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    await screen.findByRole("form", {
      name: "Композитор пакетных задач",
    });
    expect(
      screen.queryByText(
        "Сервер не подтвердил удаление файла. Список файлов обновлён; подождите и повторите при необходимости.",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    const restoredRemoveButton = await screen.findByRole("button", {
      name: "Убрать из проекта: focused-source.mp3",
    });
    expect(restoredRemoveButton).toBeDisabled();
    expect(restoredRemoveButton).toHaveAttribute("aria-busy", "true");
    restoredRemoveButton.click();
    expect(deleteCalls).toBe(1);

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    deleteSettled = true;
    await act(async () => {
      deleteResolvers[0]?.(await json({ detail: "raw delete failure" }, false, 500));
    });
    await waitFor(() => expect(sourceReadsAfterSettlement).toBeGreaterThan(0));
    expect(
      screen.queryByText(
        "Сервер не подтвердил удаление файла. Список файлов обновлён; подождите и повторите при необходимости.",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    expect(
      await screen.findByText(
        "Сервер не подтвердил удаление файла. Список файлов обновлён; подождите и повторите при необходимости.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Убрать из проекта: focused-source.mp3",
      }),
    ).toBeEnabled();
    expect(deleteCalls).toBe(1);
    expect(document.body).not.toHaveTextContent("raw delete failure");

    await userEvent.click(
      screen.getByRole("button", {
        name: "\u0423\u0431\u0440\u0430\u0442\u044c \u0438\u0437 \u043f\u0440\u043e\u0435\u043a\u0442\u0430: focused-source.mp3",
      }),
    );
    await waitFor(() => expect(deleteCalls).toBe(2));
    expect(screen.queryByText(ambiguousNotice)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    deleteConfirmed = true;
    await act(async () => {
      deleteResolvers[1]?.(
        await json({
          ok: true,
          source_state: "deleted",
          storage_cleanup: "not_applicable",
        }),
      );
    });
    expect(screen.queryByText(successNotice)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    expect(await screen.findByText(successNotice)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "\u0423\u0431\u0440\u0430\u0442\u044c \u0438\u0437 \u043f\u0440\u043e\u0435\u043a\u0442\u0430: focused-source.mp3",
      }),
    ).not.toBeInTheDocument();
    expect(deleteCalls).toBe(2);
  });

  it("keeps local upload ownership and safe outcomes across project switches", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const putResolvers: Array<(response: Response) => void> = [];
    let completionCalls = 0;
    let uploadSucceeded = false;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && !init?.method) {
        return json({
          projects: [
            {
              id: "p1",
              title: "Research calls",
              description: "Customer interview notes",
              created_at: "2026-07-01T00:00:00",
              updated_at: "2026-07-01T00:00:00",
              archived_at: null,
              output_drive_folder_id: "folder-123",
              output_drive_folder_url:
                "https://drive.example/folders/folder-123",
              output_drive_folder_name: "Transcripts",
            },
            {
              id: "p2",
              title: "Project Two",
              description: null,
              created_at: "2026-07-02T00:00:00",
              updated_at: "2026-07-02T00:00:00",
              archived_at: null,
              output_drive_folder_id: null,
              output_drive_folder_url: null,
              output_drive_folder_name: null,
            },
          ],
        });
      }
      if (url === "/api/projects/p2/sources" && !init?.method) {
        return json({ sources: [] });
      }
      if (url === "/api/projects/p2/jobs" && !init?.method) {
        return json({ jobs: [] });
      }
      if (
        url === "/api/projects/p1/sources" &&
        !init?.method &&
        uploadSucceeded
      ) {
        return json({
          sources: [
            {
              id: "local-source-2",
              project_id: "p1",
              source_type: "local_upload",
              original_filename: "local-source-2.ogg",
              mime_type: "audio/ogg",
              size_bytes: 7,
              drive_file_id: null,
              drive_file_url: null,
              upload_status: "uploaded",
              uploaded_at: "2099-01-01T00:00:00Z",
              expires_at: "2099-01-02T00:00:00Z",
              deleted_at: null,
              delete_reason: null,
              created_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-01T00:00:00Z",
            },
          ],
        });
      }
      if (
        String(url).startsWith("https://upload.example/presigned") &&
        init?.method === "PUT"
      ) {
        return new Promise<Response>((resolve) => {
          putResolvers.push(resolve);
        });
      }
      if (
        String(url).endsWith("/local-upload/complete") &&
        init?.method === "POST"
      ) {
        completionCalls += 1;
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    const firstRow = await screen.findByLabelText("Источник строки 1");
    const firstInput = within(firstRow).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;
    await userEvent.upload(
      firstInput,
      new File(["failed"], "first-off-panel.ogg", { type: "audio/ogg" }),
    );
    await waitFor(() => expect(putResolvers).toHaveLength(1));
    expect(firstInput).toBeDisabled();
    expect(firstInput).toHaveAttribute("aria-busy", "true");

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    expect(
      screen.queryByText(
        "Загрузка файлов для этого проекта ещё выполняется. Дождитесь завершения перед новым выбором.",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    expect(
      await screen.findByText(
        "Загрузка файлов для этого проекта ещё выполняется. Дождитесь завершения перед новым выбором.",
      ),
    ).toBeInTheDocument();
    const restoredInput = screen.getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;
    expect(restoredInput).toBeDisabled();
    expect(restoredInput).toHaveAttribute("aria-busy", "true");
    fireEvent.change(restoredInput, {
      target: {
        files: [
          new File(["duplicate"], "duplicate.ogg", { type: "audio/ogg" }),
        ],
      },
    });
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/projects/p1/sources/local-upload/initiate" &&
          init?.method === "POST",
      ),
    ).toHaveLength(1);

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    await act(async () => {
      putResolvers[0]?.(
        await json({ detail: "raw off-panel storage failure" }, false, 500),
      );
    });
    expect(
      screen.queryByText(
        "Локальная загрузка не завершена. Проверьте список файлов проекта перед повторной попыткой.",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    expect(
      await screen.findByText(
        "Локальная загрузка не завершена. Проверьте список файлов проекта перед повторной попыткой.",
      ),
    ).toBeInTheDocument();
    const retryInput = screen.getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;
    await waitFor(() => expect(retryInput).toBeEnabled());
    expect(document.body).not.toHaveTextContent(
      "raw off-panel storage failure",
    );

    await userEvent.upload(
      retryInput,
      new File(["success"], "second-off-panel.ogg", { type: "audio/ogg" }),
    );
    await waitFor(() => expect(putResolvers).toHaveLength(2));
    expect(
      screen.queryByText(
        "Локальная загрузка не завершена. Проверьте список файлов проекта перед повторной попыткой.",
      ),
    ).not.toBeInTheDocument();
    uploadSucceeded = true;
    await act(async () => {
      putResolvers[1]?.(await json({ ok: true }));
    });
    await within(screen.getByLabelText("Источник строки 1")).findByText(
      "Загружено файлов: 1.",
    );
    expect(completionCalls).toBe(1);

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    expect(
      screen.queryByText(
        "Локальная загрузка завершена. Обновлённый список файлов доступен в проекте.",
      ),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    expect(
      await screen.findByText(
        "Локальная загрузка завершена. Обновлённый список файлов доступен в проекте.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /local-source-2\.ogg/ }),
    ).toBeInTheDocument();
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/projects/p1/sources/local-upload/initiate" &&
          init?.method === "POST",
      ),
    ).toHaveLength(2);
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).startsWith("https://upload.example/presigned") &&
          init?.method === "PUT",
      ),
    ).toHaveLength(2);
  });

  it("keeps cancellation ownership and safe outcomes across project switches", async () => {
    installFocusedOutputFixture({
      jobStatus: "queued",
      includeSecondProject: true,
    });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const cancelResolvers: Array<(response: Response) => void> = [];
    let cancelCalls = 0;
    const failureMessage =
      "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443. \u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.";
    const successMessage =
      "\u0417\u0430\u043f\u0440\u043e\u0441 \u043e\u0442\u043c\u0435\u043d\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d. \u0423\u0436\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u043d\u044b\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u043e\u0441\u0442\u0430\u043d\u0443\u0442\u0441\u044f \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b.";
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).endsWith("/api/jobs/job-focused/cancel") &&
        init?.method === "POST"
      ) {
        cancelCalls += 1;
        return new Promise<Response>((resolve) => {
          cancelResolvers.push(resolve);
        });
      }
      return defaultFetch?.(url, init) ?? json({});
    });

    await openFocusedJobsList();
    const cancelButton = screen.getByRole("button", {
      name: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c",
    });
    await userEvent.click(cancelButton);
    await waitFor(() => expect(cancelCalls).toBe(1));

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    await screen.findByRole("form", {
      name: "\u041a\u043e\u043c\u043f\u043e\u0437\u0438\u0442\u043e\u0440 \u043f\u0430\u043a\u0435\u0442\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u0447",
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );

    const restoredCancelButton = await screen.findByRole("button", {
      name: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c",
    });
    expect(restoredCancelButton).toBeDisabled();
    expect(restoredCancelButton).toHaveAttribute("aria-busy", "true");
    restoredCancelButton.click();
    expect(cancelCalls).toBe(1);

    await act(async () => {
      cancelResolvers[0]?.(
        await json({ detail: "raw cancellation failure" }, false, 500),
      );
    });
    await waitFor(() => expect(restoredCancelButton).toBeEnabled());
    expect(await screen.findByText(failureMessage)).toBeInTheDocument();

    await userEvent.click(restoredCancelButton);
    await waitFor(() => expect(cancelCalls).toBe(2));
    expect(screen.queryByText(failureMessage)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Project Two/ }),
    );
    await act(async () => {
      cancelResolvers[1]?.(
        await json({
          id: "job-focused",
          project_id: "p1",
          status: "cancelled",
          title: "Focused output job",
          provider: null,
          provider_credential_id: "cred-active",
          terminal_dismissed_at: null,
          source_count: 1,
          sources: [],
          created_at: "2026-07-02T00:00:00Z",
          updated_at: "2026-07-02T00:02:00Z",
          cancelled_at: "2026-07-02T00:02:00Z",
          cancel_requested_at: null,
          attempt_count: 1,
          started_at: "2026-07-02T00:00:30Z",
          finished_at: "2026-07-02T00:02:00Z",
          error_code: null,
          error_message: null,
        }),
      );
    });
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Research calls/ }),
    );
    expect(await screen.findByText(successMessage)).toBeInTheDocument();
    expect(cancelCalls).toBe(2);
    expect(document.body.textContent).not.toContain("raw cancellation failure");
  });
  it("deduplicates output reconciliation and unlocks after failure", async () => {
    const reconciliationResponse = {
      job_id: "job-focused",
      job_status: "failed",
      available: true,
      counts: { reconciliation_required: 1 },
      cases: [],
    };
    installFocusedOutputFixture({
      jobStatus: "failed",
      reconciliationResponse,
    });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const reconciliationResolvers: Array<(response: Response) => void> = [];
    let reconciliationCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).endsWith(
          "/api/jobs/job-focused/output-reconciliation/check",
        ) && init?.method === "POST"
      ) {
        reconciliationCalls += 1;
        return new Promise<Response>((resolve) => {
          reconciliationResolvers.push(resolve);
        });
      }
      return defaultFetch?.(url, init) ?? json({});
    });

    await openFocusedJobsList();
    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    const reconciliationButton = await screen.findByRole("button", {
      name: "Проверить созданный документ в Google Drive",
    });
    act(() => {
      reconciliationButton.click();
      reconciliationButton.click();
    });

    await waitFor(() => expect(reconciliationCalls).toBe(1));
    expect(reconciliationButton).toBeDisabled();
    expect(reconciliationButton).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      reconciliationResolvers[0]?.(
        await json({ detail: "raw reconciliation failure" }, false, 500),
      );
    });
    expect(
      await screen.findByText("Не удалось проверить Google Drive."),
    ).toBeInTheDocument();
    const unlockedButton = screen.getByRole("button", {
      name: "Проверить созданный документ в Google Drive",
    });
    await waitFor(() => expect(unlockedButton).toBeEnabled());

    await userEvent.click(unlockedButton);
    await waitFor(() => expect(reconciliationCalls).toBe(2));
    reconciliationResolvers[1]?.(
      await json({
        job_id: "job-focused",
        checked: 1,
        resolved: 1,
        unresolved: 0,
        conflicts: 0,
      }),
    );
    await waitFor(() =>
      expect(
        (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([url]) => url === "/api/projects/p1/jobs",
        ).length,
      ).toBeGreaterThan(1),
    );

    const reconciliationPosts = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      ([url, init]) =>
        url === "/api/jobs/job-focused/output-reconciliation/check" &&
        init?.method === "POST",
    );
    expect(reconciliationPosts).toHaveLength(2);
    expect(document.body.textContent).not.toContain(
      "raw reconciliation failure",
    );
  });

  it("deduplicates provider-cost retry and unlocks after failure", async () => {
    const retryResponse = {
      job_id: "job-focused",
      job_status: "failed",
      available: true,
      reason: "partial_provider_resume_available",
      attempt_count: 1,
      max_attempts: 3,
      missing_output_count: 1,
      retry_safe_source_count: 1,
      resumable_provider_part_count: 1,
      provider_total_part_count: 2,
      provider_failure_code: "provider_rate_limited",
    };
    installFocusedOutputFixture({ jobStatus: "failed", retryResponse });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const retryResolvers: Array<(response: Response) => void> = [];
    let retryCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).endsWith("/api/jobs/job-focused/retry") &&
        init?.method === "POST"
      ) {
        retryCalls += 1;
        return new Promise<Response>((resolve) => {
          retryResolvers.push(resolve);
        });
      }
      return defaultFetch?.(url, init) ?? json({});
    });

    await openFocusedJobsList();
    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    const retryButton = await screen.findByRole("button", {
      name: "Продолжить оставшиеся части",
    });
    act(() => {
      retryButton.click();
      retryButton.click();
    });

    await waitFor(() => expect(retryCalls).toBe(1));
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      retryResolvers[0]?.(
        await json({ detail: "raw provider retry failure" }, false, 500),
      );
    });
    expect(
      await screen.findByText("Повтор сейчас недоступен."),
    ).toBeInTheDocument();
    const unlockedButton = screen.getByRole("button", {
      name: "Продолжить оставшиеся части",
    });
    await waitFor(() => expect(unlockedButton).toBeEnabled());

    await userEvent.click(unlockedButton);
    await waitFor(() => expect(retryCalls).toBe(2));
    retryResolvers[1]?.(
      await json({
        ...retryResponse,
        job_status: "queued",
        available: false,
        reason: "already_queued",
        attempt_count: 2,
      }),
    );
    await waitFor(() =>
      expect(
        (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([url]) => url === "/api/projects/p1/jobs",
        ).length,
      ).toBeGreaterThan(1),
    );

    const retryPosts = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      ([url, init]) =>
        url === "/api/jobs/job-focused/retry" && init?.method === "POST",
    );
    expect(retryPosts).toHaveLength(2);
    expect(
      retryPosts.map(([, init]) => JSON.parse(String(init?.body))),
    ).toEqual([
      { confirm_remaining_provider_cost: true },
      { confirm_remaining_provider_cost: true },
    ]);
    expect(document.body.textContent).not.toContain(
      "raw provider retry failure",
    );
  });
  it("confirms timed-out cancellation with an authoritative job read and no second POST", async () => {
    installFocusedOutputFixture({ jobStatus: "queued" });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let cancelPosts = 0;
    let authoritativeReads = 0;
    let mutationSignal: AbortSignal | undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      const requestUrl = String(url);
      if (
        requestUrl.endsWith("/api/jobs/job-focused/cancel") &&
        init?.method === "POST"
      ) {
        cancelPosts += 1;
        mutationSignal = init.signal;
        return new Promise<Response>((_resolve, reject) =>
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
        );
      }
      if (requestUrl.endsWith("/api/jobs/job-focused") && !init?.method) {
        authoritativeReads += 1;
        return json({
          id: "job-focused",
          project_id: "p1",
          status: "cancelled",
          title: "Focused output job",
          provider: null,
          terminal_dismissed_at: null,
          source_count: 1,
          sources: [],
          created_at: "2026-07-02T00:00:00Z",
          updated_at: "2026-07-02T00:02:00Z",
          cancelled_at: "2026-07-02T00:02:00Z",
          cancel_requested_at: null,
          attempt_count: 1,
          started_at: null,
          finished_at: "2026-07-02T00:02:00Z",
          error_code: null,
          error_message: null,
        });
      }
      return defaultFetch?.(url, init) ?? json({});
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 0 : delay,
          ...args,
        )) as typeof setTimeout);

    try {
      await openFocusedJobsList();
      await userEvent.click(
        screen.getByRole("button", { name: "Отменить" }),
      );

      expect(
        await screen.findByText(
          "Сервер не ответил вовремя, но отмена подтверждена по актуальному состоянию задачи.",
        ),
      ).toBeInTheDocument();
      expect(cancelPosts).toBe(1);
      expect(authoritativeReads).toBe(1);
      expect(mutationSignal?.aborted).toBe(true);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("reports an unconfirmed timed-out dismissal without repeating the POST", async () => {
    installFocusedOutputFixture({ jobStatus: "completed" });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let dismissPosts = 0;
    let authoritativeReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      const requestUrl = String(url);
      if (
        requestUrl.endsWith("/api/jobs/job-focused/dismiss") &&
        init?.method === "POST"
      ) {
        dismissPosts += 1;
        return new Promise<Response>((_resolve, reject) =>
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
        );
      }
      if (requestUrl.endsWith("/api/jobs/job-focused") && !init?.method) {
        authoritativeReads += 1;
        return defaultFetch?.(url, init) ?? json({});
      }
      return defaultFetch?.(url, init) ?? json({});
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 0 : delay,
          ...args,
        )) as typeof setTimeout);

    try {
      await openFocusedJobsList();
      const readsBeforeDismiss = authoritativeReads;
      await userEvent.click(
        screen.getByRole("button", { name: "Убрать в историю" }),
      );

      expect(
        await screen.findByText(
          "Сервер не ответил вовремя. Перенос в историю не подтверждён; обновите состояние перед повтором.",
        ),
      ).toBeInTheDocument();
      expect(dismissPosts).toBe(1);
      expect(authoritativeReads).toBeGreaterThan(readsBeforeDismiss);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("confirms a timed-out provider-cost retry from readiness without repeating the POST", async () => {
    const beforeRetry = {
      job_id: "job-focused",
      job_status: "failed",
      available: true,
      reason: "partial_provider_resume_available",
      attempt_count: 1,
      max_attempts: 3,
      missing_output_count: 1,
      retry_safe_source_count: 1,
      resumable_provider_part_count: 1,
      provider_total_part_count: 2,
      provider_failure_code: "provider_rate_limited",
    };
    installFocusedOutputFixture({
      jobStatus: "failed",
      retryResponse: beforeRetry,
    });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let retryPosts = 0;
    let readinessReads = 0;
    let retryTimedOut = false;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      const requestUrl = String(url);
      if (
        requestUrl.endsWith("/api/jobs/job-focused/retry") &&
        init?.method === "POST"
      ) {
        retryPosts += 1;
        return new Promise<Response>((_resolve, reject) =>
          init.signal?.addEventListener("abort", () => {
            retryTimedOut = true;
            reject(init.signal?.reason);
          }),
        );
      }
      if (
        requestUrl.endsWith("/api/jobs/job-focused/retry") &&
        !init?.method
      ) {
        readinessReads += 1;
        return json(
          retryTimedOut
            ? {
                ...beforeRetry,
                job_status: "queued",
                available: false,
                reason: "job_not_failed",
              }
            : beforeRetry,
        );
      }
      return defaultFetch?.(url, init) ?? json({});
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 0 : delay,
          ...args,
        )) as typeof setTimeout);

    try {
      await openFocusedJobsList();
      await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
      const readsBeforeRetry = readinessReads;
      await userEvent.click(
        await screen.findByRole("button", {
          name: "Продолжить оставшиеся части",
        }),
      );

      expect(
        await screen.findByText(
          "Сервер не ответил вовремя, но повтор подтверждён по актуальному состоянию задачи.",
        ),
      ).toBeInTheDocument();
      expect(retryPosts).toBe(1);
      expect(readinessReads).toBeGreaterThan(readsBeforeRetry);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("reports an unchanged reconciliation state after timeout without repeating the Google check", async () => {
    const reconciliationState = {
      job_id: "job-focused",
      job_status: "failed",
      available: true,
      counts: { reconciliation_required: 1 },
      cases: [
        {
          job_source_id: "source-1",
          status: "reconciliation_required",
          resolved: false,
          last_checked_at: null,
        },
      ],
    };
    installFocusedOutputFixture({
      jobStatus: "failed",
      reconciliationResponse: reconciliationState,
    });
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let reconciliationPosts = 0;
    let reconciliationReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      const requestUrl = String(url);
      if (
        requestUrl.endsWith(
          "/api/jobs/job-focused/output-reconciliation/check",
        ) &&
        init?.method === "POST"
      ) {
        reconciliationPosts += 1;
        return new Promise<Response>((_resolve, reject) =>
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
        );
      }
      if (
        requestUrl.endsWith("/api/jobs/job-focused/output-reconciliation") &&
        !init?.method
      ) {
        reconciliationReads += 1;
        return json(reconciliationState);
      }
      return defaultFetch?.(url, init) ?? json({});
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 0 : delay,
          ...args,
        )) as typeof setTimeout);

    try {
      await openFocusedJobsList();
      await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
      const readsBeforeCheck = reconciliationReads;
      await userEvent.click(
        await screen.findByRole("button", {
          name: "Проверить созданный документ в Google Drive",
        }),
      );

      expect(
        await screen.findByText(
          "Сервер не ответил вовремя. Результат проверки не подтверждён; обновите состояние перед повтором.",
        ),
      ).toBeInTheDocument();
      expect(reconciliationPosts).toBe(1);
      expect(reconciliationReads).toBeGreaterThan(readsBeforeCheck);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
  it("renders the explicit empty job outputs state without output links", async () => {
    installFocusedOutputFixture({
      jobStatus: "queued",
      outputCount: 0,
      outputs: [],
    });
    await openFocusedJobsList();
    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    const outputs = await screen.findByLabelText("Результаты job-focused");
    expect(outputs).toHaveTextContent(/Состояние задачи:\s*В очереди/);
    expect(outputs).toHaveTextContent("Результатов: 0");
    expect(outputs).toHaveTextContent("Результаты пока не созданы.");
    expect(
      within(outputs).queryByRole("link", { name: "Открыть документ" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["failed", "Ошибка"],
    ["cancelled", "Отменена"],
  ] as const)(
    "renders partial outputs for %s jobs without completed-status gating",
    async (jobStatus, label) => {
      installFocusedOutputFixture({ jobStatus });
      await openFocusedJobsList();
      await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
      const outputs = await screen.findByLabelText("Результаты job-focused");
      expect(outputs).toHaveTextContent(
        new RegExp(`Состояние задачи:\\s*${label}`),
      );
      expect(outputs).toHaveTextContent("Результатов: 1");
      expect(outputs).toHaveTextContent(`${jobStatus}-source`);
      expect(
        within(outputs).getByRole("link", { name: "Открыть документ" }),
      ).toHaveAttribute(
        "href",
        "https://docs.google.com/document/d/focused-safe/edit",
      );
    },
  );

  it("keeps loaded job details visible when outputs request fails generically", async () => {
    installFocusedOutputFixture({
      outputsOk: false,
      outputsErrorBody: { detail: "raw database traceback token" },
    });
    await openFocusedJobsList();
    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    const detail = await screen.findByLabelText("Job detail job-focused");
    expect(
      within(detail).getByText("1. focused-source.mp3"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Не удалось загрузить результаты."),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(
      "raw database traceback token",
    );
  });

  it("keeps successful outputs visible when job detail request fails generically", async () => {
    installFocusedOutputFixture({
      detailOk: false,
      detailErrorBody: { detail: "raw detail traceback token" },
    });
    await openFocusedJobsList();
    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    expect(
      await screen.findByText("Не удалось загрузить детали задачи."),
    ).toBeInTheDocument();
    const outputs = await screen.findByLabelText("Результаты job-focused");
    expect(outputs).toHaveTextContent("Результатов: 1");
    expect(outputs).toHaveTextContent("processing-source");
    expect(
      within(outputs).getByRole("link", { name: "Открыть документ" }),
    ).toHaveAttribute(
      "href",
      "https://docs.google.com/document/d/focused-safe/edit",
    );
    expect(document.body.textContent).not.toContain(
      "raw detail traceback token",
    );
  });

  it("keeps login out of the DOM while session bootstrap is pending", async () => {
    let resolveSession: (value: Response) => void = () => undefined;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.endsWith("/api/auth/session"))
          return new Promise((resolve) => {
            resolveSession = resolve;
          });
        return json({ csrf_token: "csrf-after-refresh" });
      },
    );
    renderApp();
    expect(screen.getByRole("status")).toHaveTextContent("Проверяем сессию…");
    expect(
      screen.queryByRole("heading", { name: "Вход" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Пароль")).not.toBeInTheDocument();
    resolveSession(
      await json({
        authenticated: true,
        user: { email: "user@example.com", role: "admin" },
      }),
    );
    await waitForPlatformOverview();
  });

  it("renders login only for confirmed anonymous session and keeps manual login/logout transitions", async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    window.history.replaceState({}, "", "/settings/diagnostics");
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith("/api/auth/session")) return json({}, false, 401);
      if (url.endsWith("/api/auth/bootstrap-status"))
        return json({ bootstrap_required: false });
      if (url.endsWith("/api/auth/login-context"))
        return json({ login_csrf_token: "login-csrf" });
      if (url.endsWith("/api/auth/login"))
        return json({
          authenticated: true,
          user: { email: "user@example.com", role: "admin" },
          csrf_token: "csrf-login",
        });
      if (url.endsWith("/api/auth/logout")) return json({ ok: true });
      if (url.endsWith("/api/credentials"))
        return json({
          credentials: [
            {
              id: "cred-active",
              provider: "elevenlabs",
              label: "Primary STT",
              status: "active",
              masked_value: "••••1234",
              active_version: 2,
            },
          ],
        });
      if (url.endsWith("/api/audit-events")) return json({ events: [] });
      if (url.endsWith("/api/google/connection"))
        return json(googleConnectionFixture());
      return json({ csrf_token: "csrf-after-refresh" });
    });
    renderApp();
    await screen.findByRole("heading", { name: "Вход" });
    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Пароль"), "password-long");
    await userEvent.click(screen.getByRole("button", { name: "Войти" }));
    await waitForPlatformOverview();
    expect(window.location.pathname).toBe("/");
    await openSettingsPage();
    await userEvent.click(await screen.findByRole("button", { name: "Выйти" }));
    expect(
      await screen.findByRole("heading", { name: "Вход" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Пароль"), "password-long");
    await userEvent.click(screen.getByRole("button", { name: "Войти" }));
    await waitForPlatformOverview();
  });

  it("shows retry instead of login after transient session failure", async () => {
    let sessionCalls = 0;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.endsWith("/api/auth/session")) {
          sessionCalls += 1;
          return sessionCalls === 1
            ? json({ detail: "service unavailable" }, false, 503)
            : json({
                authenticated: true,
                user: { email: "user@example.com", role: "admin" },
              });
        }
        return json({ csrf_token: "csrf-after-refresh" });
      },
    );
    renderApp();
    expect(
      await screen.findByText(
        "Не удалось проверить сессию. Повторите попытку.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Вход" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitForPlatformOverview();
  });

  it("bounds and retries both authenticated bootstrap stages", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const sessionSignals: AbortSignal[] = [];
    const csrfSignals: AbortSignal[] = [];
    let secondAttemptSessionSignal: AbortSignal | undefined;
    let sessionReads = 0;
    let csrfReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/session")) {
        sessionReads += 1;
        const signal = init?.signal;
        if (!signal) throw new Error("Session bootstrap signal is missing");
        if (sessionReads === 1) {
          sessionSignals.push(signal);
          return new Promise<Response>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason));
          });
        }
        if (sessionReads === 2) secondAttemptSessionSignal = signal;
        return json({
          authenticated: true,
          user: { email: "current@example.com", role: "admin" },
        });
      }
      if (url.endsWith("/api/auth/csrf") && init?.method === "POST") {
        csrfReads += 1;
        const signal = init.signal;
        if (!signal) throw new Error("CSRF bootstrap signal is missing");
        if (csrfReads === 1) {
          csrfSignals.push(signal);
          return new Promise<Response>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason));
          });
        }
        return json({
          csrf_token: "csrf-current",
          user: { email: "current@example.com", role: "admin" },
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      expect(
        await screen.findByText(
          "Не удалось проверить сессию. Повторите попытку.",
        ),
      ).toBeInTheDocument();
      expect(sessionSignals).toHaveLength(1);
      expect(sessionSignals[0]?.aborted).toBe(true);
      expect(
        screen.queryByRole("heading", { name: "Вход" }),
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
      await waitFor(() => expect(csrfSignals).toHaveLength(1));
      expect(csrfSignals[0]).toBe(secondAttemptSessionSignal);
      expect(csrfSignals[0]?.aborted).toBe(true);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Не удалось проверить сессию",
      );

      await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
      await waitForPlatformOverview();
      expect(sessionReads).toBe(3);
      expect(csrfReads).toBe(2);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("rejects malformed bootstrap responses without rendering raw fields", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let sessionReads = 0;
    let csrfReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/session")) {
        sessionReads += 1;
        if (sessionReads === 1) {
          return json({
            authenticated: true,
            user: { email: "safe@example.com", role: "raw-session-role" },
            raw_session_field: "raw-session-secret",
          });
        }
        return json({
          authenticated: true,
          user: { email: "safe@example.com", role: "user" },
        });
      }
      if (url.endsWith("/api/auth/csrf") && init?.method === "POST") {
        csrfReads += 1;
        if (csrfReads === 1) {
          return json({
            csrf_token: "raw-csrf-token",
            user: { email: "other@example.com", role: "user" },
            raw_csrf_field: "raw-csrf-secret",
          });
        }
        return json({
          csrf_token: "csrf-safe",
          user: { email: "safe@example.com", role: "user" },
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось проверить сессию",
    );
    expect(document.body.textContent).not.toContain("raw-session-role");
    expect(document.body.textContent).not.toContain("raw-session-secret");
    expect(
      screen.queryByRole("heading", { name: "Вход" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(csrfReads).toBe(1));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось проверить сессию",
    );
    expect(document.body.textContent).not.toContain("raw-csrf-token");
    expect(document.body.textContent).not.toContain("raw-csrf-secret");
    expect(document.body.textContent).not.toContain("other@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitForPlatformOverview();
    expect(sessionReads).toBe(3);
    expect(csrfReads).toBe(2);
  });

  it("aborts and ignores an older StrictMode bootstrap across session generations", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let sessionReads = 0;
    let csrfReads = 0;
    let olderSignal: AbortSignal | undefined;
    let resolveOlderSession: ((response: Response) => void) | undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/session")) {
        sessionReads += 1;
        if (sessionReads === 1) {
          olderSignal = init?.signal;
          return new Promise<Response>((resolve) => {
            resolveOlderSession = resolve;
          });
        }
        return json({
          authenticated: true,
          user: { email: "current@example.com", role: "admin" },
        });
      }
      if (url.endsWith("/api/auth/csrf") && init?.method === "POST") {
        csrfReads += 1;
        const lateOlderAttempt = csrfReads > 1;
        return json({
          csrf_token: lateOlderAttempt ? "csrf-older" : "csrf-current",
          user: lateOlderAttempt
            ? { email: "older@example.com", role: "user" }
            : { email: "current@example.com", role: "admin" },
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await waitForPlatformOverview();
    expect(sessionReads).toBeGreaterThanOrEqual(2);
    expect(olderSignal?.aborted).toBe(true);
    expect(resolveOlderSession).toBeDefined();

    await act(async () => {
      resolveOlderSession?.(
        await json({
          authenticated: true,
          user: { email: "older@example.com", role: "user" },
          raw_session_field: "late-raw-session-field",
        }),
      );
    });
    await waitFor(() => expect(csrfReads).toBeGreaterThanOrEqual(2));
    await openSettingsPage();
    expect(await screen.findByText("current@example.com")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("older@example.com");
    expect(document.body.textContent).not.toContain("late-raw-session-field");

    await userEvent.click(screen.getByRole("button", { name: "Выйти" }));
    expect(
      await screen.findByRole("heading", { name: "Вход" }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("older@example.com");
  });

  it("reconciles an ambiguous logout without replaying the mutation", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let sessionReads = 0;
    let csrfReads = 0;
    let logoutCalls = 0;
    let timedOutLogoutSignal: AbortSignal | undefined;
    const logoutTokens: string[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/session")) {
        sessionReads += 1;
        return json({
          authenticated: true,
          user: { email: "logout@example.com", role: "admin" },
        });
      }
      if (url.endsWith("/api/auth/csrf") && init?.method === "POST") {
        csrfReads += 1;
        return json({
          csrf_token: csrfReads === 1 ? "csrf-initial" : "csrf-reconciled",
          user: { email: "logout@example.com", role: "admin" },
        });
      }
      if (url.endsWith("/api/auth/logout") && init?.method === "POST") {
        logoutCalls += 1;
        logoutTokens.push(String(new Headers(init.headers).get("x-csrf-token")));
        if (logoutCalls === 1) {
          timedOutLogoutSignal = init.signal;
          if (!timedOutLogoutSignal) {
            throw new Error("Logout signal is missing");
          }
          return new Promise<Response>((_resolve, reject) => {
            timedOutLogoutSignal?.addEventListener("abort", () =>
              reject(timedOutLogoutSignal?.reason),
            );
          });
        }
        return json({ ok: true });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openSettingsPage();
      const logoutButton = screen.getByRole("button", { name: "Выйти" });
      fireEvent.click(logoutButton);
      fireEvent.click(logoutButton);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Не удалось подтвердить выход",
      );
      expect(screen.getByText("logout@example.com")).toBeInTheDocument();
      expect(timedOutLogoutSignal?.aborted).toBe(true);
      expect(logoutCalls).toBe(1);
      expect(sessionReads).toBe(2);
      expect(csrfReads).toBe(2);

      await userEvent.click(screen.getByRole("button", { name: "Выйти" }));
      expect(
        await screen.findByRole("heading", { name: "Вход" }),
      ).toBeInTheDocument();
      expect(logoutCalls).toBe(2);
      expect(logoutTokens).toEqual(["csrf-initial", "csrf-reconciled"]);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("accepts an authoritative anonymous reconciliation after malformed logout success", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let sessionReads = 0;
    let logoutCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/session")) {
        sessionReads += 1;
        if (sessionReads > 1) {
          return json({ detail: "raw-session-ended" }, false, 401);
        }
        return json({
          authenticated: true,
          user: { email: "logout@example.com", role: "user" },
        });
      }
      if (url.endsWith("/api/auth/csrf") && init?.method === "POST") {
        return json({
          csrf_token: "csrf-initial",
          user: { email: "logout@example.com", role: "user" },
        });
      }
      if (url.endsWith("/api/auth/logout") && init?.method === "POST") {
        logoutCalls += 1;
        return json({ ok: "raw-ok", raw_logout_field: "raw-logout-secret" });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openSettingsPage();
    await userEvent.click(screen.getByRole("button", { name: "Выйти" }));

    expect(
      await screen.findByRole("heading", { name: "Вход" }),
    ).toBeInTheDocument();
    expect(logoutCalls).toBe(1);
    expect(sessionReads).toBe(2);
    expect(document.body.textContent).not.toContain("raw-ok");
    expect(document.body.textContent).not.toContain("raw-logout-secret");
    expect(document.body.textContent).not.toContain("raw-session-ended");
  });

  it("aborts logout ownership on root-shell teardown and ignores late success", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let logoutSignal: AbortSignal | undefined;
    let resolveLogout: ((response: Response) => void) | undefined;
    let sessionReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/session")) sessionReads += 1;
      if (url.endsWith("/api/auth/logout") && init?.method === "POST") {
        logoutSignal = init.signal;
        return new Promise<Response>((resolve) => {
          resolveLogout = resolve;
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    const rendered = render(<App />);
    await openSettingsPage();
    await userEvent.click(screen.getByRole("button", { name: "Выйти" }));
    await waitFor(() => expect(resolveLogout).toBeDefined());

    rendered.unmount();
    expect(logoutSignal?.aborted).toBe(true);
    await act(async () => resolveLogout?.(await json({ ok: true })));
    expect(sessionReads).toBe(1);
  });

  it("waits for confirmed Google connection before showing OAuth success", async () => {
    window.history.pushState(
      {},
      "",
      "/studio?keep=1&google_oauth=connected#safe",
    );
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let resolveConnection: (value: Response) => void = () => undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/connection"))
        return new Promise((resolve) => {
          resolveConnection = resolve;
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Настройки аккаунта" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Google Drive подключён. Статус подключения обновлён.",
      ),
    ).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/google/connection",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.anything(),
      "",
      "/studio?keep=1#safe",
    );
    expect(window.location.search).toBe("?keep=1");
    resolveConnection(
      await json({
        connected: true,
        status: "active",
        google_email: "safe.user@example.com",
        scopes: "openid email https://www.googleapis.com/auth/drive.file",
        connected_at: "2026-07-01T00:00:00",
        revoked_at: null,
        picker_configured: true,
        picker_scope_ready: true,
        picker_ready: true,
        reconnect_required: false,
      }),
    );
    expect(
      await screen.findByText(
        "Google Drive подключён. Статус подключения обновлён.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("safe.user@example.com"),
    ).toBeInTheDocument();
    cleanup();
    renderApp();
    await waitForPlatformOverview();
    expect(
      screen.queryByText(
        "Google Drive подключён. Статус подключения обновлён.",
      ),
    ).not.toBeInTheDocument();
  });

  it("routes a safe maintenance OAuth callback to confirmed settings", async () => {
    window.history.pushState(
      {},
      "",
      "/?google_maintenance_oauth=connected&keep=1#safe",
    );

    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Настройки аккаунта" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Расширенный доступ для обслуживания подключён и проверен.",
      ),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/google/maintenance/connection",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(window.location.search).toBe("?keep=1");
    expect(window.location.hash).toBe("#safe");
  });

  it("does not show OAuth success when refreshed Google connection is disconnected", async () => {
    window.history.pushState({}, "", "/?google_oauth=connected");
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/connection"))
        return json(googleConnectionFixture());
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    expect(
      await screen.findByText("Google Drive не подключён"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Google Drive подключён. Статус подключения обновлён.",
      ),
    ).not.toBeInTheDocument();
  });

  it("does not show OAuth success when refreshed Google connection fails", async () => {
    window.history.pushState({}, "", "/?google_oauth=connected");
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/connection"))
        return json({ detail: "raw backend token detail" }, false, 500);
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    expect(
      await screen.findByText(
        "Не удалось загрузить статус Google Drive. Повторите попытку.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Google Drive подключён. Статус подключения обновлён.",
      ),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw backend token detail");
  });

  it.each([
    ["cancelled", "Подключение Google Drive отменено."],
    [
      "invalid_state",
      "Не удалось завершить подключение Google Drive. Запустите подключение ещё раз.",
    ],
    [
      "invalid_callback",
      "Не удалось завершить подключение Google Drive. Запустите подключение ещё раз.",
    ],
    [
      "exchange_failed",
      "Google Drive не подключён. Повторите авторизацию и подтвердите запрошенный доступ.",
    ],
    [
      "offline_access_missing",
      "Google Drive не подключён. Повторите авторизацию и подтвердите запрошенный доступ.",
    ],
  ])(
    "maps Google OAuth result %s to a safe message",
    async (result, message) => {
      window.history.pushState(
        {},
        "",
        `/?google_oauth=${result}&error_description=raw-secret-value`,
      );
      renderApp();
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("raw-secret-value");
    },
  );

  it("ignores unknown Google OAuth results safely", async () => {
    window.history.pushState(
      {},
      "",
      "/?google_oauth=raw-secret-value&keep=1#hash",
    );
    renderApp();
    await waitForPlatformOverview();
    expect(document.body.textContent).not.toContain("raw-secret-value");
    expect(window.location.search).toBe("?keep=1");
    expect(window.location.hash).toBe("#hash");
  });

  it("marks login fields with explicit browser autocomplete semantics", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) =>
        url.endsWith("/api/auth/session")
          ? json({}, false, 401)
          : json({ bootstrap_required: false }),
    );
    renderApp();
    const email = await screen.findByLabelText("Email");
    const password = screen.getByLabelText("Пароль");
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(password).toHaveAttribute("autocomplete", "current-password");
  });
  it("marks BYOK credential forms to avoid saved login autofill", async () => {
    renderApp();
    await openSettingsPage();
    await screen.findByText(/Ключи провайдеров/);
    await userEvent.click(
      screen.getByRole("button", { name: "Добавить ключ" }),
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Заменить" })[0],
    );
    const createKey = screen.getByPlaceholderText("Новый ключ");
    const replaceKey = screen.getByPlaceholderText("Новый ключ для замены");
    expect(createKey.closest("form")).toHaveAttribute("autocomplete", "off");
    expect(replaceKey.closest("form")).toHaveAttribute("autocomplete", "off");
    const label = screen.getByPlaceholderText("Метка");
    expect(label).toHaveAttribute("name", "credential_label");
    expect(label).toHaveAttribute("autocomplete", "off");
    expect(createKey).toHaveAttribute("name", "credential_raw_value");
    expect(replaceKey).toHaveAttribute(
      "name",
      "replacement_credential_raw_value",
    );
    expect(createKey).toHaveAttribute("autocomplete", "new-password");
    expect(replaceKey).toHaveAttribute("autocomplete", "new-password");
    expect(createKey).toHaveAttribute("type", "password");
    expect(replaceKey).toHaveAttribute("type", "password");
    expect(createKey).toHaveAttribute("spellcheck", "false");
    expect(replaceKey).toHaveAttribute("spellcheck", "false");
    expect(createKey).toHaveAttribute("data-1p-ignore", "true");
    expect(createKey).toHaveAttribute("data-lpignore", "true");
    expect(createKey).toHaveAttribute("data-bwignore", "true");
    expect(replaceKey).toHaveAttribute("data-1p-ignore", "true");
    expect(replaceKey).toHaveAttribute("data-lpignore", "true");
    expect(replaceKey).toHaveAttribute("data-bwignore", "true");
  });
  it("renders polished overview summary cards with separated labels and values", async () => {
    renderApp();
    const projectsCard = await screen.findByLabelText("Проекты");
    expect(within(projectsCard).getByText("Проекты")).toHaveClass(
      "summary-label",
    );
    expect(within(projectsCard).getByText("1")).toHaveClass("summary-value");
    const driveCard = screen.getByLabelText("Google Drive");
    expect(within(driveCard).getByText("Google Drive")).toHaveClass(
      "summary-label",
    );
    expect(within(driveCard).getByText("Подключён")).toHaveClass(
      "summary-value",
    );
    expect(screen.queryByText("ПРОЕКТЫ1")).not.toBeInTheDocument();
    expect(screen.queryByText("GOOGLE DRIVEПодключён")).not.toBeInTheDocument();
  });

  it("keeps project list out of the application sidebar selector architecture", async () => {
    renderApp();
    await openProjectsPage();
    const projectList = await screen.findByLabelText("Список проектов");
    expect(projectList.tagName.toLowerCase()).toBe("section");
    expect(projectList).toHaveClass("project-list");
    expect(projectList).not.toHaveClass("app-sidebar");
    expect(within(projectList).getByText("Research calls")).toBeInTheDocument();
  });

  it("preserves multi-row associations while moving and deleting composer rows", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const folderNames: Record<string, string> = {
      "folder-alpha": "Folder Alpha",
      "folder-bravo": "Folder Bravo",
      "folder-charlie": "Folder Charlie",
    };
    const folderIds = ["folder-alpha", "folder-bravo", "folder-charlie"];
    vi.spyOn(googlePicker, "openGooglePicker").mockImplementation(
      async (kind) => {
        expect(kind).toBe("output-folder");
        const folderId = folderIds.shift() ?? "folder-fallback";
        return {
          action: "picked",
          docs: [{ id: folderId }],
        } as Awaited<ReturnType<typeof googlePicker.openGooglePicker>>;
      },
    );
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url.endsWith("/api/projects/p1/output-folders/google-picker/verify") &&
        init?.method === "POST"
      ) {
        const body = JSON.parse(String(init.body)) as { folder_id?: string };
        const folderId = body.folder_id ?? "folder-fallback";
        const name = folderNames[folderId] ?? "Folder Fallback";
        return json({
          id: folderId,
          name,
          web_view_url: `https://drive.example/folders/${folderId}`,
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const getComposerRows = () =>
      screen
        .getAllByRole("listitem")
        .filter((item) => item.classList.contains("composer-row"));
    const expectRow = async (
      position: number,
      sourceText: string,
      folderText: string,
      title: string,
    ) => {
      const row = getComposerRows()[position - 1];
      expect(row).toHaveAccessibleName(`Задача ${position}`);
      expect(within(row).getByText(`Задача ${position}`)).toBeInTheDocument();
      expect(row).toHaveTextContent(sourceText);
      expect(row).toHaveTextContent(folderText);
      await waitFor(() =>
        expect(
          within(row).getByLabelText(`Название задачи для строки ${position}`),
        ).toHaveValue(title),
      );
    };

    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });

    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1, "folder-one");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 1"),
      "Alpha title",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 1",
      }),
    );
    await screen.findByText("Folder Alpha");

    await userEvent.click(
      screen.getByRole("button", { name: "Добавить строку" }),
    );
    await chooseExistingSource(2, "local-temp");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 2"),
      "Bravo title",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /папку результата для строки 2/,
      }),
    );
    await screen.findByText("Folder Bravo");

    await userEvent.click(
      screen.getByRole("button", { name: "Добавить строку" }),
    );
    const row3 = await screen.findByLabelText("Источник строки 3");
    await userEvent.upload(
      within(row3).getByLabelText(
        "Выбрать файлы с устройства для строки 3",
      ) as HTMLInputElement,
      new File(["charlie"], "charlie.ogg", { type: "audio/ogg" }),
    );
    await screen.findByText("Загружено файлов: 1.");
    await userEvent.type(
      screen.getByLabelText("Название задачи для строки 3"),
      "Charlie title",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /папку результата для строки 3/,
      }),
    );
    await screen.findByText("Folder Charlie");

    await expectRow(1, "Лекция 1", "Folder Alpha", "Alpha title");
    await expectRow(2, "local-temp.ogg", "Folder Bravo", "Bravo title");
    await expectRow(3, "local-source-1.ogg", "Folder Charlie", "Charlie title");

    await userEvent.click(
      screen.getByRole("button", { name: "Поднять строку 3" }),
    );

    await expectRow(1, "Лекция 1", "Folder Alpha", "Alpha title");
    await expectRow(2, "local-source-1.ogg", "Folder Charlie", "Charlie title");
    await expectRow(3, "local-temp.ogg", "Folder Bravo", "Bravo title");
    expect(
      screen.getByRole("button", { name: "Поднять строку 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Поднять строку 2" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Опустить строку 2" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Удалить строку 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Опустить строку 3" }),
    ).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Удалить строку 2" }),
    );

    expect(getComposerRows()).toHaveLength(2);
    const rowTextAfterDelete = getComposerRows()
      .map((row) => row.textContent ?? "")
      .join(" ");
    expect(rowTextAfterDelete).not.toContain("Folder Charlie");
    expect(screen.queryByDisplayValue("Charlie title")).not.toBeInTheDocument();
    await expectRow(1, "Лекция 1", "Folder Alpha", "Alpha title");
    await expectRow(2, "local-temp.ogg", "Folder Bravo", "Bravo title");

    await userEvent.click(
      screen.getByRole("button", { name: "Удалить строку 2" }),
    );

    expect(getComposerRows()).toHaveLength(1);
    await expectRow(1, "Лекция 1", "Folder Alpha", "Alpha title");
    expect(
      screen.queryByRole("button", { name: /Поднять строку/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Опустить строку/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Удалить строку/ }),
    ).not.toBeInTheDocument();
    expect(
      baseFetch.mock.calls.some(
        ([url, init]) =>
          String(url).startsWith("/api/sources/") && init?.method === "DELETE",
      ),
    ).toBe(false);
  });

  it("keeps the final composer row and does not remove its project source", async () => {
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await chooseExistingSource(1, "Лекция 1");
    expect(
      screen.queryByRole("button", { name: "Удалить строку 1" }),
    ).not.toBeInTheDocument();
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) =>
          String(url).startsWith("/api/sources/") && init?.method === "DELETE",
      ),
    ).toBe(false);
    expect(screen.getAllByText(/Лекция 1/).length).toBeGreaterThan(0);
  });

  it("renders balanced Drive and device source cards with an accessible hidden file input", async () => {
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    const row = await screen.findByLabelText("Источник строки 1");
    expect(
      within(row).getByRole("button", { name: "Выбрать файлы Google Drive" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Добавить строку для/ }),
    ).not.toBeInTheDocument();
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;
    expect(input.tagName.toLowerCase()).toBe("input");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("multiple");
    await waitFor(() => expect(input).toBeEnabled());
    expect(input).toHaveClass("visually-hidden");
    expect(input.closest(".file-picker-control")).not.toBeNull();
    expect(
      input.closest(".file-picker-control")?.querySelector("label"),
    ).toHaveTextContent("С устройства");
    expect(input).toHaveAttribute(
      "accept",
      "audio/*,video/*,application/ogg",
    );
    expect(document.body).not.toHaveTextContent(
      "https://upload.example/presigned",
    );
  });

  it("local multi-file selection preserves successful rows through ordered batch creation", async () => {
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;

    await userEvent.upload(
      input,
      [
        new File(["one"], "one.ogg", { type: "audio/ogg" }),
        new File(["bad"], "bad.exe", { type: "application/x-msdownload" }),
        new File(["two"], "two.ogg", { type: "audio/ogg" }),
      ],
      { applyAccept: false },
    );

    await screen.findByText("Загружено файлов: 2.");
    expect(screen.getByLabelText("Источник строки 1")).toHaveTextContent(
      "local-source-1.ogg",
    );
    expect(screen.getByLabelText("Источник строки 1")).toHaveTextContent(
      "Временная копия хранится до:",
    );
    expect(screen.getByLabelText("Источник строки 2")).toHaveTextContent(
      "local-source-2.ogg",
    );
    expect(
      screen.getByText(
        /bad\.exe: тип файла не поддерживается текущими правилами\./,
      ),
    ).toBeInTheDocument();
    const uploadPuts = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      ([url, init]) =>
        String(url).startsWith("https://upload.example/presigned") &&
        init?.method === "PUT",
    );
    expect(uploadPuts).toHaveLength(2);
    for (const [, init] of uploadPuts) {
      expect(init).toEqual(
        expect.objectContaining({
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
        }),
      );
    }
    expect(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 1",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Выбрать папку результата для строки 2",
      }),
    ).toBeInTheDocument();
    await chooseResultFolder(1, "folder-local-1");
    await chooseResultFolder(2, "folder-local-2");
    await reviewAndConfirmBatch();
    const batchCall = await waitFor(() => {
      const call = (
        fetch as unknown as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        ([url, init]) =>
          url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
      );
      expect(call).toBeTruthy();
      return call;
    });
    expect(JSON.parse(String(batchCall?.[1]?.body)).items).toMatchObject([
      {
        source_id: "local-source-1",
        output_folder_id: "folder-local-1",
      },
      {
        source_id: "local-source-2",
        output_folder_id: "folder-local-2",
      },
    ]);
  });

  it("bounds ambiguous local upload initiation without replaying the POST", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const initiationSignals: AbortSignal[] = [];
    let initiationCalls = 0;
    let sourceReadsAfterInitiation = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/sources" &&
        !init?.method &&
        initiationCalls > 0
      ) {
        sourceReadsAfterInitiation += 1;
      }
      if (
        url === "/api/projects/p1/sources/local-upload/initiate" &&
        init?.method === "POST"
      ) {
        initiationCalls += 1;
        const signal = init.signal;
        if (!signal) throw new Error("upload initiation signal is missing");
        initiationSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);
    try {
      renderApp();
      await openProjectsPage();
      const row = await screen.findByLabelText("Источник строки 1");
      const input = within(row).getByLabelText(
        "Выбрать файлы с устройства для строки 1",
      ) as HTMLInputElement;

      await userEvent.upload(
        input,
        new File(["stalled"], "initiation-timeout.ogg", {
          type: "audio/ogg",
        }),
      );

      expect(
        await within(row).findByText(
          /Сервер не подтвердил подготовку загрузки\. Список файлов обновлён/,
        ),
      ).toBeInTheDocument();
      expect(initiationSignals).toHaveLength(1);
      expect(initiationSignals[0]?.aborted).toBe(true);
      expect(initiationCalls).toBe(1);
      await waitFor(() => expect(sourceReadsAfterInitiation).toBeGreaterThan(0));
      expect(input).toBeEnabled();
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            String(url).startsWith("https://upload.example/presigned") &&
            init?.method === "PUT",
        ),
      ).toHaveLength(0);
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            String(url).endsWith("/local-upload/complete") &&
            init?.method === "POST",
        ),
      ).toHaveLength(0);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("fails closed after an ambiguous initiation response without replay", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let initiationCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/sources/local-upload/initiate" &&
        init?.method === "POST"
      ) {
        initiationCalls += 1;
        expect(init.signal).toBeInstanceOf(AbortSignal);
        return json({ detail: "raw private initiation failure" }, false, 500);
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;

    await userEvent.upload(
      input,
      new File(["ambiguous"], "initiation-500.ogg", { type: "audio/ogg" }),
    );

    expect(
      await within(row).findByText(
        /Сервер не подтвердил подготовку загрузки\. Список файлов обновлён/,
      ),
    ).toBeInTheDocument();
    expect(initiationCalls).toBe(1);
    expect(input).toBeEnabled();
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).startsWith("https://upload.example/presigned") &&
          init?.method === "PUT",
      ),
    ).toHaveLength(0);
    expect(document.body).not.toHaveTextContent(
      "raw private initiation failure",
    );
  });
  it("bounds a stalled local PUT and recovers without repeating object upload", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const putSignals: AbortSignal[] = [];
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).startsWith("https://upload.example/presigned") &&
        init?.method === "PUT"
      ) {
        const signal = init.signal;
        if (!signal) throw new Error("upload PUT signal is missing");
        putSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);
    try {
      renderApp();
      await openProjectsPage();
      const row = await screen.findByLabelText("Источник строки 1");
      const input = within(row).getByLabelText(
        "Выбрать файлы с устройства для строки 1",
      ) as HTMLInputElement;

      await userEvent.upload(
        input,
        new File(["stalled"], "put-timeout.ogg", { type: "audio/ogg" }),
      );

      await within(row).findByText("Загружено файлов: 1.");
      expect(putSignals).toHaveLength(1);
      expect(putSignals[0]?.aborted).toBe(true);
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            url ===
              "/api/projects/p1/sources/local-upload/initiate" &&
            init?.method === "POST",
        ),
      ).toHaveLength(1);
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            String(url).startsWith("https://upload.example/presigned") &&
            init?.method === "PUT",
        ),
      ).toHaveLength(1);
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            String(url).endsWith("/local-upload/complete") &&
            init?.method === "POST",
        ),
      ).toHaveLength(1);
      expect(row).toHaveTextContent("local-source-1.ogg");
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("recovers an ambiguous local PUT through completion without creating a second source", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let rejectedPut = false;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).startsWith("https://upload.example/presigned") &&
        init?.method === "PUT" &&
        !rejectedPut
      ) {
        rejectedPut = true;
        return Promise.reject(new TypeError("synthetic ambiguous PUT"));
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;

    await userEvent.upload(
      input,
      new File(["recover"], "recover.ogg", { type: "audio/ogg" }),
    );

    await within(row).findByText("Загружено файлов: 1.");
    expect(row).toHaveTextContent("local-source-1.ogg");
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith(
            "/api/projects/p1/sources/local-upload/initiate",
          ) && init?.method === "POST",
      ),
    ).toHaveLength(1);
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).startsWith("https://upload.example/presigned") &&
          init?.method === "PUT",
      ),
    ).toHaveLength(1);
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith("/local-upload/complete") &&
          init?.method === "POST",
      ),
    ).toHaveLength(1);
  });

  it("accepts an authoritative uploaded source without replaying completion", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let completionCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/sources" &&
        !init?.method &&
        completionCalls === 1
      ) {
        return json({
          sources: [
            {
              id: "local-source-1",
              project_id: "p1",
              source_type: "local_upload",
              original_filename: "local-source-1.ogg",
              mime_type: "audio/ogg",
              size_bytes: 7,
              drive_file_id: null,
              drive_file_url: null,
              upload_status: "uploaded",
              uploaded_at: "2099-01-01T00:00:00Z",
              expires_at: "2099-01-02T00:00:00Z",
              deleted_at: null,
              delete_reason: null,
              created_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-01T00:00:00Z",
            },
          ],
        });
      }
      if (
        String(url).endsWith("/local-upload/complete") &&
        init?.method === "POST"
      ) {
        completionCalls += 1;
        return Promise.reject(new TypeError("synthetic lost response"));
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File(["recover"], "completed-reconcile.ogg", {
        type: "audio/ogg",
      }),
    );

    await within(row).findByText("Загружено файлов: 1.");
    expect(completionCalls).toBe(1);
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith(
            "/api/projects/p1/sources/local-upload/initiate",
          ) && init?.method === "POST",
      ),
    ).toHaveLength(1);
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).startsWith("https://upload.example/presigned") &&
          init?.method === "PUT",
      ),
    ).toHaveLength(1);
    expect(document.body).not.toHaveTextContent("synthetic lost response");
  });
  it("retries local upload completion without repeating initiation or PUT", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let rejectedCompletion = false;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/sources" &&
        !init?.method &&
        rejectedCompletion
      ) {
        return json({
          sources: [
            {
              id: "local-source-1",
              project_id: "p1",
              source_type: "local_upload",
              upload_status: "pending",
              mime_type: "audio/ogg",
              size_bytes: 7,
              deleted_at: null,
            },
          ],
        });
      }      if (
        String(url).endsWith("/local-upload/complete") &&
        init?.method === "POST" &&
        !rejectedCompletion
      ) {
        rejectedCompletion = true;
        return Promise.reject(new TypeError("synthetic lost completion"));
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;

    await userEvent.upload(
      input,
      new File(["recover"], "complete-retry.ogg", { type: "audio/ogg" }),
    );

    await within(row).findByText("Загружено файлов: 1.");
    expect(
      baseFetch.mock.calls.some(
        ([url, init]) =>
          url === "/api/projects/p1/sources" &&
          init?.cache === "no-store",
      ),
    ).toBe(true);
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith(
            "/api/projects/p1/sources/local-upload/initiate",
          ) && init?.method === "POST",
      ),
    ).toHaveLength(1);
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).startsWith("https://upload.example/presigned") &&
          init?.method === "PUT",
      ),
    ).toHaveLength(1);
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith("/local-upload/complete") &&
          init?.method === "POST",
      ),
    ).toHaveLength(2);
  });

  it("bounds stalled upload completion and replays only after pending reconciliation", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const completionSignals: AbortSignal[] = [];
    let completionCalls = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === "/api/projects/p1/sources" &&
        !init?.method &&
        completionCalls === 1
      ) {
        return json({
          sources: [
            {
              id: "local-source-1",
              project_id: "p1",
              source_type: "local_upload",
              upload_status: "pending",
              mime_type: "audio/ogg",
              size_bytes: 7,
              deleted_at: null,
            },
          ],
        });
      }
      if (
        String(url).endsWith("/local-upload/complete") &&
        init?.method === "POST"
      ) {
        completionCalls += 1;
        if (completionCalls === 1) {
          const signal = init.signal;
          if (!signal) throw new Error("upload completion signal is missing");
          completionSignals.push(signal);
          return new Promise<Response>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason));
          });
        }
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);
    try {
      renderApp();
      await openProjectsPage();
      const row = await screen.findByLabelText("Источник строки 1");
      const input = within(row).getByLabelText(
        "Выбрать файлы с устройства для строки 1",
      ) as HTMLInputElement;

      await userEvent.upload(
        input,
        new File(["recover"], "complete-timeout.ogg", { type: "audio/ogg" }),
      );

      await within(row).findByText("Загружено файлов: 1.");
      expect(completionSignals).toHaveLength(1);
      expect(completionSignals[0]?.aborted).toBe(true);
      expect(completionCalls).toBe(2);
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            String(url).endsWith(
              "/api/projects/p1/sources/local-upload/initiate",
            ) && init?.method === "POST",
        ),
      ).toHaveLength(1);
      expect(
        baseFetch.mock.calls.filter(
          ([url, init]) =>
            String(url).startsWith("https://upload.example/presigned") &&
            init?.method === "PUT",
        ),
      ).toHaveLength(1);
      expect(
        baseFetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/projects/p1/sources" &&
            init?.cache === "no-store",
        ),
      ).toBe(true);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
  it("blocks a second local selection while the row upload is still running", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let releasePut: (() => void) | undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).startsWith("https://upload.example/presigned") &&
        init?.method === "PUT"
      )
        return new Promise<Response>((resolve) => {
          releasePut = () => resolve({ ok: true } as Response);
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;

    await userEvent.upload(
      input,
      new File(["first"], "first.ogg", { type: "audio/ogg" }),
    );
    await waitFor(() => expect(input).toBeDisabled());
    fireEvent.change(input, {
      target: {
        files: [new File(["second"], "second.ogg", { type: "audio/ogg" })],
      },
    });
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith(
            "/api/projects/p1/sources/local-upload/initiate",
          ) && init?.method === "POST",
      ),
    ).toHaveLength(1);

    act(() => releasePut?.());
    await within(row).findByText("Загружено файлов: 1.");
    await waitFor(() => expect(input).toBeEnabled());
    expect(row).toHaveTextContent("local-source-1.ogg");
    expect(row).not.toHaveTextContent("local-source-2.ogg");
  });

  it("reports an explicit storage PUT rejection without leaking upload identity", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).startsWith("https://upload.example/presigned") &&
        init?.method === "PUT"
      )
        return json({ private: "raw-storage-body" }, false, 400);
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;

    await userEvent.upload(
      input,
      new File(["rejected"], "private-filename.ogg", { type: "audio/ogg" }),
    );

    expect(
      await within(row).findByText(
        /Хранилище отклонило загрузку\. Обновите страницу и повторите/,
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        baseFetch.mock.calls.some(([url]) =>
          String(url).endsWith("/api/diagnostics/pwa-events"),
        ),
      ).toBe(true),
    );
    const event = postedPwaEventsFrom(baseFetch).find(
      (candidate) => candidate.event_code === "PWA_API_REQUEST_FAILED",
    );
    expect(event).toMatchObject({
      event_code: "PWA_API_REQUEST_FAILED",
      metadata: {
        boundary: "api_request",
        error_code: "api_request_failed",
        endpoint_group: "sources",
        http_status_category: "4xx",
        retryable: false,
      },
    });
    expect(JSON.stringify(event)).not.toContain("private-filename.ogg");
    expect(JSON.stringify(event)).not.toContain("presigned");
    expect(JSON.stringify(event)).not.toContain("raw-storage-body");
    expect(
      baseFetch.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/local-upload/complete") &&
          init?.method === "POST",
      ),
    ).toBe(false);
  });

  it("refuses an unsafe upload capability before contacting its origin", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).endsWith(
          "/api/projects/p1/sources/local-upload/initiate",
        ) &&
        init?.method === "POST"
      )
        return json({
          source_id: "unsafe-source",
          upload: {
            method: "POST",
            url: "http://unsafe-upload.example/private",
            headers: {
              "Content-Type": "audio/ogg",
              Authorization: "private",
            },
            expires_in: 3600,
          },
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;

    await userEvent.upload(
      input,
      new File(["unsafe"], "unsafe.ogg", { type: "audio/ogg" }),
    );

    expect(
      await within(row).findByText(
        /Сервер вернул небезопасный ответ для загрузки/,
      ),
    ).toBeInTheDocument();
    expect(
      baseFetch.mock.calls.some(([url]) =>
        String(url).startsWith("http://unsafe-upload.example"),
      ),
    ).toBe(false);
    expect(
      baseFetch.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/local-upload/complete") &&
          init?.method === "POST",
      ),
    ).toBe(false);
    expect(document.body.textContent).not.toContain("Authorization");
    expect(document.body.textContent).not.toContain("private");
  });

  it("refuses a mismatched upload completion before adding it to a task row", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        String(url).endsWith("/local-upload/complete") &&
        init?.method === "POST"
      )
        return json({
          id: "different-source",
          project_id: "p1",
          source_type: "local_upload",
          original_filename: "different.ogg",
          mime_type: "audio/ogg",
          size_bytes: 8,
          drive_file_url: null,
          upload_status: "uploaded",
          uploaded_at: "2099-01-01T00:00:00Z",
          expires_at: "2099-01-02T00:00:00Z",
          deleted_at: null,
          delete_reason: null,
          created_at: "2026-07-01T00:00:00Z",
          updated_at: "2026-07-01T00:00:00Z",
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;

    await userEvent.upload(
      input,
      new File(["mismatch"], "mismatch.ogg", { type: "audio/ogg" }),
    );

    expect(
      await within(row).findByText(
        /Сервер вернул несогласованное подтверждение загрузки/,
      ),
    ).toBeInTheDocument();
    expect(row).not.toHaveTextContent("different.ogg");
    expect(
      baseFetch.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith("/local-upload/complete") &&
          init?.method === "POST",
      ),
    ).toHaveLength(1);
  });

  it("bounds and retries Preparation prerequisite reads independently", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    const credentialSignals: AbortSignal[] = [];
    const policySignals: AbortSignal[] = [];
    let credentialReads = 0;
    let policyReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/credentials") && !init?.method) {
        credentialReads += 1;
        if (credentialReads === 2) {
          const signal = init.signal;
          if (!signal) throw new Error("Preparation credential signal is missing");
          credentialSignals.push(signal);
          return new Promise<Response>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason));
          });
        }
      }
      if (url.endsWith("/api/sources/upload-policy") && !init?.method) {
        policyReads += 1;
        if (policyReads === 1) {
          const signal = init.signal;
          if (!signal) throw new Error("Upload-policy signal is missing");
          policySignals.push(signal);
          return new Promise<Response>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason));
          });
        }
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderApp();
      await openProjectsPage();
      await screen.findByRole("form", { name: "Композитор пакетных задач" });
      expect(
        await screen.findByRole("button", {
          name: "Повторить загрузку подключения ElevenLabs",
        }),
      ).toBeInTheDocument();
      expect(
        await screen.findByText(/Не удалось загрузить правила локальной загрузки/),
      ).toBeInTheDocument();
      expect(credentialSignals).toHaveLength(1);
      expect(policySignals).toHaveLength(1);
      expect(credentialSignals[0]?.aborted).toBe(true);
      expect(policySignals[0]?.aborted).toBe(true);
      const credentialReadsBeforeRetry = credentialReads;
      const policyReadsBeforeRetry = policyReads;

      await userEvent.click(
        screen.getByRole("button", {
          name: "Повторить загрузку подключения ElevenLabs",
        }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Повторить загрузку правил" }),
      );

      expect(await screen.findByText("Подключён и готов")).toBeInTheDocument();
      const row = await screen.findByLabelText("Источник строки 1");
      await waitFor(() =>
        expect(
          within(row).getByLabelText(
            "Выбрать файлы с устройства для строки 1",
          ),
        ).toBeEnabled(),
      );
      expect(credentialReads).toBe(credentialReadsBeforeRetry + 1);
      expect(policyReads).toBe(policyReadsBeforeRetry + 1);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("rejects malformed Preparation prerequisite responses without raw fields", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let credentialReads = 0;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/credentials") && !init?.method) {
        credentialReads += 1;
        if (credentialReads === 2) {
          return json({
            credentials: [
              credentialFixture({
                id: "duplicate-preparation",
                label: "raw-credential-field",
              }),
              credentialFixture({ id: "duplicate-preparation" }),
            ],
          });
        }
      }
      if (url.endsWith("/api/sources/upload-policy") && !init?.method) {
        return json({
          local_upload_enabled: true,
          max_upload_bytes: "raw-policy-field",
          supported_mime_prefixes: ["audio/"],
          supported_mime_types: [],
        });
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    expect(
      await screen.findByRole("button", {
        name: "Повторить загрузку подключения ElevenLabs",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Не удалось загрузить правила локальной загрузки/),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw-credential-field");
    expect(document.body.textContent).not.toContain("raw-policy-field");
    const row = await screen.findByLabelText("Источник строки 1");
    expect(
      within(row).getByLabelText(
        "Выбрать файлы с устройства для строки 1",
      ),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Проверить задачи/ }),
    ).toBeDisabled();
  });

  it("aborts and ignores late Preparation prerequisites across project remounts", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    let credentialReads = 0;
    let policyReads = 0;
    let olderCredentialSignal: AbortSignal | undefined;
    let olderPolicySignal: AbortSignal | undefined;
    let resolveOlderCredentials: ((response: Response) => void) | undefined;
    let resolveOlderPolicy: ((response: Response) => void) | undefined;
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/projects") && !init?.method) {
        return json({
          projects: [
            projectFixture({
              id: "p1",
              title: "Research calls",
              created_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-01T00:00:00Z",
            }),
            projectFixture({
              id: "p2",
              title: "Project Two",
              created_at: "2026-07-02T00:00:00Z",
              updated_at: "2026-07-02T00:00:00Z",
            }),
          ],
        });
      }
      if (
        (url.endsWith("/api/projects/p2/sources") ||
          url.endsWith("/api/projects/p2/jobs")) &&
        !init?.method
      ) {
        return json(url.endsWith("/sources") ? { sources: [] } : { jobs: [] });
      }
      if (url.endsWith("/api/credentials") && !init?.method) {
        credentialReads += 1;
        if (credentialReads === 2) {
          olderCredentialSignal = init.signal;
          return new Promise<Response>((resolve) => {
            resolveOlderCredentials = resolve;
          });
        }
        if (credentialReads > 2) {
          return json({
            credentials: [
              credentialFixture({
                id: `current-${credentialReads}`,
                label: `Current ${credentialReads}`,
              }),
            ],
          });
        }
      }
      if (url.endsWith("/api/sources/upload-policy") && !init?.method) {
        policyReads += 1;
        if (policyReads === 1) {
          olderPolicySignal = init.signal;
          return new Promise<Response>((resolve) => {
            resolveOlderPolicy = resolve;
          });
        }
      }
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });

    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await waitFor(() => expect(resolveOlderCredentials).toBeDefined());
    await waitFor(() => expect(resolveOlderPolicy).toBeDefined());

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two .*02\.07\.2026/ }),
    );
    expect(olderCredentialSignal?.aborted).toBe(true);
    expect(olderPolicySignal?.aborted).toBe(true);
    expect(await screen.findByText("Подключён и готов")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Research calls .*01\.07\.2026/ }),
    );
    expect(await screen.findByText("Подключён и готов")).toBeInTheDocument();
    const row = await screen.findByLabelText("Источник строки 1");
    await waitFor(() =>
      expect(
        within(row).getByLabelText(
          "Выбрать файлы с устройства для строки 1",
        ),
      ).toBeEnabled(),
    );

    const credentialReadsBeforeLate = credentialReads;
    const policyReadsBeforeLate = policyReads;
    await act(async () => {
      resolveOlderCredentials?.(
        await json({
          credentials: [
            credentialFixture({ id: "old-1", label: "Late old profile one" }),
            credentialFixture({ id: "old-2", label: "Late old profile two" }),
          ],
        }),
      );
      resolveOlderPolicy?.(
        await json({
          local_upload_enabled: false,
          max_upload_bytes: 1,
          supported_mime_prefixes: ["audio/"],
          supported_mime_types: [],
        }),
      );
    });

    expect(screen.queryByText("Late old profile one")).not.toBeInTheDocument();
    expect(screen.queryByText("Late old profile two")).not.toBeInTheDocument();
    expect(
      within(row).getByLabelText(
        "Выбрать файлы с устройства для строки 1",
      ),
    ).toBeEnabled();
    expect(credentialReadsBeforeLate).toBeGreaterThanOrEqual(4);
    expect(policyReadsBeforeLate).toBeGreaterThanOrEqual(3);
    expect(credentialReads).toBe(credentialReadsBeforeLate);
    expect(policyReads).toBe(policyReadsBeforeLate);
  });

  it("uses the server upload-size policy before initiating a local upload", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/sources/upload-policy"))
        return json({
          local_upload_enabled: true,
          max_upload_bytes: 3,
          supported_mime_prefixes: ["audio/", "video/"],
          supported_mime_types: ["application/ogg"],
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    const row = await screen.findByLabelText("Источник строки 1");
    const input = within(row).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;
    await waitFor(() => expect(input).toBeEnabled());

    await userEvent.upload(
      input,
      new File(["four"], "too-large.ogg", { type: "audio/ogg" }),
    );

    expect(
      await screen.findByText(/too-large\.ogg: файл больше 3 байт\./),
    ).toBeInTheDocument();
    expect(
      baseFetch.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith(
            "/api/projects/p1/sources/local-upload/initiate",
          ) && init?.method === "POST",
      ),
    ).toBe(false);
  });

  it("fails closed when the server upload policy is unavailable", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/sources/upload-policy"))
        return json({ detail: "unavailable" }, false, 503);
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    expect(
      await screen.findByText(
        /Не удалось загрузить правила локальной загрузки/,
      ),
    ).toBeInTheDocument();
    const row = await screen.findByLabelText("Источник строки 1");
    expect(
      within(row).getByLabelText(
        "Выбрать файлы с устройства для строки 1",
      ),
    ).toBeDisabled();
  });

  it("clears stale local upload status before rejecting a new invalid file", async () => {
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    const deviceCard = await screen.findByLabelText("Источник строки 1");
    const input = within(deviceCard).getByLabelText(
      "Выбрать файлы с устройства для строки 1",
    ) as HTMLInputElement;
    const validFile = new File(["valid audio"], "valid.ogg", {
      type: "audio/ogg",
    });

    await userEvent.upload(input, validFile);

    await within(deviceCard).findByText("Загружено файлов: 1.");
    const uploadInitiationsBeforeInvalid = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith(
          "/api/projects/p1/sources/local-upload/initiate",
        ) && init?.method === "POST",
    );
    expect(uploadInitiationsBeforeInvalid).toHaveLength(1);

    const unsupportedFile = new File(["not media"], "unsupported.exe", {
      type: "application/x-msdownload",
    });
    await userEvent.upload(input, unsupportedFile, { applyAccept: false });

    await screen.findByText(
      /unsupported\.exe: тип файла не поддерживается текущими правилами\./,
    );
    expect(
      within(deviceCard).queryByText(/valid\.ogg/),
    ).not.toBeInTheDocument();
    expect(
      within(deviceCard).queryByText(/Загружено файлов: 1\./),
    ).not.toBeInTheDocument();
    const uploadInitiationsAfterInvalid = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith(
          "/api/projects/p1/sources/local-upload/initiate",
        ) && init?.method === "POST",
    );
    expect(uploadInitiationsAfterInvalid).toHaveLength(1);
  });

  it("shows the no-ready-source recovery state and switches back to sources", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/projects/p1/sources") && !init?.method)
        return json({ sources: [] });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp();
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    expect(
      await screen.findByText(/Сначала добавьте хотя бы один готовый файл/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Перейти к источникам" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Подготовка" }),
    ).not.toBeInTheDocument();
  });

  it("places Google Drive technical values in a closed details block and repairs security summary markup", async () => {
    renderApp();
    await openSettingsPage();
    const technical = await screen.findByText("Технические сведения");
    const details = technical.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(
      within(details as HTMLElement).getByText("active"),
    ).toBeInTheDocument();
    expect(
      within(details as HTMLElement).getByText(/drive.file/),
    ).toBeInTheDocument();
    const securitySummary = screen
      .getByText("Журнал безопасности")
      .closest("summary");
    expect(securitySummary).toHaveAccessibleName("Журнал безопасности");
    expect(securitySummary?.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
    expect(securitySummary?.closest("details")).not.toHaveAttribute("open");
  });

  it("keeps Studio CSS scoped to one token block without broad sidebar aside rules", () => {
    const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    expect(css.match(/:root\s*\{/g)).toHaveLength(1);
    expect(css).toContain(".app-sidebar");
    expect(css).not.toContain("button:not(.primary):not(.danger)");
    expect(css).toMatch(
      /button:where\(\s*:not\(\.primary\):not\(\.danger\)\s*\)/,
    );
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toMatch(/\.shell > main\s*\{[^}]*width:\s*100%/s);
    expect(css).not.toContain("width: min(100%, 1360px)");
    expect(css).not.toContain("!important");
    expect(css).toContain(".app-nav button");
    expect(css).toContain(".tabs button");
    expect(css).toContain(".project-list-item");
    expect(css).toContain(".project-list-item.active");
    expect(css).toContain(".file-picker-control:focus-within .button-like");
    expect(css).toMatch(
      /\.file-picker-control:focus-within \.button-like\s*\{[^}]*outline:/s,
    );
    expect(css).not.toMatch(/(^|\n)aside\s*\{/);
    expect(css).not.toMatch(/aside\s*\{[^}]*height:\s*100vh/s);
    expect(css).not.toMatch(/(^|\n)input\[type=["']file["']\]\s*\{/);
  });

  it("shows bootstrap-required operator instruction", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) =>
        url.endsWith("/api/auth/session")
          ? json({}, false, 401)
          : json({ bootstrap_required: true }),
    );
    renderApp();
    expect(await screen.findByText(/bootstrap-admin/)).toBeInTheDocument();
  });
});

describe("settings diagnostics", () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    clearPwaDiagnosticsSession();
    window.history.replaceState({}, "", "/");
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ ok: true })),
    );
  });

  async function openDiagnosticsSettings() {
    await openSettingsPage();
    await userEvent.click(screen.getByRole("tab", { name: "Диагностика" }));
    await screen.findByRole("heading", { name: "Диагностика" });
  }

  function installBasicPlatformSettingsFixture() {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: false,
            status: null,
            google_email: null,
            scopes: null,
            connected_at: null,
            revoked_at: null,
          });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            build: {},
            diagnostics: {},
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [],
            next_cursor: null,
            period: {
              start: "2026-07-15T00:00:00Z",
              end: "2026-07-16T00:00:00Z",
            },
          });
        if (url.endsWith("/api/projects")) return json({ projects: [] });
        return json({ ok: true });
      },
    );
  }

  it("uses broad diagnostics export copy while preserving the common Markdown report endpoint", async () => {
    const originalURL = URL;
    const createObjectURL = vi.fn(() => "blob:diagnostics-report");
    const revokeObjectURL = vi.fn();
    originalURL.createObjectURL = createObjectURL;
    originalURL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const calledUrls: string[] = [];
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        calledUrls.push(url);
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: false,
            status: null,
            google_email: null,
            scopes: null,
            connected_at: null,
            revoked_at: null,
          });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            build: {},
            diagnostics: {},
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [],
            next_cursor: null,
            period: {
              start: "2026-07-15T00:00:00Z",
              end: "2026-07-16T00:00:00Z",
            },
          });
        if (
          url.endsWith("/api/diagnostics/report.md") &&
          init?.method === "POST"
        )
          return json(new Blob(["# Markdown"], { type: "text/markdown" }));
        return json({ ok: true });
      },
    );

    renderApp();
    await openDiagnosticsSettings();
    expect(
      screen.getByRole("heading", { name: "События диагностики" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Экспорт диагностики" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/PWA, API и фоновой обработки/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Аудит безопасности остаётся/)).toBeInTheDocument();
    expect(screen.getByText(/в этот отчёт не входит/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Период"), "7");
    await userEvent.selectOptions(screen.getByLabelText("Уровень"), "INFO");
    await userEvent.selectOptions(screen.getByLabelText("Компонент"), "api");
    await userEvent.type(
      screen.getByLabelText("Код события"),
      "api.request_failed",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Скачать Markdown" }),
    );
    const reportCalls = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(([url]) =>
      String(url).endsWith("/api/diagnostics/report.md"),
    );
    expect(reportCalls).toHaveLength(1);
    expect(reportCalls[0][1]?.body).toContain('"level":"INFO"');
    expect(reportCalls[0][1]?.body).toContain('"component":"api"');
    expect(reportCalls[0][1]?.body).toContain(
      '"event_code":"api.request_failed"',
    );
    expect(
      calledUrls.some(
        (url) =>
          url.includes("/api/diagnostics/pwa") &&
          !url.endsWith("/api/diagnostics/pwa-events"),
      ),
    ).toBe(false);
    expect(
      clickSpy.mock.instances[0]?.download ?? "studio-diagnostics.md",
    ).toMatch(/\.md$/);
    clickSpy.mockRestore();
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("restores URL-backed navigation without browser-stored navigation state", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const localGet = vi.spyOn(Storage.prototype, "getItem");
    const localSet = vi.spyOn(Storage.prototype, "setItem");
    installBasicPlatformSettingsFixture();
    window.history.replaceState({}, "", "/");

    renderApp();
    await waitForPlatformOverview();
    expect(window.location.pathname).toBe("/");
    await userEvent.click(screen.getByRole("button", { name: "Проекты" }));
    expect(
      await screen.findByRole("heading", { name: "Проекты" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/projects");
    await userEvent.click(screen.getByRole("button", { name: "Настройки" }));
    expect(
      await screen.findByRole("heading", { name: "Настройки аккаунта" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/settings");
    await userEvent.click(screen.getByRole("tab", { name: "Диагностика" }));
    expect(
      await screen.findByRole("heading", { name: "Диагностика" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/settings/diagnostics");
    await userEvent.click(screen.getByRole("tab", { name: "Аккаунт" }));
    expect(
      await screen.findByRole("heading", { name: "Настройки аккаунта" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/settings");
    cleanup();
    expect(
      removeSpy.mock.calls.filter(([type]) => type === "popstate"),
    ).toHaveLength(1);

    window.history.replaceState({}, "", "/settings/diagnostics");
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Диагностика" }),
    ).toBeInTheDocument();
    window.history.pushState({}, "", "/settings");
    fireEvent.popState(window);
    expect(
      await screen.findByRole("heading", { name: "Настройки аккаунта" }),
    ).toBeInTheDocument();
    cleanup();

    window.history.replaceState({}, "", "/unknown");
    renderApp();
    await waitForPlatformOverview();
    cleanup();

    window.history.replaceState({}, "", "/projects");
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Проекты" }),
    ).toBeInTheDocument();
    cleanup();

    window.history.replaceState({}, "", "/settings");
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Настройки аккаунта" }),
    ).toBeInTheDocument();
    expect(
      addSpy.mock.calls.filter(([type]) => type === "popstate"),
    ).toHaveLength(5);
    expect(
      localGet.mock.calls.every(([key]) => key === "studio-theme-preference"),
    ).toBe(true);
    expect(localSet).not.toHaveBeenCalled();
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("direct settings OAuth cleanup preserves the intended settings route", async () => {
    installBasicPlatformSettingsFixture();
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    window.history.replaceState(
      {},
      "",
      "/settings/diagnostics?google_oauth=connected&keep=1",
    );
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Диагностика" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/settings/diagnostics");
    expect(window.location.search).toBe("?keep=1");
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.anything(),
      "",
      "/settings/diagnostics?keep=1",
    );
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("opens platform Settings diagnostics and renders safe system, timeline, PWA, and separate audit sections", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: false,
            status: null,
            google_email: null,
            scopes: null,
            connected_at: null,
            revoked_at: null,
          });
        if (url.endsWith("/api/audit-events"))
          return json({
            events: [
              {
                id: "audit-1",
                type: "auth.login",
                created_at: "2026-07-16T10:00:00Z",
              },
            ],
          });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            environment: "production",
            build: {
              web: "web-build",
              api: "api-build",
              worker: "worker-build",
            },
            google_drive: { connected: true, scope_ready: false },
            provider_credentials: { active_count: 2, ready: true },
            diagnostics: {
              recording_enabled: true,
              debug_recording: "inactive",
              retention_days: 14,
              debug_retention_hours: 24,
            },
            report_limits: { max_days: 7, max_timeline_events: 5000 },
            secret_path: "/secret/path/forbidden",
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [
              {
                id: "evt-1",
                occurred_at: "2026-07-16T09:00:00Z",
                level: "ERROR",
                component: "api",
                event_code: "JOB_FAILED",
                correlation_id: "corr_should_not_render",
                request_id: "req_should_not_render",
                metadata: {
                  boundary: "provider_transport",
                  error_code: "provider_timeout",
                  retryable: true,
                  http_status_category: "5xx",
                  filename: "forbidden.mp3",
                  transcript: "forbidden transcript",
                  safe_count: 3,
                },
                occurrence_count: 2,
              },
            ],
            next_cursor: "cursor-secret",
            period: {
              start: "2026-07-15T00:00:00Z",
              end: "2026-07-16T00:00:00Z",
            },
          });
        if (
          url.endsWith("/api/diagnostics/report.md") &&
          init?.method === "POST"
        )
          return json(new Blob(["# report"], { type: "text/markdown" }));
        return json({ ok: true });
      },
    );

    renderApp();
    await openDiagnosticsSettings();

    expect(screen.getByRole("tab", { name: "Диагностика" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("web-build")).toBeInTheDocument();
    expect(screen.getByText("api-build")).toBeInTheDocument();
    expect(screen.getByText("worker-build")).toBeInTheDocument();
    expect(
      screen.getByText("Разрешение Google Drive получено"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Google Drive готов")).not.toBeInTheDocument();
    expect(screen.getByText("JOB_FAILED")).toBeInTheDocument();
    expect(screen.getAllByText("Ошибка").length).toBeGreaterThan(0);
    expect(screen.getAllByText("API").length).toBeGreaterThan(0);
    expect(screen.getByText("неактивна")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("JOB_FAILEDERROR");
    expect(screen.getByText("boundary")).toBeInTheDocument();
    expect(screen.getByText("error_code")).toBeInTheDocument();
    expect(screen.getByText("retryable")).toBeInTheDocument();
    expect(screen.getByText("http_status_category")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Диагностика PWA" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/пока не включён/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Аудит безопасности" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Вход выполнен/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("corr_should_not_render");
    expect(document.body.textContent).not.toContain("req_should_not_render");
    expect(document.body.textContent).not.toContain("cursor-secret");
    expect(document.body.textContent).not.toContain("/secret/path/forbidden");
    expect(document.body.textContent).not.toContain("forbidden.mp3");
    expect(document.body.textContent).not.toContain("forbidden transcript");
    expect(document.body.textContent).not.toContain("safe_count");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("sends selected filters on the first diagnostics request and cursor only for the second page", async () => {
    const originalURL = URL;
    const createObjectURL = vi.fn(() => "blob:diagnostics-report");
    const revokeObjectURL = vi.fn();
    originalURL.createObjectURL = createObjectURL;
    originalURL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const diagnosticsEventUrls: string[] = [];
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: false,
            status: null,
            google_email: null,
            scopes: null,
            connected_at: null,
            revoked_at: null,
          });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            build: {},
            diagnostics: {},
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
          });
        if (url.includes("/api/diagnostics/events")) {
          diagnosticsEventUrls.push(url);
          const query = new URL(url, "http://localhost").searchParams;
          const isCursorRequest = query.has("cursor");
          return json({
            events: [
              {
                id: isCursorRequest ? "evt-second-page" : "evt-first-page",
                occurred_at: isCursorRequest
                  ? "2026-07-16T09:05:00Z"
                  : "2026-07-16T09:00:00Z",
                level: "INFO",
                component: "worker",
                event_code: isCursorRequest ? "JOB_COMPLETED" : "JOB_CREATED",
                metadata: isCursorRequest
                  ? { output_count: 1, final_job_status: "completed" }
                  : {
                      source_count: 2,
                      batch_position: 1,
                      credential_selected: true,
                    },
                occurrence_count: 1,
              },
            ],
            next_cursor: isCursorRequest ? null : "opaque-cursor",
            period: {
              start: "2026-07-15T00:00:00Z",
              end: "2026-07-16T00:00:00Z",
            },
          });
        }
        if (
          url.endsWith("/api/diagnostics/report.md") &&
          init?.method === "POST"
        )
          return json(new Blob(["# Markdown"], { type: "text/markdown" }));
        return json({ ok: true });
      },
    );

    renderApp();
    await openDiagnosticsSettings();
    await screen.findByText("JOB_CREATED");
    expect(screen.getAllByText("Информация").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Фоновая обработка").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("JOB_CREATEDINFO");
    diagnosticsEventUrls.length = 0;

    await userEvent.selectOptions(screen.getByLabelText("Период"), "7");
    await userEvent.selectOptions(screen.getByLabelText("Уровень"), "INFO");
    await userEvent.selectOptions(screen.getByLabelText("Компонент"), "worker");
    await userEvent.type(screen.getByLabelText("Код события"), "JOB_CREATED");
    await userEvent.click(
      screen.getByRole("button", { name: "Применить фильтры" }),
    );
    await waitFor(() => expect(diagnosticsEventUrls).toHaveLength(1));
    const firstParams = new URL(diagnosticsEventUrls[0], "http://localhost")
      .searchParams;
    expect(firstParams.get("page_size")).toBe("25");
    expect(firstParams.get("start")).toBeTruthy();
    expect(firstParams.get("end")).toBeTruthy();
    expect(firstParams.get("level")).toBe("INFO");
    expect(firstParams.get("component")).toBe("worker");
    expect(firstParams.get("event_code")).toBe("JOB_CREATED");
    expect(firstParams.has("cursor")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    await waitFor(() => expect(diagnosticsEventUrls).toHaveLength(2));
    const secondParams = new URL(diagnosticsEventUrls[1], "http://localhost")
      .searchParams;
    expect([...secondParams.keys()].sort()).toEqual(["cursor", "page_size"]);
    expect(secondParams.get("page_size")).toBe("25");
    expect(secondParams.get("cursor")).toBe("opaque-cursor");
    expect(secondParams.has("start")).toBe(false);
    expect(secondParams.has("end")).toBe(false);
    expect(secondParams.has("level")).toBe(false);
    expect(secondParams.has("component")).toBe(false);
    expect(secondParams.has("event_code")).toBe(false);
    expect(secondParams.has("project_id")).toBe(false);
    expect(secondParams.has("job_id")).toBe(false);
    expect(screen.getByText("JOB_CREATED")).toBeInTheDocument();
    expect(screen.getByText("JOB_COMPLETED")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    await userEvent.click(
      screen.getByRole("button", { name: "Скачать Markdown" }),
    );
    const reportCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]) =>
      String(url).endsWith("/api/diagnostics/report.md"),
    );
    expect(reportCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(reportCall?.[1]?.body).toContain('"level":"INFO"');
    await waitFor(() =>
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob)),
    );
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:diagnostics-report");
    expect(document.body.innerHTML).not.toContain(".txt");
    expect(document.body.innerHTML).not.toContain("text/html");
    expect(document.body.innerHTML).not.toContain("application/json");
    expect(document.body.innerHTML).not.toContain("https://");
    clickSpy.mockRestore();
  });

  it("renders backend-registered diagnostic metadata keys and rejects arbitrary sensitive metadata", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: false,
            status: null,
            google_email: null,
            scopes: null,
            connected_at: null,
            revoked_at: null,
          });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            build: {},
            diagnostics: {},
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [
              {
                id: "created",
                occurred_at: "2026-07-16T09:00:00Z",
                level: "INFO",
                component: "api",
                event_code: "JOB_CREATED",
                metadata: {
                  source_count: 2,
                  batch_position: 0,
                  credential_selected: true,
                  filename: "forbidden-source.mp3",
                  url: "https://forbidden.example/report",
                  attempt: 99,
                },
                occurrence_count: 1,
              },
              {
                id: "provider-failed",
                occurred_at: "2026-07-16T09:01:00Z",
                level: "ERROR",
                component: "worker",
                event_code: "PROVIDER_REQUEST_FAILED",
                metadata: {
                  attempt_number: 3,
                  boundary: "provider_transport",
                  duration_ms: 1200,
                  error_code: "provider_timeout",
                  retryable: true,
                  http_status_category: "5xx",
                  transcript: "forbidden transcript",
                  secret: "forbidden-secret",
                  duration_seconds: 2,
                },
                occurrence_count: 1,
              },
              {
                id: "completed",
                occurred_at: "2026-07-16T09:02:00Z",
                level: "INFO",
                component: "worker",
                event_code: "JOB_COMPLETED",
                metadata: {
                  output_count: 1,
                  final_job_status: "completed",
                  attempt_number: 3,
                  request_id: "req_should_not_render",
                },
                occurrence_count: 1,
              },
              {
                id: "cancelled",
                occurred_at: "2026-07-16T09:03:00Z",
                level: "INFO",
                component: "api",
                event_code: "JOB_CANCELLED",
                metadata: {
                  final_job_status: "cancelled",
                  correlation_id: "corr_should_not_render",
                },
                occurrence_count: 1,
              },
              {
                id: "api-failure",
                occurred_at: "2026-07-16T09:04:00Z",
                level: "WARNING",
                component: "api",
                event_code: "API_REQUEST_FAILED",
                metadata: {
                  endpoint_group: "jobs",
                  http_status_category: "4xx",
                  arbitrary: "forbidden arbitrary value",
                  status_category: "4xx",
                  safe_count: 12,
                },
                occurrence_count: 1,
              },
            ],
            next_cursor: null,
            period: {
              start: "2026-07-15T00:00:00Z",
              end: "2026-07-16T00:00:00Z",
            },
          });
        if (
          url.endsWith("/api/diagnostics/report.md") &&
          init?.method === "POST"
        )
          return json(new Blob(["# Markdown"], { type: "text/markdown" }));
        return json({ ok: true });
      },
    );

    renderApp();
    await openDiagnosticsSettings();
    await screen.findByText("JOB_CREATED");
    const headers = Array.from(
      document.querySelectorAll<HTMLElement>(".diagnostics-event-header"),
    );
    const createdHeader = headers.find((header) =>
      header.textContent?.includes("JOB_CREATED"),
    );
    const cancelledHeader = headers.find((header) =>
      header.textContent?.includes("JOB_CANCELLED"),
    );
    expect(createdHeader?.textContent).toContain("JOB_CREATED·Информация");
    expect(cancelledHeader?.textContent).toContain("JOB_CANCELLED·Информация");
    expect(createdHeader?.textContent).not.toContain("JOB_CREATEDИнформация");
    expect(cancelledHeader?.textContent).not.toContain(
      "JOB_CANCELLEDИнформация",
    );
    for (const separator of document.querySelectorAll(
      ".diagnostics-event-header span",
    )) {
      if (separator.textContent === "·")
        expect(separator).not.toHaveAttribute("aria-hidden");
    }
    for (const text of [
      "PROVIDER_REQUEST_FAILED",
      "JOB_COMPLETED",
      "JOB_CANCELLED",
      "API_REQUEST_FAILED",
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
    ]) {
      expect(screen.queryAllByText(text).length).toBeGreaterThan(0);
    }
    for (const forbidden of [
      "forbidden-source.mp3",
      "https://forbidden.example/report",
      "forbidden transcript",
      "forbidden-secret",
      "req_should_not_render",
      "corr_should_not_render",
      "forbidden arbitrary value",
      "filename",
      "transcript",
      "secret",
      "request_id",
      "correlation_id",
      "arbitrary",
    ]) {
      expect(document.body.textContent).not.toContain(forbidden);
    }
    for (const unsupportedKey of [
      "attempt",
      "duration_seconds",
      "status_category",
      "safe_count",
    ]) {
      expect(screen.queryByText(unsupportedKey, { exact: true })).toBeNull();
    }
  });

  it("localizes unconfigured build identities and inactive DEBUG display state", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({ connected: false, status: null });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            build: { web: "unknown", api: "", worker: undefined },
            diagnostics: { debug_recording: "inactive" },
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [],
            next_cursor: null,
            period: {
              start: "2026-07-16T00:00:00Z",
              end: "2026-07-17T00:00:00Z",
            },
          });
        return json({ ok: true });
      },
    );

    renderApp();
    await openDiagnosticsSettings();

    expect(await screen.findAllByText("не настроено")).toHaveLength(3);
    expect(screen.getByText("неактивна")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("unknown");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("uses Russian labels for known audit events and safe fallback for unknown events", async () => {
    const knownTypes = [
      "admin.bootstrap_created",
      "auth.login_failed",
      "auth.sessions_revoked",
      "credential.created",
      "credential.replaced",
      "credential.revoked",
      "credential.deleted",
      "google.connected",
      "google.disconnected",
      "google.oauth_started",
      "google.oauth_failed",
      "project.created",
      "project.updated",
      "project.archived",
      "project.output_folder.google_picker_set",
      "source.google_drive.created",
      "source.google_picker.created",
      "job.cancelled",
      "job.cancel_requested",
      "unknown.private_event",
    ];
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({ connected: false, status: null });
        if (url.endsWith("/api/audit-events"))
          return json({
            events: knownTypes.map((type, index) => ({
              id: `audit-${index}`,
              type,
              created_at: "2026-07-16T10:00:00Z",
            })),
          });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            build: {},
            diagnostics: {},
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [],
            next_cursor: null,
            period: {
              start: "2026-07-16T00:00:00Z",
              end: "2026-07-17T00:00:00Z",
            },
          });
        return json({ ok: true });
      },
    );

    renderApp();
    await openDiagnosticsSettings();

    for (const label of [
      "Администратор создан",
      "Неудачная попытка входа",
      "Другие сеансы завершены",
      "Ключ создан",
      "Ключ заменён",
      "Ключ отозван",
      "Ключ удалён",
      "Google Drive подключён",
      "Google Drive отключён",
      "Начато подключение Google Drive",
      "Подключение Google Drive не удалось",
      "Проект создан",
      "Проект обновлён",
      "Проект архивирован",
      "Папка проекта выбрана через Google Drive",
      "Источник Google Drive добавлен",
      "Источники выбраны через Google Drive",
      "Задача отменена",
      "Запрошена отмена задачи",
    ]) {
      expect(screen.getAllByText(new RegExp(label)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/Событие безопасности/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("unknown.private_event");
    expect(document.body.textContent).not.toContain("job.cancelled");
    expect(document.body.textContent).not.toContain("job.cancel_requested");
  });

  it("shows loading, empty, error, and retry states", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "user@example.com", role: "admin" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-after-refresh" });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: false,
            status: null,
            google_email: null,
            scopes: null,
            connected_at: null,
            revoked_at: null,
          });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/diagnostics/system"))
          return json({}, false, 500);
        if (url.includes("/api/diagnostics/events"))
          return json({}, false, 500);
        return json({ ok: true });
      },
    );
    renderApp();
    await openDiagnosticsSettings();
    expect(
      screen.getByText(/Не удалось загрузить состояние/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Повторить загрузку состояния" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Повторить загрузку событий" }),
    ).toBeInTheDocument();
  });

  it("bounds and validates system status before explicit retry", async () => {
    installBasicPlatformSettingsFixture();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = fetchMock.getMockImplementation();
    const systemSignals: AbortSignal[] = [];
    let systemGets = 0;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/diagnostics/system")) {
          systemGets += 1;
          const signal = init?.signal;
          if (!signal) throw new Error("system status signal is missing");
          systemSignals.push(signal);
          if (systemGets === 1) {
            return json({
              build: { web: { raw: "raw-build-secret" } },
              diagnostics: {},
              google_drive: {},
              provider_credentials: {},
              report_limits: {},
            });
          }
          return json({
            environment: "production",
            build: { web: "web-safe", api: "api-safe", worker: "worker-safe" },
            diagnostics: {},
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
            raw_system_field: "raw-system-secret",
          });
        }
        return defaultFetch?.(input, init) ?? json({});
      },
    );
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    try {
      renderApp();
      await openDiagnosticsSettings();
      expect(
        await screen.findByText("Не удалось загрузить состояние."),
      ).toBeInTheDocument();
      expect(systemSignals[0]?.aborted).toBe(false);
      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 15_000);
      expect(document.body.textContent).not.toContain("raw-build-secret");

      await userEvent.click(
        screen.getByRole("button", { name: "Повторить загрузку состояния" }),
      );
      expect(await screen.findByText("web-safe")).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("raw-system-secret");
      expect(systemGets).toBe(2);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("keeps filtered events latest-wins and paginates single-flight", async () => {
    installBasicPlatformSettingsFixture();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = fetchMock.getMockImplementation();
    let eventGets = 0;
    let staleSignal: AbortSignal | undefined;
    let resolveStale: ((response: Response) => void) | undefined;
    let resolvePage: ((response: Response) => void) | undefined;
    const period = {
      start: "2026-07-16T00:00:00Z",
      end: "2026-07-17T00:00:00Z",
    };
    const event = (id: string, level: "ERROR" | "WARNING" | "INFO") => ({
      id,
      occurred_at: "2026-07-16T09:00:00Z",
      level,
      component: "api",
      event_code: id,
      occurrence_count: 1,
    });
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/diagnostics/events")) {
          eventGets += 1;
          if (eventGets === 1) {
            return json({
              events: [event("INITIAL_EVENT", "INFO")],
              next_cursor: null,
              period,
            });
          }
          if (eventGets === 2) {
            staleSignal = init?.signal;
            return new Promise<Response>((resolve) => {
              resolveStale = resolve;
            });
          }
          if (eventGets === 3) {
            return json({
              events: [{ ...event("MALFORMED_EVENT", "WARNING"), level: "RAW" }],
              next_cursor: null,
              period,
              raw_events_field: "raw-events-secret",
            });
          }
          if (eventGets === 4) {
            return json({
              events: [
                {
                  ...event("LATEST_EVENT", "WARNING"),
                  metadata: {
                    retryable: true,
                    transcript: "raw-transcript-secret",
                  },
                  raw_event_field: "raw-event-secret",
                },
              ],
              next_cursor: "safe-cursor",
              period,
            });
          }
          return new Promise<Response>((resolve) => {
            resolvePage = resolve;
          });
        }
        return defaultFetch?.(input, init) ?? json({});
      },
    );

    renderApp();
    await openDiagnosticsSettings();
    expect(await screen.findByText("INITIAL_EVENT")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Уровень"), "ERROR");
    await userEvent.click(
      screen.getByRole("button", { name: "Применить фильтры" }),
    );
    await waitFor(() => expect(resolveStale).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText("Уровень"), "WARNING");
    await userEvent.click(
      screen.getByRole("button", { name: "Применить фильтры" }),
    );
    expect(
      await screen.findByText("Не удалось загрузить события."),
    ).toBeInTheDocument();
    expect(staleSignal?.aborted).toBe(true);
    expect(screen.queryByText("MALFORMED_EVENT")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Повторить загрузку событий" }),
    );
    expect(await screen.findByText("LATEST_EVENT")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw-events-secret");
    expect(document.body.textContent).not.toContain("raw-event-secret");
    expect(document.body.textContent).not.toContain("raw-transcript-secret");

    const more = screen.getByRole("button", { name: "Показать ещё" });
    fireEvent.click(more);
    fireEvent.click(more);
    expect(eventGets).toBe(5);
    await act(async () =>
      resolvePage?.(
        await json({
          events: [
            event("LATEST_EVENT", "WARNING"),
            event("PAGE_EVENT", "INFO"),
          ],
          next_cursor: null,
          period,
        }),
      ),
    );
    expect(await screen.findByText("PAGE_EVENT")).toBeInTheDocument();
    expect(screen.getAllByText("LATEST_EVENT")).toHaveLength(1);

    await act(async () =>
      resolveStale?.(
        await json({
          events: [event("STALE_EVENT", "ERROR")],
          next_cursor: null,
          period,
        }),
      ),
    );
    expect(screen.queryByText("STALE_EVENT")).not.toBeInTheDocument();
  });

  it("aborts system and event read ownership on diagnostics teardown", async () => {
    installBasicPlatformSettingsFixture();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = fetchMock.getMockImplementation();
    let systemSignal: AbortSignal | undefined;
    let eventsSignal: AbortSignal | undefined;
    let resolveSystem: ((response: Response) => void) | undefined;
    let resolveEvents: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/diagnostics/system")) {
          systemSignal = init?.signal;
          return new Promise<Response>((resolve) => {
            resolveSystem = resolve;
          });
        }
        if (url.includes("/api/diagnostics/events")) {
          eventsSignal = init?.signal;
          return new Promise<Response>((resolve) => {
            resolveEvents = resolve;
          });
        }
        return defaultFetch?.(input, init) ?? json({});
      },
    );

    renderApp();
    await openDiagnosticsSettings();
    await waitFor(() => {
      expect(resolveSystem).toBeDefined();
      expect(resolveEvents).toBeDefined();
    });
    await userEvent.click(screen.getByRole("tab", { name: "Аккаунт" }));
    expect(systemSignal?.aborted).toBe(true);
    expect(eventsSignal?.aborted).toBe(true);

    await act(async () => {
      resolveSystem?.(
        await json({
          environment: "late-system",
          build: {},
          diagnostics: {},
          google_drive: {},
          provider_credentials: {},
          report_limits: {},
        }),
      );
      resolveEvents?.(
        await json({
          events: [
            {
              id: "LATE_EVENT",
              occurred_at: "2026-07-16T09:00:00Z",
              level: "INFO",
              component: "api",
              event_code: "LATE_EVENT",
            },
          ],
          next_cursor: null,
          period: {
            start: "2026-07-16T00:00:00Z",
            end: "2026-07-17T00:00:00Z",
          },
        }),
      );
    });
    expect(screen.queryByText("late-system")).not.toBeInTheDocument();
    expect(screen.queryByText("LATE_EVENT")).not.toBeInTheDocument();
  });
});

describe("PWA API diagnostics instrumentation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearPwaDiagnosticsSession();
    configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: false });
  });

  function postedPwaEvents(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/api/diagnostics/pwa-events"))
      .flatMap(
        ([, init]) => JSON.parse(String((init as RequestInit).body)).events,
      );
  }

  it("emits no event for successful requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await __appDiagnosticsTest.api("/projects");
    expect(postedPwaEvents(fetchMock)).toHaveLength(0);
  });

  it("emits one safe event for direct network failure and omits raw path", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("synthetic-network-detail"))
      .mockResolvedValue(json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      __appDiagnosticsTest.api("/jobs/synthetic-id"),
    ).rejects.toThrow();
    await waitFor(() => expect(postedPwaEvents(fetchMock)).toHaveLength(1));
    const payload = JSON.stringify(postedPwaEvents(fetchMock));
    expect(payload).toContain("jobs");
    expect(payload).not.toContain("synthetic-id");
    expect(payload).not.toContain("synthetic-network-detail");
  });

  it("emits one safe event for direct 5xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: false }, false, 503))
      .mockResolvedValue(json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      __appDiagnosticsTest.api("/sources/synthetic-id"),
    ).rejects.toThrow();
    await waitFor(() => expect(postedPwaEvents(fetchMock)).toHaveLength(1));
    expect(postedPwaEvents(fetchMock)[0].metadata).toMatchObject({
      endpoint_group: "sources",
      http_status_category: "5xx",
      retryable: true,
    });
  });

  it("emits nothing for recovered CSRF retry", async () => {
    const onCsrf = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({ detail: { reason: "csrf_token_invalid" } }, false, 403),
      )
      .mockResolvedValueOnce(json({ csrf_token: "csrf-new" }))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await __appDiagnosticsTest.csrfMutate("/projects", "csrf-old", onCsrf, {
      method: "POST",
      body: "{}",
    });
    expect(onCsrf).toHaveBeenCalledWith("csrf-new");
    expect(postedPwaEvents(fetchMock)).toHaveLength(0);
  });

  it("emits exactly one for final failed CSRF retry and does not retry non-CSRF failures", async () => {
    const onCsrf = vi.fn();
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({ detail: { reason: "csrf_token_invalid" } }, false, 403),
      )
      .mockResolvedValueOnce(json({ csrf_token: "csrf-new" }))
      .mockResolvedValueOnce(json({ ok: false }, false, 500))
      .mockResolvedValue(json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      __appDiagnosticsTest.csrfMutate("/credentials", "csrf-old", onCsrf, {
        method: "POST",
        body: "{}",
      }),
    ).rejects.toThrow();
    await waitFor(() => expect(postedPwaEvents(fetchMock)).toHaveLength(1));

    fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: false }, false, 400))
      .mockResolvedValue(json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      __appDiagnosticsTest.csrfMutate("/projects", "csrf-old", onCsrf, {
        method: "POST",
        body: "{}",
      }),
    ).rejects.toThrow();
    await waitFor(() => expect(postedPwaEvents(fetchMock)).toHaveLength(1));
    expect(
      fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.endsWith("/api/auth/csrf")),
    ).toHaveLength(0);
  });

  it("emits one original-operation event when CSRF refresh fails", async () => {
    for (const refreshFailure of [
      {
        response: Promise.reject(new Error("synthetic-refresh-network")),
        category: "unknown",
      },
      { response: json({ ok: false }, false, 503), category: "5xx" },
    ]) {
      clearPwaDiagnosticsSession();
      configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: false });
      const onCsrf = vi.fn();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          json({ detail: { reason: "csrf_token_invalid" } }, false, 403),
        )
        .mockImplementationOnce(() => refreshFailure.response)
        .mockResolvedValue(json({ accepted: true }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        __appDiagnosticsTest.csrfMutate("/projects", "csrf-old", onCsrf, {
          method: "POST",
          body: "{}",
        }),
      ).rejects.toThrow();
      await waitFor(() => expect(postedPwaEvents(fetchMock)).toHaveLength(1));
      expect(postedPwaEvents(fetchMock)[0].metadata).toMatchObject({
        endpoint_group: "projects",
        http_status_category: refreshFailure.category,
      });
      expect(JSON.stringify(postedPwaEvents(fetchMock))).not.toContain("auth");
      expect(JSON.stringify(postedPwaEvents(fetchMock))).not.toContain(
        "synthetic-refresh-network",
      );
      expect(onCsrf).not.toHaveBeenCalled();
    }
  });

  it("does not recursively emit when diagnostics ingestion fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: false }, false, 500))
      .mockRejectedValueOnce(new Error("synthetic-ingestion-failure"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      __appDiagnosticsTest.api("/diagnostics/events"),
    ).rejects.toThrow();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/api/diagnostics/pwa-events"),
      ),
    ).toHaveLength(1);
  });
});

describe("Settings DEBUG session controls", () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    clearPwaDiagnosticsSession();
    window.history.replaceState({}, "", "/");
  });

  function installSettingsFetch(
    debugResponses: Array<
      | {
          active: boolean;
          started_at?: string | null;
          expires_at?: string | null;
        }
      | Response
    >,
  ) {
    const debugGets: string[] = [];
    const posts: unknown[] = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "safe@example.test", role: "user" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-safe" });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({ connected: false });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            build: {},
            diagnostics: {},
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [],
            next_cursor: null,
            period: {
              start: "2026-07-16T00:00:00Z",
              end: "2026-07-17T00:00:00Z",
            },
          });
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          (!init?.method || init.method === "GET")
        ) {
          debugGets.push(url);
          const next = debugResponses.shift() ?? {
            active: false,
            started_at: null,
            expires_at: null,
          };
          return next instanceof Response ? next : json(next);
        }
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          init?.method === "POST"
        ) {
          posts.push(JSON.parse(String(init.body)));
          return json({
            active: true,
            started_at: new Date(Date.now()).toISOString(),
            expires_at: new Date(Date.now() + 600000).toISOString(),
          });
        }
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          init?.method === "DELETE"
        )
          return json({ active: false, started_at: null, expires_at: null });
        if (url.endsWith("/api/diagnostics/pwa-events"))
          return json({ accepted: true });
        return json({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, debugGets, posts };
  }

  async function openDiagnostics() {
    renderApp();
    await screen.findByText("Настройки");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Настройки" })[0],
    );
    await userEvent.click(screen.getByRole("tab", { name: "Диагностика" }));
  }

  it("renders loading, inactive defaults, active status, start and stop flows without browser storage", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    const { posts } = installSettingsFetch([
      { active: false, started_at: null, expires_at: null },
      { active: false, started_at: null, expires_at: null },
    ]);
    await openDiagnostics();
    expect(await screen.findByText("DEBUG не активна")).toBeInTheDocument();
    const duration = screen.getByLabelText(
      "Длительность DEBUG",
    ) as HTMLSelectElement;
    expect(duration.value).toBe("10");
    expect(
      within(duration).getByRole("option", { name: "5 минут" }),
    ).toBeInTheDocument();
    expect(
      within(duration).getByRole("option", { name: "30 минут" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Включить DEBUG" }),
    );
    expect(await screen.findByText("DEBUG активна")).toBeInTheDocument();
    expect(posts).toEqual([{ duration_minutes: 10 }]);
    await userEvent.click(
      screen.getByRole("button", { name: "Остановить DEBUG" }),
    );
    expect(await screen.findByText("DEBUG не активна")).toBeInTheDocument();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("refreshes on 409 conflict without issuing a second POST", async () => {
    const debugGets: string[] = [];
    let postCount = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "safe@example.test", role: "user" },
          });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: "csrf-safe" });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({ connected: false });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            build: {},
            diagnostics: {},
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [],
            next_cursor: null,
            period: {
              start: "2026-07-16T00:00:00Z",
              end: "2026-07-17T00:00:00Z",
            },
          });
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          (!init?.method || init.method === "GET")
        ) {
          debugGets.push(url);
          return debugGets.length === 1
            ? json({ active: false, started_at: null, expires_at: null })
            : json({
                active: true,
                started_at: new Date(Date.now()).toISOString(),
                expires_at: new Date(Date.now() + 600000).toISOString(),
              });
        }
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          init?.method === "POST"
        ) {
          postCount += 1;
          return json({ detail: "conflict" }, false, 409);
        }
        if (url.endsWith("/api/diagnostics/pwa-events"))
          return json({ accepted: true });
        return json({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    await openDiagnostics();
    await userEvent.click(
      await screen.findByRole("button", { name: "Включить DEBUG" }),
    );
    await screen.findByText(
      "DEBUG уже активна в другой вкладке. Статус обновлён.",
    );
    expect(postCount).toBe(1);
    expect(debugGets).toHaveLength(2);
  });

  it("uses refreshed CSRF for ingestion after DEBUG start retry", async () => {
    const oldToken = "csrf-old-safe";
    const newToken = "csrf-new-safe";
    const expiresAt = new Date(Date.now() + 600000).toISOString();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/auth/session"))
          return json({
            authenticated: true,
            user: { email: "safe@example.test", role: "user" },
          });
        if (url.endsWith("/api/auth/csrf") && init?.method === "POST")
          return json({ csrf_token: newToken });
        if (url.endsWith("/api/auth/csrf"))
          return json({ csrf_token: oldToken });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "cred-active",
                provider: "elevenlabs",
                label: "Primary STT",
                status: "active",
                masked_value: "••••1234",
                active_version: 2,
              },
            ],
          });
        if (url.endsWith("/api/google/connection"))
          return json({ connected: false });
        if (url.endsWith("/api/diagnostics/system"))
          return json({
            build: {},
            diagnostics: {},
            google_drive: {},
            provider_credentials: {},
            report_limits: {},
          });
        if (url.includes("/api/diagnostics/events"))
          return json({
            events: [],
            next_cursor: null,
            period: {
              start: "2026-07-16T00:00:00Z",
              end: "2026-07-17T00:00:00Z",
            },
          });
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          (!init?.method || init.method === "GET")
        )
          return json({ active: false, started_at: null, expires_at: null });
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          init?.method === "POST" &&
          (init.headers as Record<string, string>)["x-csrf-token"] === oldToken
        )
          return json(
            { detail: { reason: "csrf_token_invalid" } },
            false,
            403,
          );
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          init?.method === "POST"
        )
          return json({
            active: true,
            started_at: new Date(Date.now()).toISOString(),
            expires_at: expiresAt,
          });
        if (url.endsWith("/api/diagnostics/pwa-events"))
          return json({ accepted: true });
        return json({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    await openDiagnostics();
    await userEvent.click(
      await screen.findByRole("button", { name: "Включить DEBUG" }),
    );
    expect(await screen.findByText("DEBUG активна")).toBeInTheDocument();

    emitPwaDiagnostic(
      "PWA_API_REQUEST_FAILED",
      {
        boundary: "api_request",
        error_code: "api_request_failed",
        retryable: true,
      },
      { dedupe: false },
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).endsWith("/api/diagnostics/pwa-events"),
        ),
      ).toBe(true),
    );
    const ingestion = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/diagnostics/pwa-events"),
    )?.[1] as RequestInit;
    expect(ingestion.headers).toMatchObject({ "x-csrf-token": newToken });
    expect(JSON.stringify(ingestion)).not.toContain(oldToken);
  });

  it("CSRF refresh during another mutation preserves DEBUG until inactive server status clears it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({ detail: { reason: "csrf_token_invalid" } }, false, 403),
      )
      .mockResolvedValueOnce(json({ csrf_token: "csrf-rotated" }))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValue(json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);
    clearPwaDiagnosticsSession();
    configurePwaDiagnosticsSession({
      csrf: "csrf-old",
      debugActive: true,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    await __appDiagnosticsTest.csrfMutate(
      "/projects",
      "csrf-old",
      (token) => configurePwaDiagnosticsSession({ csrf: token }),
      { method: "POST", body: "{}" },
    );
    emitPwaDiagnostic(
      "PWA_API_REQUEST_FAILED",
      {
        boundary: "api_request",
        error_code: "api_request_failed",
        retryable: true,
      },
      { dedupe: false },
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).endsWith("/api/diagnostics/pwa-events"),
        ),
      ).toBe(true),
    );
    expect(postedPwaEventsFrom(fetchMock).at(-1)?.level).toBe("DEBUG");

    configurePwaDiagnosticsSession({
      csrf: "csrf-rotated",
      debugActive: false,
    });
    emitPwaDiagnostic(
      "PWA_API_REQUEST_FAILED",
      {
        boundary: "api_request",
        error_code: "api_request_failed",
        retryable: true,
      },
      { dedupe: false },
    );
    await waitFor(() => expect(postedPwaEventsFrom(fetchMock)).toHaveLength(2));
    expect(postedPwaEventsFrom(fetchMock).at(-1)?.level).toBeUndefined();
  });

  it("bounds and validates DEBUG status reads before explicit retry", async () => {
    const { fetchMock } = installSettingsFetch([]);
    const defaultFetch = fetchMock.getMockImplementation();
    const debugSignals: AbortSignal[] = [];
    let debugGets = 0;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          (!init?.method || init.method === "GET")
        ) {
          debugGets += 1;
          if (debugGets === 1) {
            const signal = init?.signal;
            if (!signal) throw new Error("DEBUG status signal is missing");
            debugSignals.push(signal);
            return new Promise<Response>((_resolve, reject) => {
              signal.addEventListener("abort", () => reject(signal.reason));
            });
          }
          if (debugGets === 2) {
            return json({
              active: "raw-active",
              raw_debug_field: "raw-debug-secret",
            });
          }
          return json({ active: false, raw_ignored_field: "raw-ignored" });
        }
        return defaultFetch?.(input, init) ?? json({});
      },
    );
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      await openDiagnostics();
      expect(
        await screen.findByText("Не удалось загрузить статус DEBUG."),
      ).toBeInTheDocument();
      expect(debugSignals[0]?.aborted).toBe(true);

      await userEvent.click(
        screen.getByRole("button", { name: "Повторить проверку DEBUG" }),
      );
      expect(
        await screen.findByText("Не удалось загрузить статус DEBUG."),
      ).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("raw-active");
      expect(document.body.textContent).not.toContain("raw-debug-secret");

      await userEvent.click(
        screen.getByRole("button", { name: "Повторить проверку DEBUG" }),
      );
      expect(await screen.findByText("DEBUG не активна")).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("raw-ignored");
      expect(debugGets).toBe(3);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("reconciles bounded DEBUG start and stop without mutation replay", async () => {
    const { fetchMock } = installSettingsFetch([]);
    const defaultFetch = fetchMock.getMockImplementation();
    let debugGets = 0;
    let startCalls = 0;
    let stopCalls = 0;
    let startSignal: AbortSignal | undefined;
    const startedAt = new Date(Date.now()).toISOString();
    const expiresAt = new Date(Date.now() + 600000).toISOString();
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          (!init?.method || init.method === "GET")
        ) {
          debugGets += 1;
          return debugGets === 2
            ? json({ active: true, started_at: startedAt, expires_at: expiresAt })
            : json({ active: false });
        }
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          init?.method === "POST"
        ) {
          startCalls += 1;
          startSignal = init.signal;
          if (!startSignal) throw new Error("DEBUG start signal is missing");
          return new Promise<Response>((_resolve, reject) => {
            startSignal?.addEventListener("abort", () =>
              reject(startSignal?.reason),
            );
          });
        }
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          init?.method === "DELETE"
        ) {
          stopCalls += 1;
          return json({
            active: "raw-stopped",
            raw_stop_field: "raw-stop-secret",
          });
        }
        return defaultFetch?.(input, init) ?? json({});
      },
    );
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 20_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      await openDiagnostics();
      const start = await screen.findByRole("button", {
        name: "Включить DEBUG",
      });
      fireEvent.click(start);
      fireEvent.click(start);
      expect(
        await screen.findByText("DEBUG включена. Статус подтверждён."),
      ).toBeInTheDocument();
      expect(startSignal?.aborted).toBe(true);
      expect(startCalls).toBe(1);
      expect(debugGets).toBe(2);

      const stop = screen.getByRole("button", { name: "Остановить DEBUG" });
      fireEvent.click(stop);
      fireEvent.click(stop);
      expect(
        await screen.findByText("DEBUG остановлена. Статус подтверждён."),
      ).toBeInTheDocument();
      expect(stopCalls).toBe(1);
      expect(debugGets).toBe(3);
      expect(document.body.textContent).not.toContain("raw-stopped");
      expect(document.body.textContent).not.toContain("raw-stop-secret");
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("aborts DEBUG mutation ownership on diagnostics teardown", async () => {
    const { fetchMock } = installSettingsFetch([
      { active: false, started_at: null, expires_at: null },
    ]);
    const defaultFetch = fetchMock.getMockImplementation();
    let startSignal: AbortSignal | undefined;
    let resolveStart: ((response: Response) => void) | undefined;
    let startCalls = 0;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.endsWith("/api/diagnostics/debug-session") &&
          init?.method === "POST"
        ) {
          startCalls += 1;
          startSignal = init.signal;
          return new Promise<Response>((resolve) => {
            resolveStart = resolve;
          });
        }
        return defaultFetch?.(input, init) ?? json({});
      },
    );

    await openDiagnostics();
    await userEvent.click(
      await screen.findByRole("button", { name: "Включить DEBUG" }),
    );
    await waitFor(() => expect(resolveStart).toBeDefined());
    await userEvent.click(screen.getByRole("tab", { name: "Аккаунт" }));

    expect(startSignal?.aborted).toBe(true);
    await act(async () =>
      resolveStart?.(
        await json({
          active: true,
          started_at: new Date(Date.now()).toISOString(),
          expires_at: new Date(Date.now() + 600000).toISOString(),
        }),
      ),
    );
    expect(startCalls).toBe(1);
    expect(
      screen.queryByText("DEBUG включена."),
    ).not.toBeInTheDocument();
  });

  it("expires local DEBUG once and failed refresh does not poll every second", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const expiresAt = new Date(Date.now() + 1000).toISOString();
    const { debugGets } = installSettingsFetch([
      {
        active: true,
        started_at: new Date(Date.now()).toISOString(),
        expires_at: expiresAt,
      },
      new Response("{}", { status: 500 }),
    ]);
    await openDiagnostics();
    expect(await screen.findByText("DEBUG активна")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      await screen.findByText("Не удалось загрузить статус DEBUG."),
    ).toBeInTheDocument();
    const afterExpiryGets = debugGets.length;
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(debugGets).toHaveLength(afterExpiryGets);
    vi.useRealTimers();
  });
});
