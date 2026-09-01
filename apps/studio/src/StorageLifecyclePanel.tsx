import { useEffect, useState } from "react";

import { api, mutateWithCsrfRetry } from "./apiClient";
import { formatBytes, retentionOptionLabel } from "./formatters";


type StorageClassPolicy = {
  reference_class: "transcription" | "audio_processing";
  label: string;
  storage_ready: boolean;
  provider_lifecycle_declared: boolean;
  effective_retention_seconds: number;
  retention_applies_to_new_uploads_only: true;
};

type StorageLifecycle = {
  classes: StorageClassPolicy[];
  multipart: {
    threshold_bytes: number;
    part_size_bytes: number;
    abandoned_session_ttl_seconds: number;
  };
  reconciliation: {
    available: boolean;
    dry_run_default: true;
    apply_requires_confirmation: true;
    minimum_orphan_age_seconds: number;
    scan_limit: number;
    apply_limit: number;
  };
};

type ReconciliationPreview = {
  status: "ready" | "truncated";
  scanned_count: number;
  protected_recent_count: number;
  orphan_count: number;
  orphan_bytes: number;
  plan_token: string | null;
  plan_expires_at: string | null;
  apply_available: boolean;
};

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function parseLifecycle(candidate: unknown): StorageLifecycle | null {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Partial<StorageLifecycle>;
  if (
    !Array.isArray(value.classes) ||
    value.classes.length !== 2 ||
    !value.multipart ||
    !value.reconciliation ||
    !nonNegativeInteger(value.multipart.threshold_bytes) ||
    !nonNegativeInteger(value.multipart.part_size_bytes) ||
    !nonNegativeInteger(value.multipart.abandoned_session_ttl_seconds) ||
    typeof value.reconciliation.available !== "boolean" ||
    value.reconciliation.dry_run_default !== true ||
    value.reconciliation.apply_requires_confirmation !== true ||
    !nonNegativeInteger(value.reconciliation.minimum_orphan_age_seconds) ||
    !nonNegativeInteger(value.reconciliation.scan_limit) ||
    !nonNegativeInteger(value.reconciliation.apply_limit)
  )
    return null;
  const classes = value.classes as unknown[];
  if (
    classes.some((entry) => {
      if (!entry || typeof entry !== "object") return true;
      const policy = entry as Partial<StorageClassPolicy>;
      return (
        (policy.reference_class !== "transcription" &&
          policy.reference_class !== "audio_processing") ||
        typeof policy.label !== "string" ||
        policy.label.length < 1 ||
        policy.label.length > 80 ||
        typeof policy.storage_ready !== "boolean" ||
        typeof policy.provider_lifecycle_declared !== "boolean" ||
        !nonNegativeInteger(policy.effective_retention_seconds) ||
        policy.retention_applies_to_new_uploads_only !== true
      );
    }) ||
    new Set(
      classes.map(
        (entry) => (entry as StorageClassPolicy).reference_class,
      ),
    ).size !== 2
  )
    return null;
  return value as StorageLifecycle;
}

function parsePreview(candidate: unknown): ReconciliationPreview | null {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Partial<ReconciliationPreview>;
  if (
    (value.status !== "ready" && value.status !== "truncated") ||
    !nonNegativeInteger(value.scanned_count) ||
    !nonNegativeInteger(value.protected_recent_count) ||
    !nonNegativeInteger(value.orphan_count) ||
    !nonNegativeInteger(value.orphan_bytes) ||
    typeof value.apply_available !== "boolean" ||
    (value.plan_token !== null &&
      (typeof value.plan_token !== "string" ||
        !/^[A-Za-z0-9_-]{40,1600}$/.test(value.plan_token))) ||
    (value.plan_expires_at !== null &&
      (typeof value.plan_expires_at !== "string" ||
        !Number.isFinite(Date.parse(value.plan_expires_at)))) ||
    (value.apply_available &&
      (!value.plan_token || value.status !== "ready"))
  )
    return null;
  return value as ReconciliationPreview;
}

function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  return operation(controller.signal).finally(() => window.clearTimeout(timeout));
}

export function StorageLifecyclePanel({
  csrf,
  onCsrf,
  active,
}: {
  csrf: string;
  onCsrf: (csrf: string) => void;
  active: boolean;
}) {
  const [policy, setPolicy] = useState<StorageLifecycle | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [preview, setPreview] = useState<ReconciliationPreview | null>(null);
  const [operation, setOperation] = useState<"preview" | "apply" | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setState("loading");
    setMessage("");
    try {
      const candidate = await withTimeout((signal) =>
        api<unknown>("/storage/lifecycle", { signal, cache: "no-store" }),
      );
      const parsed = parseLifecycle(candidate);
      if (!parsed) throw new Error("invalid_storage_lifecycle_response");
      setPolicy(parsed);
      setState("ready");
    } catch {
      setState("error");
      setMessage("Не удалось загрузить состояние хранилища.");
    }
  };

  useEffect(() => {
    if (!active || state !== "idle") return;
    void load();
  }, [active, state]);

  const runPreview = async () => {
    if (operation) return;
    setOperation("preview");
    setPreview(null);
    setMessage("");
    try {
      const candidate = await withTimeout((signal) =>
        mutateWithCsrfRetry<unknown>(
          "/storage/reconciliation/preview",
          csrf,
          onCsrf,
          { method: "POST", signal },
        ),
      );
      const parsed = parsePreview(candidate);
      if (!parsed) throw new Error("invalid_storage_preview_response");
      setPreview(parsed);
      setMessage(
        parsed.status === "truncated"
          ? "Проверен безопасный лимит объектов. Ничего не удалено; для очистки нужен более узкий повторный план."
          : parsed.orphan_count === 0
            ? "Проверка завершена: временных остатков для удаления не найдено."
            : `Проверка завершена: найдено ${parsed.orphan_count} временных остатков (${formatBytes(parsed.orphan_bytes)}). Ничего не удалено.`,
      );
    } catch {
      setMessage("Не удалось проверить хранилище. Ничего не удалено.");
    } finally {
      setOperation(null);
    }
  };

  const apply = async () => {
    if (!preview?.apply_available || !preview.plan_token || operation) return;
    const confirmed = window.confirm(
      `Удалить ${preview.orphan_count} подтверждённых временных остатков (${formatBytes(preview.orphan_bytes)})? Google Drive и Google Docs не затрагиваются.`,
    );
    if (!confirmed) return;
    setOperation("apply");
    setMessage("");
    try {
      const candidate = await withTimeout((signal) =>
        mutateWithCsrfRetry<unknown>(
          "/storage/reconciliation/apply",
          csrf,
          onCsrf,
          {
            method: "POST",
            signal,
            body: JSON.stringify({ plan_token: preview.plan_token, confirm: true }),
          },
        ),
      );
      if (!candidate || typeof candidate !== "object") {
        throw new Error("invalid_storage_apply_response");
      }
      const result = candidate as Record<string, unknown>;
      if (
        (result.status !== "completed" && result.status !== "partial") ||
        !nonNegativeInteger(result.deleted_count) ||
        !nonNegativeInteger(result.failed_count) ||
        !nonNegativeInteger(result.deleted_bytes)
      )
        throw new Error("invalid_storage_apply_response");
      setPreview(null);
      setMessage(
        result.status === "completed"
          ? `Удаление подтверждено: ${result.deleted_count} объектов (${formatBytes(result.deleted_bytes)}).`
          : `Удалено и подтверждено: ${result.deleted_count}. Не удалось подтвердить: ${result.failed_count}. Выполните проверку заново.`,
      );
    } catch {
      setPreview(null);
      setMessage(
        "Studio не подтвердила полный результат очистки. Выполните проверку заново перед новой попыткой.",
      );
    } finally {
      setOperation(null);
    }
  };

  return (
    <section className="card storage-lifecycle-panel" aria-labelledby="storage-lifecycle-title">
      <h3 id="storage-lifecycle-title">Контроль временного хранилища</h3>
      {state === "loading" && <p role="status">Проверяем правила хранения…</p>}
      {state === "error" && (
        <div className="error" role="alert">
          <p>{message}</p>
          <button type="button" onClick={() => void load()}>Повторить</button>
        </div>
      )}
      {state === "ready" && policy && (
        <>
          <div className="storage-policy-grid">
            {policy.classes.map((item) => (
              <article key={item.reference_class}>
                <strong>{item.label}</strong>
                <span>Новые файлы: {retentionOptionLabel(item.effective_retention_seconds)}</span>
                <span>
                  Аварийное правило хранилища: {item.provider_lifecycle_declared ? "заявлено" : "не подтверждено"}
                </span>
              </article>
            ))}
          </div>
          <p className="muted">
            Файлы от {formatBytes(policy.multipart.threshold_bytes)} загружаются частями. Незавершённые сессии автоматически очищаются; Google Drive и Google Docs не затрагиваются.
          </p>
          <div className="storage-reconciliation-actions">
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={operation !== null || !policy.reconciliation.available}
              aria-busy={operation === "preview" || undefined}
            >
              {operation === "preview" ? "Проверяем…" : "Проверить хранилище"}
            </button>
            {preview?.apply_available && preview.orphan_count > 0 && (
              <button
                type="button"
                className="danger"
                onClick={() => void apply()}
                disabled={operation !== null}
                aria-busy={operation === "apply" || undefined}
              >
                {operation === "apply" ? "Подтверждаем удаление…" : "Удалить найденные остатки"}
              </button>
            )}
          </div>
          {message && <p role="status" className="notice">{message}</p>}
        </>
      )}
    </section>
  );
}


export const __storageLifecycleTest = { parseLifecycle, parsePreview };
