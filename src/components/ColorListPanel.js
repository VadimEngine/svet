import { DISPLAY_INCREMENT } from '../ColorVisualization';
import { LabDisplay } from './LabDisplay';

export function ColorListPanel({
  // State
  selectedColor,
  inspectedColor,
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
  setDisplayLimit,
  setInspectedColor,
  // Callbacks
  onClearReference,
  onRemoveFromList,
  onClearList,
  onMinimize,
  listScrollRef,
  onListScroll,
}) {
  const thresholdValueNum = parseFloat(similarityThreshold);
  const hasActiveThreshold = !Number.isNaN(thresholdValueNum) && !!selectedColor;

  return (
    <div className="color-list-panel">
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
            List Plot{listColors.length > 0 && <span className="tab-badge">{listColors.length}</span>}
          </button>
          <button
            type="button"
            className={`panel-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
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
                  <div className="reference-name">{selectedColor.name}</div>
                  <div className="reference-hex">{selectedColor.hex.toUpperCase()}</div>
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
            className="color-list"
            ref={listScrollRef}
            onScroll={onListScroll}
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
                      {!hidePercentage && (selectedColor || isHexSearch) && color.similarity !== undefined && (
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
            {listColors.length > 0 && (
              <button type="button" className="list-clear-all" onClick={onClearList}>
                Clear all
              </button>
            )}
          </div>
          {listColors.length === 0 ? (
            <div className="color-empty">
              No colors in list — open a color and press "Add to List".
            </div>
          ) : (
            <div className="color-list">
              {listColors.map((color, idx) => (
                <div
                  key={`${color.hex}-${idx}`}
                  className={`color-item${inspectedColor?.hex === color.hex ? ' selected' : ''}`}
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
                  <button
                    type="button"
                    className="list-remove"
                    onClick={() => onRemoveFromList(color)}
                    title="Remove from list"
                    aria-label="Remove from list"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="settings-content">
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
            <div className="setting-hint">
              LAB plots colors in perceptual L*a*b* space. XYZ plots in CIE XYZ color space.
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-header">
              <label className="setting-label" htmlFor="point-size-slider">
                Point size
              </label>
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
            <div className="setting-hint">
              Adjust how large the points appear in the 3D plot.
            </div>
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
            <div className="setting-hint">
              Hide the similarity percentage in the color list and inspected color panel.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
