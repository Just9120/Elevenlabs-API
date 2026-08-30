import { useEffect, useRef, useState } from "react";
import { ApiError, mutateWithCsrfRetry } from "./apiClient";
import { runBoundedRequest } from "./jobMutationRequest";
import {
  cancelLatestRequests,
  settleLatestRequest,
} from "./latestRequest";
import {
  parseRevokeOtherResponse,
  parseTargetedRevokeResponse,
  requestActiveSessions,
  revokeOtherIsConfirmed,
  targetedRevokeIsConfirmed,
  type ActiveSessionsResponse,
} from "./accountSessions";


const SESSION_READ_TIMEOUT_MS = 15_000;
const SESSION_MUTATION_TIMEOUT_MS = 20_000;

type SessionMutation =
  | { kind: "target"; sessionId: string }
  | { kind: "others" }
  | null;

function isAmbiguousMutationFailure(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && (error.status === 408 || error.status >= 500))
  );
}

function safeConfirm(message: string) {
  try {
    return window.confirm(message) === true;
  } catch {
    return false;
  }
}

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AccountSessionsPanel({
  csrf,
  onCsrf,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
}) {
  const [collection, setCollection] =
    useState<ActiveSessionsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"notice" | "error">(
    "notice",
  );
  const [mutation, setMutation] = useState<SessionMutation>(null);
  const mutationPendingRef = useRef(false);
  const mountedRef = useRef(true);
  const requestEpochsRef = useRef(new Map<string, number>());
  const requestControllersRef = useRef(new Map<string, AbortController>());

  const loadSessions = async ({
    reportFailure = true,
  } = {}): Promise<ActiveSessionsResponse | null> => {
    let observed: ActiveSessionsResponse | null = null;
    const hadConfirmedCollection = collection !== null;
    if (!hadConfirmedCollection) setState("loading");
    if (reportFailure) setMessage("");
    await settleLatestRequest(
      requestEpochsRef.current,
      "settings:active-sessions",
      requestActiveSessions,
      (nextCollection) => {
        observed = nextCollection;
        setCollection(nextCollection);
        setState("ready");
        if (reportFailure) setMessage("");
      },
      () => {
        setState(hadConfirmedCollection ? "ready" : "error");
        if (reportFailure) {
          setMessageTone("error");
          setMessage(
            hadConfirmedCollection
              ? "Не удалось обновить активные сессии. Последний подтверждённый список сохранён."
              : "Не удалось загрузить активные сессии. Повторите попытку.",
          );
        }
      },
      {
        controllers: requestControllersRef.current,
        timeoutMs: SESSION_READ_TIMEOUT_MS,
      },
    );
    return observed;
  };

  useEffect(() => {
    mountedRef.current = true;
    void loadSessions();
    return () => {
      mountedRef.current = false;
      cancelLatestRequests(
        requestEpochsRef.current,
        requestControllersRef.current,
      );
    };
  }, []);

  const reconcileTarget = async (sessionId: string) => {
    const observed = await loadSessions({ reportFailure: false });
    const confirmed =
      observed !== null && targetedRevokeIsConfirmed(observed, sessionId);
    if (!mountedRef.current) return;
    setMessageTone(confirmed ? "notice" : "error");
    setMessage(
      confirmed
        ? "Завершение сессии подтверждено по актуальному списку."
        : observed
          ? "Studio не подтвердила завершение сессии. Список обновлён; проверьте его перед повтором."
          : "Studio не подтвердила завершение сессии, а обновить список не удалось. Обновите страницу перед повтором.",
    );
  };

  const revokeTarget = async (sessionId: string) => {
    if (mutationPendingRef.current) return;
    if (!safeConfirm("Завершить выбранную сессию на другом устройстве?")) {
      return;
    }
    mutationPendingRef.current = true;
    setMutation({ kind: "target", sessionId });
    setMessage("");
    try {
      const request = await runBoundedRequest(
        (signal) =>
          mutateWithCsrfRetry<unknown>(
            `/auth/sessions/${encodeURIComponent(sessionId)}`,
            csrf,
            onCsrf,
            { method: "DELETE", signal },
          ),
        SESSION_MUTATION_TIMEOUT_MS,
      );
      if (
        request.status === "timed_out" ||
        !parseTargetedRevokeResponse(request.value)
      ) {
        await reconcileTarget(sessionId);
        return;
      }
      if (mountedRef.current) {
        setCollection((current) =>
          current
            ? {
                ...current,
                sessions: current.sessions.filter(
                  (session) => session.id !== sessionId,
                ),
              }
            : current,
        );
        setMessageTone("notice");
        setMessage("Сессия завершена.");
      }
      await loadSessions({ reportFailure: false });
    } catch (error) {
      if (isAmbiguousMutationFailure(error)) {
        await reconcileTarget(sessionId);
      } else if (mountedRef.current) {
        setMessageTone("error");
        setMessage("Не удалось завершить сессию. Обновите список и повторите.");
      }
    } finally {
      mutationPendingRef.current = false;
      if (mountedRef.current) setMutation(null);
    }
  };

  const reconcileOthers = async () => {
    const observed = await loadSessions({ reportFailure: false });
    const confirmed = observed !== null && revokeOtherIsConfirmed(observed);
    if (!mountedRef.current) return;
    setMessageTone(confirmed ? "notice" : "error");
    setMessage(
      confirmed
        ? "Завершение остальных сессий подтверждено по актуальному списку."
        : observed
          ? "Studio не подтвердила завершение всех остальных сессий. Список обновлён; проверьте его перед повтором."
          : "Studio не подтвердила завершение остальных сессий, а обновить список не удалось. Обновите страницу перед повтором.",
    );
  };

  const revokeOthers = async () => {
    if (mutationPendingRef.current) return;
    if (!safeConfirm("Завершить все остальные активные сессии?")) return;
    mutationPendingRef.current = true;
    setMutation({ kind: "others" });
    setMessage("");
    try {
      const request = await runBoundedRequest(
        (signal) =>
          mutateWithCsrfRetry<unknown>(
            "/auth/sessions/revoke-other",
            csrf,
            onCsrf,
            { method: "POST", signal },
          ),
        SESSION_MUTATION_TIMEOUT_MS,
      );
      if (
        request.status === "timed_out" ||
        !parseRevokeOtherResponse(request.value)
      ) {
        await reconcileOthers();
        return;
      }
      if (mountedRef.current) {
        setCollection((current) =>
          current
            ? {
                ...current,
                sessions: current.sessions.filter(
                  (session) => session.is_current,
                ),
                truncated: false,
              }
            : current,
        );
        setMessageTone("notice");
        setMessage("Все остальные сессии завершены.");
      }
      await loadSessions({ reportFailure: false });
    } catch (error) {
      if (isAmbiguousMutationFailure(error)) {
        await reconcileOthers();
      } else if (mountedRef.current) {
        setMessageTone("error");
        setMessage(
          "Не удалось завершить остальные сессии. Обновите список и повторите.",
        );
      }
    } finally {
      mutationPendingRef.current = false;
      if (mountedRef.current) setMutation(null);
    }
  };

  const otherSessionCount =
    collection?.sessions.filter((session) => !session.is_current).length ?? 0;

  return (
    <section
      className="card account-sessions"
      aria-labelledby="active-sessions-title"
      aria-busy={mutation !== null || undefined}
    >
      <div className="account-sessions-heading">
        <div>
          <h3 id="active-sessions-title">Активные сессии</h3>
          <p className="muted">
            Показываются только время входа, последняя активность и срок
            действия. Данные устройства, IP и credential data не собираются.
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => void loadSessions()}
          disabled={state === "loading" || mutation !== null}
        >
          Обновить
        </button>
      </div>

      {state === "loading" && !collection && (
        <p role="status">Загружаем активные сессии…</p>
      )}
      {state === "error" && !collection && (
        <div className="error">
          <p role="alert">{message}</p>
          <button type="button" onClick={() => void loadSessions()}>
            Повторить
          </button>
        </div>
      )}
      {collection && (
        <>
          <ul className="account-session-list">
            {collection.sessions.map((session) => (
              <li key={session.id} className="account-session-row">
                <div>
                  <b>{session.is_current ? "Текущая сессия" : "Другая сессия"}</b>
                  <span>
                    Вход: {formatSessionDate(session.created_at)}
                  </span>
                  <span>
                    Последняя активность:{" "}
                    {formatSessionDate(
                      session.last_seen_at ?? session.created_at,
                    )}
                  </span>
                  <span>Истекает: {formatSessionDate(session.expires_at)}</span>
                </div>
                {session.is_current ? (
                  <span className="status">Текущая</span>
                ) : (
                  <button
                    type="button"
                    className="danger"
                    disabled={mutation !== null}
                    aria-busy={
                      mutation?.kind === "target" &&
                        mutation.sessionId === session.id
                        ? true
                        : undefined
                    }
                    onClick={() => void revokeTarget(session.id)}
                  >
                    {mutation?.kind === "target" &&
                    mutation.sessionId === session.id
                      ? "Завершаем…"
                      : "Завершить сессию"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {collection.truncated && (
            <p className="notice" role="status">
              Показаны первые {collection.limit} сессий. Массовое завершение
              применяется ко всем остальным активным сессиям, включая не
              показанные.
            </p>
          )}
          {otherSessionCount === 0 ? (
            <p className="muted">Других активных сессий нет.</p>
          ) : (
            <button
              type="button"
              className="danger"
              disabled={mutation !== null}
              aria-busy={mutation?.kind === "others" || undefined}
              onClick={() => void revokeOthers()}
            >
              {mutation?.kind === "others"
                ? "Завершаем остальные…"
                : "Завершить все остальные"}
            </button>
          )}
        </>
      )}
      {message && state !== "error" && (
        <p
          className={messageTone}
          role={messageTone === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </section>
  );
}
