import { useState, useRef, useEffect, useCallback } from 'react';
import { deltaE2000, hexToLab } from '../colorUtils';
import { LabDisplay } from './LabDisplay';

export function QuizTab({ allColors }) {
  const [targetColor, setTargetColor] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [threshold, setThreshold] = useState(90);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedGuessColor, setSelectedGuessColor] = useState(null);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const [won, setWon] = useState(false);
  const inputRef = useRef(null);

  const pickNewColor = useCallback(() => {
    if (allColors.length === 0) return;
    const color = allColors[Math.floor(Math.random() * allColors.length)];
    setTargetColor(color);
    setGuesses([]);
    setWon(false);
    setInputValue('');
    setSuggestions([]);
    setSelectedGuessColor(null);
    setActiveSuggestionIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [allColors]);

  useEffect(() => {
    if (allColors.length > 0 && !targetColor) pickNewColor();
  }, [allColors, targetColor, pickNewColor]);

  const submitGuess = useCallback((guessColor) => {
    if (!guessColor || !targetColor) return;
    const distance = deltaE2000(
      targetColor.l, targetColor.a, targetColor.b,
      guessColor.l, guessColor.a, guessColor.b
    );
    const similarity = Math.max(0, 100 - distance);
    const isWin = similarity >= threshold;
    setGuesses(prev => [{ color: guessColor, similarity, isWin }, ...prev]);
    if (isWin) setWon(true);
    setInputValue('');
    setSelectedGuessColor(null);
    setSuggestions([]);
    setActiveSuggestionIdx(-1);
  }, [targetColor, threshold]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setActiveSuggestionIdx(-1);
    if (!val.trim()) {
      setSuggestions([]);
      setSelectedGuessColor(null);
      return;
    }

    const hexRaw = val.trim().replace(/^#/, '');
    const isValidHex = /^[0-9a-f]{6}$/i.test(hexRaw);

    if (isValidHex) {
      const lab = hexToLab(hexRaw);
      if (lab) {
        // Find the nearest named color by perceptual distance
        let closest = null;
        let closestDist = Infinity;
        for (const c of allColors) {
          const d = deltaE2000(lab.l, lab.a, lab.b, c.l, c.a, c.b);
          if (d < closestDist) { closestDist = d; closest = c; }
        }
        if (closest) {
          const rest = allColors
            .filter(c => c.hex !== closest.hex && c.name.toLowerCase().includes(val.toLowerCase()))
            .slice(0, 7);
          const filtered = [{ ...closest, isHexMatch: true }, ...rest];
          setSuggestions(filtered);
          setActiveSuggestionIdx(0);
          setSelectedGuessColor(filtered[0]);
          return;
        }
      }
    }

    const lower = val.toLowerCase();
    const nameMatches = allColors
      .filter(c => c.name.toLowerCase().includes(lower))
      .sort((a, b) => {
        const an = a.name.toLowerCase();
        const bn = b.name.toLowerCase();
        const aStarts = an.startsWith(lower);
        const bStarts = bn.startsWith(lower);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        const aWord = an.split(' ').some(w => w.startsWith(lower));
        const bWord = bn.split(' ').some(w => w.startsWith(lower));
        if (aWord !== bWord) return aWord ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
    setSuggestions(nameMatches);
    if (nameMatches.length > 0) {
      setActiveSuggestionIdx(0);
      setSelectedGuessColor(nameMatches[0]);
    } else {
      setSelectedGuessColor(null);
    }
  };

  const selectSuggestion = (color) => {
    setSelectedGuessColor(color);
    setInputValue(color.name);
    setSuggestions([]);
    setActiveSuggestionIdx(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(activeSuggestionIdx + 1, suggestions.length - 1);
        setActiveSuggestionIdx(next);
        setSelectedGuessColor(suggestions[next]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(activeSuggestionIdx - 1, 0);
        setActiveSuggestionIdx(prev);
        setSelectedGuessColor(suggestions[prev]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const idx = activeSuggestionIdx >= 0 ? activeSuggestionIdx : 0;
        const color = suggestions[idx];
        setInputValue(color.name);
        setSuggestions([]);
        setActiveSuggestionIdx(-1);
        setSelectedGuessColor(color);
        submitGuess(color);
      } else if (e.key === 'Escape') {
        setSuggestions([]);
        setActiveSuggestionIdx(-1);
      }
    } else if (e.key === 'Enter' && selectedGuessColor) {
      submitGuess(selectedGuessColor);
    }
  };

  if (!targetColor) return <div className="color-empty">Loading quiz…</div>;

  return (
    <div className="quiz-tab">
      <div className="quiz-target">
        <div className="quiz-target-header">
          <div className="quiz-target-label">{won ? 'You got it!' : 'Guess this color'}</div>
          <button className="quiz-reset-btn" onClick={pickNewColor} title="Pick a new color">↺ Reset</button>
        </div>
        <div className="quiz-target-swatch" style={{ backgroundColor: targetColor.hex }} />
        {won && (
          <div className="quiz-target-reveal">
            <div className="quiz-target-name">{targetColor.name}</div>
            <div className="quiz-target-hex">{targetColor.hex.toUpperCase()}</div>
            <div className="quiz-target-lab">
              <LabDisplay l={targetColor.l} a={targetColor.a} b={targetColor.b} />
            </div>
          </div>
        )}
      </div>

      <div className="quiz-threshold-section">
        <div className="threshold-header">
          <label className="threshold-label">Win threshold</label>
          <input
            type="number"
            className="filter-input filter-input-compact"
            value={threshold}
            min="0"
            max="100"
            step="1"
            onChange={e => setThreshold(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
          />
        </div>
        <input
          type="range"
          className="threshold-slider"
          min="0"
          max="100"
          step="1"
          value={threshold}
          onChange={e => setThreshold(parseFloat(e.target.value))}
        />
      </div>

      {won ? (
        <button className="quiz-new-btn" onClick={pickNewColor}>New Color</button>
      ) : (
        <div className="quiz-input-section">
          <div className="quiz-input-row">
            <input
              ref={inputRef}
              type="text"
              className="filter-input"
              placeholder="Type a color name…"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <button
              className="quiz-submit-btn"
              onClick={() => submitGuess(selectedGuessColor)}
              disabled={!selectedGuessColor}
            >
              Guess
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="quiz-suggestions">
              {suggestions.map((color, idx) => (
                <div
                  key={color.hex + idx}
                  className={`quiz-suggestion-item${activeSuggestionIdx === idx ? ' active' : ''}`}
                  onMouseDown={() => {
                    selectSuggestion(color);
                    submitGuess(color);
                  }}
                >
                  <div className="quiz-suggestion-swatch" style={{ backgroundColor: color.hex }} />
                  <span className="quiz-suggestion-name">{color.name}</span>
                  <span className="quiz-suggestion-hex">{color.hex.toUpperCase()}</span>
                  {color.isHexMatch && <span className="quiz-suggestion-badge">≈ hex</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {guesses.length > 0 && (
        <div className="quiz-guesses">
          <div className="quiz-guesses-label">
            Guesses <span className="quiz-guesses-count">({guesses.length})</span>
          </div>
          <div className="quiz-guesses-list">
            {guesses.map((g, idx) => (
              <div key={idx} className={`quiz-guess-item${g.isWin ? ' win' : ''}`}>
                <div className="quiz-guess-swatch" style={{ backgroundColor: g.color.hex }} />
                <div className="quiz-guess-info">
                  <div className="quiz-guess-name">{g.color.name}</div>
                  <div className="quiz-guess-hex">{g.color.hex.toUpperCase()}</div>
                </div>
                <div className={`quiz-guess-pct${g.isWin ? ' win' : ''}`}>
                  {g.similarity.toFixed(1)}%
                  {g.isWin && <span className="quiz-win-badge">✓</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
