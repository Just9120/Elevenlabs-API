import { useId } from "react";

export function ConfirmClearDialog({
  title,
  description,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  return (
    <div className="confirm-clear-backdrop" role="presentation">
      <section
        className="card confirm-clear-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h4 id={titleId}>{title}</h4>
        <p>{description}</p>
        <div className="actions">
          <button
            type="button"
            className="danger"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={onConfirm}
          >
            {pending ? "Очищаем…" : "Да"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={onCancel}
          >
            Нет
          </button>
        </div>
      </section>
    </div>
  );
}
