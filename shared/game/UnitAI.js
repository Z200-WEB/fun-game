/**
 * UNIT AI - Modular AI Behavior System
 *
 * Features:
 * - State machine (idle, move, attack, cooldown, dead)
 * - Pluggable target selection strategies
 * - Grid or free movement support
 * - Melee & ranged attack handling
 * - Independent update loop (fixed timestep)
 *
 * Architecture:
 * - UnitAI operates on Unit instances
 * - Does not render - only updates game state
 * - Can run on server or client
 */

import { Unit, UnitState, UnitType, TargetPriority } from './Unit.js';

// ===================
// AI CONFIGURATION
// ===================

const DEFAULT_CONFIG = {
  // Movement
  useGridMovement: false,      // Snap to grid vs free movement
  gridSize: 1.0,               // Grid cell size (if grid movement)
  smoothMovement: true,        // Interpolate between positions
  pathfindingEnabled: false,   // Use pathfinding (requires implementation)

  // Combat
  attackWindupTime: 100,       // ms before attack damage is applied
  attackRecoveryTime: 100,     // ms after attack before can move
  retargetOnKill: true,        // Find new target when current dies
  aggroRange: 15,              // Range to detect enemies

  // Behavior
  holdPosition: false,         // Don't move, only attack in range
  retreatOnLowHealth: false,   // Retreat when HP < threshold
  retreatHealthThreshold: 0.2, // 20% HP

  // Performance
  targetUpdateInterval: 200,   // ms between target searches
  pathUpdateInterval: 500      // ms between path recalculations
};

// ===================
// UNIT AI CLASS
// ===================

export class UnitAI {
  /**
   * @param {Unit} unit - The unit to control
   * @param {Object} config - AI configuration
   */
  constructor(unit, config = {}) {
    this.unit = unit;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Target selection
    this.targetSelector = null;  // Set via setTargetSelector()
    this.lastTargetSearch = 0;

    // Movement
    this.path = [];              // Waypoints for pathfinding
    this.currentWaypoint = 0;
    this.lastPathUpdate = 0;

    // Attack timing
    this.attackStartTime = 0;
    this.attackPhase = 'none';   // 'none', 'windup', 'hit', 'recovery'

    // Destination (for "move to point" commands)
    this.destination = null;

    // Callbacks
    this.onAttackHit = null;     // Called when attack lands
    this.onTargetLost = null;    // Called when target dies/escapes
    this.onDestinationReached = null;

    // State
    this.isPaused = false;
  }

  // ===================
  // MAIN UPDATE LOOP
  // ===================

  /**
   * Update AI state (call at fixed timestep)
   * @param {number} deltaTime - Time since last update (ms)
   * @param {number} currentTime - Current game time (ms)
   * @param {Map<string, Unit>} allUnits - All units in game
   * @param {Object} gameContext - Additional game context
   */
  update(deltaTime, currentTime, allUnits, gameContext = {}) {
    if (this.isPaused) return;
    if (!this.unit.isAlive()) return;

    // Update unit buffs and stun
    this.unit.updateBuffs(currentTime);
    this.unit.updateStun(currentTime);

    // Skip if stunned
    if (this.unit.isStunned) {
      this.unit.setState(UnitState.IDLE);
      return;
    }

    // State machine
    switch (this.unit.state) {
      case UnitState.IDLE:
        this._handleIdleState(deltaTime, currentTime, allUnits, gameContext);
        break;

      case UnitState.MOVE:
        this._handleMoveState(deltaTime, currentTime, allUnits, gameContext);
        break;

      case UnitState.ATTACK:
        this._handleAttackState(deltaTime, currentTime, allUnits, gameContext);
        break;

      case UnitState.COOLDOWN:
        this._handleCooldownState(deltaTime, currentTime, allUnits, gameContext);
        break;

      case UnitState.DEAD:
        // No updates for dead units
        break;
    }
  }

  // ===================
  // STATE HANDLERS
  // ===================

  _handleIdleState(deltaTime, currentTime, allUnits, context) {
    // Search for targets periodically
    if (currentTime - this.lastTargetSearch >= this.config.targetUpdateInterval) {
      this._searchForTarget(allUnits, currentTime);
    }

    // If we have a target, start moving/attacking
    if (this.unit.targetId) {
      const target = allUnits.get(this.unit.targetId);

      if (target && target.isAlive()) {
        if (this.unit.isUnitInRange(target)) {
          // Target in range - attack
          this.unit.setState(UnitState.ATTACK, currentTime);
        } else if (!this.config.holdPosition) {
          // Target out of range - move towards it
          this.unit.setState(UnitState.MOVE, currentTime);
        }
      } else {
        // Target dead or gone
        this.unit.clearTarget();
        if (this.onTargetLost) this.onTargetLost(this.unit);
      }
    } else if (this.destination) {
      // No target but have destination - move to it
      this.unit.setState(UnitState.MOVE, currentTime);
    }
  }

  _handleMoveState(deltaTime, currentTime, allUnits, context) {
    // Check for target periodically
    if (currentTime - this.lastTargetSearch >= this.config.targetUpdateInterval) {
      this._searchForTarget(allUnits, currentTime);
    }

    // Determine move target
    let moveTarget = null;

    if (this.unit.targetId) {
      const target = allUnits.get(this.unit.targetId);

      if (target && target.isAlive()) {
        // Check if in range to attack
        if (this.unit.isUnitInRange(target)) {
          this.unit.setState(UnitState.ATTACK, currentTime);
          return;
        }

        // Move towards target
        moveTarget = { x: target.position.x, z: target.position.z };
      } else {
        // Target gone
        this.unit.clearTarget();
        if (this.onTargetLost) this.onTargetLost(this.unit);
      }
    } else if (this.destination) {
      moveTarget = this.destination;
    }

    if (moveTarget) {
      // Move towards target
      this._moveTowards(moveTarget, deltaTime, context);

      // Check if reached destination
      if (this.destination) {
        const dist = this.unit.distanceTo(this.destination.x, this.destination.z);
        if (dist < 0.1) {
          this.destination = null;
          this.unit.setState(UnitState.IDLE, currentTime);
          if (this.onDestinationReached) this.onDestinationReached(this.unit);
        }
      }
    } else {
      // Nothing to move to
      this.unit.setState(UnitState.IDLE, currentTime);
    }
  }

  _handleAttackState(deltaTime, currentTime, allUnits, context) {
    const target = allUnits.get(this.unit.targetId);

    // Validate target
    if (!target || !target.isAlive()) {
      this.unit.clearTarget();
      this.unit.setState(UnitState.IDLE, currentTime);
      this.attackPhase = 'none';
      if (this.onTargetLost) this.onTargetLost(this.unit);
      return;
    }

    // Check if target still in range
    if (!this.unit.isUnitInRange(target)) {
      // Target moved out of range
      if (this.config.holdPosition) {
        this.unit.clearTarget();
        this.unit.setState(UnitState.IDLE, currentTime);
      } else {
        this.unit.setState(UnitState.MOVE, currentTime);
      }
      this.attackPhase = 'none';
      return;
    }

    // Face target
    this.unit.lookAtUnit(target);

    // Attack phases
    switch (this.attackPhase) {
      case 'none':
        // Start attack if cooldown ready
        if (this.unit.canAttack(currentTime)) {
          this.attackPhase = 'windup';
          this.attackStartTime = currentTime;
          this.unit.recordAttack(currentTime);
        } else {
          // Wait for cooldown
          this.unit.setState(UnitState.COOLDOWN, currentTime);
        }
        break;

      case 'windup':
        // Wait for windup time
        if (currentTime - this.attackStartTime >= this.config.attackWindupTime) {
          this.attackPhase = 'hit';
          this._applyAttackDamage(target, allUnits, context);
        }
        // Update attack progress for animation
        this.unit.attackProgress = (currentTime - this.attackStartTime) /
          (this.config.attackWindupTime + this.config.attackRecoveryTime);
        break;

      case 'hit':
        // Transition to recovery
        this.attackPhase = 'recovery';
        break;

      case 'recovery':
        // Wait for recovery time
        const totalAttackTime = this.config.attackWindupTime + this.config.attackRecoveryTime;
        if (currentTime - this.attackStartTime >= totalAttackTime) {
          this.attackPhase = 'none';
          this.unit.isAttacking = false;

          // Check if target still alive and in range
          if (target.isAlive() && this.unit.isUnitInRange(target)) {
            // Stay in attack state for next attack
          } else {
            this.unit.setState(UnitState.IDLE, currentTime);
          }
        }
        // Update attack progress
        this.unit.attackProgress = (currentTime - this.attackStartTime) / totalAttackTime;
        break;
    }
  }

  _handleCooldownState(deltaTime, currentTime, allUnits, context) {
    // Wait for attack cooldown
    if (this.unit.canAttack(currentTime)) {
      // Check if we still have a valid target
      const target = allUnits.get(this.unit.targetId);

      if (target && target.isAlive() && this.unit.isUnitInRange(target)) {
        this.unit.setState(UnitState.ATTACK, currentTime);
      } else {
        this.unit.setState(UnitState.IDLE, currentTime);
      }
    }
  }

  // ===================
  // MOVEMENT
  // ===================

  _moveTowards(target, deltaTime, context) {
    const dx = target.x - this.unit.position.x;
    const dz = target.z - this.unit.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 0.01) return;

    // Calculate movement speed (with buffs)
    const speed = this.unit.getEffectiveStat(this.unit.moveSpeed, 'speed');
    const moveDistance = speed * (deltaTime / 1000);

    // Normalize direction
    const dirX = dx / distance;
    const dirZ = dz / distance;

    // Calculate new position
    let newX, newZ;

    if (moveDistance >= distance) {
      // Would overshoot - clamp to target
      newX = target.x;
      newZ = target.z;
    } else {
      newX = this.unit.position.x + dirX * moveDistance;
      newZ = this.unit.position.z + dirZ * moveDistance;
    }

    // Grid movement snapping
    if (this.config.useGridMovement) {
      newX = Math.round(newX / this.config.gridSize) * this.config.gridSize;
      newZ = Math.round(newZ / this.config.gridSize) * this.config.gridSize;
    }

    // Collision check (if provided in context)
    if (context.checkCollision) {
      const collision = context.checkCollision(this.unit, newX, newZ);
      if (collision) {
        // Handle collision - could implement sliding along walls, etc.
        return;
      }
    }

    // Apply movement
    this.unit.setPosition(newX, newZ);

    // Update rotation to face movement direction
    this.unit.lookAt(target.x, target.z);
  }

  // ===================
  // TARGET SELECTION
  // ===================

  _searchForTarget(allUnits, currentTime) {
    this.lastTargetSearch = currentTime;

    if (this.targetSelector) {
      // Use custom target selector
      const newTarget = this.targetSelector.selectTarget(this.unit, allUnits);
      if (newTarget) {
        this.unit.setTarget(newTarget.id);
      }
    } else {
      // Default target selection
      this._defaultTargetSelection(allUnits);
    }
  }

  _defaultTargetSelection(allUnits) {
    let bestTarget = null;
    let bestScore = Infinity;

    for (const [id, other] of allUnits) {
      // Skip self, allies, and dead units
      if (other.id === this.unit.id) continue;
      if (other.owner === this.unit.owner) continue;
      if (!other.isAlive()) continue;

      // Check if can target this unit type
      if (other.isFlying && !this.unit.canTargetFlying) continue;
      if (!other.isFlying && !this.unit.canTargetGround) continue;

      // Check priority targets
      const targetType = other.isBuilding ? 'building' : 'unit';
      if (!this.unit.priorityTargets.includes(targetType)) continue;

      // Check aggro range
      const distance = this.unit.distanceToUnit(other);
      if (distance > this.config.aggroRange) continue;

      // Score based on priority
      let score = distance;

      switch (this.unit.targetPriority) {
        case TargetPriority.NEAREST:
          score = distance;
          break;

        case TargetPriority.LOWEST_HP:
          score = other.health;
          break;

        case TargetPriority.HIGHEST_HP:
          score = -other.health;
          break;

        case TargetPriority.BUILDINGS_ONLY:
          if (!other.isBuilding) continue;
          score = distance;
          break;

        case TargetPriority.UNITS_FIRST:
          score = other.isBuilding ? distance + 1000 : distance;
          break;
      }

      if (score < bestScore) {
        bestScore = score;
        bestTarget = other;
      }
    }

    if (bestTarget) {
      this.unit.setTarget(bestTarget.id);
    } else {
      this.unit.clearTarget();
    }
  }

  // ===================
  // COMBAT
  // ===================

  _applyAttackDamage(target, allUnits, context) {
    const damage = this.unit.getEffectiveStat(this.unit.damage, 'damage');

    // Splash damage
    if (this.unit.splashRadius > 0) {
      for (const [id, other] of allUnits) {
        if (other.owner === this.unit.owner) continue;
        if (!other.isAlive()) continue;

        const dist = other.distanceTo(target.position.x, target.position.z);
        if (dist <= this.unit.splashRadius) {
          // Full damage in center, reduced at edges
          const falloff = 1 - (dist / this.unit.splashRadius) * 0.5;
          other.takeDamage(damage * falloff, this.unit);
        }
      }
    } else {
      // Single target damage
      target.takeDamage(damage, this.unit);
    }

    // Callback
    if (this.onAttackHit) {
      this.onAttackHit(this.unit, target, damage);
    }

    // Retarget if target died
    if (!target.isAlive() && this.config.retargetOnKill) {
      this.unit.clearTarget();
      this._searchForTarget(allUnits, Date.now());
    }
  }

  // ===================
  // PUBLIC API
  // ===================

  /**
   * Set a custom target selector
   */
  setTargetSelector(selector) {
    this.targetSelector = selector;
    return this;
  }

  /**
   * Command unit to move to a position
   */
  moveTo(x, z) {
    this.destination = { x, z };
    this.unit.setState(UnitState.MOVE);
    return this;
  }

  /**
   * Command unit to attack a specific target
   */
  attackTarget(targetId) {
    this.unit.setTarget(targetId);
    return this;
  }

  /**
   * Stop all actions
   */
  stop() {
    this.destination = null;
    this.unit.clearTarget();
    this.unit.setState(UnitState.IDLE);
    return this;
  }

  /**
   * Pause AI updates
   */
  pause() {
    this.isPaused = true;
    return this;
  }

  /**
   * Resume AI updates
   */
  resume() {
    this.isPaused = false;
    return this;
  }

  /**
   * Set hold position mode
   */
  setHoldPosition(hold) {
    this.config.holdPosition = hold;
    return this;
  }
}

// ===================
// AI MANAGER
// ===================

/**
 * Manages multiple UnitAI instances
 * Provides centralized update loop
 */
export class AIManager {
  constructor() {
    this.ais = new Map();  // unitId -> UnitAI
    this.isPaused = false;
  }

  /**
   * Register a unit with AI
   */
  register(unit, config = {}) {
    const ai = new UnitAI(unit, config);
    this.ais.set(unit.id, ai);
    return ai;
  }

  /**
   * Unregister a unit
   */
  unregister(unitId) {
    this.ais.delete(unitId);
  }

  /**
   * Get AI for a unit
   */
  getAI(unitId) {
    return this.ais.get(unitId);
  }

  /**
   * Update all AIs (call at fixed timestep)
   */
  update(deltaTime, currentTime, allUnits, context = {}) {
    if (this.isPaused) return;

    for (const [id, ai] of this.ais) {
      // Skip if unit is dead
      if (!ai.unit.isAlive()) {
        continue;
      }

      ai.update(deltaTime, currentTime, allUnits, context);
    }
  }

  /**
   * Remove dead units
   */
  cleanup() {
    for (const [id, ai] of this.ais) {
      if (!ai.unit.isAlive()) {
        this.ais.delete(id);
      }
    }
  }

  /**
   * Pause all AIs
   */
  pauseAll() {
    this.isPaused = true;
  }

  /**
   * Resume all AIs
   */
  resumeAll() {
    this.isPaused = false;
  }

  /**
   * Get count of active AIs
   */
  getCount() {
    return this.ais.size;
  }

  /**
   * Clear all AIs
   */
  clear() {
    this.ais.clear();
  }
}
