import type { OutputReconciliationState } from "./jobRecoveryModel";

export function OutputReconciliationNotice({
  jobId,
  state,
  onCheck,
}: {
  jobId: string;
  state: OutputReconciliationState;
  onCheck: (jobId: string) => void | Promise<void>;
}) {
  return (
    <section className="notice" aria-label="Проверка результата в Google Drive">
      <b>Требуется проверка результата Google Docs</b>
      <p>
        Studio проверит, появился ли документ в Google Drive, и не будет
        создавать его повторно.
      </p>
      <button
        type="button"
        disabled={state.checking}
        aria-busy={state.checking}
        onClick={() => void onCheck(jobId)}
      >
        {state.checking
          ? "Проверяем Google Drive…"
          : "Проверить созданный документ в Google Drive"}
      </button>
      {state.message && <p role="status">{state.message}</p>}
      {state.error && <p className="error">{state.error}</p>}
    </section>
  );
}
