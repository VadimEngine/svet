import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import './ColorVisualization.css';

const INITIAL_DISPLAY_LIMIT = 100;
const DISPLAY_INCREMENT = 100;
const SCROLL_LOAD_THRESHOLD_PX = 250;

function LabDisplay({ l, a, b }) {
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

export function ColorVisualization() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);
  const pointsMaterialRef = useRef(null);
  const highlightMarkerRef = useRef(null);
  const highlightCloudRef = useRef(null);
  const highlightMaterialRef = useRef(null);
  const orbitTargetRef = useRef(null);
  const colorsRef = useRef([]);
  const needsRenderRef = useRef(true);
  const listScrollRef = useRef(null);
  const raycasterRef = useRef(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);
  const [sortedColors, setSortedColors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState('');
  const [hideOutliers, setHideOutliers] = useState(false);
  const [reverseSort, setReverseSort] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY_LIMIT);
  const [inspectedColor, setInspectedColor] = useState(null);
  const [activeTab, setActiveTab] = useState('colors');
  const [pointSize, setPointSize] = useState(1.5);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [filterByThreshold, setFilterByThreshold] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Orbit target (the point the camera revolves around / looks at)
    orbitTargetRef.current = new THREE.Vector3(0, 50, 0);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    camera.position.set(100, 80, 100);
    camera.lookAt(0, 50, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Raycaster for click-to-inspect on the point cloud
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 2.5;
    raycasterRef.current = raycaster;

    const pickAtScreen = (clientX, clientY) => {
      const particles = particlesRef.current;
      if (!particles) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(particles);
      if (intersects.length === 0) return;
      // Take the closest hit
      const idx = intersects[0].index;
      const visible = particles.userData.visibleColors || colorsRef.current;
      const picked = visible[idx];
      if (picked) setInspectedColor(picked);
    };

    // Setup controls
    setupControls(camera, renderer, pickAtScreen);
    addAxes(scene);

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      needsRenderRef.current = true;
    };
    window.addEventListener('resize', handleResize);

    // Render-on-demand animation loop: only redraws when something has changed.
    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (needsRenderRef.current) {
        needsRenderRef.current = false;
        renderer.render(scene, camera);
      }
    };
    animate();

    // Auto-load CSV file
    loadCSVFile();

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupControls = (camera, renderer, pickAtScreen) => {
    const canvas = renderer.domElement;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let previousTouchDistance = 0;
    let previousTouchMidpoint = { x: 0, y: 0 };
    let pressStart = { x: 0, y: 0 };
    let movedDuringPress = false;
    const CLICK_MOVE_THRESHOLD = 5;
    const MIN_RADIUS = 50;
    const MAX_RADIUS = 500;

    const getOrbitParams = () => {
      const target = orbitTargetRef.current;
      const toCamera = camera.position.clone().sub(target);
      const radius = toCamera.length();
      const theta = Math.atan2(toCamera.x, toCamera.z);
      const phi = Math.acos(Math.max(-1, Math.min(1, toCamera.y / radius)));
      return { radius, theta, phi };
    };

    const applyOrbit = (radius, theta, phi) => {
      const target = orbitTargetRef.current;
      camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = target.y + radius * Math.cos(phi);
      camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(target);
      needsRenderRef.current = true;
    };

    const applyZoom = (distanceDelta, zoomSpeed) => {
      const target = orbitTargetRef.current;
      const toCamera = camera.position.clone().sub(target);
      const currentRadius = toCamera.length();
      const newRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, currentRadius - distanceDelta * zoomSpeed));
      camera.position.copy(target).addScaledVector(toCamera.normalize(), newRadius);
      camera.lookAt(target);
      needsRenderRef.current = true;
    };

    // Mouse controls
    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
      pressStart = { x: e.clientX, y: e.clientY };
      movedDuringPress = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      if (Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > CLICK_MOVE_THRESHOLD) {
        movedDuringPress = true;
      }
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      const { radius, theta, phi } = getOrbitParams();
      applyOrbit(radius, theta - deltaX * 0.005, Math.max(0.1, Math.min(Math.PI - 0.1, phi - deltaY * 0.005)));
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('mouseup', (e) => {
      isDragging = false;
      if (!movedDuringPress && pickAtScreen) pickAtScreen(e.clientX, e.clientY);
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const target = orbitTargetRef.current;
      const toCamera = camera.position.clone().sub(target);
      const currentRadius = toCamera.length();
      const newRadius = currentRadius + e.deltaY * 0.1;
      if (newRadius >= MIN_RADIUS && newRadius <= MAX_RADIUS) {
        camera.position.copy(target).addScaledVector(toCamera.normalize(), newRadius);
        camera.lookAt(target);
        needsRenderRef.current = true;
      }
    }, { passive: false });

    // Touch controls
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        pressStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        movedDuringPress = false;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        previousTouchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        previousTouchMidpoint = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();

      if (e.touches.length === 1 && isDragging) {
        if (Math.hypot(e.touches[0].clientX - pressStart.x, e.touches[0].clientY - pressStart.y) > CLICK_MOVE_THRESHOLD) {
          movedDuringPress = true;
        }
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        const { radius, theta, phi } = getOrbitParams();
        applyOrbit(radius, theta - deltaX * 0.005, Math.max(0.1, Math.min(Math.PI - 0.1, phi - deltaY * 0.005)));
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      } else if (e.touches.length === 2) {
        movedDuringPress = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        // Pinch zoom
        if (previousTouchDistance > 0) {
          applyZoom(currentDistance - previousTouchDistance, 0.5);
        }

        // 2-finger pan: shift the orbit target in camera space
        const midDeltaX = midX - previousTouchMidpoint.x;
        const midDeltaY = midY - previousTouchMidpoint.y;
        if (Math.abs(midDeltaX) > 0.3 || Math.abs(midDeltaY) > 0.3) {
          const panSpeed = 0.3;
          const target = orbitTargetRef.current;
          const camDir = camera.getWorldDirection(new THREE.Vector3());
          const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
          target.addScaledVector(right, -midDeltaX * panSpeed);
          target.y += midDeltaY * panSpeed;
          camera.lookAt(target);
          needsRenderRef.current = true;
        }

        previousTouchDistance = currentDistance;
        previousTouchMidpoint = { x: midX, y: midY };
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (!movedDuringPress && e.touches.length === 0 && e.changedTouches.length === 1 && pickAtScreen) {
        const t = e.changedTouches[0];
        pickAtScreen(t.clientX, t.clientY);
      }
      if (e.touches.length < 2) {
        previousTouchDistance = 0;
        previousTouchMidpoint = { x: 0, y: 0 };
      }
      if (e.touches.length === 0) {
        isDragging = false;
        movedDuringPress = false;
      } else if (e.touches.length === 1) {
        // Transitioned from 2-finger to 1-finger — re-anchor position tracker
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isDragging = true;
      }
    });
  };

  const makeAxisLabel = (text, color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Black stroke for legibility on any background
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, 128, 64);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false // always visible above particles
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(24, 12, 1);
    return sprite;
  };

  const addAxes = (scene) => {
    const axesLength = 100;
    const labelOffset = 14;

    const addLine = (x1, y1, z1, x2, y2, z2, color) => {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x1, y1, z1, x2, y2, z2]), 3));
      scene.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color })));
    };

    // a* axis (X): green on negative side, red on positive side
    addLine(0, 0, 0, -axesLength, 0, 0, 0x22cc55);
    addLine(0, 0, 0,  axesLength, 0, 0, 0xff3333);
    const aNegLabel = makeAxisLabel('-a*', '#55dd88');
    aNegLabel.position.set(-axesLength - labelOffset, 0, 0);
    scene.add(aNegLabel);
    const aPosLabel = makeAxisLabel('+a*', '#ff6b6b');
    aPosLabel.position.set(axesLength + labelOffset, 0, 0);
    scene.add(aPosLabel);

    // L* axis (Y): white, 0 → 100 (L* range)
    addLine(0, 0, 0, 0, axesLength, 0, 0xffffff);
    const lLabel = makeAxisLabel('L*', '#ffffff');
    lLabel.position.set(0, axesLength + labelOffset, 0);
    scene.add(lLabel);

    // b* axis (Z): blue on negative side, yellow on positive side
    addLine(0, 0, 0, 0, 0, -axesLength, 0x3366ff);
    addLine(0, 0, 0, 0, 0,  axesLength, 0xeeaa00);
    const bNegLabel = makeAxisLabel('-b*', '#6699ff');
    bNegLabel.position.set(0, 0, -axesLength - labelOffset);
    scene.add(bNegLabel);
    const bPosLabel = makeAxisLabel('+b*', '#ffcc44');
    bPosLabel.position.set(0, 0, axesLength + labelOffset);
    scene.add(bPosLabel);
  };

  const deltaE2000 = (L1, a1, b1, L2, a2, b2) => {
    const kL = 1,
          kC = 1,
          kH = 1;

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

    const dHp =
        2 * Math.sqrt(C1p * C2p) *
        Math.sin((dhp * Math.PI) / 360);

    const Lbar = (L1 + L2) / 2;
    const Cbarp = (C1p + C2p) / 2;

    let hbarp;

    if (C1p * C2p === 0) {
        hbarp = h1pp + h2pp;
    } else if (Math.abs(h1pp - h2pp) <= 180) {
        hbarp = (h1pp + h2pp) / 2;
    } else {
        hbarp =
            h1pp + h2pp < 360
                ? (h1pp + h2pp + 360) / 2
                : (h1pp + h2pp - 360) / 2;
    }

    const T =
        1
        - 0.17 * Math.cos(((hbarp - 30) * Math.PI) / 180)
        + 0.24 * Math.cos(((2 * hbarp) * Math.PI) / 180)
        + 0.32 * Math.cos(((3 * hbarp + 6) * Math.PI) / 180)
        - 0.20 * Math.cos(((4 * hbarp - 63) * Math.PI) / 180);

    const dTheta =
        30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));

    const RC =
        2 *
        Math.sqrt(
            Math.pow(Cbarp, 7) /
            (Math.pow(Cbarp, 7) + Math.pow(25, 7))
        );

    const SL =
        1 +
        (0.015 * Math.pow(Lbar - 50, 2)) /
        Math.sqrt(20 + Math.pow(Lbar - 50, 2));

    const SC = 1 + 0.045 * Cbarp;
    const SH = 1 + 0.015 * Cbarp * T;

    const RT =
        -Math.sin((2 * dTheta * Math.PI) / 180) * RC;

    return Math.sqrt(
        Math.pow(dLp / (kL * SL), 2) +
        Math.pow(dCp / (kC * SC), 2) +
        Math.pow(dHp / (kH * SH), 2) +
        RT *
        (dCp / (kC * SC)) *
        (dHp / (kH * SH))
    );
  };

  const addHighlightMarker = (x, y, z) => {
    const scene = sceneRef.current;
    
    // Remove old marker if exists
    if (highlightMarkerRef.current) {
      scene.remove(highlightMarkerRef.current);
    }

    // Create a sphere marker
    const geometry = new THREE.SphereGeometry(3, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(x, y, z);
    scene.add(marker);
    highlightMarkerRef.current = marker;
    needsRenderRef.current = true;
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    
    // Add highlight marker
    const x = (color.a / 127) * 150;
    const y = color.l;
    const z = (color.b / 127) * 150;
    addHighlightMarker(x, y, z);

    // Sort colors by similarity
    const sorted = colorsRef.current.map(c => {
      const distance = deltaE2000(color.l, color.a, color.b, c.l, c.a, c.b);
      // Map ΔE2000 to a similarity percentage:
      //   ΔE = 0   -> 100% (identical)
      //   ΔE >= 100 -> 0%  (max perceptual difference in LAB)
      const similarity = Math.max(0, 100 - distance);
      return {
        ...c,
        distance,
        similarity
      };
    }).sort((a, b) => a.distance - b.distance);

    setSortedColors(sorted);
  };

  const loadCSVFile = async () => {
    try {
      setIsLoading(true);
      const csvPath = `${process.env.PUBLIC_URL}/colornames.csv`;
      const response = await fetch(csvPath);
      if (!response.ok) {
        throw new Error(`Failed to load CSV: ${response.statusText}`);
      }
      const csv = await response.text();
      const colors = parseCSV(csv);

      if (colors.length === 0) {
        throw new Error('No colors found in CSV');
      }

      createVisualization(colors);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      showError(`Error: ${err.message}`);
    }
  };

  const parseCSV = (csv) => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV is empty');
    }

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
      if (parts.length <= Math.max(nameIdx, hexIdx, lIdx, aIdx, bIdx)) {
        continue;
      }

      colors.push({
        name: parts[nameIdx],
        hex: parts[hexIdx],
        l: parseFloat(parts[lIdx]),
        a: parseFloat(parts[aIdx]),
        b: parseFloat(parts[bIdx])
      });
    }

    return colors;
  };

  const createVisualization = (colors) => {
    const scene = sceneRef.current;

    // Remove old particles if they exist
    if (particlesRef.current) {
      scene.remove(particlesRef.current);
      if (pointsMaterialRef.current) {
        pointsMaterialRef.current.dispose();
      }
      particlesRef.current.geometry.dispose();
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors_array = [];

    colors.forEach(color => {
      const x = (color.a / 127) * 150;
      const y = color.l;
      const z = (color.b / 127) * 150;

      positions.push(x, y, z);

      // Parse hex color
      const hex = color.hex.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

      colors_array.push(r, g, b);
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors_array), 3));

    // Create material
    const pointsMaterial = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8
    });
    pointsMaterialRef.current = pointsMaterial;

    // Create points mesh
    const particles = new THREE.Points(geometry, pointsMaterial);
    particles.userData.visibleColors = colors;
    particlesRef.current = particles;
    scene.add(particles);
    needsRenderRef.current = true;

    // Store colors in ref and state
    colorsRef.current = colors;
    setSortedColors(colors);
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => {
      setError('');
    }, 5000);
  };

  // Derived filtered list: name/hex search + similarity threshold (memoized so
  // we don't re-walk 30k colors on unrelated re-renders).
  const filteredColors = useMemo(() => {
    const normalizeForSearch = (s) => s.replace(/[‘’]/g, "'").toLowerCase();
    const normalizedSearch = normalizeForSearch(searchTerm.trim());
    const searchHex = normalizedSearch.replace(/^#/, '');
    const thresholdValue = parseFloat(similarityThreshold);
    const hasThreshold = !Number.isNaN(thresholdValue);
    const hasSearch = normalizedSearch.length > 0;
    const hasSelection = !!selectedColor;

    const applyThreshold = filterByThreshold && hasSelection && hasThreshold;

    let result;
    if (!hasSearch && !applyThreshold) {
      result = sortedColors;
    } else {
      result = sortedColors.filter(color => {
        if (hasSearch) {
          const nameMatch = normalizeForSearch(color.name).includes(normalizedSearch);
          const hexMatch = color.hex.toLowerCase().replace(/^#/, '').includes(searchHex);
          if (!nameMatch && !hexMatch) return false;
        }
        if (applyThreshold) {
          if (color.similarity === undefined || color.similarity < thresholdValue) {
            return false;
          }
        }
        return true;
      });
    }

    return reverseSort ? result.slice().reverse() : result;
  }, [sortedColors, searchTerm, similarityThreshold, selectedColor, reverseSort, filterByThreshold]);

  // Reset the display window whenever the filter or sort changes so the list
  // always starts at "top 100" instead of growing unbounded.
  useEffect(() => {
    setDisplayLimit(INITIAL_DISPLAY_LIMIT);
    if (listScrollRef.current) {
      listScrollRef.current.scrollTop = 0;
    }
  }, [searchTerm, similarityThreshold, selectedColor, reverseSort, filterByThreshold]);

  // Update the point material size and the raycaster's hit tolerance whenever
  // the user adjusts the slider in the settings tab.
  useEffect(() => {
    if (pointsMaterialRef.current) {
      pointsMaterialRef.current.size = pointSize;
      needsRenderRef.current = true;
    }
    if (highlightMaterialRef.current) {
      highlightMaterialRef.current.size = pointSize * 1.8;
      needsRenderRef.current = true;
    }
    if (raycasterRef.current) {
      raycasterRef.current.params.Points.threshold = Math.max(2, pointSize * 1.5);
    }
  }, [pointSize]);

  // Filter the 3D particle cloud when "Hide outliers" is on. We rebuild the
  // BufferGeometry from scratch with only the colors that meet the threshold;
  // when the toggle is off (or there's no reference/threshold) we restore the
  // full point cloud. `userData.filtered` lets us skip work when the cloud is
  // already in the right state.
  useEffect(() => {
    const particles = particlesRef.current;
    if (!particles) return;

    const thresholdValue = parseFloat(similarityThreshold);
    const hasThreshold = !Number.isNaN(thresholdValue);
    const shouldFilter = hideOutliers && !!selectedColor && hasThreshold;

    const wasFiltered = particles.userData.filtered === true;
    if (!shouldFilter && !wasFiltered) {
      return; // already showing everything — nothing to do
    }

    const source = shouldFilter
      ? sortedColors.filter(c => c.similarity !== undefined && c.similarity >= thresholdValue)
      : colorsRef.current;

    const n = source.length;
    const positions = new Float32Array(n * 3);
    const colorsArr = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
      const c = source[i];
      positions[i * 3] = (c.a / 127) * 150;
      positions[i * 3 + 1] = c.l;
      positions[i * 3 + 2] = (c.b / 127) * 150;

      const hex = c.hex.replace('#', '');
      colorsArr[i * 3] = parseInt(hex.substring(0, 2), 16) / 255;
      colorsArr[i * 3 + 1] = parseInt(hex.substring(2, 4), 16) / 255;
      colorsArr[i * 3 + 2] = parseInt(hex.substring(4, 6), 16) / 255;
    }

    const newGeom = new THREE.BufferGeometry();
    newGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    newGeom.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3));

    particles.geometry.dispose();
    particles.geometry = newGeom;
    particles.userData.filtered = shouldFilter;
    particles.userData.visibleColors = source;
    needsRenderRef.current = true;
  }, [hideOutliers, similarityThreshold, selectedColor, sortedColors]);

  // Render a white-glow halo cloud over points that meet the similarity threshold.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (highlightCloudRef.current) {
      scene.remove(highlightCloudRef.current);
      highlightCloudRef.current.geometry.dispose();
      highlightCloudRef.current = null;
    }
    if (highlightMaterialRef.current) {
      highlightMaterialRef.current.dispose();
      highlightMaterialRef.current = null;
    }

    const thresholdValue = parseFloat(similarityThreshold);
    if (!selectedColor || Number.isNaN(thresholdValue) || thresholdValue <= 0) {
      needsRenderRef.current = true;
      return;
    }

    const matchingColors = sortedColors.filter(
      c => c.similarity !== undefined && c.similarity >= thresholdValue
    );

    if (matchingColors.length === 0) {
      needsRenderRef.current = true;
      return;
    }

    const positions = new Float32Array(matchingColors.length * 3);
    matchingColors.forEach((c, i) => {
      positions[i * 3]     = (c.a / 127) * 150;
      positions[i * 3 + 1] = c.l;
      positions[i * 3 + 2] = (c.b / 127) * 150;
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      size: (pointsMaterialRef.current?.size ?? 1.5) * 1.8,
      color: 0xffffff,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    highlightMaterialRef.current = mat;
    const cloud = new THREE.Points(geom, mat);
    highlightCloudRef.current = cloud;
    scene.add(cloud);
    needsRenderRef.current = true;

    return () => {
      if (highlightCloudRef.current && sceneRef.current) {
        sceneRef.current.remove(highlightCloudRef.current);
        highlightCloudRef.current.geometry.dispose();
        highlightCloudRef.current = null;
      }
      if (highlightMaterialRef.current) {
        highlightMaterialRef.current.dispose();
        highlightMaterialRef.current = null;
      }
      needsRenderRef.current = true;
    };
  }, [sortedColors, similarityThreshold, selectedColor]);

  const visibleColors = useMemo(
    () => filteredColors.slice(0, displayLimit),
    [filteredColors, displayLimit]
  );
  const hiddenCount = Math.max(0, filteredColors.length - displayLimit);

  const handleListScroll = (e) => {
    if (hiddenCount === 0) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_LOAD_THRESHOLD_PX) {
      setDisplayLimit(d => d + DISPLAY_INCREMENT);
    }
  };

  return (
    <div className="visualization-container">
      <div ref={containerRef} className="scene-container" />

      {sortedColors.length > 0 && !panelCollapsed && (() => {
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
                  className={`panel-tab ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  Settings
                </button>
              </div>
              <button
                type="button"
                className="panel-minimize"
                onClick={() => setPanelCollapsed(true)}
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
                        onClick={() => {
                          setSelectedColor(null);
                          setSortedColors(colorsRef.current);
                          if (highlightMarkerRef.current && sceneRef.current) {
                            sceneRef.current.remove(highlightMarkerRef.current);
                            highlightMarkerRef.current = null;
                            needsRenderRef.current = true;
                          }
                        }}
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
                      placeholder="Search by name or hex (e.g. crimson or #ff0033)"
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
                        disabled={!selectedColor}
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
                      disabled={!selectedColor}
                      aria-label="Min similarity percentage"
                    />
                  </div>

                  <div className="filter-options">
                    <label
                      className={`option-check ${!selectedColor ? 'disabled' : ''}`}
                      title="Apply the similarity threshold to the list of colors below"
                    >
                      <input
                        type="checkbox"
                        checked={filterByThreshold}
                        onChange={(e) => setFilterByThreshold(e.target.checked)}
                        disabled={!selectedColor}
                      />
                      <span>Filter colors</span>
                    </label>
                    <label
                      className={`option-check ${!selectedColor ? 'disabled' : ''}`}
                      title={
                        selectedColor
                          ? 'Hide points in the 3D plot that don’t meet the threshold'
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
                      {reverseSort ? '↑ Least similar' : '↓ Most similar'}
                    </button>
                    <div className="filter-stats">
                      {visibleColors.length} / {filteredColors.length}
                    </div>
                  </div>
                </div>

                <div
                  className="color-list"
                  ref={listScrollRef}
                  onScroll={handleListScroll}
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
                          withinThreshold ? 'within-threshold' : ''
                        ].filter(Boolean).join(' ');
                        return (
                          <div
                            key={`${color.name}-${color.hex}-${idx}`}
                            className={classes}
                            onClick={() => handleColorSelect(color)}
                          >
                            <div
                              className="color-swatch"
                              style={{ backgroundColor: color.hex }}
                            />
                            <div className="color-info">
                              <div className="color-name">{color.name}</div>
                              <div className="color-hex">{color.hex.toUpperCase()}</div>
                              <div className="color-lab"><LabDisplay l={color.l} a={color.a} b={color.b} /></div>
                            </div>
                            {selectedColor && color.similarity !== undefined && (
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

            {activeTab === 'settings' && (
              <div className="settings-content">
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
              </div>
            )}
          </div>
        );
      })()}

      {sortedColors.length > 0 && panelCollapsed && (
        <button
          type="button"
          className="panel-show"
          onClick={() => setPanelCollapsed(false)}
          title="Show colors panel"
        >
          ☰ Colors
        </button>
      )}

      {inspectedColor && (() => {
        let inspectedSimilarity = null;
        if (selectedColor) {
          const d = deltaE2000(
            selectedColor.l, selectedColor.a, selectedColor.b,
            inspectedColor.l, inspectedColor.a, inspectedColor.b
          );
          inspectedSimilarity = Math.max(0, 100 - d);
        }
        const isAlreadyReference =
          selectedColor &&
          selectedColor.name === inspectedColor.name &&
          selectedColor.hex === inspectedColor.hex;
        return (
          <div className="inspected-panel">
            <div className="inspected-header">
              <span className="inspected-title">Inspected color</span>
              <button
                type="button"
                className="inspected-close"
                onClick={() => setInspectedColor(null)}
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
                {inspectedSimilarity !== null && (
                  <div className="inspected-similarity">
                    {inspectedSimilarity.toFixed(2)}% vs reference
                  </div>
                )}
              </div>
            </div>
            {!isAlreadyReference && (
              <button
                type="button"
                className="inspected-promote"
                onClick={() => {
                  handleColorSelect(inspectedColor);
                  setInspectedColor(null);
                }}
              >
                Use as reference
              </button>
            )}
          </div>
        );
      })()}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="loading">
          Loading...
        </div>
      )}
    </div>
  );
}
