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
