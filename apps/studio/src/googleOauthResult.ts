export type GoogleOauthResult =
  | "connected"
  | "cancelled"
  | "invalid_callback"
  | "invalid_state"
  | "exchange_failed"
  | "offline_access_missing";

export const googleOauthMessages: Record<GoogleOauthResult, string> = {
  connected: "Google Drive подключён. Статус подключения обновлён.",
  cancelled: "Подключение Google Drive отменено.",
  invalid_callback:
    "Не удалось завершить подключение Google Drive. Запустите подключение ещё раз.",
  invalid_state:
    "Не удалось завершить подключение Google Drive. Запустите подключение ещё раз.",
  exchange_failed:
    "Google Drive не подключён. Повторите авторизацию и подтвердите запрошенный доступ.",
  offline_access_missing:
    "Google Drive не подключён. Повторите авторизацию и подтвердите запрошенный доступ.",
};

const googleOauthResults = new Set<GoogleOauthResult>(
  Object.keys(googleOauthMessages) as GoogleOauthResult[],
);

export function consumeGoogleOauthResult(): GoogleOauthResult | null {
  const current = `${window.location.pathname ?? "/"}${window.location.search ?? ""}${window.location.hash ?? ""}`;
  const url = new URL(current, window.location.origin || "http://localhost");
  const raw = url.searchParams.get("google_oauth");
  if (raw === null) return null;
  url.searchParams.delete("google_oauth");
  const cleaned = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", cleaned);
  return googleOauthResults.has(raw as GoogleOauthResult)
    ? (raw as GoogleOauthResult)
    : null;
}
