import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as googlePicker from "./googlePicker";
import { AudioPreparationPage } from "./AudioPreparationPage";

function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function source(id: string, filename: string, createdAt: string | null) {
  return {
    id,
    project_id: "project-id",
    source_type: "local_upload",
    original_filename: filename,
    mime_type: "audio/wav",
    size_bytes: 100,
    drive_file_url: null,
    upload_status: "uploaded",
    uploaded_at: "2026-08-24T20:00:00Z",
    source_created_at: createdAt,
    source_created_at_provenance: createdAt ? "embedded_media_metadata" : null,
    expires_at: "2027-08-25T20:00:00Z",
    deleted_at: null,
    delete_reason: null,
    created_at: "2026-08-24T20:00:00Z",
    updated_at: "2026-08-24T20:00:00Z",
  };
}

function previewJob(id: string, title: string, sourceIds: string[]) {
  return {
    id,
    status: "preview_queued",
    title,
    options: { output_format: "copy" },
    input_count: sourceIds.length,
    inputs: sourceIds.map((sourceId, position) => ({ position, filename: sourceId, source_type: "local_upload", ephemeral_reference: false })),
    preview: null,
    progress: { percent: 0, stage: "preview_queued" },
    output: null,
    error_code: null,
  };
}

describe("AudioPreparationPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("restores older pending previews and allows cancelling them to release their sources", async () => {
    const pending = { ...previewJob("older-preview", "Подготовка исходного файла", ["source-id"]), status: "preview_ready", progress: { percent: 100, stage: "preview_ready" } };
    const latest = { ...previewJob("latest-result", "Последний результат", []), status: "completed", progress: { percent: 100, stage: "completed" } };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" } });
      if (url.endsWith("/sources")) return json({ sources: [] });
      if (url.endsWith("/audio-preparations")) return json({ jobs: [latest, pending] });
      if (url.endsWith("/older-preview/cancel") && init?.method === "POST") return json({ ...pending, status: "cancelled", progress: { percent: 100, stage: "cancelled" } });
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);

    const heading = await screen.findByRole("heading", { name: /Подготовка исходного файла/ });
    const card = heading.closest("article")!;
    await userEvent.click(within(card).getByRole("button", { name: "Отменить" }));
    expect(await within(card).findByText("Отменено")).toBeVisible();
    expect(within(card).queryByRole("button", { name: "Отменить" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/older-preview/cancel") && init?.method === "POST")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Отменить" })).not.toBeInTheDocument();
  });

  it("loads the owner workspace, explains ephemeral retention and enables preview after selection", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/api/projects/project-id/sources")) return json({ sources: [{ id: "source-id", project_id: "project-id", source_type: "local_upload", original_filename: "meeting.wav", mime_type: "audio/wav", size_bytes: 100, drive_file_url: null, upload_status: "uploaded", uploaded_at: "2026-08-24T20:00:00Z", source_created_at: "2026-08-24T19:00:00Z", source_created_at_provenance: "embedded_media_metadata", expires_at: "2027-08-25T20:00:00Z", deleted_at: null, delete_reason: null, created_at: "2026-08-24T20:00:00Z", updated_at: "2026-08-24T20:00:00Z" }] });
      if (url.endsWith("/api/projects/project-id/audio-preparations")) return json({ jobs: [] });
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Подготовка аудио" })).toBeInTheDocument();
    const savedSources = screen
      .getByText("Выбрать из сохранённых файлов Studio")
      .closest("details");
    expect(savedSources).not.toHaveAttribute("open");
    await userEvent.click(
      screen.getByText("Выбрать из сохранённых файлов Studio"),
    );
    const source = await screen.findByRole("checkbox", { name: /meeting\.wav/i });
    expect(screen.getByText(/максимум через 24 часа/i)).toBeInTheDocument();
    const preview = screen.getByRole("button", { name: "Проверить файлы и рассчитать" });
    expect(screen.getByRole("textbox", { name: /Название результата/ })).toHaveValue("");
    expect(screen.getByPlaceholderText("Имя исходного файла")).toBeInTheDocument();
    expect(screen.getByText(/если оставить поле пустым, используется имя исходного файла/i)).toBeInTheDocument();
    expect(preview).toBeDisabled();
    await userEvent.click(source);
    await waitFor(() => expect(preview).toBeEnabled());
  });

  it("defaults to preserving the source and exposes conversion controls explicitly", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/sources")) return json({ sources: [] });
      return json({ jobs: [] });
    }));
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    const user = userEvent.setup();
    expect(await screen.findByLabelText("Формат результата")).toHaveValue("copy");
    expect(screen.queryByLabelText("Шаблон файла")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    const preset = screen.getByLabelText("Сценарий");
    await user.selectOptions(preset, "lecture");
    expect(screen.getByLabelText("Формат результата")).toHaveValue("flac");
    expect(screen.getByLabelText("Звуковые каналы")).toHaveValue("mixdown");
    expect(screen.getByRole("checkbox", { name: "Уменьшить длинные паузы в аудио или видео" })).toBeChecked();
    await user.click(screen.getByText("Дополнительные настройки пауз"));
    expect(screen.getByLabelText(/Что считать тишиной/)).toHaveValue("-45");
    await user.selectOptions(screen.getByLabelText("Формат результата"), "copy");
    expect(screen.getByLabelText("Звуковые каналы")).toHaveValue("preserve");
    expect(screen.getByRole("checkbox", { name: "Уменьшить длинные паузы в аудио или видео" })).not.toBeChecked();
  });

  it("renders consistent terminal actions and hands the exact output source to transcriptions", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/sources")) return json({ sources: [] });
      if (url.endsWith("/audio-preparations")) return json({ jobs: [{
        id: "audio-job-id",
        status: "completed",
        title: "Готовый файл",
        input_count: 1,
        inputs: [],
        preview: { input_duration_seconds: 10, estimated_output_duration_seconds: 8, copy_compatible: true },
        progress: { percent: 100, stage: "completed" },
        output: { download_ready: true, source_id: "prepared-source-id", google_drive_url: "https://drive.google.com/file/d/safe/view", duration_seconds: 8 },
        error_code: null,
      }] });
      throw new Error(`unexpected request: ${url}`);
    }));
    const listener = vi.fn();
    window.addEventListener("studio:transcribe-source", listener);

    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);

    const download = await screen.findByRole("link", { name: "Скачать файл" });
    expect(download).toHaveClass("button-like", "primary");
    await userEvent.click(
      screen.getByRole("button", { name: "Использовать для транскрибации" }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      sourceId: "prepared-source-id",
    });
    expect(
      screen.getByRole("button", { name: "Использовать в новой обработке" }),
    ).toBeInTheDocument();
    window.removeEventListener("studio:transcribe-source", listener);
  });

  it("creates independent jobs by default for multiple selected files", async () => {
    const created: Record<string, unknown>[] = [];
    const rows = [
      source("source-a", "anything-a.wav", "2026-08-24T20:00:00Z"),
      source("source-b", "Лекция 1. Предмет, задачи и методы социальной психологии.mp4", "2026-08-24T18:00:00Z"),
      source("source-c", "anything-c.wav", "2026-08-24T19:00:00Z"),
    ];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/sources")) return json({ sources: rows });
      if (url.endsWith("/audio-preparations") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        created.push(body);
        return json(previewJob(`job-${created.length}`, String(body.title), body.source_ids as string[]));
      }
      if (url.endsWith("/audio-preparations")) return json({ jobs: [] });
      throw new Error(`unexpected request: ${url}`);
    }));
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    await userEvent.click(await screen.findByText("Выбрать из сохранённых файлов Studio"));
    for (const row of rows) await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(row.original_filename, "i") }));

    expect(screen.getByRole("radio", { name: "Обработать каждый отдельно" })).toBeChecked();
    expect(screen.getByText("Будет создано результатов: 3.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Проверить файлы и рассчитать" }));

    await waitFor(() => expect(created).toHaveLength(3));
    expect(created.map((body) => body.source_ids)).toEqual([["source-b"], ["source-c"], ["source-a"]]);
    expect(created.map((body) => body.title)).toEqual(["Лекция 1. Предмет, задачи и методы социальной психологии", "anything-c", "anything-a"]);
  });

  it("shows and submits an explicit metadata-ordered concatenation plan", async () => {
    let created: Record<string, unknown> | null = null;
    const rows = [
      source("source-a", "arbitrary-z.wav", "2026-08-24T20:00:00Z"),
      source("source-b", "arbitrary-x.wav", "2026-08-24T18:00:00Z"),
      source("source-c", "arbitrary-y.wav", "2026-08-24T19:00:00Z"),
    ];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/sources")) return json({ sources: rows });
      if (url.endsWith("/audio-preparations") && init?.method === "POST") {
        created = JSON.parse(String(init.body));
        return json(previewJob("concat-job", "Обработанное аудио", (created as Record<string, unknown>).source_ids as string[]));
      }
      if (url.endsWith("/audio-preparations")) return json({ jobs: [] });
      throw new Error(`unexpected request: ${url}`);
    }));
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    await userEvent.click(await screen.findByText("Выбрать из сохранённых файлов Studio"));
    for (const row of rows) await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(row.original_filename, "i") }));
    await userEvent.click(screen.getByRole("radio", { name: "Склеить в один файл" }));

    const plan = screen.getByRole("heading", { name: "Порядок склейки" }).parentElement as HTMLElement;
    const items = within(plan).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("arbitrary-x.wav");
    expect(items[1]).toHaveTextContent("arbitrary-y.wav");
    expect(items[2]).toHaveTextContent("arbitrary-z.wav");
    await userEvent.click(within(plan).getByRole("button", { name: "Переместить файл 1 ниже" }));
    await userEvent.click(screen.getByRole("button", { name: "Проверить файлы и рассчитать" }));

    await waitFor(() => expect(created).not.toBeNull());
    expect(created).toMatchObject({ title: "arbitrary-y", source_ids: ["source-c", "source-b", "source-a"], manual_order: true });
  });

  it("keeps device files browser-local until the user explicitly chooses Studio upload", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/sources")) return json({ sources: [] });
      if (url.endsWith("/audio-preparations")) return json({ jobs: [] });
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    await screen.findByRole("heading", { name: "Подготовка аудио" });
    await userEvent.click(screen.getByRole("tab", { name: "Обработать на устройстве" }));

    await userEvent.upload(
      screen.getByLabelText("Выбрать файлы для обработки на устройстве"),
      new File(["local bytes"], "private-recording.wav", { type: "audio/wav" }),
    );

    expect(screen.getByText(/Выбрано файлов: 1 · обработка на устройстве/i)).toBeInTheDocument();
    expect(
      screen.getByText(/исходные файлы не отправляются в Studio/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Формат результата")).toHaveValue("wav");
    expect(screen.getByLabelText("Формат результата")).toBeDisabled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("local-upload/initiate"))).toBe(false);
  });

  it("discloses the bounded FLAC output precision", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/sources")) return json({ sources: [] });
      if (url.endsWith("/audio-preparations")) return json({ jobs: [] });
      throw new Error(`unexpected request: ${url}`);
    }));
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    await screen.findByRole("heading", { name: "Подготовка аудио" });

    await userEvent.selectOptions(screen.getByLabelText("Формат результата"), "flac");

    expect(
      screen.getByText(/FLAC создаётся в 16-bit PCM без lossy-сжатия/i),
    ).toBeInTheDocument();
  });

  it("exposes keyboard-accessible source tabs and isolates direct Drive upload from processing controls", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/sources")) return json({ sources: [] });
      if (url.endsWith("/audio-preparations")) return json({ jobs: [] });
      throw new Error(`unexpected request: ${url}`);
    }));
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    await screen.findByRole("heading", { name: "Подготовка аудио" });

    const tablist = screen.getByRole("tablist", { name: "Способ получения исходных файлов" });
    expect(within(tablist).getAllByRole("tab")).toHaveLength(4);
    const direct = within(tablist).getByRole("tab", { name: "В Google Drive без обработки" });
    await userEvent.click(direct);
    expect(direct).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Загрузить исходные файлы без обработки" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "2. Параметры" })).not.toBeInTheDocument();

    direct.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(within(tablist).getByRole("tab", { name: "Загрузить в Studio" }))
      .toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "2. Параметры" })).toBeInTheDocument();
  });
});


describe("audio UX regression", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("keeps empty/minus drafts and sends comma/point decimals as numbers only after validation", async () => {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/workspace")) return json({ project: { id: "project-id", title: "Studio" } });
      if (url.endsWith("/sources")) return json({ sources: [source("s", "Лекция.wav", null)] });
      if (url.endsWith("/audio-preparations") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)); requests.push(body);
        return json(previewJob("job", "Лекция", ["s"]));
      }
      if (url.endsWith("/audio-preparations")) return json({ jobs: [] });
      throw new Error(url);
    }));
    const user = userEvent.setup();
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    await user.click(screen.getByText("Выбрать из сохранённых файлов Studio"));
    await user.click(await screen.findByRole("checkbox", { name: /Лекция.wav/ }));
    await user.click(screen.getByRole("checkbox", { name: "Уменьшить длинные паузы в аудио или видео" }));
    await user.click(screen.getByText("Дополнительные настройки пауз"));
    const threshold = screen.getByLabelText(/Что считать тишиной/);
    const minimum = screen.getByLabelText("Минимальная пауза, сек");
    const keep = screen.getByLabelText("Сколько паузы оставить, сек");
    const submit = screen.getByRole("button", { name: "Проверить файлы и рассчитать" });
    await user.clear(threshold);
    expect(threshold).toHaveValue("");
    await user.type(threshold, "-");
    expect(threshold).toHaveValue("-");
    await user.click(submit);
    expect(requests).toHaveLength(0);
    expect(screen.getByText(/введите число от −60 до −10/)).toBeVisible();
    await user.type(threshold, "40.5");
    expect(threshold).toHaveValue("-40,5");
    await user.clear(minimum); await user.type(minimum, "1,2");
    await user.clear(keep); await user.type(keep, "0.35");
    expect(keep).toHaveValue("0,35");
    await user.click(submit);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].options).toMatchObject({ silence_threshold_db: -40.5, silence_min_duration_seconds: 1.2, silence_keep_duration_seconds: 0.35 });
  });

  it("saves a completed download through the same folder picker, keeps download and polls the durable export", async () => {
    const picker = vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValue({ action: "picked", docs: [{ id: "chosen-folder", name: "Результаты" }] });
    const saved = { ...previewJob("ready", "Готовое аудио", []), status: "completed", progress: { percent: 100, stage: "completed" }, output: { download_ready: true, source_id: "ready-source", google_drive_url: null } };
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/workspace")) return json({ project: { id: "project-id", title: "Studio" } });
      if (url.endsWith("/sources")) return json({ sources: [] });
      if (url.endsWith("/audio-preparations")) return json({ jobs: [saved] });
      if (url.endsWith("/picker/session")) return json({ access_token: "synthetic", scope_ready: true });
      if (url.endsWith("/ready/save-to-drive")) {
        posts.push(JSON.parse(String(init?.body)));
        return json({ ...saved, progress: { percent: 0, stage: "google_drive_export_queued" } });
      }
      if (url.endsWith("/ready")) return json({ ...saved, output: { ...saved.output, google_drive_url: "https://drive.google.com/file/d/result/view" } });
      throw new Error(url);
    }));
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Сохранить в Google Drive" }));
    expect(picker.mock.calls[0][0]).toBe("output-folder");
    expect(posts).toEqual([{ folder_id: "chosen-folder" }]);
    expect(screen.getByRole("link", { name: "Скачать файл" })).toHaveAttribute("href", "/api/audio-preparations/ready/download");
    expect(screen.getByRole("button", { name: "Сохраняем в Google Drive…" })).toBeDisabled();
    expect(await screen.findByRole("link", { name: "Открыть в Google Drive" }, { timeout: 3000 })).toHaveAttribute("href", "https://drive.google.com/file/d/result/view");
  });

  it("picker cancellation makes no export and an unconfirmed export retries its original destination", async () => {
    const picker = vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValue({ action: "cancel" });
    const ready = { ...previewJob("ready", "Аудио", []), status: "completed", progress: { percent: 100, stage: "completed" }, output: { download_ready: true, source_id: "out", google_drive_url: null } };
    const posts: unknown[] = [];
    let failed = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/workspace")) return json({ project: { id: "project-id", title: "Studio" } });
      if (url.endsWith("/sources")) return json({ sources: [] });
      if (url.endsWith("/audio-preparations")) return json({ jobs: [{ ...ready, ...(failed ? { progress: { percent: 100, stage: "google_drive_export_failed" }, output_folder: { id: "original", name: "Папка" } } : {}) }] });
      if (url.endsWith("/picker/session")) return json({ access_token: "synthetic", scope_ready: true });
      if (url.endsWith("/save-to-drive")) { posts.push(JSON.parse(String(init?.body))); return json(ready); }
      throw new Error(url);
    }));
    const view = render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Сохранить в Google Drive" }));
    expect(posts).toHaveLength(0);
    view.unmount(); failed = true;
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Повторить сохранение в Google Drive" }));
    expect(posts).toEqual([{ folder_id: "original" }]);
    expect(picker).toHaveBeenCalledTimes(1);
  });
});
