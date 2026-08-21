/**
 * SkyRendererV2 - Three.js Astronomical Sky Renderer Module
 * 
 * FEATURES:
 * - Complete 3D Celestial Objects Engine (Stars, 3D Milky Way, Atmosphere, Planets, Sun, Moon, DSOs, Constellations, Asterisms, Asteroids, Comets, Satellites, Spacecraft).
 * - Constellation boundaries (88 official constellations) and Asterisms (Big Dipper, Summer Triangle, Winter Hexagon, Orion's Belt, Southern Cross).
 * - Minor Bodies System with Asteroids, Comets (coma & tail), Satellites, and Spacecraft using exact original icon sprites.
 * - Intelligent 2D Overlay Label System with Horizon Clipping and Camera FOV Zoom LOD scaling.
 * - 100% Search compatible with camera target centering & focus highlighting.
 * 
 * IMPORTANT:
 * - Celestial.js remains 100% active and untouched.
 * - SkyRendererV2 remains fully isolated inside rendererV2/ module.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AtmosphereSystem } from './atmosphereSystem.js';
import { SolarSystem } from './solarSystem.js';
import { DSOSystem } from './dsoSystem.js';
import { DSORenderingSystem } from './dsoRenderingSystem.js';
import { ConstellationSystem } from './constellationSystem.js';
import { MinorBodiesSystem } from './minorBodiesSystem.js';
import { LabelSystem } from './labelSystem.js';
import { StarRenderingSystem } from './starRenderingSystem.js';
import { BrightStarGlowSystem } from './brightStarGlowSystem.js';
import { MilkyWaySystem } from './milkyWaySystem.js';
import { PickingSystem } from './pickingSystem.js';
import { LandscapeSystem } from './landscapeSystem.js';

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
      clearColor: 0x02040a,
      clearAlpha: 1.0,
      ...options
    };

    this.container = null;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.showPlanets = true;
    this.showDSOs = true;
    this.showStars = true;
    this.showStarLabels = true;
    // Star magnitude limit must exist before StarRenderingSystem initializes.
this.starMagnitudeLimit = 4.0;
    this.showDSOLabels = true;
    this.showConstellations = true;
    this.showConstellationNames = true;
    this.showAsterisms = true;
    this.showAsterismNames = true;
    this.showSatellites = false;
    this.showSpacecraft = false;
    this.showAsteroids = true;
    this.showComets = true;
    this.showAtmosphere = true;
    this.showLandscape = true;
    // Grid layer visibility flags
    this.showEquatorialGrid = false;
    this.showCelestialEquator = false;
    this.showEcliptic = false;
    this.showGalacticPlane = false;
    this.showHorizonLine = false;

    // Grid layer meshes
    this.gridEquatorial = null;
    this.gridCelestialEquator = null;
    this.gridEcliptic = null;
    this.gridGalacticPlane = null;
    this.gridHorizon = null;
    this.controls = null;

    this.starSphereGroup = null;
    this.milkyWayMesh = null;
    this.milkyWayMaterial = null;
    this.milkyWayOpacity = 0.85;
    this.milkyWayBrightness = 1.0;

    this.atmosphere = null;
    this.solarSystem = null;
    this.starRenderingSystem = null;
    this.dsoSystem = null;
    this.constellationSystem = null;
    this.minorBodiesSystem = null;
    this.labelSystem = null;
    this.pickingSystem = new PickingSystem(this);

    this.starLabels = [];
    this._onWindowResizeBound = this._onWindowResize.bind(this);
  }

  /**
   * Converts Celestial RA (deg) & Dec (deg) to 3D Cartesian Vector3.
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
   * Initializes high-resolution Stellarium-quality MilkyWaySystem.
   */
  async loadMilkyWay() {
    try {
      this.milkyWaySystem = new MilkyWaySystem({ radius: this.options.sphereRadius * 0.999 });
      await this.milkyWaySystem.init();
      // Restore current UI settings after MilkyWaySystem finishes initializing.
this.milkyWaySystem.setBrightness(this.milkyWayBrightness);
this.milkyWaySystem.setOpacity(this.milkyWayOpacity);
      if (this.milkyWaySystem && this.milkyWaySystem.group && this.starSphereGroup) {
        this.starSphereGroup.add(this.milkyWaySystem.group);
      }
      console.log('[SkyRendererV2] Successfully initialized Stellarium-Quality MilkyWaySystem.');
    } catch (e) {
      console.warn('[SkyRendererV2] Could not initialize MilkyWaySystem:', e);
    }
  }

  /**
   * Creates a line-segments mesh from a flat array of XYZ pairs.
   */
  _makeLineMesh(points, color, opacity, name) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const mesh = new THREE.LineSegments(geo, mat);
    mesh.name = name;
    mesh.visible = false;
    return mesh;
  }

  /**
   * Builds all 5 independent grid/reference-line layers.
   */
  createGridLayers(radius = this.options.sphereRadius * 0.995) {
    // ── 1. EQUATORIAL GRID (RA meridians every 1h + Dec parallels every 15°) ──
    {
      const pts = [];
      for (let h = 0; h < 24; h++) {
        const ra = h * 15;
        for (let d = -85; d < 85; d += 3) {
          const a = this.celestialToCartesian(ra, d, radius);
          const b = this.celestialToCartesian(ra, d + 3, radius);
          pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
      for (let d = -75; d <= 75; d += 15) {
        for (let ra = 0; ra < 360; ra += 3) {
          const a = this.celestialToCartesian(ra, d, radius);
          const b = this.celestialToCartesian(ra + 3, d, radius);
          pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
      this.gridEquatorial = this._makeLineMesh(pts, 0x2266bb, 0.40, 'equatorialGrid');
    }

    // ── 2. CELESTIAL EQUATOR (single circle at Dec = 0) ──
    {
      const pts = [];
      for (let ra = 0; ra < 360; ra += 2) {
        const a = this.celestialToCartesian(ra, 0, radius);
        const b = this.celestialToCartesian(ra + 2, 0, radius);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      this.gridCelestialEquator = this._makeLineMesh(pts, 0x4499ff, 0.75, 'celestialEquator');
    }

    // ── 3. ECLIPTIC  (J2000 obliquity ε = 23.4393°, tilted from equator) ──
    {
      const pts = [];
      const eps = THREE.MathUtils.degToRad(23.4393);
      for (let i = 0; i < 360; i += 2) {
        const lon1 = THREE.MathUtils.degToRad(i);
        const lon2 = THREE.MathUtils.degToRad(i + 2);
        const raDeg1 = THREE.MathUtils.radToDeg(Math.atan2(Math.sin(lon1) * Math.cos(eps), Math.cos(lon1)));
        const decDeg1 = THREE.MathUtils.radToDeg(Math.asin(Math.sin(eps) * Math.sin(lon1)));
        const raDeg2 = THREE.MathUtils.radToDeg(Math.atan2(Math.sin(lon2) * Math.cos(eps), Math.cos(lon2)));
        const decDeg2 = THREE.MathUtils.radToDeg(Math.asin(Math.sin(eps) * Math.sin(lon2)));
        const a = this.celestialToCartesian((raDeg1 + 360) % 360, decDeg1, radius);
        const b = this.celestialToCartesian((raDeg2 + 360) % 360, decDeg2, radius);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      this.gridEcliptic = this._makeLineMesh(pts, 0x44cc88, 0.75, 'ecliptic');
    }

    // ── 4. GALACTIC PLANE  (convert galactic l=0..360, b=0 → equatorial) ──
    {
      const pts = [];
      // Galactic north pole in J2000: RA 192.859°, Dec +27.128°; Galactic centre: RA 266.405°, Dec -28.936°
      const ngpRa = THREE.MathUtils.degToRad(192.859);
      const ngpDec = THREE.MathUtils.degToRad(27.128);
      const l0Ra = THREE.MathUtils.degToRad(266.405);
      const cosDngp = Math.cos(ngpDec), sinDngp = Math.sin(ngpDec);
      const galToEq = (l) => {
        const lr = THREE.MathUtils.degToRad(l);
        const x = Math.cos(lr), y = Math.sin(lr);
        // Rotate galactic plane (b=0) into equatorial
        const sinRA = Math.cos(l0Ra - lr) * cosDngp;
        const cosRA = -Math.sin(l0Ra - lr);
        const sinDec = Math.sin(l0Ra - lr) * sinDngp;
        const ra = Math.atan2(sinRA, cosRA) + ngpRa;
        const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
        return this.celestialToCartesian(THREE.MathUtils.radToDeg((ra + 2 * Math.PI) % (2 * Math.PI)), THREE.MathUtils.radToDeg(dec), radius);
      };
      for (let l = 0; l < 360; l += 2) {
        const a = galToEq(l);
        const b = galToEq(l + 2);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      this.gridGalacticPlane = this._makeLineMesh(pts, 0xcc6644, 0.65, 'galacticPlane');
    }

    // ── 5. HORIZON / ALT-AZ GRID  (circles every 30° altitude + az meridians) ──
    // Horizon sits in the XZ plane (Y = 0).  Because starSphereGroup is rotated
    // by LST & latitude each frame, we put the horizon in a SEPARATE fixed group.
    {
      const pts = [];
      const hr = radius * 0.997;
      // Horizon ring (alt = 0)
      for (let az = 0; az < 360; az += 2) {
        const a1 = THREE.MathUtils.degToRad(az), a2 = THREE.MathUtils.degToRad(az + 2);
        pts.push(Math.sin(a1) * hr, 0, Math.cos(a1) * hr,
          Math.sin(a2) * hr, 0, Math.cos(a2) * hr);
      }
      // Altitude circles 30°, 60°
      for (const alt of [30, 60]) {
        const y = Math.sin(THREE.MathUtils.degToRad(alt)) * hr;
        const cr = Math.cos(THREE.MathUtils.degToRad(alt)) * hr;
        for (let az = 0; az < 360; az += 2) {
          const a1 = THREE.MathUtils.degToRad(az), a2 = THREE.MathUtils.degToRad(az + 2);
          pts.push(Math.sin(a1) * cr, y, Math.cos(a1) * cr,
            Math.sin(a2) * cr, y, Math.cos(a2) * cr);
        }
      }
      // Azimuth meridians every 90°
      for (const az of [0, 90, 180, 270]) {
        const ax = THREE.MathUtils.degToRad(az);
        for (let alt = 0; alt < 90; alt += 2) {
          const a1 = THREE.MathUtils.degToRad(alt), a2 = THREE.MathUtils.degToRad(alt + 2);
          pts.push(Math.sin(ax) * Math.cos(a1) * hr, Math.sin(a1) * hr, Math.cos(ax) * Math.cos(a1) * hr,
            Math.sin(ax) * Math.cos(a2) * hr, Math.sin(a2) * hr, Math.cos(ax) * Math.cos(a2) * hr);
        }
      }
      this.gridHorizon = this._makeLineMesh(pts, 0xffa040, 0.55, 'horizonGrid');
    }
  }

  /**
   * Robustly parses RA in celestial degrees (supports numbers, numeric strings, "HH:MM:SS", and "HHh MMm").
   * @param {*} val
   * @returns {number|null}
   */
  parseCelestialRA(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') {
      return isNaN(val) ? null : ((val % 360) + 360) % 360;
    }
    let str = String(val).trim();
    if (!str) return null;

    str = str.replace(/[hms]/gi, ' ').trim();
    if (str.includes(':')) {
      const parts = str.split(':').map(p => parseFloat(p) || 0);
      const h = parts[0] || 0;
      const m = parts[1] || 0;
      const s = parts[2] || 0;
      const sign = h < 0 || str.startsWith('-') ? -1 : 1;
      const totalHours = Math.abs(h) + (m / 60.0) + (s / 3600.0);
      return ((sign * totalHours * 15.0 % 360) + 360) % 360;
    }

    const parts = str.split(/\s+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
    if (parts.length >= 2) {
      const h = parts[0] || 0;
      const m = parts[1] || 0;
      const s = parts[2] || 0;
      const sign = h < 0 || str.startsWith('-') ? -1 : 1;
      const totalHours = Math.abs(h) + (m / 60.0) + (s / 3600.0);
      return ((sign * totalHours * 15.0 % 360) + 360) % 360;
    }

    const num = parseFloat(str);
    return isNaN(num) ? null : ((num % 360) + 360) % 360;
  }

  /**
   * Robustly parses Dec in celestial degrees (supports numbers, numeric strings, "+DD:MM:SS", "-DD:MM:SS", and space-separated "+DD MM").
   * @param {*} val
   * @returns {number|null}
   */
  parseCelestialDec(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') {
      return isNaN(val) ? null : val;
    }
    let str = String(val).trim();
    if (!str) return null;

    str = str.replace(/[d°'"]/gi, ' ').trim();
    const sign = str.startsWith('-') ? -1 : 1;

    if (str.includes(':')) {
      const parts = str.split(':').map(p => parseFloat(p) || 0);
      const d = parts[0] || 0;
      const m = parts[1] || 0;
      const s = parts[2] || 0;
      return sign * (Math.abs(d) + (m / 60.0) + (s / 3600.0));
    }

    const parts = str.split(/\s+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
    if (parts.length >= 2) {
      const d = parts[0] || 0;
      const m = parts[1] || 0;
      const s = parts[2] || 0;
      return sign * (Math.abs(d) + (m / 60.0) + (s / 3600.0));
    }

    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Calculates world position Vector3 for any celestial object.
   * @param {Object} obj - Target object metadata.
   * @returns {THREE.Vector3|null}
   */
  getObjectWorldPosition(obj) {
    if (!obj) return null;

    const radius = this.options.sphereRadius * 0.995;
    if (this.starSphereGroup) {
      this.starSphereGroup.updateMatrixWorld(true);
    }

    // 1. Direct Local / World Vector Transformation (Dynamic Frame Evaluation)
    const localVec = obj.position || (obj.item && obj.item.position) || (obj.rawObj && obj.rawObj.position) || null;
    if (localVec && typeof localVec.x === 'number' && typeof localVec.y === 'number' && typeof localVec.z === 'number') {
      const wPos = localVec.clone();
      if (this.starSphereGroup) {
        wPos.applyMatrix4(this.starSphereGroup.matrixWorld);
      }
      return wPos;
    }

    // 2. Planets & Solar System
    if (obj.type === 'planet' || obj.type === 'sun' || obj.type === 'moon') {
      const nameLower = String(obj.displayName || obj.name || obj.id || '').toLowerCase();
      if (this.solarSystem && this.solarSystem.planetCatalog) {
        const match = this.solarSystem.planetCatalog.find(p => {
          const pName = String(p.name || p.id || '').toLowerCase();
          return pName === nameLower || nameLower.includes(pName) || pName.includes(nameLower);
        });
        if (match && match.position) {
          const wPos = match.position.clone();
          if (this.starSphereGroup) wPos.applyMatrix4(this.starSphereGroup.matrixWorld);
          return wPos;
        }
      }
    }

    // 3. Minor Bodies (Spacecraft & Satellites)
    if (this.minorBodiesSystem) {
      const nameLower = String(obj.displayName || obj.name || '').toLowerCase();
      const idStr = String(obj.id || '').toLowerCase();
      if (obj.type === 'spacecraft' && Array.isArray(this.minorBodiesSystem.spacecraftList)) {
        const sp = this.minorBodiesSystem.spacecraftList.find(s => {
          const sName = String(s.name || s.displayName || s.id || '').toLowerCase();
          return (nameLower && sName.includes(nameLower)) || (idStr && sName.includes(idStr)) || (nameLower && nameLower.includes(sName));
        });
        if (sp && sp.position) {
          const wPos = sp.position.clone();
          if (this.starSphereGroup) wPos.applyMatrix4(this.starSphereGroup.matrixWorld);
          return wPos;
        }
      }
      if (obj.type === 'satellite' && Array.isArray(this.minorBodiesSystem.satellitesList)) {
        const sat = this.minorBodiesSystem.satellitesList.find(s => {
          const sName = String(s.name || s.OBJECT_NAME || '').toLowerCase();
          const sId = String(s.NORAD_CAT_ID || s.id || '').toLowerCase();
          return (nameLower && sName.includes(nameLower)) || (idStr && (sId === idStr || sName.includes(idStr)));
        });
        if (sat && sat.position) {
          const wPos = sat.position.clone();
          if (this.starSphereGroup) wPos.applyMatrix4(this.starSphereGroup.matrixWorld);
          return wPos;
        }
        // 3B. Asteroids & Comets
if (this.minorBodiesSystem) {

    const nameLower =
        String(
            obj.displayName ||
            obj.name ||
            obj.id ||
            ""
        ).toLowerCase();

    const idStr =
        String(
            obj.id ||
            ""
        ).toLowerCase();

    if (
        obj.type === "asteroid" &&
        Array.isArray(
            this.minorBodiesSystem.asteroidsList
        )
    ) {
        const asteroid =
            this.minorBodiesSystem.asteroidsList.find(a => {

                const aName =
                    String(
                        a.name ||
                        a.displayName ||
                        a.id ||
                        ""
                    ).toLowerCase();

                const aId =
                    String(
                        a.id ||
                        a.name ||
                        ""
                    ).toLowerCase();

                return (
                    aId === idStr ||
                    aName === nameLower ||
                    aName.includes(nameLower) ||
                    nameLower.includes(aName)
                );
            });

        if (
            asteroid &&
            asteroid.position
        ) {
            const wPos =
                asteroid.position.clone();

            if (this.starSphereGroup) {
                wPos.applyMatrix4(
                    this.starSphereGroup.matrixWorld
                );
            }

            return wPos;
        }
    }

    if (
        obj.type === "comet" &&
        Array.isArray(
            this.minorBodiesSystem.cometsList
        )
    ) {
        const comet =
            this.minorBodiesSystem.cometsList.find(c => {

                const cName =
                    String(
                        c.name ||
                        c.displayName ||
                        c.id ||
                        ""
                    ).toLowerCase();

                const cId =
                    String(
                        c.id ||
                        c.name ||
                        ""
                    ).toLowerCase();

                return (
                    cId === idStr ||
                    cName === nameLower ||
                    cName.includes(nameLower) ||
                    nameLower.includes(cName)
                );
            });

        if (
            comet &&
            comet.position
        ) {
            const wPos =
                comet.position.clone();

            if (this.starSphereGroup) {
                wPos.applyMatrix4(
                    this.starSphereGroup.matrixWorld
                );
            }

            return wPos;
        }
    }
}
      }
    }

    // 4. Celestial RA & Dec Coordinates (check top-level or nested)
    const rawRa = obj.ra !== undefined ? obj.ra :
      (obj.rawObj && obj.rawObj.ra !== undefined) ? obj.rawObj.ra :
        (obj.item && obj.item.ra !== undefined) ? obj.item.ra :
          (obj.satData && obj.satData.ra !== undefined) ? obj.satData.ra : null;

    const rawDec = obj.dec !== undefined ? obj.dec :
      (obj.rawObj && obj.rawObj.dec !== undefined) ? obj.rawObj.dec :
        (obj.item && obj.item.dec !== undefined) ? obj.item.dec :
          (obj.satData && obj.satData.dec !== undefined) ? obj.satData.dec : null;

    let ra = this.parseCelestialRA(rawRa);
    let dec = this.parseCelestialDec(rawDec);

    // Fallback: search DSO catalog list if RA/Dec missing
    const typeLower = String(obj.type || '').toLowerCase();
    const isDSOType = !typeLower || typeLower === 'dso' || typeLower === 'ngc' || typeLower === 'ic' || typeLower === 'messier' ||
      ['oc', 'gc', 'g', 'pn', 'sfr', 'rn', 'e', 's', 'snr', 'pos', 'i', 'nebula', 'cluster'].includes(typeLower);

    if ((ra === null || dec === null) && isDSOType && this.dsoRenderingSystem && Array.isArray(this.dsoRenderingSystem.dsoList)) {
      const dsoKey = String(obj.id || obj.name || obj.displayName || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      const match = this.dsoRenderingSystem.dsoList.find(d => {
        const k1 = String(d.id || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        const k2 = String(d.name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        return k1 === dsoKey || k2 === dsoKey || (k1 && dsoKey.includes(k1)) || (k2 && dsoKey.includes(k2));
      });
      if (match) {
        ra = this.parseCelestialRA(match.ra);
        dec = this.parseCelestialDec(match.dec);
      }
    }

    // 5. Constellations & Asterisms
    if ((obj.type === 'constellation' || obj.type === 'asterism') && this.constellationSystem) {
      const cKey = String(obj.displayName || obj.name || obj.id || '').toLowerCase().replace(/\s+/g, '');
      const list = obj.type === 'constellation' ? this.constellationSystem.constellationLabels : this.constellationSystem.asterismLabels;
      if (Array.isArray(list)) {
        const match = list.find(c => {
          const k1 = String(c.name || '').toLowerCase().replace(/\s+/g, '');
          const k2 = String(c.id || '').toLowerCase().replace(/\s+/g, '');
          return k1 === cKey || k2 === cKey;
        });
        if (match && match.position) {
          const wPos = match.position.clone();
          if (this.starSphereGroup) wPos.applyMatrix4(this.starSphereGroup.matrixWorld);
          return wPos;
        }
      }
    }

    // 6. Stars Catalog Lookup (Only if RA/Dec missing on obj)
    if ((ra === null || dec === null) && obj.type === 'star' && this.starRenderingSystem && Array.isArray(this.starRenderingSystem.starsList)) {
      const sKey = String(obj.name || obj.displayName || obj.id || '').toLowerCase().replace(/\s+/g, '');
      const match = this.starRenderingSystem.starsList.find(s => {
        const k1 = String(s.name || '').toLowerCase().replace(/\s+/g, '');
        const k2 = String(s.properName || '').toLowerCase().replace(/\s+/g, '');
        const k3 = String(s.bayerName || '').toLowerCase().replace(/\s+/g, '');
        const k4 = String(s.id || '').toLowerCase().replace(/\s+/g, '');
        return k1 === sKey || k2 === sKey || k3 === sKey || k4 === sKey;
      });
      if (match) {
        ra = this.parseCelestialRA(match.ra);
        dec = this.parseCelestialDec(match.dec);
      }
    }

    // 7. Search Objects Master Catalog Match (Universal Fallback for Search & Info Panel)
    if ((ra === null || dec === null) && typeof window !== 'undefined' && Array.isArray(window.searchObjects)) {
      const targetName = String(obj.displayName || obj.name || obj.id || '').toLowerCase().replace(/\s+/g, '');
      if (targetName) {
        const match = window.searchObjects.find(s => {
          if (!s) return false;
          const k1 = String(s.id || '').toLowerCase().replace(/\s+/g, '');
          const k2 = String(s.name || '').toLowerCase().replace(/\s+/g, '');
          const k3 = String(s.displayName || '').toLowerCase().replace(/\s+/g, '');
          return k1 === targetName || k2 === targetName || k3 === targetName;
        });
        if (match) {
          if (match.position && typeof match.position.x === 'number') {
            const wPos = new THREE.Vector3(match.position.x, match.position.y, match.position.z);
            if (this.starSphereGroup) wPos.applyMatrix4(this.starSphereGroup.matrixWorld);
            return wPos;
          }
          ra = this.parseCelestialRA(match.ra);
          dec = this.parseCelestialDec(match.dec);
        }
      }
    }

    if (ra !== null && dec !== null) {
      const localPos = this.celestialToCartesian(ra, dec, radius);
      if (this.starSphereGroup) {
        localPos.applyMatrix4(this.starSphereGroup.matrixWorld);
      }
      return localPos;
    }

    return null;
  }

  /**
   * Smoothly rotates camera to focus on target object.
   * @param {Object} obj - Target object.
   * @param {number} [duration=800] - Focus transition duration in ms.
   */
  focusOnObject(obj, duration = 800) {
    if (!obj || !this.camera) return;
    this.setSelectedObject(obj);

    if (this.focusAnimId) {
      cancelAnimationFrame(this.focusAnimId);
      this.focusAnimId = null;
    }

    const startCamPos = this.camera.position.clone();
    const camRadius = 0.1;
    const startTime = performance.now();

    const animateCamera = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      // Smooth cubic easing
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Re-evaluate target world position dynamically each frame (tracks real-time sky rotation)
      const currentWPos = this.getObjectWorldPosition(obj);
      if (currentWPos && currentWPos.lengthSq() > 0.001) {
        const targetDir = currentWPos.clone().normalize();
        const targetCamPos = targetDir.clone().negate().multiplyScalar(camRadius);

        this.camera.position.lerpVectors(startCamPos, targetCamPos, ease);

        if (Math.abs(targetDir.y) > 0.95) {
          this.camera.up.set(0, 0, 1);
        } else {
          this.camera.up.set(0, 1, 0);
        }

        if (this.controls) {
          this.controls.target.set(0, 0, 0);
          this.controls.update();
        }
      }

      if (progress < 1.0) {
        this.focusAnimId = requestAnimationFrame(animateCamera);
      } else {
        this.focusAnimId = null;
        if (this.controls) {
          this.controls.target.set(0, 0, 0);
          this.controls.update();
        }
      }
    };

    this.focusAnimId = requestAnimationFrame(animateCamera);
  }

  /**
   * Performs screen-space object picking with 5-Level Priority:
   * Level 1: Planets / Sun / Moon
   * Level 2: DSOs
   * Performs screen-space object picking delegated to PickingSystem.
   * @param {number} clientX - Pointer screen X.
   * @param {number} clientY - Pointer screen Y.
   * @returns {Object|null} Picked target object or null.
   */
  pickObject(clientX, clientY) {
    if (this.pickingSystem) {
      return this.pickingSystem.pickObject(clientX, clientY);
    }
    return null;
  }

  /**
   * Checks if an object is visible and clickable on screen.
   * @param {Object} obj - Candidate target object.
   * @param {string} [fallbackType=null] - Optional category fallback type string.
   * @returns {boolean}
   */
  isObjectVisible(obj, fallbackType = null) {
    if (this.pickingSystem) {
      return this.pickingSystem.isObjectVisible(obj, fallbackType);
    }
    return false;
  };

  /**
   * Performs lightweight hover detection over visible text labels.
   * Updates container cursor style to 'pointer' when hovering over a label.
   * @param {number} clientX
   * @param {number} clientY
   */
  checkLabelHover(clientX, clientY) {
    if (!this.container || !this.labelSystem || !Array.isArray(this.labelSystem.renderedLabelBoxes)) return;

    const rect = this.container.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const LABEL_HIT_PADDING = 4;

    let isOverLabel = false;
    const boxes = this.labelSystem.renderedLabelBoxes;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (!box || !box.name || box.visible === false || box.type === 'constellation' || box.type === 'asterism') continue;

      if (mouseX >= box.minX - LABEL_HIT_PADDING && mouseX <= box.maxX + LABEL_HIT_PADDING &&
        mouseY >= box.minY - LABEL_HIT_PADDING && mouseY <= box.maxY + LABEL_HIT_PADDING) {

        const targetObj = box.item || box.rawObj;
        if (targetObj && this.isObjectVisible(targetObj, box.type)) {
          isOverLabel = true;
          break;
        }
      }
    }

    if (isOverLabel) {
      this.container.style.cursor = 'pointer';
    } else {
      this.container.style.cursor = 'crosshair';
    }
  }

  /**

  /**
   * Sets active selected object and updates 2D/3D label highlighting.
   * @param {Object|null} obj
   */
  setSelectedObject(obj) {
    this.selectedTargetObject = obj || null;

    const name = obj
      ? (obj.displayName || obj.name || obj.id || null)
      : null;

    if (typeof window !== 'undefined') {
      window.searchHighlightId = name;

      // Tell the V2 marker system directly that this exact object
      // is the selected target.
      window.v2SelectedObject = obj || null;
    }

    if (this.labelSystem) {
      this.labelSystem.setSearchTarget(name);
    }

    // Immediately request marker creation/refresh.
    if (obj && typeof window !== 'undefined' &&
      typeof window.ensureV2SelectionMarker === 'function') {
      window.ensureV2SelectionMarker();
    }
  }

  /**
   * Projects a celestial object to container-relative screen coordinates.
   * Returns {x, y} in pixels, or null if the object is behind the camera / not visible.
   * @param {Object} obj - Any searchObjects-style object.
   * @returns {{x: number, y: number}|null}
   */
  getScreenPosition(obj) {
    if (!obj || !this.camera || !this.container) return null;

    const wPos = this.getObjectWorldPosition(obj);
    if (!wPos) return null;

    const proj = wPos.clone().project(this.camera);

    // Behind camera frustum plane — return null so marker hides
    if (proj.z > 1.0) {
      return null;
    }

    const rect = this.container.getBoundingClientRect();
    const x = (proj.x * 0.5 + 0.5) * rect.width;
    const y = (-proj.y * 0.5 + 0.5) * rect.height;

    return { x, y };
  }

  /**
   * Re-evaluates on-screen label targets and updates LabelSystem overlay.
   */
  updateLabelsList() {
    if (!this.labelSystem) return;

    const targets = [];
    const radius = this.options.sphereRadius * 0.995;

    // ---------------------------------------------------------
    // DAYTIME / EXR PRESENTATION STATE
    // ---------------------------------------------------------
    // AtmosphereSystem remains active for astronomical calculations,
    // but the old procedural atmosphere mesh is not the visual sky.
    const sunAlt =
      this.atmosphere &&
        this.atmosphere.sunAltitude !== undefined
        ? this.atmosphere.sunAltitude
        : -30;

    // EXR daytime presentation is active only when:
    // Atmosphere toggle = ON AND Sun is above horizon.
    const exrDayPresentation =
      this.showAtmosphere && sunAlt > 0;

    // ---------------------------------------------------------
    // 1. PLANETS / SUN / MOON
    // ---------------------------------------------------------
    // These labels remain visible during daytime.
    if (
      this.showPlanets &&
      this.solarSystem &&
      this.solarSystem.planetCatalog
    ) {
      this.solarSystem.planetCatalog.forEach(p => {
        if (p.position) {
          targets.push({
            name: p.name,
            position: p.position,
            type: 'planet',
            color: '#ffd700',
            priority: 0,
            ra: p.ra || 0,
            dec: p.dec || 0,
            rawObj: p
          });
        }
      });
    }

    // ---------------------------------------------------------
    // 2. DSO LABELS
    // ---------------------------------------------------------
    // Hide during bright EXR daytime.
    if (
      this.showDSOLabels &&
      !exrDayPresentation &&
      this.dsoRenderingSystem
    ) {
      const fov = this.camera
        ? (this.camera.fov || 60)
        : 60;

      const highlightId =
        this.selectedTargetObject
          ? (
            this.selectedTargetObject.name ||
            this.selectedTargetObject.id
          )
          : null;

      const dsoLabels =
        this.dsoRenderingSystem.getDSOLabels(
          fov,
          highlightId
        );

      if (Array.isArray(dsoLabels)) {
        dsoLabels.forEach(d => {
          if (d.position && d.name) {
            targets.push({
              name: d.name || d.id,
              position: d.position,
              type: 'dso',
              color: d.color || '#ff77aa',
              priority:
                d.priority !== undefined
                  ? d.priority
                  : 2,
              ra: d.ra !== undefined ? d.ra : 0,
              dec: d.dec !== undefined ? d.dec : 0,
              mag: d.mag || 7.0,
              rawObj: d.rawObj || d
            });
          }
        });
      }
    }

    // ---------------------------------------------------------
    // 3. STAR LABELS
    // ---------------------------------------------------------
    // Hide during bright EXR daytime.
    if (
      this.showStars &&
      !exrDayPresentation &&
      this.starRenderingSystem
    ) {
      const fov = this.camera
        ? (this.camera.fov || 60)
        : 60;

      const magLimit =
        parseFloat(this.starMagnitudeLimit) || 6.5;

      const highlightId =
        this.selectedTargetObject
          ? (
            this.selectedTargetObject.name ||
            this.selectedTargetObject.id
          )
          : null;

      const starLabels =
        this.starRenderingSystem.getStarLabels(
          fov,
          magLimit,
          highlightId
        );

      if (Array.isArray(starLabels)) {
        starLabels.forEach(s => {
          if (s.position && s.name) {
            targets.push({
              name: s.name,
              position: s.position,
              type: 'star',
              color: s.color || '#ffffff',
              priority:
                s.priority !== undefined
                  ? s.priority
                  : 1,
              ra: s.ra || 0,
              dec: s.dec || 0,
              mag: s.mag || 1.0,
              rawObj: s
            });
          }
        });
      }
    }

    // ---------------------------------------------------------
    // 4. CONSTELLATIONS & ASTERISMS
    // ---------------------------------------------------------
    // Hide both labels during bright daytime.
    if (
      this.constellationSystem &&
      !exrDayPresentation
    ) {
      if (
        this.showConstellations &&
        this.showConstellationNames &&
        this.constellationSystem.constellationLines &&
        this.constellationSystem.constellationLines.visible !== false
      ) {
        this.constellationSystem.constellationLabels.forEach(c => {
          targets.push({
            name: c.name,
            position: c.position,
            type: 'constellation',
            color: '#33aaff',
            priority: 2,
            ra: c.ra || 0,
            dec: c.dec || 0,
            rawObj: c
          });
        });
      }

      if (
        this.showAsterisms &&
        this.showAsterismNames &&
        this.constellationSystem.asterismLines &&
        this.constellationSystem.asterismLines.visible !== false
      ) {
        this.constellationSystem.asterismLabels.forEach(a => {
          targets.push({
            name: a.name,
            position: a.position,
            type: 'asterism',
            color: '#ffcc00',
            priority: 2,
            ra: a.ra || 0,
            dec: a.dec || 0,
            rawObj: a
          });
        });
      }
    }

    // ---------------------------------------------------------
    // 5. SPACECRAFT
    // ---------------------------------------------------------
    // Hide labels during bright daytime.
    if (
      this.showSpacecraft &&
      !exrDayPresentation &&
      this.minorBodiesSystem &&
      Array.isArray(
        this.minorBodiesSystem.spacecraftList
      )
    ) {
      this.minorBodiesSystem.spacecraftList.forEach(sp => {
        if (
          sp.position &&
          (
            sp.isVisible ||
            sp.currentOpacity > 0.15
          )
        ) {
          targets.push({
            name: sp.name,
            position: sp.position,
            type: 'spacecraft',
            color: '#00f5ff',
            priority: 1,
            ra: sp.ra || 0,
            dec: sp.dec || 0,
            rawObj: sp
          });
        }
      });
    }

    // ---------------------------------------------------------
    // 6. SATELLITES
    // ---------------------------------------------------------
    // Hide labels during bright daytime.
    if (
      this.showSatellites &&
      !exrDayPresentation &&
      this.minorBodiesSystem &&
      Array.isArray(
        this.minorBodiesSystem.satellitesList
      )
    ) {
      const selectedName =
        this.selectedTargetObject
          ? (
            this.selectedTargetObject.name || ''
          ).toLowerCase()
          : '';

      this.minorBodiesSystem.satellitesList.forEach(sat => {
        const sName =
          (
            sat.name ||
            sat.OBJECT_NAME ||
            ''
          ).toLowerCase();

        const isSelected =
          selectedName &&
          (
            selectedName === sName ||
            sName.includes(selectedName)
          );

        if (
          sat.position &&
          (
            sat.isVisible ||
            sat.currentOpacity > 0.15 ||
            isSelected
          )
        ) {
          targets.push({
            name:
              sat.name ||
              sat.OBJECT_NAME,
            position: sat.position,
            type: 'satellite',
            color: '#ffee00',
            priority: 1,
            ra: sat.ra || 0,
            dec: sat.dec || 0,
            rawObj: sat
          });
        }
      });
    }
    // ---------------------------------------------------------
// 7. ASTEROIDS & COMETS
// ---------------------------------------------------------
// Minor-body labels follow their live calculated positions.
// Show only objects that currently have a valid visible position.

if (
  !exrDayPresentation &&
  this.minorBodiesSystem
) {

  // -------------------------
  // ASTEROIDS
  // -------------------------
  if (
    this.showAsteroids &&
    Array.isArray(this.minorBodiesSystem.asteroidsList)
  ) {
    this.minorBodiesSystem.asteroidsList.forEach(ast => {

      if (
        ast.position &&
        (
          ast.alt === undefined ||
          ast.alt >= 0 ||
          ast.isVisible ||
          ast === this.selectedTargetObject
        )
      ) {
        const rawName = ast.name || '';
        const capName = rawName ? (rawName.charAt(0).toUpperCase() + rawName.slice(1)) : '';
        targets.push({
          name:
            capName ||
            ast.displayName ||
            ast.designation ||
            (ast.number ? `Asteroid ${ast.number}` : 'Asteroid'),

          position: ast.position,

          type: 'asteroid',

          color: '#b8c7d9',

          // Minor-body labels
          priority: 3,

          ra: ast.ra || 0,
          dec: ast.dec || 0,
          mag: ast.mag,

          rawObj: ast
        });
      }

    });
  }


  // -------------------------
  // COMETS
  // -------------------------
  if (
    this.showComets &&
    Array.isArray(this.minorBodiesSystem.cometsList)
  ) {
    this.minorBodiesSystem.cometsList.forEach(comet => {

      if (
        comet.position &&
        (
          comet.alt === undefined ||
          comet.alt >= 0 ||
          comet.isVisible ||
          comet === this.selectedTargetObject
        )
      ) {
        targets.push({
          name:
            comet.displayName ||
            comet.name ||
            comet.id ||
            'Comet',

          position: comet.position,

          type: 'comet',

          color: '#00ffff',

          // Minor-body labels
          priority: 3,

          ra: comet.ra || 0,
          dec: comet.dec || 0,
          mag: comet.mag,

          rawObj: comet
        });
      }

    });
  }
}

    // ---------------------------------------------------------
    // 7. SELECTED TARGET RETICLE
    // ---------------------------------------------------------
    // IMPORTANT:
    // Never hide the selected object's reticle.
    // This keeps search/click highlighting working even
    // when the normal label for that object is suppressed.
    if (this.selectedTargetObject) {
      const targetName =
        this.selectedTargetObject.displayName ||
        this.selectedTargetObject.name ||
        this.selectedTargetObject.id;

      if (targetName) {
        const wPos =
          this.getObjectWorldPosition(
            this.selectedTargetObject
          );

        if (wPos) {
          const nameLower =
            String(targetName).toLowerCase();

          const exists = targets.some(
            t =>
              t.name &&
              t.name.toLowerCase() === nameLower
          );

          if (!exists) {
            targets.push({
              name: targetName,
              position: wPos,
              type: this.selectedTargetObject.type,
              color: '#00ffff',
              priority: 0
            });
          }
        }
      }
    }

    // ---------------------------------------------------------
    // APPLY LABELS & CONTEXT TO LABEL SYSTEM
    // ---------------------------------------------------------
    if (this.labelSystem) {
      this.labelSystem.setDaytime(exrDayPresentation);
      this.labelSystem.setSelectedObject(this.selectedTargetObject);
      this.labelSystem.setLabels(targets);
    }
  }

  /**
   * Updates time, location, position vectors, and label projection.
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
          console.warn('[SkyRendererV2] Sidereal calculation failed:', e);
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

      const sinH = Math.sin(lstRad);
      const cosH = Math.cos(lstRad);
      const sinPhi = Math.sin(latRad);
      const cosPhi = Math.cos(latRad);

      // Canonical Equatorial -> Local Horizon transformation matrix
      // Basis: East = (sinH, 0, -cosH), Up = (cosPhi*cosH, sinPhi, cosPhi*sinH), North = (-sinPhi*cosH, cosPhi, -sinPhi*sinH)
      this.starSphereGroup.matrix.set(
        sinH, 0, -cosH, 0,
        cosPhi * cosH, sinPhi, cosPhi * sinH, 0,
        -sinPhi * cosH, cosPhi, -sinPhi * sinH, 0,
        0, 0, 0, 1
      );
      this.starSphereGroup.matrix.decompose(
        this.starSphereGroup.position,
        this.starSphereGroup.quaternion,
        this.starSphereGroup.scale
      );
      this.starSphereGroup.updateMatrixWorld(true);
    }

    if (this.atmosphere) {
      const env = this.atmosphere.updateSunPosition(date, obs);

      const sunAlt =
        env.sunAltitude !== undefined
          ? env.sunAltitude
          : -30;

      const sunAz =
        env.sunAzimuth !== undefined
          ? env.sunAzimuth
          : 180;

      const moonAlt =
        this.atmosphere.moonAltitude || -30;

      const moonPhase =
        this.atmosphere.moonPhase || 0.5;

      const bortle =
        this.atmosphere.bortleScale || 3;

      const trans =
        this.atmosphere.transparency || 0.8;

      // =========================================================
      // EXR DAYTIME PRESENTATION
      // =========================================================
      const exrDayPresentation =
        this.showAtmosphere && sunAlt > 0;


      // =========================================================
      // STARS
      // =========================================================
      const starVisible =
        this.showStars && !exrDayPresentation;

      const starMat =
        this.starRenderingSystem &&
        this.starRenderingSystem.starMaterial;

      if (
        starMat &&
        starMat.uniforms &&
        starMat.uniforms.uDaytimeOpacity
      ) {
        starMat.uniforms.uDaytimeOpacity.value =
          exrDayPresentation ? 0.0 : 1.0;
      }

      if (
        this.starRenderingSystem &&
        this.starRenderingSystem.group
      ) {
        this.starRenderingSystem.group.visible =
          starVisible;
      }

      if (
        this.starRenderingSystem &&
        this.starRenderingSystem.starPoints
      ) {
        this.starRenderingSystem.starPoints.visible =
          starVisible;

        if (this.starRenderingSystem.starPoints.material) {
          this.starRenderingSystem.starPoints.material.visible =
            starVisible;
        }
      }


      // =========================================================
      // DSOs
      // =========================================================
      const dsoVisible =
        this.showDSOs && !exrDayPresentation;

      if (
        this.dsoRenderingSystem &&
        this.dsoRenderingSystem.group
      ) {
        this.dsoRenderingSystem.group.visible =
          dsoVisible;
      }

      if (
        this.dsoRenderingSystem &&
        this.dsoRenderingSystem.points
      ) {
        this.dsoRenderingSystem.points.visible =
          dsoVisible;
      }

      if (
        this.dsoRenderingSystem &&
        this.dsoRenderingSystem.material
      ) {
        this.dsoRenderingSystem.material.visible =
          dsoVisible;
      }


      // =========================================================
      // CONSTELLATIONS / ASTERISMS
      // =========================================================
      if (this.constellationSystem) {

        if (this.constellationSystem.constellationLines) {
          this.constellationSystem.constellationLines.visible =
            this.showConstellations &&
            !exrDayPresentation;
        }

        if (this.constellationSystem.asterismLines) {
          this.constellationSystem.asterismLines.visible =
            this.showAsterisms &&
            !exrDayPresentation;
        }
      }


      // =========================================================
      // MILKY WAY
      // =========================================================
      if (this.milkyWaySystem) {
        this.milkyWaySystem.updateSkyConditions(
          sunAlt,
          moonAlt,
          moonPhase,
          bortle
        );
      }


      // =========================================================
      // LANDSCAPE / EXR
      // =========================================================
      if (this.landscapeSystem) {

        const landscapeAtmosphereOn =
          this.showAtmosphere;

        this.landscapeSystem.setAtmosphereState(
          landscapeAtmosphereOn
        );



        this.landscapeSystem.updateSkyConditions(
          sunAlt,
          moonAlt,
          moonPhase,
          bortle,
          trans,
          sunAz,
          this.moonlightBrightness ?? 0.5
        );

      }
    }


    // ===========================================================
    // SOLAR SYSTEM
    // ===========================================================
    if (this.solarSystem) {
      this.solarSystem.updatePositions(date, obs);
    }


    // ===========================================================
    // CAMERA / FOV UPDATES
    // ===========================================================
    if (this.camera) {

      if (this.milkyWaySystem) {
        this.milkyWaySystem.updateFOV(
          this.camera.fov
        );
      }

      if (this.dsoRenderingSystem) {
        this.dsoRenderingSystem.updateFOV(
          this.camera.fov
        );
      }

      if (this.starRenderingSystem) {
        this.starRenderingSystem.updateFOV(
          this.camera.fov
        );
      }
    }


    // ===========================================================
    // MINOR BODIES
    // ===========================================================
    // IMPORTANT:
    // updateVisibility() can change the visibility of
    // satellites / spacecraft / asteroids / comets.
    // Therefore the EXR daytime hiding is applied AFTER it.
    if (this.minorBodiesSystem) {

      const matrix =
        this.starSphereGroup
          ? this.starSphereGroup.matrixWorld
          : null;

      this.minorBodiesSystem.updateVisibility(
        date,
        obs,
        this.camera,
        matrix,
        this.selectedTargetObject
      );

      const sunAlt =
        this.atmosphere &&
          this.atmosphere.sunAltitude !== undefined
          ? this.atmosphere.sunAltitude
          : -30;

      const exrDayPresentation =
        this.showAtmosphere &&
        sunAlt > 0;

      if (exrDayPresentation) {

        if (this.minorBodiesSystem.satellitesGroup) {
          this.minorBodiesSystem.satellitesGroup.visible =
            false;
        }

        if (this.minorBodiesSystem.spacecraftGroup) {
          this.minorBodiesSystem.spacecraftGroup.visible =
            false;
        }

        if (this.minorBodiesSystem.asteroidsGroup) {
          this.minorBodiesSystem.asteroidsGroup.visible =
            this.showAsteroids;
        }

        if (this.minorBodiesSystem.cometsGroup) {
          this.minorBodiesSystem.cometsGroup.visible =
            this.showComets;
        }

      } else {

        if (this.minorBodiesSystem.satellitesGroup) {
          this.minorBodiesSystem.satellitesGroup.visible =
            this.showSatellites;
        }

        if (this.minorBodiesSystem.spacecraftGroup) {
          this.minorBodiesSystem.spacecraftGroup.visible =
            this.showSpacecraft;
        }

        if (this.minorBodiesSystem.asteroidsGroup) {
          this.minorBodiesSystem.asteroidsGroup.visible =
            this.showAsteroids;
        }

        if (this.minorBodiesSystem.cometsGroup) {
          this.minorBodiesSystem.cometsGroup.visible =
            this.showComets;
        }
      }
    }


    // ===========================================================
    // LABELS
    // ===========================================================
    this.updateLabelsList();
  }

  /**
   * Dynamically updates star magnitude limit uniform on GPU.
   * @param {number} limit
   */
  setStarMagnitudeLimit(limit) {
    const parsed = Number(limit);

    const val = Number.isFinite(parsed)
        ? parsed
        : 6.5;

    this.starMagnitudeLimit = val;

    if (this.starRenderingSystem) {
        this.starRenderingSystem.setMagnitudeLimit(val);
    }

    this.updateLabelsList();
  }

  starLODStats() {
    if (this.starRenderingSystem && typeof this.starRenderingSystem.starLODStats === 'function') {
      return this.starRenderingSystem.starLODStats();
    }
    return { currentLOD: 0, fov: 60, level0: 0, level1: 0, level2: 0, level3: 0, activeStars: 0, duplicateStarsRemoved: 0 };
  }
  setStarTwinklingEnabled(enabled) {
    if (this.starRenderingSystem) {
        this.starRenderingSystem.setTwinklingEnabled(
            !!enabled
        );
    }
}

setStarTwinklingSpeed(speed) {
    if (this.starRenderingSystem) {
        this.starRenderingSystem.setTwinklingSpeed(
            Number(speed)
        );
    }
}

setStarTwinklingIntensity(intensity) {
    if (this.starRenderingSystem) {
        this.starRenderingSystem.setTwinklingIntensity(
            Number(intensity)
        );
    }
}



  setConstellationsVisible(visible) {
    this.showConstellations = !!visible;
    this.showConstellationNames = !!visible;
    this.showConstellationArt = !!visible;
    if (this.constellationSystem) {
      this.constellationSystem.setConstellationsVisible(!!visible);
      this.constellationSystem.setArtVisible(!!visible);
    }
  }

  setConstellationArtVisible(visible) {
    this.showConstellationArt = !!visible;
    if (this.constellationSystem) {
      this.constellationSystem.setArtVisible(!!visible);
    }
  }

  setConstellationNamesVisible(visible) {
    this.showConstellationNames = !!visible;
  }

  setAsterismsVisible(visible) {
    this.showAsterisms = !!visible;
    this.showAsterismNames = !!visible;
    if (this.constellationSystem) {
      this.constellationSystem.setAsterismsVisible(!!visible);
    }
  }

  setAsterismNamesVisible(visible) {
    this.showAsterismNames = !!visible;
  }

  setStarsVisible(visible) {
    this.showStars = !!visible;
    this.showStarLabels = !!visible;
    if (this.starRenderingSystem && this.starRenderingSystem.group) {
      this.starRenderingSystem.group.visible = !!visible;
      if (this.starRenderingSystem.starPoints) {
        this.starRenderingSystem.starPoints.visible = !!visible;
        if (this.starRenderingSystem.starPoints.material) {
          this.starRenderingSystem.starPoints.material.visible = !!visible;
        }
      }
    }
  }

  setStarLabelsVisible(visible) {
    this.showStarLabels = !!visible;
  }

  setStarColorSaturation(saturation) {
    const value = Math.max(
        0.0,
        Math.min(2.0, Number(saturation) || 0.0)
    );

    if (this.starRenderingSystem) {
        this.starRenderingSystem.setStarColorSaturation(value);
    }
}

  setDSOLabelsVisible(visible) {
  this.showDSOLabels = !!visible;

  if (typeof this.updateLabelsList === "function") {
    this.updateLabelsList();
  }
}
  setMilkyWayVisible(visible) {
    this.showMilkyWay = !!visible;

    if (this.milkyWaySystem) {
      this.milkyWaySystem.setVisible(visible);
    }
  }

  setMilkyWayBrightness(brightness) {
    const num = parseFloat(brightness);

    const val = Number.isFinite(num)
        ? Math.max(0.0, Math.min(1.0, num))
        : 0.75;

    this.milkyWayBrightness = val;

    if (this.milkyWaySystem) {
        this.milkyWaySystem.setBrightness(val);
    }
}

  setMilkyWayOpacity(opacity) {
    const num = parseFloat(opacity);
    const val = Number.isFinite(num)
        ? Math.max(0.0, Math.min(1.0, num))
        : 0.85;

    this.milkyWayOpacity = val;

    if (this.milkyWaySystem) {
        this.milkyWaySystem.setOpacity(val);
    }
}

  setDSOsVisible(visible) {
    this.showDSOs = !!visible;

    if (
      this.dsoRenderingSystem &&
      this.dsoRenderingSystem.group
    ) {
      this.dsoRenderingSystem.group.visible = !!visible;

      if (this.dsoRenderingSystem.points) {
        this.dsoRenderingSystem.points.visible = !!visible;
      }
    }
    if (typeof this.updateLabelsList === "function") {
      this.updateLabelsList();
    }
  }


  /**
   * Sets Deep Sky Object glow intensity.
   * @param {number} intensity 0.0–1.0
   */
  setDeepSkyGlowIntensity(intensity) {
    const value = Math.max(
      0.0,
      Math.min(1.0, parseFloat(intensity) || 0.0)
    );

    if (
      this.dsoRenderingSystem &&
      typeof this.dsoRenderingSystem.setGlowIntensity === "function"
    ) {
      this.dsoRenderingSystem.setGlowIntensity(value);
    }
  }


  /**
   * Enables/disables Deep Sky Object glow.
   * @param {boolean} enabled
   */
  setDeepSkyGlowEnabled(enabled) {
    if (
      this.dsoRenderingSystem &&
      typeof this.dsoRenderingSystem.setGlowEnabled === "function"
    ) {
      this.dsoRenderingSystem.setGlowEnabled(!!enabled);
    }
  }


  setPlanetsVisible(visible) {
    this.showPlanets = !!visible;

    if (this.solarSystem && this.solarSystem.group) {
      this.solarSystem.group.visible = !!visible;
    }
  }

  setSatellitesVisible(visible) {
    this.showSatellites = !!visible;
    if (this.minorBodiesSystem && this.minorBodiesSystem.satellitesGroup) {
      this.minorBodiesSystem.satellitesGroup.visible = !!visible;
    }
  }

  setSpacecraftVisible(visible) {
    this.showSpacecraft = !!visible;
    if (this.minorBodiesSystem && this.minorBodiesSystem.spacecraftGroup) {
      this.minorBodiesSystem.spacecraftGroup.visible = !!visible;
    }
  }

  setAsteroidsVisible(visible) {
    this.showAsteroids = !!visible;
    if (this.minorBodiesSystem && this.minorBodiesSystem.asteroidsGroup) {
      this.minorBodiesSystem.asteroidsGroup.visible = !!visible;
    }
  }

  setCometsVisible(visible) {
    this.showComets = !!visible;
    if (this.minorBodiesSystem && this.minorBodiesSystem.cometsGroup) {
      this.minorBodiesSystem.cometsGroup.visible = !!visible;
    }
  }

  setMinorBodiesVisible(visible) {
    this.setSatellitesVisible(visible);
    this.setSpacecraftVisible(visible);
    this.setAsteroidsVisible(visible);
    this.setCometsVisible(visible);
  }

  setEquatorialGridVisible(visible) {
    this.showEquatorialGrid = !!visible;
    if (this.gridEquatorial) this.gridEquatorial.visible = !!visible;
  }

  setCelestialEquatorVisible(visible) {
    this.showCelestialEquator = !!visible;
    if (this.gridCelestialEquator) this.gridCelestialEquator.visible = !!visible;
  }

  setEclipticVisible(visible) {
    this.showEcliptic = !!visible;
    if (this.gridEcliptic) this.gridEcliptic.visible = !!visible;
  }

  setGalacticPlaneVisible(visible) {
    this.showGalacticPlane = !!visible;
    if (this.gridGalacticPlane) this.gridGalacticPlane.visible = !!visible;
  }

  setHorizonLineVisible(visible) {
    this.showHorizonLine = !!visible;
    if (this.gridHorizon) this.gridHorizon.visible = !!visible;
  }

  // Legacy single-grid convenience (kept for backward compat)
  setGridVisible(visible) {
    this.setEquatorialGridVisible(visible);
  }

  setAtmosphereVisible(visible) {
    this.showAtmosphere = !!visible;

    // AtmosphereSystem remains available for:
    // - Sun position
    // - Moon position
    // - twilight calculations
    // - Bortle
    // - transparency
    //
    // Its old procedural sky mesh must NOT cover the EXR daytime sky.
    if (
      this.atmosphere &&
      typeof this.atmosphere.setEnabled === 'function'
    ) {
      this.atmosphere.setEnabled(this.showAtmosphere);
    }

    // EXR landscape/environment controls the visual sky + landscape.
    // EXR landscape/environment controls the visual sky + landscape.
    if (
      this.landscapeSystem &&
      typeof this.landscapeSystem.setAtmosphereState === 'function'
    ) {
      const landscapeAtmosphereOn =
        this.showAtmosphere;

      this.landscapeSystem.setAtmosphereState(
        landscapeAtmosphereOn
      );
    }

    // ---------------------------------------------------------
    // When Atmosphere is OFF:
    // restore the user's normal astronomical visibility settings.
    // ---------------------------------------------------------
    if (!this.showAtmosphere) {
      if (
        this.starRenderingSystem &&
        this.starRenderingSystem.group
      ) {
        this.starRenderingSystem.group.visible =
          this.showStars;

        if (this.starRenderingSystem.starPoints) {
          this.starRenderingSystem.starPoints.visible =
            this.showStars;

          if (this.starRenderingSystem.starPoints.material) {
            this.starRenderingSystem.starPoints.material.visible =
              this.showStars;
          }
        }
      }

      if (
        this.dsoRenderingSystem &&
        this.dsoRenderingSystem.group
      ) {
        this.dsoRenderingSystem.group.visible =
          this.showDSOs;

        if (this.dsoRenderingSystem.points) {
          this.dsoRenderingSystem.points.visible =
            this.showDSOs;
        }

        if (this.dsoRenderingSystem.material) {
          this.dsoRenderingSystem.material.visible =
            this.showDSOs;
        }
      }

      if (
        this.constellationSystem &&
        this.constellationSystem.group
      ) {
        this.constellationSystem.group.visible =
          this.showConstellations;
      }

      if (this.milkyWaySystem) {
        this.milkyWaySystem.setVisible(
          this.showMilkyWay
        );
      }
    }

    // Rebuild labels so daytime/nighttime filtering
    // is applied immediately.
    this.updateLabelsList();
  }

  setLandscapeVisible(visible) {
    this.showLandscape = !!visible;
    this.showGround = !!visible;
    if (this.landscapeSystem && typeof this.landscapeSystem.setEnabled === 'function') {
      this.landscapeSystem.setEnabled(visible);
    }
    if (this.starRenderingSystem && typeof this.starRenderingSystem.setShowGround === 'function') {
      this.starRenderingSystem.setShowGround(visible);
    }
    if (this.dsoRenderingSystem && typeof this.dsoRenderingSystem.setShowGround === 'function') {
      this.dsoRenderingSystem.setShowGround(visible);
    }
  }

  /**
   * Sets Bortle light pollution scale (1=darkest to 9=city). Affects atmosphere sky glow
   * and Milky Way visibility. Also updates the MilkyWay shader via updateSkyConditions.
   * @param {number} scale  1–9
   */
  setBortleScale(scale) {
    const s = Math.max(1, Math.min(9, Math.round(scale)));
    if (this.atmosphere) {
      this.atmosphere.setBortleScale(s);
    }
    if (this.milkyWaySystem) {
      const sunAlt = this.atmosphere ? this.atmosphere.sunAltitude : -30;
      const moonAlt = this.atmosphere ? this.atmosphere.moonAltitude : -30;
      const moonPh = this.atmosphere ? this.atmosphere.moonPhase : 0.5;
      this.milkyWaySystem.updateSkyConditions(sunAlt, moonAlt, moonPh, s);
    }
  }

  /**
   * Sets overall sky brightness — scales star point opacity globally.
   * 0 = stars invisible, 1 = full brightness (no atmosphere dimming).
   * @param {number} brightness 0.0–1.0
   */
  setSkyBrightness(brightness) {
    const val = Math.max(0, Math.min(1, parseFloat(brightness) ?? 0.5));
    this._skyBrightness = val;
    if (this.atmosphere && typeof this.atmosphere.setSkyBrightness === 'function') {
      this.atmosphere.setSkyBrightness(val);
    }
  }

  /**
   * Sets atmosphere shell opacity — how opaque the sky shell is.
   * 0 = fully transparent (invisible), 1 = full scattering.
   * @param {number} opacity 0.0–1.0
   */
  setAirTransparency(transparency) {
    const t = Math.max(0.0, Math.min(1.0, parseFloat(transparency) ?? 0.8));
    this.airTransparency = t;
    if (this.atmosphere && typeof this.atmosphere.setTransparency === 'function') {
      this.atmosphere.setTransparency(t);
    }
  }

  /**
   * Sets moonlight brightness contribution in the atmosphere shader.
   * Controls how much the Moon brightens the sky at night.
   * @param {number} brightness 0.0–1.0
   */
  setMoonlightBrightness(brightness) {
    const b = Math.max(
      0.0,
      Math.min(1.0, parseFloat(brightness) || 0.0)
    );

    this.moonlightBrightness = b;

    // Atmosphere moonlight
    if (
      this.atmosphere &&
      typeof this.atmosphere.setMoonlightBrightness === "function"
    ) {
      this.atmosphere.setMoonlightBrightness(b);
    }

    // Landscape moonlight
    if (
      this.landscapeSystem &&
      typeof this.landscapeSystem.setMoonlightBrightness === "function"
    ) {
      this.landscapeSystem.setMoonlightBrightness(b);
    }
  }

  getStarCatalogStats() {
    if (this.starRenderingSystem && typeof this.starRenderingSystem.getStarCatalogStats === 'function') {
      return this.starRenderingSystem.getStarCatalogStats();
    }
    return { loaded: false, total: 0, levels: { level0: 0, level1: 0, level2: 0, level3: 0 }, active: 0 };
  }

  getActiveStarCount() {
    if (this.starRenderingSystem && typeof this.starRenderingSystem.getActiveStarCount === 'function') {
      return this.starRenderingSystem.getActiveStarCount();
    }
    return 0;
  }

  getStarCatalogStatus() {
    if (this.starRenderingSystem && typeof this.starRenderingSystem.getStarCatalogStatus === 'function') {
      return this.starRenderingSystem.getStarCatalogStatus();
    }
    return 'Stellarium Catalog: Not initialized';
  }


  /**
   * Horizon Glow / Airglow — controls the faint chemiluminescent emission ring
   * at the horizon (airglow is a real sky phenomenon visible at dark sites from
   * oxygen/hydroxyl molecules at 80–100km altitude).
   * true/1 = full airglow, false/0 = airglow off.
   * @param {boolean|number} enabled
   */
  setHorizonGlow(enabled) {
    const intensity = enabled ? 1.0 : 0.0;
    if (this.atmosphere) {
      this.atmosphere.setAirglowIntensity(intensity);
    }
  }

  /**
   * Initializes Three.js WebGL renderer and all sub-systems.
   */
  async init(containerElement, customStarCatalog) {
    if (this.isInitialized) return;

    if (!containerElement || !(containerElement instanceof HTMLElement)) {
      throw new Error('[SkyRendererV2] Valid DOM containerElement is required.');
    }

    this.container = containerElement;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      this.options.fov,
      width / height,
      this.options.near,
      this.options.far
    );
    this.camera.position.set(0, 0, 0.1);

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

    this.starSphereGroup = new THREE.Group();
    this.scene.add(this.starSphereGroup);

    await this.loadMilkyWay();

    this.atmosphere = new AtmosphereSystem({ radius: this.options.sphereRadius * 0.99 });
    if (this.atmosphere && this.atmosphere.mesh) {
      this.scene.add(this.atmosphere.mesh);
      this.setAtmosphereVisible(true);
    }

    this.landscapeSystem = new LandscapeSystem({
      radius: this.options.sphereRadius * 0.98,
      assetPath: 'assets/landscape/suburban_garden_4k.exr'
    });
    if (this.landscapeSystem && this.landscapeSystem.mesh) {
      this.scene.add(this.landscapeSystem.mesh);
      this.setLandscapeVisible(true);
    }

    this.createGridLayers(this.options.sphereRadius * 0.995);
    for (const mesh of [this.gridEquatorial, this.gridCelestialEquator, this.gridEcliptic, this.gridGalacticPlane]) {
      if (mesh && this.starSphereGroup) this.starSphereGroup.add(mesh);
    }
    // Horizon grid lives in scene directly (not rotated with starSphereGroup)
    if (this.gridHorizon) this.scene.add(this.gridHorizon);

    this.solarSystem = new SolarSystem({ radius: this.options.sphereRadius });
    if (this.solarSystem && this.solarSystem.group) {
      this.starSphereGroup.add(this.solarSystem.group);
    }

    this.starRenderingSystem = new StarRenderingSystem({
  radius: this.options.sphereRadius
});

await this.starRenderingSystem.init();

// Apply initial star magnitude limit immediately.
// This prevents stars from being visible but unpickable
// until the magnitude slider is moved.
if (this.starRenderingSystem) {
  this.starRenderingSystem.setMagnitudeLimit(
    this.starMagnitudeLimit
  );
  this.starRenderingSystem.setShowGround(
    this.showLandscape !== false && this.showGround !== false
  );
}

if (
  this.starRenderingSystem &&
  this.starRenderingSystem.group &&
  this.starSphereGroup
) {
      this.starSphereGroup.add(this.starRenderingSystem.group);
      this.starLabels = this.starRenderingSystem.starLabels;

      try {
        this.brightStarGlowSystem = new BrightStarGlowSystem({ radius: this.options.sphereRadius * 0.997 });
        const glowGroup = this.brightStarGlowSystem.init(this.starRenderingSystem.starsList || []);
        if (glowGroup && this.starSphereGroup) {
          this.starSphereGroup.add(glowGroup);
        }
      } catch (e) {
        console.warn('[SkyRendererV2] BrightStarGlowSystem init exception:', e);
      }
    }

    this.dsoRenderingSystem = new DSORenderingSystem({ radius: this.options.sphereRadius * 0.998 });
    await this.dsoRenderingSystem.init();
    if (this.dsoRenderingSystem && this.dsoRenderingSystem.group && this.starSphereGroup) {
      this.starSphereGroup.add(this.dsoRenderingSystem.group);
    }

    // Apply initial DSO glow settings
    if (this.dsoRenderingSystem) {
      this.dsoRenderingSystem.setGlowIntensity(
        window.skySettings?.deepSkyGlowIntensity ?? 0.5
      );

      this.dsoRenderingSystem.setGlowEnabled(
        window.skySettings?.enableDeepSkyGlow ?? true
      );
    }

    this.constellationSystem = new ConstellationSystem({ radius: this.options.sphereRadius });
    await this.constellationSystem.init(this.starRenderingSystem);
    if (this.constellationSystem && this.constellationSystem.group && this.starSphereGroup) {
      this.starSphereGroup.add(this.constellationSystem.group);
    }

    this.minorBodiesSystem = new MinorBodiesSystem({
    radius: this.options.sphereRadius * 0.998
});

await this.minorBodiesSystem.init();

if (
    this.minorBodiesSystem &&
    this.minorBodiesSystem.group &&
    this.starSphereGroup
) {
    this.starSphereGroup.add(
        this.minorBodiesSystem.group
    );

    // 🔧 SYNC MINOR-BODY VISIBILITY AFTER ASYNC INIT
    if (this.minorBodiesSystem.satellitesGroup) {
        this.minorBodiesSystem.satellitesGroup.visible =
            !!this.showSatellites;
    }

    if (this.minorBodiesSystem.spacecraftGroup) {
        this.minorBodiesSystem.spacecraftGroup.visible =
            !!this.showSpacecraft;
    }

    if (this.minorBodiesSystem.asteroidsGroup) {
        this.minorBodiesSystem.asteroidsGroup.visible =
            !!this.showAsteroids;
    }

    if (this.minorBodiesSystem.cometsGroup) {
        this.minorBodiesSystem.cometsGroup.visible =
            !!this.showComets;
    }
}
    this.labelSystem = new LabelSystem(this.container);

    this.updateTimeAndObserver(new Date(), { latitude: 0, longitude: 0 });

    if (this.options.enableControls) {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enableZoom = false;
      this.controls.rotateSpeed = -0.4;
      this.controls.enablePan = false;

      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY > 0 ? 1.08 : 0.92;
        this.camera.fov = Math.max(10.0, Math.min(100.0, this.camera.fov * factor));
        this.camera.updateProjectionMatrix();
        if (this.dsoSystem) {
          this.dsoSystem.updateFOV(this.camera.fov);
        }
        if (this.starRenderingSystem) {
          this.starRenderingSystem.updateFOV(this.camera.fov);
        }
      }, { passive: false });
    }

    window.addEventListener('resize', this._onWindowResizeBound, false);

    this.isInitialized = true;
    console.log(`[SkyRendererV2] Successfully initialized complete celestial object engine.`);

    if (this._pendingStart) {
      this._pendingStart = false;
      this.start();
    }
  }

  start() {
    if (!this.isInitialized) {
      this._pendingStart = true;
      return;
    }
    if (this.isRendering) return;

    this.isRendering = true;
    this._animate();
  }

  stop() {
    if (!this.isRendering) return;
    this.isRendering = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  render() {
    if (
      !this.isInitialized ||
      !this.renderer ||
      !this.scene ||
      !this.camera
    ) {
      return;
    }

    if (this.controls && !this.focusAnimId) {
      this.controls.update();
    }

    // ---------------------------------------------------------
    // COMPASS DIRECTION STRIP HUD SYNC
    // ---------------------------------------------------------
    if (this.camera) {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const headingDeg = (THREE.MathUtils.radToDeg(Math.atan2(-dir.x, -dir.z)) + 360) % 360;
      if (typeof globalThis !== 'undefined') {
        globalThis.skyHeading = headingDeg;
        if (typeof globalThis.updateCompassHUD === 'function') {
          globalThis.updateCompassHUD();
        }
      }
    }

    if (this.starSphereGroup) {
      this.starSphereGroup.updateMatrixWorld(true);
    }

    const matrix =
      this.starSphereGroup
        ? this.starSphereGroup.matrixWorld
        : null;

    // ---------------------------------------------------------
    // MINOR BODIES UPDATE
    // ---------------------------------------------------------
    if (this.minorBodiesSystem) {
      this.minorBodiesSystem.updateVisibility(
        this.currentDate || new Date(),
        this.currentObserver || { latitude: 0, longitude: 0 },
        this.camera,
        matrix,
        this.selectedTargetObject
      );
    }


    // ---------------------------------------------------------
    // EXR DAYTIME VISIBILITY
    // ---------------------------------------------------------
    const sunAlt =
      this.atmosphere &&
        this.atmosphere.sunAltitude !== undefined
        ? this.atmosphere.sunAltitude
        : -30;

    const exrDayPresentation =
      this.showAtmosphere &&
      sunAlt > 0;

    // ---------------------------------------------------------
    // MINOR BODIES — HIDE DURING EXR DAYTIME
    // ---------------------------------------------------------
    if (exrDayPresentation && this.minorBodiesSystem) {

      if (this.minorBodiesSystem.satellitesGroup) {
        this.minorBodiesSystem.satellitesGroup.visible = false;
      }

      if (this.minorBodiesSystem.spacecraftGroup) {
        this.minorBodiesSystem.spacecraftGroup.visible = false;
      }

      if (this.minorBodiesSystem.asteroidsGroup) {
        this.minorBodiesSystem.asteroidsGroup.visible = false;
      }

      if (this.minorBodiesSystem.cometsGroup) {
        this.minorBodiesSystem.cometsGroup.visible = false;
      }
    }
    if (this.starRenderingSystem) {
    this.starRenderingSystem.updateTime(
        performance.now() * 0.001
    );
}

    // ---------------------------------------------------------
    // STARS
    // ---------------------------------------------------------
    if (
      this.starRenderingSystem &&
      this.starRenderingSystem.group
    ) {
      this.starRenderingSystem.group.visible =
        this.showStars &&
        !exrDayPresentation;
    }

    if (
      this.starRenderingSystem &&
      this.starRenderingSystem.starPoints
    ) {
      this.starRenderingSystem.starPoints.visible =
        this.showStars &&
        !exrDayPresentation;

      if (this.starRenderingSystem.starPoints.material) {
        this.starRenderingSystem.starPoints.material.visible =
          this.showStars &&
          !exrDayPresentation;
      }
    }

    // ---------------------------------------------------------
    // DSOs
    // ---------------------------------------------------------
    if (
      this.dsoRenderingSystem &&
      this.dsoRenderingSystem.group
    ) {
      this.dsoRenderingSystem.group.visible =
        this.showDSOs &&
        !exrDayPresentation;
    }

    if (
      this.dsoRenderingSystem &&
      this.dsoRenderingSystem.points
    ) {
      this.dsoRenderingSystem.points.visible =
        this.showDSOs &&
        !exrDayPresentation;
    }

    // ---------------------------------------------------------
    // CONSTELLATIONS / ASTERISMS
    // ---------------------------------------------------------
    if (this.constellationSystem) {

      if (this.constellationSystem.group) {
        this.constellationSystem.group.visible =
          !exrDayPresentation;
      }

      if (this.constellationSystem.constellationLines) {
        this.constellationSystem.constellationLines.visible =
          this.showConstellations &&
          !exrDayPresentation;
      }

      if (this.constellationSystem.asterismLines) {
        this.constellationSystem.asterismLines.visible =
          this.showAsterisms &&
          !exrDayPresentation;
      }
    }

    // ---------------------------------------------------------
    // MILKY WAY
    // ---------------------------------------------------------
    if (this.milkyWaySystem) {
      this.milkyWaySystem.setVisible(
        this.showMilkyWay &&
        !exrDayPresentation
      );
    }

    // ---------------------------------------------------------
    // MINOR BODY GROUPS
    // IMPORTANT:
    // updateVisibility() above can turn them back ON,
    // so hide them AFTER updateVisibility().
    // ---------------------------------------------------------
    if (this.minorBodiesSystem) {

      if (this.minorBodiesSystem.satellitesGroup) {
        this.minorBodiesSystem.satellitesGroup.visible =
          this.showSatellites &&
          !exrDayPresentation;
      }

      if (this.minorBodiesSystem.spacecraftGroup) {
        this.minorBodiesSystem.spacecraftGroup.visible =
          this.showSpacecraft &&
          !exrDayPresentation;
      }

      if (this.minorBodiesSystem.asteroidsGroup) {
        this.minorBodiesSystem.asteroidsGroup.visible =
          this.showAsteroids &&
          !exrDayPresentation;
      }

      if (this.minorBodiesSystem.cometsGroup) {
        this.minorBodiesSystem.cometsGroup.visible =
          this.showComets &&
          !exrDayPresentation;
      }
    }

    // ---------------------------------------------------------
    // LABELS
    // ---------------------------------------------------------
    this.updateLabelsList();

    // ---------------------------------------------------------
    // RENDER
    // ---------------------------------------------------------
    this.renderer.render(
      this.scene,
      this.camera
    );

    if (this.labelSystem) {
      this.labelSystem.render(
        this.camera,
        matrix
      );
    }
  }
  collectLabelTargets() {
    this.updateLabelsList();
  }

  _animate() {
    if (!this.isRendering) return;
    this.animationFrameId = requestAnimationFrame(() => this._animate());
    this.render();
  }

  _onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    if (this.labelSystem) {
      this.labelSystem.resize();
    }
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onWindowResizeBound, false);

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.dsoSystem) {
      this.dsoSystem.dispose();
      this.dsoSystem = null;
    }

    if (this.constellationSystem) {
      this.constellationSystem.dispose();
      this.constellationSystem = null;
    }

    if (this.minorBodiesSystem) {
      this.minorBodiesSystem.dispose();
      this.minorBodiesSystem = null;
    }

    if (this.solarSystem) {
      this.solarSystem.dispose();
      this.solarSystem = null;
    }

    if (this.atmosphere) {
      this.atmosphere.dispose();
      this.atmosphere = null;
    }

    if (this.starRenderingSystem) {
      this.starRenderingSystem.dispose();
      this.starRenderingSystem = null;
    }

    if (this.labelSystem) {
      this.labelSystem.dispose();
      this.labelSystem = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.container = null;
    this.isInitialized = false;
  }
}

export default SkyRendererV2;
