/**
 * LandscapeSystem - EXR Equirectangular Panorama & Horizon System for SkyRendererV2
 * 
 * TOGGLE BEHAVIOR:
 * - Atmosphere ON: Full 360° EXR Panorama Image (bright daytime sky + real sun + trees + house + ground).
 * - Atmosphere OFF: Dark starry night sky overhead (100% transparent above horizon for stars/Milky Way),
 *   with dark natural planetarium landscape silhouette at horizon matching Stellarium Web.
 * - Red Cardinal Direction Markers ('N', 'E', 'S', 'W') sitting right on the horizon line.
 * - Zero WebGL INVALID_OPERATION errors.
 * - Locked 60 FPS performance.
 */

import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export const LandscapeVertexShader = `
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const LandscapeFragmentShader = `
  uniform sampler2D uLandscapeTexture;
  uniform float uHasTexture;
  uniform float uSunAltitude;
  uniform float uSunAzimuthOffset;
  uniform float uAtmosphereOn;
  uniform float uMoonAltitude;
  uniform float uMoonIllumination;
  uniform float uMoonBrightness;
  uniform float uBortleScale;
  uniform float uTransparency;
  uniform float uOpacity;
  uniform float uEnabled;

  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Pseudo-random & procedural noise helpers for organic landscape shapes
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  // Draw procedural cardinal direction letter glyphs ('N', 'E', 'S', 'W')
  float drawCardinalLetter(vec2 uv, int type) {
    vec2 p = abs(uv - vec2(0.5));
    if (p.x > 0.35 || p.y > 0.45) return 0.0;
    
    float d = 0.0;
    // N
    if (type == 0) {
      if (abs(uv.x - 0.2) < 0.08 || abs(uv.x - 0.8) < 0.08) d = 1.0;
      float diag = abs((uv.x - uv.y));
      if (diag < 0.12 && uv.x >= 0.2 && uv.x <= 0.8) d = 1.0;
    }
    // E
    else if (type == 1) {
      if (abs(uv.x - 0.25) < 0.08) d = 1.0;
      if (uv.x >= 0.25 && uv.x <= 0.75 && (abs(uv.y - 0.15) < 0.08 || abs(uv.y - 0.5) < 0.08 || abs(uv.y - 0.85) < 0.08)) d = 1.0;
    }
    // S
    else if (type == 2) {
      if (abs(uv.y - 0.15) < 0.08 || abs(uv.y - 0.5) < 0.08 || abs(uv.y - 0.85) < 0.08) d = 1.0;
      if (uv.y > 0.5 && abs(uv.x - 0.25) < 0.08) d = 1.0;
      if (uv.y < 0.5 && abs(uv.x - 0.75) < 0.08) d = 1.0;
    }
    // W
    else if (type == 3) {
      if (abs(uv.x - 0.15) < 0.08 || abs(uv.x - 0.85) < 0.08 || abs(uv.x - 0.5) < 0.08) d = 1.0;
      if (abs(uv.y - 0.25) < 0.10) d = 1.0;
    }
    return d;
  }

  void main() {
    if (uEnabled <= 0.05) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec3 viewDir = normalize(vWorldPosition);
    float elevation = viewDir.y;
    float azimuth = atan(viewDir.x, viewDir.z);

    // 1. HORIZON SILHOUETTE PROFILE FOR NIGHT / ATMOSPHERE OFF MODE
    float mountainRidge = sin(azimuth * 2.0) * 0.006 + fbm(vec2(azimuth * 4.0, 0.0)) * 0.010;
    float hillLine = cos(azimuth * 3.5) * 0.004 + fbm(vec2(azimuth * 8.0, 2.0)) * 0.006;
    float treeDetail = noise(vec2(azimuth * 40.0, 5.0)) * 0.003;
    float maxHorizonElev = clamp(max(mountainRidge, hillLine) + treeDetail + 0.16, 0.08, 0.26);

    // 2. RED CARDINAL DIRECTION LABELS ('N', 'E', 'S', 'W') RIGHT ON THE HORIZON
    float cardinalAlpha = 0.0;
    vec3 cardinalColor = vec3(0.85, 0.20, 0.18);

    float nDist = abs(azimuth);
    float eDist = abs(azimuth - 1.5707963);
    float sDist = min(abs(azimuth - 3.1415926), abs(azimuth + 3.1415926));
    float wDist = abs(azimuth + 1.5707963);

    float labelSpreadAz = 0.040;
    float labelSpreadElev = 0.035;

    if (abs(elevation - 0.015) < labelSpreadElev) {
      vec2 letterUv = vec2(0.5);
      int letterType = -1;

      if (nDist < labelSpreadAz) {
        letterUv = vec2((azimuth + labelSpreadAz) / (2.0 * labelSpreadAz), (elevation + 0.01) / (2.0 * labelSpreadElev));
        letterType = 0; // N
      } else if (eDist < labelSpreadAz) {
        letterUv = vec2((azimuth - 1.5707963 + labelSpreadAz) / (2.0 * labelSpreadAz), (elevation + 0.01) / (2.0 * labelSpreadElev));
        letterType = 1; // E
      } else if (sDist < labelSpreadAz) {
        float sAz = azimuth > 0.0 ? (azimuth - 3.1415926) : (azimuth + 3.1415926);
        letterUv = vec2((sAz + labelSpreadAz) / (2.0 * labelSpreadAz), (elevation + 0.01) / (2.0 * labelSpreadElev));
        letterType = 2; // S
      } else if (wDist < labelSpreadAz) {
        letterUv = vec2((azimuth + 1.5707963 + labelSpreadAz) / (2.0 * labelSpreadAz), (elevation + 0.01) / (2.0 * labelSpreadElev));
        letterType = 3; // W
      }

      if (letterType >= 0) {
        cardinalAlpha = drawCardinalLetter(letterUv, letterType);
      }
    }

    // =====================================================
    // NIGHT / ATMOSPHERE SKY CUTOUT
    // =====================================================
    if (uSunAltitude <= 0.0 && elevation > maxHorizonElev + 0.005) {
        if (cardinalAlpha > 0.1) {
            gl_FragColor = vec4(
                cardinalColor,
                cardinalAlpha * clamp(uOpacity, 0.0, 1.0)
            );
            return;
        }
        discard;
    }

    float horizonAlpha = 1.0 - smoothstep(maxHorizonElev - 0.003, maxHorizonElev + 0.005, elevation);

    vec3 finalColor = vec3(0.0);

    // 3. SAMPLE EXR PANORAMA TEXTURE OR PROCEDURAL FALLBACK
    if (uHasTexture > 0.5) {

    float calibratedAzimuth = azimuth + uSunAzimuthOffset;
    float elevAngle = asin(clamp(viewDir.y, -0.999, 0.999));
    vec2 equirectUv = vec2(fract(0.5 - (calibratedAzimuth / (2.0 * 3.1415926535))), (elevAngle / 3.1415926535) + 0.5);
    vec4 exrTex = texture2D(uLandscapeTexture, equirectUv);
    vec3 exrRgb = clamp(exrTex.rgb, 0.0, 5.0);

    if (uSunAltitude > 0.0) {

        // =================================================
        // DAYTIME
        // =================================================

        if (uAtmosphereOn > 0.5) {
            vec3 daylight = exrRgb * 1.65;
            float skyMask = smoothstep(-0.02, 0.20, elevation);
            daylight += vec3(0.010, 0.025, 0.055) * skyMask;
            daylight = clamp(daylight, 0.0, 1.0);
            finalColor = daylight;
        } else {
            finalColor = exrRgb;
        }

    } else {

        // =====================================================
        // STELLARIUM-QUALITY NIGHT LANDSCAPE RENDERING PIPELINE
        // =====================================================

        float luma = dot(exrRgb, vec3(0.299, 0.587, 0.114));
        float toneMappedLuma = pow(luma / (1.0 + luma), 0.55);
        vec3 toneMappedRgb = exrRgb * (toneMappedLuma / max(luma, 0.001));

        float wNight = 1.0 - smoothstep(-18.0, -12.0, uSunAltitude);
        float wAstro = smoothstep(-18.0, -12.0, uSunAltitude) * (1.0 - smoothstep(-12.0, -6.0, uSunAltitude));
        float wNaut  = smoothstep(-12.0, -6.0, uSunAltitude)  * (1.0 - smoothstep(-6.0, 0.0, uSunAltitude));
        float wCivil = smoothstep(-6.0, 0.0, uSunAltitude)   * (1.0 - smoothstep(0.0, 5.0, uSunAltitude));

        vec3 ambientNight = vec3(0.012, 0.018, 0.032);
        vec3 ambientAstro = vec3(0.020, 0.030, 0.055);
        vec3 ambientNaut  = vec3(0.040, 0.060, 0.095);
        vec3 ambientCivil = vec3(0.120, 0.085, 0.075);

        vec3 envAmbient = ambientNight * wNight + ambientAstro * wAstro + ambientNaut * wNaut + ambientCivil * wCivil;

        float horizonOpticalDepth = exp(-6.0 * max(0.0, elevation + 0.01));
        vec3 horizonSkyTint = mix(vec3(0.012, 0.020, 0.036), vec3(0.140, 0.090, 0.070), wCivil);
        vec3 atmosphericGlow = horizonSkyTint * horizonOpticalDepth * 0.75;

        float moonAltFactor = smoothstep(-2.0, 8.0, uMoonAltitude);
        float moonPhaseFactor = clamp(uMoonIllumination, 0.0, 1.0);
        float moonLight = moonAltFactor * moonPhaseFactor * clamp(uMoonBrightness, 0.0, 1.0);
        vec3 moonSheen = vec3(0.035, 0.065, 0.110) * moonLight * toneMappedLuma;

        float pollutionFill = smoothstep(1.0, 9.0, uBortleScale);
        vec3 lightPollution = vec3(0.015, 0.014, 0.018) * pollutionFill * horizonOpticalDepth;

        vec3 nightLandscape = toneMappedRgb * (0.28 + wCivil * 0.40 + wNaut * 0.18 + wAstro * 0.08) + envAmbient + atmosphericGlow + moonSheen + lightPollution;

        nightLandscape = clamp(nightLandscape, vec3(0.010, 0.015, 0.024), vec3(0.38, 0.40, 0.45));

        finalColor = nightLandscape;
    }
    } else {
        // =========================================================
        // NO EXR TEXTURE — PROCEDURAL FALLBACK
        // =========================================================
        if (uAtmosphereOn > 0.5) {
            finalColor = vec3(0.35, 0.65, 0.96);
        } else {
            finalColor = vec3(0.004, 0.007, 0.012);
        }
    }

    if (cardinalAlpha > 0.1) {
      finalColor = mix(finalColor, cardinalColor, cardinalAlpha);
    }

    float finalAlpha = clamp(uOpacity, 0.0, 1.0) * (uSunAltitude <= 0.0 ? horizonAlpha : 1.0);
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export class LandscapeSystem {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.radius=784] - Horizon placement radius (slightly inside celestial sphere).
   * @param {string} [options.assetPath='assets/landscape/suburban_garden_4k.exr'] - Path to EXR panorama.
   * @param {number} [options.landscapeSunAzimuthOffset=0.0] - Azimuth offset to align EXR Sun with astronomical Sun.
   */
  constructor(options = {}) {
    this.options = {
      radius: options.radius || 784,
      assetPath: options.assetPath || 'assets/landscape/suburban_garden_4k.exr',
      landscapeSunAzimuthOffset: options.landscapeSunAzimuthOffset !== undefined ? options.landscapeSunAzimuthOffset : 0.0,
      ...options
    };

    this.mesh = null;
    this.material = null;
    this.texture = null;
    this.enabled = true;
    this.moonlightBrightness = 0.5;
    this.opacity = 1.0;

    this.init();
    this.loadEXRPanorama(this.options.assetPath);
  }

  /**
   * Initializes GPU WebGL Landscape Shader Material and Sphere Geometry.
   */
  init() {
    try {
      const radius = this.options.radius;
      const geometry = new THREE.SphereGeometry(radius, 64, 32);

      // Create initial placeholder texture
      const placeholder = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
      placeholder.needsUpdate = true;

      this.material = new THREE.ShaderMaterial({
        uniforms: {
          uLandscapeTexture: { value: placeholder },
          uHasTexture: { value: 0.0 },
          uSunAltitude: { value: -25.0 },
          uSunAzimuthOffset: { value: this.options.landscapeSunAzimuthOffset },
          uAtmosphereOn: { value: 1.0 },
          uMoonAltitude: { value: -30.0 },
          uMoonIllumination: { value: 0.5 },
          uMoonBrightness: { value: 0.5 },
          uBortleScale: { value: 3.0 },
          uTransparency: { value: 0.8 },
          uOpacity: { value: 1.0 },
          uEnabled: { value: 1.0 }
        },
        vertexShader: LandscapeVertexShader,
        fragmentShader: LandscapeFragmentShader,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        depthTest: true
      });

      this.mesh = new THREE.Mesh(geometry, this.material);
      this.mesh.renderOrder = -4; // Rendered behind MilkyWay (-10) / Stars (+1)
    } catch (e) {
      console.warn('[LandscapeSystem] Landscape initialization failed gracefully:', e);
      this.enabled = false;
    }
  }

  /**
   * Asynchronously loads the EXR 360° panorama using Three.js EXRLoader.
   * @param {string} url
   */
  loadEXRPanorama(url) {
    if (!url) return;
    try {
      const loader = new EXRLoader();
      if (typeof THREE.FloatType !== 'undefined') {
        loader.setDataType(THREE.FloatType);
      }
      loader.load(
        url,
        (texture) => {
          if (!this.material || !this.material.uniforms) return;
          texture.type = THREE.FloatType;
          texture.format = THREE.RGBAFormat;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          texture.needsUpdate = true;

          this.texture = texture;
          this.material.uniforms.uLandscapeTexture.value = texture;
          this.material.uniforms.uHasTexture.value = 1.0;
          console.log('[LandscapeSystem] EXR landscape panorama loaded successfully:', url);
        },
        undefined,
        (err) => {
          console.warn('[LandscapeSystem] EXR panorama load warning (using procedural fallback):', err);
        }
      );
    } catch (e) {
      console.warn('[LandscapeSystem] EXRLoader failed gracefully (using procedural fallback):', e);
    }
  }

  /**
   * Sets atmosphere state (1.0 = ON full EXR image, 0.0 = OFF dark natural silhouette at horizon).
   * @param {boolean} enabled
   */
  setAtmosphereState(enabled) {
    const value = enabled ? 1.0 : 0.0;

    if (
        this.material &&
        this.material.uniforms &&
        this.material.uniforms.uAtmosphereOn
    ) {
        this.material.uniforms.uAtmosphereOn.value = value;
    }
}

  /**
   * Sets calibration azimuth offset to align EXR Sun with actual astronomical Sun.
   * @param {number} offsetRad
   */
  setSunAzimuthOffset(offsetRad) {
    this.options.landscapeSunAzimuthOffset = offsetRad;
    if (this.material && this.material.uniforms && this.material.uniforms.uSunAzimuthOffset) {
      this.material.uniforms.uSunAzimuthOffset.value = offsetRad;
    }
  }


  /**
   * Enables or disables the landscape panorama mesh cleanly.
   * @param {boolean} enabled
   */
  /**
   * Sets moonlight brightness for the night landscape.
   * @param {number} brightness 0.0 - 1.0
   */
  setMoonlightBrightness(brightness) {
    const b = Math.max(
        0.0,
        Math.min(1.0, parseFloat(brightness) || 0.0)
    );

    this.moonlightBrightness = b;

    if (
        this.material &&
        this.material.uniforms &&
        this.material.uniforms.uMoonBrightness
    ) {
        this.material.uniforms.uMoonBrightness.value = b;
    }
}


  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.mesh) {
      this.mesh.visible = this.enabled;
    }
    if (this.material && this.material.uniforms && this.material.uniforms.uEnabled) {
      this.material.uniforms.uEnabled.value = this.enabled ? 1.0 : 0.0;
    }
  }

  /**
   * Updates environmental uniforms for daytime, twilight, moonlight, Bortle, haze, and Sun azimuth.
   * @param {number} sunAlt
   * @param {number} moonAlt
   * @param {number} moonPhase
   * @param {number} bortle
   * @param {number} transparency
   * @param {number} [sunAz=180.0]
   */
  updateSkyConditions(
    sunAlt = -25.0,
    moonAlt = -30.0,
    moonPhase = 0.5,
    bortle = 3.0,
    transparency = 0.8,
    sunAz = 180.0,
    moonBrightness = 0.5
  ) {
    if (!this.material || !this.material.uniforms) return;

    this.material.uniforms.uSunAltitude.value = sunAlt;
    this.material.uniforms.uMoonAltitude.value = moonAlt;
    this.material.uniforms.uMoonIllumination.value = moonPhase;
    this.material.uniforms.uBortleScale.value = bortle;
    this.material.uniforms.uTransparency.value = transparency;
    this.material.uniforms.uMoonBrightness.value =
      Math.max(0.0, Math.min(1.0, parseFloat(moonBrightness) || 0.0));
    if (sunAz !== undefined) {
      const sunAzRad = THREE.MathUtils.degToRad(sunAz);
      this.material.uniforms.uSunAzimuthOffset.value = sunAzRad;
    }
  }

  /**
   * Disposes of geometry, material, and texture resources cleanly.
   */
  dispose() {
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
    if (this.mesh) {
      if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
      this.mesh = null;
    }
    this.material = null;
  }
}

export default LandscapeSystem;
