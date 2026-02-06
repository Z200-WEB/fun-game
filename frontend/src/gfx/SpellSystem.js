/**
 * SPELL SYSTEM - Timeline-Based VFX Manager
 *
 * Features:
 * - Multiple spell types (projectile, AOE, buff/debuff)
 * - Timeline-based animation phases
 * - Composite effects (particles + meshes + lights)
 * - Auto-cleanup after completion
 * - Spell pooling for performance
 *
 * Architecture:
 * - SpellSystem manages active spells
 * - SpellEffect is a single spell instance
 * - Timeline drives effect phases
 */

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ParticleEmitter, BlendMode, EmitterShape } from './ParticleEmitter.js';

// ===================
// SPELL TYPES
// ===================

export const SpellType = {
  PROJECTILE: 'projectile',
  AOE: 'aoe',
  BUFF: 'buff',
  DEBUFF: 'debuff',
  BEAM: 'beam',
  CHAIN: 'chain'
};

// ===================
// TIMELINE PHASE
// ===================

export const TimelinePhase = {
  CAST: 'cast',           // Casting animation at source
  TRAVEL: 'travel',       // Projectile moving
  IMPACT: 'impact',       // Hit target/ground
  PERSIST: 'persist',     // Lingering effect
  FADE: 'fade'            // Cleanup
};

// ===================
// SPELL EFFECT CLASS
// ===================

export class SpellEffect {
  constructor(definition, options = {}) {
    this.definition = definition;
    this.options = options;

    // Identification
    this.id = `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = definition.type || SpellType.PROJECTILE;

    // Positions
    this.source = options.source ? new THREE.Vector3().copy(options.source) : new THREE.Vector3();
    this.target = options.target ? new THREE.Vector3().copy(options.target) : new THREE.Vector3();
    this.currentPosition = this.source.clone();

    // Timeline
    this.timeline = definition.timeline || {};
    this.currentPhase = null;
    this.phaseStartTime = 0;
    this.elapsedTime = 0;
    this.totalDuration = this._calculateTotalDuration();

    // State
    this.isPlaying = false;
    this.isComplete = false;

    // Three.js container
    this.group = new THREE.Group();
    this.group.position.copy(this.source);

    // Components
    this.emitters = [];       // ParticleEmitter instances
    this.meshes = [];         // THREE.Mesh instances
    this.lights = [];         // THREE.Light instances
    this.gsapTweens = [];     // GSAP tweens for cleanup

    // Callbacks
    this.onPhaseChange = options.onPhaseChange || null;
    this.onImpact = options.onImpact || null;
    this.onComplete = options.onComplete || null;
  }

  // ===================
  // LIFECYCLE
  // ===================

  start(scene) {
    this.isPlaying = true;
    this.elapsedTime = 0;
    scene.add(this.group);

    // Start first phase
    const phases = Object.keys(this.timeline);
    if (phases.length > 0) {
      this._startPhase(phases[0]);
    }

    return this;
  }

  update(deltaTime) {
    if (!this.isPlaying || this.isComplete) return;

    this.elapsedTime += deltaTime;

    // Update current phase
    if (this.currentPhase) {
      const phaseConfig = this.timeline[this.currentPhase];
      const phaseDuration = phaseConfig?.duration || 0;
      const phaseElapsed = this.elapsedTime - this.phaseStartTime;

      // Phase-specific updates
      this._updatePhase(this.currentPhase, phaseElapsed, phaseDuration);

      // Check for phase transition
      if (phaseDuration > 0 && phaseElapsed >= phaseDuration) {
        this._nextPhase();
      }
    }

    // Update particle emitters
    for (const emitter of this.emitters) {
      emitter.update(deltaTime);
    }

    // Check completion
    if (this._isAllComplete()) {
      this._complete();
    }
  }

  stop() {
    this.isPlaying = false;
    this._cleanup();
  }

  // ===================
  // PHASE MANAGEMENT
  // ===================

  _calculateTotalDuration() {
    let total = 0;
    for (const phase in this.timeline) {
      total += this.timeline[phase]?.duration || 0;
    }
    return total;
  }

  _startPhase(phaseName) {
    this.currentPhase = phaseName;
    this.phaseStartTime = this.elapsedTime;

    const phaseConfig = this.timeline[phaseName];
    if (!phaseConfig) return;

    // Execute phase start actions
    if (phaseConfig.onStart) {
      phaseConfig.onStart(this);
    }

    // Create phase effects
    if (phaseConfig.effects) {
      for (const effectDef of phaseConfig.effects) {
        this._createEffect(effectDef);
      }
    }

    // Callback
    if (this.onPhaseChange) {
      this.onPhaseChange(phaseName, this);
    }

    // Special phase handling
    switch (phaseName) {
      case TimelinePhase.IMPACT:
        if (this.onImpact) {
          this.onImpact(this.currentPosition.clone(), this);
        }
        break;
    }
  }

  _nextPhase() {
    const phases = Object.keys(this.timeline);
    const currentIndex = phases.indexOf(this.currentPhase);

    if (currentIndex < phases.length - 1) {
      this._startPhase(phases[currentIndex + 1]);
    } else {
      // End of timeline
      this.currentPhase = null;
    }
  }

  _updatePhase(phaseName, elapsed, duration) {
    const progress = duration > 0 ? elapsed / duration : 1;
    const phaseConfig = this.timeline[phaseName];

    switch (this.type) {
      case SpellType.PROJECTILE:
        if (phaseName === TimelinePhase.TRAVEL) {
          // Move towards target
          this.currentPosition.lerpVectors(this.source, this.target, progress);
          this.group.position.copy(this.currentPosition);

          // Face direction
          const direction = new THREE.Vector3().subVectors(this.target, this.source).normalize();
          if (direction.length() > 0.01) {
            this.group.lookAt(this.target);
          }
        }
        break;

      case SpellType.AOE:
        if (phaseName === TimelinePhase.IMPACT) {
          // Expand radius
          const maxRadius = this.definition.radius || 3;
          const currentRadius = maxRadius * this._easeOutQuad(progress);

          // Scale ring effects
          this.meshes.forEach(mesh => {
            if (mesh.userData.scaleWithRadius) {
              mesh.scale.setScalar(currentRadius);
            }
          });
        }
        break;
    }

    // Update callback
    if (phaseConfig?.onUpdate) {
      phaseConfig.onUpdate(progress, this);
    }
  }

  // ===================
  // EFFECT CREATION
  // ===================

  _createEffect(effectDef) {
    switch (effectDef.type) {
      case 'particles':
        this._createParticleEffect(effectDef);
        break;

      case 'ring':
        this._createRingEffect(effectDef);
        break;

      case 'sphere':
        this._createSphereEffect(effectDef);
        break;

      case 'light':
        this._createLightEffect(effectDef);
        break;

      case 'trail':
        this._createTrailEffect(effectDef);
        break;

      case 'shockwave':
        this._createShockwaveEffect(effectDef);
        break;

      case 'glow':
        this._createGlowEffect(effectDef);
        break;
    }
  }

  _createParticleEffect(def) {
    const emitter = new ParticleEmitter({
      maxParticles: def.count || 50,
      burstCount: def.burst ? (def.count || 50) : 0,
      emissionRate: def.burst ? 0 : (def.rate || 20),
      duration: def.duration || 1,
      emitterShape: def.shape || EmitterShape.POINT,
      emitterRadius: def.radius || 0.5,
      size: def.size || { min: 0.1, max: 0.3 },
      lifetime: def.lifetime || { min: 0.5, max: 1.0 },
      speed: def.speed || { min: 1, max: 3 },
      direction: def.direction || new THREE.Vector3(0, 1, 0),
      spread: def.spread ?? 0.5,
      gravity: def.gravity || new THREE.Vector3(0, -2, 0),
      color: def.color || 0xffffff,
      colorEnd: def.colorEnd || def.color,
      opacity: def.opacity || { start: 1, end: 0 },
      scale: def.scale || { start: 1, end: 0.5 },
      blendMode: def.blendMode || BlendMode.ADDITIVE,
      onComplete: () => {
        const index = this.emitters.indexOf(emitter);
        if (index > -1) this.emitters.splice(index, 1);
      }
    });

    emitter.setPosition(
      def.offset?.x || 0,
      def.offset?.y || 0,
      def.offset?.z || 0
    );

    this.group.add(emitter.getObject3D());
    this.emitters.push(emitter);
    emitter.play();
  }

  _createRingEffect(def) {
    const innerRadius = def.innerRadius || 0.5;
    const outerRadius = def.outerRadius || 1;

    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
    const material = new THREE.MeshBasicMaterial({
      color: def.color || 0xffffff,
      transparent: true,
      opacity: def.opacity || 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;  // Lay flat
    mesh.position.set(
      def.offset?.x || 0,
      def.offset?.y || 0.05,
      def.offset?.z || 0
    );
    mesh.userData.scaleWithRadius = def.scaleWithRadius || false;

    this.group.add(mesh);
    this.meshes.push(mesh);

    // Animate
    if (def.animate) {
      const tween = gsap.to(material, {
        opacity: 0,
        duration: def.fadeTime || 1,
        ease: 'power2.out',
        onComplete: () => {
          this.group.remove(mesh);
          geometry.dispose();
          material.dispose();
        }
      });
      this.gsapTweens.push(tween);

      if (def.expand) {
        const scaleTween = gsap.to(mesh.scale, {
          x: def.expandScale || 3,
          y: def.expandScale || 3,
          z: def.expandScale || 3,
          duration: def.expandTime || 0.5,
          ease: 'power2.out'
        });
        this.gsapTweens.push(scaleTween);
      }
    }
  }

  _createSphereEffect(def) {
    const geometry = new THREE.SphereGeometry(def.radius || 0.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: def.color || 0xffffff,
      transparent: true,
      opacity: def.opacity || 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      def.offset?.x || 0,
      def.offset?.y || 0,
      def.offset?.z || 0
    );

    this.group.add(mesh);
    this.meshes.push(mesh);

    // Pulsing animation
    if (def.pulse) {
      const tween = gsap.to(mesh.scale, {
        x: 1.2,
        y: 1.2,
        z: 1.2,
        duration: 0.3,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut'
      });
      this.gsapTweens.push(tween);
    }

    // Fade out
    if (def.fadeTime) {
      const tween = gsap.to(material, {
        opacity: 0,
        duration: def.fadeTime,
        delay: def.fadeDelay || 0,
        ease: 'power2.out',
        onComplete: () => {
          this.group.remove(mesh);
          geometry.dispose();
          material.dispose();
        }
      });
      this.gsapTweens.push(tween);
    }
  }

  _createLightEffect(def) {
    const light = new THREE.PointLight(
      def.color || 0xffffff,
      def.intensity || 2,
      def.distance || 10
    );

    light.position.set(
      def.offset?.x || 0,
      def.offset?.y || 1,
      def.offset?.z || 0
    );

    this.group.add(light);
    this.lights.push(light);

    // Animate intensity
    if (def.flicker) {
      const tween = gsap.to(light, {
        intensity: def.intensity * 0.5,
        duration: 0.1,
        yoyo: true,
        repeat: -1,
        ease: 'none'
      });
      this.gsapTweens.push(tween);
    }

    // Fade out
    if (def.fadeTime) {
      const tween = gsap.to(light, {
        intensity: 0,
        duration: def.fadeTime,
        delay: def.fadeDelay || 0,
        ease: 'power2.out'
      });
      this.gsapTweens.push(tween);
    }
  }

  _createShockwaveEffect(def) {
    // Expanding ring with thickness
    const geometry = new THREE.TorusGeometry(
      def.radius || 1,
      def.thickness || 0.1,
      8,
      32
    );
    const material = new THREE.MeshBasicMaterial({
      color: def.color || 0xffffff,
      transparent: true,
      opacity: def.opacity || 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(0.1);

    this.group.add(mesh);
    this.meshes.push(mesh);

    // Expand and fade
    const expandTween = gsap.to(mesh.scale, {
      x: def.maxScale || 5,
      y: def.maxScale || 5,
      z: def.maxScale || 5,
      duration: def.duration || 0.5,
      ease: 'power2.out'
    });

    const fadeTween = gsap.to(material, {
      opacity: 0,
      duration: def.duration || 0.5,
      ease: 'power2.out',
      onComplete: () => {
        this.group.remove(mesh);
        geometry.dispose();
        material.dispose();
      }
    });

    this.gsapTweens.push(expandTween, fadeTween);
  }

  _createGlowEffect(def) {
    // Sprite-based glow
    const spriteMaterial = new THREE.SpriteMaterial({
      color: def.color || 0xffffff,
      transparent: true,
      opacity: def.opacity || 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.setScalar(def.size || 2);
    sprite.position.set(
      def.offset?.x || 0,
      def.offset?.y || 0,
      def.offset?.z || 0
    );

    this.group.add(sprite);
    this.meshes.push(sprite);

    // Pulse
    if (def.pulse) {
      const tween = gsap.to(sprite.scale, {
        x: (def.size || 2) * 1.3,
        y: (def.size || 2) * 1.3,
        duration: 0.5,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut'
      });
      this.gsapTweens.push(tween);
    }
  }

  _createTrailEffect(def) {
    // Trail is a ribbon of connected quads
    // For simplicity, using particle trail
    this._createParticleEffect({
      ...def,
      type: 'particles',
      shape: EmitterShape.POINT,
      burst: false,
      rate: def.rate || 30,
      spread: 0,
      gravity: new THREE.Vector3(0, 0, 0),
      lifetime: { min: 0.2, max: 0.4 }
    });
  }

  // ===================
  // COMPLETION
  // ===================

  _isAllComplete() {
    if (this.currentPhase !== null) return false;
    if (this.emitters.some(e => !e.isComplete())) return false;
    return true;
  }

  _complete() {
    this.isComplete = true;
    this.isPlaying = false;

    if (this.onComplete) {
      this.onComplete(this);
    }
  }

  _cleanup() {
    // Kill GSAP tweens
    this.gsapTweens.forEach(tween => tween.kill());
    this.gsapTweens = [];

    // Dispose emitters
    this.emitters.forEach(emitter => emitter.dispose());
    this.emitters = [];

    // Dispose meshes
    this.meshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      this.group.remove(mesh);
    });
    this.meshes = [];

    // Remove lights
    this.lights.forEach(light => this.group.remove(light));
    this.lights = [];

    // Remove from scene
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }

  // ===================
  // UTILITIES
  // ===================

  _easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  getPosition() {
    return this.currentPosition.clone();
  }

  dispose() {
    this.stop();
    this._cleanup();
  }
}

// ===================
// SPELL SYSTEM CLASS
// ===================

export class SpellSystem {
  constructor(scene) {
    this.scene = scene;
    this.activeSpells = new Map();  // id -> SpellEffect
    this.spellDefinitions = new Map();  // name -> definition
  }

  /**
   * Register a spell definition
   */
  registerSpell(name, definition) {
    this.spellDefinitions.set(name, definition);
    return this;
  }

  /**
   * Cast a spell
   */
  cast(spellName, options = {}) {
    const definition = this.spellDefinitions.get(spellName);
    if (!definition) {
      console.warn(`SpellSystem: Unknown spell "${spellName}"`);
      return null;
    }

    const effect = new SpellEffect(definition, {
      ...options,
      onComplete: (spell) => {
        this.activeSpells.delete(spell.id);
        spell.dispose();
        if (options.onComplete) options.onComplete(spell);
      }
    });

    this.activeSpells.set(effect.id, effect);
    effect.start(this.scene);

    return effect;
  }

  /**
   * Cast spell at position
   */
  castAt(spellName, position, options = {}) {
    return this.cast(spellName, {
      ...options,
      source: position,
      target: position
    });
  }

  /**
   * Cast projectile spell
   */
  castProjectile(spellName, source, target, options = {}) {
    return this.cast(spellName, {
      ...options,
      source,
      target
    });
  }

  /**
   * Update all active spells
   */
  update(deltaTime) {
    for (const [id, spell] of this.activeSpells) {
      spell.update(deltaTime);
    }
  }

  /**
   * Cancel a specific spell
   */
  cancel(spellId) {
    const spell = this.activeSpells.get(spellId);
    if (spell) {
      spell.stop();
      this.activeSpells.delete(spellId);
      spell.dispose();
    }
  }

  /**
   * Cancel all active spells
   */
  cancelAll() {
    for (const [id, spell] of this.activeSpells) {
      spell.stop();
      spell.dispose();
    }
    this.activeSpells.clear();
  }

  /**
   * Get active spell count
   */
  getActiveCount() {
    return this.activeSpells.size;
  }

  /**
   * Dispose system
   */
  dispose() {
    this.cancelAll();
    this.spellDefinitions.clear();
  }
}
