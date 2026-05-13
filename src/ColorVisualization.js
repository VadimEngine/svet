import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './ColorVisualization.css';

export function ColorVisualization() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);
  const pointsMaterialRef = useRef(null);
  const statsRef = useRef(null);
  const errorRef = useRef(null);
  const loadingRef = useRef(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    // Setup controls
    setupControls(camera, renderer);
    addAxes(scene);

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Auto-load CSV file
    loadCSVFile();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const setupControls = (camera, renderer) => {
    const canvas = renderer.domElement;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        const radius = camera.position.length();
        const theta = Math.atan2(camera.position.x, camera.position.z);
        const phi = Math.acos(camera.position.y / radius);

        const newTheta = theta - deltaX * 0.005;
        const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + deltaY * 0.005));

        camera.position.x = radius * Math.sin(newPhi) * Math.sin(newTheta);
        camera.position.y = radius * Math.cos(newPhi);
        camera.position.z = radius * Math.sin(newPhi) * Math.cos(newTheta);
        camera.lookAt(0, 50, 0);

        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const currentRadius = camera.position.length();
      const zoomSpeed = 0.1;
      const newRadius = currentRadius + e.deltaY * zoomSpeed;
      const minRadius = 50;
      const maxRadius = 500;

      if (newRadius >= minRadius && newRadius <= maxRadius) {
        const direction = camera.position.clone().normalize();
        camera.position.copy(direction.multiplyScalar(newRadius));
      }
    }, { passive: false });
  };

  const addAxes = (scene) => {
    const axesLength = 150;

    // X axis (a*) - Red
    const xGeometry = new THREE.BufferGeometry();
    xGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, axesLength, 0, 0]),
      3
    ));
    const xLine = new THREE.Line(xGeometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
    scene.add(xLine);

    // Y axis (L*) - Green
    const yGeometry = new THREE.BufferGeometry();
    yGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, axesLength, 0]),
      3
    ));
    const yLine = new THREE.Line(yGeometry, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
    scene.add(yLine);

    // Z axis (b*) - Blue
    const zGeometry = new THREE.BufferGeometry();
    zGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, 0, axesLength]),
      3
    ));
    const zLine = new THREE.Line(zGeometry, new THREE.LineBasicMaterial({ color: 0x0000ff }));
    scene.add(zLine);
  };

  const loadCSVFile = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/colornames.csv');
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
    particlesRef.current = particles;
    scene.add(particles);

    // Update stats
    if (statsRef.current) {
      statsRef.current.textContent = `Loaded: ${colors.length} colors`;
    }
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => {
      setError('');
    }, 5000);
  };

  return (
    <div className="visualization-container">
      <div ref={containerRef} className="scene-container" />

      <div className="info-panel">
        <h3>LAB 3D Space</h3>
        <p><strong>X-axis:</strong> a* (-128 to 127)</p>
        <p><strong>Y-axis:</strong> L* (0 to 100)</p>
        <p><strong>Z-axis:</strong> b* (-128 to 127)</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>Drag to rotate, scroll to zoom</p>
        <div ref={statsRef} id="stats" style={{ marginTop: '0.5rem', color: '#888' }}></div>
      </div>

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
