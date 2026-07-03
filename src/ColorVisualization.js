import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import './ColorVisualization.css';
import { hexToLab, getColorPlotPos, deltaE2000, parseCSV } from './colorUtils';
import { buildLabAxesGroup, buildXyzAxesGroup } from './sceneHelpers';
import { ColorListPanel } from './components/ColorListPanel';
import { InspectedPanel } from './components/InspectedPanel';

export const INITIAL_DISPLAY_LIMIT = 100;
export const DISPLAY_INCREMENT = 100;
const SCROLL_LOAD_THRESHOLD_PX = 250;

function createLabelSprite(name, hex) {
  const res = 2;
  const fontSize = 13 * res;
  const padding = 5 * res;
  const lineGap = 3 * res;

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `bold ${fontSize}px sans-serif`;
  const nameW = measure.measureText(name).width;
  measure.font = `${fontSize}px monospace`;
  const hexW = measure.measureText(hex).width;

  const w = Math.ceil(Math.max(nameW, hexW) + padding * 2);
  const h = Math.ceil(fontSize * 2 + lineGap + padding * 2);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const r = 4 * res;
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(w - r, 0);
  ctx.arcTo(w, 0, w, r, r); ctx.lineTo(w, h - r);
  ctx.arcTo(w, h, w - r, h, r); ctx.lineTo(r, h);
  ctx.arcTo(0, h, 0, h - r, r); ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, padding, padding + fontSize);

  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(hex, padding, padding + fontSize + lineGap + fontSize);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  const worldH = 10;
  sprite.scale.set((w / h) * worldH, worldH, 1);
  return sprite;
}

export function ColorVisualization() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);
  const pointsMaterialRef = useRef(null);
  const highlightMarkerRef = useRef(null);
  const inspectMarkerRef = useRef(null);
  const highlightCloudRef = useRef(null);
  const highlightMaterialRef = useRef(null);
  const axesGroupRef = useRef(null);
  const selectedColorRef = useRef(null);
  const orbitTargetRef = useRef(null);
  const colorsRef = useRef([]);
  const needsRenderRef = useRef(true);
  const listScrollRef = useRef(null);
  const raycasterRef = useRef(null);
  const labelSpritesGroupRef = useRef(null);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);
  const [sortedColors, setSortedColors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rangeSearchTerm, setRangeSearchTerm] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState('');
  const [hideOutliers, setHideOutliers] = useState(false);
  const [reverseSort, setReverseSort] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY_LIMIT);
  const [inspectedColor, setInspectedColor] = useState(null);
  const [activeTab, setActiveTab] = useState('colors');
  const [pointSize, setPointSize] = useState(1.5);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [filterByThreshold, setFilterByThreshold] = useState(true);
  const [hidePercentage, setHidePercentage] = useState(false);
  const [plotMode, setPlotMode] = useState('lab');
  const [labelListColors, setLabelListColors] = useState(false);
  const [colorLists, setColorLists] = useState(() => {
    try {
      const saved = localStorage.getItem('colorLists');
      if (saved) return JSON.parse(saved);
      // Migrate old single list
      const old = localStorage.getItem('colorListPlot');
      if (old) return [{ id: 'list-0', name: 'List 1', colors: JSON.parse(old) }];
    } catch {}
    return [{ id: 'list-0', name: 'List 1', colors: [] }];
  });
  const [activeListId, setActiveListId] = useState('list-0');
  const [plotListOnly, setPlotListOnly] = useState(false);

  // ─── Scene initialization ────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    orbitTargetRef.current = new THREE.Vector3(0, 50, 0);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(100, 80, 100);
    camera.lookAt(0, 50, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

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
      const idx = intersects[0].index;
      const visible = particles.userData.visibleColors || colorsRef.current;
      const picked = visible[idx];
      if (picked) setInspectedColor(picked);
    };

    setupControls(camera, renderer, pickAtScreen);
    axesGroupRef.current = buildLabAxesGroup();
    scene.add(axesGroupRef.current);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      needsRenderRef.current = true;
    };
    window.addEventListener('resize', handleResize);

    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (needsRenderRef.current) {
        needsRenderRef.current = false;
        renderer.render(scene, camera);
      }
    };
    animate();

    loadCSVFile();

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

  // ─── Orbit / pan / zoom controls ────────────────────────────────────────────

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
        previousTouchMidpoint = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
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

        if (previousTouchDistance > 0) applyZoom(currentDistance - previousTouchDistance, 0.5);

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
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isDragging = true;
      }
    });
  };

  // ─── Scene helpers ───────────────────────────────────────────────────────────

  const addHighlightMarker = (x, y, z) => {
    const scene = sceneRef.current;
    if (highlightMarkerRef.current) scene.remove(highlightMarkerRef.current);
    const geometry = new THREE.SphereGeometry(3, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true, transparent: true, opacity: 0.7 });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(x, y, z);
    scene.add(marker);
    highlightMarkerRef.current = marker;
    needsRenderRef.current = true;
  };

  const createVisualization = (colors) => {
    const scene = sceneRef.current;
    if (particlesRef.current) {
      scene.remove(particlesRef.current);
      if (pointsMaterialRef.current) pointsMaterialRef.current.dispose();
      particlesRef.current.geometry.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors_array = [];

    colors.forEach(color => {
      const pos = getColorPlotPos(color, 'lab');
      positions.push(pos.x, pos.y, pos.z);
      const hex = color.hex.replace('#', '');
      colors_array.push(
        parseInt(hex.substring(0, 2), 16) / 255,
        parseInt(hex.substring(2, 4), 16) / 255,
        parseInt(hex.substring(4, 6), 16) / 255
      );
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors_array), 3));

    const pointsMaterial = new THREE.PointsMaterial({
      size: 1.5, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.8,
    });
    pointsMaterialRef.current = pointsMaterial;

    const particles = new THREE.Points(geometry, pointsMaterial);
    particles.userData.visibleColors = colors;
    particlesRef.current = particles;
    scene.add(particles);
    needsRenderRef.current = true;

    colorsRef.current = colors;
    setSortedColors(colors);
  };

  // ─── Data loading ────────────────────────────────────────────────────────────

  const loadCSVFile = async () => {
    try {
      setIsLoading(true);
      const csvPath = `${process.env.PUBLIC_URL}/colornames.csv`;
      const response = await fetch(csvPath);
      if (!response.ok) throw new Error(`Failed to load CSV: ${response.statusText}`);
      const csv = await response.text();
      const colors = parseCSV(csv);
      if (colors.length === 0) throw new Error('No colors found in CSV');
      createVisualization(colors);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      showError(`Error: ${err.message}`);
    }
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  // ─── Color selection & list management ──────────────────────────────────────

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    selectedColorRef.current = color;
    const pos = getColorPlotPos(color, plotMode);
    addHighlightMarker(pos.x, pos.y, pos.z);
    const sorted = colorsRef.current.map(c => {
      const distance = deltaE2000(color.l, color.a, color.b, c.l, c.a, c.b);
      return { ...c, distance, similarity: Math.max(0, 100 - distance) };
    }).sort((a, b) => a.distance - b.distance);
    setSortedColors(sorted);
  };

  const activeList = colorLists.find(l => l.id === activeListId) ?? colorLists[0];
  const listColors = activeList?.colors ?? [];

  const updateActiveList = (updater) =>
    setColorLists(prev => prev.map(l => l.id === activeListId ? { ...l, colors: updater(l.colors) } : l));

  const handleAddToList = (color) => {
    updateActiveList(prev => prev.some(c => c.hex === color.hex) ? prev : [...prev, color]);
  };

  const handleRemoveFromList = (color) => {
    updateActiveList(prev => prev.filter(c => c.hex !== color.hex));
  };

  const handleReorderList = (from, to) => {
    updateActiveList(prev => {
      const updated = [...prev];
      const [item] = updated.splice(from, 1);
      updated.splice(to, 0, item);
      return updated;
    });
  };

  const handleSortListByReference = () => {
    if (!selectedColor) return;
    updateActiveList(prev => [...prev].sort((a, b) =>
      deltaE2000(selectedColor.l, selectedColor.a, selectedColor.b, a.l, a.a, a.b) -
      deltaE2000(selectedColor.l, selectedColor.a, selectedColor.b, b.l, b.a, b.b)
    ));
  };

  const handleCreateList = () => {
    const id = `list-${Date.now()}`;
    setColorLists(prev => [...prev, { id, name: `List ${prev.length + 1}`, colors: [] }]);
    setActiveListId(id);
  };

  const handleDeleteList = (id) => {
    const remaining = colorLists.filter(l => l.id !== id);
    if (remaining.length === 0) {
      const fallback = { id: `list-${Date.now()}`, name: 'List 1', colors: [] };
      setColorLists([fallback]);
      setActiveListId(fallback.id);
    } else {
      setColorLists(remaining);
      if (activeListId === id) setActiveListId(remaining[0].id);
    }
    setPlotListOnly(false);
  };

  const handleRenameList = (id, name) => {
    setColorLists(prev => prev.map(l => l.id === id ? { ...l, name } : l));
  };

  const handleClearReference = () => {
    setSelectedColor(null);
    setSortedColors(colorsRef.current);
    if (highlightMarkerRef.current && sceneRef.current) {
      sceneRef.current.remove(highlightMarkerRef.current);
      highlightMarkerRef.current = null;
      needsRenderRef.current = true;
    }
  };

  // ─── Derived state ───────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      localStorage.setItem('colorLists', JSON.stringify(colorLists));
    } catch {}
  }, [colorLists]);

  // Turn off plotListOnly automatically if the list is cleared.
  useEffect(() => {
    if (listColors.length === 0 && plotListOnly) setPlotListOnly(false);
  }, [listColors, plotListOnly]);

  const isHexSearch = /^#?[0-9a-f]{6}$/i.test(searchTerm.trim());

  const isRangeSearch = (() => {
    const t = rangeSearchTerm.trim();
    if (!t.includes(':')) return false;
    if (/\s/.test(t)) {
      const tokens = t.split(/\s+/);
      return tokens.length === 3 && tokens.every(tok => /^[0-9a-f]{1,2}(?::[0-9a-f]{1,2})?$/i.test(tok));
    }
    return /^([0-9a-f]{2}(?::[0-9a-f]{2})?)([0-9a-f]{2}(?::[0-9a-f]{2})?)([0-9a-f]{2}(?::[0-9a-f]{2})?)$/i.test(t);
  })();

  // Range-filtered base set (alphabetical, used as plot source).
  const rangeFilteredColors = useMemo(() => {
    const t = rangeSearchTerm.trim().toLowerCase();
    if (!t.includes(':')) return null;
    let parts = null;
    if (/\s/.test(t)) {
      const tokens = t.split(/\s+/);
      if (tokens.length === 3 && tokens.every(tok => /^[0-9a-f]{1,2}(?::[0-9a-f]{1,2})?$/i.test(tok))) {
        parts = tokens;
      }
    } else {
      const m = t.match(/^([0-9a-f]{2}(?::[0-9a-f]{2})?)([0-9a-f]{2}(?::[0-9a-f]{2})?)([0-9a-f]{2}(?::[0-9a-f]{2})?)$/i);
      if (m) parts = [m[1], m[2], m[3]];
    }
    if (!parts) return null;
    const pad = (h) => h.length === 1 ? '0' + h : h;
    const parseChannel = (s) => {
      if (s.includes(':')) {
        const [lo, hi] = s.split(':');
        return { min: parseInt(pad(lo), 16), max: parseInt(pad(hi), 16) };
      }
      const v = parseInt(pad(s), 16);
      return { min: v, max: v };
    };
    const [rCh, gCh, bCh] = parts.map(parseChannel);
    return colorsRef.current
      .filter(c => {
        const hex = c.hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return r >= rCh.min && r <= rCh.max && g >= gCh.min && g <= gCh.max && b >= bCh.min && b <= bCh.max;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rangeSearchTerm]);

  // Filtered list: name/hex search + similarity threshold on top of range base.
  const filteredColors = useMemo(() => {
    let base = rangeFilteredColors !== null ? rangeFilteredColors : sortedColors;
    if (rangeFilteredColors !== null && selectedColor) {
      base = base.map(c => {
        const distance = deltaE2000(selectedColor.l, selectedColor.a, selectedColor.b, c.l, c.a, c.b);
        return { ...c, distance, similarity: Math.max(0, 100 - distance) };
      });
    }
    const normalizeForSearch = (s) => s.replace(/['']/g, "'").toLowerCase();
    const normalizedSearch = normalizeForSearch(searchTerm.trim());
    const searchHex = normalizedSearch.replace(/^#/, '');
    const thresholdValue = parseFloat(similarityThreshold);
    const hasThreshold = !Number.isNaN(thresholdValue);
    const hasSearch = normalizedSearch.length > 0;
    const applyThreshold = filterByThreshold && !!selectedColor && hasThreshold;

    const isFullHex = /^#?[0-9a-f]{6}$/i.test(normalizedSearch);
    if (isFullHex) {
      const lab = hexToLab(searchHex);
      if (lab) {
        let ranked = base.map(c => {
          const distance = deltaE2000(lab.l, lab.a, lab.b, c.l, c.a, c.b);
          return { ...c, distance, similarity: Math.max(0, 100 - distance) };
        }).sort((a, b) => a.distance - b.distance);
        if (filterByThreshold && hasThreshold) ranked = ranked.filter(c => c.similarity >= thresholdValue);
        return reverseSort ? ranked.slice().reverse() : ranked;
      }
    }

    let result;
    if (!hasSearch && !applyThreshold) {
      result = base;
    } else {
      result = base.filter(color => {
        if (hasSearch) {
          const nameMatch = normalizeForSearch(color.name).includes(normalizedSearch);
          const hexMatch = color.hex.toLowerCase().replace(/^#/, '').includes(searchHex);
          if (!nameMatch && !hexMatch) return false;
        }
        if (applyThreshold && (color.similarity === undefined || color.similarity < thresholdValue)) return false;
        return true;
      });
    }
    return reverseSort ? result.slice().reverse() : result;
  }, [rangeFilteredColors, sortedColors, searchTerm, similarityThreshold, selectedColor, reverseSort, filterByThreshold]);

  // Reset scroll/display when filters change.
  useEffect(() => {
    setDisplayLimit(INITIAL_DISPLAY_LIMIT);
    if (listScrollRef.current) listScrollRef.current.scrollTop = 0;
  }, [searchTerm, rangeSearchTerm, similarityThreshold, selectedColor, reverseSort, filterByThreshold]);

  // ─── Three.js reactive effects ───────────────────────────────────────────────

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

  useEffect(() => {
    const particles = particlesRef.current;
    if (!particles) return;

    let source;
    let shouldFilter;

    if (plotListOnly) {
      source = listColors;
      shouldFilter = true;
    } else if (isRangeSearch) {
      source = rangeFilteredColors;
      shouldFilter = true;
    } else {
      const thresholdValue = parseFloat(similarityThreshold);
      const hasThreshold = !Number.isNaN(thresholdValue);
      shouldFilter = hideOutliers && !!selectedColor && hasThreshold;
      const wasFiltered = particles.userData.filtered === true;
      if (!shouldFilter && !wasFiltered) return;
      source = shouldFilter
        ? sortedColors.filter(c => c.similarity !== undefined && c.similarity >= thresholdValue)
        : colorsRef.current;
    }

    const n = source.length;
    const positions = new Float32Array(n * 3);
    const colorsArr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const c = source[i];
      const p = getColorPlotPos(c, plotMode);
      positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
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
  }, [hideOutliers, similarityThreshold, selectedColor, sortedColors, plotMode, plotListOnly, listColors, isRangeSearch, rangeFilteredColors]);

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
    if (!selectedColor || Number.isNaN(thresholdValue) || thresholdValue <= 0 || hideOutliers || plotListOnly) {
      needsRenderRef.current = true;
      return;
    }

    // When range search is active, restrict halos to the visible (range-filtered) set only.
    const rangeHexSet = isRangeSearch && rangeFilteredColors
      ? new Set(rangeFilteredColors.map(c => c.hex))
      : null;

    const matchingColors = sortedColors.filter(c =>
      c.similarity !== undefined &&
      c.similarity >= thresholdValue &&
      (!rangeHexSet || rangeHexSet.has(c.hex))
    );
    if (matchingColors.length === 0) { needsRenderRef.current = true; return; }

    const positions = new Float32Array(matchingColors.length * 3);
    matchingColors.forEach((c, i) => {
      const p = getColorPlotPos(c, plotMode);
      positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: (pointsMaterialRef.current?.size ?? 1.5) * 1.8,
      color: 0xffffff, sizeAttenuation: true, transparent: true,
      opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false,
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
  }, [sortedColors, similarityThreshold, selectedColor, hideOutliers, plotMode, plotListOnly, isRangeSearch, rangeFilteredColors]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (inspectMarkerRef.current) {
      scene.remove(inspectMarkerRef.current);
      inspectMarkerRef.current = null;
    }
    if (inspectedColor) {
      const { x, y, z } = getColorPlotPos(inspectedColor, plotMode);
      const geometry = new THREE.SphereGeometry(3, 32, 32);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.7 });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(x, y, z);
      scene.add(marker);
      inspectMarkerRef.current = marker;
    }
    needsRenderRef.current = true;
  }, [inspectedColor, plotMode]);

  useEffect(() => {
    const particles = particlesRef.current;
    const scene = sceneRef.current;
    if (!particles || !scene || colorsRef.current.length === 0) return;

    const source = particles.userData.visibleColors || colorsRef.current;
    const positions = new Float32Array(source.length * 3);
    source.forEach((c, i) => {
      const p = getColorPlotPos(c, plotMode);
      positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
    });
    particles.geometry.attributes.position.array.set(positions);
    particles.geometry.attributes.position.needsUpdate = true;

    if (axesGroupRef.current) scene.remove(axesGroupRef.current);
    axesGroupRef.current = plotMode === 'xyz' ? buildXyzAxesGroup() : buildLabAxesGroup();
    scene.add(axesGroupRef.current);

    if (selectedColorRef.current && highlightMarkerRef.current) {
      const p = getColorPlotPos(selectedColorRef.current, plotMode);
      highlightMarkerRef.current.position.set(p.x, p.y, p.z);
    }
    needsRenderRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotMode]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const clearLabels = () => {
      if (labelSpritesGroupRef.current) {
        labelSpritesGroupRef.current.children.forEach(s => {
          s.material.map.dispose();
          s.material.dispose();
        });
        scene.remove(labelSpritesGroupRef.current);
        labelSpritesGroupRef.current = null;
        needsRenderRef.current = true;
      }
    };

    clearLabels();

    if (plotListOnly && labelListColors && listColors.length > 0) {
      const group = new THREE.Group();
      listColors.forEach(color => {
        const sprite = createLabelSprite(color.name, color.hex.toUpperCase());
        const pos = getColorPlotPos(color, plotMode);
        sprite.position.set(pos.x, pos.y + 6, pos.z);
        group.add(sprite);
      });
      labelSpritesGroupRef.current = group;
      scene.add(group);
      needsRenderRef.current = true;
    }

    return clearLabels;
  }, [plotListOnly, labelListColors, listColors, plotMode]);

  // ─── Render helpers ──────────────────────────────────────────────────────────

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

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="visualization-container">
      <div ref={containerRef} className="scene-container" />

      {sortedColors.length > 0 && !panelCollapsed && (
        <ColorListPanel
          allColors={sortedColors}
          selectedColor={selectedColor}
          inspectedColor={inspectedColor}
          colorLists={colorLists}
          activeListId={activeListId}
          listColors={listColors}
          filteredColors={filteredColors}
          visibleColors={visibleColors}
          hiddenCount={hiddenCount}
          activeTab={activeTab}
          searchTerm={searchTerm}
          rangeSearchTerm={rangeSearchTerm}
          similarityThreshold={similarityThreshold}
          hideOutliers={hideOutliers}
          reverseSort={reverseSort}
          filterByThreshold={filterByThreshold}
          hidePercentage={hidePercentage}
          plotMode={plotMode}
          plotListOnly={plotListOnly}
          labelListColors={labelListColors}
          pointSize={pointSize}
          isHexSearch={isHexSearch}
          isRangeSearch={isRangeSearch}
          setActiveTab={setActiveTab}
          setSearchTerm={setSearchTerm}
          setRangeSearchTerm={setRangeSearchTerm}
          setSimilarityThreshold={setSimilarityThreshold}
          setHideOutliers={setHideOutliers}
          setReverseSort={setReverseSort}
          setFilterByThreshold={setFilterByThreshold}
          setHidePercentage={setHidePercentage}
          setPlotMode={setPlotMode}
          setPointSize={setPointSize}
          setPlotListOnly={setPlotListOnly}
          setLabelListColors={setLabelListColors}
          setDisplayLimit={setDisplayLimit}
          setInspectedColor={setInspectedColor}
          setActiveListId={setActiveListId}
          onClearReference={handleClearReference}
          onRemoveFromList={handleRemoveFromList}
          onReorderList={handleReorderList}
          onSortListByReference={handleSortListByReference}
          onClearList={() => { updateActiveList(() => []); setPlotListOnly(false); }}
          onCreateList={handleCreateList}
          onDeleteList={handleDeleteList}
          onRenameList={handleRenameList}
          onMinimize={() => setPanelCollapsed(true)}
          listScrollRef={listScrollRef}
          onListScroll={handleListScroll}
        />
      )}

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

      {inspectedColor && (
        <InspectedPanel
          inspectedColor={inspectedColor}
          selectedColor={selectedColor}
          plotMode={plotMode}
          hidePercentage={hidePercentage}
          listColors={listColors}
          onClose={() => setInspectedColor(null)}
          onSetReference={() => { handleColorSelect(inspectedColor); setInspectedColor(null); }}
          onAddToList={handleAddToList}
        />
      )}

      {error && <div className="error">{error}</div>}
      {isLoading && <div className="loading">Loading...</div>}
    </div>
  );
}
