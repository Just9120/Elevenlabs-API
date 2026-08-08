import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockCallbacks = {
  onStatus: (value: string) => void;
  onInputLevel: (value: number) => void;
};

const controllerState = vi.hoisted(() => ({
  instances: [] as Array<{
    callbacks: MockCallbacks;
    dependencies: { requestCapability: () => Promise<unknown> };
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("./realtimeSession", () => ({
  RealtimeSessionController: class {
    callbacks: MockCallbacks;
    dependencies: { requestCapability: () => Promise<unknown> };
    start = vi.fn(async () => {
      this.callbacks.onStatus("requesting_permission");
      await this.dependencies.requestCapability();
      this.callbacks.onStatus("connected");
      this.callbacks.onInputLevel(0.42);
    });
    stop = vi.fn(() => this.callbacks.onStatus("stopped"));
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
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => cleanup());

  it("requests a project-scoped one-use capability without rendering it", async () => {
    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
      />,
    );
    const start = await screen.findByRole("button", { name: "Начать" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);

    await screen.findByText("Соединение установлено");
    expect(screen.getByText("Сигнал есть · 42%")).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole("button", { name: "Остановить" }));
    expect(controllerState.instances[0].stop).toHaveBeenCalledOnce();
    expect(screen.getByText("Остановлено")).toBeInTheDocument();
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
      />,
    );
    expect(await screen.findByText("Активный профиль не найден")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Начать" })).toBeDisabled();
  });

  it("disposes capture when the browser page is hidden", async () => {
    render(
      <LiveTranscriptionPanel
        projectId="project-safe"
        csrf="csrf-safe"
        onCsrf={vi.fn()}
      />,
    );
    const start = await screen.findByRole("button", { name: "Начать" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);
    await screen.findByText("Соединение установлено");

    window.dispatchEvent(new Event("pagehide"));

    expect(controllerState.instances[0].dispose).toHaveBeenCalledOnce();
  });
});
