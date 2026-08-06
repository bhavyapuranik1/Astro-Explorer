/**
 * GPU Atmosphere GLSL Shader Definitions
 * Implements Rayleigh Scattering, Mie Solar Forward Halo, Bortle Light Pollution,
 * Moonlight Phase Scattering, and Upper Atmosphere Airglow.
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
  uniform float uMoonPhase;
  uniform float uBortleScale;
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

    // 1. Rayleigh Scattering Base Zenith & Horizon Colors
    vec3 zenithColor = vec3(0.003, 0.005, 0.015);
    vec3 horizonColor = vec3(0.008, 0.012, 0.025);

    if (sunAlt > 0.0) {
      // Day Sky Rayleigh scattering
      float dayFactor = clamp(sunAlt / 45.0, 0.0, 1.0);
      zenithColor = mix(vec3(0.12, 0.32, 0.60), vec3(0.08, 0.22, 0.55), dayFactor);
      horizonColor = mix(vec3(0.44, 0.64, 0.90), vec3(0.60, 0.78, 0.98), dayFactor);
    } else if (sunAlt > -6.0) {
      // Sunrise & Sunset / Civil Twilight Golden & Crimson Mie/Rayleigh Glow
      float t = (sunAlt + 6.0) / 6.0;
      zenithColor = mix(vec3(0.03, 0.06, 0.18), vec3(0.12, 0.32, 0.60), t);
      horizonColor = mix(vec3(0.95, 0.42, 0.15), vec3(0.44, 0.64, 0.90), t);
    } else if (sunAlt > -12.0) {
      // Nautical Twilight (Deep Navy to Sunset Crimson)
      float t = (sunAlt + 12.0) / 6.0;
      zenithColor = mix(vec3(0.012, 0.025, 0.080), vec3(0.03, 0.06, 0.18), t);
      horizonColor = mix(vec3(0.25, 0.12, 0.30), vec3(0.95, 0.42, 0.15), t);
    } else if (sunAlt > -18.0) {
      // Astronomical Twilight (Deep Midnight Blue)
      float t = (sunAlt + 18.0) / 6.0;
      zenithColor = mix(vec3(0.003, 0.005, 0.015), vec3(0.012, 0.025, 0.080), t);
      horizonColor = mix(vec3(0.015, 0.025, 0.060), vec3(0.25, 0.12, 0.30), t);
    }

    // 2. Mie Scattering Forward Solar Corona Glow
    float mieSolarGlow = 0.0;
    if (sunAlt > -8.0) {
      mieSolarGlow = henyeyGreenstein(cosSunAngle, 0.76) * clamp((sunAlt + 8.0) / 8.0, 0.0, 1.0) * 0.18;
    }

    // 3. Moonlight Contribution (Phase & Altitude scattering)
    vec3 moonlightColor = vec3(0.0);
    if (moonAlt > 0.0 && sunAlt < -6.0) {
      float moonScattering = henyeyGreenstein(cosMoonAngle, 0.60) * (moonAlt / 90.0) * uMoonPhase * 0.08;
      moonlightColor = vec3(0.12, 0.18, 0.28) * moonScattering;
    }

    // 4. Light Pollution (Bortle Scale 1-9 Urban Sky Glow)
    float bortleFactor = clamp((uBortleScale - 1.0) / 8.0, 0.0, 1.0);
    vec3 lightPollutionColor = mix(vec3(0.0), vec3(0.35, 0.22, 0.10), bortleFactor) * exp(-1.8 * max(0.0, height));

    // 5. Airglow (Chemiluminescent Upper Atmosphere Glow)
    vec3 airglowColor = vec3(0.005, 0.012, 0.008) * uAirglowIntensity * (1.0 - exp(-1.5 * max(0.0, height)));

    // 6. Horizon Elevation Gradient Synthesis
    float elevation = clamp(height * 0.5 + 0.5, 0.0, 1.0);
    vec3 skyColor = mix(horizonColor, zenithColor, elevation);
    skyColor += vec3(mieSolarGlow) + moonlightColor + lightPollutionColor + airglowColor;

    // 7. Dynamic Atmosphere Alpha
    float atmosphereAlpha = 0.0;
    if (sunAlt > 0.0) {
      atmosphereAlpha = 0.90;
    } else if (sunAlt > -18.0) {
      atmosphereAlpha = mix(0.04 + bortleFactor * 0.30, 0.90, (sunAlt + 18.0) / 18.0);
    } else {
      atmosphereAlpha = 0.04 + bortleFactor * 0.30;
    }

    gl_FragColor = vec4(skyColor, atmosphereAlpha * uOpacity);
  }
`;
