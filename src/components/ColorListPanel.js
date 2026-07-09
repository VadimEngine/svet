import { useRef, useState, useEffect } from 'react';
import { DISPLAY_INCREMENT } from '../ColorVisualization';
import { deltaE2000 } from '../colorUtils';
import { LabDisplay } from './LabDisplay';
import { CopyButton } from './CopyButton';
import { QuizTab } from './QuizTab';
import { BuildTab } from './BuildTab';
import packageJson from '../../package.json';

export function ColorListPanel({
  // State
  allColors,
  selectedColor,
  inspectedColor,
  colorLists,
  activeListId,
  listColors,
  filteredColors,
  visibleColors,
  hiddenCount,
  activeTab,
  searchTerm,
  rangeSearchTerm,
  similarityThreshold,
  hideOutliers,
  reverseSort,
  filterByThreshold,
  hidePercentage,
  plotMode,
  plotListOnly,
  labelListColors,
  pointSize,
  isHexSearch,
  isRangeSearch,
  // Setters
  setActiveTab,
  setSearchTerm,
  setRangeSearchTerm,
  setSimilarityThreshold,
  setHideOutliers,
  setReverseSort,
  setFilterByThreshold,
  setHidePercentage,
  setPlotMode,
  setPointSize,
  setPlotListOnly,
  setLabelListColors,
  setDisplayLimit,
  setInspectedColor,
  setActiveListId,
  // Callbacks
  onClearReference,
  onRemoveFromList,
  onReorderList,
  onSortListByReference,
  onClearList,
  onCreateList,
  onDeleteList,
  onRenameList,
  onMinimize,
  listScrollRef,
  onListScroll,
}) {
  const thresholdValueNum = parseFloat(similarityThreshold);
  const hasActiveThreshold = !Number.isNaN(thresholdValueNum) && !!selectedColor;

  const handleExportList = () => {
    const list = colorLists.find(l => l.id === activeListId);
    if (!list || list.colors.length === 0) return;
    const rows = ['name,hex', ...list.colors.map(c => `"${c.name.replace(/"/g, '""')}",${c.hex}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${list.name.replace(/[^a-z0-9]/gi, '_') || 'colors'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dragIndexRef = useRef(null);
  const overIndexRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hamburgerRef = useRef(null);
  const settingsDropdownRef = useRef(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (e) => {
      if (!hamburgerRef.current?.contains(e.target) && !settingsDropdownRef.current?.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen]);

  const handleDragStart = (e, index) => {
    e.preventDefault();
    dragIndexRef.current = index;
    overIndexRef.current = index;
    setDragIndex(index);
    setOverIndex(index);

    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const itemEl = el?.closest('[data-list-index]');
      if (itemEl) {
        const idx = parseInt(itemEl.dataset.listIndex, 10);
        if (!isNaN(idx) && idx !== overIndexRef.current) {
          overIndexRef.current = idx;
          setOverIndex(idx);
        }
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const from = dragIndexRef.current;
      const to = overIndexRef.current;
      dragIndexRef.current = null;
      overIndexRef.current = null;
      setDragIndex(null);
      setOverIndex(null);
      if (from !== null && to !== null && from !== to) {
        onReorderList(from, to);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <div className="color-list-panel">
      <div className="panel-header-wrapper">
        <div className="panel-header">
          <div className="panel-tabs">
            <button
              type="button"
              className={`panel-tab ${activeTab === 'colors' ? 'active' : ''}`}
              onClick={() => setActiveTab('colors')}
            >
              Colors
            </button>
            <button
              type="button"
              className={`panel-tab ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              List{colorLists.reduce((s, l) => s + l.colors.length, 0) > 0 && <span className="tab-badge">{colorLists.reduce((s, l) => s + l.colors.length, 0)}</span>}
            </button>
            <button
              type="button"
              className={`panel-tab ${activeTab === 'build' ? 'active' : ''}`}
              onClick={() => setActiveTab('build')}
            >
              Build
            </button>
            <button
              type="button"
              className={`panel-tab ${activeTab === 'quiz' ? 'active' : ''}`}
              onClick={() => setActiveTab('quiz')}
            >
              Quiz
            </button>
          </div>
          <div className="panel-header-actions">
            <button
              ref={hamburgerRef}
              type="button"
              className={`panel-settings-btn${settingsOpen ? ' active' : ''}`}
              onClick={() => setSettingsOpen(v => !v)}
              title="Settings"
              aria-label="Settings"
            >
              ⚙
            </button>
            <button
              type="button"
              className="panel-minimize"
              onClick={onMinimize}
              title="Minimize panel"
              aria-label="Minimize panel"
            >
              −
            </button>
          </div>
        </div>

        {settingsOpen && (
          <div className="settings-dropdown" ref={settingsDropdownRef}>
            <div className="setting-row">
              <div className="setting-label">Plot mode</div>
              <div className="setting-radio-group">
                {['lab', 'xyz'].map(mode => (
                  <label key={mode} className="option-check">
                    <input
                      type="radio"
                      name="plot-mode"
                      value={mode}
                      checked={plotMode === mode}
                      onChange={() => setPlotMode(mode)}
                    />
                    <span>{mode.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="setting-row">
              <div className="setting-header">
                <label className="setting-label" htmlFor="point-size-slider">Point size</label>
                <span className="setting-value">{pointSize.toFixed(1)}</span>
              </div>
              <input
                id="point-size-slider"
                type="range"
                className="threshold-slider"
                min="0.3"
                max="6"
                step="0.1"
                value={pointSize}
                onChange={(e) => setPointSize(parseFloat(e.target.value))}
              />
            </div>
            <div className="setting-row">
              <label className="option-check">
                <input
                  type="checkbox"
                  checked={hidePercentage}
                  onChange={(e) => setHidePercentage(e.target.checked)}
                />
                <span>Hide percentage</span>
              </label>
            </div>
            <div className="settings-version">v{packageJson.version}</div>
          </div>
        )}
      </div>

      {activeTab === 'colors' && (
        <div className="colors-tab">
          {selectedColor ? (
            <div className="reference-color">
              <div className="reference-label">Reference color</div>
              <div className="reference-body">
                <div
                  className="reference-swatch"
                  style={{ backgroundColor: selectedColor.hex }}
                />
                <div className="reference-info">
                  <div className="reference-name-row">
                    <div className="reference-name">{selectedColor.name}</div>
                    <CopyButton text={selectedColor.name} label="name" />
                  </div>
                  <div className="reference-hex-row">
                    <div className="reference-hex">{selectedColor.hex.toUpperCase()}</div>
                    <CopyButton text={selectedColor.hex.toUpperCase()} label="hex code" />
                  </div>
                  <div className="reference-lab">
                    <LabDisplay l={selectedColor.l} a={selectedColor.a} b={selectedColor.b} />
                  </div>
                </div>
                <button
                  className="reference-clear"
                  onClick={onClearReference}
                  title="Clear reference color"
                  aria-label="Clear reference color"
                >
                  ×
                </button>
              </div>
            </div>
          ) : (
            <div className="reference-empty">
              No reference color selected — click a color below or tap a point in the plot.
            </div>
          )}

          <div className="filter-controls">
            <div className="search-wrapper">
              <input
                type="text"
                className="filter-input"
                placeholder="Range search (e.g. 00:ff 91:ff d:ff)"
                value={rangeSearchTerm}
                onChange={(e) => setRangeSearchTerm(e.target.value)}
              />
              {rangeSearchTerm && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setRangeSearchTerm('')}
                  aria-label="Clear range search"
                  title="Clear range search"
                >
                  ×
                </button>
              )}
            </div>
            <div className="search-wrapper">
              <input
                type="text"
                className="filter-input"
                placeholder="Filter by name or hex (e.g. crimson or #ff0033)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <div className="threshold-section">
              <div className="threshold-header">
                <label className="threshold-label" htmlFor="similarity-threshold-number">
                  Min similarity %
                </label>
                <input
                  id="similarity-threshold-number"
                  type="number"
                  className="filter-input filter-input-compact"
                  value={similarityThreshold}
                  min="0"
                  max="100"
                  step="0.01"
                  onChange={(e) => setSimilarityThreshold(e.target.value)}
                  disabled={!selectedColor && !isHexSearch}
                />
              </div>
              <input
                type="range"
                className="threshold-slider"
                min="0"
                max="100"
                step="0.01"
                value={parseFloat(similarityThreshold) || 0}
                onChange={(e) => setSimilarityThreshold(e.target.value)}
                disabled={!selectedColor && !isHexSearch}
                aria-label="Min similarity percentage"
              />
            </div>

            <div className="filter-options">
              <label
                className={`option-check ${!selectedColor && !isHexSearch ? 'disabled' : ''}`}
                title="Apply the similarity threshold to the list of colors below"
              >
                <input
                  type="checkbox"
                  checked={filterByThreshold}
                  onChange={(e) => setFilterByThreshold(e.target.checked)}
                  disabled={!selectedColor && !isHexSearch}
                />
                <span>Filter colors</span>
              </label>
              <label
                className={`option-check ${!selectedColor ? 'disabled' : ''}`}
                title={
                  selectedColor
                    ? "Hide points in the 3D plot that don't meet the threshold"
                    : 'Select a reference color to enable filtering'
                }
              >
                <input
                  type="checkbox"
                  checked={hideOutliers}
                  onChange={(e) => setHideOutliers(e.target.checked)}
                  disabled={!selectedColor}
                />
                <span>Hide Plot outliers</span>
              </label>
            </div>
            <div className="filter-row-bottom">
              <button
                type="button"
                className="sort-toggle"
                onClick={() => setReverseSort(v => !v)}
                title="Toggle sort order"
              >
                {isRangeSearch
                  ? (reverseSort ? '↑ Z–A' : '↓ A–Z')
                  : (reverseSort ? '↑ Least similar' : '↓ Most similar')}
              </button>
              <div className="filter-stats">
                {visibleColors.length} / {filteredColors.length}
              </div>
            </div>
          </div>

          <div
            className={`color-list${selectedColor ? ' has-reference' : ''}`}
            ref={listScrollRef}
            onScroll={onListScroll}
            style={selectedColor ? { borderLeft: `6px solid ${selectedColor.hex}` } : {}}
          >
            {filteredColors.length === 0 ? (
              <div className="color-empty">No colors match the current filters.</div>
            ) : (
              <>
                {visibleColors.map((color, idx) => {
                  const isReference = selectedColor?.name === color.name && selectedColor?.hex === color.hex;
                  const withinThreshold =
                    hasActiveThreshold &&
                    color.similarity !== undefined &&
                    color.similarity >= thresholdValueNum;
                  const classes = [
                    'color-item',
                    isReference ? 'selected' : '',
                    withinThreshold ? 'within-threshold' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <div
                      key={`${color.name}-${color.hex}-${idx}`}
                      className={classes}
                      onClick={() => setInspectedColor(color)}
                    >
                      <div className="color-swatch" style={{ backgroundColor: color.hex }} />
                      <div className="color-info">
                        <div className="color-name">{color.name}</div>
                        <div className="color-hex">{color.hex.toUpperCase()}</div>
                        <div className="color-lab">
                          <LabDisplay l={color.l} a={color.a} b={color.b} />
                        </div>
                      </div>
                      {!hidePercentage && (selectedColor || isHexSearch || isRangeSearch) && color.similarity !== undefined && (
                        <div className="color-similarity">
                          {color.similarity.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    className="load-more"
                    onClick={() => setDisplayLimit(d => d + DISPLAY_INCREMENT)}
                  >
                    Show {Math.min(DISPLAY_INCREMENT, hiddenCount)} more
                    <span className="load-more-remaining"> ({hiddenCount} remaining)</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="list-tab">
          {/* List selector row */}
          <div className="list-selector-row">
            <div className="list-selector-tabs">
              {colorLists.map(list => (
                <button
                  key={list.id}
                  type="button"
                  className={`list-selector-btn${list.id === activeListId ? ' active' : ''}`}
                  onClick={() => setActiveListId(list.id)}
                >
                  {list.name}
                  {list.colors.length > 0 && <span className="tab-badge">{list.colors.length}</span>}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="list-new-btn"
              onClick={onCreateList}
              title="New list"
            >
              +
            </button>
          </div>

          {/* Active list name + delete */}
          <div className="list-meta-row">
            <input
              type="text"
              className="list-name-input"
              value={colorLists.find(l => l.id === activeListId)?.name ?? ''}
              onChange={e => onRenameList(activeListId, e.target.value)}
              placeholder="List name"
            />
            {colorLists.length > 1 && (
              <button
                type="button"
                className="list-delete-btn"
                onClick={() => onDeleteList(activeListId)}
                title="Delete this list"
              >
                Delete
              </button>
            )}
          </div>

          {/* Plot / label / clear controls */}
          <div className="list-controls">
            <label className={`option-check ${listColors.length === 0 ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={plotListOnly}
                onChange={e => setPlotListOnly(e.target.checked)}
                disabled={listColors.length === 0}
              />
              <span>Plot List</span>
            </label>
            <label className={`option-check ${!plotListOnly ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={labelListColors}
                onChange={e => setLabelListColors(e.target.checked)}
                disabled={!plotListOnly}
              />
              <span>Label colors</span>
            </label>
            <button
              type="button"
              className="list-sort-btn"
              onClick={onSortListByReference}
              disabled={!selectedColor || listColors.length < 2}
              title={selectedColor ? 'Sort list by similarity to the reference color' : 'Select a reference color to enable sorting'}
            >
              Sort by reference
            </button>
            {listColors.length > 0 && (
              <>
                <button type="button" className="list-export-btn" onClick={handleExportList}>
                  Export CSV
                </button>
                <button type="button" className="list-clear-all" onClick={onClearList}>
                  Clear
                </button>
              </>
            )}
          </div>

          {/* Color items */}
          {listColors.length === 0 ? (
            <div className="color-empty">
              No colors — open a color and press "Add to List".
            </div>
          ) : (
            <div className="color-list">
              {listColors.map((color, idx) => {
                const isDragging = dragIndex === idx;
                const isOverTarget = overIndex === idx && dragIndex !== null && dragIndex !== idx;
                const overTop = isOverTarget && dragIndex > idx;
                const overBottom = isOverTarget && dragIndex < idx;
                const classes = [
                  'color-item',
                  inspectedColor?.hex === color.hex ? 'selected' : '',
                  isDragging ? 'dragging' : '',
                  overTop ? 'drag-over-top' : '',
                  overBottom ? 'drag-over-bottom' : '',
                ].filter(Boolean).join(' ');
                return (
                  <div
                    key={`${color.hex}-${idx}`}
                    className={classes}
                    data-list-index={idx}
                    onClick={() => setInspectedColor(color)}
                  >
                    <div
                      className="drag-handle"
                      onPointerDown={e => handleDragStart(e, idx)}
                      onClick={e => e.stopPropagation()}
                    >
                      ⠿
                    </div>
                    <div className="color-swatch" style={{ backgroundColor: color.hex }} />
                    <div className="color-info">
                      <div className="color-name">{color.name}</div>
                      <div className="color-hex">{color.hex.toUpperCase()}</div>
                      <div className="color-lab">
                        <LabDisplay l={color.l} a={color.a} b={color.b} />
                      </div>
                    </div>
                    {!hidePercentage && selectedColor && (
                      <div className="color-similarity">
                        {Math.max(0, 100 - deltaE2000(selectedColor.l, selectedColor.a, selectedColor.b, color.l, color.a, color.b)).toFixed(2)}%
                      </div>
                    )}
                    <button
                      type="button"
                      className="list-remove"
                      onClick={e => { e.stopPropagation(); onRemoveFromList(color); }}
                      title="Remove from list"
                      aria-label="Remove from list"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ display: activeTab === 'quiz' ? 'flex' : 'none', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
        <QuizTab allColors={allColors} />
      </div>

      <div style={{ display: activeTab === 'build' ? 'flex' : 'none', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
        <BuildTab allColors={allColors} plotMode={plotMode} setInspectedColor={setInspectedColor} />
      </div>
    </div>
  );
}
