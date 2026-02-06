/**
 * TARGET SELECTOR - Pluggable Target Selection Strategies
 *
 * Features:
 * - Multiple built-in strategies
 * - Custom strategy support
 * - Priority overrides
 * - Line of sight checks (optional)
 * - Threat assessment
 *
 * Architecture:
 * - Strategy pattern for different selection logic
 * - Composable for complex behaviors
 */

import { UnitType } from './Unit.js';

// ===================
// BASE TARGET SELECTOR
// ===================

export class TargetSelector {
  /**
   * Select a target for a unit
   * @param {Unit} unit - The unit looking for a target
   * @param {Map<string, Unit>} allUnits - All units in game
   * @returns {Unit|null} - Selected target or null
   */
  selectTarget(unit, allUnits) {
    throw new Error('selectTarget must be implemented by subclass');
  }

  /**
   * Filter valid targets
   */
  getValidTargets(unit, allUnits) {
    const valid = [];

    for (const [id, other] of allUnits) {
      if (this._isValidTarget(unit, other)) {
        valid.push(other);
      }
    }

    return valid;
  }

  /**
   * Check if a unit is a valid target
   */
  _isValidTarget(unit, other) {
    // Skip self
    if (other.id === unit.id) return false;

    // Skip allies
    if (other.owner === unit.owner) return false;

    // Skip dead
    if (!other.isAlive()) return false;

    // Check flying/ground targeting
    if (other.isFlying && !unit.canTargetFlying) return false;
    if (!other.isFlying && !unit.canTargetGround) return false;

    return true;
  }
}

// ===================
// NEAREST TARGET SELECTOR
// ===================

export class NearestTargetSelector extends TargetSelector {
  constructor(config = {}) {
    super();
    this.maxRange = config.maxRange || Infinity;
  }

  selectTarget(unit, allUnits) {
    const targets = this.getValidTargets(unit, allUnits);

    let nearest = null;
    let nearestDist = Infinity;

    for (const target of targets) {
      const dist = unit.distanceToUnit(target);

      if (dist < nearestDist && dist <= this.maxRange) {
        nearestDist = dist;
        nearest = target;
      }
    }

    return nearest;
  }
}

// ===================
// LOWEST HP SELECTOR
// ===================

export class LowestHPSelector extends TargetSelector {
  constructor(config = {}) {
    super();
    this.maxRange = config.maxRange || Infinity;
    this.usePercentage = config.usePercentage || false;  // true = lowest %, false = lowest absolute
  }

  selectTarget(unit, allUnits) {
    const targets = this.getValidTargets(unit, allUnits)
      .filter(t => unit.distanceToUnit(t) <= this.maxRange);

    if (targets.length === 0) return null;

    return targets.reduce((best, current) => {
      const bestHP = this.usePercentage ? best.getHealthPercent() : best.health;
      const currentHP = this.usePercentage ? current.getHealthPercent() : current.health;
      return currentHP < bestHP ? current : best;
    });
  }
}

// ===================
// HIGHEST HP SELECTOR
// ===================

export class HighestHPSelector extends TargetSelector {
  constructor(config = {}) {
    super();
    this.maxRange = config.maxRange || Infinity;
  }

  selectTarget(unit, allUnits) {
    const targets = this.getValidTargets(unit, allUnits)
      .filter(t => unit.distanceToUnit(t) <= this.maxRange);

    if (targets.length === 0) return null;

    return targets.reduce((best, current) => {
      return current.health > best.health ? current : best;
    });
  }
}

// ===================
// PRIORITY TARGET SELECTOR
// ===================

/**
 * Selects targets based on priority list
 * e.g., ['spell_caster', 'ranged', 'melee', 'building']
 */
export class PriorityTargetSelector extends TargetSelector {
  constructor(config = {}) {
    super();
    this.maxRange = config.maxRange || Infinity;
    this.priorities = config.priorities || ['unit', 'building'];
    this.fallbackToNearest = config.fallbackToNearest !== false;
  }

  selectTarget(unit, allUnits) {
    const targets = this.getValidTargets(unit, allUnits)
      .filter(t => unit.distanceToUnit(t) <= this.maxRange);

    if (targets.length === 0) return null;

    // Try each priority in order
    for (const priority of this.priorities) {
      const matching = targets.filter(t => this._matchesPriority(t, priority));

      if (matching.length > 0) {
        // Return nearest matching priority
        return matching.reduce((best, current) => {
          const bestDist = unit.distanceToUnit(best);
          const currentDist = unit.distanceToUnit(current);
          return currentDist < bestDist ? current : best;
        });
      }
    }

    // Fallback to nearest
    if (this.fallbackToNearest && targets.length > 0) {
      return targets.reduce((best, current) => {
        const bestDist = unit.distanceToUnit(best);
        const currentDist = unit.distanceToUnit(current);
        return currentDist < bestDist ? current : best;
      });
    }

    return null;
  }

  _matchesPriority(target, priority) {
    switch (priority) {
      case 'building':
        return target.isBuilding;
      case 'unit':
        return !target.isBuilding;
      case 'flying':
        return target.isFlying;
      case 'ground':
        return !target.isFlying;
      case 'melee':
        return target.unitType === UnitType.MELEE;
      case 'ranged':
        return target.unitType === UnitType.RANGED;
      default:
        // Match by cardId
        return target.cardId === priority;
    }
  }
}

// ===================
// THREAT BASED SELECTOR
// ===================

/**
 * Selects targets based on threat assessment
 * Considers DPS, range, and distance
 */
export class ThreatBasedSelector extends TargetSelector {
  constructor(config = {}) {
    super();
    this.maxRange = config.maxRange || Infinity;
    this.dpsWeight = config.dpsWeight || 1.0;
    this.rangeWeight = config.rangeWeight || 0.5;
    this.distanceWeight = config.distanceWeight || 0.3;
    this.healthWeight = config.healthWeight || 0.2;
  }

  selectTarget(unit, allUnits) {
    const targets = this.getValidTargets(unit, allUnits)
      .filter(t => unit.distanceToUnit(t) <= this.maxRange);

    if (targets.length === 0) return null;

    let highestThreat = null;
    let highestScore = -Infinity;

    for (const target of targets) {
      const score = this._calculateThreatScore(unit, target);

      if (score > highestScore) {
        highestScore = score;
        highestThreat = target;
      }
    }

    return highestThreat;
  }

  _calculateThreatScore(unit, target) {
    // DPS threat (damage per second)
    const dps = target.damage * target.attackSpeed;

    // Range threat (can it hit us?)
    const rangeThreat = target.range >= unit.distanceToUnit(target) ? 1 : 0;

    // Distance threat (closer = more threatening)
    const distance = unit.distanceToUnit(target);
    const distanceThreat = 1 / (1 + distance * 0.1);

    // Health threat (low health = easier kill)
    const healthThreat = 1 - target.getHealthPercent();

    return (
      dps * this.dpsWeight +
      rangeThreat * this.rangeWeight +
      distanceThreat * this.distanceWeight +
      healthThreat * this.healthWeight
    );
  }
}

// ===================
// COMPOSITE SELECTOR
// ===================

/**
 * Combines multiple selectors with weights
 * Uses voting system for final decision
 */
export class CompositeSelector extends TargetSelector {
  constructor() {
    super();
    this.selectors = [];  // { selector, weight }
  }

  addSelector(selector, weight = 1.0) {
    this.selectors.push({ selector, weight });
    return this;
  }

  selectTarget(unit, allUnits) {
    const targets = this.getValidTargets(unit, allUnits);

    if (targets.length === 0) return null;
    if (this.selectors.length === 0) return targets[0];

    // Score each target
    const scores = new Map();
    targets.forEach(t => scores.set(t.id, 0));

    for (const { selector, weight } of this.selectors) {
      const selected = selector.selectTarget(unit, allUnits);

      if (selected) {
        const currentScore = scores.get(selected.id) || 0;
        scores.set(selected.id, currentScore + weight);
      }
    }

    // Find highest scored target
    let best = null;
    let bestScore = -Infinity;

    for (const [id, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        best = targets.find(t => t.id === id);
      }
    }

    return best;
  }
}

// ===================
// LINE OF SIGHT SELECTOR
// ===================

/**
 * Wraps another selector with line of sight checks
 */
export class LineOfSightSelector extends TargetSelector {
  constructor(innerSelector, losChecker) {
    super();
    this.innerSelector = innerSelector;
    this.losChecker = losChecker;  // (from, to) => boolean
  }

  selectTarget(unit, allUnits) {
    // Get filtered targets with LOS
    const validTargets = new Map();

    for (const [id, other] of allUnits) {
      if (this._isValidTarget(unit, other)) {
        if (this.losChecker(unit, other)) {
          validTargets.set(id, other);
        }
      }
    }

    return this.innerSelector.selectTarget(unit, validTargets);
  }
}

// ===================
// FACTORY FUNCTIONS
// ===================

/**
 * Create a target selector by name
 */
export function createTargetSelector(type, config = {}) {
  switch (type) {
    case 'nearest':
      return new NearestTargetSelector(config);

    case 'lowest_hp':
      return new LowestHPSelector(config);

    case 'highest_hp':
      return new HighestHPSelector(config);

    case 'priority':
      return new PriorityTargetSelector(config);

    case 'threat':
      return new ThreatBasedSelector(config);

    default:
      console.warn(`Unknown target selector type: ${type}, using nearest`);
      return new NearestTargetSelector(config);
  }
}

/**
 * Create a composite selector from multiple types
 */
export function createCompositeSelector(configs) {
  const composite = new CompositeSelector();

  for (const { type, weight, ...config } of configs) {
    const selector = createTargetSelector(type, config);
    composite.addSelector(selector, weight);
  }

  return composite;
}
