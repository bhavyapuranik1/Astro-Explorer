/**
 * SkyRendererV2 - Standalone Three.js Sky Renderer Module (V2 Foundation)
 * 
 * IMPORTANT:
 * - This module is completely independent and unattached by default.
 * - It does NOT auto-instantiate or create DOM canvas elements upon file import.
 * - It initializes scene, perspective camera, WebGLRenderer, animation loop, and resize handling ONLY when explicitly invoked via `init(container)`.
 */

import * as THREE from 'three';

export class SkyRendererV2 {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.fov=60] - Field of view in degrees.
   * @param {number} [options.near=0.1] - Near clipping plane.
   * @param {number} [options.far=2000] - Far clipping plane.
   * @param {number} [options.clearColor=0x000000] - Canvas clear background color (default black).
   * @param {number} [options.clearAlpha=1.0] - Clear background alpha.
   */
  constructor(options = {}) {
    this.options = {
      fov: options.fov || 60,
      near: options.near || 0.1,
      far: options.far || 2000,
      clearColor: options.clearColor !== undefined ? options.clearColor : 0x000000,
      clearAlpha: options.clearAlpha !== undefined ? options.clearAlpha : 1.0,
      ...options
    };

    this.container = null;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.isInitialized = false;
    this.isRendering = false;
    this.animationFrameId = null;

    // Bound handlers for clean event listener cleanup
    this._onWindowResizeBound = this._onWindowResize.bind(this);
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
    this.camera.position.set(0, 0, 0);

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
    this.canvas.style.pointerEvents = 'none'; // Standby layer by default

    this.container.appendChild(this.canvas);

    // 4. Resize Listener
    window.addEventListener('resize', this._onWindowResizeBound, false);

    this.isInitialized = true;
    console.log('[SkyRendererV2] Successfully initialized blank Three.js WebGL scene.');
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
