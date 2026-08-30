import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectDriveUploadPanel } from "./DirectDriveUploadPanel";
import * as directDriveUpload from "./directDriveUpload";
import * as googlePicker from "./googlePicker";


const OPERATION_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
] as const;

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function mockApi(requestBodies: Array<{ path: string; body: unknown }>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requestBodies.push({ path, body });
    if (path === "/api/google/picker/session") {
      return jsonResponse({
        access_token: "picker-token",
        api_key: "picker-key",
        app_id: "picker-app",
        scope_ready: true,
      });
    }
    if (path.endsWith("/direct-drive-uploads/session")) {
      const files = (body as { files: Array<{ operation_id: string }> }).files;
      return jsonResponse({
        access_token: "drive-token",
        expires_in: 3600,
        folder: { name: "Результаты" },
        policy: {
          max_files: 20,
          max_file_bytes: 1024 * 1024,
          max_total_bytes: 2 * 1024 * 1024,
          supported_mime_prefixes: ["audio/", "video/"],
          supported_mime_types: ["application/ogg"],
        },
        uploads: files.map((file) => ({
          operation_id: file.operation_id,
          capability: "a".repeat(96),
        })),
      });
    }
    if (path.endsWith("/direct-drive-uploads/complete")) {
      const descriptor = body as {
        file_id: string;
        original_filename: string;
        mime_type: string;
        size_bytes: number;
      };
      return jsonResponse({
        name: descriptor.original_filename,
        mime_type: descriptor.mime_type,
        size_bytes: descriptor.size_bytes,
        web_view_url: `https://drive.google.com/file/d/${descriptor.file_id}/view`,
      });
    }
    throw new Error(`unexpected_request:${path}`);
  });
}

async function selectFolderAndFiles(files: File[]) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Выбрать целевую папку" }));
  await screen.findByText(/Папка:/);
  fireEvent.change(
    screen.getByLabelText("Выбрать файлы для прямой загрузки в Google Drive"),
    { target: { files } },
  );
  return user;
}

describe("DirectDriveUploadPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps partial failures isolated and retries the same operation safely", async () => {
    const requestBodies: Array<{ path: string; body: unknown }> = [];
    vi.stubGlobal("fetch", mockApi(requestBodies));
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValue({
      action: "picked",
      docs: [{ id: "folder-id", name: "Результаты" }],
    });
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce(OPERATION_IDS[0])
      .mockReturnValueOnce(OPERATION_IDS[1]);
    let failSecond = true;
    const upload = vi.spyOn(directDriveUpload, "uploadDirectDriveFile")
      .mockImplementation(async ({ item, onProgress }) => {
        onProgress?.({
          loadedBytes: item.file.size,
          totalBytes: item.file.size,
          percent: 100,
        });
        if (item.file.name === "broken.mp4" && failSecond) {
          failSecond = false;
          throw new Error("network_failure");
        }
        return {
          fileId: item.file.name === "ready.ogg" ? "drive-file-1" : "drive-file-2",
          reused: item.file.name === "broken.mp4",
        };
      });

    render(<DirectDriveUploadPanel projectId="project-1" csrf="csrf" onCsrf={vi.fn()} />);
    const user = await selectFolderAndFiles([
      new File(["ready"], "ready.ogg", { type: "audio/ogg" }),
      new File(["broken"], "broken.mp4", { type: "video/mp4" }),
    ]);
    await user.click(screen.getByRole("button", { name: "Загрузить в Google Drive" }));

    await waitFor(() => expect(screen.getByText(/подтверждено 1 из 2/)).toBeInTheDocument());
    expect(screen.getAllByRole("link", { name: "Открыть в Google Drive" })).toHaveLength(1);
    expect(screen.getByRole("progressbar", { name: "Прогресс загрузки ready.ogg" })).toHaveValue(100);
    expect(screen.getByRole("progressbar", { name: "Прогресс загрузки broken.mp4" })).toHaveValue(100);
    expect(screen.getByRole("button", { name: "Изменить целевую папку" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Повторить" }));

    await waitFor(() => expect(screen.getByText(/подтверждено 2 из 2/)).toBeInTheDocument());
    expect(screen.getAllByRole("link", { name: "Открыть в Google Drive" })).toHaveLength(2);
    expect(screen.getByText(/Уже загружен — подтверждён без дубля/)).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(3);
    const sessions = requestBodies
      .filter((request) => request.path.endsWith("/direct-drive-uploads/session"))
      .map((request) => request.body as { files: Array<{ operation_id: string }> });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].files.map((file) => file.operation_id)).toEqual(OPERATION_IDS);
    expect(sessions[1].files.map((file) => file.operation_id)).toEqual([OPERATION_IDS[1]]);
    expect(requestBodies.some((request) => request.path.includes("/sources"))).toBe(false);
  });

  it("cancels the active transfer and exposes an explicit safe retry", async () => {
    const requestBodies: Array<{ path: string; body: unknown }> = [];
    vi.stubGlobal("fetch", mockApi(requestBodies));
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValue({
      action: "picked",
      docs: [{ id: "folder-id", name: "Результаты" }],
    });
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce(OPERATION_IDS[0])
      .mockReturnValueOnce(OPERATION_IDS[1]);
    const upload = vi.spyOn(directDriveUpload, "uploadDirectDriveFile")
      .mockImplementation(({ signal }) => new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }));

    render(<DirectDriveUploadPanel projectId="project-1" csrf="csrf" onCsrf={vi.fn()} />);
    const user = await selectFolderAndFiles([
      new File(["voice"], "voice.ogg", { type: "audio/ogg" }),
      new File(["video"], "video.mp4", { type: "video/mp4" }),
    ]);
    await user.click(screen.getByRole("button", { name: "Загрузить в Google Drive" }));
    await user.click(await screen.findByRole("button", { name: "Отменить загрузку" }));

    await waitFor(() => expect(screen.getAllByText(/Отменён — перед повтором/)).toHaveLength(2));
    expect(screen.getAllByRole("button", { name: "Повторить" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Повторить незавершённые" })).toBeEnabled();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(requestBodies.some((request) =>
      request.path.endsWith("/direct-drive-uploads/complete"),
    )).toBe(false);
  });
});
