import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.getByLabelText(/Что считать тишиной/)).toHaveValue(-45);
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
      source("source-b", "anything-b.wav", "2026-08-24T18:00:00Z"),
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
    expect(created.map((body) => body.title)).toEqual(["anything-b", "anything-c", "anything-a"]);
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
