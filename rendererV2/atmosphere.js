/**
 * Atmosphere Module for SkyRendererV2
 * 
 * FEATURES:
 * - Physically-inspired GPU WebGL atmosphere shader (THREE.ShaderMaterial).
 * - Smooth continuous transitions across 7 solar altitude phases:
 *   Day Sky (sunAlt > 0°), Golden Sunset/Sunrise & Civil Twilight (0° to -6°),
 *   Nautical Twilight (-6° to -12°), Astronomical Twilight (-12° to -18°), and Night Sky (sunAlt < -18°).
 * - Automatic star attenuation factor (stars fade during day, visible at night).
 * - Extensible architecture ready for future upgrades:
 *   Horizon extinction, Airglow, Light pollution, Moonlight, Weather effects.
 * - Rendered on inner celestial sphere (radius = 0.99 * R, renderOrder = -5).
 */

import * as THREE from 'three';

export class Atmosphere {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.radius=792] - Celestial placement radius.
   */
  constructor(options = {}) {
    this.options = {
      radius: options.radius || 792,
      ...options
    };

    this.mesh = null;
    this.material = null;
    this.sunAltitude = -25.0; // Default night altitude
    this.sunAzimuth = 180.0;
    this.starVisibilityFactor = 1.0;
    this.opacity = 1.0;

    this.init();
  }

  /**
   * Initializes GPU WebGL Atmosphere Shader Material and Geometry.
   */
  init() {
    const geometry = new THREE.SphereGeometry(this.options.radius, 64, 32);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSunAltitude: { value: -25.0 },
        uSunAzimuth: { value: 180.0 },
        uOpacity: { value: 1.0 },

        // Extensible Architecture Uniforms for future features
        uExtinction: { value: 0.0 },
        uAirglow: { value: 0.05 },
        uLightPollution: { value: 0.0 },
        uMoonlight: { value: 0.0 },
        uWeather: { value: 0.0 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float uSunAltitude;
        uniform float uSunAzimuth;
        uniform float uOpacity;

        uniform float uExtinction;
        uniform float uAirglow;
        uniform float uLightPollution;
        uniform float uMoonlight;
        uniform float uWeather;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float height = dir.y; // -1.0 (nadir) to +1.0 (zenith)

          float sunAlt = uSunAltitude;

          vec3 zenithColor = vec3(0.005, 0.008, 0.020);
          vec3 horizonColor = vec3(0.010, 0.015, 0.030);

          if (sunAlt > 0.0) {
            // Day Sky (Rayleigh blue scattering)
            float dayFactor = clamp(sunAlt / 45.0, 0.0, 1.0);
            zenithColor = mix(vec3(0.12, 0.32, 0.60), vec3(0.08, 0.22, 0.55), dayFactor);
            horizonColor = mix(vec3(0.44, 0.64, 0.90), vec3(0.60, 0.78, 0.98), dayFactor);
          } else if (sunAlt > -6.0) {
            // Civil Twilight / Sunset & Sunrise Golden Glow
            float t = (sunAlt + 6.0) / 6.0;
            zenithColor = mix(vec3(0.03, 0.06, 0.18), vec3(0.12, 0.32, 0.60), t);
            horizonColor = mix(vec3(0.95, 0.42, 0.15), vec3(0.44, 0.64, 0.90), t);
          } else if (sunAlt > -12.0) {
            // Nautical Twilight (Deep Crimson to Navy)
            float t = (sunAlt + 12.0) / 6.0;
            zenithColor = mix(vec3(0.015, 0.030, 0.090), vec3(0.03, 0.06, 0.18), t);
            horizonColor = mix(vec3(0.25, 0.12, 0.30), vec3(0.95, 0.42, 0.15), t);
          } else if (sunAlt > -18.0) {
            // Astronomical Twilight (Deep Midnight Blue)
            float t = (sunAlt + 18.0) / 6.0;
            zenithColor = mix(vec3(0.005, 0.008, 0.020), vec3(0.015, 0.030, 0.090), t);
            horizonColor = mix(vec3(0.020, 0.035, 0.080), vec3(0.25, 0.12, 0.30), t);
          }

          // Vertical height gradient
          float elevation = clamp(height * 0.5 + 0.5, 0.0, 1.0);
          vec3 skyColor = mix(horizonColor, zenithColor, elevation);

          // Subtle night airglow
          vec3 nightGlow = vec3(0.005, 0.008, 0.018) * (1.0 + uAirglow);
          if (sunAlt < -18.0) {
            skyColor += nightGlow;
          }

          // Alpha transparency based on day/night phase
          float atmosphereAlpha = 0.0;
          if (sunAlt > 0.0) {
            atmosphereAlpha = 0.90;
          } else if (sunAlt > -18.0) {
            atmosphereAlpha = mix(0.04, 0.90, (sunAlt + 18.0) / 18.0);
          } else {
            atmosphereAlpha = 0.04;
          }

          gl_FragColor = vec4(skyColor, atmosphereAlpha * uOpacity);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = -5; // Rendered between Milky Way (-10) and Stars (+1)
  }

  /**
   * Calculates Sun altitude and updates GPU atmosphere uniforms + star visibility factor.
   * @param {Date} date - Simulation date/time.
   * @param {Object} observer - Observer location ({ latitude, longitude }).
   */
  updateSunPosition(date = new Date(), observer = { latitude: 0, longitude: 0 }) {
    let sunAlt = -25.0;
    let sunAz = 180.0;

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

        const sunEquator = window.Astronomy.Equator(bodySun, time, obs, true, true);
        const refr = (window.Astronomy.Refraction && window.Astronomy.Refraction.None !== undefined)
          ? window.Astronomy.Refraction.None
          : null;

        const sunHorizon = window.Astronomy.Horizon(time, obs, sunEquator.ra, sunEquator.dec, refr);
        sunAlt = sunHorizon.altitude;
        sunAz = sunHorizon.azimuth;
      } catch (e) {
        console.warn('[Atmosphere] Solar position calculation fallback:', e);
      }
    }

    // Solar Local Math Fallback if Astronomy Engine is omitted
    if (sunAlt === -25.0) {
      const yearDay = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
      const declination = -23.44 * Math.cos(THREE.MathUtils.degToRad((360 / 365) * (yearDay + 10)));

      // Use local solar hours for observer horizon calculation
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

    if (this.material && this.material.uniforms) {
      this.material.uniforms.uSunAltitude.value = sunAlt;
      this.material.uniforms.uSunAzimuth.value = sunAz;
    }

    // Compute star visibility factor (fades stars gracefully during day)
    if (sunAlt > 0.0) {
      this.starVisibilityFactor = 0.0;
    } else if (sunAlt > -6.0) {
      this.starVisibilityFactor = Math.pow((sunAlt + 6.0) / -6.0, 2.0);
    } else {
      this.starVisibilityFactor = 1.0;
    }

    return { altitude: sunAlt, azimuth: sunAz, starVisibility: this.starVisibilityFactor };
  }

  /**
   * Sets overall atmosphere opacity (0.0 to 1.0).
   * @param {number} opacity
   */
  setOpacity(opacity) {
    this.opacity = Math.max(0.0, Math.min(1.0, opacity));
    if (this.material && this.material.uniforms) {
      this.material.uniforms.uOpacity.value = this.opacity;
    }
  }

  /**
   * Extensible method to set future environment parameters (airglow, extinction, etc.).
   * @param {Object} params
   */
  setEnvironmentParameters(params = {}) {
    if (!this.material || !this.material.uniforms) return;
    if (params.extinction !== undefined) this.material.uniforms.uExtinction.value = params.extinction;
    if (params.airglow !== undefined) this.material.uniforms.uAirglow.value = params.airglow;
    if (params.lightPollution !== undefined) this.material.uniforms.uLightPollution.value = params.lightPollution;
    if (params.moonlight !== undefined) this.material.uniforms.uMoonlight.value = params.moonlight;
    if (params.weather !== undefined) this.material.uniforms.uWeather.value = params.weather;
  }

  dispose() {
    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.material) this.material.dispose();
      if (this.mesh.parentNode) this.mesh.parentNode.removeChild(this.mesh);
      this.mesh = null;
      this.material = null;
    }
  }
}

export default Atmosphere;
