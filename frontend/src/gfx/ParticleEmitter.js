/**
 * PARTICLE EMITTER - GPU-Optimized Particle System
 *
 * Features:
 * - Instanced rendering for performance
 * - Multiple blend modes (additive, normal, multiply)
 * - Particle behaviors (gravity, velocity, fade, scale)
 * - Burst and continuous emission
 * - Color over lifetime
 * - Auto-dispose when complete
 */

import * as THREE from 'three';

// ===================
// BLEND MODES
// ===================

export const BlendMode = {
  NORMAL: 'normal',
  ADDITIVE: 'additive',
  MULTIPLY: 'multiply'
};

// ===================
// PARTICLE SHAPES
// ===================

export const ParticleShape = {
  POINT: 'point',
  QUAD: 'quad',
  SPHERE: 'sphere',
  RING: 'ring'
};

// ===================
// EMITTER SHAPES
// ===================

export const EmitterShape = {
  POINT: 'point',
  SPHERE: 'sphere',
  CONE: 'cone',
  BOX: 'box',
  RING: 'ring'
};

// ===================
// DEFAULT CONFIG
// ===================

const DEFAULT_CONFIG = {
  // Emission
  maxParticles: 100,
  emissionRate: 10,           // Particles per second (0 = burst mode)
  burstCount: 0,              // Particles per burst (0 = continuous)
  duration: 1.0,              // Emitter lifetime (-1 = infinite)
  loop: false,

  // Emitter shape
  emitterShape: EmitterShape.POINT,
  emitterRadius: 1.0,
  emitterAngle: 45,           // Cone angle in degrees

  // Particle properties
  particleShape: ParticleShape.QUAD,
  size: { min: 0.1, max: 0.3 },
  lifetime: { min: 0.5, max: 1.5 },

  // Initial velocity
  speed: { min: 1, max: 3 },
  direction: new THREE.Vector3(0, 1, 0),
  spread: 0.5,                // 0 = focused, 1 = sphere

  // Physics
  gravity: new THREE.Vector3(0, -2, 0),
  drag: 0.1,

  // Appearance
  color: 0xffffff,
  colorEnd: null,             // null = same as start
  opacity: { start: 1.0, end: 0.0 },
  scale: { start: 1.0, end: 0.5 },

  // Blending
  blendMode: BlendMode.ADDITIVE,
  depthWrite: false,
  transparent: true,

  // Texture
  texture: null,              // THREE.Texture

  // Callbacks
  onComplete: null
};

// ===================
// PARTICLE CLASS
// ===================

class Particle {
  constructor() {
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.color = new THREE.Color();
    this.colorEnd = new THREE.Color();
    this.size = 1;
    this.sizeEnd = 0.5;
    this.opacity = 1;
    this.opacityEnd = 0;
    this.lifetime = 1;
    this.age = 0;
    this.alive = false;
    this.rotation = 0;
    this.rotationSpeed = 0;
  }

  reset() {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.age = 0;
    this.alive = false;
  }
}

// ===================
// PARTICLE EMITTER CLASS
// ===================

export class ParticleEmitter {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Particle pool
    this.particles = [];
    this.activeCount = 0;

    // State
    this.isPlaying = false;
    this.isPaused = false;
    this.elapsedTime = 0;
    this.emissionAccumulator = 0;

    // Three.js objects
    this.group = new THREE.Group();
    this.geometry = null;
    this.material = null;
    this.mesh = null;

    // Initialize
    this._initParticlePool();
    this._createGeometry();
    this._createMaterial();
    this._createMesh();
  }

  // ===================
  // INITIALIZATION
  // ===================

  _initParticlePool() {
    for (let i = 0; i < this.config.maxParticles; i++) {
      this.particles.push(new Particle());
    }
  }

  _createGeometry() {
    const count = this.config.maxParticles;

    // Use InstancedBufferGeometry for performance
    this.geometry = new THREE.InstancedBufferGeometry();

    // Base quad geometry
    const baseGeo = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = baseGeo.index;
    this.geometry.attributes.position = baseGeo.attributes.position;
    this.geometry.attributes.uv = baseGeo.attributes.uv;

    // Instance attributes
    const offsets = new Float32Array(count * 3);
    const colors = new Float32Array(count * 4);  // RGBA
    const sizes = new Float32Array(count);
    const rotations = new Float32Array(count);

    this.geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
    this.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 4));
    this.geometry.setAttribute('size', new THREE.InstancedBufferAttribute(sizes, 1));
    this.geometry.setAttribute('rotation', new THREE.InstancedBufferAttribute(rotations, 1));
  }

  _createMaterial() {
    const { blendMode, depthWrite, transparent, texture } = this.config;

    // Determine blending
    let blending = THREE.NormalBlending;
    if (blendMode === BlendMode.ADDITIVE) {
      blending = THREE.AdditiveBlending;
    } else if (blendMode === BlendMode.MULTIPLY) {
      blending = THREE.MultiplyBlending;
    }

    // Custom shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uUseTexture: { value: texture ? 1.0 : 0.0 }
      },
      vertexShader: `
        attribute vec3 offset;
        attribute vec4 color;
        attribute float size;
        attribute float rotation;

        varying vec4 vColor;
        varying vec2 vUv;

        void main() {
          vColor = color;
          vUv = uv;

          // Rotate quad
          float c = cos(rotation);
          float s = sin(rotation);
          vec3 rotatedPosition = vec3(
            position.x * c - position.y * s,
            position.x * s + position.y * c,
            position.z
          );

          // Billboard - face camera
          vec4 mvPosition = modelViewMatrix * vec4(offset, 1.0);
          mvPosition.xyz += rotatedPosition * size;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uUseTexture;

        varying vec4 vColor;
        varying vec2 vUv;

        void main() {
          vec4 texColor = mix(
            vec4(1.0),
            texture2D(uTexture, vUv),
            uUseTexture
          );

          // Soft circle falloff for non-textured
          float dist = length(vUv - 0.5) * 2.0;
          float alpha = 1.0 - smoothstep(0.0, 1.0, dist);

          vec4 finalColor = vColor * texColor;
          finalColor.a *= mix(alpha, texColor.a, uUseTexture);

          if (finalColor.a < 0.01) discard;

          gl_FragColor = finalColor;
        }
      `,
      blending,
      depthWrite,
      transparent,
      side: THREE.DoubleSide
    });
  }

  _createMesh() {
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;  // Particles can spread
    this.group.add(this.mesh);
  }

  // ===================
  // EMISSION
  // ===================

  _emit(count = 1) {
    for (let i = 0; i < count; i++) {
      const particle = this._getInactiveParticle();
      if (!particle) return;  // Pool exhausted

      this._initParticle(particle);
    }
  }

  _getInactiveParticle() {
    for (const particle of this.particles) {
      if (!particle.alive) {
        return particle;
      }
    }
    return null;
  }

  _initParticle(particle) {
    const config = this.config;

    particle.alive = true;
    particle.age = 0;

    // Lifetime
    particle.lifetime = this._randomRange(config.lifetime.min, config.lifetime.max);

    // Position based on emitter shape
    this._setEmitterPosition(particle);

    // Velocity
    const speed = this._randomRange(config.speed.min, config.speed.max);
    const direction = this._getEmissionDirection();
    particle.velocity.copy(direction).multiplyScalar(speed);

    // Size
    particle.size = this._randomRange(config.size.min, config.size.max);
    particle.sizeEnd = particle.size * config.scale.end;
    particle.size *= config.scale.start;

    // Color
    particle.color.set(config.color);
    particle.colorEnd.set(config.colorEnd || config.color);

    // Opacity
    particle.opacity = config.opacity.start;
    particle.opacityEnd = config.opacity.end;

    // Rotation
    particle.rotation = Math.random() * Math.PI * 2;
    particle.rotationSpeed = (Math.random() - 0.5) * 2;

    this.activeCount++;
  }

  _setEmitterPosition(particle) {
    const { emitterShape, emitterRadius } = this.config;
    const pos = particle.position;

    switch (emitterShape) {
      case EmitterShape.POINT:
        pos.set(0, 0, 0);
        break;

      case EmitterShape.SPHERE:
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.cbrt(Math.random()) * emitterRadius;  // Uniform volume
        pos.set(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        );
        break;

      case EmitterShape.RING:
        const angle = Math.random() * Math.PI * 2;
        pos.set(
          Math.cos(angle) * emitterRadius,
          0,
          Math.sin(angle) * emitterRadius
        );
        break;

      case EmitterShape.BOX:
        pos.set(
          (Math.random() - 0.5) * emitterRadius * 2,
          (Math.random() - 0.5) * emitterRadius * 2,
          (Math.random() - 0.5) * emitterRadius * 2
        );
        break;

      case EmitterShape.CONE:
        // Position at base, velocity determines cone spread
        pos.set(0, 0, 0);
        break;
    }

    // Apply group position
    pos.add(this.group.position);
  }

  _getEmissionDirection() {
    const { direction, spread, emitterShape, emitterAngle } = this.config;
    const dir = new THREE.Vector3();

    if (emitterShape === EmitterShape.CONE) {
      // Cone emission
      const angleRad = (emitterAngle * Math.PI) / 180;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * angleRad;

      dir.set(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      );
    } else if (spread >= 1) {
      // Full sphere
      dir.set(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
    } else if (spread <= 0) {
      // Exact direction
      dir.copy(direction).normalize();
    } else {
      // Mix of direction and random
      dir.copy(direction).normalize();
      const random = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      dir.lerp(random, spread);
      dir.normalize();
    }

    return dir;
  }

  // ===================
  // UPDATE
  // ===================

  update(deltaTime) {
    if (!this.isPlaying || this.isPaused) return;

    this.elapsedTime += deltaTime;

    // Check duration
    if (this.config.duration > 0 && this.elapsedTime >= this.config.duration) {
      if (this.config.loop) {
        this.elapsedTime = 0;
      } else {
        this.stop();
      }
    }

    // Emission
    if (this.isPlaying && this.config.emissionRate > 0) {
      this.emissionAccumulator += deltaTime * this.config.emissionRate;

      while (this.emissionAccumulator >= 1) {
        this._emit(1);
        this.emissionAccumulator -= 1;
      }
    }

    // Update particles
    this._updateParticles(deltaTime);

    // Check completion
    if (!this.isPlaying && this.activeCount === 0) {
      if (this.config.onComplete) {
        this.config.onComplete(this);
      }
    }
  }

  _updateParticles(deltaTime) {
    const { gravity, drag } = this.config;

    const offsets = this.geometry.attributes.offset.array;
    const colors = this.geometry.attributes.color.array;
    const sizes = this.geometry.attributes.size.array;
    const rotations = this.geometry.attributes.rotation.array;

    let index = 0;
    this.activeCount = 0;

    for (const particle of this.particles) {
      if (!particle.alive) {
        // Hide inactive particles
        sizes[index] = 0;
        index++;
        continue;
      }

      // Age
      particle.age += deltaTime;
      const t = particle.age / particle.lifetime;

      if (t >= 1) {
        particle.alive = false;
        sizes[index] = 0;
        index++;
        continue;
      }

      this.activeCount++;

      // Physics
      particle.velocity.add(gravity.clone().multiplyScalar(deltaTime));
      particle.velocity.multiplyScalar(1 - drag * deltaTime);
      particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

      // Rotation
      particle.rotation += particle.rotationSpeed * deltaTime;

      // Interpolate properties
      const currentSize = THREE.MathUtils.lerp(particle.size, particle.sizeEnd, t);
      const currentOpacity = THREE.MathUtils.lerp(particle.opacity, particle.opacityEnd, t);

      const currentColor = new THREE.Color();
      currentColor.lerpColors(particle.color, particle.colorEnd, t);

      // Update buffers
      offsets[index * 3] = particle.position.x;
      offsets[index * 3 + 1] = particle.position.y;
      offsets[index * 3 + 2] = particle.position.z;

      colors[index * 4] = currentColor.r;
      colors[index * 4 + 1] = currentColor.g;
      colors[index * 4 + 2] = currentColor.b;
      colors[index * 4 + 3] = currentOpacity;

      sizes[index] = currentSize;
      rotations[index] = particle.rotation;

      index++;
    }

    // Mark buffers for update
    this.geometry.attributes.offset.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.rotation.needsUpdate = true;

    // Update instance count
    this.geometry.instanceCount = this.config.maxParticles;
  }

  // ===================
  // CONTROL
  // ===================

  play() {
    this.isPlaying = true;
    this.isPaused = false;

    // Burst emission
    if (this.config.burstCount > 0) {
      this._emit(this.config.burstCount);
    }

    return this;
  }

  stop() {
    this.isPlaying = false;
    return this;
  }

  pause() {
    this.isPaused = true;
    return this;
  }

  resume() {
    this.isPaused = false;
    return this;
  }

  reset() {
    this.elapsedTime = 0;
    this.emissionAccumulator = 0;

    for (const particle of this.particles) {
      particle.reset();
    }

    this.activeCount = 0;
    return this;
  }

  burst(count) {
    this._emit(count);
    return this;
  }

  // ===================
  // POSITION
  // ===================

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
    return this;
  }

  getObject3D() {
    return this.group;
  }

  // ===================
  // UTILITY
  // ===================

  _randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  isComplete() {
    return !this.isPlaying && this.activeCount === 0;
  }

  // ===================
  // DISPOSE
  // ===================

  dispose() {
    this.geometry.dispose();
    this.material.dispose();

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
