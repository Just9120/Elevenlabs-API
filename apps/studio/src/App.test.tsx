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
import { buildSegmentPlan, parseTimeToSeconds } from "./segments";
import { clearPwaDiagnosticsSession, configurePwaDiagnosticsSession } from "./pwaDiagnostics";
const originalLocation = window.location;
const json = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    blob: () =>
      Promise.resolve(
        body instanceof Blob
          ? body
          : new Blob([JSON.stringify(body)], { type: "application/json" }),
      ),
  } as Response);
function renderApp(mode: "static" | "platform") {
  render(<App mode={mode} />);
}

function installFakeGooglePicker() {
  googlePicker.resetGooglePickerLoaderForTests();
  let callback: ((data: unknown) => void) | null = null;
  const viewIds: string[] = [];
  const viewModes: string[] = [];
  const viewParents: string[] = [];
  const includeFolders: boolean[] = [];
  const selectFolderEnabled: boolean[] = [];
  const viewMimeTypes: string[] = [];
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
    setMimeTypes(value: string) {
      viewMimeTypes.push(value);
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
    viewMimeTypes,
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
          ],
        });
      if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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
              provider_credential_id: null,
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
              provider_credential_id: null,
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

async function openSettingsPage() {
  await openPlatformNavPage("Настройки");
  expect(
    await screen.findByRole("heading", { name: "Настройки аккаунта" }),
  ).toBeInTheDocument();
}

async function openFocusedJobsList() {
  renderApp("platform");
  await openSelectedProjectJobs();
  expect(await screen.findByText("Focused output job")).toBeInTheDocument();
}
describe("Studio PWA", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    window.history.replaceState({}, "", "/");
    googlePicker.resetGooglePickerLoaderForTests();
    delete window.gapi;
    delete window.google;
    document.head
      .querySelectorAll('script[data-studio-google-picker="true"]')
      .forEach((node) => node.remove());
    localStorage.clear();
    sessionStorage.clear();
    let localUploadIndex = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
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
        if (url.endsWith("/api/auth/bootstrap-status"))
          return json({ bootstrap_required: false });
        if (url.endsWith("/api/auth/login-context"))
          return json({ login_csrf_token: "login-csrf" });
        if (url.endsWith("/api/auth/login"))
          return json({
            user: { email: "user@example.com", role: "admin" },
            csrf_token: "csrf",
          });
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
                expires_at: "2026-07-01T01:02:00",
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
                id: "s-picker-2",
                project_id: "p1",
                source_type: "google_drive",
                original_filename: "picked-second.mp4",
                mime_type: "video/mp4",
                size_bytes: 20,
                drive_file_id: "file-2",
                drive_file_url: "https://drive.example/file-2",
                upload_status: "uploaded",
                uploaded_at: "2026-07-01T00:00:00Z",
                expires_at: null,
                deleted_at: null,
                delete_reason: null,
                created_at: "2026-07-01T00:00:00Z",
                updated_at: "2026-07-01T00:00:00Z",
              },
              {
                id: "s-picker-1",
                project_id: "p1",
                source_type: "google_drive",
                original_filename: "picked-first.mp4",
                mime_type: "video/mp4",
                size_bytes: 10,
                drive_file_id: "file-1",
                drive_file_url: "https://drive.example/file-1",
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
          return json({
            source_id: sourceId,
            upload: {
              method: "PUT",
              url: `https://upload.example/presigned-${localUploadIndex}`,
              headers: { "Content-Type": "audio/ogg" },
              expires_in: 3600,
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
          return json({
            id: sourceId,
            project_id: "p1",
            source_type: "local_upload",
            original_filename: `${sourceId}.ogg`,
            mime_type: "audio/ogg",
            size_bytes: 11,
            drive_file_id: null,
            drive_file_url: null,
            upload_status: "uploaded",
            uploaded_at: "2026-07-01T00:00:00Z",
            expires_at: null,
            deleted_at: null,
            delete_reason: null,
            created_at: "2026-07-01T00:00:00Z",
            updated_at: "2026-07-01T00:00:00Z",
          });
        }
        if (url.endsWith("/api/sources/s1") && init?.method === "DELETE")
          return json({ ok: true });
        if (url.endsWith("/api/credentials") && init?.method === "POST")
          return json({ id: "c1" });
        if (url.endsWith("/replace")) return json({ ok: true });
        if (url.endsWith("/api/credentials"))
          return json({
            credentials: [
              {
                id: "c1",
                provider: "openai",
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
          return json({
            connected: false,
            status: "revoked",
            google_email: "safe.user@example.com",
            scopes: "https://www.googleapis.com/auth/drive.file",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: "2026-07-02T00:00:00",
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
          return json({
            authorization_url:
              "https://accounts.google.com/o/oauth2/v2/auth?state=secret-state",
            expires_at: "2026-07-01T00:10:00",
          });
        if (
          url.endsWith("/api/projects/p1/jobs/batch") &&
          init?.method === "POST"
        )
          return json({ jobs: [], created_count: 0, replayed: false });
        return json({ ok: true });
      }),
    );
  });
  it("opens approved Drive resource links in new tabs with compact action labels", async () => {
    renderApp("platform");
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
      screen.getByText("Временная копия будет удалена из хранилища Studio."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Убрать из проекта: local-temp.ogg" }),
    ).toBeInTheDocument();
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
          return json({ ok: true });
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        return json({ ok: true });
      },
    );
    renderApp("platform");
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

  it("keeps the source card and shows a safe project-removal error on failed removal", async () => {
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        return json({ ok: true });
      },
    );
    renderApp("platform");
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Убрать из проекта: safe-drive.mp4",
      }),
    );
    expect(
      await screen.findByText("Не удалось убрать файл из проекта."),
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
    renderApp("platform");
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
    renderApp("platform");
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
    renderApp("platform");
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

  it("opens the project creation form only for the dashboard new-project action", async () => {
    renderApp("platform");
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
  });

  it("opens a recent project directly in the preparation workspace", async () => {
    renderApp("platform");
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

  it("static-only mode renders public UI and makes no /api requests", async () => {
    renderApp("static");
    expect(screen.getByText("Панель готова к установке")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Настройки/ }));
    expect(screen.getByText(/Статический режим/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
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
      setMimeTypes() {
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
      setSelectableMimeTypes() {
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
    const pickedPromise = googlePicker.openGooglePicker("sources", {
      access_token: "ya29.secret",
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

  it("configures Google Picker source and output-folder presentation separately", async () => {
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
    const selectFolderEnabled: boolean[] = [];
    const viewMimeTypes: string[] = [];
    const builderCalls: { method: string; args: unknown[] }[] = [];
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
      setMimeTypes(value: string) {
        viewMimeTypes.push(value);
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

    expect(viewIds).toEqual(["docs", "folders"]);
    expect(viewModes).toEqual(["list", "list"]);
    expect(viewParents).toEqual(["root", "root"]);
    expect(includeFolders).toEqual([true, true]);
    expect(selectFolderEnabled).toEqual([true]);
    expect(viewMimeTypes).toEqual([]);
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
      method: "setDeveloperKey",
      args: ["public"],
    });
    expect(builderCalls).toContainEqual({ method: "setAppId", args: ["app"] });
    expect(builderCalls).toContainEqual({ method: "setMaxItems", args: [50] });
    expect(builderCalls).toContainEqual({ method: "setMaxItems", args: [1] });
    expect(
      builderCalls.filter((call) => call.method === "setSelectableMimeTypes"),
    ).toEqual([]);
    expect(
      builderCalls.filter((call) => call.method === "enableFeature"),
    ).toEqual([{ method: "enableFeature", args: ["multi"] }]);
    expect(
      builderCalls.filter((call) => call.method === "setCallback"),
    ).toHaveLength(2);
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

  it("platform mode refreshes in-memory CSRF and renders settings without browser storage secrets", async () => {
    renderApp("platform");
    await waitForPlatformOverview();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/csrf",
      expect.objectContaining({ method: "POST" }),
    );
    await openSettingsPage();
    await screen.findByText(/Ключи провайдеров/);
    const credentialCard = screen
      .getByRole("heading", { name: "main" })
      .closest("article");
    expect(credentialCard).not.toBeNull();
    expect(within(credentialCard!).getByText(/••••1234/)).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
  it("renders disconnected Google Drive state", async () => {
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/connection"))
        return json({
          connected: false,
          status: "disconnected",
          google_email: null,
          scopes: null,
          connected_at: null,
          revoked_at: null,
          picker_configured: false,
          picker_scope_ready: false,
          picker_ready: false,
          reconnect_required: false,
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp("platform");
    await openSettingsPage();
    expect(
      await screen.findByText("Google Drive не подключён"),
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
        if (url.endsWith("/api/audit-events")) return json({ events: [] });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "https://www.googleapis.com/auth/drive.file",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: null,
            refresh_token: "raw-refresh-token-never-render",
          });
        return json({ ok: true });
      },
    );
    renderApp("platform");
    await openSettingsPage();
    expect(
      await screen.findByText("Google Drive подключён"),
    ).toBeInTheDocument();
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
        return json({
          connected: false,
          status: "disconnected",
          google_email: null,
          scopes: null,
          connected_at: null,
          revoked_at: null,
          picker_configured: false,
          picker_scope_ready: false,
          picker_ready: false,
          reconnect_required: false,
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true,
    });
    renderApp("platform");
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
      "https://accounts.google.com/o/oauth2/v2/auth?state=secret-state",
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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
          return json({
            connected: false,
            status: "revoked",
            google_email: "safe.user@example.com",
            scopes: "https://www.googleapis.com/auth/drive.file",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: "2026-07-02T00:00:00",
          });
        if (url.endsWith("/api/google/connection"))
          return json({
            connected: true,
            status: "active",
            google_email: "safe.user@example.com",
            scopes: "https://www.googleapis.com/auth/drive.file",
            connected_at: "2026-07-01T00:00:00",
            revoked_at: null,
          });
        return json({ ok: true });
      },
    );
    renderApp("platform");
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

  it("platform mode supports credential replacement without rendering raw key", async () => {
    renderApp("platform");
    await openSettingsPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Заменить" }),
    );
    await userEvent.type(
      screen.getByPlaceholderText("Новый ключ для замены"),
      "raw-secret-never-render",
    );
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/credentials/c1/replace",
        expect.anything(),
      ),
    );
    const replaceCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]) => url === "/api/credentials/c1/replace");
    expect(JSON.parse(String(replaceCall?.[1]?.body))).toMatchObject({
      raw_value: "raw-secret-never-render",
    });
    expect(
      screen.queryByText("raw-secret-never-render"),
    ).not.toBeInTheDocument();
  });
  it("creates credentials with raw_value while using credential-specific field names", async () => {
    renderApp("platform");
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

  it("platform projects page loads /api/projects and renders populated projects", async () => {
    renderApp("platform");
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
    renderApp("platform");
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
    renderApp("platform");
    await openProjectsPage();
    expect(
      await screen.findByText(/Операция не выполнена/),
    ).toBeInTheDocument();
  });
  it("platform projects page creates, edits, and archives projects with CSRF", async () => {
    renderApp("platform");
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

  it("shows compact preparation readiness status", async () => {
    renderApp("platform");
    await openProjectsPage();
    await screen.findByRole("heading", { name: "Подготовка задач" });
    const status = await screen.findByLabelText("Готовность строк подготовки");
    expect(status).toHaveTextContent("Готово: 0 из 1");
    expect(status).toHaveTextContent("Строка 1: выберите источник");
    expect(
      screen.queryByRole("heading", { name: "Готовность" }),
    ).not.toBeInTheDocument();
  });

  it("derives readiness, blockers, and submit state from row readiness", async () => {
    renderApp("platform");
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
      screen.getByRole("button", { name: "Создать задачи (1)" }),
    ).toBeDisabled();

    await chooseExistingSource(1, "Лекция 1");
    expect(readiness).toHaveTextContent("Готово: 0 из 1");
    expect(readiness).toHaveTextContent("Строка 1: выберите папку результата");
    await chooseResultFolder(1);
    expect(readiness).toHaveTextContent("Готово: 1 из 1");
    expect(
      screen.getByRole("button", { name: "Создать задачи (1)" }),
    ).toBeEnabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Добавить строку" }),
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
      screen.getByRole("button", { name: "Создать задачи (2)" }),
    ).toBeDisabled();

    await chooseExistingSource(2, "local-temp");
    expect(readiness).toHaveTextContent("Готово: 2 из 2");
    expect(readiness).toHaveTextContent("Все строки готовы");
    expect(
      screen.getByRole("button", { name: "Создать задачи (2)" }),
    ).toBeEnabled();
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

    renderApp("platform");
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");

    const readiness = screen.getByLabelText("Готовность строк подготовки");
    expect(readiness).toHaveTextContent("Готово: 0 из 1");
    expect(readiness).toHaveTextContent("Строка 1: выберите папку результата");
    expect(
      screen.getByRole("button", { name: "Создать задачи (1)" }),
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

    renderApp("platform");
    await openProjectsPage();
    await chooseExistingSource(1, "Лекция 1");
    await chooseResultFolder(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Создать задачи (1)" }),
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
                provider: "openai",
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
              {
                id: "cred-deleted",
                provider: "openai",
                label: "Deleted STT",
                status: "deleted",
                masked_value: "••••0000",
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
                expires_at: "2026-07-01T01:02:00",
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
                provider_credential_id: null,
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
                provider_credential_id: null,
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
                provider_credential_id: null,
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
            provider_credential_id: null,
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
            provider_credential_id: null,
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
    renderApp("platform");
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
    expect(screen.getByLabelText("Ключ провайдера")).toHaveValue("");
    expect(document.body.textContent).not.toContain("worker/provider");
    expect(screen.getByText("Задача job-2")).toBeInTheDocument();
    expect(screen.getByText("Статус: В очереди")).toBeInTheDocument();
    expect(screen.getByText("Статус: Ошибка")).toBeInTheDocument();
    expect(screen.getByText("Статус: Обрабатывается")).toBeInTheDocument();
    expect(screen.getByText(/Отмена запрошена:/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Отмена запрошена" }),
    ).toBeDisabled();
    expect(screen.getByText("Файлов: 2")).toBeInTheDocument();
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
    const credentialSelect = screen.getByLabelText("Ключ провайдера");
    expect(
      within(credentialSelect).getByRole("option", { name: "Без ключа" }),
    ).toBeInTheDocument();
    expect(
      within(credentialSelect).getByRole("option", {
        name: "openai · Primary STT · ••••1234 · v2",
      }),
    ).toBeInTheDocument();
    expect(
      within(credentialSelect).queryByRole("option", { name: /Revoked STT/ }),
    ).not.toBeInTheDocument();
    expect(
      within(credentialSelect).queryByRole("option", { name: /Deleted STT/ }),
    ).not.toBeInTheDocument();
    await userEvent.selectOptions(credentialSelect, "cred-active");
    expect(screen.getByLabelText("Ключ провайдера")).toHaveValue("cred-active");
    await userEvent.click(
      screen.getByRole("button", { name: /Создать задачи \(\d+\)/ }),
    );
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
      items: [
        {
          source_id: "s1",
          output_folder_id: "folder-123",
          title: "Created from UI",
        },
        { source_id: "s2", output_folder_id: "folder-123", title: null },
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
    expect(within(detail).getAllByText("Статус файла: queued")).toHaveLength(2);
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

  it("renders processing cancellation-request state without extra api calls in static mode", async () => {
    renderApp("static");
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api"),
      expect.anything(),
    );
  });

  it("uses Google Picker actions instead of manual Drive ID forms in platform projects", async () => {
    renderApp("platform");
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
    renderApp("platform");
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
    await userEvent.click(
      screen.getByRole("button", { name: /Создать задачи \(\d+\)/ }),
    );
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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
                      provider_credential_id: null,
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
                      provider_credential_id: null,
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
                      provider_credential_id: null,
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
                provider_credential_id: null,
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
        return json({ ok: true });
      },
    );
    renderApp("platform");
    await openSelectedProjectJobs();
    await chooseExistingSource(1, "ready-local.ogg");
    await chooseResultFolder(1);
    await userEvent.click(
      screen.getByRole("button", { name: /Создать задачи \(\d+\)/ }),
    );
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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
          return json({ ok: true });
        if (
          url.endsWith("/api/projects/p1/jobs/batch") &&
          init?.method === "POST"
        )
          return json({ jobs: [], created_count: 0, replayed: false });
        return json({ ok: true });
      },
    );
    renderApp("platform");
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
      screen.getByRole("button", { name: /Создать задачи \(\d+\)/ }),
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
      renderApp("platform");
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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
            ? json({ detail: "csrf" }, false, 403)
            : json({
                name: "Verified folder",
                web_view_url:
                  "https://drive.google.com/drive/folders/folder-csrf",
              });
        }
        return json({ ok: true });
      },
    );
    renderApp("platform");
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
    renderApp("platform");
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

    renderApp("platform");
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    await userEvent.selectOptions(
      await screen.findByLabelText("Ключ провайдера"),
      "cred-1",
    );
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
    expect(screen.getByLabelText("Ключ провайдера")).toHaveValue("cred-1");
    expect(screen.getByDisplayValue("Alpha draft")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Beta draft")).toBeInTheDocument();
    expect(screen.getAllByText("Папка Google Drive").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.getByDisplayValue("Alpha draft")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Beta draft")).toBeInTheDocument();
    expect(screen.getByLabelText("Ключ провайдера")).toHaveValue("cred-1");

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
    expect(screen.getByLabelText("Ключ провайдера")).toHaveValue("cred-1");

    await userEvent.click(
      screen.getByRole("button", { name: /Project Two .*02\.07\.2026/ }),
    );
    await screen.findByText("p2-clean.ogg");
    expect(screen.queryByDisplayValue("Alpha draft")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Beta draft")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ключ провайдера")).toHaveValue("");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("isolates composer rows, messages, retry state, details, and outputs when switching projects", async () => {
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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
                provider_credential_id: null,
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
            provider_credential_id: null,
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
        if (
          url.endsWith("/api/projects/pA/jobs/batch") &&
          init?.method === "POST"
        )
          return Promise.reject(new Error("temporary batch outage"));
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
                provider_credential_id: null,
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

    renderApp("platform");
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
    await userEvent.click(
      screen.getByRole("button", { name: /Создать задачи \(\d+\)/ }),
    );
    expect(
      await screen.findByText(/ключ повтора сохранены/),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Project B .*02\.07\.2026/ }),
    );
    await screen.findByRole("form", { name: "Композитор пакетных задач" });

    expect(
      screen.queryByDisplayValue("Project A row title"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("A default")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/ключ повтора сохранены/),
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
    await userEvent.click(
      screen.getByRole("button", { name: /Создать задачи \(\d+\)/ }),
    );
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
      provider_credential_id: null,
      items: [
        {
          source_id: "source-b",
          output_folder_id: "folder-b",
          title: "B clean submit",
        },
      ],
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("source Picker cancel/error and duplicate clicks do not create source mutations", async () => {
    let picker = installFakeGooglePicker();
    renderApp("platform");
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
    renderApp("platform");
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

    renderApp("platform");
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

      renderApp("platform");
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
    renderApp("platform");
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
    expect(picker.viewMimeTypes).toEqual([]);
    expect(
      picker.builderCalls.filter((call) => call.method === "enableFeature"),
    ).toEqual([]);
    expect(
      picker.builderCalls.filter(
        (call) => call.method === "setSelectableMimeTypes",
      ),
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
    renderApp("platform");
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
    renderApp("platform");
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
    renderApp("platform");
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
          return json({
            authorization_url:
              "https://accounts.google.com/o/oauth2/v2/auth?state=safe",
            expires_at: "2026-07-01T00:10:00",
          });
        return json({ credentials: [], events: [] });
      },
    );
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, assign },
      configurable: true,
    });
    renderApp("platform");
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
      "https://accounts.google.com/o/oauth2/v2/auth?state=safe",
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
                expires_at: "2026-07-01T01:02:00",
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
                provider_credential_id: null,
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
    renderApp("platform");
    await openProjectsPage();
    await screen.findByRole("form", { name: "Композитор пакетных задач" });
    expect(
      await screen.findByText(
        "Ключи сейчас недоступны. Задачу можно создать без выбранного ключа.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ключи сейчас недоступны. Задачу можно создать без выбранного ключа.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("raw backend detail ignored"),
    ).not.toBeInTheDocument();

    await chooseExistingSource(1, "ready-local.ogg");
    await chooseResultFolder(1);
    await userEvent.click(
      screen.getByRole("button", { name: /Создать задачи \(\d+\)/ }),
    );
    const createCall = await waitFor(() => {
      const call = (
        fetch as unknown as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        ([url, init]) =>
          url === "/api/projects/p1/jobs/batch" && init?.method === "POST",
      );
      expect(call).toBeTruthy();
      return call;
    });
    expect(createCall?.[1]?.headers).toEqual(
      expect.objectContaining({
        "Idempotency-Key": expect.stringMatching(/^batch-[0-9a-f-]{36}$/),
      }),
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      provider_credential_id: null,
      items: [{ source_id: "s1", output_folder_id: "folder-123", title: null }],
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("does not request job outputs until explicit job detail opening", async () => {
    installFocusedOutputFixture();
    renderApp("platform");
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
    renderApp("platform");
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
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith("/api/auth/session")) return json({}, false, 401);
      if (url.endsWith("/api/auth/bootstrap-status"))
        return json({ bootstrap_required: false });
      if (url.endsWith("/api/auth/login-context"))
        return json({ login_csrf_token: "login-csrf" });
      if (url.endsWith("/api/auth/login"))
        return json({
          user: { email: "user@example.com", role: "admin" },
          csrf_token: "csrf-login",
        });
      if (url.endsWith("/api/auth/logout")) return json({ ok: true });
      if (url.endsWith("/api/credentials")) return json({ credentials: [] });
      if (url.endsWith("/api/audit-events")) return json({ events: [] });
      if (url.endsWith("/api/google/connection"))
        return json({
          connected: false,
          status: "disconnected",
          google_email: null,
          scopes: null,
          connected_at: null,
          revoked_at: null,
          picker_configured: false,
          picker_scope_ready: false,
          picker_ready: false,
          reconnect_required: false,
        });
      return json({ csrf_token: "csrf-after-refresh" });
    });
    renderApp("platform");
    await screen.findByRole("heading", { name: "Вход" });
    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Пароль"), "password-long");
    await userEvent.click(screen.getByRole("button", { name: "Войти" }));
    await waitForPlatformOverview();
    await openSettingsPage();
    await userEvent.click(await screen.findByRole("button", { name: "Выйти" }));
    expect(
      await screen.findByRole("heading", { name: "Вход" }),
    ).toBeInTheDocument();
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
    renderApp("platform");
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
    renderApp("platform");
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
    renderApp("platform");
    await waitForPlatformOverview();
    expect(
      screen.queryByText(
        "Google Drive подключён. Статус подключения обновлён.",
      ),
    ).not.toBeInTheDocument();
  });

  it("does not show OAuth success when refreshed Google connection is disconnected", async () => {
    window.history.pushState({}, "", "/?google_oauth=connected");
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/connection"))
        return json({
          connected: false,
          status: "disconnected",
          google_email: null,
          scopes: null,
          connected_at: null,
          revoked_at: null,
          picker_configured: false,
          picker_scope_ready: false,
          picker_ready: false,
          reconnect_required: false,
        });
      return defaultFetch?.(url, init) ?? json({ ok: true });
    });
    renderApp("platform");
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
    renderApp("platform");
    expect(
      await screen.findByText("Google Drive сейчас недоступен."),
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
      renderApp("platform");
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("raw-secret-value");
    },
  );

  it("ignores unknown Google OAuth results safely and static mode remains API-free", async () => {
    window.history.pushState(
      {},
      "",
      "/?google_oauth=raw-secret-value&keep=1#hash",
    );
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    renderApp("static");
    expect(
      await screen.findByText(/Панель готова к установке/),
    ).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    cleanup();
    renderApp("platform");
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
    renderApp("platform");
    const email = await screen.findByLabelText("Email");
    const password = screen.getByLabelText("Пароль");
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(password).toHaveAttribute("autocomplete", "current-password");
  });
  it("marks BYOK credential forms to avoid saved login autofill", async () => {
    renderApp("platform");
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
    renderApp("platform");
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
    renderApp("platform");
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

    renderApp("platform");
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
    renderApp("platform");
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
    renderApp("platform");
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
    expect(input).toHaveClass("visually-hidden");
    expect(input.closest(".file-picker-control")).not.toBeNull();
    expect(
      input.closest(".file-picker-control")?.querySelector("label"),
    ).toHaveTextContent("С устройства");
    expect(input).toHaveAttribute(
      "accept",
      "audio/*,video/*,.ogg,.oga,application/ogg",
    );
    expect(document.body).not.toHaveTextContent(
      "https://upload.example/presigned",
    );
  });

  it("local multi-file selection creates rows and partial failure preserves successful rows", async () => {
    renderApp("platform");
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
    expect(screen.getByLabelText("Источник строки 2")).toHaveTextContent(
      "local-source-2.ogg",
    );
    expect(
      screen.getByText(
        /bad\.exe: поддерживаются только аудио, видео или OGG\./,
      ),
    ).toBeInTheDocument();
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
  });

  it("clears stale local upload status before rejecting a new invalid file", async () => {
    renderApp("platform");
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
      /unsupported\.exe: поддерживаются только аудио, видео или OGG\./,
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
    renderApp("platform");
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
    renderApp("platform");
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
    renderApp("platform");
    expect(await screen.findByText(/bootstrap-admin/)).toBeInTheDocument();
  });
  it("validates sequential segment boundaries", () => {
    expect(parseTimeToSeconds("01:05")).toBe(65);
    const plan = buildSegmentPlan([
      { id: "1", title: "", end: "00:30" },
      { id: "2", title: "", end: "00:20" },
      { id: "3", title: "", end: "" },
    ]);
    expect(plan[1].error).toMatch(/позже/);
    expect(plan[2].endLabel).toBe("До конца записи");
  });
});

describe("settings diagnostics", () => {
  beforeEach(() => {
    cleanup();
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

  it("static mode performs zero diagnostics or audit API calls", async () => {
    renderApp("static");
    await screen.findByRole("heading", { name: "Панель готова к установке" });
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/diagnostics"),
      expect.anything(),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/audit-events"),
      expect.anything(),
    );
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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

    renderApp("platform");
    await openDiagnosticsSettings();

    expect(screen.getByRole("tab", { name: "Диагностика" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("web-build")).toBeInTheDocument();
    expect(screen.getByText("api-build")).toBeInTheDocument();
    expect(screen.getByText("worker-build")).toBeInTheDocument();
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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

    renderApp("platform");
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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

    renderApp("platform");
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
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.endsWith("/api/auth/session"))
        return json({
          authenticated: true,
          user: { email: "user@example.com", role: "admin" },
        });
      if (url.endsWith("/api/auth/csrf"))
        return json({ csrf_token: "csrf-after-refresh" });
      if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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
        return json({ events: [], next_cursor: null, period: null });
      return json({ ok: true });
    });

    renderApp("platform");
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
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.endsWith("/api/auth/session"))
        return json({
          authenticated: true,
          user: { email: "user@example.com", role: "admin" },
        });
      if (url.endsWith("/api/auth/csrf"))
        return json({ csrf_token: "csrf-after-refresh" });
      if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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
        return json({ build: {}, diagnostics: {}, google_drive: {}, provider_credentials: {}, report_limits: {} });
      if (url.includes("/api/diagnostics/events"))
        return json({ events: [], next_cursor: null, period: null });
      return json({ ok: true });
    });

    renderApp("platform");
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
        if (url.endsWith("/api/credentials")) return json({ credentials: [] });
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
    renderApp("platform");
    await openDiagnosticsSettings();
    expect(
      screen.getByText(/Не удалось загрузить состояние/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Повторить" }),
    ).toBeInTheDocument();
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
      .flatMap(([, init]) => JSON.parse(String((init as RequestInit).body)).events);
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
    await expect(__appDiagnosticsTest.api("/jobs/synthetic-id")).rejects.toThrow();
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
    await expect(__appDiagnosticsTest.api("/sources/synthetic-id")).rejects.toThrow();
    await waitFor(() => expect(postedPwaEvents(fetchMock)).toHaveLength(1));
    expect(postedPwaEvents(fetchMock)[0].metadata).toMatchObject({ endpoint_group: "sources", http_status_category: "5xx", retryable: true });
  });

  it("emits nothing for recovered CSRF retry", async () => {
    const onCsrf = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: false }, false, 403))
      .mockResolvedValueOnce(json({ csrf_token: "csrf-new" }))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await __appDiagnosticsTest.csrfMutate("/projects", "csrf-old", onCsrf, { method: "POST", body: "{}" });
    expect(onCsrf).toHaveBeenCalledWith("csrf-new");
    expect(postedPwaEvents(fetchMock)).toHaveLength(0);
  });

  it("emits exactly one for final failed CSRF retry and does not retry non-CSRF failures", async () => {
    const onCsrf = vi.fn();
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: false }, false, 419))
      .mockResolvedValueOnce(json({ csrf_token: "csrf-new" }))
      .mockResolvedValueOnce(json({ ok: false }, false, 500))
      .mockResolvedValue(json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(__appDiagnosticsTest.csrfMutate("/credentials", "csrf-old", onCsrf, { method: "POST", body: "{}" })).rejects.toThrow();
    await waitFor(() => expect(postedPwaEvents(fetchMock)).toHaveLength(1));

    fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: false }, false, 400))
      .mockResolvedValue(json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(__appDiagnosticsTest.csrfMutate("/projects", "csrf-old", onCsrf, { method: "POST", body: "{}" })).rejects.toThrow();
    await waitFor(() => expect(postedPwaEvents(fetchMock)).toHaveLength(1));
    expect(fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.endsWith("/api/auth/csrf"))).toHaveLength(0);
  });

  it("does not recursively emit when diagnostics ingestion fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: false }, false, 500))
      .mockRejectedValueOnce(new Error("synthetic-ingestion-failure"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(__appDiagnosticsTest.api("/diagnostics/events")).rejects.toThrow();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/diagnostics/pwa-events"))).toHaveLength(1);
  });
});

describe("Settings DEBUG session controls", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearPwaDiagnosticsSession();
  });

  function installSettingsFetch(debugResponses: Array<{ active: boolean; started_at?: string | null; expires_at?: string | null } | Response>) {
    const debugGets: string[] = [];
    const posts: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) return json({ authenticated: true, user: { email: "safe@example.test", role: "owner" } });
      if (url.endsWith("/api/auth/csrf")) return json({ csrf_token: "csrf-safe" });
      if (url.endsWith("/api/audit-events")) return json({ events: [] });
      if (url.endsWith("/api/credentials")) return json({ credentials: [] });
      if (url.endsWith("/api/google/connection")) return json({ connected: false });
      if (url.endsWith("/api/diagnostics/system")) return json({ build: {}, diagnostics: {}, google_drive: {}, provider_credentials: {}, report_limits: {} });
      if (url.includes("/api/diagnostics/events")) return json({ events: [], next_cursor: null, period: { start: "2026-07-16T00:00:00Z", end: "2026-07-17T00:00:00Z" } });
      if (url.endsWith("/api/diagnostics/debug-session") && (!init?.method || init.method === "GET")) {
        debugGets.push(url);
        const next = debugResponses.shift() ?? { active: false, started_at: null, expires_at: null };
        return next instanceof Response ? next : json(next);
      }
      if (url.endsWith("/api/diagnostics/debug-session") && init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return json({ active: true, started_at: new Date(Date.now()).toISOString(), expires_at: new Date(Date.now() + 600000).toISOString() });
      }
      if (url.endsWith("/api/diagnostics/debug-session") && init?.method === "DELETE") return json({ active: false, started_at: null, expires_at: null });
      if (url.endsWith("/api/diagnostics/pwa-events")) return json({ accepted: true });
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, debugGets, posts };
  }

  async function openDiagnostics() {
    renderApp("platform");
    await screen.findByText("Настройки");
    await userEvent.click(screen.getAllByRole("button", { name: "Настройки" })[0]);
    await userEvent.click(screen.getByRole("tab", { name: "Диагностика" }));
  }

  it("renders loading, inactive defaults, active status, start and stop flows without browser storage", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    const { posts } = installSettingsFetch([{ active: false, started_at: null, expires_at: null }, { active: false, started_at: null, expires_at: null }]);
    await openDiagnostics();
    expect(await screen.findByText("DEBUG не активна")).toBeInTheDocument();
    const duration = screen.getByLabelText("Длительность DEBUG") as HTMLSelectElement;
    expect(duration.value).toBe("10");
    expect(within(duration).getByRole("option", { name: "5 минут" })).toBeInTheDocument();
    expect(within(duration).getByRole("option", { name: "30 минут" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Включить DEBUG" }));
    expect(await screen.findByText("DEBUG активна")).toBeInTheDocument();
    expect(posts).toEqual([{ duration_minutes: 10 }]);
    await userEvent.click(screen.getByRole("button", { name: "Остановить DEBUG" }));
    expect(await screen.findByText("DEBUG не активна")).toBeInTheDocument();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("refreshes on 409 conflict without issuing a second POST", async () => {
    const debugGets: string[] = [];
    let postCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) return json({ authenticated: true, user: { email: "safe@example.test", role: "owner" } });
      if (url.endsWith("/api/auth/csrf")) return json({ csrf_token: "csrf-safe" });
      if (url.endsWith("/api/audit-events")) return json({ events: [] });
      if (url.endsWith("/api/credentials")) return json({ credentials: [] });
      if (url.endsWith("/api/google/connection")) return json({ connected: false });
      if (url.endsWith("/api/diagnostics/system")) return json({ build: {}, diagnostics: {}, google_drive: {}, provider_credentials: {}, report_limits: {} });
      if (url.includes("/api/diagnostics/events")) return json({ events: [], next_cursor: null, period: { start: "2026-07-16T00:00:00Z", end: "2026-07-17T00:00:00Z" } });
      if (url.endsWith("/api/diagnostics/debug-session") && (!init?.method || init.method === "GET")) {
        debugGets.push(url);
        return debugGets.length === 1
          ? json({ active: false, started_at: null, expires_at: null })
          : json({ active: true, started_at: new Date(Date.now()).toISOString(), expires_at: new Date(Date.now() + 600000).toISOString() });
      }
      if (url.endsWith("/api/diagnostics/debug-session") && init?.method === "POST") {
        postCount += 1;
        return json({ detail: "conflict" }, false, 409);
      }
      if (url.endsWith("/api/diagnostics/pwa-events")) return json({ accepted: true });
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    await openDiagnostics();
    await userEvent.click(await screen.findByRole("button", { name: "Включить DEBUG" }));
    await screen.findByText("DEBUG уже активна в другой вкладке. Статус обновлён.");
    expect(postCount).toBe(1);
    expect(debugGets).toHaveLength(2);
  });

  it("expires local DEBUG once and failed refresh does not poll every second", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const expiresAt = new Date(Date.now() + 1000).toISOString();
    const { debugGets } = installSettingsFetch([
      { active: true, started_at: new Date(Date.now()).toISOString(), expires_at: expiresAt },
      new Response("{}", { status: 500 }),
    ]);
    await openDiagnostics();
    expect(await screen.findByText("DEBUG активна")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(await screen.findByText("Не удалось загрузить статус DEBUG.")).toBeInTheDocument();
    const afterExpiryGets = debugGets.length;
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(debugGets).toHaveLength(afterExpiryGets);
    vi.useRealTimers();
  });
});
