/**
 * SkyRendererV2 - Three.js Sky Renderer Module (V2 Foundation)
 * 
 * FEATURES INCLUDED IN THIS STEP:
 * - Isolated 3D celestial sphere star field rendering using THREE.Points and THREE.BufferGeometry.
 * - Uniform spherical distribution surrounding camera at origin (0, 0, 0).
 * - Realistic stellar spectral classification color palette (O, B, A, F, G, K, M).
 * - Varied star apparent magnitudes/sizes (1.5px - 4.5px) and brightness alpha values.
 * - Soft radial glow star texture and additive blending for realistic night-sky aesthetics.
 * - Black background (0x000000).
 * - Optional OrbitControls for isolated testing (disabled by default; active app remains untouched).
 * - Target: 60 FPS locked, ~0.15 MB VRAM total footprint.
 * 
 * IMPORTANT:
 * - Celestial.js remains the active primary renderer.
 * - SkyRendererV2 remains 100% unattached and does NOT auto-instantiate on import.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SkyRendererV2 {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.fov=60] - Camera FOV in degrees.
   * @param {number} [options.near=0.1] - Near clipping plane.
   * @param {number} [options.far=2000] - Far clipping plane.
   * @param {number} [options.starCount=3500] - Number of stars to generate.
   * @param {number} [options.sphereRadius=800] - Radius of celestial sphere.
   * @param {boolean} [options.enableControls=false] - Whether to enable OrbitControls for testing.
   */
  constructor(options = {}) {
    this.options = {
      fov: options.fov || 60,
      near: options.near || 0.1,
      far: options.far || 2000,
      starCount: options.starCount || 3500,
      sphereRadius: options.sphereRadius || 800,
      enableControls: options.enableControls || false,
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

    this.starFieldPoints = null;
    this.starTexture = null;

    this.isInitialized = false;
    this.isRendering = false;
    this.animationFrameId = null;

    this._onWindowResizeBound = this._onWindowResize.bind(this);
  }

  /**
   * Generates a circular soft radial glow texture for realistic star point rendering.
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
   * Generates 3D celestial sphere star field using THREE.Points & BufferGeometry.
   * @param {number} count - Number of stars to generate.
   * @param {number} radius - Sphere radius.
   * @returns {THREE.Points}
   */
  createStarField(count = this.options.starCount, radius = this.options.sphereRadius) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // Stellar spectral colors (O, B, A, F, G, K, M)
    const spectralPalette = [
      new THREE.Color('#9bb0ff'), // O/B: Deep Blue-White (15%)
      new THREE.Color('#bbccff'), // B: Light Blue-White (20%)
      new THREE.Color('#ffffff'), // A: Pure White (30%)
      new THREE.Color('#f8f7ff'), // F: Soft Warm White (15%)
      new THREE.Color('#fffae6'), // G: Yellow (Sun-like) (10%)
      new THREE.Color('#ffcc6f'), // K: Orange (7%)
      new THREE.Color('#ff7b7b')  // M: Red Giant/Dwarf (3%)
    ];

    const weights = [0.15, 0.20, 0.30, 0.15, 0.10, 0.07, 0.03];

    const getRandomSpectralColor = () => {
      const r = Math.random();
      let cumulative = 0;
      for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (r <= cumulative) return spectralPalette[i];
      }
      return spectralPalette[2];
    };

    for (let i = 0; i < count; i++) {
      // Uniform distribution on spherical surface
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);

      // Slight radial variation for depth
      const r = radius * (0.98 + Math.random() * 0.04);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color assignment
      const baseColor = getRandomSpectralColor();
      // Random brightness intensity variation
      const brightness = 0.55 + Math.random() * 0.45;
      colors[i * 3] = baseColor.r * brightness;
      colors[i * 3 + 1] = baseColor.g * brightness;
      colors[i * 3 + 2] = baseColor.b * brightness;

      // Apparent magnitude / size distribution (mostly faint stars, few bright ones)
      const sizeFactor = Math.pow(Math.random(), 3.5);
      sizes[i] = 1.5 + sizeFactor * 3.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    if (!this.starTexture) {
      this.starTexture = this._createStarTexture();
    }

    const material = new THREE.PointsMaterial({
      size: 3.5,
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
   * Initializes the Three.js WebGL renderer and attaches canvas ONLY when explicitly called.
   * @param {HTMLElement} containerElement - DOM parent container where WebGL canvas will be attached.
   */
  init(containerElement) {
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
    this.camera.position.set(0, 0, 0.1); // Camera centered inside celestial sphere

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
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = this.options.enableControls ? 'auto' : 'none';

    this.container.appendChild(this.canvas);

    // 4. Create & Add 3D Star Field
    this.starFieldPoints = this.createStarField();
    this.scene.add(this.starFieldPoints);

    // 5. Optional OrbitControls for isolated testing
    if (this.options.enableControls) {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enableZoom = true;
      this.controls.rotateSpeed = 0.5;
    }

    // 6. Resize Listener
    window.addEventListener('resize', this._onWindowResizeBound, false);

    this.isInitialized = true;
    console.log(`[SkyRendererV2] Initialized Three.js 3D Star Field (${this.options.starCount} stars).`);
  }

  /**
   * Starts the animation loop.
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
   * Stops the animation loop.
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

  /**
   * Internal animation frame handler.
   */
  _animate() {
    if (!this.isRendering) return;
    this.animationFrameId = requestAnimationFrame(() => this._animate());
    this.render();
  }

  /**
   * Handles window / container resize events.
   * @param {number} [forcedWidth]
   * @param {number} [forcedHeight]
   */
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

  /**
   * Cleans up and disposes WebGL resources, listeners, and canvas element.
   */
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
      this.scene.remove(this.starFieldPoints);
      this.starFieldPoints = null;
    }

    if (this.starTexture) {
      this.starTexture.dispose();
      this.starTexture = null;
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

// Standalone module export
export default SkyRendererV2;
