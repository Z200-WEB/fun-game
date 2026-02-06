/**
 * GFX MODULE - Graphics utilities for Three.js
 *
 * Centralized exports for all graphics-related functionality:
 * - Materials: Color palette and material factories
 * - Lighting: Scene lighting system
 * - GameModel: Model wrapper for normalization
 * - ModelLoader: Asset loading with caching
 */

// Materials & Colors
export {
  Materials,
  COLORS,
  getTeamColor,
  getTeamAccentColor,
  getHealthColor,
  darkenColor,
  lightenColor
} from './Materials.js';

// Lighting
export {
  LightingSystem,
  LightingPresets,
  ShadowConfig,
  setupLighting
} from './Lighting.js';

// Model Loading
export {
  GameModel
} from './GameModel.js';

export {
  ModelLoader,
  ModelPresets,
  getModelLoader,
  loadModel,
  preloadModels
} from './ModelLoader.js';

// Particle System
export {
  ParticleEmitter,
  BlendMode,
  ParticleShape,
  EmitterShape
} from './ParticleEmitter.js';

// Spell System
export {
  SpellSystem,
  SpellEffect,
  SpellType,
  TimelinePhase
} from './SpellSystem.js';

export {
  SPELLS,
  FIREBALL,
  FREEZE_ZONE,
  HEAL,
  POISON_CLOUD,
  LIGHTNING_BOLT,
  registerAllSpells,
  getSpellDefinition
} from './SpellDefs.js';

// Unit Models
export {
  UNIT_MODEL_CONFIGS,
  TOWER_MODEL_CONFIG,
  preloadUnitModels,
  areModelsPreloaded,
  getPreloadProgress,
  getUnitModel,
  getTowerModel,
  getModelConfig,
  getModelAnimations,
  createAnimationMixer
} from './UnitModels.js';
