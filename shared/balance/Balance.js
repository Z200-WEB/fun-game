/**
 * BALANCE SYSTEM - Card Game Balance Framework
 *
 * Core Concepts:
 * 1. Power Budget: Each elixir point grants ~100 power points
 * 2. Stat Weights: Different stats have different power costs
 * 3. Role Efficiency: Specialized units get bonuses, generalists get penalties
 * 4. Synergy Modifiers: Special abilities add/subtract power
 *
 * Formula:
 *   PowerScore = (HP × HP_WEIGHT) + (DPS × DPS_WEIGHT) + (Mobility × MOB_WEIGHT) + Abilities
 *   ExpectedPower = Cost × POWER_PER_ELIXIR
 *   BalanceRatio = PowerScore / ExpectedPower (target: 0.95 - 1.05)
 */

// ===================
// BALANCE CONSTANTS
// ===================

export const BALANCE_CONSTANTS = {
  // Core power budget
  POWER_PER_ELIXIR: 100,

  // Acceptable balance range (0.95 = slightly weak, 1.05 = slightly strong)
  BALANCE_MIN: 0.90,
  BALANCE_MAX: 1.10,
  BALANCE_IDEAL: 1.00,

  // Stat base values (for normalization)
  BASE_HP: 500,           // "Standard" HP for a 3-cost unit
  BASE_DPS: 50,           // "Standard" DPS for a 3-cost unit
  BASE_SPEED: 1.0,        // Normal movement speed
  BASE_RANGE: 1.0,        // Melee range
  BASE_SPLASH: 0,         // No splash by default

  // Reference unit (the "vanilla" unit all others compare to)
  REFERENCE_COST: 3,
  REFERENCE_POWER: 300    // 3 elixir × 100 power
};

// ===================
// STAT WEIGHTS
// ===================

/**
 * How much power each stat point is worth
 * These are the primary tuning knobs for balance
 */
export const STAT_WEIGHTS = {
  // Survivability
  HP: {
    weight: 0.08,           // Per HP point
    description: 'Raw health pool'
  },
  HP_REGEN: {
    weight: 5.0,            // Per HP/sec
    description: 'Health regeneration'
  },
  SHIELD: {
    weight: 0.12,           // Per shield point (worth more than HP)
    description: 'Regenerating shield'
  },

  // Damage
  DPS: {
    weight: 1.2,            // Per damage/second
    description: 'Damage per second'
  },
  BURST_DAMAGE: {
    weight: 0.15,           // Per burst damage point
    description: 'One-time damage (spells)'
  },
  SPLASH_RADIUS: {
    weight: 30,             // Per unit of radius
    description: 'Area damage radius'
  },

  // Mobility
  MOVE_SPEED: {
    weight: 50,             // Per 0.1 speed above base
    description: 'Movement speed bonus'
  },
  FLYING: {
    weight: 40,             // Flat bonus for flying
    description: 'Can fly over obstacles'
  },

  // Range
  ATTACK_RANGE: {
    weight: 15,             // Per unit of range above melee
    description: 'Attack range'
  },

  // Special
  SPAWN_COUNT: {
    weight: -15,            // Penalty per additional unit (swarm discount)
    description: 'Multiple units spawned'
  },
  ATTACK_SPEED: {
    weight: 20,             // Per 0.1 attacks/sec above 1.0
    description: 'Attack speed bonus'
  }
};

// ===================
// ROLE DEFINITIONS
// ===================

/**
 * Unit roles affect how efficiently they use their power budget
 * Specialists get bonuses, generalists get penalties
 */
export const ROLES = {
  TANK: {
    name: 'Tank',
    description: 'High HP, low damage',
    statMultipliers: {
      HP: 1.2,              // Tanks get 20% bonus HP efficiency
      DPS: 0.8              // But 20% less damage efficiency
    },
    expectedHPRatio: 0.65,   // 65% of power in HP
    expectedDPSRatio: 0.25   // 25% in damage
  },

  DPS: {
    name: 'Damage Dealer',
    description: 'High damage, low HP',
    statMultipliers: {
      HP: 0.8,
      DPS: 1.2
    },
    expectedHPRatio: 0.30,
    expectedDPSRatio: 0.55
  },

  BALANCED: {
    name: 'Balanced',
    description: 'Even stats',
    statMultipliers: {
      HP: 1.0,
      DPS: 1.0
    },
    expectedHPRatio: 0.45,
    expectedDPSRatio: 0.40
  },

  SWARM: {
    name: 'Swarm',
    description: 'Multiple weak units',
    statMultipliers: {
      HP: 0.7,              // Each unit is fragile
      DPS: 1.1,             // But combined DPS is good
      SPAWN_COUNT: 0.5      // Reduced penalty for swarm
    },
    expectedHPRatio: 0.35,
    expectedDPSRatio: 0.50
  },

  SIEGE: {
    name: 'Siege',
    description: 'Building damage specialist',
    statMultipliers: {
      HP: 0.9,
      DPS: 1.0,
      BUILDING_DAMAGE: 1.5  // Bonus vs buildings
    },
    expectedHPRatio: 0.40,
    expectedDPSRatio: 0.45
  },

  SUPPORT: {
    name: 'Support',
    description: 'Utility focused',
    statMultipliers: {
      HP: 0.9,
      DPS: 0.7,
      UTILITY: 1.5          // Abilities worth more
    },
    expectedHPRatio: 0.40,
    expectedDPSRatio: 0.20
  }
};

// ===================
// ABILITY COSTS
// ===================

/**
 * Power cost/bonus for special abilities
 * Positive = costs power, negative = grants power (as drawback)
 */
export const ABILITY_COSTS = {
  // Positive abilities (cost power)
  SPLASH_DAMAGE: 25,
  CHARGE: 20,
  STUN: 35,
  SLOW: 25,
  SHIELD_ON_DEPLOY: 30,
  DEATH_DAMAGE: 20,
  SPAWN_ON_DEATH: 15,
  HEAL_ALLIES: 40,
  BUFF_ALLIES: 35,
  SPAWN_UNITS: 50,
  INVISIBILITY: 45,
  DASH: 30,

  // Negative abilities (grant power back)
  MELEE_ONLY: -15,
  CANNOT_TARGET_AIR: -20,
  CANNOT_TARGET_BUILDINGS: -25,
  SLOW_ATTACK: -10,
  SLOW_MOVE: -15,
  FRAGILE: -20,           // Takes extra damage
  DELAYED_ATTACK: -15,    // Wind-up time
  SELF_DAMAGE: -25        // Hurts self when attacking
};

// ===================
// POWER CALCULATOR
// ===================

export class PowerCalculator {
  constructor(config = {}) {
    this.config = {
      ...BALANCE_CONSTANTS,
      ...config
    };
    this.weights = { ...STAT_WEIGHTS, ...config.weights };
    this.roles = { ...ROLES, ...config.roles };
    this.abilityCosts = { ...ABILITY_COSTS, ...config.abilityCosts };
  }

  /**
   * Calculate power score for a unit
   * @param {Object} unit - Unit definition
   * @returns {Object} - Power breakdown
   */
  calculatePower(unit) {
    const role = this.roles[unit.role] || this.roles.BALANCED;
    const breakdown = {
      unit: unit.id,
      cost: unit.elixirCost,
      expectedPower: unit.elixirCost * this.config.POWER_PER_ELIXIR,
      components: {},
      abilities: {},
      totalPower: 0,
      balanceRatio: 0,
      balanceStatus: 'UNKNOWN'
    };

    // Calculate HP power
    const hpPower = this._calculateHPPower(unit, role);
    breakdown.components.HP = hpPower;

    // Calculate DPS power
    const dpsPower = this._calculateDPSPower(unit, role);
    breakdown.components.DPS = dpsPower;

    // Calculate mobility power
    const mobilityPower = this._calculateMobilityPower(unit, role);
    breakdown.components.MOBILITY = mobilityPower;

    // Calculate range power
    const rangePower = this._calculateRangePower(unit, role);
    breakdown.components.RANGE = rangePower;

    // Calculate spawn count modifier
    if (unit.spawnCount && unit.spawnCount > 1) {
      const swarmMod = this._calculateSwarmModifier(unit, role);
      breakdown.components.SWARM = swarmMod;
    }

    // Calculate ability costs
    if (unit.abilities) {
      for (const ability of unit.abilities) {
        const abilityCost = this.abilityCosts[ability] || 0;
        breakdown.abilities[ability] = abilityCost;
      }
    }

    // Sum up total power
    breakdown.totalPower = Object.values(breakdown.components).reduce((a, b) => a + b, 0);
    breakdown.totalPower += Object.values(breakdown.abilities).reduce((a, b) => a + b, 0);

    // Calculate balance ratio
    breakdown.balanceRatio = breakdown.totalPower / breakdown.expectedPower;

    // Determine balance status
    breakdown.balanceStatus = this._getBalanceStatus(breakdown.balanceRatio);

    return breakdown;
  }

  _calculateHPPower(unit, role) {
    const baseHP = unit.health || 0;
    const multiplier = role.statMultipliers.HP || 1.0;
    const weight = this.weights.HP.weight;

    // Multiply by spawn count for swarms
    const totalHP = baseHP * (unit.spawnCount || 1);

    return totalHP * weight * multiplier;
  }

  _calculateDPSPower(unit, role) {
    const damage = unit.damage || 0;
    const attackSpeed = unit.attackSpeed || 1.0;
    const dps = damage * attackSpeed;
    const multiplier = role.statMultipliers.DPS || 1.0;
    const weight = this.weights.DPS.weight;

    // Multiply by spawn count
    const totalDPS = dps * (unit.spawnCount || 1);

    // Add splash bonus
    let splashBonus = 0;
    if (unit.splashRadius && unit.splashRadius > 0) {
      splashBonus = unit.splashRadius * this.weights.SPLASH_RADIUS.weight;
    }

    return (totalDPS * weight * multiplier) + splashBonus;
  }

  _calculateMobilityPower(unit, role) {
    let power = 0;

    // Speed bonus
    const speedDiff = (unit.moveSpeed || 1.0) - this.config.BASE_SPEED;
    if (speedDiff !== 0) {
      power += speedDiff * 10 * this.weights.MOVE_SPEED.weight;
    }

    // Flying bonus
    if (unit.isFlying) {
      power += this.weights.FLYING.weight;
    }

    return power;
  }

  _calculateRangePower(unit, role) {
    const rangeDiff = (unit.range || 1.0) - this.config.BASE_RANGE;
    if (rangeDiff <= 0) return 0;

    return rangeDiff * this.weights.ATTACK_RANGE.weight;
  }

  _calculateSwarmModifier(unit, role) {
    const count = unit.spawnCount || 1;
    if (count <= 1) return 0;

    const multiplier = role.statMultipliers.SPAWN_COUNT || 1.0;
    return (count - 1) * this.weights.SPAWN_COUNT.weight * multiplier;
  }

  _getBalanceStatus(ratio) {
    if (ratio < this.config.BALANCE_MIN) return 'UNDERPOWERED';
    if (ratio > this.config.BALANCE_MAX) return 'OVERPOWERED';
    if (ratio >= 0.98 && ratio <= 1.02) return 'PERFECT';
    if (ratio < 1.0) return 'SLIGHTLY_WEAK';
    return 'SLIGHTLY_STRONG';
  }

  /**
   * Calculate what stats a unit SHOULD have for its cost
   * @param {number} cost - Elixir cost
   * @param {string} roleName - Role name
   * @returns {Object} - Recommended stats
   */
  calculateIdealStats(cost, roleName = 'BALANCED') {
    const role = this.roles[roleName] || this.roles.BALANCED;
    const totalPower = cost * this.config.POWER_PER_ELIXIR;

    // Distribute power according to role
    const hpPower = totalPower * role.expectedHPRatio;
    const dpsPower = totalPower * role.expectedDPSRatio;
    const utilityPower = totalPower * (1 - role.expectedHPRatio - role.expectedDPSRatio);

    // Convert back to stats
    const hpMultiplier = role.statMultipliers.HP || 1.0;
    const dpsMultiplier = role.statMultipliers.DPS || 1.0;

    const idealHP = hpPower / (this.weights.HP.weight * hpMultiplier);
    const idealDPS = dpsPower / (this.weights.DPS.weight * dpsMultiplier);

    return {
      cost,
      role: roleName,
      idealHP: Math.round(idealHP),
      idealDPS: Math.round(idealDPS),
      idealDamage: Math.round(idealDPS),  // Assuming 1.0 attack speed
      utilityBudget: Math.round(utilityPower),
      breakdown: {
        hpPower,
        dpsPower,
        utilityPower
      }
    };
  }

  /**
   * Suggest stat adjustments to balance a unit
   * @param {Object} unit - Unit definition
   * @returns {Object} - Suggested changes
   */
  suggestAdjustments(unit) {
    const power = this.calculatePower(unit);
    const suggestions = [];

    if (power.balanceStatus === 'PERFECT') {
      return { unit: unit.id, status: 'BALANCED', suggestions: [] };
    }

    const diff = power.expectedPower - power.totalPower;
    const percentDiff = ((power.balanceRatio - 1) * 100).toFixed(1);

    if (power.balanceRatio > 1) {
      // Overpowered - suggest nerfs
      suggestions.push({
        type: 'NERF',
        message: `Unit is ${percentDiff}% overpowered (${Math.abs(diff).toFixed(0)} power over budget)`
      });

      // Suggest specific nerfs
      if (power.components.HP > power.components.DPS) {
        const hpReduction = Math.round(diff / this.weights.HP.weight);
        suggestions.push({
          stat: 'health',
          change: -hpReduction,
          reason: 'Reduce HP to lower survivability'
        });
      } else {
        const damageReduction = Math.round(diff / this.weights.DPS.weight);
        suggestions.push({
          stat: 'damage',
          change: -damageReduction,
          reason: 'Reduce damage to lower threat'
        });
      }
    } else {
      // Underpowered - suggest buffs
      suggestions.push({
        type: 'BUFF',
        message: `Unit is ${Math.abs(percentDiff)}% underpowered (${Math.abs(diff).toFixed(0)} power under budget)`
      });

      const role = this.roles[unit.role] || this.roles.BALANCED;

      if (role.expectedHPRatio > 0.5) {
        const hpIncrease = Math.round(Math.abs(diff) / this.weights.HP.weight);
        suggestions.push({
          stat: 'health',
          change: hpIncrease,
          reason: 'Increase HP to match tank role'
        });
      } else {
        const damageIncrease = Math.round(Math.abs(diff) / this.weights.DPS.weight);
        suggestions.push({
          stat: 'damage',
          change: damageIncrease,
          reason: 'Increase damage to match DPS role'
        });
      }
    }

    return {
      unit: unit.id,
      currentPower: power.totalPower,
      expectedPower: power.expectedPower,
      ratio: power.balanceRatio,
      status: power.balanceStatus,
      suggestions
    };
  }

  /**
   * Compare two units
   */
  compareUnits(unitA, unitB) {
    const powerA = this.calculatePower(unitA);
    const powerB = this.calculatePower(unitB);

    return {
      unitA: {
        id: unitA.id,
        cost: unitA.elixirCost,
        power: powerA.totalPower,
        ratio: powerA.balanceRatio,
        status: powerA.balanceStatus
      },
      unitB: {
        id: unitB.id,
        cost: unitB.elixirCost,
        power: powerB.totalPower,
        ratio: powerB.balanceRatio,
        status: powerB.balanceStatus
      },
      comparison: {
        powerDiff: powerA.totalPower - powerB.totalPower,
        costDiff: unitA.elixirCost - unitB.elixirCost,
        powerPerElixirA: powerA.totalPower / unitA.elixirCost,
        powerPerElixirB: powerB.totalPower / unitB.elixirCost
      }
    };
  }
}

// ===================
// DEBUG UTILITIES
// ===================

export class BalanceDebugger {
  constructor(calculator) {
    this.calculator = calculator;
  }

  /**
   * Generate a balance report for all units
   */
  generateReport(units) {
    const report = {
      timestamp: new Date().toISOString(),
      totalUnits: units.length,
      balanced: 0,
      overpowered: 0,
      underpowered: 0,
      units: []
    };

    for (const unit of units) {
      const power = this.calculator.calculatePower(unit);

      report.units.push({
        id: unit.id,
        name: unit.name,
        cost: unit.elixirCost,
        power: Math.round(power.totalPower),
        expected: power.expectedPower,
        ratio: power.balanceRatio.toFixed(3),
        status: power.balanceStatus,
        components: power.components
      });

      if (power.balanceStatus === 'PERFECT' ||
          power.balanceStatus === 'SLIGHTLY_WEAK' ||
          power.balanceStatus === 'SLIGHTLY_STRONG') {
        report.balanced++;
      } else if (power.balanceRatio > 1) {
        report.overpowered++;
      } else {
        report.underpowered++;
      }
    }

    // Sort by balance ratio (worst first)
    report.units.sort((a, b) => Math.abs(1 - b.ratio) - Math.abs(1 - a.ratio));

    return report;
  }

  /**
   * Print a formatted balance report to console
   */
  printReport(units) {
    const report = this.generateReport(units);

    console.log('\n=== BALANCE REPORT ===');
    console.log(`Generated: ${report.timestamp}`);
    console.log(`Total Units: ${report.totalUnits}`);
    console.log(`Balanced: ${report.balanced} | Overpowered: ${report.overpowered} | Underpowered: ${report.underpowered}\n`);

    console.log('Unit                 Cost  Power  Expected  Ratio   Status');
    console.log('-------------------------------------------------------------------');

    for (const unit of report.units) {
      const status = this._getStatusEmoji(unit.status);
      console.log(
        `${unit.name.padEnd(20)} ${unit.cost.toString().padStart(4)} ${unit.power.toString().padStart(6)} ` +
        `${unit.expected.toString().padStart(9)} ${unit.ratio.padStart(7)} ${status} ${unit.status}`
      );
    }

    console.log('\n');
  }

  _getStatusEmoji(status) {
    switch (status) {
      case 'PERFECT': return '✓';
      case 'SLIGHTLY_WEAK': return '↓';
      case 'SLIGHTLY_STRONG': return '↑';
      case 'UNDERPOWERED': return '⚠️';
      case 'OVERPOWERED': return '🔴';
      default: return '?';
    }
  }

  /**
   * Generate visual power bar for a unit
   */
  generatePowerBar(unit, width = 50) {
    const power = this.calculator.calculatePower(unit);
    const ratio = Math.min(1.5, Math.max(0.5, power.balanceRatio));

    // Normalize to bar width
    const normalizedPos = ((ratio - 0.5) / 1.0) * width;
    const idealPos = width / 2;

    let bar = '';
    for (let i = 0; i < width; i++) {
      if (i === Math.floor(idealPos)) {
        bar += '|';  // Ideal position marker
      } else if (i === Math.floor(normalizedPos)) {
        bar += power.balanceRatio > 1 ? '▶' : '◀';  // Current position
      } else if (i >= Math.min(idealPos, normalizedPos) && i <= Math.max(idealPos, normalizedPos)) {
        bar += power.balanceRatio > 1 ? '+' : '-';  // Difference
      } else {
        bar += '·';
      }
    }

    return {
      unit: unit.id,
      bar: `[${bar}]`,
      ratio: power.balanceRatio.toFixed(2),
      status: power.balanceStatus
    };
  }
}

// ===================
// DEFAULT INSTANCE
// ===================

let defaultCalculator = null;

export function getBalanceCalculator(config) {
  if (!defaultCalculator) {
    defaultCalculator = new PowerCalculator(config);
  }
  return defaultCalculator;
}

export function getBalanceDebugger(config) {
  return new BalanceDebugger(getBalanceCalculator(config));
}
