import * as THREE from 'three';

export const makeAxisLabel = (text, color) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, 128, 64);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(24, 12, 1);
  return sprite;
};

export const buildLabAxesGroup = () => {
  const group = new THREE.Group();
  const axesLength = 100;
  const labelOffset = 14;

  const labToRgb = (L, a, b) => {
    const fy = (L + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;
    const d = 6 / 29;
    const f = t => t > d ? t * t * t : 3 * d * d * (t - 4 / 29);
    const X = 0.95047 * f(fx);
    const Y = 1.00000 * f(fy);
    const Z = 1.08883 * f(fz);
    const gamma = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return [
      Math.max(0, Math.min(1, gamma( 3.2406 * X - 1.5372 * Y - 0.4986 * Z))),
      Math.max(0, Math.min(1, gamma(-0.9689 * X + 1.8758 * Y + 0.0415 * Z))),
      Math.max(0, Math.min(1, gamma( 0.0557 * X - 0.2040 * Y + 1.0570 * Z))),
    ];
  };

  const toHex = ([r, g, b]) =>
    '#' + [r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');

  const addGradientLine = (from, to, colorFn, steps = 64) => {
    const n = steps + 1;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / steps;
      positions[i * 3]     = from[0] + (to[0] - from[0]) * t;
      positions[i * 3 + 1] = from[1] + (to[1] - from[1]) * t;
      positions[i * 3 + 2] = from[2] + (to[2] - from[2]) * t;
      const [r, g, bv] = colorFn(t);
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = bv;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    group.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ vertexColors: true })));
  };

  addGradientLine([0, 0, 0], [0, axesLength, 0], t => labToRgb(t * 100, 0, 0));
  const lLabel = makeAxisLabel('L*', toHex(labToRgb(100, 0, 0)));
  lLabel.position.set(0, axesLength + labelOffset, 0);
  group.add(lLabel);

  addGradientLine([0, 0, 0], [-axesLength, 0, 0], t => labToRgb(50, -t * 128, 0));
  const aNegLabel = makeAxisLabel('-a*', toHex(labToRgb(50, -128, 0)));
  aNegLabel.position.set(-axesLength - labelOffset, 0, 0);
  group.add(aNegLabel);

  addGradientLine([0, 0, 0], [axesLength, 0, 0], t => labToRgb(50, t * 128, 0));
  const aPosLabel = makeAxisLabel('+a*', toHex(labToRgb(50, 128, 0)));
  aPosLabel.position.set(axesLength + labelOffset, 0, 0);
  group.add(aPosLabel);

  addGradientLine([0, 0, 0], [0, 0, -axesLength], t => labToRgb(50, 0, -t * 128));
  const bNegLabel = makeAxisLabel('-b*', toHex(labToRgb(50, 0, -128)));
  bNegLabel.position.set(0, 0, -axesLength - labelOffset);
  group.add(bNegLabel);

  addGradientLine([0, 0, 0], [0, 0, axesLength], t => labToRgb(50, 0, t * 128));
  const bPosLabel = makeAxisLabel('+b*', toHex(labToRgb(50, 0, 128)));
  bPosLabel.position.set(0, 0, axesLength + labelOffset);
  group.add(bPosLabel);

  return group;
};

export const buildXyzAxesGroup = () => {
  const group = new THREE.Group();
  const labelOffset = 14;

  const xEnd = 0.95047 * 150;
  const yEnd = 1.0    * 100;
  const zEnd = 1.08883 * 150;

  const xyzToRgb = (X, Y, Z) => {
    const gamma = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return [
      Math.max(0, Math.min(1, gamma( 3.2406 * X - 1.5372 * Y - 0.4986 * Z))),
      Math.max(0, Math.min(1, gamma(-0.9689 * X + 1.8758 * Y + 0.0415 * Z))),
      Math.max(0, Math.min(1, gamma( 0.0557 * X - 0.2040 * Y + 1.0570 * Z))),
    ];
  };

  const toHex = ([r, g, b]) =>
    '#' + [r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');

  const addGradientLine = (from, to, colorFn, steps = 64) => {
    const n = steps + 1;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / steps;
      positions[i * 3]     = from[0] + (to[0] - from[0]) * t;
      positions[i * 3 + 1] = from[1] + (to[1] - from[1]) * t;
      positions[i * 3 + 2] = from[2] + (to[2] - from[2]) * t;
      const [r, g, bv] = colorFn(t);
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = bv;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    group.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })));
  };

  addGradientLine([0, 0, 0], [xEnd, 0, 0], t => xyzToRgb(t * 0.95047, 0, 0));
  const xLabel = makeAxisLabel('X', toHex(xyzToRgb(0.95047, 0, 0)));
  xLabel.position.set(xEnd + labelOffset, 0, 0);
  group.add(xLabel);

  addGradientLine([0, 0, 0], [0, yEnd, 0], t => [t, t, t]);
  const yLabel = makeAxisLabel('Y', '#ffffff');
  yLabel.position.set(0, yEnd + labelOffset, 0);
  group.add(yLabel);

  addGradientLine([0, 0, 0], [0, 0, zEnd], t => xyzToRgb(0, 0, t * 1.08883));
  const zLabel = makeAxisLabel('Z', toHex(xyzToRgb(0, 0, 1.08883)));
  zLabel.position.set(0, 0, zEnd + labelOffset);
  group.add(zLabel);

  return group;
};
