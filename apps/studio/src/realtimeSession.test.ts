import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RealtimeSessionController,
  realtimeProviderErrorMessage,
  type RealtimeSessionStatus,
} from "./realtimeSession";

const capability = {
  websocket_url:
    "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=sutkn_test&audio_format=pcm_16000&commit_strategy=vad",
  expires_in_seconds: 900,
  model_id: "scribe_v2_realtime",
  audio_format: "pcm_16000",
  commit_strategy: "vad",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mediaFixture() {
  const stop = vi.fn();
  const track = { stop, addEventListener: vi.fn() };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stop };
}

function audioFixture() {
  const processor = {
    onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as ScriptProcessorNode;
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const gain = {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const destination = { disconnect: vi.fn(), stream: mediaFixture().stream };
  const context = {
    state: "running",
    sampleRate: 48_000,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createMediaStreamSource: vi.fn(() => source),
    createScriptProcessor: vi.fn(() => processor),
    createGain: vi.fn(() => gain),
    createMediaStreamDestination: vi.fn(() => destination),
  } as unknown as AudioContext;
  return { context, processor };
}

function websocketFixture() {
  const socket = {
    readyState: 0,
    bufferedAmount: 0,
    send: vi.fn(),
    close: vi.fn(),
    onopen: null as (() => void) | null,
    onmessage: null as ((message: MessageEvent) => void) | null,
    onerror: null as (() => void) | null,
    onclose: null as (() => void) | null,
  } as unknown as WebSocket;
  return socket;
}

describe("RealtimeSessionController", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", { CONNECTING: 0, OPEN: 1 });
  });

  it("maps safe provider codes to distinct operator actions", () => {
    expect(realtimeProviderErrorMessage("session_time_limit_exceeded")).toContain(
      "максимальная длительность",
    );
    expect(realtimeProviderErrorMessage("rate_limited")).toContain(
      "частоту realtime-запросов",
    );
    expect(realtimeProviderErrorMessage("quota_exceeded")).toContain(
      "баланс ElevenLabs",
    );
    expect(realtimeProviderErrorMessage("queue_overflow")).toContain(
      "Очередь ElevenLabs",
    );
    expect(realtimeProviderErrorMessage("input_error")).toContain(
      "аудиопоток",
    );
    expect(
      realtimeProviderErrorMessage("insufficient_audio_activity"),
    ).toContain("речевой активности");
  });

  it("requests browser permission before consuming a capability", async () => {
    const display = mediaFixture();
    const permission = deferred<MediaStream>();
    const requestCapability = vi.fn().mockResolvedValue(capability);
    const statuses: RealtimeSessionStatus[] = [];
    const controller = new RealtimeSessionController(
      {
        onStatus: (status) => statuses.push(status),
        onPartial: vi.fn(),
        onCommitted: vi.fn(),
        onError: vi.fn(),
      },
      {
        requestCapability,
        mediaDevices: {
          getDisplayMedia: vi.fn(() => permission.promise),
          getUserMedia: vi.fn(),
        },
        createAudioContext: () => audioFixture().context,
        createWebSocket: () => websocketFixture(),
        setTimer: vi.fn(),
        clearTimer: vi.fn(),
      },
    );

    const starting = controller.start({
      displayAudio: true,
      microphone: false,
    });
    expect(statuses).toEqual(["requesting_permission"]);
    expect(requestCapability).not.toHaveBeenCalled();

    controller.stop();
    permission.resolve(display.stream);
    await starting;
    expect(display.stop).toHaveBeenCalled();
    expect(requestCapability).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe("stopped");
  });

  it("streams PCM, presents partial and committed text, and stops cleanly", async () => {
    const microphone = mediaFixture();
    const audio = audioFixture();
    const socket = websocketFixture();
    const statuses: RealtimeSessionStatus[] = [];
    const partials: string[] = [];
    const committed: string[] = [];
    const errors: string[] = [];
    const inputLevels: number[] = [];
    const timerCallbacks: Array<() => void> = [];
    const timerDelays: number[] = [];
    const controller = new RealtimeSessionController(
      {
        onStatus: (status) => statuses.push(status),
        onPartial: (text) => partials.push(text),
        onCommitted: (text) => committed.push(text),
        onError: (message) => errors.push(message),
        onInputLevel: (level) => inputLevels.push(level),
      },
      {
        requestCapability: vi.fn().mockResolvedValue(capability),
        mediaDevices: {
          getDisplayMedia: vi.fn(),
          getUserMedia: vi.fn().mockResolvedValue(microphone.stream),
        },
        createAudioContext: () => audio.context,
        createWebSocket: () => socket,
        setTimer: (callback, milliseconds) => {
          timerCallbacks.push(callback);
          timerDelays.push(milliseconds);
          return timerCallbacks.length;
        },
        clearTimer: vi.fn(),
      },
    );

    await controller.start({ displayAudio: false, microphone: true });
    expect(statuses).toEqual([
      "requesting_permission",
      "connecting",
    ]);
    (socket as unknown as { readyState: number }).readyState = 1;
    socket.onopen?.(new Event("open"));
    socket.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({ message_type: "session_started" }),
      }),
    );
    socket.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          message_type: "partial_transcript",
          text: "черновик",
        }),
      }),
    );
    socket.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          message_type: "final_transcript",
          text: "уточнённый черновик",
        }),
      }),
    );
    socket.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          message_type: "committed_transcript",
          text: "готовый фрагмент",
        }),
      }),
    );
    expect(statuses.at(-1)).toBe("transcribing");
    expect(partials).toEqual([
      "",
      "черновик",
      "уточнённый черновик",
      "",
    ]);
    expect(committed).toEqual(["готовый фрагмент"]);
    expect(errors).toEqual([""]);

    audio.processor.onaudioprocess?.({
      inputBuffer: {
        getChannelData: () => new Float32Array(48).fill(0.25),
      },
    } as AudioProcessingEvent);
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(inputLevels.at(-1)).toBeCloseTo(1);
    expect(JSON.parse(String(vi.mocked(socket.send).mock.calls[0][0]))).toMatchObject({
      message_type: "input_audio_chunk",
      sample_rate: 16_000,
    });

    controller.stop();
    expect(timerDelays).toEqual([25_000, 10_000, 10_000, 2_000]);
    expect(microphone.stop).toHaveBeenCalled();
    expect(inputLevels.at(-1)).toBe(0);
    expect(JSON.parse(String(vi.mocked(socket.send).mock.calls[1][0]))).toEqual({
      message_type: "input_audio_chunk",
      audio_base_64: "",
      sample_rate: 16_000,
      commit: true,
    });
    timerCallbacks.at(-1)?.();
    expect(socket.close).toHaveBeenCalledWith(1000, "Остановлено пользователем");
    expect(statuses.at(-1)).toBe("stopped");
    expect(controller.active).toBe(false);
  });

  it("closes media when the realtime socket does not connect in time", async () => {
    const microphone = mediaFixture();
    const audio = audioFixture();
    const socket = websocketFixture();
    const statuses: RealtimeSessionStatus[] = [];
    const errors: string[] = [];
    let connectTimeout: (() => void) | undefined;
    const controller = new RealtimeSessionController(
      {
        onStatus: (status) => statuses.push(status),
        onPartial: vi.fn(),
        onCommitted: vi.fn(),
        onError: (message) => errors.push(message),
      },
      {
        requestCapability: vi.fn().mockResolvedValue(capability),
        mediaDevices: {
          getDisplayMedia: vi.fn(),
          getUserMedia: vi.fn().mockResolvedValue(microphone.stream),
        },
        createAudioContext: () => audio.context,
        createWebSocket: () => socket,
        setTimer: (callback, milliseconds) => {
          if (milliseconds === 10_000) connectTimeout = callback;
          return 23;
        },
        clearTimer: vi.fn(),
      },
    );

    await controller.start({ displayAudio: false, microphone: true });
    expect(statuses.at(-1)).toBe("connecting");
    connectTimeout?.();

    expect(socket.close).toHaveBeenCalledWith(1000, "Тайм-аут подключения");
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(errors.at(-1)).toContain("10 секунд");
    expect(statuses.at(-1)).toBe("closed");
    expect(controller.active).toBe(false);
  });

  it("closes media when the provider never starts the realtime session", async () => {
    const microphone = mediaFixture();
    const audio = audioFixture();
    const socket = websocketFixture();
    const statuses: RealtimeSessionStatus[] = [];
    const errors: string[] = [];
    const tenSecondTimers: Array<() => void> = [];
    const controller = new RealtimeSessionController(
      {
        onStatus: (status) => statuses.push(status),
        onPartial: vi.fn(),
        onCommitted: vi.fn(),
        onError: (message) => errors.push(message),
      },
      {
        requestCapability: vi.fn().mockResolvedValue(capability),
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(microphone.stream),
        },
        createAudioContext: () => audio.context,
        createWebSocket: () => socket,
        setTimer: (callback, milliseconds) => {
          if (milliseconds === 10_000) tenSecondTimers.push(callback);
          return tenSecondTimers.length + 50;
        },
        clearTimer: vi.fn(),
      },
    );

    await controller.start({ displayAudio: false, microphone: true });
    (socket as unknown as { readyState: number }).readyState = 1;
    socket.onopen?.(new Event("open"));
    expect(statuses.at(-1)).toBe("connected");
    expect(tenSecondTimers).toHaveLength(2);

    tenSecondTimers[1]();

    expect(errors.at(-1)).toContain("не подтвердил realtime-сессию");
    expect(socket.close).toHaveBeenCalledWith(1000, "Тайм-аут запуска сессии");
    expect(microphone.stop).toHaveBeenCalled();
    expect(statuses.at(-1)).toBe("closed");
    expect(controller.active).toBe(false);
  });

  it("never exposes a capability URL from a WebSocket constructor failure", async () => {
    const microphone = mediaFixture();
    const audio = audioFixture();
    const errors: string[] = [];
    const controller = new RealtimeSessionController(
      {
        onStatus: vi.fn(),
        onPartial: vi.fn(),
        onCommitted: vi.fn(),
        onError: (message) => errors.push(message),
      },
      {
        requestCapability: vi.fn().mockResolvedValue(capability),
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(microphone.stream),
        },
        createAudioContext: () => audio.context,
        createWebSocket: (url) => {
          throw new Error(`CSP rejected ${url}`);
        },
        setTimer: vi.fn(() => 37),
        clearTimer: vi.fn(),
      },
    );

    await controller.start({ displayAudio: false, microphone: true });

    expect(errors.at(-1)).toContain("защищённое realtime-соединение");
    expect(errors.join(" ")).not.toContain("sutkn_test");
    expect(errors.join(" ")).not.toContain("wss://");
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(controller.active).toBe(false);
  });

  it("aborts a stalled capability request and releases capture", async () => {
    const microphone = mediaFixture();
    const audio = audioFixture();
    const requestEntered = deferred<void>();
    const errors: string[] = [];
    const statuses: RealtimeSessionStatus[] = [];
    let capabilitySignal: AbortSignal | undefined;
    let capabilityTimeout: (() => void) | undefined;
    const controller = new RealtimeSessionController(
      {
        onStatus: (status) => statuses.push(status),
        onPartial: vi.fn(),
        onCommitted: vi.fn(),
        onError: (message) => errors.push(message),
      },
      {
        requestCapability: (signal) => {
          capabilitySignal = signal;
          requestEntered.resolve(undefined);
          return new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          });
        },
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(microphone.stream),
        },
        createAudioContext: () => audio.context,
        createWebSocket: vi.fn(),
        setTimer: (callback, milliseconds) => {
          if (milliseconds === 25_000) capabilityTimeout = callback;
          return 41;
        },
        clearTimer: vi.fn(),
      },
    );

    const starting = controller.start({
      displayAudio: false,
      microphone: true,
    });
    await requestEntered.promise;
    capabilityTimeout?.();
    await starting;

    expect(capabilitySignal?.aborted).toBe(true);
    expect(microphone.stop).toHaveBeenCalled();
    expect(errors.at(-1)).toContain("25 секунд");
    expect(statuses.at(-1)).toBe("ready");
    expect(controller.active).toBe(false);
  });

  it("fails closed when websocket audio backpressure becomes unsafe", async () => {
    const microphone = mediaFixture();
    const audio = audioFixture();
    const socket = websocketFixture();
    const errors: string[] = [];
    const statuses: RealtimeSessionStatus[] = [];
    const controller = new RealtimeSessionController(
      {
        onStatus: (status) => statuses.push(status),
        onPartial: vi.fn(),
        onCommitted: vi.fn(),
        onError: (message) => errors.push(message),
      },
      {
        requestCapability: vi.fn().mockResolvedValue(capability),
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(microphone.stream),
        },
        createAudioContext: () => audio.context,
        createWebSocket: () => socket,
        setTimer: vi.fn(() => 31),
        clearTimer: vi.fn(),
      },
    );

    await controller.start({ displayAudio: false, microphone: true });
    (socket as unknown as { readyState: number; bufferedAmount: number }).readyState = 1;
    (socket as unknown as { bufferedAmount: number }).bufferedAmount = 600_000;
    socket.onopen?.(new Event("open"));
    audio.processor.onaudioprocess?.({
      inputBuffer: {
        getChannelData: () => new Float32Array(48).fill(0.2),
      },
    } as AudioProcessingEvent);

    expect(socket.send).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalledWith(1000, "Переполнение очереди аудио");
    expect(errors.at(-1)).toContain("не накапливать задержку");
    expect(statuses.at(-1)).toBe("closed");
    expect(microphone.stop).toHaveBeenCalled();
    expect(controller.active).toBe(false);
  });

  it("mixes display audio and microphone in one AudioContext", async () => {
    const display = mediaFixture();
    const microphone = mediaFixture();
    const audio = audioFixture();
    const socket = websocketFixture();
    const getDisplayMedia = vi.fn().mockResolvedValue(display.stream);
    const controller = new RealtimeSessionController(
      {
        onStatus: vi.fn(),
        onPartial: vi.fn(),
        onCommitted: vi.fn(),
        onError: vi.fn(),
      },
      {
        requestCapability: vi.fn().mockResolvedValue(capability),
        mediaDevices: {
          getDisplayMedia,
          getUserMedia: vi.fn().mockResolvedValue(microphone.stream),
        },
        createAudioContext: () => audio.context,
        createWebSocket: () => socket,
        setTimer: vi.fn(),
        clearTimer: vi.fn(),
      },
    );

    await controller.start({ displayAudio: true, microphone: true });
    expect(getDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: true,
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
      systemAudio: "include",
      windowAudio: "system",
    });
    expect(audio.context.createMediaStreamDestination).toHaveBeenCalledTimes(1);
    expect(audio.context.createMediaStreamSource).toHaveBeenCalledTimes(3);
    controller.dispose();
    expect(display.stop).toHaveBeenCalled();
    expect(microphone.stop).toHaveBeenCalled();
  });

  it("reports unsupported browser capture before issuing a capability", async () => {
    const requestCapability = vi.fn().mockResolvedValue(capability);
    const errors: string[] = [];
    const statuses: RealtimeSessionStatus[] = [];
    const controller = new RealtimeSessionController(
      {
        onStatus: (status) => statuses.push(status),
        onPartial: vi.fn(),
        onCommitted: vi.fn(),
        onError: (message) => errors.push(message),
      },
      {
        requestCapability,
        mediaDevices: {},
      },
    );

    await controller.start({ displayAudio: true, microphone: false });

    expect(requestCapability).not.toHaveBeenCalled();
    expect(errors.at(-1)).toBe(
      "Этот браузер не поддерживает захват звука вкладки или экрана.",
    );
    expect(statuses.at(-1)).toBe("ready");
    expect(controller.active).toBe(false);
  });
});
