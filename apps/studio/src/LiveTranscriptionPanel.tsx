import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, mutateWithCsrfRetry } from "./apiClient";
import {
  requestCredentialCollection,
  type Credential,
} from "./credentialContracts";
import {
  cancelLatestRequests,
  settleLatestRequest,
} from "./latestRequest";
import {
  RealtimeSessionController,
  type RealtimeSessionStatus,
} from "./realtimeSession";
import type { TranscriptionLanguageMode } from "./jobModel";
import {
  REALTIME_PARTIAL_CHECKPOINT_DEBOUNCE_MS,
  deleteLocalRealtimeDraft,
  loadLocalRealtimeDraft,
  makeRealtimeDraft,
  newestRealtimeDraft,
  newRealtimeClientSessionId,
  parseLatestRealtimeDraftResponse,
  realtimeDraftDownloadText,
  saveLocalRealtimeDraft,
  type RealtimeDraft,
} from "./realtimeDrafts";

type Props = {
  ownerUserId: string;
  projectId: string;
  csrf: string;
  onCsrf: (csrf: string) => void;
  active: boolean;
  initialSegments?: string[];
  onSegmentsChange?: (segments: string[]) => void;
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

const CREDENTIAL_REQUEST_TIMEOUT_MS = 15_000;

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

export function LiveTranscriptionPanel({
  ownerUserId,
  projectId,
  csrf,
  onCsrf,
  active,
  initialSegments = [],
  onSegmentsChange,
}: Props) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialId, setCredentialId] = useState("");
  const [credentialsState, setCredentialsState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [credentialsMessage, setCredentialsMessage] = useState("");
  const [displayAudio, setDisplayAudio] = useState(() =>
    Boolean(navigator.mediaDevices?.getDisplayMedia),
  );
  const [microphone, setMicrophone] = useState(() =>
    !navigator.mediaDevices?.getDisplayMedia &&
    Boolean(navigator.mediaDevices?.getUserMedia),
  );
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [language, setLanguage] =
    useState<TranscriptionLanguageMode>("ru");
  const [status, setStatus] = useState<RealtimeSessionStatus>("ready");
  const [partial, setPartial] = useState("");
  const [segments, setSegments] = useState<string[]>(() => [
    ...initialSegments,
  ]);
  const [error, setError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const [inputLevel, setInputLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [followTranscript, setFollowTranscript] = useState(true);
  const [recoveryCandidate, setRecoveryCandidate] =
    useState<RealtimeDraft | null>(null);
  const [recoveryState, setRecoveryState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [draftStatus, setDraftStatus] = useState<
    "idle" | "saving" | "saved" | "degraded"
  >("idle");
  const controllerRef = useRef<RealtimeSessionController | null>(null);
  const credentialRequestEpochsRef = useRef(new Map<string, number>());
  const credentialRequestControllersRef = useRef(
    new Map<string, AbortController>(),
  );
  const sessionStartedAtRef = useRef<number | null>(null);
  const committedRef = useRef<HTMLDivElement | null>(null);
  const segmentsRef = useRef([...initialSegments]);
  const partialRef = useRef("");
  const draftRef = useRef<RealtimeDraft | null>(null);
  const serverSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const partialCheckpointTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const csrfRef = useRef(csrf);
  const onCsrfRef = useRef(onCsrf);
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
  csrfRef.current = csrf;
  onCsrfRef.current = onCsrf;

  function checkpointDraft(
    committedSegments: string[],
    latestPartial: string,
  ) {
    if (committedSegments.length === 0 && !latestPartial) return;
    const nextRevision = (draftRef.current?.revision ?? 0) + 1;
    let nextDraft: RealtimeDraft;
    try {
      nextDraft = makeRealtimeDraft({
        ownerUserId,
        projectId,
        clientSessionId:
          draftRef.current?.client_session_id ?? newRealtimeClientSessionId(),
        revision: nextRevision,
        committedSegments,
        partial: latestPartial,
      });
    } catch {
      setDraftStatus("degraded");
      setError(
        "Live-текст превысил безопасный размер временного черновика. Скачайте текущий текст.",
      );
      return;
    }
    draftRef.current = nextDraft;
    setDraftStatus("saving");
    const localWrite = saveLocalRealtimeDraft(nextDraft)
      .then(() => true)
      .catch(() => false);
    serverSaveQueueRef.current = serverSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const localSaved = await localWrite;
        let serverSaved = false;
        try {
          const response = await mutateWithCsrfRetry<unknown>(
            `/projects/${projectId}/realtime/drafts/${encodeURIComponent(nextDraft.client_session_id)}`,
            csrfRef.current,
            onCsrfRef.current,
            {
              method: "PUT",
              body: JSON.stringify({
                revision: nextDraft.revision,
                committed_segments: nextDraft.committed_segments,
                partial: nextDraft.partial,
              }),
            },
          );
          const metadata =
            response && typeof response === "object"
              ? (response as { draft?: unknown }).draft
              : null;
          serverSaved = Boolean(
            metadata &&
              typeof metadata === "object" &&
              (metadata as { client_session_id?: unknown }).client_session_id ===
                nextDraft.client_session_id &&
              (metadata as { revision?: unknown }).revision ===
                nextDraft.revision,
          );
        } catch {
          serverSaved = false;
        }
        if (!mountedRef.current || draftRef.current?.revision !== nextDraft.revision) {
          return;
        }
        setDraftStatus(localSaved && serverSaved ? "saved" : "degraded");
      });
  }

  function schedulePartialCheckpoint(nextPartial: string) {
    if (partialCheckpointTimerRef.current !== null) {
      window.clearTimeout(partialCheckpointTimerRef.current);
    }
    partialCheckpointTimerRef.current = window.setTimeout(() => {
      partialCheckpointTimerRef.current = null;
      checkpointDraft(segmentsRef.current, nextPartial);
    }, REALTIME_PARTIAL_CHECKPOINT_DEBOUNCE_MS);
  }

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    setRecoveryState("loading");
    setRecoveryCandidate(null);
    void Promise.all([
      loadLocalRealtimeDraft(ownerUserId, projectId).catch(() => null),
      api<unknown>(`/projects/${projectId}/realtime/drafts/latest`)
        .then((candidate) => {
          const parsed = parseLatestRealtimeDraftResponse(
            candidate,
            ownerUserId,
            projectId,
          );
          if (parsed === undefined) throw new Error("invalid_realtime_draft_response");
          return parsed;
        })
        .catch(() => undefined),
    ]).then(([localDraft, serverDraft]) => {
      if (cancelled) return;
      if (serverDraft === undefined) {
        setRecoveryState("error");
      } else {
        setRecoveryState("ready");
      }
      const candidate = newestRealtimeDraft(localDraft, serverDraft ?? null);
      if (
        candidate &&
        (candidate.committed_segments.length > 0 || candidate.partial)
      ) {
        setRecoveryCandidate(candidate);
      }
    });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (partialCheckpointTimerRef.current !== null) {
        window.clearTimeout(partialCheckpointTimerRef.current);
        partialCheckpointTimerRef.current = null;
      }
    };
  }, [ownerUserId, projectId]);

  useEffect(() => {
    const flushDraft = () => {
      if (
        partialRef.current &&
        draftRef.current?.partial !== partialRef.current
      ) {
        checkpointDraft(segmentsRef.current, partialRef.current);
      }
    };
    window.addEventListener("pagehide", flushDraft);
    return () => window.removeEventListener("pagehide", flushDraft);
  }, [ownerUserId, projectId]);

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

  const loadCredentials = async () => {
    setCredentialsState("loading");
    setCredentialsMessage("");
    await settleLatestRequest(
      credentialRequestEpochsRef.current,
      "live:credentials",
      requestCredentialCollection,
      (credentialCollection) => {
        const activeCredentials = credentialCollection.filter(
          (credential) =>
            credential.provider === "elevenlabs" &&
            credential.status === "active",
        );
        setCredentials(activeCredentials);
        setCredentialId((selected) =>
          activeCredentials.some((credential) => credential.id === selected)
            ? selected
            : (activeCredentials[0]?.id ?? ""),
        );
        setCredentialsState("ready");
        setCredentialsMessage("");
      },
      () => {
        setCredentials([]);
        setCredentialId("");
        setCredentialsState("error");
        setCredentialsMessage(
          "Не удалось загрузить профили ElevenLabs. Повторите попытку.",
        );
      },
      {
        controllers: credentialRequestControllersRef.current,
        timeoutMs: CREDENTIAL_REQUEST_TIMEOUT_MS,
      },
    );
  };

  useEffect(() => {
    void loadCredentials();
    return () => {
      cancelLatestRequests(
        credentialRequestEpochsRef.current,
        credentialRequestControllersRef.current,
      );
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

  useEffect(() => {
    const controller = controllerRef.current;
    if (active || !controller?.active) return;
    controller.stop();
    setExportNotice(
      "Live-сессия остановлена при переходе в пакетный режим. Текст сохранён в этой вкладке.",
    );
  }, [active]);

  useEffect(() => {
    if (!running && !transcript) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [running, transcript]);

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
        onPartial: (text) => {
          partialRef.current = text;
          setPartial(text);
          schedulePartialCheckpoint(text);
        },
        onCommitted: (text) => {
          if (partialCheckpointTimerRef.current !== null) {
            window.clearTimeout(partialCheckpointTimerRef.current);
            partialCheckpointTimerRef.current = null;
          }
          const next = [...segmentsRef.current, text];
          segmentsRef.current = next;
          partialRef.current = "";
          checkpointDraft(next, "");
          setPartial("");
          setSegments(next);
          onSegmentsChange?.(next);
        },
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

  function downloadTextFile(text: string) {
    if (!text) return;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = transcriptFilename();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExportNotice("Текст сохранён в файл .txt.");
  }

  function downloadTranscript() {
    downloadTextFile(transcript);
  }

  async function deleteDraft(draft: RealtimeDraft) {
    setDraftStatus("saving");
    await deleteLocalRealtimeDraft(ownerUserId, projectId).catch(() => undefined);
    try {
      const response = await mutateWithCsrfRetry<unknown>(
        `/projects/${projectId}/realtime/drafts/${encodeURIComponent(draft.client_session_id)}`,
        csrfRef.current,
        onCsrfRef.current,
        { method: "DELETE" },
      );
      if (
        !response ||
        typeof response !== "object" ||
        (response as { ok?: unknown }).ok !== true
      ) {
        throw new Error("invalid_realtime_draft_delete_response");
      }
      if (draftRef.current?.client_session_id === draft.client_session_id) {
        draftRef.current = null;
      }
      setDraftStatus("idle");
      return true;
    } catch {
      setDraftStatus("degraded");
      setError(
        "Локальная копия черновика удалена, но Studio API не подтвердил удаление серверной копии. Повторите действие.",
      );
      return false;
    }
  }

  function restoreRecoveryDraft() {
    const candidate = recoveryCandidate;
    if (!candidate) return;
    draftRef.current = candidate;
    segmentsRef.current = [...candidate.committed_segments];
    partialRef.current = candidate.partial;
    setSegments([...candidate.committed_segments]);
    setPartial(candidate.partial);
    onSegmentsChange?.([...candidate.committed_segments]);
    setRecoveryCandidate(null);
    setDraftStatus("saved");
    void saveLocalRealtimeDraft(candidate).catch(() =>
      setDraftStatus("degraded"),
    );
    setExportNotice("Незавершённый Live-черновик восстановлен.");
  }

  async function discardRecoveryDraft() {
    const candidate = recoveryCandidate;
    if (!candidate) return;
    setError("");
    if (await deleteDraft(candidate)) {
      setRecoveryCandidate(null);
      setExportNotice("Временный Live-черновик удалён.");
    }
  }

  async function clearTranscript() {
    if (!transcript || running) return;
    if (
      !window.confirm(
        "Очистить подтверждённый текст и удалить временный Live-черновик?",
      )
    )
      return;
    const currentDraft = draftRef.current;
    if (currentDraft) await deleteDraft(currentDraft);
    segmentsRef.current = [];
    partialRef.current = "";
    setSegments([]);
    onSegmentsChange?.([]);
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
            источника одновременно. Текст временно checkpoint-ится в браузере
            и в зашифрованном Studio storage на 72 часа; audio не сохраняется.
          </p>
        </div>
        <span className={`live-status live-status-${status}`} role="status">
          {STATUS_LABELS[status]}
        </span>
      </header>

      {recoveryState === "loading" && (
        <p className="muted" role="status">
          Проверяем незавершённые Live-черновики…
        </p>
      )}
      {recoveryState === "error" && (
        <p className="error" role="alert">
          Server recovery сейчас недоступен. Локальный черновик, если он есть,
          всё равно можно восстановить ниже.
        </p>
      )}
      {recoveryCandidate && (
        <section className="notice live-recovery" aria-label="Восстановление Live-черновика">
          <div>
            <h4>Найден незавершённый Live-черновик</h4>
            <p>
              Обновлён {new Date(recoveryCandidate.updated_at).toLocaleString("ru-RU")}
              {" · "}подтверждённых фрагментов: {recoveryCandidate.committed_segments.length}
              {recoveryCandidate.partial ? " · есть неподтверждённый фрагмент" : ""}.
            </p>
          </div>
          <div className="actions">
            <button type="button" className="primary" onClick={restoreRecoveryDraft}>
              Восстановить
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile(realtimeDraftDownloadText(recoveryCandidate))}
            >
              Скачать .txt
            </button>
            <button
              type="button"
              className="danger"
              disabled={draftStatus === "saving"}
              onClick={() => void discardRecoveryDraft()}
            >
              Удалить черновик
            </button>
          </div>
        </section>
      )}

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

        <section
          className="live-config-card"
          aria-busy={credentialsState === "loading" || undefined}
        >
          <h4>Распознавание</h4>
          <label>
            Профиль ElevenLabs
            <select
              value={credentialId}
              disabled={running || credentialsState !== "ready"}
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
          {credentialsState === "loading" && (
            <p role="status" className="muted">
              Загружаем профили ElevenLabs…
            </p>
          )}
          {credentialsState === "error" && (
            <div className="error">
              <p role="alert">{credentialsMessage}</p>
              <button
                type="button"
                className="secondary"
                onClick={() => void loadCredentials()}
              >
                Повторить загрузку профилей
              </button>
            </div>
          )}
          <label>
            Язык
            <select
              value={language}
              disabled={running}
              onChange={(event) =>
                setLanguage(event.target.value as TranscriptionLanguageMode)
              }
            >
              <option value="ru">Русский</option>
              <option value="en">Английский</option>
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
              disabled={
                running ||
                credentialsState !== "ready" ||
                recoveryState === "loading" ||
                recoveryCandidate !== null ||
                !sourceReady ||
                !credentialId
              }
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
      {draftStatus === "saving" && (
        <p className="muted" role="status">Сохраняем временный Live-черновик…</p>
      )}
      {draftStatus === "saved" && (
        <p className="muted" role="status">
          Live-черновик сохранён локально и в Studio до 72 часов.
        </p>
      )}
      {draftStatus === "degraded" && (
        <p className="error" role="alert">
          Не все копии Live-черновика подтверждены. Не закрывайте вкладку и
          скачайте текст при первой возможности.
        </p>
      )}

      <section className="live-transcript-card">
        <header className="split">
          <div>
            <h4>Текст Live-транскрибации</h4>
            <p className="muted">
              Временно хранится только для восстановления. Не попадает в
              Google Docs, каталог, History, Analytics или diagnostics.
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
              onClick={() => void clearTranscript()}
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
          <li>
            Обновление или закрытие текущей вкладки останавливает захват.
            После повторного входа можно восстановить последний checkpoint,
            но audio и сама realtime-сессия не возобновляются.
          </li>
          <li>
            Пока идёт сессия или есть текст, браузер предупреждает
            перед обновлением или закрытием вкладки.
          </li>
          <li>
            Другие вкладки не продолжают audio capture; authenticated owner
            может получить последний временный draft через recovery.
          </li>
        </ul>
      </details>
    </section>
  );
}
