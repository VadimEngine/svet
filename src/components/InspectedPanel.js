import { useState } from 'react';
import { deltaE2000, hexToXyz } from '../colorUtils';
import { LabDisplay } from './LabDisplay';
import { XyzDisplay } from './XyzDisplay';
import { CopyButton } from './CopyButton';
import { ListMembershipModal } from './ListMembershipModal';

export function InspectedPanel({
  inspectedColor,
  selectedColor,
  plotMode,
  hidePercentage,
  colorLists,
  onClose,
  onSetReference,
  onAddToList,
  onRemoveFromList,
}) {
  const [listModalOpen, setListModalOpen] = useState(false);

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

  const listsContaining = colorLists.filter(l => l.colors.some(c => c.hex === inspectedColor.hex));

  const handleToggleList = (listId, isIn) => {
    if (isIn) onRemoveFromList(inspectedColor, listId);
    else onAddToList(inspectedColor, listId);
  };

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
      <div className="inspected-body" style={{ backgroundColor: inspectedColor.hex }}>
        <div className="inspected-info">
          <div className="inspected-name-row">
            <div className="inspected-name">{inspectedColor.name}</div>
            <CopyButton text={inspectedColor.name} label="name" />
          </div>
          <div className="inspected-hex-row">
            <div className="inspected-hex">{inspectedColor.hex.toUpperCase()}</div>
            <CopyButton text={inspectedColor.hex.toUpperCase()} label="hex code" />
          </div>
          {plotMode === 'xyz' ? (
            <div className="inspected-xyz">
              {(() => {
                const { x, y, z } = hexToXyz(inspectedColor.hex.replace('#', ''));
                return <XyzDisplay x={x} y={y} z={z} />;
              })()}
            </div>
          ) : (
            <div className="inspected-lab">
              <LabDisplay l={inspectedColor.l} a={inspectedColor.a} b={inspectedColor.b} />
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
          className="inspected-add-list"
          onClick={() => setListModalOpen(true)}
        >
          Add to List
        </button>
      </div>
      {listsContaining.length > 0 && (
        <div className="inspected-in-lists">
          {listsContaining.map(list => (
            <span key={list.id} className="inspected-list-chip">
              {list.name}
              <button
                type="button"
                className="inspected-list-chip-remove"
                onClick={() => onRemoveFromList(inspectedColor, list.id)}
                title={`Remove from ${list.name}`}
                aria-label={`Remove from ${list.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {listModalOpen && (
        <ListMembershipModal
          color={inspectedColor}
          colorLists={colorLists}
          onToggle={handleToggleList}
          onClose={() => setListModalOpen(false)}
        />
      )}
    </div>
  );
}
