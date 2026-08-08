import {
  downsampleMono,
  floatToPcm16Base64,
  parseRealtimeCapability,
  parseRealtimeEvent,
  realtimeAudioMessage,
  type RealtimeCapability,
} from "./realtimeProtocol";

export type RealtimeSourceOptions = {
  displayAudio: boolean;
  microphone: boolean;
  microphoneDeviceId?: string;
};

export type RealtimeSessionStatus =
  | "ready"
  | "requesting_permission"
  | "connecting"
  | "connected"
  | "transcribing"
  | "stopping"
  | "stopped"
  | "closed";

type RealtimeSessionCallbacks = {
  onStatus: (status: RealtimeSessionStatus) => void;
  onPartial: (text: string) => void;
  onCommitted: (text: string) => void;
  onError: (message: string) => void;
};

type AudioNodeLike = { disconnect: () => void };
type Attempt = {
  id: number;
  cancelled: boolean;
  cleanupDone: boolean;
  userStopRequested: boolean;
  mediaStreams: MediaStream[];
  audioContext: AudioContext | null;
  processor: ScriptProcessorNode | null;
  nodes: AudioNodeLike[];
  websocket: WebSocket | null;
  connectionTimer: number | null;
  closeTimer: number | null;
};

type RealtimeSessionDependencies = {
  requestCapability: () => Promise<unknown>;
  mediaDevices?: Pick<
    MediaDevices,
    "getDisplayMedia" | "getUserMedia"
  >;
  createAudioContext?: () => AudioContext;
  createWebSocket?: (url: string) => WebSocket;
  setTimer?: (callback: () => void, milliseconds: number) => number;
  clearTimer?: (timer: number) => void;
};

const PERMISSION_ERRORS = new Set([
  "NotAllowedError",
  "PermissionDeniedError",
  "AbortError",
]);
const CONNECTION_TIMEOUT_MS = 10_000;
const FINAL_COMMIT_GRACE_MS = 2_000;
const AUDIO_PROCESSOR_BUFFER_SIZE = 8_192;

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function safeDisconnect(node: AudioNodeLike | null) {
  try {
    node?.disconnect();
  } catch {
    // Already disconnected.
  }
}

function knownRealtimeError(code: string) {
  const normalized = code.toLowerCase();
  if (normalized.includes("quota") || normalized.includes("limit")) {
    return "Лимит ElevenLabs исчерпан или временно ограничен.";
  }
  if (normalized.includes("auth") || normalized.includes("token")) {
    return "Одноразовый realtime-доступ отклонён. Запустите новую сессию.";
  }
  if (normalized.includes("audio")) {
    return "ElevenLabs отклонил аудиопоток. Выберите источник и начните заново.";
  }
  return "Realtime-сессия завершилась ошибкой. Начните новую сессию.";
}

export class RealtimeSessionController {
  private generation = 0;
  private current: Attempt | null = null;
  private readonly callbacks: RealtimeSessionCallbacks;
  private readonly deps: Required<RealtimeSessionDependencies>;

  constructor(
    callbacks: RealtimeSessionCallbacks,
    dependencies: RealtimeSessionDependencies,
  ) {
    this.callbacks = callbacks;
    this.deps = {
      requestCapability: dependencies.requestCapability,
      mediaDevices: dependencies.mediaDevices ?? navigator.mediaDevices,
      createAudioContext:
        dependencies.createAudioContext ?? (() => new AudioContext()),
      createWebSocket:
        dependencies.createWebSocket ?? ((url) => new WebSocket(url)),
      setTimer:
        dependencies.setTimer ??
        ((callback, milliseconds) =>
          window.setTimeout(callback, milliseconds)),
      clearTimer:
        dependencies.clearTimer ?? ((timer) => window.clearTimeout(timer)),
    };
  }

  get active() {
    return Boolean(this.current && !this.current.cleanupDone);
  }

  async start(options: RealtimeSourceOptions) {
    if (this.active) return;
    if (!options.displayAudio && !options.microphone) {
      this.callbacks.onError("Выберите хотя бы один источник аудио.");
      return;
    }
    const attempt: Attempt = {
      id: ++this.generation,
      cancelled: false,
      cleanupDone: false,
      userStopRequested: false,
      mediaStreams: [],
      audioContext: null,
      processor: null,
      nodes: [],
      websocket: null,
      connectionTimer: null,
      closeTimer: null,
    };
    this.current = attempt;
    this.callbacks.onError("");
    this.callbacks.onPartial("");
    this.callbacks.onStatus("requesting_permission");
    try {
      const stream = await this.capture(attempt, options);
      this.assertActive(attempt);
      if (!attempt.audioContext) {
        attempt.audioContext = this.deps.createAudioContext();
      }
      await attempt.audioContext.resume();
      this.assertActive(attempt);

      this.callbacks.onStatus("connecting");
      const capability = parseRealtimeCapability(
        await this.deps.requestCapability(),
      );
      this.assertActive(attempt);
      this.connect(attempt, capability, stream);
    } catch (error) {
      this.handleStartFailure(attempt, error);
    }
  }

  stop() {
    const attempt = this.current;
    if (!attempt || attempt.cleanupDone) {
      this.callbacks.onStatus("stopped");
      return;
    }
    attempt.cancelled = true;
    attempt.userStopRequested = true;
    this.callbacks.onPartial("");
    this.callbacks.onStatus("stopping");
    this.releaseMedia(attempt);
    const websocket = attempt.websocket;
    if (websocket?.readyState === WebSocket.OPEN) {
      try {
        websocket.send(realtimeAudioMessage("", true));
      } catch {
        // Closing below is still deterministic.
      }
      attempt.closeTimer = this.deps.setTimer(() => {
        this.closeSocket(attempt);
        this.finish(attempt, "stopped");
      }, FINAL_COMMIT_GRACE_MS);
      return;
    }
    this.closeSocket(attempt);
    this.finish(attempt, "stopped");
  }

  dispose() {
    const attempt = this.current;
    if (!attempt) return;
    attempt.cancelled = true;
    attempt.userStopRequested = true;
    this.closeSocket(attempt);
    this.finish(attempt, "stopped", false);
  }

  private owns(attempt: Attempt) {
    return this.current?.id === attempt.id;
  }

  private assertActive(attempt: Attempt) {
    if (!this.owns(attempt) || attempt.cancelled || attempt.cleanupDone) {
      throw new Error("STALE_REALTIME_ATTEMPT");
    }
  }

  private async capture(
    attempt: Attempt,
    options: RealtimeSourceOptions,
  ) {
    const streams: MediaStream[] = [];
    const register = (stream: MediaStream) => {
      if (!this.owns(attempt) || attempt.cancelled) {
        stopStream(stream);
        throw new Error("STALE_REALTIME_ATTEMPT");
      }
      streams.push(stream);
      attempt.mediaStreams.push(stream);
      stream.getTracks().forEach((track) => {
        track.addEventListener(
          "ended",
          () => {
            if (!this.owns(attempt) || attempt.cancelled) return;
            this.callbacks.onError(
              "Источник аудио остановлен браузером или отключён.",
            );
            this.stop();
          },
          { once: true },
        );
      });
      return stream;
    };
    try {
      if (options.displayAudio) {
        const display = register(
          await this.deps.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          }),
        );
        if (display.getAudioTracks().length === 0) {
          throw new Error(
            "Браузер не передал звук выбранной вкладки или экрана. Включите передачу аудио в окне выбора.",
          );
        }
      }
      if (options.microphone) {
        register(
          await this.deps.mediaDevices.getUserMedia({
            audio: options.microphoneDeviceId
              ? { deviceId: { exact: options.microphoneDeviceId } }
              : true,
          }),
        );
      }
      this.assertActive(attempt);
      if (streams.length === 1) return streams[0];

      const context = this.deps.createAudioContext();
      attempt.audioContext = context;
      const destination = context.createMediaStreamDestination();
      attempt.nodes.push(destination);
      for (const stream of streams) {
        const source = context.createMediaStreamSource(stream);
        source.connect(destination);
        attempt.nodes.push(source);
      }
      return destination.stream;
    } catch (error) {
      streams.forEach(stopStream);
      throw error;
    }
  }

  private connect(
    attempt: Attempt,
    capability: RealtimeCapability,
    stream: MediaStream,
  ) {
    this.assertActive(attempt);
    const context = attempt.audioContext;
    if (!context) throw new Error("AudioContext не подготовлен.");
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(
      AUDIO_PROCESSOR_BUFFER_SIZE,
      1,
      1,
    );
    const silentOutput = context.createGain();
    silentOutput.gain.value = 0;
    source.connect(processor);
    processor.connect(silentOutput);
    silentOutput.connect(context.destination);
    attempt.nodes.push(source, silentOutput);
    attempt.processor = processor;
    processor.onaudioprocess = (event) => {
      if (!this.owns(attempt) || attempt.cancelled) return;
      const websocket = attempt.websocket;
      if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
      const mono = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleMono(mono, context.sampleRate);
      websocket.send(realtimeAudioMessage(floatToPcm16Base64(downsampled)));
    };

    const websocket = this.deps.createWebSocket(capability.websocket_url);
    attempt.websocket = websocket;
    attempt.connectionTimer = this.deps.setTimer(() => {
      attempt.connectionTimer = null;
      if (
        !this.owns(attempt) ||
        attempt.cleanupDone ||
        websocket.readyState !== WebSocket.CONNECTING
      ) {
        return;
      }
      this.callbacks.onError(
        "ElevenLabs не установил realtime-соединение за 10 секунд. Начните новую сессию.",
      );
      this.closeSocket(attempt, "Тайм-аут подключения");
      this.finish(attempt, "closed");
    }, CONNECTION_TIMEOUT_MS);
    websocket.onopen = () => {
      if (!this.owns(attempt) || attempt.cancelled) return;
      this.clearConnectionTimer(attempt);
      this.callbacks.onStatus("connected");
    };
    websocket.onmessage = (message) => {
      if (!this.owns(attempt) || attempt.cleanupDone) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(message.data));
      } catch {
        return;
      }
      const event = parseRealtimeEvent(parsed);
      if (event.kind === "session_started") {
        this.callbacks.onStatus("transcribing");
      } else if (event.kind === "partial") {
        this.callbacks.onPartial(event.text);
      } else if (event.kind === "committed") {
        this.callbacks.onPartial("");
        this.callbacks.onCommitted(event.text);
      } else if (event.kind === "error") {
        if (attempt.userStopRequested) return;
        this.callbacks.onError(knownRealtimeError(event.code));
        this.closeSocket(attempt, "Ошибка провайдера");
        this.finish(attempt, "closed");
      }
    };
    websocket.onerror = () => {
      if (!this.owns(attempt) || attempt.userStopRequested) return;
      this.callbacks.onError(
        "Соединение realtime прервалось. Новая попытка получит новый одноразовый доступ.",
      );
      this.closeSocket(attempt, "Ошибка соединения");
      this.finish(attempt, "closed");
    };
    websocket.onclose = () => {
      if (!this.owns(attempt)) return;
      const status = attempt.userStopRequested ? "stopped" : "closed";
      if (!attempt.userStopRequested) {
        this.callbacks.onError(
          "Realtime-соединение закрыто. Автоподключение отключено: нажмите «Начать» для новой безопасной сессии.",
        );
      }
      this.finish(attempt, status);
    };
  }

  private handleStartFailure(attempt: Attempt, error: unknown) {
    if (!this.owns(attempt)) {
      this.releaseMedia(attempt);
      return;
    }
    const stale = error instanceof Error && error.message === "STALE_REALTIME_ATTEMPT";
    if (!stale) {
      const errorName = error instanceof DOMException ? error.name : "";
      this.callbacks.onError(
        PERMISSION_ERRORS.has(errorName)
          ? "Разрешение на захват аудио отменено или отклонено. Выберите источник и начните снова."
          : error instanceof Error
            ? error.message
            : "Не удалось запустить realtime-сессию.",
      );
    }
    this.finish(attempt, attempt.userStopRequested ? "stopped" : "ready");
  }

  private releaseMedia(attempt: Attempt) {
    if (attempt.processor) {
      attempt.processor.onaudioprocess = null;
      safeDisconnect(attempt.processor);
      attempt.processor = null;
    }
    attempt.nodes.forEach(safeDisconnect);
    attempt.nodes = [];
    attempt.mediaStreams.forEach(stopStream);
    attempt.mediaStreams = [];
    const context = attempt.audioContext;
    attempt.audioContext = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private closeSocket(attempt: Attempt, reason = "Остановлено пользователем") {
    this.clearConnectionTimer(attempt);
    if (attempt.closeTimer !== null) {
      this.deps.clearTimer(attempt.closeTimer);
      attempt.closeTimer = null;
    }
    const websocket = attempt.websocket;
    attempt.websocket = null;
    if (
      websocket &&
      (websocket.readyState === WebSocket.OPEN ||
        websocket.readyState === WebSocket.CONNECTING)
    ) {
      try {
        websocket.close(1000, reason);
      } catch {
        // Browser is already closing it.
      }
    }
  }

  private clearConnectionTimer(attempt: Attempt) {
    if (attempt.connectionTimer === null) return;
    this.deps.clearTimer(attempt.connectionTimer);
    attempt.connectionTimer = null;
  }

  private finish(
    attempt: Attempt,
    status: RealtimeSessionStatus,
    reportStatus = true,
  ) {
    if (attempt.cleanupDone) return;
    attempt.cleanupDone = true;
    this.releaseMedia(attempt);
    this.closeSocket(attempt);
    if (this.owns(attempt)) {
      this.current = null;
      if (reportStatus) this.callbacks.onStatus(status);
    }
  }
}
