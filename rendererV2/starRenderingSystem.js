/**
 * Advanced Stellarium Star Rendering System for SkyRendererV2
 * 
 * FEATURES:
 * 1. Single GPU BufferGeometry holding all catalog stars permanently (zero geometry rebuilds on slider change).
 * 2. Custom WebGL ShaderMaterial implementing Stellarium point-spread optics:
 *    - Anti-aliased circular Gaussian point sprites (no square pixels).
 *    - Faint stars render as tiny, crisp, anti-aliased pin-point dots without halos.
 *    - Bright stars (mag <= 2.0) receive dense core + soft atmospheric halo.
 *    - B-V Color Index to RGB astronomical spectral temperature tinting (O B A F G K M).
 * 3. Dynamic uMagLimit shader uniform for instantaneous 60 FPS slider interaction.
 * 4. Dynamic uFOV camera zoom scaling for crisp pin-point stars across all field of view levels.
 */

import * as THREE from 'three';
import StelStarCatalogLoader from './stelStarCatalogLoader.js';

export class StarRenderingSystem {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.radius=800] - Sphere radius on celestial sphere.
   */
  constructor(options = {}) {
    this.options = {
      radius: options.radius || 800,
      ...options
    };

    this.group = null;
    this.starPoints = null;
    this.starMaterial = null;
    this.starsList = [];
    this.starLabels = [];
    this.starNamesMap = {};

    this.magLimit = 6.5;
    this._lastMagLODTier = 0; // tracks which mag-based tier is currently active

    this.twinklingEnabled = true;
    this.twinklingSpeed = 0.5;
    this.twinklingIntensity = 0.27;
    this.starMagnitudeLimit = 4.0;
    this.twinklingTime = 0.0;

    // Star color saturation (> 1.0 = extra vivid / oversaturated for aesthetic vibrancy):
    this.starColorSaturation = 1.4;

    // Catalog stats & level boundaries
    this.catalogLoader = null;
    this.catalogStats = {
      loaded: false,
      total: 0,
      levels: { level0: 0, level1: 0, level2: 0, level3: 0 },
      active: 0
    };
    this.levelThresholds = {
      level0End: 0,
      level1End: 0,
      level2End: 0,
      level3End: 0
    };
  }

  /**
   * Converts B-V color index to RGB Color object (Astronomical blackbody curve).
   */
  bvToColor(bv) {
    // B-V color index mapping for stellar spectral classes (O B A F G K M)
    // Clamp to physical stellar B-V range: [-0.4, 2.0]
    bv = Math.max(-0.4, Math.min(2.0, Number(bv) || 0.0));
    let r = 1.0, g = 1.0, b = 1.0;

    if (bv < -0.05) {
      // O & B stars (Vivid Blue / Cyan - Hadar, Acrux, Spica, Rigel)
      const t = (bv + 0.4) / 0.35;
      r = 0.35 + t * 0.35; // 0.35 .. 0.70
      g = 0.65 + t * 0.25; // 0.65 .. 0.90
      b = 1.0;             // 1.0
    } else if (bv < 0.35) {
      // A stars (Crisp Ice White / Blue-White - Sirius, Vega, Altair)
      const t = (bv + 0.05) / 0.40;
      r = 0.70 + t * 0.28; // 0.70 .. 0.98
      g = 0.90 + t * 0.08; // 0.90 .. 0.98
      b = 1.0;
    } else if (bv < 0.75) {
      // F & G stars (Warm Yellow / Golden Amber - Sun, Alpha Centauri, Capella)
      const t = (bv - 0.35) / 0.40;
      r = 1.0;
      g = 0.98 - t * 0.18; // 0.98 .. 0.80
      b = 0.95 - t * 0.55; // 0.95 .. 0.40
    } else if (bv < 1.35) {
      // K stars (Rich Deep Orange - Arcturus, Aldebaran, Pollux)
      const t = (bv - 0.75) / 0.60;
      r = 1.0;
      g = 0.80 - t * 0.35; // 0.80 .. 0.45
      b = 0.40 - t * 0.30; // 0.40 .. 0.10
    } else {
      // M stars (Vivid Coral Red / Deep Ruby Red - Betelgeuse, Antares, Alphard, Gacrux)
      const t = Math.min(1.0, (bv - 1.35) / 0.65);
      r = 1.0;
      g = 0.45 - t * 0.25; // 0.45 .. 0.20
      b = 0.10 - t * 0.05; // 0.10 .. 0.05
    }

    return new THREE.Color(r, g, b);
  }


  /**
   * Converts Celestial RA (deg) & Dec (deg) to 3D Cartesian Vector3.
   */
  celestialToCartesian(raDeg, decDeg, radius = this.options.radius) {
    const raRad = THREE.MathUtils.degToRad(raDeg);
    const decRad = THREE.MathUtils.degToRad(decDeg);

    const x = radius * Math.cos(decRad) * Math.cos(raRad);
    const y = radius * Math.sin(decRad);
    const z = radius * Math.cos(decRad) * Math.sin(raRad);

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Loads Stellarium binary catalogs with fallback to data/stars.6.json.
   */
  async loadCatalog() {
    let primaryStars = [];
    try {
      const resNames = await fetch('./data/starnames.json');
      this.starNamesMap = await resNames.json();
    } catch (e) {
      console.warn('[StarRenderingSystem] Could not fetch data/starnames.json:', e);
    }

    // Fetch primary named stars (stars.6.json) with proper name mapping
    try {
      const res6 = await fetch('./data/stars.6.json');
      const data6 = await res6.json();
      if (data6 && Array.isArray(data6.features)) {
        data6.features.forEach(f => {
          if (!f.geometry || !Array.isArray(f.geometry.coordinates)) return;
          let ra = f.geometry.coordinates[0];
          if (ra < 0) ra += 360.0;
          const dec = f.geometry.coordinates[1];
          const hip = f.id ? Number(f.id) : null;
          const mag = f.properties && f.properties.mag !== undefined ? f.properties.mag : 5.0;
          const bv = f.properties && f.properties.bv !== undefined ? parseFloat(f.properties.bv) : 0.5;

          let name = null, properName = null, bayerName = null;
          if (hip && this.starNamesMap[hip]) {
            const nameData = this.starNamesMap[hip];
            properName = nameData.name && nameData.name.trim() !== '' ? nameData.name.trim() : null;
            bayerName = nameData.bayer && nameData.c ? `${nameData.bayer} ${nameData.c}` : (nameData.flam && nameData.c ? `${nameData.flam} ${nameData.c}` : null);
            name = properName || bayerName;
          }

          const starObj = {
            id: hip ? `HIP ${hip}` : `STAR_6_${f.id}`,
            hip: hip,
            name: name || (hip ? `HIP ${hip}` : `Star ${f.id}`),
            displayName: name || (hip ? `HIP ${hip}` : `Star ${f.id}`),
            properName: properName,
            bayerName: bayerName,
            ra,
            dec,
            mag,
            bv,
            type: 'star'
          };
          primaryStars.push(starObj);
        });
        // console.log(`[StarRenderingSystem] Loaded ${primaryStars.length} primary named stars from stars.6.json.`);
      }
    } catch (e) {
      console.warn('[StarRenderingSystem] Could not fetch data/stars.6.json:', e);
    }

    this.catalogLoader = new StelStarCatalogLoader();
    let loadedCatalog = false;

    try {
      loadedCatalog = await this.catalogLoader.loadAll('./data/stars/hip_gaia3/');
    } catch (e) {
      console.warn('[StarRenderingSystem] Stellarium catalog load exception, falling back:', e);
    }

    const primaryHipSet = new Set(primaryStars.filter(s => s.hip).map(s => s.hip));

    let l0 = [], l1 = [], l2 = [], l3 = [];
    if (loadedCatalog && this.catalogLoader.totalCount > 0) {
      l0 = (this.catalogLoader.parsedLevels.level0 || []).filter(s => !s.hip || !primaryHipSet.has(s.hip));
      l1 = (this.catalogLoader.parsedLevels.level1 || []).filter(s => !s.hip || !primaryHipSet.has(s.hip));
      l2 = (this.catalogLoader.parsedLevels.level2 || []).filter(s => !s.hip || !primaryHipSet.has(s.hip));
      l3 = (this.catalogLoader.parsedLevels.level3 || []).filter(s => !s.hip || !primaryHipSet.has(s.hip));

      [...l0, ...l1, ...l2].forEach(star => {
        if (star.hip && this.starNamesMap[star.hip]) {
          const nameData = this.starNamesMap[star.hip];
          const properName = nameData.name && nameData.name.trim() !== '' ? nameData.name.trim() : null;
          const bayerName = nameData.bayer && nameData.c ? `${nameData.bayer} ${nameData.c}` : (nameData.flam && nameData.c ? `${nameData.flam} ${nameData.c}` : null);
          if (properName) star.properName = properName;
          if (bayerName) star.bayerName = bayerName;
          star.name = properName || bayerName || star.name || star.id;
          star.displayName = star.name;
        }
      });
    }

    const level0Stars = [...primaryStars, ...l0];

    this.parsedLevelArrays = {
      level0: level0Stars,
      level1: l1,
      level2: l2,
      level3: l3
    };

    // Construct master deduplicated stars list for search/picking
    const masterSet = new Set();
    this.starsList = [];
    [level0Stars, l1, l2, l3].forEach(lvlArr => {
      lvlArr.forEach(star => {
        if (star.hip && masterSet.has(star.hip)) return;
        if (star.hip) masterSet.add(star.hip);
        this.starsList.push(star);
      });
    });

    this.catalogStats = {
      loaded: true,
      total: this.starsList.length,
      levels: {
        level0: level0Stars.length,
        level1: l1.length,
        level2: l2.length,
        level3: l3.length
      },
      active: level0Stars.length
    };

    // console.log(`[StarRenderingSystem] Successfully initialized star catalog with ${this.starsList.length} total deduplicated stars (${primaryStars.length} primary named stars).`);
  }

  /**
   * Returns target LOD level (0..3) based on camera FOV.
   * Wide FOV (>55): LOD 0
   * Medium FOV (35-55): LOD 1
   * Close FOV (20-35): LOD 2
   * Deep Zoom (<=20): LOD 3
   */
  getActiveStarLOD(fov) {
    const current = this.currentLOD !== undefined && this.currentLOD >= 0 ? this.currentLOD : -1;

    if (current === 3) {
      if (fov > 22.0) return 2;
      return 3;
    }
    if (current === 2) {
      if (fov <= 18.0) return 3;
      if (fov > 37.0) return 1;
      return 2;
    }
    if (current === 1) {
      if (fov <= 33.0) return 2;
      if (fov > 57.0) return 0;
      return 1;
    }
    if (current === 0) {
      if (fov <= 53.0) return 1;
      return 0;
    }

    if (fov <= 20.0) return 3;
    if (fov <= 35.0) return 2;
    if (fov <= 55.0) return 1;
    return 0;
  }

  /**
   * Rebuilds GPU attributes for active deduplicated star set for target LOD level.
   */
  rebuildActiveStarBuffer(targetLOD) {
    if (!this.starPoints || !this.starPoints.geometry) return;

    const renderedHipIds = new Set();
    let duplicateCount = 0;
    const activeStars = [];

    let effectiveLOD = targetLOD;
    if (this.magLimit > 9.0) effectiveLOD = Math.max(effectiveLOD, 3);
    else if (this.magLimit > 7.5) effectiveLOD = Math.max(effectiveLOD, 2);
    else if (this.magLimit > 6.0) effectiveLOD = Math.max(effectiveLOD, 1);

    const levelsToInclude = [0];
    if (effectiveLOD >= 1) levelsToInclude.push(1);
    if (effectiveLOD >= 2) levelsToInclude.push(2);
    if (effectiveLOD >= 3) levelsToInclude.push(3);

    levelsToInclude.forEach(lvl => {
      const starsInLevel = (this.parsedLevelArrays && this.parsedLevelArrays[`level${lvl}`]) ? this.parsedLevelArrays[`level${lvl}`] : [];
      for (let i = 0; i < starsInLevel.length; i++) {
        const star = starsInLevel[i];
        if (star.hip && renderedHipIds.has(star.hip)) {
          duplicateCount++;
          continue;
        }
        if (star.hip) {
          renderedHipIds.add(star.hip);
        }
        activeStars.push(star);
      }
    });

    const count = activeStars.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const mags = new Float32Array(count);
    const phases = new Float32Array(count);

    this.starLabels = [];

    for (let i = 0; i < count; i++) {
      const star = activeStars[i];
      const vec = this.celestialToCartesian(star.ra, star.dec, this.options.radius);

      positions[i * 3] = vec.x;
      positions[i * 3 + 1] = vec.y;
      positions[i * 3 + 2] = vec.z;

      const starColor = this.bvToColor(star.bv);
      colors[i * 3] = starColor.r;
      colors[i * 3 + 1] = starColor.g;
      colors[i * 3 + 2] = starColor.b;

      mags[i] = Number.isFinite(star.mag) ? star.mag : 5.0;

      phases[i] = ((i * 12.9898 + star.ra * 78.233 + star.dec * 37.719) % 6.2831853 + 6.2831853) % 6.2831853;

      if (star.name && !star.name.startsWith('HIP ') && !star.name.startsWith('Star ') && star.mag <= 3.5) {
        this.starLabels.push({
          id: star.hip ? `HIP ${star.hip}` : star.id || star.name,
          name: star.name,
          displayName: star.name,
          type: 'star',
          ra: star.ra,
          dec: star.dec,
          mag: star.mag,
          position: vec,
          color: '#ffffff',
          priority: star.mag <= 1.0 ? 0 : (star.mag <= 2.5 ? 1 : 2),
          rawObj: star
        });
      }
    } // end for loop

    const geometry = this.starPoints.geometry;
    geometry.dispose();

    const posAttr = new THREE.BufferAttribute(positions, 3);
    const colorAttr = new THREE.BufferAttribute(colors, 3);
    const magAttr = new THREE.BufferAttribute(mags, 1);
    const twinkleAttr = new THREE.BufferAttribute(phases, 1);

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    magAttr.needsUpdate = true;
    twinkleAttr.needsUpdate = true;

    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('aColor', colorAttr);
    geometry.setAttribute('aMag', magAttr);
    geometry.setAttribute('aTwinklePhase', twinkleAttr);
    geometry.setDrawRange(0, count);

    this.currentLOD = targetLOD;
    this.activeStarsList = activeStars;
    this.duplicateStarsRemoved = duplicateCount;
    if (this.catalogStats) {
      this.catalogStats.active = count;
    }
  }

  starLODStats() {
    return {
      currentLOD: this.currentLOD !== undefined ? this.currentLOD : 0,
      fov: this.currentFOV || 60,
      level0: (this.parsedLevelArrays && this.parsedLevelArrays.level0) ? this.parsedLevelArrays.level0.length : 0,
      level1: (this.parsedLevelArrays && this.parsedLevelArrays.level1) ? this.parsedLevelArrays.level1.length : 0,
      level2: (this.parsedLevelArrays && this.parsedLevelArrays.level2) ? this.parsedLevelArrays.level2.length : 0,
      level3: (this.parsedLevelArrays && this.parsedLevelArrays.level3) ? this.parsedLevelArrays.level3.length : 0,
      activeStars: this.activeStarsList ? this.activeStarsList.length : 0,
      duplicateStarsRemoved: this.duplicateStarsRemoved || 0
    };
  }

  /**
   * Initializes single permanent GPU BufferGeometry & Stellarium ShaderMaterial.
   */
  async init() {
    this.group = new THREE.Group();
    this.group.name = 'starRenderingSystemGroup';

    await this.loadCatalog();

    const geometry = new THREE.BufferGeometry();
    const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1.0;
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uMagLimit: { value: this.magLimit },
        uFOV: { value: 60.0 },
        uPixelRatio: { value: pixelRatio },
        uBrightness: { value: 1.0 },
        uDaytimeOpacity: { value: 1.0 },
        uGlowIntensity: {
    value: 0.5
},

uGlowEnabled: {
    value: true
},
uTwinklingEnabled: {
    value: this.twinklingEnabled
},

uTwinklingSpeed: {
    value: this.twinklingSpeed
},

uTwinklingIntensity: {
    value: this.twinklingIntensity
},

uTime: {
    value: 0.0
},
        uColorSaturation: {
          value: this.starColorSaturation
        },
        uShowGround: {
          value: true
        }
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aMag;
        attribute float aTwinklePhase;

        varying vec3 vColor;
        varying float vMag;
        varying float vAlpha;
        varying float vTwinklePhase;
        varying float vBrightness;
        varying float vIsBright;

        uniform float uMagLimit;
        uniform float uFOV;
        uniform float uPixelRatio;
        uniform float uBrightness;
        uniform float uDaytimeOpacity;
        uniform bool uShowGround;

        void main() {
          vColor = aColor;
          vMag = aMag;
          vTwinklePhase = aTwinklePhase;

          // 1. Transform star local position into 3D World Space using modelMatrix
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          float magDiff = uMagLimit - aMag;

          // 2. Magnitude limit test
          if (magDiff < -0.5) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vAlpha = 0.0;
            vBrightness = 0.0;
            vIsBright = 0.0;
          } else {
            vAlpha = clamp(magDiff + 0.5, 0.0, 1.0);
            vec4 mvPosition = viewMatrix * worldPosition;
            gl_Position = projectionMatrix * mvPosition;

            // Brightness intensity curve
            vBrightness = max(0.4, min(1.4, 1.4 - (aMag - (-1.5)) * 0.12));

            // STELLAR DISK SIZE
            // Restores historical star-size relationship:
            // Bright stars = larger disks, Faint stars = smaller but clearly visible disks
            float baseSize;
            if (aMag <= -1.0) {
              baseSize = 28.0;
            } else if (aMag <= 1.0) {
              baseSize = 22.0 - (aMag + 1.0) * 3.0;
            } else if (aMag <= 3.0) {
              baseSize = 16.0 - (aMag - 1.0) * 3.0;
            } else if (aMag <= 5.0) {
              baseSize = 10.0 - (aMag - 3.0) * 1.5;
            } else {
              baseSize = max(4.5, 7.0 - (aMag - 5.0) * 0.5);
            }

            if (aMag <= 1.5) {
              vIsBright = 1.0;
            } else {
              vIsBright = 0.0;
            }

            float fovFactor = clamp(60.0 / uFOV, 0.75, 1.8);
            gl_PointSize = baseSize * fovFactor * max(uPixelRatio, 1.0);
          }
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vMag;
        varying float vAlpha;
        varying float vTwinklePhase;
        varying float vBrightness;
        varying float vIsBright;

        uniform float uBrightness;
        uniform float uDaytimeOpacity;
        uniform bool uTwinklingEnabled;
        uniform float uTwinklingSpeed;
        uniform float uTwinklingIntensity;
        uniform float uTime;
        uniform float uColorSaturation;
        uniform float uGlowIntensity;

        void main() {
          if (vAlpha < 0.01) discard;

          vec2 coord = gl_PointCoord - vec2(0.5);
          float r = length(coord) * 2.0;
          if (r > 1.0) discard;

          // ----------------------------------------------------
          // STAR TWINKLING / ORGANIC ATMOSPHERIC SCINTILLATION
          // ----------------------------------------------------
          float twinkleFactor = 1.0;
          if (uTwinklingEnabled) {
            float t = uTime * uTwinklingSpeed * 3.5;
            float wave1 = sin(t * 1.5 + vTwinklePhase);
            float wave2 = sin(t * 3.1 + vTwinklePhase * 2.3);
            float wave3 = cos(t * 5.7 + vTwinklePhase * 4.1);
            float scintillation = (wave1 * 0.45 + wave2 * 0.35 + wave3 * 0.20);
            twinkleFactor = max(0.2, 1.0 + scintillation * uTwinklingIntensity * 0.55);
          }

          // CIRCULAR STELLAR DISK PROFILE
          // smoothstep anti-aliased edge disk (r <= 0.65 solid, 0.65..1.0 anti-aliased edge)
          float disk = smoothstep(1.0, 0.65, r);

          // Central Gaussian core brightness concentration
          float core = exp(-4.5 * r * r);

          // Soft Optical Aura Halo for bright stars
          float halo = 0.0;
          if (vIsBright > 0.5) {
            halo = exp(-2.2 * r) * 0.35;
          }

          // Central core specular whitening (soft highlight right at r <= 0.15)
          vec3 coreColor = mix(vColor, vec3(1.0), exp(-16.0 * r * r) * 0.15);

          // Color Saturation boost for astronomical spectral temperature hues
          // uColorSaturation = 0.0 -> Pure monochrome white/greyscale stars
          // uColorSaturation = 1.0 -> Standard astronomical color
          // uColorSaturation = 1.4+ -> Extra vivid spectral colors
          float luma = dot(coreColor, vec3(0.299, 0.587, 0.114));
          vec3 vividColor = mix(vec3(luma), coreColor, uColorSaturation);
          vec3 finalColor = clamp(vividColor, 0.0, 1.0);

          // Alpha blending profile
          float alpha = clamp((disk * 0.75 + core * 0.45 + halo) * vAlpha * uBrightness * uDaytimeOpacity * twinkleFactor, 0.0, 1.0);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.starPoints = new THREE.Points(geometry, this.starMaterial);
    this.starPoints.renderOrder = 1;
    this.group.add(this.starPoints);

    this.currentLOD = -1;
    this.rebuildActiveStarBuffer(0);

    // console.log(`[StarRenderingSystem] Initialized Stellarium Star Shader with wide-FOV LOD 0 active.`);
  }

  /**
   * Updates magnitude limit.
   * - GPU uniform (uMagLimit) is updated instantly for in-buffer star visibility.
   * - When the new limit crosses a LOD-tier boundary (6.0 / 7.5 / 9.0), the
   *   GPU buffer is rebuilt so the newly-revealed faint stars enter the geometry
   *   with ALL correct attributes and the same shader material as the existing stars.
   * @param {number} limit
   */
  setMagnitudeLimit(limit) {
    const parsed = Number(limit);
    this.magLimit = Number.isFinite(parsed) ? parsed : 6.5;

    // Update the GPU uniform so in-buffer stars are hidden/shown instantly
    if (this.starMaterial && this.starMaterial.uniforms && this.starMaterial.uniforms.uMagLimit) {
      this.starMaterial.uniforms.uMagLimit.value = this.magLimit;
    }

    // Determine which LOD tier the current magLimit requires
    let magTier = 0;
    if (this.magLimit > 9.0)       magTier = 3;
    else if (this.magLimit > 7.5)  magTier = 2;
    else if (this.magLimit > 6.0)  magTier = 1;

    // Only rebuild the GPU buffer if the tier has actually changed
    if (magTier !== this._lastMagLODTier) {
      this._lastMagLODTier = magTier;
      // Use the current camera LOD as the base; rebuildActiveStarBuffer
      // internally picks max(cameraLOD, magTier) so faint stars get included.
      const cameraLOD = this.currentLOD !== undefined && this.currentLOD >= 0 ? this.currentLOD : 0;
      this.rebuildActiveStarBuffer(cameraLOD);
    }
  }

  setShowGround(show) {
    if (this.starMaterial && this.starMaterial.uniforms && this.starMaterial.uniforms.uShowGround) {
      this.starMaterial.uniforms.uShowGround.value = !!show;
    }
  }

  /**
   * Updates camera FOV uniform and dynamically rebuilds active GPU buffers when LOD level changes.
   * @param {number} fov
   */
  updateFOV(fov) {
    this.currentFOV = fov;
    if (this.starMaterial && this.starMaterial.uniforms && this.starMaterial.uniforms.uFOV) {
      this.starMaterial.uniforms.uFOV.value = fov;
    }

    const targetLOD = this.getActiveStarLOD(fov);
    if (targetLOD !== this.currentLOD) {
      this.rebuildActiveStarBuffer(targetLOD);
    }
  }

  getStarCatalogStats() {
    return {
      loaded: !!(this.catalogStats && this.catalogStats.loaded),
      total: this.starsList ? this.starsList.length : 0,
      level0: this.catalogStats && this.catalogStats.levels ? this.catalogStats.levels.level0 : 0,
      level1: this.catalogStats && this.catalogStats.levels ? this.catalogStats.levels.level1 : 0,
      level2: this.catalogStats && this.catalogStats.levels ? this.catalogStats.levels.level2 : 0,
      level3: this.catalogStats && this.catalogStats.levels ? this.catalogStats.levels.level3 : 0,
      active: (this.catalogStats && this.catalogStats.active !== undefined) ? this.catalogStats.active : (this.starsList ? this.starsList.length : 0)
    };
  }

  getActiveStarCount() {
    return this.catalogStats.active || 0;
  }

  getStarCatalogStatus() {
    return `Stellarium Catalog: ${this.catalogStats.loaded ? 'Active' : 'Fallback'} (${this.catalogStats.active} active / ${this.catalogStats.total} total stars)`;
  }

  /**
 * Enable / disable star twinkling.
 * @param {boolean} enabled
 */
setTwinklingEnabled(enabled) {
    this.twinklingEnabled = !!enabled;

    if (
        this.starMaterial &&
        this.starMaterial.uniforms &&
        this.starMaterial.uniforms.uTwinklingEnabled
    ) {
        this.starMaterial.uniforms.uTwinklingEnabled.value =
            this.twinklingEnabled;
    }
}

/**
 * Set star twinkling speed.
 * @param {number} speed
 */
setTwinklingSpeed(speed) {
    const value = Math.max(
        0.1,
        Math.min(2.0, Number(speed) || 0.5)
    );

    this.twinklingSpeed = value;

    if (
        this.starMaterial &&
        this.starMaterial.uniforms &&
        this.starMaterial.uniforms.uTwinklingSpeed
    ) {
        this.starMaterial.uniforms.uTwinklingSpeed.value = value;
    }
}

/**
 * Set star twinkling intensity.
 * @param {number} intensity
 */
setTwinklingIntensity(intensity) {
    const value = Math.max(
        0.0,
        Math.min(1.0, Number(intensity) || 0.0)
    );

    this.twinklingIntensity = value;

    if (
        this.starMaterial &&
        this.starMaterial.uniforms &&
        this.starMaterial.uniforms.uTwinklingIntensity
    ) {
        this.starMaterial.uniforms.uTwinklingIntensity.value = value;
    }
}

setStarColorSaturation(saturation) {
    const value = Math.max(
        0.0,
        Math.min(2.0, Number(saturation) || 0.0)
    );

    this.starColorSaturation = value;

    if (
        this.starMaterial &&
        this.starMaterial.uniforms &&
        this.starMaterial.uniforms.uColorSaturation
    ) {
        this.starMaterial.uniforms.uColorSaturation.value = value;
    }
}



/**
 * Update animation clock for star twinkling.
 * @param {number} timeSeconds
 */
updateTime(timeSeconds) {
    this.twinklingTime = Number(timeSeconds) || 0.0;

    if (
        this.starMaterial &&
        this.starMaterial.uniforms &&
        this.starMaterial.uniforms.uTime
    ) {
        this.starMaterial.uniforms.uTime.value =
            this.twinklingTime;
    }
}

  /**
   * Returns progressive star label targets based on camera FOV zoom level and star magnitude limit.
   * Stars without proper names remain unlabeled when zoomed out.
   * Brightest named stars labeled by default when zoomed out.
   * Bayer, Flamsteed, and Proper name labels revealed while zooming in.
   * Search target automatically highlighted.
   * @param {number} fovDeg
   * @param {number} magLimit
   * @param {string|null} searchHighlightId
   * @returns {Array<Object>}
   */
  getStarLabels(fovDeg = this.currentFOV || 60.0, magLimit = this.magLimit || 6.5, searchHighlightId = null) {
    const targets = [];
    const highlightKey = searchHighlightId ? String(searchHighlightId).toLowerCase().replace(/\s+/g, '') : null;

    for (let i = 0; i < this.starsList.length; i++) {
      const star = this.starsList[i];

      // Stars without proper names or Bayer designations remain unlabeled
      if (!star.properName && !star.bayerName) continue;
      if (star.mag > magLimit) continue;

      const starKey = String(star.properName || star.name || star.id).toLowerCase().replace(/\s+/g, '');
      const isSearchTarget = highlightKey && (starKey.includes(highlightKey) || String(star.id).toLowerCase() === highlightKey);

      // Progressive Zoom LOD hierarchy:
      // Zoomed Out (FOV > 55°): Only brightest Proper Named Stars (Sirius, Caph, Alpheratz, Rigel, Vega, Betelgeuse, etc.)
      // Medium Zoom (35° < FOV <= 55°): Proper Named Stars up to mag 4.5
      // Deep Zoom (FOV <= 35°): Bayer & Flamsteed designations (α Cas, β Cas)
      let isVisibleAtZoom = false;
      if (isSearchTarget) {
        isVisibleAtZoom = true;
      } else if (star.properName && star.mag <= 3.0) {
        isVisibleAtZoom = true;
      } else if (fovDeg <= 55.0 && star.properName && star.mag <= 4.5) {
        isVisibleAtZoom = true;
      } else if (fovDeg <= 35.0 && star.bayerName) {
        isVisibleAtZoom = true;
      }

      if (isVisibleAtZoom) {
        const labelText = (fovDeg > 35.0 && star.properName) ? star.properName : (star.properName || star.bayerName || star.name);
        targets.push({
          id: star.id,
          name: labelText,
          position: this.celestialToCartesian(star.ra, star.dec),
          color: isSearchTarget ? '#00ffff' : (star.properName ? '#ffffff' : '#a0c8ff'),
          priority: isSearchTarget ? 0 : (star.properName ? 1 : 2),
          isSelected: isSearchTarget
        });
      }
    }

    return targets;
  }

  dispose() {
    if (this.group) {
      if (this.starPoints) {
        if (this.starPoints.geometry) this.starPoints.geometry.dispose();
        if (this.starPoints.material) this.starPoints.material.dispose();
      }
      this.group = null;
    }
  }
}

export default StarRenderingSystem;
