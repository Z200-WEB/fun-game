/**
 * MODEL LOADER - Centralized Asset Loading System
 *
 * Features:
 * - GLTF/GLB loading with Three.js GLTFLoader
 * - Draco compression support
 * - Caching (prevents duplicate loads)
 * - Progress tracking
 * - Preloading for performance
 * - Error handling
 *
 * Usage:
 *   const loader = new ModelLoader();
 *   const gltf = await loader.load('/models/tower.glb');
 *   const model = new GameModel(gltf.scene, { targetHeight: 5 });
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GameModel } from './GameModel.js';

// Singleton cache
const modelCache = new Map();
const loadingPromises = new Map();

export class ModelLoader {
  constructor(options = {}) {
    // GLTF Loader
    this.gltfLoader = new GLTFLoader();

    // Draco decoder (for compressed models)
    if (options.useDraco !== false) {
      const dracoLoader = new DRACOLoader();
      // Use CDN for Draco decoder (or provide local path)
      dracoLoader.setDecoderPath(
        options.dracoPath || 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
      );
      dracoLoader.setDecoderConfig({ type: 'js' });
      this.gltfLoader.setDRACOLoader(dracoLoader);
    }

    // Loading manager for progress
    this.loadingManager = new THREE.LoadingManager();
    this.onProgress = options.onProgress || null;
    this.onError = options.onError || null;

    // Base path for models
    this.basePath = options.basePath || '/assets/models/';
  }

  /**
   * Load a GLTF/GLB model
   * @param {string} path - Path to the model file
   * @param {Object} options - Options for GameModel wrapper
   * @returns {Promise<GameModel>} - Wrapped game model
   */
  async load(path, options = {}) {
    const fullPath = this._resolvePath(path);

    // Check cache first
    if (modelCache.has(fullPath)) {
      const cached = modelCache.get(fullPath);
      // Clone for new instance
      return new GameModel(cached.scene.clone(), options);
    }

    // Check if already loading
    if (loadingPromises.has(fullPath)) {
      const gltf = await loadingPromises.get(fullPath);
      return new GameModel(gltf.scene.clone(), options);
    }

    // Start new load
    const loadPromise = this._loadGLTF(fullPath);
    loadingPromises.set(fullPath, loadPromise);

    try {
      const gltf = await loadPromise;

      // Cache the result
      modelCache.set(fullPath, gltf);
      loadingPromises.delete(fullPath);

      // Create and return GameModel
      const gameModel = new GameModel(gltf.scene.clone(), options);

      // Setup animations if present
      if (gltf.animations && gltf.animations.length > 0) {
        gameModel.setupAnimations(gltf.animations);
      }

      return gameModel;

    } catch (error) {
      loadingPromises.delete(fullPath);
      throw error;
    }
  }

  /**
   * Load raw GLTF without GameModel wrapper
   * @param {string} path - Path to the model file
   * @returns {Promise<GLTF>} - Raw GLTF result
   */
  async loadRaw(path) {
    const fullPath = this._resolvePath(path);

    if (modelCache.has(fullPath)) {
      return modelCache.get(fullPath);
    }

    if (loadingPromises.has(fullPath)) {
      return loadingPromises.get(fullPath);
    }

    const loadPromise = this._loadGLTF(fullPath);
    loadingPromises.set(fullPath, loadPromise);

    try {
      const gltf = await loadPromise;
      modelCache.set(fullPath, gltf);
      loadingPromises.delete(fullPath);
      return gltf;
    } catch (error) {
      loadingPromises.delete(fullPath);
      throw error;
    }
  }

  /**
   * Internal GLTF loading
   */
  _loadGLTF(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          console.log(`ModelLoader: Loaded ${path}`);
          resolve(gltf);
        },
        (progress) => {
          if (this.onProgress) {
            const percent = progress.total > 0
              ? (progress.loaded / progress.total) * 100
              : 0;
            this.onProgress(path, percent);
          }
        },
        (error) => {
          console.error(`ModelLoader: Failed to load ${path}`, error);
          if (this.onError) {
            this.onError(path, error);
          }
          reject(error);
        }
      );
    });
  }

  /**
   * Resolve path with base path
   */
  _resolvePath(path) {
    if (path.startsWith('/') || path.startsWith('http')) {
      return path;
    }
    return this.basePath + path;
  }

  /**
   * Preload multiple models
   * @param {string[]} paths - Array of model paths
   * @returns {Promise<void>}
   */
  async preload(paths) {
    const promises = paths.map(path => this.loadRaw(path));
    await Promise.all(promises);
    console.log(`ModelLoader: Preloaded ${paths.length} models`);
  }

  /**
   * Check if a model is cached
   */
  isCached(path) {
    const fullPath = this._resolvePath(path);
    return modelCache.has(fullPath);
  }

  /**
   * Clear the cache
   */
  clearCache() {
    modelCache.clear();
    loadingPromises.clear();
    console.log('ModelLoader: Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      cachedModels: modelCache.size,
      pendingLoads: loadingPromises.size
    };
  }
}

// ===================
// MODEL PRESETS
// ===================

/**
 * Preset configurations for common model types
 */
export const ModelPresets = {
  // Tower preset (for game towers)
  tower: {
    targetHeight: 5,
    centerPivot: true,
    groundLevel: true,
    castShadow: true,
    receiveShadow: true,
    fixMaterials: true,
    defaultRoughness: 0.5
  },

  // Unit preset (for game characters)
  unit: {
    targetHeight: 1.2,
    centerPivot: true,
    groundLevel: true,
    castShadow: true,
    receiveShadow: false,
    fixMaterials: true,
    defaultRoughness: 0.6
  },

  // Projectile preset
  projectile: {
    targetHeight: 0.3,
    centerPivot: true,
    groundLevel: false,
    castShadow: false,
    receiveShadow: false,
    fixMaterials: true
  },

  // Environment prop
  prop: {
    centerPivot: true,
    groundLevel: true,
    castShadow: true,
    receiveShadow: true,
    fixMaterials: true,
    defaultRoughness: 0.7
  },

  // Debug (show all info)
  debug: {
    centerPivot: true,
    groundLevel: true,
    castShadow: true,
    receiveShadow: true,
    fixMaterials: true,
    showBoundingBox: true,
    logInfo: true
  }
};

// ===================
// SINGLETON INSTANCE
// ===================

let defaultLoader = null;

/**
 * Get the default loader instance (singleton)
 */
export function getModelLoader(options = {}) {
  if (!defaultLoader) {
    defaultLoader = new ModelLoader(options);
  }
  return defaultLoader;
}

// ===================
// CONVENIENCE FUNCTIONS
// ===================

/**
 * Quick load a model with preset
 * @param {string} path - Model path
 * @param {string} preset - Preset name from ModelPresets
 * @param {Object} overrides - Override specific options
 */
export async function loadModel(path, preset = 'prop', overrides = {}) {
  const loader = getModelLoader();
  const presetOptions = ModelPresets[preset] || ModelPresets.prop;
  const options = { ...presetOptions, ...overrides };
  return loader.load(path, options);
}

/**
 * Quick preload models
 */
export async function preloadModels(paths) {
  const loader = getModelLoader();
  return loader.preload(paths);
}
