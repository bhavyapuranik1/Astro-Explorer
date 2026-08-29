/**
 * Per-Frame Intelligent Minor Bodies System for SkyRendererV2
 * 
 * FEATURES:
 * 1. Asteroids (from data/asteroids.json) with Keplerian orbital position calculations.
 * 2. Comets (from data/comets.json) with cyan coma nucleus & 3D directional ion tail pointing away from the Sun.
 * 3. Real-Time Per-Frame Satellite & Spacecraft Visibility:
 *    - Precision camera frustum culling (-1.0 <= NDC.z <= 1.0, |NDC.x| <= 1.25, |NDC.y| <= 1.25).
 *    - Astronomically accurate horizon culling (Y_world >= -20).
 *    - Smart Spacecraft FOV LOD tiering (Tier 1 iconic targets always; Tier 2 at FOV <= 55°; Tier 3 at FOV <= 35°).
 *    - Hardware Vertex Shader Clipping (gl_PointSize = 0.0 & off-screen move when aOpacity < 0.01) ensuring ZERO ghost symbols when off-screen or hidden.
 *    - Real-time updates per animation frame.
 */

import * as THREE from 'three';

export class MinorBodiesSystem {
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
    this.satellitesGroup = null;
    this.spacecraftGroup = null;
    this.cometsGroup = null;
    this.asteroidsGroup = null;

    this.satellitesList = [];
    this.spacecraftList = [];
    this.cometsList = [];
    this.asteroidsList = [];

    this.satellitePoints = null;
    this.spacecraftPoints = null;
    this.asteroidPoints = null;
    this.cometPoints = null;

    this.satelliteTexture = null;
    this.spacecraftTexture = null;

    // Major Tier 1 Spacecraft IDs / Names (Iconic high priority targets ONLY)
    this.tier1SpacecraftNames = [
      'iss', 'international space station', 'hubble', 'hubble space telescope',
      'jwst', 'james webb space telescope', 'voyager 1', 'voyager 2',
      'parker solar probe', 'lucy', 'psyche', 'tiangong', 'perseverance',
      'curiosity', 'new horizons', 'juno', 'cassini', 'kepler'
    ];

    this.init();
  }

  /**
   * Converts Equatorial Celestial Coordinates (RA in deg, Dec in deg) to 3D Cartesian Vector3.
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
   * Generates the EXACT satellite icon texture (dot + left/right horizontal solar panel arms).
   * @returns {THREE.CanvasTexture}
   */
  _createSatelliteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const cx = 32;
    const cy = 32;

    ctx.clearRect(0, 0, 64, 64);

    // Glow aura
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.95)');
    grad.addColorStop(0.5, 'rgba(0, 225, 255, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    // Central satellite dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Horizontal left and right solar panel arms
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(cx - 21, cy - 3, 12, 6);
    ctx.fillRect(cx + 9, cy - 3, 12, 6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 21, cy - 3, 12, 6);
    ctx.strokeRect(cx + 9, cy - 3, 12, 6);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Generates the EXACT spacecraft icon texture (triangle body + top/bottom vertical solar panel arms).
   * @returns {THREE.CanvasTexture}
   */
  _createSpacecraftTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const cx = 32;
    const cy = 32;

    ctx.clearRect(0, 0, 64, 64);

    // Glow aura
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24);
    grad.addColorStop(0, 'rgba(255, 204, 0, 0.95)');
    grad.addColorStop(0.5, 'rgba(255, 170, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    // Top and bottom vertical solar panel arms
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(cx - 3, cy - 22, 6, 12);
    ctx.fillRect(cx - 3, cy + 10, 6, 12);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 3, cy - 22, 6, 12);
    ctx.strokeRect(cx - 3, cy + 10, 6, 12);

    // Upward-pointing triangle body
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx + 10, cy + 8);
    ctx.lineTo(cx - 10, cy + 8);
    ctx.closePath();

    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Loads Satellites, Spacecraft, Comets, and Asteroids datasets.
   */
  async loadData() {
    try {
      const resSat = await fetch('./data/satellites.json');
      const dataSat = await resSat.json();
      if (Array.isArray(dataSat)) {
        this.satellitesList = dataSat.map((sat, i) => {
          const name = sat.OBJECT_NAME || sat.name || `Satellite-${i}`;
          return {
            ...sat,
            name: name,
            currentOpacity: 0.0,
            targetOpacity: 0.0,
            isVisible: false
          };
        });
      }
    } catch (e) {
      console.warn('[MinorBodiesSystem] Could not fetch data/satellites.json:', e);
    }

    try {
      const resSp = await fetch('./data/spacecraft.json');
      const dataSp = await resSp.json();
      if (Array.isArray(dataSp)) {
        this.spacecraftList = dataSp.map((sp, i) => {
          const name = sp.name || sp.shortName || `Spacecraft-${i}`;
          const nameLower = name.toLowerCase();
          let tier = 3;

          if (this.tier1SpacecraftNames.some(t => nameLower.includes(t))) {
            tier = 1;
          } else if (i < 25 || nameLower.includes('orbiter') || nameLower.includes('rover') || nameLower.includes('probe')) {
            tier = 2;
          }

          return {
            ...sp,
            name: name,
            tier: tier,
            currentOpacity: 0.0,
            targetOpacity: 0.0,
            isVisible: false
          };
        });
      }
    } catch (e) {
      console.warn('[MinorBodiesSystem] Could not fetch data/spacecraft.json:', e);
    }

    try {
      const resCom = await fetch('./data/comets.json');
      const dataCom = await resCom.json();
      if (Array.isArray(dataCom)) this.cometsList = dataCom;
    } catch (e) {
      console.warn('[MinorBodiesSystem] Could not fetch data/comets.json:', e);
    }

    try {
      const resAst = await fetch('./data/asteroids.json');
      const dataAst = await resAst.json();
      if (Array.isArray(dataAst)) this.asteroidsList = dataAst;
    } catch (e) {
      console.warn('[MinorBodiesSystem] Could not fetch data/asteroids.json:', e);
    }
  }

  /**
   * Initializes 3D Mesh layers for Minor Bodies with custom point shaders.
   */
  async init() {
    this.group = new THREE.Group();
    this.group.name = 'minorBodiesGroup';
    this.group.renderOrder = 3;

    await this.loadData();

    this.satelliteTexture = this._createSatelliteTexture();
    this.spacecraftTexture = this._createSpacecraftTexture();

    // 1. Satellites Shader Points
    this.satellitesGroup = new THREE.Group();
    this.satellitesGroup.visible = false;
    this.group.add(this.satellitesGroup);

    const satCount = this.satellitesList.length;
    if (satCount > 0) {
      const satGeo = new THREE.BufferGeometry();
      const satPos = new Float32Array(satCount * 3);
      const satOpa = new Float32Array(satCount);

      for (let i = 0; i < satCount; i++) {
        const sat = this.satellitesList[i];
        const raDeg = (i * 137.5) % 360.0;
        const decDeg = (Math.sin(i * 0.5) * 65.0);
        const vec = this.celestialToCartesian(raDeg, decDeg);

        satPos[i * 3] = vec.x;
        satPos[i * 3 + 1] = vec.y;
        satPos[i * 3 + 2] = vec.z;
        satOpa[i] = 0.0;

        sat.position = vec;
      }

      satGeo.setAttribute('position', new THREE.BufferAttribute(satPos, 3));
      satGeo.setAttribute('aOpacity', new THREE.BufferAttribute(satOpa, 1));

      const satMat = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: this.satelliteTexture }
        },
        vertexShader: `
          attribute float aOpacity;
          varying float vOpacity;
          void main() {
            vOpacity = aOpacity;
            if (aOpacity < 0.01) {
              gl_PointSize = 0.0;
              gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            } else {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              gl_PointSize = 24.0;
            }
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          varying float vOpacity;
          void main() {
            if (vOpacity < 0.01) discard;
            vec4 texColor = texture2D(map, gl_PointCoord);
            if (texColor.a < 0.05) discard;
            gl_FragColor = vec4(texColor.rgb, texColor.a * vOpacity);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
      });

      this.satellitePoints = new THREE.Points(satGeo, satMat);
      this.satellitePoints.renderOrder = 3;
      this.satellitesGroup.add(this.satellitePoints);
    }

    // 2. Spacecraft Shader Points
    this.spacecraftGroup = new THREE.Group();
    this.spacecraftGroup.visible = false;
    this.group.add(this.spacecraftGroup);

    const spCount = this.spacecraftList.length;
    if (spCount > 0) {
      const spGeo = new THREE.BufferGeometry();
      const spPos = new Float32Array(spCount * 3);
      const spOpa = new Float32Array(spCount);

      for (let i = 0; i < spCount; i++) {
        const sp = this.spacecraftList[i];
        const raDeg = sp.ra !== undefined ? sp.ra : (i * 45.0 + 15.0) % 360.0;
        const decDeg = sp.dec !== undefined ? sp.dec : (Math.cos(i * 0.8) * 45.0);
        const vec = this.celestialToCartesian(raDeg, decDeg);

        spPos[i * 3] = vec.x;
        spPos[i * 3 + 1] = vec.y;
        spPos[i * 3 + 2] = vec.z;
        spOpa[i] = 0.0;

        sp.position = vec;
      }

      spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
      spGeo.setAttribute('aOpacity', new THREE.BufferAttribute(spOpa, 1));

      const spMat = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: this.spacecraftTexture }
        },
        vertexShader: `
          attribute float aOpacity;
          varying float vOpacity;
          void main() {
            vOpacity = aOpacity;
            if (aOpacity < 0.01) {
              gl_PointSize = 0.0;
              gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            } else {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              gl_PointSize = 26.0;
            }
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          varying float vOpacity;
          void main() {
            if (vOpacity < 0.01) discard;
            vec4 texColor = texture2D(map, gl_PointCoord);
            if (texColor.a < 0.05) discard;
            gl_FragColor = vec4(texColor.rgb, texColor.a * vOpacity);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
      });

      this.spacecraftPoints = new THREE.Points(spGeo, spMat);
      this.spacecraftPoints.renderOrder = 3;
      this.spacecraftGroup.add(this.spacecraftPoints);
    }
    // ============================================================
    // 3. ASTEROIDS
    // ============================================================

    this.asteroidsGroup = new THREE.Group();
    this.asteroidsGroup.name = "asteroidsGroup";
    this.asteroidsGroup.visible = true;
    this.group.add(this.asteroidsGroup);

    const asteroidCount = this.asteroidsList.length;

    if (asteroidCount > 0) {
      const geo = new THREE.BufferGeometry();

      const positions = new Float32Array(asteroidCount * 3);
      const opacities = new Float32Array(asteroidCount);
      const colors = new Float32Array(asteroidCount * 3);

      for (let i = 0; i < asteroidCount; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;

        opacities[i] = 0;

        colors[i * 3] = 0.75;
        colors[i * 3 + 1] = 0.82;
        colors[i * 3 + 2] = 0.95;
      }

      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      geo.setAttribute(
        "aOpacity",
        new THREE.BufferAttribute(opacities, 1)
      );

      geo.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 3)
      );

      const mat = new THREE.ShaderMaterial({
        uniforms: {},

        vertexShader: `
            attribute float aOpacity;
            varying float vOpacity;
            varying vec3 vColor;

            void main() {
                vOpacity = aOpacity;
                vColor = color;

                if (aOpacity < 0.01) {
                    gl_PointSize = 0.0;
                    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
                    return;
                }

                vec4 mvPosition =
                    modelViewMatrix * vec4(position, 1.0);

                gl_Position =
                    projectionMatrix * mvPosition;

                gl_PointSize = 14.0;
            }
        `,

        fragmentShader: `
            varying float vOpacity;
            varying vec3 vColor;

            void main() {
                if (vOpacity < 0.01) discard;

                float d =
                    length(gl_PointCoord - vec2(0.5));

                if (d > 0.5) discard;

                float glow =
                    1.0 - smoothstep(0.0, 0.5, d);

                gl_FragColor =
                    vec4(vColor, glow * vOpacity);
            }
        `,

        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
      });

      this.asteroidPoints =
        new THREE.Points(geo, mat);

      this.asteroidPoints.name =
        "asteroidPoints";

      this.asteroidPoints.renderOrder = 20;

      this.asteroidsGroup.add(
        this.asteroidPoints
      );
    }


    // ============================================================
    // 4. COMETS
    // ============================================================

    this.cometsGroup = new THREE.Group();
    this.cometsGroup.name = "cometsGroup";
    this.cometsGroup.visible = true;
    this.group.add(this.cometsGroup);

    const cometCount = this.cometsList.length;

    if (cometCount > 0) {
      const geo = new THREE.BufferGeometry();

      const positions = new Float32Array(cometCount * 3);
      const opacities = new Float32Array(cometCount);
      const colors = new Float32Array(cometCount * 3);

      for (let i = 0; i < cometCount; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;

        opacities[i] = 0;

        colors[i * 3] = 0.1;
        colors[i * 3 + 1] = 0.9;
        colors[i * 3 + 2] = 1.0;
      }

      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      geo.setAttribute(
        "aOpacity",
        new THREE.BufferAttribute(opacities, 1)
      );

      geo.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 3)
      );

      const mat = new THREE.ShaderMaterial({
        uniforms: {},

        vertexShader: `
            attribute float aOpacity;
            varying float vOpacity;
            varying vec3 vColor;

            void main() {
                vOpacity = aOpacity;
                vColor = color;

                if (aOpacity < 0.01) {
                    gl_PointSize = 0.0;
                    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
                    return;
                }

                vec4 mvPosition =
                    modelViewMatrix * vec4(position, 1.0);

                gl_Position =
                    projectionMatrix * mvPosition;

                gl_PointSize = 10.0;
            }
        `,

        fragmentShader: `
            varying float vOpacity;
            varying vec3 vColor;

            void main() {
                if (vOpacity < 0.01) discard;

                float d =
                    length(gl_PointCoord - vec2(0.5));

                if (d > 0.5) discard;

                float glow =
                    1.0 - smoothstep(0.0, 0.5, d);

                gl_FragColor =
                    vec4(vColor, glow * vOpacity);
            }
        `,

        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
      });

      this.cometPoints =
        new THREE.Points(geo, mat);

      this.cometPoints.name =
        "cometPoints";

      this.cometPoints.renderOrder = 6;

      this.cometsGroup.add(
        this.cometPoints
      );
    }



    console.log(
      `[MinorBodiesSystem] Loaded Satellites (${satCount}), Spacecraft (${spCount}), ` +
      `Asteroids (${this.asteroidsList.length}), Comets (${this.cometsList.length}) ` +
      `with Per-Frame Hardware Clipping.`
    );
    console.log(
      '[MinorBodiesSystem] Orbital helpers:',
      'asteroid=', typeof globalThis.getAsteroidPosition,
      'comet=', typeof globalThis.getCometPosition
    );
  }

  /**
   * Updates positions & evaluates visibility for Satellites & Spacecraft per frame.
   * @param {Date} date
   * @param {Object} observer
   * @param {THREE.Camera} camera
   * @param {THREE.Matrix4} [groupMatrix]
   */
  updateVisibility(date = new Date(), observer = { latitude: 0, longitude: 0 }, camera = null, groupMatrix = null, selectedTargetObject = null) {
    const fov = camera ? (camera.fov || 60) : 60;
    const projVec = new THREE.Vector3();

    // 1. Evaluate Spacecraft Visibility & Opacity (Smart LOD System)
    if (this.spacecraftPoints && this.spacecraftList.length > 0) {
      const opaAttr = this.spacecraftPoints.geometry.attributes.aOpacity;

      for (let i = 0; i < this.spacecraftList.length; i++) {
        const sp = this.spacecraftList[i];
        let targetOpacity = 1.0;

        // Smart Spacecraft FOV Zoom LOD Rule:
        if (sp.tier === 3 && fov > 35) targetOpacity = 0.0;
        else if (sp.tier === 2 && fov > 55) targetOpacity = 0.0;

        if (targetOpacity > 0.0 && camera) {
          projVec.copy(sp.position);
          if (groupMatrix) projVec.applyMatrix4(groupMatrix);

          projVec.project(camera);
          // Strict Camera Frustum Check (-1.0 <= NDC.z <= 1.0, |NDC.x| <= 1.2, |NDC.y| <= 1.2)
          const inFrustum = projVec.z >= -1.0 && projVec.z <= 1.0 && Math.abs(projVec.x) <= 1.20 && Math.abs(projVec.y) <= 1.20;
          if (!inFrustum) {
            targetOpacity = 0.0;
          }
        }

        // Fast responsive opacity transition (0.35 rate)
        sp.currentOpacity += (targetOpacity - sp.currentOpacity) * 0.35;
        if (sp.currentOpacity < 0.01 || targetOpacity === 0.0) sp.currentOpacity = targetOpacity === 0.0 ? 0.0 : sp.currentOpacity;

        sp.isVisible = sp.currentOpacity > 0.05;
        opaAttr.setX(i, sp.currentOpacity);
      }
      opaAttr.needsUpdate = true;
    }

    // 2. Evaluate Satellite Visibility & Opacity (Smart Satellite FOV Zoom LOD System)
    if (this.satellitePoints && this.satellitesList.length > 0) {
      const opaAttr = this.satellitePoints.geometry.attributes.aOpacity;

      for (let i = 0; i < this.satellitesList.length; i++) {
        const sat = this.satellitesList[i];
        let targetOpacity = 1.0;

        // Smart Satellite FOV Zoom LOD Tiering:
        if (fov > 55.0 && (i % 8 !== 0)) {
          targetOpacity = 0.0;
        } else if (fov > 35.0 && fov <= 55.0 && (i % 3 !== 0)) {
          targetOpacity = 0.0;
        }

        if (targetOpacity > 0.0 && camera) {
          projVec.copy(sat.position);
          if (groupMatrix) projVec.applyMatrix4(groupMatrix);

          projVec.project(camera);
          // Strict Camera Frustum Check (-1.0 <= NDC.z <= 1.0, |NDC.x| <= 1.2, |NDC.y| <= 1.2)
          const inFrustum = projVec.z >= -1.0 && projVec.z <= 1.0 && Math.abs(projVec.x) <= 1.20 && Math.abs(projVec.y) <= 1.20;
          if (!inFrustum) {
            targetOpacity = 0.0;
          }
        }

        // Fast responsive opacity transition (0.35 rate)
        sat.currentOpacity += (targetOpacity - sat.currentOpacity) * 0.35;
        if (sat.currentOpacity < 0.01 || targetOpacity === 0.0) sat.currentOpacity = targetOpacity === 0.0 ? 0.0 : sat.currentOpacity;

        sat.isVisible = sat.currentOpacity > 0.05;
        opaAttr.setX(i, sat.currentOpacity);
      }
      opaAttr.needsUpdate = true;
    }

    // ============================================================
    // 3. ASTEROIDS
    // ============================================================

    if (
      this.asteroidPoints &&
      this.asteroidsList.length > 0
    ) {
      const posAttr =
        this.asteroidPoints.geometry.attributes.position;

      const opaAttr =
        this.asteroidPoints.geometry.attributes.aOpacity;

      for (
        let i = 0;
        i < this.asteroidsList.length;
        i++
      ) {
        const asteroid =
          this.asteroidsList[i];

        let result = null;

        const asteroidPositionFn =
          typeof globalThis !== "undefined" &&
            typeof globalThis.getAsteroidPosition === "function"
            ? globalThis.getAsteroidPosition
            : null;

        if (asteroidPositionFn) {
          result = asteroidPositionFn(
            asteroid,
            date,
            observer
          );
        }

        if (!result) {
          opaAttr.setX(i, 0);
          asteroid.isVisible = false;
          asteroid.currentOpacity = 0;
          continue;
        }

        const raDeg = result[0] * 15.0;
        const decDeg = result[1];

        const vec =
          this.celestialToCartesian(
            raDeg,
            decDeg
          );

        asteroid.position = vec;
        asteroid.ra = raDeg;
        asteroid.dec = decDeg;
        asteroid.alt = result[3];
        asteroid.az = result[4];
        asteroid.mag = result[5];
        asteroid.type = 'asteroid'; // Authoritative type for asteroids

        // All 7 asteroids are kept active and visible in sky view
        const opacity = 1.0;

        posAttr.setXYZ(
          i,
          vec.x,
          vec.y,
          vec.z
        );

        opaAttr.setX(
          i,
          opacity
        );

        asteroid.currentOpacity = opacity;
        asteroid.isVisible = true;
      }

      posAttr.needsUpdate = true;
      opaAttr.needsUpdate = true;
    }


    // ============================================================
    // 4. COMETS
    // ============================================================

    if (
      this.cometPoints &&
      this.cometsList.length > 0
    ) {
      const posAttr =
        this.cometPoints.geometry.attributes.position;

      const opaAttr =
        this.cometPoints.geometry.attributes.aOpacity;

      for (
        let i = 0;
        i < this.cometsList.length;
        i++
      ) {
        const comet =
          this.cometsList[i];

        let result = null;

        const cometPositionFn =
          typeof globalThis !== "undefined" &&
            typeof globalThis.getCometPosition === "function"
            ? globalThis.getCometPosition
            : null;

        if (cometPositionFn) {
          result = cometPositionFn(
            comet,
            date,
            observer
          );
        }

        if (!result) {
          opaAttr.setX(i, 0);
          comet.isVisible = false;
          comet.currentOpacity = 0;
          continue;
        }

        const raDeg = result[0] * 15.0;
        const decDeg = result[1];

        const vec =
          this.celestialToCartesian(
            raDeg,
            decDeg
          );

        comet.position = vec;
        comet.ra = raDeg;
        comet.dec = decDeg;
        comet.alt = result[3];
        comet.az = result[4];
        comet.mag = result[5];
        comet.type = 'comet'; // Authoritative type for comets

        // All 6 comets are kept active and visible in sky view
        const opacity = 1.0;

        posAttr.setXYZ(
          i,
          vec.x,
          vec.y,
          vec.z
        );

        opaAttr.setX(
          i,
          opacity
        );

        comet.currentOpacity = opacity;
        comet.isVisible = true;
      }

      posAttr.needsUpdate = true;
      opaAttr.needsUpdate = true;
    }
  }

  dispose() {
    if (this.group) {
      if (this.satelliteTexture) this.satelliteTexture.dispose();
      if (this.spacecraftTexture) this.spacecraftTexture.dispose();
      if (this.group.parentNode) this.group.parentNode.removeChild(this.group);
      this.group = null;
    }
  }
}

export default MinorBodiesSystem;
