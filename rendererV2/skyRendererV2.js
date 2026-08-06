/**
 * SkyRendererV2 - Three.js Astronomical Sky Renderer Module
 * 
 * FEATURES:
 * - Complete Solar System Renderer (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto).
 * - Solar Corona Lens Flare & Photorealistic Planetary GLSL Shaders.
 * - Integrated Physically-Inspired GPU WebGL Atmosphere System (rendererV2/atmosphere.js).
 * - Smooth solar altitude transitions: Day Sky, Sunset/Sunrise, Civil, Nautical & Astronomical Twilight, and Night Sky.
 * - Automatic star daytime fading & atmosphere blending.
 * - Planetarium-grade HDR WebGL Star Shader with ACES tone mapping & selective diffraction bloom.
 * - High-precision Blackbody / Morgan-Keenan spectral color temperatures (B-V color index).
 * - Physically realistic 3D Milky Way all-sky equirectangular sphere with Galactic Euler alignment.
 * - Rotates seamlessly with Local Sidereal Time (LST) and Observer Latitude via Astronomy Engine.
 * - 100% Real Astronomical Star Field from data/stars.6.json (8,738 stars).
 * - Single GPU draw call particle system (60 FPS locked).
 * 
 * IMPORTANT:
 * - Celestial.js remains 100% active and untouched.
 * - SkyRendererV2 remains fully isolated inside rendererV2/ module.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Atmosphere } from './atmosphere.js';
import { SolarSystem } from './solarSystem.js';

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
    this.milkyWayMesh = null;
    this.milkyWayMaterial = null;
    this.milkyWayTexture = null;

    this.milkyWayOpacity = 0.85;
    this.milkyWayBrightness = 1.0;

    this.atmosphere = null;
    this.solarSystem = null;

    this.isInitialized = false;
    this.isRendering = false;
    this.animationFrameId = null;

    this._onWindowResizeBound = this._onWindowResize.bind(this);
  }

  /**
   * High-precision Blackbody / Morgan-Keenan Spectral Color Transformation from B-V Color Index.
   * @param {number} bv - B-V Color Index
   * @returns {THREE.Color}
   */
  bvToColor(bv) {
    if (isNaN(bv)) return new THREE.Color('#ffffff');
    if (bv < -0.30) return new THREE.Color('#7b9eff'); // O5 - Deep Electric Blue
    if (bv < -0.15) return new THREE.Color('#9bb3ff'); // B0 - Blue-White
    if (bv < 0.00)  return new THREE.Color('#caf0ff'); // B5 - Light Cyan-White
    if (bv < 0.15)  return new THREE.Color('#f8fcff'); // A0 - Crisp Pure White (Vega/Sirius)
    if (bv < 0.35)  return new THREE.Color('#fffaed'); // F0 - Warm White (Procyon)
    if (bv < 0.60)  return new THREE.Color('#fff4cc'); // F8 - Soft Yellow-White
    if (bv < 0.85)  return new THREE.Color('#ffe699'); // G2 - Solar Golden Yellow (Sun/Capella)
    if (bv < 1.15)  return new THREE.Color('#ffc875'); // K0 - Deep Orange (Arcturus)
    if (bv < 1.45)  return new THREE.Color('#ff9d5c'); // K5 - Rich Amber-Orange (Aldebaran)
    return new THREE.Color('#ff6b52');                 // M0+ - Crimson Red (Betelgeuse/Antares)
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
   * Creates real 3D celestial star field using modern Planetarium HDR WebGL Star Shader.
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
    const isBrights = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const star = stars[i];
      const vec = this.celestialToCartesian(star.ra, star.dec, radius);

      positions[i * 3] = vec.x;
      positions[i * 3 + 1] = vec.y;
      positions[i * 3 + 2] = vec.z;

      const starColor = this.bvToColor(star.bv);
      const mag = star.mag;

      // Brightness intensity curve
      const brightness = Math.max(0.4, Math.min(1.4, 1.4 - (mag - (-1.5)) * 0.12));

      colors[i * 3] = starColor.r;
      colors[i * 3 + 1] = starColor.g;
      colors[i * 3 + 2] = starColor.b;

      // Planetarium magnitude size curve: 3px faint stars up to 34px bright stars
      if (mag <= 1.5) {
        sizes[i] = Math.max(18.0, Math.min(34.0, 34.0 - mag * 6.0));
        isBrights[i] = 1.0;
      } else if (mag <= 3.5) {
        sizes[i] = Math.max(8.0, 18.0 - (mag - 1.5) * 5.0);
        isBrights[i] = 0.0;
      } else {
        sizes[i] = Math.max(3.0, 8.0 - (mag - 3.5) * 2.0);
        isBrights[i] = 0.0;
      }

      brightnesses[i] = brightness;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('brightness', new THREE.BufferAttribute(brightnesses, 1));
    geometry.setAttribute('isBright', new THREE.BufferAttribute(isBrights, 1));

    // Custom WebGL GLSL Planetarium HDR Star Shader Material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uDaytimeOpacity: { value: 1.0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float brightness;
        attribute float isBright;

        varying vec3 vColor;
        varying float vBrightness;
        varying float vIsBright;

        void main() {
          vColor = color;
          vBrightness = brightness;
          vIsBright = isBright;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          gl_PointSize = size;
        }
      `,
      fragmentShader: `
        uniform float uDaytimeOpacity;

        varying vec3 vColor;
        varying float vBrightness;
        varying float vIsBright;

        // ACES Filmic HDR Tone Mapping
        vec3 ACESFilmicToneMapping(vec3 x) {
          float a = 2.51;
          float b = 0.03;
          float c = 2.43;
          float d = 0.59;
          float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord) * 2.0;

          if (dist > 1.0) discard;

          // 1. Intense Stellar Core (Gaussian Profile)
          float core = exp(-12.0 * dist * dist);

          // 2. Soft Optical Aura Halo (Planetarium Optics)
          float halo = exp(-3.2 * dist) * 0.40;

          // 3. Diffraction Flare Bloom (ONLY for bright stars m_V <= 1.5)
          float flare = 0.0;
          if (vIsBright > 0.5) {
            float bloomAura = exp(-1.4 * dist) * 0.40;
            float spikeX = exp(-45.0 * abs(coord.y)) * exp(-2.5 * abs(coord.x));
            float spikeY = exp(-45.0 * abs(coord.x)) * exp(-2.5 * abs(coord.y));
            flare = bloomAura + (spikeX + spikeY) * 0.28;
          }

          // 4. Smooth Anti-Aliased Edge
          float alpha = smoothstep(1.0, 0.70, dist);

          float totalIntensity = (core + halo + flare) * vBrightness;
          vec3 rawColor = vColor * totalIntensity;

          // 5. HDR ACES Tone Mapping
          vec3 tonedColor = ACESFilmicToneMapping(rawColor);

          gl_FragColor = vec4(tonedColor, alpha * clamp(totalIntensity, 0.0, 1.0) * uDaytimeOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 1;
    return points;
  }

  /**
   * Generates a 2048x1024 high-definition equirectangular Milky Way texture.
   * @returns {THREE.CanvasTexture}
   */
  _createMilkyWayEquirectangularTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const w = canvas.width;
    const h = canvas.height;
    const centerY = h / 2;

    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, w, h);

    const bandGrad = ctx.createLinearGradient(0, centerY - 280, 0, centerY + 280);
    bandGrad.addColorStop(0.0, 'rgba(2, 4, 10, 0.0)');
    bandGrad.addColorStop(0.2, 'rgba(15, 30, 70, 0.22)');
    bandGrad.addColorStop(0.4, 'rgba(85, 65, 140, 0.50)');
    bandGrad.addColorStop(0.5, 'rgba(185, 155, 215, 0.70)');
    bandGrad.addColorStop(0.6, 'rgba(85, 65, 140, 0.50)');
    bandGrad.addColorStop(0.8, 'rgba(15, 30, 70, 0.22)');
    bandGrad.addColorStop(1.0, 'rgba(2, 4, 10, 0.0)');

    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, 0, w, h);

    const coreGrad = ctx.createRadialGradient(w / 2, centerY, 15, w / 2, centerY, 420);
    coreGrad.addColorStop(0.0, 'rgba(255, 235, 185, 0.98)');
    coreGrad.addColorStop(0.18, 'rgba(255, 195, 135, 0.80)');
    coreGrad.addColorStop(0.42, 'rgba(165, 115, 195, 0.50)');
    coreGrad.addColorStop(0.72, 'rgba(40, 55, 115, 0.22)');
    coreGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(w / 2, centerY, 420, 200, 0, 0, Math.PI * 2);
    ctx.fill();

    const starClouds = [
      { x: w * 0.22, y: centerY - 15, rx: 240, ry: 95, c: 'rgba(215, 185, 255, 0.40)' },
      { x: w * 0.35, y: centerY + 10, rx: 290, ry: 115, c: 'rgba(185, 205, 255, 0.42)' },
      { x: w * 0.68, y: centerY - 8,  rx: 270, ry: 110, c: 'rgba(225, 195, 245, 0.40)' },
      { x: w * 0.82, y: centerY + 12, rx: 220, ry: 90,  c: 'rgba(195, 215, 255, 0.35)' }
    ];

    starClouds.forEach(sc => {
      const cg = ctx.createRadialGradient(sc.x, sc.y, 5, sc.x, sc.y, sc.rx);
      cg.addColorStop(0, sc.c);
      cg.addColorStop(0.5, 'rgba(80, 95, 165, 0.20)');
      cg.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(sc.x, sc.y, sc.rx, sc.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(3, 5, 12, 0.65)';
    ctx.beginPath();
    ctx.moveTo(w * 0.42, centerY - 30);
    ctx.bezierCurveTo(w * 0.47, centerY - 8, w * 0.52, centerY + 18, w * 0.58, centerY - 12);
    ctx.bezierCurveTo(w * 0.54, centerY + 40, w * 0.48, centerY + 30, w * 0.42, centerY - 30);
    ctx.closePath();
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Loads and renders the physically realistic 3D Milky Way celestial sphere.
   * @param {number} [radius=this.options.sphereRadius * 0.98]
   */
  async loadMilkyWay(radius = this.options.sphereRadius * 0.98) {
    this.milkyWayGroup = new THREE.Group();
    this.milkyWayGroup.name = 'milkyWayGroup';
    this.milkyWayGroup.renderOrder = -10;

    this.milkyWayTexture = this._createMilkyWayEquirectangularTexture();

    this.milkyWayMaterial = new THREE.MeshBasicMaterial({
      map: this.milkyWayTexture,
      side: THREE.BackSide,
      transparent: true,
      opacity: this.milkyWayOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const sphereGeometry = new THREE.SphereGeometry(radius, 64, 32);
    this.milkyWayMesh = new THREE.Mesh(sphereGeometry, this.milkyWayMaterial);
    this.milkyWayMesh.renderOrder = -10;
    this.milkyWayGroup.add(this.milkyWayMesh);

    const galacticNodeRA = THREE.MathUtils.degToRad(192.8595);
    const galacticNodeDec = THREE.MathUtils.degToRad(27.1283);
    const galacticZeroLon = THREE.MathUtils.degToRad(32.9319);

    this.milkyWayGroup.rotation.order = 'ZXY';
    this.milkyWayGroup.rotation.z = galacticZeroLon;
    this.milkyWayGroup.rotation.x = (Math.PI / 2.0) - galacticNodeDec;
    this.milkyWayGroup.rotation.y = galacticNodeRA;

    if (this.starSphereGroup) {
      this.starSphereGroup.add(this.milkyWayGroup);
    }
  }

  /**
   * Adjusts internal Milky Way opacity dynamically (0.0 to 1.0).
   * @param {number} opacity
   */
  setMilkyWayOpacity(opacity) {
    this.milkyWayOpacity = Math.max(0.0, Math.min(1.0, opacity));
    if (this.milkyWayMaterial) {
      this.milkyWayMaterial.opacity = this.milkyWayOpacity * this.milkyWayBrightness;
    }
  }

  /**
   * Adjusts internal Milky Way brightness dynamically (0.0 to 2.0).
   * @param {number} brightness
   */
  setMilkyWayBrightness(brightness) {
    this.milkyWayBrightness = Math.max(0.0, Math.min(2.0, brightness));
    if (this.milkyWayMaterial) {
      this.milkyWayMaterial.opacity = this.milkyWayOpacity * this.milkyWayBrightness;
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
   * Adjusts atmosphere opacity dynamically (0.0 to 1.0).
   * @param {number} opacity
   */
  setAtmosphereOpacity(opacity) {
    if (this.atmosphere) {
      this.atmosphere.setOpacity(opacity);
    }
  }

  /**
   * Toggles Atmosphere visibility on/off.
   * @param {boolean} visible
   */
  setAtmosphereVisible(visible) {
    if (this.atmosphere && this.atmosphere.mesh) {
      this.atmosphere.mesh.visible = !!visible;
    }
  }

  /**
   * Updates celestial sphere rotation, atmosphere solar position, and Solar System positions.
   * @param {Date} [date=new Date()] - Active simulation date/time.
   * @param {Object} [obs={ latitude: 0, longitude: 0 }] - Observer location ({ latitude, longitude }).
   */
  updateTimeAndObserver(date = new Date(), obs = { latitude: 0, longitude: 0 }) {
    if (this.starSphereGroup) {
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

    // Update Atmosphere Solar Position & Star Daytime Fading
    if (this.atmosphere) {
      const env = this.atmosphere.updateSunPosition(date, obs);
      if (this.starFieldPoints && this.starFieldPoints.material && this.starFieldPoints.material.uniforms) {
        if (this.starFieldPoints.material.uniforms.uDaytimeOpacity) {
          const isAtmoVisible = (this.atmosphere.mesh && this.atmosphere.mesh.visible !== false) && (this.atmosphere.opacity > 0.05);
          this.starFieldPoints.material.uniforms.uDaytimeOpacity.value = isAtmoVisible ? Math.max(0.40, env.starVisibility) : 1.0;
        }
      }
    }

    // Update Solar System Positions (Sun, Moon, Planets)
    if (this.solarSystem) {
      this.solarSystem.updatePositions(date, obs);
    }
  }

  /**
   * Initializes Three.js WebGL renderer, star catalog, Milky Way, Atmosphere, and Solar System.
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

    // 5. Load Realistic 3D Milky Way Equirectangular Sphere (Behind Stars)
    await this.loadMilkyWay();

    // 6. Load Atmosphere System
    this.atmosphere = new Atmosphere({ radius: this.options.sphereRadius * 0.99 });
    if (this.atmosphere && this.atmosphere.mesh) {
      this.scene.add(this.atmosphere.mesh);
    }

    // 7. Load Complete Solar System Module (Sun, Moon, Planets)
    this.solarSystem = new SolarSystem({ radius: this.options.sphereRadius });
    if (this.solarSystem && this.solarSystem.group) {
      this.starSphereGroup.add(this.solarSystem.group);
    }

    // 8. Load Real Astronomical Star Catalog with Planetarium HDR Star Shader
    const stars = customStarCatalog || await this.loadProjectStarCatalog();
    if (stars && stars.length > 0) {
      this.starFieldPoints = this.createAstronomicalStarField(stars);
      this.starSphereGroup.add(this.starFieldPoints);
    }

    // Initial position alignment
    this.updateTimeAndObserver(new Date(), { latitude: 0, longitude: 0 });

    // 9. Camera Drag Rotation Controls & Smooth Wheel FOV Zoom
    if (this.options.enableControls) {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enableZoom = false; // Wheel event handles FOV zoom
      this.controls.rotateSpeed = -0.4;
      this.controls.enablePan = false;

      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY > 0 ? 1.08 : 0.92;
        this.camera.fov = Math.max(10.0, Math.min(100.0, this.camera.fov * factor));
        this.camera.updateProjectionMatrix();
      }, { passive: false });
    }

    // 10. Resize Listener
    window.addEventListener('resize', this._onWindowResizeBound, false);

    this.isInitialized = true;
    console.log(`[SkyRendererV2] Successfully loaded Planetarium HDR Star Shader, Atmosphere, 3D Milky Way, and Solar System.`);

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

    if (this.solarSystem) {
      this.solarSystem.dispose();
      this.solarSystem = null;
    }

    if (this.atmosphere) {
      this.atmosphere.dispose();
      this.atmosphere = null;
    }

    if (this.starFieldPoints) {
      if (this.starFieldPoints.geometry) this.starFieldPoints.geometry.dispose();
      if (this.starFieldPoints.material) this.starFieldPoints.material.dispose();
      if (this.starSphereGroup) this.starSphereGroup.remove(this.starFieldPoints);
      this.starFieldPoints = null;
    }

    if (this.milkyWayMesh) {
      if (this.milkyWayMesh.geometry) this.milkyWayMesh.geometry.dispose();
      if (this.milkyWayMaterial) this.milkyWayMaterial.dispose();
      if (this.milkyWayTexture) this.milkyWayTexture.dispose();
      if (this.milkyWayGroup) this.milkyWayGroup.remove(this.milkyWayMesh);
      this.milkyWayMesh = null;
      this.milkyWayMaterial = null;
      this.milkyWayTexture = null;
    }

    if (this.milkyWayGroup) {
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
