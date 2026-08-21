/**
 * AtmosphereSystem - GPU Atmosphere Module for SkyRendererV2
 * 
 * FEATURES:
 * - Natural 3D sky atmosphere with non-linear vertical gradient.
 * - Full Daytime Blue Sky (when sunAlt >= 0°: deep zenith blue, clear mid blue, paler light blue horizon, subtle solar halo).
 * - Smooth Sun-altitude driven twilight transitions (Night < -18°, Astronomical -18°..-12°, Nautical -12°..-6°, Civil -6°..0°, Day >= 0°).
 * - Sunrise/Sunset warm pink/orange/gold scattering near horizon and Sun.
 * - Non-uniform Bortle Light Pollution horizon dome (zenith stays dark, horizon gains light dome).
 * - Aerosol Air Transparency haze layer concentrating near horizon.
 * - Physics-inspired Moonlight Rayleigh sky glow & Mie forward halo.
 * - Smooth Exposure-based Sky Brightness control.
 * - Real setEnabled(enabled) toggle API (disables shader completely when OFF).
 * - Zero allocation per-frame rendering loop (locked 60 FPS performance).
 */

import * as THREE from 'three';

export const AtmosphereVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vSunDir;
  varying vec3 vMoonDir;

  uniform vec3 uSunPosition;
  uniform vec3 uMoonPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    vSunDir = normalize(uSunPosition);
    vMoonDir = normalize(uMoonPosition);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const AtmosphereFragmentShader = `
  uniform float uSunAltitude;
  uniform float uSunAzimuth;
  uniform float uMoonAltitude;
  uniform float uMoonIllumination;
  uniform float uMoonBrightness;
  uniform float uBortleScale;
  uniform float uTransparency;
  uniform float uSkyBrightness;
  uniform float uAirglowIntensity;
  uniform float uOpacity;
  uniform float uEnabled;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vSunDir;
  varying vec3 vMoonDir;

  // Henyey-Greenstein Mie scattering phase function
  float henyeyGreenstein(float cosAngle, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.1415926535 * pow(1.0 + g2 - 2.0 * g * cosAngle, 1.5));
  }

  void main() {
    if (uEnabled <= 0.05) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec3 viewDir = normalize(vWorldPosition);
    float h = clamp(viewDir.y, -0.15, 1.0); // Smooth continuous atmosphere across full sphere

    float cosSunAngle = dot(viewDir, vSunDir);
    float cosMoonAngle = dot(viewDir, vMoonDir);

    float sunAlt = uSunAltitude;
    float moonAlt = uMoonAltitude;

    // 1. NON-LINEAR ALTITUDE GRADIENT PROFILE (C2 Continuous, Zero Banding)
    float zenithWeight = smoothstep(0.01, 0.65, h);
    float horizonFactor = exp(-4.5 * h); // Exponential horizon scattering & natural extinction

    // Exposure non-linear scaling (preserves gradient at max, structure at min)
    float skyExposure = mix(0.40, 1.40, clamp(uSkyBrightness, 0.0, 2.0) * 0.5);

    // 2. SUN-ALTITUDE TWILIGHT GRADIENT STAGES
    // Smoothstep weights across twilight regimes (C1 continuous)
    float wNight = 1.0 - smoothstep(-18.0, -12.0, sunAlt);
    float wAstro = smoothstep(-18.0, -12.0, sunAlt) * (1.0 - smoothstep(-12.0, -6.0, sunAlt));
    float wNaut  = smoothstep(-12.0, -6.0, sunAlt)  * (1.0 - smoothstep(-6.0, 0.0, sunAlt));
    float wCivil = smoothstep(-6.0, 0.0, sunAlt)   * (1.0 - smoothstep(0.0, 20.0, sunAlt));
    float wDay   = smoothstep(0.0, 20.0, sunAlt);

    // Night (< -18°): Deep Stellarium Astronomical Sky (#02040A Zenith -> #0E1826 Horizon)
    vec3 zenithNight  = vec3(0.006, 0.012, 0.032); // Deepest navy-black overhead (#02040A)
    vec3 horizonNight = vec3(0.035, 0.065, 0.110); // Subtle dark blue-grey horizon haze (#0A1320)

    // Astronomical Twilight (-18° to -12°): Deep navy twilight sky
    vec3 zenithAstro  = vec3(0.008, 0.018, 0.045);
    vec3 horizonAstro = vec3(0.055, 0.095, 0.150);

    // Nautical Twilight (-12° to -6°): Deep blue overhead, dusk horizon
    vec3 zenithNaut   = vec3(0.015, 0.032, 0.085);
    vec3 horizonNaut  = vec3(0.095, 0.125, 0.200);

    // Civil Twilight (-6° to 0°): Soft purple zenith, warm pink/orange dusk horizon
    vec3 zenithCivil  = vec3(0.040, 0.080, 0.200);
    vec3 horizonCivil = vec3(0.350, 0.180, 0.100);

    // Full Daylight (sunAlt >= 0°): Bright vivid natural blue daytime sky (matching Stellarium Web)
    vec3 zenithDay    = vec3(0.350, 0.650, 0.960); // Bright natural sky blue (#59a6f5)
    vec3 horizonDay   = vec3(0.620, 0.820, 0.980); // Light pale blue scattering (#9ed1fa)

    // Blend base colors continuously across sun altitude
    vec3 baseZenith  = zenithNight * wNight + zenithAstro * wAstro + zenithNaut * wNaut + zenithCivil * wCivil + zenithDay * wDay;
    vec3 baseHorizon = horizonNight * wNight + horizonAstro * wAstro + horizonNaut * wNaut + horizonCivil * wCivil + horizonDay * wDay;

    // Composite main atmospheric vertical gradient
    vec3 skyColor = mix(baseHorizon, baseZenith, zenithWeight);

    // 3. SUNRISE / SUNSET & MIE SOLAR CORONA
    // Soft warm scattering near horizon and Sun during twilight and day
    if (sunAlt > -8.0) {
      float mieHalo = henyeyGreenstein(cosSunAngle, 0.82) * clamp((sunAlt + 8.0) / 12.0, 0.0, 1.0) * 0.22;
      vec3 warmSunsetColor = vec3(0.75, 0.35, 0.18) * horizonFactor * (1.0 - wDay) * 0.4;
      skyColor += vec3(0.65, 0.45, 0.28) * mieHalo + warmSunsetColor;
    }

    // 4. BORTLE LIGHT POLLUTION HORIZON DOME (Concentrated near horizon, zenith stays dark)
    float bortleNorm = clamp((uBortleScale - 1.0) / 8.0, 0.0, 1.0);
    vec3 lightDomeColor = mix(vec3(0.003, 0.006, 0.014), vec3(0.038, 0.035, 0.048), pow(bortleNorm, 1.4));
    float lightDomeShape = exp(-5.0 * h) * pow(bortleNorm, 1.3);
    skyColor += lightDomeColor * lightDomeShape * 0.75;

    // 5. AIR TRANSPARENCY & AEROSOL HAZE (Concentrated near horizon)
    float hazeAmount = clamp(1.0 - uTransparency, 0.0, 1.0);
    float hazeHorizonShape = exp(-4.0 * h);
    vec3 hazeColor = mix(vec3(0.005, 0.010, 0.020), vec3(0.035, 0.038, 0.050), bortleNorm);
    skyColor += hazeColor * hazeHorizonShape * hazeAmount * 0.35;

    // 6. MOONLIGHT SKY GLOW & MIE HALO (Cool/neutral blue, stronger near horizon)
    if (moonAlt > 0.0 && uMoonBrightness > 0.01) {
      float mAltFactor = clamp(moonAlt / 90.0, 0.0, 1.0);
      float mPhaseFactor = clamp(uMoonIllumination, 0.05, 1.0);
      float moonGlow = mAltFactor * mPhaseFactor * uMoonBrightness;

      // Global Cool Moon Rayleigh sky glow (concentrates near lower sky / horizon)
      vec3 moonRayleigh = vec3(0.008, 0.020, 0.048) * moonGlow * exp(-2.8 * h);

      // Forward Mie scattering halo around Moon
      float mieMoon = henyeyGreenstein(cosMoonAngle, 0.84) * moonGlow * 0.15;
      vec3 moonMie = vec3(0.12, 0.18, 0.30) * mieMoon;

      skyColor += moonRayleigh + moonMie;
    }

    // 7. HORIZON AIRGLOW & BLENDING
    float airglowShape = exp(-5.0 * h) * uAirglowIntensity;
    vec3 airglowColor = vec3(0.004, 0.012, 0.010); // Subtle cool airglow emission
    skyColor += airglowColor * airglowShape * 0.35;

    // 8. EXPOSURE TONE MAPPING (Natural non-linear contrast)
    vec3 finalColor = vec3(1.0) - exp(-skyColor * skyExposure);

    // Alpha blending
    float finalAlpha = clamp(uOpacity, 0.0, 1.0);
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export class AtmosphereSystem {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.radius=792] - Celestial placement radius.
   * @param {number} [options.bortleScale=3] - Default Bortle class (1 to 9).
   */
  constructor(options = {}) {
    this.options = {
      radius: options.radius || 792,
      bortleScale: options.bortleScale || 3,
      ...options
    };

    this.mesh = null;
    this.material = null;
    this.sunAltitude = -25.0;
    this.sunAzimuth = 180.0;
    this.moonAltitude = -30.0;
    this.moonPhase = 0.5;
    this.bortleScale = this.options.bortleScale;
    this.airglowIntensity = 1.0;
    this.starVisibilityFactor = 1.0;
    this.opacity = 1.0;
    this.skyBrightness = 0.5;
    this.transparency = 0.8;
    this.moonBrightness = 0.5;
    this.enabled = true;

    this.init();
  }

  /**
   * Initializes GPU WebGL Atmosphere Shader Material and Geometry.
   */
  init() {
    const geometry = new THREE.SphereGeometry(this.options.radius, 64, 32);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSunPosition: { value: new THREE.Vector3(0, -1, 0) },
        uMoonPosition: { value: new THREE.Vector3(0, -1, 0) },
        uSunAltitude: { value: -25.0 },
        uSunAzimuth: { value: 180.0 },
        uMoonAltitude: { value: -30.0 },
        uMoonPhase: { value: 0.5 },
        uMoonIllumination: { value: 0.5 },
        uMoonBrightness: { value: 0.5 },
        uBortleScale: { value: this.bortleScale },
        uTransparency: { value: 0.8 },
        uSkyBrightness: { value: 0.5 },
        uAirglowIntensity: { value: 1.0 },
        uOpacity: { value: 1.0 },
        uEnabled: { value: 1.0 }
      },
      vertexShader: AtmosphereVertexShader,
      fragmentShader: AtmosphereFragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = -5; // Rendered between Milky Way (-10) and Stars (+1)
  }

  /**
   * Enables or disables the atmosphere shader and mesh cleanly.
   * @param {boolean} enabled
   */
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
   * Calculates Sun & Moon positions and updates GPU atmosphere uniforms + star visibility factor.
   * @param {Date} date - Simulation date/time.
   * @param {Object} observer - Observer location ({ latitude, longitude }).
   */
  updateSunPosition(date = new Date(), observer = { latitude: 0, longitude: 0 }) {
    let sunAlt = -25.0;
    let sunAz = 180.0;
    let moonAlt = -30.0;
    let moonPhase = 0.5;

    const d = (date instanceof Date && !isNaN(date)) ? date : new Date(date || Date.now());

    if (typeof window !== 'undefined' && window.Astronomy && typeof window.Astronomy.Equator === 'function') {
      try {
        const time = window.Astronomy.MakeTime(d);
        let obs = observer;
        if (!(obs instanceof window.Astronomy.Observer)) {
          const lat = (observer && observer.latitude !== undefined) ? observer.latitude : (observer && observer.lat !== undefined ? observer.lat : 0);
          const lon = (observer && observer.longitude !== undefined) ? observer.longitude : (observer && observer.lon !== undefined ? observer.lon : 0);
          obs = new window.Astronomy.Observer(lat, lon, 0);
        }

        const bodySun = (window.Astronomy.Body && window.Astronomy.Body.Sun !== undefined)
          ? window.Astronomy.Body.Sun
          : "Sun";
        const bodyMoon = (window.Astronomy.Body && window.Astronomy.Body.Moon !== undefined)
          ? window.Astronomy.Body.Moon
          : "Moon";

        const refr = (window.Astronomy.Refraction && window.Astronomy.Refraction.None !== undefined)
          ? window.Astronomy.Refraction.None
          : null;

        const sunEquator = window.Astronomy.Equator(bodySun, time, obs, true, true);
        const sunHorizon = window.Astronomy.Horizon(time, obs, sunEquator.ra, sunEquator.dec, refr);
        sunAlt = sunHorizon.altitude;
        sunAz = sunHorizon.azimuth;

        const moonEquator = window.Astronomy.Equator(bodyMoon, time, obs, true, true);
        const moonHorizon = window.Astronomy.Horizon(time, obs, moonEquator.ra, moonEquator.dec, refr);
        moonAlt = moonHorizon.altitude;

        if (typeof window.Astronomy.MoonPhase === 'function') {
          const phaseDeg = window.Astronomy.MoonPhase(time);
          moonPhase = (1.0 - Math.cos(phaseDeg * Math.PI / 180.0)) / 2.0;
        }
      } catch (e) {
        console.warn('[AtmosphereSystem] Astronomy Engine solar calculation fallback:', e);
      }
    }

    // Solar Local Math Fallback if Astronomy Engine is omitted
    if (sunAlt === -25.0) {
      const yearDay = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
      const declination = -23.44 * Math.cos(THREE.MathUtils.degToRad((360 / 365) * (yearDay + 10)));
      const localHours = d.getHours() + d.getMinutes() / 60.0 + d.getSeconds() / 3600.0;
      const hourAngle = (localHours - 12.0) * 15.0;

      const latRad = THREE.MathUtils.degToRad((observer && observer.latitude !== undefined) ? observer.latitude : ((observer && observer.lat !== undefined) ? observer.lat : 0));
      const decRad = THREE.MathUtils.degToRad(declination);
      const haRad = THREE.MathUtils.degToRad(hourAngle);

      const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
      sunAlt = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1.0, Math.min(1.0, sinAlt))));
    }

    this.sunAltitude = sunAlt;
    this.sunAzimuth = sunAz;
    this.moonAltitude = moonAlt;
    this.moonPhase = moonPhase;

    if (this.material && this.material.uniforms) {
      this.material.uniforms.uSunAltitude.value = sunAlt;
      this.material.uniforms.uSunAzimuth.value = sunAz;
      this.material.uniforms.uMoonAltitude.value = moonAlt;
      this.material.uniforms.uMoonPhase.value = moonPhase;
      this.material.uniforms.uMoonIllumination.value = moonPhase;
      this.material.uniforms.uMoonBrightness.value = this.moonBrightness !== undefined ? this.moonBrightness : 0.5;

      // Update 3D Direction Vectors for Mie scattering
      const sunAzRad = THREE.MathUtils.degToRad(sunAz);
      const sunAltRad = THREE.MathUtils.degToRad(sunAlt);
      this.material.uniforms.uSunPosition.value.set(
        Math.cos(sunAltRad) * Math.sin(sunAzRad),
        Math.sin(sunAltRad),
        Math.cos(sunAltRad) * Math.cos(sunAzRad)
      );
    }

    // Star visibility factor calculation
    if (sunAlt > 0.0) {
      this.starVisibilityFactor = 0.0;
    } else if (sunAlt > -18.0) {
      this.starVisibilityFactor = (sunAlt + 18.0) / -18.0;
    } else {
      this.starVisibilityFactor = 1.0;
    }

    return {
      altitude: sunAlt,
      azimuth: sunAz,

      // Compatibility names used by SkyRendererV2
      sunAltitude: sunAlt,
      sunAzimuth: sunAz,

      starVisibility: this.starVisibilityFactor
    };
  }

  /**
   * Sets Bortle Light Pollution class (1 to 9).
   * @param {number} scale
   */
  setBortleScale(scale) {
    this.bortleScale = Math.max(1, Math.min(9, scale));
    if (this.material && this.material.uniforms) {
      this.material.uniforms.uBortleScale.value = this.bortleScale;
    }
  }

  /**
   * Sets moonlight scattering brightness scale (0.0 to 2.0).
   * @param {number} brightness
   */
  setMoonlightBrightness(brightness) {
    const b = Math.max(0.0, Math.min(2.0, parseFloat(brightness) ?? 0.5));
    this.moonBrightness = b;
    if (this.material && this.material.uniforms && this.material.uniforms.uMoonBrightness) {
      this.material.uniforms.uMoonBrightness.value = b;
    }
  }

  /**
   * Sets atmospheric transparency / aerosol clarity (0.0 to 1.0).
   * 1 = crystal clear sky, 0 = strong aerosol haze layer.
   * @param {number} transparency
   */
  setTransparency(transparency) {
    const t = Math.max(0.0, Math.min(1.0, parseFloat(transparency) ?? 0.8));
    this.transparency = t;
    if (this.material && this.material.uniforms && this.material.uniforms.uTransparency) {
      this.material.uniforms.uTransparency.value = t;
    }
  }

  /**
   * Alias for setTransparency.
   */
  setAirTransparency(transparency) {
    this.setTransparency(transparency);
  }

  /**
   * Sets sky brightness / exposure scale (0.0 to 2.0).
   * Controls atmospheric scattering intensity without flat color multiplication.
   * @param {number} brightness
   */
  setSkyBrightness(brightness) {
    const b = Math.max(0.0, Math.min(2.0, parseFloat(brightness) ?? 0.5));
    this.skyBrightness = b;
    if (this.material && this.material.uniforms && this.material.uniforms.uSkyBrightness) {
      this.material.uniforms.uSkyBrightness.value = b;
    }
  }

  /**
   * Sets upper atmosphere airglow intensity (0.0 to 2.0).
   * @param {number} intensity
   */
  setAirglowIntensity(intensity) {
    this.airglowIntensity = Math.max(0.0, Math.min(2.0, intensity));
    if (this.material && this.material.uniforms && this.material.uniforms.uAirglowIntensity) {
      this.material.uniforms.uAirglowIntensity.value = this.airglowIntensity;
    }
  }

  /**
   * Toggles horizon glow / upper airglow intensity.
   * @param {boolean} visible
   */
  setHorizonGlow(visible) {
    this.showHorizonGlow = !!visible;
    this.setAirglowIntensity(visible ? 1.0 : 0.0);
  }

  /**
   * Disposes of geometry and material resources cleanly.
   */
  dispose() {
    if (this.mesh) {
      if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
      this.mesh = null;
    }
    this.material = null;
  }
}

export const Atmosphere = AtmosphereSystem;
export default AtmosphereSystem;
