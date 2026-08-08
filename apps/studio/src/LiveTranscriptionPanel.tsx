import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, mutateWithCsrfRetry } from "./apiClient";
import {
  RealtimeSessionController,
  type RealtimeSessionStatus,
} from "./realtimeSession";

type Credential = {
  id: string;
  provider: "elevenlabs" | "openai";
  label: string;
  status: string;
  active_version?: number;
};

type Props = {
  projectId: string;
  csrf: string;
  onCsrf: (csrf: string) => void;
};

const STATUS_LABELS: Record<RealtimeSessionStatus, string> = {
  ready: "Готово к запуску",
  requesting_permission: "Ожидаем разрешение браузера",
  connecting: "Подключаемся к ElevenLabs",
  connected: "Соединение установлено",
  transcribing: "Распознаём речь",
  stopping: "Завершаем сессию",
  stopped: "Остановлено",
  closed: "Соединение закрыто",
};

const FAILURE_MESSAGES: Record<string, string> = {
  provider_authentication_rejected:
    "ElevenLabs отклонил основной ключ. Обновите профиль в настройках.",
  provider_request_rejected:
    "ElevenLabs отклонил запрос одноразового доступа.",
  provider_rate_limited:
    "ElevenLabs временно ограничил новые realtime-сессии. Повторите позже.",
  provider_timeout: "ElevenLabs не ответил вовремя. Повторите запуск.",
  provider_unavailable: "ElevenLabs временно недоступен. Повторите запуск.",
  malformed_provider_response:
    "ElevenLabs вернул некорректный одноразовый доступ.",
};

function capabilityFailureMessage(error: unknown) {
  if (!(error instanceof ApiError) || !error.data) {
    return error instanceof Error
      ? error.message
      : "Не удалось подготовить realtime-сессию.";
  }
  const data = error.data as { detail?: { reason?: unknown } };
  const reason = data.detail?.reason;
  return typeof reason === "string" && FAILURE_MESSAGES[reason]
    ? FAILURE_MESSAGES[reason]
    : error.message;
}

function credentialLabel(credential: Credential) {
  return credential.active_version
    ? `${credential.label} · v${credential.active_version}`
    : credential.label;
}

function formatElapsed(totalSeconds: number) {
  const bounded = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(bounded / 3600);
  const minutes = Math.floor((bounded % 3600) / 60);
  const seconds = bounded % 60;
  const minuteSecond = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${minuteSecond}`
    : minuteSecond;
}

function transcriptFilename(now = new Date()) {
  const timestamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[:T]/g, "-");
  return `studio-live-transcript-${timestamp}.txt`;
}

export function LiveTranscriptionPanel({ projectId, csrf, onCsrf }: Props) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialId, setCredentialId] = useState("");
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [displayAudio, setDisplayAudio] = useState(false);
  const [microphone, setMicrophone] = useState(() =>
    Boolean(navigator.mediaDevices?.getUserMedia),
  );
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [language, setLanguage] = useState("ru");
  const [status, setStatus] = useState<RealtimeSessionStatus>("ready");
  const [partial, setPartial] = useState("");
  const [segments, setSegments] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const [inputLevel, setInputLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [followTranscript, setFollowTranscript] = useState(true);
  const controllerRef = useRef<RealtimeSessionController | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const committedRef = useRef<HTMLDivElement | null>(null);
  const microphoneSupported = Boolean(
    navigator.mediaDevices?.getUserMedia,
  );
  const displayAudioSupported = Boolean(
    navigator.mediaDevices?.getDisplayMedia,
  );

  const running = [
    "requesting_permission",
    "connecting",
    "connected",
    "transcribing",
    "stopping",
  ].includes(status);
  const transcript = useMemo(() => segments.join("\n"), [segments]);

  useEffect(() => {
    const startedAt = sessionStartedAtRef.current;
    if (!running || startedAt === null) return;
    const updateElapsed = () =>
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [running, status]);

  useEffect(() => {
    const committed = committedRef.current;
    if (!committed || !followTranscript) return;
    committed.scrollTop = committed.scrollHeight;
  }, [segments, followTranscript]);

  useEffect(() => {
    let current = true;
    setCredentialsLoading(true);
    api<{ credentials: Credential[] }>("/credentials")
      .then((response) => {
        if (!current) return;
        const active = response.credentials.filter(
          (credential) =>
            credential.provider === "elevenlabs" &&
            credential.status === "active",
        );
        setCredentials(active);
        setCredentialId((selected) =>
          active.some((credential) => credential.id === selected)
            ? selected
            : (active[0]?.id ?? ""),
        );
      })
      .catch(() => {
        if (current) setError("Не удалось загрузить профили ElevenLabs.");
      })
      .finally(() => {
        if (current) setCredentialsLoading(false);
      });
    return () => {
      current = false;
    };
  }, [projectId]);

  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const available = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = available.filter(
        (device) => device.kind === "audioinput",
      );
      setDevices(audioInputs);
      setMicrophoneDeviceId((selected) =>
        selected && !audioInputs.some((device) => device.deviceId === selected)
          ? ""
          : selected,
      );
    } catch {
      setError(
        "Браузер пока не показывает аудиоустройства. После первого разрешения список обновится.",
      );
    }
  }

  useEffect(() => {
    void refreshDevices();
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    const handler = () => void refreshDevices();
    mediaDevices.addEventListener("devicechange", handler);
    return () => mediaDevices.removeEventListener("devicechange", handler);
  }, []);

  useEffect(() => {
    const dispose = () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
    window.addEventListener("pagehide", dispose);
    return () => {
      window.removeEventListener("pagehide", dispose);
      dispose();
    };
  }, [projectId]);

  async function start() {
    if (running) return;
    setError("");
    setExportNotice("");
    sessionStartedAtRef.current = null;
    setElapsedSeconds(0);
    setFollowTranscript(true);
    const controller = new RealtimeSessionController(
      {
        onStatus: (nextStatus) => {
          if (
            (nextStatus === "connected" || nextStatus === "transcribing") &&
            sessionStartedAtRef.current === null
          ) {
            sessionStartedAtRef.current = Date.now();
            setElapsedSeconds(0);
          }
          if (
            (nextStatus === "stopped" || nextStatus === "closed") &&
            sessionStartedAtRef.current !== null
          ) {
            setElapsedSeconds(
              Math.floor(
                (Date.now() - sessionStartedAtRef.current) / 1000,
              ),
            );
          }
          setStatus(nextStatus);
          if (nextStatus === "connected" && microphone) {
            void refreshDevices();
          }
        },
        onPartial: setPartial,
        onCommitted: (text) =>
          setSegments((current) => [...current, text]),
        onError: setError,
        onInputLevel: setInputLevel,
      },
      {
        requestCapability: async (signal) => {
          try {
            return await mutateWithCsrfRetry(
              `/projects/${projectId}/realtime/capability`,
              csrf,
              onCsrf,
              {
                method: "POST",
                signal,
                body: JSON.stringify({
                  provider_credential_id: credentialId || null,
                  language,
                }),
              },
            );
          } catch (capabilityError) {
            throw new Error(capabilityFailureMessage(capabilityError), {
              cause: capabilityError,
            });
          }
        },
      },
    );
    controllerRef.current?.dispose();
    controllerRef.current = controller;
    await controller.start({
      displayAudio,
      microphone,
      microphoneDeviceId: microphoneDeviceId || undefined,
    });
  }

  function stop() {
    controllerRef.current?.stop();
  }

  async function copyTranscript() {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setExportNotice("Текст скопирован в буфер обмена.");
    } catch {
      setExportNotice("");
      setError("Браузер не разрешил копирование. Используйте скачивание.");
    }
  }

  function downloadTranscript() {
    if (!transcript) return;
    const url = URL.createObjectURL(
      new Blob([transcript], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = transcriptFilename();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExportNotice("Текст сохранён в файл .txt.");
  }

  function clearTranscript() {
    if (!transcript || running) return;
    if (
      !window.confirm(
        "Очистить подтверждённый текст только в этой вкладке браузера?",
      )
    )
      return;
    setSegments([]);
    setPartial("");
    setExportNotice("");
  }

  const sourceReady =
    (displayAudio && displayAudioSupported) ||
    (microphone && microphoneSupported);
  const inputPercent = Math.round(inputLevel * 100);
  const inputSignalLabel = running
    ? inputPercent >= 2
      ? "Сигнал есть"
      : "Тишина или очень тихий сигнал"
    : "Измерение начнётся после запуска";
  return (
    <section
      className="live-transcription"
      aria-label="Live-транскрибация"
    >
      <header className="live-intro">
        <div>
          <h3>Live-транскрибация</h3>
          <p>
            Распознаёт микрофон, звук выбранной вкладки или экрана либо оба
            источника одновременно. Подтверждённый текст остаётся только в
            текущей вкладке браузера.
          </p>
        </div>
        <span className={`live-status live-status-${status}`} role="status">
          {STATUS_LABELS[status]}
        </span>
      </header>

      <div className="live-config-grid">
        <section className="live-config-card">
          <h4>Источники звука</h4>
          <label className="check-row">
            <input
              type="checkbox"
              aria-label="Звук вкладки или экрана"
              checked={displayAudio}
              disabled={running || !displayAudioSupported}
              onChange={(event) => setDisplayAudio(event.target.checked)}
            />
            <span>
              <b>Звук вкладки или экрана</b>
              <small>
                {displayAudioSupported
                  ? "В окне Chrome выберите источник и включите передачу аудио."
                  : "Этот браузер не поддерживает захват звука вкладки или экрана."}
              </small>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              aria-label="Микрофон или аудиовход"
              checked={microphone}
              disabled={running || !microphoneSupported}
              onChange={(event) => setMicrophone(event.target.checked)}
            />
            <span>
              <b>Микрофон или аудиовход</b>
              <small>
                {microphoneSupported
                  ? "Можно смешать с системным звуком."
                  : "Этот браузер не поддерживает захват микрофона."}
              </small>
            </span>
          </label>
          {microphone && (
            <label>
              Устройство ввода
              <select
                value={microphoneDeviceId}
                disabled={running}
                onChange={(event) =>
                  setMicrophoneDeviceId(event.target.value)
                }
              >
                <option value="">По умолчанию</option>
                {devices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Аудиовход ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!sourceReady && (
            <p className="error">Выберите хотя бы один источник аудио.</p>
          )}
          <div className="live-input-level">
            <div className="split">
              <b>Входной сигнал</b>
              <span>{inputSignalLabel} · {inputPercent}%</span>
            </div>
            <meter
              aria-label="Уровень входного аудио"
              min="0"
              max="100"
              value={inputPercent}
            />
            <small>
              Рассчитывается только в браузере и не сохраняется.
            </small>
          </div>
        </section>

        <section className="live-config-card">
          <h4>Распознавание</h4>
          <label>
            Профиль ElevenLabs
            <select
              value={credentialId}
              disabled={running || credentialsLoading}
              onChange={(event) => setCredentialId(event.target.value)}
            >
              {credentials.length === 0 && (
                <option value="">Активный профиль не найден</option>
              )}
              {credentials.map((credential) => (
                <option key={credential.id} value={credential.id}>
                  {credentialLabel(credential)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Язык
            <select
              value={language}
              disabled={running}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="ru">Русский</option>
              <option value="detect">Определить автоматически</option>
            </select>
          </label>
          <p className="muted">
            Модель: scribe_v2_realtime · фиксация фрагментов: VAD.
          </p>
          <div className="actions">
            <button
              className="primary"
              type="button"
              disabled={running || !sourceReady || !credentialId}
              onClick={() => void start()}
            >
              Начать
            </button>
            <button type="button" disabled={!running} onClick={stop}>
              Остановить
            </button>
          </div>
        </section>
      </div>

      {displayAudio && microphone && !running && (
        <p className="notice">
          При смешивании микрофон может повторно захватить звук динамиков.
          Наушники уменьшают эхо.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {exportNotice && (
        <p className="notice" role="status">
          {exportNotice}
        </p>
      )}

      <section className="live-transcript-card">
        <header className="split">
          <div>
            <h4>Текст текущей вкладки</h4>
            <p className="muted">
              Не сохраняется в Studio, Google Docs, каталог или аналитику.
            </p>
            <p className="muted" aria-label="Статистика live-сессии">
              Сессия: {formatElapsed(elapsedSeconds)} · Фрагментов:{" "}
              {segments.length} · Символов: {transcript.length}
            </p>
          </div>
          <div className="actions">
            <button
              type="button"
              aria-pressed={followTranscript}
              onClick={() => setFollowTranscript((current) => !current)}
            >
              Автопрокрутка: {followTranscript ? "вкл" : "выкл"}
            </button>
            <button
              type="button"
              disabled={!transcript}
              onClick={() => void copyTranscript()}
            >
              Копировать
            </button>
            <button
              type="button"
              disabled={!transcript}
              onClick={downloadTranscript}
            >
              Скачать .txt
            </button>
            <button
              type="button"
              disabled={!transcript || running}
              onClick={clearTranscript}
            >
              Очистить
            </button>
          </div>
        </header>
        <div className="live-partial" aria-live="polite">
          <span>Предварительно</span>
          <p>{partial || "Речь появится здесь до подтверждения фрагмента."}</p>
        </div>
        <div
          ref={committedRef}
          className="live-committed"
          aria-label="Подтверждённая транскрипция"
          aria-live="polite"
          onScroll={(event) => {
            const target = event.currentTarget;
            const distanceFromBottom =
              target.scrollHeight - target.scrollTop - target.clientHeight;
            setFollowTranscript(distanceFromBottom <= 32);
          }}
        >
          {segments.length === 0 ? (
            <p className="muted">
              Подтверждённых фрагментов пока нет.
            </p>
          ) : (
            segments.map((segment, index) => (
              <p key={`${index}-${segment.slice(0, 24)}`}>{segment}</p>
            ))
          )}
        </div>
      </section>

      <details className="live-boundaries">
        <summary>Ограничения первой версии</summary>
        <ul>
          <li>
            При разрыве связи автоматического reconnect нет: новая попытка
            получает новый одноразовый доступ.
          </li>
          <li>Обновление или закрытие вкладки останавливает захват.</li>
          <li>
            Другие вкладки браузера не получают этот текст и не продолжают
            текущую сессию.
          </li>
        </ul>
      </details>
    </section>
  );
}
