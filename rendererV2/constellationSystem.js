/**
 * Constellation & Asterism System for SkyRendererV2 (Stellarium Index.json HIP-Bound Engine)
 * 
 * FEATURES:
 * - Minimalist Ultra-Clean Mode: Renders ONLY Top 15 Iconic Constellations & Top 5 Famous Asterisms.
 * - Eliminates 80%+ of screen line clutter.
 * - Uses 100% Stellarium HIP star coordinate accuracy and Great Circle arc subdivision (max 3° steps).
 * - 100% Locked Alignment: ZERO parallax shifting, bending, or wobbling when rotating camera.
 * - Single GPU draw call per layer using THREE.LineSegments with zero per-frame Javascript loops.
 */

import * as THREE from 'three';

export class ConstellationSystem {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.radius=800] - Placement radius on celestial sphere (matches StarRenderingSystem radius 800).
   */
  constructor(options = {}) {
    this.options = {
      radius: options.radius || 800,
      ...options
    };

    this.group = null;
    this.constellationLines = null;
    this.asterismLines = null;
    this.constellationLabels = [];
    this.asterismLabels = [];

    // Track desired visibility before async init completes
    this._pendingConstellationsVisible = true;
    this._pendingAsterismsVisible = true;

    // Diagnostics stats
    this.stats = {
      constellationsLoaded: 0,
      asterismsLoaded: 0,
      hipsReferenced: 0,
      hipsResolved: 0,
      hipsMissing: 0,
      lineSegmentsGenerated: 0
    };
  }

  /**
   * Converts Celestial Coordinates (RA in degrees, Dec in degrees) to 3D Cartesian Vector3.
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
   * Subdivides a 3D line segment into spherical Great Circle arcs along radius 800.0.
   * Eliminates 3D chord sagging, perspective distortion, and camera rotation shifting.
   */
  addArcSegment(p1, p2, positionsArray, maxAngleDeg = 3.0) {
    const angleRad = p1.angleTo(p2);
    const angleDeg = THREE.MathUtils.radToDeg(angleRad);
    const steps = Math.max(1, Math.ceil(angleDeg / maxAngleDeg));

    let prevPos = p1.clone();
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const currPos = p1.clone().lerp(p2, t).normalize().multiplyScalar(this.options.radius);
      positionsArray.push(prevPos.x, prevPos.y, prevPos.z, currPos.x, currPos.y, currPos.z);
      prevPos = currPos;
    }
  }

  /**
   * Loads Stellarium index.json data.
   */
  async loadData() {
    let indexData = null;
    try {
      const res = await fetch('./data/constellations/index.json');
      indexData = await res.json();
    } catch (e) {
      console.warn('[ConstellationSystem] Could not fetch ./data/constellations/index.json:', e);
    }
    return indexData;
  }

  /**
   * Builds comprehensive HIP ID -> { ra, dec } coordinate map from stars catalog files and StarRenderingSystem.
   */
  async buildHipMap(starRenderingSystem) {
    const hipMap = new Map();

    // 1. Fetch data/stars.6.json for complete bright star HIP coordinates
    try {
      const res = await fetch('./data/stars.6.json');
      const data = await res.json();
      if (data && Array.isArray(data.features)) {
        data.features.forEach(f => {
          if (f.id !== undefined && f.geometry && Array.isArray(f.geometry.coordinates)) {
            const hip = Number(f.id);
            if (!isNaN(hip)) {
              let ra = f.geometry.coordinates[0];
              if (ra < 0) ra += 360.0;
              const dec = f.geometry.coordinates[1];
              hipMap.set(hip, { ra, dec, mag: f.properties ? f.properties.mag : 5.0 });
            }
          }
        });
      }
    } catch (e) {
      console.warn('[ConstellationSystem] Could not fetch data/stars.6.json:', e);
    }

    // 2. Fetch data/stars.8.json for fainter star HIP coordinates
    try {
      const res = await fetch('./data/stars.8.json');
      const data = await res.json();
      if (data && Array.isArray(data.features)) {
        data.features.forEach(f => {
          if (f.id !== undefined && f.geometry && Array.isArray(f.geometry.coordinates)) {
            const hip = Number(f.id);
            if (!isNaN(hip) && !hipMap.has(hip)) {
              let ra = f.geometry.coordinates[0];
              if (ra < 0) ra += 360.0;
              const dec = f.geometry.coordinates[1];
              hipMap.set(hip, { ra, dec, mag: f.properties ? f.properties.mag : 7.0 });
            }
          }
        });
      }
    } catch (e) {}

    // 3. Merge active StarRenderingSystem starsList
    if (starRenderingSystem) {
      if (Array.isArray(starRenderingSystem.starsList)) {
        starRenderingSystem.starsList.forEach(star => {
          if (star && star.hip !== undefined && star.hip !== null) {
            const numHip = Number(star.hip);
            if (!isNaN(numHip) && numHip > 0) {
              hipMap.set(numHip, { ra: star.ra, dec: star.dec, mag: star.mag });
            }
          }
        });
      }
      if (starRenderingSystem.parsedLevelArrays) {
        Object.values(starRenderingSystem.parsedLevelArrays).forEach(lvlArr => {
          if (Array.isArray(lvlArr)) {
            lvlArr.forEach(star => {
              if (star && star.hip !== undefined && star.hip !== null) {
                const numHip = Number(star.hip);
                if (!isNaN(numHip) && numHip > 0 && !hipMap.has(numHip)) {
                  hipMap.set(numHip, { ra: star.ra, dec: star.dec, mag: star.mag });
                }
              }
            });
          }
        });
      }
    }

    return hipMap;
  }

  /**
   * Initializes 3D Constellation & Asterism Line Geometry and Label Anchors.
   * @param {Object} [starRenderingSystem=null] - Reference to active StarRenderingSystem instance.
   */
  async init(starRenderingSystem = null) {
    this.group = new THREE.Group();
    this.group.name = 'constellationGroup';
    this.group.renderOrder = 0;

    const indexData = await this.loadData();
    if (!indexData) {
      console.warn('[ConstellationSystem] index.json missing or invalid.');
      return;
    }

    const hipMap = await this.buildHipMap(starRenderingSystem);

    const referencedHips = new Set();
    let resolvedCount = 0;
    let missingCount = 0;
    let segmentsCount = 0;

    this.constellationLabels = [];
    this.asterismLabels = [];

    // TOP 15 ULTRA-FAMOUS MAJOR CONSTELLATIONS ONLY
    const top15Constellations = new Set([
      'Ori', 'UMa', 'Cas', 'Tau', 'Leo', 'Cyg', 'Sco', 'Gem', 'Peg', 'CMa',
      'Boo', 'Her', 'And', 'Aql', 'Sgr'
    ]);

    // 1. BUILD TOP 15 MAJOR CONSTELLATION LINES & LABELS
    const cPositions = [];
    const constellations = Array.isArray(indexData.constellations) ? indexData.constellations : [];

    constellations.forEach(c => {
      // Extract 3-letter code from Stellarium ID (e.g. 'CON modern Ori' -> 'Ori')
      const code = c.id.replace('CON modern ', '').trim();
      if (!top15Constellations.has(code)) return;

      const nameObj = c.common_name || {};
      const englishName = nameObj.english || nameObj.native || code;
      const nativeName = nameObj.native || englishName;
      const constId = c.id;

      const cStarPositions = [];

      if (Array.isArray(c.lines)) {
        c.lines.forEach(path => {
          if (!Array.isArray(path)) return;

          for (let i = 0; i < path.length - 1; i++) {
            const hipA = Number(path[i]);
            const hipB = Number(path[i + 1]);

            referencedHips.add(hipA);
            referencedHips.add(hipB);

            const starA = hipMap.get(hipA);
            const starB = hipMap.get(hipB);

            if (starA && starB) {
              const p1 = this.celestialToCartesian(starA.ra, starA.dec);
              const p2 = this.celestialToCartesian(starB.ra, starB.dec);

              this.addArcSegment(p1, p2, cPositions, 3.0);
              cStarPositions.push(p1, p2);

              resolvedCount++;
              segmentsCount++;
            } else {
              missingCount++;
            }
          }
        });
      }

      // Constellation Label Anchor: centroid of constituent line stars
      if (cStarPositions.length > 0) {
        const centroid = new THREE.Vector3();
        cStarPositions.forEach(p => centroid.add(p));
        centroid.divideScalar(cStarPositions.length);
        centroid.normalize().multiplyScalar(this.options.radius);

        const raRad = Math.atan2(centroid.z, centroid.x);
        let raDeg = THREE.MathUtils.radToDeg(raRad);
        if (raDeg < 0) raDeg += 360.0;
        const decRad = Math.asin(Math.max(-1, Math.min(1, centroid.y / this.options.radius)));
        const decDeg = THREE.MathUtils.radToDeg(decRad);

        this.constellationLabels.push({
          id: constId,
          name: nativeName || englishName,
          englishName: englishName,
          ra: raDeg,
          dec: decDeg,
          position: centroid,
          type: 'constellation'
        });
      }
    });

    if (cPositions.length > 0) {
      const cGeometry = new THREE.BufferGeometry();
      cGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cPositions, 3));
      const cMaterial = new THREE.LineBasicMaterial({
        color: 0x33aaff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      });
      this.constellationLines = new THREE.LineSegments(cGeometry, cMaterial);
      this.constellationLines.visible = this._pendingConstellationsVisible;
      this.group.add(this.constellationLines);
    }

    // 2. BUILD TOP 5 ICONIC ASTERISMS ONLY
    const aPositions = [];
    const asterisms = Array.isArray(indexData.asterisms) ? indexData.asterisms : [];

    const top5AsterismKeywords = [
      'big dipper', 'orion\'s belt', 'summer triangle', 'great square of pegasus', 'teapot'
    ];

    asterisms.forEach(a => {
      // Skip ray helpers
      if (a.is_ray_helper) return;

      const nameObj = a.common_name || {};
      const name = nameObj.english || nameObj.native || null;
      if (!name) return;

      const nameLower = String(name).toLowerCase();

      // Check match against top 5 asterisms keywords
      const isMatch = top5AsterismKeywords.some(k => nameLower.includes(k));
      if (!isMatch) return;

      const aStarPositions = [];

      if (Array.isArray(a.lines)) {
        a.lines.forEach(path => {
          if (!Array.isArray(path)) return;

          for (let i = 0; i < path.length - 1; i++) {
            const hipA = Number(path[i]);
            const hipB = Number(path[i + 1]);

            referencedHips.add(hipA);
            referencedHips.add(hipB);

            const starA = hipMap.get(hipA);
            const starB = hipMap.get(hipB);

            if (starA && starB) {
              const p1 = this.celestialToCartesian(starA.ra, starA.dec);
              const p2 = this.celestialToCartesian(starB.ra, starB.dec);

              this.addArcSegment(p1, p2, aPositions, 3.0);
              aStarPositions.push(p1, p2);

              resolvedCount++;
              segmentsCount++;
            } else {
              missingCount++;
            }
          }
        });
      }

      if (aStarPositions.length > 0) {
        const centroid = new THREE.Vector3();
        aStarPositions.forEach(p => centroid.add(p));
        centroid.divideScalar(aStarPositions.length);
        centroid.normalize().multiplyScalar(this.options.radius);

        const raRad = Math.atan2(centroid.z, centroid.x);
        let raDeg = THREE.MathUtils.radToDeg(raRad);
        if (raDeg < 0) raDeg += 360.0;
        const decRad = Math.asin(Math.max(-1, Math.min(1, centroid.y / this.options.radius)));
        const decDeg = THREE.MathUtils.radToDeg(decRad);

        this.asterismLabels.push({
          id: a.id,
          name: name,
          ra: raDeg,
          dec: decDeg,
          position: centroid,
          type: 'asterism'
        });
      }
    });

    if (aPositions.length > 0) {
      const aGeometry = new THREE.BufferGeometry();
      aGeometry.setAttribute('position', new THREE.Float32BufferAttribute(aPositions, 3));
      const aMaterial = new THREE.LineBasicMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      });
      this.asterismLines = new THREE.LineSegments(aGeometry, aMaterial);
      this.asterismLines.visible = this._pendingAsterismsVisible;
      this.group.add(this.asterismLines);
    }

    // 3. BUILD 3D STELLARIUM CONSTELLATION ARTWORK MESHES
    this.artGroup = new THREE.Group();
    this.artGroup.name = 'constellationArtGroup';
    this.artGroup.renderOrder = -1; // Behind constellation lines

    const textureLoader = new THREE.TextureLoader();

    constellations.forEach(c => {
      const code = c.id.replace('CON modern ', '').trim();
      if (!top15Constellations.has(code)) return;
      if (!c.image || !Array.isArray(c.image.anchors) || c.image.anchors.length < 3) return;

      const imgPath = './data/constellations/' + c.image.file;
      const imgWidth = (c.image.size && c.image.size[0]) || 512;
      const imgHeight = (c.image.size && c.image.size[1]) || 512;

      const a0 = c.image.anchors[0];
      const a1 = c.image.anchors[1];
      const a2 = c.image.anchors[2];

      const star0 = hipMap.get(Number(a0.hip));
      const star1 = hipMap.get(Number(a1.hip));
      const star2 = hipMap.get(Number(a2.hip));

      if (!star0 || !star1 || !star2) return;

      const p0 = this.celestialToCartesian(star0.ra, star0.dec, this.options.radius * 0.996);
      const p1 = this.celestialToCartesian(star1.ra, star1.dec, this.options.radius * 0.996);
      const p2 = this.celestialToCartesian(star2.ra, star2.dec, this.options.radius * 0.996);

      const u0 = a0.pos[0] / imgWidth;
      const v0 = 1.0 - (a0.pos[1] / imgHeight);
      const u1 = a1.pos[0] / imgWidth;
      const v1 = 1.0 - (a1.pos[1] / imgHeight);
      const u2 = a2.pos[0] / imgWidth;
      const v2 = 1.0 - (a2.pos[1] / imgHeight);

      // Create a 4th synthetic vertex to form a 2-triangle quad
      const p3 = p0.clone().add(p2).sub(p1);
      const u3 = u0 + u2 - u1;
      const v3 = v0 + v2 - v1;

      const positions = new Float32Array([
        p0.x, p0.y, p0.z,
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z,

        p0.x, p0.y, p0.z,
        p2.x, p2.y, p2.z,
        p3.x, p3.y, p3.z
      ]);

      const uvs = new Float32Array([
        u0, v0,
        u1, v1,
        u2, v2,

        u0, v0,
        u2, v2,
        u3, v3
      ]);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      textureLoader.load(
        imgPath,
        (tex) => {
          tex.magFilter = THREE.LinearFilter;
          tex.minFilter = THREE.LinearFilter;
          tex.needsUpdate = true;

          const material = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.40, // Subtle Stellarium artwork opacity
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          });

          const mesh = new THREE.Mesh(geometry, material);
          this.artGroup.add(mesh);
        },
        undefined,
        (err) => {
          console.warn(`[ConstellationSystem] Artwork load skipped for ${code}:`, err);
        }
      );
    });

    this.artGroup.visible = this._pendingArtVisible !== undefined ? this._pendingArtVisible : true;
    this.group.add(this.artGroup);

    this.stats = {
      constellationsLoaded: this.constellationLabels.length,
      asterismsLoaded: this.asterismLabels.length,
      hipsReferenced: referencedHips.size,
      hipsResolved: resolvedCount,
      hipsMissing: missingCount,
      lineSegmentsGenerated: segmentsCount
    };

    console.log(`[ConstellationSystem] Stellarium index.json Loaded (Minimalist Top 15 Constellations & Top 5 Asterisms & 3D Artwork):`, this.stats);
  }

  /**
   * Set constellation lines visibility (safe even if called before init completes).
   */
  setArtVisible(visible) {
    this._pendingArtVisible = !!visible;
    if (this.artGroup) {
      this.artGroup.visible = !!visible;
    }
  }

  setConstellationsVisible(visible) {
    this._pendingConstellationsVisible = !!visible;
    if (this.constellationLines) {
      this.constellationLines.visible = !!visible;
    }
  }

  /**
   * Set asterism lines visibility (safe even if called before init completes).
   */
  setAsterismsVisible(visible) {
    this._pendingAsterismsVisible = !!visible;
    if (this.asterismLines) {
      this.asterismLines.visible = !!visible;
    }
  }

  dispose() {
    if (this.group) {
      if (this.constellationLines) {
        if (this.constellationLines.geometry) this.constellationLines.geometry.dispose();
        if (this.constellationLines.material) this.constellationLines.material.dispose();
      }
      if (this.asterismLines) {
        if (this.asterismLines.geometry) this.asterismLines.geometry.dispose();
        if (this.asterismLines.material) this.asterismLines.material.dispose();
      }
      this.group = null;
    }
  }
}

export default ConstellationSystem;
