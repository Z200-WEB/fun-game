/**
 * BALANCE CONFIG - Tuning Parameters & Presets
 *
 * This file provides different balance configurations for:
 * - Development (relaxed balance thresholds)
 * - Production (strict balance enforcement)
 * - Tournament (extra strict)
 * - Casual (more generous)
 *
 * Also includes meta-game configurations for different play styles.
 */

import { BALANCE_CONSTANTS, STAT_WEIGHTS, ROLES, ABILITY_COSTS } from './Balance.js';

// ===================
// ENVIRONMENT CONFIGS
// ===================

/**
 * Development configuration - relaxed for testing
 */
export const DEV_CONFIG = {
  ...BALANCE_CONSTANTS,
  BALANCE_MIN: 0.80,      // Allow 20% underpowered
  BALANCE_MAX: 1.20,      // Allow 20% overpowered
  LOG_WARNINGS: true,     // Console warnings for imbalanced units
  AUTO_ADJUST: false      // Don't auto-adjust stats
};

/**
 * Production configuration - standard balance
 */
export const PROD_CONFIG = {
  ...BALANCE_CONSTANTS,
  BALANCE_MIN: 0.90,
  BALANCE_MAX: 1.10,
  LOG_WARNINGS: false,
  AUTO_ADJUST: false
};

/**
 * Tournament configuration - strict balance
 */
export const TOURNAMENT_CONFIG = {
  ...BALANCE_CONSTANTS,
  BALANCE_MIN: 0.95,
  BALANCE_MAX: 1.05,
  LOG_WARNINGS: true,
  AUTO_ADJUST: true,      // Auto-adjust to meet thresholds
  DISABLED_ABILITIES: ['INVISIBILITY']  // Abilities disabled in tournaments
};

/**
 * Casual configuration - more forgiving
 */
export const CASUAL_CONFIG = {
  ...BALANCE_CONSTANTS,
  BALANCE_MIN: 0.75,
  BALANCE_MAX: 1.25,
  POWER_PER_ELIXIR: 90,   // Slightly lower power expectation
  LOG_WARNINGS: false,
  AUTO_ADJUST: false
};

// ===================
// META CONFIGURATIONS
// ===================

/**
 * Fast-paced meta - favors aggression
 */
export const AGGRESSIVE_META = {
  weights: {
    ...STAT_WEIGHTS,
    DPS: { weight: 1.4, description: 'Increased DPS value' },
    HP: { weight: 0.06, description: 'Decreased HP value' },
    MOVE_SPEED: { weight: 70, description: 'Speed more valuable' }
  },
  roles: {
    ...ROLES,
    DPS: {
      ...ROLES.DPS,
      statMultipliers: { HP: 0.7, DPS: 1.4 }
    },
    TANK: {
      ...ROLES.TANK,
      statMultipliers: { HP: 1.0, DPS: 0.9 }  // Tanks less effective
    }
  }
};

/**
 * Defensive meta - favors survival
 */
export const DEFENSIVE_META = {
  weights: {
    ...STAT_WEIGHTS,
    HP: { weight: 0.12, description: 'Increased HP value' },
    HP_REGEN: { weight: 8.0, description: 'Regen more valuable' },
    DPS: { weight: 1.0, description: 'Standard DPS value' }
  },
  roles: {
    ...ROLES,
    TANK: {
      ...ROLES.TANK,
      statMultipliers: { HP: 1.4, DPS: 0.7 }  // Tanks very effective
    }
  }
};

/**
 * Swarm meta - favors multiple units
 */
export const SWARM_META = {
  weights: {
    ...STAT_WEIGHTS,
    SPAWN_COUNT: { weight: -5, description: 'Reduced swarm penalty' }
  },
  roles: {
    ...ROLES,
    SWARM: {
      ...ROLES.SWARM,
      statMultipliers: { HP: 0.9, DPS: 1.2, SPAWN_COUNT: 0.3 }
    }
  }
};

/**
 * Spell-heavy meta - spells are stronger
 */
export const SPELL_META = {
  weights: {
    ...STAT_WEIGHTS,
    BURST_DAMAGE: { weight: 0.20, description: 'Increased burst damage value' }
  },
  abilityCosts: {
    ...ABILITY_COSTS,
    SPLASH_DAMAGE: 35,    // Splash costs more
    STUN: 45              // CC costs more
  }
};

// ===================
// DIFFICULTY SCALING
// ===================

/**
 * Scale unit stats for different difficulty levels
 * Used for PvE or AI opponents
 */
export const DIFFICULTY_SCALING = {
  EASY: {
    hpMultiplier: 0.7,
    damageMultiplier: 0.7,
    speedMultiplier: 0.9,
    aiReactionDelay: 2.0
  },
  NORMAL: {
    hpMultiplier: 1.0,
    damageMultiplier: 1.0,
    speedMultiplier: 1.0,
    aiReactionDelay: 1.0
  },
  HARD: {
    hpMultiplier: 1.2,
    damageMultiplier: 1.15,
    speedMultiplier: 1.1,
    aiReactionDelay: 0.5
  },
  NIGHTMARE: {
    hpMultiplier: 1.5,
    damageMultiplier: 1.3,
    speedMultiplier: 1.2,
    aiReactionDelay: 0.2
  }
};

// ===================
// LEVEL SCALING
// ===================

/**
 * How much stats scale per level
 * Level 1 = base, each level adds percentage
 */
export const LEVEL_SCALING = {
  MIN_LEVEL: 1,
  MAX_LEVEL: 13,

  // Per-level multipliers (compound)
  HP_PER_LEVEL: 0.10,       // +10% HP per level
  DAMAGE_PER_LEVEL: 0.10,   // +10% damage per level

  /**
   * Calculate level multiplier
   * @param {number} level - Unit level (1-13)
   * @returns {Object} - HP and damage multipliers
   */
  getMultiplier(level) {
    const clampedLevel = Math.max(this.MIN_LEVEL, Math.min(this.MAX_LEVEL, level));
    const levelsAboveBase = clampedLevel - 1;

    return {
      hp: Math.pow(1 + this.HP_PER_LEVEL, levelsAboveBase),
      damage: Math.pow(1 + this.DAMAGE_PER_LEVEL, levelsAboveBase)
    };
  },

  /**
   * Apply level scaling to a unit
   * @param {Object} unit - Base unit stats
   * @param {number} level - Target level
   * @returns {Object} - Scaled unit stats
   */
  applyLevel(unit, level) {
    const mult = this.getMultiplier(level);

    return {
      ...unit,
      level,
      health: Math.round(unit.health * mult.hp),
      damage: Math.round(unit.damage * mult.damage)
    };
  }
};

// ===================
// ELIXIR ECONOMY
// ===================

export const ELIXIR_CONFIG = {
  // Generation
  BASE_REGEN_RATE: 2.8,        // Elixir per second in normal time
  DOUBLE_ELIXIR_RATE: 5.6,     // 2x during overtime
  TRIPLE_ELIXIR_RATE: 8.4,     // 3x during sudden death
  MAX_ELIXIR: 10,
  STARTING_ELIXIR: 5,

  // Timing
  NORMAL_TIME_DURATION: 120,   // 2 minutes
  OVERTIME_DURATION: 60,       // 1 minute
  SUDDEN_DEATH_DURATION: 120,  // 2 minutes (or until tower down)

  /**
   * Get elixir regen rate for game phase
   */
  getRegenRate(phase) {
    switch (phase) {
      case 'DOUBLE_ELIXIR':
      case 'OVERTIME':
        return this.DOUBLE_ELIXIR_RATE;
      case 'TRIPLE_ELIXIR':
      case 'SUDDEN_DEATH':
        return this.TRIPLE_ELIXIR_RATE;
      default:
        return this.BASE_REGEN_RATE;
    }
  }
};

// ===================
// TOWER CONFIG
// ===================

export const TOWER_CONFIG = {
  KING_TOWER: {
    health: 5000,
    damage: 100,
    attackSpeed: 1.0,
    range: 7.0,
    activationRange: 6.0  // Range to activate when dormant
  },

  PRINCESS_TOWER: {
    health: 3000,
    damage: 80,
    attackSpeed: 0.8,
    range: 7.5
  },

  // Damage bonus when king tower is activated
  KING_ACTIVATION_DAMAGE_BONUS: 0.2
};

// ===================
// GAME PHASE BALANCE
// ===================

export const PHASE_CONFIG = {
  NORMAL: {
    elixirMultiplier: 1.0,
    damageMultiplier: 1.0,
    towerDamageMultiplier: 1.0
  },
  OVERTIME: {
    elixirMultiplier: 2.0,
    damageMultiplier: 1.0,
    towerDamageMultiplier: 1.0
  },
  SUDDEN_DEATH: {
    elixirMultiplier: 3.0,
    damageMultiplier: 1.0,
    towerDamageMultiplier: 1.0
  }
};

// ===================
// EXPORT ACTIVE CONFIG
// ===================

let activeConfig = PROD_CONFIG;
let activeMeta = null;

/**
 * Set the active balance configuration
 */
export function setBalanceConfig(config) {
  activeConfig = { ...BALANCE_CONSTANTS, ...config };
}

/**
 * Set the active meta configuration
 */
export function setMetaConfig(meta) {
  activeMeta = meta;
}

/**
 * Get the current active configuration
 */
export function getActiveConfig() {
  return { ...activeConfig };
}

/**
 * Get combined configuration with meta
 */
export function getFullConfig() {
  if (!activeMeta) {
    return { ...activeConfig };
  }

  return {
    ...activeConfig,
    weights: { ...STAT_WEIGHTS, ...(activeMeta.weights || {}) },
    roles: { ...ROLES, ...(activeMeta.roles || {}) },
    abilityCosts: { ...ABILITY_COSTS, ...(activeMeta.abilityCosts || {}) }
  };
}

/**
 * Reset to default configuration
 */
export function resetConfig() {
  activeConfig = PROD_CONFIG;
  activeMeta = null;
}
