/**
 * UNIT - Core Unit Data Structure
 *
 * Represents a game unit with:
 * - Identity (id, owner, type)
 * - Stats (health, damage, speed, range)
 * - State (position, target, current state)
 * - Combat (attack cooldown, last attack time)
 *
 * This is a pure data class - no behavior logic.
 * Behavior is handled by UnitAI.
 */

// ===================
// UNIT STATES
// ===================

export const UnitState = {
  IDLE: 'idle',
  MOVE: 'move',
  ATTACK: 'attack',
  COOLDOWN: 'cooldown',
  DEAD: 'dead'
};

// ===================
// UNIT TYPES
// ===================

export const UnitType = {
  MELEE: 'melee',
  RANGED: 'ranged',
  FLYING: 'flying',
  BUILDING: 'building'
};

// ===================
// TARGETING PRIORITY
// ===================

export const TargetPriority = {
  NEAREST: 'nearest',
  LOWEST_HP: 'lowest_hp',
  HIGHEST_HP: 'highest_hp',
  BUILDINGS_ONLY: 'buildings_only',
  UNITS_FIRST: 'units_first'
};

// ===================
// UNIT CLASS
// ===================

export class Unit {
  /**
   * @param {Object} config - Unit configuration
   */
  constructor(config) {
    // Identity
    this.id = config.id || this._generateId();
    this.owner = config.owner;           // Player number (1 or 2)
    this.cardId = config.cardId;         // Source card ID
    this.unitType = config.unitType || UnitType.MELEE;

    // Stats (base values)
    this.maxHealth = config.maxHealth || 100;
    this.health = config.health ?? this.maxHealth;
    this.damage = config.damage || 10;
    this.attackSpeed = config.attackSpeed || 1.0;  // Attacks per second
    this.moveSpeed = config.moveSpeed || 1.0;      // Units per second
    this.range = config.range || 1.0;              // Attack range
    this.splashRadius = config.splashRadius || 0;  // 0 = no splash

    // Hitbox
    this.hitboxRadius = config.hitboxRadius || 0.4;

    // Position & Movement
    this.position = {
      x: config.x ?? 0,
      z: config.z ?? 0
    };
    this.targetPosition = null;  // Where unit is moving to
    this.rotation = config.rotation ?? 0;  // Facing direction (radians)

    // Visual interpolation (client-side)
    this.visualPosition = { ...this.position };
    this.visualRotation = this.rotation;

    // State Machine
    this.state = UnitState.IDLE;
    this.previousState = null;
    this.stateStartTime = 0;

    // Targeting
    this.targetId = null;              // Current target unit ID
    this.targetPriority = config.targetPriority || TargetPriority.NEAREST;
    this.canTargetFlying = config.canTargetFlying !== false;
    this.canTargetGround = config.canTargetGround !== false;
    this.priorityTargets = config.priorityTargets || ['unit', 'building'];

    // Combat
    this.lastAttackTime = 0;
    this.attackCooldown = 1000 / this.attackSpeed;  // ms between attacks
    this.isAttacking = false;
    this.attackProgress = 0;  // 0-1 for animation

    // Flags
    this.isFlying = config.isFlying || false;
    this.isBuilding = config.isBuilding || false;
    this.isInvulnerable = false;
    this.isStunned = false;
    this.stunEndTime = 0;

    // Buffs/Debuffs
    this.buffs = new Map();  // buffId -> { type, value, endTime }

    // Spawn time
    this.spawnTime = config.spawnTime || Date.now();

    // Death
    this.deathTime = null;
  }

  // ===================
  // STATE MANAGEMENT
  // ===================

  /**
   * Change unit state
   */
  setState(newState, time = Date.now()) {
    if (this.state === newState) return;
    if (this.state === UnitState.DEAD) return;  // Can't change from dead

    this.previousState = this.state;
    this.state = newState;
    this.stateStartTime = time;

    if (newState === UnitState.DEAD) {
      this.deathTime = time;
    }
  }

  /**
   * Check if unit is in a specific state
   */
  isInState(state) {
    return this.state === state;
  }

  /**
   * Get time spent in current state
   */
  getStateTime(currentTime = Date.now()) {
    return currentTime - this.stateStartTime;
  }

  // ===================
  // HEALTH & DAMAGE
  // ===================

  /**
   * Apply damage to unit
   * @returns {number} Actual damage dealt
   */
  takeDamage(amount, source = null) {
    if (this.isInvulnerable || this.state === UnitState.DEAD) {
      return 0;
    }

    const actualDamage = Math.min(this.health, amount);
    this.health -= actualDamage;

    if (this.health <= 0) {
      this.health = 0;
      this.setState(UnitState.DEAD);
    }

    return actualDamage;
  }

  /**
   * Heal the unit
   * @returns {number} Actual healing done
   */
  heal(amount) {
    if (this.state === UnitState.DEAD) return 0;

    const actualHeal = Math.min(this.maxHealth - this.health, amount);
    this.health += actualHeal;
    return actualHeal;
  }

  /**
   * Check if unit is alive
   */
  isAlive() {
    return this.state !== UnitState.DEAD && this.health > 0;
  }

  /**
   * Get health percentage
   */
  getHealthPercent() {
    return this.health / this.maxHealth;
  }

  // ===================
  // POSITION & MOVEMENT
  // ===================

  /**
   * Set unit position
   */
  setPosition(x, z) {
    this.position.x = x;
    this.position.z = z;
  }

  /**
   * Get distance to a point
   */
  distanceTo(x, z) {
    const dx = this.position.x - x;
    const dz = this.position.z - z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Get distance to another unit
   */
  distanceToUnit(other) {
    return this.distanceTo(other.position.x, other.position.z);
  }

  /**
   * Check if a point is within attack range
   */
  isInRange(x, z) {
    return this.distanceTo(x, z) <= this.range;
  }

  /**
   * Check if another unit is within attack range
   */
  isUnitInRange(other) {
    const distance = this.distanceToUnit(other);
    const combinedRadius = this.hitboxRadius + other.hitboxRadius;
    return distance - combinedRadius <= this.range;
  }

  /**
   * Set movement target
   */
  setMoveTarget(x, z) {
    this.targetPosition = { x, z };
    if (this.state !== UnitState.ATTACK) {
      this.setState(UnitState.MOVE);
    }
  }

  /**
   * Clear movement target
   */
  clearMoveTarget() {
    this.targetPosition = null;
  }

  /**
   * Face towards a point
   */
  lookAt(x, z) {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    this.rotation = Math.atan2(dx, dz);
  }

  /**
   * Face towards another unit
   */
  lookAtUnit(other) {
    this.lookAt(other.position.x, other.position.z);
  }

  // ===================
  // COMBAT
  // ===================

  /**
   * Set attack target
   */
  setTarget(targetId) {
    this.targetId = targetId;
  }

  /**
   * Clear attack target
   */
  clearTarget() {
    this.targetId = null;
  }

  /**
   * Check if can attack (cooldown ready)
   */
  canAttack(currentTime = Date.now()) {
    if (this.state === UnitState.DEAD) return false;
    if (this.isStunned && currentTime < this.stunEndTime) return false;
    return currentTime - this.lastAttackTime >= this.attackCooldown;
  }

  /**
   * Record an attack
   */
  recordAttack(currentTime = Date.now()) {
    this.lastAttackTime = currentTime;
    this.isAttacking = true;
    this.attackProgress = 0;
  }

  /**
   * Get attack cooldown progress (0-1)
   */
  getAttackCooldownProgress(currentTime = Date.now()) {
    const elapsed = currentTime - this.lastAttackTime;
    return Math.min(1, elapsed / this.attackCooldown);
  }

  // ===================
  // BUFFS & DEBUFFS
  // ===================

  /**
   * Apply a buff/debuff
   */
  applyBuff(buffId, type, value, duration) {
    this.buffs.set(buffId, {
      type,
      value,
      startTime: Date.now(),
      endTime: Date.now() + duration
    });
  }

  /**
   * Remove a buff/debuff
   */
  removeBuff(buffId) {
    this.buffs.delete(buffId);
  }

  /**
   * Check and remove expired buffs
   */
  updateBuffs(currentTime = Date.now()) {
    for (const [id, buff] of this.buffs) {
      if (currentTime >= buff.endTime) {
        this.buffs.delete(id);
      }
    }
  }

  /**
   * Get total buff value for a type
   */
  getBuffValue(type) {
    let total = 0;
    for (const buff of this.buffs.values()) {
      if (buff.type === type) {
        total += buff.value;
      }
    }
    return total;
  }

  /**
   * Get effective stat with buffs
   */
  getEffectiveStat(baseStat, buffType) {
    const buffValue = this.getBuffValue(buffType);
    return baseStat * (1 + buffValue);
  }

  // ===================
  // STUN
  // ===================

  /**
   * Stun the unit
   */
  stun(duration) {
    this.isStunned = true;
    this.stunEndTime = Date.now() + duration;
    this.setState(UnitState.IDLE);
  }

  /**
   * Check if stun has ended
   */
  updateStun(currentTime = Date.now()) {
    if (this.isStunned && currentTime >= this.stunEndTime) {
      this.isStunned = false;
    }
  }

  // ===================
  // SERIALIZATION
  // ===================

  /**
   * Serialize for network transmission
   */
  serialize() {
    return {
      id: this.id,
      owner: this.owner,
      cardId: this.cardId,
      unitType: this.unitType,
      health: this.health,
      maxHealth: this.maxHealth,
      position: { ...this.position },
      rotation: this.rotation,
      state: this.state,
      targetId: this.targetId,
      isFlying: this.isFlying
    };
  }

  /**
   * Create unit from serialized data
   */
  static deserialize(data) {
    const unit = new Unit({
      id: data.id,
      owner: data.owner,
      cardId: data.cardId,
      unitType: data.unitType,
      maxHealth: data.maxHealth,
      health: data.health,
      x: data.position.x,
      z: data.position.z,
      rotation: data.rotation,
      isFlying: data.isFlying
    });
    unit.state = data.state;
    unit.targetId = data.targetId;
    return unit;
  }

  // ===================
  // HELPERS
  // ===================

  _generateId() {
    return `unit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clone the unit
   */
  clone() {
    return Unit.deserialize(this.serialize());
  }

  /**
   * Debug string
   */
  toString() {
    return `Unit[${this.id}] ${this.cardId} HP:${this.health}/${this.maxHealth} State:${this.state}`;
  }
}
