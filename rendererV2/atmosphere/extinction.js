/**
 * Atmospheric Extinction & Airmass System
 * Calculates visual magnitude dimming near the horizon due to atmospheric thickness.
 */

export class AtmosphericExtinction {
  /**
   * Calculates airmass X(z) for zenith angle z (in degrees).
   * Uses Kasten-Young (1989) empirical airmass formula.
   * @param {number} altitudeDeg - Altitude angle above horizon in degrees (0..90).
   * @returns {number} Airmass relative factor (1.0 at zenith, ~38 at horizon).
   */
  static getAirmass(altitudeDeg) {
    const alt = Math.max(0.1, Math.min(90.0, altitudeDeg));
    const zenithRad = (90.0 - alt) * (Math.PI / 180.0);
    const cosZ = Math.cos(zenithRad);
    const secZ = 1.0 / (cosZ + 0.15 * Math.pow(alt + 3.885, -1.253));
    return Math.max(1.0, Math.min(38.0, secZ));
  }

  /**
   * Calculates visual extinction magnitude drop Δm for a given altitude.
   * @param {number} altitudeDeg - Altitude in degrees.
   * @param {number} [k=0.20] - Atmospheric extinction coefficient (mag/airmass).
   * @returns {number} Magnitude increase Δm (dimming).
   */
  static getExtinctionMag(altitudeDeg, k = 0.20) {
    if (altitudeDeg <= 0) return 6.0; // Fully extinguished below horizon
    const airmass = this.getAirmass(altitudeDeg);
    return (airmass - 1.0) * k;
  }
}

export default AtmosphericExtinction;
