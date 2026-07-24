import { ApiError } from "./apiClient";

const RECONNECT_REASONS = new Set([
  "google_connection_missing",
  "google_connection_inactive",
  "google_reauthorization_required",
  "google_scope_unavailable",
]);

const CONFIG_REASONS = new Set([
  "google_config_unavailable",
  "google_picker_not_configured",
]);

function safeReason(error: ApiError) {
  if (!error.data || typeof error.data !== "object") return null;
  const detail = (error.data as { detail?: unknown }).detail;
  return typeof detail === "string" ? detail : null;
}

export function googlePickerFailureMessage(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const reason = safeReason(error);
  if (reason && RECONNECT_REASONS.has(reason)) {
    return "Переподключите Google Drive в настройках и повторите выбор.";
  }
  if (reason && CONFIG_REASONS.has(reason)) {
    return "Google Picker не настроен. Обратитесь к администратору.";
  }
  if (reason === "google_token_unavailable") {
    return "Google Drive временно недоступен. Повторите попытку; если ошибка сохранится, переподключите Google Drive в настройках.";
  }
  if (error.status === 429) return error.message;
  return null;
}
