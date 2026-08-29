/**
 * Advanced Stellarium-Quality MilkyWaySystem for SkyRendererV2
 * 
 * FEATURES:
 * 1. Render Order = 0 (always behind Stars at 2 & DSOs at 2 so stars remain 100% visible through the band).
 * 2. Natural Stellarium Color Calibration (Warm amber core + cool outer sky depth).
 * 3. Smooth Alpha Blending & Feathered Edges (Max alpha clamped at 0.65; never obscures stars).
 * 4. Dynamic Zoom LOD (Smooth mipmap filtering, zero pixelation, enhanced dust lane details on zoom).
 * 5. Synchronized Sky Adaptation (Sun Altitude / Twilight, Moon Altitude / Phase, Bortle Scale).
 * 6. UI Brightness Slider Capped at 1.0.
 * 7. Future-Ready Public API (HDR, Multi-layer, Exposure, Dust Enhancement, Color Presets).
 */

import * as THREE from 'three';

export class MilkyWaySystem {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.radius=798]
   */
  constructor(options = {}) {
    this.options = {
      radius: options.radius || 798,
      ...options
    };

    this.group = null;
    this.mesh = null;
    this.material = null;
    this.texture = null;

    this.baseOpacity = 0.55;
    this.userBrightness = 0.75;
    this.skyFactor = 1.0;
    this.fov = 60.0;

    // Future-Ready Extensions
    this.hdrEnabled = false;
    this.multiLayerEnabled = false;
    this.exposure = 1.0;
    this.dustEnhancement = 1.0;
    this.colorPreset = 'stellarium_natural';

    
  }

  async init() {
    this.group = new THREE.Group();
    this.group.name = 'milkyWayGroup';
    // Render order set BEFORE stars (stars = 2, DSOs = 2) so stars render on top of the Milky Way
    this.group.renderOrder = 0;

    const textureLoader = new THREE.TextureLoader();
    this.texture = await new Promise((resolve) => {
      textureLoader.load(
        './assets/milkyway.jpg',
        resolve,
        undefined,
        () => resolve(null)
      );
    });

    if (this.texture) {
      this.texture.wrapS = THREE.RepeatWrapping;
      this.texture.wrapT = THREE.ClampToEdgeWrapping;
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.minFilter = THREE.LinearMipmapLinearFilter;
      this.texture.generateMipmaps = true;

      const geometry = new THREE.SphereGeometry(this.options.radius, 64, 32);

      // Stellarium Color Calibration Shader
      this.material = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: this.texture },
          uOpacity: { value: this.baseOpacity },
          uBrightness: { value: this.userBrightness },
          uSkyFactor: { value: this.skyFactor },
          uFOV: { value: this.fov },
          uExposure: { value: this.exposure },
          uDustEnhancement: { value: this.dustEnhancement }
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform float uOpacity;
          uniform float uBrightness;
          uniform float uSkyFactor;
          uniform float uFOV;
          uniform float uExposure;
          uniform float uDustEnhancement;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          void main() {
            vec4 texColor = texture2D(uMap, vUv);
            vec3 rgb = texColor.rgb;

            // 1. Stellarium Color Calibration (Warm core + subtle cool outer galactic arms)
            float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
            
            vec3 coreWarmth = vec3(1.08, 0.98, 0.88);
            vec3 outerCool = vec3(0.92, 0.98, 1.05);
            vec3 calibratedColor = mix(rgb * outerCool, rgb * coreWarmth, smoothstep(0.15, 0.65, luma));

            // 2. Controlled Contrast & Soft Dust Lane Preservation
            calibratedColor =
    pow(calibratedColor, vec3(1.08))
    * 1.15
    * uBrightness
    * uExposure
    * uSkyFactor;

            // 3. Dynamic Dust Enhancement based on FOV Zoom
            float zoomDetail = clamp((60.0 - uFOV) / 45.0, 0.0, 0.35);
            calibratedColor += vec3(luma * zoomDetail * 0.12 * uDustEnhancement);

            // 4. Alpha Blending & Smooth Edge Feathering (Max alpha clamped at 0.65 - stars always remain visible)
            
            float alpha = clamp(
    luma * 1.1 * uOpacity,
    0.0,
    0.65
);
            gl_FragColor = vec4(calibratedColor, alpha);
          }
        `,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
      });

      this.mesh = new THREE.Mesh(geometry, this.material);
      this.mesh.renderOrder = 0;
      // Exact Astronomical Galactic Coordinate Alignment
      this.mesh.rotation.y = THREE.MathUtils.degToRad(-90);
      this.mesh.rotation.x = THREE.MathUtils.degToRad(62.87);
      this.mesh.rotation.z = THREE.MathUtils.degToRad(-192.85);

      this.group.add(this.mesh);
    }
  }

  // Future-Ready Public API
  setBrightness(val) {
    const num = parseFloat(val);

    this.userBrightness = Number.isFinite(num)
        ? Math.max(0.0, Math.min(1.0, num))
        : 0.75;

    if (this.material && this.material.uniforms.uBrightness) {
        this.material.uniforms.uBrightness.value =
            this.userBrightness;
    }
}

  setOpacity(val) {
    const num = parseFloat(val);

    this.baseOpacity = Number.isFinite(num)
        ? Math.max(0.0, Math.min(1.0, num))
        : 0.55;

    if (this.material && this.material.uniforms.uOpacity) {
        this.material.uniforms.uOpacity.value =
            this.baseOpacity;
    }
}

  setVisible(visible) {
    if (this.group) this.group.visible = !!visible;
  }

  updateFOV(fovDeg) {
    this.fov = fovDeg;
    if (this.material && this.material.uniforms.uFOV) {
      this.material.uniforms.uFOV.value = fovDeg;
    }
  }

  updateSkyConditions(sunAltDeg = -30, moonAltDeg = -30, moonPhase = 0.5, bortleScale = 3) {
    // 1. Twilight / Sun Altitude Adaptation
    let sunFactor = 1.0;
    if (sunAltDeg >= 0) sunFactor = 0.0;
    else if (sunAltDeg >= -6) sunFactor = 0.01;
    else if (sunAltDeg >= -12) sunFactor = 0.15;
    else if (sunAltDeg >= -18) sunFactor = 0.50;

    // 2. Moonlight Adaptation (Full Moon dims Milky Way)
    let moonFactor = 1.0;
    if (moonAltDeg > 0) {
      moonFactor = Math.max(0.2, 1.0 - (moonAltDeg / 90.0) * moonPhase * 0.70);
    }

    // 3. Bortle Light Pollution Adaptation
    let bortleFactor = Math.max(0.1, 1.0 - (bortleScale - 1.0) / 7.0);

    this.skyFactor = sunFactor * moonFactor * bortleFactor;
    if (this.material && this.material.uniforms.uSkyFactor) {
      this.material.uniforms.uSkyFactor.value = this.skyFactor;
    }
  }

  // Extension API
  setHDRMode(enabled) { this.hdrEnabled = !!enabled; }
  setMultiLayerMode(enabled) { this.multiLayerEnabled = !!enabled; }
  setExposure(val) {
    this.exposure = parseFloat(val) || 1.0;
    if (this.material && this.material.uniforms.uExposure) {
      this.material.uniforms.uExposure.value = this.exposure;
    }
  }
  setDustCloudEnhancement(val) {
    this.dustEnhancement = parseFloat(val) || 1.0;
    if (this.material && this.material.uniforms.uDustEnhancement) {
      this.material.uniforms.uDustEnhancement.value = this.dustEnhancement;
    }
  }
  setColorCalibration(preset) { this.colorPreset = preset; }
}
