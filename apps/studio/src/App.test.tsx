import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as googlePicker from "./googlePicker";
import { computeGooglePickerSize } from "./googlePicker";
import { buildSegmentPlan, parseTimeToSeconds } from "./segments";
const originalLocation = window.location;
const json = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
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

async function openFocusedJobsList() {
  renderApp("platform");
  await userEvent.click(await screen.findByRole("button", { name: /Проекты/ }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Показать jobs" }),
  );
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
                original_filename: "drive-call.mp4",
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
          return json({ sources: [{ id: "s-picker" }] });
        if (
          url.endsWith("/api/projects/p1/output-folder/google-picker") &&
          init?.method === "POST"
        )
          return json({
            id: "p1",
            title: "Research calls",
            description: "Customer interview notes",
            created_at: "2026-07-01T00:00:00",
            updated_at: "2026-07-01T00:02:00",
            archived_at: null,
            output_drive_folder_id: "folder-picked",
            output_drive_folder_url:
              "https://drive.google.com/drive/folders/folder-picked",
            output_drive_folder_name: "Picked folder",
          });
        if (
          url.endsWith("/api/projects/p1/sources/google-drive") &&
          init?.method === "POST"
        )
          return json({ id: "s2" });
        if (
          url.endsWith("/api/projects/p1/sources/local-upload/initiate") &&
          init?.method === "POST"
        )
          return json({
            source_id: "local-source-1",
            upload: {
              method: "PUT",
              url: "https://upload.example/presigned",
              headers: { "Content-Type": "audio/ogg" },
              expires_in: 3600,
            },
          });
        if (url === "https://upload.example/presigned")
          return json({}, true, 200);
        if (
          url.endsWith("/api/sources/local-source-1/local-upload/complete") &&
          init?.method === "POST"
        )
          return json({ id: "local-source-1" });
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
        return json({ ok: true });
      }),
    );
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
    expect(viewMimeTypes).toEqual([
      "audio/*,video/*,application/ogg",
      "application/vnd.google-apps.folder",
    ]);
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
    expect(builderCalls).toContainEqual({ method: "setMaxItems", args: [50] });
    expect(builderCalls).toContainEqual({ method: "setMaxItems", args: [1] });
    expect(builderCalls).toContainEqual({
      method: "setSelectableMimeTypes",
      args: ["audio/*,video/*,application/ogg"],
    });
    expect(builderCalls).toContainEqual({
      method: "setSelectableMimeTypes",
      args: ["application/vnd.google-apps.folder"],
    });
    expect(
      builderCalls.filter((call) => call.method === "enableFeature"),
    ).toEqual([{ method: "enableFeature", args: ["multi"] }]);
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
    await screen.findByText(/Панель аккаунта готова/);
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/csrf",
      expect.objectContaining({ method: "POST" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Настройки/ }));
    await screen.findByText(/BYOK credentials/);
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Настройки/ }),
    );
    expect(await screen.findByText("Drive не подключён")).toBeInTheDocument();
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Настройки/ }),
    );
    expect(await screen.findByText("Drive подключён")).toBeInTheDocument();
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Настройки/ }),
    );
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Настройки/ }),
    );
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
    expect(await screen.findByText(/Status: revoked/)).toBeInTheDocument();
  });

  it("platform mode supports credential replacement without rendering raw key", async () => {
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Настройки/ }),
    );
    const replaceForm = await screen.findByLabelText("Заменить credential");
    await userEvent.selectOptions(replaceForm.querySelector("select")!, "c1");
    await userEvent.type(
      screen.getByPlaceholderText("Новый ключ для замены"),
      "raw-secret-never-render",
    );
    await userEvent.click(screen.getByRole("button", { name: "Заменить" }));
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Настройки/ }),
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    expect(await screen.findByText("Research calls")).toBeInTheDocument();
    expect(screen.getByText("Customer interview notes")).toBeInTheDocument();
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    expect(
      await screen.findByText(/Операция не выполнена/),
    ).toBeInTheDocument();
  });
  it("platform projects page creates, edits, and archives projects with CSRF", async () => {
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await screen.findByText("Research calls");
    await userEvent.type(
      screen.getByPlaceholderText("Название проекта"),
      "Created project",
    );
    await userEvent.type(
      screen.getByPlaceholderText("Описание (необязательно)"),
      "Brief",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Создать проект" }),
    );
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
      ).toHaveLength(2),
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

  it("shows configured output folder in job readiness checklist", async () => {
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать jobs" }),
    );
    expect(
      await screen.findByLabelText("Project job readiness checklist"),
    ).toHaveTextContent("Output folder: configured (Transcripts)");
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
                output_drive_folder_id: null,
                output_drive_folder_url: null,
                output_drive_folder_name: null,
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
        if (url.endsWith("/api/projects/p1/jobs") && init?.method === "POST")
          return json({
            id: "job-created",
            project_id: "p1",
            status: "queued",
            title: "Created from UI",
            provider: null,
            provider_credential_id: null,
            source_count: 2,
            sources: [],
            created_at: "2026-07-04T00:00:00Z",
            updated_at: "2026-07-04T00:00:00Z",
            cancelled_at: null,
            started_at: null,
            finished_at: null,
            error_code: null,
            error_message: null,
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
                drive_file_url: null,
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать jobs" }),
    );
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
      screen.getByText(
        "Job lifecycle status и persisted output records отображаются отдельно.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Processing, failed, cancelled и completed jobs могут иметь частичные outputs.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "UI загружает outputs только по кнопке деталей job; production-live processing и deployment не подтверждены.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Project job readiness checklist"),
    ).toHaveTextContent("sources ещё не загружены");
    expect(
      screen.getByLabelText("Project job readiness checklist"),
    ).toHaveTextContent("не выбран — optional для record creation");
    expect(
      screen.getByLabelText("Project job readiness checklist"),
    ).toHaveTextContent("Output folder: не настроен");
    expect(
      screen.getByLabelText("Project job readiness checklist"),
    ).toHaveTextContent("не запускает worker/provider execution");
    expect(screen.getByText("Job job-2")).toBeInTheDocument();
    expect(screen.getByText("Статус: Queued")).toBeInTheDocument();
    expect(
      screen.getByText("Статус: Failed · safe error metadata only"),
    ).toBeInTheDocument();
    expect(screen.getByText("Статус: В обработке")).toBeInTheDocument();
    expect(screen.getByText(/Отмена запрошена:/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Отмена запрошена" }),
    ).toBeDisabled();
    expect(screen.getByText("Sources: 2")).toBeInTheDocument();
    expect(screen.getByText("Error code: SAFE_CODE")).toBeInTheDocument();
    expect(screen.getByText("Error: Safe visible error")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Показать sources" }),
    );
    expect(await screen.findByText("ready-drive.mp4")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Project job readiness checklist"),
    ).toHaveTextContent("Sources: 2 usable uploaded source(s)");
    expect(screen.getByText(/Source ещё не готов для job/)).toBeInTheDocument();
    expect(
      screen.getByText(/Удалённый source нельзя добавить в job/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/pending-local/)).toBeDisabled();
    expect(screen.getByLabelText(/deleted-drive/)).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/ready-drive/));
    await userEvent.click(screen.getByLabelText(/ready-local/));
    await userEvent.type(
      screen.getByLabelText("Название job"),
      "Created from UI",
    );
    const credentialSelect = screen.getByLabelText(
      "Provider credential для processing",
    );
    expect(
      within(credentialSelect).getByRole("option", { name: "Без credential" }),
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
    expect(
      screen.getByLabelText("Project job readiness checklist"),
    ).toHaveTextContent("openai · Primary STT · ••••1234 · v2 selected");
    await userEvent.click(screen.getByRole("button", { name: "Создать job" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/p1/jobs",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const createCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url, init]) =>
        url === "/api/projects/p1/jobs" && init?.method === "POST",
    );
    expect(createCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      source_ids: ["s1", "s2"],
      title: "Created from UI",
      provider_credential_id: "cred-active",
    });

    await userEvent.click(
      screen.getAllByRole("button", { name: "Показать детали job" })[0],
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
      within(detail).getAllByText("Job source status: queued"),
    ).toHaveLength(2);
    expect(
      within(detail).queryByRole("link", { name: "Drive file URL" }),
    ).not.toBeInTheDocument();
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
    const outputs = await screen.findByLabelText("Job outputs job-1");
    expect(outputs).toHaveTextContent(
      "Lifecycle status из outputs: В обработке",
    );
    expect(outputs).toHaveTextContent("Output records: 3");
    expect(outputs).toHaveTextContent("2. second-output");
    expect(outputs).toHaveTextContent("1. first-output");
    expect(outputs.textContent?.indexOf("2. second-output")).toBeLessThan(
      outputs.textContent?.indexOf("1. first-output") ?? 0,
    );
    const outputLink = within(outputs).getByRole("link", {
      name: "Открыть output в Google",
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
      screen.getByRole("button", { name: "Отменить queued record" }),
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
        "Запрос отмены отправлен или job уже терминальна. Доступные output records, если они есть, остаются отдельными от lifecycle status.",
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать sources" }),
    );
    expect(
      screen.getByRole("button", { name: "Выбрать файлы из Google Drive" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Выбрать папку для результатов" }),
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

  it("source Picker sends only selected file IDs and reloads sources", async () => {
    const picker = installFakeGooglePicker();
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать sources" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать файлы из Google Drive" }),
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
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.body.textContent).not.toContain("ya29.test-access-token");
  });

  it("source Picker cancel/error and duplicate clicks do not create source mutations", async () => {
    let picker = installFakeGooglePicker();
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать sources" }),
    );
    const button = screen.getByRole("button", {
      name: "Выбрать файлы из Google Drive",
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать sources" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать файлы из Google Drive" }),
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

  it("output-folder Picker sends only folder ID and guards duplicate opens", async () => {
    const picker = installFakeGooglePicker();
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    const button = await screen.findByRole("button", {
      name: "Выбрать папку для результатов",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await picker.loadScript();
    await picker.waitForCallback();
    expect(picker.viewIds).toContain("folders");
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
          url === "/api/projects/p1/output-folder/google-picker" &&
          init?.method === "POST",
      );
      expect(call).toBeTruthy();
      return call;
    });
    expect(JSON.parse(String(folderCall?.[1]?.body))).toEqual({
      folder_id: "folder-picked",
    });
    expect(String(folderCall?.[1]?.body)).not.toContain("Folder Name");
    expect(String(folderCall?.[1]?.body)).not.toContain("ya29");
  });

  it("output-folder Picker cancel/error does not mutate folder and source/folder cannot open simultaneously", async () => {
    let picker = installFakeGooglePicker();
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать sources" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать файлы из Google Drive" }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Выбрать папку для результатов",
      }),
    ).toBeDisabled();
    await picker.loadScript();
    await picker.waitForCallback();
    picker.trigger({ action: "cancel" });
    await screen.findByText("Выбор файлов отменён.");
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) => url === "/api/projects/p1/output-folder/google-picker",
      ),
    ).toBe(false);

    cleanup();
    vi.clearAllMocks();
    picker = installFakeGooglePicker();
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Выбрать папку для результатов",
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
        ([url]) => url === "/api/projects/p1/output-folder/google-picker",
      ),
    ).toBe(false);
    expect(document.body.textContent).not.toContain("raw-google-payload");
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
      value: { assign },
      configurable: true,
    });
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать sources" }),
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain("повторная авторизация"),
    );
    expect(
      screen.getByRole("button", { name: "Выбрать файлы из Google Drive" }),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Настройки/ }));
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
        if (url.endsWith("/api/projects/p1/jobs") && init?.method === "POST")
          return json({
            id: "job-created",
            project_id: "p1",
            status: "queued",
            title: null,
            provider: null,
            provider_credential_id: null,
            source_count: 1,
            sources: [],
            created_at: "2026-07-04T00:00:00Z",
            updated_at: "2026-07-04T00:00:00Z",
            cancelled_at: null,
            started_at: null,
            finished_at: null,
            error_code: null,
            error_message: null,
          });
        return json({});
      },
    );
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать jobs" }),
    );
    expect(
      await screen.findByText(
        "Credentials сейчас недоступны. Job можно создать без credential.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Project job readiness checklist"),
    ).toHaveTextContent("Active provider credential недоступен");
    expect(
      screen.queryByText("raw backend detail ignored"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Показать sources" }),
    );
    await userEvent.click(await screen.findByLabelText(/ready-local/));
    await userEvent.click(screen.getByRole("button", { name: "Создать job" }));
    const createCall = await waitFor(() => {
      const call = (
        fetch as unknown as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        ([url, init]) =>
          url === "/api/projects/p1/jobs" && init?.method === "POST",
      );
      expect(call).toBeTruthy();
      return call;
    });
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      source_ids: ["s1"],
      title: null,
      provider_credential_id: null,
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("does not request job outputs until explicit job detail opening", async () => {
    installFocusedOutputFixture();
    renderApp("platform");
    await screen.findByText("Панель аккаунта готова");
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([url]) =>
        String(url).endsWith("/api/jobs/job-focused/outputs"),
      ),
    ).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /Проекты/ }));
    await screen.findByText("Research calls");
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([url]) =>
        String(url).endsWith("/api/jobs/job-focused/outputs"),
      ),
    ).toBe(false);

    await userEvent.click(
      screen.getByRole("button", { name: "Показать jobs" }),
    );
    expect(await screen.findByText("Focused output job")).toBeInTheDocument();
    expect(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([url]) =>
        String(url).endsWith("/api/jobs/job-focused/outputs"),
      ),
    ).toBe(false);

    await userEvent.click(
      screen.getByRole("button", { name: "Показать детали job" }),
    );
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
    await userEvent.click(
      screen.getByRole("button", { name: "Показать детали job" }),
    );
    const outputs = await screen.findByLabelText("Job outputs job-focused");
    expect(outputs).toHaveTextContent("Lifecycle status из outputs: Queued");
    expect(outputs).toHaveTextContent("Output records: 0");
    expect(outputs).toHaveTextContent("Output records пока не найдены.");
    expect(
      within(outputs).queryByRole("link", { name: "Открыть output в Google" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["failed", "Failed · safe error metadata only"],
    ["cancelled", "Cancelled · terminal"],
  ] as const)(
    "renders partial outputs for %s jobs without completed-status gating",
    async (jobStatus, label) => {
      installFocusedOutputFixture({ jobStatus });
      await openFocusedJobsList();
      await userEvent.click(
        screen.getByRole("button", { name: "Показать детали job" }),
      );
      const outputs = await screen.findByLabelText("Job outputs job-focused");
      expect(outputs).toHaveTextContent(
        `Lifecycle status из outputs: ${label}`,
      );
      expect(outputs).toHaveTextContent("Output records: 1");
      expect(outputs).toHaveTextContent(`${jobStatus}-source`);
      expect(outputs).toHaveTextContent(
        "Output availability не означает, что job завершена.",
      );
      expect(
        within(outputs).getByRole("link", { name: "Открыть output в Google" }),
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
    await userEvent.click(
      screen.getByRole("button", { name: "Показать детали job" }),
    );
    const detail = await screen.findByLabelText("Job detail job-focused");
    expect(
      within(detail).getByText("1. focused-source.mp3"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Не удалось загрузить outputs job."),
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
    await userEvent.click(
      screen.getByRole("button", { name: "Показать детали job" }),
    );
    expect(
      await screen.findByText("Не удалось загрузить детали job."),
    ).toBeInTheDocument();
    const outputs = await screen.findByLabelText("Job outputs job-focused");
    expect(outputs).toHaveTextContent("Output records: 1");
    expect(outputs).toHaveTextContent("processing-source");
    expect(
      within(outputs).getByRole("link", { name: "Открыть output в Google" }),
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
    expect(
      await screen.findByText(/Панель аккаунта готова/),
    ).toBeInTheDocument();
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
    await screen.findByText(/Панель аккаунта готова/);
    await userEvent.click(screen.getByRole("button", { name: /Настройки/ }));
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
    expect(
      await screen.findByText(/Панель аккаунта готова/),
    ).toBeInTheDocument();
  });

  it("handles Google OAuth return on Settings, refreshes connection, and cleans URL", async () => {
    window.history.pushState(
      {},
      "",
      "/studio?keep=1&google_oauth=connected#safe",
    );
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    renderApp("platform");
    expect(
      await screen.findByRole("heading", { name: "Настройки аккаунта" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Google Drive подключён. Статус подключения обновлён."),
    ).toBeInTheDocument();
    await screen.findByRole("heading", {
      name: /Drive подключён|Drive не подключён/,
    });
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
    cleanup();
    renderApp("platform");
    await screen.findByText(/Панель аккаунта готова/);
    expect(
      screen.queryByText(
        "Google Drive подключён. Статус подключения обновлён.",
      ),
    ).not.toBeInTheDocument();
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
    await screen.findByText(/Панель аккаунта готова/);
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Настройки/ }),
    );
    await screen.findByText(/BYOK credentials/);
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
