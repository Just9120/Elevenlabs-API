import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { buildSegmentPlan, parseTimeToSeconds } from "./segments";
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
describe("Studio PWA", () => {
  beforeEach(() => {
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
            connected: false,
            status: null,
            google_email: null,
            scopes: null,
            connected_at: null,
            revoked_at: null,
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

  it("renders and updates output Drive folder metadata with CSRF", async () => {
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    expect(await screen.findByText(/Transcripts/)).toBeInTheDocument();
    expect(screen.getByText(/folder-123/)).toBeInTheDocument();
    const folderId = screen.getByPlaceholderText("Output Drive folder ID");
    await userEvent.clear(folderId);
    await userEvent.type(folderId, "folder-456");
    await userEvent.click(
      screen.getByRole("button", { name: "Сохранить output folder" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/p1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const patchCalls = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      ([url, init]) => url === "/api/projects/p1" && init?.method === "PATCH",
    );
    expect(patchCalls.at(-1)?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(JSON.parse(String(patchCalls.at(-1)?.[1]?.body))).toMatchObject({
      output_drive_folder_id: "folder-456",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Очистить output folder" }),
    );
    await waitFor(() =>
      expect(
        (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([url, init]) =>
            url === "/api/projects/p1" && init?.method === "PATCH",
        ).length,
      ).toBeGreaterThan(1),
    );
    const clearCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .filter(
        ([url, init]) => url === "/api/projects/p1" && init?.method === "PATCH",
      )
      .at(-1);
    expect(JSON.parse(String(clearCall?.[1]?.body))).toMatchObject({
      output_drive_folder_id: null,
      output_drive_folder_url: null,
      output_drive_folder_name: null,
    });
  });
  it("loads sources, verifies Drive metadata, adds verified source, uploads local file, and deletes with CSRF", async () => {
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await screen.findByText("Research calls");
    await userEvent.click(
      screen.getByRole("button", { name: "Показать sources" }),
    );
    expect(await screen.findByText("drive-call.mp4")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/p1/sources",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    await userEvent.type(
      screen.getByPlaceholderText("Drive file/folder ID"),
      "drive-file-2",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Проверить Drive metadata" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/google/drive/files/drive-file-2/metadata",
        expect.objectContaining({ credentials: "same-origin" }),
      ),
    );
    const preview = await screen.findByLabelText("Drive metadata preview");
    expect(
      within(preview).getByText("verified-drive-call.mov"),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText("MIME: video/quicktime"),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Размер: 0.00 MB")).toBeInTheDocument();
    expect(
      within(preview).getByRole("link", { name: "Открыть в Google Drive" }),
    ).toHaveAttribute("href", "https://drive.example/file/2");
    await userEvent.click(
      within(preview).getByRole("button", {
        name: "Добавить source из проверенных metadata",
      }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/p1/sources/google-drive",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const driveCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url]) => url === "/api/projects/p1/sources/google-drive",
    );
    expect(driveCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(JSON.parse(String(driveCall?.[1]?.body))).toMatchObject({
      drive_file_id: "drive-file-2",
      drive_file_url: "https://drive.example/file/2",
      original_filename: "verified-drive-call.mov",
      mime_type: "video/quicktime",
      size_bytes: 1234,
    });
    const file = new File(["abc"], "clip.ogg", { type: "audio/ogg" });
    await userEvent.upload(
      screen.getByLabelText(/Загрузить временный локальный/),
      file,
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/sources/local-source-1/local-upload/complete",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const initCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([url]) => url === "/api/projects/p1/sources/local-upload/initiate",
    );
    expect(initCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(JSON.parse(String(initCall?.[1]?.body))).toMatchObject({
      original_filename: "clip.ogg",
      mime_type: "audio/ogg",
      size_bytes: 3,
    });
    const putCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]) => url === "https://upload.example/presigned");
    expect(putCall?.[1]).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "audio/ogg" },
      body: file,
    });
    expect(putCall?.[1]).not.toHaveProperty("credentials");
    expect(
      screen.queryByText("https://upload.example/presigned"),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Удалить source" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/sources/s1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    const deleteCall = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]) => url === "/api/sources/s1");
    expect(deleteCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
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

  it("lists Drive folder children, appends pages, and adds selected file metadata only", async () => {
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать sources" }),
    );
    await userEvent.type(
      screen.getByPlaceholderText("Drive folder ID"),
      "folder-children",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Показать файлы в папке" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/google/drive/folders/folder-children/children",
        expect.objectContaining({ credentials: "same-origin" }),
      ),
    );
    const children = await screen.findByLabelText("Drive folder children");
    expect(within(children).getByText("child-call.mp3")).toBeInTheDocument();
    expect(within(children).getByText("Файл Google Drive")).toBeInTheDocument();
    expect(within(children).getByText("Nested folder")).toBeInTheDocument();
    expect(
      within(children).getByText(
        "Папка Google Drive — не добавляется как source файл",
      ),
    ).toBeInTheDocument();
    expect(within(children).getByText("MIME: audio/mpeg")).toBeInTheDocument();
    expect(within(children).getByText("Размер: 0.00 MB")).toBeInTheDocument();
    expect(
      within(children).getAllByRole("link", {
        name: "Открыть в Google Drive",
      })[0],
    ).toHaveAttribute("href", "https://drive.example/file/child-1");

    await userEvent.click(
      within(children).getByRole("button", { name: "Загрузить ещё" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/google/drive/folders/folder-children/children?page_token=next-token",
        expect.objectContaining({ credentials: "same-origin" }),
      ),
    );
    expect(await screen.findByText("second-child.wav")).toBeInTheDocument();

    const childFile = within(children).getByLabelText("child-call.mp3");
    const childFolder = within(children).getByLabelText("Nested folder");
    expect(childFolder).toBeDisabled();
    await userEvent.click(childFile);
    await userEvent.click(
      within(children).getByRole("button", {
        name: "Добавить выбранные sources",
      }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/p1/sources/google-drive",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const driveCalls = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      ([url, init]) =>
        url === "/api/projects/p1/sources/google-drive" &&
        init?.method === "POST",
    );
    expect(driveCalls).toHaveLength(1);
    expect(driveCalls[0]?.[1]?.headers).toMatchObject({
      "x-csrf-token": "csrf-after-refresh",
    });
    expect(JSON.parse(String(driveCalls[0]?.[1]?.body))).toMatchObject({
      drive_file_id: "child-file-1",
      drive_file_url: "https://drive.example/file/child-1",
      original_filename: "child-call.mp3",
      mime_type: "audio/mpeg",
      size_bytes: 4096,
    });
    expect(
      JSON.stringify(driveCalls.map((call) => call[1]?.body)),
    ).not.toContain("child-folder-1");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("shows safe Drive metadata verification errors without rendering token-like backend details", async () => {
    const rawSecret =
      "ya29.raw-access-token-never-render raw-google-payload refresh_token";
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
        if (url.includes("/api/google/drive/files/"))
          return json({ detail: rawSecret }, false, 409);
        if (url.includes("/api/google/drive/folders/"))
          return json({ detail: rawSecret }, false, 502);
        return json({ credentials: [], events: [] });
      },
    );
    renderApp("platform");
    await userEvent.click(
      await screen.findByRole("button", { name: /Проекты/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Показать sources" }),
    );
    await userEvent.type(
      screen.getByPlaceholderText("Drive file/folder ID"),
      "drive-file-with-error",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Проверить Drive metadata" }),
    );
    expect(
      await screen.findByText(/Не удалось проверить Drive metadata/),
    ).toBeInTheDocument();
    await userEvent.type(
      screen.getByPlaceholderText("Drive folder ID"),
      "folder-with-error",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Показать файлы в папке" }),
    );
    expect(
      await screen.findByText(/Не удалось загрузить файлы из Drive папки/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/raw-access-token-never-render/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/raw-google-payload/)).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
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
