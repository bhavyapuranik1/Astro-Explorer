/**
 * Master Atmosphere Module for SkyRendererV2
 * 
 * FEATURES:
 * - Physically-inspired GPU WebGL atmosphere shader (THREE.ShaderMaterial).
 * - Rayleigh & Mie scattering forward solar halo.
 * - Bortle Scale 1-9 Light Pollution sky glow system.
 * - Moonlight phase & altitude contribution.
 * - Upper atmospheric chemiluminescent Airglow.
 * - Kasten-Young Atmospheric Horizon Extinction.
 * - Smooth solar altitude phase transitions (Day, Sunset/Sunrise, Civil, Nautical & Astronomical Twilight, Night).
 * - Automatic star attenuation factor.
 * - Rendered on inner celestial sphere (radius = 0.99 * R, renderOrder = -5).
 */

import * as THREE from 'three';
import { AtmosphereVertexShader, AtmosphereFragmentShader } from './atmosphereShader.js';
import { LightPollution } from './lightPollution.js';
import { AtmosphericExtinction } from './extinction.js';

export class Atmosphere {
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
        uBortleScale: { value: this.bortleScale },
        uAirglowIntensity: { value: 1.0 },
        uOpacity: { value: 1.0 }
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
        console.warn('[Atmosphere] Astronomy Engine solar calculation fallback:', e);
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

      // Update 3D Direction Vectors for Mie scattering
      const sunAzRad = THREE.MathUtils.degToRad(sunAz);
      const sunAltRad = THREE.MathUtils.degToRad(sunAlt);
      this.material.uniforms.uSunPosition.value.set(
        Math.cos(sunAltRad) * Math.sin(sunAzRad),
        Math.sin(sunAltRad),
        Math.cos(sunAltRad) * Math.cos(sunAzRad)
      );
    }

    // Compute star visibility factor
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
   * Sets upper atmosphere airglow intensity (0.0 to 2.0).
   * @param {number} intensity
   */
  setAirglowIntensity(intensity) {
    this.airglowIntensity = Math.max(0.0, Math.min(2.0, intensity));
    if (this.material && this.material.uniforms) {
      this.material.uniforms.uAirglowIntensity.value = this.airglowIntensity;
    }
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

export { LightPollution, AtmosphericExtinction };
export default Atmosphere;
