import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioPreparationPage } from "./AudioPreparationPage";

function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

describe("AudioPreparationPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the owner workspace, explains ephemeral retention and enables preview after selection", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/api/projects/project-id/sources")) return json({ sources: [{ id: "source-id", project_id: "project-id", source_type: "local_upload", original_filename: "meeting.wav", mime_type: "audio/wav", size_bytes: 100, drive_file_url: null, upload_status: "uploaded", uploaded_at: "2026-08-24T20:00:00Z", source_created_at: "2026-08-24T19:00:00Z", source_created_at_provenance: "embedded_media_metadata", expires_at: "2026-08-25T20:00:00Z", deleted_at: null, delete_reason: null, created_at: "2026-08-24T20:00:00Z", updated_at: "2026-08-24T20:00:00Z" }] });
      if (url.endsWith("/api/projects/project-id/audio-preparations")) return json({ jobs: [] });
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Обработка аудио" })).toBeInTheDocument();
    const savedSources = screen
      .getByText("Выбрать из сохранённых файлов Studio")
      .closest("details");
    expect(savedSources).not.toHaveAttribute("open");
    await userEvent.click(
      screen.getByText("Выбрать из сохранённых файлов Studio"),
    );
    const source = await screen.findByRole("checkbox", { name: /meeting\.wav/i });
    expect(screen.getByText(/максимум через 24 часа/i)).toBeInTheDocument();
    const preview = screen.getByRole("button", { name: "Проверить и рассчитать" });
    expect(preview).toBeDisabled();
    await userEvent.click(source);
    await waitFor(() => expect(preview).toBeEnabled());
  });

  it("applies an editable lecture preset and keeps copy mode safe", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/transcriptions/workspace")) return json({ project: { id: "project-id", title: "Транскрибации" }, created: false });
      if (url.endsWith("/sources")) return json({ sources: [] });
      return json({ jobs: [] });
    }));
    render(<AudioPreparationPage csrf="csrf" onCsrf={vi.fn()} />);
    const user = userEvent.setup();
    const preset = await screen.findByLabelText("Preset");
    await user.selectOptions(preset, "lecture");
    expect(screen.getByLabelText("Формат")).toHaveValue("flac");
    expect(screen.getByLabelText("Каналы")).toHaveValue("mixdown");
    expect(screen.getByRole("checkbox", { name: "Уменьшить длинные паузы" })).toBeChecked();
    await user.selectOptions(screen.getByLabelText("Формат"), "copy");
    expect(screen.getByLabelText("Каналы")).toHaveValue("preserve");
    expect(screen.getByLabelText("Каналы")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Уменьшить длинные паузы" })).not.toBeChecked();
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

    const download = await screen.findByRole("link", { name: "Скачать результат" });
    expect(download).toHaveClass("button-like", "primary");
    await userEvent.click(
      screen.getByRole("button", { name: "Транскрибировать результат" }),
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
});
