/**
 * Stellarium Gaia/HIP Star Catalog Binary Loader for SkyRendererV2
 * Parses binary .cat files (stars_0, stars_1, stars_2, stars_3) & .fab files (name.fab, extra_name.fab).
 */

const PHI = (1.0 + Math.sqrt(5.0)) / 2.0;
const R = Math.sqrt(1.0 + PHI * PHI);

const icoVerts = [
  [0, 1 / R, PHI / R], [0, -1 / R, PHI / R], [0, 1 / R, -PHI / R], [0, -1 / R, -PHI / R],
  [1 / R, PHI / R, 0], [-1 / R, PHI / R, 0], [1 / R, -PHI / R, 0], [-1 / R, -PHI / R, 0],
  [PHI / R, 0, 1 / R], [-PHI / R, 0, 1 / R], [PHI / R, 0, -1 / R], [-PHI / R, 0, -1 / R]
].map(v => normalize(v));

const icoFaces = [
  [0, 4, 5], [0, 5, 9], [0, 9, 8], [0, 8, 4],
  [1, 6, 7], [1, 7, 9], [1, 9, 8], [1, 8, 6],
  [2, 4, 5], [2, 5, 11], [2, 11, 10], [2, 10, 4],
  [3, 6, 7], [3, 7, 11], [3, 11, 10], [3, 10, 6],
  [4, 8, 10], [5, 9, 11], [6, 8, 10], [7, 9, 11]
];

function normalize(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1.0;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function signExtend(value, bits) {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

function getZonesForLevel(level) {
  let zones = icoFaces.map(f => [icoVerts[f[0]], icoVerts[f[1]], icoVerts[f[2]]]);
  for (let l = 0; l < level; l++) {
    const nextZones = [];
    zones.forEach(([v0, v1, v2]) => {
      const m01 = normalize([(v0[0] + v1[0]) / 2, (v0[1] + v1[1]) / 2, (v0[2] + v1[2]) / 2]);
      const m12 = normalize([(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2, (v2[2] + v0[2]) / 2]);
      const m20 = normalize([(v2[0] + v0[0]) / 2, (v2[1] + v0[1]) / 2, (v2[2] + v0[2]) / 2]);
      nextZones.push([v0, m01, m20]);
      nextZones.push([v1, m12, m01]);
      nextZones.push([v2, m20, m12]);
      nextZones.push([m01, m12, m20]);
    });
    zones = nextZones;
  }

  return zones.map(([v0, v1, v2]) => {
    return {
      center: v0,
      axis0: [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]],
      axis1: [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]]
    };
  });
}

export class StelStarCatalogLoader {
  constructor() {
    this.hipSpectralFile = "stars_hip_sp_0v0_6.cat";
    this.objecttypesFile = "object_types_v0_1.cat";

    this.files = [
      { name: 'stars_0_0v0_21.cat', level: 0, magRange: [-2.00, 6.00] },
      { name: 'stars_1_0v0_16.cat', level: 1, magRange: [6.00, 7.50] },
      { name: 'stars_2_0v0_17.cat', level: 2, magRange: [7.50, 9.00] },
      { name: 'stars_3_0v0_10.cat', level: 3, magRange: [9.00, 10.50] }
    ];
    this.parsedLevels = {
      level0: [],
      level1: [],
      level2: [],
      level3: []
    };
    this.counts = {
      level0: 0,
      level1: 0,
      level2: 0,
      level3: 0
    };
    this.starNamesMap = {};
    this.totalCount = 0;
    this.isLoaded = false;
  }

  async loadFabFiles(basePath = './data/stars/hip_gaia3/') {
    const fabFiles = ['name.fab', 'extra_name.fab'];
    for (const fabName of fabFiles) {
      try {
        const url = basePath + fabName;
        const res = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        const lines = text.split(/\r?\n/);
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('#')) continue;
          const parts = line.split('|');
          if (parts.length >= 2) {
            const hipStr = parts[0].trim();
            const rawName = parts[1].trim().replace(/_/g, ' ');
            const hip = parseInt(hipStr, 10);
            if (!isNaN(hip) && hip > 0 && !this.starNamesMap[hip]) {
              this.starNamesMap[hip] = rawName;
            }
          }
        }
        // console.log(`[StarCatalog] Loaded ${fabName} names mapping.`);
      } catch (e) {
        console.warn(`[StarCatalog] Could not load ${fabName}:`, e);
      }
    }
  }

  async loadAll(basePath = './data/stars/hip_gaia3/') {
    // console.log('[StarCatalog] Loading Stellarium catalog & .fab name files...');
    await this.loadFabFiles(basePath);

    let successCount = 0;

    for (const f of this.files) {
      try {
        const url = basePath + f.name;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[StarCatalog] Could not load ${f.name}: HTTP ${res.status}`);
          continue;
        }
        const ab = await res.arrayBuffer();
        const parsed = this.parseCatalogBuffer(ab, f.name);
        if (parsed && Array.isArray(parsed.stars)) {
          this.parsedLevels[`level${f.level}`] = parsed.stars;
          this.counts[`level${f.level}`] = parsed.count;
          this.totalCount += parsed.count;
          successCount++;
          // console.log(`[StarCatalog] ${f.name} loaded: ${parsed.count}`);
        }
      } catch (err) {
        console.warn(`[StarCatalog] Error parsing ${f.name}:`, err.message || err);
      }
    }

    if (successCount > 0) {
      this.isLoaded = true;
      // console.log(`[StarCatalog] Total catalog stars: ${this.totalCount}`);
    } else {
      console.warn('[StarCatalog] Catalog loading failed, falling back to primary star system.');
    }

    return this.isLoaded;
  }

  parseCatalogBuffer(arrayBuffer, filename) {
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 32) throw new Error('File header too small');

    const magic = view.getUint32(0, true);
    if (magic !== 0x835f040a) throw new Error(`Invalid magic header: 0x${magic.toString(16)}`);

    const level = view.getInt32(0x10, true);
    const magMin = view.getInt32(0x14, true) / 1000.0;

    // Zone count is correctly derived from getZonesForLevel(tier): 20*4^tier zones
    // (20, 80, 320, 1280 for tiers 0–3). u32[0x1c] is an unrelated catalog field.
    const zones = getZonesForLevel(level);
    const numZones = zones.length;
    const numZonesGeom = numZones;

    // Conspicuously read the zone counts contiguously starting at offset 32
    const zoneCountsOffset = 32;
    const starDataOffset = zoneCountsOffset + numZones * 4;

    const counts = [];
    let totalStars = 0;
    for (let z = 0; z < numZones; z++) {
      if (zoneCountsOffset + z * 4 + 4 > view.byteLength) break;
      const count = view.getUint32(zoneCountsOffset + z * 4, true);
      counts.push(count);
      totalStars += count;
    }

    const stars = [];
    const maxPosVal = 2147483647.0;
    let currentOffset = starDataOffset;
    let validHipCount = 0;
    let minMag = 99.0, maxMag = -99.0;
    let minBv = 99.0, maxBv = -99.0;
    const sampleDiagStars = [];

    for (let z = 0; z < numZones; z++) {
      const zone = zones[z % numZonesGeom];
      const count = counts[z] || 0;

      for (let i = 0; i < count; i++) {
        if (currentOffset + 48 > view.byteLength) break;

        // In the 48-byte record, the standard Star1 record starts at offset + 20
        const star1Offset = currentOffset + 20;

        const x0 = view.getInt32(star1Offset, true);
        const x1 = view.getInt32(star1Offset + 4, true);
        
        // Bytes 8-10 of Star1: Signed 24-bit HIP ID
        const b0 = view.getUint8(star1Offset + 8);
        const b1 = view.getUint8(star1Offset + 9);
        const b2 = view.getUint8(star1Offset + 10);
        const rawHip = b0 | (b1 << 8) | (b2 << 16);
        const hipId = signExtend(rawHip, 24);

        // mag is at bytes 14-15 (int16), representing mag * 1000
        const rawMag = view.getInt16(star1Offset + 14, true);
        const mag = rawMag / 1000.0;

        // bVIndex is at byte 16 of Star1
        const bVIndex = view.getUint8(star1Offset + 16);

        currentOffset += 48;

        const isValidHip = hipId > 0 && hipId < 200000;
        const validHipId = isValidHip ? hipId : null;
        if (validHipId) validHipCount++;

        if (mag < minMag) minMag = mag;
        if (mag > maxMag) maxMag = mag;

        // Geodesic Grid Position (scaled by 2^20 fixed point precision)
        const x0Scaled = x0 / maxPosVal;
        const x1Scaled = x1 / maxPosVal;

        const px = zone.center[0] + zone.axis0[0] * x0Scaled + zone.axis1[0] * x1Scaled;
        const py = zone.center[1] + zone.axis0[1] * x0Scaled + zone.axis1[1] * x1Scaled;
        const pz = zone.center[2] + zone.axis0[2] * x0Scaled + zone.axis1[2] * x1Scaled;

        const norm = Math.sqrt(px * px + py * py + pz * pz) || 1.0;
        const x = px / norm;
        const y = py / norm;
        const zPos = pz / norm;

        let ra = Math.atan2(y, x) * (180 / Math.PI);
        if (ra < 0) ra += 360;
        const dec = Math.asin(Math.max(-1, Math.min(1, zPos))) * (180 / Math.PI);

        // Stellarium Star1 B-V color encoding: uint8 (127 = 0.0) -> (bVIndex - 127) / 50.0
        const bvVal = (bVIndex - 127) / 50.0;

        if (bvVal < minBv) minBv = bvVal;
        if (bvVal > maxBv) maxBv = bvVal;

        const fabName = (validHipId && this.starNamesMap[validHipId]) ? this.starNamesMap[validHipId] : null;

        const starObj = {
          id: validHipId ? `HIP ${validHipId}` : `CAT_${level}_${z}_${i}`,
          hip: validHipId,
          name: fabName || (validHipId ? `HIP ${validHipId}` : `Star ${level}-${z}-${i}`),
          displayName: fabName || (validHipId ? `HIP ${validHipId}` : `Star ${level}-${z}-${i}`),
          properName: fabName,
          bayerName: fabName,
          ra,
          dec,
          mag,
          bv: bvVal,
          level
        };

        stars.push(starObj);

        if (sampleDiagStars.length < 3) {
          sampleDiagStars.push({
            hip: validHipId,
            ra: ra.toFixed(2),
            dec: dec.toFixed(2),
            mag: mag.toFixed(2),
            bv: bvVal.toFixed(2),
            pos3D: [x.toFixed(3), y.toFixed(3), zPos.toFixed(3)]
          });
        }
      }
    }

    return { level, stars, count: stars.length };
  }
}

export default StelStarCatalogLoader;
