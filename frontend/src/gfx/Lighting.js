/**
 * LIGHTING - Centralized Lighting System
 *
 * Supercell-style lighting philosophy:
 * - Warm, inviting atmosphere (not harsh or cold)
 * - Soft shadows that don't obscure gameplay
 * - Rim/fill lights to prevent flat-looking objects
 * - Consistent mood across the entire arena
 *
 * This setup mimics outdoor daylight with stylized adjustments.
 */

import * as THREE from 'three';

// ===================
// LIGHTING PRESETS
// ===================
export const LightingPresets = {
  // Default daytime arena look
  DAY: {
    ambient: { color: 0x404060, intensity: 0.6 },
    sun: { color: 0xfff5e6, intensity: 1.0, position: [15, 30, 10] },
    rim: { color: 0x4a9eff, intensity: 0.4, position: [-15, 15, -15] },
    hemisphere: { skyColor: 0x87ceeb, groundColor: 0x3d5c3d, intensity: 0.3 },
    fog: { color: 0x1a1a2e, near: 35, far: 70 },
    background: 0x1a1a2e
  },

  // Double elixir / overtime mode (optional future use)
  OVERTIME: {
    ambient: { color: 0x503050, intensity: 0.5 },
    sun: { color: 0xffccaa, intensity: 0.8, position: [10, 25, 8] },
    rim: { color: 0xff6b9e, intensity: 0.5, position: [-15, 15, -15] },
    hemisphere: { skyColor: 0xd946ef, groundColor: 0x3d3c5d, intensity: 0.4 },
    fog: { color: 0x1a1525, near: 30, far: 60 },
    background: 0x1a1525
  },

  // Sudden death (optional future use)
  SUDDEN_DEATH: {
    ambient: { color: 0x602020, intensity: 0.4 },
    sun: { color: 0xff8866, intensity: 0.9, position: [12, 28, 5] },
    rim: { color: 0xe94560, intensity: 0.6, position: [-15, 15, -15] },
    hemisphere: { skyColor: 0xff6b6b, groundColor: 0x2d2020, intensity: 0.35 },
    fog: { color: 0x1a1015, near: 25, far: 55 },
    background: 0x1a1015
  }
};

// ===================
// SHADOW CONFIGURATION
// ===================
export const ShadowConfig = {
  mapSize: 2048,      // Shadow map resolution (power of 2)
  near: 1,            // Shadow camera near plane
  far: 60,            // Shadow camera far plane
  bounds: 25,         // Shadow camera frustum size (covers arena)
  bias: -0.0001,      // Reduces shadow acne
  normalBias: 0.02    // Reduces peter-panning on curved surfaces
};

// ===================
// LIGHTING SYSTEM CLASS
// ===================
export class LightingSystem {
  constructor(scene) {
    this.scene = scene;
    this.lights = {
      ambient: null,
      sun: null,
      rim: null,
      hemisphere: null
    };
    this.currentPreset = null;
  }

  /**
   * Initialize lighting with a preset
   * @param {string} presetName - 'DAY', 'OVERTIME', or 'SUDDEN_DEATH'
   */
  setup(presetName = 'DAY') {
    const preset = LightingPresets[presetName];
    if (!preset) {
      console.warn(`Unknown lighting preset: ${presetName}, using DAY`);
      return this.setup('DAY');
    }

    this.currentPreset = presetName;

    // Clear existing lights
    this.dispose();

    // Set scene background and fog
    this.scene.background = new THREE.Color(preset.background);
    this.scene.fog = new THREE.Fog(preset.fog.color, preset.fog.near, preset.fog.far);

    // Create lights
    this.createAmbientLight(preset.ambient);
    this.createSunLight(preset.sun);
    this.createRimLight(preset.rim);
    this.createHemisphereLight(preset.hemisphere);

    console.log(`Lighting initialized: ${presetName}`);
  }

  /**
   * AMBIENT LIGHT
   * Purpose: Base illumination that fills all shadows
   * Why: Prevents pitch-black areas, maintains visibility
   * Supercell uses slightly blue-tinted ambient for cool shadows
   */
  createAmbientLight(config) {
    this.lights.ambient = new THREE.AmbientLight(config.color, config.intensity);
    this.scene.add(this.lights.ambient);
  }

  /**
   * SUN (DIRECTIONAL) LIGHT
   * Purpose: Primary light source, creates main shadows
   * Why: Defines shape and depth of all 3D objects
   * Position is high and angled for dramatic but readable shadows
   * Warm color (0xfff5e6) gives friendly, daytime feel
   */
  createSunLight(config) {
    this.lights.sun = new THREE.DirectionalLight(config.color, config.intensity);
    this.lights.sun.position.set(...config.position);

    // Shadow configuration
    this.lights.sun.castShadow = true;
    this.lights.sun.shadow.mapSize.width = ShadowConfig.mapSize;
    this.lights.sun.shadow.mapSize.height = ShadowConfig.mapSize;
    this.lights.sun.shadow.camera.near = ShadowConfig.near;
    this.lights.sun.shadow.camera.far = ShadowConfig.far;
    this.lights.sun.shadow.camera.left = -ShadowConfig.bounds;
    this.lights.sun.shadow.camera.right = ShadowConfig.bounds;
    this.lights.sun.shadow.camera.top = ShadowConfig.bounds;
    this.lights.sun.shadow.camera.bottom = -ShadowConfig.bounds;
    this.lights.sun.shadow.bias = ShadowConfig.bias;
    this.lights.sun.shadow.normalBias = ShadowConfig.normalBias;

    // PCFSoft for smooth shadow edges (set in renderer)
    this.scene.add(this.lights.sun);
  }

  /**
   * RIM (FILL) LIGHT
   * Purpose: Secondary light from opposite side
   * Why: Separates objects from background, adds depth
   * Blue tint (0x4a9eff) creates cool/warm contrast with sun
   * Lower intensity so it doesn't compete with main light
   */
  createRimLight(config) {
    this.lights.rim = new THREE.DirectionalLight(config.color, config.intensity);
    this.lights.rim.position.set(...config.position);
    // No shadows - fill light shouldn't cast additional shadows
    this.lights.rim.castShadow = false;
    this.scene.add(this.lights.rim);
  }

  /**
   * HEMISPHERE LIGHT
   * Purpose: Simulates sky/ground color bounce
   * Why: Adds natural-looking ambient variation
   * Sky blue above, ground green below
   * Subtle effect that adds realism without being obvious
   */
  createHemisphereLight(config) {
    this.lights.hemisphere = new THREE.HemisphereLight(
      config.skyColor,
      config.groundColor,
      config.intensity
    );
    this.scene.add(this.lights.hemisphere);
  }

  /**
   * Transition to a different lighting preset (with optional animation)
   */
  transitionTo(presetName, duration = 1.0) {
    const preset = LightingPresets[presetName];
    if (!preset || presetName === this.currentPreset) return;

    // For now, instant switch. Could add GSAP tween later.
    this.setup(presetName);
  }

  /**
   * Adjust sun intensity (for time-of-day effects)
   */
  setSunIntensity(intensity) {
    if (this.lights.sun) {
      this.lights.sun.intensity = intensity;
    }
  }

  /**
   * Adjust ambient intensity
   */
  setAmbientIntensity(intensity) {
    if (this.lights.ambient) {
      this.lights.ambient.intensity = intensity;
    }
  }

  /**
   * Get the main shadow-casting light (for helper debugging)
   */
  getSunLight() {
    return this.lights.sun;
  }

  /**
   * Clean up all lights
   */
  dispose() {
    for (const key in this.lights) {
      if (this.lights[key]) {
        this.scene.remove(this.lights[key]);
        this.lights[key] = null;
      }
    }
  }
}

// ===================
// QUICK SETUP FUNCTION
// ===================

/**
 * Quick function to set up lighting on a scene
 * Usage: setupLighting(scene, 'DAY')
 */
export function setupLighting(scene, preset = 'DAY') {
  const system = new LightingSystem(scene);
  system.setup(preset);
  return system;
}
