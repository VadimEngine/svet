export function LabDisplay({ l, a, b }) {
  const outline = '0 0 4px #000, 0 0 8px rgba(0,0,0,0.6)';

  // L*: lightness mapped to grayscale — dark gray at 0, white at 100
  const lColor = `hsl(0, 0%, ${Math.max(30, l)}%)`;

  // a*: neutral at 0, green toward negative, red toward positive
  const aSat = Math.min(100, Math.abs(a) * 1.6);
  const aColor = `hsl(${a >= 0 ? 4 : 122}, ${aSat}%, 62%)`;

  // b*: neutral at 0, blue toward negative, yellow toward positive
  const bSat = Math.min(100, Math.abs(b) * 1.6);
  const bColor = `hsl(${b >= 0 ? 52 : 222}, ${bSat}%, ${b >= 0 ? 60 : 64}%)`;

  const s = (color) => ({ color, textShadow: outline });

  return (
    <>
      <span style={s(lColor)}>L:{l.toFixed(1)}</span>
      {' '}
      <span style={s(aColor)}>a:{a.toFixed(1)}</span>
      {' '}
      <span style={s(bColor)}>b:{b.toFixed(1)}</span>
    </>
  );
}
