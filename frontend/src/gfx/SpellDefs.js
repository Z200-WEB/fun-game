/**
 * SPELL DEFINITIONS - Pre-built Spell VFX
 *
 * Contains complete spell definitions with:
 * - Timeline phases (cast, travel, impact, persist, fade)
 * - Visual effects (particles, meshes, lights)
 * - Animation parameters
 *
 * Usage:
 *   import { SPELLS, registerAllSpells } from './SpellDefs.js';
 *   registerAllSpells(spellSystem);
 *   spellSystem.castAt('fireball', targetPosition);
 */

import * as THREE from 'three';
import { SpellType, TimelinePhase } from './SpellSystem.js';
import { BlendMode, EmitterShape } from './ParticleEmitter.js';

// ===================
// COLOR PALETTE
// ===================

const COLORS = {
  // Fire
  FIRE_CORE: 0xffff00,
  FIRE_MID: 0xff6600,
  FIRE_OUTER: 0xff3300,
  FIRE_SMOKE: 0x333333,

  // Ice
  ICE_CORE: 0xffffff,
  ICE_MID: 0x88ccff,
  ICE_OUTER: 0x4488ff,

  // Lightning
  LIGHTNING_CORE: 0xffffff,
  LIGHTNING_MID: 0xaaddff,
  LIGHTNING_OUTER: 0x4488ff,

  // Poison
  POISON_CORE: 0x88ff88,
  POISON_MID: 0x44aa44,
  POISON_OUTER: 0x226622,

  // Heal
  HEAL_CORE: 0xffffff,
  HEAL_MID: 0x88ff88,
  HEAL_OUTER: 0x44cc44,

  // Dark
  DARK_CORE: 0x8844aa,
  DARK_MID: 0x662288,
  DARK_OUTER: 0x441166,

  // Holy
  HOLY_CORE: 0xffffcc,
  HOLY_MID: 0xffdd88,
  HOLY_OUTER: 0xffaa44
};

// ===================
// FIREBALL SPELL
// ===================

export const FIREBALL = {
  name: 'fireball',
  type: SpellType.PROJECTILE,
  radius: 2.5,

  timeline: {
    // Phase 1: Cast animation at source
    [TimelinePhase.CAST]: {
      duration: 0.2,
      effects: [
        {
          type: 'particles',
          count: 20,
          burst: true,
          shape: EmitterShape.SPHERE,
          radius: 0.3,
          size: { min: 0.1, max: 0.2 },
          lifetime: { min: 0.2, max: 0.4 },
          speed: { min: 1, max: 2 },
          spread: 1,
          color: COLORS.FIRE_CORE,
          colorEnd: COLORS.FIRE_OUTER,
          gravity: new THREE.Vector3(0, 0, 0)
        },
        {
          type: 'sphere',
          radius: 0.4,
          color: COLORS.FIRE_MID,
          opacity: 0.8,
          pulse: true,
          fadeTime: 0.2
        },
        {
          type: 'light',
          color: COLORS.FIRE_MID,
          intensity: 3,
          distance: 8,
          flicker: true,
          fadeTime: 0.2
        }
      ]
    },

    // Phase 2: Travel to target
    [TimelinePhase.TRAVEL]: {
      duration: 0.5,  // Adjusted based on distance
      effects: [
        // Core fireball
        {
          type: 'sphere',
          radius: 0.5,
          color: COLORS.FIRE_CORE,
          opacity: 0.9
        },
        // Outer glow
        {
          type: 'glow',
          size: 1.5,
          color: COLORS.FIRE_MID,
          opacity: 0.6,
          pulse: true
        },
        // Trail particles
        {
          type: 'particles',
          count: 100,
          rate: 50,
          shape: EmitterShape.POINT,
          size: { min: 0.1, max: 0.3 },
          lifetime: { min: 0.2, max: 0.5 },
          speed: { min: 0.5, max: 1 },
          direction: new THREE.Vector3(0, 0, -1),
          spread: 0.3,
          color: COLORS.FIRE_MID,
          colorEnd: COLORS.FIRE_SMOKE,
          gravity: new THREE.Vector3(0, 1, 0),
          opacity: { start: 1, end: 0 }
        },
        // Light
        {
          type: 'light',
          color: COLORS.FIRE_MID,
          intensity: 5,
          distance: 15,
          flicker: true
        }
      ]
    },

    // Phase 3: Impact explosion
    [TimelinePhase.IMPACT]: {
      duration: 0.8,
      effects: [
        // Explosion burst
        {
          type: 'particles',
          count: 60,
          burst: true,
          shape: EmitterShape.SPHERE,
          radius: 0.5,
          size: { min: 0.3, max: 0.8 },
          lifetime: { min: 0.4, max: 0.8 },
          speed: { min: 3, max: 8 },
          spread: 1,
          color: COLORS.FIRE_CORE,
          colorEnd: COLORS.FIRE_OUTER,
          gravity: new THREE.Vector3(0, -5, 0),
          opacity: { start: 1, end: 0 }
        },
        // Smoke
        {
          type: 'particles',
          count: 30,
          burst: true,
          shape: EmitterShape.SPHERE,
          radius: 1,
          size: { min: 0.5, max: 1.5 },
          lifetime: { min: 0.8, max: 1.5 },
          speed: { min: 1, max: 3 },
          spread: 1,
          color: COLORS.FIRE_SMOKE,
          colorEnd: 0x111111,
          gravity: new THREE.Vector3(0, 2, 0),
          opacity: { start: 0.6, end: 0 },
          blendMode: BlendMode.NORMAL
        },
        // Shockwave
        {
          type: 'shockwave',
          color: COLORS.FIRE_MID,
          opacity: 0.5,
          maxScale: 4,
          duration: 0.4
        },
        // Ground ring
        {
          type: 'ring',
          innerRadius: 0.1,
          outerRadius: 0.5,
          color: COLORS.FIRE_OUTER,
          opacity: 0.8,
          animate: true,
          expand: true,
          expandScale: 3,
          expandTime: 0.5,
          fadeTime: 0.8
        },
        // Flash light
        {
          type: 'light',
          color: COLORS.FIRE_CORE,
          intensity: 10,
          distance: 20,
          fadeTime: 0.5
        }
      ]
    },

    // Phase 4: Lingering flames
    [TimelinePhase.PERSIST]: {
      duration: 1.0,
      effects: [
        {
          type: 'particles',
          count: 50,
          rate: 30,
          shape: EmitterShape.RING,
          radius: 1.5,
          size: { min: 0.1, max: 0.3 },
          lifetime: { min: 0.3, max: 0.6 },
          speed: { min: 1, max: 2 },
          direction: new THREE.Vector3(0, 1, 0),
          spread: 0.2,
          color: COLORS.FIRE_MID,
          colorEnd: COLORS.FIRE_SMOKE,
          gravity: new THREE.Vector3(0, 0, 0)
        }
      ]
    }
  }
};

// ===================
// AOE FREEZE SPELL
// ===================

export const FREEZE_ZONE = {
  name: 'freeze_zone',
  type: SpellType.AOE,
  radius: 3,

  timeline: {
    [TimelinePhase.CAST]: {
      duration: 0.3,
      effects: [
        // Ice crystals forming
        {
          type: 'particles',
          count: 30,
          burst: true,
          shape: EmitterShape.RING,
          radius: 1,
          size: { min: 0.1, max: 0.2 },
          lifetime: { min: 0.3, max: 0.5 },
          speed: { min: 2, max: 4 },
          direction: new THREE.Vector3(0, 1, 0),
          spread: 0.3,
          color: COLORS.ICE_CORE,
          colorEnd: COLORS.ICE_OUTER,
          gravity: new THREE.Vector3(0, -3, 0)
        }
      ]
    },

    [TimelinePhase.IMPACT]: {
      duration: 0.5,
      effects: [
        // Expanding ice ring
        {
          type: 'ring',
          innerRadius: 0,
          outerRadius: 0.5,
          color: COLORS.ICE_MID,
          opacity: 0.7,
          scaleWithRadius: true,
          animate: true,
          fadeTime: 0.5
        },
        // Ice shards
        {
          type: 'particles',
          count: 40,
          burst: true,
          shape: EmitterShape.RING,
          radius: 0.5,
          size: { min: 0.2, max: 0.5 },
          lifetime: { min: 0.4, max: 0.8 },
          speed: { min: 5, max: 10 },
          direction: new THREE.Vector3(0, 0.5, 0),
          spread: 0.8,
          color: COLORS.ICE_CORE,
          colorEnd: COLORS.ICE_OUTER,
          gravity: new THREE.Vector3(0, -8, 0),
          opacity: { start: 1, end: 0.5 }
        },
        // Cold mist
        {
          type: 'particles',
          count: 50,
          rate: 40,
          shape: EmitterShape.SPHERE,
          radius: 2,
          size: { min: 0.5, max: 1.5 },
          lifetime: { min: 0.5, max: 1.0 },
          speed: { min: 0.5, max: 1 },
          spread: 1,
          color: COLORS.ICE_MID,
          colorEnd: COLORS.ICE_OUTER,
          gravity: new THREE.Vector3(0, 0.5, 0),
          opacity: { start: 0.4, end: 0 }
        },
        // Flash
        {
          type: 'light',
          color: COLORS.ICE_CORE,
          intensity: 5,
          distance: 15,
          fadeTime: 0.3
        }
      ]
    },

    [TimelinePhase.PERSIST]: {
      duration: 3.0,
      effects: [
        // Frozen ground indicator
        {
          type: 'ring',
          innerRadius: 2.8,
          outerRadius: 3,
          color: COLORS.ICE_MID,
          opacity: 0.5,
          animate: true,
          fadeTime: 3.0
        },
        // Floating ice particles
        {
          type: 'particles',
          count: 100,
          rate: 20,
          shape: EmitterShape.SPHERE,
          radius: 2.5,
          size: { min: 0.05, max: 0.15 },
          lifetime: { min: 1, max: 2 },
          speed: { min: 0.2, max: 0.5 },
          spread: 1,
          color: COLORS.ICE_CORE,
          colorEnd: COLORS.ICE_MID,
          gravity: new THREE.Vector3(0, 0.3, 0),
          opacity: { start: 0.8, end: 0 }
        },
        // Ambient cold light
        {
          type: 'light',
          color: COLORS.ICE_MID,
          intensity: 2,
          distance: 8,
          fadeTime: 3.0
        }
      ]
    }
  }
};

// ===================
// HEAL SPELL (BUFF)
// ===================

export const HEAL = {
  name: 'heal',
  type: SpellType.BUFF,
  radius: 1.5,

  timeline: {
    [TimelinePhase.CAST]: {
      duration: 0.5,
      effects: [
        // Healing circle
        {
          type: 'ring',
          innerRadius: 1.2,
          outerRadius: 1.5,
          color: COLORS.HEAL_MID,
          opacity: 0.8,
          animate: true,
          fadeTime: 2.0
        },
        // Rising healing particles
        {
          type: 'particles',
          count: 80,
          rate: 40,
          shape: EmitterShape.RING,
          radius: 1,
          size: { min: 0.1, max: 0.25 },
          lifetime: { min: 1, max: 2 },
          speed: { min: 1, max: 2 },
          direction: new THREE.Vector3(0, 1, 0),
          spread: 0.1,
          color: COLORS.HEAL_CORE,
          colorEnd: COLORS.HEAL_MID,
          gravity: new THREE.Vector3(0, 0, 0),
          opacity: { start: 1, end: 0 }
        },
        // Sparkles
        {
          type: 'particles',
          count: 30,
          burst: true,
          shape: EmitterShape.SPHERE,
          radius: 0.5,
          size: { min: 0.05, max: 0.1 },
          lifetime: { min: 0.5, max: 1 },
          speed: { min: 2, max: 4 },
          spread: 1,
          color: COLORS.HEAL_CORE,
          colorEnd: COLORS.HEAL_OUTER,
          gravity: new THREE.Vector3(0, 1, 0)
        },
        // Healing glow
        {
          type: 'glow',
          size: 3,
          color: COLORS.HEAL_MID,
          opacity: 0.4,
          pulse: true
        },
        // Light
        {
          type: 'light',
          color: COLORS.HEAL_MID,
          intensity: 3,
          distance: 10,
          fadeTime: 2.0
        }
      ]
    },

    [TimelinePhase.PERSIST]: {
      duration: 1.5,
      effects: [
        {
          type: 'particles',
          count: 50,
          rate: 20,
          shape: EmitterShape.RING,
          radius: 0.8,
          size: { min: 0.08, max: 0.15 },
          lifetime: { min: 0.8, max: 1.5 },
          speed: { min: 0.5, max: 1 },
          direction: new THREE.Vector3(0, 1, 0),
          spread: 0.1,
          color: COLORS.HEAL_MID,
          colorEnd: COLORS.HEAL_OUTER,
          gravity: new THREE.Vector3(0, 0, 0)
        }
      ]
    }
  }
};

// ===================
// POISON CLOUD (DEBUFF)
// ===================

export const POISON_CLOUD = {
  name: 'poison_cloud',
  type: SpellType.DEBUFF,
  radius: 3,

  timeline: {
    [TimelinePhase.CAST]: {
      duration: 0.3,
      effects: [
        {
          type: 'particles',
          count: 20,
          burst: true,
          shape: EmitterShape.POINT,
          size: { min: 0.2, max: 0.4 },
          lifetime: { min: 0.3, max: 0.5 },
          speed: { min: 3, max: 5 },
          spread: 0.8,
          color: COLORS.POISON_CORE,
          colorEnd: COLORS.POISON_OUTER
        }
      ]
    },

    [TimelinePhase.IMPACT]: {
      duration: 0.5,
      effects: [
        // Poison burst
        {
          type: 'particles',
          count: 40,
          burst: true,
          shape: EmitterShape.SPHERE,
          radius: 0.5,
          size: { min: 0.3, max: 0.8 },
          lifetime: { min: 0.5, max: 1 },
          speed: { min: 2, max: 5 },
          spread: 1,
          color: COLORS.POISON_MID,
          colorEnd: COLORS.POISON_OUTER,
          gravity: new THREE.Vector3(0, -1, 0),
          opacity: { start: 0.8, end: 0 }
        }
      ]
    },

    [TimelinePhase.PERSIST]: {
      duration: 5.0,
      effects: [
        // Poison cloud
        {
          type: 'particles',
          count: 200,
          rate: 30,
          shape: EmitterShape.SPHERE,
          radius: 2.5,
          size: { min: 0.5, max: 1.5 },
          lifetime: { min: 1, max: 2 },
          speed: { min: 0.3, max: 0.8 },
          spread: 1,
          color: COLORS.POISON_MID,
          colorEnd: COLORS.POISON_OUTER,
          gravity: new THREE.Vector3(0, 0.5, 0),
          opacity: { start: 0.5, end: 0 },
          blendMode: BlendMode.NORMAL
        },
        // Toxic bubbles
        {
          type: 'particles',
          count: 50,
          rate: 10,
          shape: EmitterShape.SPHERE,
          radius: 2,
          size: { min: 0.1, max: 0.2 },
          lifetime: { min: 0.5, max: 1 },
          speed: { min: 1, max: 2 },
          direction: new THREE.Vector3(0, 1, 0),
          spread: 0.3,
          color: COLORS.POISON_CORE,
          colorEnd: COLORS.POISON_MID,
          gravity: new THREE.Vector3(0, 0, 0)
        },
        // Danger zone ring
        {
          type: 'ring',
          innerRadius: 2.8,
          outerRadius: 3,
          color: COLORS.POISON_MID,
          opacity: 0.4,
          animate: true,
          fadeTime: 5.0
        },
        // Eerie glow
        {
          type: 'light',
          color: COLORS.POISON_MID,
          intensity: 2,
          distance: 8,
          fadeTime: 5.0
        }
      ]
    }
  }
};

// ===================
// LIGHTNING BOLT
// ===================

export const LIGHTNING_BOLT = {
  name: 'lightning_bolt',
  type: SpellType.PROJECTILE,
  radius: 1,

  timeline: {
    [TimelinePhase.CAST]: {
      duration: 0.1,
      effects: [
        {
          type: 'light',
          color: COLORS.LIGHTNING_CORE,
          intensity: 10,
          distance: 20,
          fadeTime: 0.1
        }
      ]
    },

    [TimelinePhase.TRAVEL]: {
      duration: 0.1,  // Nearly instant
      effects: [
        {
          type: 'particles',
          count: 30,
          burst: true,
          shape: EmitterShape.POINT,
          size: { min: 0.1, max: 0.2 },
          lifetime: { min: 0.1, max: 0.2 },
          speed: { min: 5, max: 10 },
          spread: 0.5,
          color: COLORS.LIGHTNING_CORE,
          colorEnd: COLORS.LIGHTNING_OUTER
        },
        {
          type: 'glow',
          size: 2,
          color: COLORS.LIGHTNING_MID,
          opacity: 0.8
        }
      ]
    },

    [TimelinePhase.IMPACT]: {
      duration: 0.5,
      effects: [
        // Electric burst
        {
          type: 'particles',
          count: 50,
          burst: true,
          shape: EmitterShape.SPHERE,
          radius: 0.3,
          size: { min: 0.1, max: 0.3 },
          lifetime: { min: 0.2, max: 0.4 },
          speed: { min: 5, max: 15 },
          spread: 1,
          color: COLORS.LIGHTNING_CORE,
          colorEnd: COLORS.LIGHTNING_OUTER,
          gravity: new THREE.Vector3(0, 0, 0)
        },
        // Flash
        {
          type: 'light',
          color: COLORS.LIGHTNING_CORE,
          intensity: 20,
          distance: 30,
          fadeTime: 0.2
        },
        // Electric ring
        {
          type: 'shockwave',
          color: COLORS.LIGHTNING_MID,
          opacity: 0.7,
          maxScale: 2,
          duration: 0.2
        }
      ]
    }
  }
};

// ===================
// SPELL REGISTRY
// ===================

export const SPELLS = {
  fireball: FIREBALL,
  freeze_zone: FREEZE_ZONE,
  heal: HEAL,
  poison_cloud: POISON_CLOUD,
  lightning_bolt: LIGHTNING_BOLT
};

/**
 * Register all spells with a SpellSystem
 */
export function registerAllSpells(spellSystem) {
  for (const [name, definition] of Object.entries(SPELLS)) {
    spellSystem.registerSpell(name, definition);
  }
  return spellSystem;
}

/**
 * Get spell by name
 */
export function getSpellDefinition(name) {
  return SPELLS[name] || null;
}
