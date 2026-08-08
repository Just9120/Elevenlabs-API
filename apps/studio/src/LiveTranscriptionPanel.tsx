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

export function LiveTranscriptionPanel({ projectId, csrf, onCsrf }: Props) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialId, setCredentialId] = useState("");
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [displayAudio, setDisplayAudio] = useState(false);
  const [microphone, setMicrophone] = useState(true);
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [language, setLanguage] = useState("ru");
  const [status, setStatus] = useState<RealtimeSessionStatus>("ready");
  const [partial, setPartial] = useState("");
  const [segments, setSegments] = useState<string[]>([]);
  const [error, setError] = useState("");
  const controllerRef = useRef<RealtimeSessionController | null>(null);

  const running = [
    "requesting_permission",
    "connecting",
    "connected",
    "transcribing",
    "stopping",
  ].includes(status);
  const transcript = useMemo(() => segments.join("\n"), [segments]);

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
      setDevices(available.filter((device) => device.kind === "audioinput"));
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

  useEffect(
    () => () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    },
    [projectId],
  );

  async function start() {
    if (running) return;
    setError("");
    const controller = new RealtimeSessionController(
      {
        onStatus: setStatus,
        onPartial: setPartial,
        onCommitted: (text) =>
          setSegments((current) => [...current, text]),
        onError: setError,
      },
      {
        requestCapability: async () => {
          try {
            return await mutateWithCsrfRetry(
              `/projects/${projectId}/realtime/capability`,
              csrf,
              onCsrf,
              {
                method: "POST",
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
    if (microphone) void refreshDevices();
  }

  function stop() {
    controllerRef.current?.stop();
  }

  async function copyTranscript() {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
    } catch {
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
    link.download = "studio-live-transcript.txt";
    link.click();
    URL.revokeObjectURL(url);
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
  }

  const sourceReady = displayAudio || microphone;
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
              disabled={running}
              onChange={(event) => setDisplayAudio(event.target.checked)}
            />
            <span>
              <b>Звук вкладки или экрана</b>
              <small>
                В окне Chrome выберите источник и включите передачу аудио.
              </small>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              aria-label="Микрофон или аудиовход"
              checked={microphone}
              disabled={running}
              onChange={(event) => setMicrophone(event.target.checked)}
            />
            <span>
              <b>Микрофон или аудиовход</b>
              <small>Можно смешать с системным звуком.</small>
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

      <section className="live-transcript-card">
        <header className="split">
          <div>
            <h4>Текст текущей вкладки</h4>
            <p className="muted">
              Не сохраняется в Studio, Google Docs, каталог или аналитику.
            </p>
          </div>
          <div className="actions">
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
        <div className="live-committed" aria-live="polite">
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
