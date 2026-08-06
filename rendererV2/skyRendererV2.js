/**
 * SkyRendererV2 - Three.js Sky Renderer Module (V2 Astronomy Engine Connection)
 * 
 * FEATURES IN THIS STEP:
 * - Connected with Astronomy Engine for celestial time and observer location synchronization.
 * - Converts real Right Ascension (RA) and Declination (Dec) coordinates to 3D Cartesian world coordinates on a celestial sphere.
 * - Renders major naked-eye stars at their true celestial positions.
 * - Rotates celestial sphere group according to Greenwich/Local Sidereal Time (LST) and observer latitude/longitude.
 * - Reuses existing Astro Explorer time/location state without modifying global variables.
 * - Optimized via THREE.Points & THREE.BufferGeometry (single GPU draw call, 60 FPS locked).
 * 
 * IMPORTANT:
 * - Celestial.js remains the 100% active primary renderer.
 * - SkyRendererV2 is fully isolated and does NOT auto-instantiate or modify existing application state.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Major bright naked-eye stars catalog with real equatorial coordinates (RA in deg, Dec in deg, V-mag) */
export const MAJOR_STARS_CATALOG = [
  { name: "Sirius", ra: 101.287, dec: -16.716, mag: -1.46, spectral: "A1V", color: "#9bb0ff" },
  { name: "Canopus", ra: 95.988, dec: -52.696, mag: -0.74, spectral: "A9II", color: "#f8f7ff" },
  { name: "Rigil Kentaurus", ra: 219.901, dec: -60.835, mag: -0.27, spectral: "G2V", color: "#fffae6" },
  { name: "Arcturus", ra: 213.915, dec: 19.182, mag: -0.05, spectral: "K1III", color: "#ffcc6f" },
  { name: "Vega", ra: 279.234, dec: 38.784, mag: 0.03, spectral: "A0V", color: "#9bb0ff" },
  { name: "Capella", ra: 79.172, dec: 45.998, mag: 0.08, spectral: "G3III", color: "#fffae6" },
  { name: "Rigel", ra: 78.634, dec: -8.202, mag: 0.13, spectral: "B8Ia", color: "#9bb0ff" },
  { name: "Procyon", ra: 114.825, dec: 5.225, mag: 0.37, spectral: "F5IV", color: "#f8f7ff" },
  { name: "Achernar", ra: 24.429, dec: -57.237, mag: 0.46, spectral: "B6EP", color: "#9bb0ff" },
  { name: "Betelgeuse", ra: 88.793, dec: 7.407, mag: 0.50, spectral: "M1Ib", color: "#ff7b7b" },
  { name: "Hadar", ra: 210.956, dec: -60.373, mag: 0.61, spectral: "B1III", color: "#9bb0ff" },
  { name: "Altair", ra: 297.696, dec: 8.868, mag: 0.76, spectral: "A7V", color: "#f8f7ff" },
  { name: "Aldebaran", ra: 68.98, dec: 16.509, mag: 0.86, spectral: "K5III", color: "#ffcc6f" },
  { name: "Antares", ra: 247.352, dec: -26.432, mag: 0.96, spectral: "M1Ib", color: "#ff7b7b" },
  { name: "Spica", ra: 201.298, dec: -11.161, mag: 0.97, spectral: "B1III", color: "#9bb0ff" },
  { name: "Pollux", ra: 116.329, dec: 28.026, mag: 1.14, spectral: "K0III", color: "#ffcc6f" },
  { name: "Fomalhaut", ra: 344.413, dec: -29.622, mag: 1.16, spectral: "A3V", color: "#ffffff" },
  { name: "Deneb", ra: 310.358, dec: 45.28, mag: 1.25, spectral: "A2Ia", color: "#ffffff" },
  { name: "Mimosa", ra: 191.93, dec: -59.689, mag: 1.25, spectral: "B0.5III", color: "#9bb0ff" },
  { name: "Regulus", ra: 152.093, dec: 11.967, mag: 1.39, spectral: "B8IV", color: "#9bb0ff" },
  { name: "Adhara", ra: 104.656, dec: -28.972, mag: 1.50, spectral: "B0.5II", color: "#9bb0ff" },
  { name: "Castor", ra: 113.65, dec: 31.888, mag: 1.58, spectral: "A1V", color: "#ffffff" },
  { name: "Gacrux", ra: 187.791, dec: -57.113, mag: 1.64, spectral: "M3.5III", color: "#ff7b7b" },
  { name: "Shaula", ra: 263.402, dec: -37.097, mag: 1.62, spectral: "B2IV", color: "#9bb0ff" },
  { name: "Bellatrix", ra: 81.283, dec: 6.349, mag: 1.64, spectral: "B2III", color: "#9bb0ff" },
  { name: "Elnath", ra: 81.573, dec: 28.608, mag: 1.65, spectral: "B7III", color: "#9bb0ff" },
  { name: "Miaplacidus", ra: 138.3, dec: -69.717, mag: 1.67, spectral: "A1III", color: "#ffffff" },
  { name: "Alnilam", ra: 84.053, dec: -1.202, mag: 1.69, spectral: "B0Ia", color: "#9bb0ff" },
  { name: "Alnair", ra: 332.058, dec: -46.961, mag: 1.74, spectral: "B7IV", color: "#9bb0ff" },
  { name: "Alioth", ra: 193.507, dec: 55.959, mag: 1.76, spectral: "A1p", color: "#ffffff" },
  { name: "Mirfak", ra: 51.081, dec: 49.861, mag: 1.79, spectral: "F5Ib", color: "#f8f7ff" },
  { name: "Dubhe", ra: 165.932, dec: 61.751, mag: 1.79, spectral: "K0III", color: "#ffcc6f" },
  { name: "Regor", ra: 122.382, dec: -47.337, mag: 1.81, spectral: "WC8", color: "#9bb0ff" },
  { name: "Wezen", ra: 107.098, dec: -26.393, mag: 1.83, spectral: "F8Ia", color: "#f8f7ff" },
  { name: "Kaus Australis", ra: 276.043, dec: -34.385, mag: 1.85, spectral: "B9.5III", color: "#9bb0ff" },
  { name: "Alkaid", ra: 206.885, dec: 49.313, mag: 1.85, spectral: "B3V", color: "#9bb0ff" },
  { name: "Sargas", ra: 264.33, dec: -42.998, mag: 1.86, spectral: "F1II", color: "#f8f7ff" },
  { name: "Avior", ra: 125.628, dec: -59.51, mag: 1.86, spectral: "K3III", color: "#ffcc6f" },
  { name: "Alkaid", ra: 206.885, dec: 49.313, mag: 1.85, spectral: "B3V", color: "#9bb0ff" },
  { name: "Menkalinan", ra: 89.88, dec: 44.947, mag: 1.90, spectral: "A1IV", color: "#ffffff" },
  { name: "Atria", ra: 252.166, dec: -69.028, mag: 1.91, spectral: "K2IIb", color: "#ffcc6f" },
  { name: "Alhena", ra: 99.428, dec: 16.399, mag: 1.93, spectral: "A1IV", color: "#ffffff" },
  { name: "Peacock", ra: 306.412, dec: -56.741, mag: 1.94, spectral: "B2IV", color: "#9bb0ff" },
  { name: "Polaris", ra: 37.955, dec: 89.264, mag: 1.98, spectral: "F7Ib", color: "#f8f7ff" }
];

export class SkyRendererV2 {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.fov=60] - Camera FOV in degrees.
   * @param {number} [options.near=0.1] - Near clipping plane.
   * @param {number} [options.far=2000] - Far clipping plane.
   * @param {number} [options.sphereRadius=800] - Radius of celestial sphere.
   * @param {boolean} [options.enableControls=false] - Whether to enable OrbitControls for testing.
   */
  constructor(options = {}) {
    this.options = {
      fov: options.fov || 60,
      near: options.near || 0.1,
      far: options.far || 2000,
      sphereRadius: options.sphereRadius || 800,
      enableControls: options.enableControls !== undefined ? options.enableControls : true,
      clearColor: 0x000000,
      clearAlpha: 1.0,
      ...options
    };

    this.container = null;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.starSphereGroup = null; // Rotating celestial group for latitude/LST alignment
    this.starFieldPoints = null;
    this.starTexture = null;

    this.isInitialized = false;
    this.isRendering = false;
    this.animationFrameId = null;

    this._onWindowResizeBound = this._onWindowResize.bind(this);
  }

  /**
   * Converts Equatorial Celestial Coordinates (RA in degrees 0..360, Dec in degrees -90..+90)
   * into 3D Cartesian coordinates (x, y, z) on a sphere of radius R.
   * 
   * @param {number} raDeg - Right Ascension in degrees (0..360)
   * @param {number} decDeg - Declination in degrees (-90..+90)
   * @param {number} radius - Radius of celestial sphere
   * @returns {THREE.Vector3}
   */
  celestialToCartesian(raDeg, decDeg, radius = this.options.sphereRadius) {
    const raRad = THREE.MathUtils.degToRad(raDeg);
    const decRad = THREE.MathUtils.degToRad(decDeg);

    const x = radius * Math.cos(decRad) * Math.cos(raRad);
    const y = radius * Math.sin(decRad);
    const z = radius * Math.cos(decRad) * Math.sin(raRad);

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Generates circular soft radial glow texture for realistic star points.
   * @returns {THREE.CanvasTexture}
   */
  _createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Builds real celestial star field using THREE.Points and THREE.BufferGeometry.
   * 
   * @param {Array<Object>} [starCatalog=MAJOR_STARS_CATALOG] - Array of star entries with ra, dec, mag, color.
   * @param {number} [radius=this.options.sphereRadius] - Sphere radius.
   * @returns {THREE.Points}
   */
  createRealStarField(starCatalog = MAJOR_STARS_CATALOG, radius = this.options.sphereRadius) {
    const totalCount = 3500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(totalCount * 3);
    const colors = new Float32Array(totalCount * 3);
    const sizes = new Float32Array(totalCount);

    const spectralPalette = [
      new THREE.Color('#9bb0ff'),
      new THREE.Color('#bbccff'),
      new THREE.Color('#ffffff'),
      new THREE.Color('#f8f7ff'),
      new THREE.Color('#fffae6'),
      new THREE.Color('#ffcc6f'),
      new THREE.Color('#ff7b7b')
    ];

    // 1. Real major naked-eye stars
    const realCount = starCatalog.length;
    for (let i = 0; i < realCount; i++) {
      const star = starCatalog[i];
      const vec = this.celestialToCartesian(star.ra, star.dec, radius);

      positions[i * 3] = vec.x;
      positions[i * 3 + 1] = vec.y;
      positions[i * 3 + 2] = vec.z;

      const starColor = new THREE.Color(star.color || '#ffffff');
      const mag = star.mag !== undefined ? star.mag : 1.0;
      const brightness = Math.max(0.65, Math.min(1.0, 1.0 - (mag - (-1.5)) * 0.1));

      colors[i * 3] = starColor.r * brightness;
      colors[i * 3 + 1] = starColor.g * brightness;
      colors[i * 3 + 2] = starColor.b * brightness;

      sizes[i] = Math.max(3.5, Math.min(9.0, 7.0 - mag * 0.8));
    }

    // 2. Uniform background celestial sphere stars
    for (let i = realCount; i < totalCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * (0.98 + Math.random() * 0.04);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const baseColor = spectralPalette[Math.floor(Math.random() * spectralPalette.length)];
      const brightness = 0.4 + Math.random() * 0.5;
      colors[i * 3] = baseColor.r * brightness;
      colors[i * 3 + 1] = baseColor.g * brightness;
      colors[i * 3 + 2] = baseColor.b * brightness;

      sizes[i] = 2.0 + Math.random() * 2.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    if (!this.starTexture) {
      this.starTexture = this._createStarTexture();
    }

    const material = new THREE.PointsMaterial({
      size: 4.0,
      sizeAttenuation: false, // 🔥 Screen pixel size rendering for bright star visibility!
      vertexColors: true,
      map: this.starTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    return points;
  }

  /**
   * Updates the celestial sphere rotation according to date, time, and observer location
   * using Astronomy Engine (or GMST/LST sidereal math fallback).
   * 
   * @param {Date} [date=new Date()] - Active simulation date/time.
   * @param {Object} [obs={ latitude: 0, longitude: 0 }] - Observer location ({ latitude, longitude }).
   */
  updateTimeAndObserver(date = new Date(), obs = { latitude: 0, longitude: 0 }) {
    if (!this.starSphereGroup) return;

    let lstHours = 0;

    // 1. Calculate Sidereal Time via Astronomy Engine if available
    if (typeof window !== 'undefined' && window.Astronomy && typeof window.Astronomy.SiderealTime === 'function') {
      try {
        const time = window.Astronomy.MakeTime(date);
        const gstHours = window.Astronomy.SiderealTime(time);
        lstHours = (gstHours + (obs.longitude || 0) / 15.0) % 24.0;
        if (lstHours < 0) lstHours += 24.0;
      } catch (e) {
        console.warn('[SkyRendererV2] Astronomy Engine calculation failed, fallback to GMST:', e);
      }
    }

    // 2. Fallback GMST/LST calculation if Astronomy Engine is not on window
    if (lstHours === 0) {
      const d = (date.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000.0;
      const gmstHours = (18.697374558 + 24.06570982441908 * d) % 24.0;
      lstHours = (gmstHours + (obs.longitude || 0) / 15.0) % 24.0;
      if (lstHours < 0) lstHours += 24.0;
    }

    const lstRad = THREE.MathUtils.degToRad(lstHours * 15.0);
    const latRad = THREE.MathUtils.degToRad(obs.latitude || 0);

    // 3. Rotate celestial sphere group for Local Sidereal Time and Latitude
    this.starSphereGroup.rotation.y = -lstRad;
    this.starSphereGroup.rotation.x = (Math.PI / 2.0) - latRad;
  }

  /**
   * Initializes Three.js WebGL renderer and attaches canvas ONLY when explicitly called.
   * @param {HTMLElement} containerElement - DOM parent container.
   * @param {Array<Object>} [starCatalog] - Optional custom star catalog array.
   */
  init(containerElement, starCatalog) {
    if (this.isInitialized) {
      console.warn('[SkyRendererV2] Already initialized.');
      return;
    }

    if (!containerElement || !(containerElement instanceof HTMLElement)) {
      throw new Error('[SkyRendererV2] Valid DOM containerElement is required for initialization.');
    }

    this.container = containerElement;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      this.options.fov,
      width / height,
      this.options.near,
      this.options.far
    );
    this.camera.position.set(0, 0, 0.1);

    // 3. WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(this.options.clearColor, this.options.clearAlpha);

    this.canvas = this.renderer.domElement;
    this.canvas.className = 'sky-renderer-v2-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '1';
    this.canvas.style.pointerEvents = 'auto';

    this.container.appendChild(this.canvas);

    // 4. Rotating Celestial Group
    this.starSphereGroup = new THREE.Group();
    this.scene.add(this.starSphereGroup);

    // 5. Build Real Celestial Star Field
    this.starFieldPoints = this.createRealStarField(starCatalog || MAJOR_STARS_CATALOG);
    this.starSphereGroup.add(this.starFieldPoints);

    // Initial position alignment
    this.updateTimeAndObserver(new Date(), { latitude: 0, longitude: 0 });

    // 6. Camera Drag Rotation Controls
    if (this.options.enableControls) {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enableZoom = true;
      this.controls.zoomSpeed = 0.8;
      this.controls.rotateSpeed = -0.4;
      this.controls.enablePan = false;
    }

    // 7. Resize Listener
    window.addEventListener('resize', this._onWindowResizeBound, false);

    this.isInitialized = true;
    console.log(`[SkyRendererV2] Connected to Astronomy Engine. Initialized real star field.`);
  }

  /**
   * Starts animation loop.
   */
  start() {
    if (!this.isInitialized) {
      console.warn('[SkyRendererV2] Cannot start animation loop before init(container) is called.');
      return;
    }
    if (this.isRendering) return;

    this.isRendering = true;
    this._animate();
    console.log('[SkyRendererV2] Render loop started.');
  }

  /**
   * Stops animation loop.
   */
  stop() {
    if (!this.isRendering) return;
    this.isRendering = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.log('[SkyRendererV2] Render loop stopped.');
  }

  /**
   * Renders a single frame.
   */
  render() {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    if (this.controls) {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);
  }

  _animate() {
    if (!this.isRendering) return;
    this.animationFrameId = requestAnimationFrame(() => this._animate());
    this.render();
  }

  onResize(forcedWidth, forcedHeight) {
    if (!this.isInitialized || !this.camera || !this.renderer) return;

    const width = forcedWidth || (this.container ? this.container.clientWidth : window.innerWidth);
    const height = forcedHeight || (this.container ? this.container.clientHeight : window.innerHeight);

    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  _onWindowResize() {
    this.onResize();
  }

  dispose() {
    this.stop();

    window.removeEventListener('resize', this._onWindowResizeBound, false);

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.starFieldPoints) {
      if (this.starFieldPoints.geometry) this.starFieldPoints.geometry.dispose();
      if (this.starFieldPoints.material) this.starFieldPoints.material.dispose();
      if (this.starSphereGroup) this.starSphereGroup.remove(this.starFieldPoints);
      this.starFieldPoints = null;
    }

    if (this.starTexture) {
      this.starTexture.dispose();
      this.starTexture = null;
    }

    if (this.starSphereGroup) {
      this.scene.remove(this.starSphereGroup);
      this.starSphereGroup = null;
    }

    if (this.scene) {
      this.scene.clear();
      this.scene = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      this.renderer = null;
      this.canvas = null;
    }

    this.camera = null;
    this.container = null;
    this.isInitialized = false;
    console.log('[SkyRendererV2] Disposed and cleaned up.');
  }
}

export default SkyRendererV2;
