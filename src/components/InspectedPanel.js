import { deltaE2000, hexToXyz } from '../colorUtils';
import { LabDisplay } from './LabDisplay';

export function InspectedPanel({
  inspectedColor,
  selectedColor,
  plotMode,
  hidePercentage,
  listColors,
  onClose,
  onSetReference,
  onAddToList,
}) {
  const inspectedSimilarity = selectedColor
    ? Math.max(0, 100 - deltaE2000(
        selectedColor.l, selectedColor.a, selectedColor.b,
        inspectedColor.l, inspectedColor.a, inspectedColor.b
      ))
    : null;

  const isAlreadyReference =
    selectedColor &&
    selectedColor.name === inspectedColor.name &&
    selectedColor.hex === inspectedColor.hex;

  const inList = listColors.some(c => c.hex === inspectedColor.hex);

  return (
    <div className="inspected-panel">
      <div className="inspected-header">
        <span className="inspected-title">Inspected color</span>
        <button
          type="button"
          className="inspected-close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>
      <div className="inspected-body">
        <div
          className="inspected-swatch"
          style={{ backgroundColor: inspectedColor.hex }}
        />
        <div className="inspected-info">
          <div className="inspected-name">{inspectedColor.name}</div>
          <div className="inspected-hex">{inspectedColor.hex.toUpperCase()}</div>
          <div className="inspected-lab">
            <LabDisplay l={inspectedColor.l} a={inspectedColor.a} b={inspectedColor.b} />
          </div>
          {plotMode === 'xyz' && (
            <div className="inspected-xyz">
              {(() => {
                const { x, y, z } = hexToXyz(inspectedColor.hex.replace('#', ''));
                return `X:${x.toFixed(4)} Y:${y.toFixed(4)} Z:${z.toFixed(4)}`;
              })()}
            </div>
          )}
          {!hidePercentage && inspectedSimilarity !== null && (
            <div className="inspected-similarity">
              {inspectedSimilarity.toFixed(2)}% vs reference
            </div>
          )}
        </div>
      </div>
      <div className="inspected-actions">
        {!isAlreadyReference && (
          <button
            type="button"
            className="inspected-promote"
            onClick={onSetReference}
          >
            Use as Reference
          </button>
        )}
        <button
          type="button"
          className={`inspected-add-list ${inList ? 'in-list' : ''}`}
          onClick={() => onAddToList(inspectedColor)}
          disabled={inList}
        >
          {inList ? 'In List' : 'Add to List'}
        </button>
      </div>
    </div>
  );
}
