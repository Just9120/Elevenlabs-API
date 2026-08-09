import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockCallbacks = {
  onStatus: (value: string) => void;
  onInputLevel: (value: number) => void;
  onCommitted: (value: string) => void;
};

const controllerState = vi.hoisted(() => ({
  instances: [] as Array<{
    active: boolean;
    callbacks: MockCallbacks;
    dependencies: { requestCapability: () => Promise<unknown> };
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("./realtimeSession", () => ({
  RealtimeSessionController: class {
    active = false;
    callbacks: MockCallbacks;
    dependencies: { requestCapability: () => Promise<unknown> };
    start = vi.fn(async () => {
      this.active = true;
      this.callbacks.onStatus("requesting_permission");
      await this.dependencies.requestCapability();
      this.callbacks.onStatus("connected");
      this.callbacks.onInputLevel(0.42);
    });
    stop = vi.fn(() => {
      this.active = false;
      this.callbacks.onStatus("stopped");
    });
    dispose = vi.fn();
    constructor(
      callbacks: MockCallbacks,
      dependencies: { requestCapability: () => Promise<unknown> },
    ) {
      this.callbacks = callbacks;
      this.dependencies = dependencies;
      controllerState.instances.push(this);
    }
  },
}));

import { LiveTranscriptionPanel } from "./LiveTranscriptionPanel";

const response = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  } as Response);

describe("LiveTranscriptionPanel", () => {
  beforeEach(() => {
    controllerState.instances.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/api/credentials")) {
          return response({
            credentials: [
              {
                id: "credential-safe",
                provider: "elevenlabs",
                label: "Realtime",
                status: "active",
                active_version: 4,
              },
            ],
          });
        }
        if (
          url.endsWith("/api/projects/project-safe/realtime/capability") &&
          init?.method === "POST"
        ) {
          return response({
            websocket_url:
              "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=sutkn_browser_secret&audio_format=pcm_16000&commit_strategy=vad&language_code=ru",
            expires_in_seconds: 900,
            model_id: "scribe_v2_realtime",
            audio_format: "pcm_16000",
            commit_strategy: "vad",
          });
        }
        return response({ ok: true });
      }),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn(),
        getDisplayMedia: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:live-transcript"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it("requests a project-scoped one-use capability without rendering it", async () => {
    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        active
      />,
    );
    const start = await screen.findByRole("button", { name: "Начать" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);

    await screen.findByText("Соединение установлено");
    expect(screen.getByText("Сигнал есть · 42%")).toBeInTheDocument();
    expect(screen.getByLabelText("Статистика live-сессии")).toHaveTextContent(
      "Сессия: 00:00 · Фрагментов: 0 · Символов: 0",
    );
    const capabilityCall = vi.mocked(fetch).mock.calls.find(
      ([url]) =>
        String(url).endsWith(
          "/api/projects/project-safe/realtime/capability",
        ),
    );
    expect(capabilityCall).toBeDefined();
    expect(capabilityCall?.[1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      headers: expect.objectContaining({ "x-csrf-token": "csrf-safe" }),
    });
    expect(JSON.parse(String(capabilityCall?.[1]?.body))).toEqual({
      provider_credential_id: "credential-safe",
      language: "ru",
    });
    expect(document.body.textContent).not.toContain("sutkn_browser_secret");
    expect(document.body.textContent).not.toContain("websocket_url");
    await waitFor(() =>
      expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalledTimes(2),
    );

    await userEvent.click(screen.getByRole("button", { name: "Остановить" }));
    expect(controllerState.instances[0].stop).toHaveBeenCalledOnce();
    expect(screen.getByText("Остановлено")).toBeInTheDocument();
  });

  it("keeps long live output observable with stats and opt-out follow", async () => {
    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        active
      />,
    );
    const start = await screen.findByRole("button", { name: "Начать" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);

    const committed = screen.getByLabelText("Подтверждённая транскрипция");
    Object.defineProperty(committed, "scrollHeight", {
      configurable: true,
      value: 480,
    });
    act(() => {
      controllerState.instances[0].callbacks.onCommitted("Готовый фрагмент");
    });

    expect(await screen.findByText("Готовый фрагмент")).toBeInTheDocument();
    expect(screen.getByLabelText("Статистика live-сессии")).toHaveTextContent(
      "Фрагментов: 1 · Символов: 16",
    );
    await waitFor(() => expect(committed.scrollTop).toBe(480));

    const follow = screen.getByRole("button", {
      name: "Автопрокрутка: вкл",
    });
    await userEvent.click(follow);
    expect(
      screen.getByRole("button", { name: "Автопрокрутка: выкл" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("confirms copy and downloads a timestamped browser-only transcript", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        active
      />,
    );
    const start = await screen.findByRole("button", { name: "Начать" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);
    act(() => {
      controllerState.instances[0].callbacks.onCommitted("Итоговый текст");
    });

    await userEvent.click(screen.getByRole("button", { name: "Копировать" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Итоговый текст");
    expect(
      await screen.findByText("Текст скопирован в буфер обмена."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Скачать .txt" }));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0];
    expect(anchor.download).toMatch(
      /^studio-live-transcript-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}Z\.txt$/,
    );
    expect(anchor.href).toBe("blob:live-transcript");
    expect(await screen.findByText("Текст сохранён в файл .txt.")).toBeInTheDocument();
    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:live-transcript"),
    );
  });

  it("stops hidden capture and keeps the transcript mounted across mode switches", async () => {
    const props = {
      projectId: "project-safe",
      csrf: "csrf-safe",
      onCsrf: vi.fn(),
    };
    const { rerender } = render(
      <LiveTranscriptionPanel {...props} active />,
    );
    const start = await screen.findByRole("button", { name: "Начать" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);
    act(() => {
      controllerState.instances[0].callbacks.onCommitted("Сохранённый текст");
    });

    rerender(<LiveTranscriptionPanel {...props} active={false} />);

    expect(controllerState.instances[0].stop).toHaveBeenCalledOnce();
    expect(screen.getByText("Сохранённый текст")).toBeInTheDocument();
    expect(
      screen.getByText(/Live-сессия остановлена при переходе/),
    ).toBeInTheDocument();

    rerender(<LiveTranscriptionPanel {...props} active />);
    expect(screen.getByText("Сохранённый текст")).toBeInTheDocument();
  });

  it("warns before browser navigation while live text can be lost", async () => {
    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        active
      />,
    );
    const untouched = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(untouched);
    expect(untouched.defaultPrevented).toBe(false);

    const start = await screen.findByRole("button", { name: "Начать" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);
    const runningNavigation = new Event("beforeunload", {
      cancelable: true,
    });
    window.dispatchEvent(runningNavigation);
    expect(runningNavigation.defaultPrevented).toBe(true);
  });

  it("restores only committed text supplied from current React memory", async () => {
    const onSegmentsChange = vi.fn();
    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        active
        initialSegments={["Первый проектный фрагмент", "Второй фрагмент"]}
        onSegmentsChange={onSegmentsChange}
      />,
    );

    expect(await screen.findByText("Realtime · v4")).toBeInTheDocument();
    expect(screen.getByText("Первый проектный фрагмент")).toBeInTheDocument();
    expect(screen.getByText("Второй фрагмент")).toBeInTheDocument();
    expect(screen.getByLabelText("Статистика live-сессии")).toHaveTextContent(
      "Фрагментов: 2",
    );
    expect(onSegmentsChange).not.toHaveBeenCalled();
  });

  it("requires an active ElevenLabs profile", async () => {
    vi.mocked(fetch).mockImplementation((url: string) =>
      url.endsWith("/api/credentials")
        ? response({ credentials: [] })
        : response({ ok: true }),
    );
    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        active
      />,
    );
    expect(await screen.findByText("Активный профиль не найден")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Начать" })).toBeDisabled();
  });

  it("fails closed when browser audio capture is unavailable", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        active
      />,
    );

    expect(
      await screen.findByText("Этот браузер не поддерживает захват микрофона."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Этот браузер не поддерживает захват звука вкладки или экрана.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Начать" })).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Микрофон или аудиовход" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Микрофон или аудиовход" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Звук вкладки или экрана" }),
    ).toBeDisabled();
  });

  it("disposes capture when the browser page is hidden", async () => {
    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        active
      />,
    );
    const start = await screen.findByRole("button", { name: "Начать" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);
    await screen.findByText("Соединение установлено");

    window.dispatchEvent(new Event("pagehide"));

    expect(controllerState.instances[0].dispose).toHaveBeenCalledOnce();
  });

  it("stops capture when the document becomes hidden", async () => {
    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        active
      />,
    );
    const start = await screen.findByRole("button", { name: "Начать" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);
    await screen.findByText("Соединение установлено");
    const visibilityState = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(controllerState.instances[0].stop).toHaveBeenCalledOnce();
    expect(
      await screen.findByText(/вкладка стала скрытой/),
    ).toBeInTheDocument();
    visibilityState.mockRestore();
  });
});
