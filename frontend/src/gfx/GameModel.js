/**
 * GAME MODEL - Wrapper for GLB/GLTF Models
 *
 * Solves common Sketchfab/Blender import issues:
 * - Inconsistent scale (models exported at different scales)
 * - Wrong pivot/origin (model not centered)
 * - Flat materials (missing roughness/metalness for PBR)
 * - Inconsistent shadows (some meshes don't cast/receive)
 * - Wrong rotation (Y-up vs Z-up coordinate systems)
 *
 * Usage:
 *   const tower = new GameModel(gltfScene, {
 *     targetHeight: 5,
 *     centerPivot: true,
 *     castShadow: true
 *   });
 *   scene.add(tower.root);
 */

import * as THREE from 'three';

// Default options for model normalization
const DEFAULT_OPTIONS = {
  // Scale
  targetHeight: null,       // Normalize to this height (null = keep original)
  targetWidth: null,        // Normalize to this width (null = keep original)
  uniformScale: 1.0,        // Additional uniform scale multiplier

  // Pivot / Origin
  centerPivot: true,        // Center the model horizontally (X/Z)
  groundLevel: true,        // Place model bottom at Y=0

  // Rotation (fix coordinate system issues)
  rotationY: 0,             // Y-axis rotation in degrees
  rotationX: 0,             // X-axis rotation in degrees (for Z-up models, use -90)
  rotationZ: 0,             // Z-axis rotation in degrees

  // Shadows
  castShadow: true,         // All meshes cast shadows
  receiveShadow: true,      // All meshes receive shadows

  // Materials
  fixMaterials: true,       // Apply PBR fixes to materials
  defaultRoughness: 0.5,    // Default roughness if missing
  defaultMetalness: 0.0,    // Default metalness if missing
  forceDoubleSide: false,   // Force double-sided materials

  // Debug
  showBoundingBox: false,   // Show wireframe bounding box
  logInfo: false            // Log model info to console
};

export class GameModel {
  /**
   * @param {THREE.Group} gltfScene - The scene from GLTFLoader result
   * @param {Object} options - Normalization options
   */
  constructor(gltfScene, options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create a wrapper group (this is what you add to the scene)
    this.root = new THREE.Group();
    this.root.name = 'GameModel';

    // Store original scene
    this.model = gltfScene.clone();

    // Store computed bounds
    this.boundingBox = new THREE.Box3();
    this.originalSize = new THREE.Vector3();
    this.originalCenter = new THREE.Vector3();

    // Animation mixer (if model has animations)
    this.mixer = null;
    this.animations = [];

    // Process the model
    this._computeBounds();
    this._normalizeScale();
    this._normalizePivot();
    this._normalizeRotation();
    this._fixMaterials();
    this._setupShadows();

    // Add model to root
    this.root.add(this.model);

    // Debug helpers
    if (this.options.showBoundingBox) {
      this._addBoundingBoxHelper();
    }

    if (this.options.logInfo) {
      this._logModelInfo();
    }
  }

  /**
   * Compute the bounding box of the model
   */
  _computeBounds() {
    this.boundingBox.setFromObject(this.model);
    this.boundingBox.getSize(this.originalSize);
    this.boundingBox.getCenter(this.originalCenter);
  }

  /**
   * Normalize scale to target dimensions
   */
  _normalizeScale() {
    let scaleFactor = this.options.uniformScale;

    if (this.options.targetHeight !== null) {
      // Scale based on target height
      scaleFactor = this.options.targetHeight / this.originalSize.y;
    } else if (this.options.targetWidth !== null) {
      // Scale based on target width (max of X or Z)
      const maxWidth = Math.max(this.originalSize.x, this.originalSize.z);
      scaleFactor = this.options.targetWidth / maxWidth;
    }

    // Apply uniform scale multiplier
    scaleFactor *= this.options.uniformScale;

    this.model.scale.setScalar(scaleFactor);

    // Update bounds after scaling
    this._computeBounds();
  }

  /**
   * Center the pivot point
   */
  _normalizePivot() {
    const offset = new THREE.Vector3();

    if (this.options.centerPivot) {
      // Center horizontally (X and Z)
      offset.x = -this.originalCenter.x;
      offset.z = -this.originalCenter.z;
    }

    if (this.options.groundLevel) {
      // Place bottom at Y=0
      offset.y = -this.boundingBox.min.y;
    }

    this.model.position.add(offset);

    // Update bounds after repositioning
    this._computeBounds();
  }

  /**
   * Apply rotation corrections
   */
  _normalizeRotation() {
    const { rotationX, rotationY, rotationZ } = this.options;

    if (rotationX !== 0) {
      this.model.rotation.x = THREE.MathUtils.degToRad(rotationX);
    }
    if (rotationY !== 0) {
      this.model.rotation.y = THREE.MathUtils.degToRad(rotationY);
    }
    if (rotationZ !== 0) {
      this.model.rotation.z = THREE.MathUtils.degToRad(rotationZ);
    }
  }

  /**
   * Fix materials for real-time PBR lighting
   */
  _fixMaterials() {
    if (!this.options.fixMaterials) return;

    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.forEach((mat) => {
          this._fixSingleMaterial(mat);
        });
      }
    });
  }

  /**
   * Fix a single material for PBR rendering
   */
  _fixSingleMaterial(material) {
    // Skip if not a standard material
    if (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial) {
      // Convert basic/phong materials to standard
      if (material.isMeshBasicMaterial || material.isMeshPhongMaterial) {
        // Can't convert in place, but we can adjust properties
        console.warn('GameModel: Non-PBR material detected, consider converting');
      }
      return;
    }

    // Fix roughness (Sketchfab often exports too shiny)
    if (material.roughness === undefined || material.roughness === 0) {
      material.roughness = this.options.defaultRoughness;
    }

    // Fix metalness
    if (material.metalness === undefined) {
      material.metalness = this.options.defaultMetalness;
    }

    // Ensure proper encoding for color maps
    if (material.map) {
      material.map.colorSpace = THREE.SRGBColorSpace;
    }

    // Fix emissive (often too bright from Sketchfab)
    if (material.emissive && material.emissiveIntensity > 1) {
      material.emissiveIntensity = 1;
    }

    // Force double-sided if needed
    if (this.options.forceDoubleSide) {
      material.side = THREE.DoubleSide;
    }

    // Enable fog
    material.fog = true;

    // Ensure material updates
    material.needsUpdate = true;
  }

  /**
   * Setup shadow casting/receiving for all meshes
   */
  _setupShadows() {
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = this.options.castShadow;
        child.receiveShadow = this.options.receiveShadow;

        // Ensure geometry has proper attributes for shadows
        if (child.geometry && !child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
      }
    });
  }

  /**
   * Add a wireframe bounding box helper
   */
  _addBoundingBoxHelper() {
    const helper = new THREE.Box3Helper(this.boundingBox, 0xffff00);
    this.root.add(helper);
  }

  /**
   * Log model information for debugging
   */
  _logModelInfo() {
    let meshCount = 0;
    let vertexCount = 0;
    const materials = new Set();

    this.model.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        if (child.geometry) {
          const pos = child.geometry.attributes.position;
          if (pos) vertexCount += pos.count;
        }
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => materials.add(m.type));
        }
      }
    });

    console.log('GameModel Info:', {
      meshes: meshCount,
      vertices: vertexCount,
      materials: [...materials],
      originalSize: this.originalSize.toArray().map(v => v.toFixed(2)),
      finalBounds: {
        min: this.boundingBox.min.toArray().map(v => v.toFixed(2)),
        max: this.boundingBox.max.toArray().map(v => v.toFixed(2))
      }
    });
  }

  // ===================
  // PUBLIC API
  // ===================

  /**
   * Get the root group to add to scene
   */
  getObject3D() {
    return this.root;
  }

  /**
   * Set position of the model
   */
  setPosition(x, y, z) {
    this.root.position.set(x, y, z);
    return this;
  }

  /**
   * Set rotation of the model (in degrees)
   */
  setRotation(x, y, z) {
    this.root.rotation.set(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z)
    );
    return this;
  }

  /**
   * Set scale of the model
   */
  setScale(s) {
    this.root.scale.setScalar(s);
    return this;
  }

  /**
   * Get the current height of the model
   */
  getHeight() {
    return this.boundingBox.max.y - this.boundingBox.min.y;
  }

  /**
   * Get the current width of the model
   */
  getWidth() {
    return Math.max(
      this.boundingBox.max.x - this.boundingBox.min.x,
      this.boundingBox.max.z - this.boundingBox.min.z
    );
  }

  /**
   * Find a mesh by name
   */
  getMeshByName(name) {
    let result = null;
    this.model.traverse((child) => {
      if (child.isMesh && child.name === name) {
        result = child;
      }
    });
    return result;
  }

  /**
   * Replace material on all meshes
   */
  setMaterial(material) {
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
      }
    });
    return this;
  }

  /**
   * Set color on all materials (for tinting)
   */
  setColor(color) {
    const threeColor = new THREE.Color(color);
    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (mat.color) mat.color.copy(threeColor);
        });
      }
    });
    return this;
  }

  /**
   * Set visibility
   */
  setVisible(visible) {
    this.root.visible = visible;
    return this;
  }

  /**
   * Setup animations (if model has any)
   */
  setupAnimations(animations) {
    if (!animations || animations.length === 0) return this;

    this.animations = animations;
    this.mixer = new THREE.AnimationMixer(this.model);

    return this;
  }

  /**
   * Play an animation by index or name
   */
  playAnimation(indexOrName, options = {}) {
    if (!this.mixer || this.animations.length === 0) {
      console.warn('GameModel: No animations available');
      return this;
    }

    let clip;
    if (typeof indexOrName === 'number') {
      clip = this.animations[indexOrName];
    } else {
      clip = this.animations.find(a => a.name === indexOrName);
    }

    if (clip) {
      const action = this.mixer.clipAction(clip);
      action.reset();

      if (options.loop === false) {
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
      }

      if (options.timeScale) {
        action.timeScale = options.timeScale;
      }

      action.play();
    }

    return this;
  }

  /**
   * Stop all animations
   */
  stopAnimations() {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    return this;
  }

  /**
   * Update animations (call in render loop)
   */
  update(deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }

  /**
   * Dispose of the model and free resources
   */
  dispose() {
    this.model.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(mat => {
            if (mat.map) mat.map.dispose();
            if (mat.normalMap) mat.normalMap.dispose();
            if (mat.roughnessMap) mat.roughnessMap.dispose();
            if (mat.metalnessMap) mat.metalnessMap.dispose();
            if (mat.emissiveMap) mat.emissiveMap.dispose();
            mat.dispose();
          });
        }
      }
    });

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    this.root.clear();
  }
}
