export const hexToLab = (hex) => {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const toLinear = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const rl = toLinear(r), gl = toLinear(g), bl = toLinear(b);
  const X = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const Y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const Z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(X / 0.95047), fy = f(Y / 1.00000), fz = f(Z / 1.08883);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
};

export const hexToXyz = (hex) => {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return { x: 0, y: 0, z: 0 };
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const toLinear = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const rl = toLinear(r), gl = toLinear(g), bl = toLinear(b);
  return {
    x: rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    y: rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750,
    z: rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041,
  };
};

export const xyzToHex = (X, Y, Z) => {
  const gamma = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  const clamp = (c) => Math.max(0, Math.min(1, c));
  const r = clamp(gamma( 3.2406 * X - 1.5372 * Y - 0.4986 * Z));
  const g = clamp(gamma(-0.9689 * X + 1.8758 * Y + 0.0415 * Z));
  const b = clamp(gamma( 0.0557 * X - 0.2040 * Y + 1.0570 * Z));
  return '#' + [r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
};

export const labToHex = (L, a, b) => {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const d = 6 / 29;
  const f = (t) => t > d ? t * t * t : 3 * d * d * (t - 4 / 29);
  const X = 0.95047 * f(fx);
  const Y = 1.00000 * f(fy);
  const Z = 1.08883 * f(fz);
  return xyzToHex(X, Y, Z);
};

// Returns 3D plot position for a color given the current plot mode.
// LAB: a* → X, L* → Y, b* → Z  (bipolar axes, range ~±150 / 0-100)
// XYZ: X → x, Y → y, Z → z     (all positive, D65 white at ~143/100/163)
export const getColorPlotPos = (color, mode) => {
  if (mode === 'xyz') {
    const xyz = hexToXyz(color.hex.replace('#', ''));
    return { x: xyz.x * 150, y: xyz.y * 100, z: xyz.z * 150 };
  }
  return { x: (color.a / 127) * 150, y: color.l, z: (color.b / 127) * 150 };
};

export const deltaE2000 = (L1, a1, b1, L2, a2, b2) => {
  const kL = 1, kC = 1, kH = 1;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = (Math.atan2(b1, a1p) * 180) / Math.PI;
  const h2p = (Math.atan2(b2, a2p) * 180) / Math.PI;
  const h1pp = h1p < 0 ? h1p + 360 : h1p;
  const h2pp = h2p < 0 ? h2p + 360 : h2p;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2pp - h1pp) <= 180) {
    dhp = h2pp - h1pp;
  } else if (h2pp - h1pp > 180) {
    dhp = h2pp - h1pp - 360;
  } else {
    dhp = h2pp - h1pp + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);
  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp;
  if (C1p * C2p === 0) {
    hbarp = h1pp + h2pp;
  } else if (Math.abs(h1pp - h2pp) <= 180) {
    hbarp = (h1pp + h2pp) / 2;
  } else {
    hbarp = h1pp + h2pp < 360
      ? (h1pp + h2pp + 360) / 2
      : (h1pp + h2pp - 360) / 2;
  }

  const T =
    1
    - 0.17 * Math.cos(((hbarp - 30) * Math.PI) / 180)
    + 0.24 * Math.cos(((2 * hbarp) * Math.PI) / 180)
    + 0.32 * Math.cos(((3 * hbarp + 6) * Math.PI) / 180)
    - 0.20 * Math.cos(((4 * hbarp - 63) * Math.PI) / 180);

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbar - 50, 2)) / Math.sqrt(20 + Math.pow(Lbar - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin((2 * dTheta * Math.PI) / 180) * RC;

  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
};

export const parseCSV = (csv) => {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV is empty');

  const headers = lines[0].split(',').map(h => h.trim());
  const nameIdx = headers.indexOf('name');
  const hexIdx = headers.indexOf('hex');
  const lIdx = headers.indexOf('l*');
  const aIdx = headers.indexOf('a*');
  const bIdx = headers.indexOf('b*');

  if (nameIdx === -1 || hexIdx === -1 || lIdx === -1 || aIdx === -1 || bIdx === -1) {
    throw new Error('CSV missing required columns: name, hex, l*, a*, b*');
  }

  const colors = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',').map(p => p.trim());
    if (parts.length <= Math.max(nameIdx, hexIdx, lIdx, aIdx, bIdx)) continue;
    colors.push({
      name: parts[nameIdx],
      hex: parts[hexIdx],
      l: parseFloat(parts[lIdx]),
      a: parseFloat(parts[aIdx]),
      b: parseFloat(parts[bIdx]),
    });
  }
  return colors;
};
