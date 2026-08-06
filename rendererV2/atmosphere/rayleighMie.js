/**
 * Rayleigh & Mie Physical Scattering Parameters
 */

export const RayleighCoefficients = {
  // Wavelength dependence lambda^-4 for RGB (680nm, 550nm, 440nm)
  red: 5.8e-6,
  green: 1.35e-5,
  blue: 3.31e-5
};

export const MieParameters = {
  g: 0.76, // Henyey-Greenstein asymmetry factor for aerosol scattering
  betaMie: 2.1e-5
};
