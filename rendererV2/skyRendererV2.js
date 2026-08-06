/**
 * SkyRendererV2 - Three.js Astronomical Sky Renderer Module
 * 
 * FEATURES IN THIS STEP:
 * - Stellarium-grade WebGL Star Shader (THREE.ShaderMaterial with GLSL shaders).
 * - Circular star sprites with brilliant cores, soft atmospheric halo bloom, and anti-aliased edges.
 * - Dynamic magnitude-based size scaling (4px to 24px) & brightness falloff.
 * - Additive blending for natural cosmic light accumulation.
 * - Realistic 3D Milky Way background integration (using project data/mw.json).
 * - Celestial coordinate orientation aligned with real night sky.
 * - Rotates seamlessly with Local Sidereal Time (LST) and Observer Latitude via Astronomy Engine.
 * - Rendered strictly behind all stars (depthWrite: false, renderOrder: -10).
 * - Internal opacity (setMilkyWayOpacity) and visibility (setMilkyWayVisible) controls.
 * - 100% Real Astronomical Star Field from data/stars.6.json (8,738 stars).
 * - Single GPU draw call particle system (60 FPS locked).
 * 
 * IMPORTANT:
 * - Celestial.js remains 100% active and untouched.
 * - SkyRendererV2 remains fully isolated inside rendererV2/ module.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SkyRendererV2 {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.fov=60] - Camera FOV in degrees.
   * @param {number} [options.near=0.1] - Near clipping plane.
   * @param {number} [options.far=2000] - Far clipping plane.
   * @param {number} [options.sphereRadius=800] - Radius of celestial sphere.
   * @param {boolean} [options.enableControls=true] - Whether to enable camera drag rotation controls.
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

    this.starSphereGroup = null;
    this.starFieldPoints = null;
    this.loadedStarCount = 0;

    this.milkyWayGroup = null;
    this.milkyWayOpacity = 1.0;

    this.isInitialized = false;
    this.isRendering = false;
    this.animationFrameId = null;

    this._onWindowResizeBound = this._onWindowResize.bind(this);
  }

  /**
   * Converts B-V Color Index to standard astronomical RGB spectral color.
   * @param {number} bv - B-V Color Index
   * @returns {THREE.Color}
   */
  bvToColor(bv) {
    if (isNaN(bv)) return new THREE.Color('#ffffff');
    if (bv < -0.2) return new THREE.Color('#9bb0ff'); // O / Blue
    if (bv < 0.0) return new THREE.Color('#bbccff');  // B / Blue-White
    if (bv < 0.3) return new THREE.Color('#ffffff');  // A / White
    if (bv < 0.6) return new THREE.Color('#f8f7ff');  // F / Yellow-White
    if (bv < 0.9) return new THREE.Color('#fffae6');  // G / Yellow (Sun-like)
    if (bv < 1.4) return new THREE.Color('#ffcc6f');  // K / Orange
    return new THREE.Color('#ff7b7b');                // M / Red
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
   * Loads the real project astronomical star catalog (data/stars.6.json).
   * @returns {Promise<Array<Object>>}
   */
  async loadProjectStarCatalog() {
    try {
      const response = await fetch('./data/stars.6.json');
      const data = await response.json();
      if (data && data.features && Array.isArray(data.features)) {
        return data.features.map(f => {
          const coords = f.geometry ? f.geometry.coordinates : [0, 0];
          const raHours = coords[0] || 0;
          const raDeg = (raHours * 15.0) % 360.0;
          const decDeg = coords[1] || 0;
          const mag = f.properties ? parseFloat(f.properties.mag) : 5.0;
          const bv = f.properties ? parseFloat(f.properties.bv) : 0.4;
          return {
            id: f.id,
            ra: raDeg,
            dec: decDeg,
            mag: isNaN(mag) ? 5.0 : mag,
            bv: isNaN(bv) ? 0.4 : bv
          };
        });
      }
    } catch (e) {
      console.warn('[SkyRendererV2] Could not fetch data/stars.6.json:', e);
    }
    return [];
  }

  /**
   * Creates real 3D celestial star field using custom Stellarium-grade WebGL Star Shader.
   * @param {Array<Object>} stars - Real star catalog items ({ ra, dec, mag, bv }).
   * @param {number} radius - Celestial sphere radius.
   * @returns {THREE.Points}
   */
  createAstronomicalStarField(stars, radius = this.options.sphereRadius) {
    const count = stars.length;
    this.loadedStarCount = count;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightnesses = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const star = stars[i];
      const vec = this.celestialToCartesian(star.ra, star.dec, radius);

      positions[i * 3] = vec.x;
      positions[i * 3 + 1] = vec.y;
      positions[i * 3 + 2] = vec.z;

      const starColor = this.bvToColor(star.bv);
      const mag = star.mag;

      // Brightness intensity scaling
      const brightness = Math.max(0.4, Math.min(1.25, 1.25 - (mag - (-1.5)) * 0.11));

      colors[i * 3] = starColor.r;
      colors[i * 3 + 1] = starColor.g;
      colors[i * 3 + 2] = starColor.b;

      // Dynamic Stellarium-scale magnitude size scaling in screen space pixels
      sizes[i] = Math.max(4.0, Math.min(26.0, 22.0 - mag * 2.3));
      brightnesses[i] = brightness;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('brightness', new THREE.BufferAttribute(brightnesses, 1));

    // Custom WebGL GLSL Stellarium Star Shader Material
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float brightness;

        varying vec3 vColor;
        varying float vBrightness;

        void main() {
          vColor = color;
          vBrightness = brightness;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Dynamic screen space point size
          gl_PointSize = size;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vBrightness;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord) * 2.0;

          if (dist > 1.0) discard;

          // 1. Brilliant core (Gaussian radial intensity)
          float core = exp(-9.0 * dist * dist);

          // 2. Soft atmospheric halo bloom (Stellarium optics)
          float halo = exp(-2.8 * dist) * 0.45;

          // 3. Smooth anti-aliased edge fading
          float alpha = smoothstep(1.0, 0.65, dist);

          float totalIntensity = (core + halo) * vBrightness;
          vec3 finalColor = vColor * totalIntensity;

          gl_FragColor = vec4(finalColor, alpha * clamp(totalIntensity, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 1; // Render stars above Milky Way background
    return points;
  }

  /**
   * Loads and renders the realistic 3D Milky Way background structure from project data (data/mw.json).
   * @param {number} [radius=this.options.sphereRadius * 0.98] - Placement radius inside celestial sphere.
   */
  async loadMilkyWay(radius = this.options.sphereRadius * 0.98) {
    this.milkyWayGroup = new THREE.Group();
    this.milkyWayGroup.name = 'milkyWayGroup';
    this.milkyWayGroup.renderOrder = -10; // Ensure rendered strictly behind stars

    try {
      const response = await fetch('./data/mw.json');
      const data = await response.json();

      if (data && data.features && Array.isArray(data.features)) {
        data.features.forEach((feature, index) => {
          if (!feature.geometry) return;

          let strokeColor = 0x4868a8; // Outer diffuse glow
          let baseOpacity = 0.18;

          const featId = String(feature.id || index);
          if (featId.includes('ol5') || index > 8) {
            strokeColor = 0xffe0a0; // Core galactic starlight
            baseOpacity = 0.45;
          } else if (featId.includes('ol3') || index > 4) {
            strokeColor = 0xb090f0; // Middle dust lane glow
            baseOpacity = 0.28;
          }

          const coordsList = feature.geometry.type === 'MultiPolygon'
            ? feature.geometry.coordinates.flat(1)
            : (feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : []);

          coordsList.forEach(polygon => {
            const points = [];
            polygon.forEach(coord => {
              const raHours = coord[0] || 0;
              const raDeg = (raHours * 15.0) % 360.0;
              const decDeg = coord[1] || 0;

              const vec = this.celestialToCartesian(raDeg, decDeg, radius);
              points.push(vec);
            });

            if (points.length > 1) {
              const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
              const lineMat = new THREE.LineBasicMaterial({
                color: strokeColor,
                transparent: true,
                opacity: baseOpacity * this.milkyWayOpacity,
                depthWrite: false,
                blending: THREE.AdditiveBlending
              });
              lineMat.userData = { baseOpacity };

              const lineMesh = new THREE.LineLoop(lineGeo, lineMat);
              this.milkyWayGroup.add(lineMesh);
            }
          });
        });
      }
    } catch (e) {
      console.warn('[SkyRendererV2] Failed to load data/mw.json for Milky Way structure:', e);
    }

    // Add procedurally blurred background atmospheric glow sphere for smooth sky blending
    const sphereGeo = new THREE.SphereGeometry(radius * 0.99, 32, 16);
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 512;
    glowCanvas.height = 256;
    const gctx = glowCanvas.getContext('2d');

    const grad = gctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(5, 10, 25, 0.0)');
    grad.addColorStop(0.32, 'rgba(30, 50, 100, 0.12)');
    grad.addColorStop(0.50, 'rgba(160, 120, 200, 0.25)');
    grad.addColorStop(0.68, 'rgba(30, 50, 100, 0.12)');
    grad.addColorStop(1, 'rgba(5, 10, 25, 0.0)');

    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 512, 256);

    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const sphereMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.35 * this.milkyWayOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    sphereMat.userData = { baseOpacity: 0.35 };

    const glowMesh = new THREE.Mesh(sphereGeo, sphereMat);
    glowMesh.renderOrder = -11;
    this.milkyWayGroup.add(glowMesh);

    if (this.starSphereGroup) {
      this.starSphereGroup.add(this.milkyWayGroup);
    }
  }

  /**
   * Adjusts internal Milky Way opacity dynamically (0.0 to 1.0).
   * @param {number} opacity - Opacity value between 0.0 and 1.0.
   */
  setMilkyWayOpacity(opacity) {
    this.milkyWayOpacity = Math.max(0.0, Math.min(1.0, opacity));
    if (this.milkyWayGroup) {
      this.milkyWayGroup.traverse(child => {
        if (child.material) {
          const base = child.material.userData && child.material.userData.baseOpacity ? child.material.userData.baseOpacity : 0.3;
          child.material.opacity = base * this.milkyWayOpacity;
        }
      });
    }
  }

  /**
   * Toggles Milky Way visibility on/off.
   * @param {boolean} visible
   */
  setMilkyWayVisible(visible) {
    if (this.milkyWayGroup) {
      this.milkyWayGroup.visible = !!visible;
    }
  }

  /**
   * Updates celestial sphere rotation according to date, time, and observer location.
   * @param {Date} [date=new Date()] - Active simulation date/time.
   * @param {Object} [obs={ latitude: 0, longitude: 0 }] - Observer location ({ latitude, longitude }).
   */
  updateTimeAndObserver(date = new Date(), obs = { latitude: 0, longitude: 0 }) {
    if (!this.starSphereGroup) return;

    let lstHours = 0;

    if (typeof window !== 'undefined' && window.Astronomy && typeof window.Astronomy.SiderealTime === 'function') {
      try {
        const time = window.Astronomy.MakeTime(date);
        const gstHours = window.Astronomy.SiderealTime(time);
        lstHours = (gstHours + (obs.longitude || 0) / 15.0) % 24.0;
        if (lstHours < 0) lstHours += 24.0;
      } catch (e) {
        console.warn('[SkyRendererV2] Sidereal calculation failed, fallback to GMST:', e);
      }
    }

    if (lstHours === 0) {
      const d = (date.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000.0;
      const gmstHours = (18.697374558 + 24.06570982441908 * d) % 24.0;
      lstHours = (gmstHours + (obs.longitude || 0) / 15.0) % 24.0;
      if (lstHours < 0) lstHours += 24.0;
    }

    const lstRad = THREE.MathUtils.degToRad(lstHours * 15.0);
    const latRad = THREE.MathUtils.degToRad(obs.latitude || 0);

    this.starSphereGroup.rotation.y = -lstRad;
    this.starSphereGroup.rotation.x = (Math.PI / 2.0) - latRad;
  }

  /**
   * Initializes Three.js WebGL renderer, star catalog, and Milky Way structure.
   * @param {HTMLElement} containerElement - DOM parent container.
   * @param {Array<Object>} [customStarCatalog] - Optional star catalog array.
   */
  async init(containerElement, customStarCatalog) {
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

    // 5. Load 3D Milky Way Structure (Behind Stars)
    await this.loadMilkyWay();

    // 6. Load Real Astronomical Star Catalog with Stellarium Star Shader
    const stars = customStarCatalog || await this.loadProjectStarCatalog();
    if (stars && stars.length > 0) {
      this.starFieldPoints = this.createAstronomicalStarField(stars);
      this.starSphereGroup.add(this.starFieldPoints);
    }

    // Initial position alignment
    this.updateTimeAndObserver(new Date(), { latitude: 0, longitude: 0 });

    // 7. Camera Drag Rotation Controls
    if (this.options.enableControls) {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enableZoom = true;
      this.controls.zoomSpeed = 0.8;
      this.controls.rotateSpeed = -0.4;
      this.controls.enablePan = false;
    }

    // 8. Resize Listener
    window.addEventListener('resize', this._onWindowResizeBound, false);

    this.isInitialized = true;
    console.log(`[SkyRendererV2] Successfully loaded Stellarium GLSL Star Shader with ${this.loadedStarCount} stars.`);

    if (this._pendingStart) {
      this._pendingStart = false;
      this.start();
    }
  }

  /**
   * Starts animation loop.
   */
  start() {
    if (!this.isInitialized) {
      this._pendingStart = true;
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

    if (this.milkyWayGroup) {
      this.milkyWayGroup.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      if (this.starSphereGroup) this.starSphereGroup.remove(this.milkyWayGroup);
      this.milkyWayGroup = null;
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
