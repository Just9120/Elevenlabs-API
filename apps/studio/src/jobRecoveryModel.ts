import type { JobСтатус } from "./jobModel";

export type OutputReconciliationResponse = {
  job_id: string;
  job_status: JobСтатус;
  available: boolean;
  counts: Record<string, number>;
  cases: {
    job_source_id: string;
    status: string;
    reason?: string | null;
    resolved: boolean;
    last_checked_at?: string | null;
  }[];
};

export type JobRetryResponse = {
  job_id: string;
  job_status: JobСтатус;
  available: boolean;
  reason: string;
  attempt_count: number;
  max_attempts: number;
  missing_output_count: number;
  retry_safe_source_count: number;
  resumable_provider_part_count?: number;
  provider_total_part_count?: number;
  provider_failure_code?: string | null;
};

export type JobRetryState = {
  loading: boolean;
  posting: boolean;
  error: string;
  message: string;
  data: JobRetryResponse | null;
};

export type OutputReconciliationCheckResponse = {
  job_id: string;
  checked: number;
  resolved: number;
  unresolved: number;
  conflicts: number;
};

export type OutputReconciliationState = {
  loading: boolean;
  checking: boolean;
  error: string;
  message: string;
  data: OutputReconciliationResponse | null;
};

export function retryUnavailableLabel(reason: string | undefined) {
  if (reason === "provider_outcome_uncertain") {
    return "Повтор недоступен: результат внешнего вызова не определён";
  }
  if (reason === "output_reconciliation_required") {
    return "Требуется проверка созданного документа";
  }
  if (reason === "attempt_limit_reached") {
    return "Достигнут предел попыток";
  }
  if (reason && reason !== "available") return "Повтор недоступен";
  return "";
}

export function isPartialProviderResume(data: JobRetryResponse | null | undefined) {
  return data?.reason === "partial_provider_resume_available";
}

export function isPartialProviderRestart(data: JobRetryResponse | null | undefined) {
  return data?.reason === "partial_provider_restart_available";
}

export function providerFailureLabel(code: string | null | undefined) {
  const labels: Record<string, string> = {
    provider_authentication_rejected: "ElevenLabs отклонил API-ключ",
    provider_request_rejected: "ElevenLabs отклонил эту часть файла",
    provider_rate_limited: "ElevenLabs ограничил частоту запросов",
    provider_timeout: "ElevenLabs не ответил вовремя",
    provider_unavailable: "ElevenLabs временно недоступен",
    malformed_provider_response: "ElevenLabs вернул некорректный ответ",
  };
  return code ? labels[code] ?? "Не удалось обработать следующую часть" : "Не удалось обработать следующую часть";
}
