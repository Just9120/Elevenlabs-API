import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import {
  localFolderRejectedReasonLabel,
  type LocalFolderPreview,
} from "./folderIntakeModel";

const MAX_VISIBLE_ITEMS = 8;

export function FolderImportDialog({
  preview,
  targetFolderName,
  onConfirm,
  onCancel,
}: {
  preview: LocalFolderPreview;
  targetFolderName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelRef.current?.focus();
    return () => {
      const target = returnFocusRef.current;
      if (target?.isConnected) target.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (controls.length === 0) {
      event.preventDefault();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="confirm-clear-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="card confirm-clear-dialog folder-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId}>Импортировать папку «{preview.folder_name}»?</h2>
        <p id={descriptionId}>
          Файлы будут загружены только после явного подтверждения.
        </p>
        <dl className="folder-import-summary">
          <div>
            <dt>Всего найдено</dt>
            <dd>{preview.total_count}</dd>
          </div>
          <div>
            <dt>Будет загружено</dt>
            <dd>{preview.supported_count}</dd>
          </div>
          <div>
            <dt>Будет пропущено</dt>
            <dd>{preview.rejected.length}</dd>
          </div>
          <div>
            <dt>Папка результата</dt>
            <dd>{targetFolderName ?? "не выбрана"}</dd>
          </div>
        </dl>
        <details>
          <summary>Файлы для загрузки</summary>
          <ul className="folder-import-items">
            {preview.accepted.slice(0, MAX_VISIBLE_ITEMS).map((item) => (
              <li key={item.relative_path}>{item.relative_path}</li>
            ))}
          </ul>
          {preview.accepted.length > MAX_VISIBLE_ITEMS && (
            <p className="muted">
              И ещё {preview.accepted.length - MAX_VISIBLE_ITEMS}.
            </p>
          )}
        </details>
        {preview.rejected.length > 0 && (
          <details>
            <summary>Пропущенные файлы</summary>
            <ul className="folder-import-items">
              {preview.rejected
                .slice(0, MAX_VISIBLE_ITEMS)
                .map((item, index) => (
                  <li key={`${item.display_name}:${item.reason}:${index}`}>
                    {item.display_name}: {localFolderRejectedReasonLabel(item.reason)}
                  </li>
                ))}
            </ul>
            {preview.rejected.length > MAX_VISIBLE_ITEMS && (
              <p className="muted">
                И ещё {preview.rejected.length - MAX_VISIBLE_ITEMS}.
              </p>
            )}
          </details>
        )}
        <div className="actions">
          <button type="button" className="primary" onClick={onConfirm}>
            Импортировать {preview.supported_count}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="secondary"
            onClick={onCancel}
          >
            Отмена
          </button>
        </div>
      </section>
    </div>
  );
}
