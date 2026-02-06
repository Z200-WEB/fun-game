/**
 * UNIT MODELS - Configuration for 3D Unit Models
 *
 * Maps card IDs to their GLB model files and settings.
 * Used by GameRenderer to load and display unit models.
 */

import { getModelLoader, ModelPresets } from './ModelLoader.js';

// ===================
// MODEL CONFIGURATIONS
// ===================

/**
 * Model config for each card type
 * - path: GLB file path
 * - scale: Model scale (adjust per model)
 * - yOffset: Height offset from ground
 * - rotationOffset: Y-axis rotation correction
 */
export const UNIT_MODEL_CONFIGS = {
  knight: {
    path: 'Knight.glb',
    scale: 0.8,
    yOffset: 0,
    rotationOffset: Math.PI,  // Face forward
    preset: 'unit'
  },

  archer: {
    path: 'Archers.glb',
    scale: 0.7,
    yOffset: 0,
    rotationOffset: Math.PI,
    preset: 'unit'
  },

  giant: {
    path: 'Giant.glb',
    scale: 1.2,
    yOffset: 0,
    rotationOffset: Math.PI,
    preset: 'unit'
  },

  minions: {
    path: 'Minions.glb',
    scale: 0.6,
    yOffset: 2.5,  // Flying units hover
    rotationOffset: Math.PI,
    preset: 'unit'
  },

  skeleton: {
    path: 'Skeletons.glb',
    scale: 0.5,
    yOffset: 0,
    rotationOffset: Math.PI,
    preset: 'unit'
  },

  musketeer: {
    path: 'Musketeer.glb',
    scale: 0.75,
    yOffset: 0,
    rotationOffset: Math.PI,
    preset: 'unit'
  },

  bomber: {
    path: 'Bomber.glb',
    scale: 0.6,
    yOffset: 0,
    rotationOffset: Math.PI,
    preset: 'unit'
  }
};

// Tower model config
export const TOWER_MODEL_CONFIG = {
  path: 'tower.glb',
  scale: 1.0,
  yOffset: 0,
  rotationOffset: 0,
  preset: 'tower'
};

// ===================
// MODEL CACHE
// ===================

const loadedModels = new Map();
let isPreloading = false;
let preloadPromise = null;

// ===================
// PRELOAD FUNCTIONS
// ===================

/**
 * Preload all unit models for faster spawning
 * Call this during loading screen
 */
export async function preloadUnitModels(onProgress = null) {
  if (preloadPromise) {
    return preloadPromise;
  }

  isPreloading = true;
  const loader = getModelLoader();

  const configs = Object.entries(UNIT_MODEL_CONFIGS);
  const total = configs.length + 1; // +1 for tower
  let loaded = 0;

  preloadPromise = (async () => {
    // Preload unit models
    for (const [cardId, config] of configs) {
      try {
        console.log(`Preloading model: ${config.path}`);
        const gltf = await loader.loadRaw(config.path);
        loadedModels.set(cardId, gltf);
        loaded++;

        if (onProgress) {
          onProgress(loaded / total, config.path);
        }
      } catch (error) {
        console.warn(`Failed to preload ${config.path}:`, error);
        loaded++;
      }
    }

    // Preload tower model
    try {
      console.log('Preloading tower model');
      const towerGltf = await loader.loadRaw(TOWER_MODEL_CONFIG.path);
      loadedModels.set('tower', towerGltf);
      loaded++;

      if (onProgress) {
        onProgress(loaded / total, TOWER_MODEL_CONFIG.path);
      }
    } catch (error) {
      console.warn('Failed to preload tower:', error);
    }

    isPreloading = false;
    console.log(`Preloaded ${loadedModels.size} models`);
    return loadedModels;
  })();

  return preloadPromise;
}

/**
 * Check if models are preloaded
 */
export function areModelsPreloaded() {
  return loadedModels.size > 0 && !isPreloading;
}

/**
 * Get preload progress
 */
export function getPreloadProgress() {
  const total = Object.keys(UNIT_MODEL_CONFIGS).length + 1;
  return {
    loaded: loadedModels.size,
    total,
    percent: (loadedModels.size / total) * 100,
    isComplete: loadedModels.size >= total
  };
}

// ===================
// MODEL INSTANTIATION
// ===================

/**
 * Get a unit model instance for a card
 * @param {string} cardId - Card ID (knight, archer, etc.)
 * @returns {THREE.Group|null} - Cloned model group
 */
export function getUnitModel(cardId) {
  const config = UNIT_MODEL_CONFIGS[cardId];
  if (!config) {
    console.warn(`No model config for card: ${cardId}`);
    return null;
  }

  const cached = loadedModels.get(cardId);
  if (!cached) {
    console.warn(`Model not preloaded: ${cardId}`);
    return null;
  }

  // Clone the scene for this instance
  const model = cached.scene.clone();

  // Apply scale
  model.scale.setScalar(config.scale);

  // Store config in userData for later use
  model.userData.modelConfig = config;
  model.userData.cardId = cardId;

  return model;
}

/**
 * Get the tower model
 * @returns {THREE.Group|null}
 */
export function getTowerModel() {
  const cached = loadedModels.get('tower');
  if (!cached) {
    console.warn('Tower model not preloaded');
    return null;
  }

  const model = cached.scene.clone();
  model.scale.setScalar(TOWER_MODEL_CONFIG.scale);
  model.userData.modelConfig = TOWER_MODEL_CONFIG;

  return model;
}

/**
 * Get model config for a card
 */
export function getModelConfig(cardId) {
  return UNIT_MODEL_CONFIGS[cardId] || null;
}

// ===================
// ANIMATION HELPERS
// ===================

/**
 * Get animations for a loaded model
 * @param {string} cardId - Card ID
 * @returns {THREE.AnimationClip[]|null}
 */
export function getModelAnimations(cardId) {
  const cached = loadedModels.get(cardId);
  if (!cached || !cached.animations) {
    return null;
  }
  return cached.animations;
}

/**
 * Create animation mixer for a model instance
 * @param {THREE.Group} model - Model instance
 * @param {string} cardId - Card ID to get animations from
 * @returns {THREE.AnimationMixer|null}
 */
export function createAnimationMixer(model, cardId) {
  const animations = getModelAnimations(cardId);
  if (!animations || animations.length === 0) {
    return null;
  }

  const THREE = window.THREE || require('three');
  const mixer = new THREE.AnimationMixer(model);

  return {
    mixer,
    animations,
    play: (name) => {
      const clip = animations.find(a => a.name === name) || animations[0];
      if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
        return action;
      }
      return null;
    },
    update: (delta) => mixer.update(delta)
  };
}
