import { useEffect, useMemo, useState } from 'react';
import { deltaE2000, hexToLab, hexToXyz, labToHex, xyzToHex } from '../colorUtils';
import { LabDisplay } from './LabDisplay';

const NEAREST_COUNT = 15;
const DEFAULT_HEX = '808080';

function SliderRow({ label, value, min, max, step, decimals, onChange }) {
  const [text, setText] = useState(value.toFixed(decimals));

  useEffect(() => {
    setText(value.toFixed(decimals));
  }, [value, decimals]);

  const commit = (raw) => {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) {
      setText(value.toFixed(decimals));
      return;
    }
    onChange(Math.min(max, Math.max(min, parsed)));
  };

  return (
    <div className="setting-row build-slider-row">
      <div className="setting-header">
        <label className="setting-label">{label}</label>
        <input
          type="number"
          className="filter-input filter-input-compact"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit(e.target.value);
              e.target.blur();
            }
          }}
        />
      </div>
      <div className="build-slider-track">
        <button
          type="button"
          className="build-step-btn"
          onClick={() => onChange(Math.max(min, value - (max - min) * 0.01))}
          aria-label={`Decrease ${label} by 1%`}
        >
          −
        </button>
        <input
          type="range"
          className="threshold-slider"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <button
          type="button"
          className="build-step-btn"
          onClick={() => onChange(Math.min(max, value + (max - min) * 0.01))}
          aria-label={`Increase ${label} by 1%`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function BuildTab({ allColors, plotMode, setInspectedColor }) {
  const [hex, setHex] = useState(DEFAULT_HEX);

  const lab = useMemo(() => hexToLab(hex) || { l: 0, a: 0, b: 0 }, [hex]);
  const xyz = useMemo(() => hexToXyz(hex), [hex]);

  const setL = (l) => setHex(labToHex(l, lab.a, lab.b).slice(1));
  const setA = (a) => setHex(labToHex(lab.l, a, lab.b).slice(1));
  const setB = (b) => setHex(labToHex(lab.l, lab.a, b).slice(1));
  const setX = (x) => setHex(xyzToHex(x, xyz.y, xyz.z).slice(1));
  const setY = (y) => setHex(xyzToHex(xyz.x, y, xyz.z).slice(1));
  const setZ = (z) => setHex(xyzToHex(xyz.x, xyz.y, z).slice(1));

  const nearest = useMemo(() => {
    if (allColors.length === 0) return [];
    return allColors
      .map((c) => ({ ...c, similarity: Math.max(0, 100 - deltaE2000(lab.l, lab.a, lab.b, c.l, c.a, c.b)) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, NEAREST_COUNT);
  }, [allColors, lab]);

  return (
    <div className="build-tab">
      <div className="build-swatch-section">
        <div className="build-swatch" style={{ backgroundColor: `#${hex}` }} />
        <div className="build-hex">#{hex.toUpperCase()}</div>
      </div>

      <div className="build-sliders">
        {plotMode === 'xyz' ? (
          <>
            <SliderRow label="X" value={xyz.x} min={0} max={1} step={0.005} decimals={3} onChange={setX} />
            <SliderRow label="Y" value={xyz.y} min={0} max={1} step={0.005} decimals={3} onChange={setY} />
            <SliderRow label="Z" value={xyz.z} min={0} max={1.1} step={0.005} decimals={3} onChange={setZ} />
          </>
        ) : (
          <>
            <SliderRow label="L*" value={lab.l} min={0} max={100} step={0.5} decimals={1} onChange={setL} />
            <SliderRow label="a*" value={lab.a} min={-128} max={127} step={0.5} decimals={1} onChange={setA} />
            <SliderRow label="b*" value={lab.b} min={-128} max={127} step={0.5} decimals={1} onChange={setB} />
          </>
        )}
      </div>

      <div className="build-nearest">
        <div className="build-nearest-label">Nearest colors</div>
        <div className="color-list build-nearest-list">
          {nearest.map((color, idx) => (
            <div
              key={`${color.name}-${color.hex}-${idx}`}
              className="color-item"
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
              <div className="color-similarity">{color.similarity.toFixed(2)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
