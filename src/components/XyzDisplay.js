export function XyzDisplay({ x, y, z }) {
  const outline = '0 0 4px #000, 0 0 8px rgba(0,0,0,0.6)';
  const s = { color: '#bbb', textShadow: outline };

  return (
    <>
      <span style={s}>X:{x.toFixed(3)}</span>
      {' '}
      <span style={s}>Y:{y.toFixed(3)}</span>
      {' '}
      <span style={s}>Z:{z.toFixed(3)}</span>
    </>
  );
}
