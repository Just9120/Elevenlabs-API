import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RealtimeSessionController,
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
    const timerCallbacks: Array<() => void> = [];
    const timerDelays: number[] = [];
    const controller = new RealtimeSessionController(
      {
        onStatus: (status) => statuses.push(status),
        onPartial: (text) => partials.push(text),
        onCommitted: (text) => committed.push(text),
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
          message_type: "committed_transcript",
          text: "готовый фрагмент",
        }),
      }),
    );
    expect(statuses.at(-1)).toBe("transcribing");
    expect(partials).toEqual(["", "черновик", ""]);
    expect(committed).toEqual(["готовый фрагмент"]);
    expect(errors).toEqual([""]);

    audio.processor.onaudioprocess?.({
      inputBuffer: {
        getChannelData: () => new Float32Array(48).fill(0.25),
      },
    } as AudioProcessingEvent);
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(socket.send).mock.calls[0][0]))).toMatchObject({
      message_type: "input_audio_chunk",
      sample_rate: 16_000,
    });

    controller.stop();
    expect(timerDelays).toEqual([10_000, 2_000]);
    expect(microphone.stop).toHaveBeenCalled();
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
          expect(milliseconds).toBe(10_000);
          connectTimeout = callback;
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

  it("mixes display audio and microphone in one AudioContext", async () => {
    const display = mediaFixture();
    const microphone = mediaFixture();
    const audio = audioFixture();
    const socket = websocketFixture();
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
          getDisplayMedia: vi.fn().mockResolvedValue(display.stream),
          getUserMedia: vi.fn().mockResolvedValue(microphone.stream),
        },
        createAudioContext: () => audio.context,
        createWebSocket: () => socket,
        setTimer: vi.fn(),
        clearTimer: vi.fn(),
      },
    );

    await controller.start({ displayAudio: true, microphone: true });
    expect(audio.context.createMediaStreamDestination).toHaveBeenCalledTimes(1);
    expect(audio.context.createMediaStreamSource).toHaveBeenCalledTimes(3);
    controller.dispose();
    expect(display.stop).toHaveBeenCalled();
    expect(microphone.stop).toHaveBeenCalled();
  });
});
