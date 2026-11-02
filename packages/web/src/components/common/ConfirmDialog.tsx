import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Spinner } from './Icons.js';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="c2-confirm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onCancel();
      }}
    >
      <div className="c2-confirm-body">
        <h3 id={titleId} className="c2-confirm-title">
          {title}
        </h3>
        <div className="c2-confirm-desc">{description}</div>
        <div className="c2-confirm-actions">
          <button type="button" className="c2-btn c2-btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`c2-btn ${tone === 'danger' ? 'c2-btn-danger' : 'c2-btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Spinner size={15} />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
