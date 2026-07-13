export function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="list-modal-overlay" onClick={onCancel}>
      <div className="list-modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="list-modal-header">
          <div className="list-modal-title">{title}</div>
          <button
            type="button"
            className="list-modal-close"
            onClick={onCancel}
            aria-label="Cancel"
            title="Cancel"
          >
            ×
          </button>
        </div>
        <div className="confirm-modal-body">{message}</div>
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-modal-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="confirm-modal-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
