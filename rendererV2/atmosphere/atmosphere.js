/**
 * Master Atmosphere Module for SkyRendererV2 (Re-exporting AtmosphereSystem)
 */

export { AtmosphereSystem, AtmosphereSystem as Atmosphere, AtmosphereVertexShader, AtmosphereFragmentShader } from '../atmosphereSystem.js';
export { LightPollution } from './lightPollution.js';
export { AtmosphericExtinction } from './extinction.js';
import { AtmosphereSystem } from '../atmosphereSystem.js';
export default AtmosphereSystem;
