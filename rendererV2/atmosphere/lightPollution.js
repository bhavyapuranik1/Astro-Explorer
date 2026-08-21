/**
 * Bortle Light Pollution Scale System (1 to 9)
 * Computes sky glow intensity and visual limiting magnitude.
 */

export class LightPollution {
  /**
   * Returns Bortle scale properties for a given Bortle class (1 to 9).
   * @param {number} scale - Bortle class (1: Excellent dark sky, 9: Inner-city sky).
   */
  static getBortleProperties(scale = 3) {
    const s = Math.max(1, Math.min(9, Math.round(scale)));

    const table = {
      1: { name: 'Excellent Dark Sky', limitingMag: 7.8, skyGlow: 0.002, airglowVisible: true },
      2: { name: 'Typical Truly Dark Site', limitingMag: 7.3, skyGlow: 0.008, airglowVisible: true },
      3: { name: 'Rural Sky', limitingMag: 6.8, skyGlow: 0.025, airglowVisible: true },
      4: { name: 'Rural/Suburban Transition', limitingMag: 6.2, skyGlow: 0.08, airglowVisible: false },
      5: { name: 'Suburban Sky', limitingMag: 5.7, skyGlow: 0.18, airglowVisible: false },
      6: { name: 'Bright Suburban Sky', limitingMag: 5.2, skyGlow: 0.35, airglowVisible: false },
      7: { name: 'Suburban/Urban Transition', limitingMag: 4.7, skyGlow: 0.55, airglowVisible: false },
      8: { name: 'City Sky', limitingMag: 4.2, skyGlow: 0.80, airglowVisible: false },
      9: { name: 'Inner-City Sky', limitingMag: 3.5, skyGlow: 1.00, airglowVisible: false }
    };

    return table[s] || table[3];
  }
}

export default LightPollution;
