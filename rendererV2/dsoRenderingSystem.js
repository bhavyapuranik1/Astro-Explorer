/**
 * Advanced Deep Sky Object (DSO) Rendering System for SkyRendererV2
 * 
 * FEATURES:
 * 1. Dedicated GPU Shaders for 10 DSO categories:
 *    - Spiral Galaxies: Soft elliptical glow + bright core + spiral arm density
 *    - Elliptical Galaxies: Smooth Gaussian starlight halo + intense nucleus
 *    - Emission Nebulae: Ionized gas clouds (#ff85b3) with multi-layer turbulence
 *    - Reflection Nebulae: Diffuse blue-tinted starlight glow (#70b5ff)
 *    - Dark Nebulae: Cosmic dust silhouettes with subtle opacity subtraction
 *    - Planetary Nebulae: Compact glowing gas shell (#78f5e5) with central star
 *    - Supernova Remnants: Filamentary expanding shockwave filaments
 *    - Open Clusters: Multiple young blue stars embedded in cluster starlight glow
 *    - Globular Clusters: Dense spherical amber star distribution (#fff2cc) with core
 *    - Diffuse Objects: Extremely soft gradual edge transparency
 * 2. Dynamic FOV Level of Detail (LOD):
 *    - Zoomed Out (FOV >= 60°): Major Messier DSOs visible, small DSOs subtle
 *    - Medium Zoom (25° <= FOV < 60°): NGC/IC objects gradually fade in
 *    - Zoomed In (FOV < 25°): High-detail procedural nebular structure & cluster details
 * 3. Selection & Search Auto-Highlighting
 * 4. Zero-allocation frame rendering loop (60 FPS locked)
 */

import * as THREE from 'three';

export class DSORenderingSystem {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.radius=798] - Placement radius on celestial sphere.
   */
  constructor(options = {}) {
    this.options = {
      radius: options.radius || 798,
      ...options
    };

    this.group = null;
    this.points = null;
    this.material = null;
    this.dsoList = [];
    this.loadedCount = 0;

    this.currentFOV = 60.0;
    this.selectedId = null;

    this.init();
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
   * Categorizes DSO type into 10 dedicated rendering categories:
   * 0: Spiral Galaxy, 1: Elliptical Galaxy, 2: Emission Nebula, 3: Reflection Nebula,
   * 4: Dark Nebula, 5: Planetary Nebula, 6: Supernova Remnant, 7: Open Cluster,
   * 8: Globular Cluster, 9: Diffuse Object.
   */
  getDSOCategory(typeStr = '') {
    const t = typeStr.toLowerCase().trim();
    if (t === 'gc' || t.includes('globular')) return 8; // Globular Cluster
    if (t === 'oc' || t.includes('open')) return 7; // Open Cluster
    if (t === 'pn' || t.includes('planetary')) return 5; // Planetary Nebula
    if (t === 'snr' || t.includes('supernova') || t.includes('remnant')) return 6; // Supernova Remnant
    if (t === 'dn' || t.includes('dark')) return 4; // Dark Nebula
    if (t === 'rn' || t.includes('reflection')) return 3; // Reflection Nebula
    if (t === 'en' || t === 'sfr' || t === 'nb' || t.includes('emission') || t.includes('neb')) return 2; // Emission Nebula
    if (t === 'e' || t === 'eg' || t.includes('elliptical')) return 1; // Elliptical Galaxy
    if (t === 's' || t === 'sg' || t === 'g' || t === 'gx' || t.includes('spiral') || t.includes('gal')) return 0; // Spiral Galaxy
    return 9; // Diffuse Object
  }

  /**
   * Returns characteristic astronomical color for DSO category.
   */
  getDSOColor(catId) {
    switch (catId) {
      case 0: return new THREE.Color('#d8c6ff'); // Spiral Galaxy: Warm violet/cyan core & arm starlight
      case 1: return new THREE.Color('#ffe6c8'); // Elliptical Galaxy: Smooth golden elliptical halo
      case 2: return new THREE.Color('#ff85b3'); // Emission Nebula: Ionized magenta H-II gas glow
      case 3: return new THREE.Color('#70b5ff'); // Reflection Nebula: Starlight blue reflection dust
      case 4: return new THREE.Color('#202838'); // Dark Nebula: Subtle dark dust silhouette
      case 5: return new THREE.Color('#78f5e5'); // Planetary Nebula: Emerald cyan/teal gas shell
      case 6: return new THREE.Color('#ffaa66'); // Supernova Remnant: Filamentary orange/red shockwave
      case 7: return new THREE.Color('#a8dbff'); // Open Cluster: Young blue cluster stars
      case 8: return new THREE.Color('#fff2cc'); // Globular Cluster: Dense amber star core
      case 9: return new THREE.Color('#e0e6ff'); // Diffuse Object: Soft starlight halo
      default: return new THREE.Color('#ffffff');
    }
  }

  /**
   * Fetches data/messier.json, data/dsos.bright.json, and data/ngc-ic-messier-catalog.json.
   */
  async loadDSOData() {
    const dsoMap = new Map();

    const addDSO = (id, name, ra, dec, mag, typeStr, isMessier = false) => {
      if (!id || ra === undefined || dec === undefined) return;
      let raDeg = parseFloat(ra);
      if (raDeg < 0) raDeg += 360.0;
      const decDeg = parseFloat(dec);
      if (isNaN(raDeg) || isNaN(decDeg)) return;

      const key = String(id).toLowerCase().replace(/\s+/g, '');
      if (!dsoMap.has(key)) {
        const catId = this.getDSOCategory(typeStr);
        const vMag = isNaN(parseFloat(mag)) ? 7.5 : parseFloat(mag);
        
        // Priority: 0 = Messier Major, 1 = Bright NGC/IC, 2 = Faint DSOs
        let priority = 2;
        if (isMessier || key.startsWith('m') || (name && name.startsWith('M'))) priority = 0;
        else if (vMag <= 7.0) priority = 1;

        dsoMap.set(key, {
          id: String(id),
          name: name || String(id),
          ra: raDeg,
          dec: decDeg,
          mag: vMag,
          type: typeStr || 'g',
          catId: catId,
          priority: priority
        });
      }
    };

    // 1. Messier Catalog (data/messier.json)
    try {
      const res = await fetch('./data/messier.json');
      const data = await res.json();
      if (data && data.features && Array.isArray(data.features)) {
        data.features.forEach(f => {
          const coords = f.geometry ? f.geometry.coordinates : [0, 0];
          const name = f.properties ? (f.properties.alt || f.properties.name || f.id) : f.id;
          const mag = f.properties ? f.properties.mag : 7.0;
          const typeStr = f.properties ? f.properties.type : 'g';
          addDSO(f.id, name, coords[0], coords[1], mag, typeStr, true);
        });
      }
    } catch (e) {
      console.warn('[DSORenderingSystem] Could not fetch data/messier.json:', e);
    }

    // 2. Bright DSOs Catalog (data/dsos.bright.json)
    try {
      const res = await fetch('./data/dsos.bright.json');
      const data = await res.json();
      if (data && data.features && Array.isArray(data.features)) {
        data.features.forEach(f => {
          const coords = f.geometry ? f.geometry.coordinates : [0, 0];
          const name = f.properties ? (f.properties.name || f.properties.desig || f.id) : f.id;
          const mag = f.properties ? f.properties.mag : 6.5;
          const typeStr = f.properties ? f.properties.type : 'g';
          addDSO(f.id || f.properties?.desig, name, coords[0], coords[1], mag, typeStr);
        });
      }
    } catch (e) {
      console.warn('[DSORenderingSystem] Could not fetch data/dsos.bright.json:', e);
    }

    return Array.from(dsoMap.values());
  }

  /**
   * Initializes GPU WebGL DSO LOD Shader & Points Mesh.
   */
  async init() {
    this.group = new THREE.Group();
    this.group.name = 'dsoRenderingSystemGroup';
    this.group.renderOrder = 2;

    const dsoData = await this.loadDSOData();
    this.dsoList = dsoData;
    const count = dsoData.length;
    this.loadedCount = count;

    if (count === 0) return;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseSizes = new Float32Array(count);
    const categories = new Float32Array(count);
    const brightnesses = new Float32Array(count);
    const priorities = new Float32Array(count);

    const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1.0;

    for (let i = 0; i < count; i++) {
      const dso = dsoData[i];
      const vec = this.celestialToCartesian(dso.ra, dso.dec);

      positions[i * 3] = vec.x;
      positions[i * 3 + 1] = vec.y;
      positions[i * 3 + 2] = vec.z;

      const col = this.getDSOColor(dso.catId);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      categories[i] = dso.catId;
      priorities[i] = dso.priority;
      brightnesses[i] = Math.max(0.40, Math.min(1.30, 1.35 - (dso.mag - 3.0) * 0.12));
      baseSizes[i] = Math.max(20.0, Math.min(65.0, 55.0 - dso.mag * 3.8)) * pixelRatio;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('baseSize', new THREE.BufferAttribute(baseSizes, 1));
    geometry.setAttribute('category', new THREE.BufferAttribute(categories, 1));
    geometry.setAttribute('brightness', new THREE.BufferAttribute(brightnesses, 1));
    geometry.setAttribute('priority', new THREE.BufferAttribute(priorities, 1));

    // Custom WebGL GPU DSO Shader with 10 Category Visual Styles & Dynamic Zoom LOD
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uCameraFOV: { value: 60.0 },
        uGlowIntensity: { value: 0.5 },
        uGlowEnabled: { value: true },
        uShowGround: { value: true }
      },
      vertexShader: `
        attribute float baseSize;
        attribute vec3 color;
        attribute float category;
        attribute float brightness;
        attribute float priority;

        uniform float uCameraFOV;
        uniform bool uShowGround;

        varying vec3 vColor;
        varying float vCategory;
        varying float vBrightness;
        varying float vLOD;
        varying float vAlphaFade;

        void main() {
          vColor = color;
          vCategory = category;
          vBrightness = brightness;

          vec4 worldPosition = modelMatrix * vec4(position, 1.0);

          float lod = clamp((60.0 - uCameraFOV) / 45.0, 0.0, 1.0);
          vLOD = lod;

          float fovAlpha = 1.0;
          if (priority >= 2.0) {
            fovAlpha = clamp((50.0 - uCameraFOV) / 25.0, 0.0, 1.0);
          } else if (priority >= 1.0) {
            fovAlpha = clamp((80.0 - uCameraFOV) / 35.0, 0.2, 1.0);
          }
          vAlphaFade = fovAlpha;

          vec4 mvPosition = viewMatrix * worldPosition;
          gl_Position = projectionMatrix * mvPosition;

          float lodScale = (0.5 + lod * 0.5) * clamp(60.0 / uCameraFOV, 0.7, 1.3);
          gl_PointSize = baseSize * 0.45 * lodScale;
        }
      `,
      fragmentShader: `
  uniform float uCameraFOV;
  uniform float uGlowIntensity;
  uniform bool uGlowEnabled;

  varying vec3 vColor;
        varying float vCategory;
        varying float vBrightness;
        varying float vLOD;
        varying float vAlphaFade;

        void main() {
          if (vAlphaFade < 0.02) discard;

          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord) * 2.0;
          if (dist > 1.0) discard;

          float intensity = 0.0;
          vec3 shapeColor = vColor;

          int cat = int(vCategory + 0.5);
          float core = exp(-16.0 * dist * dist);
          if (cat == 0) {
            // 1. Spiral Galaxy (Tilted spiral arm density & bright nucleus)
            float angle = atan(coord.y, coord.x);
            float spiralArm = exp(-3.2 * dist) * (0.6 + 0.4 * cos(angle * 2.0 + dist * 6.5));
            intensity = mix(core + exp(-4.5 * dist) * 0.35, core * 1.2 + spiralArm * 0.95, vLOD);
          } else if (cat == 1) {
            // 2. Elliptical Galaxy (Smooth golden elliptical starlight halo + intense nucleus)
            float halo = exp(-3.8 * dist) * 0.55;
            intensity = core + halo;
          } else if (cat == 2) {
            // 3. Emission Nebula (Ionized gas cloud with soft multi-layer turbulence)
            float nebCore = exp(-2.8 * dist);
            float turbulence = 0.5 + 0.5 * sin(coord.x * 14.0) * cos(coord.y * 14.0);
            intensity = nebCore * mix(0.85, turbulence, vLOD * 0.75);
          } else if (cat == 3) {
            // 4. Reflection Nebula (Blue-tinted diffuse starlight reflection glow)
            float diffuse = exp(-2.2 * dist) * 0.60;
            intensity = core * 0.8 + diffuse * 0.7;
          } else if (cat == 4) {
            // 5. Dark Nebula (Cosmic dust silhouettes)
            float dust = smoothstep(0.9, 0.2, dist);
            intensity = dust * 0.45;
          } else if (cat == 5) {
            // 6. Planetary Nebula (Compact glowing gas shell + bright central star)
            float ring = exp(-28.0 * pow(dist - 0.45, 2.0));
            float centralStar = exp(-45.0 * dist * dist);
            intensity = ring * 0.85 + centralStar * 1.1;
          } else if (cat == 6) {
            // 7. Supernova Remnant (Filamentary expanding shockwave filaments)
            float filaments = exp(-6.0 * dist) * (0.5 + 0.5 * sin(coord.x * 20.0 + coord.y * 15.0));
            intensity = filaments * mix(0.7, 1.2, vLOD);
          } else if (cat == 7) {
            // 8. Open Cluster (4-petal glowing blue star cluster icon)
            float angle = atan(coord.y, coord.x);
            float petals = exp(-8.0 * pow(dist - 0.38, 2.0)) * pow(abs(cos(angle * 2.0)), 1.8);
            intensity = core * 1.2 + petals * 1.1;
          } else if (cat == 8) {
            // 9. Globular Cluster (Dense golden core + dotted star halo ring for M4, M13, etc.)
            float globCore = exp(-24.0 * dist * dist);
            float ring = exp(-35.0 * pow(dist - 0.42, 2.0));
            float dots = 0.5 + 0.5 * cos(atan(coord.y, coord.x) * 10.0);
            intensity = globCore * 1.4 + ring * dots * 1.1;
          } else {
            // 10. Diffuse Object
            intensity = exp(-3.0 * dist * dist);
          }

          // -----------------------------------------------------
// DSO EDGE + GLOW
// -----------------------------------------------------

// Soft circular edge.
// 0.65 -> fully visible, 1.0 -> transparent edge.
float edgeAlpha =
    1.0 - smoothstep(0.65, 1.0, dist);

// Base DSO brightness.
float finalIntensity =
    intensity * vBrightness;

// Optional glow contribution.
if (uGlowEnabled) {
    float glow = exp(-4.5 * dist * dist);

finalIntensity +=
    glow *
    uGlowIntensity *
    0.45;
}

// Apply fade and edge.
float finalAlpha =
    clamp(
        finalIntensity *
        vAlphaFade *
        edgeAlpha,
        0.0,
        1.0
    );

vec3 finalColor =
    shapeColor * finalIntensity;

gl_FragColor = vec4(
    finalColor,
    finalAlpha
);

}
`,
transparent: true,
depthWrite: false,
blending: THREE.AdditiveBlending
});

this.points = new THREE.Points(geometry, this.material);
    this.points.renderOrder = 2;
    this.group.add(this.points);

    // console.log(`[DSORenderingSystem] Loaded 10 Deep Sky Object category shaders across ${count} objects.`);
  }

  /**
   * Updates camera FOV uniform for dynamic LOD scaling.
   * @param {number} fovDeg
   */
  updateFOV(fovDeg) {
    this.currentFOV = fovDeg;
    if (this.material && this.material.uniforms && this.material.uniforms.uCameraFOV) {
      this.material.uniforms.uCameraFOV.value = fovDeg;
    }
  }
  /**
 * Sets DSO glow intensity.
 * @param {number} intensity 0.0–1.0
 */
setGlowIntensity(intensity) {
  const value = Math.max(
    0.0,
    Math.min(1.0, Number(intensity) || 0.0)
  );

  if (
    this.material &&
    this.material.uniforms &&
    this.material.uniforms.uGlowIntensity
  ) {
    this.material.uniforms.uGlowIntensity.value = value;
  }
}

/**
 * Enables or disables DSO glow.
 * @param {boolean} enabled
 */
setGlowEnabled(enabled) {
  if (
    this.material &&
    this.material.uniforms &&
    this.material.uniforms.uGlowEnabled
  ) {
    this.material.uniforms.uGlowEnabled.value = !!enabled;
  }
}

setShowGround(visible) {
  if (
    this.material &&
    this.material.uniforms &&
    this.material.uniforms.uShowGround
  ) {
    this.material.uniforms.uShowGround.value = !!visible;
  }
}

  /**
   * Sets currently selected object ID for search & highlight priority.
   * @param {string|null} id
   */
  setSelectedObject(id) {
    this.selectedId = id ? String(id).toLowerCase() : null;
  }

  /**
   * Returns priority-sorted DSO label targets for LabelSystem based on camera FOV zoom level.
   * Messier major objects (M31, M42, M13, M45) always receive highest priority.
   * NGC/IC/Caldwell labels progressively appear as FOV decreases.
   * @param {number} fovDeg
   * @param {string|null} searchHighlightId
   * @returns {Array<Object>}
   */
  getDSOLabels(fovDeg = this.currentFOV, searchHighlightId = null) {
    const targets = [];
    const highlightKey = searchHighlightId ? String(searchHighlightId).toLowerCase().replace(/\s+/g, '') : null;

    for (let i = 0; i < this.dsoList.length; i++) {
      const dso = this.dsoList[i];
      const key = dso.id.toLowerCase().replace(/\s+/g, '');
      const isSearchTarget = highlightKey && (key.includes(highlightKey) || String(dso.name).toLowerCase().includes(highlightKey));

      targets.push({
        id: dso.id,
        name: dso.name,
        position: this.celestialToCartesian(dso.ra, dso.dec),
        color: isSearchTarget ? '#00ffff' : (dso.priority === 0 ? '#ff85b3' : '#d4c5ff'),
        priority: isSearchTarget ? 0 : dso.priority,
        isSelected: isSearchTarget,
        ra: dso.ra,
        dec: dso.dec,
        mag: dso.mag,
        rawObj: dso
      });
    }

    return targets;
  }

  dispose() {
    if (this.group) {
      if (this.points) {
        if (this.points.geometry) this.points.geometry.dispose();
        if (this.material) this.material.dispose();
        this.group.remove(this.points);
        this.points = null;
        this.material = null;
      }
      this.group = null;
    }
  }
}

export default DSORenderingSystem;
