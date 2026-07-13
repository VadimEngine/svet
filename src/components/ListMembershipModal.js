export function ListMembershipModal({ color, colorLists, onToggle, onClose }) {
  return (
    <div className="list-modal-overlay" onClick={onClose}>
      <div className="list-modal" onClick={(e) => e.stopPropagation()}>
        <div className="list-modal-header">
          <div className="list-modal-title">
            <span className="list-modal-swatch" style={{ backgroundColor: color.hex }} />
            Add "{color.name}" to lists
          </div>
          <button
            type="button"
            className="list-modal-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
        <div className="list-modal-body">
          {colorLists.map(list => {
            const isIn = list.colors.some(c => c.hex === color.hex);
            return (
              <label key={list.id} className={`list-modal-row${isIn ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={isIn}
                  onChange={() => onToggle(list.id, isIn)}
                />
                <span className="list-modal-name">{list.name}</span>
                {list.colors.length > 0 && <span className="tab-badge">{list.colors.length}</span>}
              </label>
            );
          })}
        </div>
        <div className="list-modal-footer">
          <button type="button" className="list-modal-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
