/**
 * Advanced GPU Atmosphere GLSL Shader Definitions (Part 2)
 * Implements Rayleigh Scattering, Mie Solar Forward Halo, Horizon Haze,
 * Bortle Light Pollution 1-9, Moonlight Phase Scattering, and Night Airglow.
 */

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

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vSunDir;
  varying vec3 vMoonDir;

  // Henyey-Greenstein Mie scattering phase function
  float henyeyGreenstein(float cosAngle, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(1.0 + g2 - 2.0 * g * cosAngle, 1.5));
  }

  void main() {
    vec3 viewDir = normalize(vWorldPosition);
    float height = viewDir.y; // -1.0 (nadir) to +1.0 (zenith)
    float cosSunAngle = dot(viewDir, vSunDir);
    float cosMoonAngle = dot(viewDir, vMoonDir);

    float sunAlt = uSunAltitude;
    float moonAlt = uMoonAltitude;

    // 1. NON-LINEAR ALTITUDE GRADIENT (Zenith darkest, Horizon strongest)
    float heightPos = max(0.0, height);
    float zenithFactor = smoothstep(0.0, 0.85, heightPos);
    float horizonFactor = exp(-2.8 * heightPos);

    // Sky Brightness Exposure Scaling (0.0 = dark night, 0.5 = natural dark observing sky, 1.0 = strong skyglow)
    float skyExposure = pow(clamp(uSkyBrightness, 0.0, 2.0), 1.2);

    // 2. SUN-ALTITUDE SKY MODEL & TRANSITIONS (Stellarium-inspired rich midnight twilight blue)
    vec3 zenithColor = vec3(0.035, 0.065, 0.140) * (0.6 + 0.4 * skyExposure);
    vec3 horizonColor = vec3(0.075, 0.115, 0.220) * (0.6 + 0.4 * skyExposure);
    float baseAlpha = 0.65 + (skyExposure * 0.10);

    if (sunAlt > 0.0) {
      // Daylight (Sun above horizon): Natural subtle blue atmospheric scattering
      float dayFactor = clamp(sunAlt / 45.0, 0.0, 1.0);
      zenithColor = mix(vec3(0.04, 0.12, 0.28), vec3(0.02, 0.08, 0.22), dayFactor) * (0.3 + 0.7 * skyExposure);
      horizonColor = mix(vec3(0.12, 0.25, 0.45), vec3(0.18, 0.35, 0.58), dayFactor) * (0.3 + 0.7 * skyExposure);
      baseAlpha = clamp(0.15 + (skyExposure * 0.20), 0.05, 0.35);
    } else if (sunAlt > -6.0) {
      // Civil Twilight (0° to -6°): Sunset/Sunrise crimson & golden glow to deep blue
      float t = (sunAlt + 6.0) / 6.0;
      zenithColor = mix(vec3(0.035, 0.065, 0.140), vec3(0.08, 0.24, 0.52), t);
      horizonColor = mix(vec3(0.88, 0.35, 0.10), vec3(0.38, 0.58, 0.84), t);
      baseAlpha = mix(0.60, 0.95, t);
    } else if (sunAlt > -12.0) {
      // Nautical Twilight (-6° to -12°): Deep navy to golden sunset horizon
      float t = (sunAlt + 12.0) / 6.0;
      zenithColor = mix(vec3(0.025, 0.045, 0.100), vec3(0.035, 0.065, 0.140), t);
      horizonColor = mix(vec3(0.050, 0.080, 0.170), vec3(0.88, 0.35, 0.10), t);
      baseAlpha = mix(0.50, 0.60, t);
    } else if (sunAlt > -18.0) {
      // Astronomical Twilight (-12° to -18°): Faint midnight navy sky fading to rich night blue
      float t = (sunAlt + 18.0) / 6.0;
      zenithColor = mix(vec3(0.020, 0.038, 0.085), vec3(0.025, 0.045, 0.100), t) * (0.4 + 0.6 * skyExposure);
      horizonColor = mix(vec3(0.045, 0.070, 0.150), vec3(0.050, 0.080, 0.170), t) * (0.4 + 0.6 * skyExposure);
      baseAlpha = mix(0.40, 0.50, t);
    }


    // 3. MIE SCATTERING FORWARD SOLAR CORONA (Sunrise/Sunset)
    float mieSolarGlow = 0.0;
    if (sunAlt > -8.0) {
      mieSolarGlow = henyeyGreenstein(cosSunAngle, 0.76) * clamp((sunAlt + 8.0) / 8.0, 0.0, 1.0) * 0.25;
    }

    // 4. BORTLE LIGHT POLLUTION SKYGLOW DOME (Bortle 1-9)
    float bortleFactor = clamp((uBortleScale - 1.0) / 8.0, 0.0, 1.0);
    vec3 bortleGlowColor = mix(vec3(0.0), vec3(0.38, 0.25, 0.12), pow(bortleFactor, 1.3));
    float bortleDome = horizonFactor * bortleFactor * (0.4 + 0.6 * skyExposure);

    // 5. TRANSPARENCY AEROSOL HAZE (Independent of Bortle)
    float hazeIntensity = clamp(1.0 - uTransparency, 0.0, 1.0);
    float horizonHaze = horizonFactor * hazeIntensity * 0.30;
    vec3 hazeColor = mix(vec3(0.12, 0.15, 0.22), vec3(0.80, 0.50, 0.25), clamp((sunAlt + 6.0) / 12.0, 0.0, 1.0));

    // 6. MOONLIGHT MODEL (Global Rayleigh Scattering + Local Forward Mie Halo)
    vec3 moonlightColor = vec3(0.0);
    if (moonAlt > 0.0 && uMoonBrightness > 0.01) {
      float mAltFactor = clamp(moonAlt / 90.0, 0.0, 1.0);
      float mPhaseFactor = clamp(uMoonIllumination, 0.1, 1.0);

      // A. Global Moonlit Sky Rayleigh Brightness
      float globalMoonSky = mAltFactor * mPhaseFactor * uMoonBrightness;
      vec3 globalMoonColor = vec3(0.03, 0.07, 0.18) * globalMoonSky * horizonFactor;

      // B. Localized Forward Mie Moon Halo around Moon
      float localMoonHalo = henyeyGreenstein(cosMoonAngle, 0.82) * mAltFactor * mPhaseFactor * uMoonBrightness * 0.35;
      vec3 localMoonColor = vec3(0.30, 0.40, 0.60) * localMoonHalo;

      moonlightColor = globalMoonColor + localMoonColor;
      baseAlpha += globalMoonSky * 0.25;
    }

    // 7. STELLARIUM-STYLE ALTITUDE GRADIENT COMPOSITING
    vec3 skyColor = mix(horizonColor, zenithColor, zenithFactor);
    skyColor += vec3(mieSolarGlow) + (hazeColor * horizonHaze) + (bortleGlowColor * bortleDome) + moonlightColor;

    // 8. DYNAMIC ATMOSPHERE ALPHA
    float finalAlpha = clamp(baseAlpha + (bortleFactor * 0.25 * horizonFactor), 0.03, 0.95);

    gl_FragColor = vec4(skyColor, finalAlpha * uOpacity);
  }
`;
