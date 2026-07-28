export type GoogleOauthResult =
  | "connected"
  | "cancelled"
  | "invalid_callback"
  | "invalid_state"
  | "exchange_failed"
  | "offline_access_missing"
  | "scope_unavailable"
  | "account_identity_missing"
  | "account_mismatch"
  | "primary_connection_required";
export type GoogleMaintenanceOauthResult = GoogleOauthResult;

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
  scope_unavailable:
    "Google Drive не подключён: предоставлены не все обязательные разрешения.",
  account_identity_missing:
    "Google Drive не подключён: Google не подтвердил аккаунт.",
  account_mismatch:
    "Google Drive не подключён: выбран другой Google-аккаунт.",
  primary_connection_required:
    "Сначала подключите основной доступ Google Drive.",
};

export const googleMaintenanceOauthMessages: Record<
  GoogleMaintenanceOauthResult,
  string
> = {
  connected:
    "Расширенный доступ для обслуживания подключён и проверен.",
  cancelled: "Подключение доступа для обслуживания отменено.",
  invalid_callback:
    "Не удалось завершить подключение доступа для обслуживания. Запустите его ещё раз.",
  invalid_state:
    "Не удалось завершить подключение доступа для обслуживания. Запустите его ещё раз.",
  exchange_failed:
    "Доступ для обслуживания не подключён. Повторите авторизацию.",
  offline_access_missing:
    "Доступ для обслуживания не подключён. Подтвердите постоянный доступ при повторной авторизации.",
  scope_unavailable:
    "Доступ для обслуживания не подключён: предоставлены не все обязательные разрешения.",
  account_identity_missing:
    "Доступ для обслуживания не подключён: Google не подтвердил аккаунт.",
  account_mismatch:
    "Выберите тот же Google-аккаунт, который подключён к Studio.",
  primary_connection_required:
    "Сначала подключите основной доступ Google Drive.",
};

const googleOauthResults = new Set<GoogleOauthResult>(
  Object.keys(googleOauthMessages) as GoogleOauthResult[],
);
const googleMaintenanceOauthResults =
  new Set<GoogleMaintenanceOauthResult>(
    Object.keys(
      googleMaintenanceOauthMessages,
    ) as GoogleMaintenanceOauthResult[],
  );

function consumeOauthResult<T extends string>(
  parameter: string,
  allowed: Set<T>,
): T | null {
  const current = `${window.location.pathname ?? "/"}${window.location.search ?? ""}${window.location.hash ?? ""}`;
  const url = new URL(current, window.location.origin || "http://localhost");
  const raw = url.searchParams.get(parameter);
  if (raw === null) return null;
  url.searchParams.delete(parameter);
  const cleaned = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", cleaned);
  return allowed.has(raw as T) ? (raw as T) : null;
}

export function consumeGoogleOauthResult(): GoogleOauthResult | null {
  return consumeOauthResult("google_oauth", googleOauthResults);
}

export function consumeGoogleMaintenanceOauthResult():
  | GoogleMaintenanceOauthResult
  | null {
  return consumeOauthResult(
    "google_maintenance_oauth",
    googleMaintenanceOauthResults,
  );
}
