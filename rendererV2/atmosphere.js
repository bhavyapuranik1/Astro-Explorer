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

          vec3 zenithColor = vec3(0.01, 0.02, 0.05);
          vec3 horizonColor = vec3(0.02, 0.03, 0.06);

          if (sunAlt > 0.0) {
            // Day Sky (Rayleigh blue scattering)
            float dayFactor = clamp(sunAlt / 45.0, 0.0, 1.0);
            zenithColor = mix(vec3(0.12, 0.32, 0.60), vec3(0.08, 0.22, 0.55), dayFactor);
            horizonColor = mix(vec3(0.44, 0.64, 0.90), vec3(0.60, 0.78, 0.98), dayFactor);
          } else if (sunAlt > -6.0) {
            // Civil Twilight / Sunset & Sunrise Golden Glow
            float t = (sunAlt + 6.0) / 6.0;
            zenithColor = mix(vec3(0.04, 0.08, 0.22), vec3(0.12, 0.32, 0.60), t);
            horizonColor = mix(vec3(0.95, 0.42, 0.15), vec3(0.44, 0.64, 0.90), t);
          } else if (sunAlt > -12.0) {
            // Nautical Twilight (Deep Navy to Sunset Crimson)
            float t = (sunAlt + 12.0) / 6.0;
            zenithColor = mix(vec3(0.02, 0.04, 0.12), vec3(0.04, 0.08, 0.22), t);
            horizonColor = mix(vec3(0.25, 0.15, 0.35), vec3(0.95, 0.42, 0.15), t);
          } else if (sunAlt > -18.0) {
            // Astronomical Twilight (Midnight Blue)
            float t = (sunAlt + 18.0) / 6.0;
            zenithColor = mix(vec3(0.01, 0.02, 0.05), vec3(0.02, 0.04, 0.12), t);
            horizonColor = mix(vec3(0.03, 0.05, 0.10), vec3(0.25, 0.15, 0.35), t);
          }

          // Vertical height gradient
          float elevation = clamp(height * 0.5 + 0.5, 0.0, 1.0);
          vec3 skyColor = mix(horizonColor, zenithColor, elevation);

          // Subtle night airglow
          vec3 nightGlow = vec3(0.008, 0.012, 0.025) * (1.0 + uAirglow);
          if (sunAlt < -18.0) {
            skyColor += nightGlow;
          }

          // Alpha transparency based on day/night phase
          float atmosphereAlpha = 0.0;
          if (sunAlt > 0.0) {
            atmosphereAlpha = 0.92;
          } else if (sunAlt > -18.0) {
            atmosphereAlpha = mix(0.08, 0.92, (sunAlt + 18.0) / 18.0);
          } else {
            atmosphereAlpha = 0.08;
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

    if (typeof window !== 'undefined' && window.Astronomy && typeof window.Astronomy.Equator === 'function') {
      try {
        const time = window.Astronomy.MakeTime(date);
        const obs = new window.Astronomy.Observer(observer.latitude || 0, observer.longitude || 0, 0);
        const sunEquator = window.Astronomy.Equator("Sun", time, obs, true, true);
        const sunHorizon = window.Astronomy.Horizon(time, obs, sunEquator.ra, sunEquator.dec, "Refracted");
        sunAlt = sunHorizon.altitude;
        sunAz = sunHorizon.azimuth;
      } catch (e) {
        console.warn('[Atmosphere] Solar position calculation fallback:', e);
      }
    }

    // Solar Math Fallback if Astronomy Engine is omitted
    if (sunAlt === -25.0) {
      const yearDay = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
      const declination = -23.44 * Math.cos(THREE.MathUtils.degToRad((360 / 365) * (yearDay + 10)));
      const hourAngle = ((date.getUTCHours() + date.getUTCMinutes() / 60) * 15 + (observer.longitude || 0)) - 180;
      const latRad = THREE.MathUtils.degToRad(observer.latitude || 0);
      const decRad = THREE.MathUtils.degToRad(declination);
      const haRad = THREE.MathUtils.degToRad(hourAngle);
      const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
      sunAlt = THREE.MathUtils.radToDeg(Math.asin(sinAlt));
    }

    this.sunAltitude = sunAlt;
    this.sunAzimuth = sunAz;

    if (this.material && this.material.uniforms) {
      this.material.uniforms.uSunAltitude.value = sunAlt;
      this.material.uniforms.uSunAzimuth.value = sunAz;
    }

    // Compute star visibility factor (fades stars gracefully during day)
    if (sunAlt > 0.0) {
      this.starVisibilityFactor = 0.0; // Day: stars hidden
    } else if (sunAlt > -6.0) {
      this.starVisibilityFactor = Math.pow((sunAlt + 6.0) / -6.0, 2.0); // Fading during civil twilight
    } else {
      this.starVisibilityFactor = 1.0; // Night: stars 100% visible
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
